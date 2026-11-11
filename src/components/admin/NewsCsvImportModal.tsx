import { useState, useRef } from 'react';
import { Loader2, X, Upload, Download, CheckCircle2, AlertCircle, SkipForward, Newspaper } from 'lucide-react';
import { toast } from 'sonner';
import { downloadCsvText, parseCsv } from '@/lib/csvUtils';
import { saveNewsItem } from '@/lib/news/newsService';
import { NEWS_CATEGORIES, type LocalNewsItem, type NewsCategory, type NewsLanguage } from '@/lib/news/newsTypes';

type RowStatus = 'ready' | 'duplicate' | 'error';

interface ParsedNewsRow {
  title: string;
  titleMr: string;
  summary: string;
  summaryMr: string;
  category: NewsCategory;
  language: NewsLanguage;
  sourceName: string;
  sourceUrl: string;
  imageUrl: string;
  publishedAtIso: string;
  isPinned: boolean;
  isActive: boolean;
  status: RowStatus;
  messages: string[];
}

const VALID_CATEGORIES = new Set<string>(NEWS_CATEGORIES.map((c) => c.value));

function parseBool(val: string | undefined, defaultVal: boolean): boolean {
  const s = (val || '').trim().toLowerCase();
  if (!s) return defaultVal;
  if (s === 'yes' || s === 'true' || s === '1') return true;
  if (s === 'no' || s === 'false' || s === '0') return false;
  return defaultVal;
}

function downloadTemplate() {
  const headers = [
    'Title',
    'Title (Marathi)',
    'Summary',
    'Summary (Marathi)',
    'Category',
    'Language',
    'Source Name',
    'Source URL',
    'Image URL',
    'Published At',
    'Pinned',
    'Active',
  ].join(',');
  const sample = [
    '"New Drinking Water Pipeline Inaugurated"',
    '"नवीन पिण्याच्या पाण्याच्या योजनेचे लोकार्पण"',
    '"Municipal council completed Phase 1 of the town water supply upgrade."',
    '"नगरपंचायतीच्या पाणी पुरवठा योजनेचा पहिला टप्पा पूर्ण."',
    '"civic"',
    '"mr"',
    '"Town Desk"',
    '"https://example.com/news/water-pipeline"',
    '""',
    `"${new Date().toISOString()}"`,
    '"No"',
    '"Yes"',
  ].join(',');
  downloadCsvText('apnatown_news_template.csv', `${headers}\n${sample}`, false);
}

interface Props {
  cityId: string;
  cityName: string;
  existingItems: LocalNewsItem[];
  onClose: () => void;
  onDone: () => void;
}

