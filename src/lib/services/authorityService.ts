/**
 * Service for Essential Services & Local Authorities (Water, Power, Municipal).
 * Features:
 *   - Resilient Supabase database access with automatic demo fallbacks.
 *   - Authoritative UUID resolution matching remote PostgreSQL schemas.
 *   - Automatic outage expiry: expired active announcements become 'completed'.
 *   - WhatsApp-ready citizen alert formatting.
 */

import { supabase } from '@/integrations/supabase/client';
import {
  AuthorityDepartment,
  AuthorityOrganization,
  AuthorityAnnouncement,
  AnnouncementStatus,
} from './authorityTypes';

// ---- Authoritative Database UUIDs -----------------------------------------

export const DEPARTMENT_UUIDS = {
  water: '74454c43-6cb7-4493-b2a8-a5b0613e98e5',
  electricity: '93f5f0d9-40b8-4d0f-9849-1ca8fa69d493',
  municipal: 'ae3f554a-3c84-4a29-87c2-71e3eca43dc8',
} as const;

export const ORGANIZATION_UUIDS = {
  water: 'abb01fb9-e141-4e14-81df-f245bf4ec310',
  electricity: '8bb70f3d-b586-4ba5-bfea-ecf43353dd6a',
  municipal: '831f0597-37ad-48d9-b846-9d77d8a1ce8d',
} as const;

export const CITY_MUKTAINAGAR_UUID = '644b68eb-472c-40d3-9f83-c7d26e121498';

// UUID validation and generation helpers
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(id?: string | null): boolean {
  return typeof id === 'string' && UUID_REGEX.test(id);
}

export function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function resolveDepartmentUuid(deptIdOrSlug?: string): string {
  if (deptIdOrSlug && isValidUuid(deptIdOrSlug)) {
    return deptIdOrSlug;
  }
  const s = String(deptIdOrSlug || '').toLowerCase();
  if (s.includes('water')) return DEPARTMENT_UUIDS.water;
  if (s.includes('power') || s.includes('electr') || s.includes('msedcl')) return DEPARTMENT_UUIDS.electricity;
  if (s.includes('muni') || s.includes('council')) return DEPARTMENT_UUIDS.municipal;
  return DEPARTMENT_UUIDS.water;
}

export function resolveOrganizationUuid(deptUuid: string, orgId?: string): string {
  if (orgId && isValidUuid(orgId)) {
    return orgId;
  }
  if (deptUuid === DEPARTMENT_UUIDS.electricity) return ORGANIZATION_UUIDS.electricity;
  if (deptUuid === DEPARTMENT_UUIDS.municipal) return ORGANIZATION_UUIDS.municipal;
  return ORGANIZATION_UUIDS.water;
}

// ---- Baseline Demo Fixtures (Demo-First Compliance) ------------------------

export const DEMO_DEPARTMENTS: AuthorityDepartment[] = [
  {
    id: DEPARTMENT_UUIDS.water,
    slug: 'water',
    name: 'Water Supply Department',
    name_mr: 'पाणी पुरवठा विभाग',
    icon: 'Droplets',
    color_theme: 'blue',
    sort_order: 1,
    is_active: true,
  },
  {
    id: DEPARTMENT_UUIDS.electricity,
    slug: 'electricity',
    name: 'Electricity Department (MSEDCL)',
    name_mr: 'वीज वितरण विभाग (महावितरण)',
    icon: 'Zap',
    color_theme: 'amber',
    sort_order: 2,
    is_active: true,
  },
  {
    id: DEPARTMENT_UUIDS.municipal,
    slug: 'municipal',
    name: 'Municipal Council & Local Body',
    name_mr: 'नगरपंचायत व स्थानिक प्रशासन',
    icon: 'Building2',
    color_theme: 'emerald',
    sort_order: 3,
    is_active: true,
  },
];

