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
  mockFetchLocalNews,
  mockFetchAnnouncements,
  mockFetchOrganizations,
  mockFrom,
  mockUseCity,
} = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
  mockFetchMesses: vi.fn(),
  mockFetchPGs: vi.fn(),
  mockSchoolsList: vi.fn(),
  mockFetchLocalNews: vi.fn(),
  mockFetchAnnouncements: vi.fn(),
  mockFetchOrganizations: vi.fn(),
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

vi.mock('@/lib/news/newsService', () => ({
  fetchLocalNewsForCity: mockFetchLocalNews,
}));

vi.mock('@/lib/services/authorityService', () => ({
  fetchAnnouncementsForCity: mockFetchAnnouncements,
  fetchOrganizationsForCity: mockFetchOrganizations,
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
        id: 'mess-1',
        slug: 'annapurna-mess',
        name: 'Annapurna Mess',
        name_mr: 'अन्नपूर्णा मेस',
        area: 'Bus Stand Road',
        mess_profile: {
          shop_id: 'mess-1',
          mess_type: 'pure_veg',
          single_thali_rate: 60,
          monthly_rate: 2200,
          tiffin_delivery: true,
        },
        today_menu: {
          lunch_text: 'Puran Poli, Kadhi, Rice',
          dinner_text: 'Paneer Masala, Bhakri',
          special_tag: 'Puran Poli Special',
          menu_date: '2026-11-11',
        },
      },
      {
        id: 'mess-2',
        slug: 'saraswati-bhojanalay',
        name: 'Saraswati Bhojanalay',
        name_mr: 'सरस्वती भोजनालय',
        area: 'College Road',
        mess_profile: {
          shop_id: 'mess-2',
          mess_type: 'both',
          single_thali_rate: 80,
          monthly_rate: 2600,
          tiffin_delivery: false,
        },
        today_menu: null,
      },
    ]);

    mockFetchPGs.mockResolvedValue([
      {
        id: 'pg-1',
        slug: 'vidyarthi-boys-pg',
        name: 'Vidyarthi Boys Hostel',
        name_mr: 'विद्यार्थी मुले वसतिगृह',
        area: 'Near College',
        pg_profile: {
          shop_id: 'pg-1',
          gender: 'boys',
          available_beds: 4,
          food_included: true,
        },
      },
    ]);

    mockSchoolsList.mockResolvedValue([]);
    mockFetchLocalNews.mockResolvedValue({ items: [], storageMode: 'supabase' });
    mockFetchAnnouncements.mockResolvedValue([]);
    mockFetchOrganizations.mockResolvedValue([]);
  });

  describe('assistantService', () => {
    it('detects Marathi, Hinglish, and English queries cleanly', () => {
      expect(detectQueryLanguage('स्वस्त जेवण कुठे मिळेल?')).toBe('mr');
      expect(detectQueryLanguage('aaj mess madhe kay special ahe')).toBe('hinglish');
      expect(detectQueryLanguage('Affordable meals near me')).toBe('en');
    });

    it('skips Edge Function when explicitly disabled via env and queries bus_timetable & shops cleanly', async () => {
      vi.stubEnv('VITE_ENABLE_TOWN_ASSISTANT_AI', 'false');
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

    it('fetches and ranks Local News in English & Marathi and provides a live-news fallback when empty', async () => {
      vi.stubEnv('VITE_ENABLE_TOWN_ASSISTANT_AI', 'false');
      mockFetchLocalNews.mockResolvedValue({
        storageMode: 'supabase',
        items: [
          {
            id: 'news-1',
            city_id: CITY_MUKTAINAGAR.id,
            title: 'Cotton Mandi Prices Surge in Muktainagar',
            title_mr: 'मुक्ताईनगर बाजारात कापूस दरात वाढ',
            summary: 'Rates touched ₹7,800 per quintal at APMC yard today.',
            summary_mr: 'कृषी उत्पन्न बाजार समितीत आज ₹७,८०० भाव मिळाला.',
            category: 'agriculture',
            language: 'mr',
            source_name: 'Lokmat',
            source_url: 'https://lokmat.com/example-1',
            published_at: '2026-11-11T08:00:00Z',
            scraped_at: '2026-11-11T08:15:00Z',
            is_pinned: true,
            is_active: true,
          },
        ],
      });

      const mrRes = await askTownAssistant({
        query: 'आजच्या ताज्या बातम्या',
        cityId: CITY_MUKTAINAGAR.id,
        citySlug: CITY_MUKTAINAGAR.slug,
        locationLabel: 'Muktainagar',
      });

      expect(mrRes.detectedLanguage).toBe('mr');
      expect(mrRes.recommendations[0]).toMatchObject({
        entityType: 'news',
        id: 'news-1',
        title: 'मुक्ताईनगर बाजारात कापूस दरात वाढ',
        externalUrl: 'https://lokmat.com/example-1',
      });

      // Empty news feed -> helpful navigation card instead of falling into shops
      mockFetchLocalNews.mockResolvedValue({ storageMode: 'local-cache', items: [] });
      const emptyNewsRes = await askTownAssistant({
        query: "Today's local news",
        cityId: CITY_MUKTAINAGAR.id,
        citySlug: CITY_MUKTAINAGAR.slug,
        locationLabel: 'Muktainagar',
      });
      expect(emptyNewsRes.recommendations[0].entityType).toBe('news');
      expect(emptyNewsRes.recommendations[0].id).toContain('news-desk');
    });

    it('surfaces Essential Civic Alerts and Department Helplines for water/electricity queries', async () => {
      vi.stubEnv('VITE_ENABLE_TOWN_ASSISTANT_AI', 'false');
      mockFetchAnnouncements.mockResolvedValue([
        {
          id: 'ann-1',
          org_id: 'org-1',
          department_id: 'dept-1',
          city_id: CITY_MUKTAINAGAR.id,
          title: 'Emergency Water Pipeline Repair',
          title_mr: 'तातडीची जलवाहिनी दुरुस्ती',
          description: 'Supply paused for 3 hours near Station Road.',
          category: 'interruption',
          priority: 'high',
          status: 'active',
          published_at: '2026-11-11T06:00:00Z',
          is_demo: true,
          department: { id: 'dept-1', slug: 'water', name: 'Water Supply', name_mr: 'पाणी पुरवठा', icon: 'Droplets', color_theme: 'blue', sort_order: 1, is_active: true },
          organization: { id: 'org-1', department_ids: ['dept-1'], city_id: CITY_MUKTAINAGAR.id, name: 'Water Board', name_mr: 'पाणी पुरवठा', helpline_phone: '1916', emergency_phone: '9822001100', is_demo: true, is_verified: true },
          locations: [{ city_id: CITY_MUKTAINAGAR.id, area_text: 'Station Road' }],
        },
      ]);
      mockFetchOrganizations.mockResolvedValue([
        {
          id: 'org-2',
          department_ids: ['dept-2'],
          city_id: CITY_MUKTAINAGAR.id,
          name: 'Electricity Sub-Division (MSEDCL)',
          name_mr: 'महावितरण उपविभाग',
          office_address: 'Malkapur Road',
          helpline_phone: '1912',
          emergency_phone: '1912',
          is_demo: true,
          is_verified: true,
        },
      ]);

      const res = await askTownAssistant({
        query: 'Water outage or electricity helpline number?',
        cityId: CITY_MUKTAINAGAR.id,
        citySlug: CITY_MUKTAINAGAR.slug,
        locationLabel: 'Muktainagar',
      });

      expect(res.recommendations.length).toBeGreaterThanOrEqual(2);
      expect(res.recommendations[0]).toMatchObject({
        entityType: 'service',
        id: 'ann-1',
        phone: '9822001100',
        priority: 'high',
      });
    });

    it('matches upgraded Education fields, school_notices, and Parandwadi transport coverage', async () => {
      vi.stubEnv('VITE_ENABLE_TOWN_ASSISTANT_AI', 'false');
      mockSchoolsList.mockResolvedValue([
        {
          id: 'sch-1',
          slug: 'indira-college-parandwadi',
          name: 'Indira College of Engineering & Management',
          name_mr: 'इंदिरा अभियांत्रिकी महाविद्यालय',
          school_type: 'engineering-polytechnic',
          medium: 'english',
          area: 'Parandwadi',
          address: 'Parandwadi, Maval, Pune',
          phone: '02114280200',
          board: 'SPPU Pune University',
          admission_status: 'open',
          available_seats: 120,
          annual_fee_min: 75000,
          annual_fee_max: 98000,
          transport_villages: ['Parandwadi', 'Somatane', 'Talegaon'],
          is_active: true,
        },
        {
          id: 'sch-2',
          slug: 'zp-primary-urse',
          name: 'ZP Primary School',
          name_mr: 'जि.प. प्राथमिक शाळा',
          school_type: 'primary',
          medium: 'marathi',
          area: 'Urse',
          address: 'Urse Gaon',
          admission_status: 'closed',
          is_active: true,
        },
      ]);

      mockFrom.mockImplementation((table: string) => {
        if (table === 'school_notices') {
          return makeSupabaseChain([
            {
              id: 'notice-1',
              school_id: 'sch-1',
              title: 'B.E. CAP Round 2 Admission Notice',
              category: 'admission',
              is_pinned: true,
              is_active: true,
              expires_at: null,
              created_at: '2026-11-10T10:00:00Z',
            },
          ]);
        }
        return makeSupabaseChain([]);
      });

      const res = await askTownAssistant({
        query: 'Engineering college admissions open notice for Parandwadi?',
        cityId: '11111111-1111-4111-8111-111111111111',
        citySlug: 'maval',
        villageName: 'Parandwadi',
        locationLabel: 'Parandwadi, Maval',
      });

      expect(res.recommendations[0]).toMatchObject({
        entityType: 'school',
        id: 'sch-1',
        slug: 'indira-college-parandwadi',
        highlightBadge: 'Admissions Open',
        phone: '02114280200',
      });
      expect(res.recommendations[0].reason).toContain('B.E. CAP Round 2 Admission Notice');
    });

    it('falls back to Parandwadi bus depot seeds for Maval when DB bus_timetable is empty', async () => {
      vi.stubEnv('VITE_ENABLE_TOWN_ASSISTANT_AI', 'false');
      const res = await askTownAssistant({
        query: 'Next bus to Nigdi from Parandwadi?',
        cityId: '11111111-1111-4111-8111-111111111111',
        citySlug: 'maval',
        locationLabel: 'Parandwadi, Maval',
      });

      expect(res.recommendations.length).toBeGreaterThan(0);
      expect(res.recommendations[0].entityType).toBe('bus');
      expect(res.recommendations[0].title).toContain('Nigdi');
    });

    it('uses conversation history for brief follow-ups and forwards history + citySlug to Edge Function', async () => {
      mockFetchPGs.mockResolvedValue([
        {
          id: 'pg-boys',
          slug: 'boys-hostel',
          name: 'Boys Hostel',
          pg_profile: { shop_id: 'pg-boys', gender: 'boys', available_beds: 5 },
        },
        {
          id: 'pg-girls',
          slug: 'savitri-girls-pg',
          name: 'Savitri Girls PG',
          pg_profile: { shop_id: 'pg-girls', gender: 'girls', available_beds: 6 },
        },
      ]);

      vi.stubEnv('VITE_ENABLE_TOWN_ASSISTANT_AI', 'false');
      const followUpRes = await askTownAssistant({
        query: 'for girls?',
        cityId: CITY_MUKTAINAGAR.id,
        citySlug: CITY_MUKTAINAGAR.slug,
        locationLabel: 'Muktainagar',
        history: [{ role: 'user', text: 'Any PG near college?' }],
      });

      expect(followUpRes.recommendations[0]).toMatchObject({
        entityType: 'pg',
        id: 'pg-girls',
      });

      // Verify Edge Function payload forwards citySlug and trimmed history
      vi.stubEnv('VITE_ENABLE_TOWN_ASSISTANT_AI', 'true');
      resetAssistantEdgeAvailability();
      mockInvoke.mockResolvedValue({
        data: {
          replyText: 'Here are the details.',
          detectedLanguage: 'en',
          mode: 'gemini',
          recommendations: [],
          followUpSuggestions: [],
        },
        error: null,
      });

      await askTownAssistant({
        query: 'What are their fees?',
        cityId: CITY_MUKTAINAGAR.id,
        citySlug: CITY_MUKTAINAGAR.slug,
        villageName: 'Parandwadi',
        locationLabel: 'Muktainagar',
        history: [{ role: 'user', text: 'College admissions open?' }],
      });

      expect(mockInvoke).toHaveBeenCalledWith('town-assistant', {
        body: expect.objectContaining({
          cityId: CITY_MUKTAINAGAR.id,
          citySlug: CITY_MUKTAINAGAR.slug,
          villageName: 'Parandwadi',
          history: [{ role: 'user', text: 'College admissions open?' }],
        }),
      });
    });

    it('surfaces regular permanent menus (menu_items) for Hotel/Restaurant queries and excludes Hotel/PG from retail shop results', async () => {
      vi.stubEnv('VITE_ENABLE_TOWN_ASSISTANT_AI', 'false');
      mockFetchMesses.mockResolvedValue([
        {
          id: 'visawa-1',
          slug: 'hotel-visawa-family-restaurant-parandwadi',
          name: 'Hotel Visawa Family Restaurant',
          area: 'Parandwadi',
          mess_profile: {
            shop_id: 'visawa-1',
            mess_type: 'veg_nonveg',
            single_thali_rate: 120,
            monthly_rate: null,
            tiffin_delivery: false,
          },
          today_menu: null,
          latest_menu: null,
          menu_items: [
            { id: 'mi-1', name: 'Special Misal Pav', category: 'Snacks', price: 80, is_veg: true, available: true },
            { id: 'mi-2', name: 'Veg Thali', category: 'Main Course', price: 120, is_veg: true, available: true },
          ],
        },
      ]);

      const hotelMenuRes = await askTownAssistant({
        query: 'Hotel Visawa Family Restaurant menu',
        cityId: '11111111-1111-4111-8111-111111111111',
        citySlug: 'maval',
        locationLabel: 'Parandwadi, Maval',
      });

      expect(hotelMenuRes.recommendations[0]).toMatchObject({
        entityType: 'mess',
        id: 'visawa-1',
        slug: 'hotel-visawa-family-restaurant-parandwadi',
      });
      expect(hotelMenuRes.recommendations[0].reason).toContain('Special Misal Pav');

      // When querying general shops, mixed DB rows for Hotels/PGs must never leak as entityType 'shop'
      mockFrom.mockImplementation((table: string) => {
        if (table === 'shops') {
          return makeSupabaseChain([
            {
              id: 'visawa-1',
              slug: 'hotel-visawa-family-restaurant-parandwadi',
              name: 'Hotel Visawa Family Restaurant',
              area: 'Parandwadi',
              shop_categories: [{ categories: { name: 'Hotels & Restaurants' } }],
            },
            {
              id: 'kirana-1',
              slug: 'shree-ganesh-kirana',
              name: 'Shree Ganesh Kirana',
              area: 'Parandwadi',
              shop_categories: [{ categories: { name: 'Grocery & Kirana' } }],
            },
          ]);
        }
        return makeSupabaseChain([]);
      });

      const kiranaRes = await askTownAssistant({
        query: 'Kirana store in Parandwadi',
        cityId: '11111111-1111-4111-8111-111111111111',
        citySlug: 'maval',
        locationLabel: 'Parandwadi, Maval',
      });

      expect(kiranaRes.recommendations.some((r) => r.entityType === 'shop' && r.id === 'visawa-1')).toBe(false);
      expect(kiranaRes.recommendations[0]).toMatchObject({
        entityType: 'shop',
        id: 'kirana-1',
      });
    });

    it('normalizes misclassified Edge AI recommendations for Hotel/Restaurant and PG away from entityType shop', async () => {
      vi.stubEnv('VITE_ENABLE_TOWN_ASSISTANT_AI', 'true');
      mockInvoke.mockResolvedValue({
        data: {
          replyText: 'Here are dining and stay options near Parandwadi.',
          detectedLanguage: 'en',
          mode: 'gemini',
          recommendations: [
            {
              entityType: 'shop',
              id: 'visawa-1',
              slug: 'hotel-visawa-family-restaurant-parandwadi',
              title: 'Hotel Visawa Family Restaurant',
              highlightBadge: 'Family Restaurant',
              reason: 'Menu includes Special Misal Pav and Veg Thali.',
              area: 'Parandwadi',
            },
            {
              entityType: 'shop',
              id: 'pg-2',
              slug: 'saikrupa-girls-pg-parandwadi',
              title: 'Saikrupa Girls PG',
              highlightBadge: 'Girls Hostel',
              reason: 'Beds available near college.',
              area: 'Parandwadi',
            },
            {
              entityType: 'shop',
              id: 'shop-1',
              slug: 'patil-kirana',
              title: 'Patil Kirana Store',
              highlightBadge: 'Grocery & Kirana',
              reason: 'Open daily.',
              area: 'Main Road',
            },
          ],
          followUpSuggestions: [],
        },
        error: null,
      });

      const res = await askTownAssistant({
        query: 'Where is Hotel Visawa and girls PG?',
        cityId: '11111111-1111-4111-8111-111111111111',
        citySlug: 'maval',
        locationLabel: 'Parandwadi, Maval',
      });

      expect(res.recommendations.map((r) => r.entityType)).toEqual(['mess', 'pg', 'shop']);
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

    it('uses higher bottom offset on detail pages including schools and stacks above the Shops filter FAB without overlap', () => {
      const { unmount } = render(
        <MemoryRouter initialEntries={['/muktainagar/mess/annapurna-mess']}>
          <TownAssistantDrawer />
        </MemoryRouter>,
      );

      expect(screen.getByTestId('town-assistant-fab').className).toContain('bottom-24');
      unmount();

      const { unmount: unmountSchool } = render(
        <MemoryRouter initialEntries={['/maval/schools/indira-college']}>
          <TownAssistantDrawer />
        </MemoryRouter>,
      );

      expect(screen.getByTestId('town-assistant-fab').className).toContain('bottom-24');
      unmountSchool();

      render(
        <MemoryRouter initialEntries={['/muktainagar/shops']}>
          <TownAssistantDrawer />
        </MemoryRouter>,
      );

      const shopsFab = screen.getByTestId('town-assistant-fab');
      expect(shopsFab.className).toContain('bottom-20');
      expect(shopsFab.className).toContain('sm:right-6');
      expect(shopsFab.className).toContain('lg:right-10');
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

    it('keeps user question and live AI result immediately visible in the open scroll container on form submit', async () => {
      mockInvoke.mockResolvedValue({
        data: {
          replyText: 'Annapurna Mess has Puran Poli Special today at ₹60.',
          detectedLanguage: 'en',
          mode: 'gemini',
          recommendations: [
            {
              entityType: 'mess',
              id: 'mess-1',
              slug: 'annapurna-mess',
              title: 'Annapurna Mess',
              highlightBadge: '₹60 Thali',
              reason: 'Today special Puran Poli',
              area: 'Bus Stand Road',
            },
          ],
          followUpSuggestions: ['Next bus departing soon'],
        },
        error: null,
      });

      render(
        <MemoryRouter initialEntries={['/muktainagar']}>
          <TownAssistantDrawer />
        </MemoryRouter>,
      );

      await act(async () => {
        fireEvent.click(screen.getByTestId('town-assistant-fab'));
      });

      const inputEl = screen.getByRole('textbox', { name: 'Ask a question' });
      await act(async () => {
        fireEvent.change(inputEl, { target: { value: 'Best cheap meal today?' } });
      });

      const form = inputEl.closest('form')!;
      await act(async () => {
        fireEvent.submit(form);
      });

      const scrollContainer = screen.getByTestId('assistant-messages-scroll');
      expect(scrollContainer).toHaveClass('min-h-0', 'flex-1', 'overflow-y-auto');
      expect(screen.getByText('Best cheap meal today?')).toBeVisible();

      await waitFor(() => {
        expect(screen.getByText('AI Powered')).toBeVisible();
        expect(
          screen.getByText('Annapurna Mess has Puran Poli Special today at ₹60.'),
        ).toBeVisible();
        expect(screen.getByText('Best cheap meal today?')).toBeVisible();
      });
    });

    it('navigates to /schools/:slug, /news with source link, and /services with tel action from drawer cards', async () => {
      mockInvoke.mockResolvedValue({
        data: {
          replyText: 'Found town updates, alerts, and institute details.',
          detectedLanguage: 'en',
          mode: 'gemini',
          recommendations: [
            {
              entityType: 'school',
              id: 'sch-1',
              slug: 'indira-college-parandwadi',
              title: 'Indira College',
              highlightBadge: 'Admissions Open',
              reason: 'SPPU · B.E. seats open',
              phone: '02114280200',
            },
            {
              entityType: 'news',
              id: 'news-1',
              title: 'Highway Underpass Approved',
              highlightBadge: 'Civic',
              reason: 'NHAI clears work near Somatane Phata.',
              externalUrl: 'https://lokmat.com/news-1',
            },
            {
              entityType: 'service',
              id: 'srv-1',
              title: 'MSEDCL Helpline',
              highlightBadge: '🚨 HIGH Alert',
              reason: 'Feeder maintenance completed.',
              phone: '1912',
              priority: 'high',
            },
          ],
          followUpSuggestions: [],
        },
        error: null,
      });

      render(
        <MemoryRouter initialEntries={['/maval']}>
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

      const newsPrompt = screen.getByRole('button', { name: "Today's local news" });
      await act(async () => {
        fireEvent.click(newsPrompt);
      });

      await waitFor(() => {
        expect(screen.getByText('Indira College')).toBeInTheDocument();
        expect(screen.getByText('Highway Underpass Approved')).toBeInTheDocument();
        expect(screen.getByText('MSEDCL Helpline')).toBeInTheDocument();
      });

      // Quick tel & source links rendered cleanly beside buttons
      expect(screen.getByRole('link', { name: 'Call MSEDCL Helpline' })).toHaveAttribute('href', 'tel:1912');
      expect(screen.getByRole('link', { name: 'Read source for Highway Underpass Approved' })).toHaveAttribute(
        'href',
        'https://lokmat.com/news-1',
      );

      // School card deep-links to /:citySlug/schools/:slug
      await act(async () => {
        fireEvent.click(screen.getByText('Indira College').closest('button')!);
      });
      await waitFor(() => {
        expect(screen.getByTestId('current-path')).toHaveTextContent(
          '/muktainagar/schools/indira-college-parandwadi',
        );
      });

      // Re-open and click news -> navigates to /:citySlug/news
      await act(async () => {
        fireEvent.click(screen.getByTestId('town-assistant-fab'));
      });
      await act(async () => {
        fireEvent.click(screen.getByText('Highway Underpass Approved').closest('button')!);
      });
      await waitFor(() => {
        expect(screen.getByTestId('current-path')).toHaveTextContent('/muktainagar/news');
      });

      // Re-open and click service -> navigates to /:citySlug/services
      await act(async () => {
        fireEvent.click(screen.getByTestId('town-assistant-fab'));
      });
      await act(async () => {
        fireEvent.click(screen.getByText('MSEDCL Helpline').closest('button')!);
      });
      await waitFor(() => {
        expect(screen.getByTestId('current-path')).toHaveTextContent('/muktainagar/services');
      });
    });

    it('routes Hotel/Restaurant and PG cards to /mess/:slug and /pg/:slug even if backend returned entityType shop', async () => {
      mockUseCity.mockReturnValue({
        currentCity: {
          id: '11111111-1111-4111-8111-111111111111',
          slug: 'maval',
          name: 'Maval',
          name_mr: 'मावळ',
        },
        currentVillage: null,
      });

      mockInvoke.mockResolvedValue({
        data: {
          replyText: 'Hotel Visawa serves family dining in Parandwadi.',
          detectedLanguage: 'en',
          mode: 'gemini',
          recommendations: [
            {
              entityType: 'shop',
              id: 'visawa-1',
              slug: 'hotel-visawa-family-restaurant-parandwadi',
              title: 'Hotel Visawa Family Restaurant',
              highlightBadge: 'Restaurant',
              reason: 'Regular Menu: Misal Pav (₹80), Veg Thali (₹120)',
              area: 'Parandwadi',
            },
            {
              entityType: 'shop',
              id: 'pg-2',
              slug: 'saikrupa-girls-pg-parandwadi',
              title: 'Saikrupa Girls PG',
              highlightBadge: 'Girls PG',
              reason: '4 beds vacant',
              area: 'Parandwadi',
            },
          ],
          followUpSuggestions: [],
        },
        error: null,
      });

      render(
        <MemoryRouter initialEntries={['/maval']}>
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

      const inputEl = screen.getByRole('textbox', { name: 'Ask a question' });
      await act(async () => {
        fireEvent.change(inputEl, { target: { value: 'Hotel Visawa menu and PG' } });
      });
      await act(async () => {
        fireEvent.submit(inputEl.closest('form')!);
      });

      await waitFor(() => {
        expect(screen.getByText('Hotel Visawa Family Restaurant')).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByText('Hotel Visawa Family Restaurant').closest('button')!);
      });

      await waitFor(() => {
        expect(screen.getByTestId('current-path')).toHaveTextContent(
          '/maval/mess/hotel-visawa-family-restaurant-parandwadi',
        );
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('town-assistant-fab'));
      });
      await act(async () => {
        fireEvent.click(screen.getByText('Saikrupa Girls PG').closest('button')!);
      });

      await waitFor(() => {
        expect(screen.getByTestId('current-path')).toHaveTextContent(
          '/maval/pg/saikrupa-girls-pg-parandwadi',
        );
      });
    });
  });
});
