import { useEffect, useMemo, useState } from 'react';
import {
  Plus, Pencil, ArrowUp, ArrowDown, Loader2, Eye, EyeOff,
  Megaphone, Home, Store, Tag, Bookmark, LayoutPanelTop, Image as ImageIcon,
  MousePointerClick, Calendar, ExternalLink, MapPin,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Banner, BannerPlacement, PLACEMENT_LABELS } from '@/lib/banners/types';
import { useAllBanners } from '@/hooks/useBanners';
import { useOptionalCity } from '@/hooks/useCity';
import { removeBanner, toggleActive, reorderBanners, setAllBannersActive } from '@/lib/banners/store';
import { adsState, setRuntimeAdsEnabled, runtimeAdsEnabled } from '@/lib/banners/flags';
import { BannerModal } from './BannerModal';
import { ConfirmTapButton } from './_shared/ConfirmTapButton';
import { EmptyState } from './_shared/EmptyState';
import { QuickFilters } from './_shared/QuickFilters';
import { useToast } from '@/hooks/use-toast';
import { optimizedImage } from '@/lib/uxUtils';

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
    hint: 'Full-screen splash shown once per session on Home.',
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
  home_bottom: 'Empty — falls back to "Homepage inline".',
  saved_inline: 'Empty — Saved Shops falls back to "Homepage inline".',
};

type StatusFilter = 'all' | 'active' | 'inactive';

