/**
 * Reviews API — hooks and helpers backed by `shop_reviews` +
 * `shop_review_helpful`. UNIQUE (shop_id, user_id) at the DB level enforces
 * the "one review per user per shop" rule; edits go through UPDATE, deletes
 * through DELETE, both gated by RLS to the owning user.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface ShopReview {
  id: string;
  shop_id: string;
  user_id: string;
  rating: number;               // 1..5
  body: string;
  helpful_count: number;
  created_at: string;
  updated_at: string;
  author_name?: string | null;
}

export interface ShopRating {
  average: number;                            // one decimal
  count: number;
  distribution: [number, number, number, number, number]; // [5,4,3,2,1]
}

const client = supabase as any;

/* ─────────────── Rating aggregate ─────────────── */

async function fetchShopRating(shopId: string): Promise<ShopRating | null> {
  if (!shopId) return null;
  const { data, error } = await client.rpc('get_shop_rating', { _shop_id: shopId });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || Number(row.count) === 0) return null;
  return {
    average: Number(row.average) || 0,
    count: Number(row.count) || 0,
    distribution: [
      Number(row.d5) || 0,
      Number(row.d4) || 0,
      Number(row.d3) || 0,
      Number(row.d2) || 0,
      Number(row.d1) || 0,
    ],
  };
}

export function useShopRating(shopId: string | undefined) {
  return useQuery({
    queryKey: ['shop-rating', shopId],
    queryFn: () => fetchShopRating(shopId!),
    enabled: !!shopId,
    staleTime: 60_000,
  });
}

/* ─────────────── Review list ─────────────── */

async function fetchShopReviews(shopId: string): Promise<ShopReview[]> {
  const { data, error } = await client
    .from('shop_reviews')
    .select('id, shop_id, user_id, rating, body, helpful_count, created_at, updated_at, profiles:profiles!shop_reviews_user_id_fkey(full_name)')
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false });
  if (error) {
    // Fallback if the implicit relationship isn't available: fetch without join
    const { data: plain, error: e2 } = await client
      .from('shop_reviews')
      .select('id, shop_id, user_id, rating, body, helpful_count, created_at, updated_at')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false });
    if (e2) throw e2;
    return (plain ?? []).map((r: any) => ({ ...r, author_name: null }));
  }
  return (data ?? []).map((r: any) => ({
    ...r,
    author_name: r.profiles?.full_name ?? null,
  }));
}

export function useShopReviews(shopId: string | undefined) {
  return useQuery({
    queryKey: ['shop-reviews', shopId],
    queryFn: () => fetchShopReviews(shopId!),
    enabled: !!shopId,
    staleTime: 30_000,
  });
}

/* ─────────────── Upsert / delete own review ─────────────── */

export function useUpsertReview(shopId: string) {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: { rating: number; body: string }) => {
      if (!user) throw new Error('Sign in to leave a review');
      if (!input.rating || input.rating < 1 || input.rating > 5) {
        throw new Error('Please select a rating');
      }
      const payload = {
        shop_id: shopId,
        user_id: user.id,
        rating: input.rating,
        body: (input.body ?? '').trim().slice(0, 2000),
      };
      const { data, error } = await client
        .from('shop_reviews')
        .upsert(payload, { onConflict: 'shop_id,user_id' })
        .select()
        .single();
      if (error) throw error;
      return data as ShopReview;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shop-reviews', shopId] });
      qc.invalidateQueries({ queryKey: ['shop-rating', shopId] });
    },
  });
}

export function useDeleteReview(shopId: string) {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (reviewId: string) => {
      if (!user) throw new Error('Sign in required');
      const { error } = await client
        .from('shop_reviews')
        .delete()
        .eq('id', reviewId)
        .eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shop-reviews', shopId] });
      qc.invalidateQueries({ queryKey: ['shop-rating', shopId] });
    },
  });
}

/* ─────────────── Helpful votes ─────────────── */

export function useMyHelpfulVotes(shopId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['review-helpful-mine', shopId, user?.id],
    queryFn: async () => {
      if (!user || !shopId) return new Set<string>();
      const { data, error } = await client
        .from('shop_review_helpful')
        .select('review_id, shop_reviews!inner(shop_id)')
        .eq('user_id', user.id)
        .eq('shop_reviews.shop_id', shopId);
      if (error) return new Set<string>();
      return new Set<string>((data ?? []).map((r: any) => r.review_id));
    },
    enabled: !!user && !!shopId,
    staleTime: 60_000,
  });
}

export function useToggleHelpful(shopId: string) {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ reviewId, on }: { reviewId: string; on: boolean }) => {
      if (!user) throw new Error('Sign in to mark reviews as helpful');
      if (on) {
        const { error } = await client
          .from('shop_review_helpful')
          .insert({ review_id: reviewId, user_id: user.id });
        if (error && !`${error.message}`.toLowerCase().includes('duplicate')) throw error;
      } else {
        const { error } = await client
          .from('shop_review_helpful')
          .delete()
          .eq('review_id', reviewId)
          .eq('user_id', user.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shop-reviews', shopId] });
      qc.invalidateQueries({ queryKey: ['review-helpful-mine', shopId] });
    },
  });
}

/* ─────────────── Formatting helper ─────────────── */

export function formatRelative(iso: string): string {
  const diff = Date.now() - +new Date(iso);
  const day = 24 * 3600 * 1000;
  if (diff < day) return 'today';
  if (diff < 2 * day) return 'yesterday';
  const days = Math.floor(diff / day);
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return new Date(iso).toLocaleDateString();
}
