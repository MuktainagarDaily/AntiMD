import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nProvider } from '@/i18n';
import BusTimetable from '@/pages/BusTimetable';
import PG from '@/pages/PG';
import Mess from '@/pages/Mess';
import EssentialServices from '@/pages/EssentialServices';
import SectionComingSoon from '@/pages/SectionComingSoon';
import SavedShops from '@/pages/SavedShops';
import MyShop from '@/pages/MyShop';
import AdminOverview from '@/pages/admin/Overview';
import { UserMenuDrawer } from '@/components/UserMenuDrawer';
import { LocationMapPicker } from '@/components/shared/LocationMapPicker';
import { supabase } from '@/integrations/supabase/client';
import { getGuestBookmarks } from '@/lib/guestBookmarks';
import { CompactShopCard } from '@/components/home/CompactShopCard';
import { PGOwnerHub } from '@/components/myshop/PGOwnerHub';
import { AdminFab } from '@/components/admin/_shared/AdminFab';
import { PhotoSlider } from '@/components/shared/PhotoSlider';
import { OfflineOverlay } from '@/components/shared/OfflineOverlay';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Plus } from 'lucide-react';

const {
  mockOfflineState,
  mockAuthState,
  mockCityContext,
} = vi.hoisted(() => ({
  mockOfflineState: { online: true },
  mockAuthState: {
    user: null as { id: string; email?: string } | null,
    isAdmin: false,
    isShopkeeper: false,
    loading: false,
    signOut: vi.fn(),
  },
  mockCityContext: {
    currentCity: {
      id: '644b68eb-472c-40d3-9f83-c7d26e121498',
      slug: 'muktainagar',
      name: 'Muktainagar',
      name_mr: 'मुक्ताईनगर',
      district: 'Jalgaon',
      state: 'Maharashtra',
      tagline: 'Local Portal',
      tagline_mr: 'स्थानिक पोर्टल',
      is_active: true,
    },
    currentVillage: null,
    allCities: [
      {
        id: '644b68eb-472c-40d3-9f83-c7d26e121498',
        slug: 'muktainagar',
        name: 'Muktainagar',
        name_mr: 'मुक्ताईनगर',
        district: 'Jalgaon',
        state: 'Maharashtra',
        is_active: true,
      },
    ],
    townName: 'Muktainagar',
    townBrand: 'ApnaTown',
    getPageTitle: (p: string) => `${p} · ApnaTown`,
    setCityBySlug: vi.fn(),
    setVillageBySlug: vi.fn(),
  },
}));

function makeSupabaseChain(data: any[] = [], count = 0): any {
  const result = { data, count, error: null };
  const chain: any = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    neq: vi.fn(() => chain),
    in: vi.fn(() => chain),
    or: vi.fn(() => chain),
    order: vi.fn(() => chain),
    gte: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  };
  return chain;
}

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    from: vi.fn(() => makeSupabaseChain([])),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
      unsubscribe: vi.fn(),
    })),
    removeChannel: vi.fn(),
  },
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockAuthState,
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/hooks/useRealtime', () => ({
  useRealtimeChannel: vi.fn(),
  useRealtimeRow: vi.fn(),
}));

vi.mock('@/lib/guestBookmarks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/guestBookmarks')>();
  return {
    ...actual,
    getGuestBookmarks: vi.fn(() => []),
  };
});

vi.mock('@/hooks/useCity', () => ({
  useCity: () => mockCityContext,
  useOptionalCity: () => mockCityContext,
}));

vi.mock('@/hooks/useOnlineStatus', () => ({
  useOnlineStatus: () => mockOfflineState.online,
}));

vi.mock('@/hooks/useTranslationsCache', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/useTranslationsCache')>();
  return {
    ...actual,
    useLocalizedShop: (shop: any) => shop,
    useLocalizedCategories: (cats: any[]) => cats,
  };
});

vi.mock('@/lib/reviewsApi', () => ({
  useShopRating: () => ({ data: null }),
}));

