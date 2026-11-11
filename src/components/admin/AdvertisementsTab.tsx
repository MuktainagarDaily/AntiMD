import { useEffect, useMemo, useState } from 'react';
import {
  Plus, Pencil, ArrowUp, ArrowDown, Loader2, Eye, EyeOff,
  Megaphone, Home, Store, Tag, Bookmark, LayoutPanelTop, Image as ImageIcon,
  MousePointerClick, Calendar, ExternalLink, MapPin, Copy, RotateCcw,
  Search, X, AlertTriangle, Map as MapIcon, Lock, Download,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Banner,
  BannerCampaignStatus,
  BannerPlacement,
  PLACEMENT_LABELS,
  getBannerCampaignStatus,
  isBannerLive,
  isValidTargetUrl,
} from '@/lib/banners/types';
import { useAllBanners } from '@/hooks/useBanners';
import { useOptionalCity } from '@/hooks/useCity';
import {
  removeBanner,
  toggleActive,
  reorderBanners,
  setAllBannersActive,
  duplicateBanner,
  resetBannerMetrics,
} from '@/lib/banners/store';
import { adsState, setRuntimeAdsEnabled, runtimeAdsEnabled } from '@/lib/banners/flags';
import { BannerModal } from './BannerModal';
import { ConfirmTapButton } from './_shared/ConfirmTapButton';
import { EmptyState } from './_shared/EmptyState';
import { QuickFilters } from './_shared/QuickFilters';
import { useToast } from '@/hooks/use-toast';
import { optimizedImage } from '@/lib/uxUtils';
import { downloadCsv, townCsvFilename } from '@/lib/csvUtils';

/* ------------------------------------------------------------------ */
/* Grouping: organize 8 placement slots into 4 user-meaningful groups. */
/* ------------------------------------------------------------------ */

type GroupKey = 'popup' | 'home' | 'shops' | 'other';

interface GroupDef {
  key: GroupKey;
  label: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  placements: BannerPlacement[];
}

const GROUPS: GroupDef[] = [
  {
    key: 'popup',
    label: 'Popup',
    hint: 'Full-screen splash shown once per day on Home.',
    icon: LayoutPanelTop,
    placements: ['popup'],
  },
  {
    key: 'home',
    label: 'Homepage',
    hint: 'Inline banners across the Home feed.',
    icon: Home,
    placements: ['homepage_inline', 'home_bottom'],
  },
  {
    key: 'shops',
    label: 'Shops & Category',
    hint: 'Banners on the Shops list, in-feed, category and shop detail.',
    icon: Store,
    placements: ['shops_inline', 'shops_infeed', 'category_inline', 'shop_detail_inline'],
  },
  {
    key: 'other',
    label: 'Saved & Other',
    hint: 'Saved Shops and ancillary placements.',
    icon: Bookmark,
    placements: ['saved_inline'],
  },
];

const PLACEMENT_ICON: Record<BannerPlacement, React.ComponentType<{ className?: string }>> = {
  popup: LayoutPanelTop,
  homepage_inline: Home,
  home_bottom: Home,
  shops_inline: Store,
  shops_infeed: Store,
  category_inline: Tag,
  shop_detail_inline: Store,
  saved_inline: Bookmark,
};

const PLACEMENT_FALLBACK_HINT: Partial<Record<BannerPlacement, string>> = {
  category_inline: 'Empty — falls back to "Shops inline" when a single category is selected.',
  shops_infeed: 'Empty — in-feed slot falls back to "Shops inline".',
  shop_detail_inline: 'Empty — shop detail falls back to "Homepage inline".',
  home_bottom: 'Empty — falls back to "Homepage inline" (unclaimed banners).',
  saved_inline: 'Empty — Saved Shops falls back to "Homepage inline".',
};

type StatusFilter = 'all' | BannerCampaignStatus;

const CAMPAIGN_STATUS_META: Record<
  BannerCampaignStatus,
  { label: string; badgeCls: string; actionHint: string }
