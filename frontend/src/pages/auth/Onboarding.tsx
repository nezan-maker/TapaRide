import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import AuthLayout, { AuthLink } from "./AuthLayout";
import { api, ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import Fa from '../../components/Fa';

export default function Onboarding() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [searchParams] = useSearchParams();
  const isGoogleAuth = searchParams.get("provider") === "google";

  const [phone, setPhone] = useState("");
  const [walletPassword, setWalletPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!walletPassword || !confirmPassword) {
      setError("Please fill in all fields.");
      return;
    }

    if (isGoogleAuth && !phone) {
      setError("Please enter your phone number.");
      return;
    }

    if (walletPassword !== confirmPassword) {
      setError("Wallet passwords do not match.");
      return;
    }

    if (walletPassword.length < 4) {
      setError("Wallet password must be at least 4 characters.");
      return;
    }

    setLoading(true);
    try {
      const payload: { walletPassword: string; phone?: string } = { walletPassword };
      if (isGoogleAuth) {
        payload.phone = phone.startsWith("+") ? phone : `+${phone}`;
      }
      await api.post("/api/auth/onboarding", payload);
      await refreshUser();
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to complete setup. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Complete your setup"
      subtitle={
        isGoogleAuth
          ? "Just a couple more things to get you started with TapaRide."
          : "Set up your wallet password to secure your account."
      }
      footer={
        <>
          Already have an account?{' '}
          <AuthLink to="/login">Log in</AuthLink>
        </>
      }
    >
      <div className="space-y-5 animate-fade-up">
        <div className="rounded-2xl bg-ink-50 p-4 text-sm text-ink-600 flex items-start gap-3">
          <Fa name="info-circle" className="h-5 w-5 text-flame-600 shrink-0 mt-0.5" />
          <p>
            {isGoogleAuth
              ? "Your Google account is connected. We just need your phone number and a wallet password to secure your account."
              : "Create a wallet password to secure your Tapa wallet for payments and top-ups."}
          </p>
        </div>

        {error && (
          <div className="rounded-xl bg-flame-50 px-4 py-3 text-sm text-flame-700 flex items-start gap-2">
            <Fa name="alert-circle" className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isGoogleAuth && (
            <div>
              <label className="label">Phone number</label>
              <div className="relative">
                <Fa name="phone" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                <input
                  type="tel"
                  className="input pl-10 h-12 text-base"
                  placeholder="+250 7XX XXX XXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={loading}
                  autoFocus
                />
              </div>
              <p className="mt-1.5 text-xs text-ink-400">We'll send you an SMS code to verify this number.</p>
            </div>
          )}

          <div>
            <label className="label">Wallet password</label>
            <div className="relative">
              <Fa name="lock" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <input
                type="password"
                className="input pl-10 h-12 text-base"
                placeholder="Create a wallet PIN"
                value={walletPassword}
                onChange={(e) => setWalletPassword(e.target.value)}
                disabled={loading}
                autoFocus={!isGoogleAuth}
              />
            </div>
            <p className="mt-1.5 text-xs text-ink-400">This PIN secures your Tapa wallet for payments and top-ups.</p>
          </div>

          <div>
            <label className="label">Confirm wallet password</label>
            <div className="relative">
              <Fa name="lock" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <input
                type="password"
                className="input pl-10 h-12 text-base"
                placeholder="Re-enter your wallet PIN"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-4 text-base shadow-card-sm hover:shadow-card disabled:opacity-50 disabled:shadow-none"
          >
            {loading ? 'Setting up…' : 'Complete setup'}
          </button>
        </form>
      </div>
    </AuthLayout>
  );
}