import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import AuthLayout, { AuthLink } from "./AuthLayout";
import { api, ApiError } from "../../lib/api";
import Fa from '../../components/Fa';

export default function Signup() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ verifyEmailLink?: string; otpCode?: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !phone || !password) {
      setError("Please fill in all required fields.");
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("/api/auth/register", {
        email,
        password,
        phone: phone.startsWith("+") ? phone : `+${phone}`,
        role: "CLIENT",
      });
      // Store phone for OTP verification
      sessionStorage.setItem('registrationPhone', phone.startsWith("+") ? phone : `+${phone}`);
      // Show success with dev verification info
      setSuccess({ verifyEmailLink: res.verifyEmailLink, otpCode: res.otpCode });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title={success ? "Account created!" : "Create your account"}
      subtitle={success
        ? "Your account is ready. Verify your email and phone to log in."
        : "Sign up to book buses and send parcels in minutes."}
      footer={
        success ? null : (
          <>
            Already have an account? <AuthLink to="/login">Log in</AuthLink>
          </>
        )
      }
    >
      {success ? (
        <div className="space-y-5">
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-700 flex items-start gap-3">
            <Fa name="check-circle2" className="h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">Registration successful!</div>
              <p className="text-xs mt-1">Verify your email and phone to start using Tapa.</p>
            </div>
          </div>

          {success.verifyEmailLink && (
            <div className="card p-4 border-flame-200 bg-flame-50/30">
              <div className="flex items-center gap-2 text-xs font-semibold text-flame-700 mb-2">
                🛠️ Dev mode — verification link
              </div>
              <a
                href={success.verifyEmailLink}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full rounded-xl bg-flame-600 text-white text-center py-3 font-semibold text-sm hover:bg-flame-700 transition"
              >
                ✅ Click to verify email
              </a>
              <p className="mt-1.5 text-[10px] text-ink-400 break-all select-all">{success.verifyEmailLink}</p>
            </div>
          )}

          {success.otpCode && (
            <div className="card p-4 border-ink-200 bg-ink-50">
              <div className="flex items-center gap-2 text-xs font-semibold text-ink-500 mb-2">
                🛠️ Dev mode — OTP code
              </div>
              <div className="text-center">
                <span className="text-3xl font-extrabold text-ink-900 tracking-widest select-all">{success.otpCode}</span>
              </div>
              <p className="mt-1.5 text-xs text-ink-400 text-center">Enter this code on the OTP verification page.</p>
            </div>
          )}

          <button
            onClick={() => navigate("/verify-otp")}
            className="btn-primary w-full py-3.5"
          >
            Go to OTP Verification →
          </button>

          <button
            onClick={() => navigate("/login")}
            className="btn-outline w-full py-3"
          >
            I've verified — Log in
          </button>
        </div>
      ) : (
        <>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 rounded-xl bg-flame-50 px-4 py-3 text-sm text-flame-700">
            <Fa name="alert-circle" className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <label className="label">Full name</label>
          <div className="relative">
            <Fa name="user" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input
              className="input pl-9"
              placeholder="Amina Uwimana"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Email</label>
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
            <label className="label">Phone</label>
            <div className="relative">
              <Fa name="phone" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <input
                className="input pl-9"
                placeholder="+250 7XX XXX XXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>
        </div>

        <div>
          <label className="label">Password</label>
          <div className="relative">
            <Fa name="lock" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input
              type={show ? "text" : "password"}
              className="input pl-9 pr-10"
              placeholder="Create a strong password"
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
          <p className="mt-1.5 text-xs text-ink-400">
            Use 8+ characters with a mix of letters and numbers.
          </p>
        </div>

        <label className="flex items-start gap-2.5 text-sm text-ink-600">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-ink-200 text-ink-900 focus:ring-ink-900"
          />
          I agree to TapaRide's{" "}
          <span className="font-semibold text-flame-600">Terms</span> and{" "}
          <span className="font-semibold text-flame-600">Privacy Policy</span>.
        </label>

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full py-3.5 disabled:opacity-50"
        >
          {loading ? "Creating account..." : "Create Account"}
        </button>
      </form>

      <div className="flex items-center gap-3 py-1 text-xs text-ink-300">
        <span className="h-px flex-1 bg-ink-100" /> or{" "}
        <span className="h-px flex-1 bg-ink-100" />
      </div>

      <div className="rounded-2xl border border-ink-100 bg-ink-50 p-5 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-ink-900 text-white">
          <Fa name="fingerprint" className="h-5 w-5" />
        </span>
        <h3 className="mt-3 font-semibold text-ink-900">Secure your account</h3>
        <p className="mt-1 text-sm text-ink-600">
          Add a passkey for passwordless login and enhanced security.
        </p>
        <Link
          to="/register-passkey"
          className="btn-outline mt-4 inline-flex items-center gap-2"
        >
          Set up passkey
        </Link>
      </div>
      </>
      )}
    </AuthLayout>
  );
}
