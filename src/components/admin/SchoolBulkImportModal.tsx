import { useState, useMemo, useRef } from 'react';
import { Upload, Download, AlertCircle, CheckCircle2, X, Sparkles, Loader2, SkipForward } from 'lucide-react';
import { toast } from 'sonner';
import { schoolsRepo, type SchoolRow } from '@/lib/repos/schoolsRepo';
import { normalizePhone } from '@/lib/shopUtils';
import { normalizeWhatsApp } from './adminHelpers';
import { buildCsvString, downloadCsvText } from '@/lib/csvUtils';
import {
  parseBulkSchoolCsv,
  toDbSchoolType,
  serializeSchoolDescription,
  SCHOOL_CSV_EXPORT_HEADERS,
  SCHOOL_TYPE_CONFIG,
  SCHOOL_MEDIUM_CONFIG,
  ADMISSION_STATUS_CONFIG,
} from '@/lib/schools/schoolHelpers';

interface SchoolBulkImportModalProps {
  open: boolean;
  cityId: string;
  cityName: string;
  districtId?: string | null;
  stateId?: string | null;
  existingSchools?: SchoolRow[];
  onClose: () => void;
  onImported: () => void;
}

const SAMPLE_CSV = `Name, Marathi Name, Type, Medium, Area, Phone, Notes, Board, Management, AdmissionStatus, WhatsApp, UDISE
Z.P. Primary School, जि.प. प्राथमिक शाळा, Primary, Marathi, Station Road, 02583-234000, Classes 1st to 7th, State Board (SSC/HSC), Government, Open, , 27030100101
Muktainagar High School & Jr College, मुक्ताईनगर हायस्कूल, Junior College, Semi-English, College Road, 02583-234250, Science & Commerce, State Board (SSC/HSC), Aided, Open, 9822000123,
Smt. G.G. Khadse Senior College, श्रीमती जी. जी. खडसे महाविद्यालय, College, Marathi, Highway Campus, 02583-234408, NAAC Grade A, KBCNMU (Jalgaon), Aided, Open, ,
Government ITI, शासकीय औद्योगिक प्रशिक्षण संस्था, ITI, Marathi, MIDC Area, 02583-234789, DTE technical trades, DTE / AICTE, Government, Ongoing, ,
D.Y. Patil College of Engineering, डी.वाय. पाटील इंजिनिअरिंग, Engineering, English, Varale / Ambi, 02114-673351, B.E. & B.Tech Campus, SPPU (Pune University), Private, Open, 9822112233,`;

const TEMPLATE_EXAMPLE_ROW = [
  '',
  'Z.P. Primary School',
  'जि.प. प्राथमिक शाळा',
  'primary',
  'marathi',
  'marathi',
  'State Board (SSC/HSC)',
  'government',
  'coed',
  '27030100101',
  '1965',
  'Govt Recognized',
  '1st to 7th Std',
  'Science|Commerce',
  'Mid-Day Meal|Playground|Computer Lab',
  'Shri R. P. Patil',
  '10:00 AM - 05:00 PM',
  'open',
  '2026-07-15',
  '',
  '',
  'free',
  '0',
  '0',
  'RTE Free Admission|SC/ST/OBC Pre-Matric',
  'Birth Certificate|Aadhaar Card|Previous LC',
  'Muktainagar|Kurha',
  '',
  '120',
  '35',
  '02583234000',
  '919822000123',
  'school@example.edu.in',
  'https://school.example.edu.in',
  'Station Road',
  'Near Bus Stand',
  'Main Station Road, Muktainagar',
  'मुख्य स्टेशन रोड, मुक्ताईनगर',
  '21.0758',
  '75.9817',
  '',
  '',
  'true',
  'true',
  'Government Marathi medium primary school.',
];

