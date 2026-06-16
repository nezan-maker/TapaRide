import { cn } from '../lib/utils';

type SkeletonVariant = 'text' | 'title' | 'avatar' | 'card' | 'image' | 'btn' | 'chip' | 'pulse';
type SkeletonWidth = 'full' | '3/4' | '1/2' | '1/3' | '1/4' | 'sm' | 'md' | 'lg';

const widthMap: Record<SkeletonWidth, string> = {
  full: 'w-full',
  '3/4': 'w-3/4',
  '1/2': 'w-1/2',
  '1/3': 'w-1/3',
  '1/4': 'w-1/4',
  sm: 'w-16',
  md: 'w-32',
  lg: 'w-48',
};

const variantBase: Record<SkeletonVariant, string> = {
  text: 'skeleton skeleton-text',
  title: 'skeleton skeleton-title',
  avatar: 'skeleton skeleton-avatar shrink-0',
  card: 'skeleton skeleton-card',
  image: 'skeleton skeleton-image',
  btn: 'skeleton skeleton-btn',
  chip: 'skeleton skeleton-chip',
  pulse: 'skeleton-pulse',
};

interface SkeletonProps {
  variant?: SkeletonVariant;
  width?: SkeletonWidth | string;
  height?: string;
  className?: string;
  rounded?: string;
  count?: number;
  gap?: string;
}

/**
 * Base skeleton block — Apple-style shimmer.
 * Usage:
 *   <Skeleton variant="text" />               ← single line placeholder
 *   <Skeleton variant="text" count={3} />      ← three stacked lines
 *   <Skeleton variant="title" width="3/4" />   ← heading placeholder
 *   <Skeleton variant="avatar" className="h-10 w-10" />
 *   <Skeleton variant="card" className="h-32" />
 */
export function Skeleton({
  variant = 'text',
  width,
  height,
  className = '',
  count = 1,
  gap = 'gap-3',
}: SkeletonProps) {
  const items = Array.from({ length: count }, (_, i) => i);
  return (
    <div className={cn('flex flex-col', gap)}>
      {items.map((i) => (
        <div
          key={i}
          className={cn(
            variantBase[variant],
            width && typeof width === 'string' && widthMap[width as SkeletonWidth]
              ? widthMap[width as SkeletonWidth]
              : '',
            className,
          )}
          style={{
            width: width && !widthMap[width as SkeletonWidth] ? width : undefined,
            height: height,
          }}
          aria-hidden="true"
          role="presentation"
        />
      ))}
    </div>
  );
}

/* ─── Composite skeletons ─── */

/** A list-row skeleton: avatar + two text lines */
export function SkeletonListItem({ className = '' }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <Skeleton variant="avatar" className="h-10 w-10" />
      <div className="flex-1 space-y-2">
        <Skeleton variant="title" width="1/2" height="0.875rem" />
        <Skeleton variant="text" width="1/4" />
      </div>
    </div>
  );
}

/** A card skeleton: image header + content body */
export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={cn('card overflow-hidden', className)}>
      <Skeleton variant="image" className="h-48 rounded-none" />
      <div className="p-5 space-y-3">
        <Skeleton variant="chip" />
        <Skeleton variant="title" width="3/4" />
        <Skeleton variant="text" count={2} gap="gap-2" />
        <Skeleton variant="btn" width="1/3" />
      </div>
    </div>
  );
}

/** A stat card skeleton: compact number + label placeholder */
export function SkeletonStat({ className = '' }: { className?: string }) {
  return (
    <div className={cn('card p-5', className)}>
      <Skeleton variant="title" width="sm" height="1.75rem" />
      <Skeleton variant="text" width="1/3" className="mt-2" />
    </div>
  );
}

/** A table/header skeleton */
export function SkeletonHeader({ className = '' }: { className?: string }) {
  return (
    <div className={cn('space-y-6', className)}>
      <Skeleton variant="title" width="1/3" height="1.5rem" />
      <div className="flex gap-3">
        <Skeleton variant="chip" />
        <Skeleton variant="chip" />
        <Skeleton variant="chip" />
        <div className="flex-1" />
        <Skeleton variant="btn" width="md" />
      </div>
    </div>
  );
}
