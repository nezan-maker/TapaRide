import { useState } from "react";
import { cn } from "../../lib/utils";
import PasskeyButton from "../../components/PasskeyButton";
import Fa from '../../components/Fa';

export default function Settings() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold text-ink-900">Settings</h1>
        <p className="text-ink-500">
          Manage your profile, preferences and security.
        </p>
      </div>

      {/* Profile */}
      <div className="card p-6">
        <SectionTitle icon="user" title="Profile" />
        <div className="mt-4 flex items-center gap-4">
          <img
            src="https://i.pravatar.cc/120?img=47"
            alt="avatar"
            className="h-16 w-16 rounded-full object-cover"
          />
          <button className="btn-outline">Change photo</button>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Full name" value="Amina Uwimana" />
          <Field label="Email" value="amina.u@email.com" />
          <Field label="Phone" value="+250 788 123 456" />
          <Field label="City" value="Kigali" />
        </div>
        <div className="mt-5">
          <button className="btn-primary">Save changes</button>
        </div>
      </div>

      {/* Notifications */}
      <div className="card p-6">
        <SectionTitle icon="bell" title="Notifications" />
        <div className="mt-4 space-y-1">
          <Toggle label="Trip reminders & updates" defaultOn />
          <Toggle label="Parcel tracking alerts" defaultOn />
          <Toggle label="Promotions & offers" />
          <Toggle label="Email newsletter" defaultOn />
        </div>
      </div>

      {/* Preferences */}
      <div className="card p-6">
        <SectionTitle icon="globe" title="Preferences" />
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Language</label>
            <select className="input">
              <option>English</option>
              <option>Kinyarwanda</option>
              <option>Français</option>
            </select>
          </div>
          <div>
            <label className="label">Currency</label>
            <select className="input">
              <option>RWF — Rwandan Franc</option>
              <option>USD — US Dollar</option>
            </select>
          </div>
        </div>
      </div>

      {/* Security */}
      <div className="card p-6">
        <SectionTitle icon="shield" title="Security" />

        {/* Passkeys */}
        <div className="mt-4 rounded-xl border border-ink-100 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-ink-900 text-white">
                <Fa name="fingerprint" className="h-5 w-5" />
              </span>
              <div>
                <div className="font-semibold text-ink-900">Passkeys</div>
                <div className="text-xs text-ink-500">
                  Passwordless login method
                </div>
              </div>
            </div>
            <span className="chip bg-emerald-100 text-emerald-700">
              1 passkey
            </span>
          </div>

          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between rounded-lg bg-ink-50 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-ink-900">
                  iPhone 15 Pro
                </span>
                <span className="text-xs text-ink-400">• Added 2 days ago</span>
              </div>
              <button className="text-ink-300 hover:text-flame-600">
                <Fa name="trash2" className="h-4 w-4" />
              </button>
            </div>
          </div>

          <PasskeyButton mode="register" className="mt-3" />
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <button className="btn-outline flex-1">Change password</button>
          <button className="btn-outline flex-1">
            Enable two-factor authentication
          </button>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({
  icon: iconName,
  title,
}: {
  icon: string;
  title: string;
}) {
  return (
    <h2 className="flex items-center gap-2 font-bold text-ink-900">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-ink-50 text-ink-900">
        <Fa name={iconName} className="h-4 w-4" />
      </span>
      {title}
    </h2>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input className="input" defaultValue={value} />
    </div>
  );
}

function Toggle({ label, defaultOn }: { label: string; defaultOn?: boolean }) {
  const [on, setOn] = useState(!!defaultOn);
  return (
    <button
      onClick={() => setOn((v) => !v)}
      className="flex w-full items-center justify-between py-2.5 text-left"
    >
      <span className="text-sm text-ink-700">{label}</span>
      <span
        className={cn(
          "relative h-6 w-11 rounded-full transition",
          on ? "bg-ink-900" : "bg-ink-200",
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
