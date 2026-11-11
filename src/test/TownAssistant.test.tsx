import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { TownAssistantDrawer } from '@/components/TownAssistantDrawer';
import {
  askTownAssistant,
  detectQueryLanguage,
  resetAssistantEdgeAvailability,
  type AssistantResponsePayload,
} from '@/lib/assistant/assistantService';

const {
  mockInvoke,
  mockFetchMesses,
  mockFetchPGs,
  mockSchoolsList,
  mockFrom,
  mockUseCity,
} = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
  mockFetchMesses: vi.fn(),
  mockFetchPGs: vi.fn(),
  mockSchoolsList: vi.fn(),
  mockFrom: vi.fn(),
  mockUseCity: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: mockInvoke,
    },
    from: mockFrom,
  },
}));

vi.mock('@/lib/living/livingService', () => ({
  fetchMessesForCity: mockFetchMesses,
  fetchPGsForCity: mockFetchPGs,
}));

vi.mock('@/lib/repos/schoolsRepo', () => ({
  schoolsRepo: {
    list: mockSchoolsList,
  },
}));

vi.mock('@/hooks/useCity', () => ({
  useCity: () => mockUseCity(),
}));

vi.mock('@/i18n', () => ({
  useT: () => ({
    locale: 'en',
    t: (k: string) => k,
    setLocale: vi.fn(),
  }),
}));

