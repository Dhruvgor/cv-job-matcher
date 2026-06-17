#!/usr/bin/env python3
"""
CV Job Matcher — FastAPI Backend
- Auth: register, login, logout (JWT sessions)
- Per-user Gemini API key stored in SQLite
- POST /api/search   : Parse CV + run Gemini with Google Search Grounding
- POST /api/tailor   : Rewrite CV for a specific job
- POST /api/download : Generate polished PDF of tailored CV
"""

import io
import json
import os
import re
import sqlite3
import textwrap
from datetime import datetime, timedelta
from typing import Optional

import uvicorn
from fastapi import FastAPI, File, Form, HTTPException, UploadFile, Depends, Cookie
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from fpdf import FPDF
from pypdf import PdfReader
import bcrypt as _bcrypt_lib
from jose import JWTError, jwt
from google import genai
from google.genai import types as genai_types
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request as StarletteRequest

# ── Security ───────────────────────────────────────────────────────────────────
SECRET_KEY = os.environ.get("JWT_SECRET", "cv-job-matcher-super-secret-key-change-in-prod")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 72

# ── Database (Ensured persistent location for cloud infrastructure) ────────────
if os.path.exists("/tmp"):
    DB_PATH = "/tmp/cv_matcher.db"  # Use writable container storage if available
