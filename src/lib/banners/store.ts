/**
 * Banner store — Supabase-backed.
 * - CRUD on public.banners (admin RLS)
 * - Image upload to the `shop-images` bucket under `banners/` prefix
 * - View/click counters via SECURITY DEFINER RPCs (anon-safe)
 * - Order persisted via `sort_order` + `reorder_banners(_ids)` RPC
 *
 * The public.banners query layer is owned by `useBanners.ts` (React Query).
 */
import { Banner, BannerPlacement } from './types';
import { supabase } from '@/integrations/supabase/client';

const BUCKET = 'shop-images';
const PREFIX = 'banners/';

const SEEN_PREFIX = 'md_banner_seen_';
const SEEN_DAY_PREFIX = 'md_banner_seen_day_';
const SESSION_SHOWN_PREFIX = 'md_banner_shown_session_';
const SESSION_VIEW_PREFIX = 'md_banner_view_session_';
const SEEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/** True if popup for this banner was already shown today (any device session). */
export function wasPopupSeenToday(id: string): boolean {
  try {
    return window.localStorage.getItem(SEEN_DAY_PREFIX + id) === todayKey();
  } catch { return false; }
}

/** True if popup already shown in *this* tab session (prevents re-show on SPA route changes). */
export function wasPopupShownThisSession(id: string): boolean {
  try { return sessionStorage.getItem(SESSION_SHOWN_PREFIX + id) === '1'; }
  catch { return false; }
}

export function markPopupShownThisSession(id: string): void {
  try { sessionStorage.setItem(SESSION_SHOWN_PREFIX + id, '1'); } catch { /* ignore */ }
}

/* ---------------- Image upload helpers ---------------- */

function extractBannerStoragePath(publicUrl: string): string | null {
  try {
    const marker = `/object/public/${BUCKET}/`;
    const idx = publicUrl.indexOf(marker);
    if (idx === -1) return null;
    const path = decodeURIComponent(publicUrl.slice(idx + marker.length).split('?')[0]);
    return path.startsWith(PREFIX) ? path : null;
  } catch {
    return null;
  }
}

