/**
 * bannersRepo — wrapper around `supabase.from('banners')`.
 *
 * Banner rows drive the home/section carousels. Uploads live in the shared
 * `shop-images` bucket under the `banners/` prefix (see `lib/banners/store.ts`).
 */
import { supabase } from '@/integrations/supabase/client';
import type { RepoResult } from './types';

export const BANNER_LIST_SELECT = '*';

export const bannersRepo = {
  async list(activeOnly = true, select = BANNER_LIST_SELECT) {
    let q = supabase.from('banners').select(select).order('sort_order', { ascending: true });
    if (activeOnly) q = q.eq('is_active', true);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as any[];
  },

  async insert(row: Record<string, any>): Promise<RepoResult<any>> {
    const { data, error } = await supabase
      .from('banners')
      .insert(row as any)
      .select()
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    return { ok: true, row: data };
  },

  async update(id: string, patch: Record<string, any>): Promise<RepoResult<any>> {
    const { data, error } = await supabase
      .from('banners')
      .update(patch as any)
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    return { ok: true, row: data };
  },

  async delete(id: string): Promise<RepoResult<null>> {
    const { error } = await supabase.from('banners').delete().eq('id', id);
    if (error) return { ok: false, error: error.message };
    return { ok: true, row: null };
  },
};

export type BannersRepo = typeof bannersRepo;
