/**
 * Speed / Draft Form — rapid multi-shop capture for on-ground admin use.
 *
 * Rules:
 * - Only photo + GPS are required per shop
 * - All other fields optional
 * - is_active defaults to false (draft)
 * - GPS is fresh per draft — never carried over from previous
 * - Previous Area button auto-fills only area from the last saved draft
 * - "Add Another Shop" saves current draft to array and opens a fresh form
 * - "Submit All" uploads photos and inserts all drafts with is_active=false
 */
import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  X, MapPin, Navigation, Loader2, Plus, Send, ChevronLeft, ChevronRight, Trash2, FlaskConical,
} from 'lucide-react';
import { toast } from 'sonner';
import { compressImage } from '@/lib/imageUtils';
import { normalizePhone } from '@/lib/shopUtils';
import { parseGoogleMapsLink } from '@/lib/mapsUtils';
import { inputCls, normalizeWhatsApp } from './adminHelpers';

const normalizeArea = (s: string) =>
  s.trim().replace(/(^|[\s,])([a-z])/g, (_m, pre, ch) => pre + ch.toUpperCase());
import { uploadShopImage } from '@/lib/storageNaming';
import { TimePickerField } from '@/components/shared/TimePickerField';
import { useCity } from '@/hooks/useCity';
import { fetchVillagesForCity } from '@/lib/geo/geoService';
import { translateEnToMr } from '@/lib/translateApi';
import { ImageCropPicker } from '@/components/shared/ImageCropPicker';
import { AmenitiesPicker } from '@/components/shared/AmenitiesPicker';
import { MarathiMirrorField } from '@/components/shared/MarathiMirrorField';
import { TranslateAllButton } from '@/components/shared/TranslateAllButton';
import { DEV_AUTOFILL, DUMMY_SHOP_DATA } from '@/lib/devHelpers';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

/* ── Types ───────────────────────────────────────────────────────── */
type DraftShop = {
  id: string;           // local key
  photo_blob: Blob | null;
  photo_preview: string;
  latitude: string;
  longitude: string;
  // all optional
  name: string;
  phone: string;
  whatsapp: string;
  area: string;
  sub_area: string;
  address: string;
  category_id: string;
  opening_time: string;
  closing_time: string;
  description: string;
  keywords: string;
  amenities: string[];
  // Marathi mirror values — auto-translated via MyMemory, editable.
  mr_name: string;
  mr_area: string;
  mr_sub_area: string;
  mr_address: string;
  mr_description: string;
  mr_keywords: string;
};

function emptyDraft(): DraftShop {
  return {
    id: crypto.randomUUID(),
    photo_blob: null, photo_preview: '',
    latitude: '', longitude: '',
    name: '', phone: '', whatsapp: '',
    area: '', sub_area: '', address: '',
    category_id: '', opening_time: '', closing_time: '',
    description: '', keywords: '',
    amenities: [],
    mr_name: '', mr_area: '', mr_sub_area: '', mr_address: '', mr_description: '', mr_keywords: '',
  };
}

interface Props {
  onClose: () => void;
  onDone: () => void;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-foreground mb-1.5">{label}</label>
      {children}
    </div>
  );
}

