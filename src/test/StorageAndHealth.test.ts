import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockFrom = vi.fn();
const mockStorageFrom = vi.fn();
const mockRpc = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: any[]) => mockFrom(...args),
    storage: {
      from: (...args: any[]) => mockStorageFrom(...args),
    },
    rpc: (...args: any[]) => mockRpc(...args),
  },
}));

import {
  dqAreaCompareKey,
  dqNormalizeAreaValue,
  dqIsSuspiciousArea,
  buildCityAreaSummary,
  findSimilarAreaGroups,
  findDuplicateShops,
  buildListingHygieneReport,
  isValidListingPhone,
  normalizePhone10,
} from '@/lib/admin/dataQualityHelpers';
import {
  classifyStorageAudit,
  computeReferencedPathsFromRows,
  fetchAllPaginated,
} from '@/lib/admin/storageHealthService';
import {
  diffRemovedStoragePaths,
  extractEntityStoragePaths,
  slugifyShopName,
  uploadShopImage,
} from '@/lib/storageNaming';
import { coerceDatasetRow } from '@/lib/admin/masterDatasets';
import type { StorageObjectEntry } from '@/lib/storageNaming';

const CITY_MUKTAI = '644b68eb-472c-40d3-9f83-c7d26e121498';
const CITY_MAVAL = '98aba7d0-ba7f-443f-a9bc-2f3079b06fe6';
const cityNameMap = new Map([
  [CITY_MUKTAI, 'Muktainagar'],
  [CITY_MAVAL, 'Maval'],
]);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Devanagari & Area Normalization Safeguards', () => {
  it('never strips Devanagari area names into empty strings or collides distinct areas', () => {
    const k1 = dqAreaCompareKey('बस स्टँड परिसर');
    const k2 = dqAreaCompareKey('गांधी चौक');
    const empty = dqAreaCompareKey('   ');

    expect(k1).not.toBe('');
    expect(k2).not.toBe('');
    expect(k1).not.toBe(k2);
    expect(empty).toBe('__empty__');
  });

  it('normalizes minor punctuation and case variations for near-duplicate English areas', () => {
    expect(dqAreaCompareKey('College Rd.')).toBe('college rd');
    expect(dqAreaCompareKey('  college   rd ')).toBe('college rd');
    expect(dqNormalizeAreaValue('  station  road ')).toBe('Station Road');
    expect(dqIsSuspiciousArea('AB')).toBe(true);
    expect(dqIsSuspiciousArea('1234')).toBe(true);
    expect(dqIsSuspiciousArea('MAIN ROAD')).toBe(true);
    expect(dqIsSuspiciousArea('गांधी चौक')).toBe(false);
  });

  it('keeps identical area names isolated per town and blocks cross-town similarity grouping', () => {
    const shops = [
      { id: 's1', area: 'College Road', city_id: CITY_MUKTAI },
      { id: 's2', area: 'College Road', city_id: CITY_MUKTAI },
      { id: 's3', area: 'College Road', city_id: CITY_MAVAL },
      { id: 's4', area: 'college road.', city_id: CITY_MUKTAI },
    ];

    const summary = buildCityAreaSummary(shops, {
      cityFilter: 'all',
      defaultCityId: CITY_MUKTAI,
      cityNameMap,
    });

    const muktaiRow = summary.find((r) => r.cityKey === CITY_MUKTAI && r.area === 'College Road');
    const mavalRow = summary.find((r) => r.cityKey === CITY_MAVAL && r.area === 'College Road');
    expect(muktaiRow?.count).toBe(2);
    expect(mavalRow?.count).toBe(1);

    const { groups, bestCandidateByCompositeKey } = findSimilarAreaGroups(summary);
    // Similar group only pairs Muktainagar's 'College Road' with 'college road.' (NOT Maval!)
    expect(groups.size).toBe(1);
    expect(bestCandidateByCompositeKey.get(`${CITY_MUKTAI}::college road.`)).toBe('College Road');
    expect(bestCandidateByCompositeKey.has(`${CITY_MAVAL}::College Road`)).toBe(false);
  });
});

