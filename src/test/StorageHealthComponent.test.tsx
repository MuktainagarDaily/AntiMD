import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { DataQualityTab } from '@/components/admin/DataQualityTab';

const CITY_MUKTAI = '644b68eb-472c-40d3-9f83-c7d26e121498';
const CITY_MAVAL = '98aba7d0-ba7f-443f-a9bc-2f3079b06fe6';

const {
  mockRunSystemDiagnostics,
  mockFetchAllPaginated,
  mockUpdateEq,
  mockUpdateOr,
  mockFrom,
} = vi.hoisted(() => ({
  mockRunSystemDiagnostics: vi.fn(),
  mockFetchAllPaginated: vi.fn(),
  mockUpdateEq: vi.fn(),
  mockUpdateOr: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock('@/hooks/useCity', () => ({
  useOptionalCity: () => ({
    currentCity: {
      id: CITY_MUKTAI,
      slug: 'muktainagar',
      name: 'Muktainagar',
      name_mr: 'मुक्ताईनगर',
      type: 'taluka',
      district_id: 'dist-1',
      latitude: 21.07,
      longitude: 75.98,
      is_active: true,
      sort_order: 1,
    },
    allCities: [
      {
        id: CITY_MUKTAI,
        slug: 'muktainagar',
        name: 'Muktainagar',
        name_mr: 'मुक्ताईनगर',
        type: 'taluka',
        district_id: 'dist-1',
        latitude: 21.07,
        longitude: 75.98,
        is_active: true,
        sort_order: 1,
      },
      {
        id: CITY_MAVAL,
        slug: 'maval',
        name: 'Maval',
        name_mr: 'मावळ',
        type: 'taluka',
        district_id: 'dist-2',
        latitude: 18.75,
        longitude: 73.54,
        is_active: true,
        sort_order: 2,
      },
    ],
  }),
}));

vi.mock('@/lib/admin/storageHealthService', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    runSystemDiagnostics: (...args: any[]) => mockRunSystemDiagnostics(...args),
    fetchAllPaginated: (...args: any[]) => mockFetchAllPaginated(...args),
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: any[]) => mockFrom(...args),
  },
}));

const sampleShops = [
  {
    id: 'shop-1',
    name: 'Muktai Kirana',
    area: 'College Road',
    city_id: CITY_MUKTAI,
    phone: '',
    whatsapp: '',
    is_verified: false,
    is_active: true,
    image_url: null,
    latitude: null,
    longitude: null,
    shop_categories: [],
  },
  {
    id: 'shop-2',
    name: 'Maval Electronics',
    area: 'College Road',
    city_id: CITY_MAVAL,
    phone: '9822001122',
    whatsapp: '',
    is_verified: true,
    is_active: true,
    image_url: 'https://example.com/shop2.webp',
    latitude: 18.75,
    longitude: 73.54,
    shop_categories: [],
  },
];

const sampleSchools = [
  {
    id: 'sch-1',
    name: 'Taluka High School',
    name_mr: '',
    area: 'Station Road',
    city_id: CITY_MUKTAI,
    phone: '02583234567',
    is_verified: false,
    is_active: true,
    image_url: 'https://example.com/sch1.webp',
    latitude: 21.07,
    longitude: 75.98,
  },
];

function renderTab() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const onEditShop = vi.fn();
  const onEditSchool = vi.fn();

  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <DataQualityTab onEditShop={onEditShop} onEditSchool={onEditSchool} />
      </MemoryRouter>
    </QueryClientProvider>,
  );

  return { onEditShop, onEditSchool };
}

