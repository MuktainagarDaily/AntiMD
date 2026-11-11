import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Bus, Plus, Pencil, Trash2, Eye, EyeOff, MapPin, Phone, AlertCircle, Search, X, ChevronDown, Upload, Download, Sparkles, CalendarCheck } from 'lucide-react';
import { z } from 'zod';
import { ConfirmTapButton } from './_shared/ConfirmTapButton';
import { EmptyState } from './_shared/EmptyState';
import { MarathiMirrorField } from '@/components/shared/MarathiMirrorField';
import { useToast } from '@/hooks/use-toast';
import { useCity } from '@/hooks/useCity';
import type { GeoCity } from '@/lib/geo/types';
import { downloadCsv, townCsvFilename } from '@/lib/csvUtils';
import { BusBulkImportModal } from './BusBulkImportModal';
import {
  type BusDirection,
  type BusType,
  type BusRouteMeta,
  BUS_TYPE_CONFIG,
  parseBusNotes,
  serializeBusNotes,
  PARANDWADI_DEPOT_SEEDS,
} from '@/lib/bus/busHelpers';

// Bus stand info validation schema — phone is digits/+/spaces/dashes/parens,
// 7–20 chars after stripping; address is non-trivial free text; maps_url
// must be a Google Maps host when provided so we never tel:/javascript: it.
export const PHONE_RE = /^[\d+()\-\s]{7,20}$/;
export const standInfoSchema = z.object({
  phone: z
    .string()
    .trim()
    .max(20, 'Phone must be 20 characters or fewer')
    .refine((v) => v === '' || PHONE_RE.test(v), {
      message: 'Use digits, +, -, spaces, or parentheses only (7–20 chars)',
    })
    .refine((v) => v === '' || v.replace(/\D/g, '').length >= 7, {
      message: 'Phone must have at least 7 digits',
    }),
  address: z
    .string()
    .trim()
    .max(300, 'Address must be 300 characters or fewer')
    .refine((v) => v === '' || v.length >= 6, {
      message: 'Address must be at least 6 characters',
    }),
  maps_url: z
    .string()
    .trim()
    .max(2000, 'Maps URL is too long')
    .refine((v) => {
      if (!v) return true;
      try {
        const u = new URL(v);
        if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
        const host = u.hostname.toLowerCase();
        return (
          host === 'maps.google.com' ||
          host === 'www.google.com' ||
          host === 'google.com' ||
          host === 'maps.app.goo.gl' ||
          host === 'goo.gl' ||
          host.endsWith('.google.com')
        );
      } catch {
        return false;
      }
    }, { message: 'Must be a valid Google Maps URL (google.com or maps.app.goo.gl)' }),
});
type StandInfoErrors = Partial<Record<'phone' | 'address' | 'maps_url', string>>;


export interface Row {
  id: string;
  destination: string;
  destination_mr: string | null;
  departure_times: string[];
  notes: string | null;
  sort_order: number;
  is_active: boolean;
  city_id?: string | null;
}

export function filterBusRows(
  rows: Row[],
  search: string,
  status: 'all' | 'active' | 'hidden',
  directionFilter: 'all' | 'outgoing' | 'incoming' = 'all'
): Row[] {
  const query = search.trim().toLowerCase();
  return rows.filter((row) => {
    if (status === 'active' && !row.is_active) return false;
    if (status === 'hidden' && row.is_active) return false;
    const meta = parseBusNotes(row.notes);
    if (directionFilter !== 'all' && meta.direction !== directionFilter) return false;
    if (!query) return true;
    const dest = (row.destination || '').toLowerCase();
    const destMr = (row.destination_mr || '').toLowerCase();
    const notes = (row.notes || '').toLowerCase();
    return dest.includes(query) || destMr.includes(query) || notes.includes(query);
  });
}

const TIME_RE = /^([01]?\d|2[0-3]):[0-5]\d$/;

export function parseTimes(raw: string): { ok: string[]; bad: string[] } {
  const tokens = raw
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      // Accept "9:00" -> "09:00"
      const m = s.match(/^(\d{1,2}):(\d{2})$/);
      if (!m) return s;
      return `${m[1].padStart(2, '0')}:${m[2]}`;
    });
  const ok: string[] = [];
  const bad: string[] = [];
  for (const tk of tokens) (TIME_RE.test(tk) ? ok : bad).push(tk);
  // de-dup + sort
  const dedup = Array.from(new Set(ok)).sort();
  return { ok: dedup, bad };
}

