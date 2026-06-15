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
    <div className="grid h-screen overflow-hidden lg:grid-cols-[1fr_1.05fr]">
      {/* ── Brand side — Rwanda map showcase, LEFT column ──────────── */}
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-ink-900 via-ink-800 to-ink-700 lg:block">
        {/* Soft multi-blob background */}
        <div className="pointer-events-none absolute -right-32 -top-24 h-[28rem] w-[28rem] rounded-full bg-flame-500/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-20 h-[26rem] w-[26rem] rounded-full bg-flame-700/25 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '22px 22px' }} />

        {/* ── Bus oblique — diagonal decorative silhouette ───────────── */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <svg
            viewBox="0 0 320 120"
            className="absolute -bottom-4 -left-16 w-[480px] h-auto rotate-[-14deg] opacity-[0.040] sm:w-[560px]"
            fill="white"
            aria-hidden="true"
          >
            <path d="M35 20 L55 8 L270 8 Q288 8 288 22 L288 75 Q288 88 270 88 L48 88 L35 20Z" />
            <path d="M37 22 L55 13 L55 83 L37 76Z" />
            <rect x="62" y="14" width="38" height="32" rx="4" />
            <rect x="104" y="14" width="38" height="32" rx="4" />
            <rect x="146" y="14" width="38" height="32" rx="4" />
            <rect x="188" y="14" width="34" height="32" rx="4" />
            <rect x="40" y="68" width="242" height="3" rx="1.5" />
            <path d="M55 8 L270 8" stroke="white" strokeWidth="1.5" fill="none" />
            <circle cx="288" cy="72" r="5" />
            <circle cx="90" cy="90" r="14" fill="none" stroke="white" strokeWidth="3" />
            <circle cx="230" cy="90" r="14" fill="none" stroke="white" strokeWidth="3" />
            <circle cx="90" cy="90" r="5" fill="white" opacity="0.6" />
            <circle cx="230" cy="90" r="5" fill="white" opacity="0.6" />
            <path d="M268 55 Q280 55 290 50" stroke="white" strokeWidth="1.5" fill="none" opacity="0.5" />
            <path d="M270 62 Q282 62 292 58" stroke="white" strokeWidth="1.5" fill="none" opacity="0.35" />
          </svg>
          <svg
            viewBox="0 0 200 80"
            className="absolute -top-6 -right-8 w-[240px] h-auto rotate-[8deg] opacity-[0.020]"
            fill="white"
            aria-hidden="true"
          >
            <path d="M22 14 L38 6 L170 6 Q180 6 180 14 L180 48 Q180 56 170 56 L32 56 L22 14Z" />
            <path d="M24 16 L38 10 L38 52 L24 48Z" />
            <rect x="42" y="10" width="24" height="22" rx="3" />
            <rect x="70" y="10" width="24" height="22" rx="3" />
            <rect x="98" y="10" width="24" height="22" rx="3" />
            <rect x="126" y="10" width="22" height="22" rx="3" />
            <rect x="28" y="44" width="148" height="2" rx="1" />
            <circle cx="60" cy="58" r="9" fill="none" stroke="white" strokeWidth="2" />
            <circle cx="140" cy="58" r="9" fill="none" stroke="white" strokeWidth="2" />
            <circle cx="180" cy="48" r="3" />
          </svg>
        </div>

        {/* ── Brand side content ─────────────────────────────────┘ */}
        <div className="relative z-10 flex h-full flex-col text-white">

          {/* Top label */}
          <div className="shrink-0 px-14 pt-6 xl:px-20">
            <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/50">
              TapaRide &middot; Rwanda
            </div>
          </div>

          {/* Hero zone: stars + headline + map */}
          <div className="flex min-h-0 flex-1 flex-col px-14 xl:px-20">
            {/* Stars + tagline — compact */}
            <div className="shrink-0 flex items-center gap-1">
              <div className="flex items-center gap-0.5 text-flame-400">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Fa key={i} name="star" className="h-3 w-3 fill-current" />
                ))}
              </div>
              <span className="ml-1.5 text-[10px] font-medium tracking-wide text-white/50">
                5,000+ travellers
              </span>
            </div>

            {/* Headline — slim */}
            <h2 className="shrink-0 mt-2 max-w-[20ch] text-[1.6rem] font-bold leading-[1.1] tracking-tight">
              Travel smart.<br />Deliver <span className="text-flame-400">fast.</span>
            </h2>

            {/* ── Premium Rwanda map — main design component ─────── */}
            <div className="mt-3 flex min-h-0 flex-1 items-center justify-center">
              <RwandaMap />
            </div>
          </div>

          {/* Bottom quote */}
          <div className="shrink-0 px-14 pb-5 xl:px-20">
            <p className="text-[11px] leading-relaxed text-white/40">
              &ldquo;It&rsquo;s the only way I travel now.&rdquo; &mdash; <span className="text-white/70">Aline, Musanze</span>
            </p>
          </div>
        </div>
      </div>

      {/* ── Form side — login / signup, RIGHT column ─────────────────── */}
      <div className="relative flex flex-col overflow-hidden bg-white">
        <div className="pointer-events-none absolute -bottom-40 -right-40 h-[34rem] w-[34rem] rounded-full bg-flame-100/40 blur-3xl" />

        <div className="relative flex flex-1 flex-col overflow-hidden">
          <div className="shrink-0 px-6 pt-7 sm:px-12 sm:pt-10">
            <Logo height="lg" />
          </div>

          <div className="flex flex-1 items-center justify-center overflow-y-auto px-6 py-8 sm:px-12">
            <div className="w-full max-w-md">
              <h1 className="text-4xl font-bold tracking-tighter text-ink-900 sm:text-[2.6rem] sm:leading-[1.1]">
                {title}
              </h1>
              <p className="mt-3 text-base text-ink-500 sm:text-[15px]">{subtitle}</p>
              <div className="mt-9">{children}</div>
              {footer && <div className="mt-7 text-center text-sm text-ink-500">{footer}</div>}
            </div>
          </div>

          <p className="shrink-0 px-6 pb-6 text-center text-[11px] tracking-wider text-ink-300 sm:px-12">
            &copy; 2025 TapaRide Rwanda &middot; Made in Kigali
          </p>
        </div>
      </div>
    </div>
  )
}

