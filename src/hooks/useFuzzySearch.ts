/**
 * useFuzzySearch — Phase 1 (Forge #5).
 *
 * Encapsulates the buildShopFuse + fuzzySearchShops + translation-map pattern
 * that Home.tsx and Shops.tsx were repeating verbatim. Also debounces the
 * query for you so callers don't have to wire useDebouncedValue themselves.
 *
 * Sentinel: wrapper-only. Underlying ranking logic in `lib/fuzzySearch.ts`
 * is untouched — Home/Shops can migrate one at a time without behaviour drift.
 */
import { useMemo } from 'react';
import { buildShopFuse, fuzzySearchShops } from '@/lib/fuzzySearch';
import { useDebouncedValue } from './useDebouncedValue';
import type { ShopTranslation, CategoryTranslation } from './useTranslationsCache';

interface Options {
  /** Cap on returned results (passed through to fuzzySearchShops). */
  limit?: number;
  /** Debounce in ms. Set to 0 to disable. Default: 150ms. */
  debounceMs?: number;
  /** Optional Marathi shop translation map for bilingual matching. */
  shopTrMap?: Map<string, ShopTranslation>;
  /** Optional Marathi category translation map. */
  catTrMap?: Map<string, CategoryTranslation>;
}

export function useFuzzySearch<T extends { id: string }>(
  shops: T[] | undefined | null,
  query: string,
  opts: Options = {},
): { results: T[]; debouncedQuery: string } {
  const { limit, debounceMs = 150, shopTrMap, catTrMap } = opts;
  const debouncedQuery = useDebouncedValue(query, debounceMs);

  const fuse = useMemo(
    () => buildShopFuse((shops || []) as any[], shopTrMap, catTrMap),
    [shops, shopTrMap, catTrMap],
  );

  const results = useMemo(() => {
    if (!shops || shops.length === 0) return [] as T[];
    return fuzzySearchShops(
      fuse,
      shops as any[],
      debouncedQuery,
      shopTrMap,
      catTrMap,
      limit,
    ) as T[];
  }, [fuse, shops, debouncedQuery, shopTrMap, catTrMap, limit]);

  return { results, debouncedQuery };
}
