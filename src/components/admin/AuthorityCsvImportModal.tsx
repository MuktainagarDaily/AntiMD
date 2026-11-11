import { useState, useRef } from 'react';
import { Loader2, X, Upload, Download, CheckCircle2, AlertCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { downloadCsvText, parseCsv } from '@/lib/csvUtils';
import { resolveDepartmentUuid, saveAnnouncement } from '@/lib/services/authorityService';
import type {
  AnnouncementCategory,
  AnnouncementPriority,
  AnnouncementStatus,
  AuthorityDepartment,
} from '@/lib/services/authorityTypes';

type RowStatus = 'ready' | 'error';

interface ParsedAnnouncementRow {
  departmentId: string;
  departmentName: string;
  title: string;
  titleMr: string;
  description: string;
  descriptionMr: string;
  category: AnnouncementCategory;
  priority: AnnouncementPriority;
  statusField: AnnouncementStatus;
  startTimeIso: string | null;
  endTimeIso: string | null;
  areaText: string;
  status: RowStatus;
  messages: string[];
}

const VALID_CATEGORIES = new Set<string>(['interruption', 'maintenance', 'emergency', 'advisory', 'notice']);
const VALID_PRIORITIES = new Set<string>(['low', 'medium', 'high', 'critical']);
const VALID_STATUSES = new Set<string>(['active', 'scheduled', 'completed', 'draft']);

function downloadTemplate() {
  const headers = [
    'Department',
    'Title',
    'Title (Marathi)',
    'Description',
    'Description (Marathi)',
    'Category',
    'Priority',
    'Status',
    'Start Time',
    'End Time',
    'Affected Areas',
  ].join(',');
  const start = new Date(Date.now() + 2 * 3600 * 1000).toISOString();
  const end = new Date(Date.now() + 6 * 3600 * 1000).toISOString();
  const sample = [
    '"electricity"',
    '"Scheduled Feeder Maintenance - Ward 4"',
    '"प्रभाग ४ फिडर देखभाल काम"',
    '"Power supply will remain suspended between 10 AM and 2 PM for feeder maintenance."',
    '"फिडर दुरुस्तीमुळे सकाळी १० ते दुपारी २ वीजपुरवठा बंद राहील."',
    '"maintenance"',
    '"high"',
    '"scheduled"',
    `"${start}"`,
    `"${end}"`,
    '"Ward No. 4, College Road"',
  ].join(',');
  downloadCsvText('apnatown_civic_announcements_template.csv', `${headers}\n${sample}`, false);
}

interface Props {
  cityId: string;
  cityName: string;
  departments: AuthorityDepartment[];
  onClose: () => void;
  onDone: () => void;
}

export function AuthorityCsvImportModal({ cityId, cityName, departments, onClose, onDone }: Props) {
  const [step, setStep] = useState<'upload' | 'preview' | 'result'>('upload');
  const [rows, setRows] = useState<ParsedAnnouncementRow[]>([]);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; skippedErrors: number; failed: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const resolveDept = (rawDept: string): AuthorityDepartment | undefined => {
    const clean = rawDept.trim().toLowerCase();
    if (!clean) return departments[0];
    const direct = departments.find(
      (d) =>
        d.slug.toLowerCase() === clean ||
        d.name.toLowerCase() === clean ||
        d.id === rawDept.trim(),
    );
    if (direct) return direct;
    const uuid = resolveDepartmentUuid(clean);
    return departments.find((d) => d.id === uuid) || departments[0];
  };

  const processCsv = (csvText: string) => {
    const rawRows = parseCsv(csvText);
    if (rawRows.length === 0) {
      toast.error('CSV has no data rows');
      setParsing(false);
      return;
    }

    const processed: ParsedAnnouncementRow[] = rawRows.map((raw) => {
      const deptRaw = (raw['department'] || 'water').trim();
      const dept = resolveDept(deptRaw);
      const departmentId = dept?.id || resolveDepartmentUuid(deptRaw);
      const departmentName = dept?.name || deptRaw || 'Department';

      const title = (raw['title'] || '').trim();
      const titleMr = (raw['title (marathi)'] || raw['title_mr'] || '').trim() || title;
      const description = (raw['description'] || '').trim();
      const descriptionMr = (raw['description (marathi)'] || raw['description_mr'] || '').trim() || description;

      const catRaw = (raw['category'] || 'interruption').trim().toLowerCase();
      const category: AnnouncementCategory = VALID_CATEGORIES.has(catRaw) ? (catRaw as AnnouncementCategory) : 'notice';

      const prioRaw = (raw['priority'] || 'medium').trim().toLowerCase();
      const priority: AnnouncementPriority = VALID_PRIORITIES.has(prioRaw) ? (prioRaw as AnnouncementPriority) : 'medium';

      const stRaw = (raw['status'] || 'active').trim().toLowerCase();
      const statusField: AnnouncementStatus = VALID_STATUSES.has(stRaw) ? (stRaw as AnnouncementStatus) : 'active';

      const startRaw = (raw['start time'] || raw['start_time'] || '').trim();
      const endRaw = (raw['end time'] || raw['end_time'] || '').trim();
      const areaText = (raw['affected areas'] || raw['areas'] || raw['area_text'] || '').trim() || 'Town-wide';

      const messages: string[] = [];
      let status: RowStatus = 'ready';
      let startTimeIso: string | null = null;
      let endTimeIso: string | null = null;

      if (!title) {
        messages.push('Title is required');
        status = 'error';
      }

      if (startRaw) {
        const d = new Date(startRaw);
        if (Number.isNaN(d.getTime())) {
          messages.push(`Invalid Start Time "${startRaw}"`);
          status = 'error';
        } else {
          startTimeIso = d.toISOString();
        }
      }

      if (endRaw) {
        const d = new Date(endRaw);
        if (Number.isNaN(d.getTime())) {
          messages.push(`Invalid End Time "${endRaw}"`);
          status = 'error';
        } else {
          endTimeIso = d.toISOString();
        }
      }

      if (status === 'ready') messages.push('Ready to broadcast');

      return {
        departmentId,
        departmentName,
        title,
        titleMr,
        description,
        descriptionMr,
        category,
        priority,
        statusField,
        startTimeIso,
        endTimeIso,
        areaText,
        status,
        messages,
      };
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
    processCsv(csvText);
  };

  const importable = rows.filter((r) => r.status === 'ready');
  const errCount = rows.filter((r) => r.status === 'error').length;

  const handleImport = async () => {
    setImporting(true);
    let imported = 0;
    let failed = 0;
    for (const row of importable) {
      try {
        await saveAnnouncement({
          city_id: cityId,
          department_id: row.departmentId,
          title: row.title,
          title_mr: row.titleMr,
          description: row.description,
          description_mr: row.descriptionMr,
          category: row.category,
          priority: row.priority,
          status: row.statusField,
          start_time: row.startTimeIso,
          end_time: row.endTimeIso,
          is_demo: false,
          locations: [
            {
              city_id: cityId,
              village_id: null,
              area_text: row.areaText,
            },
          ],
        });
        imported++;
      } catch {
        failed++;
      }
    }

    setResult({ imported, skippedErrors: errCount, failed });
    setImporting(false);
    setStep('result');
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
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <h2 className="font-bold text-base sm:text-lg text-foreground truncate">Import Civic Outages &amp; Notices ({cityName})</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 hover:bg-muted rounded-lg shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {step === 'upload' && (
          <div className="p-4 sm:p-6 space-y-5 overflow-y-auto flex-1 min-h-0">
            <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2 text-xs text-muted-foreground">
              <p className="text-sm font-semibold text-foreground">How it works</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Bulk schedule water, electricity (MSEDCL), or municipal notices for <strong className="text-foreground">{cityName}</strong>.</li>
                <li>Valid Departments: <code className="text-[11px]">water</code>, <code className="text-[11px]">electricity</code>, <code className="text-[11px]">municipal</code>.</li>
                <li>Categories: <code className="text-[11px]">interruption | maintenance | emergency | advisory | notice</code>. Priorities: <code className="text-[11px]">low | medium | high | critical</code>.</li>
              </ul>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 items-start">
              <button
                onClick={downloadTemplate}
                className="flex items-center gap-2 border border-border bg-background text-foreground px-4 py-2.5 rounded-lg font-semibold text-sm hover:bg-muted transition-colors"
              >
                <Download className="w-4 h-4" /> Download Template CSV
              </button>
              <label className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg font-semibold text-sm hover:bg-primary/90 transition-colors cursor-pointer">
                {parsing ? <><Loader2 className="w-4 h-4 animate-spin" /> Parsing...</> : <><Upload className="w-4 h-4" /> Choose CSV File</>}
                <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleFileChange} className="sr-only" disabled={parsing} />
              </label>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 min-h-0">
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-success/10 text-success border border-success/30">
                <CheckCircle2 className="w-3.5 h-3.5" /> {importable.length} Ready
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-destructive/10 text-destructive border border-destructive/30">
                <AlertCircle className="w-3.5 h-3.5" /> {errCount} Errors
              </span>
            </div>

            <div className="rounded-xl border border-border overflow-hidden">
              <div className="overflow-x-auto max-h-80 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-muted/90 border-b border-border">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold">#</th>
                      <th className="text-left px-3 py-2 font-semibold">Announcement</th>
                      <th className="text-left px-3 py-2 font-semibold">Dept &amp; Priority</th>
                      <th className="text-left px-3 py-2 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rows.map((r, i) => (
                      <tr key={i} className={r.status === 'error' ? 'bg-destructive/5' : ''}>
                        <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                        <td className="px-3 py-2">
                          <div className="font-semibold text-foreground">{r.title || <span className="text-destructive italic">missing</span>}</div>
                          <div className="text-[11px] text-muted-foreground">{r.areaText}</div>
                          {r.messages.filter((m) => m !== 'Ready to broadcast').map((m, k) => (
                            <div key={k} className="text-[11px] text-destructive">{m}</div>
                          ))}
                        </td>
                        <td className="px-3 py-2 capitalize">
                          <div>{r.departmentName}</div>
                          <div className="text-muted-foreground">{r.priority} · {r.statusField}</div>
                        </td>
                        <td className="px-3 py-2 capitalize font-semibold">{r.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => { setRows([]); setStep('upload'); }} className="flex-1 py-2.5 border border-border rounded-xl font-semibold text-sm">← Back</button>
              <button
                onClick={handleImport}
                disabled={importing || importable.length === 0}
                className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-xl font-bold text-sm disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {importing ? <><Loader2 className="w-4 h-4 animate-spin" /> Importing...</> : `Publish ${importable.length} Notices`}
              </button>
            </div>
          </div>
        )}

        {step === 'result' && result && (
          <div className="p-4 sm:p-6 space-y-5">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-7 h-7 text-success shrink-0" />
              <div>
                <p className="font-bold text-lg text-foreground">Announcements Imported</p>
                <p className="text-xs text-muted-foreground">Broadcast list updated for {cityName}.</p>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-muted/20 divide-y divide-border text-sm">
              <div className="flex justify-between px-4 py-2.5"><span>Published</span><strong>{result.imported}</strong></div>
              <div className="flex justify-between px-4 py-2.5"><span>Skipped (errors)</span><strong>{result.skippedErrors}</strong></div>
              <div className="flex justify-between px-4 py-2.5"><span>Failed</span><strong>{result.failed}</strong></div>
            </div>
            <button onClick={onDone} className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl font-bold text-sm">Done</button>
          </div>
        )}
      </div>
    </div>
  );
}
