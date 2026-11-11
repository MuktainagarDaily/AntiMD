import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, X, Upload, Download, CheckCircle2, AlertCircle, SkipForward, BedDouble } from 'lucide-react';
import { toast } from 'sonner';
import { normalizePhone } from '@/lib/shopUtils';
import { isValidIndianPhone } from '@/lib/utils';
import { downloadCsvText, fetchAllPaged, parseCsv } from '@/lib/csvUtils';
import { DEFAULT_STATE } from '@/lib/geo/geoService';
import { useCity } from '@/hooks/useCity';
import { savePGProfile } from '@/lib/living/livingService';
import type { PGGender, PGSharingRates } from '@/lib/living/livingTypes';
import type { Database } from '@/integrations/supabase/types';

function makeUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

type RowStatus = 'ready' | 'duplicate' | 'error';

interface ParsedPGRow {
  name: string;
  nameMr: string;
  phone: string | null;
  whatsapp: string | null;
  townName: string;
  cityId: string;
  districtId: string | null;
  stateId: string | null;
  area: string;
  address: string;
  gender: PGGender;
  occupancyTarget: 'students' | 'professionals' | 'any';
  totalBeds: number;
  availableBeds: number;
  depositAmount: number;
  noticePeriodDays: number;
  gateClosingTime: string;
  foodIncluded: boolean;
  sharingRates: PGSharingRates;
  amenities: string[];
  isVerified: boolean;
  isActive: boolean;
  status: RowStatus;
  messages: string[];
}

function downloadTemplate() {
  const headers = [
    'Name',
    'Name (Marathi)',
    'Phone',
    'WhatsApp',
    'Town',
    'Area',
    'Address',
    'Gender',
    'Occupancy Target',
    'Total Beds',
    'Available Beds',
    'Deposit Amount',
    'Notice Period Days',
    'Gate Closing Time',
    'Food Included',
    '1-Sharing Rate',
    '2-Sharing Rate',
    '3-Sharing Rate',
    '4-Sharing Rate',
    'Amenities',
    'Verified',
    'Active',
  ].join(',');
  const sample = [
    '"Sai Girls Hostel & PG"',
    '"साई गर्ल्स हॉस्टेल आणि पीजी"',
    '"9822003344"',
    '"9822003344"',
    '"Muktainagar"',
    '"College Road"',
    '"Plot 14, Vidyanagar, Muktainagar"',
    '"girls"',
    '"students"',
    '"24"',
    '"4"',
    '"2000"',
    '"30"',
    '"09:30 PM"',
    '"No"',
    '"5500"',
    '"3500"',
    '"2800"',
    '""',
    '"High-Speed Wi-Fi|RO Drinking Water|CCTV Security"',
    '"Yes"',
    '"Yes"',
  ].join(',');
  downloadCsvText('apnatown_pg_template.csv', `${headers}\n${sample}`, false);
}

function parseBool(val: string | undefined, defaultVal: boolean): boolean {
  const s = (val || '').trim().toLowerCase();
  if (!s) return defaultVal;
  if (s === 'yes' || s === 'true' || s === '1') return true;
  if (s === 'no' || s === 'false' || s === '0') return false;
  return defaultVal;
}

function normalizeGender(raw: string | undefined): PGGender {
  const s = (raw || '').trim().toLowerCase();
  if (s.includes('girl') || s.includes('women') || s.includes('female') || s.includes('ladies')) return 'girls';
  if (s.includes('both') || s.includes('co') || s.includes('any')) return 'both';
  return 'boys';
}

function normalizeOccupancy(raw: string | undefined): 'students' | 'professionals' | 'any' {
  const s = (raw || '').trim().toLowerCase();
  if (s.includes('prof') || s.includes('work')) return 'professionals';
  if (s === 'any' || s.includes('both') || s.includes('all')) return 'any';
  return 'students';
}

