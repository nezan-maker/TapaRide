import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import AuthSpinner from '../../components/AuthSpinner';
import AuthLayout, { AuthLink } from "./AuthLayout";
import Select from "../../components/Select";
import PasskeyButton from "../../components/PasskeyButton";
import GoogleSignInButton from "../../components/GoogleSignInButton";
import { useAuth } from "../../lib/auth";
import Fa from '../../components/Fa';

type LoginRole = 'CLIENT' | 'DRIVER' | 'MANAGER' | 'OWNER';

const ROLE_META: Record<LoginRole, { title: string; blurb: string; icon: string }> = {
  CLIENT:  { icon: 'ticket',    title: 'Traveler',     blurb: 'Book trips & send parcels' },
  DRIVER:  { icon: 'bus',       title: 'Driver',       blurb: 'Drive routes & manage trips' },
  MANAGER: { icon: 'briefcase', title: 'Manager',      blurb: 'Manage agency operations' },
  OWNER:   { icon: 'building',  title: 'Agency owner', blurb: 'Run your transport company' },
};

const ROLE_OPTIONS = (Object.keys(ROLE_META) as LoginRole[]).map((value) => ({
  value,
  label: ROLE_META[value].title,
}));

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, loginOAuth, error, clearError, loading } = useAuth();
  const [role, setRole] = useState<LoginRole | ''>('');
  const [showPasskey, setShowPasskey] = useState(false);
  const [show, setShow] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const fromState = (location.state as { from?: unknown } | null)?.from;
  const fromPath =
    fromState && typeof fromState === 'object' && 'pathname' in (fromState as Record<string, unknown>)
      ? (fromState as { pathname: string; search?: string })
      : null;
  const postLoginTarget = fromPath
    ? fromPath.pathname + (fromPath.search ?? '')
    : '/dashboard';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();
    if (!email || !password) {
      setLocalError('Enter both your email and password.');
      return;
    }
    try {
      await login(email, password);
      navigate(postLoginTarget, { replace: true });
    } catch {
      // error is set in auth context
    }
  };

  const handlePasskeySuccess = (result: any) => {
    if (result.accessToken) localStorage.setItem('accessToken', result.accessToken);
    if (result.refreshToken) localStorage.setItem('refreshToken', result.refreshToken);
    setTimeout(() => navigate(postLoginTarget, { replace: true }), 500);
  };

  const displayError = localError || error;
  const selectedMeta = role ? ROLE_META[role as LoginRole] : null;

  return (
    <AuthLayout
      title={selectedMeta ? `Welcome, ${selectedMeta.title}.` : 'Welcome back'}
      subtitle={
        selectedMeta
          ? `Sign in to ${selectedMeta.blurb.toLowerCase()}.`
          : 'How are you using TapaRide today?'
      }
      footer={
        null
      }
    >
      {/* Invite card — always visible at the top so invited users can accept from login too */}
      {!role && (
        <Link
          to="/accept-invite"
          className="mb-6 flex items-start gap-3 rounded-2xl border border-flame-200 bg-gradient-to-br from-flame-50 to-white p-4 text-sm shadow-card-sm transition hover:shadow-card hover:border-flame-300"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-ink-900 text-white">
            <Fa name="envelope" className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="font-semibold text-ink-900">Were you invited?</div>
            <p className="mt-0.5 text-ink-500">Managers and drivers skip signup and accept an email invitation.</p>
            <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-flame-600">
              Accept invitation <Fa name="arrow-right" className="h-3 w-3" />
            </span>
          </div>
        </Link>
      )}

      {!role ? (
        // ── Role selection screen ─────────────────────────────────────────────
        <div className="space-y-4">
          <Select
            label="I'm signing in as a…"
            options={ROLE_OPTIONS}
            value={role}
            placeholder="Pick your role"
            onChange={(v) => setRole(v as LoginRole)}
          />

          {selectedMeta && (
            <div
              key={role}
              className="flex items-start gap-3 rounded-2xl border border-ink-100 bg-ink-50/70 p-4 animate-fade-up"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-ink-900 text-white">
                <Fa name={selectedMeta.icon} className="h-4 w-4" />
              </span>
              <div className="text-sm">
                <div className="font-semibold text-ink-900">{selectedMeta.title}</div>
                <p className="text-ink-500">{selectedMeta.blurb}.</p>
              </div>
            </div>
          )}
        </div>
      ) : (
        // ── Login form for selected role ─────────────────────────────────────
        <div className="space-y-5">
          {/* Role pill — clear "you are" indicator */}
          <button
            type="button"
            onClick={() => setRole('')}
            className="inline-flex items-center gap-2 rounded-full bg-ink-50 pl-1 pr-3 py-1 text-sm font-medium text-ink-700 transition hover:bg-ink-100"
          >
            <span className="grid h-6 w-6 place-items-center rounded-full bg-ink-900 text-white">
              <Fa name={selectedMeta!.icon} className="h-3.5 w-3.5" />
            </span>
            Signing in as {selectedMeta!.title} · change
          </button>

          {displayError && (
            <div className="rounded-xl bg-flame-50 px-4 py-3 text-sm text-flame-700 flex items-start gap-2">
              <Fa name="alertcircle" className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{displayError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
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
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="label !mb-0">Password</label>
                          <Link to="/forgot-password" className="text-xs font-semibold text-flame-600 hover:text-flame-700">
                            Forgot?
                          </Link>
                        </div>
                        <div className="relative">
                          <Fa name="lock" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                          <input
                            type={show ? 'text' : 'password'}
                            className="input pl-10 pr-12 h-12 text-base"
                            placeholder="••••••••"
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
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className="btn-primary w-full py-4 text-base shadow-card-sm hover:shadow-card disabled:opacity-50 disabled:shadow-none"
                      >
                        <AuthSpinner label="Signing in…" />
                      </button>
                    </form>

                    <div className="flex items-center gap-3 text-xs text-ink-400">
                      <span className="h-px flex-1 bg-ink-100" /> or continue with <span className="h-px flex-1 bg-ink-100" />
                    </div>

                    <GoogleSignInButton
                      onSuccess={async (idToken) => {
                        try {
                          await loginOAuth('google', idToken);
                          navigate(postLoginTarget, { replace: true });
                        } catch {}
                      }}
                      onError={(err) => setLocalError(err)}
                      disabled={loading}
                    />

                    {!showPasskey && (
                      <button
                        type="button"
                        onClick={() => setShowPasskey(true)}
                        className="btn-outline w-full py-3"
                      >
                        <Fa name="fingerprint" className="h-4 w-4" /> Use Passkey
                      </button>
                    )}
                    {showPasskey && <PasskeyButton mode="login" onSuccess={handlePasskeySuccess} />}

                    {/* Signup link - placed under the form */}
                    <div className="mt-6 text-center text-sm text-ink-500">
                      New here?{' '}
                      <AuthLink to="/signup">
                        Create a free account
                      </AuthLink>
                    </div>
                  </div>
                )}
              </AuthLayout>
            );
          }
