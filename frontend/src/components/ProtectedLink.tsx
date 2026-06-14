import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { ReactNode, MouseEvent } from 'react';
import { useAuth } from '../lib/auth';

/**
 * Public route prefixes — destinations that ANY visitor (logged out or in)
 * is allowed to land on. Every other route is treated as login-required.
 *
 * Why an allow-list of public routes, instead of a block-list of protected
 * ones? Because the product keeps adding new transactional surfaces (booking,
 * parcels, dashboards, journeys, waitlist) and a block-list goes stale. The
 * public surface is small and stable (browse + marketing + auth), so the
 * allow-list is the safer side of the trade.
 */
const PUBLIC_ROUTE_PREFIXES = [
  '/',             // landing
  '/search',       // browse & compare routes — public discovery
  '/track',        // look up any parcel by code — public tracking
  '/support',      // marketing / contact
  '/login',
  '/signup',
  '/verify-otp',
  '/forgot-password',
  '/register-passkey',
];

function isPublicRoute(path: string): boolean {
  // Exact match for "/" (the landing) and prefix match for the rest, so
  // /booking/anything still counts as protected.
  if (path === '/') return true;
  return PUBLIC_ROUTE_PREFIXES.some(
    (p) => p !== '/' && (path === p || path.startsWith(p + '/')),
  );
}

interface ProtectedLinkProps {
  to: string;
  children: ReactNode;
  className?: string;
  /**
   * Where to send logged-out users. Defaults to /login. The current location
   * is forwarded as `state.from` so the auth flow can bounce them back.
   */
  loginPath?: string;
  /**
   * Optional click handler (e.g. to close a mobile menu before navigating).
   */
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
  /**
   * Optional title/aria attrs forwarded to the underlying <Link>.
   */
  title?: string;
  'aria-label'?: string;
}

/**
 * A drop-in replacement for <Link> that gates navigation on auth.
 *
 * If `to` resolves to a public route (see PUBLIC_ROUTE_PREFIXES), this behaves
 * like a plain <Link> — everyone can click through.
 *
 * If `to` is a protected route, logged-out users are sent to /login (or
 * `loginPath`) with the original destination stored in `state.from` (the
 * existing convention used by router-level <ProtectedRoute>), so the auth
 * flow can bounce them back. Logged-in users navigate normally.
 *
 * Important: the rendered <Link> always exposes the real `href`, so
 * middle-click, right-click "open in new tab", and Cmd-click all work
 * correctly. The auth gate fires only on a plain left-click.
 */
export default function ProtectedLink({
  to,
  children,
  className,
  loginPath = '/login',
  onClick,
  title,
  'aria-label': ariaLabel,
}: ProtectedLinkProps) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Public destinations never need a gate.
  if (isPublicRoute(to)) {
    return (
      <Link
        to={to}
        className={className}
        onClick={onClick}
        title={title}
        aria-label={ariaLabel}
      >
        {children}
      </Link>
    );
  }

  // Protected destination: intercept plain left-clicks and send logged-out
  // users to the auth flow with the original destination preserved.
  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (onClick) onClick(e);
    if (e.defaultPrevented) return;
    // Don't hijack modifier-clicks (Cmd/Ctrl/Shift/Alt/middle button) — the
    // user explicitly wants to open the link in a new tab.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
      return;
    }
    // While auth state is still loading, let the click through to <Link> —
    // the router's <ProtectedRoute> will render a spinner or redirect as
    // appropriate. This avoids a flash-of-login-redirect on page load.
    if (loading) return;
    if (!user) {
      e.preventDefault();
      // SPA navigation, preserving the current location so the auth page
      // can bounce the user back after sign-in.
      navigate(loginPath, { state: { from: { pathname: to, search: location.search } } });
    }
  };

  return (
    <Link
      to={to}
      className={className}
      onClick={handleClick}
      title={title}
      aria-label={ariaLabel}
    >
      {children}
    </Link>
  );
}
