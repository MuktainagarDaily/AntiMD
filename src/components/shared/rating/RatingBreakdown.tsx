/**
 * RatingBreakdown — big average on the left, 5→1 star horizontal bars on the right.
 * Distribution order: [count5, count4, count3, count2, count1].
 */
import { RatingStars } from './RatingStars';

interface Props {
  average: number;
  count: number;
  distribution: [number, number, number, number, number];
  className?: string;
}

export function RatingBreakdown({ average, count, distribution, className = '' }: Props) {
  const max = Math.max(1, ...distribution);
  return (
    <div className={`flex gap-5 items-center ${className}`}>
      <div className="flex flex-col items-center shrink-0 min-w-[88px]">
        <div className="text-4xl font-extrabold text-foreground leading-none tabular-nums">
          {average.toFixed(1)}
        </div>
        <div className="mt-1.5">
          <RatingStars value={average} size="sm" />
        </div>
        <div className="text-[11px] text-muted-foreground mt-1">
          {count.toLocaleString()} {count === 1 ? 'review' : 'reviews'}
        </div>
      </div>
      <div className="flex-1 min-w-0 space-y-1.5">
        {[5, 4, 3, 2, 1].map((star, idx) => {
          const c = distribution[idx];
          const w = (c / max) * 100;
          return (
            <div key={star} className="flex items-center gap-2 text-xs">
              <span className="w-3 text-muted-foreground font-semibold tabular-nums">{star}</span>
              <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${w}%`, background: 'hsl(var(--rating))' }}
                />

              </div>
              <span className="w-8 text-right text-muted-foreground tabular-nums">{c}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
