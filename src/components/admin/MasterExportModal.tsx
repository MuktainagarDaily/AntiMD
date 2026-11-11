import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Download, Database, Store, Tag, Image as ImageIcon, Inbox, KeyRound, CheckCircle2, Loader2, Archive, FileText, UtensilsCrossed, BedDouble } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { downloadCsv } from '@/lib/csvUtils';
import JSZip from 'jszip';

/**
 * Master Export — real implementation.
 *
 * Admin picks which datasets to include and whether to bundle the actual
 * image files into a ZIP archive alongside the CSVs. Falls back to a single
 * CSV download when only one dataset is selected and images are off.
 */

type DatasetKey = 'shops' | 'categories' | 'shop_categories' | 'mess_profiles' | 'pg_profiles' | 'requests' | 'claims' | 'images';

interface DatasetMeta {
  key: DatasetKey;
  label: string;
  detail: string;
  icon: React.ReactNode;
}

const DATASETS: DatasetMeta[] = [
  { key: 'shops',           label: 'Shops',            detail: 'All shops with full details, contacts, hours, location', icon: <Store className="w-4 h-4" /> },
  { key: 'categories',      label: 'Categories',       detail: 'All categories with active state',                       icon: <Tag className="w-4 h-4" /> },
  { key: 'shop_categories', label: 'Shop ↔ Category',  detail: 'Mapping rows linking shops to categories',                icon: <Database className="w-4 h-4" /> },
  { key: 'mess_profiles',   label: 'Mess Profiles',    detail: 'Mess types, monthly rates, thali rates, and tiffin',     icon: <UtensilsCrossed className="w-4 h-4" /> },
  { key: 'pg_profiles',     label: 'PG & Hostels',     detail: 'Room capacities, vacancies, sharing rates, and deposits', icon: <BedDouble className="w-4 h-4" /> },
  { key: 'requests',        label: 'Listing Requests', detail: 'Pending / approved / rejected submissions',               icon: <Inbox className="w-4 h-4" /> },
  { key: 'claims',          label: 'Ownership Claims', detail: 'Claim status, requested shop, claimant details',          icon: <KeyRound className="w-4 h-4" /> },
  { key: 'images',          label: 'Image Files',      detail: 'Downloads each shop image into a ZIP /images folder',     icon: <ImageIcon className="w-4 h-4" /> },
];

const DATE_SUFFIX = () => new Date().toISOString().slice(0, 10);

function csvFromObjects(rows: Record<string, any>[]): string {
  if (rows.length === 0) return '';
  const headerSet = new Set<string>();
  rows.forEach((r) => Object.keys(r).forEach((k) => headerSet.add(k)));
  const headers = Array.from(headerSet);
  const esc = (v: unknown) => {
    if (v === null || v === undefined) return '""';
    const s = Array.isArray(v) ? v.join('|') : typeof v === 'object' ? JSON.stringify(v) : String(v);
    return `"${s.replace(/"/g, '""')}"`;
  };
  const lines = [headers.join(',')];
  for (const r of rows) lines.push(headers.map((h) => esc(r[h])).join(','));
  return '\uFEFF' + lines.join('\n');
}

async function fetchAll(table: string) {
  const { data, error } = await supabase.from(table as any).select('*');
  if (error) throw error;
  return (data ?? []) as Record<string, any>[];
}

function safeImageName(url: string, shopId: string) {
  try {
    const base = url.split('/').pop()?.split('?')[0] ?? 'image';
    const ext = base.includes('.') ? base.split('.').pop() : 'jpg';
    return `${shopId}.${ext}`;
  } catch {
    return `${shopId}.jpg`;
  }
}

