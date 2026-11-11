/**
 * requestsRepo — wrapper around `supabase.from('shop_requests')`.
 *
 * `shop_requests` is the public listing-submission table (moderated by admins
 * before they become `shops` rows). Statuses: 'pending' | 'approved' | 'rejected'.
 */
import { supabase } from '@/integrations/supabase/client';
import type { RepoResult } from './types';

export const REQUEST_LIST_SELECT = '*';

export const requestsRepo = {
  async list(status?: 'pending' | 'approved' | 'rejected', select = REQUEST_LIST_SELECT) {
    let q = supabase.from('shop_requests').select(select).order('created_at', { ascending: false });
    if (status) q = q.eq('status', status);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as any[];
  },

  async get(id: string, select = REQUEST_LIST_SELECT) {
    const { data, error } = await supabase
      .from('shop_requests')
      .select(select)
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data as any | null;
  },

  async insert(row: Record<string, any>): Promise<RepoResult<any>> {
    const { data, error } = await supabase
      .from('shop_requests')
      .insert(row as any)
      .select()
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    return { ok: true, row: data };
  },

  async updateStatus(
    id: string,
    status: 'pending' | 'approved' | 'rejected',
    extra: Record<string, any> = {},
  ): Promise<RepoResult<any>> {
    const { data, error } = await supabase
      .from('shop_requests')
      .update({ status, ...extra } as any)
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    return { ok: true, row: data };
  },

  async delete(id: string): Promise<RepoResult<null>> {
    const { error } = await supabase.from('shop_requests').delete().eq('id', id);
    if (error) return { ok: false, error: error.message };
    return { ok: true, row: null };
  },
};

export type RequestsRepo = typeof requestsRepo;