export async function uploadBannerImage(blob: Blob): Promise<string> {
  const ext = blob.type === 'image/webp' ? 'webp'
            : blob.type === 'image/png'  ? 'png'
            : blob.type === 'image/jpeg' ? 'jpg' : 'webp';
  const name = `${PREFIX}${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(name, blob, {
    cacheControl: '3600',
    upsert: false,
    contentType: blob.type || 'image/webp',
  });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(name);
  return data.publicUrl;
}

function cleanupBannerImage(url: string | undefined | null) {
  if (!url) return;
  if (url.startsWith('data:') || url.startsWith('blob:')) return;
  const path = extractBannerStoragePath(url);
  if (!path) return;
  void supabase.storage.from(BUCKET).remove([path]).then(() => {}, () => {});
}

/* ---------------- DB types ---------------- */

type BannerRow = {
  id: string;
  title: string;
  image_url: string;
  target_url: string;
  placement: string;
  is_active: boolean;
  popup_delay_seconds: number;
  close_enable_seconds: number;
  start_date: string | null;
  end_date: string | null;
  view_count: number;
  click_count: number;
  sort_order: number;
  target_level?: 'global' | 'state' | 'district' | 'city';
  target_district_id?: string | null;
  target_city_id?: string | null;
  created_at: string;
  updated_at: string;
};

function rowToBanner(r: BannerRow): Banner {
  return { ...r, placement: r.placement as BannerPlacement };
}

/* ---------------- Queries ---------------- */

export async function fetchAllBanners(): Promise<Banner[]> {
  const { data, error } = await supabase
    .from('banners')
    .select('*')
    .order('placement', { ascending: true })
    .order('sort_order' as any, { ascending: true })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as BannerRow[]).map(rowToBanner);
}

/** Build YYYY-MM-DD in local time (not UTC). Keeps DB filter and
 *  `isBannerLive` in the same timezone so banners don't appear/expire
 *  a day early/late for users east/west of UTC. */
function todayLocalISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export async function fetchLiveBanners(): Promise<Banner[]> {
  const today = todayLocalISO();
  const { data, error } = await supabase
    .from('banners')
    .select('*')
    .eq('is_active', true)
    .or(`start_date.is.null,start_date.lte.${today}`)
    .or(`end_date.is.null,end_date.gte.${today}`)
    .order('sort_order' as any, { ascending: true })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as BannerRow[]).map(rowToBanner);
}

/* ---------------- Mutations ---------------- */

export type BannerInput = Omit<Banner,
  'id' | 'view_count' | 'click_count' | 'created_at' | 'updated_at' | 'sort_order'
> & { sort_order?: number };

export async function createBanner(input: BannerInput): Promise<Banner> {
  const db = supabase as any;
  // Append to the end of the placement group
  const { data: maxRow } = await db
    .from('banners')
    .select('sort_order')
    .eq('placement', input.placement)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  const sort_order = (maxRow?.sort_order ?? 0) + 1;
  const { data, error } = await db
    .from('banners')
    .insert({
      title: input.title,
      image_url: input.image_url,
      target_url: input.target_url,
      placement: input.placement,
      is_active: input.is_active,
      popup_delay_seconds: input.popup_delay_seconds,
      close_enable_seconds: input.close_enable_seconds,
      start_date: input.start_date ?? null,
      end_date: input.end_date ?? null,
      sort_order,
    })
    .select('*')
    .single();
  if (error) throw error;
  return rowToBanner(data as BannerRow);
}

export async function updateBanner(
  id: string,
  patch: Partial<BannerInput>,
  prevImageUrl?: string,
): Promise<Banner> {
  const db = supabase as any;
  const { data, error } = await db
    .from('banners')
    .update({
      ...patch,
      start_date: patch.start_date === undefined ? undefined : (patch.start_date ?? null),
      end_date: patch.end_date === undefined ? undefined : (patch.end_date ?? null),
    })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  if (typeof patch.image_url === 'string' && prevImageUrl && prevImageUrl !== patch.image_url) {
    cleanupBannerImage(prevImageUrl);
  }
  return rowToBanner(data as BannerRow);
}

export async function removeBanner(id: string, imageUrl?: string): Promise<void> {
  const { error } = await supabase.from('banners').delete().eq('id', id);
  if (error) throw error;
  cleanupBannerImage(imageUrl);
  try {
    localStorage.removeItem(SEEN_PREFIX + id);
    sessionStorage.removeItem(SESSION_VIEW_PREFIX + id);
  } catch { /* ignore */ }
}

export async function toggleActive(id: string, current: boolean): Promise<void> {
  const { error } = await supabase
    .from('banners')
    .update({ is_active: !current })
    .eq('id', id);
  if (error) throw error;
}

/** Bulk "pause all" / "resume all". Used by the global ad-visibility control
 *  in AdvertisementsTab so an admin can take every ad off the directory in a
 *  single tap without touching individual rows. */
export async function setAllBannersActive(active: boolean): Promise<number> {
  const { data, error } = await supabase
    .from('banners')
    .update({ is_active: active })
    .neq('is_active', active)
    .select('id');
  if (error) throw error;
  return (data ?? []).length;
}

export async function reorderBanners(ids: string[]): Promise<void> {
  const { error } = await (supabase as any).rpc('reorder_banners', { _ids: ids });
  if (error) throw error;
}

/* ---------------- Tracking ---------------- */

const recentClicks = new Map<string, number>();
const CLICK_COOLDOWN_MS = 2000;

export function trackView(id: string): void {
  // Only fire the RPC after we've successfully marked this view as seen for
  // the session. If setItem throws (private mode, quota), bailing out keeps
  // us from double-counting on every render.
  try {
    const key = SESSION_VIEW_PREFIX + id;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    void (supabase as any).rpc('increment_banner_view', { _id: id }).then(() => {}, () => {});
  } catch { /* storage unavailable — skip view-count to avoid inflation */ }
}

export function trackClick(id: string): void {
  const now = Date.now();
  const last = recentClicks.get(id) ?? 0;
  if (now - last < CLICK_COOLDOWN_MS) return;
  recentClicks.set(id, now);
  if (recentClicks.size > 100) {
    for (const [k, t] of recentClicks) if (now - t > 10_000) recentClicks.delete(k);
  }
  void (supabase as any).rpc('increment_banner_click', { _id: id }).then(() => {}, () => {});
}

/* ---------------- Popup seen TTL ---------------- */

export function wasPopupSeenRecently(id: string): boolean {
  try {
    const raw = window.localStorage.getItem(SEEN_PREFIX + id);
    if (!raw) return false;
    const ts = Number(raw);
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts < SEEN_TTL_MS;
  } catch { return false; }
}

export function markPopupSeen(id: string): void {
  try {
    window.localStorage.setItem(SEEN_PREFIX + id, String(Date.now()));
    window.localStorage.setItem(SEEN_DAY_PREFIX + id, todayKey());
  } catch { /* ignore */ }
}
