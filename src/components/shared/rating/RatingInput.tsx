/**
 * RatingInput — interactive 5-star row (whole stars only, 1..5).
 * Each star is a real button for large tap targets and clear a11y.
 */
import { useState, KeyboardEvent } from 'react';
import { Star } from 'lucide-react';

interface Props {
  value: number;
  onChange: (v: number) => void;
  size?: number; // px
  ariaLabel?: string;
  disabled?: boolean;
}

export function RatingInput({
  value,
  onChange,
  size = 40,
  ariaLabel = 'Your rating',
  disabled,
}: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const display = hover ?? value;

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      onChange(Math.min(5, Math.max(1, Math.round(value) + 1)));
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      onChange(Math.max(0, Math.round(value) - 1));
    } else if (e.key === 'Home') {
      e.preventDefault(); onChange(1);
    } else if (e.key === 'End') {
      e.preventDefault(); onChange(5);
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
      onKeyDown={onKey}
      onPointerLeave={() => setHover(null)}
      className={`inline-flex items-center gap-1 select-none outline-none ${
        disabled ? 'opacity-60 cursor-not-allowed' : ''
      }`}
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const active = display >= n;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} ${n === 1 ? 'star' : 'stars'}`}
            disabled={disabled}
            onPointerEnter={() => !disabled && setHover(n)}
            onFocus={() => !disabled && setHover(n)}
            onBlur={() => setHover(null)}
            onClick={() => !disabled && onChange(n)}
            className="p-1 rounded-md focus-visible:ring-2 focus-visible:ring-primary active:scale-90 transition-transform"
          >
            <Star
              width={size}
              height={size}
              strokeWidth={1.5}
              style={{
                color: active ? 'hsl(var(--rating))' : 'hsl(var(--muted-foreground) / 0.4)',
                fill: active ? 'hsl(var(--rating))' : 'none',
              }}
            />
          </button>
        );
      })}
    </div>
  );
}
