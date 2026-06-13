import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { User, Mail, Phone, Lock, AlertCircle, Eye, EyeOff, Fingerprint } from "lucide-react";
import AuthLayout, { AuthLink } from "./AuthLayout";
import { api, ApiError } from "../../lib/api";

export default function Signup() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !phone || !password) {
      setError("Please fill in all required fields.");
      return;
    }

    setLoading(true);
    try {
      await api.post("/api/auth/register", {
        email,
        password,
        phone: phone.startsWith("+") ? phone : `+${phone}`,
        role: "CLIENT",
      });
      // Store phone for OTP verification
      sessionStorage.setItem('registrationPhone', phone.startsWith("+") ? phone : `+${phone}`);
      // Registration successful — navigate to OTP verification
      navigate("/verify-otp");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Sign up to book buses and send parcels in minutes."
      footer={
        <>
          Already have an account? <AuthLink to="/login">Log in</AuthLink>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 rounded-xl bg-flame-50 px-4 py-3 text-sm text-flame-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <label className="label">Full name</label>
          <div className="relative">
            <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
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
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
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
              <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
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
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
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
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
          <Fingerprint className="h-5 w-5" />
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
    </AuthLayout>
  );
}
