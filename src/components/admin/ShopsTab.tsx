/**
 * ShopsTab — migrated to `<EntityTab/>` (Forge rec #2).
 *
 * The shell now delegates header/search/filters/banner/table/footer
 * chrome to `<EntityTab/>`. Everything business-critical stays local:
 *  - useInfiniteQuery paging (fed through dataOverride)
 *  - IntersectionObserver-driven auto-loading
 *  - Broken-image scan mutation
 *  - Toggle-active / toggle-verified mutations (with ConfirmTapButton)
 *  - Delete confirmation dialog
 *  - Mobile card render (with per-shop dropdown)
 */
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useInfiniteQuery, useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchVillagesForCity } from '@/lib/geo/geoService';
import { filterRetailShops, isSpecializedCategoryName } from '@/lib/shopUtils';
import {
  Plus, Pencil, Trash2, Eye, EyeOff, Search, Filter, Loader2, ShieldCheck, ShieldOff,
  Upload, Download, ExternalLink, Zap, MoreHorizontal, Phone as PhoneIcon, ScanLine, MapPin,
} from 'lucide-react';
import { toast } from 'sonner';
import { useCity } from '@/hooks/useCity';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { downloadCsv } from '@/lib/csvUtils';
import { QuickFilters } from './_shared/QuickFilters';
import { AdminFab } from './_shared/AdminFab';
import { EmptyState } from './_shared/EmptyState';
import { ConfirmTapButton } from './_shared/ConfirmTapButton';
import { optimizedImage } from '@/lib/uxUtils';
import { verifyImageUrl } from '@/lib/imageVerify';
import { SafeImage } from '@/components/SafeImage';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { EntityTab } from './_shared/EntityTab';
import { ShopEntity, type ShopRow } from '@/lib/entities/shopEntity';
import type { EntityColumn } from '@/lib/entities/types';

type QuickFilter = 'all' | 'active' | 'hidden' | 'verified' | 'unverified' | 'noimage';

interface ShopsTabProps {
  onEdit: (shop: any) => void;
  onImport: () => void;
  onSpeedAdd: () => void;
}

