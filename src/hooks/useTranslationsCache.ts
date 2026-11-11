/**
 * Localized content cache.
 *
 * Loads all Marathi translations for shops + categories in a single query
 * per locale, then resolves per-row lookups in memory. React Query stores
 * results for 1 hour (staleTime) / 24h (gcTime). Per-row results are also
 * mirrored to sessionStorage so back-navigation is synchronous.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useT, type Locale } from '@/i18n';

export interface ShopTranslation {
  shop_id: string;
  locale: Locale;
  name: string | null;
  description: string | null;
  address: string | null;
  area: string | null;
  sub_area: string | null;
  keywords: string | null;
}

export interface CategoryTranslation {
  category_id: string;
  locale: Locale;
  name: string;
}

const SHOP_KEY = (l: Locale) => ['translations', 'shops', l] as const;
const CAT_KEY  = (l: Locale) => ['translations', 'categories', l] as const;

// Persisted snapshot keys (full map, JSON-stringified array of entries).
const SHOP_SS_KEY = (l: Locale) => `md.tx.${l}.shops.map.v1`;
const CAT_SS_KEY  = (l: Locale) => `md.tx.${l}.cats.map.v1`;

const ss = {
  get<T>(k: string): T | null {
    try { const v = sessionStorage.getItem(k); return v ? (JSON.parse(v) as T) : null; } catch { return null; }
  },
  set(k: string, v: unknown) {
    try { sessionStorage.setItem(k, JSON.stringify(v)); } catch { /* quota */ }
  },
};

function readShopSnapshot(l: Locale): Map<string, ShopTranslation> | undefined {
  if (l === 'en') return undefined;
  const arr = ss.get<[string, ShopTranslation][]>(SHOP_SS_KEY(l));
  return arr ? new Map(arr) : undefined;
}
function readCatSnapshot(l: Locale): Map<string, CategoryTranslation> | undefined {
  if (l === 'en') return undefined;
  const arr = ss.get<[string, CategoryTranslation][]>(CAT_SS_KEY(l));
  return arr ? new Map(arr) : undefined;
}

/**
 * Fetch every shop_translations row and key by shop_id.
 *
 * We always load the Marathi rows (even when the UI locale is English) so
 * that the search index can match queries typed in either script regardless
 * of the currently selected language. Rendering helpers below still gate on
 * `locale === 'en'`, so the EN UI continues to show English content.
 */
export function useShopTranslations() {
  const { locale } = useT();
  const fetchLocale: Locale = locale === 'en' ? 'mr' : locale;
  return useQuery({
    queryKey: SHOP_KEY(fetchLocale),
    staleTime: 60 * 60_000,
    gcTime: 24 * 60 * 60_000,
    // Hydrate synchronously from last session so no English flash on reload/navigation.
    initialData: () => readShopSnapshot(fetchLocale),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shop_translations' as any)
        .select('shop_id, locale, name, description, address, area, sub_area, keywords')
        .eq('locale', fetchLocale);
      if (error) throw error;
      const map = new Map<string, ShopTranslation>();
      (data as any as ShopTranslation[]).forEach((r) => map.set(r.shop_id, r));
      ss.set(SHOP_SS_KEY(fetchLocale), Array.from(map.entries()));
      return map;
    },
  });
}

export function useCategoryTranslations() {
  const { locale } = useT();
  const fetchLocale: Locale = locale === 'en' ? 'mr' : locale;
  return useQuery({
    queryKey: CAT_KEY(fetchLocale),
    staleTime: 60 * 60_000,
    gcTime: 24 * 60 * 60_000,
    initialData: () => readCatSnapshot(fetchLocale),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('category_translations' as any)
        .select('category_id, locale, name')
        .eq('locale', fetchLocale);
      if (error) throw error;
      const map = new Map<string, CategoryTranslation>();
      (data as any as CategoryTranslation[]).forEach((r) => map.set(r.category_id, r));
      ss.set(CAT_SS_KEY(fetchLocale), Array.from(map.entries()));
      return map;
    },
  });
}


/** Returns a row with Marathi fields overlaid on top of the English source. */
export function useLocalizedShop<T extends { id: string; name?: string | null; description?: string | null; address?: string | null; area?: string | null; sub_area?: string | null; keywords?: string | null }>(shop: T | null | undefined): T | null {
  const { locale } = useT();
  const { data } = useShopTranslations();
  if (!shop) return shop ?? null;
  if (locale === 'en' || !data) return shop;
  const t = data.get(shop.id);
  if (!t) return shop;
  // Note: we intentionally do NOT write to sessionStorage here — that's a
  // side effect inside render. The full per-locale map is already persisted
  // by `useShopTranslations` after its fetch, which is enough for the
  // synchronous-hydration goal.
  const out: T = {
    ...shop,
    name: t.name ?? shop.name,
    description: t.description ?? shop.description,
    address: t.address ?? shop.address,
    area: t.area ?? shop.area,
    sub_area: t.sub_area ?? shop.sub_area,
    keywords: t.keywords ?? shop.keywords,
  } as T;
  return out;
}

export function useLocalizedCategory<T extends { id: string; name: string }>(cat: T | null | undefined): T | null {
  const { locale } = useT();
  const { data } = useCategoryTranslations();
  if (!cat) return cat ?? null;
  if (locale === 'en' || !data) return cat;
  const t = data.get(cat.id);
  if (!t) return cat;
  return { ...cat, name: t.name } as T;
}

export function useLocalizeCategoryName() {
  const { locale } = useT();
  const { data } = useCategoryTranslations();
  return useCallback(
    (id: string | null | undefined, fallback: string): string => {
      if (!id || locale === 'en' || !data) return fallback;
      return data.get(id)?.name ?? fallback;
    },
    [locale, data],
  );
}

/** Call after admin edits a shop/category translation row. */
export function useInvalidateTranslations() {
  const qc = useQueryClient();
  return useCallback(() => {
    qc.invalidateQueries({ queryKey: ['translations'] });
    try {
      Object.keys(sessionStorage)
        .filter((k) => k.startsWith('md.tx.'))
        .forEach((k) => sessionStorage.removeItem(k));
    } catch { /* noop */ }
  }, [qc]);
}