export const DEMO_ORGANIZATIONS: AuthorityOrganization[] = [
  {
    id: ORGANIZATION_UUIDS.water,
    department_ids: [DEPARTMENT_UUIDS.water],
    city_id: CITY_MUKTAINAGAR_UUID,
    name: 'Muktainagar Water Services [DEMO SIMULATION]',
    name_mr: 'मुक्ताईनगर पाणी पुरवठा विभाग [डेमो सिम्युलेशन]',
    office_address: 'Near Old Water Tank, Main Road, Muktainagar',
    maps_url: 'https://maps.google.com/?q=21.0758,75.9817',
    visiting_hours: '10:30 AM - 05:30 PM (Mon-Sat)',
    helpline_phone: '02583-222101',
    emergency_phone: '9822001100',
    whatsapp_number: '919822001100',
    email: 'water-demo@apnalocal.in',
    key_contacts: [
      { id: 'kc-1', role: 'Section Engineer (Water)', name: 'Shri R. P. Patil', phone: '9822001100' },
      { id: 'kc-2', role: 'Line Inspector (Ward 1-5)', name: 'Sunil Wagh', phone: '9822001103' },
    ],
    is_demo: true,
    is_verified: false,
    is_active: true,
  },
  {
    id: ORGANIZATION_UUIDS.electricity,
    department_ids: [DEPARTMENT_UUIDS.electricity],
    city_id: CITY_MUKTAINAGAR_UUID,
    name: 'Muktainagar Electricity Sub-Division [DEMO SIMULATION]',
    name_mr: 'मुक्ताईनगर वीज वितरण उपविभाग [डेमो सिम्युलेशन]',
    office_address: 'MSEDCL Substation, Malkapur Road, Muktainagar',
    maps_url: 'https://maps.google.com/?q=21.0730,75.9890',
    visiting_hours: '10:00 AM - 05:00 PM (Cash/Bill Desk till 03:30 PM)',
    helpline_phone: '1912',
    emergency_phone: '02583-222102',
    whatsapp_number: '919822001101',
    email: 'msedcl-demo@apnalocal.in',
    key_contacts: [
      { id: 'kc-3', role: 'Assistant Engineer (MSEDCL)', name: 'Er. V. S. Sonawane', phone: '02583-222102' },
      { id: 'kc-4', role: 'Feeder Breakdown Technician', name: 'Ganesh Mahajan', phone: '9822001104' },
    ],
    is_demo: true,
    is_verified: false,
    is_active: true,
  },
  {
    id: ORGANIZATION_UUIDS.municipal,
    department_ids: [DEPARTMENT_UUIDS.municipal],
    city_id: CITY_MUKTAINAGAR_UUID,
    name: 'Muktainagar Municipal Council [DEMO SIMULATION]',
    name_mr: 'मुक्ताईनगर नगरपंचायत [डेमो सिम्युलेशन]',
    office_address: 'Nagar Panchayat Complex, Shivaji Chowk, Muktainagar',
    maps_url: 'https://maps.google.com/?q=21.0765,75.9805',
    visiting_hours: '10:30 AM - 05:30 PM (Citizen facilitation desk)',
    helpline_phone: '02583-222103',
    emergency_phone: '9822001102',
    whatsapp_number: '919822001102',
    email: 'admin-demo@apnalocal.in',
    key_contacts: [
      { id: 'kc-5', role: 'Chief Officer (Muni Council)', name: 'Shri A. K. Deshmukh', phone: '02583-222103' },
      { id: 'kc-6', role: 'Sanitation Inspector', name: 'Pravin Joshi', phone: '9822001105' },
    ],
    is_demo: true,
    is_verified: false,
    is_active: true,
  },
];

const now = new Date();
const inHours = (h: number) => new Date(now.getTime() + h * 3600 * 1000).toISOString();
const agoHours = (h: number) => new Date(now.getTime() - h * 3600 * 1000).toISOString();

