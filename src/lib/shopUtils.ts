/**
 * Shared utilities for shop display logic
 */

/**
 * Normalize a phone string for duplicate detection and wa.me links.
 * Strips spaces, dashes, parens, dots, +; strips leading 91 country code (12-digit → 10-digit).
 */
export function normalizePhone(phone: string): string {
  let n = phone.replace(/[\s\-().+]/g, '');
  if (n.startsWith('91') && n.length === 12) n = n.slice(2);
  return n;
}

/**
 * Convert a shop name to a URL-safe slug (same logic as the DB trigger).
 * e.g. "Sharma's General Store!" → "sharmas-general-store"
 */
export function toSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/[ -]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'shop';
}

/** Format HH:MM (24h) → 12-hour AM/PM */
export function formatTime(time: string | null | undefined): string {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
}

/**
 * Dynamically determine if shop is open right now.
 * Falls back to the manual `is_open` flag when no times are set.
 */
export function isShopOpen(shop: {
  is_open: boolean;
  opening_time?: string | null;
  closing_time?: string | null;
}): boolean {
  return getShopStatus(shop).open;
}

/** Status descriptor used by every shop card / detail page. */
export type ShopStatus = {
  /** True if the shop is currently open. */
  open: boolean;
  /** Short human label: "Open · Closes in 35 min", "Closed · Opens at 9:00 AM" etc. */
  label: string;
  /** "imminent" within 30 min boundary → highlight in amber; "normal" otherwise. */
  urgency: 'normal' | 'imminent';
};

/**
 * Compute open/closed state PLUS a friendly countdown label.
 * Pure function, safe for memoisation. Recomputes minute-by-minute when callers
 * re-render (Shops page already invalidates queries every 60s).
 */
export function getShopStatus(shop: {
  is_open: boolean;
  opening_time?: string | null;
  closing_time?: string | null;
}): ShopStatus {
  const { opening_time, closing_time, is_open } = shop;

  // Manual override: owner toggled CLOSED → always closed, regardless of hours.
  if (is_open === false) {
    if (opening_time && closing_time) {
      return { open: false, label: `Closed · opens ${formatTime(opening_time)}`, urgency: 'normal' };
    }
    return { open: false, label: 'Closed', urgency: 'normal' };
  }

  // No hours → fall back to the manual flag with no countdown
  if (!opening_time || !closing_time) {
    return { open: is_open, label: is_open ? 'Open' : 'Closed', urgency: 'normal' };
  }

  const now = new Date();
  const [oh, om] = opening_time.split(':').map(Number);
  const [ch, cm] = closing_time.split(':').map(Number);
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const openMins = oh * 60 + om;
  const closeMins = ch * 60 + cm;
  const overnight = closeMins < openMins;

  const insideHours = overnight
    ? (nowMins >= openMins || nowMins < closeMins)
    : (nowMins >= openMins && nowMins < closeMins);

  // Owner toggled OPEN but we're outside scheduled hours. Keep open, but
  // signal "after hours" so visitors don't see a stale "Open now" 24/7
  // when an owner forgets to toggle off.
  if (!insideHours) {
    return { open: true, label: 'Open · after hours', urgency: 'normal' };
  }

  // Inside scheduled hours, owner has not overridden → countdown to close.
  const minutesUntil = (target: number) => ((target - nowMins) % 1440 + 1440) % 1440;
  const mLeft = minutesUntil(closeMins) || 1440;
  if (mLeft <= 60) {
    return { open: true, label: `Closes in ${formatDuration(mLeft)}`, urgency: 'imminent' };
  }
  return { open: true, label: `Open · until ${formatTime(closing_time)}`, urgency: 'normal' };
}

