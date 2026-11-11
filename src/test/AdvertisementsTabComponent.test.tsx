import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AdvertisementsTab } from '@/components/admin/AdvertisementsTab';
import { Banner } from '@/lib/banners/types';

const mockBanners: Banner[] = [
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
    created_at: '2026-06-02T10:00:00Z',
    updated_at: '2026-06-02T10:00:00Z',
  },
];

vi.mock('@/hooks/useBanners', () => ({
  useAllBanners: () => mockBanners,
}));

vi.mock('@/lib/banners/store', () => ({
  removeBanner: vi.fn(),
  toggleActive: vi.fn(),
  reorderBanners: vi.fn(),
  setAllBannersActive: vi.fn(),
}));

describe('AdvertisementsTab Admin Component', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  it('renders the Advertisements header and New banner action', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <AdvertisementsTab />
      </QueryClientProvider>
    );

    expect(screen.getByRole('heading', { name: /Advertisements/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /New banner/i })).toBeDefined();
  });

  it('renders accurate KPI metrics (Total, Active, Views, Clicks, CTR)', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <AdvertisementsTab />
      </QueryClientProvider>
    );

    expect(screen.getByText('Total')).toBeDefined();
    expect(screen.getAllByText('Active').length).toBeGreaterThan(0);
    expect(screen.getByText('1,700')).toBeDefined();
    expect(screen.getByText('80 · 4.7%')).toBeDefined();
  });

  it('renders banner rows with title, badges, and target link', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <AdvertisementsTab />
      </QueryClientProvider>
    );

    expect(screen.getByText('Shree Krishna Jewellers Offer')).toBeDefined();
    expect(screen.getByText('Grand Diwali Flash Sale')).toBeDefined();
    expect(screen.getAllByText('Active').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Inactive').length).toBeGreaterThan(0);
  });
});