export const DEMO_ANNOUNCEMENTS: AuthorityAnnouncement[] = [
  {
    id: '19530f2f-00d4-471f-b3e7-8a3958fb9a8a',
    org_id: ORGANIZATION_UUIDS.water,
    department_id: DEPARTMENT_UUIDS.water,
    city_id: CITY_MUKTAINAGAR_UUID,
    title: 'Emergency Pipeline Repair at Station Road [DEMO]',
    title_mr: 'स्टेशन रोड येथे मुख्य जलवाहिनी तातडीची दुरुस्ती [डेमो]',
    description:
      'Water supply will remain suspended for 4 hours due to urgent main conduit weld repair at Station Road junction.',
    description_mr:
      'स्टेशन रोड चौकातील मुख्य जलवाहिनीच्या वेल्डिंग दुरुस्तीमुळे प्रभाग क्र. २ व स्टेशन रोड परिसराचा पाणीपुरवठा ४ तास बंद राहील.',
    category: 'interruption',
    priority: 'high',
    status: 'active',
    start_time: agoHours(1),
    end_time: inHours(3),
    published_at: agoHours(1),
    is_demo: true,
    media_urls: [],
    department: DEMO_DEPARTMENTS[0],
    organization: DEMO_ORGANIZATIONS[0],
    locations: [
      {
        city_id: CITY_MUKTAINAGAR_UUID,
        area_text: 'Station Road, Ward No. 2, Shivaji Chowk',
      },
    ],
  },
  {
    id: 'a8655469-30b0-4253-baac-297e20f1fbf3',
    org_id: ORGANIZATION_UUIDS.electricity,
    department_id: DEPARTMENT_UUIDS.electricity,
    city_id: CITY_MUKTAINAGAR_UUID,
    title: 'Scheduled Transformer & Feeder Maintenance [DEMO]',
    title_mr: 'ट्रान्सफॉर्मर व फिडरचे नियोजित देखभाल काम [डेमो]',
    description:
      'Routine pre-summer feeder maintenance and tree trimming across Ward 3 and College Road.',
    description_mr:
      'उन्हाळापूर्व नियोजित फिडर देखभाल व झाडांच्या फांद्या छाटणीसाठी प्रभाग क्र. ३ आणि कॉलेज रोड परिसराचा वीजपुरवठा उद्या सकाळी १० ते दुपारी २ बंद राहील.',
    category: 'maintenance',
    priority: 'medium',
    status: 'scheduled',
    start_time: inHours(14),
    end_time: inHours(18),
    published_at: agoHours(4),
    is_demo: true,
    media_urls: [],
    department: DEMO_DEPARTMENTS[1],
    organization: DEMO_ORGANIZATIONS[1],
    locations: [
      {
        city_id: CITY_MUKTAINAGAR_UUID,
        area_text: 'Ward No. 3, College Road, Vidyanagar',
      },
    ],
  },
  {
    id: '821ef7ee-641c-41b0-a801-623e6160893d',
    org_id: ORGANIZATION_UUIDS.municipal,
    department_id: DEPARTMENT_UUIDS.municipal,
    city_id: CITY_MUKTAINAGAR_UUID,
    title: 'Civic Drainage & Sanitation Drive Advisory [DEMO]',
    title_mr: 'नागरिक स्वच्छता व गटार उपसा मोहीम सूचना [डेमो]',
    description:
      'Municipal sanitation teams are carrying out deep drain desilting across all wards. Citizens are requested to park vehicles clear of primary drainage paths.',
    description_mr:
      'पावसाळापूर्व गटार उपसा व स्वच्छता मोहीम सुरू असून नागरिकांनी वाहने मुख्य नाल्यांवर किंवा रस्त्यावर अडथळा निर्माण होणार नाही अशी लावावीत.',
    category: 'advisory',
    priority: 'low',
    status: 'active',
    start_time: agoHours(24),
    end_time: inHours(72),
    published_at: agoHours(24),
    is_demo: true,
    media_urls: [],
    department: DEMO_DEPARTMENTS[2],
    organization: DEMO_ORGANIZATIONS[2],
    locations: [
      {
        city_id: CITY_MUKTAINAGAR_UUID,
        area_text: 'Town-wide (सर्व प्रभाग व मुख्य रस्ते)',
      },
    ],
  },
  {
    id: '5b22596e-52fa-48f8-8ec7-d1a129d20c3a',
    org_id: ORGANIZATION_UUIDS.electricity,
    department_id: DEPARTMENT_UUIDS.electricity,
    city_id: CITY_MUKTAINAGAR_UUID,
    title: 'Substation Cable Repair Completed [DEMO]',
    title_mr: 'उपकेंद्र केबल दुरुस्ती यशस्वीरीत्या पूर्ण [डेमो]',
    description:
      'Underground high-tension cable fault at Substation No. 1 has been repaired and power restored to all consumers.',
    description_mr:
      'उपकेंद्र क्र. १ येथील भूमिगत उच्चदाब वाहिनी दुरुस्त करण्यात आली असून वीजपुरवठा पूर्ववत सुरू करण्यात आला आहे.',
    category: 'interruption',
    priority: 'high',
    status: 'completed',
    start_time: agoHours(48),
    end_time: agoHours(44),
    published_at: agoHours(48),
    is_demo: true,
    media_urls: [],
    department: DEMO_DEPARTMENTS[1],
    organization: DEMO_ORGANIZATIONS[1],
    locations: [
      {
        city_id: CITY_MUKTAINAGAR_UUID,
        area_text: 'Industrial Area, Malkapur Road',
      },
    ],
  },
];

