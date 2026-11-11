import { useState, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Upload, Download, AlertCircle, CheckCircle2, X, Sparkles, Loader2, SkipForward } from 'lucide-react';
import { toast } from 'sonner';
import { parseBulkBusCsv } from '@/lib/bus/busHelpers';
import { downloadCsvText } from '@/lib/csvUtils';

interface BusBulkImportModalProps {
  open: boolean;
  cityId: string;
  cityName: string;
  existingCount: number;
  existingDestinations?: string[];
  onClose: () => void;
  onImported: () => void;
}

const SAMPLE_CSV = `Destination, Marathi Name, Departure Times, Notes, Active
Jalgaon, जळगाव, 06:00 07:15 09:30 14:00 17:30, "[Outgoing] · [MSRTC Ordinary] · via Bhusawal", true
Pune Station, पुणे स्टेशन, 21:00 22:30, "[Outgoing] · [Express] · via Somatane Phata, Chinchwad", true
Nigdi, निगडी, 07:30 09:30 12:05 16:35, "[Outgoing] · [PMPML] · via Dehu Road · Route 342", true
Urse Gaon, उर्से गाव, 07:15 09:10 11:45 16:20, "[Incoming] · [PMPML] · via Parandwadi", true`;

export function BusBulkImportModal({
  open,
  cityId,
  cityName,
  existingCount,
  existingDestinations = [],
  onClose,
  onImported,
}: BusBulkImportModalProps) {
  const [text, setText] = useState('');
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { valid, errors } = useMemo(() => parseBulkBusCsv(text), [text]);

  const { readyRows, duplicateIndices } = useMemo(() => {
    const existingSet = new Set(existingDestinations.map((d) => d.trim().toLowerCase()));
    const seen = new Set<string>();
    const dupes = new Set<number>();

    valid.forEach((r, idx) => {
      const key = r.destination.trim().toLowerCase();
      if (existingSet.has(key) || seen.has(key)) {
        dupes.add(idx);
      } else {
        seen.add(key);
      }
    });

    const filtered = skipDuplicates ? valid.filter((_, idx) => !dupes.has(idx)) : valid;
    return { readyRows: filtered, duplicateIndices: dupes };
  }, [valid, existingDestinations, skipDuplicates]);

  if (!open) return null;

  const handlePasteSample = () => {
    setText(SAMPLE_CSV);
    toast.info('Sample timetable template loaded');
  };

  const handleDownloadTemplate = () => {
    downloadCsvText('bus_timetable_template.csv', SAMPLE_CSV, false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv') && !file.name.toLowerCase().endsWith('.tsv') && file.type !== 'text/csv') {
      toast.error('Please upload a .csv or .tsv file');
      return;
    }
    try {
      const csvText = await file.text();
      setText(csvText);
      toast.success(`Loaded ${file.name}`);
      if (fileRef.current) fileRef.current.value = '';
    } catch {
      toast.error('Could not read file');
    }
  };

  const handleImport = async () => {
    if (readyRows.length === 0) {
      toast.error('No valid routes to import');
      return;
    }
    setImporting(true);
    try {
      const payload = readyRows.map((r, i) => ({
        city_id: cityId,
        destination: r.destination,
        destination_mr: r.destination_mr || null,
        departure_times: r.departure_times,
        notes: r.notes || null,
        sort_order: existingCount + i + 1,
        is_active: r.is_active ?? true,
      }));

      const { error } = await supabase.from('bus_timetable').insert(payload);
      if (error) throw error;

      toast.success(`Successfully imported ${readyRows.length} bus route(s) for ${cityName}!`);
      onImported();
      onClose();
    } catch (err: unknown) {
      console.error('[BusBulkImportModal] Import error:', err);
      const msg = err instanceof Error
        ? err.message
        : (typeof err === 'object' && err !== null && 'message' in err ? String((err as { message?: unknown }).message) : 'Failed to import routes');
      toast.error(msg || 'Failed to import routes');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-background border border-border w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90dvh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 sm:px-5 py-3.5 border-b border-border bg-card flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Upload className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm sm:text-base text-foreground truncate">
                Bulk Import Timetable — {cityName}
              </h3>
              <p className="text-[11px] text-muted-foreground truncate">
                Upload a CSV file or paste spreadsheet columns to add multiple routes at once
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 overflow-y-auto overscroll-contain space-y-4 flex-1 min-h-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20 text-xs font-semibold cursor-pointer hover:bg-primary/15 transition-colors">
                <Upload className="w-3.5 h-3.5" />
                <span>Choose CSV File</span>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.tsv,text/csv"
                  onChange={handleFileUpload}
                  className="sr-only"
                />
              </label>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card text-foreground hover:bg-muted text-xs font-semibold transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Template CSV</span>
              </button>
            </div>
            <button
              type="button"
              onClick={handlePasteSample}
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-semibold shrink-0"
            >
              <Sparkles className="w-3 h-3" /> Fill sample
            </button>
          </div>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={7}
            placeholder={`Destination, Marathi Name, Departure Times, Notes, Active\nJalgaon, जळगाव, 06:00 07:15 09:30, "[Outgoing] · via Bhusawal", true\nNigdi, निगडी, 07:30 12:05, "[PMPML] · via Somatane Phata, Dehu Road", true`}
            className="w-full px-3.5 py-3 rounded-xl border border-input bg-background text-sm font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />

          {/* Real-time Validation Summary */}
          {text.trim() && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {readyRows.length} ready route{readyRows.length !== 1 ? 's' : ''}
                  </span>
                  {duplicateIndices.size > 0 && (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <SkipForward className="w-3.5 h-3.5" />
                      {duplicateIndices.size} duplicate{duplicateIndices.size !== 1 ? 's' : ''}
                    </span>
                  )}
                  {errors.length > 0 && (
                    <span className="flex items-center gap-1 text-destructive">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {errors.length} skipped / issue{errors.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                {duplicateIndices.size > 0 && (
                  <label className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={skipDuplicates}
                      onChange={(e) => setSkipDuplicates(e.target.checked)}
                      className="rounded border-border"
                    />
                    Skip existing routes
                  </label>
                )}
              </div>

              {/* Preview List */}
              {valid.length > 0 && (
                <div className="max-h-48 overflow-y-auto rounded-xl border border-border divide-y divide-border bg-card/60 text-xs">
                  {valid.map((r, i) => {
                    const isDupe = duplicateIndices.has(i);
                    return (
                      <div key={i} className={`p-2.5 flex flex-wrap items-baseline justify-between gap-2 ${isDupe && skipDuplicates ? 'opacity-50 bg-muted/40' : ''}`}>
                        <div className="min-w-0 flex-1">
                          <span className="font-bold text-foreground break-words">{r.destination}</span>
                          {r.destination_mr && (
                            <span className="ml-1.5 text-muted-foreground font-normal">
                              ({r.destination_mr})
                            </span>
                          )}
                          {isDupe && (
                            <span className="ml-1.5 text-[9px] px-1.5 py-0.2 rounded bg-muted text-muted-foreground border border-border">
                              Duplicate
                            </span>
                          )}
                          {!r.is_active && (
                            <span className="ml-1.5 text-[9px] px-1.5 py-0.2 rounded bg-muted text-muted-foreground border border-border">
                              Hidden
                            </span>
                          )}
                          {r.notes && (
                            <p className="text-[11px] text-muted-foreground truncate">{r.notes}</p>
                          )}
                        </div>
                        <div className="text-left sm:text-right max-w-full">
                          <span className="font-mono text-[11px] text-primary break-words">
                            {r.departure_times.join(', ')}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Error messages if any */}
              {errors.length > 0 && (
                <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive space-y-1">
                  {errors.slice(0, 4).map((err, i) => (
                    <p key={i}>
                      Line {err.line}: {err.message}
                    </p>
                  ))}
                  {errors.length > 4 && (
                    <p className="text-[10px] text-muted-foreground">
                      +{errors.length - 4} more skipped lines
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] border-t border-border bg-card flex flex-wrap items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-muted-foreground hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={readyRows.length === 0 || importing}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 disabled:opacity-50"
          >
            {importing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Import {readyRows.length} Route{readyRows.length !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