> = {
  live: {
    label: 'Live',
    badgeCls: 'bg-success/15 text-success border border-success/30 hover:bg-success/25',
    actionHint: 'Live on site — click to pause',
  },
  scheduled: {
    label: 'Scheduled',
    badgeCls: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 hover:bg-blue-500/25',
    actionHint: 'Scheduled for future start date — click to pause',
  },
  expired: {
    label: 'Expired',
    badgeCls: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/25',
    actionHint: 'End date has passed (not visible publicly) — click to pause or update dates',
  },
  paused: {
    label: 'Paused',
    badgeCls: 'bg-muted text-muted-foreground border border-border hover:bg-muted/70',
    actionHint: 'Paused — click to activate',
  },
};

function resolveBannerReach(
  b: Banner,
  cityMap: Map<string, string>,
  districtMap: Map<string, string>,
): { kind: 'city' | 'district' | 'global'; label: string } {
  const cid = b.target_city_id || (b as any).city_id;
  if (cid) {
    return { kind: 'city', label: cityMap.get(cid) || 'Specific town' };
  }
  if ((b.target_level === 'district' || b.target_district_id) && b.target_district_id) {
    const distName = districtMap.get(b.target_district_id) || 'District';
    return { kind: 'district', label: `${distName} Dist.` };
  }
  return { kind: 'global', label: '🌐 Global' };
}

