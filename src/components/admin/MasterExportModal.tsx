import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Download, Database, Store, Tag, Image as ImageIcon, Inbox, KeyRound,
  CheckCircle2, Loader2, Archive, FileText, UtensilsCrossed, BedDouble,
  GraduationCap, Bell, Bus, Newspaper, Megaphone, Building2, ShieldAlert,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { csvFromObjects, downloadCsvText, fetchAllPaged } from '@/lib/csvUtils';
import { isMissingRelationErr } from '@/lib/entities/claimEntity';
import { MASTER_DATASETS, type MasterDatasetKey, type MasterExportKey } from '@/lib/admin/masterDatasets';
import JSZip from 'jszip';

/**
 * Master Export — complete backup utility covering all 19 directory/platform tables.
 *
 * - Paginates every table past Supabase's 1,000-row cap via `fetchAllPaged`.
 * - Serializes nested arrays and JSONB columns cleanly through `csvFromObjects`
 *   (no `[object Object]` corruption).
 * - Bundles shop galleries, school galleries, mess menu photos, and ad banners
 *   into organized ZIP subfolders when `Image Files` is toggled on.
 */

const ICON_BY_KEY: Record<MasterExportKey, React.ReactNode> = {
  categories:              <Tag className="w-4 h-4" />,
  shops:                   <Store className="w-4 h-4" />,
  shop_categories:         <Database className="w-4 h-4" />,
  mess_profiles:           <UtensilsCrossed className="w-4 h-4" />,
  mess_daily_menus:        <UtensilsCrossed className="w-4 h-4" />,
  pg_profiles:             <BedDouble className="w-4 h-4" />,
  schools:                 <GraduationCap className="w-4 h-4" />,
  school_notices:          <Bell className="w-4 h-4" />,
  school_claims:           <KeyRound className="w-4 h-4" />,
  bus_timetable:           <Bus className="w-4 h-4" />,
  bus_stand_info:          <Bus className="w-4 h-4" />,
  news_sources:            <Newspaper className="w-4 h-4" />,
  local_news:              <Newspaper className="w-4 h-4" />,
  banners:                 <Megaphone className="w-4 h-4" />,
  authority_departments:   <Building2 className="w-4 h-4" />,
  authority_organizations: <Building2 className="w-4 h-4" />,
  authority_announcements: <ShieldAlert className="w-4 h-4" />,
  announcement_locations:  <Building2 className="w-4 h-4" />,
  requests:                <Inbox className="w-4 h-4" />,
  claims:                  <KeyRound className="w-4 h-4" />,
  images:                  <ImageIcon className="w-4 h-4" />,
};

const DATE_SUFFIX = () => new Date().toISOString().slice(0, 10);

function buildDefaultSelection(): Record<MasterExportKey, boolean> {
  const sel: Record<string, boolean> = { images: false };
  for (const d of MASTER_DATASETS) {
    sel[d.key] = Boolean(d.defaultSelected);
  }
  return sel as Record<MasterExportKey, boolean>;
}

type DynamicExportClient = {
  select: (cols: string) => {
    range: (
      from: number,
      to: number
    ) => PromiseLike<{ data: Record<string, unknown>[] | null; error: unknown }>;
  };
};

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && err !== null && 'message' in err) {
    return String((err as { message?: unknown }).message ?? 'Unknown error');
  }
  return 'Unknown error';
}

async function fetchTableAllPaged(
  table: string,
  optional?: boolean
): Promise<{ rows: Record<string, unknown>[]; skipped: boolean }> {
  try {
    const client = (supabase as unknown as { from: (t: string) => DynamicExportClient }).from(table);
    const rows = await fetchAllPaged<Record<string, unknown>>(
      (from, to) => client.select('*').range(from, to),
      1000
    );
    return { rows, skipped: false };
  } catch (err: unknown) {
    if (optional && isMissingRelationErr(err)) {
      return { rows: [], skipped: true };
    }
    throw err;
  }
}

function safeImageName(url: string, prefix: string) {
  try {
    const base = url.split('/').pop()?.split('?')[0] ?? 'image';
    const extMatch = base.match(/\.([a-zA-Z0-9]{2,5})$/);
    const ext = extMatch ? extMatch[1].toLowerCase() : 'jpg';
    return `${prefix}.${ext}`;
  } catch {
    return `${prefix}.jpg`;
  }
}

interface ImageAssetTask {
  url: string;
  folder: 'shops' | 'schools' | 'menus' | 'banners';
  filename: string;
}