// ---- Local Runtime Store with Browser Persistence -------------------------

const LOCAL_STORAGE_KEY = 'apnalocal.runtime_announcements';
const SESSION_STORAGE_ORGS_KEY = 'apnalocal.runtime_organizations';
const LEGACY_STORAGE_ORGS_KEY = 'apnalocal.runtime_organizations';

// In-memory store for active session (SEC-09: prevents unencrypted PII written to persistent localStorage)
let memoryOrganizations: AuthorityOrganization[] | null = null;

export function resetRuntimeOrganizationsStore(): void {
  memoryOrganizations = null;
}

export function getRuntimeOrganizations(): AuthorityOrganization[] {
  // Defensively clear any historical unencrypted PII from persistent localStorage (SEC-09)
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(LEGACY_STORAGE_ORGS_KEY);
    } catch {
      /* ignore */
    }
  }

  if (memoryOrganizations && memoryOrganizations.length > 0) {
    return [...memoryOrganizations];
  }

  // In DEV mode, honor session-only cache to preserve mock edits during page transitions
  if (typeof window !== 'undefined' && import.meta.env.DEV) {
    try {
      const raw = window.sessionStorage.getItem(SESSION_STORAGE_ORGS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          memoryOrganizations = parsed;
          return [...memoryOrganizations];
        }
      }
    } catch {
      /* ignore parse errors */
    }
  }

  memoryOrganizations = [...DEMO_ORGANIZATIONS];
  return [...memoryOrganizations];
}

export function saveRuntimeOrganizations(list: AuthorityOrganization[]): void {
  memoryOrganizations = [...list];
  if (typeof window === 'undefined') return;
  // SEC-09: Never write officer PII to persistent localStorage. Only keep in sessionStorage in DEV.
  if (import.meta.env.DEV) {
    try {
      window.sessionStorage.setItem(SESSION_STORAGE_ORGS_KEY, JSON.stringify(list));
    } catch {
      /* ignore storage errors */
    }
  }
}

function getRuntimeStore(): AuthorityAnnouncement[] {
  if (typeof window === 'undefined') return [...DEMO_ANNOUNCEMENTS];
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    /* ignore parse errors */
  }
  return [...DEMO_ANNOUNCEMENTS];
}

function saveRuntimeStore(list: AuthorityAnnouncement[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* ignore storage errors */
  }
}

/**
 * Computes automatic expiry for an announcement.
 * If status is 'active' and end_time has passed, it is marked as 'completed'.
 */
export function processAnnouncementExpiry(ann: AuthorityAnnouncement): AuthorityAnnouncement {
  if (ann.status === 'active' && ann.end_time) {
    const end = new Date(ann.end_time).getTime();
    if (!isNaN(end) && end < Date.now()) {
      return {
        ...ann,
        status: 'completed',
        isExpiredOutage: true,
      };
    }
  }
  return ann;
}

/**
 * Fetch all authority departments.
 * Demo fallback is strictly limited to DEV/test simulation; production returns live rows only.
 */
export async function fetchDepartments(): Promise<AuthorityDepartment[]> {
  try {
    const { data, error } = await (supabase as any)
      .from('authority_departments')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (!error && data && data.length > 0) {
      return data;
    }
    if (error && !import.meta.env.DEV) {
      throw error;
    }
  } catch (err) {
    if (!import.meta.env.DEV) throw err;
  }
  return import.meta.env.DEV ? DEMO_DEPARTMENTS : [];
}

/**
 * Fetch organizations in a city.
 * Production reads exclusively from Supabase; DEV mode overlays the session runtime store for prototype testing.
 */
export async function fetchOrganizationsForCity(cityId?: string): Promise<AuthorityOrganization[]> {
  let dbOrgs: AuthorityOrganization[] = [];

  try {
    let query = (supabase as any).from('authority_organizations').select('*');
    if (cityId && isValidUuid(cityId)) {
      query = query.eq('city_id', cityId);
    }
    const { data, error } = await query;
    if (error && !import.meta.env.DEV) {
      throw error;
    }
    if (!error && data && data.length > 0) {
      dbOrgs = data;
    }
  } catch (err) {
    if (!import.meta.env.DEV) throw err;
  }

  if (!import.meta.env.DEV) {
    return dbOrgs;
  }

  const localOrgs = getRuntimeOrganizations().filter((o) => !cityId || o.city_id === cityId);
  const map = new Map<string, AuthorityOrganization>();

  // 1. Put database records first
  for (const org of dbOrgs) {
    map.set(org.id, org);
  }
  // 2. Overlay local runtime store (DEV prototype testing only)
  for (const org of localOrgs) {
    const existing = map.get(org.id);
    map.set(org.id, {
      ...existing,
      ...org,
      key_contacts: org.key_contacts || existing?.key_contacts || [],
    });
  }

  return Array.from(map.values());
}