vi.mock('@/lib/engagement', () => ({
  logShopEngagement: vi.fn(),
}));

vi.mock('@/lib/living/livingService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/living/livingService')>();
  return {
    ...actual,
    fetchPGsForCity: vi.fn().mockResolvedValue([]),
    fetchMessesForCity: vi.fn().mockResolvedValue([]),
  };
});

vi.mock('@/lib/services/authorityService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/services/authorityService')>();
  return {
    ...actual,
    fetchDepartments: vi.fn().mockResolvedValue([]),
    fetchOrganizationsForCity: vi.fn().mockResolvedValue([]),
    fetchAnnouncementsForCity: vi.fn().mockResolvedValue([]),
  };
});

function renderWithAppProviders(ui: React.ReactElement, initialEntries: string[] = ['/muktainagar']) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  return render(
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={initialEntries}>
          <I18nProvider>{ui}</I18nProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </HelmetProvider>,
  );
}

function LocationDisplay() {
  const loc = useLocation();
  return <div data-testid="current-route">{loc.pathname}{loc.search}</div>;
}

describe('Responsive UI & Wiring Regressions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOfflineState.online = true;
    mockAuthState.user = null;
    mockAuthState.isAdmin = false;
    mockAuthState.isShopkeeper = false;
    mockAuthState.loading = false;
    vi.mocked(getGuestBookmarks).mockReturnValue([]);
    (supabase.from as ReturnType<typeof vi.fn>).mockImplementation(() => makeSupabaseChain([]));
  });

  it('keeps BusTimetable header back chevron and bus title in non-overlapping flex slots', async () => {
    renderWithAppProviders(<BusTimetable />, ['/muktainagar/bus-timetable']);

    const backBtn = await screen.findByRole('button', { name: /back|मागे/i });
    expect(backBtn.className).toContain('shrink-0');

    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading.className).toContain('truncate');

    // Title block and back button live in a flex-1 min-w-0 row so Bus logo never collides with <ChevronLeft>
    const titleGroup = heading.closest('.min-w-0')?.parentElement;
    expect(titleGroup?.className).toContain('min-w-0');
    const busIcon = titleGroup?.querySelector('svg');
    expect(busIcon).not.toBeNull();
    expect(busIcon?.getAttribute('class') ?? '').toContain('shrink-0');

    const leftContainer = backBtn.parentElement;
    expect(leftContainer?.className).toContain('flex-1');
    expect(leftContainer?.className).toContain('min-w-0');
    expect(leftContainer).toContainElement(titleGroup as HTMLElement);
  });

  it('routes AdminOverview "Manage Institutes" quick action to /admin/sections/schools', async () => {
    renderWithAppProviders(
      <Routes>
        <Route
          path="*"
          element={
            <>
              <LocationDisplay />
              <AdminOverview />
            </>
          }
        />
      </Routes>,
      ['/admin/overview'],
    );

    const manageInstitutesBtn = await screen.findByRole('button', { name: /Manage Institutes/i });
    fireEvent.click(manageInstitutesBtn);

    await waitFor(() => {
      expect(screen.getByTestId('current-route')).toHaveTextContent('/admin/sections/schools');
    });
  });

  it('passes valid photos/onChange/onUploadFile props from PGOwnerHub to MultiImageCropPicker', async () => {
    const pgShop = {
      id: 'pg-shop-1',
      name: 'Shree Boys PG',
      name_mr: 'श्री बॉईज पीजी',
      slug: 'shree-boys-pg',
      area: 'College Road',
      phone: '9876543210',
      is_open: true,
      photos: [
        'https://cdn.example.com/pg-cover.webp',
        'https://cdn.example.com/pg-room-1.webp',
      ],
      amenities: ['WiFi'],
      updated_at: '2026-11-11T10:00:00Z',
    };

    renderWithAppProviders(<PGOwnerHub shop={pgShop} />);

    const amenitiesPhotosTab = await screen.findByRole('button', {
      name: /Amenities & Photos|सुविधा व फोटो/i,
    });
    fireEvent.click(amenitiesPhotosTab);

    // If MultiImageCropPicker received matching props (`photos`, `onChange`, `onUploadFile`, `maxPhotos`),
    // it renders the primary Cover image plus Gallery image slot without crashing.
    const coverImg = await screen.findByAltText('Cover');
    expect(coverImg).toHaveAttribute('src', 'https://cdn.example.com/pg-cover.webp');
    const galleryImg = screen.getByAltText('Gallery 1');
    expect(galleryImg).toHaveAttribute('src', 'https://cdn.example.com/pg-room-1.webp');
  });

  it('CompactShopCard avoids nested interactive <button> > <a> elements', () => {
    const { container } = renderWithAppProviders(
      <CompactShopCard
        shop={{
          id: 'shop-1',
          slug: 'patil-kirana',
          name: 'Patil Kirana',
          area: 'Main Road',
          phone: '9876543210',
          whatsapp: '9876543210',
          is_active: true,
        }}
      />,
    );

    expect(container.querySelector('button a')).toBeNull();
    expect(container.querySelector('a button')).toBeNull();
    expect(container.querySelector('[role="button"]')).not.toBeNull();
    expect(screen.getByRole('link', { name: /Call/i })).toHaveAttribute('href', 'tel:9876543210');
    expect(screen.getByRole('link', { name: /WhatsApp/i })).toHaveAttribute(
      'href',
      'https://wa.me/919876543210',
    );
  });

  it('AdminFab anchors at bottom without vertical-centering distortion', () => {
    render(<AdminFab onClick={vi.fn()} icon={<Plus />} label="Add Item" />);
    const fab = screen.getByRole('button', { name: 'Add Item' });
    expect(fab.className).toContain('h-12');
    expect(fab.className).toContain('inline-flex');
    expect(fab.className).toContain('bottom-5');
    expect(fab.className).not.toContain('translate-y');
  });

  it('DialogContent applies responsive viewport width and elevated z-20 close button', () => {
    render(
      <Dialog open onOpenChange={() => {}}>
        <DialogContent>
          <DialogTitle>Test Modal</DialogTitle>
          <DialogDescription className="sr-only">Dialog regression test</DialogDescription>
        </DialogContent>
      </Dialog>,
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toContain('w-[calc(100vw-1.5rem)]');
    const closeBtn = screen.getByRole('button', { name: 'Close' });
    expect(closeBtn.className).toContain('z-20');
  });

  it('PhotoSlider lifts dots above bottom overlays and OfflineOverlay uses valid sm: breakpoint', () => {
    const { rerender, container } = render(
      <PhotoSlider
        photos={['/a.jpg', '/b.jpg']}
        alt="Shop Gallery"
        showDots
        overlayBottomLeft={<span>Open Now</span>}
      />,
    );

    const dotBtn = screen.getByLabelText('Jump to photo 1');
    expect(dotBtn.parentElement?.className).toContain('bottom-10');

    rerender(<PhotoSlider photos={['/a.jpg', '/b.jpg']} alt="Shop Gallery" showDots />);
    expect(screen.getByLabelText('Jump to photo 1').parentElement?.className).toContain('bottom-2');

    mockOfflineState.online = false;
    renderWithAppProviders(<OfflineOverlay />);
    const retryBtn = screen.getByRole('button', { name: /Retry|पुन्हा/i });
    const retryLabel = retryBtn.querySelector('span');
    expect(retryLabel?.className).toContain('sm:inline');
    expect(retryLabel?.className).not.toContain('xs:');
    expect(container).toBeTruthy();
  });

  it('uses consistent primary blue headers across PG, EssentialServices, Mess, and SectionComingSoon', async () => {
    const pages: Array<{ label: string; ui: React.ReactElement; route: string }> = [
      { label: 'PG', ui: <PG />, route: '/muktainagar/pg' },
      { label: 'Mess', ui: <Mess />, route: '/muktainagar/mess' },
      { label: 'EssentialServices', ui: <EssentialServices />, route: '/muktainagar/services' },
      {
        label: 'SectionComingSoon',
        ui: (
          <Routes>
            <Route path="/:citySlug/sections/:key" element={<SectionComingSoon />} />
          </Routes>
        ),
        route: '/muktainagar/sections/banks',
      },
    ];

    for (const page of pages) {
      const { container, unmount } = renderWithAppProviders(page.ui, [page.route]);
      const header = container.querySelector('header');
      expect(header, `${page.label} should render <header>`).not.toBeNull();
      expect(header?.className, `${page.label} header should use bg-primary`).toContain('bg-primary');
      expect(header?.className, `${page.label} header should use text-primary-foreground`).toContain(
        'text-primary-foreground',
      );
      expect(header?.className, `${page.label} header should not be white`).not.toContain('bg-background');

      if (page.label === 'EssentialServices') {
        const locationBtn = await screen.findByRole('button', { name: 'Change location' });
        expect(locationBtn.className).toContain('bg-primary-foreground/15');
        expect(locationBtn.className).toContain('text-primary-foreground');
        expect(locationBtn.querySelector('span')?.className).toContain('min-w-0');
      }

      unmount();
    }
  });

  it('SavedShops renders header title "Saved Business" and desktop-responsive grid & nav', async () => {
    vi.mocked(getGuestBookmarks).mockReturnValue(['shop-1', 'shop-2']);
    (supabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      if (table === 'shops') {
        return makeSupabaseChain([
          {
            id: 'shop-1',
            slug: 'patil-kirana',
            name: 'Patil Kirana',
            area: 'Main Road',
            phone: '9876543210',
            is_active: true,
            is_open: true,
          },
          {
            id: 'shop-2',
            slug: 'sai-mess',
            name: 'Sai Mess',
            area: 'College Road',
            phone: '9876543211',
            is_active: true,
            is_open: true,
            mess_profiles: [{ shop_id: 'shop-2' }],
          },
        ]);
      }
      return makeSupabaseChain([]);
    });

    const { container } = renderWithAppProviders(<SavedShops />, ['/saved-shops']);

    const heading = await screen.findByRole('heading', { name: 'Saved Business' });
    expect(heading).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Saved Shops' })).not.toBeInTheDocument();

    expect(screen.getByRole('navigation', { name: 'Desktop Navigation' })).toBeInTheDocument();

    await screen.findByText('Patil Kirana');
    const grid = container.querySelector('.md\\:grid-cols-2.lg\\:grid-cols-3');
    expect(grid).not.toBeNull();
    expect(container.querySelector('main')?.className).toContain('xl:max-w-7xl');
  });

  it('MyShop renders desktop-responsive header, DesktopNav, and 12-column workspace layout', async () => {
    mockAuthState.user = { id: 'owner-1', email: 'owner@test.com' };
    mockAuthState.isShopkeeper = true;

    (supabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      if (table === 'shop_owners') {
        return makeSupabaseChain([
          {
            shop_id: 'shop-1',
            shops: {
              id: 'shop-1',
              slug: 'patil-kirana',
              name: 'Patil Kirana',
              description: 'Fresh groceries',
              area: 'Main Road',
              phone: '9876543210',
              whatsapp: '9876543210',
              is_open: true,
              is_active: true,
              shop_categories: [],
              mess_profiles: [],
              pg_profiles: [],
            },
          },
        ]);
      }
      return makeSupabaseChain([]);
    });

    const { container } = renderWithAppProviders(<MyShop />, ['/my-shop']);

    await screen.findByDisplayValue('Patil Kirana');
    const header = container.querySelector('header');
    expect(header?.querySelector('.xl\\:max-w-7xl')).not.toBeNull();
    expect(screen.getByRole('navigation', { name: 'Desktop Navigation' })).toBeInTheDocument();
    expect(container.querySelector('.lg\\:grid.lg\\:grid-cols-12')).not.toBeNull();
    expect(container.querySelector('.lg\\:col-span-8')).not.toBeNull();
    expect(container.querySelector('aside.lg\\:col-span-4')).not.toBeNull();
  });

  it('UserMenuDrawer Settings renders Switch controls without nested <button> elements', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      renderWithAppProviders(<UserMenuDrawer />);

      fireEvent.click(screen.getByRole('button', { name: /open user menu/i }));
      const settingsBtn = await screen.findByRole('button', { name: /settings|सेटिंग्ज/i });
      fireEvent.click(settingsBtn);

      await screen.findByRole('switch', { checked: false });
      const switches = screen.getAllByRole('switch');
      expect(switches.length).toBeGreaterThanOrEqual(2);
      expect(document.querySelector('button button')).toBeNull();

      const domNestingWarnings = errorSpy.mock.calls.filter((args) =>
        args.some((a) => typeof a === 'string' && a.includes('validateDOMNesting')),
      );
      expect(domNestingWarnings).toHaveLength(0);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('MyShop + LocationMapPicker do not hit Maximum update depth when coordinates already exist', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const originalL = (window as any).L;
    const originalFetch = globalThis.fetch;

    const mockMarker = {
      addTo: vi.fn(),
      on: vi.fn(),
      setLatLng: vi.fn(),
      getLatLng: vi.fn(() => ({ lat: 21.0758, lng: 75.9817 })),
    };
    mockMarker.addTo.mockReturnValue(mockMarker);

    (window as any).L = {
      divIcon: vi.fn(() => ({})),
      map: vi.fn(() => ({ panTo: vi.fn(), on: vi.fn(), remove: vi.fn() })),
      tileLayer: vi.fn(() => ({ addTo: vi.fn() })),
      control: { zoom: vi.fn(() => ({ addTo: vi.fn() })) },
      marker: vi.fn(() => mockMarker),
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ address: { road: 'Station Road', suburb: 'Main Road' } }),
    }) as any;

    try {
      mockAuthState.user = { id: 'owner-1', email: 'owner@test.com' };
      mockAuthState.isShopkeeper = true;

      (supabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'shop_owners') {
          return makeSupabaseChain([
            {
              shop_id: 'shop-coord-1',
              shops: {
                id: 'shop-coord-1',
                slug: 'coord-shop',
                name: 'Coord Shop',
                description: 'Shop with coordinates',
                address: 'Station Road',
                area: 'Main Road',
                phone: '9876543210',
                whatsapp: '9876543210',
                latitude: 21.0758,
                longitude: 75.9817,
                is_open: true,
                is_active: true,
                shop_categories: [],
                mess_profiles: [],
                pg_profiles: [],
              },
            },
          ]);
        }
        return makeSupabaseChain([]);
      });

      renderWithAppProviders(<MyShop />, ['/my-shop']);
      const nameInput = await screen.findByDisplayValue('Coord Shop');
      fireEvent.change(nameInput, { target: { value: 'Coord Shop Updated' } });

      // Also verify LocationMapPicker directly with fresh inline { lat, lng } objects on every parent state update
      const geocodeSpy = vi.fn();
      function ParentHarness() {
        const [tick, setTick] = React.useState(0);
        return (
          <div>
            <span data-testid="tick">{tick}</span>
            <LocationMapPicker
              value={{ lat: 21.0758, lng: 75.9817 }}
              onChange={vi.fn()}
              onGeocode={() => {
                geocodeSpy();
                setTick((t) => t + 1);
              }}
            />
          </div>
        );
      }

      render(<ParentHarness />);
      await waitFor(() => expect(geocodeSpy.mock.calls.length).toBeLessThanOrEqual(1));

      const maxDepthErrors = errorSpy.mock.calls.filter((args) =>
        args.some((a) => typeof a === 'string' && a.includes('Maximum update depth exceeded')),
      );
      expect(maxDepthErrors).toHaveLength(0);
    } finally {
      (window as any).L = originalL;
      globalThis.fetch = originalFetch;
      errorSpy.mockRestore();
    }
  });
});
