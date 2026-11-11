/**
 * Bulk backfill Marathi translations.
 *
 * Finds shops + categories + schools with missing or partial Marathi rows and fills
 * them using the shared translate API (multi-layer cached). Existing
 * admin-entered Marathi values are never overwritten.
 */
import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { translateEnToMr, isQuotaExceeded, resetQuotaExceeded } from '@/lib/translateApi';
import { useInvalidateTranslations } from '@/hooks/useTranslationsCache';
import { toast } from 'sonner';
import { Languages, Loader2, X, CheckCircle2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';

type ShopRow = {
  id: string; name: string | null; description: string | null;
  address: string | null; area: string | null; sub_area: string | null; keywords: string | null;
};
type CatRow = { id: string; name: string };
type SchoolRow = {
  id: string;
  name: string;
  address: string | null;
  name_mr: string | null;
  address_mr?: string | null;
};

const SHOP_FIELDS: (keyof Omit<ShopRow, 'id'>)[] = ['name', 'description', 'address', 'area', 'sub_area', 'keywords'];

interface Props { open: boolean; onClose: () => void }

export function MarathiBackfillModal({ open, onClose }: Props) {
  const invalidate = useInvalidateTranslations();
  const [scanning, setScanning] = useState(false);
  const [running, setRunning] = useState(false);
  const cancelRef = useRef(false);
  const hasAddressMrRef = useRef(true);

  const [shops, setShops] = useState<ShopRow[]>([]);
  const [cats, setCats] = useState<CatRow[]>([]);
  const [schools, setSchools] = useState<SchoolRow[]>([]);

  const [existingShopTx, setExistingShopTx] = useState<Map<string, Partial<Record<keyof ShopRow, string>>>>(new Map());
  const [existingCatTx, setExistingCatTx] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [summary, setSummary] = useState<{
    shops: number;
    cats: number;
    schools: number;
    cancelled?: boolean;
    quotaHit?: boolean;
  } | null>(null);

  useEffect(() => {
    if (!open) return;
    setSummary(null);
    setProgress({ done: 0, total: 0 });
    cancelRef.current = false;
    scan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const scan = async () => {
    setScanning(true);
    hasAddressMrRef.current = true;

    // Scan schools defensively in case address_mr column hasn't been migrated yet
    let schoolsRes = await (supabase as any)
      .from('schools')
      .select('id, name, address, name_mr, address_mr')
      .eq('is_active', true);

    if (schoolsRes.error && /address_mr/i.test(schoolsRes.error.message)) {
      hasAddressMrRef.current = false;
      schoolsRes = await (supabase as any)
        .from('schools')
        .select('id, name, address, name_mr')
        .eq('is_active', true);
    }

    const results = await Promise.all([
      supabase.from('shops').select('id, name, description, address, area, sub_area, keywords'),
      supabase.from('categories').select('id, name').eq('is_active', true),
      (supabase as any).from('shop_translations').select('shop_id, name, description, address, area, sub_area, keywords').eq('locale', 'mr'),
      (supabase as any).from('category_translations').select('category_id').eq('locale', 'mr'),
    ]);

    const firstErr = results.find((r) => (r as any).error)?.['error' as never] ||
      (schoolsRes.error && !/address_mr/i.test(schoolsRes.error.message) ? schoolsRes.error : null);

    if (firstErr) {
      toast.error(`Scan failed: ${(firstErr as any).message ?? 'unknown error'}`);
      setScanning(false);
      return;
    }

    const [{ data: s }, { data: c }, { data: st }, { data: ct }] = results;
    setShops((s as any) || []);
    setCats((c as any) || []);
    setSchools((schoolsRes.data as any) || []);

    const stMap = new Map<string, Partial<Record<keyof ShopRow, string>>>();
    ((st as any[]) || []).forEach((r) => {
      stMap.set(r.shop_id, {
        name: r.name || undefined, description: r.description || undefined,
        address: r.address || undefined, area: r.area || undefined,
        sub_area: r.sub_area || undefined, keywords: r.keywords || undefined,
      });
    });
    setExistingShopTx(stMap);
    setExistingCatTx(new Set(((ct as any[]) || []).map((r) => r.category_id)));
    setScanning(false);
  };

  /** Count of shop fields that still need Marathi values. */
  const shopFieldsMissing = (s: ShopRow) => {
    const tx = existingShopTx.get(s.id) || {};
    let miss = 0;
    SHOP_FIELDS.forEach((f) => { if ((s as any)[f] && !tx[f]) miss += 1; });
    return miss;
  };

  const shopsToFill = shops.filter((s) => shopFieldsMissing(s) > 0);
  const catsToFill = cats.filter((c) => !existingCatTx.has(c.id));

  const schoolFieldsMissing = (sc: SchoolRow) => {
    let miss = 0;
    if (sc.name && !sc.name_mr) miss += 1;
    if (hasAddressMrRef.current && sc.address && !sc.address_mr) miss += 1;
    return miss;
  };
  const schoolsToFill = schools.filter((sc) => schoolFieldsMissing(sc) > 0);

  const run = async () => {
    setRunning(true);
    cancelRef.current = false;
    resetQuotaExceeded();

    const total = shopsToFill.length + catsToFill.length + schoolsToFill.length;
    setProgress({ done: 0, total });

    let shopsFilled = 0;
    let catsFilled = 0;
    let schoolsFilled = 0;
    let quotaHit = false;

    // 1. Categories first (fastest & cheapest)
    for (const c of catsToFill) {
      if (cancelRef.current) break;
      if (isQuotaExceeded()) {
        quotaHit = true;
        break;
      }
      try {
        const out = (await translateEnToMr(c.name)).trim();
        if (!out || out.toLowerCase() === c.name.toLowerCase() || /^mymemory/i.test(out)) {
          setProgress((p) => ({ ...p, done: p.done + 1 }));
          continue;
        }
        await (supabase as any).from('category_translations').upsert(
          { category_id: c.id, locale: 'mr', name: out },
          { onConflict: 'category_id,locale' },
        );
        catsFilled += 1;
      } catch { /* skip */ }
      setProgress((p) => ({ ...p, done: p.done + 1 }));
      await new Promise((r) => setTimeout(r, 100));
    }

    // 2. Schools directory (education vertical)
    for (const sc of schoolsToFill) {
      if (cancelRef.current) break;
      if (isQuotaExceeded()) {
        quotaHit = true;
        break;
      }
      let nameMr = sc.name_mr;
      let addressMr = sc.address_mr;
      let touched = false;

      // Translate missing name -> name_mr
      if (!nameMr && sc.name) {
        try {
          const out = (await translateEnToMr(sc.name)).trim();
          if (out && out.toLowerCase() !== sc.name.toLowerCase() && !/^mymemory/i.test(out)) {
            nameMr = out;
            touched = true;
          }
        } catch { /* skip */ }
        await new Promise((r) => setTimeout(r, 100));
      }

      // Translate missing address -> address_mr
      if (!addressMr && sc.address && hasAddressMrRef.current) {
        try {
          const out = (await translateEnToMr(sc.address)).trim();
          if (out && out.toLowerCase() !== sc.address.toLowerCase() && !/^mymemory/i.test(out)) {
            addressMr = out;
            touched = true;
          }
        } catch { /* skip */ }
        await new Promise((r) => setTimeout(r, 100));
      }

      if (touched) {
        const updatePayload: Record<string, string> = {};
        if (nameMr) updatePayload.name_mr = nameMr;
        if (addressMr && hasAddressMrRef.current) updatePayload.address_mr = addressMr;

        try {
          const { error } = await (supabase as any)
            .from('schools')
            .update(updatePayload)
            .eq('id', sc.id);
          if (error && /address_mr/i.test(error.message)) {
            hasAddressMrRef.current = false;
            delete updatePayload.address_mr;
            if (Object.keys(updatePayload).length > 0) {
              await (supabase as any).from('schools').update(updatePayload).eq('id', sc.id);
            }
          }
          schoolsFilled += 1;
        } catch { /* skip */ }
      }
      setProgress((p) => ({ ...p, done: p.done + 1 }));
    }

    // 3. Shops — 2 gentle concurrent streams with 100ms pacing delay
    const queue = [...shopsToFill];
    const worker = async () => {
      while (!cancelRef.current) {
        if (isQuotaExceeded()) {
          quotaHit = true;
          break;
        }
        const s = queue.shift();
        if (!s) return;
        const existing = existingShopTx.get(s.id) || {};
        const payload: Record<string, string | null> = {
          name: existing.name || null,
          description: existing.description || null,
          address: existing.address || null,
          area: existing.area || null,
          sub_area: existing.sub_area || null,
          keywords: existing.keywords || null,
        };
        let touched = false;
        for (const f of SHOP_FIELDS) {
          if (cancelRef.current || isQuotaExceeded()) {
            if (isQuotaExceeded()) quotaHit = true;
            break;
          }
          if (payload[f]) continue;
          const src = (s as any)[f] as string | null;
          if (!src) continue;
          try {
            const out = (await translateEnToMr(src)).trim();
            if (!out || out.toLowerCase() === src.toLowerCase() || /^mymemory/i.test(out)) continue;
            payload[f] = out;
            touched = true;
          } catch { /* skip */ }
          await new Promise((r) => setTimeout(r, 100));
        }
        if (touched) {
          await (supabase as any).from('shop_translations').upsert(
            { shop_id: s.id, locale: 'mr', ...payload },
            { onConflict: 'shop_id,locale' },
          );
          shopsFilled += 1;
        }
        setProgress((p) => ({ ...p, done: p.done + 1 }));
      }
    };
    await Promise.all([worker(), worker()]);

    invalidate();
    setRunning(false);
    const cancelled = cancelRef.current;
    setSummary({
      shops: shopsFilled,
      cats: catsFilled,
      schools: schoolsFilled,
      cancelled,
      quotaHit: quotaHit || isQuotaExceeded(),
    });

    if (quotaHit || isQuotaExceeded()) {
      toast.warning('Daily translation limit reached. Partial progress saved — please retry tomorrow.');
    } else if (cancelled) {
      toast.warning(`Stopped — saved ${shopsFilled} shops, ${catsFilled} categories, ${schoolsFilled} schools before cancel`);
    } else {
      toast.success(`Backfill done: ${shopsFilled} shops, ${catsFilled} categories, ${schoolsFilled} schools`);
    }
  };

  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !running) onClose(); }}>
      <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="text-left">
          <DialogTitle className="flex items-center gap-2 pr-8">
            <Languages className="w-5 h-5 text-primary shrink-0" />
            <span className="min-w-0 break-words">Backfill Marathi translations</span>
          </DialogTitle>
          <DialogDescription>
            Auto-translates missing Marathi values for shops, categories, and schools. Admin-entered
            Marathi is never overwritten. Safe to re-run.
          </DialogDescription>
        </DialogHeader>

        {scanning ? (
          <div className="py-8 flex flex-col items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" /> Scanning…
          </div>
        ) : summary ? (
          <div className="py-6 text-center space-y-2">
            <CheckCircle2 className={`w-10 h-10 mx-auto ${summary.cancelled || summary.quotaHit ? 'text-amber-500' : 'text-primary'}`} />
            <p className="text-sm font-semibold text-foreground">
              {summary.quotaHit
                ? 'Daily limit reached — partial progress saved.'
                : summary.cancelled
                ? 'Stopped early — partial progress saved.'
                : 'Backfill complete.'}
            </p>
            <p className="text-sm text-foreground">
              Filled Marathi for {summary.shops} shop{summary.shops === 1 ? '' : 's'}, {summary.cats} categor{summary.cats === 1 ? 'y' : 'ies'}, and {summary.schools} school{summary.schools === 1 ? '' : 's'}.
            </p>
            <p className="text-xs text-muted-foreground">
              {summary.cancelled || summary.quotaHit
                ? 'You can resume by re-running — only the remaining rows will be processed.'
                : 'Switch the language toggle to Marathi to verify.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Stat label="Shops to fill" value={shopsToFill.length} sub={`${shops.length} total`} />
              <Stat label="Categories to fill" value={catsToFill.length} sub={`${cats.length} active`} />
              <Stat label="Schools to fill" value={schoolsToFill.length} sub={`${schools.length} active`} />
            </div>
            {running && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Translating… {progress.done}/{progress.total}</span>
                  <span>{pct}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>
            )}
            <p className="text-[11px] text-muted-foreground">
              Translations are cached project-wide with 50k chars/day quota — re-runs are cheap and fast.
            </p>
          </div>
        )}

        <DialogFooter className="gap-2">
          {!summary && !running && (
            <>
              <button
                onClick={onClose}
                className="px-3 py-2 rounded-lg border border-border text-sm font-semibold hover:bg-muted"
              >Cancel</button>
              <button
                onClick={run}
                disabled={scanning || (shopsToFill.length + catsToFill.length + schoolsToFill.length === 0)}
                className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 hover:bg-primary/90 inline-flex items-center gap-1.5"
              >
                <Languages className="w-4 h-4" />
                {shopsToFill.length + catsToFill.length + schoolsToFill.length === 0 ? 'Nothing to fill' : 'Start backfill'}
              </button>
            </>
          )}
          {running && (
            <button
              onClick={() => { cancelRef.current = true; }}
              className="px-3 py-2 rounded-lg border border-border text-sm font-semibold inline-flex items-center gap-1.5"
            >
              <X className="w-4 h-4" /> Stop
            </button>
          )}
          {summary && (
            <button
              onClick={onClose}
              className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90"
            >Done</button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-2.5 text-center">
      <div className="text-xl sm:text-2xl font-bold text-foreground leading-none">{value}</div>
      <div className="text-[11px] text-muted-foreground mt-1 truncate">{label}</div>
      {sub && <div className="text-[10px] text-muted-foreground/70">{sub}</div>}
    </div>
  );
}