/**
 * Saves/updates contact details, emergency lines, office address, and officer roster for a department organization.
 */
export async function saveOrganizationContact(
  orgData: Partial<AuthorityOrganization> & { id: string }
): Promise<AuthorityOrganization> {
  if (!import.meta.env.DEV) {
    if (!isValidUuid(orgData.id)) {
      throw new Error('Invalid organization ID');
    }
    const updatedAt = new Date().toISOString();
    const payload: any = { updated_at: updatedAt };
    if (orgData.name !== undefined) payload.name = orgData.name;
    if (orgData.name_mr !== undefined) payload.name_mr = orgData.name_mr;
    if (orgData.office_address !== undefined) payload.office_address = orgData.office_address;
    if (orgData.helpline_phone !== undefined) payload.helpline_phone = orgData.helpline_phone;
    if (orgData.emergency_phone !== undefined) payload.emergency_phone = orgData.emergency_phone;
    if (orgData.whatsapp_number !== undefined) payload.whatsapp_number = orgData.whatsapp_number;
    if (orgData.email !== undefined) payload.email = orgData.email;
    if (orgData.maps_url !== undefined) payload.maps_url = orgData.maps_url;
    if (orgData.visiting_hours !== undefined) payload.visiting_hours = orgData.visiting_hours;
    if (orgData.key_contacts !== undefined) payload.key_contacts = orgData.key_contacts;
    if (orgData.is_active !== undefined) payload.is_active = orgData.is_active;

    const { data, error } = await (supabase as any)
      .from('authority_organizations')
      .update(payload)
      .eq('id', orgData.id)
      .select()
      .single();

    if (error) throw error;
    return data as AuthorityOrganization;
  }

  const orgs = getRuntimeOrganizations();
  const existingIdx = orgs.findIndex((o) => o.id === orgData.id);
  const baseline =
    existingIdx >= 0
      ? orgs[existingIdx]
      : DEMO_ORGANIZATIONS.find((o) => o.id === orgData.id) || DEMO_ORGANIZATIONS[0];

  const updated: AuthorityOrganization = {
    ...baseline,
    ...orgData,
    updated_at: new Date().toISOString(),
  };

  if (existingIdx >= 0) {
    orgs[existingIdx] = updated;
  } else {
    orgs.push(updated);
  }
  saveRuntimeOrganizations(orgs);

  // Attempt Supabase update if an authenticated user session is active
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData?.session?.user && isValidUuid(updated.id)) {
      const payload: any = {
        name: updated.name,
        name_mr: updated.name_mr,
        office_address: updated.office_address,
        helpline_phone: updated.helpline_phone,
        emergency_phone: updated.emergency_phone,
        whatsapp_number: updated.whatsapp_number,
        email: updated.email,
        updated_at: updated.updated_at,
      };
      if (updated.maps_url !== undefined) payload.maps_url = updated.maps_url;
      if (updated.visiting_hours !== undefined) payload.visiting_hours = updated.visiting_hours;
      if (updated.key_contacts !== undefined) payload.key_contacts = updated.key_contacts;
      if (updated.is_active !== undefined) payload.is_active = updated.is_active;

      const { error } = await (supabase as any)
        .from('authority_organizations')
        .update(payload)
        .eq('id', updated.id);

      if (error) {
        console.info('[authorityService] Database org write notice:', error.message);
      }
    }
  } catch (err: any) {
    console.info('[authorityService] Local org store updated:', err?.message || err);
  }

  return updated;
}

/**
 * Fetch announcements for a given city with optional filters and automatic expiry.
 * Production reads exclusively from Supabase (never mixing localStorage/DEMO records).
 */
