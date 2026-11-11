import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Upload, AlertCircle, CheckCircle2, X, Sparkles, Loader2, GraduationCap } from 'lucide-react';
import { toast } from 'sonner';
import {
  parseBulkSchoolCsv,
  toDbSchoolType,
  SCHOOL_TYPE_CONFIG,
  SCHOOL_MEDIUM_CONFIG,
  type ParsedBulkSchoolRow,
} from '@/lib/schools/schoolHelpers';

interface SchoolBulkImportModalProps {
  open: boolean;
  cityId: string;
  cityName: string;
  districtId?: string | null;
  stateId?: string | null;
  onClose: () => void;
  onImported: () => void;
}

const SAMPLE_CSV = `Name, Marathi Name, Type, Medium, Area, Phone, Notes
Z.P. Primary School, जि.प. प्राथमिक शाळा, Primary, Marathi, Station Road, 02583-234000, State Board
Muktainagar High School & Jr College, मुक्ताईनगर हायस्कूल, Junior College, Semi-English, College Road, 02583-234250, State Board · Science & Commerce
Smt. G.G. Khadse Senior College, श्रीमती जी. जी. खडसे महाविद्यालय, College, Marathi, Highway Campus, 02583-234408, KBCNMU affiliated
Government ITI, शासकीय औद्योगिक प्रशिक्षण संस्था, ITI, Marathi, MIDC Area, 02583-234789, DTE technical trades
D.Y. Patil College of Engineering, डी.वाय. पाटील इंजिनिअरिंग, Engineering, English, Varale / Ambi, 02114-673351, SPPU affiliated`;

export function SchoolBulkImportModal({
  open,
  cityId,
  cityName,
  districtId,
  stateId,
  onClose,
  onImported,
}: SchoolBulkImportModalProps) {
  const [text, setText] = useState('');
  const [importing, setImporting] = useState(false);

  const { valid, errors } = useMemo(() => parseBulkSchoolCsv(text), [text]);

  if (!open) return null;

  const handlePasteSample = () => {
    setText(SAMPLE_CSV);
    toast.info('Sample educational institutes template loaded');
  };

  const handleImport = async () => {
    if (valid.length === 0) {
      toast.error('No valid institutes to import');
      return;
    }
    setImporting(true);
    try {
      const payload = valid.map((r) => {
        const dbType = toDbSchoolType(r.school_type);
        let finalDesc = r.description || '';
        if (r.school_type !== dbType && !finalDesc.includes('[Type:')) {
          finalDesc = `[Type: ${r.school_type}]${finalDesc ? ' · ' + finalDesc : ''}`;
        }

        return {
          city_id: cityId,
          district_id: districtId || null,
          state_id: stateId || null,
          name: r.name,
          name_mr: r.name_mr || null,
          school_type: dbType,
          medium: r.medium || null,
          area: r.area || null,
          phone: r.phone || null,
          description: finalDesc || null,
          is_active: true,
        };
      });

      const { error } = await (supabase as any).from('schools').insert(payload);
      if (error) throw error;

      toast.success(`Successfully imported ${valid.length} institutes for ${cityName}!`);
      onImported();
      onClose();
    } catch (err: any) {
      console.error('[SchoolBulkImportModal] Import error:', err);
      toast.error(err?.message || 'Failed to import institutes');
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
                Bulk Import Institutes — {cityName}
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Paste spreadsheet rows (CSV / TSV) to add schools, colleges, or ITIs in bulk
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-muted text-muted-foreground"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-foreground">
              Paste Spreadsheet Rows (CSV, Tab-delimited, or Pipe):
            </label>
            <button
              type="button"
              onClick={handlePasteSample}
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Fill Sample Template
            </button>
          </div>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={7}
            placeholder={`Format: Name, Marathi Name, Type, Medium, Area, Phone, Notes\nExample:\nZ.P. Primary School, जि.प. शाळा, Primary, Marathi, Station Road, 9822000000, State Board\nGovernment ITI, शासकीय ITI, ITI, Marathi, MIDC Area, 02583-234789, Technical trades`}
            className="w-full p-3 font-mono text-xs rounded-xl border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />

          {/* Real-time Parser Feedback */}
          {text.trim() && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                  <CheckCircle2 className="w-4 h-4" />
                  {valid.length} Valid {valid.length === 1 ? 'Institute' : 'Institutes'}
                </span>
                {errors.length > 0 && (
                  <span className="flex items-center gap-1 text-destructive font-semibold">
                    <AlertCircle className="w-4 h-4" />
                    {errors.length} {errors.length === 1 ? 'Issue' : 'Issues'}
                  </span>
                )}
              </div>

              {/* Error messages if any */}
              {errors.length > 0 && (
                <div className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-[11px] text-destructive space-y-1">
                  {errors.slice(0, 4).map((err, idx) => (
                    <div key={idx}>
                      Line {err.line}: {err.message}
                    </div>
                  ))}
                  {errors.length > 4 && <div>...and {errors.length - 4} more error(s)</div>}
                </div>
              )}

              {/* Preview List */}
              {valid.length > 0 && (
                <div className="border border-border rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                  <table className="w-full text-[11px] text-left">
                    <thead className="bg-muted text-muted-foreground uppercase text-[10px] sticky top-0">
                      <tr>
                        <th className="px-3 py-1.5">Name</th>
                        <th className="px-2 py-1.5">Category</th>
                        <th className="px-2 py-1.5">Medium</th>
                        <th className="px-2 py-1.5">Area</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {valid.map((row, i) => {
                        const typeCfg =
                          SCHOOL_TYPE_CONFIG[row.school_type] ||
                          SCHOOL_TYPE_CONFIG.other;
                        const medCfg = row.medium
                          ? SCHOOL_MEDIUM_CONFIG[row.medium]
                          : null;

                        return (
                          <tr key={i} className="hover:bg-muted/40">
                            <td className="px-3 py-1.5 font-medium text-foreground">
                              {row.name}
                              {row.name_mr && (
                                <span className="block text-[10px] text-muted-foreground">
                                  {row.name_mr}
                                </span>
                              )}
                            </td>
                            <td className="px-2 py-1.5">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] border ${typeCfg.badgeClass}`}
                              >
                                {typeCfg.labelMr}
                              </span>
                            </td>
                            <td className="px-2 py-1.5 text-muted-foreground">
                              {medCfg?.labelMr || '—'}
                            </td>
                            <td className="px-2 py-1.5 text-muted-foreground">
                              {row.area || '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border bg-card flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            disabled={importing}
            className="px-3 py-1.5 rounded-lg border border-input text-xs font-semibold hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={importing || valid.length === 0}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-50"
          >
            {importing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="w-3.5 h-3.5" />
                Import {valid.length} {valid.length === 1 ? 'Institute' : 'Institutes'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
