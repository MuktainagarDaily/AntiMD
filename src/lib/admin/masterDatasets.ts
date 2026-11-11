/**
 * Typed dataset schema registry for Master Backup & Restore.
 *
 * Centralises:
 *   1. Foreign-key-safe import/export ordering across all 19 directory/platform tables.
 *   2. Exact Postgres array (`text[]` / `uuid[]`), JSONB, numeric, and boolean column lists
 *      so CSV exports never emit "[object Object]" and round-trip CSV imports never fail
 *      with 23502 (NOT NULL violation) or 22P02 (malformed JSON/array literal).
 *   3. Town scoping metadata (city_id / district_id / state_id fallback safety).
 */

export type MasterDatasetKey =
  | 'categories'
  | 'shops'
  | 'shop_categories'
  | 'mess_profiles'
  | 'mess_daily_menus'
  | 'pg_profiles'
  | 'schools'
  | 'school_notices'
  | 'school_claims'
  | 'bus_timetable'
  | 'bus_stand_info'
  | 'news_sources'
  | 'local_news'
  | 'banners'
  | 'authority_departments'
  | 'authority_organizations'
  | 'authority_announcements'
  | 'announcement_locations'
  | 'requests'
  | 'claims';

export type MasterExportKey = MasterDatasetKey | 'images';

export type CityScopeMode = 'none' | 'city_only' | 'city_district' | 'full';

export interface MasterDatasetSpec {
  key: MasterDatasetKey;
  table: string;
  label: string;
  detail: string;
  group: 'core' | 'education' | 'civic' | 'moderation';
  conflictTarget: string;
  arrayCols: readonly string[];
  jsonCols: readonly string[];
  numCols: readonly string[];
  boolCols: readonly string[];
  notNullDefaults: Record<string, unknown>;
  cityScope: CityScopeMode;
  optionalTable?: boolean;
  defaultSelected?: boolean;
}

