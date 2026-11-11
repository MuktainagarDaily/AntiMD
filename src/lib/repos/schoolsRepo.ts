/**
 * schoolsRepo — Forge Phase 4 · first non-shop entity on the framework.
 *
 * Thin wrapper around `supabase.from('schools')` following the same shape
 * as `shopsRepo`. Delegates concurrency-checked updates to the generic
 * `updateWithConcurrency` helper (Forge rec #9) — proves the helper works
 * outside shops.
 */
import { supabase } from '@/integrations/supabase/client';
import { updateWithConcurrency, type ConcurrencyResult } from '@/lib/concurrency';
import type { RepoResult } from './types';
import type { SchoolType, SchoolMedium } from '@/lib/schools/schoolHelpers';

/** Card projection used by the admin table + public list. */
export const SCHOOL_LIST_SELECT = '*';

export type { SchoolType, SchoolMedium };

export interface SchoolRow {
  id: string;
  name: string;
  name_mr: string | null;
  school_type: SchoolType;
  medium: SchoolMedium | null;
  area: string | null;
  sub_area: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  description: string | null;
  image_url: string | null;
  photos?: string[] | null;
  latitude: number | null;
  longitude: number | null;
  is_active: boolean;
  city_id?: string | null;
  village_id?: string | null;
  district_id?: string | null;
  state_id?: string | null;
  created_at: string;
  updated_at: string;
}

interface ListOpts {
  activeOnly?: boolean;
  limit?: number;
  cityId?: string;
  citySlug?: string;
}

const schoolsTable = () => (supabase as any).from('schools');

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

  async insert(row: Record<string, any>): Promise<RepoResult<SchoolRow>> {
    const { data, error } = await schoolsTable().insert(row).select().maybeSingle();
    if (error) return { ok: false, error: error.message };
    return { ok: true, row: data as SchoolRow };
  },

  updateWithConcurrency(
    id: string,
    baselineAt: string | null | undefined,
    patch: Record<string, any>,
  ): Promise<ConcurrencyResult<SchoolRow>> {
    return updateWithConcurrency<SchoolRow>('schools', id, baselineAt, patch);
  },

  async delete(id: string): Promise<RepoResult<null>> {
    const { error } = await schoolsTable().delete().eq('id', id);
    if (error) return { ok: false, error: error.message };
    return { ok: true, row: null };
  },
};

export type SchoolsRepo = typeof schoolsRepo;
