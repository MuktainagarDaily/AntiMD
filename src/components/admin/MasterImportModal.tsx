import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Upload, Loader2, CheckCircle2, AlertTriangle, FileArchive, MapPin } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { parseCsv } from '@/lib/csvUtils';
import { useCity } from '@/hooks/useCity';
import { coerceDatasetRow, MASTER_DATASETS, DATASET_BY_KEY, type MasterDatasetKey } from '@/lib/admin/masterDatasets';
import type { GeoCity } from '@/lib/geo/types';
import JSZip from 'jszip';

/**
 * Master Import — restores a Master Export bundle across all 19 directory modules.
 *
 * Accepts either:
 *  - a single .csv file (admin picks which dataset it represents), or
 *  - a .zip produced by Master Export, imported in FK-safe order (`MASTER_DATASETS`).
 *
 * Uses `coerceDatasetRow()` so `text[]`, JSONB (`sharing_rates`, `meta`, `key_contacts`),
 * numeric columns, booleans, and `NOT NULL DEFAULT '{}'` constraints round-trip cleanly.
 */

type DynamicWriteClient = {
  insert: (
    values: Record<string, unknown> | Record<string, unknown>[]
  ) => PromiseLike<{ error: { message?: string } | null }>;
  upsert: (
    values: Record<string, unknown> | Record<string, unknown>[],
    opts?: { onConflict?: string; ignoreDuplicates?: boolean }
  ) => PromiseLike<{ error: { message?: string } | null }>;
};

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && err !== null && 'message' in err) {
    return String((err as { message?: unknown }).message ?? 'Unknown error');
  }
  return 'Unknown error';
}

async function importDataset(
  key: MasterDatasetKey,
  rows: Record<string, string>[],
  upsert: boolean,
  fallbackCity: GeoCity
) {
  if (rows.length === 0) return { inserted: 0, errors: 0, lastError: '' };
  const spec = DATASET_BY_KEY[key];
  const payload = rows.map((r) => coerceDatasetRow(key, r, fallbackCity));
  const onConflict = spec.conflictTarget || 'id';
  const client = (supabase as unknown as { from: (t: string) => DynamicWriteClient }).from(spec.table);

  let inserted = 0;
  let errors = 0;
  let lastError = '';
  const CHUNK = 200;

  for (let i = 0; i < payload.length; i += CHUNK) {
    const slice = payload.slice(i, i + CHUNK);
    const { error } = upsert
      ? await client.upsert(slice, { onConflict, ignoreDuplicates: false })
      : await client.insert(slice);

    if (error) {
      for (const one of slice) {
        const r = upsert
          ? await client.upsert(one, { onConflict })
          : await client.insert(one);
        if (r.error) {
          errors++;
          lastError = r.error.message || lastError;
        } else {
          inserted++;
        }
      }
    } else {
      inserted += slice.length;
    }
  }
  return { inserted, errors, lastError };
}

interface Props {
  onClose: () => void;
  onDone: () => void;
}