/** "47 min" or "2h 5m" — compact, mobile-friendly. */
function formatDuration(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/**
 * Checks if a category name represents a specialized non-shop domain
 * (Mess & Dining, PG & Hostels, Schools, Hospitals, etc.).
 */
export function isSpecializedCategoryName(name: string | null | undefined): boolean {
  if (!name) return false;
  const lower = name.toLowerCase();
  return (
    lower.includes('mess') ||
    lower.includes('dining') ||
    lower.includes('tiffin') ||
    lower.includes('bhojanalay') ||
    lower.includes('भोजनालय') ||
    lower.includes('टिफिन') ||
    lower.includes('hotel') ||
    lower.includes('हॉटेल') ||
    lower.includes('restaurant') ||
    lower.includes('रेस्टॉरंट') ||
    lower.includes('dhaba') ||
    lower.includes('ढाबा') ||
    lower.includes('khanawal') ||
    lower.includes('खानावळ') ||
    lower.includes('pg') ||
    lower.includes('hostel') ||
    lower.includes('paying guest') ||
    lower.includes('वसतिगृह') ||
    lower.includes('school') ||
    lower.includes('college') ||
    lower.includes('vidyalaya') ||
    lower.includes('विद्यालय') ||
    lower.includes('महाविद्यालय') ||
    lower.includes('शाळा') ||
    lower.includes('hospital') ||
    lower.includes('रुग्णालय')
  );
}

/**
 * Detects whether a database establishment is a specialized non-retail entity
 * (Mess / Dining, PG / Hostel, etc.) that belongs in its own dedicated section
 * rather than the general commercial shops directory.
 */
export function isSpecializedEntity(shop: any): boolean {
  if (!shop) return false;

  // 1. Direct profile association (from embedded joins)
  if (shop.mess_profiles && (Array.isArray(shop.mess_profiles) ? shop.mess_profiles.length > 0 : Boolean(shop.mess_profiles))) {
    return true;
  }
  if (shop.pg_profiles && (Array.isArray(shop.pg_profiles) ? shop.pg_profiles.length > 0 : Boolean(shop.pg_profiles))) {
    return true;
  }
  if (shop.mess_profile || shop.pg_profile) {
    return true;
  }

  // 2. Category checking (e.g. "Mess & Dining", "PG & Hostels")
  const cats = shop.shop_categories || [];
  for (const sc of cats) {
    const catName = sc?.categories?.name || sc?.name;
    if (isSpecializedCategoryName(catName)) {
      return true;
    }
  }

  // 3. Fallback name heuristics for unmigrated or unlinked records
  const rawName = shop.name || '';
  const lowerName = rawName.toLowerCase();
  if (
    lowerName.includes('bhojanalay') ||
    lowerName.includes('भोजनालय') ||
    /\bmess\b/i.test(rawName) ||
    lowerName.includes('tiffin') ||
    lowerName.includes('टिफिन') ||
    /\bhotel\b/i.test(rawName) ||
    lowerName.includes('हॉटेल') ||
    lowerName.includes('restaurant') ||
    lowerName.includes('रेस्टॉरंट') ||
    lowerName.includes('dhaba') ||
    lowerName.includes('ढाबा') ||
    lowerName.includes('khanawal') ||
    lowerName.includes('खानावळ') ||
    (/\bpg\b/i.test(rawName) && (lowerName.includes('boy') || lowerName.includes('girl') || lowerName.includes('hostel') || lowerName.includes('guest') || lowerName.includes('stay') || lowerName.includes('room'))) ||
    lowerName.includes('paying guest') ||
    lowerName.includes('hostel') ||
    lowerName.includes('वसतिगृह')
  ) {
    return true;
  }

  return false;
}

/**
 * Filter out non-retail specialized entities from a list of shops,
 * keeping only genuine retail and commercial shops.
 */
export function filterRetailShops<T>(shops: T[]): T[] {
  if (!Array.isArray(shops)) return [];
  return shops.filter((s) => !isSpecializedEntity(s));
}

/**
 * Prioritizes and deduplicates related shops within a single city boundary:
 * 1. Matches same village_id first (hyper-local priority).
 * 2. Follows with remaining shops from the wider city.
 * 3. Excludes any shops with a different city_id (strict city boundary).
 * 4. Excludes the current shop itself.
 * 5. Deduplicates repeated entries.
 * 6. Caps the result to maxResults (default 12).
 */
export function prioritizeRelatedShops<
  T extends { id: string; city_id?: string | null; village_id?: string | null }
>(
  candidateRowsOrShops: Array<T | { shops: T }>,
  currentShopId: string,
  targetCityId: string,
  targetVillageId?: string | null,
  maxResults = 12
): T[] {
  const seen = new Set<string>();
  const hyperLocal: T[] = [];
  const townWide: T[] = [];

  for (const row of candidateRowsOrShops) {
    const s: T = (row as any)?.shops || row;
    if (!s || s.id === currentShopId || seen.has(s.id)) continue;
    // Strict geographic boundary check: must belong to the target city
    if (s.city_id && s.city_id !== targetCityId) continue;
    seen.add(s.id);

    // Hyper-local prioritization: match same village/ward first
    if (targetVillageId && s.village_id === targetVillageId) {
      hyperLocal.push(s);
    } else {
      townWide.push(s);
    }
  }

  return [...hyperLocal, ...townWide].slice(0, maxResults);
}


