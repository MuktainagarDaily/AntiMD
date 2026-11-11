/**
 * Banner/ad feature flags.
 *
 * Why a flag layer at all?
 * ------------------------
 * The trusted directory (shops, categories, claim flows) is editorial content
 * curated by admins. Banners/ads are *paid placements* that must remain
 * visually and operationally separate from that content. This module is the
 * single switchboard that controls:
 *
 *   1. The build-time kill switch  — set `VITE_ADS_ENABLED=false` to ship a
 *      build with no ad surface at all (useful for clean app-store screenshots,
 *      government-tender demos, or any context where ads are inappropriate).
 *
 *   2. The runtime admin override  — admins can flip an in-app switch that
 *      hides all ads without touching individual banner rows. The override is
 *      stored under `localStorage['md_ads_runtime']` and read on every render.
 *      This is a per-admin convenience for previewing the directory the way a
 *      regular user sees it — it is NOT a public kill-switch. To take ads off
 *      production for everyone, either flip `VITE_ADS_ENABLED=false` or set
 *      every banner row's `is_active = false` (the "Pause all banners" action
 *      in AdvertisementsTab does the latter in one call).
 *
 *   3. Per-banner `is_active`     — the existing column on `public.banners`,
 *      flipped from AdvertisementsTab. Granular per-row control.
 *
 *   4. Per-placement `is_active`  — implicit: a placement renders nothing
 *      when no active banner exists in it AND no fallback placement provides
 *      one (see BannerSlot's `fallback` prop).
 *
 * Hierarchy (any layer being OFF hides ads):
 *   build env  >  admin override  >  per-banner row
 */

const RUNTIME_KEY = 'md_ads_runtime';

/** Build-time switch — defaults to `true`. */
function buildFlag(): boolean {
  const raw = (import.meta as any).env?.VITE_ADS_ENABLED;
  if (raw === undefined || raw === null || raw === '') return true;
  return String(raw).toLowerCase() !== 'false' && raw !== '0';
}

/** Runtime admin override. Returns `true` when ads are allowed. */
export function runtimeAdsEnabled(): boolean {
  try {
    const v = window.localStorage.getItem(RUNTIME_KEY);
    if (v === null) return true;
    return v !== '0';
  } catch {
    return true;
  }
}

export function setRuntimeAdsEnabled(enabled: boolean): void {
  try {
    window.localStorage.setItem(RUNTIME_KEY, enabled ? '1' : '0');
    // Notify any in-page subscribers immediately.
    window.dispatchEvent(new CustomEvent('md_ads_runtime_change', { detail: enabled }));
  } catch {
    /* ignore */
  }
}

/** Combined check — call this from hooks/components before rendering ads. */
export function adsEnabled(): boolean {
  return buildFlag() && runtimeAdsEnabled();
}

/** Stable string describing why ads are off (or 'on'). For admin UI copy. */
export function adsState():
  | { on: true }
  | { on: false; reason: 'build' | 'runtime' } {
  if (!buildFlag()) return { on: false, reason: 'build' };
  if (!runtimeAdsEnabled()) return { on: false, reason: 'runtime' };
  return { on: true };
}
