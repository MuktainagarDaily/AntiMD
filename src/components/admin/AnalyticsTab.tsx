import { useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { TrendingUp, Phone, MessageCircle, Download, Upload, GraduationCap, ExternalLink, MapPin, FileText } from 'lucide-react';
import { AnalyticsCsvImportModal } from './AnalyticsCsvImportModal';
import { downloadCsv, fetchAllPaged, townCsvFilename } from '@/lib/csvUtils';
import { useCity } from '@/hooks/useCity';
import { isMissingRelationErr } from '@/lib/entities/claimEntity';
import { SCHOOL_TYPE_CONFIG, resolveSchoolType } from '@/lib/schools/schoolHelpers';

type DateRange = '7d' | '30d' | 'all';
const DATE_RANGE_OPTIONS: { label: string; value: DateRange }[] = [
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
  { label: 'All time', value: 'all' },
];

type ShopSort = 'total' | 'call' | 'whatsapp';

interface ShopLookupEntry {
  name: string;
  area: string | null;
  city_id: string | null;
  categories: { id: string; name: string; icon: string }[];
}

interface SchoolLookupEntry {
  name: string;
  area: string | null;
  city_id: string | null;
  schoolTypeLabel: string;
}

export function AnalyticsTab() {
  const { allCities } = useCity();
  const [selectedCityId, setSelectedCityId] = useState<string>('all');
  const [dateRange, setDateRange] = useState<DateRange>('30d');
  const [shopSort, setShopSort] = useState<ShopSort>('total');
  const [showAnalyticsImport, setShowAnalyticsImport] = useState(false);
  const qc = useQueryClient();

  const cutoff = useMemo(() => {
    if (dateRange === 'all') return null;
    const d = new Date();
    d.setDate(d.getDate() - (dateRange === '7d' ? 7 : 30));
    return d.toISOString();
  }, [dateRange]);

  const selectedCity = useMemo(
    () => (selectedCityId === 'all' ? null : allCities.find((c) => c.id === selectedCityId) ?? null),
    [allCities, selectedCityId],
  );
  const citySlugForFile = selectedCityId === 'all' ? 'all-towns' : (selectedCity?.slug || 'town');
  const cityNameById = useMemo(() => {
    const m = new Map<string, string>();
    allCities.forEach((c) => m.set(c.id, c.name));
    return m;
  }, [allCities]);

  // Fetch shop engagement paginated past 1,000 rows (up to 25,000 most recent events)
  const { data: rows = [], isLoading: rowsLoading } = useQuery({
    queryKey: ['admin-engagement', dateRange],
    queryFn: async () => {
      return fetchAllPaged<{ shop_id: string; event_type: string; created_at: string }>((from, to) => {
        let query = supabase
          .from('shop_engagement')
          .select('shop_id, event_type, created_at')
          .order('created_at', { ascending: false })
          .range(from, to);
        if (cutoff) query = query.gte('created_at', cutoff);
        return query as any;
      }, 1000, 25);
    },
    staleTime: 30_000,
  });

  // Single paginated shop-name + category lookup for the whole period
  const { data: shopLookup = new Map<string, ShopLookupEntry>(), isLoading: shopsLoading } = useQuery({
    queryKey: ['admin-engagement-shops'],
    queryFn: async () => {
      const data = await fetchAllPaged<any>((from, to) =>
        supabase
          .from('shops')
          .select('id, name, area, city_id, shop_categories(categories(id, name, icon))')
          .order('id', { ascending: true })
          .range(from, to)
      );
      const map = new Map<string, ShopLookupEntry>();
      data.forEach((s: any) => {
        const cats = (s.shop_categories || [])
          .map((sc: any) => sc.categories)
          .filter(Boolean) as { id: string; name: string; icon: string }[];
        map.set(s.id, { name: s.name, area: s.area, city_id: s.city_id, categories: cats });
      });
      return map;
    },
    staleTime: 60_000,
  });

  // Fetch Education engagement + school directory lookup (gracefully skipped if unmigrated)
  const { data: schoolData } = useQuery({
    queryKey: ['admin-school-engagement', dateRange],
    queryFn: async () => {
      try {
        const events = await fetchAllPaged<{ school_id: string; event_type: string; created_at: string }>((from, to) => {
          let query = (supabase.from('school_engagement' as any) as any)
            .select('school_id, event_type, created_at')
            .order('created_at', { ascending: false })
            .range(from, to);
          if (cutoff) query = query.gte('created_at', cutoff);
          return query;
        }, 1000, 25);

        const schools = await fetchAllPaged<any>((from, to) =>
          (supabase.from('schools' as any) as any)
            .select('id, name, area, city_id, school_type, description')
            .order('id', { ascending: true })
            .range(from, to)
        );

        const schoolMap = new Map<string, SchoolLookupEntry>();
        schools.forEach((s: any) => {
          const resolvedType = resolveSchoolType({ school_type: s.school_type, description: s.description });
          schoolMap.set(s.id, {
            name: s.name,
            area: s.area ?? null,
            city_id: s.city_id ?? null,
            schoolTypeLabel: SCHOOL_TYPE_CONFIG[resolvedType]?.labelEn || s.school_type || 'Institute',
          });
        });

        return { events, schoolMap, available: true };
      } catch (err) {
        if (isMissingRelationErr(err)) {
          return {
            events: [] as { school_id: string; event_type: string; created_at: string }[],
            schoolMap: new Map<string, SchoolLookupEntry>(),
            available: false,
          };
        }
        throw err;
      }
    },
    staleTime: 30_000,
  });

  const isLoading = rowsLoading || shopsLoading;
  const includeLegacyNullCity = selectedCity?.slug === 'muktainagar';

  const matchesTownFilter = useCallback(
    (cityId: string | null | undefined) => {
      if (selectedCityId === 'all') return true;
      if (cityId === selectedCityId) return true;
      return includeLegacyNullCity && !cityId;
    },
    [selectedCityId, includeLegacyNullCity],
  );

  const filteredRows = useMemo(() => {
    if (selectedCityId === 'all') return rows;
    return rows.filter((r) => {
      const shop = shopLookup.get(r.shop_id);
      if (!shop) return false;
      return matchesTownFilter(shop.city_id);
    });
  }, [rows, selectedCityId, matchesTownFilter, shopLookup]);

  const aggregated = useMemo(() => {
    const map = new Map<string, { name: string; area: string | null; town: string; call: number; whatsapp: number; total: number }>();
    filteredRows.forEach((r) => {
      const shop = shopLookup.get(r.shop_id);
      if (!map.has(r.shop_id)) {
        const town = shop?.city_id ? (cityNameById.get(shop.city_id) ?? '') : 'Muktainagar';
        map.set(r.shop_id, { name: shop?.name ?? r.shop_id, area: shop?.area ?? null, town, call: 0, whatsapp: 0, total: 0 });
      }
      const e = map.get(r.shop_id)!;
      if (r.event_type === 'call') e.call += 1;
      if (r.event_type === 'whatsapp') e.whatsapp += 1;
      e.total += 1;
    });
    return Array.from(map.values());
  }, [filteredRows, shopLookup, cityNameById]);

  const sortedShops = useMemo(() =>
    [...aggregated].sort((a, b) => b[shopSort] - a[shopSort]),
    [aggregated, shopSort],
  );

  const aggregatedCategories = useMemo(() => {
    const map = new Map<string, { id: string; name: string; icon: string; total: number; call: number; whatsapp: number }>();
    filteredRows.forEach((r) => {
      const cats = shopLookup.get(r.shop_id)?.categories ?? [];
      cats.forEach((cat) => {
        if (!map.has(cat.id)) map.set(cat.id, { id: cat.id, name: cat.name, icon: cat.icon, total: 0, call: 0, whatsapp: 0 });
        const e = map.get(cat.id)!;
        e.total += 1;
        if (r.event_type === 'call') e.call += 1;
        if (r.event_type === 'whatsapp') e.whatsapp += 1;
      });
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filteredRows, shopLookup]);

  const { totalCalls, totalWhatsApp } = useMemo(() => {
    let call = 0, wa = 0;
    for (const r of filteredRows) {
      if (r.event_type === 'call') call++;
      else if (r.event_type === 'whatsapp') wa++;
    }
    return { totalCalls: call, totalWhatsApp: wa };
  }, [filteredRows]);

  const filteredSchoolRows = useMemo(() => {
    if (!schoolData?.events?.length) return [];
    if (selectedCityId === 'all') return schoolData.events;
    return schoolData.events.filter((r) => {
      const s = schoolData.schoolMap.get(r.school_id);
      if (!s) return false;
      return matchesTownFilter(s.city_id);
    });
  }, [schoolData, selectedCityId, matchesTownFilter]);

  const aggregatedSchools = useMemo(() => {
    const schoolMap = schoolData?.schoolMap ?? new Map<string, SchoolLookupEntry>();
    const map = new Map<string, {
      id: string;
      name: string;
      area: string | null;
      town: string;
      schoolType: string;
      call: number;
      whatsapp: number;
      website: number;
      maps: number;
      prospectus: number;
      total: number;
    }>();
    filteredSchoolRows.forEach((r) => {
      const s = schoolMap.get(r.school_id);
      if (!map.has(r.school_id)) {
        const town = s?.city_id ? (cityNameById.get(s.city_id) ?? '') : 'Muktainagar';
        map.set(r.school_id, {
          id: r.school_id,
          name: s?.name ?? r.school_id,
          area: s?.area ?? null,
          town,
          schoolType: s?.schoolTypeLabel ?? 'Institute',
          call: 0,
          whatsapp: 0,
          website: 0,
          maps: 0,
          prospectus: 0,
          total: 0,
        });
      }
      const entry = map.get(r.school_id)!;
      if (r.event_type === 'call') entry.call += 1;
      else if (r.event_type === 'whatsapp') entry.whatsapp += 1;
      else if (r.event_type === 'website') entry.website += 1;
      else if (r.event_type === 'maps') entry.maps += 1;
      else if (r.event_type === 'prospectus') entry.prospectus += 1;
      entry.total += 1;
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filteredSchoolRows, schoolData, cityNameById]);

  const exportTopShops = () => {
    const headers = ['Shop Name', 'Area', 'Town', 'Calls', 'WhatsApp', 'Total', 'Date Range'];
    const csvRows = sortedShops.map((r) => [r.name, r.area ?? '', r.town, r.call, r.whatsapp, r.total, dateRange]);
    downloadCsv(townCsvFilename(citySlugForFile, 'shop-analytics'), headers, csvRows);
  };

  const exportTopCategories = () => {
    const headers = ['Category', 'Calls', 'WhatsApp', 'Total', 'Date Range'];
    const csvRows = aggregatedCategories.map((c) => [c.name, c.call, c.whatsapp, c.total, dateRange]);
    downloadCsv(townCsvFilename(citySlugForFile, 'category-analytics'), headers, csvRows);
  };

  const exportSchoolEngagement = () => {
    const headers = ['Institute Name', 'Type', 'Area', 'Town', 'Calls', 'WhatsApp', 'Website', 'Maps', 'Prospectus', 'Total', 'Date Range'];
    const csvRows = aggregatedSchools.map((s) => [
      s.name, s.schoolType, s.area ?? '', s.town, s.call, s.whatsapp, s.website, s.maps, s.prospectus, s.total, dateRange,
    ]);
    downloadCsv(townCsvFilename(citySlugForFile, 'school-analytics'), headers, csvRows);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-foreground">Engagement Analytics</h2>
        <div className="flex flex-wrap items-center gap-2">
          {/* Town scope filter */}
          <select
            value={selectedCityId}
            onChange={(e) => setSelectedCityId(e.target.value)}
            className="bg-card border border-border rounded-lg text-xs font-semibold px-2.5 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">🌐 All Towns</option>
            {allCities.map((c) => (
              <option key={c.id} value={c.id}>
                📍 {c.name} {c.name_mr ? `(${c.name_mr})` : ''}
              </option>
            ))}
          </select>

          <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 bg-card border border-border rounded-lg p-1 max-w-full">
            {DATE_RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setDateRange(opt.value)}
                className={`px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  dateRange === opt.value ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {sortedShops.length > 0 && (
            <button
              onClick={exportTopShops}
              className="flex items-center gap-2 bg-card border border-border text-foreground px-3.5 py-1.5 rounded-lg font-semibold text-xs hover:bg-muted transition-colors shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>
          )}

          <button
            onClick={() => setShowAnalyticsImport(true)}
            className="flex items-center gap-2 bg-card border border-border text-foreground px-3.5 py-1.5 rounded-lg font-semibold text-xs hover:bg-muted transition-colors shrink-0"
          >
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Import CSV</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="bg-card rounded-xl border border-border px-2 sm:px-3 py-3 text-center">
          <TrendingUp className="w-5 h-5 mx-auto mb-1 text-primary" />
          <div className="text-lg sm:text-xl font-bold text-foreground">{filteredRows.length}</div>
          <div className="text-[11px] sm:text-xs text-muted-foreground">Total Taps</div>
        </div>
        <div className="bg-card rounded-xl border border-border px-2 sm:px-3 py-3 text-center">
          <Phone className="w-5 h-5 mx-auto mb-1 text-primary" />
          <div className="text-lg sm:text-xl font-bold text-foreground">{totalCalls}</div>
          <div className="text-[11px] sm:text-xs text-muted-foreground">Calls</div>
        </div>
        <div className="bg-card rounded-xl border border-border px-2 sm:px-3 py-3 text-center">
          <MessageCircle className="w-5 h-5 mx-auto mb-1" style={{ color: '#25D366' }} />
          <div className="text-lg sm:text-xl font-bold text-foreground">{totalWhatsApp}</div>
          <div className="text-[11px] sm:text-xs text-muted-foreground">WhatsApp</div>
        </div>
      </div>

      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <h3 className="font-bold text-foreground">Top Shops</h3>
          <div className="flex flex-wrap items-center gap-1 bg-card border border-border rounded-lg p-1 self-start sm:self-auto max-w-full">
            {([
              { value: 'total', label: 'Total' },
              { value: 'call', label: '📞 Calls' },
              { value: 'whatsapp', label: '💬 WhatsApp' },
            ] as { value: ShopSort; label: string }[]).map((opt) => (
              <button
                key={opt.value}
                onClick={() => setShopSort(opt.value)}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                  shopSort === opt.value ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="bg-card rounded-xl p-4 border border-border skeleton-shimmer h-14" />)}</div>
        ) : sortedShops.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-8 text-center text-muted-foreground">
            <p className="text-2xl mb-2">📊</p>
            <p className="font-semibold text-sm">No engagement data for this period</p>
            <p className="text-xs mt-1">Call and WhatsApp taps will appear here once users engage.</p>
          </div>
        ) : (
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/60 border-b border-border">
                    <th className="text-left px-4 py-3 font-semibold text-foreground w-8">#</th>
                    <th className="text-left px-4 py-3 font-semibold text-foreground">Shop</th>
                    <th className="text-right px-4 py-3 font-semibold text-foreground hidden sm:table-cell">
                      <span className="flex items-center justify-end gap-1"><Phone className="w-3.5 h-3.5" /> Calls</span>
                    </th>
                    <th className="text-right px-4 py-3 font-semibold text-foreground hidden sm:table-cell">
                      <span className="flex items-center justify-end gap-1"><MessageCircle className="w-3.5 h-3.5" /> WA</span>
                    </th>
                    <th className="text-right px-4 py-3 font-semibold text-foreground">
                      {shopSort === 'total' ? 'Total' : shopSort === 'call' ? 'Calls' : 'WA'}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedShops.map((row, idx) => (
                    <tr key={idx} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-muted-foreground font-medium">{idx + 1}</td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-foreground">{row.name}</div>
                        {(row.area || row.town) && (
                          <div className="text-xs text-muted-foreground">
                            {[row.area, row.town].filter(Boolean).join(' · ')}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right hidden sm:table-cell">
                        {row.call > 0 ? <span className="font-semibold text-foreground">{row.call}</span> : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right hidden sm:table-cell">
                        {row.whatsapp > 0 ? <span className="font-semibold text-foreground">{row.whatsapp}</span> : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-bold ${shopSort === 'total' || shopSort === 'call' ? 'text-primary' : ''}`}
                          style={shopSort === 'whatsapp' ? { color: '#25D366' } : undefined}>
                          {row[shopSort]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <h3 className="font-bold text-foreground">Top Categories by Engagement</h3>
          {aggregatedCategories.length > 0 && (
            <button
              onClick={exportTopCategories}
              className="flex items-center gap-1.5 bg-card border border-border text-foreground px-3 py-1.5 rounded-lg font-semibold text-xs hover:bg-muted transition-colors shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Categories</span>
            </button>
          )}
        </div>
        {isLoading ? (
          <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="bg-card rounded-xl p-4 border border-border skeleton-shimmer h-14" />)}</div>
        ) : aggregatedCategories.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-8 text-center text-muted-foreground">
            <p className="text-2xl mb-2">🏷️</p>
            <p className="font-semibold text-sm">No category engagement for this period</p>
          </div>
        ) : (
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/60 border-b border-border">
                    <th className="text-left px-4 py-3 font-semibold text-foreground w-8">#</th>
                    <th className="text-left px-4 py-3 font-semibold text-foreground">Category</th>
                    <th className="text-right px-4 py-3 font-semibold text-foreground hidden sm:table-cell">
                      <span className="flex items-center justify-end gap-1"><Phone className="w-3.5 h-3.5" /> Calls</span>
                    </th>
                    <th className="text-right px-4 py-3 font-semibold text-foreground hidden sm:table-cell">
                      <span className="flex items-center justify-end gap-1"><MessageCircle className="w-3.5 h-3.5" /> WA</span>
                    </th>
                    <th className="text-right px-4 py-3 font-semibold text-foreground">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {aggregatedCategories.map((cat, idx) => (
                    <tr key={cat.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-muted-foreground font-medium">{idx + 1}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-lg leading-none">{cat.icon}</span>
                          <span className="font-semibold text-foreground">{cat.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right hidden sm:table-cell">
                        {cat.call > 0 ? <span className="font-semibold text-foreground">{cat.call}</span> : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right hidden sm:table-cell">
                        {cat.whatsapp > 0 ? <span className="font-semibold text-foreground">{cat.whatsapp}</span> : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-bold text-primary">{cat.total}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Education Institute Engagement */}
      {schoolData?.available && (
        <div>
          <div className="flex items-center justify-between gap-2 mb-3">
            <h3 className="font-bold text-foreground flex items-center gap-1.5">
              <GraduationCap className="w-4 h-4 text-primary" />
              Top Educational Institutes ({aggregatedSchools.length})
            </h3>
            {aggregatedSchools.length > 0 && (
              <button
                onClick={exportSchoolEngagement}
                className="flex items-center gap-1.5 bg-card border border-border text-foreground px-3 py-1.5 rounded-lg font-semibold text-xs hover:bg-muted transition-colors shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Institutes</span>
              </button>
            )}
          </div>
          {aggregatedSchools.length === 0 ? (
            <div className="bg-card rounded-xl border border-border p-8 text-center text-muted-foreground">
              <p className="text-2xl mb-2">🎓</p>
              <p className="font-semibold text-sm">No institute engagement for this period</p>
            </div>
          ) : (
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/60 border-b border-border">
                      <th className="text-left px-4 py-3 font-semibold text-foreground w-8">#</th>
                      <th className="text-left px-4 py-3 font-semibold text-foreground">Institute</th>
                      <th className="text-right px-4 py-3 font-semibold text-foreground hidden sm:table-cell"><Phone className="w-3.5 h-3.5 inline mr-1" />Calls</th>
                      <th className="text-right px-4 py-3 font-semibold text-foreground hidden sm:table-cell"><MessageCircle className="w-3.5 h-3.5 inline mr-1" />WA</th>
                      <th className="text-right px-4 py-3 font-semibold text-foreground hidden md:table-cell"><ExternalLink className="w-3.5 h-3.5 inline mr-1" />Web</th>
                      <th className="text-right px-4 py-3 font-semibold text-foreground hidden md:table-cell"><MapPin className="w-3.5 h-3.5 inline mr-1" />Maps</th>
                      <th className="text-right px-4 py-3 font-semibold text-foreground hidden md:table-cell"><FileText className="w-3.5 h-3.5 inline mr-1" />PDF</th>
                      <th className="text-right px-4 py-3 font-semibold text-foreground">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aggregatedSchools.map((s, idx) => (
                      <tr key={s.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 text-muted-foreground font-medium">{idx + 1}</td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-foreground">{s.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {[s.schoolType, s.area, s.town].filter(Boolean).join(' · ')}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right hidden sm:table-cell">{s.call || '—'}</td>
                        <td className="px-4 py-3 text-right hidden sm:table-cell">{s.whatsapp || '—'}</td>
                        <td className="px-4 py-3 text-right hidden md:table-cell">{s.website || '—'}</td>
                        <td className="px-4 py-3 text-right hidden md:table-cell">{s.maps || '—'}</td>
                        <td className="px-4 py-3 text-right hidden md:table-cell">{s.prospectus || '—'}</td>
                        <td className="px-4 py-3 text-right font-bold text-primary">{s.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {showAnalyticsImport && (
        <AnalyticsCsvImportModal
          onClose={() => setShowAnalyticsImport(false)}
          onDone={() => {
            setShowAnalyticsImport(false);
            qc.invalidateQueries({ queryKey: ['admin-engagement'] });
            qc.invalidateQueries({ queryKey: ['admin-school-engagement'] });
          }}
        />
      )}
    </div>
  );
}