function toNumOrNull(raw: string | undefined): number | null {
  if (!raw || !raw.trim()) return null;
  const n = Number(raw.trim());
  return Number.isFinite(n) && n >= 0 ? n : null;
}

interface Props {
  onClose: () => void;
  onDone: () => void;
}

export function PGCsvImportModal({ onClose, onDone }: Props) {
  const { currentCity, allCities } = useCity();
  const [targetCityId, setTargetCityId] = useState<string>(currentCity.id);
  const [step, setStep] = useState<'upload' | 'preview' | 'result'>('upload');
  const [rows, setRows] = useState<ParsedPGRow[]>([]);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; skippedDupes: number; skippedErrors: number; failed: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const processCsv = async (csvText: string) => {
    const rawRows = parseCsv(csvText);
    if (rawRows.length === 0) {
      toast.error('CSV has no data rows');
      setParsing(false);
      return;
    }

    const existingShops = await fetchAllPaged<{ id: string; name: string; phone: string | null; area: string | null; city_id: string | null }>(
      (from, to) =>
        supabase
          .from('shops')
          .select('id, name, phone, area, city_id')
          .order('id', { ascending: true })
          .range(from, to),
    );

    const existingPhoneCity = new Set<string>();
    const existingNameCity = new Set<string>();
    const muktainagarId = allCities.find((c) => c.slug === 'muktainagar')?.id || currentCity.id;

    existingShops.forEach((s) => {
      const cKey = s.city_id || muktainagarId;
      const p = normalizePhone(s.phone);
      if (p) existingPhoneCity.add(`${cKey}::${p}`);
      if (s.name) existingNameCity.add(`${cKey}::${s.name.toLowerCase().trim()}::${(s.area || '').toLowerCase().trim()}`);
    });

    const seenPhones = new Set<string>();
    const defaultCityObj = allCities.find((c) => c.id === targetCityId) || currentCity;

    const processed: ParsedPGRow[] = rawRows.map((raw) => {
      const name = (raw['name'] || raw['pg name'] || raw['hostel name'] || '').trim();
      const nameMr = (raw['name (marathi)'] || raw['name_mr'] || '').trim();
      const phoneRaw = (raw['phone'] || '').trim();
      const waRaw = (raw['whatsapp'] || '').trim();
      const phone = phoneRaw ? normalizePhone(phoneRaw) : null;
      const whatsapp = waRaw ? normalizePhone(waRaw) : null;

      const townRaw = (raw['town'] || raw['city'] || '').trim();
      const matchedCity = townRaw
        ? allCities.find(
            (c) =>
              c.slug.toLowerCase() === townRaw.toLowerCase() ||
              c.name.toLowerCase() === townRaw.toLowerCase() ||
              (c.name_mr && c.name_mr.trim() === townRaw),
          )
        : defaultCityObj;
      const resolvedCity = matchedCity || defaultCityObj;

      const area = (raw['area'] || '').trim();
      const address = (raw['address'] || '').trim();
      const gender = normalizeGender(raw['gender']);
      const occupancyTarget = normalizeOccupancy(raw['occupancy target'] || raw['occupancy_target']);
      const totalBeds = Math.max(0, parseInt(raw['total beds'] || raw['total_beds'] || '0', 10) || 0);
      let availableBeds = Math.max(0, parseInt(raw['available beds'] || raw['available_beds'] || '0', 10) || 0);
      const depositAmount = Math.max(0, Number(raw['deposit amount'] || raw['deposit_amount'] || '0') || 0);
      const noticePeriodDays = Math.max(0, parseInt(raw['notice period days'] || raw['notice_period_days'] || '30', 10) || 30);
      const gateClosingTime = (raw['gate closing time'] || raw['gate_closing_time'] || '').trim() || '10:00 PM';
      const foodIncluded = parseBool(raw['food included'] || raw['food_included'], false);

      const sharingRates: PGSharingRates = {
        '1_sharing': toNumOrNull(raw['1-sharing rate'] || raw['1_sharing']),
        '2_sharing': toNumOrNull(raw['2-sharing rate'] || raw['2_sharing']),
        '3_sharing': toNumOrNull(raw['3-sharing rate'] || raw['3_sharing']),
        '4_sharing': toNumOrNull(raw['4-sharing rate'] || raw['4_sharing']),
      };

      const amenitiesRaw = (raw['amenities'] || '').trim();
      const amenities = amenitiesRaw ? amenitiesRaw.split('|').map((a) => a.trim()).filter(Boolean) : [];
      const isVerified = parseBool(raw['verified'] || raw['is_verified'], false);
      const isActive = parseBool(raw['active'] || raw['is_active'], true);

      const messages: string[] = [];
      let status: RowStatus = 'ready';

      if (!name) {
        messages.push('Name is required');
        status = 'error';
      }
      if (!area && !address) {
        messages.push('Area or address is required');
        status = 'error';
      }
      if (phoneRaw && !isValidIndianPhone(phoneRaw)) {
        messages.push(`Invalid phone "${phoneRaw}"`);
        status = 'error';
      }
      if (totalBeds > 0 && availableBeds > totalBeds) {
        messages.push(`Available beds clamped from ${availableBeds} to ${totalBeds}`);
        availableBeds = totalBeds;
      }

      const cityKey = resolvedCity.id;
      const phoneKey = phone ? `${cityKey}::${phone}` : null;
      const nameKey = name ? `${cityKey}::${name.toLowerCase().trim()}::${area.toLowerCase().trim()}` : null;

      if (status !== 'error') {
        if ((phoneKey && (existingPhoneCity.has(phoneKey) || seenPhones.has(phoneKey))) || (nameKey && existingNameCity.has(nameKey))) {
          status = 'duplicate';
          messages.push('Matches existing listing in town');
        }
        if (phoneKey) seenPhones.add(phoneKey);
      }

      if (status === 'ready' && messages.length === 0) messages.push('Ready to import');

      return {
        name,
        nameMr,
        phone,
        whatsapp,
        townName: resolvedCity.name,
        cityId: resolvedCity.id,
        districtId: resolvedCity.district_id ?? null,
        stateId: resolvedCity.district?.state_id ?? DEFAULT_STATE.id,
        area,
        address,
        gender,
        occupancyTarget,
        totalBeds,
        availableBeds,
        depositAmount,
        noticePeriodDays,
        gateClosingTime,
        foodIncluded,
        sharingRates,
        amenities,
        isVerified,
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
    await processCsv(csvText);
  };

  const importable = rows.filter((r) => r.status === 'ready' || (!skipDuplicates && r.status === 'duplicate'));
  const dupeCount = rows.filter((r) => r.status === 'duplicate').length;
  const errCount = rows.filter((r) => r.status === 'error').length;

  const handleImport = async () => {
    setImporting(true);
    const { data: pgCat } = await supabase
      .from('categories')
      .select('id')
      .or('name.ilike.%pg%,name.ilike.%hostel%')
      .limit(1)
      .maybeSingle();

    let imported = 0;
    let failed = 0;

    for (const row of importable) {
      const shopId = makeUuid();
      const shopInsert = {
        id: shopId,
        name: row.name,
        phone: row.phone,
        whatsapp: row.whatsapp,
        area: row.area || null,
        address: row.address || null,
        amenities: row.amenities,
        photos: [],
        is_verified: row.isVerified,
        is_active: row.isActive,
        is_open: true,
        city_id: row.cityId,
        district_id: row.districtId,
        state_id: row.stateId,
      } as unknown as Database['public']['Tables']['shops']['Insert'];

      const { error: shopErr } = await supabase.from('shops').insert(shopInsert);

      if (shopErr) {
        failed++;
        continue;
      }

      if (pgCat?.id) {
        await supabase.from('shop_categories').insert({ shop_id: shopId, category_id: pgCat.id });
      }

      await savePGProfile({
        shop_id: shopId,
        gender: row.gender,
        occupancy_target: row.occupancyTarget,
        total_beds: row.totalBeds,
        available_beds: row.availableBeds,
        deposit_amount: row.depositAmount,
        notice_period_days: row.noticePeriodDays,
        gate_closing_time: row.gateClosingTime,
        food_included: row.foodIncluded,
        amenities: row.amenities,
        sharing_rates: row.sharingRates,
      });

      if (row.nameMr) {
        await supabase.from('shop_translations').upsert(
          { shop_id: shopId, locale: 'mr', name: row.nameMr },
          { onConflict: 'shop_id,locale' },
        );
      }

      imported++;
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
            <BedDouble className="w-5 h-5 text-blue-600 shrink-0" />
            <h2 className="font-bold text-base sm:text-lg text-foreground truncate">Import PG &amp; Hostels CSV</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 hover:bg-muted rounded-lg shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {step === 'upload' && (
          <div className="p-4 sm:p-6 space-y-5 overflow-y-auto flex-1 min-h-0">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-foreground uppercase tracking-wide">
                Default Target Town (when CSV Town column is blank)
              </label>
              <select
                value={targetCityId}
                onChange={(e) => setTargetCityId(e.target.value)}
                className="w-full sm:w-72 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground"
              >
                {allCities.map((c) => (
                  <option key={c.id} value={c.id}>
                    📍 {c.name} {c.name_mr ? `(${c.name_mr})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2 text-sm text-muted-foreground">
              <p className="font-semibold text-foreground">How it works</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Creates shop rows, links PG &amp; Hostels category, and builds <code className="text-[11px]">pg_profiles</code> including gender, vacancies, and <code className="text-[11px]">sharing_rates</code> JSONB.</li>
                <li>Validates bed counts (clamping available ≤ total) and deduplicates by normalized phone / name in the target town.</li>
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
                      <th className="text-left px-3 py-2 font-semibold">PG / Hostel</th>
                      <th className="text-left px-3 py-2 font-semibold">Beds &amp; Gender</th>
                      <th className="text-left px-3 py-2 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rows.map((r, i) => (
                      <tr key={i} className={r.status === 'error' ? 'bg-destructive/5' : ''}>
                        <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                        <td className="px-3 py-2">
                          <div className="font-semibold text-foreground">{r.name || <span className="text-destructive italic">missing</span>}</div>
                          <div className="text-[11px] text-muted-foreground">{[r.area, r.townName, r.phone].filter(Boolean).join(' · ')}</div>
                          {r.messages.filter((m) => m !== 'Ready to import').map((m, k) => (
                            <div key={k} className="text-[11px] text-amber-700 dark:text-amber-300">{m}</div>
                          ))}
                        </td>
                        <td className="px-3 py-2 capitalize">
                          <div>{r.gender} · {r.availableBeds}/{r.totalBeds} beds</div>
                          <div className="text-muted-foreground">
                            {r.sharingRates['2_sharing'] ? `2-sh ₹${r.sharingRates['2_sharing']}` : '—'}
                          </div>
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
                {importing ? <><Loader2 className="w-4 h-4 animate-spin" /> Importing...</> : `Import ${importable.length} Listings`}
              </button>
            </div>
          </div>
        )}

        {step === 'result' && result && (
          <div className="p-4 sm:p-6 space-y-5">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-7 h-7 text-success shrink-0" />
              <div>
                <p className="font-bold text-lg text-foreground">PG &amp; Hostel Import Complete</p>
                <p className="text-xs text-muted-foreground">Profiles and sharing rates saved.</p>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-muted/20 divide-y divide-border text-sm">
              <div className="flex justify-between px-4 py-2.5"><span>Imported</span><strong>{result.imported}</strong></div>
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
