import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Upload, Loader2, CheckCircle2, AlertTriangle, FileArchive, Database, Store, Tag, Inbox, MapPin, UtensilsCrossed, BedDouble } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { parseCsv } from '@/lib/csvUtils';
import { useCity } from '@/hooks/useCity';
import JSZip from 'jszip';

/**
 * Master Import — restores a Master Export bundle.
 *
 * Accepts either:
 *  - a single .csv file (admin picks which dataset it represents), or
 *  - a .zip produced by Master Export, containing shops.csv / categories.csv /
 *    shop_categories.csv / requests.csv / claims.csv (any subset).
 *
 * Safety:
 *  - Admin-only RLS is enforced server-side; nothing here weakens it.
 *  - Default mode is "skip duplicates" (insert-only). Upsert is opt-in.
 *  - Engagement events and ownership tables are intentionally NOT importable
 *    to protect data integrity.
 */

type DatasetKey = 'shops' | 'categories' | 'shop_categories' | 'mess_profiles' | 'pg_profiles' | 'requests' | 'claims';

const TABLE_FOR: Record<DatasetKey, string> = {
  shops: 'shops',
  categories: 'categories',
  shop_categories: 'shop_categories',
  mess_profiles: 'mess_profiles',
  pg_profiles: 'pg_profiles',
  requests: 'shop_requests',
  claims: 'shop_claims',
};

const LABEL: Record<DatasetKey, { label: string; icon: React.ReactNode }> = {
  shops:           { label: 'Shops',            icon: <Store className="w-4 h-4" /> },
  categories:      { label: 'Categories',       icon: <Tag className="w-4 h-4" /> },
  shop_categories: { label: 'Shop ↔ Category',  icon: <Database className="w-4 h-4" /> },
  mess_profiles:   { label: 'Mess Profiles',    icon: <UtensilsCrossed className="w-4 h-4" /> },
  pg_profiles:     { label: 'PG & Hostels',     icon: <BedDouble className="w-4 h-4" /> },
  requests:        { label: 'Listing Requests', icon: <Inbox className="w-4 h-4" /> },
  claims:          { label: 'Ownership Claims', icon: <Database className="w-4 h-4" /> },
};

const ARRAY_COLUMNS: Record<string, string[]> = {
  shops: ['amenities'],
  pg_profiles: ['amenities'],
  shop_requests: ['amenities'],
};

function coerceRow(table: string, row: Record<string, string>, defaultCityId?: string): Record<string, any> {
  const out: Record<string, any> = {};
  const arrCols = ARRAY_COLUMNS[table] ?? [];
  for (const [k, v] of Object.entries(row)) {
    if (v === '' || v === undefined) { out[k] = null; continue; }
    if (arrCols.includes(k)) { out[k] = v.split('|').map((s) => s.trim()).filter(Boolean); continue; }
    if (v === 'true') { out[k] = true; continue; }
    if (v === 'false') { out[k] = false; continue; }
    if (/^-?\d+(\.\d+)?$/.test(v) && (k === 'latitude' || k === 'longitude')) { out[k] = parseFloat(v); continue; }
    out[k] = v;
  }
  // Strip generated/server-managed columns the admin shouldn't overwrite blindly
  delete out.created_at;
  delete out.updated_at;
  // Keep id so upsert works; drop empty ids
  if (!out.id) delete out.id;
  // Assign fallback city_id for shops if not present in the CSV
  if ((table === 'shops' || table === 'shop_requests') && !out.city_id && defaultCityId) {
    out.city_id = defaultCityId;
  }
  return out;
}

// Tables that use a composite or custom primary key — `id`-based upsert would fail.
const CONFLICT_TARGETS: Record<string, string> = {
  shop_categories: 'shop_id,category_id',
  mess_profiles: 'shop_id',
  pg_profiles: 'shop_id',
};

async function importDataset(table: string, rows: Record<string, string>[], upsert: boolean, defaultCityId?: string) {
  if (rows.length === 0) return { inserted: 0, errors: 0 };
  const payload = rows.map((r) => coerceRow(table, r, defaultCityId));
  const onConflict = CONFLICT_TARGETS[table] ?? 'id';
  let inserted = 0, errors = 0;
  const CHUNK = 200;
  for (let i = 0; i < payload.length; i += CHUNK) {
    const slice = payload.slice(i, i + CHUNK);
    const { error } = upsert
      ? await supabase.from(table as any).upsert(slice, { onConflict, ignoreDuplicates: false })
      : await supabase.from(table as any).insert(slice);
    if (error) {
      // Fall back to per-row so partial success still works
      for (const one of slice) {
        const r = upsert
          ? await supabase.from(table as any).upsert(one, { onConflict })
          : await supabase.from(table as any).insert(one);
        if (r.error) errors++; else inserted++;
      }
    } else {
      inserted += slice.length;
    }
  }
  return { inserted, errors };
}

interface Props { onClose: () => void; onDone: () => void; }