describe('Devanagari Slugification & Upload Collision Prevention', () => {
  it('transliterates Marathi-only shop names into unique storage slugs', () => {
    const slugA = slugifyShopName('मुक्ताई किराणा स्टोअर्स');
    const slugB = slugifyShopName('साई मेडिकल');

    expect(slugA).not.toBe('shop');
    expect(slugB).not.toBe('shop');
    expect(slugA).not.toBe(slugB);
    expect(slugA).toMatch(/^[a-z0-9-]+$/);
  });

  it('retries with a unique suffix instead of hijacking sibling photo on HTTP 409 duplicate', async () => {
    const uploadMock = vi
      .fn()
      .mockResolvedValueOnce({ error: { statusCode: 409, message: 'The resource already exists' } })
      .mockResolvedValueOnce({ error: null });

    mockStorageFrom.mockReturnValue({
      list: vi.fn().mockResolvedValue({ data: [], error: null }),
      upload: uploadMock,
      getPublicUrl: vi.fn((p: string) => ({
        data: { publicUrl: `https://example.supabase.co/storage/v1/object/public/shop-images/${p}` },
      })),
    });

    const blob = new Blob(['webp-bytes'], { type: 'image/webp' });
    const res = await uploadShopImage(blob, 'New Kirana');

    expect(uploadMock).toHaveBeenCalledTimes(2);
    expect(res.isExisting).toBe(false);
    expect(res.path).toMatch(/^new-kirana-[a-z0-9]+\.webp$/);
  });

  it('extractEntityStoragePaths & diffRemovedStoragePaths track gallery arrays cleanly', () => {
    const base = 'https://proj.supabase.co/storage/v1/object/public/shop-images';
    const paths = extractEntityStoragePaths({
      image_url: `${base}/cover.webp`,
      photos: [`${base}/cover.webp`, `${base}/gallery-2.webp`, 'https://cdn.other.com/ext.jpg'],
      proof_image_path: 'claims/user-1/proof.webp',
    });

    expect(paths).toEqual(['cover.webp', 'gallery-2.webp', 'claims/user-1/proof.webp']);

    const removed = diffRemovedStoragePaths(
      [`${base}/cover.webp`, `${base}/old-2.webp`],
      [`${base}/cover.webp`, `${base}/new-2.webp`],
    );
    expect(removed).toEqual(['old-2.webp']);
  });
});

describe('Upgraded Duplicate Detection', () => {
  it('detects Phone, WhatsApp, and Phone<->WhatsApp matches while ignoring placeholder numbers', () => {
    expect(normalizePhone10('09822001100')).toBe('9822001100');
    expect(normalizePhone10('0000000000')).toBeNull();
    expect(normalizePhone10('9999999999')).toBeNull();
    expect(normalizePhone10('12345')).toBeNull();
    expect(isValidListingPhone('+91 98220-01100')).toBe(true);
    expect(isValidListingPhone('02583-234567')).toBe(true);
    expect(isValidListingPhone('0000000000')).toBe(false);

    const shops = [
      { id: '1', name: 'Alpha Electronics', phone: '9822001100', whatsapp: '', area: 'Main Road', city_id: CITY_MUKTAI },
      { id: '2', name: 'Alpha Care', phone: '', whatsapp: '+91 98220 01100', area: 'Station Rd', city_id: CITY_MUKTAI },
      { id: '3', name: 'Placeholder Shop A', phone: '0000000000', area: 'Main Road', city_id: CITY_MUKTAI },
      { id: '4', name: 'Placeholder Shop B', phone: '0000000000', area: 'Station Rd', city_id: CITY_MUKTAI },
      { id: '5', name: 'Maval Branch', phone: '9822001100', area: 'Talegaon', city_id: CITY_MAVAL },
    ];

    const sameTownOnly = findDuplicateShops(shops, {
      cityFilter: 'all',
      defaultCityId: CITY_MUKTAI,
      cityNameMap,
      includeCrossTownPhones: false,
    });

    expect(sameTownOnly).toHaveLength(1);
    expect(sameTownOnly[0].shops.map((s) => s.id).sort()).toEqual(['1', '2']);
    expect(sameTownOnly[0].reasons).toContain('Phone ↔ WhatsApp');

    const withCrossTown = findDuplicateShops(shops, {
      cityFilter: 'all',
      defaultCityId: CITY_MUKTAI,
      cityNameMap,
      includeCrossTownPhones: true,
    });
    expect(withCrossTown.some((g) => g.crossTown && g.reasons.includes('Cross-Town Phone'))).toBe(true);
  });

  it('prevents false positives on distinct "Shree ..." prefixes while catching true similar names', () => {
    const shops = [
      { id: 'a', name: 'Shree Ganesh Kirana', area: 'Main Road', city_id: CITY_MUKTAI },
      { id: 'b', name: 'Shree Swami Samarth', area: 'Main Road', city_id: CITY_MUKTAI },
      { id: 'c', name: 'Sai Kirana', area: 'Main Road', city_id: CITY_MUKTAI },
      { id: 'd', name: 'Sai Kirana Stores', area: 'Main Road', city_id: CITY_MUKTAI },
    ];

    const groups = findDuplicateShops(shops, { cityFilter: CITY_MUKTAI, defaultCityId: CITY_MUKTAI });
    expect(groups).toHaveLength(1);
    expect(groups[0].shops.map((s) => s.id).sort()).toEqual(['c', 'd']);
    expect(groups[0].reasons).toContain('Similar Name & Area');
  });
});

