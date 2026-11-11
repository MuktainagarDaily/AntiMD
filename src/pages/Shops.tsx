import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { PageSeo } from '@/components/seo/PageSeo';

import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ArrowLeft, Search, X, AlertCircle, SlidersHorizontal, ShieldCheck, MapPin, Store, Check, Plus } from 'lucide-react';
import { CategoryIcon } from '@/components/shared/CategoryIcon';
import { UserMenuDrawer } from '@/components/UserMenuDrawer';
import { DesktopNav } from '@/components/DesktopNav';
import { ShopCard } from '@/components/ShopCard';
import { Footer } from '@/components/shared/Footer';
import { isShopOpen, filterRetailShops, isSpecializedCategoryName, getEntityDetailPath } from '@/lib/shopUtils';
import { BannerSlot } from '@/components/banners/BannerSlot';
import { haptic } from '@/lib/uxUtils';
import { useInterval } from '@/hooks/useInterval';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
// useSmartBack intentionally not used on /shops — back always goes to Home.
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import { useSwipeDownToClose } from '@/hooks/useSwipeDownToClose';
import { useT } from '@/i18n';
import { useLocalizeCategoryName, useShopTranslations, useCategoryTranslations, useLocalizedShop } from '@/hooks/useTranslationsCache';
import { useCity } from '@/hooks/useCity';
import { buildShopFuse, fuzzySearchShops } from '@/lib/fuzzySearch';
import { HighlightedText } from '@/components/shared/HighlightedText';

function SuggestionRow({ shop: rawShop, query, onPick, localizeCat, currentCitySlug }: { shop: any; query: string; onPick: (path: string) => void; localizeCat: (id: string | null | undefined, fallback: string) => string; currentCitySlug: string }) {
  const shop = useLocalizedShop(rawShop) || rawShop;
  const sc = rawShop.shop_categories?.[0];
  const catLabel = sc?.categories?.name ? localizeCat(sc.category_id, sc.categories.name) : null;
  const shopPath = getEntityDetailPath(currentCitySlug, rawShop);
  const areaLine = [shop.area, shop.sub_area].filter(Boolean).join(', ');
  return (
    <div
      onMouseDown={(e) => { e.preventDefault(); onPick(shopPath); }}
      onPointerDown={(e) => { e.preventDefault(); onPick(shopPath); }}
      className="flex items-center gap-3 px-3.5 py-2.5 cursor-pointer hover:bg-accent/50 transition-colors border-b border-border/50 last:border-b-0"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">
          <HighlightedText text={shop.name} query={query} />
        </p>
        {areaLine && (
          <p className="text-xs text-muted-foreground truncate">
            <HighlightedText text={areaLine} query={query} />
          </p>
        )}
      </div>
      {catLabel && (
        <span className="shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
          <HighlightedText text={catLabel} query={query} />
        </span>
      )}
    </div>
  );
}

type AvailabilityFilter = 'all' | 'open' | 'closed';
const PAGE_SIZE = 12;

function sameSearchParams(a: URLSearchParams, b: URLSearchParams) {
  return a.toString() === b.toString();
}

function ShopSkeleton() {
  return (
    <div className="rounded-xl border border-border p-4 skeleton-shimmer">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <div className="h-5 rounded-md skeleton-shimmer w-2/3" />
          <div className="h-3 rounded-md skeleton-shimmer w-1/2" />
          <div className="h-3 rounded-md skeleton-shimmer w-1/3" />
        </div>
        <div className="h-7 w-16 rounded-full skeleton-shimmer shrink-0" />
      </div>
      <div className="flex gap-2 mt-3">
        <div className="flex-1 h-11 rounded-lg skeleton-shimmer" />
        <div className="flex-1 h-11 rounded-lg skeleton-shimmer" />
      </div>
    </div>
  );
}

