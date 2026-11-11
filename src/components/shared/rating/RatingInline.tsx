/**
 * RatingInline — the on-card rating expression. Amber filled star + bold
 * value, muted "· N" count. NO pill, NO chip — deliberately different
 * language from status/verified chips so the eye lands on it first.
 * (Per user audit: 4.2 must out-shout the "Verified" chip on cards.)
 */
import { Star } from 'lucide-react';

interface Props {
  value: number;
  count?: number;
  size?: 'sm' | 'md';
  className?: string;
}

export function RatingInline({ value, count, size = 'sm', className = '' }: Props) {
  const v = Math.max(0, Math.min(5, value)).toFixed(1);
  const px = size === 'md' ? 14 : 12;
  const text = size === 'md' ? 'text-sm' : 'text-[12px]';
  return (
    <span
      className={`inline-flex items-center gap-1 font-bold leading-none ${text} ${className}`}
      aria-label={`Rated ${v} out of 5${count != null ? `, ${count} reviews` : ''}`}
    >
      <Star
        width={px}
        height={px}
        strokeWidth={0}
        fill="currentColor"
        style={{ color: 'hsl(var(--rating))' }}
      />
      <span className="tabular-nums" style={{ color: 'hsl(var(--rating-ink, var(--foreground)))' }}>
        {v}
      </span>
      {count != null && count > 0 && (
        <span className="font-medium text-muted-foreground tabular-nums">· {count}</span>
      )}
    </span>
  );
}