export function SpeedShopModal({ onClose, onDone }: Props) {
  const { currentCity, currentVillage, townName, allCities } = useCity();
  const [targetCityId, setTargetCityId] = useState(currentCity.id);
  const [targetVillageId, setTargetVillageId] = useState(currentVillage?.id || '');

  const { data: cityVillages = [] } = useQuery({
    queryKey: ['admin-speed-shop-villages', targetCityId],
    queryFn: () => fetchVillagesForCity(targetCityId),
    enabled: !!targetCityId,
  });

  const [drafts, setDrafts]           = useState<DraftShop[]>([emptyDraft()]);
  const [currentIdx, setCurrentIdx]   = useState(0);
  const [lastArea, setLastArea]       = useState('');
  const [locating, setLocating]       = useState(false);
  const [submitting, setSubmitting]   = useState(false);
  const [showCancel, setShowCancel]   = useState(false);
  const [errors, setErrors]           = useState<Record<string, string>>({});
  const [showMr, setShowMr]           = useState(false);

  const { data: categories = [] } = useQuery({
    queryKey: ['admin-categories'],
    queryFn: async () => {
      const { data, error } = await supabase.from('categories').select('*').eq('is_active', true).order('name');
      if (error) throw error;
      return data;
    },
  });

  const draft = drafts[currentIdx];

  const updateDraft = useCallback((patch: Partial<DraftShop>) => {
    setDrafts((prev) => prev.map((d, i) => i === currentIdx ? { ...d, ...patch } : d));
    setErrors({});
  }, [currentIdx]);

  /* ── GPS (fresh per draft) ──────────────────────────────────── */
  const handleGetLocation = () => {
    if (!navigator.geolocation) { toast.error('Geolocation not supported'); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        updateDraft({ latitude: pos.coords.latitude.toFixed(6), longitude: pos.coords.longitude.toFixed(6) });
        setLocating(false);
        toast.success('Location captured!');
      },
      (err) => {
        setLocating(false);
        if (err.code === err.PERMISSION_DENIED) toast.error('Location permission denied.');
        else toast.error('Could not get location. Try again.');
      },
      { timeout: 10000, maximumAge: 0 } // maximumAge: 0 = always fresh
    );
  };

  /* ── Image crop ─────────────────────────────────────────────── */
  const handleCropComplete = (blob: Blob, previewDataUrl: string) => {
    updateDraft({ photo_blob: blob, photo_preview: previewDataUrl });
  };
  const handleCropClear = () => updateDraft({ photo_blob: null, photo_preview: '' });

  /* ── Validate current draft ─────────────────────────────────── */
  const validateCurrent = (): boolean => {
    const errs: Record<string, string> = {};
    if (!draft.photo_blob) errs.photo = 'Photo is required';
    if (!draft.latitude || !draft.longitude) errs.location = 'GPS location is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  /* ── Add another shop ───────────────────────────────────────── */
  const handleAddAnother = () => {
    if (!validateCurrent()) return;
    // Save last area from current draft
    if (draft.area.trim()) setLastArea(draft.area.trim());
    const newDraft = emptyDraft();
    // GPS NOT carried over — only area via "Previous Area" button
    setDrafts((prev) => [...prev, newDraft]);
    setCurrentIdx(drafts.length);
  };

  /* ── Navigate between drafts ────────────────────────────────── */
  const goTo = (idx: number) => {
    setCurrentIdx(Math.max(0, Math.min(drafts.length - 1, idx)));
    setErrors({});
  };

  /* ── Remove draft ───────────────────────────────────────────── */
  const removeDraft = (idx: number) => {
    if (drafts.length === 1) { setDrafts([emptyDraft()]); setCurrentIdx(0); return; }
    const next = drafts.filter((_, i) => i !== idx);
    setDrafts(next);
    setCurrentIdx(Math.min(idx, next.length - 1));
  };

  /* ── Submit all ─────────────────────────────────────────────── */
  const handleSubmitAll = async () => {
    // Validate all drafts have photo + GPS
    const invalid = drafts.findIndex((d) => !d.photo_blob || !d.latitude || !d.longitude);
    if (invalid !== -1) {
      setCurrentIdx(invalid);
      setErrors({ photo: !drafts[invalid].photo_blob ? 'Photo required' : '', location: (!drafts[invalid].latitude || !drafts[invalid].longitude) ? 'GPS required' : '' });
      toast.error(`Draft ${invalid + 1} is missing photo or location`);
      return;
    }
    setSubmitting(true);

    let saved = 0;
    for (const d of drafts) {
      try {
        // Upload photo with slug-based filename (uses shop name when available)
        const compressed = await compressImage(d.photo_blob! as unknown as File);
        let imageUrl: string;
        try {
          const result = await uploadShopImage(compressed, d.name?.trim() || 'shop');
          imageUrl = result.publicUrl;
        } catch {
          toast.error(`Photo upload failed for draft ${saved + 1}`);
          continue;
        }

        const payload: any = {
          name:         d.name.trim() || 'Unnamed Shop',
          phone:        d.phone.trim() ? normalizePhone(d.phone) : null,
          whatsapp:     d.whatsapp.trim() ? normalizeWhatsApp(d.whatsapp) : null,
          address:      d.address.trim() || null,
          area:         d.area.trim() ? normalizeArea(d.area) : null,
          sub_area:     d.sub_area.trim() || null,
          description:  d.description.trim() || null,
          keywords:     d.keywords.trim() || null,
          opening_time: d.opening_time || null,
          closing_time: d.closing_time || null,
          image_url:    imageUrl,
          latitude:     parseFloat(d.latitude),
          longitude:    parseFloat(d.longitude),
          amenities:    d.amenities.length > 0 ? d.amenities : null,
          is_active:    false,   // always draft
          is_open:      true,
          is_verified:  false,
          city_id:      (targetCityId && !targetCityId.startsWith('00000000-')) ? targetCityId : '644b68eb-472c-40d3-9f83-c7d26e121498',
          village_id:   (targetVillageId && !targetVillageId.startsWith('00000000-')) ? targetVillageId : null,
          district_id:  (() => {
            const c = allCities.find((x) => x.id === targetCityId);
            return (c?.district_id && !c.district_id.startsWith('00000000-')) ? c.district_id : null;
          })(),
          state_id:     (() => {
            const c = allCities.find((x) => x.id === targetCityId);
            return (c?.state_id && !c.state_id.startsWith('00000000-')) ? c.state_id : null;
          })(),
        };

        const { data: inserted, error: insertErr } = await supabase.from('shops').insert(payload).select('id').single();
        if (insertErr) {
          console.error('[SpeedShopModal] insert error:', insertErr);
          toast.error(`Failed to save draft ${saved + 1}: ${insertErr.message}`);
          continue;
        }

        // Category link
        if (d.category_id && inserted?.id) {
          await supabase.from('shop_categories').insert({ shop_id: inserted.id, category_id: d.category_id });
        }

        // Marathi translation: auto-fill blanks from English source.
        const enSrc: Record<string, string> = {
          name: d.name.trim(),
          area: d.area.trim(),
          sub_area: d.sub_area.trim(),
          address: d.address.trim(),
          description: d.description.trim(),
          keywords: d.keywords.trim(),
        };
        const mrPayload: Record<string, string | null> = {
          name: d.mr_name.trim() || null,
          area: d.mr_area.trim() || null,
          sub_area: d.mr_sub_area.trim() || null,
          address: d.mr_address.trim() || null,
          description: d.mr_description.trim() || null,
          keywords: d.mr_keywords.trim() || null,
        };
        await Promise.all(
          Object.keys(enSrc).map(async (k) => {
            if (mrPayload[k] || !enSrc[k]) return;
            try {
              const out = (await translateEnToMr(enSrc[k])).trim();
              if (out && out.toLowerCase() !== enSrc[k].toLowerCase()) mrPayload[k] = out;
            } catch { /* skip */ }
          }),
        );
        if (inserted?.id && Object.values(mrPayload).some(Boolean)) {
          await (supabase as any).from('shop_translations').upsert(
            { shop_id: inserted.id, locale: 'mr', ...mrPayload },
            { onConflict: 'shop_id,locale' },
          );
        }
        saved++;
      } catch (e) {
        toast.error(`Unexpected error on draft ${saved + 1}`);
      }
    }

    setSubmitting(false);
    toast.success(`${saved} of ${drafts.length} draft shops saved. They are hidden until activated.`);
    onDone();
  };

  /* ── Dev fill ───────────────────────────────────────────────── */
  const handleDevFill = () => {
    updateDraft({
      name:         DUMMY_SHOP_DATA.name + ` (Draft ${currentIdx + 1})`,
      phone:        DUMMY_SHOP_DATA.phone,
      area:         DUMMY_SHOP_DATA.area,
      sub_area:     DUMMY_SHOP_DATA.sub_area,
      address:      DUMMY_SHOP_DATA.address,
      description:  DUMMY_SHOP_DATA.description,
      keywords:     DUMMY_SHOP_DATA.keywords,
      opening_time: DUMMY_SHOP_DATA.opening_time,
      closing_time: DUMMY_SHOP_DATA.closing_time,
      latitude:     DUMMY_SHOP_DATA.latitude,
      longitude:    DUMMY_SHOP_DATA.longitude,
    });
  };

  /* ── Render ─────────────────────────────────────────────────── */
  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center overflow-y-auto overscroll-contain py-4 px-3 sm:px-4"
        onClick={() => setShowCancel(true)}
      >
        <div
          className="bg-card rounded-2xl border border-border w-full max-w-xl shadow-2xl my-4 flex flex-col max-h-[calc(100dvh-2rem)] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >

          {/* Header */}
          <div className="flex items-center justify-between gap-2 px-4 sm:px-6 py-4 border-b border-border shrink-0">
            <div className="min-w-0">
              <h2 className="font-bold text-lg text-foreground flex items-center gap-2 truncate">
                ⚡ Speed Add
              </h2>
              <p className="text-xs text-muted-foreground truncate">Draft {currentIdx + 1} of {drafts.length} — saved as hidden (inactive)</p>
            </div>
            <button type="button" onClick={() => setShowCancel(true)} aria-label="Close" className="p-1.5 hover:bg-muted rounded-lg shrink-0"><X className="w-5 h-5" /></button>
          </div>

          {/* Target Location bar */}
          <div className="bg-primary/5 border-b border-border px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground shrink-0">
              <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
              <span>Location:</span>
            </div>
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto sm:flex-1 sm:max-w-md min-w-0">
              <select
                value={targetCityId}
                onChange={(e) => {
                  setTargetCityId(e.target.value);
                  setTargetVillageId('');
                }}
                className="text-xs px-2 py-1 rounded-md border border-input bg-background font-medium min-w-0 flex-1 max-w-full truncate focus:outline-none"
              >
                {allCities.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} {c.name_mr ? `(${c.name_mr})` : ''}</option>
                ))}
              </select>
              <select
                value={targetVillageId}
                onChange={(e) => setTargetVillageId(e.target.value)}
                className="text-xs px-2 py-1 rounded-md border border-input bg-background font-medium min-w-0 flex-1 max-w-full truncate focus:outline-none"
              >
                <option value="">Main Town (no village)</option>
                {cityVillages.map((v) => (
                  <option key={v.id} value={v.id}>{v.name} {v.name_mr ? `(${v.name_mr})` : ''}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Draft thumbnails nav */}
          {drafts.length > 1 && (
            <div className="flex items-center gap-2 px-4 sm:px-6 py-2.5 border-b border-border shrink-0 overflow-x-auto no-scrollbar">
              {drafts.map((d, i) => (
                <button key={d.id} onClick={() => goTo(i)}
                  className={`shrink-0 w-12 h-12 rounded-lg border-2 overflow-hidden transition-all ${i === currentIdx ? 'border-primary' : 'border-border opacity-60 hover:opacity-100'}`}>
                  {d.photo_preview
                    ? <img src={d.photo_preview} alt={`Draft ${i + 1}`} className="w-full h-full object-cover" />
                    : <span className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground bg-muted">#{i + 1}</span>}
                </button>
              ))}
            </div>
          )}

          {/* Form */}
          <div className="overflow-y-auto overscroll-contain flex-1 min-h-0 p-4 sm:p-6 space-y-4">
            {DEV_AUTOFILL && (
              <button type="button" onClick={handleDevFill}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold border border-dashed border-secondary text-secondary bg-secondary/10 hover:bg-secondary/20 transition-colors">
                <FlaskConical className="w-3.5 h-3.5" />[DEV] Auto-fill Draft {currentIdx + 1}
              </button>
            )}

            {/* Required: Photo */}
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1.5">
                Shop Photo <span className="text-destructive">*</span>
              </label>
              <ImageCropPicker
                previewUrl={draft.photo_preview || undefined}
                onCropComplete={handleCropComplete}
                onClear={handleCropClear}
                maxMB={15}
              />
              {errors.photo && <p className="text-xs text-destructive mt-1">{errors.photo}</p>}
            </div>

            {/* Required: GPS */}
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1.5">
                GPS Location <span className="text-destructive">*</span>
                <span className="text-xs text-muted-foreground font-normal ml-1">(always freshly captured)</span>
              </label>
              {(draft.latitude && draft.longitude) ? (
                <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 rounded-lg border border-border bg-muted/40">
                  <span className="text-[11px] font-mono text-foreground min-w-0 break-all">📍 {draft.latitude}, {draft.longitude}</span>
                  <button type="button" onClick={() => updateDraft({ latitude: '', longitude: '' })}
                    className="text-xs text-destructive font-semibold hover:opacity-70 shrink-0">Clear</button>
                </div>
              ) : (
                <button type="button" onClick={handleGetLocation} disabled={locating}
                  className="w-full flex items-center justify-center gap-2 px-3 py-3 rounded-lg border border-border text-sm font-semibold transition-colors disabled:opacity-60"
                  style={{ background: 'hsl(var(--muted))', color: 'hsl(var(--foreground))' }}>
                  {locating ? <><Loader2 className="w-4 h-4 animate-spin" />Getting location…</> : <><Navigation className="w-4 h-4 text-primary" />Capture GPS Location</>}
                </button>
              )}
              {errors.location && <p className="text-xs text-destructive mt-1">{errors.location}</p>}
            </div>

            {/* Divider */}
            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-border" />
              <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Optional Details</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <Field label="Shop Name">
              <input value={draft.name} onChange={(e) => updateDraft({ name: e.target.value })}
                className={inputCls} placeholder="e.g. Sharma General Store" maxLength={120} />
            </Field>

            <Field label="Phone">
              <input value={draft.phone} onChange={(e) => updateDraft({ phone: e.target.value })}
                className={inputCls} placeholder="10-digit mobile number" inputMode="numeric" maxLength={15} />
            </Field>

            {/* Area with Previous Area helper */}
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                <label className="text-sm font-semibold text-foreground">Area / Locality</label>
                {lastArea && (
                  <button type="button" onClick={() => updateDraft({ area: lastArea })}
                    className="text-xs font-medium text-primary hover:underline flex items-center gap-1">
                    ↩ Use prev: <span className="truncate max-w-[100px]">{lastArea}</span>
                  </button>
                )}
              </div>
              <input value={draft.area} onChange={(e) => updateDraft({ area: e.target.value })}
                className={inputCls} placeholder={`e.g. Main Road, ${townName}`} list="speed-common-areas" maxLength={100} />
              <datalist id="speed-common-areas">
                {['Main Road','Station Road','Bus Stand Area','Market Area','Ward 1','Ward 2','Ward 3','Ward 4','Ward 5'].map((v) => <option key={v} value={v} />)}
              </datalist>
            </div>

            <Field label="Sub Area / Landmark">
              <input value={draft.sub_area} onChange={(e) => updateDraft({ sub_area: e.target.value })}
                className={inputCls} placeholder="e.g. Near Police Station" maxLength={100} />
            </Field>

            <Field label="Address">
              <input value={draft.address} onChange={(e) => updateDraft({ address: e.target.value })}
                className={inputCls} placeholder="Street / landmark" maxLength={250} />
            </Field>

            <Field label="Category">
              <select value={draft.category_id} onChange={(e) => updateDraft({ category_id: e.target.value })}
                className={inputCls + ' cursor-pointer'}>
                <option value="">No category</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
              </select>
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <TimePickerField label="Opening Time" optional value={draft.opening_time} onChange={(v) => updateDraft({ opening_time: v })} />
              <TimePickerField label="Closing Time" optional value={draft.closing_time} onChange={(v) => updateDraft({ closing_time: v })} />
            </div>

            <Field label="Description">
              <textarea value={draft.description} onChange={(e) => updateDraft({ description: e.target.value })}
                className={inputCls + ' min-h-[64px] resize-y'} placeholder="What does this shop sell?" maxLength={500} />
            </Field>

            <Field label="Keywords">
              <input value={draft.keywords} onChange={(e) => updateDraft({ keywords: e.target.value })}
                className={inputCls} placeholder="e.g. grocery, medicines" maxLength={200} />
            </Field>

            <Field label="Amenities">
              <AmenitiesPicker value={draft.amenities} onChange={(next) => updateDraft({ amenities: next })} />
            </Field>

            {/* Marathi mirror section — auto-translates from English via MyMemory */}
            <div className="border border-border rounded-xl">
              <button
                type="button"
                onClick={() => setShowMr((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-bold text-foreground hover:bg-muted/40 transition-colors rounded-xl"
              >
                <span className="flex items-center gap-2">🌐 मराठी अनुवाद (Marathi translation)</span>
                <span className="text-xs text-muted-foreground font-normal">{showMr ? '▲' : '▼'}</span>
              </button>
              {showMr && (
                <div className="px-4 pb-4 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-[11px] text-muted-foreground leading-snug min-w-[200px] flex-1">
                      Optional. Tap <strong>Translate to Marathi</strong> to auto-fill every empty Marathi field for this draft from the English values. Shared cache — repeats are free. Saved alongside this shop on submit.
                    </p>
                    <TranslateAllButton
                      pairs={[
                        { source: draft.name, value: draft.mr_name, onChange: (v) => updateDraft({ mr_name: v }) },
                        { source: draft.area, value: draft.mr_area, onChange: (v) => updateDraft({ mr_area: v }) },
                        { source: draft.sub_area, value: draft.mr_sub_area, onChange: (v) => updateDraft({ mr_sub_area: v }) },
                        { source: draft.address, value: draft.mr_address, onChange: (v) => updateDraft({ mr_address: v }) },
                        { source: draft.description, value: draft.mr_description, onChange: (v) => updateDraft({ mr_description: v }) },
                        { source: draft.keywords, value: draft.mr_keywords, onChange: (v) => updateDraft({ mr_keywords: v }) },
                      ]}
                    />
                  </div>
                  <MarathiMirrorField label="Shop name (मराठी)" value={draft.mr_name}
                    onChange={(v) => updateDraft({ mr_name: v })} maxLength={120} />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <MarathiMirrorField label="Area (परिसर)" value={draft.mr_area}
                      onChange={(v) => updateDraft({ mr_area: v })} maxLength={80} />
                    <MarathiMirrorField label="Sub-area (उप-परिसर)" value={draft.mr_sub_area}
                      onChange={(v) => updateDraft({ mr_sub_area: v })} maxLength={80} />
                  </div>
                  <MarathiMirrorField label="Address (पत्ता)" value={draft.mr_address}
                    onChange={(v) => updateDraft({ mr_address: v })} maxLength={200} />
                  <MarathiMirrorField label="Description (वर्णन)" value={draft.mr_description}
                    onChange={(v) => updateDraft({ mr_description: v })} textarea rows={3} maxLength={500} />
                  <MarathiMirrorField label="Keywords (कीवर्ड)" value={draft.mr_keywords}
                    onChange={(v) => updateDraft({ mr_keywords: v })} maxLength={200} />
                </div>
              )}
            </div>
          </div>

          {/* Footer actions */}
          <div className="px-4 sm:px-6 py-3 sm:py-4 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] border-t border-border shrink-0 space-y-2">
            {/* Nav row */}
            {drafts.length > 1 && (
              <div className="flex items-center justify-between mb-1">
                <button type="button" onClick={() => goTo(currentIdx - 1)} disabled={currentIdx === 0}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 font-medium">
                  <ChevronLeft className="w-4 h-4" /> Prev
                </button>
                <span className="text-xs text-muted-foreground">{currentIdx + 1} / {drafts.length}</span>
                <button type="button" onClick={() => goTo(currentIdx + 1)} disabled={currentIdx === drafts.length - 1}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 font-medium">
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {/* Remove current draft */}
              {drafts.length > 1 && (
                <button type="button" onClick={() => removeDraft(currentIdx)}
                  className="p-2.5 rounded-lg border border-border text-destructive hover:bg-destructive/10 transition-colors shrink-0" title="Remove this draft">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}

              {/* Add another */}
              <button type="button" onClick={handleAddAnother}
                className="flex items-center justify-center gap-2 flex-1 min-w-[120px] py-2.5 rounded-lg border border-border font-semibold text-sm text-foreground hover:bg-muted transition-colors">
                <Plus className="w-4 h-4" /> Add Another
              </button>

              {/* Submit all */}
              <button type="button" onClick={handleSubmitAll} disabled={submitting}
                className="flex items-center justify-center gap-2 flex-1 min-w-[120px] py-2.5 rounded-lg bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-colors disabled:opacity-60">
                {submitting
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Saving…</>
                  : <><Send className="w-4 h-4" />Submit {drafts.length > 1 ? `All (${drafts.length})` : '1 Draft'}</>}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Cancel confirmation */}
      <AlertDialog open={showCancel} onOpenChange={setShowCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard all drafts?</AlertDialogTitle>
            <AlertDialogDescription>
              You have {drafts.length} draft{drafts.length > 1 ? 's' : ''} that have not been submitted. This will discard all of them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Drafts</AlertDialogCancel>
            <AlertDialogAction onClick={onClose} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Discard All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
