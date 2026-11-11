import { useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, X, Upload, Download, CheckCircle2, AlertTriangle, AlertCircle, SkipForward, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { normalizePhone } from '@/lib/shopUtils';
import { normalizeWhatsApp, isValidPhone } from './adminHelpers';
import { buildCsvString, downloadCsvText, fetchAllPaged, parseCsv } from '@/lib/csvUtils';
import { PRESET_AMENITIES } from '@/components/shared/AmenitiesPicker';
import { useCity } from '@/hooks/useCity';
import { DEFAULT_STATE, fetchAllActiveVillages } from '@/lib/geo/geoService';

const MAX_AMENITY_LEN = 40;
const MAX_AMENITIES_PER_ROW = 12;
const PRESET_LOWER = new Set(PRESET_AMENITIES.map((a) => a.toLowerCase()));

function makeUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Parse + validate the amenities cell. Returns clean list and per-cell messages. */
function validateAmenitiesCell(raw: string): { values: string[]; messages: string[]; hadError: boolean } {
  const messages: string[] = [];
  if (!raw) return { values: [], messages, hadError: false };

  const parts = raw.split('|').map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) {
    messages.push('Amenities column present but empty — ignored');
    return { values: [], messages, hadError: false };
  }

  const seen = new Set<string>();
  const out: string[] = [];
  let droppedTooLong = 0;
  let droppedInvalid = 0;
  let droppedDupes = 0;

  for (const part of parts) {
    const clean = part.replace(/[\x00-\x1F\x7F]/g, '').trim();
    if (!clean) { droppedInvalid++; continue; }
    if (clean.length > MAX_AMENITY_LEN) { droppedTooLong++; continue; }

    const key = clean.toLowerCase();
    if (seen.has(key)) { droppedDupes++; continue; }
    seen.add(key);
    out.push(clean);
    if (out.length >= MAX_AMENITIES_PER_ROW) break;
  }

  if (droppedTooLong > 0) messages.push(`Amenities: ${droppedTooLong} value(s) over ${MAX_AMENITY_LEN} chars dropped`);
  if (droppedInvalid > 0) messages.push(`Amenities: ${droppedInvalid} invalid value(s) dropped`);
  if (droppedDupes > 0) messages.push(`Amenities: ${droppedDupes} duplicate value(s) merged`);
  if (parts.length > MAX_AMENITIES_PER_ROW && out.length === MAX_AMENITIES_PER_ROW) {
    messages.push(`Amenities: only first ${MAX_AMENITIES_PER_ROW} kept`);
  }

  const nonPreset = out.filter((v) => !PRESET_LOWER.has(v.toLowerCase()));
  if (nonPreset.length > 0) {
    messages.push(`Amenities: ${nonPreset.length} custom value(s) — ${nonPreset.slice(0, 3).join(', ')}${nonPreset.length > 3 ? '…' : ''}`);
  }

  const hadError = out.length === 0 && (droppedTooLong + droppedInvalid) > 0;
  return { values: out, messages, hadError };
}

function parsePhotosUrls(rawPhotos: string, fallbackImageUrl: string): { photos: string[]; cover: string | null; invalidCount: number } {
  const candidates = [
    ...rawPhotos.split('|').map((s) => s.trim()).filter(Boolean),
  ];
  const seen = new Set<string>();
  const valid: string[] = [];
  let invalidCount = 0;

  const cleanCover = fallbackImageUrl.trim();
  if (cleanCover) {
    if (/^https?:\/\//i.test(cleanCover)) {
      seen.add(cleanCover);
      valid.push(cleanCover);
    } else {
      invalidCount++;
    }
  }

  for (const u of candidates) {
    if (!/^https?:\/\//i.test(u)) {
      invalidCount++;
      continue;
    }
    if (!seen.has(u)) {
      seen.add(u);
      valid.push(u);
    }
    if (valid.length >= 5) break;
  }

  return {
    photos: valid,
    cover: valid[0] || null,
    invalidCount,
  };
}