export function MasterImportModal({ onClose, onDone }: Props) {
  const { currentCity, allCities } = useCity();
  const [targetCityId, setTargetCityId] = useState<string>(currentCity.id);
  const [file, setFile] = useState<File | null>(null);
  const [singleKey, setSingleKey] = useState<MasterDatasetKey>('shops');
  const [upsert, setUpsert] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [report, setReport] = useState<{ table: string; label: string; inserted: number; errors: number; lastError?: string }[] | null>(null);

  const isZip = file && (file.name.toLowerCase().endsWith('.zip') || file.type === 'application/zip');
  const isCsv = file && file.name.toLowerCase().endsWith('.csv');

  const handleClose = () => {
    if (busy) return;
    setFile(null);
    setReport(null);
    onClose();
  };

  const handleImport = async () => {
    if (!file) return;
    setBusy(true);
    setReport(null);
    const out: { table: string; label: string; inserted: number; errors: number; lastError?: string }[] = [];
    const fallbackCity = allCities.find((c) => c.id === targetCityId) || currentCity;

    try {
      if (isZip) {
        setProgress('Reading ZIP…');
        const zip = await JSZip.loadAsync(file);

        // Import strictly in FK-safe order defined by MASTER_DATASETS
        for (const spec of MASTER_DATASETS) {
          const entry = Object.values(zip.files).find(
            (f) =>
              !f.dir &&
              (f.name.toLowerCase().endsWith(`/${spec.key}.csv`) ||
                f.name.toLowerCase() === `${spec.key}.csv` ||
                f.name.toLowerCase().endsWith(`/${spec.table}.csv`) ||
                f.name.toLowerCase() === `${spec.table}.csv`)
          );
          if (!entry) continue;
          setProgress(`Importing ${spec.label}…`);
          const text = await entry.async('string');
          const rows = parseCsv(text);
          const r = await importDataset(spec.key, rows, upsert, fallbackCity);
          out.push({ table: spec.key, label: spec.label, ...r });
        }

        if (out.length === 0) {
          toast({
            title: 'No known CSVs found',
            description: 'ZIP must contain recognized CSVs like shops.csv, schools.csv, categories.csv, etc.',
            variant: 'destructive',
          });
        }
      } else if (isCsv) {
        const spec = DATASET_BY_KEY[singleKey];
        setProgress(`Importing ${spec.label}…`);
        const text = await file.text();
        const rows = parseCsv(text);
        const r = await importDataset(singleKey, rows, upsert, fallbackCity);
        out.push({ table: singleKey, label: spec.label, ...r });
      } else {
        toast({
          title: 'Unsupported file',
          description: 'Upload a .csv or .zip from Master Export.',
          variant: 'destructive',
        });
      }

      setReport(out);
      const total = out.reduce((s, x) => s + x.inserted, 0);
      const errs = out.reduce((s, x) => s + x.errors, 0);
      toast({
        title: 'Import complete',
        description: `${total} rows imported${errs ? `, ${errs} errors` : ''}.`,
      });
      onDone();
    } catch (err: unknown) {
      toast({ title: 'Import failed', description: getErrorMessage(err), variant: 'destructive' });
    } finally {
      setBusy(false);
      setProgress('');
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="pr-8 text-left">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Upload className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <DialogTitle>Master Import</DialogTitle>
              <DialogDescription className="text-xs">
                Restore from any CSV or Master Export ZIP across all 19 tables in FK-safe order
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3">
          <label className="block">
            <span className="text-xs font-semibold text-foreground">Choose file</span>
            <input
              type="file"
              accept=".csv,.zip"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setReport(null);
              }}
              disabled={busy}
              className="mt-1 block w-full max-w-full overflow-hidden text-sm file:mr-3 file:rounded-lg file:border file:bg-muted file:px-3 file:py-2 file:text-xs file:font-semibold"
            />
          </label>

          <div className="space-y-1">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-primary" /> Target Town for Imported Data (when missing in CSV)
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
                onChange={(e) => setSingleKey(e.target.value as MasterDatasetKey)}
                disabled={busy}
                className="mt-1 w-full rounded-lg border bg-background px-2 py-2 text-sm"
              >
                {MASTER_DATASETS.map((d) => (
                  <option key={d.key} value={d.key}>
                    {d.label} ({d.table})
                  </option>
                ))}
              </select>
            </label>
          )}

          {isZip && (
            <div className="rounded-lg border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground flex items-start gap-2">
              <FileArchive className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>
                Auto-detects and imports CSVs in FK-safe order (categories, shops, mess, PG, schools, notices, bus timetable, local news, banners, civic notices, requests &amp; claims).
              </span>
            </div>
          )}

          <label className="flex items-start gap-2 p-2.5 rounded-lg border bg-background cursor-pointer">
            <Checkbox checked={upsert} onCheckedChange={(v) => setUpsert(Boolean(v))} disabled={busy} className="mt-0.5" />
            <div className="text-xs">
              <div className="font-semibold text-foreground">Update existing rows (upsert by primary key)</div>
              <div className="text-muted-foreground">Off = skip duplicates. On = overwrite matching records.</div>
            </div>
          </label>

          <div className="rounded-lg border border-secondary/40 bg-secondary/10 px-3 py-2 text-[11px] text-foreground leading-snug flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>
              Image files inside a ZIP are not re-uploaded — image URLs and photo arrays are restored as-is. Engagement events and ownership assignments remain protected.
            </span>
          </div>

          {busy && progress && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-[11px] text-primary flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" /> {progress}
            </div>
          )}

          {report && report.length > 0 && (
            <ul className="rounded-lg border divide-y max-h-52 overflow-y-auto">
              {report.map((r) => (
                <li key={r.table} className="p-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground">{r.label}</span>
                    <span className="text-muted-foreground">
                      <span className="text-success font-semibold">{r.inserted}</span> ok
                      {r.errors > 0 && (
                        <>
                          {' '}· <span className="text-destructive font-semibold">{r.errors}</span> err
                        </>
                      )}
                    </span>
                  </div>
                  {r.errors > 0 && r.lastError && (
                    <div className="text-[10px] text-destructive mt-0.5 truncate" title={r.lastError}>
                      {r.lastError}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={handleClose}
            disabled={busy}
            className="px-4 py-2.5 rounded-lg border text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={busy || !file}
            className="px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {busy ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Importing…</>
            ) : report ? (
              <><CheckCircle2 className="w-4 h-4" /> Done</>
            ) : (
              <><Upload className="w-4 h-4" /> Import</>
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
