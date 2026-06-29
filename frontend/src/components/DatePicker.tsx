import { useState, useRef, useEffect } from 'react'
import { cn } from '../lib/utils'
import Fa from './Fa'

interface DatePickerProps {
  value: string
  onChange: (value: string) => void
  label?: string
  className?: string
  disabled?: boolean
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay()
}

function toISO(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function fromISO(iso: string): Date | null {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export default function DatePicker({ value, onChange, label, className, disabled }: DatePickerProps) {
  const ref = useRef<HTMLDivElement>(null)
  const selected = fromISO(value)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [open, setOpen] = useState(false)
  const [viewYear, setViewYear] = useState(selected?.getFullYear() ?? today.getFullYear())
  const [viewMonth, setViewMonth] = useState(selected?.getMonth() ?? today.getMonth())

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const daysInMonth = getDaysInMonth(viewYear, viewMonth)
  const firstDay = getFirstDayOfWeek(viewYear, viewMonth)
  const cells: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const goMonth = (delta: number) => {
    let m = viewMonth + delta
    let y = viewYear
    if (m < 0) { m = 11; y-- }
    if (m > 11) { m = 0; y++ }
    setViewMonth(m)
    setViewYear(y)
  }

  const handleSelect = (day: number) => {
    const date = new Date(viewYear, viewMonth, day)
    onChange(toISO(date))
    setOpen(false)
  }

  const isSelected = (day: number) =>
    selected &&
    selected.getDate() === day &&
    selected.getMonth() === viewMonth &&
    selected.getFullYear() === viewYear

  const isToday = (day: number) =>
    today.getDate() === day &&
    today.getMonth() === viewMonth &&
    today.getFullYear() === viewYear

  const displayValue = selected
    ? `${MONTH_NAMES[selected.getMonth()].slice(0, 3)} ${selected.getDate()}, ${selected.getFullYear()}`
    : ''

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
        <Fa name="calendar" className="h-4 w-4 shrink-0 text-ink-400" />
        <span className="flex-1 truncate">{selected ? displayValue : 'Select date'}</span>
        <Fa
          name="chevron-down"
          className={cn('h-4 w-4 shrink-0 text-ink-400 transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 w-[280px] overflow-hidden rounded-2xl border border-ink-100 bg-white p-3 shadow-card animate-fade-up origin-top">
          {/* Header */}
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => goMonth(-1)}
              className="grid h-8 w-8 place-items-center rounded-lg text-ink-400 hover:bg-ink-50 hover:text-ink-900 transition"
              aria-label="Previous month"
            >
              <Fa name="chevron-left" className="h-3.5 w-3.5" />
            </button>
            <span className="text-sm font-semibold text-ink-900">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={() => goMonth(1)}
              className="grid h-8 w-8 place-items-center rounded-lg text-ink-400 hover:bg-ink-50 hover:text-ink-900 transition"
              aria-label="Next month"
            >
              <Fa name="chevron-right" className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Day headers */}
          <div className="mb-1 grid grid-cols-7 gap-0.5">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
              <div key={d} className="py-1 text-center text-[11px] font-medium text-ink-400">
                {d}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((day, i) =>
              day === null ? (
                <div key={`empty-${i}`} />
              ) : (
                <button
                  key={day}
                  type="button"
                  onClick={() => handleSelect(day)}
                  className={cn(
                    'grid h-8 w-8 place-items-center rounded-full text-sm transition',
                    isSelected(day)
                      ? 'bg-ink-900 text-white font-semibold'
                      : isToday(day)
                        ? 'bg-ink-100 text-ink-900 font-semibold'
                        : 'text-ink-600 hover:bg-ink-50',
                  )}
                >
                  {day}
                </button>
              ),
            )}
          </div>

          {/* Footer */}
          <div className="mt-2 flex items-center justify-between border-t border-ink-100 pt-2">
            <button
              type="button"
              onClick={() => {
                onChange(toISO(today))
                setViewYear(today.getFullYear())
                setViewMonth(today.getMonth())
                setOpen(false)
              }}
              className="text-xs font-semibold text-flame-600 hover:text-flame-700"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs font-medium text-ink-400 hover:text-ink-600"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
