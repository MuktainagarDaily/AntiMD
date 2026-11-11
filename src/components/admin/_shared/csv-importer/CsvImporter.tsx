/**
 * CsvImporter framework — Forge recommendation #4 (Phase 2 Foundations).
 *
 * Config-driven three-step import shell (upload → preview → result) shared by
 * CategoryCsvImportModal, AnalyticsCsvImportModal, and the shops CsvImportModal.
 * Each caller supplies:
 *   - a CSV template + filename
 *   - a `parseRow` that turns a raw record into a typed row + status + messages
 *   - `renderCells` for the preview table
 *   - an `importBatch` that persists the "ready"/"warning" rows
 * The shell owns the FileReader pipeline, deduplication ledger, status
 * badges, counts, and the import lifecycle.
 *
 * SENTINEL NOTE: `MasterImportModal.tsx` is intentionally excluded — its
 * multi-table composite-PK `onConflict` logic (fixed in the 2026-06 bug pass)
 * is load-bearing and does not fit the row-classified single-table shape.
 * Don't migrate it here without a separate design.
 */
import { useMemo, useRef, useState } from 'react';
import {
  Loader2, X, Upload, Download,
  CheckCircle2, AlertTriangle, AlertCircle, SkipForward,
} from 'lucide-react';
import { toast } from 'sonner';
import { parseCsv } from '@/lib/csvUtils';
import type {
  CsvImporterConfig,
  CsvImporterRow,
  CsvRowStatus,
  ImportResult,
  ImporterStep,
} from './types';

interface Props<TRow> {
  config: CsvImporterConfig<TRow>;
  onClose: () => void;
  onDone: () => void;
}

const STATUS_CONFIG: Record<
  CsvRowStatus,
  { icon: React.ReactNode; label: string; rowCls: string; badgeCls: string }
> = {
  ready:     { icon: <CheckCircle2 className="w-3.5 h-3.5" />, label: 'Ready',     rowCls: '',                  badgeCls: 'bg-success/10 text-success border border-success/30' },
  warning:   { icon: <AlertTriangle className="w-3.5 h-3.5" />, label: 'Warning',   rowCls: 'bg-secondary/5',    badgeCls: 'bg-secondary/10 text-secondary border border-secondary/30' },
  error:     { icon: <AlertCircle className="w-3.5 h-3.5" />, label: 'Error',      rowCls: 'bg-destructive/5',  badgeCls: 'bg-destructive/10 text-destructive border border-destructive/30' },
  duplicate: { icon: <SkipForward className="w-3.5 h-3.5" />, label: 'Duplicate', rowCls: 'bg-muted/60',       badgeCls: 'bg-muted text-muted-foreground border border-border' },
};

