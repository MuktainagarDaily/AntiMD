import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HelmetProvider } from 'react-helmet-async';
import { I18nProvider } from '@/i18n';
import {
  handleTelLinkClick,
  OPEN_CALL_DIALOG_EVENT,
} from '@/lib/engagement';
import { CallNumberDialog } from '@/components/shared/CallNumberDialog';
import {
  DemoBadge,
  isParandwadiDemoListing,
  PARANDWADI_VILLAGE_ID,
} from '@/components/shared/DemoBadge';
import {
  EXAMINER_MODE_ENABLED,
  getEntityAutofillSample,
  getMessModalAutofillSample,
} from '@/lib/devHelpers';
import {
  SCHOOL_TYPE_OPTIONS,
  SCHOOL_MEDIUM_OPTIONS,
  MANAGEMENT_TYPE_OPTIONS,
  ADMISSION_STATUS_OPTIONS,
} from '@/lib/schools/schoolHelpers';
import { RequestListingModal } from '@/components/RequestListingModal';
import { UserMenuDrawer } from '@/components/UserMenuDrawer';
import Auth from '@/pages/Auth';

const {
  mockSignIn,
  mockSignUp,
  mockResetPassword,
  mockSignOut,
  mockAuthState,
  mockSupabaseFrom,
  mockSignInWithPassword,
} = vi.hoisted(() => ({
  mockSignIn: vi.fn(),
  mockSignUp: vi.fn(),
  mockResetPassword: vi.fn(),
  mockSignOut: vi.fn(),
  mockSignInWithPassword: vi.fn(),
  mockAuthState: {
    user: null as { id: string; email?: string; user_metadata?: { full_name?: string } } | null,
    isAdmin: false,
    isShopkeeper: false,
    loading: false,
  },
  mockSupabaseFrom: vi.fn(),
}));

const { mockCityContext } = vi.hoisted(() => ({
  mockCityContext: {
    currentCity: {
      id: '644b68eb-472c-40d3-9f83-c7d26e121498',
      slug: 'muktainagar',
      name: 'Muktainagar',
      name_mr: 'मुक्ताईनगर',
      district: 'Jalgaon',
      district_id: 'dist-jalgaon',
      state: 'Maharashtra',
      latitude: 21.0447,
      longitude: 75.7342,
      tagline: 'Local Portal',
      tagline_mr: 'स्थानिक पोर्टल',
      is_active: true,
    },
    currentVillage: null as { id: string; slug: string; name: string } | null,
    allCities: [],
    townName: 'Muktainagar',
    districtName: 'Jalgaon',
    stateName: 'Maharashtra',
    townBrand: 'ApnaLocal',
    getPageTitle: (p: string) => `${p} · ApnaLocal`,
    setCityBySlug: vi.fn(),
    setVillageBySlug: vi.fn(),
  },
}));

function makeChain(data: unknown = []) {
  const result = { data, error: null };
  const chain: Record<string, any> = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    neq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    then: (resolve: (v: unknown) => unknown, reject?: (err: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  };
  return chain;
}

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signInWithPassword: mockSignInWithPassword,
      signInWithOtp: vi.fn(),
    },
    from: mockSupabaseFrom,
  },
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: mockAuthState.user,
    session: null,
    loading: mockAuthState.loading,
    isAdmin: mockAuthState.isAdmin,
    isShopkeeper: mockAuthState.isShopkeeper,
    signIn: mockSignIn,
    signUp: mockSignUp,
    resetPassword: mockResetPassword,
    signOut: mockSignOut,
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/hooks/useCity', () => ({
  useCity: () => mockCityContext,
  useOptionalCity: () => mockCityContext,
  CityProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: 'light', setTheme: vi.fn() }),
}));

vi.mock('@/components/shared/LocationMapPicker', () => ({
  MUKTAINAGAR_CENTER: { lat: 21.0758, lng: 75.9817 },
  clearGeocodeCacheNear: vi.fn(),
  LocationMapPicker: () => <div data-testid="mock-map-picker">OSM Map</div>,
}));

function renderApp(ui: React.ReactElement, initialEntries: string[] = ['/muktainagar']) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
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