type ImportRowStatus = 'ready' | 'warning' | 'error' | 'duplicate';
interface ImportRow {
  name: string;
  name_mr: string;
  phone: string;
  whatsapp: string;
  address: string;
  area: string;
  sub_area: string;
  description: string;
  keywords: string;
  category: string;
  opening_time: string;
  closing_time: string;
  latitude: string;
  longitude: string;
  is_active: string;
  is_verified: string;
  is_open: string;
  image_url: string;
  photos: string[];
  slug: string;
  amenities: string[];
  city?: string;
  village?: string;
  resolvedCityId: string;
  resolvedCityName: string;
  resolvedVillageId: string | null;
  resolvedVillageName: string | null;
  status: ImportRowStatus;
  messages: string[];
  resolvedCategoryIds: string[];
  resolvedCategoryId: string | null;
}
interface ImportResult { imported: number; importedWithWarnings: number; skippedDupes: number; skippedErrors: number; failedInserts: number; }
type ImportStep = 'upload' | 'preview' | 'result';

const CSV_TEMPLATE_HEADERS = [
  'name', 'name_mr', 'phone', 'whatsapp', 'city', 'village', 'address', 'area', 'sub_area',
  'description', 'keywords', 'category', 'opening_time', 'closing_time', 'latitude', 'longitude',
  'is_active', 'is_verified', 'is_open', 'amenities', 'image_url', 'photos', 'slug',
];
const CSV_TEMPLATE_EXAMPLE = [
  'Sharma General Store', 'शर्मा जनरल स्टोअर', '9876543210', '9876543210', 'maval', 'parandwadi',
  'Near Main Chowk Station Road', 'Main Road', 'Main Bazaar', 'General merchandise and daily needs',
  'grocery store daily needs', 'Grocery', '09:00', '21:00', '18.7247', '73.6872',
  'true', 'false', 'true', 'Parking|UPI Accepted|Home Delivery',
  'https://example.com/shop.jpg', 'https://example.com/shop.jpg', '',
];

function downloadTemplate() {
  const csv = buildCsvString(CSV_TEMPLATE_HEADERS, [CSV_TEMPLATE_EXAMPLE], true);
  downloadCsvText('shops_import_template.csv', csv, false);
}

interface CsvImportModalProps { onClose: () => void; onDone: () => void; }

