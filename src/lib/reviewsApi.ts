/**
 * Reviews API — unified hooks & helpers backed by `shop_reviews` + `shop_review_helpful`
 * (default `entityType = 'shop'`) AND `school_reviews` + `school_review_helpful`
 * (`entityType = 'school'`).
 *
 * UNIQUE (<entity>_id, user_id) at DB level enforces one review per user per listing;
 * edits go through UPDATE and deletes through DELETE, gated by RLS to the owning user.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type ReviewEntityType = 'shop' | 'school';

export interface ShopReview {
  id: string;
  shop_id: string;
  school_id?: string;
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

function isMissingSchemaErr(err: any): boolean {
  const code = String(err?.code || '');
  const msg = String(err?.message || '').toLowerCase();
  return (
    code === '42P01' ||
    code === '42883' ||
    code === 'PGRST202' ||
    code === 'PGRST205' ||
    msg.includes('does not exist') ||
    msg.includes('could not find the function') ||
    msg.includes('schema cache')
  );
}

/* ─────────────── Rating aggregate ─────────────── */

async function fetchEntityRating(
  entityId: string,
  entityType: ReviewEntityType = 'shop',
): Promise<ShopRating | null> {
  if (!entityId) return null;
  const rpcName = entityType === 'school' ? 'get_school_rating' : 'get_shop_rating';
  const param = entityType === 'school' ? { _school_id: entityId } : { _shop_id: entityId };
  const { data, error } = await client.rpc(rpcName, param);
  if (error) {
    if (entityType === 'school' && isMissingSchemaErr(error)) return null;
    throw error;
  }
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

export function useShopRating(
  entityId: string | undefined,
  entityType: ReviewEntityType = 'shop',
) {
  return useQuery({
    queryKey: [`${entityType}-rating`, entityId],
    queryFn: () => fetchEntityRating(entityId!, entityType),
    enabled: !!entityId,
    staleTime: 60_000,
  });
}

/** Batch ratings summary for public directory cards (`Schools.tsx`). */
export function useSchoolRatingsMap(schoolIds: string[]) {
  const stableIds = Array.from(new Set(schoolIds)).sort();
  return useQuery({
    queryKey: ['schools-rating-summary', stableIds],
    queryFn: async (): Promise<Map<string, { average: number; count: number }>> => {
      const map = new Map<string, { average: number; count: number }>();
      if (stableIds.length === 0) return map;
      try {
        const { data, error } = await client.rpc('get_schools_rating_summary', {
          _school_ids: stableIds,
        });
        if (error) {
          if (isMissingSchemaErr(error)) return map;
          throw error;
        }
        for (const r of (data ?? []) as any[]) {
          if (r?.school_id) {
            map.set(r.school_id, {
              average: Number(r.average) || 0,
              count: Number(r.count) || 0,
            });
          }
        }
      } catch (err) {
        if (!isMissingSchemaErr(err)) console.warn('[useSchoolRatingsMap]', err);
      }
      return map;
    },
    enabled: stableIds.length > 0,
    staleTime: 60_000,
  });
}

/* ─────────────── Review list ─────────────── */

async function fetchEntityReviews(
  entityId: string,
  entityType: ReviewEntityType = 'shop',
): Promise<ShopReview[]> {
  if (entityType === 'school') {
    const { data, error } = await client
      .from('school_reviews')
      .select('id, school_id, user_id, rating, body, helpful_count, created_at, updated_at')
      .eq('school_id', entityId)
      .order('created_at', { ascending: false });

    if (error) {
      if (isMissingSchemaErr(error)) return [];
      throw error;
    }

    const rows = (data ?? []) as any[];
    if (rows.length === 0) return [];

    const userIds = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean)));
    const nameMap = new Map<string, string | null>();
    if (userIds.length > 0) {
      try {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', userIds);
        for (const p of (profiles ?? []) as any[]) {
          nameMap.set(p.id, p.full_name ?? null);
        }
      } catch {
        // non-blocking profile name lookup
      }
    }

    return rows.map((r) => ({
      ...r,
      shop_id: r.school_id,
      school_id: r.school_id,
      author_name: nameMap.get(r.user_id) ?? null,
    }));
  }

  const { data, error } = await client
    .from('shop_reviews')
    .select('id, shop_id, user_id, rating, body, helpful_count, created_at, updated_at, profiles:profiles!shop_reviews_user_id_fkey(full_name)')
    .eq('shop_id', entityId)
    .order('created_at', { ascending: false });

  if (error) {
    const { data: plain, error: e2 } = await client
      .from('shop_reviews')
      .select('id, shop_id, user_id, rating, body, helpful_count, created_at, updated_at')
      .eq('shop_id', entityId)
      .order('created_at', { ascending: false });
    if (e2) throw e2;
    return (plain ?? []).map((r: any) => ({ ...r, author_name: null }));
  }

  return (data ?? []).map((r: any) => ({
    ...r,
    author_name: r.profiles?.full_name ?? null,
  }));
}

