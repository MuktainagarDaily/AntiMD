/**
 * claimsRepo — wrapper around `supabase.from('shop_claims')`.
 *
 * Ownership-claim flow: a user uploads proof to `shop-images/claims/<user_id>/…`
 * and inserts a row here; admins moderate. Storage cleanup on insert failure
 * remains the caller's responsibility (see `ClaimShopModal.tsx`) — this repo
 * only handles the row.
 */
import { supabase } from '@/integrations/supabase/client';
import type { RepoResult } from './types';

export const claimsRepo = {
  async listForShop(shopId: string, select = '*') {
    const { data, error } = await supabase
      .from('shop_claims')
      .select(select)
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as any[];
  },

  async listMine(userId: string, select = '*') {
    const { data, error } = await supabase
      .from('shop_claims')
      .select(select)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as any[];
  },

  async insert(row: Record<string, any>): Promise<RepoResult<any>> {
    const { data, error } = await supabase
      .from('shop_claims')
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
      .from('shop_claims')
      .update({ status, ...extra } as any)
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    return { ok: true, row: data };
  },
};

export type ClaimsRepo = typeof claimsRepo;
