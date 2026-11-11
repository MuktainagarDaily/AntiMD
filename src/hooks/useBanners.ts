import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Banner, BannerPlacement, isBannerLive } from '@/lib/banners/types';
import { fetchAllBanners, fetchLiveBanners } from '@/lib/banners/store';
import { adsEnabled, runtimeAdsEnabled } from '@/lib/banners/flags';
import { useCity } from '@/hooks/useCity';

const EMPTY: Banner[] = [];

/** Subscribe to the runtime ad-visibility flag so toggling it re-renders. */
function useAdsRuntime(): boolean {
  const [on, setOn] = useState<boolean>(() => runtimeAdsEnabled());
  useEffect(() => {
    const handler = (e: Event) => setOn((e as CustomEvent<boolean>).detail);
    const storageHandler = () => setOn(runtimeAdsEnabled());
    window.addEventListener('md_ads_runtime_change', handler as EventListener);
    window.addEventListener('storage', storageHandler);
    return () => {
      window.removeEventListener('md_ads_runtime_change', handler as EventListener);
      window.removeEventListener('storage', storageHandler);
    };
  }, []);
  return on;
}

/** All banners (admin) — refetches on invalidation. Always returns rows,
 *  regardless of the runtime flag, so admins can manage hidden ads. */
export function useAllBanners(): Banner[] {
  const { data } = useQuery({
    queryKey: ['banners', 'all'],
    queryFn: fetchAllBanners,
    // MPULSE Rec #3 — unified 2m staleTime for long-lived reads.
    staleTime: 120_000,
  });
  return data ?? EMPTY;
}

function bannerSpecificityRank(
  b: Banner,
  city: { id: string; district_id?: string | null },
): number | null {
  const bCityId = b.target_city_id || (b as any).city_id || null;
  if (bCityId) {
    return bCityId === city.id ? 0 : null;
  }
  if (b.target_level === 'district' || b.target_district_id) {
    if (!b.target_district_id) return 1;
    return city.district_id && b.target_district_id === city.district_id ? 1 : null;
  }
  return 2; // global
}

export function selectBannersForCity(
  banners: Banner[],
  placement: BannerPlacement,
  city: { id: string; district_id?: string | null },
  now = new Date(),
): Banner[] {
  const matched: Array<{ banner: Banner; rank: number; idx: number }> = [];
  for (let i = 0; i < banners.length; i++) {
    const b = banners[i];
    if (b.placement !== placement || !isBannerLive(b, now)) continue;
    const rank = bannerSpecificityRank(b, city);
    if (rank === null) continue;
    matched.push({ banner: b, rank, idx: i });
  }
  matched.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    if ((a.banner.sort_order ?? 0) !== (b.banner.sort_order ?? 0)) {
      return (a.banner.sort_order ?? 0) - (b.banner.sort_order ?? 0);
    }
    return a.idx - b.idx;
  });
  return matched.map((m) => m.banner);
}

/** Active, live banners for a given placement (public). Honors the build
 *  flag and runtime admin override — both must be ON for any banner to
 *  reach this hook's return value. City > District > Global specificity order. */
export function useBannersForPlacement(p: BannerPlacement): Banner[] {
  const runtimeOn = useAdsRuntime();
  const { currentCity } = useCity();
  const { data } = useQuery({
    queryKey: ['banners', 'live'],
    queryFn: fetchLiveBanners,
    // MPULSE Rec #3 — unified 2m staleTime for long-lived reads.
    staleTime: 120_000,
    enabled: adsEnabled(),
  });
  return useMemo(
    () =>
      runtimeOn && adsEnabled()
        ? selectBannersForCity(data ?? EMPTY, p, currentCity)
        : EMPTY,
    [data, p, runtimeOn, currentCity],
  );
}

