interface BusSpinnerProps {
  label?: string
  className?: string
}

export default function BusSpinner({ label, className = '' }: BusSpinnerProps) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <div className="relative h-16 w-28">
        {/* Road */}
        <div className="absolute bottom-1.5 left-0 right-0 h-0.5 bg-ink-200" />
        <div className="absolute bottom-1.5 left-0 right-0 h-0.5 overflow-hidden">
          <div className="h-full w-8 animate-[road_1.2s_linear_infinite] rounded-full bg-ink-300" />
        </div>

        {/* Bus body (sideways) */}
        <svg viewBox="0 0 100 50" className="absolute bottom-2 left-1/2 h-10 w-24 -translate-x-1/2 animate-[bounce_0.6s_ease-in-out_infinite_alternate]">
          <rect x="8" y="10" width="72" height="24" rx="6" fill="#10075C" />
          <rect x="8" y="10" width="72" height="24" rx="6" fill="url(#busGradient)" />
          {/* Windows */}
          <rect x="14" y="14" width="12" height="10" rx="2" fill="white" opacity="0.9" />
          <rect x="29" y="14" width="12" height="10" rx="2" fill="white" opacity="0.9" />
          <rect x="44" y="14" width="12" height="10" rx="2" fill="white" opacity="0.9" />
          <rect x="59" y="14" width="12" height="10" rx="2" fill="white" opacity="0.9" />
          {/* Door */}
          <rect x="76" y="14" width="8" height="16" rx="1.5" fill="#0d0648" />
          <circle cx="82" cy="22" r="1" fill="#EA580C" />
          {/* Stripe */}
          <rect x="8" y="32" width="72" height="3" fill="#EA580C" />
          {/* Front light */}
          <circle cx="86" cy="28" r="2" fill="#EA580C" />
          <defs>
            <linearGradient id="busGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1a0d7a" />
              <stop offset="100%" stopColor="#10075C" />
            </linearGradient>
          </defs>
        </svg>

        {/* Wheels with spin animation */}
        <div className="absolute bottom-0 left-4 h-4 w-4">
          <svg viewBox="0 0 16 16" className="h-full w-full animate-[spin_0.8s_linear_infinite]">
            <circle cx="8" cy="8" r="7" fill="#1d1d1f" />
            <circle cx="8" cy="8" r="3" fill="#666" />
            <line x1="8" y1="1" x2="8" y2="5" stroke="#444" strokeWidth="1" />
            <line x1="8" y1="11" x2="8" y2="15" stroke="#444" strokeWidth="1" />
            <line x1="1" y1="8" x2="5" y2="8" stroke="#444" strokeWidth="1" />
            <line x1="11" y1="8" x2="15" y2="8" stroke="#444" strokeWidth="1" />
          </svg>
        </div>
        <div className="absolute bottom-0 right-4 h-4 w-4">
          <svg viewBox="0 0 16 16" className="h-full w-full animate-[spin_0.8s_linear_infinite]">
            <circle cx="8" cy="8" r="7" fill="#1d1d1f" />
            <circle cx="8" cy="8" r="3" fill="#666" />
            <line x1="8" y1="1" x2="8" y2="5" stroke="#444" strokeWidth="1" />
            <line x1="8" y1="11" x2="8" y2="15" stroke="#444" strokeWidth="1" />
            <line x1="1" y1="8" x2="5" y2="8" stroke="#444" strokeWidth="1" />
            <line x1="11" y1="8" x2="15" y2="8" stroke="#444" strokeWidth="1" />
          </svg>
        </div>
      </div>
      {label && <span className="text-sm font-medium text-ink-500">{label}</span>}
    </div>
  )
}
