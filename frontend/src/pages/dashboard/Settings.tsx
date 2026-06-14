import { useState, useEffect } from "react";
import { cn } from "../../lib/utils";
import { api, ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import PasskeyButton from "../../components/PasskeyButton";
import Fa from '../../components/Fa';
import Select from '../../components/Select';

interface UserProfile {
  email: string;
  phone: string;
  role: string;
  isVerified: boolean;
}

export default function Settings() {
  const { user, refreshUser } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [showChangePw, setShowChangePw] = useState(false);

  useEffect(() => {
    if (!user) return;
    setProfile({
      email: user.email,
      phone: user.phone,
      role: user.role,
      isVerified: user.isVerified,
    });
  }, [user]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-ink-900">Settings</h1>
        <p className="text-ink-500">Manage your profile, preferences and security.</p>
      </div>

      {/* ─── Profile card ─────────────────────────────────────────────── */}
      <section className="rounded-3xl border border-ink-100/80 bg-white p-6 shadow-soft sm:p-8">
        <SectionTitle icon="user" title="Profile" />
        <div className="mt-5 flex items-center gap-4">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-ink-700 to-ink-900 text-xl font-semibold text-white">
            {(profile?.email?.[0] ?? '?').toUpperCase()}
          </div>
          <div>
            <div className="font-semibold text-ink-900">{profile?.email}</div>
            <div className="text-xs text-ink-400">{profile?.phone}</div>
          </div>
        </div>

        {/* Apple-style grouped list */}
        <div className="mt-6 divide-y divide-ink-100 rounded-2xl border border-ink-100 bg-white">
          <ListRow label="Email" value={profile?.email} />
          <ListRow label="Phone" value={profile?.phone} />
          <ListRow label="Role" value={profile?.role} />
          <ListRow
            label="Account status"
            value={profile?.isVerified ? 'Verified' : 'Unverified'}
            accent={profile?.isVerified ? 'emerald' : 'amber'}
          />
        </div>
      </section>

      {/* ─── Notifications — list rows with toggles ──────────────────── */}
      <section className="rounded-3xl border border-ink-100/80 bg-white p-6 shadow-soft sm:p-8">
        <SectionTitle icon="bell" title="Notifications" />
        <div className="mt-5 divide-y divide-ink-100 rounded-2xl border border-ink-100 bg-white">
          <Toggle label="Trip reminders & updates" defaultOn />
          <Toggle label="Parcel tracking alerts" defaultOn />
          <Toggle label="Promotions & offers" />
          <Toggle label="Email newsletter" defaultOn />
        </div>
      </section>

      {/* ─── Preferences — list rows with chevron-as-button (Apple) ──── */}
      <section className="rounded-3xl border border-ink-100/80 bg-white p-6 shadow-soft sm:p-8">
        <SectionTitle icon="globe" title="Preferences" />
        <div className="mt-5 divide-y divide-ink-100 rounded-2xl border border-ink-100 bg-white">
          <SelectRow label="Language" defaultValue="English" options={['English', 'Kinyarwanda', 'Français']} />
          <SelectRow label="Currency" defaultValue="RWF" options={['RWF — Rwandan Franc', 'USD — US Dollar']} />
        </div>
      </section>

      {/* ─── Security — Apple grouped list with chevron rows ─────────── */}
      <section className="rounded-3xl border border-ink-100/80 bg-white p-6 shadow-soft sm:p-8">
        <SectionTitle icon="shield" title="Security" />

        <div className="mt-5 divide-y divide-ink-100 rounded-2xl border border-ink-100 bg-white">
          <ActionRow
            icon="fingerprint"
            iconBg="ink-900"
            title="Passkeys"
            subtitle="Use biometrics to sign in — no password needed"
            trailing={
              <span className="chip bg-emerald-100 text-emerald-700">Enabled</span>
            }
          />
          <ActionRow
            icon="lock"
            iconBg="flame-600"
            title="Password"
            subtitle="Last changed when you signed up"
            trailing={
              <button
                onClick={() => setShowChangePw(true)}
                className="text-sm font-medium text-flame-600"
              >
                Change
              </button>
            }
          />
          <ActionRow
            icon="shield"
            iconBg="ink-900"
            title="Two-factor authentication"
            subtitle="Add a second factor to your sign-in"
            trailing={
              <span className="text-xs font-semibold text-ink-400">Off</span>
            }
          />
        </div>

        <div className="mt-4">
          <PasskeyButton mode="register" className="w-full" />
        </div>
      </section>

      {/* ─── Danger zone — sign out ───────────────────────────────────── */}
      <SignOutRow />

      {/* ─── Change-password dialog (Apple sheet) ──────────────────── */}
      {showChangePw && (
        <ChangePasswordDialog
          onClose={() => setShowChangePw(false)}
          onChanged={() => { setShowChangePw(false); refreshUser() }}
        />
      )}
    </div>
  );
}

function SignOutRow() {
  const { logout } = useAuth();
  const [busy, setBusy] = useState(false);
  return (
    <section className="rounded-3xl border border-flame-200/60 bg-white p-6 shadow-soft sm:p-8">
      <button
        type="button"
        disabled={busy}
        onClick={async () => { setBusy(true); try { await logout() } finally { setBusy(false) } }}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-flame-50 px-4 py-3 text-sm font-semibold text-flame-700 transition hover:bg-flame-100 disabled:opacity-50"
      >
        <Fa name="right-from-bracket" className="h-4 w-4" />
        {busy ? 'Signing out…' : 'Sign out'}
      </button>
    </section>
  );
}

function ChangePasswordDialog({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const issues = checkPasswordStrength(newPassword);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (issues.length) { setError(issues[0]); return; }
    setBusy(true); setError(null);
    try {
      await api.post('/api/auth/change-password', { oldPassword, newPassword });
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not change password');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-ink-950/40 p-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <form
        onSubmit={submit}
        className="w-full max-w-md overflow-hidden rounded-3xl border border-ink-100/80 bg-white p-7 shadow-glow"
      >
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-flame-600">Security</span>
            <h3 className="mt-1.5 text-2xl font-semibold tracking-tight text-ink-900">Change password</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 place-items-center rounded-full bg-ink-50 text-ink-500 transition hover:bg-ink-100"
          >
            <Fa name="x" className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-flame-50 px-4 py-3 text-sm text-flame-700">
            <Fa name="alert-circle" className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="mt-5 space-y-3">
          <PasswordField
            label="Current password"
            value={oldPassword}
            onChange={setOldPassword}
            autoFocus
          />
          <PasswordField
            label="New password"
            value={newPassword}
            onChange={setNewPassword}
            show={show}
            onToggleShow={() => setShow((v) => !v)}
            strengthIssues={issues}
          />
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-xl px-4 py-2.5 text-sm font-semibold text-ink-500 transition hover:bg-ink-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || !oldPassword || issues.length > 0}
            className="rounded-xl bg-ink-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-ink-800 disabled:opacity-50"
          >
            {busy ? 'Updating…' : 'Update password'}
          </button>
        </div>
      </form>
    </div>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  show,
  onToggleShow,
  autoFocus,
  strengthIssues,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  show?: boolean;
  onToggleShow?: () => void;
  autoFocus?: boolean;
  strengthIssues?: string[];
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <div className="relative">
        <Fa name="lock" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoFocus={autoFocus}
          className="input px-9"
        />
        {onToggleShow && (
          <button
            type="button"
            onClick={onToggleShow}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-900"
            aria-label="toggle password"
          >
            {show ? <Fa name="eyeoff" className="h-4 w-4" /> : <Fa name="eye" className="h-4 w-4" />}
          </button>
        )}
      </div>
      {strengthIssues && value.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-xs">
          <Rule ok={value.length >= 8} label="At least 8 characters" />
          <Rule ok={/[A-Z]/.test(value)} label="One uppercase letter" />
          <Rule ok={/[a-z]/.test(value)} label="One lowercase letter" />
          <Rule ok={/[0-9]/.test(value)} label="One number" />
        </ul>
      )}
    </label>
  );
}

