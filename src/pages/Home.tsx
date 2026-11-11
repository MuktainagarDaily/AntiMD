import { useState, useMemo, useRef, useEffect } from 'react';
import { initWebVitals } from '@/lib/perf/webVitals';
import { PageSeo } from '@/components/seo/PageSeo';

import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, TrendingUp, Store, ShieldCheck, ChevronRight, Check, Sparkles, MapPin, Plus, AlertTriangle } from 'lucide-react';
import { UserMenuDrawer } from '@/components/UserMenuDrawer';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { isShopOpen, filterRetailShops } from '@/lib/shopUtils';
import { CategoryIcon } from '@/components/shared/CategoryIcon';
import { SectionIcon, type SectionKey } from '@/components/shared/SectionIcon';
import { BannerPopup } from '@/components/banners/BannerPopup';
import { BannerSlot } from '@/components/banners/BannerSlot';
import { HomeSearch } from '@/components/home/HomeSearch';
import { CategoryGrid } from '@/components/home/CategoryGrid';
import { ShopList } from '@/components/home/ShopList';
import { useCity } from '@/hooks/useCity';
import { LocationPill } from '@/components/shared/LocationPill';
import { DesktopNav } from '@/components/DesktopNav';
import { Footer } from '@/components/shared/Footer';
import logoIcon from '@/assets/logo-icon.png';
import { fetchActiveCriticalAlerts } from '@/lib/services/authorityService';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import { useSwipeDownToClose } from '@/hooks/useSwipeDownToClose';
import { useT } from '@/i18n';
import { useLocalizeCategoryName, useShopTranslations, useCategoryTranslations } from '@/hooks/useTranslationsCache';
import { buildShopFuse, fuzzySearchShops } from '@/lib/fuzzySearch';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';


type AvailabilityFilter = 'all' | 'open' | 'closed';