export function MasterImportModal({ onClose, onDone }: Props) {
  const { currentCity, allCities } = useCity();
  const [targetCityId, setTargetCityId] = useState<string>(currentCity.id);
  const [file, setFile] = useState<File | null>(null);
  const [singleKey, setSingleKey] = useState<DatasetKey>('shops');
  const [upsert, setUpsert] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [report, setReport] = useState<{ table: string; inserted: number; errors: number }[] | null>(null);

  const isZip = file && (file.name.toLowerCase().endsWith('.zip') || file.type === 'application/zip');
  const isCsv = file && file.name.toLowerCase().endsWith('.csv');

  const handleClose = () => { if (busy) return; setFile(null); setReport(null); onClose(); };

  const handleImport = async () => {
    if (!file) return;
    setBusy(true); setReport(null);
    const out: { table: string; inserted: number; errors: number }[] = [];
    try {
      if (isZip) {
        setProgress('Reading ZIP…');
        const zip = await JSZip.loadAsync(file);
        // Find each known CSV anywhere inside the zip.
        for (const k of Object.keys(TABLE_FOR) as DatasetKey[]) {
          const entry = Object.values(zip.files).find((f) => !f.dir && f.name.toLowerCase().endsWith(`${k}.csv`));
          if (!entry) continue;
          setProgress(`Importing ${k}…`);
          const text = await entry.async('string');
          const rows = parseCsv(text);
          const table = TABLE_FOR[k];
          const r = await importDataset(table, rows, upsert, targetCityId);
          out.push({ table: k, ...r });
        }
        if (out.length === 0) {
          toast({ title: 'No known CSVs found', description: 'ZIP must contain shops.csv / categories.csv / etc.', variant: 'destructive' as any });
        }
      } else if (isCsv) {
        setProgress(`Importing ${singleKey}…`);
        const text = await file.text();
        const rows = parseCsv(text);
        const table = TABLE_FOR[singleKey];
        const r = await importDataset(table, rows, upsert, targetCityId);
        out.push({ table: singleKey, ...r });
      } else {
        toast({ title: 'Unsupported file', description: 'Upload a .csv or .zip from Master Export.', variant: 'destructive' as any });
      }
      setReport(out);
      const total = out.reduce((s, x) => s + x.inserted, 0);
      const errs  = out.reduce((s, x) => s + x.errors, 0);
      toast({ title: 'Import complete', description: `${total} rows imported${errs ? `, ${errs} errors` : ''}.` });
      onDone();
    } catch (err: any) {
      
      toast({ title: 'Import failed', description: err?.message ?? 'Unknown error', variant: 'destructive' as any });
    } finally {
      setBusy(false); setProgress('');
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle>Master Import</DialogTitle>
              <DialogDescription className="text-xs">Restore from a CSV or Master Export ZIP</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3">
          <label className="block">
            <span className="text-xs font-semibold text-foreground">Choose file</span>
            <input
              type="file" accept=".csv,.zip"
              onChange={(e) => { setFile(e.target.files?.[0] ?? null); setReport(null); }}
              disabled={busy}
              className="mt-1 block w-full text-sm file:mr-3 file:rounded-lg file:border file:bg-muted file:px-3 file:py-2 file:text-xs file:font-semibold"
            />
          </label>

          <div className="space-y-1">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-primary" /> Target Town for Imported Data (if missing in CSV)
            </span>
            <select
              value={targetCityId}
              onChange={(e) => setTargetCityId(e.target.value)}
              disabled={busy}
              className="w-full rounded-lg border bg-background px-2.5 py-2 text-xs font-medium"
            >
              {allCities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.name_mr ? `(${c.name_mr})` : ''} — {c.type}
                </option>
              ))}
            </select>
          </div>

          {isCsv && (
            <label className="block">
              <span className="text-xs font-semibold text-foreground">This CSV represents</span>
              <select
                value={singleKey}
                onChange={(e) => setSingleKey(e.target.value as DatasetKey)}
                disabled={busy}
                className="mt-1 w-full rounded-lg border bg-background px-2 py-2 text-sm"
              >
                {(Object.keys(LABEL) as DatasetKey[]).map((k) => (
                  <option key={k} value={k}>{LABEL[k].label}</option>
                ))}
              </select>
            </label>
          )}

          {isZip && (
            <div className="rounded-lg border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground flex items-center gap-2">
              <FileArchive className="w-3.5 h-3.5" /> Will import any of: shops, categories, shop_categories, requests, claims.
            </div>
          )}

          <label className="flex items-start gap-2 p-2.5 rounded-lg border bg-background cursor-pointer">
            <Checkbox checked={upsert} onCheckedChange={(v) => setUpsert(Boolean(v))} disabled={busy} className="mt-0.5" />
            <div className="text-xs">
              <div className="font-semibold text-foreground">Update existing rows (upsert by id)</div>
              <div className="text-muted-foreground">Off = skip duplicates. On = overwrite matching ids.</div>
            </div>
          </label>

          <div className="rounded-lg border border-secondary/40 bg-secondary/10 px-3 py-2 text-[11px] text-foreground leading-snug flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>Image files inside a ZIP are not re-uploaded — image URLs are restored as-is. Engagement events and ownership rows are not importable.</span>
          </div>

          {busy && progress && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-[11px] text-primary flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> {progress}
            </div>
          )}

          {report && report.length > 0 && (
            <ul className="rounded-lg border divide-y">
              {report.map((r) => (
                <li key={r.table} className="flex items-center justify-between p-2 text-xs">
                  <span className="font-medium text-foreground">{r.table}</span>
                  <span className="text-muted-foreground">
                    <span className="text-success font-semibold">{r.inserted}</span> ok
                    {r.errors > 0 && <> · <span className="text-destructive font-semibold">{r.errors}</span> err</>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
          <button type="button" onClick={handleClose} disabled={busy}
            className="px-4 py-2.5 rounded-lg border text-sm font-medium hover:bg-muted disabled:opacity-50">Close</button>
          <button type="button" onClick={handleImport} disabled={busy || !file}
            className="px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 flex items-center justify-center gap-2">
            {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Importing…</>
              : report ? <><CheckCircle2 className="w-4 h-4" /> Done</>
              : <><Upload className="w-4 h-4" /> Import</>}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
