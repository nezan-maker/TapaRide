import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import AuthLayout, { AuthLink } from "./AuthLayout";
import PasskeyButton from "../../components/PasskeyButton";
import { useAuth } from "../../lib/auth";
import Fa from '../../components/Fa';

export default function Login() {
  const navigate = useNavigate();
  const { login, loginOAuth, error, clearError, loading } = useAuth();
  const [show, setShow] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();
    if (!email || !password) {
      setLocalError("Please enter both email and password.");
      return;
    }
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch {
      // error is set in auth context
    }
  };

  const handleOAuth = async (provider: "google" | "apple") => {
    try {
      // In production, this would open the OAuth redirect flow.
      // For development, we simulate with a mock token.
      const mockToken = `mock-${provider}-${Date.now()}`;
      await loginOAuth(provider, mockToken);
      navigate("/dashboard");
    } catch {
      // error handled by auth context
    }
  };

  const handlePasskeySuccess = (result: any) => {
    if (result.accessToken) {
      localStorage.setItem("accessToken", result.accessToken);
    }
    if (result.refreshToken) {
      localStorage.setItem("refreshToken", result.refreshToken);
    }
    setTimeout(() => navigate("/dashboard"), 500);
  };

  const displayError = localError || error;

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Log in to manage your trips and parcels."
      footer={
        <>
          Don't have an account? <AuthLink to="/signup">Sign up</AuthLink>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {displayError && (
          <div className="flex items-center gap-2 rounded-xl bg-flame-50 px-4 py-3 text-sm text-flame-700">
            <Fa name="alert-circle" className="h-4 w-4 shrink-0" />
            <span>{displayError}</span>
          </div>
        )}

        <div>
          <label className="label">Email or phone</label>
          <div className="relative">
            <Fa name="mail" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input
              className="input pl-9"
              placeholder="you@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label className="label">Password</label>
            <Link
              to="/forgot-password"
              className="mb-1.5 text-xs font-semibold text-flame-600"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Fa name="lock" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input
              type={show ? "text" : "password"}
              className="input px-9"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-900"
              aria-label="toggle password"
            >
              {show ? <Fa name="eyeoff" className="h-4 w-4" /> : <Fa name="eye" className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <label className="flex items-center gap-2.5 text-sm text-ink-600">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-ink-200 text-ink-900 focus:ring-ink-900"
          />
          Keep me signed in
        </label>

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full py-3.5 disabled:opacity-50"
        >
          {loading ? "Logging in..." : "Log In"}
        </button>

        <div className="flex items-center gap-3 py-1 text-xs text-ink-300">
          <span className="h-px flex-1 bg-ink-100" /> or continue with{" "}
          <span className="h-px flex-1 bg-ink-100" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => handleOAuth("google")}
            disabled={loading}
            className="btn-outline flex items-center justify-center gap-2 py-3 text-sm font-semibold disabled:opacity-50"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Google
          </button>
          <button
            type="button"
            onClick={() => handleOAuth("apple")}
            disabled={loading}
            className="btn-outline flex items-center justify-center gap-2 py-3 text-sm font-semibold disabled:opacity-50"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
            </svg>
            Apple
          </button>
        </div>

        <PasskeyButton mode="login" onSuccess={handlePasskeySuccess} />
      </form>
    </AuthLayout>
  );
}
