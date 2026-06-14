import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import Logo from '../../components/Logo'
import Fa from '../../components/Fa'

export default function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      {/* Form side */}
      <div className="relative flex flex-col bg-white">
        {/* Subtle background detail — large soft blob anchored to the bottom-left */}
        <div className="pointer-events-none absolute -bottom-40 -left-40 h-[34rem] w-[34rem] rounded-full bg-flame-100/40 blur-3xl" />

        <div className="relative flex flex-1 flex-col">
          <div className="px-6 pt-7 sm:px-10 sm:pt-10">
            <Logo />
          </div>

          <div className="flex flex-1 items-center justify-center px-6 py-10 sm:px-10">
            <div className="w-full max-w-md">
              <h1 className="text-4xl font-bold tracking-tighter text-ink-900 sm:text-[2.6rem] sm:leading-[1.1]">
                {title}
              </h1>
              <p className="mt-3 text-base text-ink-500 sm:text-[15px]">{subtitle}</p>
              <div className="mt-9">{children}</div>
              {footer && <div className="mt-7 text-center text-sm text-ink-500">{footer}</div>}
            </div>
          </div>

          <p className="relative px-6 pb-6 text-center text-[11px] tracking-wider text-ink-300 sm:px-10">
            © 2025 TapaRide Rwanda · Made in Kigali
          </p>
        </div>
      </div>

      {/* Brand side — larger gradient blob stage */}
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-ink-900 via-ink-800 to-ink-700 lg:block">
        {/* Soft multi-blob background */}
        <div className="pointer-events-none absolute -right-32 -top-24 h-[28rem] w-[28rem] rounded-full bg-flame-500/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-20 h-[26rem] w-[26rem] rounded-full bg-flame-700/25 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '22px 22px' }} />

        <div className="relative flex h-full flex-col px-14 xl:px-20 text-white">
          <div className="pt-12">
            <div className="text-xs font-medium uppercase tracking-[0.18em] text-white/50">
              TapaRide · Rwanda
            </div>
          </div>

          <div className="my-auto">
            <div className="mb-5 flex items-center gap-1 text-flame-400">
              {Array.from({ length: 5 }).map((_, i) => (
                <Fa key={i} name="star" className="h-4 w-4 fill-current" />
              ))}
              <span className="ml-2 text-[12px] font-medium text-white/70">5,000+ travellers · Kigali</span>
            </div>
            <h2 className="max-w-lg text-[3.6rem] font-bold leading-[1.05] tracking-tighter">
              Travel smart.<br />Deliver <span className="text-flame-400">fast.</span>
            </h2>
            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-white/70">
              Join thousands of Rwandans who book buses and send parcels the easy way —
              secure payments, digital tickets and live tracking.
            </p>

            <div className="mt-12 space-y-3">
              <Feature icon="bus"          title="Premium buses across 15+ cities" />
              <Feature icon="package"      title="Trackable parcel delivery"         />
              <Feature icon="shieldcheck"  title="Secure Mobile Money & card payments" />
              <Feature icon="maplocationdot" title="Live trip & vehicle GPS tracking" />
            </div>
          </div>

          <div className="pb-10 text-xs text-white/40">
            "It's the only way I travel now." — <span className="text-white/70">Aline, Musanze</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function Feature({ icon, title }: { icon: string; title: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white/5 backdrop-blur-sm p-3">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-flame-600 to-flame-700 shadow-lg shadow-flame-600/30">
        <Fa name={icon} className="h-4.5 w-4.5" />
      </span>
      <span className="text-sm font-medium text-white">{title}</span>
    </div>
  )
}

export function AuthLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="font-semibold text-flame-600 hover:text-flame-700">
      {children}
    </Link>
  )
}
