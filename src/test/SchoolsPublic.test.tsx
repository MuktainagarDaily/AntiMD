import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { I18nProvider } from '@/i18n';
import { CityProvider } from '@/hooks/useCity';
import { AuthProvider } from '@/hooks/useAuth';
import Schools from '@/pages/Schools';
import SchoolDetail from '@/pages/SchoolDetail';
import {
  normalizeWhatsApp,
  isValidPhone,
  extractStoragePath,
} from '@/components/admin/adminHelpers';
import type { SchoolRow } from '@/lib/repos/schoolsRepo';

const MAVAL_CITY_ID = 'b5555555-5555-4555-8555-555555555555';

// Deliberately simulates a legacy pre-migration row where `whatsapp`,
// `admission_status`, `mediums`, and `transport_villages` are absent (`undefined`)
const sparsePreMigrationSchool = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Z.P. Primary School, Parandwadi',
  name_mr: 'जि.प. प्राथमिक शाळा, परंदवडी',
  school_type: 'primary',
  medium: 'marathi',
  area: 'Parandwadi Gaothan',
  sub_area: null,
  address: 'Near Gram Panchayat, Parandwadi',
  phone: '02114-222225',
  email: null,
  website: null,
  description: '[Board: State Board (SSC/HSC)] · [Facilities: Mid-Day Meal]\n\nLocal ZP school.',
  image_url: null,
  photos: null,
  latitude: null,
  longitude: null,
  is_active: true,
  city_id: MAVAL_CITY_ID,
  created_at: '2026-11-01T00:00:00Z',
  updated_at: '2026-11-01T00:00:00Z',
} as unknown as SchoolRow;

const fullEnrichedSchool: SchoolRow = {
  id: '22222222-2222-4222-8222-222222222222',
  slug: 'd-y-patil-college-parandwadi',
  name: 'D.Y. Patil College of Engineering',
  name_mr: 'डी.वाय. पाटील अभियांत्रिकी महाविद्यालय',
  school_type: 'engineering-polytechnic',
  medium: 'english',
  mediums: ['english'],
  area: 'Varale / Ambi Campus',
  sub_area: null,
  address: 'Talegaon Dabhade, Maval',
  phone: '9822001122',
  whatsapp: '9822001122',
  email: 'admissions@dyp.edu',
  website: 'https://dypcoei.edu.in',
  description: 'SPPU affiliated degree engineering college.',
  image_url: null,
  photos: [],
  latitude: 18.73,
  longitude: 73.68,
  is_active: true,
  is_verified: true,
  is_claimed: true,
  board: 'SPPU (Pune University)',
  management_type: 'private',
  admission_status: 'open',
  transport_villages: ['Parandwadi', 'Somatane'],
  city_id: MAVAL_CITY_ID,
  created_at: '2026-11-01T00:00:00Z',
  updated_at: '2026-11-01T00:00:00Z',
};

let mockSchoolsList: SchoolRow[] = [sparsePreMigrationSchool, fullEnrichedSchool];
let mockDetailSchool: SchoolRow | null = fullEnrichedSchool;

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
    from: vi.fn((table: string) => {
      if (table === 'geo_cities') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: [
              {
                id: MAVAL_CITY_ID,
                district_id: 'dist-pune',
                slug: 'maval',
                name: 'Maval',
                name_mr: 'मावळ',
                is_active: true,
              },
            ],
            error: null,
          }),
        };
      }

      if (table === 'schools') {
        const schoolsChain: any = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          or: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockImplementation(() =>
            Promise.resolve({ data: mockDetailSchool, error: null }),
          ),
          then: (resolve: any) =>
            Promise.resolve({ data: mockSchoolsList, error: null }).then(resolve),
        };
        return schoolsChain;
      }

      const fallback: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        then: (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve),
      };
      return fallback;
    }),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    })),
    removeChannel: vi.fn(),
  },
}));