export function NewsCsvImportModal({ cityId, cityName, existingItems, onClose, onDone }: Props) {
  const [step, setStep] = useState<'upload' | 'preview' | 'result'>('upload');
  const [rows, setRows] = useState<ParsedNewsRow[]>([]);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; skippedDupes: number; skippedErrors: number; failed: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const processCsv = (csvText: string) => {
    const rawRows = parseCsv(csvText);
    if (rawRows.length === 0) {
      toast.error('CSV has no data rows');
      setParsing(false);
      return;
    }

    const existingUrls = new Set(existingItems.map((i) => (i.source_url || '').trim().toLowerCase()).filter(Boolean));
    const existingTitles = new Set(existingItems.map((i) => i.title.trim().toLowerCase()));
    const seenUrls = new Set<string>();
    const seenTitles = new Set<string>();

    const processed: ParsedNewsRow[] = rawRows.map((raw) => {
      const title = (raw['title'] || raw['headline'] || '').trim();
      const titleMr = (raw['title (marathi)'] || raw['title_mr'] || raw['marathi headline'] || '').trim();
      const summary = (raw['summary'] || raw['description'] || '').trim();
      const summaryMr = (raw['summary (marathi)'] || raw['summary_mr'] || '').trim();

      const catRaw = (raw['category'] || 'local').trim().toLowerCase();
      const category: NewsCategory = VALID_CATEGORIES.has(catRaw) ? (catRaw as NewsCategory) : 'local';

      const langRaw = (raw['language'] || 'mr').trim().toLowerCase();
      const language: NewsLanguage = langRaw === 'en' || langRaw === 'hi' ? langRaw : 'mr';

      const sourceName = (raw['source name'] || raw['source_name'] || raw['source'] || '').trim() || 'Town Desk';
      const sourceUrl = (raw['source url'] || raw['source_url'] || raw['url'] || '').trim();
      const imageUrl = (raw['image url'] || raw['image_url'] || '').trim();
      const pubRaw = (raw['published at'] || raw['published_at'] || raw['date'] || '').trim();
      const isPinned = parseBool(raw['pinned'] || raw['is_pinned'], false);
      const isActive = parseBool(raw['active'] || raw['is_active'], true);

      const messages: string[] = [];
      let status: RowStatus = 'ready';
      let publishedAtIso = new Date().toISOString();

      if (!title) {
        messages.push('Headline / Title is required');
        status = 'error';
      }

      if (pubRaw) {
        const d = new Date(pubRaw);
        if (Number.isNaN(d.getTime())) {
          messages.push(`Invalid Published At date "${pubRaw}"`);
          status = 'error';
        } else {
          publishedAtIso = d.toISOString();
        }
      }

      if (status !== 'error') {
        const normUrl = sourceUrl.toLowerCase();
        const normTitle = title.toLowerCase();
        if (
          (normUrl && (existingUrls.has(normUrl) || seenUrls.has(normUrl))) ||
          existingTitles.has(normTitle) ||
          seenTitles.has(normTitle)
        ) {
          status = 'duplicate';
          messages.push('Duplicate headline or source URL in town feed');
        }
        if (normUrl) seenUrls.add(normUrl);
        if (normTitle) seenTitles.add(normTitle);
      }

      if (status === 'ready') messages.push('Ready to publish');

      return {
        title,
        titleMr,
        summary,
        summaryMr,
        category,
        language,
        sourceName,
        sourceUrl,
        imageUrl,
        publishedAtIso,
        isPinned,
        isActive,
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

  const importable = rows.filter((r) => r.status === 'ready' || (!skipDuplicates && r.status === 'duplicate'));
  const dupeCount = rows.filter((r) => r.status === 'duplicate').length;
  const errCount = rows.filter((r) => r.status === 'error').length;

  const handleImport = async () => {
    setImporting(true);
    let imported = 0;
    let failed = 0;
    for (const row of importable) {
      try {
        await saveNewsItem({
          city_id: cityId,
          title: row.title,
          title_mr: row.titleMr || null,
          summary: row.summary || null,
          summary_mr: row.summaryMr || null,
          category: row.category,
          language: row.language,
          source_name: row.sourceName,
          source_url: row.sourceUrl || null,
          image_url: row.imageUrl || null,
          published_at: row.publishedAtIso,
          is_pinned: row.isPinned,
          is_active: row.isActive,
        });
        imported++;
      } catch {
        failed++;
      }
    }

    setResult({
      imported,
      skippedDupes: skipDuplicates ? dupeCount : 0,
      skippedErrors: errCount,
      failed,
    });
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
            <Newspaper className="w-5 h-5 text-primary shrink-0" />
            <h2 className="font-bold text-base sm:text-lg text-foreground truncate">Import Local News CSV ({cityName})</h2>
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
                <li>Imports news articles directly into <strong className="text-foreground">{cityName}</strong> (syncing to Supabase or local cache).</li>
                <li>Deduplicates by <code className="text-[11px]">source_url</code> and exact headline to respect unique constraints.</li>
                <li>Supports multi-line summaries and UTF-8 Devanagari headlines.</li>
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
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-success/10 text-success border border-success/30">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {rows.filter((r) => r.status === 'ready').length} Ready
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-700 border border-amber-500/30">
                  <SkipForward className="w-3.5 h-3.5" /> {dupeCount} Duplicates
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-destructive/10 text-destructive border border-destructive/30">
                  <AlertCircle className="w-3.5 h-3.5" /> {errCount} Errors
                </span>
              </div>
              {dupeCount > 0 && (
                <label className="flex items-center gap-2 text-xs font-semibold text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={skipDuplicates}
                    onChange={(e) => setSkipDuplicates(e.target.checked)}
                    className="rounded accent-primary"
                  />
                  Skip duplicates
                </label>
              )}
            </div>

            <div className="rounded-xl border border-border overflow-hidden">
              <div className="overflow-x-auto max-h-80 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-muted/90 border-b border-border">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold">#</th>
                      <th className="text-left px-3 py-2 font-semibold">Article</th>
                      <th className="text-left px-3 py-2 font-semibold">Category</th>
                      <th className="text-left px-3 py-2 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rows.map((r, i) => (
                      <tr key={i} className={r.status === 'error' ? 'bg-destructive/5' : ''}>
                        <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                        <td className="px-3 py-2">
                          <div className="font-semibold text-foreground line-clamp-1">{r.title || <span className="text-destructive italic">missing</span>}</div>
                          <div className="text-[11px] text-muted-foreground">{r.sourceName} · {r.publishedAtIso.slice(0, 10)}</div>
                          {r.messages.filter((m) => m !== 'Ready to publish').map((m, k) => (
                            <div key={k} className="text-[11px] text-amber-700 dark:text-amber-300">{m}</div>
                          ))}
                        </td>
                        <td className="px-3 py-2 capitalize">{r.category} ({r.language})</td>
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
                {importing ? <><Loader2 className="w-4 h-4 animate-spin" /> Importing...</> : `Publish ${importable.length} Articles`}
              </button>
            </div>
          </div>
        )}

        {step === 'result' && result && (
          <div className="p-4 sm:p-6 space-y-5">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-7 h-7 text-success shrink-0" />
              <div>
                <p className="font-bold text-lg text-foreground">News Import Complete</p>
                <p className="text-xs text-muted-foreground">Articles are live in {cityName}.</p>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-muted/20 divide-y divide-border text-sm">
              <div className="flex justify-between px-4 py-2.5"><span>Published</span><strong>{result.imported}</strong></div>
              <div className="flex justify-between px-4 py-2.5"><span>Skipped (duplicates)</span><strong>{result.skippedDupes}</strong></div>
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
