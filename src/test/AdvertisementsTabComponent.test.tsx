import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '@/i18n';
import { AdvertisementsTab } from '@/components/admin/AdvertisementsTab';
import { BannerSlot } from '@/components/banners/BannerSlot';
import { Banner, BannerPlacement } from '@/lib/banners/types';

const {
  mockUseAllBanners,
  mockUseBannersForPlacement,
  mockDuplicateBanner,
  mockResetBannerMetrics,
  mockReorderBanners,
} = vi.hoisted(() => ({
  mockUseAllBanners: vi.fn<() => Banner[]>(),
  mockUseBannersForPlacement: vi.fn<(p: BannerPlacement) => Banner[]>(),
  mockDuplicateBanner: vi.fn(),
  mockResetBannerMetrics: vi.fn(),
  mockReorderBanners: vi.fn(),
}));

const defaultBanners: Banner[] = [
  {
    id: 'b-1',
    title: 'Shree Krishna Jewellers Offer',
    image_url: 'https://example.com/banner1.webp',
    target_url: 'https://example.com/promo',
    placement: 'homepage_inline',
    is_active: true,
    popup_delay_seconds: 0,
    close_enable_seconds: 0,
    start_date: '2026-06-01',
    end_date: '2026-12-31',
    view_count: 1200,
    click_count: 60,
    sort_order: 1,
    target_level: 'city',
    target_district_id: 'dist-jalgaon',
    target_city_id: 'city-muktai',
    created_at: '2026-06-01T10:00:00Z',
    updated_at: '2026-06-01T10:00:00Z',
  },
  {
    id: 'b-2',
    title: 'Grand Diwali Flash Sale',
    image_url: 'https://example.com/banner2.webp',
    target_url: 'https://wa.me/919822001100',
    placement: 'popup',
    is_active: false,
    popup_delay_seconds: 2,
    close_enable_seconds: 5,
    start_date: null,
    end_date: null,
    view_count: 500,
    click_count: 20,
    sort_order: 2,
    target_level: 'global',
    created_at: '2026-06-02T10:00:00Z',
    updated_at: '2026-06-02T10:00:00Z',
  },
];

vi.mock('@/hooks/useBanners', () => ({
  useAllBanners: () => mockUseAllBanners(),
  useBannersForPlacement: (p: BannerPlacement) => mockUseBannersForPlacement(p),
}));

vi.mock('@/hooks/useCity', () => ({
  useOptionalCity: () => ({
    currentCity: {
      id: 'city-muktai',
      name: 'Muktainagar',
      name_mr: 'मुक्ताईनगर',
      district_id: 'dist-jalgaon',
      district: { id: 'dist-jalgaon', name: 'Jalgaon' },
    },
    allCities: [
      {
        id: 'city-muktai',
        name: 'Muktainagar',
        name_mr: 'मुक्ताईनगर',
        district_id: 'dist-jalgaon',
        district: { id: 'dist-jalgaon', name: 'Jalgaon' },
      },
      {
        id: 'city-bhusawal',
        name: 'Bhusawal',
        name_mr: 'भुसावळ',
        district_id: 'dist-jalgaon',
        district: { id: 'dist-jalgaon', name: 'Jalgaon' },
      },
    ],
  }),
}));

vi.mock('@/lib/banners/store', () => ({
  removeBanner: vi.fn(),
  toggleActive: vi.fn(),
  reorderBanners: mockReorderBanners,
  setAllBannersActive: vi.fn(),
  duplicateBanner: mockDuplicateBanner,
  resetBannerMetrics: mockResetBannerMetrics,
  trackView: vi.fn(),
  trackClick: vi.fn(),
}));