export const MASTER_DATASETS: MasterDatasetSpec[] = [
  {
    key: 'categories',
    table: 'categories',
    label: 'Categories',
    detail: 'All shop categories with icons and active status',
    group: 'core',
    conflictTarget: 'id',
    arrayCols: [],
    jsonCols: [],
    numCols: [],
    boolCols: ['is_active'],
    notNullDefaults: { icon: '🏪', is_active: true },
    cityScope: 'none',
    defaultSelected: true,
  },
  {
    key: 'shops',
    table: 'shops',
    label: 'Shops',
    detail: 'All shops & businesses with contacts, hours, amenities, photos & town links',
    group: 'core',
    conflictTarget: 'id',
    arrayCols: ['amenities', 'photos'],
    jsonCols: [],
    numCols: ['latitude', 'longitude'],
    boolCols: ['is_active', 'is_open', 'is_verified'],
    notNullDefaults: { amenities: [], photos: [], is_active: true, is_open: true, is_verified: false },
    cityScope: 'full',
    defaultSelected: true,
  },
  {
    key: 'shop_categories',
    table: 'shop_categories',
    label: 'Shop ↔ Category',
    detail: 'Join links associating shops with primary & secondary categories',
    group: 'core',
    conflictTarget: 'shop_id,category_id',
    arrayCols: [],
    jsonCols: [],
    numCols: [],
    boolCols: [],
    notNullDefaults: {},
    cityScope: 'none',
    defaultSelected: true,
  },
  {
    key: 'mess_profiles',
    table: 'mess_profiles',
    label: 'Mess Profiles',
    detail: 'Mess types, monthly/thali rates, tiffin delivery & meal timings',
    group: 'core',
    conflictTarget: 'shop_id',
    arrayCols: [],
    jsonCols: [],
    numCols: ['monthly_rate', 'single_thali_rate'],
    boolCols: ['tiffin_delivery', 'sunday_feast'],
    notNullDefaults: { mess_type: 'veg_nonveg', tiffin_delivery: false, sunday_feast: false },
    cityScope: 'none',
    defaultSelected: true,
  },
  {
    key: 'mess_daily_menus',
    table: 'mess_daily_menus',
    label: 'Mess Daily & Fixed Menus',
    detail: 'Dated menus & sentinel fixed-price menu cards per mess',
    group: 'core',
    conflictTarget: 'id',
    arrayCols: [],
    jsonCols: [],
    numCols: [],
    boolCols: [],
    notNullDefaults: {},
    cityScope: 'none',
    optionalTable: true,
    defaultSelected: true,
  },
  {
    key: 'pg_profiles',
    table: 'pg_profiles',
    label: 'PG & Hostels',
    detail: 'Bed capacity, vacancies, deposits, amenities & sharing_rates JSONB',
    group: 'core',
    conflictTarget: 'shop_id',
    arrayCols: ['amenities'],
    jsonCols: ['sharing_rates'],
    numCols: ['total_beds', 'available_beds', 'deposit_amount', 'notice_period_days'],
    boolCols: ['food_included'],
    notNullDefaults: {
      gender: 'boys',
      occupancy_target: 'students',
      total_beds: 0,
      available_beds: 0,
      deposit_amount: 0,
      notice_period_days: 30,
      food_included: false,
      amenities: [],
      sharing_rates: { '1_sharing': null, '2_sharing': null, '3_sharing': null, '4_sharing': null },
    },
    cityScope: 'none',
    defaultSelected: true,
  },
  {
    key: 'schools',
    table: 'schools',
    label: 'Schools & Institutes',
    detail: 'Education directory, admissions, fee tiers, scholarships, seats & photos',
    group: 'education',
    conflictTarget: 'id',
    arrayCols: [
      'mediums',
      'streams',
      'facilities',
      'scholarships',
      'required_documents',
      'transport_villages',
      'coaching_focus',
      'photos',
    ],
    jsonCols: ['meta'],
    numCols: ['latitude', 'longitude', 'established_year', 'annual_fee_min', 'annual_fee_max', 'total_seats', 'available_seats'],
    boolCols: ['is_active', 'is_verified', 'is_claimed'],
    notNullDefaults: {
      school_type: 'other',
      is_active: true,
      is_verified: false,
      is_claimed: false,
      gender_type: 'coed',
      admission_status: 'unknown',
      fee_tier: 'unspecified',
      mediums: [],
      streams: [],
      facilities: [],
      scholarships: [],
      required_documents: [],
      transport_villages: [],
      coaching_focus: [],
      photos: [],
      meta: {},
    },
    cityScope: 'full',
    defaultSelected: true,
  },
  {
    key: 'school_notices',
    table: 'school_notices',
    label: 'School Notices',
    detail: 'Pinned admission, exam, holiday & scholarship circulars for institutes',
    group: 'education',
    conflictTarget: 'id',
    arrayCols: [],
    jsonCols: [],
    numCols: [],
    boolCols: ['is_pinned', 'is_active'],
    notNullDefaults: { body: '', category: 'admission', is_pinned: false, is_active: true },
    cityScope: 'none',
    optionalTable: true,
    defaultSelected: true,
  },
  {
    key: 'school_claims',
    table: 'school_claims',
    label: 'School Claims',
    detail: 'Principal / owner institute claim verification records',
    group: 'education',
    conflictTarget: 'id',
    arrayCols: [],
    jsonCols: [],
    numCols: [],
    boolCols: [],
    notNullDefaults: { status: 'pending' },
    cityScope: 'none',
    optionalTable: true,
    defaultSelected: false,
  },
  {
    key: 'bus_timetable',
    table: 'bus_timetable',
    label: 'Bus Timetable',
    detail: 'ST bus routes, Marathi destinations, departure times & via notes',
    group: 'civic',
    conflictTarget: 'id',
    arrayCols: ['departure_times'],
    jsonCols: [],
    numCols: ['sort_order'],
    boolCols: ['is_active'],
    notNullDefaults: { departure_times: [], sort_order: 0, is_active: true },
    cityScope: 'none',
    defaultSelected: true,
  },
  {
    key: 'bus_stand_info',
    table: 'bus_stand_info',
    label: 'Bus Stand Info',
    detail: 'Depot phone, address, Google Maps link & general advisories',
    group: 'civic',
    conflictTarget: 'id',
    arrayCols: [],
    jsonCols: [],
    numCols: ['id'],
    boolCols: [],
    notNullDefaults: {},
    cityScope: 'none',
    optionalTable: true,
    defaultSelected: true,
  },
  {
    key: 'news_sources',
    table: 'news_sources',
    label: 'Local News Sources',
    detail: 'RSS feeds & web portals configured per town',
    group: 'civic',
    conflictTarget: 'id',
    arrayCols: [],
    jsonCols: [],
    numCols: [],
    boolCols: ['is_active'],
    notNullDefaults: { source_type: 'rss', language: 'mr', category_default: 'local', is_active: true },
    cityScope: 'city_only',
    optionalTable: true,
    defaultSelected: true,
  },
  {
    key: 'local_news',
    table: 'local_news',
    label: 'Local News Feed',
    detail: 'Town news articles, summaries, categories & source deduplication URLs',
    group: 'civic',
    conflictTarget: 'id',
    arrayCols: [],
    jsonCols: [],
    numCols: [],
    boolCols: ['is_pinned', 'is_active'],
    notNullDefaults: { category: 'local', language: 'mr', source_name: 'Town Desk', is_pinned: false, is_active: true },
    cityScope: 'city_only',
    optionalTable: true,
    defaultSelected: true,
  },
  {
    key: 'banners',
    table: 'banners',
    label: 'Ad Banners',
    detail: 'Top/popup campaigns, placements, dates, view & click counts',
    group: 'civic',
    conflictTarget: 'id',
    arrayCols: [],
    jsonCols: [],
    numCols: ['click_count', 'view_count', 'sort_order', 'close_enable_seconds', 'popup_delay_seconds'],
    boolCols: ['is_active'],
    notNullDefaults: {
      click_count: 0,
      view_count: 0,
      sort_order: 0,
      close_enable_seconds: 3,
      popup_delay_seconds: 2,
      is_active: true,
    },
    cityScope: 'none',
    optionalTable: true,
    defaultSelected: false,
  },
  {
    key: 'authority_departments',
    table: 'authority_departments',
    label: 'Service Departments',
    detail: 'Water, Electricity (MSEDCL), Municipal department definitions',
    group: 'civic',
    conflictTarget: 'id',
    arrayCols: [],
    jsonCols: [],
    numCols: ['sort_order'],
    boolCols: ['is_active'],
    notNullDefaults: { color_theme: 'blue', sort_order: 1, is_active: true },
    cityScope: 'none',
    optionalTable: true,
    defaultSelected: false,
  },
  {
    key: 'authority_organizations',
    table: 'authority_organizations',
    label: 'Authority Offices & Contacts',
    detail: 'Sub-divisions, helplines, emergency numbers & officer JSONB rosters',
    group: 'civic',
    conflictTarget: 'id',
    arrayCols: ['department_ids'],
    jsonCols: ['key_contacts'],
    numCols: [],
    boolCols: ['is_demo', 'is_verified', 'is_active'],
    notNullDefaults: { department_ids: [], key_contacts: [], is_demo: false, is_verified: false, is_active: true },
    cityScope: 'city_district',
    optionalTable: true,
    defaultSelected: false,
  },
  {
    key: 'authority_announcements',
    table: 'authority_announcements',
    label: 'Civic Outages & Notices',
    detail: 'Scheduled power/water interruptions, maintenance & advisories',
    group: 'civic',
    conflictTarget: 'id',
    arrayCols: ['media_urls'],
    jsonCols: [],
    numCols: [],
    boolCols: ['is_demo'],
    notNullDefaults: { category: 'notice', priority: 'medium', status: 'active', media_urls: [], is_demo: false },
    cityScope: 'city_only',
    optionalTable: true,
    defaultSelected: false,
  },
  {
    key: 'announcement_locations',
    table: 'announcement_locations',
    label: 'Outage Ward Locations',
    detail: 'Ward/village impact targets linked to civic announcements',
    group: 'civic',
    conflictTarget: 'id',
    arrayCols: [],
    jsonCols: [],
    numCols: [],
    boolCols: [],
    notNullDefaults: {},
    cityScope: 'city_only',
    optionalTable: true,
    defaultSelected: false,
  },
  {
    key: 'requests',
    table: 'shop_requests',
    label: 'Listing Requests',
    detail: 'Pending / approved / rejected submissions across shops, mess, PG & schools',
    group: 'moderation',
    conflictTarget: 'id',
    arrayCols: ['amenities', 'photos'],
    jsonCols: ['meta'],
    numCols: ['latitude', 'longitude'],
    boolCols: [],
    notNullDefaults: { status: 'pending', amenities: [], photos: [], entity_type: 'shop', meta: {} },
    cityScope: 'full',
    defaultSelected: true,
  },
  {
    key: 'claims',
    table: 'shop_claims',
    label: 'Shop Ownership Claims',
    detail: 'Claim status, requested shop & claimant verification details',
    group: 'moderation',
    conflictTarget: 'id',
    arrayCols: [],
    jsonCols: [],
    numCols: [],
    boolCols: [],
    notNullDefaults: { status: 'pending' },
    cityScope: 'none',
    defaultSelected: true,
  },
];

