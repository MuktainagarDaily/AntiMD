import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, X, Upload, Download, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { downloadCsvText, fetchAllPaged, parseCsv } from '@/lib/csvUtils';
import { useCity } from '@/hooks/useCity';

type RowStatus = 'ready' | 'error';
interface EngRow {
  shopName: string;
  area: string;
  town: string;
  calls: number;
  whatsapp: number;
  createdAtIso: string | null;
  status: RowStatus;
  messages: string[];
  shopId: string | null;
}
type Step = 'upload' | 'preview' | 'result';

function downloadTemplate() {
  const rows = [
    'Shop Name,Area,Town,Calls,WhatsApp,Total,Date',
    '"Example Shop","Main Road","Muktainagar","5","3","8","2026-11-01"',
  ].join('\n');
  downloadCsvText('apnatown_analytics_template.csv', rows, false);
}

interface Props {
  onClose: () => void;
  onDone: () => void;
}

export function AnalyticsCsvImportModal({ onClose, onDone }: Props) {
  const { currentCity, allCities } = useCity();
  const [targetCityId, setTargetCityId] = useState<string>(currentCity.id);
  const [step, setStep] = useState<Step>('upload');
  const [rows, setRows] = useState<EngRow[]>([]);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ eventsInserted: number; shopsMatched: number; skipped: number; failed: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const resolveCityId = (townRaw: string): string | null => {
    const clean = townRaw.trim().toLowerCase();
    if (!clean) return targetCityId === 'all' ? null : targetCityId;
    const match = allCities.find(
      (c) =>
        c.slug.toLowerCase() === clean ||
        c.name.toLowerCase() === clean ||
        (c.name_mr && c.name_mr.trim() === townRaw.trim()),
    );
    return match ? match.id : '__unknown__';
  };

  const processText = async (csvText: string) => {
    const rawRows = parseCsv(csvText);
    if (rawRows.length === 0) {
      toast.error('CSV has no data rows');
      setParsing(false);
      return;
    }

    const shops = await fetchAllPaged<{ id: string; name: string; area: string | null; city_id: string | null }>(
      (from, to) =>
        supabase
          .from('shops')
          .select('id, name, area, city_id')
          .order('id', { ascending: true })
          .range(from, to),
    );

    const byName = new Map<string, { id: string; name: string; area: string | null; city_id: string | null }[]>();
    shops.forEach((s) => {
      const k = s.name.toLowerCase().trim();
      const arr = byName.get(k) ?? [];
      arr.push(s);
      byName.set(k, arr);
    });

    const muktainagarId = allCities.find((c) => c.slug === 'muktainagar')?.id;

    const processed: EngRow[] = rawRows.map((raw) => {
      const shopName = (raw['shop name'] || raw['name'] || '').trim();
      const area = (raw['area'] || '').trim();
      const town = (raw['town'] || raw['city'] || '').trim();
      const dateRaw = (raw['date'] || raw['created_at'] || '').trim();
      const calls = Math.max(0, parseInt(raw['calls'] || '0', 10) || 0);
      const whatsapp = Math.max(0, parseInt(raw['whatsapp'] || '0', 10) || 0);

      const messages: string[] = [];
      let status: RowStatus = 'ready';
      let shopId: string | null = null;
      let createdAtIso: string | null = null;

      if (dateRaw) {
        const parsed = new Date(dateRaw);
        if (Number.isNaN(parsed.getTime())) {
          messages.push(`Invalid Date "${dateRaw}" (use YYYY-MM-DD)`);
          status = 'error';
        } else {
          createdAtIso = parsed.toISOString();
        }
      }

      if (!shopName) {
        messages.push('Shop name is required');
        status = 'error';
      } else {
        let candidates = byName.get(shopName.toLowerCase().trim()) ?? [];
        const scopedCityId = resolveCityId(town);

        if (scopedCityId === '__unknown__') {
          messages.push(`Unknown town "${town}"`);
          status = 'error';
          candidates = [];
        } else if (scopedCityId) {
          const isMuktainagar = scopedCityId === muktainagarId;
          candidates = candidates.filter((c) => c.city_id === scopedCityId || (isMuktainagar && !c.city_id));
        }

        if (candidates.length > 1 && area) {
          const areaLower = area.toLowerCase().trim();
          const areaMatched = candidates.filter((c) => (c.area || '').toLowerCase().trim() === areaLower);
          if (areaMatched.length > 0) candidates = areaMatched;
        }

        if (status !== 'error') {
          if (candidates.length === 0) {
            messages.push('Shop not found in selected town');
            status = 'error';
          } else if (candidates.length > 1) {
            messages.push(`Multiple shops named "${shopName}" found — add Area/Town column to disambiguate`);
            status = 'error';
          } else {
            shopId = candidates[0].id;
          }
        }
      }

      if (calls === 0 && whatsapp === 0 && status !== 'error') {
        messages.push('No engagement data');
        status = 'error';
      }
      if (status === 'ready') messages.push('Ready to import');
      return { shopName, area, town, calls, whatsapp, createdAtIso, status, messages, shopId };
    });

    setRows(processed);
    setParsing(false);
    setStep('preview');
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      toast.error('Please upload a .csv file');
      return;
    }
    setParsing(true);
    const csvText = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (ev) => resolve(ev.target?.result as string);
      reader.onerror = reject;
      reader.readAsText(file, 'utf-8');
    });
    await processText(csvText);
  };

  const importableRows = rows.filter((r) => r.status === 'ready');
  const errorRows = rows.filter((r) => r.status === 'error');

  const handleImport = async () => {
    setImporting(true);
    let eventsInserted = 0;
    let failed = 0;
    const CHUNK = 500;
    for (const row of importableRows) {
      if (!row.shopId) continue;
      const events: { shop_id: string; event_type: string; created_at?: string }[] = [];
      for (let i = 0; i < row.calls; i++) {
        events.push(row.createdAtIso ? { shop_id: row.shopId, event_type: 'call', created_at: row.createdAtIso } : { shop_id: row.shopId, event_type: 'call' });
      }
      for (let i = 0; i < row.whatsapp; i++) {
        events.push(row.createdAtIso ? { shop_id: row.shopId, event_type: 'whatsapp', created_at: row.createdAtIso } : { shop_id: row.shopId, event_type: 'whatsapp' });
      }
      for (let i = 0; i < events.length; i += CHUNK) {
        const slice = events.slice(i, i + CHUNK);
        const { error } = await supabase.from('shop_engagement').insert(slice);
        if (error) {
          failed += slice.length;
        } else {
          eventsInserted += slice.length;
        }
      }
    }
    setResult({ eventsInserted, shopsMatched: importableRows.length, skipped: errorRows.length, failed });
    setImporting(false);
    setStep('result');
  };

  const statusConfig: Record<RowStatus, { icon: React.ReactNode; label: string; rowCls: string; badgeCls: string }> = {
    ready: { icon: <CheckCircle2 className="w-3.5 h-3.5" />, label: 'Ready', rowCls: '', badgeCls: 'bg-success/10 text-success border border-success/30' },
    error: { icon: <AlertCircle className="w-3.5 h-3.5" />, label: 'Error', rowCls: 'bg-destructive/5', badgeCls: 'bg-destructive/10 text-destructive border border-destructive/30' },
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center overflow-y-auto overscroll-contain py-4 px-3 sm:px-4"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-2xl border border-border w-full max-w-2xl shadow-2xl my-4 max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 px-4 sm:px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Upload className="w-5 h-5 text-primary shrink-0" />
            <h2 className="font-bold text-base sm:text-lg text-foreground truncate">Import Analytics from CSV</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 hover:bg-muted rounded-lg shrink-0"><X className="w-5 h-5" /></button>
        </div>

        {step === 'upload' && (
          <div className="p-4 sm:p-6 space-y-5 overflow-y-auto overscroll-contain flex-1 min-h-0">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-foreground uppercase tracking-wide">
                Target Town Scope (used when CSV has no Town column)
              </label>
              <select
                value={targetCityId}
                onChange={(e) => setTargetCityId(e.target.value)}
                className="w-full sm:w-72 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground"
              >
                <option value="all">🌐 All Towns (match globally)</option>
                {allCities.map((c) => (
                  <option key={c.id} value={c.id}>
                    📍 {c.name} {c.name_mr ? `(${c.name_mr})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
              <p className="text-sm font-semibold text-foreground">How to use</p>
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Download the CSV template below</li>
                <li>Columns: <code className="text-xs">Shop Name, Area, Town, Calls, WhatsApp, Total, Date</code> (Date optional, YYYY-MM-DD)</li>
                <li>Shops are matched by name + Area within the selected Town</li>
                <li>Upload and review, then import</li>
              </ol>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 items-start">
              <button onClick={downloadTemplate} className="flex items-center gap-2 border border-border bg-background text-foreground px-4 py-2.5 rounded-lg font-semibold text-sm hover:bg-muted transition-colors">
                <Download className="w-4 h-4" />Download Template CSV
              </button>
              <label className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg font-semibold text-sm hover:bg-primary/90 transition-colors cursor-pointer">
                {parsing ? <><Loader2 className="w-4 h-4 animate-spin" /> Parsing...</> : <><Upload className="w-4 h-4" /> Choose CSV File</>}
                <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleFileChange} className="sr-only" disabled={parsing} />
              </label>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="p-4 sm:p-6 space-y-4 overflow-y-auto overscroll-contain flex-1 min-h-0">
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-success/10 text-success border border-success/30"><CheckCircle2 className="w-3.5 h-3.5" /> {importableRows.length} Ready</span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-destructive/10 text-destructive border border-destructive/30"><AlertCircle className="w-3.5 h-3.5" /> {errorRows.length} Error</span>
            </div>
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="overflow-x-auto max-h-80 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0">
                    <tr className="bg-muted/80 border-b border-border">
                      <th className="text-left px-3 py-2.5 font-semibold text-foreground w-8">#</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-foreground">Shop</th>
                      <th className="text-right px-3 py-2.5 font-semibold text-foreground">Calls</th>
                      <th className="text-right px-3 py-2.5 font-semibold text-foreground">WA</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, idx) => {
                      const cfg = statusConfig[row.status];
                      return (
                        <tr key={idx} className={`border-b border-border last:border-0 ${cfg.rowCls}`}>
                          <td className="px-3 py-2.5 text-muted-foreground">{idx + 1}</td>
                          <td className="px-3 py-2.5">
                            <div className="font-semibold text-foreground">{row.shopName || <span className="text-destructive italic">missing</span>}</div>
                            {(row.area || row.town) && (
                              <div className="text-xs text-muted-foreground">
                                {[row.area, row.town].filter(Boolean).join(' · ')}
                              </div>
                            )}
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {row.messages.filter((m) => m !== 'Ready to import').map((m, i) => <span key={i} className="block">{m}</span>)}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-right text-foreground font-medium">{row.calls}</td>
                          <td className="px-3 py-2.5 text-right text-foreground font-medium">{row.whatsapp}</td>
                          <td className="px-3 py-2.5"><span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.badgeCls}`}>{cfg.icon} {cfg.label}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button onClick={() => { setRows([]); setStep('upload'); }} className="flex-1 py-2.5 border border-border rounded-xl font-semibold text-foreground hover:bg-muted transition-colors text-sm">← Back</button>
              <button onClick={handleImport} disabled={importing || importableRows.length === 0} className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2 text-sm">
                {importing ? <><Loader2 className="w-4 h-4 animate-spin" /> Importing...</> : `Import ${importableRows.reduce((s, r) => s + r.calls + r.whatsapp, 0)} Events`}
              </button>
            </div>
          </div>
        )}

        {step === 'result' && result && (
          <div className="p-4 sm:p-6 space-y-5 overflow-y-auto overscroll-contain flex-1 min-h-0">
            <div className="flex items-center gap-3"><CheckCircle2 className="w-7 h-7 text-success shrink-0" /><div><p className="font-bold text-foreground text-lg">Import complete</p><p className="text-sm text-muted-foreground">Here's a summary.</p></div></div>
            <div className="rounded-xl border border-border bg-muted/20 divide-y divide-border">
              {[
                { label: 'Events inserted', value: result.eventsInserted, icon: '✅' },
                { label: 'Shops matched', value: result.shopsMatched, icon: '🏪' },
                { label: 'Skipped — errors', value: result.skipped, icon: '❌' },
                { label: 'Failed (database error)', value: result.failed, icon: '⚠️' },
              ].map(({ label, value, icon }) => (
                <div key={label} className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-muted-foreground flex items-center gap-2"><span>{icon}</span> {label}</span>
                  <span className="font-bold text-foreground">{value}</span>
                </div>
              ))}
            </div>
            <button onClick={onDone} className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-colors text-sm">Done</button>
          </div>
        )}
      </div>
    </div>
  );
}
