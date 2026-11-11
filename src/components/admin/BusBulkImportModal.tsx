import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { FileText, Upload, AlertCircle, CheckCircle2, X, Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { parseBulkBusCsv, type ParsedBulkBusRow } from '@/lib/bus/busHelpers';

interface BusBulkImportModalProps {
  open: boolean;
  cityId: string;
  cityName: string;
  existingCount: number;
  onClose: () => void;
  onImported: () => void;
}

const SAMPLE_CSV = `Destination, Marathi Name, Departure Times, Notes
Jalgaon, जळगाव, 06:00 07:15 09:30 14:00 17:30, [Outgoing] · [MSRTC Ordinary] · via Bhusawal
Pune Station, पुणे स्टेशन, 21:00 22:30, [Outgoing] · [Express] · via Somatane Phata
Nigdi, निगडी, 07:30 09:30 12:05 16:35, [Outgoing] · [PMPML] · via Dehu Road · Route 342
Urse Gaon, उर्से गाव, 07:15 09:10 11:45 16:20, [Incoming] · [PMPML] · via Parandwadi`;

export function BusBulkImportModal({
  open,
  cityId,
  cityName,
  existingCount,
  onClose,
  onImported,
}: BusBulkImportModalProps) {
  const [text, setText] = useState('');
  const [importing, setImporting] = useState(false);

  const { valid, errors } = useMemo(() => parseBulkBusCsv(text), [text]);

  if (!open) return null;

  const handlePasteSample = () => {
    setText(SAMPLE_CSV);
    toast.info('Sample timetable template loaded');
  };

  const handleImport = async () => {
    if (valid.length === 0) {
      toast.error('No valid routes to import');
      return;
    }
    setImporting(true);
    try {
      const payload = valid.map((r, i) => ({
        city_id: cityId,
        destination: r.destination,
        destination_mr: r.destination_mr || null,
        departure_times: r.departure_times,
        notes: r.notes || null,
        sort_order: existingCount + i + 1,
        is_active: true,
      }));

      const { error } = await supabase.from('bus_timetable').insert(payload);
      if (error) throw error;

      toast.success(`Successfully imported ${valid.length} bus routes for ${cityName}!`);
      onImported();
      onClose();
    } catch (err: any) {
      console.error('[BusBulkImportModal] Import error:', err);
      toast.error(err?.message || 'Failed to import routes');
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
        className="bg-background border border-border w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-border bg-card flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-foreground">
                Bulk Import Timetable — {cityName}
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Paste spreadsheet columns or CSV lines to add multiple routes at once
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-muted text-muted-foreground"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-foreground">
              Format: Destination, Marathi Name, Times, Notes / Operator / Via
            </span>
            <button
              type="button"
              onClick={handlePasteSample}
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-semibold"
            >
              <Sparkles className="w-3 h-3" /> Fill sample
            </button>
          </div>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={7}
            placeholder={`Jalgaon, जळगाव, 06:00 07:15 09:30, [Outgoing] · via Bhusawal\nPune, पुणे, 21:00 22:30, [Express]\nNigdi, निगडी, 07:30 12:05, [PMPML]`}
            className="w-full px-3.5 py-3 rounded-xl border border-input bg-background text-sm font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />

          {/* Real-time Validation Summary */}
          {text.trim() && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-xs font-semibold">
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {valid.length} valid route{valid.length !== 1 ? 's' : ''} detected
                </span>
                {errors.length > 0 && (
                  <span className="flex items-center gap-1 text-destructive">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {errors.length} skipped / issue{errors.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {/* Preview List */}
              {valid.length > 0 && (
                <div className="max-h-48 overflow-y-auto rounded-xl border border-border divide-y divide-border bg-card/60 text-xs">
                  {valid.map((r, i) => (
                    <div key={i} className="p-2.5 flex items-baseline justify-between gap-3">
                      <div className="min-w-0">
                        <span className="font-bold text-foreground">{r.destination}</span>
                        {r.destination_mr && (
                          <span className="ml-1.5 text-muted-foreground font-normal">
                            ({r.destination_mr})
                          </span>
                        )}
                        {r.notes && (
                          <p className="text-[11px] text-muted-foreground truncate">{r.notes}</p>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="font-mono text-[11px] text-primary">
                          {r.departure_times.join(', ')}
                        </span>
                      </div>
                    </div>
                  ))}
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
        <div className="px-5 py-3 border-t border-border bg-card flex items-center justify-end gap-2.5">
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
            disabled={valid.length === 0 || importing}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 disabled:opacity-50"
          >
            {importing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Import {valid.length} Routes
          </button>
        </div>
      </div>
    </div>
  );
}
