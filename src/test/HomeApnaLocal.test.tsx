import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HelmetProvider } from 'react-helmet-async';
import { I18nProvider } from '@/i18n';
import { CityProvider } from '@/hooks/useCity';
import { AuthProvider } from '@/hooks/useAuth';
import Home from '@/pages/Home';

import { DEFAULT_CITIES } from '@/lib/geo/geoService';

// Mock Supabase client to return clean mock data per table
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    from: vi.fn((table: string) => {
      let mockData: any = [];
      if (table === 'geo_cities') {
        mockData = [
          {
            id: '644b68eb-472c-40d3-9f83-c7d26e121498',
            district_id: '603e0eb6-1cf5-424e-9f37-9d5824470f28',
            slug: 'muktainagar',
            name: 'Muktainagar',
            name_mr: 'मुक्ताईनगर',
            type: 'taluka',
            latitude: 21.0758,
            longitude: 75.9817,
            is_active: true,
            sort_order: 1,
          },
        ];
      } else if (table === 'categories') {
        mockData = [
          { id: 'cat-1', name: 'Grocery & Kirana', icon: 'ShoppingBag', is_active: true },
          { id: 'cat-2', name: 'Medical & Pharmacy', icon: 'PlusCircle', is_active: true },
        ];
      } else if (table === 'shops') {
        mockData = [
          {
            id: 'shop-1',
            name: 'Shree Ganesh General Stores',
            slug: 'shree-ganesh-stores',
            area: 'Station Road',
            phone: '9876543210',
            is_verified: true,
            is_active: true,
            created_at: new Date().toISOString(),
          },
        ];
      }

      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockData, error: null }),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        then: (resolve: any) => Promise.resolve({ data: mockData, error: null }).then(resolve),
      };
    }),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    })),
    removeChannel: vi.fn(),
  },
}));

function renderHome(initialRoute = '/muktainagar') {
  window.history.pushState({}, '', initialRoute);
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  return render(
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <CityProvider>
              <I18nProvider>
                <Home />
              </I18nProvider>
            </CityProvider>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </HelmetProvider>
  );
}

describe('Home Page ApnaTown Architecture', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders ApnaTown master brand and dynamic town badge', async () => {
    renderHome();

    // Check Master Brand
    const brandHeading = await screen.findByRole('heading', { level: 1, name: 'ApnaTown' });
    expect(brandHeading).toBeInTheDocument();

    // Check Town name badge
    expect(screen.getAllByText('Muktainagar').length).toBeGreaterThan(0);

    // Check Canonical Tagline
    expect(screen.getByText(/Your town\. Everything local\./i)).toBeInTheDocument();
  });

  it('renders the "Useful Today" (आजचे महत्त्वाचे) action pills', async () => {
    renderHome();

    // Header label
    expect(await screen.findByText(/Useful Today/i)).toBeInTheDocument();

    // The 4 action pills
    expect(screen.getByText("Today's Menu")).toBeInTheDocument();
    expect(screen.getAllByText("Bus Timetable").length).toBeGreaterThan(0);
    expect(screen.getByText("PG Availability")).toBeInTheDocument();
    expect(screen.getByText(/Open Now/i)).toBeInTheDocument();
  });

  it('renders the "Explore your locality" section with the 5 clean cards', async () => {
    renderHome();

    // Section title
    expect(await screen.findByText(/Explore your locality/i)).toBeInTheDocument();

    // 5 Department cards
    expect(screen.getAllByText('Shops').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Food & Mess').length).toBeGreaterThan(0);
    expect(screen.getAllByText('PG & Hostels').length).toBeGreaterThan(0);
    expect(screen.getByText('Bus & Transit')).toBeInTheDocument();
    expect(screen.getByText('Education')).toBeInTheDocument();
  });

  it('renders the Community Growth self-serve merchant banner', async () => {
    renderHome();

    expect(
      await screen.findByText(/Own a business in Muktainagar\? List it on ApnaTown for free/i)
    ).toBeInTheDocument();
    expect(screen.getAllByText(/Direct Call & WhatsApp — No Middlemen/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/List Your Business Free/i).length).toBeGreaterThan(0);
  });
});
