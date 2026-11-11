import { describe, it, expect, beforeEach } from 'vitest';
import {
  getGuestBookmarks,
  isGuestBookmarked,
  toggleGuestBookmark,
  removeGuestBookmark,
  clearGuestBookmarks,
} from '@/lib/guestBookmarks';

describe('Guest Bookmarks management', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts with empty guest bookmarks', () => {
    expect(getGuestBookmarks()).toEqual([]);
    expect(isGuestBookmarked('shop-123')).toBe(false);
  });

  it('toggles bookmark on and off', () => {
    const saved = toggleGuestBookmark('shop-123');
    expect(saved).toBe(true);
    expect(isGuestBookmarked('shop-123')).toBe(true);
    expect(getGuestBookmarks()).toContain('shop-123');

    const removed = toggleGuestBookmark('shop-123');
    expect(removed).toBe(false);
    expect(isGuestBookmarked('shop-123')).toBe(false);
    expect(getGuestBookmarks()).not.toContain('shop-123');
  });

  it('removes specific bookmark and clears all', () => {
    toggleGuestBookmark('shop-1');
    toggleGuestBookmark('shop-2');
    expect(getGuestBookmarks()).toEqual(['shop-2', 'shop-1']);

    removeGuestBookmark('shop-1');
    expect(getGuestBookmarks()).toEqual(['shop-2']);

    clearGuestBookmarks();
    expect(getGuestBookmarks()).toEqual([]);
  });
});