function makeSupabaseChain(data: unknown[] = []) {
  const result = { data, error: null };
  const chain: Record<string, unknown> = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    or: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    order: vi.fn(() => chain),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    then: (resolve: (val: unknown) => unknown, reject?: (err: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  };
  return chain;
}

const CITY_MUKTAINAGAR = {
  id: '644b68eb-472c-40d3-9f83-c7d26e121498',
  slug: 'muktainagar',
  name: 'Muktainagar',
  name_mr: 'मुक्ताईनगर',
};

const CITY_BHUSAWAL = {
  id: '99999999-472c-40d3-9f83-c7d26e121499',
  slug: 'bhusawal',
  name: 'Bhusawal',
  name_mr: 'भुसावळ',
};

function LocationDisplay() {
  const loc = useLocation();
  return <div data-testid="current-path">{loc.pathname}</div>;
}

describe('TownAssistant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    resetAssistantEdgeAvailability();

    mockUseCity.mockReturnValue({
      currentCity: CITY_MUKTAINAGAR,
      currentVillage: null,
    });

    mockFrom.mockImplementation(() => makeSupabaseChain([]));

    mockFetchMesses.mockResolvedValue([
      {
        shop: {
          id: 'mess-1',
          slug: 'annapurna-mess',
          name: 'Annapurna Mess',
          name_mr: 'अन्नपूर्णा मेस',
          area: 'Bus Stand Road',
        },
        profile: {
          shop_id: 'mess-1',
          mess_type: 'pure_veg',
          single_thali_rate: 60,
          monthly_rate: 2200,
          tiffin_delivery: true,
        },
        latestMenu: {
          lunch_text: 'Puran Poli, Kadhi, Rice',
          dinner_text: 'Paneer Masala, Bhakri',
          special_tag: 'Puran Poli Special',
          menu_date: '2026-11-11',
        },
      },
      {
        shop: {
          id: 'mess-2',
          slug: 'saraswati-bhojanalay',
          name: 'Saraswati Bhojanalay',
          name_mr: 'सरस्वती भोजनालय',
          area: 'College Road',
        },
        profile: {
          shop_id: 'mess-2',
          mess_type: 'both',
          single_thali_rate: 80,
          monthly_rate: 2600,
          tiffin_delivery: false,
        },
        latestMenu: null,
      },
    ]);

    mockFetchPGs.mockResolvedValue([
      {
        shop: {
          id: 'pg-1',
          slug: 'vidyarthi-boys-pg',
          name: 'Vidyarthi Boys Hostel',
          name_mr: 'विद्यार्थी मुले वसतिगृह',
          area: 'Near College',
        },
        profile: {
          shop_id: 'pg-1',
          gender: 'boys',
          available_beds: 4,
          food_included: true,
        },
      },
    ]);

    mockSchoolsList.mockResolvedValue([]);
  });

  describe('assistantService', () => {
    it('detects Marathi, Hinglish, and English queries cleanly', () => {
      expect(detectQueryLanguage('स्वस्त जेवण कुठे मिळेल?')).toBe('mr');
      expect(detectQueryLanguage('aaj mess madhe kay special ahe')).toBe('hinglish');
      expect(detectQueryLanguage('Affordable meals near me')).toBe('en');
    });

    it('skips Edge Function without CORS errors by default and queries bus_timetable & shops cleanly', async () => {
      const result = await askTownAssistant({
        query: 'Affordable meals near me',
        cityId: CITY_MUKTAINAGAR.id,
        citySlug: CITY_MUKTAINAGAR.slug,
        locationLabel: 'Muktainagar',
      });

      expect(mockInvoke).not.toHaveBeenCalled();
      expect(mockFrom).toHaveBeenCalledWith('bus_timetable');
      expect(mockFrom).toHaveBeenCalledWith('shops');
      expect(result.mode).toBe('local-fallback');
      expect(result.recommendations.length).toBe(2);
      expect(result.recommendations[0].entityType).toBe('mess');
      expect(result.recommendations[0].title).toBe('Annapurna Mess');
      expect(result.recommendations[0].highlightBadge).toBe('Special: Puran Poli Special');
      expect(mockFetchMesses).toHaveBeenCalledWith(CITY_MUKTAINAGAR.id, undefined);
    });

    it('falls back to live local directory when AI flag is enabled but Edge Function fails', async () => {
      vi.stubEnv('VITE_ENABLE_TOWN_ASSISTANT_AI', 'true');
      mockInvoke.mockResolvedValue({ data: null, error: new Error('Function not found') });

      const result = await askTownAssistant({
        query: 'Affordable meals near me',
        cityId: CITY_MUKTAINAGAR.id,
        citySlug: CITY_MUKTAINAGAR.slug,
        locationLabel: 'Muktainagar',
      });

      expect(mockInvoke).toHaveBeenCalledTimes(1);
      expect(result.mode).toBe('local-fallback');
      expect(result.recommendations[0].title).toBe('Annapurna Mess');
    });

    it('returns live Gemini Edge Function response directly when AI flag is enabled and available', async () => {
      vi.stubEnv('VITE_ENABLE_TOWN_ASSISTANT_AI', 'true');
      const geminiPayload: AssistantResponsePayload = {
        replyText: 'Annapurna Mess serves Puran Poli Special today for ₹60.',
        detectedLanguage: 'en',
        mode: 'gemini',
        recommendations: [
          {
            entityType: 'mess',
            id: 'mess-1',
            slug: 'annapurna-mess',
            title: 'Annapurna Mess',
            highlightBadge: '₹60 Thali',
            reason: 'Today special Puran Poli with affordable ₹60 thali.',
            area: 'Bus Stand Road',
          },
        ],
        followUpSuggestions: ['Any boys PG nearby?'],
      };

      mockInvoke.mockResolvedValue({ data: geminiPayload, error: null });

      const result = await askTownAssistant({
        query: "What's special cooked today?",
        cityId: CITY_MUKTAINAGAR.id,
        citySlug: CITY_MUKTAINAGAR.slug,
        locationLabel: 'Muktainagar',
      });

      expect(result).toEqual(geminiPayload);
      expect(mockFetchMesses).not.toHaveBeenCalled();
    });
  });

  describe('TownAssistantDrawer UI', () => {
    it('hides floating button on admin and auth routes', () => {
      const { rerender } = render(
        <MemoryRouter initialEntries={['/admin/dashboard']}>
          <TownAssistantDrawer />
        </MemoryRouter>,
      );

      expect(screen.queryByTestId('town-assistant-fab')).not.toBeInTheDocument();

      rerender(
        <MemoryRouter initialEntries={['/auth']}>
          <TownAssistantDrawer />
        </MemoryRouter>,
      );

      expect(screen.queryByTestId('town-assistant-fab')).not.toBeInTheDocument();
    });

    it('uses higher bottom offset on detail pages so sticky bars remain uncovered', () => {
      render(
        <MemoryRouter initialEntries={['/muktainagar/mess/annapurna-mess']}>
          <TownAssistantDrawer />
        </MemoryRouter>,
      );

      const fab = screen.getByTestId('town-assistant-fab');
      expect(fab.className).toContain('bottom-24');
    });

    it('opens drawer, queries affordable meals via fallback, navigates on card tap, and resets on city switch', async () => {
      mockInvoke.mockResolvedValue({ data: null, error: new Error('No Edge Function') });

      const { rerender } = render(
        <MemoryRouter initialEntries={['/muktainagar']}>
          <Routes>
            <Route
              path="*"
              element={
                <>
                  <LocationDisplay />
                  <TownAssistantDrawer />
                </>
              }
            />
          </Routes>
        </MemoryRouter>,
      );

      const fab = screen.getByTestId('town-assistant-fab');
      expect(fab.className).toContain('bottom-5');

      await act(async () => {
        fireEvent.click(fab);
      });

      expect(screen.getByTestId('assistant-location-badge')).toHaveTextContent('Muktainagar');

      const quickChip = screen.getByRole('button', { name: 'Affordable meals near me' });
      await act(async () => {
        fireEvent.click(quickChip);
      });

      await waitFor(() => {
        expect(screen.getByText('Live Directory')).toBeInTheDocument();
        expect(screen.getByText('Annapurna Mess')).toBeInTheDocument();
      });

      // Click recommendation card -> navigates to /muktainagar/mess/annapurna-mess
      const recCard = screen.getByText('Annapurna Mess').closest('button')!;
      await act(async () => {
        fireEvent.click(recCard);
      });

      await waitFor(() => {
        expect(screen.getByTestId('current-path')).toHaveTextContent(
          '/muktainagar/mess/annapurna-mess',
        );
      });

      // Switch city -> Bhusawal resets previous conversation
      mockUseCity.mockReturnValue({
        currentCity: CITY_BHUSAWAL,
        currentVillage: null,
      });

      rerender(
        <MemoryRouter initialEntries={['/bhusawal']}>
          <Routes>
            <Route
              path="*"
              element={
                <>
                  <LocationDisplay />
                  <TownAssistantDrawer />
                </>
              }
            />
          </Routes>
        </MemoryRouter>,
      );

      await act(async () => {
        fireEvent.click(screen.getByTestId('town-assistant-fab'));
      });

      expect(screen.getByTestId('assistant-location-badge')).toHaveTextContent('Bhusawal');
      expect(screen.queryByText('Annapurna Mess')).not.toBeInTheDocument();
    });
  });
});
