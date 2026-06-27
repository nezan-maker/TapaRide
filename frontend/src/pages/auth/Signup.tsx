import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { cn } from "../../lib/utils";
import AuthLayout, { AuthLink } from "./AuthLayout";
import { api, ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import Fa from '../../components/Fa';
import GoogleSignInButton from "../../components/GoogleSignInButton";

type SignupRole = null | 'CLIENT' | 'OWNER';

const ROLE_INFO: Record<'CLIENT' | 'OWNER', { title: string; blurb: string }> = {
  CLIENT: { title: 'I want to book trips',    blurb: 'Search routes, buy tickets, send parcels, and live-track them.' },
  OWNER:  { title: 'I own a transport agency', blurb: 'Register a company, manage vehicles, drivers and stations.' },
};

export default function Signup() {
  const navigate = useNavigate();
  const { loginOAuth } = useAuth();
  const [role, setRole] = useState<SignupRole>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ verifyEmailLink?: string } | null>(null);

  // Cheap transition animation: re-trigger fade on role change
  const [animKey, setAnimKey] = useState(0);
  useEffect(() => setAnimKey(k => k + 1), [role]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email || !password) {
      setError("Please fill in all required fields.");
      return;
    }
    setLoading(true);
    try {
      const res = await api.post("/api/auth/register", {
        email,
        password,
        role: role || 'CLIENT',
      });
      setSuccess({ verifyEmailLink: res.verifyEmailLink });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Get started."
      subtitle={success ? "Your account is ready." : "Create a free account to book trips or run your agency."}
      footer={
        <>
          Already have an account?{' '}
          <AuthLink to="/login">Log in</AuthLink>
        </>
      }
    >
      {/* Invite card — top-level, before any state */}
      {!role && !success && (
        <Link
          to="/accept-invite"
          className="mb-6 flex items-start gap-3 rounded-2xl border border-flame-200 bg-gradient-to-br from-flame-50 to-white p-4 text-sm shadow-card-sm transition hover:shadow-card hover:border-flame-300"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-ink-900 text-white">
            <Fa name="envelope" className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="font-semibold text-ink-900">Were you invited?</div>
            <p className="mt-0.5 text-ink-500">
              Managers and drivers don't sign up — they accept an email invitation and set a password.
            </p>
            <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-flame-600">
              Accept invitation <Fa name="arrow-right" className="h-3 w-3" />
            </span>
          </div>
        </Link>
      )}

      {success ? (
        <div key={`success-${animKey}`} className="space-y-5 animate-fade-up">
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 text-sm text-emerald-700 flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-500 text-white">
              <Fa name="check" className="h-4 w-4" />
            </span>
            <div>
              <div className="font-semibold">Registration successful!</div>
              <p className="text-xs mt-1 opacity-90">
                Check your email for a verification link — we'll handle the rest.
              </p>
            </div>
          </div>

          <button onClick={() => navigate("/login")} className="btn-primary w-full py-3.5">
            Continue to login →
          </button>
          <button onClick={() => navigate("/login")} className="btn-outline w-full py-3">
            I've already verified
          </button>
        </div>
      ) : !role ? (
        <div key={`role-${animKey}`} className="space-y-4 animate-fade-up">
          <p className="eyebrow text-flame-600">Choose your path</p>
          {(['CLIENT', 'OWNER'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className={cn(
                'group flex w-full items-start gap-4 rounded-3xl border bg-white p-5 text-left transition',
                r === 'OWNER'
                  ? 'border-ink-100 hover:border-ink-900 hover:shadow-card'
                  : 'border-ink-100 hover:border-flame-500 hover:shadow-card',
              )}
            >
              <span
                className={cn(
                  'grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-white transition',
                  r === 'OWNER' ? 'bg-ink-900 group-hover:bg-ink-700' : 'bg-flame-600 group-hover:bg-flame-700',
                )}
              >
                <Fa name={r === 'OWNER' ? 'building' : 'ticket'} className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-ink-900">{ROLE_INFO[r].title}</div>
                <p className="mt-0.5 text-sm text-ink-500">{ROLE_INFO[r].blurb}</p>
              </div>
              <Fa name="chevron-right" className="mt-1 h-4 w-4 shrink-0 text-ink-300 transition group-hover:text-ink-600" />
            </button>
          ))}
        </div>
      ) : (
        // ── Signup form for selected role ─────────────────────────────────────
        <div key={`form-${animKey}`} className="space-y-5 animate-fade-up">
          {/* Role pill at the top */}
          <button
            type="button"
            onClick={() => setRole(null)}
            className="inline-flex items-center gap-2 rounded-full bg-ink-50 pl-1 pr-3 py-1 text-sm font-medium text-ink-700 transition hover:bg-ink-100"
          >
            <span className={cn('grid h-6 w-6 place-items-center rounded-full text-white', role === 'OWNER' ? 'bg-ink-900' : 'bg-flame-600')}>
              <Fa name={role === 'OWNER' ? 'building' : 'ticket'} className="h-3.5 w-3.5" />
            </span>
            {role === 'OWNER' ? 'Agency Owner' : 'Traveler'} · change
          </button>

          {/* Error */}
          {error && (
            <div className="rounded-xl bg-flame-50 px-4 py-3 text-sm text-flame-700 flex items-start gap-2">
              <Fa name="alertcircle" className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Full name</label>
              <div className="relative">
                <Fa name="user" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                <input
                  className="input pl-10 h-12 text-base"
                  placeholder="Amina Uwimana"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <label className="label">Email</label>
              <div className="relative">
                <Fa name="mail" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                <input
                  type="email"
                  className="input pl-10 h-12 text-base"
                  placeholder="you@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <Fa name="lock" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                <input
                  type={show ? 'text' : 'password'}
                  className="input pl-10 pr-12 h-12 text-base"
                  placeholder="8+ characters with a number"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-ink-400 hover:text-ink-900 hover:bg-ink-50"
                  aria-label="toggle password visibility"
                >
                  {show ? <Fa name="eyeoff" className="h-4 w-4" /> : <Fa name="eye" className="h-4 w-4" />}
                </button>
              </div>
              <p className="mt-1.5 text-xs text-ink-400">Use 8+ characters with a mix of letters and numbers.</p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-4 text-base shadow-card-sm hover:shadow-card disabled:opacity-50 disabled:shadow-none"
            >
              {loading ? 'Creating account…' : role === 'OWNER' ? 'Create owner account' : 'Create traveler account'}
            </button>
          </form>

          {/* Google OAuth — at the bottom */}
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-xs text-ink-400">
              <span className="h-px flex-1 bg-ink-100" /> or sign up with <span className="h-px flex-1 bg-ink-100" />
            </div>
            <GoogleSignInButton
              onSuccess={async (idToken) => {
                try {
                  await loginOAuth('google', idToken);
                  navigate('/onboarding?provider=google', { replace: true });
                } catch {}
              }}
              onError={(err) => setError(err)}
              disabled={loading}
            />
          </div>

          <p className="text-center text-xs text-ink-400">
            By continuing you agree to our{' '}
            <a href="#" className="font-medium text-flame-600">Terms</a> and{' '}
            <a href="#" className="font-medium text-flame-600">Privacy Policy</a>
          </p>
        </div>
      )}
    </AuthLayout>
  );
}