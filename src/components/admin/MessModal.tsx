import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Loader2, X, MapPin, UtensilsCrossed, Clock, Check, Sparkles, AlertTriangle, ShieldCheck
} from 'lucide-react';
import { toast } from 'sonner';
import { normalizeWhatsApp, inputCls } from './adminHelpers';
import { isValidIndianPhone, cn } from '@/lib/utils';
import { updateShopWithConcurrency } from '@/lib/shopConcurrency';
import { uploadShopImage, removeShopImages, diffRemovedStoragePaths } from '@/lib/storageNaming';
import { MultiImageCropPicker } from '@/components/shared/MultiImageCropPicker';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useCity } from '@/hooks/useCity';
import { fetchVillagesForCity } from '@/lib/geo/geoService';
import { MarathiMirrorField } from '@/components/shared/MarathiMirrorField';
import { TranslateAllButton } from '@/components/shared/TranslateAllButton';
import { translateEnToMr } from '@/lib/translateApi';
import { saveMessProfile } from '@/lib/living/livingService';
import type { MessType, MessWithDetails } from '@/lib/living/livingTypes';
import { DEV_AUTOFILL, getMessModalAutofillSample } from '@/lib/devHelpers';

const MESS_AMENITY_OPTIONS = [
  'Pure Veg',
  'Hotel / Restaurant',
  'Mess / Bhojanalay',
  'Unlimited Thali',
  'Tiffin Delivery',
  'Family Dining Hall',
  'AC Seating Available',
  'Dine-in Available',
  'Parcel / Takeaway Available',
  'Breakfast & Snacks',
  'RO Drinking Water',
  'Monthly Pass Available',
  'Sunday Special Feast',
  'UPI / Online Payment',
  'Spacious Dining Hall',
  'Hygienic Kitchen',
  'Jain Food Available',
];

interface MessModalProps {
  mess: any;
  onClose: () => void;
  onSaved: () => void;
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-foreground mb-1.5">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      {children}
    </div>
  );
}

