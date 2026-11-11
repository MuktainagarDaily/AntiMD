/**
 * schoolsRepo — Forge Phase 4 + Full Education Portal Repository.
 *
 * Thin wrapper around `supabase.from('schools')` and `school_owners`,
 * delegating concurrency-checked updates to `updateWithConcurrency`.
 */
import { supabase } from '@/integrations/supabase/client';
import { updateWithConcurrency, type ConcurrencyResult } from '@/lib/concurrency';
import type { RepoResult } from './types';
import type {
  SchoolType,
  SchoolMedium,
  AdmissionStatus,
  ManagementType,
  GenderType,
  FeeTier,
} from '@/lib/schools/schoolHelpers';

/** Card projection used by the admin table + public list. */
export const SCHOOL_LIST_SELECT = '*';

export type { SchoolType, SchoolMedium, AdmissionStatus, ManagementType, GenderType, FeeTier };

export interface SchoolRow {
  id: string;
  slug?: string | null;
  name: string;
  name_mr: string | null;
  school_type: SchoolType;
  medium: SchoolMedium | null;
  mediums?: string[] | null;
  area: string | null;
  sub_area: string | null;
  address: string | null;
  address_mr?: string | null;
  phone: string | null;
  whatsapp?: string | null;
  email: string | null;
  website: string | null;
  description: string | null;
  image_url: string | null;
  photos?: string[] | null;
  latitude: number | null;
  longitude: number | null;
  is_active: boolean;
  is_verified?: boolean;
  is_claimed?: boolean;
  management_type?: ManagementType | null;
  gender_type?: GenderType | null;
  udise_aishe_code?: string | null;
  established_year?: number | null;
  accreditation?: string | null;
  board?: string | null;
  classes_offered?: string | null;
  streams?: string[] | null;
  facilities?: string[] | null;
  principal_name?: string | null;
  office_timing?: string | null;
  admission_status?: AdmissionStatus | null;
  admission_deadline?: string | null;
  admission_url?: string | null;
  prospectus_url?: string | null;
  fee_tier?: FeeTier | null;
  annual_fee_min?: number | null;
  annual_fee_max?: number | null;
  scholarships?: string[] | null;
  required_documents?: string[] | null;
  transport_villages?: string[] | null;
  coaching_focus?: string[] | null;
  total_seats?: number | null;
  available_seats?: number | null;
  meta?: Record<string, any> | null;
  city_id?: string | null;
  village_id?: string | null;
  district_id?: string | null;
  state_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SchoolOwnerRecord {
  id: string;
  school_id: string;
  user_id: string;
  role_title?: string | null;
  role_label?: string | null;
  assigned_at: string;
  created_at?: string;
  school?: SchoolRow | null;
}

interface ListOpts {
  activeOnly?: boolean;
  limit?: number;
  cityId?: string;
  citySlug?: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const schoolsTable = () => (supabase as any).from('schools');
const ownersTable = () => (supabase as any).from('school_owners');

export const LEGACY_SCHOOL_COLUMNS = new Set([
  'name',
  'name_mr',
  'school_type',
  'medium',
  'area',
  'sub_area',
  'address',
  'phone',
  'email',
  'website',
  'description',
  'image_url',
  'photos',
  'latitude',
  'longitude',
  'is_active',
  'city_id',
  'village_id',
  'district_id',
  'state_id',
]);

export function pickLegacySchoolColumns(row: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(row)) {
    if (LEGACY_SCHOOL_COLUMNS.has(k)) out[k] = v;
  }
  return out;
}

export function isMissingSchoolColumnErr(err: any): boolean {
  const code = String(err?.code || '');
  const msg = String(typeof err === 'string' ? err : err?.message || '').toLowerCase();
  return (
    code === '42703' ||
    code === '42P01' ||
    code === 'PGRST204' ||
    code === 'PGRST205' ||
    msg.includes('does not exist') ||
    msg.includes('schema cache') ||
    msg.includes('could not find')
  );
}

const isMissingColumnOrRelation = isMissingSchoolColumnErr;

export const schoolsRepo = {
  async list(opts: ListOpts = {}): Promise<SchoolRow[]> {
    let q = schoolsTable().select(SCHOOL_LIST_SELECT).order('name', { ascending: true });
    if (opts.activeOnly) q = q.eq('is_active', true);
    if (opts.citySlug === 'muktainagar' && opts.cityId) {
      q = q.or(`city_id.eq.${opts.cityId},city_id.is.null`);
    } else if (opts.cityId) {
      q = q.eq('city_id', opts.cityId);
    }
    if (opts.limit) q = q.limit(opts.limit);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as SchoolRow[];
  },

  async get(id: string): Promise<SchoolRow | null> {
    const { data, error } = await schoolsTable()
      .select(SCHOOL_LIST_SELECT)
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return (data ?? null) as SchoolRow | null;
  },

  async getBySlugOrId(idOrSlug: string, cityId?: string): Promise<SchoolRow | null> {
    if (!idOrSlug) return null;
    if (UUID_RE.test(idOrSlug)) {
      return this.get(idOrSlug);
    }

    try {
      let q = schoolsTable().select(SCHOOL_LIST_SELECT).eq('slug', idOrSlug);
      if (cityId) q = q.eq('city_id', cityId);
      const { data, error } = await q.maybeSingle();
      if (error) {
        if (isMissingColumnOrRelation(error)) return null;
        throw error;
      }
      if (data) return data as SchoolRow;

      // Cross-city fallback if cityId filter missed
      if (cityId) {
        const { data: globalMatch } = await schoolsTable()
          .select(SCHOOL_LIST_SELECT)
          .eq('slug', idOrSlug)
          .maybeSingle();
        if (globalMatch) return globalMatch as SchoolRow;
      }
      return null;
    } catch (err) {
      if (isMissingColumnOrRelation(err)) return null;
      throw err;
    }
  },

  async listByOwner(userId: string): Promise<SchoolOwnerRecord[]> {
    if (!userId) return [];
    try {
      const { data, error } = await ownersTable()
        .select('id, school_id, user_id, role_title, assigned_at, schools(*)')
        .eq('user_id', userId);
      if (error) {
        if (isMissingColumnOrRelation(error)) return [];
        throw error;
      }
      return ((data ?? []) as any[])
        .filter((r) => Boolean(r.schools))
        .map((r) => ({
          id: r.id,
          school_id: r.school_id,
          user_id: r.user_id,
          role_title: r.role_title ?? null,
          role_label: r.role_title ?? null,
          assigned_at: r.assigned_at,
          created_at: r.assigned_at,
          school: r.schools as SchoolRow,
        }));
    } catch (err) {
      if (isMissingColumnOrRelation(err)) return [];
      return [];
    }
  },

  async listOwnersForSchool(schoolId: string): Promise<{
    id: string;
    user_id: string;
    role_title: string | null;
    assigned_at: string;
    full_name: string | null;
  }[]> {
    if (!schoolId) return [];
    try {
      const { data, error } = await ownersTable()
        .select('id, user_id, role_title, assigned_at')
        .eq('school_id', schoolId);
      if (error || !data || data.length === 0) return [];

      const userIds = Array.from(new Set(data.map((r: any) => r.user_id)));
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);

      const nameMap = new Map<string, string | null>(
        (profiles ?? []).map((p: any) => [p.id, p.full_name ?? null])
      );

      return (data as any[]).map((r) => ({
        id: r.id,
        user_id: r.user_id,
        role_title: r.role_title ?? null,
        assigned_at: r.assigned_at,
        full_name: nameMap.get(r.user_id) ?? null,
      }));
    } catch {
      return [];
    }
  },

