import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  MapPin, Pencil, Loader2, TriangleAlert, Users, RefreshCw,
  HardDrive, PackageX, Trash2, ArrowRight, Phone, FileImage, Wand2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { slugifyShopName, listShopImages, moveShopImage, getShopImagePublicUrl, removeShopImages } from '@/lib/storageNaming';
import { extractStoragePath } from './adminHelpers';

/* ─── Pure area-comparison helpers ─────────────────────────────── */
function dqAreaCompareKey(area: string): string {
  if (!area?.trim()) return '__empty__';
  return area
    .toLowerCase()
    .replace(/[\u0900-\u097F]+/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
const dqHasDevanagari = (s: string) => /[\u0900-\u097F]/.test(s);
function dqNormalizeAreaValue(s: string): string {
  return s.trim().replace(/(^|[\s,])([a-z])/g, (_, sep, c) => sep + c.toUpperCase());
}
function dqIsSuspiciousArea(area: string): boolean {
  const t = area.trim();
  if (t.length < 3) return true;
  if (/^\d+$/.test(t)) return true;
  if (!dqHasDevanagari(t) && t === t.toUpperCase() && /[A-Z]{3,}/.test(t)) return true;
  return false;
}

/* ─── Image Rename (slug-ify existing files) ────────────────────── */
type RenamePlanRow = {
  shopId: string;
  shopName: string;
  currentPath: string;
  currentFilename: string;
  proposedFilename: string;
  status: 'ok' | 'unchanged' | 'skip';
  reason?: string;
};

function ImageRenameSection() {
  const qc = useQueryClient();
  const [building, setBuilding] = useState(false);
  const [plan, setPlan] = useState<RenamePlanRow[] | null>(null);
  const [applying, setApplying] = useState(false);
  const [progress, setProgress] = useState({ done: 0, ok: 0, failed: 0 });
  const [confirmOpen, setConfirmOpen] = useState(false);

  const buildPlan = async () => {
    setBuilding(true);
    setPlan(null);
    setProgress({ done: 0, ok: 0, failed: 0 });
    try {
      const { data: shops, error } = await supabase
        .from('shops')
        .select('id, name, image_url')
        .not('image_url', 'is', null);
      if (error) throw error;

      // Snapshot existing storage filenames for collision-safe naming
      type StorageFile = { name: string; id: string };
      let pagedFiles: StorageFile[] = [];
      let offset = 0;
      const PAGE = 1000;
      while (true) {
        const { data: page, error: listErr } = await listShopImages({ limit: PAGE, offset });
        if (listErr) throw listErr;
        const valid = (page || []).filter((f) => f.name && f.id) as StorageFile[];
        pagedFiles = pagedFiles.concat(valid);
        if (!page || page.length < PAGE) break;
        offset += PAGE;
      }
      const taken = new Set(pagedFiles.map((f) => f.name));

      const rows: RenamePlanRow[] = [];
      for (const s of (shops || []) as any[]) {
        const currentPath = extractStoragePath(s.image_url);
        if (!currentPath) {
          rows.push({
            shopId: s.id,
            shopName: s.name,
            currentPath: s.image_url,
            currentFilename: '(external URL)',
            proposedFilename: '—',
            status: 'skip',
            reason: 'Image is not in the shop-images bucket',
          });
          continue;
        }
        const currentFilename = currentPath.split('/').pop() || currentPath;
        const slug = slugifyShopName(s.name);
        const desired = `${slug}.webp`;
        // Already named correctly (slug.webp or slug-N.webp)?
        const slugRe = new RegExp(`^${slug}(?:-\\d+)?\\.webp$`);
        if (slugRe.test(currentFilename)) {
          rows.push({
            shopId: s.id,
            shopName: s.name,
            currentPath,
            currentFilename,
            proposedFilename: currentFilename,
            status: 'unchanged',
          });
          continue;
        }
        // Pick a free name (don't collide with existing files OR with names
        // we've already reserved earlier in this same plan).
        let proposed = desired;
        if (taken.has(proposed)) {
          for (let i = 1; i < 1000; i++) {
            const candidate = `${slug}-${i}.webp`;
            if (!taken.has(candidate)) { proposed = candidate; break; }
          }
        }
        taken.add(proposed); // reserve so subsequent rows pick the next free
        rows.push({
          shopId: s.id,
          shopName: s.name,
          currentPath,
          currentFilename,
          proposedFilename: proposed,
          status: 'ok',
        });
      }
      setPlan(rows);
    } catch (err: any) {
      toast.error('Plan failed: ' + (err?.message || 'Unknown error'));
    }
    setBuilding(false);
  };

  const applyPlan = async () => {
    if (!plan) return;
    const renamable = plan.filter((r) => r.status === 'ok');
    if (renamable.length === 0) {
      toast.info('Nothing to rename');
      setConfirmOpen(false);
      return;
    }
    setApplying(true);
    setConfirmOpen(false);
    let ok = 0, failed = 0, done = 0;
    const updated: RenamePlanRow[] = [...plan];

    for (let i = 0; i < updated.length; i++) {
      const row = updated[i];
      if (row.status !== 'ok') continue;
      try {
        // storage.move from current → proposed
        const newPath = row.proposedFilename; // bucket root
        const { error: moveErr } = await moveShopImage(row.currentPath, newPath);
        if (moveErr) throw new Error(moveErr);
        const publicUrl = getShopImagePublicUrl(newPath);
        const { error: dbErr } = await supabase.from('shops').update({ image_url: publicUrl }).eq('id', row.shopId);
        if (dbErr) {
          // Roll the file back so DB and storage stay in sync
          await moveShopImage(newPath, row.currentPath);
          throw dbErr;
        }
        ok++;
        updated[i] = { ...row, status: 'unchanged', currentFilename: newPath, currentPath: newPath, reason: 'Renamed ✓' };
      } catch (err: any) {
        failed++;
        updated[i] = { ...row, status: 'skip', reason: 'Failed: ' + (err?.message || 'unknown') };
      }
      done++;
      setProgress({ done, ok, failed });
      setPlan([...updated]);
    }

    qc.invalidateQueries({ queryKey: ['shops'] });
    qc.invalidateQueries({ queryKey: ['admin-shops'] });
    qc.invalidateQueries({ queryKey: ['admin-shops-quality'] });
    toast.success(`Renamed ${ok} file${ok !== 1 ? 's' : ''}${failed ? ` · ${failed} failed` : ''}`);
    setApplying(false);
  };

  const renamableCount = plan?.filter((r) => r.status === 'ok').length ?? 0;
  const unchangedCount = plan?.filter((r) => r.status === 'unchanged').length ?? 0;
  const skipCount = plan?.filter((r) => r.status === 'skip').length ?? 0;

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <FileImage className="w-4 h-4 text-primary" />
        <h3 className="font-bold text-foreground">Rename Shop Images</h3>
        {plan && (
          <span className="ml-1 inline-flex items-center justify-center min-w-[1.5rem] h-5 px-1.5 rounded-full text-[11px] font-bold bg-primary/10 text-primary border border-primary/20">
            {renamableCount}
          </span>
        )}
        <button
          onClick={buildPlan}
          disabled={building || applying}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60"
        >
          {building ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
          {plan ? 'Re-plan' : 'Plan rename'}
        </button>
      </div>

      {!plan && !building && (
        <div className="bg-card rounded-xl border border-border p-6 text-center">
          <FileImage className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="font-semibold text-sm text-foreground">Make filenames match shop names</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
            Click <strong>Plan rename</strong> to preview new filenames like <code className="text-[11px] bg-muted px-1 py-0.5 rounded">sai-kirana-stores.webp</code>.
            Nothing is changed until you click Apply.
          </p>
        </div>
      )}
      {building && (
        <div className="bg-card rounded-xl border border-border p-6 flex items-center justify-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Building rename plan…</span>
        </div>
      )}

      {plan && !building && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-primary">{renamableCount}</span> to rename ·{' '}
              <span className="font-semibold">{unchangedCount}</span> already correct ·{' '}
              <span className="font-semibold text-muted-foreground">{skipCount}</span> skipped
              {applying && <> · <span className="text-foreground">{progress.done}/{renamableCount} processed</span></>}
            </p>
            {renamableCount > 0 && (
              <button
                onClick={() => setConfirmOpen(true)}
                disabled={applying}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60"
              >
                {applying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                Apply {renamableCount} rename{renamableCount !== 1 ? 's' : ''}
              </button>
            )}
          </div>
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/60 border-b border-border">
                  <th className="text-left px-3 py-2.5 font-semibold text-foreground">Shop</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-foreground hidden md:table-cell">Current filename</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-foreground">Proposed</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-foreground w-28">Status</th>
                </tr>
              </thead>
              <tbody>
                {plan.map((row) => (
                  <tr key={row.shopId} className="border-b border-border last:border-0">
                    <td className="px-3 py-2.5 truncate max-w-[180px]">{row.shopName}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground hidden md:table-cell truncate max-w-[220px]">{row.currentFilename}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-foreground truncate max-w-[220px]">{row.proposedFilename}</td>
                    <td className="px-3 py-2.5">
                      {row.status === 'ok' && <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">rename</span>}
                      {row.status === 'unchanged' && <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-success/10 text-success border border-success/30">{row.reason || 'ok'}</span>}
                      {row.status === 'skip' && <span title={row.reason} className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">skip</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <p className="text-xs text-muted-foreground mt-2">
        Renames files in the <code className="text-[11px] bg-muted px-1 py-0.5 rounded">shop-images</code> bucket so each filename matches the shop's name.
        Collisions are resolved with <code className="text-[11px] bg-muted px-1 py-0.5 rounded">-1</code>, <code className="text-[11px] bg-muted px-1 py-0.5 rounded">-2</code> suffixes. Each rename is reverted if the database update fails.
      </p>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-primary" />
              Rename {renamableCount} image{renamableCount !== 1 ? 's' : ''}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will move {renamableCount} file{renamableCount !== 1 ? 's' : ''} in storage and update the matching shop image URLs in the database.
              <br /><br />
              Each file is renamed individually. If a database update fails, that file is moved back to its original name automatically.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={applying}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={applyPlan} disabled={applying} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {applying ? <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Renaming…</> : `Apply ${renamableCount} rename${renamableCount !== 1 ? 's' : ''}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

/* ─── Storage Audit ─────────────────────────────────────────────── */
function StorageAuditSection() {
  const [scanned, setScanned] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [orphans, setOrphans] = useState<{ name: string; size: number; created_at: string }[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const runScan = async () => {
    setScanning(true);
    setScanned(false);
    setOrphans([]);
    setSelected(new Set());
    try {
      type StorageFile = { name: string; id: string; metadata?: { size?: number }; created_at?: string };
      let pagedFiles: StorageFile[] = [];
      let offset = 0;
      const PAGE = 1000;
      while (true) {
        const { data: page, error: listErr } = await listShopImages({ limit: PAGE, offset });
        if (listErr) throw listErr;
        const valid = (page || []).filter((f) => f.name && f.id) as StorageFile[];
        pagedFiles = pagedFiles.concat(valid);
        if (!page || page.length < PAGE) break;
        offset += PAGE;
      }
      if (pagedFiles.length === 0) { setOrphans([]); setScanned(true); setScanning(false); return; }

      const [{ data: shopImgs }, { data: reqImgs }] = await Promise.all([
        supabase.from('shops').select('image_url').not('image_url', 'is', null),
        supabase.from('shop_requests').select('image_url').not('image_url', 'is', null),
      ]);

      const referencedPaths = new Set<string>();
      [...(shopImgs || []), ...(reqImgs || [])].forEach((row: any) => {
        if (row.image_url) {
          const p = extractStoragePath(row.image_url);
          if (p) referencedPaths.add(p);
        }
      });

      const found = pagedFiles
        .filter((f) => !referencedPaths.has(f.name))
        .map((f) => ({ name: f.name, size: f.metadata?.size ?? 0, created_at: f.created_at ?? '' }));

      setOrphans(found);
      setScanned(true);
    } catch (err: any) {
      toast.error('Scan failed: ' + (err?.message || 'Unknown error'));
    }
    setScanning(false);
  };

  const toggleSelect = (name: string) => {
    setSelected((prev) => { const next = new Set(prev); if (next.has(name)) next.delete(name); else next.add(name); return next; });
  };
  const toggleSelectAll = () => {
    if (selected.size === orphans.length) setSelected(new Set());
    else setSelected(new Set(orphans.map((o) => o.name)));
  };
  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    setDeleting(true);
    const paths = Array.from(selected);
    const { error } = await removeShopImages(paths);
    if (error) {
      toast.error('Delete failed: ' + error);
    } else {
      toast.success(`Deleted ${paths.length} orphaned file${paths.length !== 1 ? 's' : ''}`);
      setOrphans((prev) => prev.filter((o) => !selected.has(o.name)));
      setSelected(new Set());
    }
    setDeleteConfirmOpen(false);
    setDeleting(false);
  };
  const formatBytes = (bytes: number) => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };
  const totalOrphanSize = orphans.reduce((acc, o) => acc + (o.size || 0), 0);

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <HardDrive className="w-4 h-4 text-primary" />
        <h3 className="font-bold text-foreground">Storage Audit</h3>
        {scanned && (
          <span className={`ml-1 inline-flex items-center justify-center min-w-[1.5rem] h-5 px-1.5 rounded-full text-[11px] font-bold ${
            orphans.length > 0 ? 'bg-destructive/15 text-destructive border border-destructive/30' : 'bg-primary/10 text-primary border border-primary/20'
          }`}>
            {orphans.length}
          </span>
        )}
        <button
          onClick={runScan}
          disabled={scanning}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60"
        >
          {scanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          {scanned ? 'Re-scan' : 'Scan Now'}
        </button>
      </div>

      {!scanned && !scanning && (
        <div className="bg-card rounded-xl border border-border p-6 text-center">
          <HardDrive className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="font-semibold text-sm text-foreground">Not scanned yet</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            Click <strong>Scan Now</strong> to list all files in the shop-images bucket and find any that are no longer referenced.
          </p>
        </div>
      )}
      {scanning && (
        <div className="bg-card rounded-xl border border-border p-6 flex items-center justify-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Scanning storage bucket…</span>
        </div>
      )}
      {scanned && !scanning && orphans.length === 0 && (
        <div className="bg-card rounded-xl border border-border p-6 text-center">
          <p className="text-2xl mb-2">✅</p>
          <p className="font-semibold text-sm text-foreground">No orphaned files</p>
          <p className="text-xs text-muted-foreground mt-1">All files in the bucket are referenced by an active shop or request.</p>
        </div>
      )}
      {scanned && !scanning && orphans.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-destructive">{orphans.length} orphaned file{orphans.length !== 1 ? 's' : ''}</span>
              {' '}· {formatBytes(totalOrphanSize)} total · not referenced by any shop or request
            </p>
            {selected.size > 0 && (
              <button
                onClick={() => setDeleteConfirmOpen(true)}
                disabled={deleting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-60"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete {selected.size} selected
              </button>
            )}
          </div>
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/60 border-b border-border">
                  <th className="px-3 py-2.5 w-10">
                    <input type="checkbox" checked={selected.size === orphans.length && orphans.length > 0} onChange={toggleSelectAll} className="h-3.5 w-3.5 rounded border-input cursor-pointer accent-primary" />
                  </th>
                  <th className="text-left px-3 py-2.5 font-semibold text-foreground">Filename</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-foreground w-24 hidden sm:table-cell">Size</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-foreground w-36 hidden md:table-cell">Uploaded</th>
                </tr>
              </thead>
              <tbody>
                {orphans.map((file) => (
                  <tr key={file.name} className={`border-b border-border last:border-0 transition-colors cursor-pointer ${selected.has(file.name) ? 'bg-destructive/5' : 'hover:bg-muted/30'}`} onClick={() => toggleSelect(file.name)}>
                    <td className="px-3 py-2.5">
                      <input type="checkbox" checked={selected.has(file.name)} onChange={() => toggleSelect(file.name)} onClick={(e) => e.stopPropagation()} className="h-3.5 w-3.5 rounded border-input cursor-pointer accent-primary" />
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <PackageX className="w-3.5 h-3.5 text-destructive shrink-0" />
                        <span className="font-mono text-xs text-foreground truncate max-w-[200px] sm:max-w-none">{file.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground text-xs hidden sm:table-cell">{formatBytes(file.size)}</td>
                    <td className="px-3 py-2.5 text-muted-foreground text-xs hidden md:table-cell">
                      {file.created_at ? new Date(file.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <p className="text-xs text-muted-foreground mt-2">
        Orphaned files are images uploaded to storage but no longer linked to any shop or request record. Safe to delete — this won't affect any live data.
      </p>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-destructive" />
              Delete {selected.size} orphaned file{selected.size !== 1 ? 's' : ''}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove {selected.size} file{selected.size !== 1 ? 's' : ''} ({formatBytes(Array.from(selected).reduce((acc, n) => acc + (orphans.find(o => o.name === n)?.size ?? 0), 0))}) from the storage bucket.
              <br /><br />
              <strong>This cannot be undone.</strong> Only do this if you are sure these files are not needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Deleting…</> : `Delete ${selected.size} file${selected.size !== 1 ? 's' : ''}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

/* ─── DataQualityTab ─────────────────────────────────────────── */
interface DataQualityTabProps {
  onEditShop: (shop: any) => void;
}

export function DataQualityTab({ onEditShop }: DataQualityTabProps) {
  const qc = useQueryClient();

  const { data: shops = [], isLoading } = useQuery({
    queryKey: ['admin-shops-quality'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shops')
        .select('*, shop_categories(categories(id, name, icon))')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const areaSummary = useMemo(() => {
    const map = new Map<string, number>();
    shops.forEach((s) => {
      const area = s.area?.trim();
      if (area) map.set(area, (map.get(area) || 0) + 1);
    });
    return Array.from(map.entries()).map(([area, count]) => ({ area, count })).sort((a, b) => b.count - a.count);
  }, [shops]);

  const similarAreaGroups = useMemo(() => {
    const map = new Map<string, string[]>();
    areaSummary.forEach(({ area }) => {
      const key = dqAreaCompareKey(area);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(area);
    });
    const result = new Map<string, string[]>();
    map.forEach((areas, key) => { if (areas.length > 1) result.set(key, areas); });
    return result;
  }, [areaSummary]);

  const bestCandidateMap = useMemo(() => {
    const countMap = new Map<string, number>(areaSummary.map(({ area, count }) => [area, count]));
    const result = new Map<string, string | null>();
    similarAreaGroups.forEach((areas) => {
      const sorted = [...areas].sort((a, b) =>
        (countMap.get(b) ?? 0) - (countMap.get(a) ?? 0) ||
        (dqHasDevanagari(b) ? 1 : 0) - (dqHasDevanagari(a) ? 1 : 0)
      );
      const best = sorted[0];
      areas.forEach((area) => { result.set(area, area === best ? null : best); });
    });
    return result;
  }, [similarAreaGroups, areaSummary]);

  const [areaRenameTarget, setAreaRenameTarget] = useState<string | null>(null);
  const [areaRenameValue, setAreaRenameValue] = useState('');
  const [areaRenaming, setAreaRenaming] = useState(false);

  const handleAreaRename = async (oldArea: string) => {
    if (!areaRenameValue.trim()) return;
    const newArea = dqNormalizeAreaValue(areaRenameValue);
    if (newArea === oldArea) { setAreaRenameTarget(null); setAreaRenameValue(''); return; }
    setAreaRenaming(true);
    const { error } = await supabase.from('shops').update({ area: newArea }).eq('area', oldArea);
    if (error) {
      toast.error('Rename failed: ' + error.message);
    } else {
      toast.success(`Area renamed: "${oldArea}" → "${newArea}"`);
      setAreaRenameTarget(null);
      setAreaRenameValue('');
      qc.invalidateQueries({ queryKey: ['admin-shops-quality'] });
    }
    setAreaRenaming(false);
  };

  const phoneDuplicateGroups = useMemo(() => {
    const map = new Map<string, any[]>();
    shops.forEach((s) => {
      if (!s.phone) return;
      let n = s.phone.replace(/[\s\-().+]/g, '');
      if (n.startsWith('91') && n.length === 12) n = n.slice(2);
      if (!map.has(n)) map.set(n, []);
      map.get(n)!.push(s);
    });
    return Array.from(map.values()).filter((g) => g.length > 1);
  }, [shops]);

  const nameAreaDuplicateGroups = useMemo(() => {
    const map = new Map<string, any[]>();
    shops.forEach((s) => {
      const nameKey = s.name?.toLowerCase().replace(/\s+/g, '').slice(0, 5) || '';
      const areaKey = (s.area || '').toLowerCase().trim();
      const key = `${nameKey}::${areaKey}`;
      if (!nameKey || !areaKey) return;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    });
    return Array.from(map.values()).filter((g) => g.length > 1);
  }, [shops]);

  const allDuplicateGroups = useMemo(() => {
    const seen = new Set<string>();
    const groups: any[][] = [];
    [...phoneDuplicateGroups, ...nameAreaDuplicateGroups].forEach((group) => {
      const key = group.map((s: any) => s.id).sort().join(',');
      if (!seen.has(key)) { seen.add(key); groups.push(group); }
    });
    return groups;
  }, [phoneDuplicateGroups, nameAreaDuplicateGroups]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => <div key={i} className="bg-card rounded-xl p-4 border border-border skeleton-shimmer h-16" />)}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-foreground mb-1">Data Quality</h2>
        <p className="text-sm text-muted-foreground">Review area consistency and spot potential duplicate shops. No automated changes — admin stays in control.</p>
      </div>

      {/* Area Consistency */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <MapPin className="w-4 h-4 text-primary" />
          <h3 className="font-bold text-foreground">Area Consistency</h3>
          <span className="ml-auto text-xs text-muted-foreground">{areaSummary.length} unique area{areaSummary.length !== 1 ? 's' : ''}</span>
        </div>

        {areaSummary.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-6 text-center text-muted-foreground text-sm">No area data found.</div>
        ) : (
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/60 border-b border-border">
                  <th className="text-left px-4 py-3 font-semibold text-foreground">Area Name</th>
                  <th className="text-left px-4 py-3 font-semibold text-foreground w-20">Shops</th>
                  <th className="text-right px-4 py-3 font-semibold text-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {areaSummary.map(({ area, count }) => {
                  const suspicious = dqIsSuspiciousArea(area);
                  const isEditing = areaRenameTarget === area;
                  const similarKey = dqAreaCompareKey(area);
                  const similarGroup = similarAreaGroups.get(similarKey);
                  const similarPeers = similarGroup ? similarGroup.filter((a) => a !== area) : [];
                  const hasSimilar = similarPeers.length > 0;
                  const bestCandidate = bestCandidateMap.get(area) ?? null;
                  const isNotBest = hasSimilar && bestCandidate !== null;
                  return (
                    <tr key={area} className={`border-b border-border last:border-0 hover:bg-muted/30 transition-colors ${hasSimilar ? 'bg-destructive/5' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-foreground">{area}</span>
                          {suspicious && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-secondary/15 text-secondary border border-secondary/30">
                              <TriangleAlert className="w-2.5 h-2.5" /> suspicious
                            </span>
                          )}
                        </div>
                        {hasSimilar && (
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/25">
                              <TriangleAlert className="w-2.5 h-2.5" />
                              similar: {similarPeers.map((p) => (
                                <span key={p} title={p}>{`"${p.length > 45 ? p.slice(0, 43) + '…' : p}"`}</span>
                              ))}
                            </span>
                          </div>
                        )}
                        {isEditing && (
                          <div className="flex items-center gap-2 mt-2">
                            <input
                              type="text"
                              value={areaRenameValue}
                              onChange={(e) => setAreaRenameValue(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') handleAreaRename(area); if (e.key === 'Escape') setAreaRenameTarget(null); }}
                              placeholder="New area name…"
                              autoFocus
                              className="flex-1 h-8 rounded-md border border-input bg-background px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                            />
                            <button onClick={() => handleAreaRename(area)} disabled={areaRenaming || !areaRenameValue.trim()} className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50 hover:bg-primary/90">
                              {areaRenaming ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save'}
                            </button>
                            <button onClick={() => { setAreaRenameTarget(null); setAreaRenameValue(''); }} className="h-8 px-2 rounded-md border border-border text-xs hover:bg-muted">
                              Cancel
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center justify-center min-w-[1.75rem] px-2 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary">{count}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {!isEditing && (
                          <div className="flex items-center justify-end gap-1.5">
                            {isNotBest && (
                              <button
                                onClick={() => { setAreaRenameTarget(area); setAreaRenameValue(bestCandidate!); }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-destructive hover:bg-destructive/10 transition-colors border border-destructive/25"
                                title={`Merge into "${bestCandidate}"`}
                              >
                                <ArrowRight className="w-3 h-3" /> Merge
                              </button>
                            )}
                            <button
                              onClick={() => { setAreaRenameTarget(area); setAreaRenameValue(area); }}
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
          Renaming an area updates all shops in that locality at once.{' '}
          <span className="inline-flex items-center gap-1 ml-1 text-secondary font-medium"><TriangleAlert className="w-3 h-3" /> suspicious</span> flags very short, all-caps, or numeric-only names.{' '}
          <span className="inline-flex items-center gap-1 ml-1 text-destructive font-medium"><TriangleAlert className="w-3 h-3" /> similar</span> detects near-duplicate names — click <strong>Merge</strong> to consolidate.
        </p>
      </section>

      {/* Possible Duplicates */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-4 h-4 text-primary" />
          <h3 className="font-bold text-foreground">Possible Duplicate Shops</h3>
          {allDuplicateGroups.length > 0 && (
            <span className="ml-1 inline-flex items-center justify-center min-w-[1.5rem] h-5 px-1.5 rounded-full text-[11px] font-bold bg-secondary/15 text-secondary border border-secondary/30">
              {allDuplicateGroups.length}
            </span>
          )}
          <button onClick={() => qc.invalidateQueries({ queryKey: ['admin-shops-quality'] })} className="ml-auto p-1 text-muted-foreground hover:text-foreground rounded transition-colors" title="Refresh">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {allDuplicateGroups.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-6 text-center">
            <p className="text-2xl mb-2">✅</p>
            <p className="font-semibold text-sm text-foreground">No duplicates detected</p>
            <p className="text-xs text-muted-foreground mt-1">No shops share the same phone number or have a very similar name in the same area.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {allDuplicateGroups.map((group, gi) => (
              <div key={gi} className="bg-card rounded-xl border border-secondary/30 overflow-hidden">
                <div className="px-4 py-2 bg-secondary/8 border-b border-secondary/20 flex items-center gap-2">
                  <TriangleAlert className="w-3.5 h-3.5 text-secondary shrink-0" />
                  <span className="text-xs font-semibold text-secondary">Possible duplicate group · {group.length} shops</span>
                </div>
                <div className="divide-y divide-border">
                  {group.map((shop: any) => {
                    const cats = (shop.shop_categories || []).map((sc: any) => sc.categories).filter(Boolean);
                    return (
                      <div key={shop.id} className="px-4 py-3 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm text-foreground truncate">{shop.name}</span>
                            {!shop.is_active && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">Inactive</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 flex-wrap text-xs text-muted-foreground">
                            {shop.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{shop.phone}</span>}
                            {shop.area && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{shop.area}</span>}
                            {cats.length > 0 && <span>{cats.map((c: any) => `${c.icon} ${c.name}`).join(', ')}</span>}
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
        <p className="text-xs text-muted-foreground mt-2">
          Duplicates are flagged by matching normalized phone number, or very similar name + same area. No shops are automatically changed — use Edit to resolve manually.
        </p>
      </section>

      {/* Image Rename */}
      <ImageRenameSection />

      {/* Storage Audit */}
      <StorageAuditSection />
    </div>
  );
}
