/**
 * Banner ad system — Supabase-backed.
 */
export type BannerPlacement =
  | 'popup'
  | 'homepage_inline'
  | 'shops_inline'
  | 'category_inline'
  | 'shops_infeed'
  | 'shop_detail_inline'
  | 'home_bottom'
  | 'saved_inline';

export interface Banner {
  id: string;
  title: string;
  image_url: string;
  target_url: string;
  placement: BannerPlacement;
  is_active: boolean;
  popup_delay_seconds: number;
  close_enable_seconds: number;
  start_date?: string | null;
  end_date?: string | null;
  view_count: number;
  click_count: number;
  sort_order: number;
  target_level?: 'global' | 'state' | 'district' | 'city';
  target_district_id?: string | null;
  target_city_id?: string | null;
  created_at: string;
  updated_at: string;
}

export const PLACEMENT_LABELS: Record<BannerPlacement, string> = {
  popup: 'Popup (Home, fullscreen)',
  homepage_inline: 'Homepage inline (top)',
  home_bottom: 'Homepage bottom (above Recently Added)',
  shops_inline: 'Shops page inline (top)',
  shops_infeed: 'Shops list in-feed (between cards)',
  category_inline: 'Category filter inline',
  shop_detail_inline: 'Shop detail page inline',
  saved_inline: 'Saved Shops page inline',
};

const ALLOWED_PROTOCOLS = ['http:', 'https:'];

/** Allowed: http(s)://; Rejected: javascript:, data:, file:, vbscript:, blob: */
export function isValidTargetUrl(raw: string): boolean {
  if (!raw) return false;
  const trimmed = raw.trim();
  if (/^\s*(javascript|data|file|vbscript|blob):/i.test(trimmed)) return false;
  try {
    const u = new URL(trimmed);
    return ALLOWED_PROTOCOLS.includes(u.protocol);
  } catch {
    return false;
  }
}

/** Today as YYYY-MM-DD in the viewer's local timezone — must match the
 *  format used by the DB-side `fetchLiveBanners` filter. */
function localISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function isBannerLive(b: Banner, now = new Date()): boolean {
  if (!b.is_active) return false;
  const today = localISODate(now);
  if (b.start_date && b.start_date > today) return false;
  if (b.end_date && b.end_date < today) return false;
  return true;
}