beforeEach(() => {
  vi.clearAllMocks();

  mockFetchAllPaginated.mockImplementation(async (table: string) => {
    if (table === 'shops') return sampleShops;
    if (table === 'schools') return sampleSchools;
    if (table === 'shop_translations') return [];
    return [];
  });

  mockRunSystemDiagnostics.mockResolvedValue({
    checkedAt: new Date().toISOString(),
    dbLatencyMs: 42,
    dbOk: true,
    dbError: null,
    rpcAvailable: false,
    schema: {
      shopsImageVerification: false,
      schoolsImageVerification: false,
      bannersImageVerification: false,
      storageRootListingFixed: false,
    },
    sqlPatchPending: true,
    storageBucketOk: true,
    storageRootSampleCount: 0,
    storageSubfoldersFound: ['banners'],
    storageError: null,
    materializedView: { exists: false, mvCountSum: 0, liveCountSum: 0, drift: 0 },
    counts: { shops: 138, schools: 7, banners: 3 },
    edgeFunctions: [
      {
        name: 'scrape-local-news',
        label: 'Local News Scraper',
        status: 'online',
        httpStatus: 204,
        latencyMs: 55,
        detail: 'Preflight OK (204) · 55 ms',
      },
    ],
    browserCache: {
      serviceWorkers: [],
      cacheStorageNames: [],
      localStorageTotalBytes: 1024,
      localStorageKeys: 2,
      breakdown: [],
    },
  });

  mockUpdateOr.mockResolvedValue({ error: null });
  mockUpdateEq.mockReturnValue({
    or: mockUpdateOr,
    eq: vi.fn().mockResolvedValue({ error: null }),
    is: vi.fn().mockResolvedValue({ error: null }),
    then: (resolve: any) => resolve({ error: null }),
  });

  mockFrom.mockReturnValue({
    update: vi.fn().mockReturnValue({
      eq: mockUpdateEq,
    }),
  });
});

describe('DataQualityTab (Storage & System Health)', () => {
  it('renders System Health diagnostics & pending SQL migration notice cleanly', async () => {
    renderTab();

    expect(screen.getByText(/Storage & System Health/i)).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /System Health/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Storage & Media Audit/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Listing Hygiene/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Areas & Duplicates/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/Supabase SQL Health Patch Pending/i)).toBeInTheDocument();
    });
    expect(screen.getByText('42 ms')).toBeInTheDocument();
    expect(screen.getByText(/Local News Scraper/i)).toBeInTheDocument();
  });

  it('switches to Listing Hygiene and lets admin verify or edit shops and schools', async () => {
    const { onEditShop, onEditSchool } = renderTab();

    await waitFor(() => {
      expect(screen.getByText('Muktai Kirana')).toBeInTheDocument();
    }).catch(() => {});

    fireEvent.click(screen.getByRole('tab', { name: /Listing Hygiene/i }));

    await waitFor(() => {
      expect(screen.getByText('Muktai Kirana')).toBeInTheDocument();
      expect(screen.getByText('Taluka High School')).toBeInTheDocument();
    });

    expect(screen.getByText(/Missing Phone \(1\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Unverified \(2\)/i)).toBeInTheDocument();

    // Edit triggers right modal callback
    const editButtons = screen.getAllByRole('button', { name: /Edit/i });
    fireEvent.click(editButtons[0]);
    expect(onEditShop).toHaveBeenCalledWith(expect.objectContaining({ id: 'shop-1' }));

    fireEvent.click(editButtons[1]);
    expect(onEditSchool).toHaveBeenCalledWith(expect.objectContaining({ id: 'sch-1' }));

    // Verify action calls Supabase update
    const verifyButtons = screen.getAllByRole('button', { name: /Verify/i });
    fireEvent.click(verifyButtons[0]);
    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('shops');
      expect(mockUpdateEq).toHaveBeenCalledWith('id', 'shop-1');
    });
  });

  it('isolates College Road per town under All Towns and scopes area rename query by city_id', async () => {
    renderTab();

    // Switch town scope to All Towns
    const townSelect = screen.getByLabelText('Town scope filter');
    fireEvent.change(townSelect, { target: { value: 'all' } });

    fireEvent.click(screen.getByRole('tab', { name: /Areas & Duplicates/i }));

    await waitFor(() => {
      const table = screen.getByRole('table');
      const collegeRows = within(table).getAllByText('College Road');
      expect(collegeRows).toHaveLength(2); // Separate row for Muktainagar & Maval!
    });

    const table = screen.getByRole('table');
    const muktaiRow = within(table)
      .getAllByRole('row')
      .find((tr) => within(tr).queryByText('Muktainagar') !== null)!;
    fireEvent.click(within(muktaiRow).getByRole('button', { name: /Rename/i }));

    const input = screen.getByPlaceholderText('New area name…');
    fireEvent.change(input, { target: { value: 'Vidya Nagar' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('shops');
      expect(mockUpdateEq).toHaveBeenCalledWith('area', 'College Road');
      expect(mockUpdateOr).toHaveBeenCalledWith(`city_id.eq.${CITY_MUKTAI},city_id.is.null`);
    });
  });
});