export default function Home() {
  const [search, setSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [filterOpen, setFilterOpen] = useState(false);
  const { ref: filterSwipeRef } = useSwipeDownToClose({
    isOpen: filterOpen,
    onClose: () => setFilterOpen(false),
  });
  const [showAllCats, setShowAllCats] = useState(false);
  const CATS_PER_PAGE = 8;
  const [areaSearch, setAreaSearch] = useState('');

  // Applied filter state
  const [availability, setAvailability] = useState<AvailabilityFilter>('all');
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  // Temporary sheet state (synced on open)
  const [sheetAvailability, setSheetAvailability] = useState<AvailabilityFilter>('all');
  const [sheetAreas, setSheetAreas] = useState<string[]>([]);
  const [sheetCategories, setSheetCategories] = useState<string[]>([]);
  const [sheetVerifiedOnly, setSheetVerifiedOnly] = useState(false);

  const navigate = useNavigate();
  const { t, locale } = useT();
  const { currentCity, currentVillage, townBrand, townName, districtName, stateName, branding, getPageTitle } = useCity();
  const localizeCat = useLocalizeCategoryName();
  const searchRef = useRef<HTMLInputElement>(null);
  const categorySectionRef = useRef<HTMLElement>(null);

  // MPULSE Phase 3 #4 — capture LCP/FCP/INP/CLS on Home so the ShopList
  // ("Recently Added") image priority + compression changes can be regression-
  // checked. Logs to console; sinks can be plugged in later.
  useEffect(() => { initWebVitals(); }, []);

  const { data: categories = [], isLoading: catsLoading } = useQuery({
    queryKey: ['categories'],
    placeholderData: (previousData) => previousData,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: shops = [] } = useQuery({
    queryKey: ['shops', 'all', currentCity.id, currentVillage?.id],
    placeholderData: (previousData) => previousData,
    queryFn: async () => {
      // Scoped by active town + optional village.
      // For Muktainagar, matches city_id = id OR city_id IS NULL (legacy data compatibility)
      let query = (supabase as any)
        .from('shops')
        .select(
          'id, name, slug, area, sub_area, address, image_url, photos, phone, whatsapp, opening_time, closing_time, is_open, is_verified, created_at, shop_owners(id), shop_categories(category_id, categories(name, icon, is_active)), mess_profiles(shop_id), pg_profiles(shop_id)'
        )
        .eq('is_active', true);

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

  const { data: criticalAlerts = [] } = useQuery({
    queryKey: ['authority-critical-alerts', currentCity.id],
    queryFn: () => fetchActiveCriticalAlerts(currentCity.id),
    staleTime: 60_000,
  });

  const openNowCount = useMemo(() => shops.filter((s) => isShopOpen(s)).length, [shops]);
  const verifiedCount = useMemo(() => shops.filter((s: any) => s.is_verified).length, [shops]);

  // Marathi overlays power bilingual + typo-tolerant search.
  const { data: shopTrMap } = useShopTranslations();
  const { data: catTrMap } = useCategoryTranslations();

  // Debounce the query: rapid typing was running fuzzy search and re-rendering
  // the suggestion list on every keystroke. 250 ms keeps it snappy while
  // collapsing bursts.
  const debouncedSearch = useDebouncedValue(search, 250);

  // MPULSE Rec #2 — search-index sidecar. Only fetched when the user focuses
  // the search box or starts typing. Merged into shops for fuse index.
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

  const homeFuse = useMemo(
    () => buildShopFuse(shopsForSearch, shopTrMap, catTrMap),
    [shopsForSearch, shopTrMap, catTrMap],
  );

  // Autocomplete suggestions — top 5 fuzzy matches (typo-tolerant, EN+MR)
  const searchSuggestions = useMemo(() => {
    if (!searchFocused || debouncedSearch.trim().length < 2) return [];
    return fuzzySearchShops(homeFuse, shopsForSearch, debouncedSearch, shopTrMap, catTrMap, 5);
  }, [homeFuse, shopsForSearch, debouncedSearch, searchFocused, shopTrMap, catTrMap]);

  const catShopCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    shops.forEach((shop) => {
      (shop as any).shop_categories?.forEach((sc: any) => {
        if (sc.category_id) counts[sc.category_id] = (counts[sc.category_id] || 0) + 1;
      });
    });
    return counts;
  }, [shops]);

  // Category counts by name (for filter drawer)
  const catNameCounts = useMemo(() => {
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

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => {
      const diff = (catShopCounts[b.id] || 0) - (catShopCounts[a.id] || 0);
      return diff !== 0 ? diff : a.name.localeCompare(b.name);
    }),
    [categories, catShopCounts]
  );

  const visibleCategories = useMemo(
    () => (showAllCats ? sortedCategories : sortedCategories.slice(0, CATS_PER_PAGE)),
    [sortedCategories, showAllCats, CATS_PER_PAGE]
  );
  const canExpandCats = sortedCategories.length > CATS_PER_PAGE;

  const recentShops = useMemo(
    () =>
      [...(shops as any[])]
        .filter((s) => s.name && s.phone && s.area)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 16),
    [shops]
  );

  // Derive area and category options from loaded shops
  const areaOptions = useMemo(() => {
    const seen = new Set<string>();
    (shops as any[]).forEach((s) => { const a = s.area?.trim(); if (a) seen.add(a); });
    return Array.from(seen).sort((a, b) => a.localeCompare(b));
  }, [shops]);

  const categoryOptions = useMemo(() => {
    const seen = new Map<string, { id: string; name: string; icon: string }>();
    (shops as any[]).forEach((s) => {
      s.shop_categories?.forEach((sc: any) => {
        const cat = sc.categories;
        const id = sc.category_id;
        if (cat?.name && cat.is_active !== false && !seen.has(cat.name)) {
          seen.set(cat.name, { id, name: cat.name, icon: cat.icon || '' });
        }
      });
    });
    return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [shops]);


  // Top 3 categories for quick chips
  const topCategories = useMemo(() => {
    return [...categoryOptions]
      .sort((a, b) => (catNameCounts[b.name] || 0) - (catNameCounts[a.name] || 0))
      .slice(0, 3);
  }, [categoryOptions, catNameCounts]);

  const applyFilters = (s: any, avail: AvailabilityFilter, areas: string[], cats: string[], verified: boolean) => {
    if (avail === 'open' && !isShopOpen(s)) return false;
    if (avail === 'closed' && isShopOpen(s)) return false;
    if (areas.length > 0 && !areas.includes(s.area?.trim() || '')) return false;
    if (cats.length > 0) {
      const shopCatNames = (s.shop_categories || []).map((sc: any) => sc.categories?.name).filter(Boolean);
      if (!cats.some((c) => shopCatNames.includes(c))) return false;
    }
    if (verified && !s.is_verified) return false;
    return true;
  };

  const sheetPreviewCount = useMemo(
    () => (shops as any[]).filter((s) => applyFilters(s, sheetAvailability, sheetAreas, sheetCategories, sheetVerifiedOnly)).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shops, sheetAvailability, sheetAreas, sheetCategories, sheetVerifiedOnly]
  );

  const activeFilterCount =
    (availability !== 'all' ? 1 : 0) + selectedAreas.length + selectedCategories.length + (verifiedOnly ? 1 : 0);

  const handleOpenFilter = () => {
    setSheetAvailability(availability);
    setSheetAreas(selectedAreas);
    setSheetCategories(selectedCategories);
    setSheetVerifiedOnly(verifiedOnly);
    setAreaSearch('');
    setFilterOpen(true);
  };

  const handleClearAll = () => {
    setSheetAvailability('all');
    setSheetAreas([]);
    setSheetCategories([]);
    setSheetVerifiedOnly(false);
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

  // Build a Shops URL from a filter set
  const buildShopsUrl = (
    avail: AvailabilityFilter,
    areas: string[],
    cats: string[],
    verified: boolean,
    searchText: string,
  ) => {
    const params = new URLSearchParams();
    if (searchText.trim()) params.set('search', searchText.trim());
    if (verified) params.set('filter', 'verified');
    else if (avail === 'open') params.set('filter', 'open');
    else if (avail === 'closed') params.set('filter', 'closed');
    areas.forEach((a) => params.append('area', a));
    cats.forEach((c) => params.append('category', c));
    const qs = params.toString();
    return `/${currentCity.slug}/shops${qs ? `?${qs}` : ''}`;
  };

  // Quick chip toggles — navigate immediately so the filter actually takes effect
  const toggleQuickCategory = (catName: string) => {
    const nextCats = selectedCategories.includes(catName)
      ? selectedCategories.filter((c) => c !== catName)
      : [...selectedCategories, catName];
    setSelectedCategories(nextCats);
    if (nextCats.length > 0) {
      navigate(buildShopsUrl(availability, selectedAreas, nextCats, verifiedOnly, search));
    }
  };

  const handleApplyAndNavigate = () => {
    setAvailability(sheetAvailability);
    setSelectedAreas(sheetAreas);
    setSelectedCategories(sheetCategories);
    setVerifiedOnly(sheetVerifiedOnly);
    setFilterOpen(false);
    navigate(buildShopsUrl(sheetAvailability, sheetAreas, sheetCategories, sheetVerifiedOnly, search));
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = search.trim();
    if (!q) { navigate(`/${currentCity.slug}/shops`); return; }

    const lower = q.toLowerCase();
    // Intelligent redirect to dedicated specialized modules
    if (
      lower.includes('mess') ||
      lower.includes('मेस') ||
      lower.includes('भोजनालय') ||
      lower.includes('tiffin') ||
      lower.includes('टिफिन') ||
      lower.includes('thali') ||
      lower.includes('थाळी') ||
      lower.includes('hotel') ||
      lower.includes('हॉटेल') ||
      lower.includes('restaurant') ||
      lower.includes('रेस्टॉरंट') ||
      lower.includes('dhaba') ||
      lower.includes('ढाबा') ||
      lower.includes('khanawal') ||
      lower.includes('खानावळ') ||
      lower.includes('जेवण')
    ) {
      toast.message(locale === 'mr' ? 'मेस, हॉटेल्स व जेवण विभाग उघडत आहे...' : 'Opening Mess, Hotels & Dining...');
      navigate(`/${currentCity.slug}/mess`);
      return;
    }

    if (
      lower.includes('pg') ||
      lower.includes('पीजी') ||
      lower.includes('hostel') ||
      lower.includes('वसतिगृह') ||
      lower.includes('room') ||
      lower.includes('खोली') ||
      lower.includes('bed')
    ) {
      toast.message(locale === 'mr' ? 'पीजी व वसतिगृह विभाग उघडत आहे...' : 'Opening PG & Hostels...');
      navigate(`/${currentCity.slug}/pg`);
      return;
    }

    if (
      lower.includes('school') ||
      lower.includes('शाळा') ||
      lower.includes('college') ||
      lower.includes('कॉलेज') ||
      lower.includes('institute')
    ) {
      toast.message(locale === 'mr' ? 'शाळा व कॉलेज विभाग उघडत आहे...' : 'Opening Schools & Colleges...');
      navigate(`/${currentCity.slug}/schools`);
      return;
    }

    if (
      lower.includes('bus') ||
      lower.includes('बस') ||
      lower.includes('timetable') ||
      lower.includes('वेळापत्रक')
    ) {
      toast.message(locale === 'mr' ? 'बस वेळापत्रक उघडत आहे...' : 'Opening Bus Timetable...');
      navigate(`/${currentCity.slug}/bus-timetable`);
      return;
    }

    // If query matches a category name
    const matchedCat = categories.find(
      (c) => c.name.toLowerCase() === q.toLowerCase()
    );
    if (matchedCat) {
      const mcLower = matchedCat.name.toLowerCase();
      if (
        mcLower.includes('mess') ||
        mcLower.includes('dining') ||
        mcLower.includes('restaurant') ||
        mcLower.includes('hotel')
      ) {
        toast.message(locale === 'mr' ? 'मेस, हॉटेल्स व जेवण विभाग उघडत आहे...' : 'Opening Mess, Hotels & Dining...');
        navigate(`/${currentCity.slug}/mess`);
        return;
      }
      if (mcLower.includes('pg') || mcLower.includes('hostel')) {
        navigate(`/${currentCity.slug}/pg`);
        return;
      }
      toast.message(t('home.openingCategory', { name: matchedCat.name }));
      navigate(`/${currentCity.slug}/shops?category=${encodeURIComponent(matchedCat.name)}`);
    } else {
      toast.message(t('home.searching', { q }));
      navigate(`/${currentCity.slug}/shops?search=${encodeURIComponent(q)}`);
    }
  };

  const scrollToCategories = () => {
    categorySectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const availabilityLabel: Record<AvailabilityFilter, string> = {
    all: 'All Shops', open: 'Open Now', closed: 'Closed Now',
  };

  // Filtered areas for drawer search
  const filteredAreaOptions = useMemo(() => {
    if (!areaSearch.trim()) return areaOptions;
    const q = areaSearch.trim().toLowerCase();
    return areaOptions.filter((a) => a.toLowerCase().includes(q));
  }, [areaOptions, areaSearch]);

  return (
    <div className="min-h-screen bg-background">
      <BannerPopup />
      <PageSeo
        title={getPageTitle(t('common.businessDirectory', { defaultValue: 'Local Business Directory' }))}
        description={branding.metaDescription}
        path={`/${currentCity.slug}`}
        jsonLd={[
          {
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: townBrand,
            url: `https://muktainagar-daily.lovable.app/${currentCity.slug}`,
            potentialAction: {
              '@type': 'SearchAction',
              target: `https://muktainagar-daily.lovable.app/${currentCity.slug}/shops?search={search_term_string}`,
              'query-input': 'required name=search_term_string',
            },
          },
          {
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: townBrand,
            url: `https://muktainagar-daily.lovable.app/${currentCity.slug}`,
            logo: 'https://muktainagar-daily.lovable.app/icons/icon-512.png',
            areaServed: {
              '@type': 'City',
              name: currentCity.name,
              containedInPlace: {
                '@type': 'AdministrativeArea',
                name: `${districtName}, ${stateName}, India`,
              },
            },
          },
        ]}
      />

      {/* Hero Header */}
      <header
        className="text-primary-foreground px-4 pt-12 sm:pt-7 pb-6 relative"
        style={{
          background: 'linear-gradient(145deg, hsl(var(--primary)) 0%, hsl(214 85% 28%) 60%, hsl(215 90% 22%) 100%)',
        }}
      >
        {/* Decorative blobs/grid — clipped by their own wrapper so the header itself
            does not clip the autocomplete dropdown that extends below it. */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div
            className="absolute top-0 right-0 w-56 h-56 rounded-full opacity-[0.08]"
            style={{ background: 'radial-gradient(circle, white, transparent)', transform: 'translate(35%, -35%)' }}
          />
          <div
            className="absolute bottom-0 left-0 w-36 h-36 rounded-full opacity-[0.07]"
            style={{ background: 'radial-gradient(circle, hsl(var(--secondary)), transparent)', transform: 'translate(-35%, 35%)' }}
          />
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage: 'linear-gradient(hsl(var(--primary-foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary-foreground)) 1px, transparent 1px)',
              backgroundSize: '32px 32px',
            }}
          />
        </div>

        {/* Language switcher & User menu for mobile only — pinned to top-right */}
        <div className="absolute top-2 right-3 sm:top-3 sm:right-4 z-30 md:hidden">
          <LanguageSwitcher />
        </div>
        <div className="absolute right-3 sm:right-4 top-[58px] sm:top-[72px] z-30 md:hidden">
          <UserMenuDrawer />
        </div>

        {/* Desktop Header Topbar (>= md screens) */}
        <div className="hidden md:flex items-center justify-between max-w-6xl xl:max-w-7xl mx-auto px-4 lg:px-6 mb-5 pb-3 border-b border-primary-foreground/15 relative z-20">
          <div className="flex items-center gap-3">
            <span className="font-extrabold text-lg text-primary-foreground tracking-tight">
              {locale === 'mr' ? 'अपनाLocal' : 'ApnaLocal'}
            </span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-primary-foreground/15 text-primary-foreground border border-primary-foreground/20">
              {townName}
            </span>
          </div>

          <DesktopNav variant="primary" />

          <div className="flex items-center gap-2.5">
            <LanguageSwitcher />
            <UserMenuDrawer />
          </div>
        </div>

        <div className="max-w-lg md:max-w-2xl lg:max-w-3xl mx-auto relative z-10">
          {/* Brand Row — master brand ApnaLocal + dynamic town badge + canonical tagline */}
          <div className="relative flex flex-wrap items-center justify-center gap-2.5 sm:gap-3.5 mb-1 pr-12 sm:pr-14 md:pr-0">
            <div className="shrink-0 drop-shadow-md animate-[logo-enter_0.6s_cubic-bezier(0.34,1.56,0.64,1)_both]">
              <img
                src={logoIcon}
                alt="ApnaLocal Logo"
                width={80}
                height={80}
                loading="eager"
                decoding="async"
                // @ts-ignore
                fetchpriority="high"
                className="w-11 h-11 sm:w-14 sm:h-14 rounded-2xl border-2 border-primary-foreground/20 shadow-lg"
              />
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight leading-tight text-primary-foreground">
                  {locale === 'mr' ? 'अपनाLocal' : 'ApnaLocal'}
                </h1>
                <span className="text-xs sm:text-sm font-semibold px-2.5 py-0.5 rounded-full bg-primary-foreground/15 text-primary-foreground border border-primary-foreground/20 backdrop-blur-xs">
                  {townName}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs font-medium text-primary-foreground/90 mt-0.5 tracking-wide">
                {branding.tagline}
              </p>
            </div>
          </div>

          {/* Active Town / Village Picker Pill */}
          <div className="flex justify-center mt-1.5 mb-3">
            <LocationPill />
          </div>

          {/* Search Bar */}
          <HomeSearch
            ref={searchRef}
            search={search}
            onSearchChange={setSearch}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
            onSubmit={handleSearch}
            searchFocused={searchFocused}
            suggestions={searchSuggestions}
            localizeCat={localizeCat}
            onPickSuggestion={(shop, p) => {
              toast.message(t('home.openingCategory', { name: shop.name }));
              navigate(p);
            }}
          />

          {/* "Useful Today" (आजचे महत्त्वाचे) Section — 4 Rounded Action Pills */}
          <div className="mt-2.5 mb-2">
            <div className="flex items-center justify-between text-[11px] text-primary-foreground/80 font-medium px-1 mb-1.5">
              <span>{locale === 'mr' ? 'आजचे महत्त्वाचे' : 'Useful Today'}</span>
              <span className="text-[10px] text-primary-foreground/60">{locale === 'mr' ? 'थेट प्रवेश' : 'Quick Access'}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => navigate(`/${currentCity.slug}/mess`)}
                className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground border border-primary-foreground/15 transition-all active:scale-95 text-xs font-semibold backdrop-blur-xs shadow-xs"
              >
                <span>🍲</span>
                <span className="truncate">{locale === 'mr' ? 'आजचा मेनू' : "Today's Menu"}</span>
              </button>
              <button
                type="button"
                onClick={() => navigate(`/${currentCity.slug}/bus-timetable`)}
                className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground border border-primary-foreground/15 transition-all active:scale-95 text-xs font-semibold backdrop-blur-xs shadow-xs"
              >
                <span>🚌</span>
                <span className="truncate">{locale === 'mr' ? 'बस वेळापत्रक' : 'Bus Timetable'}</span>
              </button>
              <button
                type="button"
                onClick={() => navigate(`/${currentCity.slug}/pg`)}
                className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground border border-primary-foreground/15 transition-all active:scale-95 text-xs font-semibold backdrop-blur-xs shadow-xs"
              >
                <span>🛏️</span>
                <span className="truncate">{locale === 'mr' ? 'पीजी व खोल्या' : 'PG Availability'}</span>
              </button>
              <button
                type="button"
                onClick={() => navigate(`/${currentCity.slug}/shops?filter=open`)}
                className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl bg-emerald-500/25 hover:bg-emerald-500/35 text-emerald-100 border border-emerald-400/30 transition-all active:scale-95 text-xs font-semibold backdrop-blur-xs shadow-xs"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                <span className="truncate">
                  {locale === 'mr' ? `उघडी दुकाने (${openNowCount})` : `Open Now (${openNowCount})`}
                </span>
              </button>
            </div>
          </div>

          {/* Compact trust cues ribbon — scannable trust cues, tappable */}
          {shops.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap scrollbar-none text-[11px] font-semibold pt-1 text-primary-foreground">
              <button
                onClick={() => navigate(`/${currentCity.slug}/shops`)}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 hover:bg-primary-foreground/15 transition-colors"
                style={{ background: 'hsl(var(--primary-foreground) / 0.10)' }}
              >
                <Store className="w-3 h-3" />
                {shops.length >= 50 ? (
                  <>
                    <span className="font-bold tabular-nums">{shops.length}</span>
                    <span>{t('home.stats.shops', { count: shops.length }).replace(/^\S+\s*/, '')}</span>
                  </>
                ) : (
                  <span className="font-bold">{locale === 'mr' ? 'स्थानिक व्यवसाय' : 'Local Directory'}</span>
                )}
              </button>
              <span className="w-1 h-1 rounded-full bg-primary-foreground/50 shrink-0" />
              <button
                onClick={scrollToCategories}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 hover:bg-primary-foreground/15 transition-colors"
                style={{ background: 'hsl(var(--primary-foreground) / 0.08)' }}
              >
                <TrendingUp className="w-3 h-3" />
                <span className="font-bold tabular-nums">{categories.length}</span>
                <span>{t('home.stats.categories', { count: categories.length }).replace(/^\S+\s*/, '')}</span>
              </button>
              {verifiedCount > 0 && (
                <>
                  <span className="w-1 h-1 rounded-full bg-primary-foreground/50 shrink-0" />
                  <button
                    onClick={() => navigate(`/${currentCity.slug}/shops?filter=verified`)}
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 transition-opacity hover:opacity-90"
                    style={{ background: 'hsl(var(--secondary) / 0.20)', color: 'hsl(var(--secondary))' }}
                  >
                    <ShieldCheck className="w-3 h-3" />
                    <span className="font-bold">{t('home.stats.verified', { count: verifiedCount })}</span>
                  </button>
                </>
              )}
              <span className="w-1 h-1 rounded-full bg-primary-foreground/50 shrink-0" />
              <span className="shrink-0 text-primary-foreground/80 text-[10px]">
                {t('trust.noMiddlemen')}
              </span>
            </div>
          )}
        </div>
      </header>


      <main className="max-w-lg md:max-w-4xl lg:max-w-6xl xl:max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-5 pb-16">
        {/* Homepage Emergency Critical Alert Banner */}
        {criticalAlerts.length > 0 && (
          <div
            onClick={() => navigate(`/${currentCity.slug}/services`)}
            className="cursor-pointer mb-5 rounded-2xl border-2 border-rose-500/40 bg-gradient-to-r from-rose-500/20 via-rose-500/10 to-card p-3.5 sm:p-4 shadow-sm hover:border-rose-500/60 transition-all active:scale-[0.99] group"
          >
            <div className="flex items-start justify-between gap-2.5">
              <div className="flex items-start gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-rose-500/25 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 mt-0.5 animate-pulse">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-rose-600 text-white tracking-wider">
                      {locale === 'mr' ? 'नागरी तातडीची सूचना' : 'Civic Emergency Alert'}
                    </span>
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-amber-500/20 text-amber-800 dark:text-amber-200 border border-amber-500/30">
                      [DEMO]
                    </span>
                  </div>
                  <h3 className="text-xs sm:text-sm font-extrabold text-foreground mt-1 leading-snug line-clamp-1 group-hover:text-primary transition-colors">
                    {locale === 'mr' ? criticalAlerts[0].title_mr || criticalAlerts[0].title : criticalAlerts[0].title}
                  </h3>
                  <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                    {locale === 'mr' ? criticalAlerts[0].description_mr || criticalAlerts[0].description : criticalAlerts[0].description}
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-0.5 shrink-0 self-center">
                <span>{locale === 'mr' ? 'पहा' : 'View'}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>
        )}

        {/* Empty Town Onboarding Banner — transforms zero-data towns into merchant onboarding funnels */}
        {shops.length === 0 && (
          <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-card rounded-2xl border border-primary/20 p-5 text-center mb-5 shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3">
              <MapPin className="w-6 h-6" />
            </div>
            <h2 className="text-base sm:text-lg font-bold text-foreground mb-1">
              {locale === 'mr' ? `${townName} मध्ये आपले स्वागत आहे!` : `Welcome to ${townName}!`}
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-sm mx-auto mb-4">
              {locale === 'mr'
                ? `आम्ही ${townName} परिसरातील दुकाने व स्थानिक व्यवसाय जोडत आहोत. आपले दुकान किंवा व्यवसाय येथे मोफत नोंदवा!`
                : `We are expanding the local directory to ${townName}. Are you a business owner or service provider here? List your shop for free.`}
            </p>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('open-list-shop-modal'))}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>{locale === 'mr' ? '+ आपले दुकान मोफत जोडा' : '+ List Your Business Free'}</span>
            </button>
          </div>
        )}

        {/* Homepage inline banner */}
        <BannerSlot placement="homepage_inline" className="mb-5" />

        {/* Homepage bottom banner — falls back to homepage_inline */}
        <BannerSlot placement="home_bottom" fallback="homepage_inline" className="mb-5" />


        {/* Recently Added */}
        <ShopList shops={recentShops} />


        {/* Explore Your Locality — clean live modules only */}
        <section className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base sm:text-lg font-bold text-foreground">{t('home.browseSection')}</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3.5">
            {([
              { k: 'shops',   to: `/${currentCity.slug}/shops`, title: locale === 'mr' ? 'दुकाने' : 'Shops', sub: locale === 'mr' ? 'स्थानिक व्यवसाय' : 'Local Businesses' },
              { k: 'mess',    to: `/${currentCity.slug}/mess`, title: locale === 'mr' ? 'खाद्य व मेस' : 'Food & Mess', sub: locale === 'mr' ? 'आजचा मेनू व डबा' : "Today's Menu & Tiffin" },
              { k: 'pg',      to: `/${currentCity.slug}/pg`, title: locale === 'mr' ? 'पीजी व हॉस्टेल' : 'PG & Hostels', sub: locale === 'mr' ? 'खोल्या व जागा' : 'Rooms & Vacancy' },
              { k: 'bus',     to: `/${currentCity.slug}/bus-timetable`, title: locale === 'mr' ? 'बस वेळापत्रक' : 'Bus & Transit', sub: locale === 'mr' ? 'एसटी बसेस' : 'ST Bus Schedule' },
              { k: 'schools', to: `/${currentCity.slug}/schools`, title: locale === 'mr' ? 'शाळा-कॉलेज' : 'Education', sub: locale === 'mr' ? 'शिक्षण संस्था' : 'Schools & Colleges' },
              { k: 'gov',     to: `/${currentCity.slug}/services`, title: locale === 'mr' ? 'नागरी सेवा' : 'Civic Services', sub: locale === 'mr' ? 'पाणी, वीज, प्रशासन' : 'Water, Power & Local' },
            ] as { k: SectionKey; to: string; title: string; sub: string }[]).map((s) => (
              <button
                key={s.k}
                onClick={() => navigate(s.to)}
                className="group relative flex flex-col items-center justify-start gap-1 bg-card rounded-xl p-2.5 sm:p-3 border border-border hover:border-primary/50 hover:shadow-md transition-all duration-200 active:scale-[0.96] h-full min-h-[136px] sm:min-h-[146px]"
              >
                <div
                  className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center text-primary group-hover:scale-110 transition-transform duration-200"
                  style={{ background: 'linear-gradient(135deg, hsl(var(--primary) / 0.12), hsl(var(--primary) / 0.04))' }}
                >
                  <SectionIcon name={s.k} className="w-6 h-6 sm:w-7 sm:h-7" strokeWidth={1.75} />
                </div>
                <span className="font-bold text-foreground text-center leading-tight line-clamp-2 w-full text-xs sm:text-sm min-h-[2rem] flex items-center justify-center px-0.5">
                  {s.title}
                </span>
                <span className="text-[10px] text-muted-foreground text-center leading-tight line-clamp-2 w-full min-h-[1.75rem] flex items-center justify-center px-0.5">
                  {s.sub}
                </span>
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground/80 text-center mt-2.5 flex items-center justify-center gap-1.5">
            <Sparkles className="w-3 h-3 text-secondary shrink-0" />
            <span>{locale === 'mr' ? 'अधिक स्थानिक सेवा लवकरच: रुग्णालये, बँका, शासकीय कार्यालये' : 'More local services launching soon: Hospitals, Banks, Govt Offices'}</span>
          </p>
        </section>

        {/* Browse by Shop Category (existing — demoted under the Section hub) */}
        <CategoryGrid
          ref={categorySectionRef}
          categories={categories}
          visibleCategories={visibleCategories}
          catShopCounts={catShopCounts}
          showAllCats={showAllCats}
          onToggleShowAll={() => setShowAllCats((v) => !v)}
          canExpand={canExpandCats}
          loading={catsLoading}
          localizeCat={localizeCat}
        />

        {/* Community Growth Self-Serve Merchant Banner */}
        <section className="mt-6 mb-4">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-card to-secondary/10 border border-primary/20 p-4 sm:p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-primary/15 text-primary">
                  <Sparkles className="w-3 h-3" />
                  <span>{locale === 'mr' ? 'मोफत नोंदणी' : 'Free Listing'}</span>
                </div>
                <h3 className="text-base sm:text-lg font-bold text-foreground">
                  {locale === 'mr'
                    ? `${townName} मध्ये आपला व्यवसाय आहे का? ApnaLocal वर मोफत जोडा`
                    : `Own a business in ${townName}? List it on ApnaLocal for free`}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {locale === 'mr'
                    ? 'थेट कॉल व व्हॉट्सॲप — कोणतेही मध्यस्थ नाहीत. केवळ २ मिनिटांत ग्राहकांपर्यंत पोहोचा.'
                    : 'Direct Call & WhatsApp — No Middlemen. Reach hundreds of local customers in 2 minutes.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('open-list-shop-modal'))}
                className="shrink-0 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-primary text-primary-foreground shadow-md hover:bg-primary/90 transition-all active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>{locale === 'mr' ? 'आपला व्यवसाय जोडा' : 'List Your Business Free'}</span>
              </button>
            </div>
          </div>
        </section>

        {/* All Shops CTA */}
        <section className="mt-4 flex justify-center">
          <button
            onClick={() => navigate(`/${currentCity.slug}/shops`)}
            className="w-full max-w-md py-4 rounded-xl font-bold text-sm sm:text-base transition-all duration-200 active:scale-[0.97] flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
            style={{ background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(214 85% 30%))', color: 'hsl(var(--primary-foreground))' }}
          >
            <Store className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
            <span>{shops.length > 0 ? t('home.viewAllShops', { count: shops.length }) : t('home.viewAllShopsShort')}</span>
            <ChevronRight className="w-4 h-4 opacity-70" />
          </button>
        </section>


      </main>

      <Footer />

      {/* Filter Bottom Sheet */}
      <Drawer open={filterOpen} onOpenChange={setFilterOpen}>
        <DrawerContent ref={filterSwipeRef} className="max-h-[85vh]">
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
              <div className="flex gap-2">
                {(['all', 'open', 'closed'] as AvailabilityFilter[]).map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setSheetAvailability(opt)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                      sheetAvailability === opt
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-card text-foreground border-border hover:border-primary/40'
                    }`}
                  >
                    <span className="inline-flex items-center justify-center gap-1.5">
                      {opt === 'open' && <span className="w-2 h-2 rounded-full bg-success shrink-0" />}
                      {opt === 'closed' && <span className="w-2 h-2 rounded-full bg-destructive shrink-0" />}
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
                    <button onClick={() => setSheetAreas([])} className="text-xs text-primary font-semibold hover:opacity-70">{t('filters.clear')}</button>
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
                      placeholder={t('filters.searchAreas')}
                      className="w-full pl-8 pr-3 py-2 rounded-lg text-sm border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/50"
                    />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  {filteredAreaOptions.map((area) => {
                    const active = sheetAreas.includes(area);
                    const count = areaShopCounts[area] || 0;
                    return (
                      <button
                        key={area}
                        onClick={() => toggleSheetArea(area)}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm border transition-all text-left ${
                          active
                            ? 'bg-primary/10 text-primary border-primary/40 font-semibold'
                            : 'bg-card text-foreground border-border hover:border-primary/30'
                        }`}
                      >
                        <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all ${
                          active ? 'bg-primary border-primary' : 'border-muted-foreground/40'
                        }`}>
                          {active && <Check className="w-3 h-3 text-primary-foreground" />}
                        </span>
                        <span className="truncate flex-1">{area}</span>
                        {count > 0 && (
                          <span className="text-[10px] text-muted-foreground shrink-0">({count})</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Category — with sub-category placeholder row */}
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
                    <button onClick={() => setSheetCategories([])} className="text-xs text-primary font-semibold hover:opacity-70">{t('filters.clear')}</button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {categoryOptions.map((cat) => {
                    const active = sheetCategories.includes(cat.name);
                    const count = catNameCounts[cat.name] || 0;
                    return (
                      <button
                        key={cat.name}
                        onClick={() => toggleSheetCategory(cat.name)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs sm:text-sm border transition-all font-medium ${
                          active
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-card text-foreground border-border hover:border-primary/40'
                        }`}
                      >
                        <CategoryIcon name={cat.name} className="w-3.5 h-3.5" />
                        <span>{localizeCat(cat.id, cat.name)}</span>
                        {count > 0 && (
                          <span className={`text-[10px] ${active ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
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
                onClick={() => setSheetVerifiedOnly((v) => !v)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
                  sheetVerifiedOnly
                    ? 'bg-primary/10 border-primary/40 text-primary'
                    : 'bg-card border-border text-foreground hover:border-primary/30'
                }`}
              >
                <span className="flex items-center gap-2.5 text-sm font-semibold">
                  <span className="text-base">✅</span>
                  {t('filters.verifiedOnly')}
                </span>
                <span className={`w-11 h-6 rounded-full flex items-center transition-all duration-200 px-0.5 ${
                  sheetVerifiedOnly ? 'bg-primary justify-end' : 'bg-muted justify-start'
                }`}>
                  <span className="w-5 h-5 rounded-full bg-background shadow-sm" />
                </span>
              </button>
            </div>
          </div>

          {/* Apply CTA — navigates to Shops page with filters pre-applied */}
          <div className="px-5 pb-8 pt-2 border-t border-border">
            <button
              onClick={handleApplyAndNavigate}
              className="w-full py-3.5 bg-primary text-primary-foreground rounded-xl font-bold text-sm active:scale-[0.98] transition-all"
            >
              {t('filters.showResults', { count: sheetPreviewCount })}
            </button>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

function StatPill({
  icon,
  label,
  highlight,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  highlight?: boolean;
  onClick?: () => void;
}) {
  const base = `flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] sm:text-xs font-semibold shrink-0 transition-all duration-200 ${
    highlight
      ? 'bg-success/20 text-success border border-success/30'
      : 'bg-primary-foreground/15 text-primary-foreground border border-primary-foreground/10'
  }`;

  if (onClick) {
    return (
      <button
        onClick={onClick}
        className={`${base} hover:bg-primary-foreground/25 active:scale-95 cursor-pointer`}
      >
        {icon}
        <span>{label}</span>
        <ChevronRight className="w-2.5 h-2.5 opacity-50" />
      </button>
    );
  }

  return (
    <div className={base}>
      {icon}
      <span>{label}</span>
    </div>
  );
}
