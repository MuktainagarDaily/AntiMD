import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Database,
  HardDrive,
  Loader2,
  RefreshCw,
  Server,
  ShieldAlert,
  Sparkles,
  Trash2,
  Wifi,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  clearAppHealthCache,
  refreshCategoryCountsMv,
  runSystemDiagnostics,
  type SystemDiagnosticsReport,
} from '@/lib/admin/storageHealthService';

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

const MIGRATION_SQL_SNIPPET = `-- Run in Supabase Dashboard → SQL Editor
-- Also saved in: supabase/migrations/20261113000000_storage_and_health_fixes.sql

BEGIN;

DROP POLICY IF EXISTS "Shop images are publicly viewable" ON storage.objects;
CREATE POLICY "Shop images are publicly viewable"
  ON storage.objects FOR SELECT TO public
  USING (
    bucket_id = 'shop-images'
    AND ((storage.foldername(name))[1] IS DISTINCT FROM 'claims')
  );

DROP POLICY IF EXISTS "Admins manage all shop-images" ON storage.objects;
CREATE POLICY "Admins manage all shop-images"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'shop-images' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'shop-images' AND public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS image_checked_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS image_broken_at  timestamptz NULL;
CREATE INDEX IF NOT EXISTS idx_shops_image_broken_at
  ON public.shops (image_broken_at) WHERE image_broken_at IS NOT NULL;

ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS image_checked_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS image_broken_at  timestamptz NULL;

ALTER TABLE public.banners
  ADD COLUMN IF NOT EXISTS image_checked_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS image_broken_at  timestamptz NULL;

COMMIT;`;

