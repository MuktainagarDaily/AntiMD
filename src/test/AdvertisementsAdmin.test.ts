import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  PLACEMENT_LABELS,
  BannerPlacement,
  isValidTargetUrl,
  isBannerLive,
  getBannerCampaignStatus,
  Banner,
} from '@/lib/banners/types';
import {
  adsEnabled,
  runtimeAdsEnabled,
  setRuntimeAdsEnabled,
  adsState,
} from '@/lib/banners/flags';
import { isSafeHttpUrl } from '@/lib/utils';

const { mockInsert, mockUpdate, mockEq } = vi.hoisted(() => ({
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
  mockEq: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: { sort_order: 2 }, error: null }),
            })),
          })),
        })),
      })),
      insert: vi.fn((payload: any) => {
        mockInsert(payload);
        return {
          select: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'banner-created-1',
                ...payload,
                view_count: 0,
                click_count: 0,
                created_at: '2026-11-11T00:00:00Z',
                updated_at: '2026-11-11T00:00:00Z',
              },
              error: null,
            }),
          })),
        };
      }),
      update: vi.fn((payload: any) => {
        mockUpdate(payload);
        return {
          eq: vi.fn((col: string, val: unknown) => {
            mockEq(col, val);
            return Promise.resolve({ error: null });
          }),
        };
      }),
    })),
  },
}));

import { selectBannersForCity } from '@/hooks/useBanners';
import { createBanner, duplicateBanner, resetBannerMetrics } from '@/lib/banners/store';

