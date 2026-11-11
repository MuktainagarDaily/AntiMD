/**
 * shopsRepo — thin wrapper around `supabase.from('shops')`.
 *
 * Responsibilities:
 *   • Centralise the SELECT projections the UI uses (list card / detail).
 *   • Enforce `OWNER_EDITABLE_FIELDS` whitelist via `updateOwner()`.
 *   • Delegate concurrency-checked updates to `shopConcurrency.ts` so the
 *     three-branch conflict contract stays a single implementation.
 *
 * Non-goals: no generic query builder, no ORM. Callers that need bespoke
 * shape can still hit `.from('shops')` directly — the migration is opt-in.
 */
import { supabase } from '@/integrations/supabase/client';
import {
  OWNER_EDITABLE_FIELDS,
  updateShopWithConcurrency,
  type ShopUpdateResult,
} from '@/lib/shopConcurrency';
import { pickFields, type RepoResult } from './types';

/** Standard card projection (matches ShopCard/Home queries). */
export const SHOP_CARD_SELECT =
  '*, shop_categories(category_id, categories(id, name, icon, is_active))';

export interface ListShopsOptions {
  select?: string;
  limit?: number;
  activeOnly?: boolean;
  order?: { column: string; ascending?: boolean };
}

export const shopsRepo = {
  /**
   * List shops. Defaults to the card projection ordered newest-first.
   * Pass `select` to override the projection when migrating an existing call site
   * — mirror the caller's original `.select(…)` string verbatim to avoid subtle
   * shape drift (Sentinel guardrail).
   */
  async list(opts: ListShopsOptions = {}) {
    const {
      select = SHOP_CARD_SELECT,
      limit,
      activeOnly = false,
      order = { column: 'created_at', ascending: false },
    } = opts;
    let q = supabase.from('shops').select(select);
    if (activeOnly) q = q.eq('is_active', true);
    q = q.order(order.column, { ascending: order.ascending ?? false });
    if (limit) q = q.limit(limit);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as any[];
  },

  /** Get a single shop by id (or slug — pass column='slug'). */
  async get(idOrSlug: string, column: 'id' | 'slug' = 'id', select = SHOP_CARD_SELECT) {
    const { data, error } = await supabase
      .from('shops')
      .select(select)
      .eq(column, idOrSlug)
      .maybeSingle();
    if (error) throw error;
    return data as any | null;
  },

  /** Insert a shop row. Returns the inserted row. */
  async insert(row: Record<string, any>): Promise<RepoResult<any>> {
    const { data, error } = await supabase
      .from('shops')
      .insert(row as any)
      .select()
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    return { ok: true, row: data };
  },

  /**
   * Owner update — whitelisted fields only + optimistic concurrency.
   * `baselineAt` is the `updated_at` the owner last read.
   */
  updateOwner(
    shopId: string,
    baselineAt: string | null | undefined,
    patch: Record<string, any>,
  ): Promise<ShopUpdateResult> {
    const safe = pickFields(patch, OWNER_EDITABLE_FIELDS);
    return updateShopWithConcurrency(shopId, baselineAt, safe);
  },

  /**
   * Admin update — no field whitelist, but still concurrency-checked.
   * Admins may write moderation flags (`is_active`, `is_verified`, `slug`, etc.)
   * on top of owner-editable fields.
   */
  updateAdmin(
    shopId: string,
    baselineAt: string | null | undefined,
    patch: Record<string, any>,
  ): Promise<ShopUpdateResult> {
    return updateShopWithConcurrency(shopId, baselineAt, patch);
  },

  /** Delete a shop row. RLS enforces admin-only. */
  async delete(shopId: string): Promise<RepoResult<null>> {
    const { error } = await supabase.from('shops').delete().eq('id', shopId);
    if (error) return { ok: false, error: error.message };
    return { ok: true, row: null };
  },
};

export type ShopsRepo = typeof shopsRepo;
