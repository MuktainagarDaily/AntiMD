import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  BadgeCheck,
  CheckCircle2,
  Download,
  GraduationCap,
  Loader2,
  MapPinOff,
  Pencil,
  PhoneOff,
  Search,
  ShieldAlert,
  Store,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { downloadCsv } from '@/lib/csvUtils';
import {
  buildListingHygieneReport,
  type HygieneFlag,
  type HygieneListingRow,
} from '@/lib/admin/dataQualityHelpers';

interface ListingHygienePanelProps {
  shops: any[];
  schools: any[];
  translatedShopIds: Set<string>;
  cityFilter: string;
  defaultCityId?: string | null;
  cityNameMap: Map<string, string>;
  onEditShop: (shop: any) => void;
  onEditSchool?: (school: any) => void;
}

const FLAG_META: {
  key: HygieneFlag;
  label: string;
  badgeCls: string;
}[] = [
  { key: 'missing_phone', label: 'Missing Phone', badgeCls: 'bg-destructive/10 text-destructive border-destructive/25' },
  { key: 'invalid_phone', label: 'Invalid Phone', badgeCls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30' },
  { key: 'unverified', label: 'Unverified', badgeCls: 'bg-secondary/15 text-secondary border-secondary/30' },
  { key: 'no_photo', label: 'No Photo', badgeCls: 'bg-muted text-muted-foreground border-border' },
  { key: 'broken_photo', label: 'Broken Photo', badgeCls: 'bg-destructive/15 text-destructive border-destructive/30' },
  { key: 'no_gps', label: 'No GPS', badgeCls: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/25' },
  { key: 'missing_marathi', label: 'Missing Marathi', badgeCls: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/25' },
];

const FLAG_LABEL_MAP = new Map<HygieneFlag, { label: string; badgeCls: string }>(
  FLAG_META.map((m) => [m.key, { label: m.label, badgeCls: m.badgeCls }]),
);

export function ListingHygienePanel({
  shops,
  schools,
  translatedShopIds,
  cityFilter,
  defaultCityId,
  cityNameMap,
  onEditShop,
  onEditSchool,
}: ListingHygienePanelProps) {
  const qc = useQueryClient();
  const [activeFlag, setActiveFlag] = useState<'all' | HygieneFlag>('all');
  const [entityFilter, setEntityFilter] = useState<'all' | 'shop' | 'school'>('all');
  const [search, setSearch] = useState('');
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  const report = useMemo(
    () =>
      buildListingHygieneReport({
        shops,
        schools,
        translatedShopIds,
        cityFilter,
        defaultCityId,
        cityNameMap,
      }),
    [shops, schools, translatedShopIds, cityFilter, defaultCityId, cityNameMap],
  );

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return report.items.filter((item) => {
      if (entityFilter !== 'all' && item.entityKind !== entityFilter) return false;
      if (activeFlag !== 'all' && !item.flags.includes(activeFlag)) return false;
      if (q) {
        const hay = `${item.name} ${item.area ?? ''} ${item.phone ?? ''} ${item.cityName}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [report.items, entityFilter, activeFlag, search]);

  const handleQuickVerify = async (row: HygieneListingRow) => {
    const key = `${row.entityKind}:${row.id}`;
    setVerifyingId(key);
    try {
      const table = row.entityKind === 'school' ? 'schools' : 'shops';
      const { error } = await (supabase as any)
        .from(table)
        .update({ is_verified: true })
        .eq('id', row.id);
      if (error) throw error;
      toast.success(`Marked "${row.name}" as Verified`);
      qc.invalidateQueries({ queryKey: ['admin-shops-quality'] });
      qc.invalidateQueries({ queryKey: ['admin-schools-quality'] });
      qc.invalidateQueries({ queryKey: ['admin-shops'] });
      qc.invalidateQueries({ queryKey: ['admin-schools'] });
      qc.invalidateQueries({ queryKey: ['admin-stats'] });
    } catch (err: any) {
      toast.error('Verify failed: ' + (err?.message || 'Unknown error'));
    } finally {
      setVerifyingId(null);
    }
  };

  const handleExportCsv = () => {
    const headers = ['Entity', 'Name', 'Town', 'Area', 'Phone', 'WhatsApp', 'Verified', 'Has GPS', 'Issues'];
    const data = filteredItems.map((item) => [
      item.entityKind === 'school' ? 'Institute' : 'Shop',
      item.name,
      item.cityName,
      item.area ?? '',
      item.phone ?? '',
      item.whatsapp ?? '',
      item.isVerified ? 'Yes' : 'No',
      item.hasGps ? 'Yes' : 'No',
      item.flags.map((f) => FLAG_LABEL_MAP.get(f)?.label || f).join(' | '),
    ]);
    downloadCsv('listing-hygiene-report', headers, data);
    toast.success(`Exported ${filteredItems.length} listing${filteredItems.length !== 1 ? 's' : ''} to CSV`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-bold text-foreground flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-primary" />
            Listing Hygiene &amp; Completeness Scanner
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Scanned {report.totalScanned} active/archived listings across Shops &amp; Institutes for missing contact info, verification, photos, GPS coordinates, and Marathi labels.
          </p>
        </div>

        <button
          onClick={handleExportCsv}
          disabled={filteredItems.length === 0}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-border bg-card hover:bg-muted transition-colors disabled:opacity-50"
        >
          <Download className="w-3.5 h-3.5" />
          Export CSV ({filteredItems.length})
        </button>
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          onClick={() => setActiveFlag('all')}
          className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${
            activeFlag === 'all'
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-card text-muted-foreground border-border hover:bg-muted'
          }`}
        >
          All Issues ({report.items.length})
        </button>
        {FLAG_META.map((m) => (
          <button
            key={m.key}
            onClick={() => setActiveFlag(m.key)}
            className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${
              activeFlag === m.key
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card text-muted-foreground border-border hover:bg-muted'
            }`}
          >
            {m.label} ({report.counts[m.key]})
          </button>
        ))}
      </div>

      {/* Search + entity selector */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by listing name, area, phone, or town…"
            className="w-full h-9 pl-8 pr-3 rounded-lg border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="inline-flex rounded-lg border border-border bg-card p-0.5 text-xs">
          {(
            [
              ['all', 'All'],
              ['shop', 'Shops'],
              ['school', 'Institutes'],
            ] as const
          ).map(([val, lbl]) => (
            <button
              key={val}
              onClick={() => setEntityFilter(val)}
              className={`px-3 py-1 rounded-md font-semibold transition-colors ${
                entityFilter === val ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {lbl}
            </button>
          ))}
        </div>
      </div>

      {/* Results list */}
      {filteredItems.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-8 text-center">
          <CheckCircle2 className="w-8 h-8 text-success mx-auto mb-2" />
          <p className="font-semibold text-sm text-foreground">No hygiene issues match this filter</p>
          <p className="text-xs text-muted-foreground mt-1">
            All scanned listings in the current scope meet these completeness checks.
          </p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border divide-y divide-border">
          {filteredItems.map((row) => {
            const verifyKey = `${row.entityKind}:${row.id}`;
            const busyVerify = verifyingId === verifyKey;
            return (
              <div
                key={verifyKey}
                className="p-3.5 flex flex-wrap sm:flex-nowrap items-start justify-between gap-3 hover:bg-muted/20 transition-colors"
              >
                <div className="min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                        row.entityKind === 'school'
                          ? 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30'
                          : 'bg-primary/10 text-primary border-primary/20'
                      }`}
                    >
                      {row.entityKind === 'school' ? (
                        <GraduationCap className="w-2.5 h-2.5" />
                      ) : (
                        <Store className="w-2.5 h-2.5" />
                      )}
                      {row.entityKind === 'school' ? 'Institute' : 'Shop'}
                    </span>
                    <span className="font-semibold text-sm text-foreground">{row.name}</span>
                    {!row.isActive && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                        Hidden
                      </span>
                    )}
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      {row.cityName}
                    </span>
                  </div>

                  <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-3">
                    <span>Area: {row.area || '—'}</span>
                    <span>
                      Phone:{' '}
                      {row.phone ? (
                        <span className="font-mono text-foreground">{row.phone}</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-destructive">
                          <PhoneOff className="w-3 h-3" /> None
                        </span>
                      )}
                    </span>
                    {!row.hasGps && (
                      <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400">
                        <MapPinOff className="w-3 h-3" /> No GPS pin
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {row.flags.map((f) => {
                      const meta = FLAG_LABEL_MAP.get(f);
                      return (
                        <span
                          key={f}
                          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${
                            meta?.badgeCls || 'bg-muted text-muted-foreground border-border'
                          }`}
                        >
                          {meta?.label || f}
                        </span>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {!row.isVerified && (
                    <button
                      onClick={() => handleQuickVerify(row)}
                      disabled={busyVerify}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-success border border-success/30 hover:bg-success/10 transition-colors disabled:opacity-50"
                      title="Mark listing as Verified"
                    >
                      {busyVerify ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <BadgeCheck className="w-3.5 h-3.5" />
                      )}
                      Verify
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (row.entityKind === 'school') {
                        if (onEditSchool) onEditSchool(row.raw);
                        else toast.info('Open Education & Institutes tab to edit this institute');
                      } else {
                        onEditShop(row.raw);
                      }
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-primary border border-primary/25 hover:bg-primary/10 transition-colors"
                  >
                    <Pencil className="w-3 h-3" /> Edit
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
