import { useState, useEffect, useCallback, createContext, useContext } from "react";
import { Switch, Route, Router, useLocation } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import {
  Upload, Search, ChevronRight, X, ExternalLink, Download,
  RefreshCw, Moon, Sun, CheckCircle, Briefcase, MapPin,
  DollarSign, Sparkles, LogOut, Settings, KeyRound, Eye, EyeOff,
  UserPlus, LogIn, ArrowLeft, ShieldCheck, Loader2, Trash2
} from "lucide-react";
import type { JobListing } from "@shared/schema";

// ── API base ─────────────────────────────────────────────────────────────────
const API = "__PORT_8000__".startsWith("__") ? "http://127.0.0.1:8000" : "__PORT_8000__";

// ── Auth Context ─────────────────────────────────────────────────────────────
interface AuthUser { id: number; email: string; has_gemini_key: boolean }
interface AuthCtx {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx>({} as AuthCtx);
const useAuth = () => useContext(AuthContext);

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // On every page load, try to restore session via httpOnly cookie
  useEffect(() => {
    fetch(`${API}/api/me`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setUser(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`${API}/api/me`, { credentials: "include", headers });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      } else {
        setToken(null);
        setUser(null);
      }
    } catch { setUser(null); }
  }, [token]);

  const login = async (email: string, password: string) => {
    const fd = new FormData();
    fd.append("email", email);
    fd.append("password", password);
    const res = await fetch(`${API}/api/login`, { method: "POST", body: fd, credentials: "include" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Login failed");
    const tok = res.headers.get("X-Auth-Token") || data.token;
    if (tok) setToken(tok);
    setUser({ id: data.id, email: data.email, has_gemini_key: data.has_gemini_key });
  };

  const register = async (email: string, password: string) => {
    const fd = new FormData();
    fd.append("email", email);
    fd.append("password", password);
    const res = await fetch(`${API}/api/register`, { method: "POST", body: fd, credentials: "include" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Registration failed");
    const tok = res.headers.get("X-Auth-Token") || data.token;
    if (tok) setToken(tok);
    setUser({ id: data.id, email: data.email, has_gemini_key: false });
  };

  const logout = () => {
    fetch(`${API}/api/logout`, { method: "POST", credentials: "include" });
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

// ── Theme ─────────────────────────────────────────────────────────────────────
function useTheme() {
  const [dark, setDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);
  return { dark, toggle: () => setDark(d => !d) };
}

// ── Shared Components ─────────────────────────────────────────────────────────
function Logo() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-label="CV Job Matcher" className="shrink-0">
      <rect width="28" height="28" rx="7" fill="#01696F" />
      <path d="M7 9h8M7 13h6M7 17h4" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <circle cx="19" cy="17" r="4" stroke="white" strokeWidth="1.8" />
      <path d="M22 20l2.5 2.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function NavBar({ onSettings }: { onSettings?: () => void }) {
  const { user, logout } = useAuth();
  const { dark, toggle } = useTheme();
  const [, navigate] = useLocation();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <button onClick={() => navigate("/")} className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
          <Logo />
          <span className="font-semibold text-sm text-foreground tracking-tight">CV Job Matcher</span>
        </button>
        <div className="flex items-center gap-2">
          {user && (
            <>
              <span className="hidden sm:block text-xs text-muted-foreground mr-1">{user.email}</span>
              {onSettings && (
                <button onClick={onSettings} className="p-2 rounded-lg hover:bg-accent transition-colors" title="Settings">
                  <Settings size={16} className="text-muted-foreground" />
                </button>
              )}
              <button onClick={logout} className="p-2 rounded-lg hover:bg-accent transition-colors" title="Log out">
                <LogOut size={16} className="text-muted-foreground" />
              </button>
            </>
          )}
          <button
            onClick={toggle}
            className="p-2 rounded-lg hover:bg-accent transition-colors"
            aria-label="Toggle dark mode"
            data-testid="button-dark-mode"
          >
            {dark ? <Sun size={16} className="text-muted-foreground" /> : <Moon size={16} className="text-muted-foreground" />}
          </button>
        </div>
      </div>
    </header>
  );
}

// ── Auth Page (Login + Register) ──────────────────────────────────────────────
function AuthPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { dark, toggle } = useTheme();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register(email, password);
      }
      navigate("/");
    } catch (err: any) {
      toast({ title: mode === "login" ? "Login failed" : "Registration failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Logo />
            <span className="font-semibold text-sm tracking-tight">CV Job Matcher</span>
          </div>
          <button onClick={toggle} className="p-2 rounded-lg hover:bg-accent transition-colors">
            {dark ? <Sun size={16} className="text-muted-foreground" /> : <Moon size={16} className="text-muted-foreground" />}
          </button>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Card */}
          <div className="bg-card border border-border rounded-2xl p-8 shadow-sm">
            <div className="flex justify-center mb-6">
              <Logo />
            </div>
            <h1 className="text-xl font-bold text-center text-foreground mb-1">
              {mode === "login" ? "Welcome back" : "Create your account"}
            </h1>
            <p className="text-sm text-muted-foreground text-center mb-6">
              {mode === "login"
                ? "Sign in to your CV Job Matcher account"
                : "Start matching your CV to real job listings"}
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  data-testid="input-email"
                  className="mt-1.5 w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Password</label>
                <div className="relative mt-1.5">
                  <input
                    type={showPw ? "text" : "password"}
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder={mode === "register" ? "Min. 8 characters" : "Your password"}
                    data-testid="input-password"
                    className="w-full px-3 py-2.5 pr-10 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <button type="button" onClick={() => setShowPw(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                data-testid="button-auth-submit"
                className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <><Loader2 size={15} className="animate-spin" /> {mode === "login" ? "Signing in…" : "Creating account…"}</>
                ) : mode === "login" ? (
                  <><LogIn size={15} /> Sign In</>
                ) : (
                  <><UserPlus size={15} /> Create Account</>
                )}
              </button>
            </form>

            <div className="mt-5 text-center">
              <span className="text-sm text-muted-foreground">
                {mode === "login" ? "Don't have an account? " : "Already have an account? "}
              </span>
              <button
                onClick={() => setMode(m => m === "login" ? "register" : "login")}
                className="text-sm text-primary font-medium hover:underline"
                data-testid="button-auth-switch"
              >
                {mode === "login" ? "Register" : "Sign In"}
              </button>
            </div>
          </div>

          {/* Trust badges */}
          <div className="mt-6 flex items-center justify-center gap-6 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><ShieldCheck size={13} /> Your data is private</span>
            <span className="flex items-center gap-1.5"><KeyRound size={13} /> Your key, your calls</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Settings Panel (slide-in) ─────────────────────────────────────────────────
function SettingsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, token, refreshUser } = useAuth();
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const { toast } = useToast();

  const saveKey = async () => {
    if (!apiKey.trim()) return;
    setSaving(true);
    const fd = new FormData();
    fd.append("gemini_api_key", apiKey.trim());
    try {
      const res = await fetch(`${API}/api/user/gemini-key`, {
        method: "POST", body: fd, credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail);
      toast({ title: "API key saved", description: "Gemini is ready to use." });
      setApiKey("");
      await refreshUser();
    } catch (err: any) {
      toast({ title: "Invalid key", description: err.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const removeKey = async () => {
    setRemoving(true);
    try {
      await fetch(`${API}/api/user/gemini-key`, {
        method: "DELETE", credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      toast({ title: "Key removed" });
      await refreshUser();
    } catch { } finally { setRemoving(false); }
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-background border-l border-border shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Settings size={18} className="text-primary" />
            <h2 className="font-semibold text-foreground">Settings</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent transition-colors">
            <X size={18} className="text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {/* Account */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Account</h3>
            <div className="bg-muted rounded-xl p-4">
              <p className="text-sm font-medium text-foreground">{user?.email}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Signed in</p>
            </div>
          </div>

          {/* Gemini API Key */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Gemini API Key</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Required to search jobs and tailor your CV. Your key is stored securely and only used for your searches.{" "}
              <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-0.5">
                Get a free key <ExternalLink size={10} />
              </a>
            </p>

            {user?.has_gemini_key ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 rounded-xl px-4 py-3">
                  <CheckCircle size={16} className="text-green-600 shrink-0" />
                  <span className="text-sm text-green-700 dark:text-green-400 font-medium">Gemini API key is active</span>
                </div>
                <button
                  onClick={removeKey}
                  disabled={removing}
                  className="flex items-center gap-2 text-sm text-red-500 hover:text-red-600 transition-colors disabled:opacity-50"
                  data-testid="button-remove-key"
                >
                  {removing ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  Remove key
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <input
                    type={showKey ? "text" : "password"}
                    value={apiKey}
                    onChange={e => setApiKey(e.target.value)}
                    placeholder="AIza..."
                    data-testid="input-gemini-key"
                    className="w-full px-3 py-2.5 pr-10 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono"
                  />
                  <button type="button" onClick={() => setShowKey(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <button
                  onClick={saveKey}
                  disabled={saving || !apiKey.trim()}
                  data-testid="button-save-key"
                  className="w-full py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving ? <><Loader2 size={14} className="animate-spin" /> Verifying…</> : <><KeyRound size={14} /> Save & Verify Key</>}
                </button>
              </div>
            )}
          </div>

          {/* How it works */}
          <div className="bg-muted rounded-xl p-4 text-xs text-muted-foreground space-y-1.5">
            <p className="font-semibold text-foreground text-sm mb-2">How your key is used</p>
            <p>• Your Gemini API key is stored encrypted in our database</p>
            <p>• It's only used to make AI calls on your behalf</p>
            <p>• You can remove it at any time</p>
            <p>• Gemini 2.5 Flash free tier: 1,500 requests/day</p>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Main App Page ─────────────────────────────────────────────────────────────
function AppPage() {
  const { user, token } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  // State
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState<JobListing[]>([]);
  const [cvText, setCvText] = useState("");
  const [selectedJob, setSelectedJob] = useState<JobListing | null>(null);
  const [tailoring, setTailoring] = useState(false);
  const [tailoredCv, setTailoredCv] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Open settings automatically if no Gemini key yet
  useEffect(() => {
    if (user && !user.has_gemini_key) {
      setSettingsOpen(true);
    }
  }, [user]);

  const examplePrompts = [
    "Find 5 data analyst jobs in London with salary",
    "Find 3 software engineer roles in Manchester",
    "Find 5 entry-level marketing jobs in Birmingham",
  ];

  const handleFile = (file: File) => {
    if (file.type !== "application/pdf") {
      toast({ title: "PDF only", description: "Please upload a PDF file.", variant: "destructive" });
      return;
    }
    setCvFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  };

  const handleSearch = async () => {
    if (!cvFile) {
      toast({ title: "No CV uploaded", description: "Please upload your CV first.", variant: "destructive" });
      return;
    }
    if (!prompt.trim()) {
      toast({ title: "No prompt", description: "Describe the jobs you're looking for.", variant: "destructive" });
      return;
    }
    if (!user?.has_gemini_key) {
      toast({ title: "Gemini key required", description: "Add your Gemini API key in Settings first.", variant: "destructive" });
      setSettingsOpen(true);
      return;
    }

    setLoading(true);
    setJobs([]);
    setSelectedJob(null);
    setTailoredCv("");

    const fd = new FormData();
    fd.append("cv_file", cvFile);
    fd.append("prompt", prompt);

    try {
      const res = await fetch(`${API}/api/search`, {
        method: "POST", body: fd, credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Search failed");
      setJobs(data.jobs || []);
      setCvText(data.cv_text || "");
      if (data.jobs?.length) {
        toast({ title: `Found ${data.jobs.length} jobs`, description: "Listings matched and ranked by fit." });
      }
    } catch (err: any) {
      toast({ title: "Search failed", description: err.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  const handleTailor = async () => {
    if (!selectedJob || !cvText) return;
    setTailoring(true);
    setTailoredCv("");
    const fd = new FormData();
    fd.append("cv_text", cvText);
    fd.append("job_title", selectedJob.job_title);
    fd.append("company", selectedJob.company);
    fd.append("job_description", selectedJob.full_description);
    try {
      const res = await fetch(`${API}/api/tailor`, {
        method: "POST", body: fd, credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Tailor failed");
      setTailoredCv(data.tailored_cv);
      toast({ title: "CV tailored successfully", description: "Your CV has been rewritten for this role." });
    } catch (err: any) {
      toast({ title: "Tailor failed", description: err.message, variant: "destructive" });
    } finally { setTailoring(false); }
  };

  const handleDownload = async () => {
    if (!tailoredCv || !selectedJob) return;
    setDownloading(true);
    const fd = new FormData();
    fd.append("cv_text", tailoredCv);
    fd.append("job_title", selectedJob.job_title);
    fd.append("company", selectedJob.company);
    try {
      const res = await fetch(`${API}/api/download`, {
        method: "POST", body: fd, credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${selectedJob.job_title}_${selectedJob.company}_CV.pdf`.replace(/[^\w\-_.]/g, "_");
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "PDF downloaded", description: "Check your downloads folder." });
    } catch (err: any) {
      toast({ title: "Download failed", description: err.message, variant: "destructive" });
    } finally { setDownloading(false); }
  };

  return (
    <div className="min-h-screen bg-background">
      <NavBar onSettings={() => setSettingsOpen(true)} />
      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {/* Gemini key warning banner */}
      {user && !user.has_gemini_key && !settingsOpen && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800 px-4 py-2.5 flex items-center justify-between gap-4">
          <span className="text-sm text-amber-800 dark:text-amber-300 flex items-center gap-2">
            <KeyRound size={14} /> Add your Gemini API key to start searching jobs
          </span>
          <button onClick={() => setSettingsOpen(true)}
            className="text-xs font-semibold text-amber-800 dark:text-amber-300 underline hover:no-underline">
            Add key →
          </button>
        </div>
      )}

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Hero */}
        <div className="text-center mb-8">
          <h1 className="text-xl font-bold text-foreground mb-2">AI-Powered Job Search &amp; CV Tailoring</h1>
          <p className="text-sm text-muted-foreground max-w-xl mx-auto">
            Upload your CV, describe the roles you want — Gemini searches real job listings, calculates
            your match score, and rewrites your CV to fit each job perfectly.
          </p>
        </div>

        {/* Upload + Prompt */}
        <div className="bg-card border border-border rounded-2xl p-6 mb-6 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* CV Upload */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Your CV (PDF)</label>
              <div
                className={`mt-2 border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => document.getElementById("cv-input")?.click()}
                data-testid="zone-cv-upload"
              >
                <input id="cv-input" type="file" accept=".pdf" className="hidden"
                  onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
                {cvFile ? (
                  <>
                    <CheckCircle size={32} className="mx-auto mb-2 text-primary" />
                    <p className="text-sm font-medium text-foreground">{cvFile.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{(cvFile.size / 1024).toFixed(1)} KB — click to replace</p>
                  </>
                ) : (
                  <>
                    <Upload size={28} className="mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm font-medium text-foreground">Drop your CV here</p>
                    <p className="text-xs text-muted-foreground mt-1">or click to browse — PDF only</p>
                  </>
                )}
              </div>
              {cvFile && (
                <p className="mt-1.5 text-xs text-muted-foreground flex items-center gap-1">
                  <CheckCircle size={11} className="text-primary" /> {cvFile.name}
                </p>
              )}
            </div>

            {/* Prompt */}
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Search Prompt</label>
              <textarea
                className="mt-2 flex-1 min-h-[120px] w-full px-3 py-3 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                placeholder='e.g. "Find 5 data analyst jobs in London with salary"'
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                data-testid="input-prompt"
              />
              <div className="flex flex-wrap gap-2 mt-2">
                {examplePrompts.map(p => (
                  <button key={p} onClick={() => setPrompt(p)}
                    className="text-xs px-2.5 py-1 rounded-full bg-muted hover:bg-accent text-muted-foreground hover:text-foreground transition-colors truncate max-w-[200px]">
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{cvFile ? cvFile.name : "No CV selected"}</p>
            <button
              onClick={handleSearch}
              disabled={loading}
              data-testid="button-find-jobs"
              className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? <><Loader2 size={15} className="animate-spin" /> Searching…</> : <><Search size={15} /> Find Jobs</>}
            </button>
          </div>
        </div>

        {/* Results */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-card border border-border rounded-xl p-5 animate-pulse">
                <div className="h-4 bg-muted rounded w-1/3 mb-2" />
                <div className="h-3 bg-muted rounded w-1/4 mb-3" />
                <div className="h-2 bg-muted rounded w-full" />
              </div>
            ))}
          </div>
        )}

        {jobs.length > 0 && !loading && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-foreground">{jobs.length} jobs found</p>
              <p className="text-xs text-muted-foreground">Click a listing to view details &amp; tailor your CV</p>
            </div>
            <div className="space-y-3">
              {jobs.map((job, idx) => (
                <div
                  key={idx}
                  className="bg-card border border-border rounded-xl p-5 cursor-pointer hover:border-primary/40 hover:shadow-sm transition-all group"
                  onClick={() => { setSelectedJob(job); setTailoredCv(""); }}
                  data-testid={`card-job-${idx}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-sm text-foreground">{job.job_title}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          job.match_percentage >= 80 ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400" :
                          job.match_percentage >= 60 ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400" :
                          "bg-muted text-muted-foreground"
                        }`}>↗ {job.match_percentage}% match</span>
                      </div>
                      <p className="text-xs text-primary font-medium mt-0.5">{job.company}</p>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1"><MapPin size={11} /> {job.location}</span>
                        <span className="flex items-center gap-1"><DollarSign size={11} /> {job.salary}</span>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-muted-foreground shrink-0 group-hover:text-primary transition-colors mt-1" />
                  </div>
                  <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${job.match_percentage}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {jobs.length === 0 && !loading && (
          <div className="text-center py-16 text-muted-foreground">
            <Briefcase size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Upload your CV and enter a search prompt to discover matching jobs and get your CV tailored in seconds.</p>
          </div>
        )}
      </main>

      {/* Job Detail Panel */}
      {selectedJob && (
        <>
          <div className="fixed inset-0 z-30 bg-black/20 backdrop-blur-sm" onClick={() => setSelectedJob(null)} />
          <div
            className="fixed right-0 top-0 bottom-0 z-40 w-full max-w-lg bg-background border-l border-border shadow-xl flex flex-col"
            data-testid="panel-job-detail"
          >
            {/* Panel header */}
            <div className="px-6 py-4 border-b border-border">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-bold text-foreground text-base">{selectedJob.job_title}</h2>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      selectedJob.match_percentage >= 80 ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400" :
                      "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400"
                    }`}>↗ {selectedJob.match_percentage}% match</span>
                  </div>
                  <p className="text-sm text-primary font-medium mt-0.5">{selectedJob.company}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1"><MapPin size={11} />{selectedJob.location}</span>
                    <span className="flex items-center gap-1"><DollarSign size={11} />{selectedJob.salary}</span>
                  </div>
                </div>
                <button onClick={() => setSelectedJob(null)} className="p-1.5 rounded-lg hover:bg-accent transition-colors shrink-0">
                  <X size={18} className="text-muted-foreground" />
                </button>
              </div>
              <a href={selectedJob.source_url} target="_blank" rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-medium">
                <ExternalLink size={12} /> Apply on site
              </a>
            </div>

            {/* Panel body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {/* Match score */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-muted-foreground">CV Match Score</span>
                  <span className="text-sm font-bold text-foreground">{selectedJob.match_percentage}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${selectedJob.match_percentage}%` }} />
                </div>
              </div>

              {/* Description */}
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Job Description</h3>
                <div className="text-sm text-foreground leading-relaxed whitespace-pre-line">
                  {selectedJob.full_description}
                </div>
              </div>

              {/* Tailored CV preview */}
              {tailoredCv && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles size={14} className="text-primary" />
                    <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">Tailored CV Preview</h3>
                  </div>
                  <div className="bg-muted rounded-xl p-4 text-xs font-mono leading-relaxed text-foreground whitespace-pre-wrap max-h-64 overflow-y-auto border border-border">
                    {tailoredCv}
                  </div>
                </div>
              )}
            </div>

            {/* Panel footer */}
            <div className="px-6 py-4 border-t border-border space-y-2">
              {tailoredCv ? (
                <>
                  <button
                    onClick={handleDownload}
                    disabled={downloading}
                    data-testid="button-download-cv"
                    className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {downloading ? <><Loader2 size={15} className="animate-spin" /> Generating PDF…</> : <><Download size={15} /> Download Tailored CV (PDF)</>}
                  </button>
                  <button
                    onClick={handleTailor}
                    disabled={tailoring}
                    data-testid="button-retailor"
                    className="w-full py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-accent transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {tailoring ? <><Loader2 size={15} className="animate-spin" /> Re-tailoring…</> : <><RefreshCw size={15} /> Re-tailor CV</>}
                  </button>
                </>
              ) : (
                <button
                  onClick={handleTailor}
                  disabled={tailoring}
                  data-testid="button-tailor-cv"
                  className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {tailoring ? <><Loader2 size={15} className="animate-spin" /> Tailoring your CV…</> : <><Sparkles size={15} /> Tailor My CV for this Role</>}
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Root with routing ─────────────────────────────────────────────────────────
function RootRouter() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
    if (!loading && user) navigate("/");
  }, [user, loading]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      <Route path="/" component={AppPage} />
      <Route component={AuthPage} />
    </Switch>
  );
}

export default function App() {
  return (
    <Router hook={useHashLocation}>
      <AuthProvider>
        <RootRouter />
        <Toaster />
      </AuthProvider>
    </Router>
  );
}
