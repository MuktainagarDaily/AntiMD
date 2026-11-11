/**
 * RatingStars — pure display, supports fractional fill to one decimal (e.g. 4.3).
 * Uses a clipped overlay of filled stars sitting on top of an outlined base row.
 */
import { Star } from 'lucide-react';

type Size = 'xs' | 'sm' | 'md' | 'lg';

const SIZE_PX: Record<Size, number> = { xs: 12, sm: 14, md: 18, lg: 24 };
const TEXT_CLS: Record<Size, string> = {
  xs: 'text-[10px]',
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
};

interface Props {
  value: number;                  // 0..5, one decimal
  size?: Size;
  showValue?: boolean;
  count?: number;
  className?: string;
  ariaLabel?: string;
}

export function RatingStars({
  value,
  size = 'sm',
  showValue = false,
  count,
  className = '',
  ariaLabel,
}: Props) {
  const clamped = Math.max(0, Math.min(5, value));
  const pct = (clamped / 5) * 100;
  const px = SIZE_PX[size];
  const label = ariaLabel ?? `${clamped.toFixed(1)} out of 5`;

  return (
    <span
      className={`inline-flex items-center gap-1 ${className}`}
      role="img"
      aria-label={count != null ? `${label}, ${count} reviews` : label}
    >
      <span className="relative inline-block leading-none" style={{ height: px }}>
        {/* Empty layer */}
        <span className="flex" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <Star
              key={i}
              width={px}
              height={px}
              strokeWidth={1.75}
              className="text-muted-foreground/40"
              fill="none"
            />
          ))}
        </span>
        {/* Filled overlay, width-clipped */}
        <span
          className="absolute inset-y-0 left-0 flex overflow-hidden pointer-events-none"
          style={{ width: `${pct}%` }}
          aria-hidden="true"
        >
          {[0, 1, 2, 3, 4].map((i) => (
            <Star
              key={i}
              width={px}
              height={px}
              strokeWidth={1.75}
              style={{ color: 'hsl(var(--rating))', fill: 'hsl(var(--rating))' }}
            />
          ))}

        </span>
      </span>
      {showValue && (
        <span className={`font-semibold text-foreground tabular-nums ${TEXT_CLS[size]}`}>
          {clamped.toFixed(1)}
          {count != null && (
            <span className="font-normal text-muted-foreground ml-1">({count})</span>
          )}
        </span>
      )}
    </span>
  );
}