describe('AdvertisementsTab Admin Component & BannerSlot Delivery', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    mockUseAllBanners.mockReturnValue(defaultBanners);
    mockUseBannersForPlacement.mockReturnValue([]);
  });

  const renderTab = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <AdvertisementsTab />
      </QueryClientProvider>,
    );

  it('renders the Advertisements header and New banner action', () => {
    renderTab();
    expect(screen.getByRole('heading', { name: /Advertisements/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /New banner/i })).toBeDefined();
  });

  it('renders accurate KPI metrics (Total, Active, Views, Clicks, CTR)', () => {
    renderTab();
    expect(screen.getByText('Total')).toBeDefined();
    expect(screen.getByText('Active')).toBeDefined();
    expect(screen.getByText('1,700')).toBeDefined();
    expect(screen.getByText('80 · 4.7%')).toBeDefined();
  });

  it('renders real campaign status badges (Live, Paused, Scheduled, Expired), reach tags, and invalid URL alert', () => {
    mockUseAllBanners.mockReturnValue([
      ...defaultBanners,
      {
        id: 'b-3',
        title: 'Expired Holi Banner',
        image_url: 'https://example.com/holi.webp',
        target_url: 'https:// novelbin.com',
        placement: 'homepage_inline',
        is_active: true,
        popup_delay_seconds: 0,
        close_enable_seconds: 0,
        start_date: '2026-01-01',
        end_date: '2026-02-01',
        view_count: 100,
        click_count: 5,
        sort_order: 2,
        target_level: 'district',
        target_district_id: 'dist-jalgaon',
        target_city_id: null,
        created_at: '',
        updated_at: '',
      },
      {
        id: 'b-4',
        title: 'Future Sankranti Campaign',
        image_url: 'https://example.com/sankranti.webp',
        target_url: 'https://example.com/sankranti',
        placement: 'shops_inline',
        is_active: true,
        popup_delay_seconds: 0,
        close_enable_seconds: 0,
        start_date: '2099-01-01',
        end_date: '2099-01-31',
        view_count: 0,
        click_count: 0,
        sort_order: 1,
        target_level: 'global',
        created_at: '',
        updated_at: '',
      },
    ]);

    renderTab();

    expect(screen.getByText('Shree Krishna Jewellers Offer')).toBeDefined();
    expect(screen.getByText('Grand Diwali Flash Sale')).toBeDefined();
    expect(screen.getByText('Expired Holi Banner')).toBeDefined();
    expect(screen.getByText('Future Sankranti Campaign')).toBeDefined();

    // Real campaign statuses in row badges + filter chips
    expect(screen.getAllByText('Live').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('Paused').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('Expired').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('Scheduled').length).toBeGreaterThanOrEqual(2);

    // Geographic reach tags
    expect(screen.getByText('Muktainagar')).toBeDefined();
    expect(screen.getByText('Jalgaon Dist.')).toBeDefined();
    expect(screen.getAllByText('🌐 Global').length).toBeGreaterThanOrEqual(2);

    // Invalid URL inline diagnostic
    expect(screen.getByText(/Invalid URL — edit to fix/i)).toBeDefined();
  });

  it('filters by search and target reach and locks reordering while filtered', () => {
    const twoInline: Banner[] = [
      defaultBanners[0],
      {
        ...defaultBanners[0],
        id: 'b-1b',
        title: 'Bhusawal Gold Expo',
        target_city_id: 'city-bhusawal',
        sort_order: 2,
      },
    ];
    mockUseAllBanners.mockReturnValue(twoInline);

    renderTab();

    // Unfiltered: Move down on first row is enabled
    const moveDownButtonsBefore = screen.getAllByRole('button', { name: 'Move down' });
    expect(moveDownButtonsBefore[0]).not.toBeDisabled();

    // Filter via search box
    const searchInput = screen.getByLabelText('Search banners');
    fireEvent.change(searchInput, { target: { value: 'Bhusawal' } });

    expect(screen.queryByText('Shree Krishna Jewellers Offer')).toBeNull();
    expect(screen.getByText('Bhusawal Gold Expo')).toBeDefined();
    expect(screen.getByText(/Slot reordering is locked while filters or search are active/i)).toBeDefined();

    // Clear filters unlocks reordering and restores both rows
    fireEvent.click(screen.getByRole('button', { name: /Clear filters/i }));
    expect(screen.getByText('Shree Krishna Jewellers Offer')).toBeDefined();
    expect(screen.getAllByRole('button', { name: 'Move down' })[0]).not.toBeDisabled();

    // Filter by town dropdown
    const targetSelect = screen.getByLabelText('Filter by target reach');
    fireEvent.change(targetSelect, { target: { value: 'city:city-muktai' } });
    expect(screen.getByText('Shree Krishna Jewellers Offer')).toBeDefined();
    expect(screen.queryByText('Bhusawal Gold Expo')).toBeNull();
  });

  it('supports duplicating a banner and 2-tap metric reset', async () => {
    mockDuplicateBanner.mockResolvedValue({ ...defaultBanners[0], id: 'copy-1', is_active: false });
    mockResetBannerMetrics.mockResolvedValue(undefined);

    renderTab();

    const dupBtn = screen.getByRole('button', { name: /Duplicate Shree Krishna Jewellers Offer/i });
    fireEvent.click(dupBtn);
    await waitFor(() => {
      expect(mockDuplicateBanner).toHaveBeenCalledWith(defaultBanners[0]);
      expect(dupBtn).not.toBeDisabled();
    });

    // 2-tap reset stats on the first rendered banner row (Popup group renders before Homepage)
    const resetButtons = screen.getAllByRole('button', { name: /Reset stats/i });
    fireEvent.click(resetButtons[0]); // first tap arms
    fireEvent.click(screen.getByRole('button', { name: /Tap to reset/i })); // second tap confirms
    await waitFor(() => {
      expect(mockResetBannerMetrics).toHaveBeenCalledWith('b-2');
      expect(screen.getAllByRole('button', { name: /Reset stats/i })[0]).not.toBeDisabled();
    });
  });

  it('rotates multiple active banners in BannerSlot and deduplicates fallback slots on the same route', () => {
    const inlineAds: Banner[] = [
      defaultBanners[0],
      {
        ...defaultBanners[0],
        id: 'b-inline-2',
        title: 'Muktainagar Electronics Fair',
        image_url: 'https://example.com/banner2.webp',
        sort_order: 2,
      },
    ];

    mockUseBannersForPlacement.mockImplementation((p) => {
      if (p === 'homepage_inline') return inlineAds;
      return [];
    });

    render(
      <I18nProvider>
        <MemoryRouter initialEntries={['/muktainagar']}>
          <BannerSlot placement="homepage_inline" />
          <BannerSlot placement="home_bottom" fallback="homepage_inline" />
        </MemoryRouter>
      </I18nProvider>,
    );

    // Primary homepage_inline slot shows Banner #1 first, fallback home_bottom claims Banner #2
    expect(screen.getByAltText('Shree Krishna Jewellers Offer')).toBeDefined();
    expect(screen.getByAltText('Muktainagar Electronics Fair')).toBeDefined();

    // Clicking next arrow on primary slot switches to Banner #2 inside the carousel
    const nextBtn = screen.getByRole('button', { name: 'Next sponsored banner' });
    fireEvent.click(nextBtn);
    expect(screen.getAllByAltText('Muktainagar Electronics Fair').length).toBeGreaterThanOrEqual(2);
  });
});