export function AdvertisementsTab() {
  const banners = useAllBanners();
  const optionalCity = useOptionalCity();
  const allCities = optionalCity?.allCities ?? [];
  const cityMap = useMemo(() => new Map(allCities.map((c) => [c.id, c.name])), [allCities]);
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState<Banner | null | undefined>(undefined);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reorderingPlacement, setReorderingPlacement] = useState<BannerPlacement | null>(null);
  const [bulkBusy, setBulkBusy] = useState<'pause' | 'resume' | null>(null);
  const [runtimeOn, setRuntimeOn] = useState<boolean>(() => runtimeAdsEnabled());
  const [activeGroup, setActiveGroup] = useState<GroupKey | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

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

  /* Grouped banners --------------------------------------------------- */
  const grouped = useMemo(() => {
    const map = new Map<BannerPlacement, Banner[]>();
    const allPlacements = GROUPS.flatMap((g) => g.placements);
    for (const p of allPlacements) map.set(p, []);
    for (const b of banners) {
      if (statusFilter === 'active' && !b.is_active) continue;
      if (statusFilter === 'inactive' && b.is_active) continue;
      const list = map.get(b.placement) ?? [];
      list.push(b);
      map.set(b.placement, list);
    }
    return map;
  }, [banners, statusFilter]);

  const visibleGroups = activeGroup === 'all' ? GROUPS : GROUPS.filter((g) => g.key === activeGroup);

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
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-primary" />
            Advertisements
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Paid placements shown with a “Sponsored” label across the app.
          </p>
        </div>
        <button
          onClick={() => setEditing(null)}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 active:scale-95 transition shadow-sm"
        >
          <Plus className="w-4 h-4" /> New banner
        </button>
      </div>

      {/* ============ KPI STRIP ============ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatCard label="Total" value={total} />
        <StatCard label="Active" value={activeCount} tone="success" />
        <StatCard label="Views" value={totalViews.toLocaleString()} icon={Eye} />
        <StatCard
          label="Clicks · CTR"
          value={`${totalClicks.toLocaleString()} · ${ctr.toFixed(1)}%`}
          icon={MousePointerClick}
        />
      </div>

      {/* ============ VISIBILITY / BULK CONTROL ============ */}
      <div className="rounded-xl border border-border bg-card p-3 space-y-2.5">
        <div className="flex items-start justify-between gap-3">
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

      {/* ============ FILTERS ============ */}
      {total > 0 && (
        <div className="space-y-2">
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
              { value: 'active', label: 'Active', count: activeCount },
              { value: 'inactive', label: 'Inactive', count: inactiveCount },
            ]}
          />
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
      ) : (
        <div className="space-y-6">
          {visibleGroups.map((group) => {
            const GroupIcon = group.icon;
            const groupBanners = group.placements.flatMap((p) => grouped.get(p) ?? []);
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
                  const busyGroup = reorderingPlacement === p;
                  const PIcon = PLACEMENT_ICON[p];
                  return (
                    <div key={p} className="space-y-2 pl-1">
                      <header className="flex items-center justify-between">
                        <h4 className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground inline-flex items-center gap-1.5">
                          <PIcon className="w-3.5 h-3.5" />
                          {PLACEMENT_LABELS[p]}{' '}
                          <span className="text-foreground/70 normal-case font-semibold">
                            · {list.length}
                          </span>
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
                              cityName={b.target_city_id ? cityMap.get(b.target_city_id) : null}
                              index={i}
                              total={list.length}
                              busy={busyId === b.id}
                              busyGroup={busyGroup}
                              onToggle={() => handleToggle(b)}
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
  label, value, icon: Icon, tone,
}: {
  label: string;
  value: string | number;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: 'success';
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        {Icon && <Icon className="w-3 h-3" />}
        {label}
      </div>
      <div
        className={`mt-1 text-lg font-bold tabular-nums ${
          tone === 'success' ? 'text-success' : 'text-foreground'
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function BannerRow({
  banner: b, index: i, total, busy, busyGroup, cityName,
  onToggle, onEdit, onDelete, onMoveUp, onMoveDown,
}: {
  banner: Banner;
  index: number;
  total: number;
  busy: boolean;
  busyGroup: boolean;
  cityName?: string | null;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <article className="group bg-card rounded-xl border border-border p-3 flex gap-3 hover:border-primary/40 hover:shadow-sm transition">
      <div className="flex flex-col items-center justify-center gap-1 shrink-0">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={i === 0 || busyGroup}
          aria-label="Move up"
          className="w-7 h-7 inline-flex items-center justify-center rounded-md border border-border hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ArrowUp className="w-3.5 h-3.5" />
        </button>
        <span className="text-[10px] font-bold text-muted-foreground tabular-nums">{i + 1}</span>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={i === total - 1 || busyGroup}
          aria-label="Move down"
          className="w-7 h-7 inline-flex items-center justify-center rounded-md border border-border hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ArrowDown className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="w-20 h-20 rounded-lg overflow-hidden bg-muted shrink-0 border border-border">
        {b.image_url ? (
          <img
            src={optimizedImage(b.image_url, { width: 160 }) || b.image_url}
            alt={b.title}
            width={80}
            height={80}
            loading="lazy"
            decoding="async"
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
          <div className="flex items-center gap-2 min-w-0">
            <h4 className="text-sm font-bold text-foreground truncate">{b.title}</h4>
            {cityName ? (
              <span className="shrink-0 inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                <MapPin className="w-2.5 h-2.5" />
                {cityName}
              </span>
            ) : (
              <span className="shrink-0 inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                🌐 Global
              </span>
            )}
          </div>
          <button
            onClick={onToggle}
            disabled={busy}
            className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide transition ${
              b.is_active
                ? 'bg-success/15 text-success border border-success/30 hover:bg-success/25'
                : 'bg-muted text-muted-foreground border border-border hover:bg-muted/70'
            } disabled:opacity-60`}
            title={b.is_active ? 'Click to deactivate' : 'Click to activate'}
          >
            {b.is_active ? 'Active' : 'Inactive'}
          </button>
        </div>
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
        <div className="flex items-center justify-between gap-2 mt-1 flex-wrap">
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Eye className="w-3 h-3" />
              <strong className="text-foreground tabular-nums">{b.view_count}</strong>
            </span>
            <span className="inline-flex items-center gap-1">
              <MousePointerClick className="w-3 h-3" />
              <strong className="text-foreground tabular-nums">{b.click_count}</strong>
            </span>
            {(b.start_date || b.end_date) && (
              <span className="inline-flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {b.start_date || '…'} → {b.end_date || '…'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <button
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
