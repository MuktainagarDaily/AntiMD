import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockInvoke, mockFrom } = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: mockInvoke,
    },
    from: mockFrom,
  },
}));

import {
  translateEnToMr,
  isQuotaExceeded,
  resetQuotaExceeded,
  clearMemoryCache,
  isWarningText,
} from '@/lib/translateApi';

function makeCacheTableMock() {
  return {
    select: () => ({
      eq: () => ({
        eq: () => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    }),
    update: () => ({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
    insert: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
}

describe('Marathi Translation Engine & Warning Guard', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    resetQuotaExceeded();
    clearMemoryCache();
    localStorage.clear();
    vi.clearAllMocks();
    mockFrom.mockImplementation(() => makeCacheTableMock());
    mockInvoke.mockResolvedValue({ data: null, error: new Error('AI unavailable') });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('Warning String Rejection & Safe Fallback', () => {
    it('detects corrupt warning and quota exceeded messages with isWarningText', () => {
      expect(isWarningText('MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS')).toBe(true);
      expect(isWarningText('mymemory warning: daily limit reached')).toBe(true);
      expect(isWarningText('QUERY LIMIT EXCEEDED FOR TODAY')).toBe(true);
      expect(isWarningText('YOU HAVE EXCEEDED YOUR FREE TRANSLATIONS QUOTA')).toBe(true);
      expect(isWarningText('INVALID EMAIL PROVIDED')).toBe(true);

      // Clean translations should return false
      expect(isWarningText('किराणा दुकान')).toBe(false);
      expect(isWarningText('जिल्हा परिषद प्राथमिक शाळा')).toBe(false);
      expect(isWarningText('General Store')).toBe(false);
    });

    it('rejects MYMEMORY WARNING strings and returns an empty string instead of corrupt text', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          responseStatus: 200,
          responseData: {
            translatedText: 'MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN 08 HOURS 12 MINUTES',
          },
        }),
      } as Response);

      const result = await translateEnToMr('Medical Store');

      // Crucial: Must return empty string '', NEVER the warning text
      expect(result).toBe('');
      expect(isQuotaExceeded()).toBe(true);
    });

    it('rejects LIMIT EXCEEDED responses and returns an empty string', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          responseStatus: 200,
          responseData: {
            translatedText: 'DAILY USAGE LIMIT EXCEEDED',
          },
        }),
      } as Response);

      const result = await translateEnToMr('Hardware Shop');

      expect(result).toBe('');
      expect(isQuotaExceeded()).toBe(true);
    });

    it('returns empty string and marks quota exceeded on HTTP 403 or 429 status', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ responseStatus: 403 }),
      } as Response);

      const result = await translateEnToMr('Stationery');

      expect(result).toBe('');
      expect(isQuotaExceeded()).toBe(true);
    });

    it('returns empty string on non-200 responseStatus in JSON payload', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          responseStatus: 429,
          responseData: { translatedText: 'Rate limit' },
        }),
      } as Response);

      const result = await translateEnToMr('Bakery');

      expect(result).toBe('');
      expect(isQuotaExceeded()).toBe(true);
    });
  });

  describe('50k Characters/Day Free Tier & Valid Translations', () => {
    it('appends &de=admin@muktainagardaily.com to the MyMemory endpoint URL', async () => {
      let requestedUrl = '';
      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        requestedUrl = url;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            responseStatus: 200,
            responseData: { translatedText: 'शाळा' },
          }),
        } as Response;
      });

      await translateEnToMr('School');

      expect(requestedUrl).toContain('&de=admin@muktainagardaily.com');
      expect(requestedUrl).toContain('langpair=en|mr');
      expect(requestedUrl).toContain('q=School');
    });

    it('returns clean Devanagari translation when response is valid', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          responseStatus: 200,
          responseData: { translatedText: 'किराणा स्टोअर्स' },
        }),
      } as Response);

      const result = await translateEnToMr('Grocery Store');

      expect(result).toBe('किराणा स्टोअर्स');
      expect(isQuotaExceeded()).toBe(false);
    });

    it('decodes HTML entities properly without leaving corrupt entity codes', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          responseStatus: 200,
          responseData: { translatedText: 'राम&#39;चे &amp; श्याम&#39;चे किराणा &quot;दुकान&quot;' },
        }),
      } as Response);

      const result = await translateEnToMr("Ram's & Shyam's Grocery 'Shop'");

      expect(result).toBe(`राम'चे & श्याम'चे किराणा "दुकान"`);
    });
  });

  describe('Cache Safety & Poison Prevention', () => {
    it('never poisons the cache with warning messages', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          responseStatus: 200,
          responseData: { translatedText: 'MYMEMORY WARNING: QUOTA' },
        }),
      } as Response);

      await translateEnToMr('Poison Test');

      // Check localStorage
      const cached = localStorage.getItem('md.tx.cache.v1');
      if (cached) {
        const parsed = JSON.parse(cached);
        expect(Object.values(parsed).some((v: any) => isWarningText(v))).toBe(false);
      }
    });
  });

  describe('Gemini AI Marathi Fallback', () => {
    it('falls back to town-assistant AI translation when MyMemory returns quota warning', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          responseStatus: 200,
          responseData: {
            translatedText: 'MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY',
          },
        }),
      } as Response);

      mockInvoke.mockResolvedValueOnce({
        data: { translations: ['ताजी टिफिन सेवा'] },
        error: null,
      });

      const result = await translateEnToMr('Fresh Tiffin Service');

      expect(mockInvoke).toHaveBeenCalledWith('town-assistant', {
        body: {
          mode: 'translate',
          texts: ['Fresh Tiffin Service'],
          sourceLang: 'en',
          targetLang: 'mr',
        },
      });
      expect(result).toBe('ताजी टिफिन सेवा');
      expect(isQuotaExceeded()).toBe(false);
    });

    it('falls back to AI translation when MyMemory returns HTTP 429 or echoes raw English', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          responseStatus: 200,
          responseData: { translatedText: 'Pure Veg Thali' },
        }),
      } as Response);

      mockInvoke.mockResolvedValueOnce({
        data: { translations: ['शुद्ध शाकाहारी थाळी'] },
        error: null,
      });

      const echoFallback = await translateEnToMr('Pure Veg Thali');
      expect(echoFallback).toBe('शुद्ध शाकाहारी थाळी');

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({ responseStatus: 429 }),
      } as Response);

      mockInvoke.mockResolvedValueOnce({
        data: { translations: ['ताजे अन्न'] },
        error: null,
      });

      const rateLimitFallback = await translateEnToMr('Fresh Food');
      expect(rateLimitFallback).toBe('ताजे अन्न');
    });

    it('rejects non-Devanagari or untranslated AI fallback responses for en|mr', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      } as Response);

      mockInvoke.mockResolvedValueOnce({
        data: { translations: ['Breakfast Counter'] },
        error: null,
      });

      const res = await translateEnToMr('Breakfast Counter');
      expect(res).toBe('');
    });
  });
});