export function ShopsTab({ onEdit, onImport, onSpeedAdd }: ShopsTabProps) {
  const { currentCity, allCities } = useCity();
  const qc = useQueryClient();
  const [searchText, setSearchText] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [cityFilter, setCityFilter] = useState<string>(() => currentCity?.slug || 'all');
  const [villageFilter, setVillageFilter] = useState<string>('all');
  const [quick, setQuick] = useState<QuickFilter>('all');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [scanning, setScanning] = useState(false);

  // Keep table's town filter synchronized when admin switches town in the top header
  useEffect(() => {
    if (currentCity?.slug) {
      setCityFilter(currentCity.slug);
      setVillageFilter('all');
    }
  }, [currentCity?.slug]);

  const selectedCityObj = useMemo(() => {
    if (!cityFilter || cityFilter === 'all') return null;
    return allCities.find((c) => c.slug === cityFilter || c.id === cityFilter) || null;
  }, [allCities, cityFilter]);

  const { data: cityVillages = [] } = useQuery({
    queryKey: ['admin-shops-villages', selectedCityObj?.id],
    queryFn: () => (selectedCityObj ? fetchVillagesForCity(selectedCityObj.id) : Promise.resolve([])),
    enabled: !!selectedCityObj?.id,
  });

  const debouncedSearch = useDebouncedValue(searchText, 300);

  const PAGE_SIZE = 40;
  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['admin-shops', { quick, search: debouncedSearch.trim(), categoryFilter, cityFilter, villageFilter }],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const from = (pageParam as number) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const select = categoryFilter
        ? '*, shop_categories!inner(categories(id, name, icon)), mess_profiles(shop_id), pg_profiles(shop_id)'
        : '*, shop_categories(categories(id, name, icon)), mess_profiles(shop_id), pg_profiles(shop_id)';
      let q = supabase
        .from('shops')
        .select(select, { count: 'estimated' })
        .order('created_at', { ascending: false });

      if (villageFilter && villageFilter !== 'all') {
        q = q.eq('village_id', villageFilter);
      } else if (cityFilter && cityFilter !== 'all') {
        const targetCity = allCities.find((c) => c.slug === cityFilter || c.id === cityFilter);
        if (targetCity) {
          if (targetCity.slug === 'muktainagar') {
            q = q.or(`city_id.eq.${targetCity.id},city_id.is.null`);
          } else {
            q = q.eq('city_id', targetCity.id);
          }
        }
      }

      if (quick === 'active') q = q.eq('is_active', true);
      else if (quick === 'hidden') q = q.eq('is_active', false);
      else if (quick === 'verified') q = q.eq('is_verified', true);
      else if (quick === 'unverified') q = q.eq('is_verified', false);
      else if (quick === 'noimage') {
        q = q.or('image_url.is.null,image_url.eq.,image_broken_at.not.is.null');
      }
      if (categoryFilter) {
        q = q.eq('shop_categories.category_id', categoryFilter);
      }
      const term = debouncedSearch.trim();
      if (term) {
        const esc = term.replace(/[%,()]/g, ' ').trim();
        const digits = term.replace(/\D/g, '');
        const ors = [
          `name.ilike.%${esc}%`,
          `area.ilike.%${esc}%`,
          `address.ilike.%${esc}%`,
        ];
        if (digits.length >= 3) {
          ors.push(`phone.ilike.%${digits}%`, `whatsapp.ilike.%${digits}%`);
        }
        q = q.or(ors.join(','));
      }
      const { data, error, count } = await q.range(from, to);
      if (error) throw error;
      return { rows: filterRetailShops(data ?? []), count: count ?? 0, page: pageParam as number };
    },
    getNextPageParam: (last) =>
      (last.rows?.length ?? 0) === PAGE_SIZE ? (last.page as number) + 1 : undefined,
  });
  const shops = useMemo(
    () => (data?.pages ?? []).flatMap((p: any) => p.rows ?? []) as ShopRow[],
    [data],
  );
  const totalEstimate = data?.pages?.[0]?.count ?? shops.length;

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasNextPage) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { rootMargin: '400px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const allCategories = useMemo(() => {
    const map = new Map<string, { id: string; name: string; icon: string }>();
    shops.forEach((s: any) => {
      s.shop_categories?.forEach((sc: any) => {
        if (sc.categories && !isSpecializedCategoryName(sc.categories.name)) {
          map.set(sc.categories.id, sc.categories);
        }
      });
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [shops]);

  const filtered = shops;

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('shops').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-shops'] }),
  });

  const toggleVerified = useMutation({
    mutationFn: async ({ id, is_verified }: { id: string; is_verified: boolean }) => {
      const { error } = await supabase.from('shops').update({ is_verified }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-shops'] });
      qc.invalidateQueries({ queryKey: ['admin-stats'] });
    },
  });

  const deleteShop = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('shops').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Shop deleted');
      setDeleteTarget(null);
      qc.invalidateQueries({ queryKey: ['admin-shops'] });
      qc.invalidateQueries({ queryKey: ['admin-stats'] });
    },
    onError: () => {
      toast.error('Failed to delete shop');
    },
  });

  const exportCsv = useCallback(() => {
    const headers = [
      'name', 'phone', 'whatsapp', 'area', 'sub_area', 'address',
      'description', 'keywords', 'opening_time', 'closing_time',
      'latitude', 'longitude', 'category', 'is_active', 'is_verified', 'is_open',
      'amenities', 'image_url', 'slug',
    ];
    const rows = filtered.map((s: any) => {
      const cats = (s.shop_categories || [])
        .map((sc: any) => sc.categories?.name)
        .filter(Boolean)
        .join(' | ');
      const amenities = Array.isArray(s.amenities)
        ? s.amenities.join('|')
        : (typeof s.amenities === 'string' ? s.amenities : '');
      return [
        s.name ?? '', s.phone ?? '', s.whatsapp ?? '', s.area ?? '',
        s.sub_area ?? '', s.address ?? '', s.description ?? '', s.keywords ?? '',
        s.opening_time ?? '', s.closing_time ?? '',
        s.latitude ?? '', s.longitude ?? '',
        cats,
        s.is_active ? 'true' : 'false',
        s.is_verified ? 'true' : 'false',
        s.is_open ? 'true' : 'false',
        amenities,
        s.image_url ?? '',
        s.slug ?? '',
      ];
    });
    downloadCsv('muktainagar-shops', headers, rows);
  }, [filtered]);

  const scanBrokenImages = useCallback(async () => {
    if (scanning) return;
    setScanning(true);
    const t = toast.loading('Scanning shop images…');
    try {
      const FRESH_DAYS = 7;
      const freshCutoff = new Date(Date.now() - FRESH_DAYS * 86400_000).toISOString();
      const { data: rows, error } = await supabase
        .from('shops')
        .select('id, image_url, image_checked_at, image_broken_at')
        .not('image_url', 'is', null)
        .neq('image_url', '')
        .or(`image_checked_at.is.null,image_checked_at.lt.${freshCutoff},image_broken_at.not.is.null`);
      if (error) throw error;
      const list = (rows ?? []) as { id: string; image_url: string }[];
      if (list.length === 0) {
        toast.success('All image links already verified recently — nothing to scan', { id: t });
        return;
      }
      const broken: string[] = [];
      const ok: string[] = [];
      const CONCURRENCY = 8;
      let i = 0;
      let done = 0;
      await Promise.all(
        Array.from({ length: Math.min(CONCURRENCY, list.length) }, async () => {
          while (i < list.length) {
            const row = list[i++];
            const result = await verifyImageUrl(row.image_url);
            if (result === 'broken') broken.push(row.id);
            else ok.push(row.id);
            done++;
            if (done % 10 === 0) {
              toast.loading(`Scanning shop images… ${done}/${list.length}`, { id: t });
            }
          }
        }),
      );
      const now = new Date().toISOString();
      if (broken.length > 0) {
        const { error: upErr } = await supabase
          .from('shops')
          .update({
            image_url: null,
            image_broken_at: now,
            image_checked_at: now,
          })
          .in('id', broken);
        if (upErr) throw upErr;
      }
      if (ok.length > 0) {
        const { error: okErr } = await supabase
          .from('shops')
          .update({ image_broken_at: null, image_checked_at: now })
          .in('id', ok);
        if (okErr) throw okErr;
      }
      toast.success(
        broken.length
          ? `Cleared ${broken.length} broken image link${broken.length === 1 ? '' : 's'} (of ${list.length} checked)`
          : `All ${list.length} image links are valid`,
        { id: t },
      );
      qc.invalidateQueries({ queryKey: ['admin-shops'] });
    } catch (e: any) {
      toast.error(e?.message ?? 'Image scan failed', { id: t });
    } finally {
      setScanning(false);
    }
  }, [scanning, qc]);

  // Extend the default ShopEntity columns with the interactive Status
  // and Verified toggles + the shop-tab-specific "Area" placement.
  const columns = useMemo<EntityColumn<ShopRow>[]>(
    () => [
      ...ShopEntity.columns.filter((c) => c.key !== 'area'),
      {
        key: 'area',
        header: 'Location / Area',
        hideOnMobile: true,
        render: (shop) => {
          const shopCity = allCities.find((c) => c.id === shop.city_id);
          return (
            <div className="flex flex-col">
              <span className="text-foreground font-semibold text-xs">
                {shopCity ? `📍 ${shopCity.name}` : '📍 Muktainagar'}
              </span>
              <span className="text-muted-foreground text-xs truncate max-w-[160px]">{shop.area || shop.address || '—'}</span>
            </div>
          );
        },
      },
      {
        key: 'status',
        header: 'Status',
        render: (shop) => (
          <ConfirmTapButton
            onConfirm={() => toggleActive.mutate({ id: shop.id, is_active: !shop.is_active })}
            title={shop.is_active ? 'Hide from public' : 'Make public'}
            confirmClassName="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-secondary text-secondary-foreground"
            confirmLabel="Tap to confirm"
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
              shop.is_active
                ? 'bg-success/10 text-success border border-success/30'
                : 'bg-muted text-muted-foreground border border-border'
            }`}
          >
            {shop.is_active ? <><Eye className="w-3 h-3" /> Active</> : <><EyeOff className="w-3 h-3" /> Hidden</>}
          </ConfirmTapButton>
        ),
      },
      {
        key: 'verified',
        header: 'Verified',
        hideOnMobile: true,
        render: (shop) => (
          <ConfirmTapButton
            onConfirm={() => toggleVerified.mutate({ id: shop.id, is_verified: !shop.is_verified })}
            title={shop.is_verified ? 'Click to unverify' : 'Click to verify'}
            confirmClassName="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-secondary text-secondary-foreground"
            confirmLabel="Tap to confirm"
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
              shop.is_verified
                ? 'bg-primary/10 text-primary border border-primary/30'
                : 'bg-muted text-muted-foreground border border-border hover:border-primary/40'
            }`}
          >
            {shop.is_verified
              ? <><ShieldCheck className="w-3 h-3" /> Verified</>
              : <><ShieldOff className="w-3 h-3" /> Unverified</>}
          </ConfirmTapButton>
        ),
      },
    ],
    [toggleActive, toggleVerified],
  );

  const filterActive = !!(searchText || categoryFilter || quick !== 'all');

  return (
    <div>
      <EntityTab<ShopRow>
        entity={ShopEntity}
        columns={columns}
        dataOverride={{ rows: filtered, isLoading }}
        title={
          <>
            Shops{' '}
            <span className="text-muted-foreground font-medium text-xs sm:text-sm">
              ({filtered.length !== shops.length
                ? `Showing ${filtered.length} of ${shops.length}`
                : `Showing ${shops.length}${hasNextPage ? ` of ~${totalEstimate}` : ''} shops`})
            </span>
          </>
        }
        onAdd={() => onEdit({})}
        addLabel="Add Shop"
        toolbarExtras={
          <>
            <div className="hidden md:flex flex-wrap gap-2">
              <button onClick={onImport} className="flex items-center gap-2 bg-card border border-border text-foreground px-3 py-2 rounded-lg font-semibold text-sm hover:bg-muted">
                <Upload className="w-4 h-4" /> Import
              </button>
              <button onClick={exportCsv} className="flex items-center gap-2 bg-card border border-border text-foreground px-3 py-2 rounded-lg font-semibold text-sm hover:bg-muted">
                <Download className="w-4 h-4" /> Export
              </button>
              <button onClick={onSpeedAdd} className="flex items-center gap-2 bg-secondary text-secondary-foreground px-3 py-2 rounded-lg font-semibold text-sm hover:bg-secondary/90">
                <Zap className="w-4 h-4" /> Speed Add (Quick)
              </button>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button aria-label="More actions" className="md:hidden inline-flex items-center justify-center w-9 h-9 rounded-lg bg-card border border-border">
                  <MoreHorizontal className="w-5 h-5 text-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onSpeedAdd}><Zap className="w-4 h-4 mr-2" /> Speed Add</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onImport}><Upload className="w-4 h-4 mr-2" /> Import CSV</DropdownMenuItem>
                <DropdownMenuItem onClick={exportCsv}><Download className="w-4 h-4 mr-2" /> Export CSV</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
        filters={
          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Search name, area, phone…"
                  className="w-full pl-9 pr-3 h-10 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              {allCategories.length > 0 && (
                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="pl-9 pr-2 h-10 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring appearance-none cursor-pointer max-w-[140px]"
                  >
                    <option value="">All cats</option>
                    {allCategories.map((c) => (
                      <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <select
                  value={cityFilter}
                  onChange={(e) => {
                    setCityFilter(e.target.value);
                    setVillageFilter('all');
                  }}
                  className="pl-9 pr-2 h-10 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring appearance-none cursor-pointer max-w-[150px]"
                  title="Filter shops by town"
                >
                  <option value="all">All Towns</option>
                  {allCities.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {cityVillages.length > 0 && (
                <div className="relative">
                  <select
                    value={villageFilter}
                    onChange={(e) => setVillageFilter(e.target.value)}
                    className="px-3 h-10 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring appearance-none cursor-pointer max-w-[160px]"
                    title="Filter shops by village"
                  >
                    <option value="all">All Villages / Wards</option>
                    {cityVillages.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <QuickFilters<QuickFilter>
              value={quick}
              onChange={setQuick}
              options={[
                { value: 'all', label: 'All', count: totalEstimate },
                { value: 'active', label: 'Active' },
                { value: 'hidden', label: 'Hidden' },
                { value: 'verified', label: 'Verified' },
                { value: 'unverified', label: 'Unverified' },
                { value: 'noimage', label: 'No image' },
              ]}
            />
          </div>
        }
        banner={
          quick === 'noimage' ? (
            <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-border bg-muted/40">
              <p className="text-xs text-muted-foreground">
                Some shops may still have an <code>image_url</code> that points to a deleted file.
                Scan to verify each link and clear broken ones — they'll then appear in this list.
              </p>
              <button
                type="button"
                onClick={scanBrokenImages}
                disabled={scanning}
                className="shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold px-3 h-8 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {scanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ScanLine className="w-3.5 h-3.5" />}
                {scanning ? 'Scanning…' : 'Scan broken images'}
              </button>
            </div>
          ) : /mess|hotel|restaurant|dhaba|tiffin|pg|hostel|school|hospital|doctor/i.test(debouncedSearch.trim()) ? (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 px-3 py-2.5 rounded-lg border border-primary/20 bg-primary/5 text-xs">
              <span className="text-foreground font-medium">
                Looking for Mess, Hotels, PG, or Schools? These specialized directories are managed in dedicated modules:
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <Link to="/admin/directory/mess" className="px-2.5 py-1 rounded bg-background border border-border text-foreground hover:border-primary font-semibold transition-colors">
                  🍽️ Mess & Hotels
                </Link>
                <Link to="/admin/directory/pg" className="px-2.5 py-1 rounded bg-background border border-border text-foreground hover:border-primary font-semibold transition-colors">
                  🛏️ PG & Hostels
                </Link>
                <Link to="/admin/sections/schools" className="px-2.5 py-1 rounded bg-background border border-border text-foreground hover:border-primary font-semibold transition-colors">
                  🎓 Schools
                </Link>
              </div>
            </div>
          ) : undefined
        }
        emptyState={
          <EmptyState
            icon={<Search className="w-6 h-6" />}
            title={filterActive ? 'No shops match current filters' : 'No shops yet'}
            hint={filterActive ? 'Try clearing filters.' : 'Add your first shop to get started.'}
            cta={!filterActive ? { label: 'Add Shop', onClick: () => onEdit({}) } : undefined}
          />
        }
        mobileCard={(shop) => (
          <ShopMobileCard
            shop={shop}
            onEdit={() => onEdit(shop)}
            onDelete={() => setDeleteTarget({ id: shop.id, name: shop.name })}
            onToggleActive={() => toggleActive.mutate({ id: shop.id, is_active: !shop.is_active })}
            onToggleVerified={() => toggleVerified.mutate({ id: shop.id, is_verified: !shop.is_verified })}
          />
        )}
        rowActions={(shop) => (
          <>
            <a
              aria-label="Preview public page"
              href={`/shop/${shop.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
              title="Preview public page"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
            <button aria-label="Edit shop" onClick={() => onEdit(shop)} className="p-1.5 text-primary hover:bg-primary/10 rounded-lg transition-colors">
              <Pencil className="w-4 h-4" />
            </button>
            <button aria-label="Delete shop" onClick={() => setDeleteTarget({ id: shop.id, name: shop.name })} className="p-1.5 text-destructive hover:bg-destructive/10 rounded-lg transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
          </>
        )}
        footer={
          !isLoading && shops.length > 0 ? (
            <div ref={sentinelRef} className="flex items-center justify-center py-4">
              {isFetchingNextPage ? (
                <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading more shops…
                </span>
              ) : hasNextPage ? (
                <button
                  type="button"
                  onClick={() => void fetchNextPage()}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted"
                >
                  Load more
                </button>
              ) : (
                <span className="text-[11px] text-muted-foreground">All shops loaded ({shops.length})</span>
              )}
            </div>
          ) : null
        }
      />

      <AdminFab onClick={() => onEdit({})} icon={<Plus className="w-5 h-5" />} label="Add Shop" />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this shop and all its data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteShop.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteShop.mutate(deleteTarget.id)}
              disabled={deleteShop.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteShop.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Deleting...</> : 'Delete Shop'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ─── Mobile card ──────────────────────────────────────────────── */
function ShopMobileCard({
  shop, onEdit, onDelete, onToggleActive, onToggleVerified,
}: {
  shop: any;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
  onToggleVerified: () => void;
}) {
  const cats = shop.shop_categories?.map((sc: any) => sc.categories).filter(Boolean) || [];
  const thumb = optimizedImage(shop.image_url, { width: 96 });
  return (
    <div className="bg-card rounded-xl border border-border p-3 flex gap-3">
      <SafeImage
        src={thumb}
        alt={shop.name}
        className="w-16 h-16 shrink-0 rounded-lg"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-foreground truncate flex items-center gap-1">
              {shop.name}
              {shop.is_verified && <ShieldCheck className="w-3.5 h-3.5 text-primary shrink-0" />}
            </p>
            {shop.area && <p className="text-[11px] text-muted-foreground truncate">{shop.area}</p>}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button aria-label="Shop actions" className="-mr-1 -mt-1 p-1.5 rounded-lg hover:bg-muted">
                <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}><Pencil className="w-4 h-4 mr-2" /> Edit</DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href={`/shop/${shop.id}`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4 mr-2" /> Preview
                </a>
              </DropdownMenuItem>
              {shop.phone && (
                <DropdownMenuItem asChild>
                  <a href={`tel:${shop.phone}`}>
                    <PhoneIcon className="w-4 h-4 mr-2" /> Call
                  </a>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
                <Trash2 className="w-4 h-4 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {cats.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {cats.slice(0, 2).map((c: any, i: number) => (
              <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-primary/10 text-primary">
                {c.icon} {c.name}
              </span>
            ))}
            {cats.length > 2 && <span className="text-[10px] text-muted-foreground">+{cats.length - 2}</span>}
          </div>
        )}

        <div className="flex items-center gap-1.5 mt-2">
          <ConfirmTapButton
            onConfirm={onToggleActive}
            confirmClassName="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-secondary text-secondary-foreground"
            confirmLabel="Confirm"
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold ${
              shop.is_active
                ? 'bg-success/10 text-success border border-success/30'
                : 'bg-muted text-muted-foreground border border-border'
            }`}
          >
            {shop.is_active ? <><Eye className="w-3 h-3" /> Active</> : <><EyeOff className="w-3 h-3" /> Hidden</>}
          </ConfirmTapButton>
          <ConfirmTapButton
            onConfirm={onToggleVerified}
            confirmClassName="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-secondary text-secondary-foreground"
            confirmLabel="Confirm"
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold ${
              shop.is_verified
                ? 'bg-primary/10 text-primary border border-primary/30'
                : 'bg-muted text-muted-foreground border border-border'
            }`}
          >
            {shop.is_verified ? <><ShieldCheck className="w-3 h-3" /> Verified</> : <><ShieldOff className="w-3 h-3" /> Unverified</>}
          </ConfirmTapButton>
        </div>
      </div>
    </div>
  );
}