export async function fetchAnnouncementsForCity(
  cityId?: string,
  options?: {
    departmentSlug?: string;
    status?: string;
    includeDrafts?: boolean;
    villageId?: string | null;
  }
): Promise<AuthorityAnnouncement[]> {
  let dbAnnouncements: AuthorityAnnouncement[] = [];

  try {
    let query = (supabase as any)
      .from('authority_announcements')
      .select(`
        *,
        department:authority_departments(*),
        organization:authority_organizations(*),
        locations:announcement_locations(*)
      `)
      .order('published_at', { ascending: false });

    if (cityId && isValidUuid(cityId)) {
      query = query.eq('city_id', cityId);
    }

    if (!import.meta.env.DEV) {
      query = query.eq('is_demo', false);
      if (!options?.includeDrafts) {
        query = query.lte('published_at', new Date().toISOString());
      }
    }

    const { data, error } = await query;
    if (error && !import.meta.env.DEV) {
      throw error;
    }
    if (!error && data && data.length > 0) {
      dbAnnouncements = data.map((item: any) => ({
        ...item,
        department: item.department || (import.meta.env.DEV ? DEMO_DEPARTMENTS.find((d) => d.id === item.department_id) : undefined),
        organization: item.organization || (import.meta.env.DEV ? DEMO_ORGANIZATIONS.find((o) => o.id === item.org_id) : undefined),
      }));
    }
  } catch (err) {
    if (!import.meta.env.DEV) throw err;
  }

  let announcements: AuthorityAnnouncement[];
  if (import.meta.env.DEV) {
    // Merge database items with local runtime items (DEV prototype simulation only)
    const localList = getRuntimeStore().filter((a) => !cityId || a.city_id === cityId);
    const mergedMap = new Map<string, AuthorityAnnouncement>();

    for (const ann of dbAnnouncements) {
      mergedMap.set(ann.id, ann);
    }
    for (const ann of localList) {
      mergedMap.set(ann.id, ann);
    }
    announcements = Array.from(mergedMap.values());
  } else {
    announcements = dbAnnouncements;
  }

  // 1. Apply Automatic Expiry calculation
  let processed = announcements.map(processAnnouncementExpiry);

  // 2. Filter by department if requested
  if (options?.departmentSlug && options.departmentSlug !== 'all') {
    processed = processed.filter(
      (a) => a.department?.slug === options.departmentSlug || a.department_id === options.departmentSlug
    );
  }

  // 3. Filter by status if requested
  if (options?.status && options.status !== 'all') {
    processed = processed.filter((a) => a.status === options.status);
  } else if (!options?.includeDrafts) {
    // Hide drafts by default on public surfaces
    processed = processed.filter((a) => a.status !== 'draft');
  }

  // 4. Filter by village if requested (matching city-wide or village-targeted)
  if (options?.villageId) {
    processed = processed.filter((a) => {
      if (!a.locations || a.locations.length === 0) return true;
      return a.locations.some((l) => !l.village_id || l.village_id === options.villageId);
    });
  }

  return processed;
}

/**
 * Returns active high or critical announcements for the emergency homepage banner.
 */
export async function fetchActiveCriticalAlerts(cityId?: string): Promise<AuthorityAnnouncement[]> {
  const all = await fetchAnnouncementsForCity(cityId, { status: 'active' });
  return all.filter((a) => a.priority === 'critical' || a.priority === 'high');
}

/**
 * Saves (inserts or updates) an announcement.
 * Resolves valid UUIDs across all foreign keys to prevent PostgreSQL syntax errors (HTTP 400).
 * Gracefully persists to local storage and syncs to Supabase if an authenticated session exists.
 */
