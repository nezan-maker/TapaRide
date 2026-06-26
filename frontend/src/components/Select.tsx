import { useState, useRef, useEffect } from 'react'
import { cn } from '../lib/utils'
import Fa from './Fa'

export interface SelectOption {
  value: string
  label: string
}

interface SelectProps {
  options: SelectOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  label?: string
  /** When true the trigger shows a chevron icon on the right. Default true. */
  showChevron?: boolean
}

export default function Select({
  options,
  value,
  onChange,
  placeholder = 'Select…',
  className,
  disabled,
  label,
  showChevron = true,
}: SelectProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = options.find((o) => o.value === value)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={ref} className={cn('relative', className)}>
      {label && <div className="label mb-1.5">{label}</div>}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className={cn(
          'input flex w-full items-center justify-between gap-2 text-left',
          !selected && 'text-ink-400',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
      >
        <span className="truncate">{selected ? selected.label : placeholder}</span>
        {showChevron && (
          <Fa
            name="chevron-down"
            className={cn('h-4 w-4 shrink-0 text-ink-400 transition-transform', open && 'rotate-180')}
          />
        )}
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-2xl border border-ink-100 bg-white py-1 shadow-card animate-fade-up origin-top">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value)
                setOpen(false)
              }}
              className={cn(
                'flex w-full items-center gap-3 px-4 py-2.5 text-sm transition text-left',
                opt.value === value
                  ? 'bg-ink-100 text-ink-900 font-semibold'
                  : 'text-ink-600 hover:bg-ink-50',
              )}
            >
              {opt.value === value && <Fa name="check" className="h-3.5 w-3.5 shrink-0 text-ink-700" />}
              <span className={opt.value === value ? '' : 'ml-[1.375rem]'}>{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
