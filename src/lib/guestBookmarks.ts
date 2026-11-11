/**
 * Guest bookmark management via localStorage.
 * Enables unauthenticated visitors to bookmark shops immediately without an auth wall.
 * Automatically synced to the database when the user signs in.
 */
const GUEST_BOOKMARKS_KEY = 'md.guest_bookmarks';

export function getGuestBookmarks(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(GUEST_BOOKMARKS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function isGuestBookmarked(shopId: string): boolean {
  return getGuestBookmarks().includes(shopId);
}

export function toggleGuestBookmark(shopId: string): boolean {
  const current = getGuestBookmarks();
  let updated: string[];
  let saved: boolean;
  if (current.includes(shopId)) {
    updated = current.filter((id) => id !== shopId);
    saved = false;
  } else {
    updated = [shopId, ...current];
    saved = true;
  }
  try {
    localStorage.setItem(GUEST_BOOKMARKS_KEY, JSON.stringify(updated));
  } catch { /* ignore quota / storage errors */ }
  window.dispatchEvent(new CustomEvent('guest-bookmarks-changed', { detail: { shopId, saved } }));
  return saved;
}

export function removeGuestBookmark(shopId: string): void {
  const current = getGuestBookmarks();
  const updated = current.filter((id) => id !== shopId);
  try {
    localStorage.setItem(GUEST_BOOKMARKS_KEY, JSON.stringify(updated));
  } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent('guest-bookmarks-changed', { detail: { shopId, saved: false } }));
}

export function clearGuestBookmarks(): void {
  try {
    localStorage.removeItem(GUEST_BOOKMARKS_KEY);
  } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent('guest-bookmarks-changed', { detail: { cleared: true } }));
}