describe('Multi-Table Storage Audit & Claim PII Retention', () => {
  it('protects photos[], schools, banners, mess menus, local_news, and claims from orphan flagging', () => {
    const base = 'https://proj.supabase.co/storage/v1/object/public/shop-images';
    const refSet = computeReferencedPathsFromRows({
      shops: [{ image_url: `${base}/shop-1.webp`, photos: [`${base}/shop-1.webp`, `${base}/shop-1-extra.webp`] }],
      shop_requests: [{ image_url: null, photos: [`${base}/req-1.webp`] }],
      schools: [{ image_url: `${base}/school-1.webp`, photos: [`${base}/school-campus.webp`] }],
      banners: [{ image_url: `${base}/banners/hero-ad.webp` }],
      mess_daily_menus: [{ photo_url: `${base}/menus/thali.webp` }],
      local_news: [{ image_url: `${base}/news-thumb.webp` }],
      shop_claims: [{ proof_image_path: 'claims/user1/aadhaar.webp' }],
      school_claims: [{ proof_image_path: 'claims/user2/udise.webp' }],
    });

    const nowMs = Date.UTC(2026, 10, 11);
    const objects: StorageObjectEntry[] = [
      { path: 'shop-1.webp', name: 'shop-1.webp', folder: '(root)', size: 1000, created_at: '2026-01-01T00:00:00Z', updated_at: '', id: '1' },
      { path: 'shop-1-extra.webp', name: 'shop-1-extra.webp', folder: '(root)', size: 2000, created_at: '2026-01-01T00:00:00Z', updated_at: '', id: '2' },
      { path: 'school-campus.webp', name: 'school-campus.webp', folder: '(root)', size: 3000, created_at: '2026-01-01T00:00:00Z', updated_at: '', id: '3' },
      { path: 'banners/hero-ad.webp', name: 'hero-ad.webp', folder: 'banners', size: 4000, created_at: '2026-01-01T00:00:00Z', updated_at: '', id: '4' },
      { path: 'menus/thali.webp', name: 'thali.webp', folder: 'menus', size: 1500, created_at: '2026-01-01T00:00:00Z', updated_at: '', id: '5' },
      { path: 'claims/user1/aadhaar.webp', name: 'aadhaar.webp', folder: 'claims/user1', size: 5000, created_at: '2026-01-01T00:00:00Z', updated_at: '', id: '6' },
      { path: 'claims/user2/udise.webp', name: 'udise.webp', folder: 'claims/user2', size: 6000, created_at: '2026-10-20T00:00:00Z', updated_at: '', id: '7' },
      { path: 'stale-orphan.webp', name: 'stale-orphan.webp', folder: '(root)', size: 9000, created_at: '2026-01-01T00:00:00Z', updated_at: '', id: '8' },
      { path: 'banners/old-banner.webp', name: 'old-banner.webp', folder: 'banners', size: 8000, created_at: '2026-01-01T00:00:00Z', updated_at: '', id: '9' },
    ];

    const claimRows = [
      { id: 'c1', source: 'shop_claims' as const, status: 'approved', proof_image_path: 'claims/user1/aadhaar.webp', created_at: '2026-01-01T00:00:00Z' },
      { id: 'c2', source: 'school_claims' as const, status: 'pending', proof_image_path: 'claims/user2/udise.webp', created_at: '2025-01-01T00:00:00Z' },
    ];

    const report = classifyStorageAudit(objects, refSet, claimRows, { retentionDays: 90, nowMs });

    expect(report.orphans.map((o) => o.path)).toEqual(['banners/old-banner.webp', 'stale-orphan.webp']);
    expect(report.folderCounts.banners.orphans).toBe(1);
    expect(report.folderCounts.root.orphans).toBe(1);
    expect(report.folderCounts.claims.orphans).toBe(0);

    // Only approved old claim appears in expiredClaimProofs; ancient pending claim stays safe!
    expect(report.expiredClaimProofs.map((c) => c.id)).toEqual(['c1']);
    expect(report.expiredClaimProofs[0].sizeBytes).toBe(5000);
  });
});