export default function Shops() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentCity, currentVillage, allVillages, setVillage, townBrand, townName, branding, getPageTitle } = useCity();
  // Back from /shops always goes to Home (see header button below).
  const qc = useQueryClient();
  const { t, locale } = useT();
  const localizeCat = useLocalizeCategoryName();
  const initialSearch = searchParams.get('search') || '';
  const filterParam = searchParams.get('filter');
  // Support both legacy single ?category=Foo and new multi ?category=Foo&category=Bar
  const initialCategories = (() => {
    const multi = searchParams.getAll('category');
    return multi.length > 0 ? multi : [];
  })();
  const initialAreas = searchParams.getAll('area');
  const [localSearch, setLocalSearch] = useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);
  const [searchFocused, setSearchFocused] = useState(false);
  const [availability, setAvailability] = useState<AvailabilityFilter>(
    filterParam === 'open' ? 'open' : filterParam === 'closed' ? 'closed' : 'all'
  );
  const [selectedAreas, setSelectedAreas] = useState<string[]>(initialAreas);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(initialCategories);
  const [verifiedOnly, setVerifiedOnly] = useState(filterParam === 'verified');
  
  const [filterOpen, setFilterOpen] = useState(false);
  const { ref: filterSwipeRef } = useSwipeDownToClose({
    isOpen: filterOpen,
    onClose: () => setFilterOpen(false),
  });
  // MPULSE Phase 3 #4 — server-side infinite paging via `get_shops_page`
  // replaces the old client-side numbered pagination. `page` state kept only
  // to preserve deep-link back-navigation (?page=N) → prefetches N pages.
  const [page, setPage] = useState(() => {
    const p = parseInt(searchParams.get('page') || '1', 10);
    return Number.isFinite(p) && p > 0 ? p : 1;
  });
  const [areaSearch, setAreaSearch] = useState('');
  const debouncedAreaSearch = useDebouncedValue(areaSearch, 200);

  // Temporary state inside the sheet (applied on "Show Results")
  const [sheetAvailability, setSheetAvailability] = useState<AvailabilityFilter>('all');
  const [sheetAreas, setSheetAreas] = useState<string[]>([]);
  const [sheetCategories, setSheetCategories] = useState<string[]>([]);
  const [sheetVerifiedOnly, setSheetVerifiedOnly] = useState(false);

  // Debounce the main search box. 350 ms feels responsive on mobile while
  // skipping per-keystroke fuzzy recomputes and URL rewrites.
  const debouncedFromHook = useDebouncedValue(localSearch, 350);
  useEffect(() => { setDebouncedSearch(debouncedFromHook); }, [debouncedFromHook]);

  // Reset page whenever filters or search change (skip on first run so we
  // preserve the ?page= value when arriving from a back-navigation).
  const filtersInitialRun = useRef(true);
  useEffect(() => {
    if (filtersInitialRun.current) { filtersInitialRun.current = false; return; }
    setPage(1);
  }, [debouncedSearch, availability, selectedAreas, selectedCategories, verifiedOnly]);

  // Persist filter + page state into the URL so back-navigation from ShopDetail restores it.
  // Uses replace:true so each filter tweak doesn't add a history entry — back button
  // still moves one logical page at a time.
  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (availability === 'open') params.set('filter', 'open');
    else if (availability === 'closed') params.set('filter', 'closed');
    else if (verifiedOnly) params.set('filter', 'verified');
    selectedAreas.forEach((a) => params.append('area', a));
    selectedCategories.forEach((c) => params.append('category', c));
    if (page > 1) params.set('page', String(page));
    if (sameSearchParams(params, searchParams)) return;
    setSearchParams(params, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, availability, verifiedOnly, selectedAreas, selectedCategories, page]);

  // Per-route title is now declarative via <PageSeo> below — no more document.title hacks.


  // Sync sheet state when drawer opens
  useEffect(() => {
    if (filterOpen) {
      setSheetAvailability(availability);
      setSheetAreas(selectedAreas);
      setSheetCategories(selectedCategories);
      setSheetVerifiedOnly(verifiedOnly);
      setAreaSearch('');
    }
  }, [filterOpen]);

  // Auto-refresh open/closed status every 60 seconds
  useInterval(useCallback(() => {
    qc.invalidateQueries({ queryKey: ['shops', 'all'] });
  }, [qc]), 60_000);

  const { data: shops = [], isLoading, isError, isFetching, refetch } = useQuery({
    // also expose isFetching so the Retry button can show a "Retrying…" label.
    queryKey: ['shops', 'all', currentCity.id, currentVillage?.id],
    placeholderData: (previousData) => previousData,
    queryFn: async () => {
      // Scoped by active town + optional village.
      // For Muktainagar, matches city_id = id OR city_id IS NULL (legacy data compatibility)
      let query = (supabase as any)
        .from('shops')
        .select(
          'id, name, slug, area, sub_area, address, image_url, photos, phone, whatsapp, opening_time, closing_time, is_open, is_verified, shop_owners(id), shop_categories(category_id, categories(name, icon, is_active)), mess_profiles(shop_id), pg_profiles(shop_id)'
        )
        .eq('is_active', true)
        .order('name');

      if (currentVillage?.id) {
        query = query.eq('village_id', currentVillage.id);
      } else if (currentCity.slug === 'muktainagar') {
        query = query.or(`city_id.eq.${currentCity.id},city_id.is.null`);
      } else {
        query = query.eq('city_id', currentCity.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      const mapped = (data || []).map((s: any) => ({
        ...s,
        is_claimed: Boolean(s.is_claimed || (s.shop_owners && s.shop_owners.length > 0)),
      }));
      // Strictly exclude specialized non-shop entities (Mess, PG, etc.)
      return filterRetailShops(mapped);
    },
  });

  // Marathi overlays — used to build the bilingual fuzzy index.
  const { data: shopTrMap } = useShopTranslations();
  const { data: catTrMap } = useCategoryTranslations();

  // MPULSE Rec #2 — search-index sidecar. Enabled only when the user has
  // focused the search input or typed something.
  const enableSearchIndex = searchFocused || debouncedSearch.trim().length > 0;
  const { data: searchFieldsMap } = useQuery({
    queryKey: ['shops', 'search-index'],
    enabled: enableSearchIndex,
    staleTime: 120_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('shops_search_public')
        .select('id, keywords, description, latitude, longitude');
      if (error) throw error;
      const map = new Map<string, any>();
      (data ?? []).forEach((r: any) => map.set(r.id, r));
      return map;
    },
  });

  const shopsForSearch = useMemo(() => {
    if (!searchFieldsMap) return shops as any[];
    return (shops as any[]).map((s) => ({ ...s, ...(searchFieldsMap.get(s.id) || {}) }));
  }, [shops, searchFieldsMap]);

  const fuse = useMemo(
    () => buildShopFuse(shopsForSearch, shopTrMap, catTrMap),
    [shopsForSearch, shopTrMap, catTrMap],
  );

  const searchedShops = useMemo(() => {
    if (!debouncedSearch.trim()) return shops as any[];
    return fuzzySearchShops(fuse, shopsForSearch, debouncedSearch, shopTrMap, catTrMap);
  }, [fuse, shops, shopsForSearch, debouncedSearch, shopTrMap, catTrMap]);

  // Derive sorted unique areas
  const areaOptions = useMemo(() => {
    const seen = new Set<string>();
    shops.forEach((s: any) => {
      const a = s.area?.trim();
      if (a) seen.add(a);
    });
    return Array.from(seen).sort((a, b) => a.localeCompare(b));
  }, [shops]);

  // Derive category options from shop data (excluding specialized non-shop domains)
  const categoryOptions = useMemo(() => {
    const seen = new Map<string, { id: string; name: string; icon: string }>();
    shops.forEach((s: any) => {
      s.shop_categories?.forEach((sc: any) => {
        const cat = sc.categories;
        const id = sc.category_id;
        if (cat?.name && cat.is_active !== false && !isSpecializedCategoryName(cat.name) && !seen.has(cat.name)) {
          seen.set(cat.name, { id, name: cat.name, icon: cat.icon || '' });
        }
      });
    });
    return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [shops]);


  // Shop counts per category and per area
  const catShopCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    (shops as any[]).forEach((s) => {
      s.shop_categories?.forEach((sc: any) => {
        const name = sc.categories?.name;
        if (name) counts[name] = (counts[name] || 0) + 1;
      });
    });
    return counts;
  }, [shops]);

  const areaShopCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    (shops as any[]).forEach((s) => {
      const a = s.area?.trim();
      if (a) counts[a] = (counts[a] || 0) + 1;
    });
    return counts;
  }, [shops]);

  // Pre-compute open status once per render cycle to avoid repeated date arithmetic
  const shopOpenMap = useMemo(() => {
    const map = new Map<string, boolean>();
    (shops as any[]).forEach((s) => map.set(s.id, isShopOpen(s)));
    return map;
  }, [shops]);

  // Autocomplete suggestions — top 5 fuzzy matches (typo-tolerant, EN+MR)
  const searchSuggestions = useMemo(() => {
    if (!searchFocused || localSearch.trim().length < 2) return [];
    return fuzzySearchShops(fuse, shops as any[], localSearch, shopTrMap, catTrMap, 5);
  }, [fuse, shops, localSearch, searchFocused, shopTrMap, catTrMap]);

  // Top 3 categories for quick chips
  const topCategories = useMemo(() => {
    return [...categoryOptions]
      .sort((a, b) => (catShopCounts[b.name] || 0) - (catShopCounts[a.name] || 0))
      .slice(0, 3);
  }, [categoryOptions, catShopCounts]);

  const applyFilters = useCallback((s: any, avail: AvailabilityFilter, areas: string[], cats: string[], verified: boolean) => {
    if (avail === 'open' && !shopOpenMap.get(s.id)) return false;
    if (avail === 'closed' && shopOpenMap.get(s.id)) return false;
    if (areas.length > 0 && !areas.includes(s.area?.trim() || '')) return false;
    if (cats.length > 0) {
      const shopCatNames = (s.shop_categories || []).map((sc: any) => sc.categories?.name).filter(Boolean);
      if (!cats.some((c) => shopCatNames.includes(c))) return false;
    }
    if (verified && !s.is_verified) return false;
    return true;
  }, [shopOpenMap]);

  const filteredShops = useMemo(() =>
    (searchedShops as any[]).filter((s) => applyFilters(s, availability, selectedAreas, selectedCategories, verifiedOnly)),
    [searchedShops, availability, selectedAreas, selectedCategories, verifiedOnly, applyFilters]
  );

  // ────────────────────────────────────────────────────────────────────────
  // MPULSE Phase 3 #4 — server-side infinite paging via `get_shops_page`.
  //
  // Rationale: at ~1k shops the "SELECT all active" pattern becomes the
  // dominant DB read cost. `get_shops_page(area, category, search, limit,
  // offset)` returns a slim projection ordered by (is_verified DESC,
  // created_at DESC) plus `total_count` for header stats.
  //
  // Because the RPC row shape doesn't include phone/whatsapp/shop_categories
  // (needed by ShopCard for call/WA buttons and category chip), we HYDRATE
  // each RPC row against the retained `['shops','all']` full-list map. That
  // means the RPC drives ordering + paging while ShopCard keeps its full
  // render fidelity. Once category coverage stabilises server-side, the
  // hydration lookup can be dropped and the full-list query removed.
  //
  // The RPC only accepts a single area + single category. When the user
  // multi-selects, we pass NULL to the RPC and apply the extra predicates
  // client-side on the loaded pages (existing `applyFilters` path). This
  // means multi-select filters degrade to "match within loaded window" — a
  // "Load more" tap keeps expanding that window until the user finds enough.
  // ────────────────────────────────────────────────────────────────────────
  const rpcArea = selectedAreas.length === 1 ? selectedAreas[0] : null;
  const rpcCategoryId = useMemo(() => {
    if (selectedCategories.length !== 1) return null;
    const match = categoryOptions.find((c) => c.name === selectedCategories[0]);
    return match?.id ?? null;
  }, [selectedCategories, categoryOptions]);

  // Windowed pagination driven directly by the town+village filtered set.
  // This ensures 100% adherence to location boundaries with zero leak across towns.
  const [visibleCount, setVisibleCount] = useState(24);
  const pagedShops = useMemo(() => {
    return filteredShops.slice(0, visibleCount);
  }, [filteredShops, visibleCount]);
  const hasMore = visibleCount < filteredShops.length;
  const safePage = 1;

  // Preview count while sheet is open — computed against the retained
  // full-list `filteredShops` so the sheet CTA reflects reality across the
  // whole catalog, not just what's currently loaded on-screen.
  const sheetPreviewCount = useMemo(() =>
    (searchedShops as any[]).filter((s) => applyFilters(s, sheetAvailability, sheetAreas, sheetCategories, sheetVerifiedOnly)).length,
    [searchedShops, sheetAvailability, sheetAreas, sheetCategories, sheetVerifiedOnly, applyFilters]
  );

  const openCount = useMemo(() => shops.filter((s: any) => isShopOpen(s)).length, [shops]);

  const activeFilterCount =
    (availability !== 'all' ? 1 : 0) + selectedAreas.length + selectedCategories.length + (verifiedOnly ? 1 : 0);

  const title = debouncedSearch ? `"${debouncedSearch}"` : 'All Shops';

  // Build active filter summary text
  const filterSummaryText = useMemo(() => {
    if (activeFilterCount === 0) return '';
    const parts: string[] = [];
    parts.push(`${filteredShops.length}`);
    if (availability === 'open') parts.push('open');
    if (availability === 'closed') parts.push('closed');
    if (verifiedOnly) parts.push('verified');
    parts.push(filteredShops.length === 1 ? 'shop' : 'shops');
    if (selectedAreas.length === 1) parts.push(`in ${selectedAreas[0]}`);
    else if (selectedAreas.length > 1) parts.push(`in ${selectedAreas.length} areas`);
    if (selectedCategories.length === 1) parts.push(`• ${selectedCategories[0]}`);
    else if (selectedCategories.length > 1) parts.push(`• ${selectedCategories.length} categories`);
    return `Showing ${parts.join(' ')}`;
  }, [activeFilterCount, filteredShops.length, availability, verifiedOnly, selectedAreas, selectedCategories]);

  const handleApply = () => {
    setAvailability(sheetAvailability);
    setSelectedAreas(sheetAreas);
    setSelectedCategories(sheetCategories);
    setVerifiedOnly(sheetVerifiedOnly);
    setFilterOpen(false);
  };

  const handleClearAll = () => {
    setSheetAvailability('all');
    setSheetAreas([]);
    setSheetCategories([]);
    setSheetVerifiedOnly(false);
  };

  // Top-level "Clear all filters" (used outside the sheet, e.g. empty state).
  // Announces the action so users don't tap twice unsure if it worked.
  const handleClearAllFiltersAndAnnounce = () => {
    const cleared = activeFilterCount;
    setAvailability('all');
    setSelectedAreas([]);
    setSelectedCategories([]);
    setVerifiedOnly(false);
    if (cleared > 0) {
      toast.success(t('shops.clearedFilters', { count: cleared }));
    }
  };

  const toggleSheetArea = (area: string) =>
    setSheetAreas((prev) => prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]);

  const toggleSheetCategory = (cat: string) =>
    setSheetCategories((prev) => prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]);

  const removeFilter = (type: 'availability' | 'area' | 'category' | 'verified', value?: string) => {
    if (type === 'availability') setAvailability('all');
    if (type === 'area' && value) setSelectedAreas((prev) => prev.filter((a) => a !== value));
    if (type === 'category' && value) setSelectedCategories((prev) => prev.filter((c) => c !== value));
    if (type === 'verified') setVerifiedOnly(false);
  };

  // Quick chip toggle helpers — light haptic for tactile feedback on mobile
  const toggleQuickOpen = () => { haptic('tap'); setAvailability((a) => a === 'open' ? 'all' : 'open'); };
  const toggleQuickVerified = () => { haptic('tap'); setVerifiedOnly((v) => !v); };
  const toggleQuickCategory = (catName: string) => {
    haptic('tap');
    setSelectedCategories((prev) =>
      prev.includes(catName) ? prev.filter((c) => c !== catName) : [...prev, catName]
    );
  };

  const availabilityLabel: Record<AvailabilityFilter, string> = {
    all: 'All Shops',
    open: 'Open Now',
    closed: 'Closed Now',
  };

  // Filtered areas for drawer search
  const filteredAreaOptions = useMemo(() => {
    if (!debouncedAreaSearch.trim()) return areaOptions;
    const q = debouncedAreaSearch.trim().toLowerCase();
    return areaOptions.filter((a) => a.toLowerCase().includes(q));
  }, [areaOptions, debouncedAreaSearch]);

  return (
    <div className="min-h-screen bg-background">
      <PageSeo
        title={
          debouncedSearch
            ? `"${debouncedSearch.slice(0, 30)}" — ${townBrand}`
            : selectedCategories.length === 1
            ? `${selectedCategories[0]} in ${townName} | ${townBrand}`
            : `All Shops in ${townName} | ${townBrand}`
        }
        description={
          debouncedSearch
            ? `Search results for "${debouncedSearch}" in ${townName}'s local business directory.`
            : `Browse all local shops and services in ${townName}. Filter by category, area, and open now.`
        }
        path={selectedCategories.length === 1 ? `/${currentCity.slug}/shops?category=${encodeURIComponent(selectedCategories[0])}` : `/${currentCity.slug}/shops`}
        noindex={!!debouncedSearch}
      />

      <header className="bg-primary text-primary-foreground px-4 py-4 sticky top-0 z-40 shadow-md">
        <div className="max-w-lg md:max-w-4xl lg:max-w-6xl xl:max-w-7xl mx-auto">
          {/* Title row */}
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <button onClick={() => navigate(`/${currentCity.slug}`)} aria-label={t('shops.backHomeAria')} className="p-1 shrink-0 hover:bg-primary-foreground/10 rounded-lg transition-colors">
                <ArrowLeft className="w-6 h-6" />
              </button>
              <div className="min-w-0">
                <h1 className="font-bold text-lg leading-tight truncate">{title}</h1>
                <p className="text-primary-foreground/70 text-xs">
                  {isLoading ? t('common.loading') : t('shops.loading.desc', { shown: pagedShops.length, total: filteredShops.length, open: openCount })}
                </p>
              </div>
            </div>

            <DesktopNav variant="primary" />

            <div className="shrink-0">
              <UserMenuDrawer />
            </div>
          </div>

          {/* Search with autocomplete */}
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
              placeholder={t('shops.search.placeholder')}
              className="w-full pl-9 pr-10 py-2.5 rounded-xl text-foreground bg-card text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
              autoComplete="off"
            />
            {localSearch && (
              <button
                onClick={() => setLocalSearch('')}
                className="absolute right-1 top-1/2 -translate-y-1/2 p-2 text-muted-foreground hover:text-foreground rounded-lg"
                aria-label={t('shops.clearSearch')}
              >
                <X className="w-4 h-4" />
              </button>
            )}

            {/* Autocomplete dropdown */}
            {searchFocused && searchSuggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-2xl z-[999] overflow-hidden max-h-[320px] overflow-y-auto">
                {searchSuggestions.map((shop: any) => (
                  <SuggestionRow
                    key={shop.id}
                    shop={shop}
                    query={localSearch}
                    localizeCat={localizeCat}
                    currentCitySlug={currentCity.slug}
                    onPick={(p) => navigate(p)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Village Quick Filter Strip (when town has child villages) */}
          {allVillages.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto whitespace-nowrap scrollbar-none py-1 mb-1 text-xs">
              <button
                onClick={() => setVillage(null)}
                className={`px-2.5 py-1 rounded-full font-medium transition-colors ${
                  !currentVillage
                    ? 'bg-secondary text-secondary-foreground font-semibold shadow-sm'
                    : 'bg-primary-foreground/15 text-primary-foreground hover:bg-primary-foreground/25'
                }`}
              >
                All {townName}
              </button>
              {allVillages.map((v) => {
                const isSel = currentVillage?.slug === v.slug;
                return (
                  <button
                    key={v.id}
                    onClick={() => setVillage(isSel ? null : v.slug)}
                    className={`px-2.5 py-1 rounded-full font-medium transition-colors ${
                      isSel
                        ? 'bg-secondary text-secondary-foreground font-semibold shadow-sm'
                        : 'bg-primary-foreground/15 text-primary-foreground hover:bg-primary-foreground/25'
                    }`}
                  >
                    {v.name}
                  </button>
                );
              })}
            </div>
          )}

          {/* Compact stats ribbon — header trimmed; Filters now floats near the list */}
          <div className="flex items-center gap-3 overflow-x-auto whitespace-nowrap scrollbar-none text-[11px] font-semibold text-primary-foreground/85 pt-0.5">
            <div className="shrink-0 flex items-center gap-1.5">
              <Store className="w-3 h-3 opacity-70" />
              <span className="text-primary-foreground">{filteredShops.length}</span>
              <span className="opacity-75">{filteredShops.length === 1 ? 'shop' : 'shops'}</span>
            </div>
            <span className="w-1 h-1 rounded-full bg-primary-foreground/25 shrink-0" />
            <div className="shrink-0 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full shrink-0 animate-pulse-open" style={{ background: 'hsl(var(--success))' }} />
              <span style={{ color: 'hsl(var(--success))' }}>{openCount}</span>
              <span className="opacity-75 text-primary-foreground">open</span>
            </div>
            {activeFilterCount > 0 && (
              <>
                <span className="w-1 h-1 rounded-full bg-primary-foreground/25 shrink-0" />
                <button
                  onClick={() => { setAvailability('all'); setSelectedAreas([]); setSelectedCategories([]); setVerifiedOnly(false); }}
                  className="shrink-0 underline text-primary-foreground/70 hover:text-primary-foreground"
                >
                  {t('filters.clearAll')}
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Floating filter pill — fixed FAB stays visible while scrolling the list */}
      <div className="fixed bottom-6 right-4 sm:right-6 lg:right-10 z-30 pointer-events-none">
        <button
          type="button"
          onClick={() => setFilterOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setFilterOpen(true); }
          }}
          aria-label={`${t('shops.filters')}${activeFilterCount > 0 ? ` (${activeFilterCount} ${t('shops.filters.activeCount') || 'active'})` : ''}`}
          aria-haspopup="dialog"
          aria-expanded={filterOpen}
          aria-controls="shops-filter-drawer"
          className="pointer-events-auto inline-flex items-center gap-2 px-5 py-3 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 ring-1 ring-primary-foreground/10 hover:shadow-xl hover:shadow-primary/40 hover:-translate-y-0.5 active:scale-95 transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background animate-in fade-in slide-in-from-bottom-4"
        >
          <SlidersHorizontal className="w-4 h-4" aria-hidden="true" />
          <span className="text-xs font-bold tracking-wide">{t('shops.filters')}</span>
          {activeFilterCount > 0 && (
            <span
              className="flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-[10px] font-bold bg-secondary text-secondary-foreground"
              aria-hidden="true"
            >
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Active filter pills — moved out of header, sit above the list when present */}
      {activeFilterCount > 0 && (
        <div className="max-w-lg md:max-w-4xl lg:max-w-6xl xl:max-w-7xl mx-auto px-4 md:px-6 mt-2">
          <div className="flex items-center gap-2 overflow-x-auto md:flex-wrap pb-1 scrollbar-none">
            {availability === 'open' && (
              <span className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-primary/10 text-primary">
                <span className="w-1.5 h-1.5 rounded-full bg-success" /> {t('shops.openNow')}
                <button onClick={() => removeFilter('availability')} aria-label={t('shops.removeOpenNowAria')} className="ml-0.5 hover:opacity-70"><X className="w-3 h-3" /></button>
              </span>
            )}
            {availability === 'closed' && (
              <span className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-primary/10 text-primary">
                <span className="w-1.5 h-1.5 rounded-full bg-destructive" /> {t('shops.filter.closedNow')}
                <button onClick={() => removeFilter('availability')} aria-label={t('shops.removeClosedNowAria')} className="ml-0.5 hover:opacity-70"><X className="w-3 h-3" /></button>
              </span>
            )}
            {verifiedOnly && (
              <span className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-primary/10 text-primary">
                <ShieldCheck className="w-3 h-3" /> {t('common.verified')}
                <button onClick={() => removeFilter('verified')} className="ml-0.5 hover:opacity-70"><X className="w-3 h-3" /></button>
              </span>
            )}
            {selectedAreas.map((area) => (
              <span key={area} className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-primary/10 text-primary whitespace-nowrap">
                <MapPin className="w-3 h-3" /> {area}
                <button onClick={() => removeFilter('area', area)} aria-label={t('shops.removeFilterAria', { label: area })} className="ml-0.5 hover:opacity-70"><X className="w-3 h-3" /></button>
              </span>
            ))}
            {selectedCategories.map((cat) => {
              const opt = categoryOptions.find((c) => c.name === cat);
              const label = opt ? localizeCat(opt.id, opt.name) : cat;
              return (
                <span key={cat} className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-primary/10 text-primary whitespace-nowrap">
                  <CategoryIcon name={opt?.name} className="w-3 h-3" /> {label}
                  <button onClick={() => removeFilter('category', cat)} aria-label={t('shops.removeFilterAria', { label })} className="ml-0.5 hover:opacity-70"><X className="w-3 h-3" /></button>
                </span>
              );
            })}
          </div>
        </div>
      )}


      <main className="max-w-lg md:max-w-4xl lg:max-w-6xl xl:max-w-7xl mx-auto px-4 md:px-6 py-4 pb-28">
        {/* Specialized Hub Shortcut Banners */}
        {activeFilterCount === 0 && !debouncedSearch && (
          <div className="grid grid-cols-2 gap-2 mb-3">
            <Link
              to={`/${currentCity.slug}/mess`}
              className="flex items-center gap-2 p-2.5 rounded-xl border border-amber-500/25 bg-amber-500/10 hover:bg-amber-500/15 active:scale-98 transition-all group"
            >
              <span className="text-xl shrink-0">🍲</span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-foreground leading-tight truncate group-hover:text-primary transition-colors">
                  {locale === 'mr' ? 'मेस, हॉटेल्स व जेवण' : 'Mess, Hotels & Dining'}
                </p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {locale === 'mr' ? 'हॉटेल्स, थाळी व मेनू' : 'Hotels, thali & menus'}
                </p>
              </div>
            </Link>

            <Link
              to={`/${currentCity.slug}/pg`}
              className="flex items-center gap-2 p-2.5 rounded-xl border border-indigo-500/25 bg-indigo-500/10 hover:bg-indigo-500/15 active:scale-98 transition-all group"
            >
              <span className="text-xl shrink-0">🛏️</span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-foreground leading-tight truncate group-hover:text-primary transition-colors">
                  {locale === 'mr' ? 'पीजी व खोल्या' : 'PGs & Hostels'}
                </p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {locale === 'mr' ? 'रिक्त जागा व भाडे' : 'Vacant beds & rent'}
                </p>
              </div>
            </Link>
          </div>
        )}

        {/* Inline ad slot — category-specific when a single category is filtered, falls back to generic shops_inline */}
        <BannerSlot
          placement={selectedCategories.length === 1 ? 'category_inline' : 'shops_inline'}
          fallback="shops_inline"
          className="mb-3"
        />


        {/* Active filter summary */}
        {activeFilterCount > 0 && filteredShops.length > 0 && (
          <div className="mb-3 px-3 py-2 rounded-lg text-xs font-medium text-muted-foreground" style={{ background: 'hsl(var(--primary) / 0.05)' }}>
            {filterSummaryText}
          </div>
        )}

        {isError ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <AlertCircle className="w-10 h-10 text-destructive/60" />
            <p className="font-semibold text-foreground">{t('shops.error.title')}</p>
            <p className="text-sm text-muted-foreground">{t('shops.error.desc')}</p>
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              aria-busy={isFetching}
              className="mt-2 bg-primary text-primary-foreground px-6 py-2 rounded-lg text-sm font-semibold active:scale-95 transition-all disabled:opacity-70 inline-flex items-center gap-2"
            >
              {isFetching && (
                <span
                  aria-hidden="true"
                  className="inline-block w-3.5 h-3.5 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin"
                />
              )}
              {isFetching ? t('shops.retrying') : t('common.retry')}
            </button>
          </div>
        ) : isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => <ShopSkeleton key={i} />)}
          </div>
        ) : filteredShops.length === 0 ? (
          <div className="text-center py-16 px-4">
            {/* Contextual empty states */}
            {localSearch && activeFilterCount === 0 ? (
              <>
                <p className="text-4xl mb-3">🔍</p>
                <p className="font-semibold text-foreground">{t('shops.empty.search', { query: localSearch })}</p>
                <p className="text-sm text-muted-foreground mt-1">{t('shops.empty.search.hint')}</p>
                <div className="flex justify-center gap-2 mt-4">
                  <button
                    onClick={() => setLocalSearch('')}
                    className="bg-primary text-primary-foreground px-5 py-2 rounded-lg text-sm font-semibold active:scale-95 transition-all"
                  >
                    {t('shops.clearSearch')}
                  </button>
                  <button
                    onClick={() => navigate('/')}
                    className="bg-muted text-foreground px-5 py-2 rounded-lg text-sm font-semibold active:scale-95 transition-all"
                  >
                    {t('shops.browseCategories')}
                  </button>
                </div>
              </>
            ) : verifiedOnly && activeFilterCount === 1 ? (
              <>
                <p className="text-4xl mb-3">✅</p>
                <p className="font-semibold text-foreground">{t('shops.empty.verified.title')}</p>
                <p className="text-sm text-muted-foreground mt-1">{t('shops.empty.verified.hint')}</p>
                <div className="flex justify-center gap-2 mt-4">
                  <button
                    onClick={() => setVerifiedOnly(false)}
                    className="bg-primary text-primary-foreground px-5 py-2 rounded-lg text-sm font-semibold active:scale-95 transition-all"
                  >
                    {t('shops.empty.verified.cta')}
                  </button>
                </div>
              </>
            ) : availability === 'open' && activeFilterCount === 1 ? (
              <>
                <p className="text-4xl mb-3">🌙</p>
                <p className="font-semibold text-foreground">{t('shops.empty.open.title')}</p>
                <p className="text-sm text-muted-foreground mt-1">{t('shops.empty.open.hint')}</p>
                <div className="flex justify-center gap-2 mt-4">
                  <button
                    onClick={() => setAvailability('all')}
                    className="bg-primary text-primary-foreground px-5 py-2 rounded-lg text-sm font-semibold active:scale-95 transition-all"
                  >
                    {t('shops.empty.open.cta')}
                  </button>
                </div>
              </>
            ) : selectedAreas.length > 0 && activeFilterCount === selectedAreas.length ? (
              <>
                <MapPin className="w-10 h-10 mb-3 text-muted-foreground mx-auto" strokeWidth={1.5} />
                <p className="font-semibold text-foreground">
                  {t('shops.empty.area.title', { area: selectedAreas.length === 1 ? selectedAreas[0] : t('shops.empty.area.multipleAreas') })}
                </p>
                <p className="text-sm text-muted-foreground mt-1">{t('shops.empty.area.hint')}</p>
                <div className="flex justify-center gap-2 mt-4">
                  <button
                    onClick={() => setSelectedAreas([])}
                    className="bg-primary text-primary-foreground px-5 py-2 rounded-lg text-sm font-semibold active:scale-95 transition-all"
                  >
                    {t('shops.empty.area.cta')}
                  </button>
                </div>
              </>
            ) : activeFilterCount > 0 ? (
              <>
                <Search className="w-10 h-10 mb-3 text-muted-foreground mx-auto" strokeWidth={1.5} />
                <p className="font-semibold text-foreground">{t('shops.empty.filters.title')}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {t('shops.empty.filters.hint', { count: activeFilterCount })}
                </p>
                <div className="mt-5 max-w-sm mx-auto">
                  <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">{t('shops.empty.filters.removeLabel')}</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {availability !== 'all' && (
                      <button
                        onClick={() => setAvailability('all')}
                        className="inline-flex items-center gap-1.5 bg-muted text-foreground px-3 py-1.5 rounded-full text-xs font-medium hover:bg-muted/70 active:scale-95 transition-all"
                      >
                        <X className="w-3 h-3" />
                        {availability === 'open' ? t('shops.filters.openShort') : t('shops.filters.closedShort')}
                      </button>
                    )}
                    {verifiedOnly && (
                      <button
                        onClick={() => setVerifiedOnly(false)}
                        className="inline-flex items-center gap-1.5 bg-muted text-foreground px-3 py-1.5 rounded-full text-xs font-medium hover:bg-muted/70 active:scale-95 transition-all"
                      >
                        <X className="w-3 h-3" />
                        {t('shops.empty.filters.verifiedOnly')}
                      </button>
                    )}
                    {selectedAreas.map((a) => (
                      <button
                        key={`a-${a}`}
                        onClick={() => setSelectedAreas((prev) => prev.filter((x) => x !== a))}
                        className="inline-flex items-center gap-1.5 bg-muted text-foreground px-3 py-1.5 rounded-full text-xs font-medium hover:bg-muted/70 active:scale-95 transition-all"
                      >
                        <X className="w-3 h-3" />
                        <MapPin className="w-3 h-3" /> {a}
                      </button>
                    ))}
                    {selectedCategories.map((c) => (
                      <button
                        key={`c-${c}`}
                        onClick={() => setSelectedCategories((prev) => prev.filter((x) => x !== c))}
                        className="inline-flex items-center gap-1.5 bg-muted text-foreground px-3 py-1.5 rounded-full text-xs font-medium hover:bg-muted/70 active:scale-95 transition-all"
                      >
                        <X className="w-3 h-3" />
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex justify-center gap-2 mt-5">
                  <button
                    onClick={handleClearAllFiltersAndAnnounce}
                    className="bg-primary text-primary-foreground px-5 py-2 rounded-lg text-sm font-semibold active:scale-95 transition-all"
                  >
                    {t('shops.empty.filters.clearAll')}
                  </button>
                </div>
              </>
            ) : (
              <>
                <Store className="w-10 h-10 mb-3 text-muted-foreground mx-auto" strokeWidth={1.5} />
                <p className="font-semibold text-foreground">{t('shops.empty.none.title')}</p>
                <p className="text-sm text-muted-foreground mt-1">{t('shops.empty.none.hint')}</p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 mt-5 max-w-xs mx-auto">
                  <button
                    type="button"
                    onClick={() => window.dispatchEvent(new CustomEvent('open-list-shop-modal'))}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 bg-primary text-primary-foreground px-5 py-2.5 rounded-lg text-sm font-semibold shadow-xs active:scale-95 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    {t('request.modalTitle') || 'List Your Shop'}
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/')}
                    className="w-full sm:w-auto inline-flex items-center justify-center bg-muted text-foreground hover:bg-muted/80 px-5 py-2.5 rounded-lg text-sm font-semibold active:scale-95 transition-all"
                  >
                    {t('error.goHome')}
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pagedShops.map((shop: any, idx: number) => {
                // In-feed banner: only on page 1, after the 3rd and 8th card, when list is long enough
                const showAdAfter = safePage === 1 && pagedShops.length >= 4 && (idx === 2 || idx === 7);
                return (
                  <div key={shop.id}>
                    <ShopCard shop={shop as any} priority={safePage === 1 && idx < 2} />
                    {showAdAfter && (
                      <div className="mt-3">
                        <BannerSlot placement="shops_infeed" fallback="shops_inline" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {hasMore && (
              <div className="flex items-center justify-center mt-5">
                <button
                  onClick={() => setVisibleCount((prev) => prev + 24)}
                  className="px-5 py-2.5 rounded-lg border border-border text-sm font-semibold transition-colors hover:bg-muted inline-flex items-center gap-2"
                >
                  {t('shops.pagination.next') || 'Load more'}
                </button>
              </div>
            )}
            {filteredShops.length > 0 && (
              <p className="text-center text-xs text-muted-foreground mt-3">
                Showing {pagedShops.length} of {filteredShops.length}
              </p>
            )}
            <p role="status" aria-live="polite" className="sr-only">
              {t('shops.pagination.ariaSingle', { count: pagedShops.length })}
            </p>
          </>
        )}
      </main>

      <Footer />

      {/* Filter Bottom Sheet */}
      <Drawer open={filterOpen} onOpenChange={setFilterOpen}>
        <DrawerContent ref={filterSwipeRef} id="shops-filter-drawer" aria-label={t('filters.title')} className="max-h-[85vh]">
          <DrawerHeader className="flex items-center justify-between px-5 pt-4 pb-2">
            <DrawerTitle className="text-base font-bold">{t('filters.title')}</DrawerTitle>
            <DrawerDescription className="sr-only">{t('shops.filtersDrawerDesc')}</DrawerDescription>
            {(sheetAvailability !== 'all' || sheetAreas.length > 0 || sheetCategories.length > 0 || sheetVerifiedOnly) && (
              <button onClick={handleClearAll} className="text-sm text-primary font-semibold hover:opacity-70">
                {t('filters.clearAll')}
              </button>
            )}
          </DrawerHeader>

          <div className="overflow-y-auto px-5 pb-6 space-y-6">
            {/* Availability */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2.5">{t('filters.availability')}</p>
              <div className="flex gap-2" role="radiogroup" aria-label={t('filters.availability')}>
                {(['all', 'open', 'closed'] as AvailabilityFilter[]).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    role="radio"
                    aria-checked={sheetAvailability === opt}
                    onClick={() => setSheetAvailability(opt)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      sheetAvailability === opt
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-card text-foreground border-border hover:border-primary/40'
                    }`}
                  >
                    <span className="inline-flex items-center justify-center gap-1.5">
                      {opt === 'open' && <span className="w-2 h-2 rounded-full bg-success shrink-0" aria-hidden="true" />}
                      {opt === 'closed' && <span className="w-2 h-2 rounded-full bg-destructive shrink-0" aria-hidden="true" />}
                      {opt === 'all' ? t('shops.filter.all') : opt === 'open' ? t('shops.filter.open') : t('shops.filter.closed')}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Area / Locality */}
            {areaOptions.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {t('filters.areaLocality')}
                    {sheetAreas.length > 0 && (
                      <span className="ml-1.5 bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 text-[10px] font-bold">
                        {sheetAreas.length}
                      </span>
                    )}
                  </p>
                  {sheetAreas.length > 0 && (
                    <button onClick={() => setSheetAreas([])} className="text-xs text-primary font-semibold hover:opacity-70">
                      {t('filters.clear')}
                    </button>
                  )}
                </div>
                {/* Area search — shown when 6+ areas */}
                {areaOptions.length >= 6 && (
                  <div className="relative mb-2">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                    <input
                      type="text"
                      value={areaSearch}
                      onChange={(e) => setAreaSearch(e.target.value)}
                      placeholder={t('shops.areaSearchPlaceholder')}
                      className="w-full pl-8 pr-3 py-2 rounded-lg text-sm border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/50"
                    />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2" role="group" aria-label={t('filters.areaLocality')}>
                  {filteredAreaOptions.map((area) => {
                    const active = sheetAreas.includes(area);
                    const count = areaShopCounts[area] || 0;
                    return (
                      <button
                        key={area}
                        type="button"
                        aria-pressed={active}
                        aria-label={`${area}${count > 0 ? ` (${count})` : ''}`}
                        onClick={() => toggleSheetArea(area)}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm border transition-all text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                          active
                            ? 'bg-primary/10 text-primary border-primary/40 font-semibold'
                            : 'bg-card text-foreground border-border hover:border-primary/30'
                        }`}
                      >
                        <span aria-hidden="true" className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all ${
                          active ? 'bg-primary border-primary' : 'border-muted-foreground/40'
                        }`}>
                          {active && <Check className="w-3 h-3 text-primary-foreground" />}
                        </span>
                        <span className="truncate flex-1">{area}</span>
                        {count > 0 && (
                          <span className="text-[10px] text-muted-foreground shrink-0" aria-hidden="true">({count})</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Category */}
            {categoryOptions.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {t('filters.category')}
                    {sheetCategories.length > 0 && (
                      <span className="ml-1.5 bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 text-[10px] font-bold">
                        {sheetCategories.length}
                      </span>
                    )}
                  </p>
                  {sheetCategories.length > 0 && (
                    <button onClick={() => setSheetCategories([])} className="text-xs text-primary font-semibold hover:opacity-70">
                      {t('filters.clear')}
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2" role="group" aria-label={t('filters.category')}>
                  {categoryOptions.map((cat) => {
                    const active = sheetCategories.includes(cat.name);
                    const count = catShopCounts[cat.name] || 0;
                    const label = localizeCat(cat.id, cat.name);
                    return (
                      <button
                        key={cat.name}
                        type="button"
                        aria-pressed={active}
                        aria-label={`${label}${count > 0 ? ` (${count})` : ''}`}
                        onClick={() => toggleSheetCategory(cat.name)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-sm border transition-all font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                          active
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-card text-foreground border-border hover:border-primary/40'
                        }`}
                      >
                        <CategoryIcon name={cat.name} className="w-3.5 h-3.5" /> {label}
                        {count > 0 && (
                          <span className={`text-[10px] ${active ? 'text-primary-foreground/70' : 'text-muted-foreground'}`} aria-hidden="true">
                            ({count})
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Verified Only */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2.5">{t('filters.trust')}</p>
              <button
                type="button"
                role="switch"
                aria-checked={sheetVerifiedOnly}
                aria-label={t('filters.verifiedOnly')}
                onClick={() => setSheetVerifiedOnly((v) => !v)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  sheetVerifiedOnly
                    ? 'bg-primary/10 border-primary/40 text-primary'
                    : 'bg-card border-border text-foreground hover:border-primary/30'
                }`}
              >
                <span className="flex items-center gap-2.5 text-sm font-semibold">
                  <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                  {t('filters.verifiedOnly')}
                </span>
                <span aria-hidden="true" className={`w-11 h-6 rounded-full flex items-center transition-all duration-200 px-0.5 ${
                  sheetVerifiedOnly ? 'bg-primary justify-end' : 'bg-muted justify-start'
                }`}>
                  <span className="w-5 h-5 rounded-full bg-background shadow-sm" />
                </span>
              </button>
            </div>
          </div>

          {/* Apply CTA */}
          <div className="px-5 pt-2 border-t border-border pb-[max(2rem,env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={handleApply}
              aria-label={`${t('shops.filters')} — Show ${sheetPreviewCount} ${sheetPreviewCount === 1 ? 'shop' : 'shops'}`}
              className="w-full py-3.5 bg-primary text-primary-foreground rounded-xl font-bold text-sm active:scale-[0.98] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Show {sheetPreviewCount} {sheetPreviewCount === 1 ? 'Shop' : 'Shops'}
            </button>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
