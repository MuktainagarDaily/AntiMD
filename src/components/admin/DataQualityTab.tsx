import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  Download,
  HardDrive,
  MapPin,
  RefreshCw,
  ShieldAlert,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useOptionalCity } from '@/hooks/useCity';
import { DEFAULT_CITIES } from '@/lib/geo/geoService';
import { downloadCsv, townCsvFilename } from '@/lib/csvUtils';
import {
  buildCityAreaSummary,
  buildListingHygieneReport,
  findDuplicateShops,
  findSimilarAreaGroups,
} from '@/lib/admin/dataQualityHelpers';
import { fetchAllPaginated } from '@/lib/admin/storageHealthService';
import { SystemDiagnosticsPanel } from './health/SystemDiagnosticsPanel';
import { StorageAuditPanel } from './health/StorageAuditPanel';
import { ListingHygienePanel } from './health/ListingHygienePanel';
import { AreaDuplicatesPanel } from './health/AreaDuplicatesPanel';

export type HealthSubTab = 'diagnostics' | 'storage' | 'hygiene' | 'areas';

interface DataQualityTabProps {
  onEditShop: (shop: any) => void;
  onEditSchool?: (school: any) => void;
  initialTab?: HealthSubTab;
}

export function DataQualityTab({
  onEditShop,
  onEditSchool,
  initialTab = 'diagnostics',
}: DataQualityTabProps) {
  const qc = useQueryClient();
  const cityCtx = useOptionalCity();
  const currentCity = cityCtx?.currentCity ?? DEFAULT_CITIES[0];
  const allCities = cityCtx?.allCities?.length ? cityCtx.allCities : DEFAULT_CITIES;

  const [activeTab, setActiveTab] = useState<HealthSubTab>(initialTab);
  const [cityFilter, setCityFilter] = useState<string>(currentCity?.id || 'all');
  const [storageIssueBadge, setStorageIssueBadge] = useState<number | null>(null);

  useEffect(() => {
    if (currentCity?.id) {
      setCityFilter(currentCity.id);
    }
  }, [currentCity?.id]);

  const muktainagarCity = useMemo(
    () => allCities.find((c) => c.slug?.toLowerCase() === 'muktainagar') ?? allCities[0] ?? null,
    [allCities],
  );

  const cityNameMap = useMemo(() => {
    const m = new Map<string, string>();
    allCities.forEach((c) => m.set(c.id, c.name));
    return m;
  }, [allCities]);

  const { data: shops = [], isLoading: shopsLoading } = useQuery({
    queryKey: ['admin-shops-quality'],
    queryFn: () =>
      fetchAllPaginated<any>(
        'shops',
        '*, shop_categories(categories(id, name, icon))',
        { orderBy: 'created_at', ascending: false },
      ),
  });

  const { data: schools = [] } = useQuery({
    queryKey: ['admin-schools-quality'],
    queryFn: () =>
      fetchAllPaginated<any>('schools', '*', {
        orderBy: 'created_at',
        ascending: false,
        optional: true,
      }),
  });

  const { data: translatedShopIds = new Set<string>() } = useQuery({
    queryKey: ['admin-translations-mr-ids'],
    queryFn: async () => {
      const rows = await fetchAllPaginated<{ shop_id: string; name?: string | null }>(
        'shop_translations',
        'shop_id, name',
        { optional: true },
      );
      // Note: filter only rows that have a Marathi name populated if column present
      const set = new Set<string>();
      for (const r of rows) {
        if (r.shop_id && (r.name === undefined || (r.name && r.name.trim()))) {
          set.add(r.shop_id);
        }
      }
      return set;
    },
  });

  const hygieneReport = useMemo(() => {
    return buildListingHygieneReport({
      shops,
      schools,
      translatedShopIds,
      cityFilter,
      defaultCityId: muktainagarCity?.id ?? null,
      cityNameMap,
    });
  }, [shops, schools, translatedShopIds, cityFilter, muktainagarCity?.id, cityNameMap]);

  const hygieneCount = hygieneReport.items.length;

  const duplicateGroups = useMemo(() => {
    return findDuplicateShops(shops, {
      cityFilter,
      defaultCityId: muktainagarCity?.id ?? null,
      cityNameMap,
    });
  }, [shops, cityFilter, muktainagarCity?.id, cityNameMap]);

  const areaDuplicateCount = useMemo(() => {
    const areaSummary = buildCityAreaSummary(shops, {
      cityFilter,
      defaultCityId: muktainagarCity?.id ?? null,
      cityNameMap,
    });
    const { groups } = findSimilarAreaGroups(areaSummary);
    return groups.size + duplicateGroups.length;
  }, [shops, cityFilter, muktainagarCity?.id, cityNameMap, duplicateGroups.length]);

  const handleExportAuditCsv = () => {
    const headers = [
      'Audit Type',
      'Entity Kind',
      'Listing Name',
      'Town',
      'Area',
      'Phone',
      'WhatsApp',
      'Verified',
      'Active',
      'Has GPS',
      'Flags / Match Reasons',
    ];
    const rows: unknown[][] = [];

    for (const item of hygieneReport.items) {
      rows.push([
        'Listing Hygiene',
        item.entityKind,
        item.name,
        item.cityName,
        item.area || '',
        item.phone || '',
        item.whatsapp || '',
        item.isVerified ? 'Yes' : 'No',
        item.isActive ? 'Yes' : 'No',
        item.hasGps ? 'Yes' : 'No',
        item.flags.join('|'),
      ]);
    }

    for (const grp of duplicateGroups) {
      for (const s of grp.shops) {
        rows.push([
          `Duplicate Group (${grp.id})`,
          'shop',
          s.name || '',
          grp.cityName,
          s.area || '',
          s.phone || '',
          s.whatsapp || '',
          s.is_verified ? 'Yes' : 'No',
          s.is_active !== false ? 'Yes' : 'No',
          s.latitude != null && s.longitude != null ? 'Yes' : 'No',
          grp.reasons.join('|'),
        ]);
      }
    }

    if (rows.length === 0) {
      toast.info('No hygiene or duplicate issues detected in this town scope');
      return;
    }

    const scopedSlug =
      cityFilter === 'all'
        ? null
        : allCities.find((c) => c.id === cityFilter)?.slug ?? null;
    downloadCsv(townCsvFilename(scopedSlug, 'data-quality-audit'), headers, rows);
    toast.success(`Exported ${rows.length} audit issue row${rows.length === 1 ? '' : 's'} to CSV`);
  };

  const handleRefreshAll = () => {
    qc.invalidateQueries({ queryKey: ['admin-shops-quality'] });
    qc.invalidateQueries({ queryKey: ['admin-schools-quality'] });
    qc.invalidateQueries({ queryKey: ['admin-translations-mr-ids'] });
  };

  if (shopsLoading && activeTab !== 'diagnostics') {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-card rounded-xl p-4 border border-border skeleton-shimmer h-16" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Town Scope Bar */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground">Storage &amp; System Health</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Infrastructure diagnostics, multi-table bucket audit, listing hygiene, and city-scoped deduplication.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-2.5 py-1.5 text-xs">
            <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="text-muted-foreground font-medium hidden sm:inline">Town Scope:</span>
            <select
              aria-label="Town scope filter"
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="bg-transparent font-semibold text-foreground focus:outline-none cursor-pointer"
            >
              <option value="all">All Towns ({shops.length})</option>
              {allCities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={handleExportAuditCsv}
            disabled={hygieneCount === 0 && duplicateGroups.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-muted text-xs font-semibold text-foreground transition-colors disabled:opacity-50"
            title="Export Hygiene & Duplicate Audit Report CSV"
          >
            <Download className="w-3.5 h-3.5" />
            Export Audit CSV
          </button>

          <button
            onClick={handleRefreshAll}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-muted text-xs font-semibold text-foreground transition-colors"
            title="Refresh directory health data"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-border pb-3">
        {(
          [
            {
              key: 'diagnostics' as const,
              label: 'System Health',
              icon: Activity,
              badge: null,
            },
            {
              key: 'storage' as const,
              label: 'Storage & Media Audit',
              icon: HardDrive,
              badge: storageIssueBadge,
            },
            {
              key: 'hygiene' as const,
              label: 'Listing Hygiene',
              icon: ShieldAlert,
              badge: hygieneCount,
            },
            {
              key: 'areas' as const,
              label: 'Areas & Duplicates',
              icon: Users,
              badge: areaDuplicateCount,
            },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              role="tab"
              aria-selected={active}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors border ${
                active
                  ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                  : 'bg-card text-muted-foreground border-border hover:bg-muted hover:text-foreground'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              {tab.badge !== null && tab.badge > 0 && (
                <span
                  className={`inline-flex items-center justify-center min-w-[1.25rem] h-4 px-1 rounded-full text-[10px] font-bold ${
                    active
                      ? 'bg-primary-foreground/20 text-primary-foreground'
                      : 'bg-secondary/20 text-secondary'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'diagnostics' && <SystemDiagnosticsPanel />}

      {activeTab === 'storage' && (
        <StorageAuditPanel
          cityFilter={cityFilter}
          defaultCityId={muktainagarCity?.id ?? null}
          cityNameMap={cityNameMap}
          onEditShop={onEditShop}
          onEditSchool={onEditSchool}
          shops={shops}
          schools={schools}
          onAuditChanged={(orphans, broken) => setStorageIssueBadge(orphans + broken)}
        />
      )}

      {activeTab === 'hygiene' && (
        <ListingHygienePanel
          shops={shops}
          schools={schools}
          translatedShopIds={translatedShopIds}
          cityFilter={cityFilter}
          defaultCityId={muktainagarCity?.id ?? null}
          cityNameMap={cityNameMap}
          onEditShop={onEditShop}
          onEditSchool={onEditSchool}
        />
      )}

      {activeTab === 'areas' && (
        <AreaDuplicatesPanel
          shops={shops}
          cityFilter={cityFilter}
          defaultCityId={muktainagarCity?.id ?? null}
          cityNameMap={cityNameMap}
          onEditShop={onEditShop}
        />
      )}
    </div>
  );
}