function renderSchoolsRoute(initialPath: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  return render(
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialPath]}>
          <AuthProvider>
            <CityProvider>
              <I18nProvider>
                <Routes>
                  <Route path="/:citySlug/schools" element={<Schools />} />
                  <Route path="/:citySlug/schools/:id" element={<SchoolDetail />} />
                </Routes>
              </I18nProvider>
            </CityProvider>
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </HelmetProvider>,
  );
}

describe('adminHelpers null/undefined safety', () => {
  it('normalizeWhatsApp safely handles undefined, null, empty, 10-digit, and +91 inputs', () => {
    expect(normalizeWhatsApp(undefined)).toBe('');
    expect(normalizeWhatsApp(null)).toBe('');
    expect(normalizeWhatsApp('')).toBe('');
    expect(normalizeWhatsApp('   ')).toBe('');
    expect(normalizeWhatsApp('9822001122')).toBe('919822001122');
    expect(normalizeWhatsApp('+91 98220-01122')).toBe('919822001122');
  });

  it('isValidPhone and extractStoragePath safely handle null and undefined inputs', () => {
    expect(isValidPhone(undefined)).toBe(false);
    expect(isValidPhone(null)).toBe(false);
    expect(isValidPhone('9822001122')).toBe(true);
    expect(extractStoragePath(undefined)).toBeNull();
    expect(extractStoragePath(null)).toBeNull();
  });
});

describe('Public Education Directory & Detail Pages Regression', () => {
  beforeEach(() => {
    mockSchoolsList = [sparsePreMigrationSchool, fullEnrichedSchool];
    mockDetailSchool = fullEnrichedSchool;
  });

  it('renders /maval/schools cleanly even when rows omit whatsapp and migration columns, and formats single-91 wa.me URLs', async () => {
    renderSchoolsRoute('/maval/schools');

    await waitFor(() => {
      expect(screen.getByText('Z.P. Primary School, Parandwadi')).toBeInTheDocument();
      expect(screen.getByText('D.Y. Patil College of Engineering')).toBeInTheDocument();
    });

    const waLinks = Array.from(document.querySelectorAll('a[href*="wa.me/"]'));
    expect(waLinks.length).toBe(1);
    const href = waLinks[0].getAttribute('href') || '';
    expect(href).toContain('https://wa.me/919822001122?text=');
    expect(href).not.toContain('https://wa.me/9191');
  });

  it('renders SchoolDetail cleanly with single-91 wa.me URLs and omits WhatsApp for landline-only sparse rows', async () => {
    mockDetailSchool = fullEnrichedSchool;
    const { unmount } = renderSchoolsRoute(`/maval/schools/${fullEnrichedSchool.id}`);

    await waitFor(() => {
      expect(screen.getAllByText('D.Y. Patil College of Engineering').length).toBeGreaterThan(0);
    });

    const detailHeader = document.querySelector('header');
    expect(detailHeader?.className).toContain('bg-primary');
    expect(detailHeader?.className).toContain('text-primary-foreground');

    const waLinks = Array.from(document.querySelectorAll('a[href*="wa.me/"]'));
    expect(waLinks.length).toBeGreaterThanOrEqual(1);
    for (const a of waLinks) {
      const href = a.getAttribute('href') || '';
      expect(href).toContain('https://wa.me/919822001122?text=');
      expect(href).not.toContain('https://wa.me/9191');
    }
    unmount();

    mockDetailSchool = sparsePreMigrationSchool;
    renderSchoolsRoute(`/maval/schools/${sparsePreMigrationSchool.id}`);

    await waitFor(() => {
      expect(screen.getAllByText('Z.P. Primary School, Parandwadi').length).toBeGreaterThan(0);
    });

    const landlineWaLinks = Array.from(document.querySelectorAll('a[href*="wa.me/"]'));
    expect(landlineWaLinks).toHaveLength(0);
  });
});