export function MasterExportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [progress, setProgress] = useState<string>('');
  const [selected, setSelected] = useState<Record<MasterExportKey, boolean>>(buildDefaultSelection);

  const toggle = (k: MasterExportKey) => setSelected((s) => ({ ...s, [k]: !s[k] }));

  const selectAll = () => {
    const next: Record<string, boolean> = { images: selected.images };
    for (const d of MASTER_DATASETS) next[d.key] = true;
    setSelected(next as Record<MasterExportKey, boolean>);
  };

  const selectRecommended = () => {
    setSelected((prev) => ({ ...buildDefaultSelection(), images: prev.images }));
  };

  const clearAll = () => {
    const next: Record<string, boolean> = { images: false };
    for (const d of MASTER_DATASETS) next[d.key] = false;
    setSelected(next as Record<MasterExportKey, boolean>);
  };

  const selectedKeys = useMemo(
    () => (Object.keys(selected) as MasterExportKey[]).filter((k) => selected[k]),
    [selected]
  );
  const csvKeys = selectedKeys.filter((k): k is MasterDatasetKey => k !== 'images');
  const onlyOneCsv = selectedKeys.length === 1 && selectedKeys[0] !== 'images';
  const hasImages = selected.images;

  const handleClose = () => {
    if (busy) return;
    setDone(false);
    setProgress('');
    onClose();
  };

  const handleExport = async () => {
    if (selectedKeys.length === 0) {
      toast({ title: 'Pick at least one dataset', variant: 'destructive' });
      return;
    }
    setBusy(true);
    setDone(false);
    try {
      const need = new Set<MasterDatasetKey>(csvKeys);
      if (hasImages) {
        need.add('shops');
        need.add('schools');
        need.add('mess_daily_menus');
        need.add('banners');
      }

      const datasets: Partial<Record<MasterDatasetKey, Record<string, unknown>[]>> = {};
      const skippedTables: string[] = [];

      for (const spec of MASTER_DATASETS) {
        if (!need.has(spec.key)) continue;
        setProgress(`Fetching ${spec.label}…`);
        const forceOptional = spec.optionalTable || (hasImages && !csvKeys.includes(spec.key));
        const res = await fetchTableAllPaged(spec.table, forceOptional);
        if (res.skipped) {
          skippedTables.push(spec.table);
        } else {
          datasets[spec.key] = res.rows;
        }
      }

      // Single CSV fast path
      if (onlyOneCsv) {
        const k = csvKeys[0];
        const rows = datasets[k] ?? [];
        const csv = csvFromObjects(rows, rows.length === 0 ? ['(empty)'] : undefined);
        downloadCsvText(`apnatown-${k}`, csv, true);
        setDone(true);
        toast({ title: 'Export ready', description: `${rows.length} rows downloaded.` });
        return;
      }

      // ZIP path (multi-csv and/or images)
      const zip = new JSZip();
      const folder = zip.folder(`apnatown-export-${DATE_SUFFIX()}`)!;

      for (const k of csvKeys) {
        const rows = datasets[k] ?? [];
        folder.file(`${k}.csv`, csvFromObjects(rows));
      }

      folder.file(
        'manifest.json',
        JSON.stringify(
          {
            exported_at: new Date().toISOString(),
            app: 'apnatown',
            counts: Object.fromEntries(csvKeys.map((k) => [k, (datasets[k] ?? []).length])),
            skipped_optional_tables: skippedTables,
            includes_images: hasImages,
          },
          null,
          2
        )
      );

      if (hasImages) {
        const seenUrls = new Set<string>();
        const tasks: ImageAssetTask[] = [];
        const enqueue = (url: unknown, targetFolder: ImageAssetTask['folder'], namePrefix: string) => {
          if (typeof url !== 'string') return;
          const clean = url.trim();
          if (!/^https?:\/\//i.test(clean) || seenUrls.has(clean)) return;
          seenUrls.add(clean);
          tasks.push({ url: clean, folder: targetFolder, filename: safeImageName(clean, namePrefix) });
        };

        for (const s of datasets.shops ?? []) {
          enqueue(s.image_url, 'shops', `${String(s.id ?? 'shop')}-cover`);
          if (Array.isArray(s.photos)) {
            s.photos.forEach((p, idx) => enqueue(p, 'shops', `${String(s.id ?? 'shop')}-photo-${idx + 1}`));
          }
        }
        for (const sc of datasets.schools ?? []) {
          enqueue(sc.image_url, 'schools', `${String(sc.id ?? 'school')}-cover`);
          if (Array.isArray(sc.photos)) {
            sc.photos.forEach((p, idx) => enqueue(p, 'schools', `${String(sc.id ?? 'school')}-photo-${idx + 1}`));
          }
        }
        for (const m of datasets.mess_daily_menus ?? []) {
          enqueue(m.photo_url, 'menus', `${m.id}`);
        }
        for (const b of datasets.banners ?? []) {
          enqueue(b.image_url, 'banners', `${b.id}`);
        }

        const imgRoot = folder.folder('images')!;
        let ok = 0;
        let fail = 0;
        for (let i = 0; i < tasks.length; i++) {
          const t = tasks[i];
          setProgress(`Downloading image ${i + 1}/${tasks.length}…`);
          try {
            const res = await fetch(t.url);
            if (!res.ok) throw new Error(String(res.status));
            const blob = await res.blob();
            imgRoot.folder(t.folder)!.file(t.filename, blob);
            ok++;
          } catch {
            fail++;
          }
        }
        imgRoot.file('_report.txt', `Downloaded: ${ok}\nFailed: ${fail}\nTotal unique assets: ${tasks.length}\n`);
      }

      setProgress('Compressing ZIP…');
      const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `apnatown-export-${DATE_SUFFIX()}.zip`;
      a.click();
      URL.revokeObjectURL(url);

      setDone(true);
      toast({ title: 'Export ready', description: `${csvKeys.length} CSV file(s) backed up.` });
    } catch (err: unknown) {
      toast({ title: 'Export failed', description: getErrorMessage(err), variant: 'destructive' });
    } finally {
      setBusy(false);
      setProgress('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="pr-8 text-left">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Download className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <DialogTitle>Master Export</DialogTitle>
              <DialogDescription className="text-xs">
                Pick tables to include (all rows exported past 1,000-row cap). Multiple tables bundle into a ZIP.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={selectAll}
              disabled={busy}
              className="px-2.5 py-1 rounded-md border text-[11px] font-semibold hover:bg-muted transition-colors"
            >
              Select All
            </button>
            <button
              type="button"
              onClick={selectRecommended}
              disabled={busy}
              className="px-2.5 py-1 rounded-md border text-[11px] font-semibold hover:bg-muted transition-colors"
            >
              Core + Education Preset
            </button>
            <button
              type="button"
              onClick={clearAll}
              disabled={busy}
              className="px-2.5 py-1 rounded-md border text-[11px] font-semibold text-muted-foreground hover:bg-muted transition-colors"
            >
              Clear
            </button>
          </div>

          <ul className="rounded-lg border bg-muted/30 divide-y max-h-[45dvh] overflow-y-auto">
            {MASTER_DATASETS.map((d) => (
              <li key={d.key} className="flex items-start gap-3 p-2.5">
                <Checkbox
                  id={`exp-${d.key}`}
                  checked={selected[d.key]}
                  onCheckedChange={() => toggle(d.key)}
                  disabled={busy}
                  className="mt-1"
                />
                <div className="mt-0.5 w-7 h-7 rounded-md bg-background border flex items-center justify-center text-muted-foreground shrink-0">
                  {ICON_BY_KEY[d.key]}
                </div>
                <label htmlFor={`exp-${d.key}`} className="min-w-0 flex-1 cursor-pointer">
                  <div className="text-sm font-medium text-foreground leading-tight">{d.label}</div>
                  <div className="text-[11px] text-muted-foreground leading-snug mt-0.5">{d.detail}</div>
                </label>
              </li>
            ))}
            <li className="flex items-start gap-3 p-2.5 bg-background/60">
              <Checkbox
                id="exp-images"
                checked={selected.images}
                onCheckedChange={() => toggle('images')}
                disabled={busy}
                className="mt-1"
              />
              <div className="mt-0.5 w-7 h-7 rounded-md bg-background border flex items-center justify-center text-muted-foreground shrink-0">
                {ICON_BY_KEY.images}
              </div>
              <label htmlFor="exp-images" className="min-w-0 flex-1 cursor-pointer">
                <div className="text-sm font-medium text-foreground leading-tight">Image Files (ZIP Bundle)</div>
                <div className="text-[11px] text-muted-foreground leading-snug mt-0.5">
                  Downloads cover &amp; gallery images for shops, schools, menus &amp; banners into /images folders
                </div>
              </label>
            </li>
          </ul>

          <div className="rounded-lg border bg-background px-3 py-2 text-[11px] text-muted-foreground flex items-center gap-2">
            {onlyOneCsv ? <FileText className="w-3.5 h-3.5 shrink-0" /> : <Archive className="w-3.5 h-3.5 shrink-0" />}
            {onlyOneCsv
              ? 'Single CSV file will download.'
              : `ZIP archive: ${csvKeys.length} CSV file(s)${hasImages ? ' + /images subfolders' : ''}.`}
          </div>

          {busy && progress && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-[11px] text-primary flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" /> {progress}
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={handleClose}
            disabled={busy}
            className="px-4 py-2.5 rounded-lg border text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={busy || selectedKeys.length === 0}
            className="px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {busy ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Exporting…</>
            ) : done ? (
              <><CheckCircle2 className="w-4 h-4" /> Done</>
            ) : (
              <><Download className="w-4 h-4" /> Download</>
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