else:
    DB_PATH = os.path.join(os.path.dirname(__file__), "cv_matcher.db")

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            hashed_password TEXT NOT NULL,
            gemini_api_key TEXT DEFAULT NULL,
            created_at TEXT DEFAULT (datetime('now'))
        )
    """)
    conn.commit()
    conn.close()

# ── App Initialization ─────────────────────────────────────────────────────────
app = FastAPI(title="CV Job Matcher API", version="2.0.0")

# ── Safe Production CORS Configuration ─────────────────────────────────────────
class CredentialCORSMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: StarletteRequest, call_next):
        origin = request.headers.get("origin", "")
        response = await call_next(request)
        if origin:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
            response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With, X-Auth-Token"
        
        # Fast response to preflight checks without letting execution pipeline drop
        if request.method == "OPTIONS":
            return JSONResponse(content="OK", headers=response.headers)
            
        return response

app.add_middleware(CredentialCORSMiddleware)

@app.on_event("startup")
def startup():
    init_db()

# ── Auth Helpers ───────────────────────────────────────────────────────────────
def hash_password(password: str) -> str:
    return _bcrypt_lib.hashpw(password.encode(), _bcrypt_lib.gensalt()).decode()

def verify_password(plain: str, hashed: str) -> bool:
    try:
        return _bcrypt_lib.checkpw(plain.encode(), hashed.encode())
    except Exception:
        return False

def create_token(user_id: int, email: str) -> str:
    expire = datetime.utcnow() + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    return jwt.encode(
        {"sub": str(user_id), "email": email, "exp": expire},
        SECRET_KEY, algorithm=ALGORITHM
    )

def get_current_user(authorization: Optional[str] = None, token: Optional[str] = Cookie(default=None)):
    raw = None
    if authorization and authorization.startswith("Bearer "):
        raw = authorization[7:]
    elif token:
        raw = token

    if not raw:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        payload = jwt.decode(raw, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    conn = get_db()
    row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=401, detail="User not found")
    return dict(row)

from fastapi import Header
def auth_required(
    authorization: Optional[str] = Header(default=None),
    token: Optional[str] = Cookie(default=None)
):
    return get_current_user(authorization=authorization, token=token)

# ── PDF Utilities ──────────────────────────────────────────────────────────────
def extract_pdf_text(file_bytes: bytes) -> str:
    reader = PdfReader(io.BytesIO(file_bytes))
    return "\n".join(page.extract_text() or "" for page in reader.pages).strip()

def _safe(text: str) -> str:
    replacements = {
        "\u2013": "-", "\u2014": "-", "\u2018": "'", "\u2019": "'",
        "\u201c": '"', "\u201d": '"', "\u2022": "*", "\u00a3": "GBP",
        "\u20ac": "EUR", "\u00b7": "*", "\u2026": "...",
    }
    for char, replacement in replacements.items():
        text = text.replace(char, replacement)
    return text.encode("latin-1", errors="replace").decode("latin-1")

def generate_pdf(cv_text: str, job_title: str, company: str) -> bytes:
    pdf = FPDF()
    pdf.set_margins(20, 20, 20)
    pdf.add_page()

    pdf.set_font("Helvetica", "B", 18)
    lines = cv_text.strip().split("\n")
    name_line = _safe(lines[0]) if lines else "Tailored CV"
    pdf.cell(0, 10, name_line, new_x="LMARGIN", new_y="NEXT", align="C")

    pdf.set_font("Helvetica", "I", 10)
    pdf.set_text_color(80, 80, 80)
    pdf.cell(0, 6, _safe(f"Tailored for: {job_title} at {company}"),
             new_x="LMARGIN", new_y="NEXT", align="C")

    pdf.set_draw_color(1, 105, 111)
    pdf.set_line_width(0.8)
    pdf.line(20, pdf.get_y() + 3, 190, pdf.get_y() + 3)
    pdf.ln(7)

    pdf.set_text_color(30, 30, 30)
    remaining = "\n".join(lines[1:]) if len(lines) > 1 else cv_text

    for raw_line in remaining.split("\n"):
        line = _safe(raw_line.strip())
        if not line:
            pdf.ln(3)
            continue

        if (line.isupper() and len(line) > 3) or (line.endswith(":") and len(line) < 50):
            pdf.ln(2)
            pdf.set_font("Helvetica", "B", 11)
            pdf.set_text_color(1, 105, 111)
            pdf.cell(0, 7, line, new_x="LMARGIN", new_y="NEXT")
            pdf.set_text_color(30, 30, 30)
        else:
            pdf.set_font("Helvetica", "", 9)
            wrapped = textwrap.wrap(line, width=100)
            for wl in wrapped:
                pdf.cell(0, 5, wl, new_x="LMARGIN", new_y="NEXT")

    return bytes(pdf.output())

# ── JSON Extraction ────────────────────────────────────────────────────────────
def extract_json_from_response(text: str) -> list:
    """Robustly extract a JSON array from LLM output."""
    # Constructed dynamically to prevent local markdown block parsing bugs
    triple_backticks = "`" * 3
    pattern = rf"{triple_backticks}(?:json)?"
    
    text = re.sub(pattern, "", text).strip()
    start = text.find("[")
    if start == -1:
        raise ValueError("No JSON array found in response")

    depth = 0
    for i, ch in enumerate(text[start:], start):
        if ch == "[":
            depth += 1
        elif ch == "]":
            depth -= 1
            if depth == 0:
                candidate = text[start : i + 1]
                try:
                    return json.loads(candidate)
                except json.JSONDecodeError as e:
                    raise ValueError(f"JSON parse error: {e}")
    raise ValueError("Unterminated JSON array")

# ── Gemini LLM Call ────────────────────────────────────────────────────────────
def call_gemini(api_key: str, system: str, user: str) -> str:
    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=user,
        config=genai_types.GenerateContentConfig(
            system_instruction=system,
            tools=[genai_types.Tool(google_search=genai_types.GoogleSearch())],
            temperature=0.3,
        ),
    )
    return response.text or ""

# ══════════════════════════════════════════════════════════════════════════════
# API ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@app.post("/api/register")
async def register(email: str = Form(...), password: str = Form(...)):
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    if "@" not in email:
        raise HTTPException(status_code=400, detail="Invalid email address")

    conn = get_db()
    existing = conn.execute("SELECT id FROM users WHERE email = ?", (email.lower(),)).fetchone()
    if existing:
        conn.close()
        raise HTTPException(status_code=409, detail="An account with this email already exists")

    hashed = hash_password(password)
    cursor = conn.execute(
        "INSERT INTO users (email, hashed_password) VALUES (?, ?)",
        (email.lower(), hashed)
    )
    user_id = cursor.lastrowid
    conn.commit()
    conn.close()

    token = create_token(user_id, email.lower())
    response = JSONResponse({"message": "Account created", "email": email.lower(), "id": user_id})
    response.set_cookie("token", token, httponly=True, max_age=60 * 60 * 72, samesite="lax")
    response.headers["X-Auth-Token"] = token
    return response

@app.post("/api/login")
async def login(email: str = Form(...), password: str = Form(...)):
    conn = get_db()
    row = conn.execute("SELECT * FROM users WHERE email = ?", (email.lower(),)).fetchone()
    conn.close()

    if not row or not verify_password(password, row["hashed_password"]):
        raise HTTPException(status_code=401, detail="Incorrect email or password")

    token = create_token(row["id"], row["email"])
    response = JSONResponse({
        "message": "Logged in",
        "email": row["email"],
        "id": row["id"],
        "has_gemini_key": bool(row["gemini_api_key"])
    })
    response.set_cookie("token", token, httponly=True, max_age=60 * 60 * 72, samesite="lax")
    response.headers["X-Auth-Token"] = token
    return response

@app.post("/api/logout")
async def logout():
    response = JSONResponse({"message": "Logged out"})
    response.delete_cookie("token")
    return response

@app.get("/api/me")
async def me(user=Depends(auth_required)):
    return {
        "id": user["id"],
        "email": user["email"],
        "has_gemini_key": bool(user["gemini_api_key"]),
        "created_at": user["created_at"],
    }

@app.post("/api/user/gemini-key")
async def save_gemini_key(gemini_api_key: str = Form(...), user=Depends(auth_required)):
    try:
        client = genai.Client(api_key=gemini_api_key)
        client.models.generate_content(
            model="gemini-2.5-flash",
            contents="Reply with just the word: ok",
            config=genai_types.GenerateContentConfig(temperature=0.0),
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Gemini API key is invalid: {e}")

    conn = get_db()
    conn.execute("UPDATE users SET gemini_api_key = ? WHERE id = ?", (gemini_api_key, user["id"]))
    conn.commit()
    conn.close()
    return {"message": "Gemini API key saved successfully"}

@app.delete("/api/user/gemini-key")
async def remove_gemini_key(user=Depends(auth_required)):
    conn = get_db()
    conn.execute("UPDATE users SET gemini_api_key = NULL WHERE id = ?", (user["id"],))
    conn.commit()
    conn.close()
    return {"message": "Gemini API key removed"}

def require_gemini_key(user=Depends(auth_required)):
    if not user.get("gemini_api_key"):
        raise HTTPException(status_code=402, detail="No Gemini API key found.")
    return user

@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "2.0.0", "ai": "gemini-2.5-flash"}

@app.post("/api/search")
async def search_jobs(cv_file: UploadFile = File(...), prompt: str = Form(...), user=Depends(require_gemini_key)):
    cv_bytes = await cv_file.read()
    try:
        cv_text = extract_pdf_text(cv_bytes)
    except Exception:
        raise HTTPException(status_code=400, detail="Could not read PDF.")

    system_instruction = textwrap.dedent("""
        You are an expert job search assistant with access to Google Search.
        Return ONLY a valid JSON array. Each object must have EXACTLY these keys:
        {
          "job_title": "...", "company": "...", "location": "...", "salary": "...",
          "match_percentage": 85, "source_url": "https://...", "full_description": "..."
        }
    """)
    user_message = f"CV:\n{cv_text[:3000]}\n\nJob Search Request: {prompt}"
    result_text = call_gemini(user["gemini_api_key"], system_instruction, user_message)
    jobs = extract_json_from_response(result_text)
    return {"jobs": jobs, "cv_text": cv_text}

@app.post("/api/tailor")
async def tailor_cv(
    cv_text: str = Form(...), job_title: str = Form(...), 
    company: str = Form(...), job_description: str = Form(...), user=Depends(require_gemini_key)
):
    system_instruction = "Tailor the candidate's CV professionally for the role. Return ONLY plain text."
    user_message = f"Role: {job_title} at {company}\nJD:\n{job_description}\nCV:\n{cv_text}"
    tailored = call_gemini(user["gemini_api_key"], system_instruction, user_message)
    return {"tailored_cv": tailored.strip()}

@app.post("/api/download")
async def download_cv(cv_text: str = Form(...), job_title: str = Form(...), company: str = Form(...), user=Depends(auth_required)):
    pdf_bytes = generate_pdf(cv_text, job_title, company)
    safe_title = re.sub(r"[^\w\-]", "_", f"{job_title}_{company}_CV")
    return StreamingResponse(io.BytesIO(pdf_bytes), media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="{safe_title}.pdf"'})

# ── Dynamic Port Binding (Crucial for Google Cloud Run) ──────────────────────
if __name__ == "__main__":
    cloud_port = int(os.environ.get("PORT", 8080))
    uvicorn.run("api_server:app", host="0.0.0.0", port=cloud_port, log_level="info")