function RwandaMap() {
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <svg
        viewBox="40 40 920 820"
        className="w-full h-auto max-h-full"
        fill="none"
        aria-hidden="true"
      >
        <defs>
          {/* ── Country glow filter ─────────────────────────── */}
          <filter id="countryGlow" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* ── Route gradients ─────────────────────────────── */}
          <linearGradient id="expressLine" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#EA580C" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#F97316" stopOpacity="0.25" />
          </linearGradient>
          <linearGradient id="localLine" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="white" stopOpacity="0.55" />
            <stop offset="100%" stopColor="white" stopOpacity="0.12" />
          </linearGradient>

          {/* ── Country fill ─────────────────────────────────── */}
          <radialGradient id="countryFill" cx="52%" cy="48%" r="58%">
            <stop offset="0%" stopColor="white" stopOpacity="0.06" />
            <stop offset="60%" stopColor="white" stopOpacity="0.02" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>

          {/* ── Grid pattern ─────────────────────────────────── */}
          <pattern id="mapGrid" width="40" height="40" patternUnits="userSpaceOnUse">
            <line x1="40" y1="0" x2="40" y2="40" stroke="white" strokeWidth="0.3" opacity="0.035" />
            <line x1="0" y1="40" x2="40" y2="40" stroke="white" strokeWidth="0.3" opacity="0.035" />
          </pattern>
        </defs>

        {/* ── Background grid ──────────────────────────────────── */}
        <rect x="0" y="0" width="1000" height="900" fill="url(#mapGrid)" />

        {/* ── Rwanda country outline ────────────────────────────── */}
        {/* Glow layer */}
        <path
          d="M116.2 784.1l-6.8-7.6-9.2-4.6-13.3-1.4-6-2.4-16.7-10.9-3.5-3.6 3-34.2-3-10.4-4.6-4.7-5-2.4-4-2.7-1.6-5.8 1.6-5.9 7.7-6.9-1.5-5.5-4.6-8.1-1.6-8.9-0.9-9.5 3.3-11.8 6.3-5.4 12-4.2 9.4-2.7 7.7-4.6 6.4-6.5 5.2-8.1 3.4-6.7 1.5-4.8 0.5-3.9 4.6-4.3 3.8-1.3 12.9 0.4 19.9-5.3 15.4-12.2 11.2-17.4 7.1-21.2 2.6-18.7-1-16.2-11.9-70.3-0.9-16.4 2.2-16 8.4-19.7 16.7-26.8 11.5-18.3 9.4-17.9 5.4-7.9 21.7-17.9 4.5-5.9 12.3-25.3 5.1-6.7 7.1-2.9 34.2-1.4 1.1-0.3 1-0.6 0.9-1 1.5-2.4 8.7-13.6 15.4-16 17.8-12.9 17.6-6.3 18 1 9.4-0.7 8.3-2.2 9.3-5.2 6.9-5 7.5-3.9 10.8-2 5.4 1.2 9.5 5.8 3.1 1.1 3.7-2.1 2.7-8.9 4-4.8 4.2-2.6 3.9-1.1 3.9 0.6 0.1 0 4.9 2.5 12.6 18.2 2 9.4 1 18.5 4.4 9.4 7.7 7.2 8.7 2.5 9.4-1 9.9-3.7 30.4-16.8 4.6-1 4.1-9.7 5.8-6.1 2.3-1.2 13.2-7.1 18.3-7.1 4.9-4.5 2.3-6.9 2.7-17.3 3.2-6.1 3.5-2.1 3.6-0.6 3.5-0.3 3.4-1 6.9-4.1 19.9-18.9 5.8-7.5 4.9-8.1 0.8-3 1-6.4 1.3-2.7 1.5-1.2 1.6-1.4 7.5-3.3 2.8-2.3 2.3-6.8 2.9-18.5 3.8-6.4 6.8-2.5 7.4 1.1 7.6 2.3 7.6 0.9 7-1.7 5.9-2.7 6.1-0.8 6.8 2.1 4.9 1.6-3.6 3.7-3.4 4.9-1.4 5 1.5 4.8 6.5 4.5 1.5 6.1-1 2.7-1.7 2.5-1.2 2.7 0.8 2.7 3.9 2.6 3.6-0.5 2.9-1.6 1.8-0.5 5.5 4 1.9 2.7 1.8 11.6 2.7 6.5 8.2 13.5 2.6 9.2 4.2 5.4 0.9 3.6-0.5 1.4-1 2-1.1 2.6-0.4 3.3 2.4 7.2 5.8 4.4 13.2 5.4 4.7 3.4 6.7 6.3 4.1 2.5 29.6 11 8.8 1.3 8.7 5.2 2.5 11.7-0.8 11.7-1.4 5.3-2.4 2.6 2.7 5.8 7.4 9.9 5.5 5.9 2 3.5 4.4 16.1 4.3 10.1 7 5.5 10.6-4.1 3.3 9.5-0.4 11.5-5.8 35.3-0.1 4.9 1 2.3 4 6.1 1.1 4.1-5.1 12.3 1.5 4.7 3.6 18-2.5 7.6-4.5 6.7-2.5 6.9 3.4 8-7.3 5.7-2.7 2.9-2.2 3.6 13.4 2.2 1.3 11.8-5.9 26.1 8.4-1.8 8.1 4 6.8 6.9 4.8 6.4 3.7 13-15.4 49.9-3.8 19.7 1.8 30.7-1.8 9.1-4.7 8.4-5.8 4.2-7.5 3.4-6.9 3.9-6.3 1.6-3.2 1.8-4.1 1.1-3.7-0.9-23.3-11.5-4.8-1.5-5.8 0.8-5.2 4-6.3 12-5.1 4.3-9.3 0.5-9.7-2.8-9.6-1.2-8.6 5.1-14.7-0.6-14.9-7-24.4-19.9-2.5-3.6-2.3-6.2-2.2-2.5-1.5 0.6-14.2-3.4-2.1-1.1-7.2 2.1-4.4 4.1-1.9 2.4-2 2.7-5.8 5.3-6.4 3.3-8.4 2.8-8.6 1.7-7.2 0.3-5.6-1.2-13.9-6.8-5.2-0.5-1.6 3-0.3 4.2-0.9 3.1-20.2 25.4-7.6 5.3-10 0.3-10.3-4-9.4-6.2-7.3-6.4-13.9-16.4-5.5-4.3-5.1-1.8-4.3-0.1-3.7 0.4-3.5-0.5-7.9-6.8-0.8-0.7-3-2.6-3.6-2.1-4.6 0.2-1.3 2.5 0 4.1-2.9 23 3.2 34.4-9.7 33.9-1.8 45.9-0.2 5-2.4 9.9-4.3 9.8-5.5 9.2-5.9 8.1-9.2 9.3-8.4 5-9.1 1.7-11.1-0.3-10-3-5.1 0-3.3 4.2-1.5 9.4-2 4.2-4.3 2.6-10 1.3-8.5-1.3-18.6-6.2-4.8-1.6-3.2-0.2-13.3 4.9-3.3 2-3.6 1.4-4.6-0.2-9.8 1.3-8.4 5.3-8.5 2.9-10.4-5.9-16.2-3-8.7-1.6-8 0.9-19.3 8.4-11.1 1-3.9-8.5-0.5-5.6-4.2-9.3-1-5.2 1.5-4.7 6.2-7.6 1-5.1-2.8-5.5-9.7-9.2-0.1-0.4-1.5-6.1 0.6-5.2-0.4-2.1-5.4-4.1-8.2-4.7-9.5-2.2-18.9-2.4-10-3.1-27.2-11.8-7.2-1.1-26.1 1.7-10.1 10-7.8 44.8z"
          fill="none"
          stroke="#EA580C"
          strokeWidth="4"
          opacity="0.12"
          filter="url(#countryGlow)"
        />
        {/* Main border */}
        <path
          d="M116.2 784.1l-6.8-7.6-9.2-4.6-13.3-1.4-6-2.4-16.7-10.9-3.5-3.6 3-34.2-3-10.4-4.6-4.7-5-2.4-4-2.7-1.6-5.8 1.6-5.9 7.7-6.9-1.5-5.5-4.6-8.1-1.6-8.9-0.9-9.5 3.3-11.8 6.3-5.4 12-4.2 9.4-2.7 7.7-4.6 6.4-6.5 5.2-8.1 3.4-6.7 1.5-4.8 0.5-3.9 4.6-4.3 3.8-1.3 12.9 0.4 19.9-5.3 15.4-12.2 11.2-17.4 7.1-21.2 2.6-18.7-1-16.2-11.9-70.3-0.9-16.4 2.2-16 8.4-19.7 16.7-26.8 11.5-18.3 9.4-17.9 5.4-7.9 21.7-17.9 4.5-5.9 12.3-25.3 5.1-6.7 7.1-2.9 34.2-1.4 1.1-0.3 1-0.6 0.9-1 1.5-2.4 8.7-13.6 15.4-16 17.8-12.9 17.6-6.3 18 1 9.4-0.7 8.3-2.2 9.3-5.2 6.9-5 7.5-3.9 10.8-2 5.4 1.2 9.5 5.8 3.1 1.1 3.7-2.1 2.7-8.9 4-4.8 4.2-2.6 3.9-1.1 3.9 0.6 0.1 0 4.9 2.5 12.6 18.2 2 9.4 1 18.5 4.4 9.4 7.7 7.2 8.7 2.5 9.4-1 9.9-3.7 30.4-16.8 4.6-1 4.1-9.7 5.8-6.1 2.3-1.2 13.2-7.1 18.3-7.1 4.9-4.5 2.3-6.9 2.7-17.3 3.2-6.1 3.5-2.1 3.6-0.6 3.5-0.3 3.4-1 6.9-4.1 19.9-18.9 5.8-7.5 4.9-8.1 0.8-3 1-6.4 1.3-2.7 1.5-1.2 1.6-1.4 7.5-3.3 2.8-2.3 2.3-6.8 2.9-18.5 3.8-6.4 6.8-2.5 7.4 1.1 7.6 2.3 7.6 0.9 7-1.7 5.9-2.7 6.1-0.8 6.8 2.1 4.9 1.6-3.6 3.7-3.4 4.9-1.4 5 1.5 4.8 6.5 4.5 1.5 6.1-1 2.7-1.7 2.5-1.2 2.7 0.8 2.7 3.9 2.6 3.6-0.5 2.9-1.6 1.8-0.5 5.5 4 1.9 2.7 1.8 11.6 2.7 6.5 8.2 13.5 2.6 9.2 4.2 5.4 0.9 3.6-0.5 1.4-1 2-1.1 2.6-0.4 3.3 2.4 7.2 5.8 4.4 13.2 5.4 4.7 3.4 6.7 6.3 4.1 2.5 29.6 11 8.8 1.3 8.7 5.2 2.5 11.7-0.8 11.7-1.4 5.3-2.4 2.6 2.7 5.8 7.4 9.9 5.5 5.9 2 3.5 4.4 16.1 4.3 10.1 7 5.5 10.6-4.1 3.3 9.5-0.4 11.5-5.8 35.3-0.1 4.9 1 2.3 4 6.1 1.1 4.1-5.1 12.3 1.5 4.7 3.6 18-2.5 7.6-4.5 6.7-2.5 6.9 3.4 8-7.3 5.7-2.7 2.9-2.2 3.6 13.4 2.2 1.3 11.8-5.9 26.1 8.4-1.8 8.1 4 6.8 6.9 4.8 6.4 3.7 13-15.4 49.9-3.8 19.7 1.8 30.7-1.8 9.1-4.7 8.4-5.8 4.2-7.5 3.4-6.9 3.9-6.3 1.6-3.2 1.8-4.1 1.1-3.7-0.9-23.3-11.5-4.8-1.5-5.8 0.8-5.2 4-6.3 12-5.1 4.3-9.3 0.5-9.7-2.8-9.6-1.2-8.6 5.1-14.7-0.6-14.9-7-24.4-19.9-2.5-3.6-2.3-6.2-2.2-2.5-1.5 0.6-14.2-3.4-2.1-1.1-7.2 2.1-4.4 4.1-1.9 2.4-2 2.7-5.8 5.3-6.4 3.3-8.4 2.8-8.6 1.7-7.2 0.3-5.6-1.2-13.9-6.8-5.2-0.5-1.6 3-0.3 4.2-0.9 3.1-20.2 25.4-7.6 5.3-10 0.3-10.3-4-9.4-6.2-7.3-6.4-13.9-16.4-5.5-4.3-5.1-1.8-4.3-0.1-3.7 0.4-3.5-0.5-7.9-6.8-0.8-0.7-3-2.6-3.6-2.1-4.6 0.2-1.3 2.5 0 4.1-2.9 23 3.2 34.4-9.7 33.9-1.8 45.9-0.2 5-2.4 9.9-4.3 9.8-5.5 9.2-5.9 8.1-9.2 9.3-8.4 5-9.1 1.7-11.1-0.3-10-3-5.1 0-3.3 4.2-1.5 9.4-2 4.2-4.3 2.6-10 1.3-8.5-1.3-18.6-6.2-4.8-1.6-3.2-0.2-13.3 4.9-3.3 2-3.6 1.4-4.6-0.2-9.8 1.3-8.4 5.3-8.5 2.9-10.4-5.9-16.2-3-8.7-1.6-8 0.9-19.3 8.4-11.1 1-3.9-8.5-0.5-5.6-4.2-9.3-1-5.2 1.5-4.7 6.2-7.6 1-5.1-2.8-5.5-9.7-9.2-0.1-0.4-1.5-6.1 0.6-5.2-0.4-2.1-5.4-4.1-8.2-4.7-9.5-2.2-18.9-2.4-10-3.1-27.2-11.8-7.2-1.1-26.1 1.7-10.1 10-7.8 44.8z"
          fill="url(#countryFill)"
          stroke="white"
          strokeWidth="1.2"
          opacity="0.28"
        />

        {/* ── Lake Kivu ─────────────────────────────────────────────── */}
        <path
          d="M 108,245 C 85,300 72,400 65,500 C 58,600 55,680 58,755 C 65,770 78,765 82,740 C 88,680 92,600 95,500 C 98,400 105,320 112,275 C 115,260 112,248 108,245 Z"
          fill="white"
          opacity="0.07"
        />

        {/* ── Primary route lines ──────────────────────────────────── */}
        {/* Kigali → Musanze */}
        <path d="M 590,440 Q 520,340 390,240" stroke="url(#expressLine)" strokeWidth="2" strokeDasharray="7 5" opacity="0.8" />
        {/* Kigali → Rubavu */}
        <path d="M 590,440 Q 500,370 280,330" stroke="url(#localLine)" strokeWidth="1.5" opacity="0.4" />
        {/* Kigali → Rusizi */}
        <path d="M 590,440 Q 460,560 85,770" stroke="url(#expressLine)" strokeWidth="1.8" strokeDasharray="6 5" opacity="0.6" />
        {/* Kigali → Huye */}
        <path d="M 590,440 Q 540,580 445,730" stroke="url(#localLine)" strokeWidth="1.5" opacity="0.4" />
        {/* Kigali → Nyagatare */}
        <path d="M 590,440 Q 660,300 745,150" stroke="url(#expressLine)" strokeWidth="1.8" opacity="0.55" />
        {/* Kigali → Karongi */}
        <path d="M 590,440 Q 470,430 280,485" stroke="url(#localLine)" strokeWidth="1.5" strokeDasharray="5 5" opacity="0.45" />
        {/* Kigali → Muhanga */}
        <path d="M 590,440 Q 530,460 445,500" stroke="url(#localLine)" strokeWidth="1.2" opacity="0.3" />

        {/* ── Secondary route lines (more connections) ─────────────── */}
        {/* Kigali → Rwamagana → Kayonza (east corridor) */}
        <path d="M 590,440 Q 640,420 680,415" stroke="url(#expressLine)" strokeWidth="1.5" opacity="0.45" />
        <path d="M 680,415 Q 710,395 740,380" stroke="url(#localLine)" strokeWidth="1.2" strokeDasharray="4 4" opacity="0.35" />
        {/* Kayonza → Nyagatare */}
        <path d="M 740,380 Q 745,260 745,150" stroke="url(#expressLine)" strokeWidth="1" opacity="0.25" />
        {/* Kigali → Byumba */}
        <path d="M 590,440 Q 570,340 510,260" stroke="url(#localLine)" strokeWidth="1.2" strokeDasharray="5 5" opacity="0.35" />
        {/* Musanze → Byumba */}
        <path d="M 390,240 Q 450,245 510,260" stroke="url(#expressLine)" strokeWidth="1" opacity="0.25" />
        {/* Muhanga → Ruhango → Huye (south corridor) */}
        <path d="M 445,500 Q 450,540 455,580" stroke="url(#localLine)" strokeWidth="1.2" opacity="0.3" />
        <path d="M 455,580 Q 450,660 445,730" stroke="url(#expressLine)" strokeWidth="1.2" strokeDasharray="4 4" opacity="0.25" />
        {/* Lake Kivu western route: Rubavu → Karongi → Rusizi */}
        <path d="M 280,330 Q 280,410 280,485" stroke="url(#expressLine)" strokeWidth="1.2" opacity="0.3" />
        <path d="M 280,485 Q 200,630 85,770" stroke="url(#localLine)" strokeWidth="1" strokeDasharray="4 4" opacity="0.25" />
        {/* Muhanga → Karongi cross-route */}
        <path d="M 445,500 Q 360,500 280,485" stroke="url(#localLine)" strokeWidth="1" strokeDasharray="3 3" opacity="0.3" />
        {/* Huye → Rusizi */}
        <path d="M 445,730 Q 340,730 85,770" stroke="url(#localLine)" strokeWidth="1.2" strokeDasharray="4 4" opacity="0.35" />
        {/* Nyagatare → Huye (long diagonal) */}
        <path d="M 745,150 Q 660,500 445,730" stroke="url(#expressLine)" strokeWidth="1" opacity="0.2" />

        {/* ── Major city nodes ──────────────────────────────────────── */}
        {/* Kigali — central hub */}
        <circle cx="590" cy="440" r="7" fill="#EA580C" stroke="white" strokeWidth="2.5" opacity="0.95" />
        <circle cx="590" cy="440" r="11" fill="none" stroke="#EA580C" strokeWidth="1.2" opacity="0.4">
          <animate attributeName="r" values="11;18;11" dur="3s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.4;0.06;0.4" dur="3s" repeatCount="indefinite" />
        </circle>
        <text x="590" y="428" textAnchor="middle" fill="white" fontSize="9" fontWeight="700" letterSpacing="0.6">KIGALI</text>

        <circle cx="390" cy="240" r="4.5" fill="white" stroke="#EA580C" strokeWidth="1.5" opacity="0.85" />
        <text x="390" y="226" textAnchor="middle" fill="white" fontSize="7.5" fontWeight="600" opacity="0.7">Musanze</text>

        <circle cx="280" cy="330" r="4" fill="white" stroke="#EA580C" strokeWidth="1.5" opacity="0.85" />
        <text x="280" y="316" textAnchor="middle" fill="white" fontSize="7" fontWeight="600" opacity="0.65">Rubavu</text>

        <circle cx="85" cy="770" r="4" fill="white" stroke="#EA580C" strokeWidth="1.5" opacity="0.85" />
        <text x="85" y="784" textAnchor="middle" fill="white" fontSize="7" fontWeight="600" opacity="0.65">Rusizi</text>

        <circle cx="445" cy="730" r="4.5" fill="white" stroke="#EA580C" strokeWidth="1.5" opacity="0.85" />
        <text x="445" y="744" textAnchor="middle" fill="white" fontSize="7.5" fontWeight="600" opacity="0.7">Huye</text>

        <circle cx="745" cy="150" r="4" fill="white" stroke="#EA580C" strokeWidth="1.5" opacity="0.85" />
        <text x="745" y="136" textAnchor="middle" fill="white" fontSize="7" fontWeight="600" opacity="0.65">Nyagatare</text>

        <circle cx="280" cy="485" r="3.5" fill="white" opacity="0.55" />
        <text x="280" y="498" textAnchor="middle" fill="white" fontSize="6.5" fontWeight="500" opacity="0.5">Karongi</text>

        <circle cx="445" cy="500" r="3.5" fill="white" opacity="0.55" />
        <text x="445" y="513" textAnchor="middle" fill="white" fontSize="6.5" fontWeight="500" opacity="0.5">Muhanga</text>

        {/* ── Secondary city nodes (small, unlabeled) ──────────────── */}
        <circle cx="680" cy="415" r="2.5" fill="white" opacity="0.4" />
        <text x="680" y="406" textAnchor="middle" fill="white" fontSize="5.5" fontWeight="400" opacity="0.4">Rwamagana</text>

        <circle cx="740" cy="380" r="2.5" fill="white" opacity="0.35" />
        <text x="740" y="371" textAnchor="middle" fill="white" fontSize="5.5" fontWeight="400" opacity="0.35">Kayonza</text>

        <circle cx="455" cy="580" r="2.5" fill="white" opacity="0.35" />
        <text x="455" y="571" textAnchor="middle" fill="white" fontSize="5.5" fontWeight="400" opacity="0.35">Ruhango</text>

        <circle cx="510" cy="260" r="2.5" fill="white" opacity="0.35" />
        <text x="510" y="251" textAnchor="middle" fill="white" fontSize="5.5" fontWeight="400" opacity="0.35">Byumba</text>

        {/* ── Compass rose — top-right ────────────────────────────── */}
        <g transform="translate(880, 80)" opacity="0.2">
          <line x1="0" y1="20" x2="0" y2="0" stroke="white" strokeWidth="1.5" />
          <polygon points="-3,6 0,0 3,6" fill="white" />
          <text x="0" y="34" textAnchor="middle" fill="white" fontSize="7" fontWeight="600" letterSpacing="1">N</text>
        </g>

        {/* ── Legend — bottom-right ──────────────────────────────── */}
        <g transform="translate(510, 780)" opacity="0.4">
          <line x1="0" y1="0" x2="18" y2="0" stroke="white" strokeWidth="1.5" opacity="0.6" />
          <text x="24" y="4" fill="white" fontSize="6.5" fontWeight="500">Active routes</text>
          <line x1="0" y1="12" x2="18" y2="12" stroke="#EA580C" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.7" />
          <text x="24" y="16" fill="white" fontSize="6.5" fontWeight="500">Express lines</text>
        </g>
      </svg>
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