describe('Advertisements & Marketing Ads System', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
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

  describe('2. Security & Target URL Validation (XSS & Whitespace Prevention)', () => {
    it('accepts safe http and https destination URLs', () => {
      expect(isValidTargetUrl('https://example.com')).toBe(true);
      expect(isValidTargetUrl('https://wa.me/919822001100')).toBe(true);
      expect(isValidTargetUrl('http://localbusiness.org/promo?id=123')).toBe(true);
      expect(isValidTargetUrl('  https://apnalocal.in/pune/shops  ')).toBe(true);
    });

    it('strictly rejects malicious schemes and internal whitespace', () => {
      expect(isValidTargetUrl('javascript:alert(1)')).toBe(false);
      expect(isValidTargetUrl('JAVASCRIPT:void(0)')).toBe(false);
      expect(isValidTargetUrl('data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==')).toBe(false);
      expect(isValidTargetUrl('file:///etc/passwd')).toBe(false);
      expect(isValidTargetUrl('vbscript:msgbox(1)')).toBe(false);
      expect(isValidTargetUrl('blob:https://example.com/uuid')).toBe(false);
      expect(isValidTargetUrl('')).toBe(false);
      expect(isValidTargetUrl('random_text_not_url')).toBe(false);
      expect(isValidTargetUrl('https:// novelbin.com')).toBe(false);
      expect(isValidTargetUrl('https://example.com/my promo')).toBe(false);
      expect(isSafeHttpUrl('https:// novelbin.com')).toBe(false);
    });
  });

  describe('3. Campaign Lifetime, Status & Live Gating', () => {
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

    it('returns false / paused when is_active is explicitly false', () => {
      const paused = { ...baseBanner, is_active: false };
      expect(isBannerLive(paused)).toBe(false);
      expect(getBannerCampaignStatus(paused)).toBe('paused');
    });

    it('returns true / live when active and dates are null (unbounded campaign)', () => {
      expect(isBannerLive(baseBanner)).toBe(true);
      expect(getBannerCampaignStatus(baseBanner)).toBe('live');
    });

    it('returns scheduled when start_date is in the future', () => {
      const banner = {
        ...baseBanner,
        start_date: '2026-12-01',
      };
      const testDate = new Date('2026-11-08T10:00:00');
      expect(isBannerLive(banner, testDate)).toBe(false);
      expect(getBannerCampaignStatus(banner, testDate)).toBe('scheduled');
    });

    it('returns expired when end_date has passed', () => {
      const banner = {
        ...baseBanner,
        start_date: '2026-10-01',
        end_date: '2026-10-31',
      };
      const testDate = new Date('2026-11-08T10:00:00');
      expect(isBannerLive(banner, testDate)).toBe(false);
      expect(getBannerCampaignStatus(banner, testDate)).toBe('expired');
    });

    it('returns live when current date is inside [start_date, end_date]', () => {
      const banner = {
        ...baseBanner,
        start_date: '2026-11-01',
        end_date: '2026-11-30',
      };
      const testDate = new Date('2026-11-08T10:00:00');
      expect(isBannerLive(banner, testDate)).toBe(true);
      expect(getBannerCampaignStatus(banner, testDate)).toBe('live');
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
      expect(ctr).toBe(5.0);
    });

    it('safely handles 0 impressions without division by zero', () => {
      const totalViews = 0;
      const totalClicks = 0;
      const ctr = totalViews > 0 ? (totalClicks / totalViews) * 100 : 0;
      expect(ctr).toBe(0);
    });
  });

  describe('6. Geographic Specificity Precedence (City > District > Global)', () => {
    const mk = (id: string, overrides: Partial<Banner>): Banner => ({
      id,
      title: id,
      image_url: 'https://cdn.example.com/a.webp',
      target_url: 'https://example.com',
      placement: 'homepage_inline',
      is_active: true,
      popup_delay_seconds: 0,
      close_enable_seconds: 0,
      start_date: null,
      end_date: null,
      view_count: 0,
      click_count: 0,
      sort_order: 1,
      created_at: '',
      updated_at: '',
      ...overrides,
    });

    const muktai = { id: 'city-muktai', district_id: 'dist-jalgaon' };

    it('ranks city ads before district ads before global ads even with higher sort_order', () => {
      const globalAd = mk('global-1', { sort_order: 1, target_level: 'global' });
      const districtAd = mk('dist-1', { sort_order: 2, target_level: 'district', target_district_id: 'dist-jalgaon' });
      const cityAd = mk('city-1', { sort_order: 99, target_level: 'city', target_district_id: 'dist-jalgaon', target_city_id: 'city-muktai' });
      const otherCityAd = mk('other-city', { sort_order: 1, target_level: 'city', target_district_id: 'dist-pune', target_city_id: 'city-pune' });
      const otherDistrictAd = mk('other-dist', { sort_order: 1, target_level: 'district', target_district_id: 'dist-pune' });
      const expiredCityAd = mk('expired-city', { sort_order: 1, target_level: 'city', target_city_id: 'city-muktai', end_date: '2026-10-01' });

      const selected = selectBannersForCity(
        [globalAd, otherCityAd, otherDistrictAd, expiredCityAd, districtAd, cityAd],
        'homepage_inline',
        muktai,
        new Date('2026-11-11T10:00:00'),
      );

      expect(selected.map((b) => b.id)).toEqual(['city-1', 'dist-1', 'global-1']);
    });

    it('preserves sort_order within the same specificity tier', () => {
      const cityB = mk('city-b', { sort_order: 2, target_level: 'city', target_city_id: 'city-muktai' });
      const cityA = mk('city-a', { sort_order: 1, target_level: 'city', target_city_id: 'city-muktai' });

      const selected = selectBannersForCity([cityB, cityA], 'homepage_inline', muktai);
      expect(selected.map((b) => b.id)).toEqual(['city-a', 'city-b']);
    });
  });

  describe('7. Store Mutations (Geographic Persistence, Duplicate & Reset)', () => {
    it('persists target_level, target_district_id, and target_city_id in createBanner', async () => {
      await createBanner({
        title: 'Muktainagar Town Promo',
        image_url: 'https://cdn.example.com/promo.webp',
        target_url: 'https://example.com/promo',
        placement: 'homepage_inline',
        is_active: true,
        popup_delay_seconds: 0,
        close_enable_seconds: 0,
        start_date: null,
        end_date: null,
        target_level: 'city',
        target_district_id: 'dist-jalgaon',
        target_city_id: 'city-muktai',
      });

      expect(mockInsert).toHaveBeenCalledTimes(1);
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Muktainagar Town Promo',
          target_level: 'city',
          target_district_id: 'dist-jalgaon',
          target_city_id: 'city-muktai',
          sort_order: 3,
        }),
      );
    });

    it('clones banner safely as paused via duplicateBanner and resets stats via resetBannerMetrics', async () => {
      const source: Banner = {
        id: 'orig-1',
        title: 'Monsoon Offer',
        image_url: 'https://cdn.example.com/monsoon.webp',
        target_url: 'https://example.com/monsoon',
        placement: 'shops_inline',
        is_active: true,
        popup_delay_seconds: 0,
        close_enable_seconds: 0,
        start_date: '2026-11-01',
        end_date: '2026-11-30',
        view_count: 420,
        click_count: 19,
        sort_order: 1,
        target_level: 'district',
        target_district_id: 'dist-jalgaon',
        target_city_id: null,
        created_at: '',
        updated_at: '',
      };

      await duplicateBanner(source);
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Monsoon Offer (Copy)',
          is_active: false,
          placement: 'shops_inline',
          target_level: 'district',
          target_district_id: 'dist-jalgaon',
          target_city_id: null,
        }),
      );

      await resetBannerMetrics('orig-1');
      expect(mockUpdate).toHaveBeenCalledWith({ view_count: 0, click_count: 0 });
      expect(mockEq).toHaveBeenCalledWith('id', 'orig-1');
    });
  });
});
