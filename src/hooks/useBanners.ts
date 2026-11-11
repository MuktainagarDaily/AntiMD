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

/** Active, live banners for a given placement (public). Honors the build
 *  flag and runtime admin override — both must be ON for any banner to
 *  reach this hook's return value. */
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
        ? (data ?? EMPTY).filter((b) => {
            if (b.placement !== p || !isBannerLive(b)) return false;
            const bCityId = (b as any).target_city_id || (b as any).city_id;
            return !bCityId || bCityId === currentCity.id;
          })
        : EMPTY,
    [data, p, runtimeOn, currentCity.id],
  );
}

