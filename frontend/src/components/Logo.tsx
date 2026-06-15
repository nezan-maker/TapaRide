import { Link } from 'react-router-dom'
import { cn } from '../lib/utils'

interface LogoProps {
  className?: string
  variant?: 'dark' | 'light'
  withText?: boolean
  /** Pixel height of the lockup / mark. Pass an explicit value when the
   *  default `h-16` is too small for the surface (e.g. auth pages). */
  height?: 'sm' | 'md' | 'lg'
}

/**
 * TapaRide logo component using the official SVG assets from /public/.
 *
 * Variants:
 * - `dark` (default): Use on light backgrounds. Mark has indigo bg,
 *   lockup uses indigo wordmark.
 * - `light`: Use on dark backgrounds. Mark is white on transparent,
 *   lockup uses white wordmark.
 *
 * Sizes:
 * - `sm`: lockup h-9 (navbar compact)
 * - `md`: lockup h-16 (default — visible)
 * - `lg`: lockup h-20 (auth pages, big CTAs)
 * - For mark-only the height is always `h-10` square (overridable via
 *   `withText={false}`).
 *
 * Examples:
 * - `<Logo />` — Navbar
 * - `<Logo variant="light" />` — Footer
 * - `<Logo height="lg" />` — Auth pages
 */
export default function Logo({
  className,
  variant = 'dark',
  withText = true,
  height = 'md',
}: LogoProps) {
  const isLight = variant === 'light'

  // Choose the correct SVG asset based on variant and whether we want the lockup
  const src = withText
    ? isLight
      ? '/logo-lockup-light.svg'
      : '/logo-lockup.svg'
    : isLight
      ? '/logo-mark-light.svg'
      : '/logo-mark.svg'

  // Alt text for accessibility — concise and not duplicated for the link
  const alt = withText ? 'TapaRide' : 'TapaRide logo'

  // Tailwind classes for the lockup height.
  // For mark-only we keep the square aspect ratio.
  const sizeClasses = withText
    ? height === 'lg'
      ? 'h-11'
      : height === 'sm'
        ? 'h-8'
        : 'h-9'
    : 'h-10 w-10'

  return (
    <Link
      to="/"
      className={cn('inline-flex items-center gap-2.5', className)}
      aria-label="TapaRide home"
    >
      <img
        src={src}
        alt={alt}
        // `block` so the img owns its box (fixes inline baseline gap)
        // `object-contain` respects the viewBox aspect ratio
        className={cn('block object-contain', sizeClasses)}
      />
    </Link>
  )
}