export async function saveAnnouncement(
  data: Partial<AuthorityAnnouncement>
): Promise<AuthorityAnnouncement> {
  const nowStr = new Date().toISOString();
  const id = data.id && isValidUuid(data.id) ? data.id : generateUuid();
  const departmentId = resolveDepartmentUuid(data.department_id || data.department?.id || data.department?.slug);
  const department =
    data.department || DEMO_DEPARTMENTS.find((d) => d.id === departmentId) || DEMO_DEPARTMENTS[0];
  const orgId = resolveOrganizationUuid(departmentId, data.org_id || data.organization?.id);
  const organization =
    data.organization || DEMO_ORGANIZATIONS.find((o) => o.id === orgId) || DEMO_ORGANIZATIONS[0];
  const cityId = data.city_id && isValidUuid(data.city_id) ? data.city_id : CITY_MUKTAINAGAR_UUID;

  const toSafeIso = (val?: string | null): string | null => {
    if (!val || typeof val !== 'string' || !val.trim()) return null;
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d.toISOString();
  };

  const fullRecord: AuthorityAnnouncement = {
    id,
    org_id: orgId,
    department_id: departmentId,
    city_id: cityId,
    title: data.title?.trim() || 'Untitled Notice',
    title_mr: data.title_mr?.trim() || data.title?.trim() || 'शीर्षक',
    description: data.description?.trim() || '',
    description_mr: data.description_mr?.trim() || data.description?.trim() || '',
    category: data.category || 'notice',
    priority: data.priority || 'medium',
    status: data.status || 'draft',
    start_time: toSafeIso(data.start_time),
    end_time: toSafeIso(data.end_time),
    published_at: toSafeIso(data.published_at) || nowStr,
    media_urls: Array.isArray(data.media_urls) ? data.media_urls : [],
    is_demo: data.is_demo ?? false,
    department,
    organization,
    locations: data.locations || [],
  };

  if (!import.meta.env.DEV) {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData?.session?.user) {
      throw new Error('Authentication required to publish civic announcements.');
    }

    const { error: upsertError } = await (supabase as any).from('authority_announcements').upsert({
      id: fullRecord.id,
      org_id: fullRecord.org_id,
      department_id: fullRecord.department_id,
      city_id: fullRecord.city_id,
      title: fullRecord.title,
      title_mr: fullRecord.title_mr,
      description: fullRecord.description,
      description_mr: fullRecord.description_mr,
      category: fullRecord.category,
      priority: fullRecord.priority,
      status: fullRecord.status,
      start_time: fullRecord.start_time,
      end_time: fullRecord.end_time,
      published_at: fullRecord.published_at,
      media_urls: fullRecord.media_urls,
      is_demo: fullRecord.is_demo,
    });
    if (upsertError) throw upsertError;

    if (fullRecord.locations && fullRecord.locations.length > 0) {
      await (supabase as any).from('announcement_locations').delete().eq('announcement_id', fullRecord.id);
      const locationRows = fullRecord.locations.map((loc) => ({
        announcement_id: fullRecord.id,
        city_id: fullRecord.city_id,
        village_id: isValidUuid(loc.village_id) ? loc.village_id : null,
        area_text: loc.area_text || 'Town-wide',
      }));
      const { error: locErr } = await (supabase as any).from('announcement_locations').insert(locationRows);
      if (locErr) throw locErr;
    }

    return processAnnouncementExpiry(fullRecord);
  }

  // 1. In DEV/test mode, persist to runtime store so prototype simulation works offline
  const store = getRuntimeStore();
  const existingIndex = store.findIndex((a) => a.id === id);
  if (existingIndex >= 0) {
    store[existingIndex] = fullRecord;
  } else {
    store.unshift(fullRecord);
  }
  saveRuntimeStore(store);

  // 2. Only attempt remote Supabase write if an active authenticated user session exists
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData?.session?.user) {
      const { error: upsertError } = await (supabase as any).from('authority_announcements').upsert({
        id: fullRecord.id,
        org_id: fullRecord.org_id,
        department_id: fullRecord.department_id,
        city_id: fullRecord.city_id,
        title: fullRecord.title,
        title_mr: fullRecord.title_mr,
        description: fullRecord.description,
        description_mr: fullRecord.description_mr,
        category: fullRecord.category,
        priority: fullRecord.priority,
        status: fullRecord.status,
        start_time: fullRecord.start_time,
        end_time: fullRecord.end_time,
        published_at: fullRecord.published_at,
        media_urls: fullRecord.media_urls,
        is_demo: fullRecord.is_demo,
      });

      if (upsertError) {
        // Log friendly note without crashing the client
        console.info('[authorityService] Database sync notice (using local store):', upsertError.message);
      } else if (fullRecord.locations && fullRecord.locations.length > 0) {
        // Upsert geographic targets
        const locationRows = fullRecord.locations.map((loc) => ({
          announcement_id: fullRecord.id,
          city_id: fullRecord.city_id,
          village_id: isValidUuid(loc.village_id) ? loc.village_id : null,
          area_text: loc.area_text || 'Town-wide',
        }));
        await (supabase as any).from('announcement_locations').insert(locationRows);
      }
    }
  } catch (err: any) {
    console.info('[authorityService] Local simulation active:', err?.message || err);
  }

  return processAnnouncementExpiry(fullRecord);
}

/**
 * Toggles or updates status of an announcement.
 */