function SectionTitle({ icon: iconName, title }: { icon: string; title: string }) {
  return (
    <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-ink-900">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-ink-50 text-ink-700">
        <Fa name={iconName} className="h-4 w-4" />
      </span>
      {title}
    </h2>
  );
}

/** Apple-style read-only list row. */
function ListRow({
  label,
  value,
  accent,
}: {
  label: string;
  value?: string;
  accent?: 'emerald' | 'amber';
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3 text-sm">
      <span className="text-ink-500">{label}</span>
      <span
        className={cn(
          'font-semibold',
          accent === 'emerald' && 'text-emerald-600',
          accent === 'amber' && 'text-amber-600',
          !accent && 'text-ink-900',
        )}
      >
        {value ?? '—'}
      </span>
    </div>
  );
}

/** Apple-style action row: icon + title + subtitle + trailing widget. */
function ActionRow({
  icon,
  iconBg,
  title,
  subtitle,
  trailing,
}: {
  icon: string;
  iconBg: string;
  title: string;
  subtitle: string;
  trailing: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <span
        className={cn(
          'grid h-9 w-9 shrink-0 place-items-center rounded-lg text-white',
          iconBg === 'ink-900' && 'bg-ink-900',
          iconBg === 'flame-600' && 'bg-flame-600',
        )}
      >
        <Fa name={icon} className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-ink-900">{title}</div>
        <div className="text-xs text-ink-400">{subtitle}</div>
      </div>
      {trailing}
    </div>
  );
}

/** Apple-style select row. */
function SelectRow({
  label,
  defaultValue,
  options,
}: {
  label: string;
  defaultValue: string;
  options: string[];
}) {
  const [value, setValue] = useState(defaultValue);
  return (
    <label className="flex items-center justify-between gap-3 px-4 py-3.5 text-sm">
      <span className="text-ink-500">{label}</span>
      <Select
        options={options.map((o) => ({ value: o, label: o }))}
        value={value}
        onChange={setValue}
        className="w-36"
      />
    </label>
  );
}

function Toggle({ label, defaultOn }: { label: string; defaultOn?: boolean }) {
  const [on, setOn] = useState(!!defaultOn);
  return (
    <button
      onClick={() => setOn((v) => !v)}
      className="flex w-full items-center justify-between px-4 py-3 text-left"
    >
      <span className="text-sm text-ink-700">{label}</span>
      <span
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition",
          on ? "bg-emerald-600" : "bg-ink-200",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition",
            on ? "left-[22px]" : "left-0.5",
          )}
        />
      </span>
    </button>
  );
}

function checkPasswordStrength(pw: string): string[] {
  const issues: string[] = [];
  if (pw.length < 8) issues.push('Password must be at least 8 characters.');
  if (!/[A-Z]/.test(pw)) issues.push('Password must contain at least one uppercase letter.');
  if (!/[a-z]/.test(pw)) issues.push('Password must contain at least one lowercase letter.');
  if (!/[0-9]/.test(pw)) issues.push('Password must contain at least one number.');
  return issues;
}

function Rule({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className={`flex items-center gap-1.5 ${ok ? 'text-emerald-600' : 'text-ink-400'}`}>
      <Fa name={ok ? 'check' : 'circle'} className="h-3 w-3" />
      <span>{label}</span>
    </li>
  );
}