export function SystemDiagnosticsPanel() {
  const qc = useQueryClient();
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<SystemDiagnosticsReport | null>(null);
  const [refreshingMv, setRefreshingMv] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);
  const [sqlModalOpen, setSqlModalOpen] = useState(false);

  const runChecks = async () => {
    setRunning(true);
    try {
      const next = await runSystemDiagnostics();
      setReport(next);
    } catch (err: any) {
      toast.error('Diagnostics failed: ' + (err?.message || 'Unknown error'));
    } finally {
      setRunning(false);
    }
  };

  useEffect(() => {
    void runChecks();
  }, []);

  const handleRefreshMv = async () => {
    setRefreshingMv(true);
    try {
      await refreshCategoryCountsMv();
      toast.success('Category shop counts materialized view refreshed');
      await runChecks();
    } catch (err: any) {
      toast.error('Refresh failed: ' + (err?.message || 'Unknown error'));
    } finally {
      setRefreshingMv(false);
    }
  };

  const handleClearCache = async () => {
    setClearingCache(true);
    try {
      const res = await clearAppHealthCache({ queryClient: qc });
      toast.success(
        `Cleared ${res.clearedStorageKeys} cache key${res.clearedStorageKeys !== 1 ? 's' : ''} and ${res.clearedCacheBuckets} offline bucket${res.clearedCacheBuckets !== 1 ? 's' : ''}`,
      );
      await runChecks();
    } catch (err: any) {
      toast.error('Cache clear failed: ' + (err?.message || 'Unknown error'));
    } finally {
      setClearingCache(false);
    }
  };

  const handleCopySql = async () => {
    try {
      await navigator.clipboard.writeText(MIGRATION_SQL_SNIPPET);
      toast.success('SQL patch copied — run in Supabase SQL Editor');
    } catch {
      toast.error('Clipboard copy failed — open SQL dialog to copy manually');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header action bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-bold text-foreground flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            Live Infrastructure &amp; Schema Diagnostics
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Verifies Supabase REST connectivity, storage RLS enumeration, Edge Functions, and local PWA cache state.
          </p>
        </div>
        <button
          onClick={runChecks}
          disabled={running}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60"
        >
          {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          {running ? 'Probing…' : 'Run Diagnostics'}
        </button>
      </div>

      {/* Pending SQL migration alert */}
      {report?.sqlPatchPending && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-foreground">
                Supabase SQL Health Patch Pending
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                {!report.schema.shopsImageVerification && '• `shops.image_broken_at` column missing (broken scans cannot persist). '}
                {!report.schema.storageRootListingFixed && '• `shop-images` root RLS still hides top-level files from `.list("")`. '}
                {!report.rpcAvailable && '• `get_system_health_snapshot()` admin RPC not installed yet.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleCopySql}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-background border border-border hover:bg-muted transition-colors"
            >
              <Copy className="w-3.5 h-3.5" /> Copy SQL
            </button>
            <button
              onClick={() => setSqlModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-600 text-white hover:bg-amber-700 transition-colors"
            >
              View Migration
            </button>
          </div>
        </div>
      )}

      {/* Scorecards grid */}
      {report && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* DB card */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-primary" /> Database REST
                </span>
                {report.dbOk ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-success/15 text-success">
                    <CheckCircle2 className="w-3 h-3" /> Healthy
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-destructive/15 text-destructive">
                    <XCircle className="w-3 h-3" /> Error
                  </span>
                )}
              </div>
              <p className="text-lg font-bold text-foreground tabular-nums">
                {report.dbLatencyMs != null ? `${report.dbLatencyMs} ms` : '—'}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {report.counts.shops ?? 0} shops · {report.counts.schools ?? 0} institutes · {report.counts.banners ?? 0} ads
              </p>
            </div>

            {/* Schema & RLS card */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-primary" /> Schema &amp; RLS
                </span>
                {!report.sqlPatchPending ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-success/15 text-success">
                    Up to date
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300">
                    Patch needed
                  </span>
                )}
              </div>
              <div className="text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Image verify cols</span>
                  <span className={report.schema.shopsImageVerification ? 'text-success font-semibold' : 'text-amber-600 font-semibold'}>
                    {report.schema.shopsImageVerification ? 'Present' : 'Missing'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Root bucket RLS</span>
                  <span className={report.schema.storageRootListingFixed ? 'text-success font-semibold' : 'text-amber-600 font-semibold'}>
                    {report.schema.storageRootListingFixed ? 'Fixed' : 'Hidden / Needs Fix'}
                  </span>
                </div>
              </div>
            </div>

            {/* Storage card */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <HardDrive className="w-3.5 h-3.5 text-primary" /> Bucket (`shop-images`)
                </span>
                {report.storageBucketOk ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-success/15 text-success">
                    Online
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-destructive/15 text-destructive">
                    Blocked
                  </span>
                )}
              </div>
              <p className="text-lg font-bold text-foreground tabular-nums">
                {report.storageRootSampleCount} root files
              </p>
              <p className="text-[11px] text-muted-foreground truncate">
                Folders: {report.storageSubfoldersFound.length > 0 ? report.storageSubfoldersFound.join(', ') : 'none detected'}
              </p>
            </div>

            {/* Materialized view card */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-primary" /> Category Counts MV
                </span>
                {report.materializedView.exists ? (
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                      report.materializedView.drift === 0
                        ? 'bg-success/15 text-success'
                        : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                    }`}
                  >
                    Drift: {report.materializedView.drift}
                  </span>
                ) : (
                  <span className="text-[11px] text-muted-foreground">Fallback mode</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {report.materializedView.exists
                  ? `MV sum: ${report.materializedView.mvCountSum} · Live links: ${report.materializedView.liveCountSum}`
                  : 'Run SQL snapshot RPC for live MV drift tracking.'}
              </p>
              <button
                onClick={handleRefreshMv}
                disabled={refreshingMv}
                className="w-full mt-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border text-xs font-semibold hover:bg-muted transition-colors disabled:opacity-60"
              >
                {refreshingMv ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                Refresh Counts MV
              </button>
            </div>
          </div>

          {/* Edge Functions + Counts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <section className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Wifi className="w-4 h-4 text-primary" />
                <h4 className="font-bold text-sm text-foreground">Supabase Edge Functions</h4>
              </div>
              <div className="divide-y divide-border">
                {report.edgeFunctions.map((fn) => (
                  <div key={fn.name} className="py-2.5 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{fn.label}</p>
                      <p className="text-[11px] font-mono text-muted-foreground truncate">
                        /functions/v1/{fn.name} · {fn.detail}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                        fn.status === 'online' || fn.status === 'reachable'
                          ? 'bg-success/10 text-success border-success/30'
                          : fn.status === 'not_deployed'
                            ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30'
                            : 'bg-destructive/10 text-destructive border-destructive/30'
                      }`}
                    >
                      {fn.status === 'online'
                        ? 'Online'
                        : fn.status === 'reachable'
                          ? 'Reachable'
                          : fn.status === 'not_deployed'
                            ? 'Not Deployed'
                            : 'Offline'}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            {/* Browser / PWA Cache Inspector */}
            <section className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h4 className="font-bold text-sm text-foreground">PWA &amp; Local Cache Inspector</h4>
                  <p className="text-[11px] text-muted-foreground">
                    {report.browserCache.localStorageKeys} keys ({formatBytes(report.browserCache.localStorageTotalBytes)}) ·{' '}
                    {report.browserCache.cacheStorageNames.length} CacheStorage bucket
                    {report.browserCache.cacheStorageNames.length !== 1 ? 's' : ''} ·{' '}
                    {report.browserCache.serviceWorkers.length} SW
                  </p>
                </div>
                <button
                  onClick={handleClearCache}
                  disabled={clearingCache}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-60"
                >
                  {clearingCache ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  Clear App Cache
                </button>
              </div>

              <div className="divide-y divide-border text-xs">
                {report.browserCache.breakdown.map((item) => (
                  <div key={item.category} className="py-2 flex items-center justify-between gap-2">
                    <div>
                      <span className="font-medium text-foreground">{item.label}</span>
                      {item.preservedOnClear && (
                        <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          kept on clear
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-muted-foreground tabular-nums">
                      {item.keyCount} key{item.keyCount !== 1 ? 's' : ''} · {formatBytes(item.bytes)}
                    </span>
                  </div>
                ))}
              </div>

              {report.browserCache.serviceWorkers.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">
                  Service Worker: inactive (expected in `localhost` dev or `?sw=off`).
                </p>
              ) : (
                <div className="text-[11px] text-muted-foreground space-y-1">
                  {report.browserCache.serviceWorkers.map((sw, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <span className="font-mono truncate">{sw.scriptURL}</span>
                      <span className="font-semibold text-success">{sw.state}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </>
      )}

      {!report && running && (
        <div className="rounded-xl border border-border bg-card p-8 flex items-center justify-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Running Supabase, Edge Function, and browser health probes…</span>
        </div>
      )}

      {/* SQL Patch Preview Modal */}
      <Dialog open={sqlModalOpen} onOpenChange={setSqlModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Supabase SQL Health Migration
            </DialogTitle>
            <DialogDescription className="text-xs">
              Paste and execute <code className="bg-muted px-1 rounded">supabase/migrations/20261113000000_storage_and_health_fixes.sql</code> in the Supabase SQL Editor to apply storage root RLS fixes, image verification columns, and diagnostics RPC.
            </DialogDescription>
          </DialogHeader>
          <pre className="p-3 rounded-lg bg-muted text-[11px] font-mono overflow-x-auto leading-relaxed border border-border">
            {MIGRATION_SQL_SNIPPET}
          </pre>
          <div className="flex justify-end gap-2">
            <button
              onClick={handleCopySql}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Copy className="w-3.5 h-3.5" /> Copy Core SQL
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