export const DATASET_BY_KEY: Record<MasterDatasetKey, MasterDatasetSpec> = Object.fromEntries(
  MASTER_DATASETS.map((spec) => [spec.key, spec])
) as Record<MasterDatasetKey, MasterDatasetSpec>;

export const DATASET_BY_TABLE: Record<string, MasterDatasetSpec> = Object.fromEntries(
  MASTER_DATASETS.map((spec) => [spec.table, spec])
);

export function findDatasetSpec(keyOrTable: string): MasterDatasetSpec | undefined {
  return (
    DATASET_BY_KEY[keyOrTable as MasterDatasetKey] ??
    DATASET_BY_TABLE[keyOrTable]
  );
}

function cloneDefaultValue(val: unknown): unknown {
  if (Array.isArray(val)) return [...val];
  if (val && typeof val === 'object') return JSON.parse(JSON.stringify(val));
  return val;
}

function parseArrayString(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((x) => String(x).trim()).filter(Boolean);
      }
    } catch {
      /* fall through to pipe split */
    }
  }
  return trimmed
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseBooleanString(raw: string): boolean | null {
  const lower = raw.trim().toLowerCase();
  if (lower === 'true' || lower === '1' || lower === 'yes') return true;
  if (lower === 'false' || lower === '0' || lower === 'no') return false;
  return null;
}

