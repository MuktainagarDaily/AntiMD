import { useEffect, useId, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Banner, BannerPlacement } from '@/lib/banners/types';
import { useBannersForPlacement } from '@/hooks/useBanners';
import { InlineBanner } from './InlineBanner';

interface Props {
  placement: Exclude<BannerPlacement, 'popup'>;
  /** If the primary placement has no live banner, render unclaimed banners from this fallback placement. */
  fallback?: Exclude<BannerPlacement, 'popup'>;
  className?: string;
}

// Per-route slot claim map: prevents fallback slots from duplicating banners already rendered
// by a primary slot on the same route, while letting each slot rotate its own banner pool.
const routeClaims = new Map<string, Map<string, string>>();
let lastRouteKey = '';

function resolveSlotPool(
  routeKey: string,
  slotId: string,
  primary: Banner[],
  fallbackPool: Banner[],
  hasFallback: boolean,
): Banner[] {
  if (lastRouteKey !== routeKey) {
    routeClaims.clear();
    lastRouteKey = routeKey;
  }

  let claims = routeClaims.get(routeKey);
  if (!claims) {
    claims = new Map<string, string>();
    routeClaims.set(routeKey, claims);
  }

  const candidates = primary.length > 0 ? primary : hasFallback ? fallbackPool : [];
  if (candidates.length === 0) return [];

  const ownedOrFree = candidates.filter((b) => {
    const owner = claims!.get(b.id);
    if (primary.length > 0) {
      // Primary placement claims its own banners unconditionally unless claimed by another primary slot
      return !owner || owner === slotId;
    }
    // Fallback skips any banner already claimed by another slot on this page
    return !owner || owner === slotId;
  });

  if (ownedOrFree.length > 0 && ownedOrFree[0]) {
    claims.set(ownedOrFree[0].id, slotId);
  }
  return ownedOrFree;
}

/**
 * Renders live active banners for a placement (or unclaimed fallback banners).
 * Automatically rotates via subtle controls when 2+ active banners share a slot.
 */
export function BannerSlot({ placement, fallback, className }: Props) {
  const slotId = useId();
  const primary = useBannersForPlacement(placement);
  const fb = useBannersForPlacement(fallback ?? placement);
  const location = useLocation();
  const [activeIdx, setActiveIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  const routeKey = location.pathname + location.search;

  const pool = useMemo(
    () =>
      resolveSlotPool(
        routeKey,
        slotId,
        primary,
        fb,
        Boolean(fallback),
      ),
    [routeKey, slotId, primary, fb, fallback],
  );

  useEffect(() => {
    const claims = routeClaims.get(routeKey);
    if (claims && pool[0]) {
      claims.set(pool[0].id, slotId);
    }
    return () => {
      const cur = routeClaims.get(routeKey);
      if (!cur) return;
      for (const [bId, owner] of cur.entries()) {
        if (owner === slotId) cur.delete(bId);
      }
    };
  }, [routeKey, slotId, pool]);

  useEffect(() => {
    setActiveIdx(0);
  }, [placement, pool.length]);

  useEffect(() => {
    if (pool.length <= 1 || paused) return;
    const timer = window.setInterval(() => {
      setActiveIdx((i) => (i + 1) % pool.length);
    }, 6500);
    return () => window.clearInterval(timer);
  }, [pool.length, paused]);

  if (pool.length === 0) return null;
  const safeIdx = activeIdx % pool.length;
  const currentBanner = pool[safeIdx];

  return (
    <div
      className={`relative group/slot ${className ?? ''}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <InlineBanner banner={currentBanner} />

      {pool.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setActiveIdx((i) => (i - 1 + pool.length) % pool.length);
            }}
            aria-label="Previous sponsored banner"
            className="hidden sm:inline-flex opacity-0 group-hover/slot:opacity-100 focus:opacity-100 transition-opacity absolute left-2 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-background/85 border border-border items-center justify-center text-foreground shadow-sm hover:bg-background"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setActiveIdx((i) => (i + 1) % pool.length);
            }}
            aria-label="Next sponsored banner"
            className="hidden sm:inline-flex opacity-0 group-hover/slot:opacity-100 focus:opacity-100 transition-opacity absolute right-2 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-background/85 border border-border items-center justify-center text-foreground shadow-sm hover:bg-background"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <div className="absolute bottom-2 right-2.5 z-10 flex items-center gap-1 bg-background/75 backdrop-blur-sm px-1.5 py-1 rounded-full border border-border/50">
            {pool.map((b, idx) => (
              <button
                key={b.id}
                type="button"
                aria-label={`View ad ${idx + 1} of ${pool.length}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setActiveIdx(idx);
                }}
                className={`h-1.5 rounded-full transition-all ${
                  idx === safeIdx ? 'w-3.5 bg-primary' : 'w-1.5 bg-foreground/35 hover:bg-foreground/60'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