describe('Listing Hygiene Scanner & Paginated Fetch & Master Backup', () => {
  it('flags missing phones, invalid phones, unverified status, missing GPS, and missing Marathi across shops and schools', () => {
    const report = buildListingHygieneReport({
      shops: [
        {
          id: 'sh-1',
          name: 'Incomplete Shop',
          phone: '123',
          is_verified: false,
          image_url: null,
          latitude: null,
          longitude: null,
          city_id: CITY_MUKTAI,
        },
        {
          id: 'sh-2',
          name: 'साई मेडिकल',
          phone: '9822001100',
          is_verified: true,
          image_url: 'https://example.com/a.webp',
          latitude: 21.07,
          longitude: 75.98,
          city_id: CITY_MUKTAI,
        },
      ],
      schools: [
        {
          id: 'sc-1',
          name: 'Muktai Vidyalaya',
          name_mr: '',
          phone: '',
          is_verified: false,
          image_url: 'https://example.com/sc.webp',
          latitude: 21.08,
          longitude: 75.99,
          city_id: CITY_MUKTAI,
        },
      ],
      translatedShopIds: new Set<string>(),
      cityFilter: CITY_MUKTAI,
      defaultCityId: CITY_MUKTAI,
      cityNameMap,
    });

    expect(report.totalScanned).toBe(3);
    expect(report.items).toHaveLength(2); // sh-2 is clean because Devanagari name counts as Marathi
    expect(report.counts.invalid_phone).toBe(1);
    expect(report.counts.missing_phone).toBe(1);
    expect(report.counts.unverified).toBe(2);
    expect(report.counts.no_photo).toBe(1);
    expect(report.counts.no_gps).toBe(1);
    expect(report.counts.missing_marathi).toBe(2);
  });

  it('fetchAllPaginated loops cleanly past 1,000 rows', async () => {
    const page1 = Array.from({ length: 1000 }, (_, i) => ({ id: `id-${i}` }));
    const page2 = Array.from({ length: 250 }, (_, i) => ({ id: `id-${1000 + i}` }));

    const rangeMock = vi
      .fn()
      .mockResolvedValueOnce({ data: page1, error: null })
      .mockResolvedValueOnce({ data: page2, error: null });

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        range: rangeMock,
      }),
    });

    const rows = await fetchAllPaginated('shops', 'id', { pageSize: 1000 });
    expect(rows).toHaveLength(1250);
    expect(rangeMock).toHaveBeenNthCalledWith(1, 0, 999);
    expect(rangeMock).toHaveBeenNthCalledWith(2, 1000, 1999);
  });

  it('coerceDatasetRow accurately parses schools arrays, shops photos, and JSONB metadata', () => {
    const coercedSchool = coerceDatasetRow(
      'schools',
      {
        name: 'New Vidyalaya',
        photos: 'https://a/1.webp|https://a/2.webp',
        mediums: 'marathi|english',
        facilities: 'library|lab',
        is_verified: 'true',
        meta: '{"hostel":true}',
      },
      { id: CITY_MUKTAI, district_id: 'dist-1', district: { state_id: 'st-1' } },
    );

    expect(coercedSchool.photos).toEqual(['https://a/1.webp', 'https://a/2.webp']);
    expect(coercedSchool.mediums).toEqual(['marathi', 'english']);
    expect(coercedSchool.facilities).toEqual(['library', 'lab']);
    expect(coercedSchool.is_verified).toBe(true);
    expect(coercedSchool.meta).toEqual({ hostel: true });
    expect(coercedSchool.city_id).toBe(CITY_MUKTAI);
  });
});