export async function updateAnnouncementStatus(
  id: string,
  newStatus: AnnouncementStatus
): Promise<boolean> {
  if (!import.meta.env.DEV) {
    if (!isValidUuid(id)) throw new Error('Invalid announcement ID');
    const { error } = await (supabase as any)
      .from('authority_announcements')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
    return true;
  }

  const store = getRuntimeStore();
  const found = store.find((a) => a.id === id);
  if (found) {
    found.status = newStatus;
    saveRuntimeStore(store);
  }

  if (isValidUuid(id)) {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session?.user) {
        await (supabase as any)
          .from('authority_announcements')
          .update({ status: newStatus, updated_at: new Date().toISOString() })
          .eq('id', id);
      }
    } catch {
      /* ignore */
    }
  }

  return true;
}

/**
 * Deletes an announcement.
 */
export async function deleteAnnouncement(id: string): Promise<boolean> {
  if (!import.meta.env.DEV) {
    if (!isValidUuid(id)) throw new Error('Invalid announcement ID');
    const { error } = await (supabase as any).from('authority_announcements').delete().eq('id', id);
    if (error) throw error;
    return true;
  }

  const store = getRuntimeStore();
  const nextStore = store.filter((a) => a.id !== id);
  saveRuntimeStore(nextStore);

  if (isValidUuid(id)) {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session?.user) {
        await (supabase as any).from('authority_announcements').delete().eq('id', id);
      }
    } catch {
      /* ignore */
    }
  }

  return true;
}

/**
 * Formats a 1-tap WhatsApp Forward alert message for local neighborhood/family groups.
 */
export function formatAnnouncementWhatsAppShare(
  ann: AuthorityAnnouncement,
  townName: string,
  locale: 'en' | 'mr' = 'en'
): string {
  const isMr = locale === 'mr';
  const title = isMr ? ann.title_mr || ann.title : ann.title;
  const desc = isMr ? ann.description_mr || ann.description : ann.description;
  const deptName = isMr ? ann.department?.name_mr || ann.department?.name : ann.department?.name;

  let emoji = '📢';
  if (ann.priority === 'critical' || ann.priority === 'high') emoji = '🚨';
  else if (ann.department?.slug === 'water') emoji = '💧';
  else if (ann.department?.slug === 'electricity') emoji = '⚡';
  else if (ann.department?.slug === 'municipal') emoji = '🏛️';

  const formatDt = (iso?: string | null) => {
    if (!iso) return isMr ? 'लागू नाही' : 'N/A';
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(isMr ? 'mr-IN' : 'en-IN', {
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return iso;
    }
  };

  const areas = ann.locations?.map((l) => l.area_text).filter(Boolean).join(', ') || (isMr ? 'संपूर्ण शहर' : 'Entire Town');
  const helpline = ann.organization?.emergency_phone || ann.organization?.helpline_phone || 'N/A';
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://apnatown.in';
  const url = `${origin}/${townName.toLowerCase()}/services`;

  if (isMr) {
    return [
      `${emoji} *स्थानिक नागरी सूचना | ${townName}*`,
      `*${title}*`,
      ``,
      `🏢 *विभाग:* ${deptName || 'स्थानिक प्रशासन'}`,
      `📍 *बाधित परिसर:* ${areas}`,
      `⏰ *वेळ:* ${formatDt(ann.start_time)} ते ${formatDt(ann.end_time)}`,
      `📞 *हेल्पलाईन:* ${helpline}`,
      ``,
      `📝 *तपशील:* ${desc}`,
      ...(ann.is_demo ? [``, `⚠️ _[डेमो सिम्युलेशन — सराव सूचना]_`] : [``]),
      `👉 अधिक माहिती व थेट संपर्क ApnaTown वर पहा:`,
      `${url}`,
    ].join('\n');
  }

  return [
    `${emoji} *Civic & Essential Services Alert | ${townName}*`,
    `*${title}*`,
    ``,
    `🏢 *Department:* ${deptName || 'Local Authority'}`,
    `📍 *Affected Areas:* ${areas}`,
    `⏰ *Window:* ${formatDt(ann.start_time)} to ${formatDt(ann.end_time)}`,
    `📞 *Helpline:* ${helpline}`,
    ``,
    `📝 *Details:* ${desc}`,
    ...(ann.is_demo ? [``, `⚠️ _[DEMO SIMULATION — Illustrative Testing Update]_`] : [``]),
    `👉 View live updates & official contacts on ApnaTown:`,
    `${url}`,
  ].join('\n');
}