export function MessModal({ mess, onClose, onSaved }: MessModalProps) {
  const { townName, currentCity, allCities } = useCity();

  const isUUID = (val?: string | null): boolean =>
    typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

  const isEdit = Boolean(mess?.id && isUUID(mess.id) && !mess.id.startsWith('demo-'));
  const [baselineUpdatedAt, setBaselineUpdatedAt] = useState<string | null | undefined>(mess?.updated_at);

  const [establishmentType, setEstablishmentType] = useState<'mess' | 'hotel' | 'tiffin'>(() => {
    const raw = `${mess?.name || ''} ${(mess?.amenities || []).join(' ')}`.toLowerCase();
    if (raw.includes('hotel') || raw.includes('restaurant') || raw.includes('dhaba')) return 'hotel';
    if (raw.includes('tiffin')) return 'tiffin';
    return 'mess';
  });

  // Shop basic details
  const [form, setForm] = useState({
    name:         mess?.name || '',
    phone:        mess?.phone || '',
    whatsapp:     mess?.whatsapp || '',
    address:      mess?.address || '',
    area:         mess?.area || '',
    sub_area:     mess?.sub_area || '',
    description:  mess?.description || '',
    is_active:    mess?.is_active ?? true,
    is_verified:  mess?.is_verified ?? false,
    city_id:      mess?.city_id || currentCity.id,
    village_id:   mess?.village_id || '',
  });

  // Specialized Mess Profile fields
  const [messType, setMessType] = useState<MessType>(mess?.mess_profile?.mess_type || 'pure_veg');
  const [monthlyRate, setMonthlyRate] = useState<string>(mess?.mess_profile?.monthly_rate ? String(mess.mess_profile.monthly_rate) : '');
  const [singleThaliRate, setSingleThaliRate] = useState<string>(mess?.mess_profile?.single_thali_rate ? String(mess.mess_profile.single_thali_rate) : '');
  const [tiffinDelivery, setTiffinDelivery] = useState<boolean>(mess?.mess_profile?.tiffin_delivery ?? false);
  const [lunchTiming, setLunchTiming] = useState<string>(mess?.mess_profile?.lunch_timing || '11:30 AM - 02:30 PM');
  const [dinnerTiming, setDinnerTiming] = useState<string>(mess?.mess_profile?.dinner_timing || '07:30 PM - 10:30 PM');
  const [sundayFeast, setSundayFeast] = useState<boolean>(mess?.mess_profile?.sunday_feast ?? false);

  // Amenities
  const initialAmenities: string[] = Array.isArray(mess?.amenities) ? mess.amenities : [];
  const [amenities, setAmenities] = useState<string[]>(initialAmenities);

  // Photos
  const initialPhotos: string[] = Array.isArray(mess?.photos) && mess.photos.length > 0
    ? mess.photos
    : (mess?.image_url ? [mess.image_url] : []);
  const initialSavedUrlsRef = useRef<string[]>(initialPhotos);
  const sessionUploadedUrlsRef = useRef<Set<string>>(new Set());
  const [photos, setPhotos] = useState<string[]>(initialPhotos);

  const handleClose = () => {
    if (saving) return;
    const unsavedPaths = diffRemovedStoragePaths(
      Array.from(sessionUploadedUrlsRef.current),
      initialSavedUrlsRef.current,
    );
    if (unsavedPaths.length > 0) void removeShopImages(unsavedPaths);
    onClose();
  };

  // Marathi translation
  const [mr, setMr] = useState({
    name: mess?.name_mr || '',
    description: '',
    address: '',
    area: '',
    sub_area: '',
  });
  const [showMr, setShowMr] = useState(Boolean(mess?.name_mr));

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Background sync latest updated_at and mess profile if editing
  useEffect(() => {
    if (!isEdit || !mess?.id) return;
    let cancelled = false;

    // Fetch shop updated_at
    supabase
      .from('shops')
      .select('updated_at, photos, description, amenities')
      .eq('id', mess.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return;
        if (data.updated_at) setBaselineUpdatedAt(data.updated_at);
        if (Array.isArray(data.photos) && data.photos.length > 0) {
          initialSavedUrlsRef.current = Array.from(new Set([...initialSavedUrlsRef.current, ...data.photos]));
          setPhotos((curr) => (curr.length <= 1 ? data.photos : curr));
        }
        if (data.description && !form.description) {
          setForm((f) => ({ ...f, description: data.description }));
        }
        if (Array.isArray(data.amenities) && data.amenities.length > 0 && amenities.length === 0) {
          setAmenities(data.amenities);
        }
      });

    // Fetch mess profile
    supabase
      .from('mess_profiles')
      .select('*')
      .eq('shop_id', mess.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return;
        if (data.mess_type) setMessType(data.mess_type as MessType);
        if (data.monthly_rate !== null && data.monthly_rate !== undefined) setMonthlyRate(String(data.monthly_rate));
        if (data.single_thali_rate !== null && data.single_thali_rate !== undefined) setSingleThaliRate(String(data.single_thali_rate));
        if (data.tiffin_delivery !== undefined) setTiffinDelivery(Boolean(data.tiffin_delivery));
        if (data.lunch_timing) setLunchTiming(data.lunch_timing);
        if (data.dinner_timing) setDinnerTiming(data.dinner_timing);
        if (data.sunday_feast !== undefined) setSundayFeast(Boolean(data.sunday_feast));
      });

    // Fetch Marathi translation
    (async () => {
      const { data } = await (supabase as any)
        .from('shop_translations')
        .select('name, description, address, area, sub_area')
        .eq('shop_id', mess.id)
        .eq('locale', 'mr')
        .maybeSingle();
      if (!cancelled && data) {
        setMr({
          name: data.name || '',
          description: data.description || '',
          address: data.address || '',
          area: data.area || '',
          sub_area: data.sub_area || '',
        });
        if (Object.values(data).some(Boolean)) setShowMr(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isEdit, mess?.id]);

  const { data: cityVillages = [] } = useQuery({
    queryKey: ['admin-mess-villages', form.city_id],
    queryFn: () => fetchVillagesForCity(form.city_id),
    enabled: !!form.city_id,
  });

  const toggleAmenity = (item: string) => {
    setAmenities((prev) =>
      prev.includes(item) ? prev.filter((a) => a !== item) : [...prev, item]
    );
  };

  const handleAutofillSample = () => {
    const sample = getMessModalAutofillSample(establishmentType, messType, townName);
    setForm((f) => ({
      ...f,
      name: sample.name,
      phone: sample.phone,
      whatsapp: sample.whatsapp,
      area: sample.area,
      sub_area: sample.sub_area,
      address: sample.address,
      description: sample.description,
    }));
    setMonthlyRate(sample.monthlyRate);
    setSingleThaliRate(sample.singleThaliRate);
    setTiffinDelivery(sample.tiffinDelivery);
    setSundayFeast(sample.sundayFeast);
    setLunchTiming(sample.lunchTiming);
    setDinnerTiming(sample.dinnerTiming);
    setAmenities(sample.amenities);
    setMr({
      name: sample.mr.name,
      area: sample.mr.area,
      sub_area: sample.mr.sub_area,
      address: sample.mr.address,
      description: sample.mr.description,
    });
    setErrors({});
    toast.success('Sample establishment details filled');
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Mess / Bhojanalay name is required';
    if (!form.phone.trim()) {
      errs.phone = 'Phone number is required';
    } else if (!isValidIndianPhone(form.phone)) {
      errs.phone = 'Enter a valid Indian mobile (10 digits, starts 6–9)';
    }
    if (form.whatsapp.trim() && !isValidIndianPhone(form.whatsapp)) {
      errs.whatsapp = 'Enter a valid WhatsApp number (10 digits, starts 6–9)';
    }
    if (!form.area.trim() && !form.address.trim()) {
      errs.area = 'Area or address is required';
    }
    if (monthlyRate && (isNaN(Number(monthlyRate)) || Number(monthlyRate) < 0)) {
      errs.monthlyRate = 'Monthly rate must be a valid positive number';
    }
    if (singleThaliRate && (isNaN(Number(singleThaliRate)) || Number(singleThaliRate) < 0)) {
      errs.singleThaliRate = 'Thali rate must be a valid positive number';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      toast.error('Please fix the errors in the form before saving');
      return;
    }

    setSaving(true);
    try {
      const resolvedCityId = form.city_id && !form.city_id.startsWith('00000000-')
        ? form.city_id
        : (currentCity?.id && !currentCity.id.startsWith('00000000-') ? currentCity.id : '644b68eb-472c-40d3-9f83-c7d26e121498');

      const selectedCityObj = allCities.find((c) => c.id === resolvedCityId) || currentCity;
      const resolvedVillageId = form.village_id && !form.village_id.startsWith('00000000-') ? form.village_id : null;
      const resolvedDistrictId = selectedCityObj?.district_id && !selectedCityObj.district_id.startsWith('00000000-') ? selectedCityObj.district_id : null;
      const resolvedStateId = selectedCityObj?.state_id && !selectedCityObj.state_id.startsWith('00000000-') ? selectedCityObj.state_id : null;

      const finalAmenities = Array.from(new Set([
        ...amenities,
        establishmentType === 'hotel' ? 'Hotel / Restaurant' : establishmentType === 'tiffin' ? 'Tiffin Delivery' : 'Mess / Bhojanalay',
      ]));

      const shopPayload: any = {
        name:         form.name.trim(),
        phone:        form.phone.trim() || null,
        whatsapp:     form.whatsapp.trim() ? normalizeWhatsApp(form.whatsapp) : null,
        address:      form.address.trim() || null,
        area:         form.area.trim() || null,
        sub_area:     form.sub_area.trim() || null,
        description:  form.description.trim() || null,
        is_active:    form.is_active,
        is_verified:  form.is_verified,
        is_open:      true,
        image_url:    photos[0] || null,
        photos:       photos,
        amenities:    finalAmenities,
        city_id:      resolvedCityId,
        village_id:   resolvedVillageId,
        district_id:  resolvedDistrictId,
        state_id:     resolvedStateId,
      };

      let shopId = mess?.id;

      if (isEdit) {
        const baseline = baselineUpdatedAt ?? mess.updated_at;
        const result = await updateShopWithConcurrency(mess.id, baseline, shopPayload);
        if (!result.ok) {
          const r = result as Extract<typeof result, { ok: false }>;
          if (r.conflict) {
            if (r.latest?.updated_at) setBaselineUpdatedAt(r.latest.updated_at);
            toast.error(
              'This mess was updated by someone else. Click "Save Mess" again to overwrite, or close to cancel.',
              { duration: 6000 }
            );
            setSaving(false);
            return;
          }
          throw new Error((r as any).error || 'Failed to update shop');
        }
      } else {
        const { data: inserted, error: insertError } = await supabase
          .from('shops')
          .insert(shopPayload)
          .select('id')
          .single();
        if (insertError) throw insertError;
        shopId = inserted.id;
      }

      if (!shopId) throw new Error('Shop ID missing');

      // 1. Ensure category is linked to Restaurant or Mess
      const targetQuery = establishmentType === 'hotel' ? '%restaurant%' : '%mess%';
      let { data: catRecord } = await supabase
        .from('categories')
        .select('id')
        .ilike('name', targetQuery)
        .limit(1)
        .maybeSingle();

      if (!catRecord?.id) {
        const { data: fallbackCat } = await supabase
          .from('categories')
          .select('id')
          .ilike('name', '%mess%')
          .limit(1)
          .maybeSingle();
        catRecord = fallbackCat;
      }

      if (catRecord?.id) {
        // Upsert into shop_categories
        await supabase
          .from('shop_categories')
          .delete()
          .eq('shop_id', shopId);

        await supabase
          .from('shop_categories')
          .insert({ shop_id: shopId, category_id: catRecord.id });
      }

      // 2. Save specialized mess_profiles row
      const { error: profileError } = await saveMessProfile({
        shop_id: shopId,
        mess_type: messType,
        monthly_rate: monthlyRate ? Number(monthlyRate) : null,
        single_thali_rate: singleThaliRate ? Number(singleThaliRate) : null,
        tiffin_delivery: tiffinDelivery,
        lunch_timing: lunchTiming.trim() || null,
        dinner_timing: dinnerTiming.trim() || null,
        sunday_feast: sundayFeast,
      });

      if (profileError) {
        console.error('[MessModal] Error saving mess profile:', profileError);
        toast.error('Shop details saved, but failed to save mess rates.');
      }

      // 3. Marathi translation best-effort persist
      const mrFinal: Record<string, string | null> = {
        name: mr.name.trim() || null,
        description: mr.description.trim() || null,
        address: mr.address.trim() || null,
        area: mr.area.trim() || null,
        sub_area: mr.sub_area.trim() || null,
      };

      // Auto-translate blanks
      const enSource = {
        name: form.name.trim(),
        description: form.description.trim(),
        address: form.address.trim(),
        area: form.area.trim(),
        sub_area: form.sub_area.trim(),
      };

      await Promise.all(
        (Object.keys(enSource) as (keyof typeof enSource)[]).map(async (k) => {
          if (mrFinal[k] || !enSource[k]) return;
          try {
            const out = (await translateEnToMr(enSource[k])).trim();
            if (out && out.toLowerCase() !== enSource[k].toLowerCase()) {
              mrFinal[k] = out;
            }
          } catch {
            // ignore auto-translate error
          }
        })
      );

      if (Object.values(mrFinal).some(Boolean)) {
        await (supabase as any)
          .from('shop_translations')
          .upsert(
            {
              shop_id: shopId,
              locale: 'mr',
              ...mrFinal,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'shop_id,locale' }
          );
      }

      const discardedPaths = diffRemovedStoragePaths(
        [...initialSavedUrlsRef.current, ...Array.from(sessionUploadedUrlsRef.current)],
        photos,
      );
      if (discardedPaths.length > 0) {
        void removeShopImages(discardedPaths);
      }

      toast.success(isEdit ? 'Listing updated successfully! ✓' : 'New listing created successfully! ✓');
      onSaved();
    } catch (err: any) {
      console.error('[MessModal] Save failed:', err);
      toast.error(err?.message || 'Failed to save listing');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto p-0 gap-0 rounded-2xl">
        <DialogHeader className="p-4 sm:p-5 pr-12 pb-3 border-b border-border sticky top-0 bg-background/95 backdrop-blur z-10 text-left">
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="text-base sm:text-lg font-bold flex items-center gap-2 min-w-0">
              <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 border border-amber-500/20 shrink-0">
                <UtensilsCrossed className="w-5 h-5" />
              </span>
              <span className="min-w-0 break-words">{isEdit ? 'Edit Mess / Hotel' : 'Add New Mess / Hotel'}</span>
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            Configure hotel, restaurant, or bhojanalay details, menus, thali prices, and tiffin delivery.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="p-4 sm:p-5 space-y-6">
          {DEV_AUTOFILL && (
            <button
              type="button"
              onClick={handleAutofillSample}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border border-dashed border-amber-500/50 text-amber-700 dark:text-amber-300 bg-amber-500/10 hover:bg-amber-500/15 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Auto-fill Genuine Establishment Sample
            </button>
          )}

          {/* SECTION 1: BASIC INFORMATION */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-border pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                1. Basic Information & Type
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Establishment Type
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  { id: 'mess', label: '🍽️ Mess & Bhojanalay' },
                  { id: 'hotel', label: '🏨 Hotel & Restaurant' },
                  { id: 'tiffin', label: '🍱 Tiffin Service' },
                ].map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setEstablishmentType(type.id as any)}
                    className={cn(
                      'py-2 px-2.5 rounded-xl text-xs font-semibold border transition-all text-center',
                      establishmentType === type.id
                        ? 'border-primary bg-primary/10 text-primary shadow-xs'
                        : 'border-border bg-card text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label={establishmentType === 'hotel' ? 'Hotel / Restaurant Name (English)' : 'Mess Name (English)'} required>
                <input
                  value={form.name}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, name: e.target.value }));
                    setErrors((err) => ({ ...err, name: '' }));
                  }}
                  className={cn(inputCls, errors.name && 'border-destructive')}
                  placeholder={establishmentType === 'hotel' ? 'e.g. Hotel Visawa Family Restaurant' : 'e.g. Annapurna Bhojanalay'}
                  maxLength={120}
                />
                {errors.name && <p className="text-[11px] text-destructive mt-1">{errors.name}</p>}
              </Field>

              <Field label="Contact Phone" required>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, phone: e.target.value }));
                    setErrors((err) => ({ ...err, phone: '' }));
                  }}
                  className={cn(inputCls, errors.phone && 'border-destructive')}
                  placeholder="e.g. 9876543210"
                  maxLength={15}
                />
                {errors.phone && <p className="text-[11px] text-destructive mt-1">{errors.phone}</p>}
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="WhatsApp (Optional)">
                <input
                  type="tel"
                  value={form.whatsapp}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, whatsapp: e.target.value }));
                    setErrors((err) => ({ ...err, whatsapp: '' }));
                  }}
                  className={cn(inputCls, errors.whatsapp && 'border-destructive')}
                  placeholder="e.g. 9876543210"
                  maxLength={15}
                />
                {errors.whatsapp && <p className="text-[11px] text-destructive mt-1">{errors.whatsapp}</p>}
              </Field>

              <Field label="Town / City" required>
                <select
                  value={form.city_id}
                  onChange={(e) => {
                    const cid = e.target.value;
                    setForm((f) => ({ ...f, city_id: cid, village_id: '' }));
                  }}
                  className={inputCls}
                >
                  {allCities.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.name_mr ? `(${c.name_mr})` : ''}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Area / Locality" required>
                <input
                  value={form.area}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, area: e.target.value }));
                    setErrors((err) => ({ ...err, area: '' }));
                  }}
                  className={cn(inputCls, errors.area && 'border-destructive')}
                  placeholder={`e.g. Station Road, ${townName}`}
                  maxLength={100}
                />
                {errors.area && <p className="text-[11px] text-destructive mt-1">{errors.area}</p>}
              </Field>

              <Field label="Sub-Area / Landmark">
                <input
                  value={form.sub_area}
                  onChange={(e) => setForm((f) => ({ ...f, sub_area: e.target.value }))}
                  className={inputCls}
                  placeholder="e.g. Behind Bus Stand, Opp. College"
                  maxLength={100}
                />
              </Field>
            </div>

            <Field label="Full Address">
              <input
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                className={inputCls}
                placeholder="e.g. Plot No 12, Shivaji Chowk, Muktainagar"
                maxLength={250}
              />
            </Field>

            <Field label="Short Description (About the Mess)">
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className={cn(inputCls, 'min-h-[64px] resize-y')}
                placeholder="Homely hygienic food, unlimited chapatis, special sweet on Sunday..."
                maxLength={400}
              />
            </Field>
          </div>

          {/* SECTION 2: MESS PROFILE & RATES */}
          <div className="space-y-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
            <div className="flex items-center gap-2 pb-1">
              <UtensilsCrossed className="w-4 h-4 text-amber-600" />
              <span className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                2. Mess Profile, Rates & Timings
              </span>
            </div>

            {/* Food Type Selector */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-foreground">Dietary Category *</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  { value: 'pure_veg', label: '🟢 Pure Veg' },
                  { value: 'veg_nonveg', label: '🔴 Veg & Non-Veg' },
                  { value: 'jain_available', label: '🟡 Jain Available' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setMessType(opt.value as MessType)}
                    className={cn(
                      'py-2 px-3 rounded-lg text-xs font-bold border transition-all text-center',
                      messType === opt.value
                        ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                        : 'bg-card text-foreground border-border hover:bg-muted'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Monthly and Thali Rates */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Monthly Pass Rate (₹ / month)">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">₹</span>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    value={monthlyRate}
                    onChange={(e) => setMonthlyRate(e.target.value)}
                    className={cn(inputCls, 'pl-7')}
                    placeholder="e.g. 2800"
                  />
                </div>
                {errors.monthlyRate && <p className="text-[11px] text-destructive mt-1">{errors.monthlyRate}</p>}
              </Field>

              <Field label="Single Thali Rate (₹ / meal)">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">₹</span>
                  <input
                    type="number"
                    min="0"
                    step="10"
                    value={singleThaliRate}
                    onChange={(e) => setSingleThaliRate(e.target.value)}
                    className={cn(inputCls, 'pl-7')}
                    placeholder="e.g. 80"
                  />
                </div>
                {errors.singleThaliRate && <p className="text-[11px] text-destructive mt-1">{errors.singleThaliRate}</p>}
              </Field>
            </div>

            {/* Timings */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Lunch Timing">
                <input
                  value={lunchTiming}
                  onChange={(e) => setLunchTiming(e.target.value)}
                  className={inputCls}
                  placeholder="e.g. 11:30 AM - 02:30 PM"
                />
              </Field>

              <Field label="Dinner Timing">
                <input
                  value={dinnerTiming}
                  onChange={(e) => setDinnerTiming(e.target.value)}
                  className={inputCls}
                  placeholder="e.g. 07:30 PM - 10:30 PM"
                />
              </Field>
            </div>

            {/* Delivery & Special switches */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <label className="flex items-center gap-2.5 p-2.5 rounded-lg border border-border bg-card cursor-pointer hover:bg-muted/30">
                <input
                  type="checkbox"
                  checked={tiffinDelivery}
                  onChange={(e) => setTiffinDelivery(e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4"
                />
                <div className="text-xs">
                  <span className="font-bold text-foreground">🛵 Tiffin Delivery Service</span>
                  <p className="text-[11px] text-muted-foreground">Delivers tiffin to rooms or offices</p>
                </div>
              </label>

              <label className="flex items-center gap-2.5 p-2.5 rounded-lg border border-border bg-card cursor-pointer hover:bg-muted/30">
                <input
                  type="checkbox"
                  checked={sundayFeast}
                  onChange={(e) => setSundayFeast(e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4"
                />
                <div className="text-xs">
                  <span className="font-bold text-foreground">🎉 Sunday Special Feast</span>
                  <p className="text-[11px] text-muted-foreground">Sweet / Special meal on Sundays</p>
                </div>
              </label>
            </div>

            {/* Mess Amenities Pills */}
            <div className="space-y-1.5 pt-2">
              <label className="block text-xs font-semibold text-foreground">Mess Features & Facilities</label>
              <div className="flex flex-wrap gap-1.5">
                {MESS_AMENITY_OPTIONS.map((item) => {
                  const active = amenities.includes(item);
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => toggleAmenity(item)}
                      className={cn(
                        'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                        active
                          ? 'bg-amber-500 text-white border-amber-600'
                          : 'bg-card text-muted-foreground border-border hover:bg-muted'
                      )}
                    >
                      {active ? '✓ ' : '+ '}
                      {item}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* SECTION 3: PHOTOS */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 border-b border-border pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                3. Mess Photos & Showcase (Up to 5 images)
              </span>
            </div>

            <MultiImageCropPicker
              photos={photos}
              onChange={setPhotos}
              maxPhotos={5}
              label="Dining Hall & Food Photos"
              onUploadFile={async (blob) => {
                setUploading(true);
                try {
                  const result = await uploadShopImage(blob, form.name || 'mess', { prefix: 'mess' });
                  if (!result.isExisting) sessionUploadedUrlsRef.current.add(result.publicUrl);
                  if (result.isExisting) {
                    toast.info('Existing photo found in storage and linked.');
                  }
                  return result.publicUrl;
                } finally {
                  setUploading(false);
                }
              }}
            />
            {uploading && (
              <p className="text-xs text-amber-600 flex items-center gap-1">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading photo...
              </p>
            )}
          </div>

          {/* SECTION 4: MARATHI TRANSLATION */}
          <div className="border border-border rounded-xl">
            <button
              type="button"
              onClick={() => setShowMr((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 text-xs font-bold text-foreground hover:bg-muted/40 transition-colors rounded-xl"
            >
              <span className="flex items-center gap-2">
                🌐 मराठी माहिती (Marathi Translation)
              </span>
              <span className="text-xs text-muted-foreground font-normal">{showMr ? '▲ Close' : '▼ Expand'}</span>
            </button>

            {showMr && (
              <div className="p-4 pt-1 space-y-3 border-t border-border">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] text-muted-foreground min-w-[160px] flex-1">
                    Auto-translate or type custom Marathi text.
                  </p>
                  <TranslateAllButton
                    pairs={[
                      { source: form.name, value: mr.name, onChange: (v) => setMr((m) => ({ ...m, name: v })) },
                      { source: form.area, value: mr.area, onChange: (v) => setMr((m) => ({ ...m, area: v })) },
                      { source: form.sub_area, value: mr.sub_area, onChange: (v) => setMr((m) => ({ ...m, sub_area: v })) },
                      { source: form.address, value: mr.address, onChange: (v) => setMr((m) => ({ ...m, address: v })) },
                      { source: form.description, value: mr.description, onChange: (v) => setMr((m) => ({ ...m, description: v })) },
                    ]}
                  />
                </div>

                <MarathiMirrorField
                  label="Mess Name (मराठी)"
                  value={mr.name}
                  onChange={(v) => setMr((m) => ({ ...m, name: v }))}
                  placeholder="उदा. अन्नपूर्णा भोजनालय"
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <MarathiMirrorField
                    label="Area (परिसर)"
                    value={mr.area}
                    onChange={(v) => setMr((m) => ({ ...m, area: v }))}
                    placeholder="उदा. स्टेशन रोड"
                  />
                  <MarathiMirrorField
                    label="Sub-Area (खूण)"
                    value={mr.sub_area}
                    onChange={(v) => setMr((m) => ({ ...m, sub_area: v }))}
                    placeholder="उदा. बस स्थानकामागे"
                  />
                </div>
              </div>
            )}
          </div>

          {/* SECTION 5: STATUS & VERIFICATION */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-muted/30 rounded-xl border border-border">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                className="rounded text-primary focus:ring-primary w-4 h-4"
              />
              <span className="text-xs font-semibold text-foreground">Active in Directory</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_verified}
                onChange={(e) => setForm((f) => ({ ...f, is_verified: e.target.checked }))}
                className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
              />
              <span className="text-xs font-semibold text-foreground flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                Verified Listing
              </span>
            </label>
          </div>

          <DialogFooter className="sticky bottom-0 bg-background/95 backdrop-blur p-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] border-t border-border -mx-4 sm:-mx-5 -mb-4 sm:-mb-5 flex flex-row flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={saving}
              className="px-4 py-2 rounded-xl text-xs font-semibold border border-border bg-card hover:bg-muted text-foreground transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || uploading}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold bg-amber-600 text-white hover:bg-amber-700 transition-all shadow-sm active:scale-95 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" /> Save Mess Profile
                </>
              )}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
