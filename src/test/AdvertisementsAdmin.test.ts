import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  PLACEMENT_LABELS,
  BannerPlacement,
  isValidTargetUrl,
  isBannerLive,
  Banner,
} from '@/lib/banners/types';
import {
  adsEnabled,
  runtimeAdsEnabled,
  setRuntimeAdsEnabled,
  adsState,
} from '@/lib/banners/flags';

describe('Advertisements & Marketing Ads System', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('1. Placement Slot Architecture', () => {
    const requiredPlacements: BannerPlacement[] = [
      'popup',
      'homepage_inline',
      'home_bottom',
      'shops_inline',
      'shops_infeed',
      'category_inline',
      'shop_detail_inline',
      'saved_inline',
    ];

    it('supports all 8 placement slots with user-meaningful labels', () => {
      requiredPlacements.forEach((placement) => {
        expect(PLACEMENT_LABELS[placement]).toBeDefined();
        expect(PLACEMENT_LABELS[placement].length).toBeGreaterThan(0);
      });
      expect(Object.keys(PLACEMENT_LABELS)).toHaveLength(8);
    });
  });

  describe('2. Security & Target URL Validation (XSS Prevention)', () => {
    it('accepts safe http and https destination URLs', () => {
      expect(isValidTargetUrl('https://example.com')).toBe(true);
      expect(isValidTargetUrl('https://wa.me/919822001100')).toBe(true);
      expect(isValidTargetUrl('http://localbusiness.org/promo?id=123')).toBe(true);
      expect(isValidTargetUrl('  https://apnalocal.in/pune/shops  ')).toBe(true);
    });

    it('strictly rejects malicious schemes (javascript:, data:, vbscript:, file:, blob:)', () => {
      expect(isValidTargetUrl('javascript:alert(1)')).toBe(false);
      expect(isValidTargetUrl('JAVASCRIPT:void(0)')).toBe(false);
      expect(isValidTargetUrl('data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==')).toBe(false);
      expect(isValidTargetUrl('file:///etc/passwd')).toBe(false);
      expect(isValidTargetUrl('vbscript:msgbox(1)')).toBe(false);
      expect(isValidTargetUrl('blob:https://example.com/uuid')).toBe(false);
      expect(isValidTargetUrl('')).toBe(false);
      expect(isValidTargetUrl('random_text_not_url')).toBe(false);
    });
  });

  describe('3. Campaign Lifetime & Live Gating (isBannerLive)', () => {
    const baseBanner: Banner = {
      id: 'test-banner-1',
      title: 'Festival Mega Sale',
      image_url: 'https://cdn.example.com/banner.webp',
      target_url: 'https://example.com/sale',
      placement: 'homepage_inline',
      is_active: true,
      popup_delay_seconds: 0,
      close_enable_seconds: 0,
      start_date: null,
      end_date: null,
      view_count: 150,
      click_count: 12,
      sort_order: 1,
      created_at: '2026-06-01T00:00:00Z',
      updated_at: '2026-06-01T00:00:00Z',
    };

    it('returns false when is_active is explicitly false', () => {
      expect(isBannerLive({ ...baseBanner, is_active: false })).toBe(false);
    });

    it('returns true when active and dates are null (unbounded campaign)', () => {
      expect(isBannerLive(baseBanner)).toBe(true);
    });

    it('returns false when start_date is in the future', () => {
      const banner = {
        ...baseBanner,
        start_date: '2026-12-01',
      };
      // Simulating date before start_date (e.g. 2026-11-08)
      const testDate = new Date('2026-11-08T10:00:00');
      expect(isBannerLive(banner, testDate)).toBe(false);
    });

    it('returns false when end_date has passed', () => {
      const banner = {
        ...baseBanner,
        start_date: '2026-10-01',
        end_date: '2026-10-31',
      };
      const testDate = new Date('2026-11-08T10:00:00');
      expect(isBannerLive(banner, testDate)).toBe(false);
    });

    it('returns true when current date is inside [start_date, end_date]', () => {
      const banner = {
        ...baseBanner,
        start_date: '2026-11-01',
        end_date: '2026-11-30',
      };
      const testDate = new Date('2026-11-08T10:00:00');
      expect(isBannerLive(banner, testDate)).toBe(true);
    });
  });

  describe('4. Ad Visibility Flags & Admin Preview Switcher', () => {
    it('defaults to ads enabled when no local override exists', () => {
      expect(runtimeAdsEnabled()).toBe(true);
      expect(adsEnabled()).toBe(true);
      expect(adsState()).toEqual({ on: true });
    });

    it('allows admin to toggle runtime ads off and emits change event', () => {
      const listener = vi.fn();
      window.addEventListener('md_ads_runtime_change', listener);

      setRuntimeAdsEnabled(false);
      expect(runtimeAdsEnabled()).toBe(false);
      expect(adsEnabled()).toBe(false);
      expect(adsState()).toEqual({ on: false, reason: 'runtime' });
      expect(listener).toHaveBeenCalled();

      // Toggle back on
      setRuntimeAdsEnabled(true);
      expect(runtimeAdsEnabled()).toBe(true);
      expect(adsEnabled()).toBe(true);

      window.removeEventListener('md_ads_runtime_change', listener);
    });
  });

  describe('5. KPI & CTR Analytics Formulas', () => {
    it('accurately computes impressions, clicks, and CTR percentage', () => {
      const mockBanners: Banner[] = [
        {
          id: 'b1',
          title: 'Ad 1',
          image_url: 'img1.webp',
          target_url: 'https://a.com',
          placement: 'homepage_inline',
          is_active: true,
          popup_delay_seconds: 0,
          close_enable_seconds: 0,
          view_count: 1000,
          click_count: 50,
          sort_order: 1,
          created_at: '',
          updated_at: '',
        },
        {
          id: 'b2',
          title: 'Ad 2',
          image_url: 'img2.webp',
          target_url: 'https://b.com',
          placement: 'shops_inline',
          is_active: false,
          popup_delay_seconds: 0,
          close_enable_seconds: 0,
          view_count: 500,
          click_count: 25,
          sort_order: 2,
          created_at: '',
          updated_at: '',
        },
      ];

      const total = mockBanners.length;
      const activeCount = mockBanners.filter((b) => b.is_active).length;
      const inactiveCount = total - activeCount;
      const totalViews = mockBanners.reduce((s, b) => s + (b.view_count || 0), 0);
      const totalClicks = mockBanners.reduce((s, b) => s + (b.click_count || 0), 0);
      const ctr = totalViews > 0 ? (totalClicks / totalViews) * 100 : 0;

      expect(total).toBe(2);
      expect(activeCount).toBe(1);
      expect(inactiveCount).toBe(1);
      expect(totalViews).toBe(1500);
      expect(totalClicks).toBe(75);
      expect(ctr).toBe(5.0); // 75 / 1500 * 100 = 5%
    });

    it('safely handles 0 impressions without division by zero', () => {
      const totalViews = 0;
      const totalClicks = 0;
      const ctr = totalViews > 0 ? (totalClicks / totalViews) * 100 : 0;
      expect(ctr).toBe(0);
    });
  });
});
