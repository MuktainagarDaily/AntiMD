import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { I18nProvider } from '@/i18n';
import { CityProvider } from '@/hooks/useCity';
import { AuthProvider } from '@/hooks/useAuth';
import ShopDetail from '@/pages/ShopDetail';

const MUKTAINAGAR_CITY_ID = '644b68eb-472c-40d3-9f83-c7d26e121498';

// Mock single isolated shop data
const mockSoloShop = {
  id: 'shop-solo-1',
  slug: 'unique-art-gallery',
  name: 'Unique Art Gallery',
  city_id: MUKTAINAGAR_CITY_ID,
  village_id: null,
  is_active: true,
  phone: '9876543210',
  shop_categories: [
    {
      category_id: 'cat-unique',
      categories: { id: 'cat-unique', name: 'Rare Antiques', is_active: true },
    },
  ],
};

// Mock shop with related competitors
const mockGroceryShop = {
  id: 'shop-grocery-1',
  slug: 'patil-kirana',
  name: 'Patil Kirana',
  city_id: MUKTAINAGAR_CITY_ID,
  village_id: 'v-kurha',
  is_active: true,
  phone: '9876543211',
  shop_categories: [
    {
      category_id: 'cat-grocery',
      categories: { id: 'cat-grocery', name: 'Grocery & Kirana', is_active: true },
    },
  ],
};

let currentShopToReturn: any = mockSoloShop;
let relatedRowsToReturn: any[] = [];

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    from: vi.fn((table: string) => {
      if (table === 'geo_cities') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: [
              {
                id: MUKTAINAGAR_CITY_ID,
                district_id: 'dist-1',
                slug: 'muktainagar',
                name: 'Muktainagar',
                is_active: true,
              },
            ],
            error: null,
          }),
        };
      }

      if (table === 'shops') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockImplementation(() =>
            Promise.resolve({ data: currentShopToReturn, error: null })
          ),
        };
      }

      if (table === 'shop_categories') {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          neq: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          limit: vi.fn().mockImplementation(() =>
            Promise.resolve({ data: relatedRowsToReturn, error: null })
          ),
        };
      }

      // Default fallback chain
      const chain: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        then: (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve),
      };
      return chain;
    }),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    })),
    removeChannel: vi.fn(),
  },
}));

function renderShopDetail(slug = 'unique-art-gallery') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  return render(
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[`/muktainagar/shop/${slug}`]}>
          <AuthProvider>
            <CityProvider>
              <I18nProvider>
                <Routes>
                  <Route path="/:citySlug/shop/:id" element={<ShopDetail />} />
                </Routes>
              </I18nProvider>
            </CityProvider>
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </HelmetProvider>
  );
}

describe('ShopDetail Related Shops Scoping and Empty-State', () => {
  it('hides the Related Shops section completely (#related-shops-title absent) when no competitors exist', async () => {
    currentShopToReturn = mockSoloShop;
    relatedRowsToReturn = []; // Empty competitors in this town/category

    renderShopDetail('unique-art-gallery');

    // Wait for the shop name to load
    await waitFor(() => {
      expect(screen.getAllByText('Unique Art Gallery').length).toBeGreaterThan(0);
    });

    // Verify #related-shops-title is completely hidden/absent from the DOM once queries settle
    await waitFor(() => {
      const relatedTitle = document.getElementById('related-shops-title');
      expect(relatedTitle).toBeNull();
    });
  });

  it('renders #related-shops-title when local competitors exist in the same city', async () => {
    currentShopToReturn = mockGroceryShop;
    relatedRowsToReturn = [
      {
        shop_id: 'shop-grocery-2',
        shops: {
          id: 'shop-grocery-2',
          slug: 'shree-ganesh-kirana',
          name: 'Shree Ganesh Kirana',
          city_id: MUKTAINAGAR_CITY_ID,
          village_id: 'v-kurha',
          is_active: true,
          phone: '9876543212',
          shop_categories: [],
        },
      },
    ];

    renderShopDetail('patil-kirana');

    // Wait for the shop name and related title to appear
    await waitFor(() => {
      expect(screen.getAllByText('Patil Kirana').length).toBeGreaterThan(0);
    });

    await waitFor(() => {
      const relatedTitle = document.getElementById('related-shops-title');
      expect(relatedTitle).not.toBeNull();
      expect(screen.getByText('Shree Ganesh Kirana')).toBeDefined();
    });
  });
});
