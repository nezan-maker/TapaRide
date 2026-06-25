// src/components/LogoUpload.tsx
//
// Drag-and-drop logo uploader with live preview, type/size validation
// Client-side voice matches Apple's setup screens: nothing screams,
// everything animates, the user always sees what will be sent.
//
// Inputs are validated client-side as a UX courtesy. The backend
// re-validates with magic-byte sniffing + sharp sanitization. Never
// rely on this component alone for security — it's a UX pass.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Fa from './Fa';

const ALLOWED = [
  { ext: 'PNG', mime: 'image/png' },
  { ext: 'JPG', mime: 'image/jpeg' },
  { ext: 'SVG', mime: 'image/svg+xml' },
] as const
const MAX_BYTES = 5 * 1024 * 1024

export interface UploadedLogo {
  file: File
  previewUrl: string
}

interface LogoUploadProps {
  value: UploadedLogo | null
  onChange: (next: UploadedLogo | null) => void
  onError?: (msg: string) => void
  /** Square target ratio. Default 1:1 because agency marks work best square. */
  hint?: string
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function validate(file: File): string | null {
  if (file.size > MAX_BYTES) {
    return `Logo is ${formatBytes(file.size)}. Max is ${formatBytes(MAX_BYTES)}.`
  }
  const okMime = ALLOWED.some((a) => a.mime === file.type)
  if (!okMime) {
    // Some browsers leave file.type empty for SVG. Check extension too.
    const lower = file.name.toLowerCase()
    const okExt = lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.svg')
    if (!okExt) {
      return 'Only PNG, JPG or SVG files are accepted.'
    }
  }
  return null
}

export default function LogoUpload({ value, onChange, onError, hint }: LogoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const file = value?.file ?? null;
  const [dragOver, setDragOver] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Derive the blob URL lazily from the current File. useMemo doesn't run
  // a side effect on every render — but URL.createObjectURL is a one-shot
  // sync-with-external call so it lives inside useMemo, and the matching
  // revoke lives in a small effect keyed off the resulting URL.
  const internalPreview = useMemo(
    () => (file === null ? null : URL.createObjectURL(file)),
    [file],
  );

  useEffect(() => {
    return () => {
      if (internalPreview) URL.revokeObjectURL(internalPreview);
    };
  }, [internalPreview]);

  const accept = useCallback((file: File) => {
    const err = validate(file)
    if (err) {
      setLocalError(err)
      onError?.(err)
      return
    }
    setLocalError(null)
    onError?.('' as unknown as string)
    onChange({ file, previewUrl: '' })
  }, [onChange, onError])

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) accept(file)
  }

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) accept(file)
    // reset so re-selecting the same file fires onChange
    e.target.value = ''
  }

  const clear = () => {
    setLocalError(null)
    onChange(null)
  }

  const previewSrc = internalPreview ?? value?.previewUrl ?? null

  return (
    <div className="space-y-2.5">
      <div className="flex items-baseline justify-between">
        <label className="label !mb-0">Agency logo</label>
        <span className="text-[11px] text-ink-400">PNG, JPG or SVG · 5 MB max</span>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml,.png,.jpg,.jpeg,.svg"
        className="hidden"
        onChange={onPick}
      />

      {previewSrc ? (
        <div className="group relative overflow-hidden rounded-2xl border border-ink-100 bg-gradient-to-br from-mist via-white to-haze">
          <div
            className="aspect-square w-full bg-[radial-gradient(circle_at_top_left,#F4F3FC_0%,transparent_60%),radial-gradient(circle_at_bottom_right,#FFE6D5_0%,transparent_55%)]"
            aria-hidden
          />
          <div className="absolute inset-0 grid place-items-center p-6">
            {/* checkerboard under-image so transparent PNGs read on light bg */}
            <div className="relative grid h-full max-h-44 w-full max-w-44 place-items-center">
              <div
                aria-hidden
                className="absolute inset-0 rounded-2xl shadow-[inset_0_0_0_1px_rgba(16,7,92,0.06),inset_0_0_24px_rgba(16,7,92,0.05)]"
                style={{
                  backgroundImage:
                    'linear-gradient(45deg, rgba(16,7,92,0.04) 25%, transparent 25%), linear-gradient(-45deg, rgba(16,7,92,0.04) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(16,7,92,0.04) 75%), linear-gradient(-45deg, transparent 75%, rgba(16,7,92,0.04) 75%)',
                  backgroundSize: '16px 16px',
                  backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0',
                }}
              />
              <img
                src={previewSrc}
                alt="Agency logo preview"
                className="relative max-h-44 max-w-full object-contain drop-shadow-[0_8px_24px_rgba(16,7,92,0.18)] transition-transform duration-300 group-hover:scale-[1.02]"
              />
            </div>
          </div>

          <div className="absolute right-3 top-3 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="grid h-9 w-9 place-items-center rounded-full bg-white/90 text-ink-900 shadow-soft backdrop-blur transition hover:bg-white hover:shadow-card"
              aria-label="Replace logo"
            >
              <Fa name="pencil" className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={clear}
              className="grid h-9 w-9 place-items-center rounded-full bg-white/90 text-flame-600 shadow-soft backdrop-blur transition hover:bg-flame-50 hover:shadow-card"
              aria-label="Remove logo"
            >
              <Fa name="trash" className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click()
          }}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={[
            'group relative cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed bg-white/70 p-8 text-center transition-all duration-200',
            dragOver
              ? 'border-ink-700 bg-ink-50/80 shadow-card-sm scale-[1.01]'
              : 'border-ink-200 hover:border-ink-900 hover:bg-white hover:shadow-soft',
          ].join(' ')}
        >
          {/* gradient pickup glow */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            style={{
              background:
                'radial-gradient(60% 50% at 50% 0%, rgba(16,7,92,0.06) 0%, transparent 70%)',
            }}
          />
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-ink-900 text-white shadow-card-sm transition-transform duration-300 group-hover:-translate-y-0.5">
            <Fa name="cloudarrowup" className="h-6 w-6" />
          </div>
          <div className="mt-4 font-semibold text-ink-900">
            Drag your logo here, or click to browse
          </div>
          <p className="mt-1 text-xs text-ink-500">
            {hint ?? 'Square images work best. We accept PNG, JPG, and SVG.'}
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {ALLOWED.map((a) => (
              <span
                key={a.ext}
                className="rounded-full bg-ink-50 px-2.5 py-1 text-[11px] font-semibold text-ink-700"
              >
                {a.ext}
              </span>
            ))}
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
              SVG is auto-rasterized for safety
            </span>
          </div>
        </div>
      )}

      {localError && (
        <div className="flex items-start gap-2 rounded-xl bg-flame-50 px-3 py-2 text-xs text-flame-700">
          <Fa name="circleexclamation" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{localError}</span>
        </div>
      )}
    </div>
  )
}