describe('Comprehensive Fixes & Examiner Mode Suite', () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    mockAuthState.user = null;
    mockAuthState.isAdmin = false;
    mockAuthState.isShopkeeper = false;
    mockCityContext.currentVillage = null;
    mockSignIn.mockResolvedValue({ error: null });
    mockSignUp.mockResolvedValue({ error: null });

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'categories') {
        return makeChain([
          { id: 'cat-kirana', name: 'Grocery & Kirana', name_mr: 'किराणा' },
          { id: 'cat-med', name: 'Medical & Pharmacy', name_mr: 'मेडिकल' },
        ]);
      }
      if (table === 'schools') {
        return makeChain([]);
      }
      return makeChain([]);
    });

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => {},
      }),
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: originalMatchMedia,
    });
  });

  describe('Desktop tel: Graceful Handler & CallNumberDialog', () => {
    it('prevents native tel: navigation on desktop, dispatches dialog event, and renders phone + WhatsApp action', async () => {
      const preventDefault = vi.fn();
      const onDial = vi.fn();

      renderApp(<CallNumberDialog />);

      let allowed = true;
      act(() => {
        allowed = handleTelLinkClick(
          { preventDefault },
          '9876543210',
          'Annapurna Mess',
          onDial,
        );
      });

      expect(onDial).toHaveBeenCalledTimes(1);
      expect(preventDefault).toHaveBeenCalledTimes(1);
      expect(allowed).toBe(false);

      expect(await screen.findByText('Annapurna Mess')).toBeInTheDocument();
      expect(screen.getByText('9876543210')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Copy Number/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /WhatsApp/i })).toHaveAttribute(
        'href',
        'https://wa.me/919876543210',
      );
    });

    it('omits WhatsApp link for landline numbers like Bus Stand STD 02024503300 and allows native dial on touch devices', async () => {
      const preventDefault = vi.fn();
      renderApp(<CallNumberDialog />);

      act(() => {
        window.dispatchEvent(
          new CustomEvent(OPEN_CALL_DIALOG_EVENT, {
            detail: { phone: '02024503300', label: 'Maval Bus Stand' },
          }),
        );
      });

      expect(await screen.findByText('02024503300')).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /WhatsApp/i })).not.toBeInTheDocument();

      // Switch to mobile coarse pointer
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: (query: string) => ({
          matches: query.includes('pointer: coarse'),
          media: query,
          onchange: null,
          addListener: () => {},
          removeListener: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => {},
        }),
      });

      const mobileAllowed = handleTelLinkClick({ preventDefault }, '9876543210', 'Mobile');
      expect(mobileAllowed).toBe(true);
      expect(preventDefault).not.toHaveBeenCalled();
    });
  });

  describe('Parandwadi Demo Badge Detection', () => {
    it('flags Parandwadi entities accurately without flagging Muktainagar listings', () => {
      expect(isParandwadiDemoListing({ village_id: PARANDWADI_VILLAGE_ID })).toBe(true);
      expect(isParandwadiDemoListing({ slug: 'hotel-visawa-parandwadi' })).toBe(true);
      expect(isParandwadiDemoListing({ area: 'Parandwadi Phata' })).toBe(true);
      expect(isParandwadiDemoListing({}, { id: PARANDWADI_VILLAGE_ID, slug: 'parandwadi' })).toBe(true);
      expect(isParandwadiDemoListing({ village_id: 'other-village', area: 'Station Road', slug: 'patil-kirana' })).toBe(false);

      renderApp(<DemoBadge />);
      expect(screen.getByText('Demo')).toBeInTheDocument();
    });
  });

  describe('Production Examiner Mode & Preserved Listing Intent', () => {
    it('keeps EXAMINER_MODE_ENABLED active, displays preserved guest notice, and signs in with 1-tap examiner account', async () => {
      expect(EXAMINER_MODE_ENABLED).toBe(true);

      function RouteEcho() {
        const loc = useLocation();
        return <div data-testid="post-auth-route">{loc.pathname}{loc.search}</div>;
      }

      renderApp(
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="*" element={<RouteEcho />} />
        </Routes>,
        ['/auth?mode=signin&next=%2Fmaval%2Fpg&list-shop=pg'],
      );

      expect(screen.getByText(/You need to sign in or sign up to list your business here/i)).toBeInTheDocument();

      // Visible on Sign Up tab too
      fireEvent.click(screen.getAllByRole('button', { name: 'Sign Up' })[0]);
      expect(screen.getByRole('button', { name: /Examiner Mode \(1-Tap Admin\)/i })).toBeInTheDocument();

      // Switch back to Sign In and click 1-Tap Examiner Mode
      fireEvent.click(screen.getAllByRole('button', { name: 'Sign In' })[0]);
      const examinerBtn = screen.getByRole('button', { name: /Examiner Mode \(1-Tap Admin\)/i });

      await act(async () => {
        fireEvent.click(examinerBtn);
      });

      expect(mockSignIn).toHaveBeenCalledWith('admin-test@apnalocal.in', 'Password@123');
      expect(await screen.findByTestId('post-auth-route')).toHaveTextContent('/maval/pg?list-shop=pg');
    });
  });

  describe('Entity-Specific Autofill & Wizard Auto-Selection', () => {
    it('provides valid domain-specific samples for shop, mess, pg, and school enums plus MessModal dietary samples', () => {
      const validTypes = new Set(SCHOOL_TYPE_OPTIONS.map((o) => o.value));
      const validMediums = new Set(SCHOOL_MEDIUM_OPTIONS.map((o) => o.value));
      const validMgmt = new Set(MANAGEMENT_TYPE_OPTIONS.map((o) => o.value));
      const validAdm = new Set(ADMISSION_STATUS_OPTIONS.map((o) => o.value));

      const schoolSample = getEntityAutofillSample('school');
      expect(schoolSample.school).toBeDefined();
      expect(validTypes.has(schoolSample.school!.schoolType)).toBe(true);
      expect(validMediums.has(schoolSample.school!.schoolMedium)).toBe(true);
      expect(validMgmt.has(schoolSample.school!.schoolManagement)).toBe(true);
      expect(validAdm.has(schoolSample.school!.schoolAdmissionStatus)).toBe(true);

      const hotelSample = getMessModalAutofillSample('hotel', 'pure_veg', 'Maval', 0);
      expect(hotelSample.name).toContain('Sai Prasad');
      expect(hotelSample.amenities).toContain('Pure Veg');

      const jainSample = getMessModalAutofillSample('mess', 'jain_available', 'Muktainagar', 0);
      expect(jainSample.name.toLowerCase()).toContain('jain');
    });

    it('auto-selects initialEntityType="pg" and populates PG fields when clicking Autofill', async () => {
      renderApp(<RequestListingModal initialEntityType="pg" onClose={vi.fn()} />);

      expect(screen.getByText('List a PG / Hostel')).toBeInTheDocument();
      const autofillBtn = screen.getByRole('button', { name: /Auto-fill Genuine Test Data/i });
      expect(autofillBtn).toHaveTextContent('(PG)');

      fireEvent.click(autofillBtn);

      // Move to Step 2 and verify genuine PG data populated
      const continueBtn = screen.getByRole('button', { name: /Continue/i });
      fireEvent.click(continueBtn);

      const nameInput = await screen.findByPlaceholderText(/श्री साई बॉईज हॉस्टेल/i);
      expect((nameInput as HTMLInputElement).value).toMatch(/Hostel|PG/i);
    });
  });

  describe('UserMenuDrawer Renames, Removed My Institutes & Clear Cache Progress', () => {
    it('shows List New Business, My Businesses, Saved without My Institutes and displays Clear Cache progress bar', async () => {
      mockAuthState.user = { id: 'u-1', email: 'examiner@apnalocal.in', user_metadata: { full_name: 'Examiner' } };

      renderApp(<UserMenuDrawer />);

      const trigger = screen.getByRole('button', { name: /Open user menu/i });
      await act(async () => {
        fireEvent.click(trigger);
      });

      expect(await screen.findByText('List New Business')).toBeInTheDocument();
      expect(screen.getByText('My Businesses')).toBeInTheDocument();
      expect(screen.getByText('Saved')).toBeInTheDocument();
      expect(screen.queryByText(/My Institutes/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/My Shops/i)).not.toBeInTheDocument();

      // Open Settings drawer -> click Clear Cache
      fireEvent.click(screen.getByText('Settings'));
      const clearBtn = await screen.findByText('Clear Cache');

      await act(async () => {
        fireEvent.click(clearBtn);
      });

      await waitFor(
        () => {
          expect(screen.getAllByText('100%').length).toBeGreaterThanOrEqual(1);
          expect(screen.getByText(/All app caches cleared!/i)).toBeInTheDocument();
        },
        { timeout: 3000 },
      );
      expect(screen.getByRole('button', { name: /Reload/i })).toBeInTheDocument();
    });
  });

  describe('Examiner Admin SQL Parity & Profile Constraint Safety', () => {
    const sqlFiles = [
      path.resolve(process.cwd(), 'supabase/migrations/20261115000000_guest_rls_reviews_and_examiner_admin.sql'),
      path.resolve(process.cwd(), 'docs/patches/2026-11-15_guest_rls_reviews_and_examiner_admin.sql'),
    ];

    it.each(sqlFiles)('avoids profiles_username_format_check violation and grants full admin parity (%s)', (filePath) => {
      const sql = fs.readFileSync(filePath, 'utf8');

      // Never insert invalid display strings violating `^[a-z][a-z0-9_.]{2,23}$`
      expect(sql).not.toMatch(/INSERT INTO public\.profiles[^;]*'Examiner Admin'/i);
      expect('examiner_admin').toMatch(/^[a-z][a-z0-9_.]{2,23}$/);
      expect('examiner_879520f0').toMatch(/^[a-z][a-z0-9_.]{2,23}$/);
      expect(sql).toContain("^[a-z][a-z0-9_.]{2,23}$");
      expect(sql).toContain("'examiner_admin'");

      // Role parity for both Examiner Mode and Super Admin
      expect(sql).toContain("'admin-test@apnalocal.in'");
      expect(sql).toContain("'harshking5305@gmail.com'");
      expect(sql).toContain("'admin'::public.app_role");
      expect(sql).toContain("'user'::public.app_role");

      // Full admin module grants + hardened signup trigger + preserved security boundaries
      for (const tbl of [
        'geo_cities',
        'schools',
        'mess_profiles',
        'pg_profiles',
        'mcp_endpoints',
        'category_translations',
        'authority_organizations',
        'user_roles',
      ]) {
        expect(sql).toContain(`'${tbl}'`);
      }
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.handle_new_user()');
      expect(sql).toContain('GRANT UPDATE (hit_count, last_used_at) ON TABLE public.translation_cache TO anon, authenticated');
      expect(sql).toContain('REVOKE ALL ON TABLE public.mcp_endpoints FROM anon');
      expect(sql).toContain('storage.objects');
    });
  });
});