export function BusTimetableTab() {
  const { currentCity, allCities, townName, districtName, stateName } = useCity();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState<Row | null>(null);
  const [creating, setCreating] = useState(false);
  const [selectedCityId, setSelectedCityId] = useState<string>(currentCity.id);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'hidden'>('all');
  const [directionFilter, setDirectionFilter] = useState<'all' | 'outgoing' | 'incoming'>('all');
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [seeding, setSeeding] = useState(false);

  // Keep selected city in sync if global currentCity changes
  useEffect(() => {
    setSelectedCityId(currentCity.id);
  }, [currentCity.id]);

  const selectedCity = useMemo(
    () => allCities.find((c) => c.id === selectedCityId) || currentCity,
    [allCities, selectedCityId, currentCity]
  );

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['admin-bus-timetable', selectedCity.id],
    queryFn: async () => {
      let q = supabase
        .from('bus_timetable')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('destination', { ascending: true });
      if (selectedCity.slug === 'muktainagar') {
        q = q.or(`city_id.eq.${selectedCity.id},city_id.is.null`);
      } else {
        q = q.eq('city_id', selectedCity.id);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as Row[];
    },
  });

  const isMavalOrParandwadi =
    selectedCity.slug === 'maval' || selectedCity.slug === 'parandwadi';
  const canSeedParandwadi = isMavalOrParandwadi && rows.length === 0;

  const handleSeedOfficialRoutes = async () => {
    setSeeding(true);
    try {
      const payload = PARANDWADI_DEPOT_SEEDS.map((r, i) => ({
        city_id: selectedCity.id,
        destination: r.destination,
        destination_mr: r.destination_mr || null,
        departure_times: r.departure_times,
        notes: r.notes || null,
        sort_order: i + 1,
        is_active: true,
      }));
      const { error } = await supabase.from('bus_timetable').insert(payload);
      if (error) throw error;
      toast({
        title: 'Routes seeded successfully!',
        description: `Added ${payload.length} official bus routes for ${selectedCity.name}`,
      });
      qc.invalidateQueries({ queryKey: ['admin-bus-timetable'] });
      qc.invalidateQueries({ queryKey: ['bus_timetable_public'] });
    } catch (err: any) {
      toast({
        title: 'Seed failed',
        description: err?.message || 'Failed to seed routes',
        variant: 'destructive',
      });
    } finally {
      setSeeding(false);
    }
  };

  const total = rows.length;
  const activeCount = useMemo(() => rows.filter((r) => r.is_active).length, [rows]);
  const hiddenCount = total - activeCount;

  const outgoingCount = useMemo(
    () => rows.filter((r) => parseBusNotes(r.notes).direction === 'outgoing').length,
    [rows]
  );
  const incomingCount = total - outgoingCount;

  const filteredRows = useMemo(
    () => filterBusRows(rows, searchQuery, statusFilter, directionFilter),
    [rows, searchQuery, statusFilter, directionFilter]
  );

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('bus_timetable').delete().eq('id', id);
    if (error) { toast({ title: 'Delete failed', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Row deleted' });
    qc.invalidateQueries({ queryKey: ['admin-bus-timetable'] });
    qc.invalidateQueries({ queryKey: ['bus_timetable_public'] });
  };

  const handleToggleActive = async (row: Row) => {
    const { error } = await supabase
      .from('bus_timetable')
      .update({ is_active: !row.is_active })
      .eq('id', row.id);
    if (error) { toast({ title: 'Update failed', description: error.message, variant: 'destructive' }); return; }
    qc.invalidateQueries({ queryKey: ['admin-bus-timetable'] });
    qc.invalidateQueries({ queryKey: ['bus_timetable_public'] });
  };

  const handleExportCsv = () => {
    if (filteredRows.length === 0) {
      toast({ title: 'No bus routes to export' });
      return;
    }
    const headers = ['Destination', 'Marathi Name', 'Departure Times', 'Notes', 'Active'];
    const csvRows = filteredRows.map((r) => [
      r.destination ?? '',
      r.destination_mr ?? '',
      (r.departure_times ?? []).join(' '),
      r.notes ?? '',
      r.is_active ? 'true' : 'false',
    ]);
    downloadCsv(townCsvFilename(selectedCity.slug, 'bus-timetable'), headers, csvRows);
    toast({ title: 'Exported CSV', description: `${filteredRows.length} bus route(s) downloaded.` });
  };

  return (
    <div className="space-y-4">
      {/* Header with City Dropdown Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <Bus className="w-4 h-4 text-primary" /> Bus Timetable
            </h2>
            <div className="relative inline-block max-w-full">
              <select
                value={selectedCityId}
                onChange={(e) => setSelectedCityId(e.target.value)}
                className="appearance-none max-w-full text-xs pl-2.5 pr-7 py-1 rounded-full font-semibold bg-primary/10 text-primary border border-primary/20 focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer hover:bg-primary/15 transition-colors"
                aria-label="Filter routes by town"
              >
                {allCities.map((c) => (
                  <option key={c.id} value={c.id}>
                    📍 {c.name} {c.name_mr ? `(${c.name_mr})` : ''}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-primary/70" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {total} destinations · {activeCount} active for {selectedCity.name}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
          {canSeedParandwadi && (
            <button
              type="button"
              onClick={handleSeedOfficialRoutes}
              disabled={seeding}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold active:scale-95 transition shadow-xs disabled:opacity-60"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {seeding ? 'Seeding…' : 'Seed Official Routes'}
            </button>
          )}
          <button
            type="button"
            onClick={() => setBulkImportOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-card hover:bg-muted text-foreground text-xs sm:text-sm font-semibold active:scale-95 transition shadow-xs"
          >
            <Upload className="w-3.5 h-3.5 text-primary" />
            Bulk Import
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-card hover:bg-muted text-foreground text-xs sm:text-sm font-semibold active:scale-95 transition shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-primary" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs sm:text-sm font-semibold hover:bg-primary/90 active:scale-95 transition shrink-0 shadow-xs"
          >
            <Plus className="w-4 h-4" /> Add destination
          </button>
        </div>
      </div>

      <StandInfoEditor activeCity={selectedCity} />

      {/* In-Tab Search and Status Filter */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-card p-2.5 rounded-xl border border-border">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${selectedCity.name} routes (e.g. Pune, जळगाव, via)...`}
            className="w-full pl-9 pr-8 py-1.5 rounded-lg border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted text-muted-foreground"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Direction Filter */}
          <div className="flex flex-wrap items-center gap-0.5 bg-muted/60 p-1 rounded-lg max-w-full">
            <button
              type="button"
              onClick={() => setDirectionFilter('all')}
              className={`px-2 py-1 rounded-md text-xs font-semibold transition ${
                directionFilter === 'all'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              All Routes
            </button>
            <button
              type="button"
              onClick={() => setDirectionFilter('outgoing')}
              className={`px-2 py-1 rounded-md text-xs font-semibold transition ${
                directionFilter === 'outgoing'
                  ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300 shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              ↗️ Outgoing ({outgoingCount})
            </button>
            <button
              type="button"
              onClick={() => setDirectionFilter('incoming')}
              className={`px-2 py-1 rounded-md text-xs font-semibold transition ${
                directionFilter === 'incoming'
                  ? 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              ↙️ Incoming ({incomingCount})
            </button>
          </div>

          {/* Status Filter */}
          <div className="flex flex-wrap items-center gap-0.5 bg-muted/60 p-1 rounded-lg max-w-full">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-2 py-1 rounded-md text-xs font-semibold transition ${
                statusFilter === 'all'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              All ({total})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('active')}
              className={`px-2 py-1 rounded-md text-xs font-semibold transition ${
                statusFilter === 'active'
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Active ({activeCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('hidden')}
              className={`px-2 py-1 rounded-md text-xs font-semibold transition ${
                statusFilter === 'hidden'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Hidden ({hiddenCount})
            </button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-14 rounded-xl border border-border skeleton-shimmer" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Bus className="w-6 h-6" />}
          title={`No bus rows for ${selectedCity.name} yet`}
          hint={
            canSeedParandwadi
              ? "Official PMPML Route 342, 305 and regional schedules are available to seed with one tap."
              : "Add destinations and their departure times, or paste a list using Bulk Import."
          }
          cta={
            canSeedParandwadi
              ? { label: 'Seed Official Routes', onClick: handleSeedOfficialRoutes }
              : { label: 'Add destination', onClick: () => setCreating(true) }
          }
        />
      ) : filteredRows.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-sm font-semibold text-foreground">No matching routes found</p>
          <p className="text-xs text-muted-foreground mt-1">
            No destinations in {selectedCity.name} matched your filter criteria.
          </p>
          <button
            onClick={() => { setSearchQuery(''); setStatusFilter('all'); setDirectionFilter('all'); }}
            className="mt-3 text-xs font-semibold text-primary hover:underline"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <ul className="space-y-2">
          {filteredRows.map((row) => {
            const meta = parseBusNotes(row.notes);
            const typeCfg = BUS_TYPE_CONFIG[meta.bus_type] || BUS_TYPE_CONFIG.other;
            return (
              <li key={row.id} className={`rounded-xl border p-3 bg-card ${row.is_active ? 'border-border' : 'border-border opacity-60'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <h3 className="font-semibold text-sm text-foreground">{row.destination}</h3>
                      {row.destination_mr && (
                        <span className="text-[11px] text-muted-foreground" lang="mr">({row.destination_mr})</span>
                      )}
                      {meta.direction === 'incoming' ? (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/25">
                          ↙️ Incoming
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20">
                          ↗️ Outgoing
                        </span>
                      )}
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${typeCfg.badgeCls}`}>
                        {typeCfg.label}
                      </span>
                      {!row.is_active && (
                        <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-semibold">Hidden</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {(row.departure_times || []).slice(0, 12).map((t, i) => (
                        <span key={i} className="text-[10px] font-semibold tabular-nums bg-muted text-foreground px-1.5 py-0.5 rounded">{t}</span>
                      ))}
                      {row.departure_times.length > 12 && (
                        <span className="text-[10px] text-muted-foreground">+{row.departure_times.length - 12}</span>
                      )}
                    </div>
                    {(meta.via.length > 0 || meta.raw_notes) && (
                      <div className="flex items-center gap-1.5 flex-wrap mt-1.5 text-[11px] text-muted-foreground">
                        {meta.via.map((v, i) => (
                          <span key={i} className="px-1.5 py-0.5 rounded-md bg-muted/80 text-[10px] font-medium border border-border/50">via {v}</span>
                        ))}
                        {meta.raw_notes && <span className="italic">{meta.raw_notes}</span>}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleToggleActive(row)}
                      title={row.is_active ? 'Hide from public' : 'Show on public'}
                      className="p-2 rounded-md hover:bg-muted text-muted-foreground"
                    >
                      {row.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => setEditing(row)}
                      title="Edit"
                      className="p-2 rounded-md hover:bg-muted text-muted-foreground"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <ConfirmTapButton
                      onConfirm={() => handleDelete(row.id)}
                      title="Delete"
                      className="p-2 rounded-md hover:bg-destructive/10 text-destructive"
                      confirmClassName="p-2 rounded-md bg-destructive text-destructive-foreground text-[11px] font-bold"
                      confirmLabel="Tap again"
                    >
                      <Trash2 className="w-4 h-4" />
                    </ConfirmTapButton>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {(creating || editing) && (
        <BusRowModal
          row={editing}
          defaultCityId={selectedCity.id}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            qc.invalidateQueries({ queryKey: ['admin-bus-timetable'] });
            qc.invalidateQueries({ queryKey: ['bus_timetable_public'] });
          }}
        />
      )}

      <BusBulkImportModal
        open={bulkImportOpen}
        cityId={selectedCity.id}
        cityName={selectedCity.name}
        existingCount={rows.length}
        existingDestinations={rows.map((r) => r.destination)}
        onClose={() => setBulkImportOpen(false)}
        onImported={() => {
          qc.invalidateQueries({ queryKey: ['admin-bus-timetable'] });
          qc.invalidateQueries({ queryKey: ['bus_timetable_public'] });
        }}
      />
    </div>
  );
}

function BusRowModal({
  row,
  defaultCityId,
  onClose,
  onSaved,
}: {
  row: Row | null;
  defaultCityId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { currentCity, allCities } = useCity();
  const { toast } = useToast();
  const [cityId, setCityId] = useState(row?.city_id || defaultCityId || currentCity.id);
  const [destination, setDestination] = useState(row?.destination || '');
  const [destinationMr, setDestinationMr] = useState(row?.destination_mr || '');
  const [timesRaw, setTimesRaw] = useState((row?.departure_times || []).join(', '));
  const [sortOrder, setSortOrder] = useState<number>(row?.sort_order ?? 0);
  const [isActive, setIsActive] = useState(row?.is_active ?? true);
  const [saving, setSaving] = useState(false);

  // Commuter Route Metadata (Direction, Type, Via, Remarks)
  const initialMeta = useMemo(() => parseBusNotes(row?.notes), [row?.notes]);
  const [direction, setDirection] = useState<BusDirection>(initialMeta.direction);
  const [busType, setBusType] = useState<BusType>(initialMeta.bus_type);
  const [viaRaw, setViaRaw] = useState(initialMeta.via.join(', '));
  const [additionalNotes, setAdditionalNotes] = useState(initialMeta.raw_notes);

  const parsed = useMemo(() => parseTimes(timesRaw), [timesRaw]);

  const handleSave = async () => {
    if (!destination.trim()) {
      toast({ title: 'Destination required', variant: 'destructive' });
      return;
    }
    if (parsed.bad.length) {
      toast({ title: 'Invalid time(s)', description: `Use HH:MM. Bad: ${parsed.bad.join(', ')}`, variant: 'destructive' });
      return;
    }
    setSaving(true);
    const serializedNotes = serializeBusNotes({
      direction,
      bus_type: busType,
      via: viaRaw.split(/[,/]+/).map((s) => s.trim()).filter(Boolean),
      raw_notes: additionalNotes.trim(),
    });

    const payload: any = {
      destination: destination.trim(),
      destination_mr: destinationMr.trim() || null,
      departure_times: parsed.ok,
      notes: serializedNotes || null,
      sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
      is_active: isActive,
      city_id: cityId || currentCity.id,
    };
    const q = row
      ? supabase.from('bus_timetable').update(payload).eq('id', row.id)
      : supabase.from('bus_timetable').insert(payload);
    const { error } = await q;
    setSaving(false);
    if (error) { toast({ title: 'Save failed', description: error.message, variant: 'destructive' }); return; }
    toast({ title: row ? 'Updated' : 'Added' });
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-background w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90dvh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-background border-b border-border px-4 sm:px-5 py-3 flex items-center justify-between gap-2">
          <h3 className="font-bold text-base truncate">{row ? 'Edit destination' : 'New destination'}</h3>
          <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground shrink-0">Close</button>
        </div>
        <div className="px-4 sm:px-5 py-4 space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1.5">City / Taluka</label>
            <select
              value={cityId}
              onChange={(e) => setCityId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring font-medium"
            >
              {allCities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.name_mr ? `(${c.name_mr})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1.5">Destination</label>
            <input
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="e.g. Jalgaon"
              className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <MarathiMirrorField
            label="Destination (Marathi)"
            value={destinationMr}
            onChange={setDestinationMr}
            placeholder="जळगाव"
          />

          <div>
            <label className="block text-sm font-semibold mb-1.5">Departure times</label>
            <textarea
              value={timesRaw}
              onChange={(e) => setTimesRaw(e.target.value)}
              rows={3}
              placeholder="06:00, 07:15, 09:30 …"
              className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring font-mono"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              HH:MM (24-hour). Comma, space, or newline separated.
            </p>
            {parsed.ok.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {parsed.ok.map((t, i) => (
                  <span key={i} className="text-[10px] tabular-nums bg-muted text-foreground px-1.5 py-0.5 rounded">{t}</span>
                ))}
              </div>
            )}
            {parsed.bad.length > 0 && (
              <p className="text-[11px] text-destructive mt-1">Invalid: {parsed.bad.join(', ')}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold mb-1.5">Route Direction</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDirection('outgoing')}
                  className={`px-3 py-2 rounded-lg text-xs font-bold border transition ${
                    direction === 'outgoing'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-muted text-muted-foreground border-border hover:text-foreground'
                  }`}
                >
                  ↗️ Outgoing (सुटणारी)
                </button>
                <button
                  type="button"
                  onClick={() => setDirection('incoming')}
                  className={`px-3 py-2 rounded-lg text-xs font-bold border transition ${
                    direction === 'incoming'
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-muted text-muted-foreground border-border hover:text-foreground'
                  }`}
                >
                  ↙️ Incoming (येणारी)
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1.5">Bus Type / Operator</label>
              <select
                value={busType}
                onChange={(e) => setBusType(e.target.value as BusType)}
                className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="msrtc_ordinary">MSRTC Ordinary (लालपरी / साधी एसटी)</option>
                <option value="msrtc_express">MSRTC Express (शिवशाही / हिरकणी / विठाई)</option>
                <option value="pmpml">PMPML Local (पुणे / मावळ लोकल फिडर)</option>
                <option value="local_shuttle">Local Shuttle (स्थानिक वाहतूक / वडाप)</option>
                <option value="other">Other / इतर</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1.5">
              Via / Major Stops <span className="text-muted-foreground font-normal">(comma-separated)</span>
            </label>
            <input
              value={viaRaw}
              onChange={(e) => setViaRaw(e.target.value)}
              placeholder="e.g. Somatane Phata, Dehu Road, Bhusawal"
              className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1.5">
              Additional Notes <span className="text-muted-foreground font-normal">(optional remarks)</span>
            </label>
            <input
              value={additionalNotes}
              onChange={(e) => setAdditionalNotes(e.target.value)}
              placeholder="e.g. Stops at ZP School; connects with local train"
              className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold mb-1.5">Sort order</label>
              <input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(parseInt(e.target.value, 10) || 0)}
                className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1.5">Visible</label>
              <button
                type="button"
                onClick={() => setIsActive((v) => !v)}
                className={`w-full px-3 py-2.5 rounded-lg border text-sm font-semibold ${
                  isActive ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted text-muted-foreground border-border'
                }`}
              >
                {isActive ? 'Active' : 'Hidden'}
              </button>
            </div>
          </div>
        </div>
        <div className="sticky bottom-0 bg-background border-t border-border px-4 sm:px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bus stand info editor — phone, address, and Google Maps URL used by the
// public BusTimetable header (sticky Call + Open on Google Maps buttons).
// Single-row table (bus_stand_info, id=1) seeded via SQL patch.
// ---------------------------------------------------------------------------
function StandInfoEditor({ activeCity }: { activeCity?: GeoCity }) {
  const { currentCity, districtName, stateName } = useCity();
  const city = activeCity || currentCity;
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading, isFetching, error: loadError, refetch } = useQuery({
    queryKey: ['admin-bus-stand-info', city.id],
    queryFn: async () => {
      let q = supabase
        .from('bus_stand_info')
        .select('id, phone, address, maps_url, notes');
      if (city.slug === 'muktainagar') {
        q = q.or(`city_id.eq.${city.id},city_id.is.null`);
      } else {
        q = q.eq('city_id', city.id);
      }
      const { data, error } = await q.maybeSingle();
      if (error) throw error;
      return (data || { phone: '', address: '', maps_url: '', notes: null }) as {
        id?: number;
        phone: string | null;
        address: string | null;
        maps_url: string | null;
        notes: string | null;
      };
    },
  });

  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [mapsUrl, setMapsUrl] = useState('');
  const [enquiryPhone, setEnquiryPhone] = useState('');
  const [verifiedDate, setVerifiedDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [errors, setErrors] = useState<StandInfoErrors>({});

  useEffect(() => {
    setHydrated(false);
  }, [city.id]);

  if (data && !hydrated) {
    setPhone(data.phone || '');
    setAddress(data.address || '');
    setMapsUrl(data.maps_url || '');
    try {
      if (data.notes) {
        const extra = JSON.parse(data.notes);
        setEnquiryPhone(extra.enquiry_phone || '');
        setVerifiedDate(extra.verified_date || '');
      } else {
        setEnquiryPhone('');
        setVerifiedDate('');
      }
    } catch {
      setEnquiryPhone('');
      setVerifiedDate(data.notes || '');
    }
    setHydrated(true);
  }

  const handleSave = async () => {
    const parsed = standInfoSchema.safeParse({
      phone: phone.trim(),
      address: address.trim(),
      maps_url: mapsUrl.trim(),
    });
    if (!parsed.success) {
      const next: StandInfoErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof StandInfoErrors | undefined;
        if (key && !next[key]) next[key] = issue.message;
      }
      setErrors(next);
      toast({
        title: 'Please fix the highlighted fields',
        description: Object.values(next).join(' · '),
        variant: 'destructive',
      });
      return;
    }
    setErrors({});
    setSaving(true);

    const extra: any = {};
    if (enquiryPhone.trim()) extra.enquiry_phone = enquiryPhone.trim();
    if (verifiedDate.trim()) extra.verified_date = verifiedDate.trim();

    const payload: any = {
      phone: parsed.data.phone || null,
      address: parsed.data.address || null,
      maps_url: parsed.data.maps_url || null,
      notes: Object.keys(extra).length > 0 ? JSON.stringify(extra) : null,
      city_id: city.id,
    };

    let error;
    if (data?.id) {
      const res = await supabase.from('bus_stand_info').update(payload).eq('id', data.id);
      error = res.error;
    } else if (city.slug === 'muktainagar') {
      const res = await supabase.from('bus_stand_info').upsert({ id: 1, ...payload });
      error = res.error;
    } else {
      const res = await supabase.from('bus_stand_info').insert(payload);
      error = res.error;
    }

    setSaving(false);
    if (error) { toast({ title: 'Save failed', description: error.message, variant: 'destructive' }); return; }
    toast({ title: `Bus stand info for ${city.name} updated` });
    qc.invalidateQueries({ queryKey: ['admin-bus-stand-info'] });
    qc.invalidateQueries({ queryKey: ['bus_stand_info'] });
  };

  const fieldClass = (k: keyof StandInfoErrors) =>
    `w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring ${
      errors[k] ? 'border-destructive' : 'border-input'
    }`;

  return (
    <section className="rounded-xl border border-border bg-card p-3 space-y-3">
      <div>
        <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-primary" /> Bus stand contact &amp; location ({city.name})
        </h3>
        <p className="text-[11px] text-muted-foreground">
          Powers the sticky Call &amp; “Open on Google Maps” buttons on the public Bus Timetable page.
        </p>
      </div>
      {isLoading ? (
        <div className="h-20 rounded-lg skeleton-shimmer" />
      ) : loadError ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-3 text-xs text-destructive flex items-start justify-between gap-2">
          <span className="flex items-start gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            Failed to load stand info. {(loadError as Error).message}
          </span>
          <button
            onClick={() => refetch()}
            className="text-xs font-semibold underline shrink-0"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold mb-1 flex items-center gap-1">
              <Phone className="w-3 h-3 text-primary" /> Main Stand Helpline
            </label>
            <input
              value={phone}
              onChange={(e) => { setPhone(e.target.value); if (errors.phone) setErrors((p) => ({ ...p, phone: undefined })); }}
              placeholder="02583234225"
              maxLength={20}
              inputMode="tel"
              aria-invalid={!!errors.phone}
              className={fieldClass('phone')}
            />
            {errors.phone && <p className="text-[10px] text-destructive mt-1">{errors.phone}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1 flex items-center gap-1">
              <Phone className="w-3 h-3 text-muted-foreground" /> Depot Enquiry / Incharge Phone <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <input
              value={enquiryPhone}
              onChange={(e) => setEnquiryPhone(e.target.value)}
              placeholder="02583234226 or 02114222444"
              maxLength={20}
              inputMode="tel"
              className={fieldClass('phone')}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1 flex items-center gap-1">
              <CalendarCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> Last Verified with Depot <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <input
              value={verifiedDate}
              onChange={(e) => setVerifiedDate(e.target.value)}
              placeholder="e.g. Nov 2026 / दिवाळी २०२६"
              maxLength={50}
              className={fieldClass('address')}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1">Google Maps URL</label>
            <input
              value={mapsUrl}
              onChange={(e) => { setMapsUrl(e.target.value); if (errors.maps_url) setErrors((p) => ({ ...p, maps_url: undefined })); }}
              placeholder="https://maps.google.com/?q=…"
              maxLength={2000}
              inputMode="url"
              aria-invalid={!!errors.maps_url}
              className={fieldClass('maps_url')}
            />
            {errors.maps_url && <p className="text-[10px] text-destructive mt-1">{errors.maps_url}</p>}
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold mb-1">Address</label>
            <input
              value={address}
              onChange={(e) => { setAddress(e.target.value); if (errors.address) setErrors((p) => ({ ...p, address: undefined })); }}
              placeholder={`${city.name} Bus Stand, ${districtName || 'Jalgaon'}, ${stateName || 'Maharashtra'}`}
              maxLength={300}
              aria-invalid={!!errors.address}
              className={fieldClass('address')}
            />
            {errors.address ? (
              <p className="text-[10px] text-destructive mt-1">{errors.address}</p>
            ) : (
              <p className="text-[10px] text-muted-foreground mt-1">
                If no Maps URL is set, the public page builds one from this address.
              </p>
            )}
          </div>
        </div>
      )}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving || isLoading || isFetching || !!loadError}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save stand info'}
        </button>
      </div>
    </section>
  );
}

