import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, X, Upload, Download, CheckCircle2, AlertCircle, SkipForward } from 'lucide-react';
import { toast } from 'sonner';
import { parseCsv } from '@/lib/csvUtils';

type RowStatus = 'ready' | 'error';
interface EngRow {
  shopName: string; area: string; calls: number; whatsapp: number;
  status: RowStatus; messages: string[]; shopId: string | null;
}
type Step = 'upload' | 'preview' | 'result';

function downloadTemplate() {
  const rows = ['Shop Name,Area,Calls,WhatsApp,Total', '"Example Shop","Main Road","5","3","8"'].join('\n');
  const blob = new Blob([rows], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'muktainagar_analytics_template.csv'; a.click(); URL.revokeObjectURL(url);
}

interface Props { onClose: () => void; onDone: () => void; }

export function AnalyticsCsvImportModal({ onClose, onDone }: Props) {
  const [step, setStep] = useState<Step>('upload');
  const [rows, setRows] = useState<EngRow[]>([]);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ eventsInserted: number; shopsMatched: number; skipped: number; failed: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const processText = async (csvText: string) => {
    const rawRows = parseCsv(csvText);
    if (rawRows.length === 0) { toast.error('CSV has no data rows'); setParsing(false); return; }
    const { data: shops } = await supabase.from('shops').select('id, name');
    const shopMap = new Map<string, string>();
    (shops || []).forEach((s: any) => shopMap.set(s.name.toLowerCase().trim(), s.id));

    const processed: EngRow[] = rawRows.map((raw) => {
      const shopName = (raw['shop name'] || '').trim();
      const area = (raw['area'] || '').trim();
      const calls = parseInt(raw['calls'] || '0', 10) || 0;
      const whatsapp = parseInt(raw['whatsapp'] || '0', 10) || 0;
      const messages: string[] = []; let status: RowStatus = 'ready';
      let shopId: string | null = null;
      if (!shopName) { messages.push('Shop name is required'); status = 'error'; }
      else {
        shopId = shopMap.get(shopName.toLowerCase().trim()) ?? null;
        if (!shopId) { messages.push('Shop not found in database'); status = 'error'; }
      }
      if (calls === 0 && whatsapp === 0 && status !== 'error') { messages.push('No engagement data'); status = 'error'; }
      if (status === 'ready') messages.push('Ready to import');
      return { shopName, area, calls, whatsapp, status, messages, shopId };
    });
    setRows(processed); setParsing(false); setStep('preview');
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') { toast.error('Please upload a .csv file'); return; }
    setParsing(true);
    const csvText = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader(); reader.onload = (ev) => resolve(ev.target?.result as string); reader.onerror = reject; reader.readAsText(file, 'utf-8');
    });
    await processText(csvText);
  };

  const importableRows = rows.filter((r) => r.status === 'ready');
  const errorRows = rows.filter((r) => r.status === 'error');

  const handleImport = async () => {
    setImporting(true); let eventsInserted = 0; let failed = 0;
    const CHUNK = 500;
    for (const row of importableRows) {
      if (!row.shopId) continue;
      const events: { shop_id: string; event_type: string }[] = [];
      for (let i = 0; i < row.calls; i++) events.push({ shop_id: row.shopId, event_type: 'call' });
      for (let i = 0; i < row.whatsapp; i++) events.push({ shop_id: row.shopId, event_type: 'whatsapp' });
      // Chunk to avoid payload-size / timeout failures on high-traffic shops.
      for (let i = 0; i < events.length; i += CHUNK) {
        const slice = events.slice(i, i + CHUNK);
        const { error } = await supabase.from('shop_engagement').insert(slice);
        if (error) { failed += slice.length; } else { eventsInserted += slice.length; }
      }
    }
    setResult({ eventsInserted, shopsMatched: importableRows.length, skipped: errorRows.length, failed });
    setImporting(false); setStep('result');
  };

  const statusConfig: Record<RowStatus, { icon: React.ReactNode; label: string; rowCls: string; badgeCls: string }> = {
    ready: { icon: <CheckCircle2 className="w-3.5 h-3.5" />, label: 'Ready', rowCls: '', badgeCls: 'bg-success/10 text-success border border-success/30' },
    error: { icon: <AlertCircle className="w-3.5 h-3.5" />, label: 'Error', rowCls: 'bg-destructive/5', badgeCls: 'bg-destructive/10 text-destructive border border-destructive/30' },
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center overflow-y-auto overscroll-contain py-4 px-4">
      <div className="bg-card rounded-2xl border border-border w-full max-w-2xl shadow-2xl my-4 max-h-[calc(100dvh-2rem)] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2"><Upload className="w-5 h-5 text-primary" /><h2 className="font-bold text-lg text-foreground">Import Analytics from CSV</h2></div>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        {step === 'upload' && (
          <div className="p-6 space-y-6">
            <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
              <p className="text-sm font-semibold text-foreground">How to use</p>
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Download the CSV template below</li>
                <li>Fill in engagement data — columns: Shop Name, Area, Calls, WhatsApp, Total</li>
                <li>Shop names must exactly match existing shops</li>
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
          <div className="p-6 space-y-4 overflow-y-auto">
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
                            {row.area && <div className="text-xs text-muted-foreground">{row.area}</div>}
                            <div className="text-xs text-muted-foreground mt-0.5">{row.messages.filter(m => m !== 'Ready to import').map((m, i) => <span key={i} className="block">{m}</span>)}</div>
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
          <div className="p-6 space-y-5">
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
