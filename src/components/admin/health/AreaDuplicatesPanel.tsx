import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  Loader2,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  RefreshCw,
  TriangleAlert,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  buildCityAreaSummary,
  dqNormalizeAreaValue,
  findDuplicateShops,
  findSimilarAreaGroups,
  type AreaSummaryItem,
} from '@/lib/admin/dataQualityHelpers';

interface AreaDuplicatesPanelProps {
  shops: any[];
  cityFilter: string;
  defaultCityId?: string | null;
  cityNameMap: Map<string, string>;
  onEditShop: (shop: any) => void;
}

export function AreaDuplicatesPanel({
  shops,
  cityFilter,
  defaultCityId,
  cityNameMap,
  onEditShop,
}: AreaDuplicatesPanelProps) {
  const qc = useQueryClient();

  const areaSummary = useMemo(
    () =>
      buildCityAreaSummary(shops, {
        cityFilter,
        defaultCityId,
        cityNameMap,
      }),
    [shops, cityFilter, defaultCityId, cityNameMap],
  );

  const { groups: similarAreaGroups, bestCandidateByCompositeKey } = useMemo(
    () => findSimilarAreaGroups(areaSummary),
    [areaSummary],
  );

  const [areaRenameTargetKey, setAreaRenameTargetKey] = useState<string | null>(null);
  const [areaRenameValue, setAreaRenameValue] = useState('');
  const [areaRenaming, setAreaRenaming] = useState(false);

  const handleAreaRename = async (item: AreaSummaryItem) => {
    if (!areaRenameValue.trim()) return;
    const newArea = dqNormalizeAreaValue(areaRenameValue);
    if (newArea === item.area) {
      setAreaRenameTargetKey(null);
      setAreaRenameValue('');
      return;
    }

    setAreaRenaming(true);
    try {
      let query = supabase
        .from('shops')
        .update({ area: newArea })
        .eq('area', item.area);

      if (item.cityKey === '__unassigned__') {
        query = query.is('city_id', null);
      } else if (defaultCityId && item.cityKey === defaultCityId) {
        query = query.or(`city_id.eq.${item.cityKey},city_id.is.null`);
      } else {
        query = query.eq('city_id', item.cityKey);
      }

      const { error } = await query;
      if (error) throw error;

      toast.success(`Renamed "${item.area}" → "${newArea}" in ${item.cityName}`);
      setAreaRenameTargetKey(null);
      setAreaRenameValue('');
      qc.invalidateQueries({ queryKey: ['admin-shops-quality'] });
      qc.invalidateQueries({ queryKey: ['admin-shops'] });
      qc.invalidateQueries({ queryKey: ['shops'] });
      qc.invalidateQueries({ queryKey: ['shops-list'] });
      qc.invalidateQueries({ queryKey: ['admin-stats'] });
    } catch (err: any) {
      toast.error('Rename failed: ' + (err?.message || 'Unknown error'));
    } finally {
      setAreaRenaming(false);
    }
  };

  const [includeCrossTownPhones, setIncludeCrossTownPhones] = useState(false);

  const duplicateGroups = useMemo(
    () =>
      findDuplicateShops(shops, {
        cityFilter,
        defaultCityId,
        cityNameMap,
        includeCrossTownPhones,
      }),
    [shops, cityFilter, defaultCityId, cityNameMap, includeCrossTownPhones],
  );

  return (
    <div className="space-y-8">
      {/* 1. City-scoped Area Consistency */}
      <section>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <MapPin className="w-4 h-4 text-primary" />
          <h3 className="font-bold text-foreground">Area Consistency (City-Scoped)</h3>
          <span className="ml-auto text-xs text-muted-foreground">
            {areaSummary.length} area{areaSummary.length !== 1 ? 's' : ''}
          </span>
        </div>

        {areaSummary.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-6 text-center text-muted-foreground text-sm">
            No area data found for this town scope.
          </div>
        ) : (
          <div className="bg-card rounded-xl border border-border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/60 border-b border-border">
                  <th className="text-left px-4 py-3 font-semibold text-foreground">Area Name</th>
                  <th className="text-left px-4 py-3 font-semibold text-foreground hidden sm:table-cell">Town</th>
                  <th className="text-left px-4 py-3 font-semibold text-foreground w-20">Shops</th>
                  <th className="text-right px-4 py-3 font-semibold text-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {areaSummary.map((item) => {
                  const isEditing = areaRenameTargetKey === item.compositeKey;
                  const groupKey = `${item.cityKey}::${item.compareKey}`;
                  const similarGroup = similarAreaGroups.get(groupKey);
                  const similarPeers = similarGroup
                    ? similarGroup.filter((p) => p.area !== item.area).map((p) => p.area)
                    : [];
                  const hasSimilar = similarPeers.length > 0;
                  const bestCandidate = bestCandidateByCompositeKey.get(item.compositeKey) ?? null;
                  const isNotBest = hasSimilar && bestCandidate !== null;

                  return (
                    <tr
                      key={item.compositeKey}
                      className={`border-b border-border last:border-0 hover:bg-muted/30 transition-colors ${
                        hasSimilar ? 'bg-destructive/5' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-foreground">{item.area}</span>
                          {item.suspicious && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-secondary/15 text-secondary border border-secondary/30">
                              <TriangleAlert className="w-2.5 h-2.5" /> suspicious
                            </span>
                          )}
                        </div>
                        {hasSimilar && (
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/25">
                              <TriangleAlert className="w-2.5 h-2.5" />
                              similar in {item.cityName}:{' '}
                              {similarPeers.map((p) => (
                                <span key={p} title={p}>
                                  {`"${p.length > 45 ? p.slice(0, 43) + '…' : p}"`}
                                </span>
                              ))}
                            </span>
                          </div>
                        )}
                        {isEditing && (
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            <input
                              type="text"
                              value={areaRenameValue}
                              onChange={(e) => setAreaRenameValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') void handleAreaRename(item);
                                if (e.key === 'Escape') setAreaRenameTargetKey(null);
                              }}
                              placeholder="New area name…"
                              autoFocus
                              className="flex-1 min-w-[140px] h-8 rounded-md border border-input bg-background px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                            />
                            <button
                              onClick={() => void handleAreaRename(item)}
                              disabled={areaRenaming || !areaRenameValue.trim()}
                              className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50 hover:bg-primary/90"
                            >
                              {areaRenaming ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save'}
                            </button>
                            <button
                              onClick={() => {
                                setAreaRenameTargetKey(null);
                                setAreaRenameValue('');
                              }}
                              className="h-8 px-2 rounded-md border border-border text-xs hover:bg-muted"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span className="text-xs px-2 py-0.5 rounded-md bg-muted text-muted-foreground font-medium">
                          {item.cityName}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center justify-center min-w-[1.75rem] px-2 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary">
                          {item.count}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {!isEditing && (
                          <div className="flex items-center justify-end gap-1.5">
                            {isNotBest && (
                              <button
                                onClick={() => {
                                  setAreaRenameTargetKey(item.compositeKey);
                                  setAreaRenameValue(bestCandidate!);
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-destructive hover:bg-destructive/10 transition-colors border border-destructive/25"
                                title={`Merge into "${bestCandidate}" within ${item.cityName}`}
                              >
                                <ArrowRight className="w-3 h-3" /> Merge
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setAreaRenameTargetKey(item.compositeKey);
                                setAreaRenameValue(item.area);
                              }}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-primary hover:bg-primary/10 transition-colors border border-primary/20"
                            >
                              <Pencil className="w-3 h-3" /> Rename
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-2">
          Renames are strictly scoped to one town (<code className="bg-muted px-1 rounded">city_id</code>) so shared names like <em>College Road</em> in different towns never collide. Devanagari names are compared cleanly without stripping Marathi script.
        </p>
      </section>

      {/* 2. Possible Duplicates */}
      <section>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <Users className="w-4 h-4 text-primary" />
          <h3 className="font-bold text-foreground">Possible Duplicate Shops</h3>
          {duplicateGroups.length > 0 && (
            <span className="inline-flex items-center justify-center min-w-[1.5rem] h-5 px-1.5 rounded-full text-[11px] font-bold bg-secondary/15 text-secondary border border-secondary/30">
              {duplicateGroups.length}
            </span>
          )}
          <div className="ml-auto flex items-center gap-3">
            <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={includeCrossTownPhones}
                onChange={(e) => setIncludeCrossTownPhones(e.target.checked)}
                className="h-3.5 w-3.5 rounded accent-primary"
              />
              Check cross-town phones
            </label>
            <button
              onClick={() => qc.invalidateQueries({ queryKey: ['admin-shops-quality'] })}
              className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {duplicateGroups.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-6 text-center">
            <p className="text-2xl mb-2">✅</p>
            <p className="font-semibold text-sm text-foreground">No duplicates detected</p>
            <p className="text-xs text-muted-foreground mt-1">
              No shops share valid Phone/WhatsApp numbers or near-identical names in the same town &amp; locality.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {duplicateGroups.map((group) => (
              <div
                key={group.id}
                className={`bg-card rounded-xl border overflow-hidden ${
                  group.crossTown ? 'border-amber-500/40' : 'border-secondary/30'
                }`}
              >
                <div className="px-4 py-2 bg-secondary/8 border-b border-secondary/20 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <TriangleAlert className="w-3.5 h-3.5 text-secondary shrink-0" />
                    <span className="text-xs font-semibold text-secondary">
                      {group.shops.length} shops · {group.cityName}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    {group.reasons.map((r) => (
                      <span
                        key={r}
                        className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-background border border-border text-foreground"
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="divide-y divide-border">
                  {group.shops.map((shop: any) => {
                    const cats = (shop.shop_categories || [])
                      .map((sc: any) => sc.categories)
                      .filter(Boolean);
                    return (
                      <div
                        key={shop.id}
                        className="px-4 py-3 flex flex-wrap sm:flex-nowrap items-start justify-between gap-2.5 sm:gap-3"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm text-foreground truncate">{shop.name}</span>
                            {!shop.is_active && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                                Inactive
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 flex-wrap text-xs text-muted-foreground">
                            {shop.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {shop.phone}
                              </span>
                            )}
                            {shop.whatsapp && shop.whatsapp !== shop.phone && (
                              <span className="flex items-center gap-1">
                                <MessageCircle className="w-3 h-3" />
                                {shop.whatsapp}
                              </span>
                            )}
                            {shop.area && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {shop.area}
                              </span>
                            )}
                            {cats.length > 0 && (
                              <span>{cats.map((c: any) => `${c.icon} ${c.name}`).join(', ')}</span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => onEditShop(shop)}
                          className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-primary hover:bg-primary/10 border border-primary/20 transition-colors"
                        >
                          <Pencil className="w-3 h-3" /> Edit
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