  async insert(row: Record<string, any>): Promise<RepoResult<SchoolRow>> {
    const { data, error } = await schoolsTable().insert(row).select().maybeSingle();
    if (error) {
      if (isMissingColumnOrRelation(error)) {
        const legacyRow = pickLegacySchoolColumns(row);
        const retry = await schoolsTable().insert(legacyRow).select().maybeSingle();
        if (retry.error) return { ok: false, error: retry.error.message };
        return { ok: true, row: retry.data as SchoolRow };
      }
      return { ok: false, error: error.message };
    }
    return { ok: true, row: data as SchoolRow };
  },

  async insertMany(rows: Record<string, any>[]): Promise<{ ok: true } | { ok: false; error: string }> {
    if (rows.length === 0) return { ok: true };
    const { error } = await schoolsTable().insert(rows);
    if (error) {
      if (isMissingColumnOrRelation(error)) {
        const legacyRows = rows.map(pickLegacySchoolColumns);
        const retry = await schoolsTable().insert(legacyRows);
        if (retry.error) return { ok: false, error: retry.error.message };
        return { ok: true };
      }
      return { ok: false, error: error.message };
    }
    return { ok: true };
  },

  async updateWithConcurrency(
    id: string,
    baselineAt: string | null | undefined,
    patch: Record<string, any>,
  ): Promise<ConcurrencyResult<SchoolRow>> {
    const res = await updateWithConcurrency<SchoolRow>('schools', id, baselineAt, patch);
    if (!res.ok && 'error' in res && isMissingColumnOrRelation(res.error)) {
      const legacyPatch = pickLegacySchoolColumns(patch);
      if (Object.keys(legacyPatch).length === 0) return res;
      return updateWithConcurrency<SchoolRow>('schools', id, baselineAt, legacyPatch);
    }
    return res;
  },

  async delete(id: string): Promise<RepoResult<null>> {
    const { error } = await schoolsTable().delete().eq('id', id);
    if (error) return { ok: false, error: error.message };
    return { ok: true, row: null };
  },
};

export type SchoolsRepo = typeof schoolsRepo;