export function CsvImportModal({ onClose, onDone }: CsvImportModalProps) {
  const { currentCity, allCities } = useCity();
  const [selectedCityId, setSelectedCityId] = useState<string>(currentCity.id);
  const [selectedVillageId, setSelectedVillageId] = useState<string>('');

  const { data: allVillages = [] } = useQuery({
    queryKey: ['admin-csv-import-all-villages'],
    queryFn: () => fetchAllActiveVillages(),
  });

  const cityVillages = useMemo(
    () => allVillages.filter((v) => v.city_id === selectedCityId),
    [allVillages, selectedCityId],
  );

  const [step, setStep] = useState<ImportStep>('upload');
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [failedRowKeys, setFailedRowKeys] = useState<Set<number>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: categories = [] } = useQuery({
    queryKey: ['admin-categories'],
    queryFn: async () => {
      const { data, error } = await supabase.from('categories').select('*').order('name');
      if (error) throw error;
      return data;
    },
  });

  const processText = async (csvText: string) => {
    const rawRows = parseCsv(csvText);
    if (rawRows.length === 0) {
      toast.error('CSV has no data rows or is malformed');
      setParsing(false);
      return;
    }

    const existingShops = await fetchAllPaged<{ phone: string | null }>((from, to) =>
      supabase.from('shops').select('phone').range(from, to)
    );
    const existingPhones = new Set(
      (existingShops || []).map((s) => (s.phone ? normalizePhone(s.phone) : '')).filter(Boolean)
    );

    const catMap = new Map<string, string>();
    categories.forEach((c: any) => catMap.set(c.name.toLowerCase().trim(), c.id));
    const seenPhones = new Set<string>();

    const targetCity = allCities.find((c) => c.id === selectedCityId) || currentCity;
    const targetVillage = cityVillages.find((v) => v.id === selectedVillageId) || null;

    const processed: ImportRow[] = rawRows.map((raw) => {
      const name = (raw['name'] || '').trim();
      const name_mr = (raw['name_mr'] || '').trim();
      const phone = (raw['phone'] || '').trim();
      const whatsapp = (raw['whatsapp'] || '').trim();
      const address = (raw['address'] || '').trim();
      const area = (raw['area'] || '').trim();
      const sub_area = (raw['sub_area'] || '').trim();
      const description = (raw['description'] || '').trim();
      const keywords = (raw['keywords'] || '').trim();
      const category = (raw['category'] || '').trim();
      const opening_time = (raw['opening_time'] || '').trim();
      const closing_time = (raw['closing_time'] || '').trim();
      const latitude = (raw['latitude'] || '').trim();
      const longitude = (raw['longitude'] || '').trim();
      const is_active = (raw['is_active'] || '').trim();
      const is_verified = (raw['is_verified'] || '').trim();
      const is_open = (raw['is_open'] || '').trim();
      const image_url_raw = (raw['image_url'] || '').trim();
      const photos_raw = (raw['photos'] || '').trim();
      const slug = (raw['slug'] || '').trim();

      const amenitiesRaw = (raw['amenities'] || '').trim();
      const amenitiesResult = validateAmenitiesCell(amenitiesRaw);
      const amenities = amenitiesResult.values;

      const parsedPhotos = parsePhotosUrls(photos_raw, image_url_raw);

      const rawCity = (raw['city'] || '').trim().toLowerCase();
      const rawVillage = (raw['village'] || '').trim().toLowerCase();

      // Resolve City: CSV override > Modal selected city
      const matchedCity = rawCity
        ? allCities.find((c) => c.slug.toLowerCase() === rawCity || c.name.toLowerCase() === rawCity)
        : null;
      const finalCity = matchedCity || targetCity;
      const resolvedCityId = finalCity.id;
      const resolvedCityName = finalCity.name;

      // Resolve Village scoped to `finalCity.id` (works across towns too)
      const villagesForFinalCity = allVillages.filter((v) => v.city_id === resolvedCityId);
      let resolvedVillageId = finalCity.id === selectedCityId ? targetVillage?.id || null : null;
      let resolvedVillageName = finalCity.id === selectedCityId ? targetVillage?.name || null : null;
      if (rawVillage) {
        const matchedVillage = villagesForFinalCity.find(
          (v) => v.slug.toLowerCase() === rawVillage || v.name.toLowerCase() === rawVillage
        );
        if (matchedVillage) {
          resolvedVillageId = matchedVillage.id;
          resolvedVillageName = matchedVillage.name;
        } else {
          resolvedVillageId = null;
          resolvedVillageName = rawVillage;
        }
      }

      const messages: string[] = [];
      let status: ImportRowStatus = 'ready';

      if (!name) { messages.push('Shop name is required'); status = 'error'; }
      if (!phone) { messages.push('Phone number is required'); status = 'error'; }
      else if (!isValidPhone(phone)) { messages.push('Phone must be at least 10 digits'); status = 'error'; }

      if (latitude && (isNaN(parseFloat(latitude)) || parseFloat(latitude) < -90 || parseFloat(latitude) > 90)) {
        messages.push('Latitude must be between -90 and 90');
        status = 'error';
      }
      if (longitude && (isNaN(parseFloat(longitude)) || parseFloat(longitude) < -180 || parseFloat(longitude) > 180)) {
        messages.push('Longitude must be between -180 and 180');
        status = 'error';
      }
      if (parsedPhotos.invalidCount > 0) {
        messages.push('Image URLs must start with http:// or https:// (invalid URL skipped)');
        if (status === 'ready') status = 'warning';
      }
      if (!area && !address) { messages.push('Area or address is required'); status = 'error'; }

      if (status !== 'error' && phone) {
        const norm = normalizePhone(phone);
        if (existingPhones.has(norm)) {
          messages.push('Phone already exists in database');
          status = 'duplicate';
        } else if (seenPhones.has(norm)) {
          messages.push('Duplicate phone number within this CSV');
          status = 'duplicate';
        } else {
          seenPhones.add(norm);
        }
      }

      if (status !== 'error' && status !== 'duplicate' && whatsapp && !isValidPhone(whatsapp)) {
        messages.push('WhatsApp number appears invalid — will be skipped');
        status = 'warning';
      }

      if (rawVillage && !resolvedVillageId && status !== 'error' && status !== 'duplicate') {
        messages.push(`Village "${raw['village']}" not matched in ${resolvedCityName}`);
        status = 'warning';
      }

      // Support one or multiple categories via "|" (or legacy spaced " | ")
      const resolvedCategoryIds: string[] = [];
      const unmatchedCats: string[] = [];
      if (category) {
        const parts = category.split('|').map((s) => s.trim()).filter(Boolean);
        for (const cName of parts) {
          const id = catMap.get(cName.toLowerCase());
          if (id) {
            if (!resolvedCategoryIds.includes(id)) resolvedCategoryIds.push(id);
          } else {
            unmatchedCats.push(cName);
          }
        }
        if (unmatchedCats.length > 0 && status !== 'error' && status !== 'duplicate') {
          messages.push(`Category not found: ${unmatchedCats.join(', ')}`);
          status = 'warning';
        }
      }

      if (amenitiesResult.messages.length > 0) {
        messages.push(...amenitiesResult.messages);
        if (
          status !== 'error' &&
          status !== 'duplicate' &&
          (amenitiesResult.hadError || amenitiesResult.values.length < amenitiesRaw.split('|').filter((s) => s.trim()).length)
        ) {
          status = status === 'ready' ? 'warning' : status;
        }
      }

      if (status === 'ready' && messages.length === 0) messages.push('Ready to import');

      return {
        name,
        name_mr,
        phone,
        whatsapp,
        address,
        area,
        sub_area,
        description,
        keywords,
        category,
        opening_time,
        closing_time,
        latitude,
        longitude,
        is_active,
        is_verified,
        is_open,
        image_url: parsedPhotos.cover ?? '',
        photos: parsedPhotos.photos,
        slug,
        amenities,
        city: rawCity || undefined,
        village: rawVillage || undefined,
        resolvedCityId,
        resolvedCityName,
        resolvedVillageId,
        resolvedVillageName,
        status,
        messages,
        resolvedCategoryIds,
        resolvedCategoryId: resolvedCategoryIds[0] ?? null,
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
    try {
      const csvText = await file.text();
      await processText(csvText);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to read CSV file');
      setParsing(false);
    }
  };

  const importableRows = rows.filter((r) => r.status === 'ready' || r.status === 'warning');
  const dupeRows = rows.filter((r) => r.status === 'duplicate');
  const errorRows = rows.filter((r) => r.status === 'error');
  const normalizeArea = (s: string) => s.trim().replace(/(^|[\s,])([a-z])/g, (_m, pre, ch) => pre + ch.toUpperCase());

  const handleImport = async () => {
    setImporting(true);
    let imported = 0;
    let importedWithWarnings = 0;
    let failedInserts = 0;
    const failedIdx = new Set<number>();
    const idxOf = new Map<ImportRow, number>();
    rows.forEach((r, i) => idxOf.set(r, i));
    const CHUNK = 100;

    type Pending = { row: ImportRow; shopId: string; payload: any };
    const pending: Pending[] = importableRows.map((row) => {
      const shopId = makeUuid();
      const resolvedCityId =
        row.resolvedCityId && !row.resolvedCityId.startsWith('00000000-')
          ? row.resolvedCityId
          : '644b68eb-472c-40d3-9f83-c7d26e121498';
      const rowCity = allCities.find((c) => c.id === resolvedCityId) || currentCity;
      const resolvedVillageId =
        row.resolvedVillageId && !row.resolvedVillageId.startsWith('00000000-') ? row.resolvedVillageId : null;
      const resolvedDistrictId =
        rowCity?.district_id && !rowCity.district_id.startsWith('00000000-') ? rowCity.district_id : null;
      const rawStateId = rowCity?.district?.state_id ?? (rowCity as any)?.state_id ?? DEFAULT_STATE.id;
      const resolvedStateId = rawStateId && !String(rawStateId).startsWith('00000000-') ? rawStateId : null;
      const normPhone = row.phone ? normalizePhone(row.phone) : null;

      return {
        row,
        shopId,
        payload: {
          id: shopId,
          name: row.name,
          phone: normPhone,
          whatsapp: row.whatsapp && isValidPhone(row.whatsapp) ? normalizeWhatsApp(row.whatsapp) : null,
          address: row.address || null,
          area: row.area ? normalizeArea(row.area) : null,
          sub_area: row.sub_area || null,
          description: row.description || null,
          keywords: row.keywords || null,
          opening_time: row.opening_time || null,
          closing_time: row.closing_time || null,
          latitude: row.latitude ? parseFloat(row.latitude) : null,
          longitude: row.longitude ? parseFloat(row.longitude) : null,
          is_active: row.is_active !== '' ? row.is_active.toLowerCase() === 'true' : true,
          is_verified: row.is_verified !== '' ? row.is_verified.toLowerCase() === 'true' : false,
          is_open: row.is_open !== '' ? row.is_open.toLowerCase() === 'true' : true,
          image_url: row.image_url || null,
          photos: row.photos,
          ...(row.slug ? { slug: row.slug } : {}),
          amenities: row.amenities.length > 0 ? row.amenities : [],
          city_id: resolvedCityId,
          village_id: resolvedVillageId,
          district_id: resolvedDistrictId,
          state_id: resolvedStateId,
        },
      };
    });

    for (let i = 0; i < pending.length; i += CHUNK) {
      const slice = pending.slice(i, i + CHUNK);
      const { error: chunkErr } = await supabase.from('shops').insert(slice.map((p) => p.payload));

      if (chunkErr) {
        for (const { row, shopId, payload } of slice) {
          const { error: e } = await supabase.from('shops').insert(payload);
          if (e) {
            failedInserts++;
            const rowIndex = idxOf.get(row);
            if (rowIndex !== undefined) failedIdx.add(rowIndex);
            continue;
          }
          if (row.resolvedCategoryIds.length > 0) {
            await supabase
              .from('shop_categories')
              .insert(row.resolvedCategoryIds.map((category_id) => ({ shop_id: shopId, category_id })));
          }
          if (row.name_mr) {
            await (supabase as any)
              .from('shop_translations')
              .upsert({ shop_id: shopId, locale: 'mr', name: row.name_mr }, { onConflict: 'shop_id,locale' });
          }
          if (row.status === 'warning') importedWithWarnings++;
          else imported++;
        }
        continue;
      }

      const catLinks: { shop_id: string; category_id: string }[] = [];
      const mrTx: { shop_id: string; locale: string; name: string }[] = [];

      for (const { row, shopId } of slice) {
        for (const category_id of row.resolvedCategoryIds) {
          catLinks.push({ shop_id: shopId, category_id });
        }
        if (row.name_mr) {
          mrTx.push({ shop_id: shopId, locale: 'mr', name: row.name_mr });
        }
        if (row.status === 'warning') importedWithWarnings++;
        else imported++;
      }

      if (catLinks.length > 0) {
        await supabase.from('shop_categories').insert(catLinks);
      }
      if (mrTx.length > 0) {
        await (supabase as any)
          .from('shop_translations')
          .upsert(mrTx, { onConflict: 'shop_id,locale' });
      }
    }

    setResult({
      imported,
      importedWithWarnings,
      skippedDupes: dupeRows.length,
      skippedErrors: errorRows.length,
      failedInserts,
    });
    setFailedRowKeys(failedIdx);
    setImporting(false);
    setStep('result');
  };

  /** CSV of every row that did not import successfully, with the reason. */
  const downloadFailureReport = () => {
    const headers = ['row_number', 'status', 'name', 'phone', 'area', 'category', 'reasons'];
    const failureRows: string[][] = [];
    rows.forEach((r, idx) => {
      const isFailedInsert = failedRowKeys.has(idx);
      if (r.status !== 'error' && r.status !== 'duplicate' && !isFailedInsert) return;
      const statusLabel = isFailedInsert ? 'failed_insert' : r.status;
      const reasonText = (isFailedInsert ? ['Database insert failed', ...r.messages] : r.messages)
        .filter((m) => m && m !== 'Ready to import')
        .join(' | ');
      failureRows.push([String(idx + 1), statusLabel, r.name, r.phone, r.area || r.address, r.category, reasonText]);
    });
    const csv = buildCsvString(headers, failureRows, true);
    downloadCsvText(`csv_import_failures_${new Date().toISOString().slice(0, 10)}.csv`, csv, false);
  };

  const failureCount =
    (result?.skippedErrors ?? 0) + (result?.skippedDupes ?? 0) + (result?.failedInserts ?? 0);

  const statusConfig: Record<ImportRowStatus, { icon: React.ReactNode; label: string; rowCls: string; badgeCls: string }> = {
    ready: { icon: <CheckCircle2 className="w-3.5 h-3.5" />, label: 'Ready', rowCls: '', badgeCls: 'bg-success/10 text-success border border-success/30' },
    warning: { icon: <AlertTriangle className="w-3.5 h-3.5" />, label: 'Warning', rowCls: 'bg-secondary/5', badgeCls: 'bg-secondary/10 text-secondary border border-secondary/30' },
    error: { icon: <AlertCircle className="w-3.5 h-3.5" />, label: 'Error', rowCls: 'bg-destructive/5', badgeCls: 'bg-destructive/10 text-destructive border border-destructive/30' },
    duplicate: { icon: <SkipForward className="w-3.5 h-3.5" />, label: 'Duplicate', rowCls: 'bg-muted/60', badgeCls: 'bg-muted text-muted-foreground border border-border' },
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center overflow-y-auto overscroll-contain py-4 px-3 sm:px-4"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-2xl border border-border w-full max-w-3xl shadow-2xl my-4 max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 px-4 sm:px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Upload className="w-5 h-5 text-primary shrink-0" />
            <h2 className="font-bold text-base sm:text-lg text-foreground truncate">Import Shops from CSV</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 hover:bg-muted rounded-lg shrink-0"><X className="w-5 h-5" /></button>
        </div>

        {step === 'upload' && (
          <div className="p-4 sm:p-6 space-y-5 overflow-y-auto overscroll-contain flex-1 min-h-0">
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary shrink-0" />
                <h3 className="text-sm font-semibold text-foreground">Target Location for Imported Shops</h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Shops in this CSV will be assigned to this City/Taluka and Village unless the row explicitly sets a <code className="px-1 rounded bg-muted">city</code> or <code className="px-1 rounded bg-muted">village</code> column.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-semibold mb-1 text-foreground">City / Taluka *</label>
                  <select
                    value={selectedCityId}
                    onChange={(e) => {
                      setSelectedCityId(e.target.value);
                      setSelectedVillageId('');
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm font-medium focus:ring-2 focus:ring-ring focus:outline-none"
                  >
                    {allCities.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.name_mr ? `(${c.name_mr})` : ''} — {c.type}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1 text-foreground">Village / Locality (optional)</label>
                  <select
                    value={selectedVillageId}
                    onChange={(e) => setSelectedVillageId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm font-medium focus:ring-2 focus:ring-ring focus:outline-none"
                  >
                    <option value="">Main City / No specific village</option>
                    {cityVillages.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} {v.name_mr ? `(${v.name_mr})` : ''} {v.pincode ? `— ${v.pincode}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
              <p className="text-sm font-semibold text-foreground">How to use</p>
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Download the CSV template below (supports Marathi <code>name_mr</code> &amp; multi-photo URLs)</li>
                <li>Fill in your shop data — one shop per row</li>
                <li>Upload the file and review the preview</li>
                <li>Import only valid rows</li>
              </ol>
              <p className="text-xs text-muted-foreground pt-1">
                <strong>Pipes:</strong> separate multiple <code className="px-1 py-0.5 rounded bg-muted">category</code>, <code className="px-1 py-0.5 rounded bg-muted">amenities</code>, or <code className="px-1 py-0.5 rounded bg-muted">photos</code> with <code className="px-1 py-0.5 rounded bg-muted">|</code>
              </p>
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
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-success/10 text-success border border-success/30"><CheckCircle2 className="w-3.5 h-3.5" /> {importableRows.filter(r => r.status === 'ready').length} Ready</span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-secondary/10 text-secondary border border-secondary/30"><AlertTriangle className="w-3.5 h-3.5" /> {importableRows.filter(r => r.status === 'warning').length} Warning</span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-destructive/10 text-destructive border border-destructive/30"><AlertCircle className="w-3.5 h-3.5" /> {errorRows.length} Error</span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground border border-border"><SkipForward className="w-3.5 h-3.5" /> {dupeRows.length} Duplicate</span>
            </div>
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="overflow-x-auto max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0">
                    <tr className="bg-muted/80 border-b border-border">
                      <th className="text-left px-3 py-2.5 font-semibold text-foreground w-8">#</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-foreground">Name</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-foreground hidden sm:table-cell">Location</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-foreground hidden sm:table-cell">Phone</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-foreground hidden md:table-cell">Area</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-foreground hidden lg:table-cell">Category</th>
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
                            <div className="font-semibold text-foreground">{row.name || <span className="text-destructive italic">missing</span>}</div>
                            {row.name_mr && <div className="text-[11px] text-muted-foreground">{row.name_mr}</div>}
                            <div className="text-xs text-muted-foreground mt-0.5">{row.messages.filter(m => m !== 'Ready to import').map((m, i) => <span key={i} className="block">{m}</span>)}</div>
                          </td>
                          <td className="px-3 py-2.5 hidden sm:table-cell">
                            <div className="font-medium text-foreground text-xs">{row.resolvedCityName}</div>
                            {row.resolvedVillageName && (
                              <div className="text-[10px] text-muted-foreground">📍 {row.resolvedVillageName}</div>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-muted-foreground hidden sm:table-cell">{row.phone || '—'}</td>
                          <td className="px-3 py-2.5 text-muted-foreground hidden md:table-cell">{row.area || row.address || '—'}</td>
                          <td className="px-3 py-2.5 hidden lg:table-cell">
                            {row.resolvedCategoryIds.length > 0 ? <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))' }}>{row.category}</span>
                              : row.category ? <span className="text-xs text-muted-foreground italic">{row.category} (unmatched)</span>
                              : <span className="text-muted-foreground">—</span>}
                          </td>
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
                {importing ? <><Loader2 className="w-4 h-4 animate-spin" /> Importing...</> : `Import ${importableRows.length} Shop${importableRows.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        )}

        {step === 'result' && result && (
          <div className="p-4 sm:p-6 space-y-5 overflow-y-auto overscroll-contain flex-1 min-h-0">
            <div className="flex items-center gap-3"><CheckCircle2 className="w-7 h-7 text-success shrink-0" /><div><p className="font-bold text-foreground text-lg">Import complete</p><p className="text-sm text-muted-foreground">Here's a summary of what happened.</p></div></div>
            <div className="rounded-xl border border-border bg-muted/20 divide-y divide-border">
              {[
                { label: 'Imported successfully', value: result.imported, icon: '✅' },
                { label: 'Imported with warnings', value: result.importedWithWarnings, icon: '🟡' },
                { label: 'Skipped — duplicate phone', value: result.skippedDupes, icon: '🔁' },
                { label: 'Skipped — validation errors', value: result.skippedErrors, icon: '❌' },
                { label: 'Failed (database error)', value: result.failedInserts, icon: '⚠️' },
              ].map(({ label, value, icon }) => (
                <div key={label} className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-foreground flex items-center gap-2"><span>{icon}</span> {label}</span>
                  <span className={`font-bold text-sm ${value > 0 && label.startsWith('Imported') ? 'text-success' : 'text-muted-foreground'}`}>{value}</span>
                </div>
              ))}
            </div>
            <button onClick={onDone} className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-colors">Close & Refresh Shops</button>
            {failureCount > 0 && (
              <button
                onClick={downloadFailureReport}
                className="w-full py-2.5 border border-border rounded-xl font-semibold text-sm hover:bg-muted transition-colors inline-flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" /> Download failure report ({failureCount} rows)
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