export interface CityFallbackInfo {
  id?: string;
  district_id?: string | null;
  state_id?: string | null;
  district?: { state_id?: string | null } | null;
}

/**
 * Coerce a CSV string-map row into a strongly-typed Postgres payload using the
 * schema registry, eliminating NULL constraint (23502) and JSON/array syntax
 * (22P02) round-trip failures.
 */
export function coerceDatasetRow(
  keyOrTable: MasterDatasetKey | string,
  row: Record<string, string>,
  fallbackCity?: CityFallbackInfo
): Record<string, unknown> {
  const spec = findDatasetSpec(keyOrTable);
  const out: Record<string, unknown> = {};

  for (const [k, rawVal] of Object.entries(row)) {
    if (!k) continue;
    const v = rawVal ?? '';

    if (k === 'created_at' || k === 'updated_at') {
      continue;
    }

    if (v === '') {
      if (spec && Object.prototype.hasOwnProperty.call(spec.notNullDefaults, k)) {
        out[k] = cloneDefaultValue(spec.notNullDefaults[k]);
      } else {
        out[k] = null;
      }
      continue;
    }

    if (spec?.arrayCols.includes(k)) {
      out[k] = parseArrayString(v);
      continue;
    }

    if (spec?.jsonCols.includes(k)) {
      try {
        out[k] = JSON.parse(v);
      } catch {
        out[k] =
          spec && Object.prototype.hasOwnProperty.call(spec.notNullDefaults, k)
            ? cloneDefaultValue(spec.notNullDefaults[k])
            : {};
      }
      continue;
    }

    if (spec?.boolCols.includes(k) || v === 'true' || v === 'false') {
      const parsedBool = parseBooleanString(v);
      if (parsedBool !== null) {
        out[k] = parsedBool;
        continue;
      }
    }

    if (spec?.numCols.includes(k) || (/^-?\d+(\.\d+)?$/.test(v) && (k === 'latitude' || k === 'longitude'))) {
      const stripped = v.startsWith("'") ? v.slice(1).trim() : v.trim();
      if (/^-?\d+(\.\d+)?$/.test(stripped)) {
        const parsedNum = Number(stripped);
        out[k] = Number.isFinite(parsedNum) ? parsedNum : null;
      } else if (spec && Object.prototype.hasOwnProperty.call(spec.notNullDefaults, k)) {
        out[k] = cloneDefaultValue(spec.notNullDefaults[k]);
      } else {
        out[k] = null;
      }
      continue;
    }

    out[k] = v;
  }

  // Never send blank id (Postgres uuid column rejects empty string)
  if (!out.id) delete out.id;
  if (out.vacancies_updated_at === null) delete out.vacancies_updated_at;

  // Apply geographic town fallbacks where the target table supports them
  if (spec && fallbackCity?.id) {
    if (spec.cityScope !== 'none' && !out.city_id) {
      out.city_id = fallbackCity.id;
    }
    if ((spec.cityScope === 'city_district' || spec.cityScope === 'full') && !out.district_id && fallbackCity.district_id) {
      out.district_id = fallbackCity.district_id;
    }
    if (spec.cityScope === 'full' && !out.state_id) {
      const fallbackStateId = fallbackCity.district?.state_id ?? fallbackCity.state_id ?? null;
      if (fallbackStateId) out.state_id = fallbackStateId;
    }
  }

  return out;
}