export function useShopReviews(
  entityId: string | undefined,
  entityType: ReviewEntityType = 'shop',
) {
  return useQuery({
    queryKey: [`${entityType}-reviews`, entityId],
    queryFn: () => fetchEntityReviews(entityId!, entityType),
    enabled: !!entityId,
    staleTime: 30_000,
  });
}

/* ─────────────── Upsert / delete own review ─────────────── */

export function useUpsertReview(
  entityId: string,
  entityType: ReviewEntityType = 'shop',
) {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: { rating: number; body: string }) => {
      if (!user) throw new Error('Sign in to leave a review');
      if (!input.rating || input.rating < 1 || input.rating > 5) {
        throw new Error('Please select a rating');
      }

      const table = entityType === 'school' ? 'school_reviews' : 'shop_reviews';
      const idCol = entityType === 'school' ? 'school_id' : 'shop_id';
      const payload = {
        [idCol]: entityId,
        user_id: user.id,
        rating: input.rating,
        body: (input.body ?? '').trim().slice(0, 2000),
      };

      const { data, error } = await client
        .from(table)
        .upsert(payload, { onConflict: `${idCol},user_id` })
        .select()
        .single();
      if (error) throw error;
      return {
        ...data,
        shop_id: data.shop_id ?? data.school_id,
      } as ShopReview;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`${entityType}-reviews`, entityId] });
      qc.invalidateQueries({ queryKey: [`${entityType}-rating`, entityId] });
      if (entityType === 'school') {
        qc.invalidateQueries({ queryKey: ['schools-rating-summary'] });
      }
    },
  });
}

export function useDeleteReview(
  entityId: string,
  entityType: ReviewEntityType = 'shop',
) {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (reviewId: string) => {
      if (!user) throw new Error('Sign in required');
      const table = entityType === 'school' ? 'school_reviews' : 'shop_reviews';
      const { error } = await client
        .from(table)
        .delete()
        .eq('id', reviewId)
        .eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`${entityType}-reviews`, entityId] });
      qc.invalidateQueries({ queryKey: [`${entityType}-rating`, entityId] });
      if (entityType === 'school') {
        qc.invalidateQueries({ queryKey: ['schools-rating-summary'] });
      }
    },
  });
}

/* ─────────────── Helpful votes ─────────────── */

export function useMyHelpfulVotes(
  entityId: string | undefined,
  entityType: ReviewEntityType = 'shop',
) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [`${entityType}-review-helpful-mine`, entityId, user?.id],
    queryFn: async () => {
      if (!user || !entityId) return new Set<string>();
      if (entityType === 'school') {
        const { data, error } = await client
          .from('school_review_helpful')
          .select('review_id, school_reviews!inner(school_id)')
          .eq('user_id', user.id)
          .eq('school_reviews.school_id', entityId);
        if (error) return new Set<string>();
        return new Set<string>((data ?? []).map((r: any) => r.review_id));
      }

      const { data, error } = await client
        .from('shop_review_helpful')
        .select('review_id, shop_reviews!inner(shop_id)')
        .eq('user_id', user.id)
        .eq('shop_reviews.shop_id', entityId);
      if (error) return new Set<string>();
      return new Set<string>((data ?? []).map((r: any) => r.review_id));
    },
    enabled: !!user && !!entityId,
    staleTime: 60_000,
  });
}

export function useToggleHelpful(
  entityId: string,
  entityType: ReviewEntityType = 'shop',
) {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ reviewId, on }: { reviewId: string; on: boolean }) => {
      if (!user) throw new Error('Sign in to mark reviews as helpful');
      const table = entityType === 'school' ? 'school_review_helpful' : 'shop_review_helpful';
      if (on) {
        const { error } = await client
          .from(table)
          .insert({ review_id: reviewId, user_id: user.id });
        if (error && !`${error.message}`.toLowerCase().includes('duplicate')) throw error;
      } else {
        const { error } = await client
          .from(table)
          .delete()
          .eq('review_id', reviewId)
          .eq('user_id', user.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`${entityType}-reviews`, entityId] });
      qc.invalidateQueries({ queryKey: [`${entityType}-review-helpful-mine`, entityId] });
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