export function MasterExportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [progress, setProgress] = useState<string>('');
  const [selected, setSelected] = useState<Record<DatasetKey, boolean>>({
    shops: true, categories: true, shop_categories: true, mess_profiles: true, pg_profiles: true, requests: true, claims: true, images: false,
  });

  const toggle = (k: DatasetKey) => setSelected((s) => ({ ...s, [k]: !s[k] }));
  const selectedKeys = (Object.keys(selected) as DatasetKey[]).filter((k) => selected[k]);
  const onlyOneCsv = selectedKeys.length === 1 && selectedKeys[0] !== 'images';
  const hasImages = selected.images;

  const handleClose = () => {
    if (busy) return;
    setDone(false); setProgress('');
    onClose();
  };

  const handleExport = async () => {
    if (selectedKeys.length === 0) {
      toast({ title: 'Pick at least one dataset', variant: 'destructive' as any });
      return;
    }
    setBusy(true); setDone(false);
    try {
      // Always need shops if images is selected.
      const need = new Set(selectedKeys);
      if (need.has('images')) need.add('shops');

      const datasets: Partial<Record<DatasetKey, Record<string, any>[]>> = {};
      for (const k of need) {
        if (k === 'images') continue;
        setProgress(`Fetching ${k}…`);
        const table = k === 'shop_categories' ? 'shop_categories'
                    : k === 'requests' ? 'shop_requests'
                    : k === 'claims' ? 'shop_claims'
                    : k;
        datasets[k] = await fetchAll(table);
      }

      // Single CSV fast path
      if (onlyOneCsv) {
        const k = selectedKeys[0];
        const rows = datasets[k] ?? [];
        const headers = rows.length ? Object.keys(rows[0]) : ['(empty)'];
        const data = rows.map((r) => headers.map((h) => {
          const v = r[h];
          return Array.isArray(v) ? v.join('|') : v ?? '';
        }));
        downloadCsv(`muktainagar-${k}`, headers, data);
        setDone(true);
        toast({ title: 'Export ready', description: `${rows.length} rows downloaded.` });
        return;
      }

      // ZIP path (multi-csv and/or images)
      const zip = new JSZip();
      const folder = zip.folder(`muktainagar-export-${DATE_SUFFIX()}`)!;

      for (const k of selectedKeys) {
        if (k === 'images') continue;
        const rows = datasets[k] ?? [];
        folder.file(`${k}.csv`, csvFromObjects(rows));
      }

      // Manifest
      folder.file('manifest.json', JSON.stringify({
        exported_at: new Date().toISOString(),
        app: 'muktainagar-daily',
        counts: Object.fromEntries(selectedKeys.filter((k) => k !== 'images').map((k) => [k, (datasets[k] ?? []).length])),
        includes_images: hasImages,
      }, null, 2));

      // Images
      if (hasImages) {
        const shops = datasets.shops ?? [];
        const withImages = shops.filter((s) => typeof s.image_url === 'string' && s.image_url);
        const imgFolder = folder.folder('images')!;
        let ok = 0, fail = 0;
        for (let i = 0; i < withImages.length; i++) {
          const s = withImages[i];
          setProgress(`Downloading image ${i + 1}/${withImages.length}…`);
          try {
            const res = await fetch(s.image_url);
            if (!res.ok) throw new Error(String(res.status));
            const blob = await res.blob();
            imgFolder.file(safeImageName(s.image_url, s.id), blob);
            ok++;
          } catch {
            fail++;
          }
        }
        folder.file('images/_report.txt', `Downloaded: ${ok}\nFailed: ${fail}\nTotal: ${withImages.length}\n`);
      }

      setProgress('Compressing ZIP…');
      const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `muktainagar-export-${DATE_SUFFIX()}.zip`; a.click();
      URL.revokeObjectURL(url);

      setDone(true);
      toast({ title: 'Export ready', description: 'ZIP archive downloaded.' });
    } catch (err: any) {
      
      toast({ title: 'Export failed', description: err?.message ?? 'Unknown error', variant: 'destructive' as any });
    } finally {
      setBusy(false); setProgress('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle>Master Export</DialogTitle>
              <DialogDescription className="text-xs">
                Pick what to include. Images bundle into a ZIP.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-2.5">
          <ul className="rounded-lg border bg-muted/30 divide-y">
            {DATASETS.map((d) => (
              <li key={d.key} className="flex items-start gap-3 p-2.5">
                <Checkbox
                  id={`exp-${d.key}`}
                  checked={selected[d.key]}
                  onCheckedChange={() => toggle(d.key)}
                  disabled={busy}
                  className="mt-1"
                />
                <div className="mt-0.5 w-7 h-7 rounded-md bg-background border flex items-center justify-center text-muted-foreground shrink-0">
                  {d.icon}
                </div>
                <label htmlFor={`exp-${d.key}`} className="min-w-0 flex-1 cursor-pointer">
                  <div className="text-sm font-medium text-foreground leading-tight">{d.label}</div>
                  <div className="text-[11px] text-muted-foreground leading-snug mt-0.5">{d.detail}</div>
                </label>
              </li>
            ))}
          </ul>

          <div className="rounded-lg border bg-background px-3 py-2 text-[11px] text-muted-foreground flex items-center gap-2">
            {onlyOneCsv ? <FileText className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
            {onlyOneCsv
              ? 'Single CSV file will download.'
              : `ZIP archive: ${selectedKeys.filter((k) => k !== 'images').length} CSV file(s)${hasImages ? ' + images folder' : ''}.`}
          </div>

          {busy && progress && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-[11px] text-primary flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> {progress}
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
          <button
            type="button" onClick={handleClose} disabled={busy}
            className="px-4 py-2.5 rounded-lg border text-sm font-medium hover:bg-muted disabled:opacity-50"
          >Cancel</button>
          <button
            type="button" onClick={handleExport} disabled={busy || selectedKeys.length === 0}
            className="px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Exporting…</>
              : done ? <><CheckCircle2 className="w-4 h-4" /> Done</>
              : <><Download className="w-4 h-4" /> Download</>}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
