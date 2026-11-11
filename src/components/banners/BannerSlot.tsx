import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { BannerPlacement } from '@/lib/banners/types';
import { useBannersForPlacement } from '@/hooks/useBanners';
import { InlineBanner } from './InlineBanner';

interface Props {
  placement: Exclude<BannerPlacement, 'popup'>;
  /** If the primary placement has no live banner, render this placement's first banner instead. */
  fallback?: Exclude<BannerPlacement, 'popup'>;
  className?: string;
}

// Per-route de-dupe: prevent the same banner from rendering twice on a single page render.
const renderedThisPaint = new Map<string, Set<string>>();
let lastPaintKey = '';
function pickBanner<T extends { id: string }>(routeKey: string, candidate: T | undefined): T | undefined {
  if (lastPaintKey !== routeKey) {
    renderedThisPaint.clear();
    lastPaintKey = routeKey;
  }
  if (!candidate) return undefined;
  let set = renderedThisPaint.get(routeKey);
  if (!set) { set = new Set(); renderedThisPaint.set(routeKey, set); }
  if (set.has(candidate.id)) return undefined;
  set.add(candidate.id);
  return candidate;
}

/** Renders the first active banner for a placement (or fallback), or nothing. */
export function BannerSlot({ placement, fallback, className }: Props) {
  const primary = useBannersForPlacement(placement);
  const fb = useBannersForPlacement(fallback ?? placement);
  const location = useLocation();

  const banner = useMemo(() => {
    const candidate = primary[0] ?? (fallback ? fb[0] : undefined);
    return pickBanner(location.pathname + location.search, candidate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primary, fb, fallback, location.pathname, location.search]);

  if (!banner) return null;
  return (
    <div className={className}>
      <InlineBanner banner={banner} />
    </div>
  );
}
