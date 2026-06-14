import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { cn } from "../../lib/utils";
import AuthLayout, { AuthLink } from "./AuthLayout";
import { api, ApiError } from "../../lib/api";
import Fa from '../../components/Fa';

type SignupRole = null | 'CLIENT' | 'OWNER';

export default function Signup() {
  const navigate = useNavigate();
  const [role, setRole] = useState<SignupRole>(null);
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
        role: role || 'CLIENT',
      });
      sessionStorage.setItem('registrationPhone', phone.startsWith("+") ? phone : `+${phone}`);
      setSuccess({ verifyEmailLink: res.verifyEmailLink, otpCode: res.otpCode });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!role) {
    return (
      <AuthLayout
        title="Join TapaRide"
        subtitle="Choose how you'll use the platform."
        footer={
          <>
            Already have an account? <AuthLink to="/login">Log in</AuthLink>
          </>
        }
      >
        <div className="grid gap-4">
          <button
            onClick={() => setRole('CLIENT')}
            className={cn(
              'group flex flex-col items-start rounded-3xl border-2 p-6 text-left transition hover:shadow-card',
              'border-ink-100 bg-white hover:border-flame-500',
            )}
          >
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-ink-900 text-white transition group-hover:bg-flame-600">
              <Fa name="ticket" className="h-6 w-6" />
            </span>
            <h3 className="mt-4 text-xl font-semibold tracking-tight text-ink-900">
              I want to book trips
            </h3>
            <p className="mt-1 text-sm text-ink-500">
              Search routes, buy tickets, send parcels, and track my journeys.
            </p>
            <span className="mt-4 text-sm font-medium text-flame-600">
              Sign up as a traveler →</span>
          </button>

          <button
            onClick={() => setRole('OWNER')}
            className={cn(
              'group flex flex-col items-start rounded-3xl border-2 p-6 text-left transition hover:shadow-card',
              'border-ink-100 bg-white hover:border-ink-900',
            )}
          >
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-ink-900 text-white transition group-hover:bg-ink-700">
              <Fa name="bus" className="h-6 w-6" />
            </span>
            <h3 className="mt-4 text-xl font-semibold tracking-tight text-ink-900">
              I own a transport agency
            </h3>
            <p className="mt-1 text-sm text-ink-500">
              Register my company, manage vehicles, assign drivers, and operate routes.
            </p>
            <span className="mt-4 text-sm font-medium text-ink-500">
              Register as an agency owner →</span>
          </button>

          <p className="pt-2 text-center text-xs text-ink-400">
            Invited as a manager or driver?{' '}
            <Link to="/accept-invite" className="font-semibold text-flame-600">
              Accept your invitation
            </Link>
          </p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={success ? "Account created!" : "Create your account"}
      subtitle={success
        ? "Your account is ready. Verify your email and phone to log in."
        : role === 'OWNER'
          ? "Register to set up your transport agency on TapaRide."
          : "Sign up to book buses and send parcels in minutes."}
      footer={
        success ? null : (
          <>
            <button onClick={() => setRole(null)} className="text-sm font-semibold text-ink-400 hover:text-ink-600">
              ← Change account type
            </button>
            <span className="mx-2 text-ink-200">·</span>
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
              <p className="text-xs mt-1">{role === 'OWNER' ? 'Head to your dashboard to complete your agency setup.' : 'Verify your email and phone to start using Tapa.'}</p>
            </div>
          </div>
          {success.verifyEmailLink && (
            <div className="card p-4 border-flame-200 bg-flame-50/30">
              <div className="flex items-center gap-2 text-xs font-semibold text-flame-700 mb-2">
                🛠️ Dev mode — verification link
              </div>
              <a href={success.verifyEmailLink} target="_blank" rel="noopener noreferrer"
                className="block w-full rounded-xl bg-flame-600 text-white text-center py-3 font-semibold text-sm hover:bg-flame-700 transition">
                ✅ Click to verify email
              </a>
              <p className="mt-1.5 text-[10px] text-ink-400 break-all select-all">{success.verifyEmailLink}</p>
            </div>
          )}
          {success.otpCode && (
            <div className="card p-4 border-ink-200 bg-ink-50">
              <div className="flex items-center gap-2 text-xs font-semibold text-ink-500 mb-2">🛠️ Dev mode — OTP code</div>
              <div className="text-center">
                <span className="text-3xl font-extrabold text-ink-900 tracking-widest select-all">{success.otpCode}</span>
              </div>
              <p className="mt-1.5 text-xs text-ink-400 text-center">Enter this code on the OTP verification page.</p>
            </div>
          )}
          <button onClick={() => navigate("/verify-otp")} className="btn-primary w-full py-3.5">
            Go to OTP Verification →
          </button>
          <button onClick={() => navigate("/login")} className="btn-outline w-full py-3">
            I've verified — Log in
          </button>
        </div>
      ) : (
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
              <input className="input pl-9" placeholder="Amina Uwimana" value={name} onChange={(e) => setName(e.target.value)} disabled={loading} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Email</label>
              <div className="relative">
                <Fa name="mail" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                <input className="input pl-9" placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} />
              </div>
            </div>
            <div>
              <label className="label">Phone</label>
              <div className="relative">
                <Fa name="phone" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                <input className="input pl-9" placeholder="+250 7XX XXX XXX" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={loading} />
              </div>
            </div>
          </div>
          <div>
            <label className="label">Password</label>
            <div className="relative">
              <Fa name="lock" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <input type={show ? "text" : "password"} className="input pl-9 pr-10" placeholder="Create a strong password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading} />
              <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-900" aria-label="toggle password">
                {show ? <Fa name="eyeoff" className="h-4 w-4" /> : <Fa name="eye" className="h-4 w-4" />}
              </button>
            </div>
            <p className="mt-1.5 text-xs text-ink-400">Use 8+ characters with a mix of letters and numbers.</p>
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full py-3.5 disabled:opacity-50">
            {loading ? "Creating account..." : role === 'OWNER' ? "Create Owner Account" : "Create Account"}
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
