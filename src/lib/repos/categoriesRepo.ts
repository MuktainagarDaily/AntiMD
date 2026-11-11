/**
 * categoriesRepo — wrapper around `supabase.from('categories')` and the
 * `shop_categories` join table (M:N with shops).
 */
import { supabase } from '@/integrations/supabase/client';
import type { RepoResult } from './types';

export const categoriesRepo = {
  async list(activeOnly = false) {
    let q = supabase.from('categories').select('*').order('name');
    if (activeOnly) q = q.eq('is_active', true);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as any[];
  },

  async get(id: string) {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data as any | null;
  },

  async insert(row: Record<string, any>): Promise<RepoResult<any>> {
    const { data, error } = await supabase
      .from('categories')
      .insert(row as any)
      .select()
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    return { ok: true, row: data };
  },

  async update(id: string, patch: Record<string, any>): Promise<RepoResult<any>> {
    const { data, error } = await supabase
      .from('categories')
      .update(patch as any)
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    return { ok: true, row: data };
  },

  async delete(id: string): Promise<RepoResult<null>> {
    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (error) return { ok: false, error: error.message };
    return { ok: true, row: null };
  },

  /** Join-table helpers for the M:N `shop_categories` link table. */
  links: {
    async listForShop(shopId: string) {
      const { data, error } = await supabase
        .from('shop_categories')
        .select('category_id, categories(id, name, icon, is_active)')
        .eq('shop_id', shopId);
      if (error) throw error;
      return (data ?? []) as any[];
    },

    async replaceForShop(shopId: string, categoryIds: string[]): Promise<RepoResult<null>> {
      const del = await supabase.from('shop_categories').delete().eq('shop_id', shopId);
      if (del.error) return { ok: false, error: del.error.message };
      if (categoryIds.length === 0) return { ok: true, row: null };
      const ins = await supabase
        .from('shop_categories')
        .insert(categoryIds.map((cid) => ({ shop_id: shopId, category_id: cid })) as any);
      if (ins.error) return { ok: false, error: ins.error.message };
      return { ok: true, row: null };
    },
  },
};

export type CategoriesRepo = typeof categoriesRepo;