export function SchoolBulkImportModal({
  open,
  cityId,
  cityName,
  districtId,
  stateId,
  existingSchools = [],
  onClose,
  onImported,
}: SchoolBulkImportModalProps) {
  const [text, setText] = useState('');
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { valid, errors } = useMemo(() => parseBulkSchoolCsv(text), [text]);

  const { uniqueRows, duplicateIndices } = useMemo(() => {
    const existingPhones = new Set<string>();
    const existingUdise = new Set<string>();
    const existingNameArea = new Set<string>();

    for (const s of existingSchools) {
      if (s.phone) existingPhones.add(normalizePhone(s.phone));
      if (s.udise_aishe_code) existingUdise.add(s.udise_aishe_code.trim().toLowerCase());
      const key = `${s.name.trim().toLowerCase()}::${(s.area || '').trim().toLowerCase()}`;
      existingNameArea.add(key);
    }

    const seenPhones = new Set<string>();
    const seenUdise = new Set<string>();
    const seenNameArea = new Set<string>();
    const dupeSet = new Set<number>();

    valid.forEach((r, idx) => {
      const pNorm = r.phone ? normalizePhone(r.phone) : '';
      const uNorm = r.udise_aishe_code ? r.udise_aishe_code.trim().toLowerCase() : '';
      const naKey = `${r.name.trim().toLowerCase()}::${(r.area || '').trim().toLowerCase()}`;

      const isDupe =
        (pNorm && pNorm.length >= 6 && (existingPhones.has(pNorm) || seenPhones.has(pNorm))) ||
        (uNorm && (existingUdise.has(uNorm) || seenUdise.has(uNorm))) ||
        existingNameArea.has(naKey) ||
        seenNameArea.has(naKey);

      if (isDupe) {
        dupeSet.add(idx);
      } else {
        if (pNorm && pNorm.length >= 6) seenPhones.add(pNorm);
        if (uNorm) seenUdise.add(uNorm);
        seenNameArea.add(naKey);
      }
    });

    const filtered = skipDuplicates ? valid.filter((_, idx) => !dupeSet.has(idx)) : valid;
    return { uniqueRows: filtered, duplicateIndices: dupeSet };
  }, [valid, existingSchools, skipDuplicates]);

  if (!open) return null;

  const handlePasteSample = () => {
    setText(SAMPLE_CSV);
    toast.info('Sample educational institutes template loaded');
  };

  const handleDownloadFullTemplate = () => {
    const csv = buildCsvString([...SCHOOL_CSV_EXPORT_HEADERS], [TEMPLATE_EXAMPLE_ROW], true);
    downloadCsvText('schools_full_import_template.csv', csv, false);
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
    if (uniqueRows.length === 0) {
      toast.error('No new valid institutes to import');
      return;
    }
    setImporting(true);
    try {
      const payload = uniqueRows.map((r) => {
        const dbType = toDbSchoolType(r.school_type);
        let descriptionToSave: string | null = r.description?.trim() || null;

        if (!r.fromExtendedHeader) {
          descriptionToSave = serializeSchoolDescription({
            type_override: r.school_type !== dbType ? r.school_type : undefined,
            board: r.board,
            raw_description: r.description || '',
          }) || null;
        } else if (r.school_type !== dbType) {
          descriptionToSave = serializeSchoolDescription({
            type_override: r.school_type,
            raw_description: r.description || '',
          }) || null;
        }

        const normPhone = r.phone ? normalizePhone(r.phone) : null;
        const normWa = r.whatsapp ? normalizeWhatsApp(r.whatsapp) : null;

        return {
          ...(r.slug ? { slug: r.slug } : {}),
          city_id: cityId,
          district_id: districtId || null,
          state_id: stateId || null,
          name: r.name,
          name_mr: r.name_mr || null,
          school_type: dbType,
          medium: r.medium || null,
          mediums: r.mediums && r.mediums.length > 0 ? r.mediums : r.medium ? [r.medium] : [],
          area: r.area || null,
          sub_area: r.sub_area || null,
          address: r.address || null,
          address_mr: r.address_mr || null,
          phone: normPhone || null,
          whatsapp: normWa || null,
          email: r.email || null,
          website: r.website || null,
          board: r.board || null,
          management_type: r.management_type || null,
          gender_type: r.gender_type || 'coed',
          admission_status: r.admission_status || 'unknown',
          admission_deadline: r.admission_deadline || null,
          admission_url: r.admission_url || null,
          prospectus_url: r.prospectus_url || null,
          fee_tier: r.fee_tier || 'unspecified',
          annual_fee_min: r.annual_fee_min ?? null,
          annual_fee_max: r.annual_fee_max ?? null,
          classes_offered: r.classes_offered || null,
          established_year: r.established_year ?? null,
          accreditation: r.accreditation || null,
          principal_name: r.principal_name || null,
          office_timing: r.office_timing || null,
          streams: r.streams ?? [],
          facilities: r.facilities ?? [],
          scholarships: r.scholarships ?? [],
          required_documents: r.required_documents ?? [],
          transport_villages: r.transport_villages ?? [],
          coaching_focus: r.coaching_focus ?? [],
          total_seats: r.total_seats ?? null,
          available_seats: r.available_seats ?? null,
          udise_aishe_code: r.udise_aishe_code || null,
          latitude: r.latitude ?? null,
          longitude: r.longitude ?? null,
          image_url: r.image_url || null,
          photos: r.photos ?? [],
          description: descriptionToSave,
          is_verified: r.is_verified ?? false,
          is_active: r.is_active ?? true,
        };
      });

      const res = await schoolsRepo.insertMany(payload);
      if (res.ok === false) throw new Error(res.error);

      toast.success(`Successfully imported ${uniqueRows.length} institute(s) for ${cityName}!`);
      onImported();
      onClose();
    } catch (err: unknown) {
      console.error('[SchoolBulkImportModal] Import error:', err);
      const msg = err instanceof Error
        ? err.message
        : (typeof err === 'object' && err !== null && 'message' in err ? String((err as { message?: unknown }).message) : 'Failed to import institutes');
      toast.error(msg || 'Failed to import institutes');
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
                Bulk Import Institutes — {cityName}
              </h3>
              <p className="text-[11px] text-muted-foreground truncate">
                Upload a CSV file (including exported Schools CSV) or paste spreadsheet rows (CSV / TSV / Pipe)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
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
                onClick={handleDownloadFullTemplate}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card text-foreground hover:bg-muted text-xs font-semibold transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Full CSV Template</span>
              </button>
            </div>
            <button
              type="button"
              onClick={handlePasteSample}
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Fill Quick Sample
            </button>
          </div>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            placeholder={`Supports:\n1. Full Education Portal CSV (upload file exported from Export CSV)\n2. Quick Paste (2–12 cols): Name, Marathi Name, Type, Medium, Area, Phone, Notes, Board, Management, AdmissionStatus, WhatsApp, UDISE`}
            className="w-full p-3 font-mono text-xs rounded-xl border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />

          {/* Real-time Parser Feedback */}
          {text.trim() && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                    <CheckCircle2 className="w-4 h-4" />
                    {uniqueRows.length} Ready to Import
                  </span>
                  {duplicateIndices.size > 0 && (
                    <span className="flex items-center gap-1 text-muted-foreground font-semibold">
                      <SkipForward className="w-4 h-4" />
                      {duplicateIndices.size} Duplicate{duplicateIndices.size === 1 ? '' : 's'}
                    </span>
                  )}
                  {errors.length > 0 && (
                    <span className="flex items-center gap-1 text-destructive font-semibold">
                      <AlertCircle className="w-4 h-4" />
                      {errors.length} {errors.length === 1 ? 'Issue' : 'Issues'}
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
                    Skip duplicates
                  </label>
                )}
              </div>

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

              {valid.length > 0 && (
                <div className="border border-border rounded-xl overflow-hidden">
                  <div className="overflow-x-auto max-h-48 overflow-y-auto">
                    <table className="w-full text-[11px] text-left">
                      <thead className="bg-muted text-muted-foreground uppercase text-[10px] sticky top-0">
                        <tr>
                          <th className="px-3 py-1.5">Name</th>
                          <th className="px-2 py-1.5">Category</th>
                          <th className="px-2 py-1.5">Medium / Board</th>
                          <th className="px-2 py-1.5">Area</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {valid.map((row, i) => {
                          const isDupe = duplicateIndices.has(i);
                          const typeCfg = SCHOOL_TYPE_CONFIG[row.school_type] || SCHOOL_TYPE_CONFIG.other;
                          const medCfg = row.medium ? SCHOOL_MEDIUM_CONFIG[row.medium] : null;
                          const admCfg = row.admission_status ? ADMISSION_STATUS_CONFIG[row.admission_status] : null;

                          return (
                            <tr key={i} className={`hover:bg-muted/40 ${isDupe && skipDuplicates ? 'opacity-50 bg-muted/40' : ''}`}>
                              <td className="px-3 py-1.5 font-medium text-foreground">
                                {row.name}
                                {isDupe && (
                                  <span className="ml-1.5 text-[9px] px-1.5 py-0.2 rounded bg-muted text-muted-foreground border border-border">
                                    Duplicate
                                  </span>
                                )}
                                {row.name_mr && (
                                  <span className="block text-[10px] text-muted-foreground">{row.name_mr}</span>
                                )}
                                {row.udise_aishe_code && (
                                  <span className="text-[9px] font-mono text-muted-foreground">
                                    UDISE: {row.udise_aishe_code}
                                  </span>
                                )}
                              </td>
                              <td className="px-2 py-1.5 space-y-1">
                                <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] border ${typeCfg.badgeClass}`}>
                                  {typeCfg.labelMr}
                                </span>
                                {admCfg && (
                                  <span className={`block w-fit px-1.5 py-0.2 rounded-full text-[9px] border ${admCfg.badgeClass}`}>
                                    {admCfg.labelEn}
                                  </span>
                                )}
                              </td>
                              <td className="px-2 py-1.5 text-muted-foreground">
                                <div>{medCfg?.labelMr || '—'}</div>
                                {row.board && (
                                  <div className="text-[10px] text-foreground/80 truncate max-w-[140px]">
                                    {row.board}
                                  </div>
                                )}
                              </td>
                              <td className="px-2 py-1.5 text-muted-foreground">{row.area || '—'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] border-t border-border bg-card flex flex-wrap items-center justify-between gap-2">
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
            disabled={importing || uniqueRows.length === 0}
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
                Import {uniqueRows.length} {uniqueRows.length === 1 ? 'Institute' : 'Institutes'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
