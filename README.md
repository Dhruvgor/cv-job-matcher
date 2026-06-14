# CV Job Matcher 🎯

An AI-powered web application that lets anyone upload their CV, search for real job listings using Google Gemini with live Search Grounding, get a personalised match score for each role, and download a professionally rewritten, job-specific CV as a PDF — all for free.

> Built for job seekers who want smarter applications, not more applications.

---

## ✨ Features

- **Register & Login** — secure email/password accounts with JWT authentication
- **Bring Your Own Gemini Key** — each user connects their own free Google Gemini API key; no shared quota, no cost to you as the host
- **Real-time Job Search** — Gemini 2.5 Flash with Google Search Grounding fetches live job listings matching your prompt
- **CV Match Scoring** — every listing gets a 0–100% compatibility score against your uploaded CV
- **One-click CV Tailoring** — Gemini rewrites your CV to mirror the language, priorities, and keywords of any selected role
- **PDF Download** — polished, downloadable PDF of your tailored CV generated on the fly
- **Dark Mode** — full light/dark theme support
- **Mobile Responsive** — works on all screen sizes

---

## 🗂 Project Structure

```
cv-job-matcher/
├── api_server.py          # FastAPI backend — all API endpoints
├── requirements.txt       # Python dependencies
├── .env.example           # Environment variable template
│
├── client/                # React frontend (Vite + TypeScript)
│   ├── index.html
│   └── src/
│       ├── App.tsx        # Full frontend — auth, search, results, settings
│       ├── index.css      # Teal/beige theme (CSS variables)
│       ├── main.tsx
│       ├── components/ui/ # shadcn/ui component library
│       ├── hooks/         # use-toast, use-mobile
│       └── lib/           # queryClient, utils
│
├── server/                # Express dev server (Vite middleware)
│   ├── index.ts
│   ├── routes.ts
│   └── vite.ts
│
├── shared/
│   └── schema.ts          # TypeScript interfaces shared across frontend/backend
│
├── package.json           # Node dependencies & build scripts
├── tailwind.config.ts     # Tailwind CSS v3 config
├── tsconfig.json
└── vite.config.ts
```

---

## 🚀 Getting Started (Local Development)

### Prerequisites

- **Node.js** 18+ and **npm**
- **Python** 3.11+
- A free [Google Gemini API key](https://aistudio.google.com/apikey)

### 1. Clone the repo

```bash
git clone https://github.com/Dhruvgor/cv-job-matcher.git
cd cv-job-matcher
```

### 2. Set up the backend

```bash
# Install Python dependencies
pip install -r requirements.txt

# Copy the environment template
cp .env.example .env

# Edit .env and set your JWT_SECRET
# (users supply their own Gemini keys via the UI — no key needed here)
```

### 3. Set up the frontend

```bash
npm install
```

### 4. Run both servers

**Terminal 1 — Backend (FastAPI on port 8000):**
```bash
python3 api_server.py
```

**Terminal 2 — Frontend (Vite dev server on port 5000):**
```bash
npm run dev
```

Open [http://localhost:5000](http://localhost:5000) in your browser.

---

## 🔑 How the Gemini API Key Works

This app follows a **Bring Your Own Key** model:

1. Each user registers an account on the app
2. After logging in, they go to **Settings** and paste their own Gemini API key
3. The key is verified immediately (a test call is made to Gemini) then stored in the database
4. All AI calls (job search, CV tailoring) use **that user's own key** — not a shared key

This means:
- You can host this for free without worrying about API costs
- Each user gets Gemini's **free tier**: 1,500 requests/day
- Users can remove their key at any time from Settings

**Get a free Gemini API key:** [https://aistudio.google.com/apikey](https://aistudio.google.com/apikey)

---

## 🌐 API Endpoints

All endpoints are on the FastAPI backend (default: `http://localhost:8000`).

### Auth

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/register` | Create account (`email`, `password` form fields) |
| `POST` | `/api/login` | Sign in — returns JWT in `X-Auth-Token` header |
| `POST` | `/api/logout` | Clear session cookie |
| `GET`  | `/api/me` | Get current user info (requires auth) |

### Gemini Key Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST`   | `/api/user/gemini-key` | Save & verify a Gemini API key |
| `DELETE` | `/api/user/gemini-key` | Remove saved key |

### Core Features

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/search` | Upload CV + prompt → returns job listings with match scores |
| `POST` | `/api/tailor` | Rewrite CV for a specific job description |
| `POST` | `/api/download` | Generate and stream a PDF of the tailored CV |
| `GET`  | `/api/health` | Health check |

**Authentication:** Pass the JWT as a `Bearer` token in the `Authorization` header:
```
Authorization: Bearer <token>
```

---

## 🏗 Deploying to Production

### Frontend → Vercel

```bash
npm run build
# Deploy the dist/public folder to Vercel
```

Or connect your GitHub repo to Vercel — it auto-detects Vite and deploys on every push.

Set the build output directory to `dist/public`.

### Backend → Render

1. Create a new **Web Service** on [Render](https://render.com)
2. Connect this GitHub repo
3. Set:
   - **Runtime:** Python 3
   - **Build command:** `pip install -r requirements.txt`
   - **Start command:** `uvicorn api_server:app --host 0.0.0.0 --port $PORT`
4. Add environment variable: `JWT_SECRET` → your secret string
5. Deploy

Update the `API` constant in `client/src/App.tsx` to point to your Render backend URL.

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS v3 + shadcn/ui |
| Icons | Lucide React |
| Backend | Python FastAPI + Uvicorn |
| Auth | JWT (python-jose) + bcrypt |
| Database | SQLite (via Python `sqlite3`) |
| AI / Search | Google Gemini 2.5 Flash + Google Search Grounding |
| PDF Parsing | pypdf |
| PDF Generation | fpdf2 |

---

## 🔒 Security Notes

- Passwords are hashed with **bcrypt** before storage — never stored in plain text
- JWTs expire after **72 hours**
- Gemini API keys are stored in the SQLite database — in production, consider encrypting them at rest
- Set a strong, random `JWT_SECRET` in production (see `.env.example`)
- The SQLite database (`cv_matcher.db`) is excluded from git via `.gitignore`

---

## 📄 Licence

MIT — free to use, modify, and distribute.

---

Built by [Dhruv Gor](https://github.com/Dhruvgor) · Powered by Google Gemini 2.5 Flash