export function CsvImporter<TRow>({ config, onClose, onDone }: Props<TRow>) {
  const [step, setStep] = useState<ImporterStep>('upload');
  const [rows, setRows] = useState<CsvImporterRow<TRow>[]>([]);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const importableRows = useMemo(
    () => rows.filter((r) => r.status === 'ready' || r.status === 'warning'),
    [rows],
  );
  const dupeRows = useMemo(() => rows.filter((r) => r.status === 'duplicate'), [rows]);
  const errorRows = useMemo(() => rows.filter((r) => r.status === 'error'), [rows]);

  function downloadTemplate() {
    const blob = new Blob([config.templateContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = config.templateFilename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      toast.error('Please upload a .csv file');
      return;
    }
    setParsing(true);
    try {
      const csvText = await file.text();
      const rawRows = parseCsv(csvText);
      if (rawRows.length === 0) {
        toast.error('CSV has no data rows');
        return;
      }
      const existingKeys = await config.loadExistingKeys();
      const existing = new Set(existingKeys);
      const seen = new Set<string>();
      const processed: CsvImporterRow<TRow>[] = rawRows.map((raw) => {
        const parsed = config.parseRow(raw, { seen, existing });
        // Framework owns dedupe accounting so callers stay declarative.
        if (parsed.status !== 'error' && parsed.dedupeKey) {
          if (existing.has(parsed.dedupeKey)) {
            parsed.status = 'duplicate';
            parsed.messages = [...parsed.messages, 'Already exists in database'];
          } else if (seen.has(parsed.dedupeKey)) {
            parsed.status = 'duplicate';
            parsed.messages = [...parsed.messages, 'Duplicate within CSV'];
          } else {
            seen.add(parsed.dedupeKey);
          }
        }
        return parsed;
      });
      setRows(processed);
      setStep('preview');
      if (fileRef.current) fileRef.current.value = '';
    } catch (err: any) {
      toast.error(err?.message || 'Failed to read CSV file');
    } finally {
      setParsing(false);
    }
  }

  async function handleImport() {
    setImporting(true);
    try {
      const payload = importableRows.map((r) => r.row);
      const { imported, failed } = await config.importBatch(payload);
      setResult({
        imported,
        skippedDupes: dupeRows.length,
        skippedErrors: errorRows.length,
        failed,
      });
      setStep('result');
    } catch (err: any) {
      toast.error(err?.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  }

  const { entity, entityPlural } = config.labels;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center overflow-y-auto overscroll-contain py-4 px-4">
      <div className="bg-card rounded-2xl border border-border w-full max-w-2xl shadow-2xl my-4 max-h-[calc(100dvh-2rem)] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-primary" />
            <h2 className="font-bold text-lg text-foreground">{config.title}</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-lg" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        {step === 'upload' && (
          <div className="p-6 space-y-6">
            <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
              <p className="text-sm font-semibold text-foreground">How to use</p>
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Download the CSV template below</li>
                <li>Fill in {entity} data — columns: {config.columns.join(', ')}</li>
                <li>Upload and review the preview</li>
                <li>Import valid rows</li>
              </ol>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 items-start">
              <button
                onClick={downloadTemplate}
                className="flex items-center gap-2 border border-border bg-background text-foreground px-4 py-2.5 rounded-lg font-semibold text-sm hover:bg-muted transition-colors"
              >
                <Download className="w-4 h-4" />Download Template CSV
              </button>
              <label className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg font-semibold text-sm hover:bg-primary/90 transition-colors cursor-pointer">
                {parsing
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Parsing...</>
                  : <><Upload className="w-4 h-4" /> Choose CSV File</>}
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileChange}
                  className="sr-only"
                  disabled={parsing}
                />
              </label>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="p-6 space-y-4 overflow-y-auto">
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-success/10 text-success border border-success/30">
                <CheckCircle2 className="w-3.5 h-3.5" /> {importableRows.filter((r) => r.status === 'ready').length} Ready
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-secondary/10 text-secondary border border-secondary/30">
                <AlertTriangle className="w-3.5 h-3.5" /> {importableRows.filter((r) => r.status === 'warning').length} Warning
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-destructive/10 text-destructive border border-destructive/30">
                <AlertCircle className="w-3.5 h-3.5" /> {errorRows.length} Error
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground border border-border">
                <SkipForward className="w-3.5 h-3.5" /> {dupeRows.length} Duplicate
              </span>
            </div>
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="overflow-x-auto max-h-80 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0">
                    <tr className="bg-muted/80 border-b border-border">
                      <th className="text-left px-3 py-2.5 font-semibold text-foreground w-8">#</th>
                      {config.columns.map((c) => (
                        <th key={c} className="text-left px-3 py-2.5 font-semibold text-foreground">{c}</th>
                      ))}
                      <th className="text-left px-3 py-2.5 font-semibold text-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, idx) => {
                      const cfg = STATUS_CONFIG[row.status];
                      return (
                        <tr key={idx} className={`border-b border-border last:border-0 ${cfg.rowCls}`}>
                          <td className="px-3 py-2.5 text-muted-foreground align-top">{idx + 1}</td>
                          {config.renderCells(row.row, row)}
                          <td className="px-3 py-2.5 align-top">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.badgeCls}`}>
                              {cfg.icon} {cfg.label}
                            </span>
                            {row.messages.length > 0 && (
                              <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                                {row.messages
                                  .filter((m) => m !== 'Ready to import')
                                  .map((m, i) => <div key={i}>{m}</div>)}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={() => { setRows([]); setStep('upload'); }}
                className="flex-1 py-2.5 border border-border rounded-xl font-semibold text-foreground hover:bg-muted transition-colors text-sm"
              >
                ← Back
              </button>
              <button
                onClick={handleImport}
                disabled={importing || importableRows.length === 0}
                className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2 text-sm"
              >
                {importing
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Importing...</>
                  : `Import ${importableRows.length} ${importableRows.length !== 1 ? entityPlural : entity}`}
              </button>
            </div>
          </div>
        )}

        {step === 'result' && result && (
          <div className="p-6 space-y-5">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-7 h-7 text-success shrink-0" />
              <div>
                <p className="font-bold text-foreground text-lg">Import complete</p>
                <p className="text-sm text-muted-foreground">Here's a summary.</p>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-muted/20 divide-y divide-border">
              {[
                { label: 'Imported successfully', value: result.imported, icon: '✅' },
                { label: 'Skipped — duplicate',   value: result.skippedDupes, icon: '🔁' },
                { label: 'Skipped — errors',      value: result.skippedErrors, icon: '❌' },
                { label: 'Failed (database error)', value: result.failed, icon: '⚠️' },
              ].map(({ label, value, icon }) => (
                <div key={label} className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <span>{icon}</span> {label}
                  </span>
                  <span className="font-bold text-foreground">{value}</span>
                </div>
              ))}
            </div>
            <button
              onClick={onDone}
              className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-colors text-sm"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
