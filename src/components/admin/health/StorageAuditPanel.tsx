import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FileImage,
  HardDrive,
  ImageOff,
  Loader2,
  PackageX,
  Pencil,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  Trash2,
  Wand2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  applyRenamePlanRow,
  buildSafeRenamePlan,
  clearBrokenMediaReference,
  probeUnifiedBrokenMedia,
  purgeResolvedClaimProofs,
  runRecursiveStorageAudit,
  type BrokenMediaItem,
  type BrokenMediaScanResult,
  type RenamePlanRow,
  type StorageAuditReport,
  type StorageFolderGroup,
} from '@/lib/admin/storageHealthService';
import { removeShopImages } from '@/lib/storageNaming';

interface StorageAuditPanelProps {
  cityFilter: string;
  defaultCityId?: string | null;
  cityNameMap: Map<string, string>;
  onEditShop: (shop: any) => void;
  onEditSchool?: (school: any) => void;
  shops: any[];
  schools: any[];
  onAuditChanged?: (orphanCount: number, brokenCount: number) => void;
}

function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function StorageAuditPanel({
  cityFilter,
  defaultCityId,
  cityNameMap,
  onEditShop,
  onEditSchool,
  shops,
  schools,
  onAuditChanged,
}: StorageAuditPanelProps) {
  const qc = useQueryClient();

  // ── 1. Recursive Storage & Claim PII Audit state
  const [retentionDays, setRetentionDays] = useState<number>(90);
  const [scanningAudit, setScanningAudit] = useState(false);
  const [auditReport, setAuditReport] = useState<StorageAuditReport | null>(null);
  const [folderTab, setFolderTab] = useState<'all' | StorageFolderGroup>('all');
  const [selectedOrphans, setSelectedOrphans] = useState<Set<string>>(new Set());
  const [deletingOrphans, setDeletingOrphans] = useState(false);
  const [deleteOrphansOpen, setDeleteOrphansOpen] = useState(false);

  const [selectedClaims, setSelectedClaims] = useState<Set<string>>(new Set());
  const [purgingClaims, setPurgingClaims] = useState(false);
  const [purgeClaimsOpen, setPurgeClaimsOpen] = useState(false);

  // ── 2. Unified Broken Media Probe state
  const [probingMedia, setProbingMedia] = useState(false);
  const [probeGallery, setProbeGallery] = useState(true);
  const [probeProgress, setProbeProgress] = useState({ done: 0, total: 0 });
  const [brokenResult, setBrokenResult] = useState<BrokenMediaScanResult | null>(null);
  const [clearingBrokenKey, setClearingBrokenKey] = useState<string | null>(null);

  // ── 3. Safe Slug Rename state
  const [buildingRename, setBuildingRename] = useState(false);
  const [includeGalleryRename, setIncludeGalleryRename] = useState(false);
  const [renamePlan, setRenamePlan] = useState<RenamePlanRow[] | null>(null);
  const [applyingRename, setApplyingRename] = useState(false);
  const [renameProgress, setRenameProgress] = useState({ done: 0, ok: 0, failed: 0 });
  const [renameConfirmOpen, setRenameConfirmOpen] = useState(false);

  const handleRunAudit = async (daysOverride?: number) => {
    const days = daysOverride ?? retentionDays;
    setScanningAudit(true);
    setSelectedOrphans(new Set());
    setSelectedClaims(new Set());
    try {
      const report = await runRecursiveStorageAudit({ claimRetentionDays: days });
      setAuditReport(report);
      onAuditChanged?.(report.orphans.length, brokenResult?.brokenItems.length ?? 0);
      if (report.storageError) {
        toast.error('Storage error: ' + report.storageError);
      }
    } catch (err: any) {
      toast.error('Storage scan failed: ' + (err?.message || 'Unknown error'));
    } finally {
      setScanningAudit(false);
    }
  };

  const visibleOrphans = useMemo(() => {
    if (!auditReport) return [];
    if (folderTab === 'all') return auditReport.orphans;
    return auditReport.orphans.filter((o) => o.folderGroup === folderTab);
  }, [auditReport, folderTab]);

  const toggleOrphan = (path: string) => {
    setSelectedOrphans((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const toggleAllVisibleOrphans = () => {
    if (visibleOrphans.length === 0) return;
    const allSelected = visibleOrphans.every((o) => selectedOrphans.has(o.path));
    setSelectedOrphans((prev) => {
      const next = new Set(prev);
      if (allSelected) visibleOrphans.forEach((o) => next.delete(o.path));
      else visibleOrphans.forEach((o) => next.add(o.path));
      return next;
    });
  };

  const handleDeleteSelectedOrphans = async () => {
    const paths = Array.from(selectedOrphans);
    if (!paths.length) return;
    setDeletingOrphans(true);
    try {
      const { error } = await removeShopImages(paths);
      if (error) {
        toast.error('Delete failed: ' + error);
      } else {
        toast.success(`Deleted ${paths.length} orphaned file${paths.length !== 1 ? 's' : ''}`);
        setAuditReport((prev) => {
          if (!prev) return prev;
          const remaining = prev.orphans.filter((o) => !selectedOrphans.has(o.path));
          onAuditChanged?.(remaining.length, brokenResult?.brokenItems.length ?? 0);
          return { ...prev, orphans: remaining };
        });
        setSelectedOrphans(new Set());
      }
    } finally {
      setDeletingOrphans(false);
      setDeleteOrphansOpen(false);
    }
  };

  const handlePurgeClaims = async () => {
    if (!auditReport) return;
    const targets = auditReport.expiredClaimProofs.filter((c) =>
      selectedClaims.has(`${c.source}:${c.id}`),
    );
    if (!targets.length) return;
    setPurgingClaims(true);
    try {
      const res = await purgeResolvedClaimProofs(targets);
      toast.success(
        `Purged ${res.purged} expired claim proof${res.purged !== 1 ? 's' : ''}${
          res.failed ? ` (${res.failed} failed)` : ''
        }`,
      );
      await handleRunAudit();
    } finally {
      setPurgingClaims(false);
      setPurgeClaimsOpen(false);
    }
  };

  const handleProbeBrokenMedia = async () => {
    setProbingMedia(true);
    setProbeProgress({ done: 0, total: 0 });
    try {
      const res = await probeUnifiedBrokenMedia({
        cityId: cityFilter,
        defaultCityId,
        includeGallery: probeGallery,
        onProgress: (done, total) => setProbeProgress({ done, total }),
      });
      setBrokenResult(res);
      onAuditChanged?.(auditReport?.orphans.length ?? 0, res.brokenItems.length);
      if (res.brokenItems.length === 0) {
        toast.success(`All ${res.probedCount} media references loaded cleanly`);
      } else {
        toast.warning(
          `Found ${res.brokenItems.length} broken media link${res.brokenItems.length !== 1 ? 's' : ''}`,
        );
      }
      qc.invalidateQueries({ queryKey: ['admin-shops'] });
      qc.invalidateQueries({ queryKey: ['admin-shops-quality'] });
    } catch (err: any) {
      toast.error('Media probe failed: ' + (err?.message || 'Unknown error'));
    } finally {
      setProbingMedia(false);
    }
  };

  const handleClearBrokenItem = async (item: BrokenMediaItem) => {
    setClearingBrokenKey(item.key);
    try {
      await clearBrokenMediaReference(item);
      setBrokenResult((prev) => {
        if (!prev) return prev;
        const remaining = prev.brokenItems.filter((b) => b.key !== item.key);
        onAuditChanged?.(auditReport?.orphans.length ?? 0, remaining.length);
        return { ...prev, brokenItems: remaining };
      });
      qc.invalidateQueries({ queryKey: ['admin-shops-quality'] });
      qc.invalidateQueries({ queryKey: ['admin-schools-quality'] });
      qc.invalidateQueries({ queryKey: ['admin-shops'] });
      qc.invalidateQueries({ queryKey: ['admin-schools'] });
      qc.invalidateQueries({ queryKey: ['banners'] });
      toast.success(`Cleared broken image link from ${item.entityName}`);
    } catch (err: any) {
      toast.error('Failed to clear link: ' + (err?.message || 'Unknown error'));
    } finally {
      setClearingBrokenKey(null);
    }
  };

  const handleEditBrokenItem = (item: BrokenMediaItem) => {
    if (item.entityType === 'shop') {
      const row = shops.find((s) => s.id === item.entityId);
      if (row) onEditShop(row);
      else toast.error('Open Shops tab to edit this listing');
    } else if (item.entityType === 'school') {
      const row = schools.find((s) => s.id === item.entityId);
      if (row && onEditSchool) onEditSchool(row);
      else toast.error('Open Education & Institutes tab to edit this institute');
    } else {
      toast.info('Edit this banner/menu in Marketing -> Advertisements or Mess Owner hub.');
    }
  };

  const handleBuildRenamePlan = async () => {
    setBuildingRename(true);
    setRenamePlan(null);
    setRenameProgress({ done: 0, ok: 0, failed: 0 });
    try {
      const rows = await buildSafeRenamePlan({
        cityId: cityFilter,
        defaultCityId,
        cityNameMap,
        includeGallery: includeGalleryRename,
        verifyBeforeMove: true,
      });
      setRenamePlan(rows);
    } catch (err: any) {
      toast.error('Rename plan failed: ' + (err?.message || 'Unknown error'));
    } finally {
      setBuildingRename(false);
    }
  };

  const handleApplyRenamePlan = async () => {
    if (!renamePlan) return;
    const renamable = renamePlan.filter((r) => r.status === 'ok');
    if (renamable.length === 0) {
      setRenameConfirmOpen(false);
      return;
    }
    setApplyingRename(true);
    setRenameConfirmOpen(false);
    let ok = 0;
    let failed = 0;
    let done = 0;
    const updated = [...renamePlan];

    for (let i = 0; i < updated.length; i++) {
      const row = updated[i];
      if (row.status !== 'ok') continue;
      try {
        await applyRenamePlanRow(row);
        ok++;
        updated[i] = {
          ...row,
          status: 'unchanged',
          currentFilename: row.proposedFilename,
          currentPath: row.proposedFilename,
          reason: 'Renamed ✓',
        };
      } catch (err: any) {
        failed++;
        updated[i] = {
          ...row,
          status: 'skip',
          reason: 'Failed: ' + (err?.message || 'unknown'),
        };
      }
      done++;
      setRenameProgress({ done, ok, failed });
      setRenamePlan([...updated]);
    }

    qc.invalidateQueries({ queryKey: ['shops'] });
    qc.invalidateQueries({ queryKey: ['admin-shops'] });
    qc.invalidateQueries({ queryKey: ['admin-shops-quality'] });
    toast.success(`Renamed ${ok} file${ok !== 1 ? 's' : ''}${failed ? ` · ${failed} failed` : ''}`);
    setApplyingRename(false);
  };

  const renamableCount = renamePlan?.filter((r) => r.status === 'ok').length ?? 0;
  const totalOrphanBytes = auditReport?.orphans.reduce((s, o) => s + (o.size || 0), 0) ?? 0;

  return (
    <div className="space-y-8">
      {/* 1. Recursive Storage Bucket Audit */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-foreground flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-primary" />
              Recursive Storage Bucket Audit (`shop-images`)
              {auditReport && (
                <span
                  className={`inline-flex items-center justify-center min-w-[1.5rem] h-5 px-1.5 rounded-full text-[11px] font-bold ${
                    auditReport.orphans.length > 0
                      ? 'bg-destructive/15 text-destructive border border-destructive/30'
                      : 'bg-success/15 text-success border border-success/30'
                  }`}
                >
                  {auditReport.orphans.length} orphans
                </span>
              )}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Walks root + <code className="bg-muted px-1 rounded">banners/</code>, <code className="bg-muted px-1 rounded">menus/</code>, <code className="bg-muted px-1 rounded">claims/</code> and cross-checks 8 database tables (`shops.photos[]`, `schools.photos[]`, `banners`, `mess_daily_menus`, `shop_claims`, `school_claims`, `shop_requests`, `local_news`).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={retentionDays}
              onChange={(e) => {
                const d = Number(e.target.value);
                setRetentionDays(d);
                if (auditReport) void handleRunAudit(d);
              }}
              aria-label="Claim proof retention window"
              className="h-8 rounded-lg border border-input bg-background px-2 text-xs font-medium"
            >
              <option value={30}>Claim PII &gt; 30d</option>
              <option value={90}>Claim PII &gt; 90d (Default)</option>
              <option value={180}>Claim PII &gt; 180d</option>
            </select>
            <button
              onClick={() => void handleRunAudit()}
              disabled={scanningAudit}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {scanningAudit ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              {auditReport ? 'Re-scan Bucket' : 'Scan Bucket'}
            </button>
          </div>
        </div>

        {!auditReport && !scanningAudit && (
          <div className="bg-card rounded-xl border border-border p-6 text-center">
            <HardDrive className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="font-semibold text-sm text-foreground">Ready for safe multi-table audit</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
              Unlike single-level scans, this recursively indexes every subfolder and gallery slot before flagging any file as orphaned.
            </p>
          </div>
        )}

        {scanningAudit && (
          <div className="bg-card rounded-xl border border-border p-6 flex items-center justify-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Scanning storage prefixes &amp; cross-checking 8 DB tables…</span>
          </div>
        )}

        {auditReport && !scanningAudit && (
          <div className="space-y-4">
            {auditReport.rootOnlyFoldersWarning && (
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 flex items-start gap-2.5 text-xs">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-foreground">Root files hidden by Supabase RLS:</span>{' '}
                  Subfolders returned objects, but 0 root-level files were visible to `.list(&quot;&quot;)`. Apply the SQL fix in the <strong>System Health</strong> tab (<code className="bg-muted px-1 rounded">IS DISTINCT FROM &#39;claims&#39;</code>) to enumerate root shop photos accurately.
                </div>
              </div>
            )}

            {/* Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="rounded-lg border border-border bg-card p-3">
                <p className="text-[11px] text-muted-foreground">Objects Listed</p>
                <p className="text-base font-bold text-foreground tabular-nums">{auditReport.totalObjects}</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-3">
                <p className="text-[11px] text-muted-foreground">Bucket Size</p>
                <p className="text-base font-bold text-foreground tabular-nums">{formatBytes(auditReport.totalBytes)}</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-3">
                <p className="text-[11px] text-muted-foreground">Referenced DB Paths</p>
                <p className="text-base font-bold text-primary tabular-nums">{auditReport.referencedPathCount}</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-3">
                <p className="text-[11px] text-muted-foreground">Reclaimable Orphans</p>
                <p className={`text-base font-bold tabular-nums ${auditReport.orphans.length > 0 ? 'text-destructive' : 'text-success'}`}>
                  {auditReport.orphans.length} ({formatBytes(totalOrphanBytes)})
                </p>
              </div>
            </div>

            {/* Folder tabs */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    ['all', 'All', auditReport.orphans.length],
                    ['root', 'Root', auditReport.folderCounts.root.orphans],
                    ['banners', 'Banners', auditReport.folderCounts.banners.orphans],
                    ['menus', 'Menus', auditReport.folderCounts.menus.orphans],
                    ['claims', 'Claims', auditReport.folderCounts.claims.orphans],
                    ['other', 'Other', auditReport.folderCounts.other.orphans],
                  ] as const
                ).map(([key, label, count]) => (
                  <button
                    key={key}
                    onClick={() => setFolderTab(key)}
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${
                      folderTab === key
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-card text-muted-foreground border-border hover:bg-muted'
                    }`}
                  >
                    {label} ({count})
                  </button>
                ))}
              </div>

              {selectedOrphans.size > 0 && (
                <button
                  onClick={() => setDeleteOrphansOpen(true)}
                  disabled={deletingOrphans}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-60"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete {selectedOrphans.size} selected
                </button>
              )}
            </div>

            {visibleOrphans.length === 0 ? (
              <div className="bg-card rounded-xl border border-border p-5 text-center text-xs text-muted-foreground">
                <CheckCircle2 className="w-6 h-6 text-success mx-auto mb-1.5" />
                No orphaned objects in this folder filter.
              </div>
            ) : (
              <div className="bg-card rounded-xl border border-border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/60 border-b border-border">
                      <th className="px-3 py-2.5 w-10">
                        <input
                          type="checkbox"
                          checked={visibleOrphans.length > 0 && visibleOrphans.every((o) => selectedOrphans.has(o.path))}
                          onChange={toggleAllVisibleOrphans}
                          className="h-3.5 w-3.5 rounded border-input cursor-pointer accent-primary"
                        />
                      </th>
                      <th className="text-left px-3 py-2.5 font-semibold text-foreground">Preview &amp; Path</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-foreground w-24 hidden sm:table-cell">Folder</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-foreground w-24 hidden sm:table-cell">Size</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-foreground w-32 hidden md:table-cell">Uploaded</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleOrphans.map((file) => (
                      <tr
                        key={file.path}
                        onClick={() => toggleOrphan(file.path)}
                        className={`border-b border-border last:border-0 transition-colors cursor-pointer ${
                          selectedOrphans.has(file.path) ? 'bg-destructive/5' : 'hover:bg-muted/30'
                        }`}
                      >
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={selectedOrphans.has(file.path)}
                            onChange={() => toggleOrphan(file.path)}
                            onClick={(e) => e.stopPropagation()}
                            className="h-3.5 w-3.5 rounded border-input cursor-pointer accent-primary"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            {file.publicUrl ? (
                              <img
                                src={file.publicUrl}
                                alt={file.name}
                                className="w-8 h-8 rounded object-cover border border-border shrink-0 bg-muted"
                                loading="lazy"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded border border-border bg-muted flex items-center justify-center shrink-0">
                                <PackageX className="w-4 h-4 text-destructive" />
                              </div>
                            )}
                            <span className="font-mono text-xs text-foreground truncate max-w-[200px] sm:max-w-[360px]">
                              {file.path}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground hidden sm:table-cell">{file.folder}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground hidden sm:table-cell">{formatBytes(file.size)}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground hidden md:table-cell">
                          {file.created_at
                            ? new Date(file.created_at).toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Claim Proof Retention PII section */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="font-bold text-sm text-foreground flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-primary" />
                    Resolved Claim Proofs Older Than {retentionDays} Days ({auditReport.expiredClaimProofs.length})
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    Keeps audit status &amp; admin notes intact while letting you purge old Aadhaar/GST verification photos from private storage.
                  </p>
                </div>
                {selectedClaims.size > 0 && (
                  <button
                    onClick={() => setPurgeClaimsOpen(true)}
                    disabled={purgingClaims}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Purge {selectedClaims.size} proof{selectedClaims.size !== 1 ? 's' : ''}
                  </button>
                )}
              </div>

              {auditReport.expiredClaimProofs.length === 0 ? (
                <p className="text-xs text-muted-foreground">No resolved claim proofs exceed the {retentionDays}-day threshold.</p>
              ) : (
                <div className="divide-y divide-border text-xs">
                  {auditReport.expiredClaimProofs.map((c) => {
                    const key = `${c.source}:${c.id}`;
                    const checked = selectedClaims.has(key);
                    return (
                      <label
                        key={key}
                        className="py-2 flex items-center justify-between gap-3 cursor-pointer hover:bg-muted/20 px-2 rounded"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setSelectedClaims((prev) => {
                                const next = new Set(prev);
                                if (next.has(key)) next.delete(key);
                                else next.add(key);
                                return next;
                              })
                            }
                            className="h-3.5 w-3.5 rounded accent-primary"
                          />
                          <div className="min-w-0">
                            <span className="font-semibold text-foreground">
                              {c.source === 'school_claims' ? 'School Claim' : 'Shop Claim'}
                            </span>{' '}
                            <span
                              className={`px-1.5 py-0.2 rounded text-[10px] font-semibold ${
                                c.status === 'approved'
                                  ? 'bg-success/15 text-success'
                                  : 'bg-destructive/15 text-destructive'
                              }`}
                            >
                              {c.status}
                            </span>
                            <div className="font-mono text-[11px] text-muted-foreground truncate">
                              {c.proof_image_path}
                            </div>
                          </div>
                        </div>
                        <span className="text-muted-foreground shrink-0 tabular-nums">
                          {c.ageDays}d old · {formatBytes(c.sizeBytes)}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* 2. Unified Broken Media Probe */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-foreground flex items-center gap-2">
              <ImageOff className="w-4 h-4 text-primary" />
              Unified Broken Media Probe
              {brokenResult && (
                <span
                  className={`inline-flex items-center justify-center min-w-[1.5rem] h-5 px-1.5 rounded-full text-[11px] font-bold ${
                    brokenResult.brokenItems.length > 0
                      ? 'bg-destructive/15 text-destructive border border-destructive/30'
                      : 'bg-success/15 text-success border border-success/30'
                  }`}
                >
                  {brokenResult.brokenItems.length} broken
                </span>
              )}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Tests live HTTP + browser image decoding across Shops, Institutes, Ad Banners, and Mess Menu cards.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={probeGallery}
                onChange={(e) => setProbeGallery(e.target.checked)}
                className="h-3.5 w-3.5 rounded accent-primary"
              />
              Include gallery photos[]
            </label>
            <button
              onClick={handleProbeBrokenMedia}
              disabled={probingMedia}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {probingMedia ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ScanLine className="w-3.5 h-3.5" />}
              {probingMedia
                ? `Probing ${probeProgress.done}/${probeProgress.total || '…'}`
                : 'Probe Media URLs'}
            </button>
          </div>
        </div>

        {brokenResult?.schemaColsMissing && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
            Note: `image_broken_at` column is not in the live DB yet — results shown here won&apos;t persist to quick-filters until you run the SQL patch in System Health.
          </div>
        )}

        {brokenResult && brokenResult.brokenItems.length === 0 && (
          <div className="bg-card rounded-xl border border-border p-5 text-center text-xs text-muted-foreground">
            <CheckCircle2 className="w-6 h-6 text-success mx-auto mb-1.5" />
            Probed {brokenResult.probedCount} media slots ({brokenResult.uniqueUrlsChecked} unique URLs) — zero broken images!
          </div>
        )}

        {brokenResult && brokenResult.brokenItems.length > 0 && (
          <div className="bg-card rounded-xl border border-border divide-y divide-border">
            {brokenResult.brokenItems.map((item) => (
              <div key={item.key} className="p-3 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-destructive/10 text-destructive border border-destructive/20">
                      {item.entityType}
                    </span>
                    <span className="text-sm font-semibold text-foreground">{item.entityName}</span>
                    {item.fallbackReplacementUrl && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                        has fallback photo
                      </span>
                    )}
                  </div>
                  <p className="font-mono text-[11px] text-muted-foreground truncate max-w-xl mt-0.5">
                    {item.url}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground"
                    title="Open URL"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  {(item.entityType === 'shop' || item.entityType === 'school') && (
                    <button
                      onClick={() => handleEditBrokenItem(item)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-primary/25 text-primary hover:bg-primary/10"
                    >
                      <Pencil className="w-3 h-3" /> Edit
                    </button>
                  )}
                  <button
                    onClick={() => handleClearBrokenItem(item)}
                    disabled={clearingBrokenKey === item.key}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-destructive/30 text-destructive hover:bg-destructive/10 disabled:opacity-50"
                  >
                    {clearingBrokenKey === item.key ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Trash2 className="w-3 h-3" />
                    )}
                    Clear Link
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 3. Safe Slug Image Rename */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-foreground flex items-center gap-2">
              <FileImage className="w-4 h-4 text-primary" />
              Rename Shop Images (Slug Sync)
              {renamePlan && (
                <span className="inline-flex items-center justify-center min-w-[1.5rem] h-5 px-1.5 rounded-full text-[11px] font-bold bg-primary/10 text-primary border border-primary/20">
                  {renamableCount}
                </span>
              )}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Renames bucket files to Devanagari-transliterated slugs and updates both <code className="bg-muted px-1 rounded">image_url</code> and <code className="bg-muted px-1 rounded">photos[0]</code> atomically.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={includeGalleryRename}
                onChange={(e) => setIncludeGalleryRename(e.target.checked)}
                className="h-3.5 w-3.5 rounded accent-primary"
              />
              Include gallery slots
            </label>
            <button
              onClick={handleBuildRenamePlan}
              disabled={buildingRename || applyingRename}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {buildingRename ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
              {renamePlan ? 'Re-plan' : 'Plan Rename'}
            </button>
          </div>
        </div>

        {renamePlan && !buildingRename && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold text-primary">{renamableCount}</span> to rename ·{' '}
                <span className="font-semibold">{renamePlan.filter((r) => r.status === 'unchanged').length}</span> already clean ·{' '}
                <span className="font-semibold">{renamePlan.filter((r) => r.status === 'skip').length}</span> skipped
                {applyingRename && <> · {renameProgress.done}/{renamableCount} processed</>}
              </p>
              {renamableCount > 0 && (
                <button
                  onClick={() => setRenameConfirmOpen(true)}
                  disabled={applyingRename}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                >
                  {applyingRename ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                  Apply {renamableCount} rename{renamableCount !== 1 ? 's' : ''}
                </button>
              )}
            </div>

            <div className="bg-card rounded-xl border border-border overflow-x-auto max-h-[380px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/60 border-b border-border sticky top-0">
                    <th className="text-left px-3 py-2 font-semibold text-foreground">Shop</th>
                    <th className="text-left px-3 py-2 font-semibold text-foreground hidden sm:table-cell">Town</th>
                    <th className="text-left px-3 py-2 font-semibold text-foreground hidden md:table-cell">Current</th>
                    <th className="text-left px-3 py-2 font-semibold text-foreground">Proposed</th>
                    <th className="text-left px-3 py-2 font-semibold text-foreground w-24">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {renamePlan.map((row) => (
                    <tr key={row.key} className="border-b border-border last:border-0">
                      <td className="px-3 py-2 truncate max-w-[180px] font-medium">{row.shopName}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground hidden sm:table-cell">{row.cityName}</td>
                      <td className="px-3 py-2 font-mono text-xs text-muted-foreground hidden md:table-cell truncate max-w-[200px]">
                        {row.currentFilename}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-foreground truncate max-w-[200px]">
                        {row.proposedFilename}
                      </td>
                      <td className="px-3 py-2">
                        {row.status === 'ok' && (
                          <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                            rename
                          </span>
                        )}
                        {row.status === 'unchanged' && (
                          <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-success/10 text-success border border-success/30">
                            {row.reason || 'ok'}
                          </span>
                        )}
                        {row.status === 'skip' && (
                          <span
                            title={row.reason}
                            className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground border border-border cursor-help"
                          >
                            skip
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Dialogs */}
      <AlertDialog open={deleteOrphansOpen} onOpenChange={setDeleteOrphansOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedOrphans.size} orphaned storage object(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes {selectedOrphans.size} file(s) from the <code className="bg-muted px-1 rounded">shop-images</code> bucket. These paths were verified absent from all 8 directory tables.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingOrphans}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSelectedOrphans}
              disabled={deletingOrphans}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingOrphans ? 'Deleting…' : 'Delete Files'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={purgeClaimsOpen} onOpenChange={setPurgeClaimsOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Purge {selectedClaims.size} expired claim proof(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              Removes the private proof document image(s) from <code className="bg-muted px-1 rounded">claims/</code> and clears <code className="bg-muted px-1 rounded">proof_image_path</code> while preserving claim approval records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={purgingClaims}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handlePurgeClaims}
              disabled={purgingClaims}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {purgingClaims ? 'Purging…' : 'Purge Proofs'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={renameConfirmOpen} onOpenChange={setRenameConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rename {renamableCount} image file(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              Moves each file in <code className="bg-muted px-1 rounded">shop-images</code> and updates both <code className="bg-muted px-1 rounded">image_url</code> and <code className="bg-muted px-1 rounded">photos</code> together. Moves roll back automatically if any DB update fails.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={applyingRename}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleApplyRenamePlan} disabled={applyingRename}>
              {applyingRename ? 'Renaming…' : `Apply ${renamableCount} Rename(s)`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
