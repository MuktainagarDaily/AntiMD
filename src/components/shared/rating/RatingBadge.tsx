/**
 * RatingBadge — compact pill "★ 4.3" used on cards.
 * Variants: overlay (dark, sits on shop image) / inline (soft, sits in badge row).
 */
import { Star } from 'lucide-react';

type Variant = 'overlay' | 'inline';
type Size = 'sm' | 'md';

interface Props {
  value: number;
  count?: number;
  variant?: Variant;
  size?: Size;
  className?: string;
}

export function RatingBadge({
  value,
  count,
  variant = 'inline',
  size = 'sm',
  className = '',
}: Props) {
  const v = Math.max(0, Math.min(5, value)).toFixed(1);
  const px = size === 'md' ? 14 : 12;
  const pad = size === 'md' ? 'px-2 py-1 text-xs' : 'px-1.5 py-0.5 text-[11px]';

  if (variant === 'overlay') {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full font-bold backdrop-blur-sm shadow-sm ${pad} ${className}`}
        style={{
          background: 'hsl(var(--foreground) / 0.78)',
          color: 'hsl(var(--background))',
        }}
        aria-label={`Rated ${v} out of 5${count != null ? `, ${count} reviews` : ''}`}
      >
        <Star width={px} height={px} strokeWidth={0} fill="currentColor" />
        <span className="tabular-nums leading-none">{v}</span>
        {count != null && count > 0 && (
          <span className="opacity-75 font-medium leading-none">({count})</span>
        )}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full font-semibold leading-none ${pad} ${className}`}
      style={{ background: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))' }}
      aria-label={`Rated ${v} out of 5${count != null ? `, ${count} reviews` : ''}`}
    >
      <Star width={px} height={px} strokeWidth={0} fill="currentColor" />
      <span className="tabular-nums">{v}</span>
      {count != null && count > 0 && <span className="opacity-70 font-medium ml-0.5">({count})</span>}
    </span>
  );
}