export function AdvertisementsTab() {
  const banners = useAllBanners();
  const optionalCity = useOptionalCity();
  const allCities = optionalCity?.allCities ?? [];
  const { cityMap, districtMap, districtOptions } = useMemo(() => {
    const cMap = new Map<string, string>();
    const dMap = new Map<string, string>();
    for (const c of allCities) {
      cMap.set(c.id, c.name);
      if (c.district_id && !dMap.has(c.district_id)) {
        dMap.set(c.district_id, c.district?.name || 'District');
      }
    }
    return {
      cityMap: cMap,
      districtMap: dMap,
      districtOptions: Array.from(dMap.entries()).map(([id, name]) => ({ id, name })),
    };
  }, [allCities]);

  const qc = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState<Banner | null | undefined>(undefined);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reorderingPlacement, setReorderingPlacement] = useState<BannerPlacement | null>(null);
  const [bulkBusy, setBulkBusy] = useState<'pause' | 'resume' | null>(null);
  const [runtimeOn, setRuntimeOn] = useState<boolean>(() => runtimeAdsEnabled());
  const [activeGroup, setActiveGroup] = useState<GroupKey | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [targetFilter, setTargetFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const state = adsState();
  const offReason: 'build' | 'runtime' | null = state.on === false ? state.reason : null;

  useEffect(() => {
    const h = (e: Event) => setRuntimeOn((e as CustomEvent<boolean>).detail);
    window.addEventListener('md_ads_runtime_change', h as EventListener);
    return () => window.removeEventListener('md_ads_runtime_change', h as EventListener);
  }, []);

  /* Counts ------------------------------------------------------------ */
  const total = banners.length;
  const activeCount = banners.filter((b) => b.is_active).length;
  const inactiveCount = total - activeCount;

  const statusCounts = useMemo(() => {
    const counts: Record<BannerCampaignStatus, number> = {
      live: 0,
      scheduled: 0,
      expired: 0,
      paused: 0,
    };
    const now = new Date();
    for (const b of banners) {
      counts[getBannerCampaignStatus(b, now)] += 1;
    }
    return counts;
  }, [banners]);

  const totalViews = banners.reduce((s, b) => s + (b.view_count || 0), 0);
  const totalClicks = banners.reduce((s, b) => s + (b.click_count || 0), 0);
  const ctr = totalViews > 0 ? (totalClicks / totalViews) * 100 : 0;

  const countsByGroup = useMemo(() => {
    const m = new Map<GroupKey, number>();
    for (const g of GROUPS) {
      m.set(g.key, banners.filter((b) => g.placements.includes(b.placement)).length);
    }
    return m;
  }, [banners]);

  const isRowListFiltered =
    statusFilter !== 'all' || targetFilter !== 'all' || searchQuery.trim() !== '';

  /* Grouped banners --------------------------------------------------- */
  const { grouped, filteredTotal } = useMemo(() => {
    const map = new Map<BannerPlacement, Banner[]>();
    const allPlacements = GROUPS.flatMap((g) => g.placements);
    for (const p of allPlacements) map.set(p, []);
    const now = new Date();
    const q = searchQuery.trim().toLowerCase();
    let matchedCount = 0;

    for (const b of banners) {
      if (statusFilter !== 'all' && getBannerCampaignStatus(b, now) !== statusFilter) continue;

      if (targetFilter === 'global') {
        const cid = b.target_city_id || (b as any).city_id;
        if (cid || b.target_level === 'district' || b.target_district_id) continue;
      } else if (targetFilter.startsWith('city:')) {
        const targetCityId = targetFilter.slice(5);
        const cid = b.target_city_id || (b as any).city_id;
        if (cid !== targetCityId) continue;
      } else if (targetFilter.startsWith('district:')) {
        const targetDistrictId = targetFilter.slice(9);
        const cid = b.target_city_id || (b as any).city_id;
        if (cid || b.target_district_id !== targetDistrictId) continue;
      }

      if (q) {
        const reach = resolveBannerReach(b, cityMap, districtMap);
        const haystack = `${b.title} ${b.target_url} ${reach.label}`.toLowerCase();
        if (!haystack.includes(q)) continue;
      }

      const list = map.get(b.placement) ?? [];
      list.push(b);
      map.set(b.placement, list);
      matchedCount += 1;
    }
    return { grouped: map, filteredTotal: matchedCount };
  }, [banners, statusFilter, targetFilter, searchQuery, cityMap, districtMap]);

  const visibleGroups = activeGroup === 'all' ? GROUPS : GROUPS.filter((g) => g.key === activeGroup);

  const visibleBanners = useMemo(
    () => visibleGroups.flatMap((g) => g.placements.flatMap((p) => grouped.get(p) ?? [])),
    [visibleGroups, grouped],
  );

  const handleExportCtrCsv = () => {
    if (visibleBanners.length === 0) return;
    const now = new Date();
    const headers = [
      'Title',
      'Placement',
      'Placement Key',
      'Reach Scope',
      'Campaign Status',
      'Active',
      'Views',
      'Clicks',
      'CTR %',
      'Start Date',
      'End Date',
      'Target URL',
      'Sort Order',
      'Created At',
    ];
    const csvRows = visibleBanners.map((b) => {
      const views = b.view_count || 0;
      const clicks = b.click_count || 0;
      const rowCtr = views > 0 ? ((clicks / views) * 100).toFixed(2) : '0.00';
      const reach = resolveBannerReach(b, cityMap, districtMap);
      return [
        b.title,
        PLACEMENT_LABELS[b.placement] || b.placement,
        b.placement,
        reach.label,
        getBannerCampaignStatus(b, now),
        b.is_active ? 'Yes' : 'No',
        views,
        clicks,
        rowCtr,
        b.start_date || '',
        b.end_date || '',
        b.target_url || '',
        b.sort_order ?? 0,
        b.created_at || '',
      ];
    });
    downloadCsv(townCsvFilename(null, 'ad-campaigns'), headers, csvRows);
    toast({ title: `Exported ${csvRows.length} banner campaign${csvRows.length === 1 ? '' : 's'} to CSV` });
  };

  const clearRowFilters = () => {
    setStatusFilter('all');
    setTargetFilter('all');
    setSearchQuery('');
  };

  /* Mutations --------------------------------------------------------- */
  const invalidate = () => qc.invalidateQueries({ queryKey: ['banners'] });

  const handleToggle = async (b: Banner) => {
    setBusyId(b.id);
    try {
      await toggleActive(b.id, b.is_active);
      await invalidate();
    } catch (e: any) {
      toast({ title: 'Could not update', description: e?.message, variant: 'destructive' });
    } finally { setBusyId(null); }
  };

  const handleDuplicate = async (b: Banner) => {
    setBusyId(b.id);
    try {
      await duplicateBanner(b);
      await invalidate();
      toast({
        title: 'Banner duplicated',
        description: 'Created a paused copy so you can review dates/targeting before going live.',
      });
    } catch (e: any) {
      toast({ title: 'Could not duplicate', description: e?.message, variant: 'destructive' });
    } finally { setBusyId(null); }
  };

  const handleResetMetrics = async (b: Banner) => {
    setBusyId(b.id);
    try {
      await resetBannerMetrics(b.id);
      await invalidate();
      toast({ title: 'Metrics reset to 0' });
    } catch (e: any) {
      toast({ title: 'Could not reset metrics', description: e?.message, variant: 'destructive' });
    } finally { setBusyId(null); }
  };

  const handleDelete = async (b: Banner) => {
    setBusyId(b.id);
    try {
      await removeBanner(b.id, b.image_url);
      await invalidate();
      toast({ title: 'Banner deleted' });
    } catch (e: any) {
      toast({ title: 'Could not delete', description: e?.message, variant: 'destructive' });
    } finally { setBusyId(null); }
  };

  const handleMove = async (placement: BannerPlacement, index: number, dir: -1 | 1) => {
    if (isRowListFiltered) return;
    const list = grouped.get(placement) ?? [];
    const target = index + dir;
    if (target < 0 || target >= list.length) return;
    const next = list.slice();
    [next[index], next[target]] = [next[target], next[index]];
    setReorderingPlacement(placement);
    try {
      await reorderBanners(next.map((b) => b.id));
      await invalidate();
    } catch (e: any) {
      toast({ title: 'Could not reorder', description: e?.message, variant: 'destructive' });
    } finally { setReorderingPlacement(null); }
  };

  const handleBulk = async (mode: 'pause' | 'resume') => {
    setBulkBusy(mode);
    try {
      const changed = await setAllBannersActive(mode === 'resume');
      await invalidate();
      toast({
        title: mode === 'pause' ? 'All banners paused' : 'All banners resumed',
        description: `${changed} banner${changed === 1 ? '' : 's'} updated.`,
      });
    } catch (e: any) {
      toast({ title: 'Bulk action failed', description: e?.message, variant: 'destructive' });
    } finally { setBulkBusy(null); }
  };

  const bulkMode: 'pause' | 'resume' = activeCount > 0 ? 'pause' : 'resume';
  const bulkDisabled =
    bulkBusy !== null || total === 0 || (bulkMode === 'resume' && inactiveCount === 0);

  /* ------------------------------------------------------------------ */
  return (
    <div className="space-y-5">
      {/* ============ HEADER: title + primary action ============ */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-primary" />
            Advertisements
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Paid placements shown with a “Sponsored” label across the app.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleExportCtrCsv}
            disabled={visibleBanners.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-card text-foreground text-xs font-semibold hover:bg-muted transition disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" /> Export CTR CSV
          </button>
          <button
            onClick={() => setEditing(null)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 active:scale-95 transition shadow-sm"
          >
            <Plus className="w-4 h-4" /> New banner
          </button>
        </div>
      </div>

      {/* ============ KPI STRIP ============ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatCard label="Total" value={total} />
        <StatCard
          label="Active"
          value={activeCount}
          subtext={
            activeCount > 0 && statusCounts.live !== activeCount
              ? `${statusCounts.live} live now`
              : statusCounts.live > 0
                ? `${statusCounts.live} live`
                : undefined
          }
          tone="success"
        />
        <StatCard label="Views" value={totalViews.toLocaleString()} icon={Eye} />
        <StatCard
          label="Clicks · CTR"
          value={`${totalClicks.toLocaleString()} · ${ctr.toFixed(1)}%`}
          icon={MousePointerClick}
        />
      </div>

      {/* ============ VISIBILITY / BULK CONTROL ============ */}
      <div className="rounded-xl border border-border bg-card p-3 space-y-2.5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Ad visibility
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Global controls — overrides individual banner states.
            </p>
          </div>
          <span
            className={`shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${
              state.on
                ? 'bg-success/15 text-success border-success/30'
                : 'bg-muted text-muted-foreground border-border'
            }`}
          >
            {state.on ? 'Ads ON' : offReason === 'build' ? 'Ads OFF (build)' : 'Ads OFF (admin)'}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setRuntimeAdsEnabled(!runtimeOn)}
            disabled={offReason === 'build'}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border border-border bg-card hover:bg-muted disabled:opacity-50"
            title={offReason === 'build' ? 'Disabled at build time via VITE_ADS_ENABLED=false' : ''}
          >
            {runtimeOn ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {runtimeOn ? 'Hide ads for me' : 'Show ads for me'}
          </button>
          <button
            type="button"
            onClick={() => handleBulk(bulkMode)}
            disabled={bulkDisabled}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border border-border bg-card hover:bg-muted disabled:opacity-50"
          >
            {bulkBusy !== null && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {bulkMode === 'pause'
              ? `Pause all (${activeCount})`
              : `Resume all (${inactiveCount})`}
          </button>
          <p className="text-[10px] text-muted-foreground basis-full">
            “Hide ads for me” is a per-admin preview (local only). Use <em>Pause all</em> to take ads off the live site.
          </p>
        </div>
      </div>

      {/* ============ SEARCH & FILTERS ============ */}
      {total > 0 && (
        <div className="space-y-2.5">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search banner title, URL, or town…"
                aria-label="Search banners"
                className="w-full h-9 pl-8 pr-8 rounded-lg border border-border bg-card text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded inline-flex items-center justify-center text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <select
              value={targetFilter}
              onChange={(e) => setTargetFilter(e.target.value)}
              aria-label="Filter by target reach"
              className="h-9 sm:w-56 px-2.5 rounded-lg border border-border bg-card text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="all">All locations</option>
              <option value="global">🌐 Global only</option>
              {districtOptions.length > 0 && (
                <optgroup label="District-wide">
                  {districtOptions.map((d) => (
                    <option key={d.id} value={`district:${d.id}`}>
                      🗺️ {d.name} District
                    </option>
                  ))}
                </optgroup>
              )}
              {allCities.length > 0 && (
                <optgroup label="Specific Town">
                  {allCities.map((c) => (
                    <option key={c.id} value={`city:${c.id}`}>
                      📍 {c.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          <QuickFilters<GroupKey | 'all'>
            value={activeGroup}
            onChange={setActiveGroup}
            options={[
              { value: 'all', label: 'All groups', count: total },
              ...GROUPS.map((g) => ({
                value: g.key,
                label: g.label,
                count: countsByGroup.get(g.key) ?? 0,
              })),
            ]}
          />
          <QuickFilters<StatusFilter>
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: 'all', label: 'All', count: total },
              { value: 'live', label: 'Live', count: statusCounts.live },
              { value: 'scheduled', label: 'Scheduled', count: statusCounts.scheduled },
              { value: 'expired', label: 'Expired', count: statusCounts.expired },
              { value: 'paused', label: 'Paused', count: statusCounts.paused },
            ]}
          />

          {isRowListFiltered && (
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-800 dark:text-amber-300">
              <span className="inline-flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 shrink-0" />
                Slot reordering is locked while filters or search are active so sort priority stays accurate.
              </span>
              <button
                type="button"
                onClick={clearRowFilters}
                className="shrink-0 font-bold underline hover:no-underline"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>
      )}

      {/* ============ LIST ============ */}
      {total === 0 ? (
        <EmptyState
          icon={<Megaphone className="w-6 h-6" />}
          title="No banners yet"
          hint="Create your first banner to promote shops, festivals or local notices."
          cta={{ label: 'Create banner', onClick: () => setEditing(null) }}
        />
      ) : isRowListFiltered && filteredTotal === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/60 p-6 text-center space-y-2">
          <p className="text-sm font-semibold text-foreground">No banners match your active filters</p>
          <p className="text-xs text-muted-foreground">Try adjusting your search query, town reach, or status filter.</p>
          <button
            type="button"
            onClick={clearRowFilters}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background text-xs font-semibold hover:bg-muted"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {visibleGroups.map((group) => {
            const GroupIcon = group.icon;
            const groupBanners = group.placements.flatMap((p) => grouped.get(p) ?? []);
            if (isRowListFiltered && groupBanners.length === 0) return null;

            return (
              <section key={group.key} className="space-y-3">
                <div className="flex items-center gap-2 border-b border-border pb-2">
                  <span className="w-7 h-7 rounded-lg bg-primary/10 text-primary inline-flex items-center justify-center">
                    <GroupIcon className="w-4 h-4" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-foreground leading-tight">
                      {group.label}{' '}
                      <span className="text-muted-foreground font-medium">
                        ({groupBanners.length})
                      </span>
                    </h3>
                    <p className="text-[11px] text-muted-foreground leading-tight">{group.hint}</p>
                  </div>
                </div>

                {group.placements.map((p) => {
                  const list = grouped.get(p) ?? [];
                  if (isRowListFiltered && list.length === 0) return null;
                  const busyGroup = reorderingPlacement === p;
                  const PIcon = PLACEMENT_ICON[p];
                  const liveInSlot = list.filter((b) => isBannerLive(b)).length;
                  return (
                    <div key={p} className="space-y-2 pl-1">
                      <header className="flex items-center justify-between gap-2">
                        <h4 className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground inline-flex items-center gap-1.5 flex-wrap">
                          <PIcon className="w-3.5 h-3.5" />
                          {PLACEMENT_LABELS[p]}{' '}
                          <span className="text-foreground/70 normal-case font-semibold">
                            · {list.length}
                          </span>
                          {liveInSlot > 1 && (
                            <span className="text-[10px] font-semibold normal-case px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                              {p === 'popup' ? `Priority (${liveInSlot} live)` : `Rotating (${liveInSlot} live)`}
                            </span>
                          )}
                        </h4>
                        {busyGroup && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
                      </header>

                      {list.length === 0 ? (
                        <p className="text-[11px] text-muted-foreground italic px-3 py-2 rounded-lg bg-muted/40 border border-dashed border-border">
                          {PLACEMENT_FALLBACK_HINT[p] ?? 'No banners in this slot yet.'}
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {list.map((b, i) => (
                            <BannerRow
                              key={b.id}
                              banner={b}
                              reach={resolveBannerReach(b, cityMap, districtMap)}
                              index={i}
                              total={list.length}
                              busy={busyId === b.id}
                              busyGroup={busyGroup}
                              canReorder={!isRowListFiltered}
                              onToggle={() => handleToggle(b)}
                              onDuplicate={() => handleDuplicate(b)}
                              onResetMetrics={() => handleResetMetrics(b)}
                              onEdit={() => setEditing(b)}
                              onDelete={() => handleDelete(b)}
                              onMoveUp={() => handleMove(p, i, -1)}
                              onMoveDown={() => handleMove(p, i, +1)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </section>
            );
          })}
        </div>
      )}

      {editing !== undefined && (
        <BannerModal
          banner={editing}
          onClose={() => setEditing(undefined)}
          onSaved={() => setEditing(undefined)}
        />
      )}
    </div>
  );
}

/* =================================================================== */
/* Sub-components                                                       */
/* =================================================================== */

function StatCard({
  label, value, subtext, icon: Icon, tone,
}: {
  label: string;
  value: string | number;
  subtext?: string;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: 'success';
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        {Icon && <Icon className="w-3 h-3" />}
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span
          className={`text-lg font-bold tabular-nums ${
            tone === 'success' ? 'text-success' : 'text-foreground'
          }`}
        >
          {value}
        </span>
        {subtext && (
          <span className="text-[11px] text-muted-foreground font-medium">{subtext}</span>
        )}
      </div>
    </div>
  );
}

function BannerRow({
  banner: b,
  reach,
  index: i,
  total,
  busy,
  busyGroup,
  canReorder,
  onToggle,
  onDuplicate,
  onResetMetrics,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  banner: Banner;
  reach: { kind: 'city' | 'district' | 'global'; label: string };
  index: number;
  total: number;
  busy: boolean;
  busyGroup: boolean;
  canReorder: boolean;
  onToggle: () => void;
  onDuplicate: () => void;
  onResetMetrics: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [b.image_url]);

  const campaignStatus = getBannerCampaignStatus(b);
  const statusMeta = CAMPAIGN_STATUS_META[campaignStatus];
  const urlValid = isValidTargetUrl(b.target_url);
  const rowCtr = b.view_count > 0 ? ((b.click_count / b.view_count) * 100).toFixed(1) : null;
  const hasStats = (b.view_count || 0) > 0 || (b.click_count || 0) > 0;

  return (
    <article className="group bg-card rounded-xl border border-border p-3 flex gap-3 hover:border-primary/40 hover:shadow-sm transition">
      <div className="flex flex-col items-center justify-center gap-1 shrink-0">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={!canReorder || i === 0 || busyGroup}
          aria-label="Move up"
          title={canReorder ? 'Move up' : 'Clear filters to reorder'}
          className="w-7 h-7 inline-flex items-center justify-center rounded-md border border-border hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ArrowUp className="w-3.5 h-3.5" />
        </button>
        <span className="text-[10px] font-bold text-muted-foreground tabular-nums">{i + 1}</span>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={!canReorder || i === total - 1 || busyGroup}
          aria-label="Move down"
          title={canReorder ? 'Move down' : 'Clear filters to reorder'}
          className="w-7 h-7 inline-flex items-center justify-center rounded-md border border-border hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ArrowDown className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-lg overflow-hidden bg-muted shrink-0 border border-border">
        {b.image_url && !imgError ? (
          <img
            src={optimizedImage(b.image_url, { width: 160 }) || b.image_url}
            alt={b.title}
            width={80}
            height={80}
            loading="lazy"
            decoding="async"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <ImageIcon className="w-5 h-5" />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1 flex flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
            <h4 className="text-sm font-bold text-foreground truncate max-w-full sm:max-w-xs">{b.title}</h4>
            {reach.kind === 'city' ? (
              <span className="shrink-0 inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                <MapPin className="w-2.5 h-2.5" />
                {reach.label}
              </span>
            ) : reach.kind === 'district' ? (
              <span className="shrink-0 inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-accent/20 text-accent-foreground border border-border">
                <MapIcon className="w-2.5 h-2.5" />
                {reach.label}
              </span>
            ) : (
              <span className="shrink-0 inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                🌐 Global
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onToggle}
            disabled={busy}
            className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide transition ${statusMeta.badgeCls} disabled:opacity-60`}
            title={statusMeta.actionHint}
          >
            {statusMeta.label}
          </button>
        </div>

        {urlValid ? (
          <a
            href={b.target_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-muted-foreground hover:text-primary truncate inline-flex items-center gap-1"
            title={b.target_url}
          >
            <ExternalLink className="w-3 h-3 shrink-0" />
            <span className="truncate">{b.target_url}</span>
          </a>
        ) : (
          <span
            className="text-[11px] text-destructive truncate inline-flex items-center gap-1"
            title={b.target_url}
          >
            <AlertTriangle className="w-3 h-3 shrink-0" />
            <span className="truncate">{b.target_url}</span>
            <span className="shrink-0 font-semibold">(Invalid URL — edit to fix)</span>
          </span>
        )}

        <div className="flex items-center justify-between gap-2 mt-1 flex-wrap">
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
            <span className="inline-flex items-center gap-1">
              <Eye className="w-3 h-3" />
              <strong className="text-foreground tabular-nums">{b.view_count}</strong>
            </span>
            <span className="inline-flex items-center gap-1">
              <MousePointerClick className="w-3 h-3" />
              <strong className="text-foreground tabular-nums">{b.click_count}</strong>
              {rowCtr !== null && <span className="text-[10px]">({rowCtr}%)</span>}
            </span>
            {(b.start_date || b.end_date) && (
              <span className="inline-flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {b.start_date || '…'} → {b.end_date || '…'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={onDuplicate}
              disabled={busy}
              aria-label={`Duplicate ${b.title}`}
              title="Duplicate as paused copy"
              className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold text-foreground border border-border hover:bg-muted disabled:opacity-50"
            >
              <Copy className="w-3.5 h-3.5" /> Duplicate
            </button>
            <ConfirmTapButton
              onConfirm={onResetMetrics}
              disabled={busy || !hasStats}
              className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold border border-border text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40"
              confirmClassName="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-bold bg-amber-600 text-white"
              confirmLabel="Tap to reset"
            >
              <RotateCcw className="w-3 h-3" /> Reset stats
            </ConfirmTapButton>
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold text-foreground border border-border hover:bg-muted"
            >
              <Pencil className="w-3.5 h-3.5" /> Edit
            </button>
            <ConfirmTapButton
              onConfirm={onDelete}
              className="px-2 py-1.5 rounded-lg text-xs font-semibold border border-destructive/30 text-destructive hover:bg-destructive/10"
              confirmClassName="px-2 py-1.5 rounded-lg text-xs font-bold bg-destructive text-destructive-foreground"
              confirmLabel="Tap to delete"
            >
              Delete
            </ConfirmTapButton>
          </div>
        </div>
      </div>
    </article>
  );
}
