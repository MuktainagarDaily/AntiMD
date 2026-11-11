import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Loader2, X, MapPin, BedDouble, Clock, Check, Sparkles, AlertTriangle, ShieldCheck, Users
} from 'lucide-react';
import { toast } from 'sonner';
import { normalizeWhatsApp, inputCls } from './adminHelpers';
import { isValidIndianPhone, cn } from '@/lib/utils';
import { updateShopWithConcurrency } from '@/lib/shopConcurrency';
import { uploadShopImage } from '@/lib/storageNaming';
import { MultiImageCropPicker } from '@/components/shared/MultiImageCropPicker';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useCity } from '@/hooks/useCity';
import { fetchVillagesForCity } from '@/lib/geo/geoService';
import { MarathiMirrorField } from '@/components/shared/MarathiMirrorField';
import { TranslateAllButton } from '@/components/shared/TranslateAllButton';
import { translateEnToMr } from '@/lib/translateApi';
import { savePGProfile } from '@/lib/living/livingService';
import type { PGGender, PGWithDetails, PGSharingRates } from '@/lib/living/livingTypes';

const PG_AMENITY_OPTIONS = [
  'High-Speed Wi-Fi',
  'RO Drinking Water',
  'Hot Water / Geyser',
  'Attached Washroom',
  'Study Table & Chair',
  'CCTV Security',
  'Daily Room Cleaning',
  'Washing Machine / Laundry',
  'Power Backup / Inverter',
  'Bike / 2-Wheeler Parking',
  'Personal Cupboard / Locker',
  'Air Cooler / AC',
];

interface PGModalProps {
  pg: any;
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

export function PGModal({ pg, onClose, onSaved }: PGModalProps) {
  const { townName, currentCity, allCities } = useCity();

  const isUUID = (val?: string | null): boolean =>
    typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

  const isEdit = Boolean(pg?.id && isUUID(pg.id) && !pg.id.startsWith('demo-'));
  const [baselineUpdatedAt, setBaselineUpdatedAt] = useState<string | null | undefined>(pg?.updated_at);

  // Shop basic details
  const [form, setForm] = useState({
    name:         pg?.name || '',
    phone:        pg?.phone || '',
    whatsapp:     pg?.whatsapp || '',
    address:      pg?.address || '',
    area:         pg?.area || '',
    sub_area:     pg?.sub_area || '',
    description:  pg?.description || '',
    is_active:    pg?.is_active ?? true,
    is_verified:  pg?.is_verified ?? false,
    city_id:      pg?.city_id || currentCity.id,
    village_id:   pg?.village_id || '',
  });

  // Specialized PG Profile fields
  const [gender, setGender] = useState<PGGender>(pg?.pg_profile?.gender || 'boys');
  const [occupancyTarget, setOccupancyTarget] = useState<'students' | 'professionals' | 'any'>(
    pg?.pg_profile?.occupancy_target || 'students'
  );
  const [totalBeds, setTotalBeds] = useState<string>(
    pg?.pg_profile?.total_beds !== undefined ? String(pg.pg_profile.total_beds) : '10'
  );
  const [availableBeds, setAvailableBeds] = useState<string>(
    pg?.pg_profile?.available_beds !== undefined ? String(pg.pg_profile.available_beds) : '2'
  );
  const [depositAmount, setDepositAmount] = useState<string>(
    pg?.pg_profile?.deposit_amount !== undefined ? String(pg.pg_profile.deposit_amount) : '2000'
  );
  const [noticePeriodDays, setNoticePeriodDays] = useState<string>(
    pg?.pg_profile?.notice_period_days !== undefined ? String(pg.pg_profile.notice_period_days) : '30'
  );
  const [gateClosingTime, setGateClosingTime] = useState<string>(
    pg?.pg_profile?.gate_closing_time || '10:00 PM'
  );
  const [foodIncluded, setFoodIncluded] = useState<boolean>(pg?.pg_profile?.food_included ?? false);

  // Sharing rates
  const initialRates = pg?.pg_profile?.sharing_rates || {};
  const [sharingRates, setSharingRates] = useState<{
    '1_sharing': string;
    '2_sharing': string;
    '3_sharing': string;
    '4_sharing': string;
  }>({
    '1_sharing': initialRates['1_sharing'] ? String(initialRates['1_sharing']) : '',
    '2_sharing': initialRates['2_sharing'] ? String(initialRates['2_sharing']) : '',
    '3_sharing': initialRates['3_sharing'] ? String(initialRates['3_sharing']) : '',
    '4_sharing': initialRates['4_sharing'] ? String(initialRates['4_sharing']) : '',
  });

  // Amenities
  const initialAmenities: string[] = Array.isArray(pg?.pg_profile?.amenities) && pg.pg_profile.amenities.length > 0
    ? pg.pg_profile.amenities
    : (Array.isArray(pg?.amenities) ? pg.amenities : []);
  const [amenities, setAmenities] = useState<string[]>(initialAmenities);

  // Photos
  const initialPhotos: string[] = Array.isArray(pg?.photos) && pg.photos.length > 0
    ? pg.photos
    : (pg?.image_url ? [pg.image_url] : []);
  const [photos, setPhotos] = useState<string[]>(initialPhotos);

  // Marathi translation
  const [mr, setMr] = useState({
    name: pg?.name_mr || '',
    description: '',
    address: '',
    area: '',
    sub_area: '',
  });
  const [showMr, setShowMr] = useState(Boolean(pg?.name_mr));

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Background sync latest updated_at and pg profile if editing
  useEffect(() => {
    if (!isEdit || !pg?.id) return;
    let cancelled = false;

    // Fetch shop updated_at
    supabase
      .from('shops')
      .select('updated_at, photos, description, amenities')
      .eq('id', pg.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return;
        if (data.updated_at) setBaselineUpdatedAt(data.updated_at);
        if (Array.isArray(data.photos) && data.photos.length > 0) {
          setPhotos((curr) => (curr.length <= 1 ? data.photos : curr));
        }
        if (data.description && !form.description) {
          setForm((f) => ({ ...f, description: data.description }));
        }
      });

    // Fetch PG profile
    supabase
      .from('pg_profiles')
      .select('*')
      .eq('shop_id', pg.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return;
        if (data.gender) setGender(data.gender as PGGender);
        if (data.occupancy_target) setOccupancyTarget(data.occupancy_target as any);
        if (data.total_beds !== undefined) setTotalBeds(String(data.total_beds));
        if (data.available_beds !== undefined) setAvailableBeds(String(data.available_beds));
        if (data.deposit_amount !== undefined) setDepositAmount(String(data.deposit_amount));
        if (data.notice_period_days !== undefined) setNoticePeriodDays(String(data.notice_period_days));
        if (data.gate_closing_time) setGateClosingTime(data.gate_closing_time);
        if (data.food_included !== undefined) setFoodIncluded(Boolean(data.food_included));
        if (Array.isArray(data.amenities) && data.amenities.length > 0) setAmenities(data.amenities);
        if (data.sharing_rates && typeof data.sharing_rates === 'object') {
          const rates = data.sharing_rates as any;
          setSharingRates({
            '1_sharing': rates['1_sharing'] ? String(rates['1_sharing']) : '',
            '2_sharing': rates['2_sharing'] ? String(rates['2_sharing']) : '',
            '3_sharing': rates['3_sharing'] ? String(rates['3_sharing']) : '',
            '4_sharing': rates['4_sharing'] ? String(rates['4_sharing']) : '',
          });
        }
      });

    // Fetch Marathi translation
    (async () => {
      const { data } = await (supabase as any)
        .from('shop_translations')
        .select('name, description, address, area, sub_area')
        .eq('shop_id', pg.id)
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
  }, [isEdit, pg?.id]);

  const { data: cityVillages = [] } = useQuery({
    queryKey: ['admin-pg-villages', form.city_id],
    queryFn: () => fetchVillagesForCity(form.city_id),
    enabled: !!form.city_id,
  });

  const toggleAmenity = (item: string) => {
    setAmenities((prev) =>
      prev.includes(item) ? prev.filter((a) => a !== item) : [...prev, item]
    );
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'PG / Hostel name is required';
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

    const tBeds = Number(totalBeds);
    const aBeds = Number(availableBeds);

    if (isNaN(tBeds) || tBeds < 0) {
      errs.totalBeds = 'Total beds must be a non-negative number';
    }
    if (isNaN(aBeds) || aBeds < 0) {
      errs.availableBeds = 'Available beds must be a non-negative number';
    } else if (aBeds > tBeds) {
      errs.availableBeds = 'Available beds cannot exceed total capacity';
    }

    if (depositAmount && (isNaN(Number(depositAmount)) || Number(depositAmount) < 0)) {
      errs.depositAmount = 'Deposit must be a valid amount';
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
        amenities:    amenities,
        city_id:      resolvedCityId,
        village_id:   resolvedVillageId,
        district_id:  resolvedDistrictId,
        state_id:     resolvedStateId,
      };

      let shopId = pg?.id;

      if (isEdit) {
        const baseline = baselineUpdatedAt ?? pg.updated_at;
        const result = await updateShopWithConcurrency(pg.id, baseline, shopPayload);
        if (!result.ok) {
          const r = result as Extract<typeof result, { ok: false }>;
          if (r.conflict) {
            if (r.latest?.updated_at) setBaselineUpdatedAt(r.latest.updated_at);
            toast.error(
              'This PG was updated by someone else. Click "Save PG" again to overwrite, or close to cancel.',
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

      // 1. Ensure category is linked to PG & Hostels
      const { data: pgCat } = await supabase
        .from('categories')
        .select('id')
        .ilike('name', '%pg%')
        .limit(1)
        .maybeSingle();

      if (pgCat?.id) {
        await supabase
          .from('shop_categories')
          .delete()
          .eq('shop_id', shopId);

        await supabase
          .from('shop_categories')
          .insert({ shop_id: shopId, category_id: pgCat.id });
      }

      // 2. Prepare structured sharing rates
      const parsedRates: PGSharingRates = {
        '1_sharing': sharingRates['1_sharing'] ? Number(sharingRates['1_sharing']) : null,
        '2_sharing': sharingRates['2_sharing'] ? Number(sharingRates['2_sharing']) : null,
        '3_sharing': sharingRates['3_sharing'] ? Number(sharingRates['3_sharing']) : null,
        '4_sharing': sharingRates['4_sharing'] ? Number(sharingRates['4_sharing']) : null,
      };

      // 3. Save specialized pg_profiles row
      const { error: profileError } = await savePGProfile({
        shop_id: shopId,
        gender: gender,
        occupancy_target: occupancyTarget,
        total_beds: Number(totalBeds) || 0,
        available_beds: Number(availableBeds) || 0,
        deposit_amount: Number(depositAmount) || 0,
        notice_period_days: Number(noticePeriodDays) || 30,
        gate_closing_time: gateClosingTime.trim() || null,
        food_included: foodIncluded,
        amenities: amenities,
        sharing_rates: parsedRates,
      });

      if (profileError) {
        console.error('[PGModal] Error saving PG profile:', profileError);
        toast.error('Shop details saved, but failed to save PG room details.');
      }

      // 4. Marathi translation best-effort persist
      const mrFinal: Record<string, string | null> = {
        name: mr.name.trim() || null,
        description: mr.description.trim() || null,
        address: mr.address.trim() || null,
        area: mr.area.trim() || null,
        sub_area: mr.sub_area.trim() || null,
      };

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
            // ignore
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

      toast.success(isEdit ? 'PG & Hostel updated successfully! ✓' : 'New PG & Hostel listing created! ✓');
      onSaved();
    } catch (err: any) {
      console.error('[PGModal] Save failed:', err);
      toast.error(err?.message || 'Failed to save PG listing');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0 rounded-2xl">
        <DialogHeader className="p-5 pb-3 border-b border-border sticky top-0 bg-background/95 backdrop-blur z-10">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 border border-blue-500/20">
                <BedDouble className="w-5 h-5" />
              </span>
              <span>{isEdit ? 'Edit PG & Hostel Listing' : 'Add New PG & Hostel'}</span>
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            Configure PG gender eligibility, live vacancy counter, room sharing rates, and hostel amenities.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="p-5 space-y-6">
          {/* SECTION 1: BASIC INFORMATION */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-border pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                1. Basic PG / Hostel Information
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="PG / Hostel Name (English)" required>
                <input
                  value={form.name}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, name: e.target.value }));
                    setErrors((err) => ({ ...err, name: '' }));
                  }}
                  className={cn(inputCls, errors.name && 'border-destructive')}
                  placeholder="e.g. Sai Girls Hostel & PG"
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
                  placeholder={`e.g. College Road, ${townName}`}
                  maxLength={100}
                />
                {errors.area && <p className="text-[11px] text-destructive mt-1">{errors.area}</p>}
              </Field>

              <Field label="Sub-Area / Landmark">
                <input
                  value={form.sub_area}
                  onChange={(e) => setForm((f) => ({ ...f, sub_area: e.target.value }))}
                  className={inputCls}
                  placeholder="e.g. Near Science College, Opp. Hospital"
                  maxLength={100}
                />
              </Field>
            </div>

            <Field label="Full Address">
              <input
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                className={inputCls}
                placeholder="e.g. Plot No 45, Vidyanagar, Muktainagar"
                maxLength={250}
              />
            </Field>

            <Field label="Short Description (About Hostel / PG)">
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className={cn(inputCls, 'min-h-[64px] resize-y')}
                placeholder="Safe and calm environment, 24/7 water, CCTV surveillance, near bus stop..."
                maxLength={400}
              />
            </Field>
          </div>

          {/* SECTION 2: PG PROFILE, CAPACITY & VACANCY */}
          <div className="space-y-4 rounded-xl border border-blue-500/30 bg-blue-500/5 p-4">
            <div className="flex items-center gap-2 pb-1">
              <BedDouble className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-bold uppercase tracking-wider text-blue-800 dark:text-blue-300">
                2. Eligibility, Capacity & Vacancies
              </span>
            </div>

            {/* Gender Eligibility */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-foreground">Gender Eligibility *</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'boys', label: '👦 Boys' },
                    { value: 'girls', label: '👧 Girls' },
                    { value: 'both', label: '👥 Both / Co-ed' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setGender(opt.value as PGGender)}
                      className={cn(
                        'py-2 px-2 rounded-lg text-xs font-bold border transition-all text-center',
                        gender === opt.value
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-card text-foreground border-border hover:bg-muted'
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Target Occupants */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-foreground">Ideal Occupants</label>
                <select
                  value={occupancyTarget}
                  onChange={(e) => setOccupancyTarget(e.target.value as any)}
                  className={inputCls}
                >
                  <option value="students">🎓 Students Only</option>
                  <option value="professionals">💼 Working Professionals</option>
                  <option value="any">🌟 Anyone (Students or Working)</option>
                </select>
              </div>
            </div>

            {/* Bed Capacity & Live Vacancies */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Total Bed Capacity" required>
                <input
                  type="number"
                  min="1"
                  value={totalBeds}
                  onChange={(e) => {
                    setTotalBeds(e.target.value);
                    setErrors((err) => ({ ...err, totalBeds: '', availableBeds: '' }));
                  }}
                  className={cn(inputCls, errors.totalBeds && 'border-destructive')}
                  placeholder="e.g. 20"
                />
                {errors.totalBeds && <p className="text-[11px] text-destructive mt-1">{errors.totalBeds}</p>}
              </Field>

              <Field label="Live Available Beds (Vacancies)" required>
                <input
                  type="number"
                  min="0"
                  value={availableBeds}
                  onChange={(e) => {
                    setAvailableBeds(e.target.value);
                    setErrors((err) => ({ ...err, availableBeds: '' }));
                  }}
                  className={cn(inputCls, errors.availableBeds && 'border-destructive')}
                  placeholder="e.g. 3"
                />
                {errors.availableBeds && <p className="text-[11px] text-destructive mt-1">{errors.availableBeds}</p>}
              </Field>
            </div>

            {/* Deposit, Notice Period & Gate Timing */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Security Deposit (₹)">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">₹</span>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    className={cn(inputCls, 'pl-7')}
                    placeholder="e.g. 2000"
                  />
                </div>
              </Field>

              <Field label="Notice Period (Days)">
                <input
                  type="number"
                  min="0"
                  value={noticePeriodDays}
                  onChange={(e) => setNoticePeriodDays(e.target.value)}
                  className={inputCls}
                  placeholder="e.g. 30"
                />
              </Field>

              <Field label="Night Gate Timing">
                <input
                  value={gateClosingTime}
                  onChange={(e) => setGateClosingTime(e.target.value)}
                  className={inputCls}
                  placeholder="e.g. 10:00 PM"
                />
              </Field>
            </div>

            {/* Food Included switch */}
            <label className="flex items-center gap-2.5 p-2.5 rounded-lg border border-border bg-card cursor-pointer hover:bg-muted/30">
              <input
                type="checkbox"
                checked={foodIncluded}
                onChange={(e) => setFoodIncluded(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
              />
              <div className="text-xs">
                <span className="font-bold text-foreground">🍲 Food / Meals Included in Rent</span>
                <p className="text-[11px] text-muted-foreground">Rent covers daily breakfast, lunch, or dinner</p>
              </div>
            </label>

            {/* SHARING RATES */}
            <div className="space-y-2 pt-2 border-t border-border">
              <label className="block text-xs font-semibold text-foreground">
                Room Sharing Rates (₹ / month per person)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <span className="text-[11px] text-muted-foreground block mb-1">Single Room</span>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-muted-foreground">₹</span>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={sharingRates['1_sharing']}
                      onChange={(e) => setSharingRates((r) => ({ ...r, '1_sharing': e.target.value }))}
                      className={cn(inputCls, 'pl-6 text-xs')}
                      placeholder="e.g. 4500"
                    />
                  </div>
                </div>

                <div>
                  <span className="text-[11px] text-muted-foreground block mb-1">2-Sharing</span>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-muted-foreground">₹</span>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={sharingRates['2_sharing']}
                      onChange={(e) => setSharingRates((r) => ({ ...r, '2_sharing': e.target.value }))}
                      className={cn(inputCls, 'pl-6 text-xs')}
                      placeholder="e.g. 2800"
                    />
                  </div>
                </div>

                <div>
                  <span className="text-[11px] text-muted-foreground block mb-1">3-Sharing</span>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-muted-foreground">₹</span>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={sharingRates['3_sharing']}
                      onChange={(e) => setSharingRates((r) => ({ ...r, '3_sharing': e.target.value }))}
                      className={cn(inputCls, 'pl-6 text-xs')}
                      placeholder="e.g. 2200"
                    />
                  </div>
                </div>

                <div>
                  <span className="text-[11px] text-muted-foreground block mb-1">4+ Sharing</span>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-muted-foreground">₹</span>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={sharingRates['4_sharing']}
                      onChange={(e) => setSharingRates((r) => ({ ...r, '4_sharing': e.target.value }))}
                      className={cn(inputCls, 'pl-6 text-xs')}
                      placeholder="e.g. 1800"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* PG Amenities Pills */}
            <div className="space-y-1.5 pt-2">
              <label className="block text-xs font-semibold text-foreground">Hostel Facilities & Amenities</label>
              <div className="flex flex-wrap gap-1.5">
                {PG_AMENITY_OPTIONS.map((item) => {
                  const active = amenities.includes(item);
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => toggleAmenity(item)}
                      className={cn(
                        'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                        active
                          ? 'bg-blue-600 text-white border-blue-600'
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
                3. Room & Building Photos (Up to 5 images)
              </span>
            </div>

            <MultiImageCropPicker
              photos={photos}
              onChange={setPhotos}
              maxPhotos={5}
              label="Room, Beds & Washroom Photos"
              onUploadFile={async (blob) => {
                setUploading(true);
                try {
                  const result = await uploadShopImage(blob, form.name || 'pg', { prefix: 'pg' });
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
              <p className="text-xs text-blue-600 flex items-center gap-1">
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
                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-muted-foreground">
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
                  label="Hostel Name (मराठी)"
                  value={mr.name}
                  onChange={(v) => setMr((m) => ({ ...m, name: v }))}
                  placeholder="उदा. साई गर्ल्स हॉस्टेल"
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <MarathiMirrorField
                    label="Area (परिसर)"
                    value={mr.area}
                    onChange={(v) => setMr((m) => ({ ...m, area: v }))}
                    placeholder="उदा. कॉलेज रोड"
                  />
                  <MarathiMirrorField
                    label="Sub-Area (खूण)"
                    value={mr.sub_area}
                    onChange={(v) => setMr((m) => ({ ...m, sub_area: v }))}
                    placeholder="उदा. सायन्स कॉलेजजवळ"
                  />
                </div>
              </div>
            )}
          </div>

          {/* SECTION 5: STATUS & VERIFICATION */}
          <div className="flex items-center justify-between gap-4 p-3 bg-muted/30 rounded-xl border border-border">
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

          <DialogFooter className="sticky bottom-0 bg-background/95 backdrop-blur p-4 border-t border-border -mx-5 -mb-5 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 rounded-xl text-xs font-semibold border border-border bg-card hover:bg-muted text-foreground transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || uploading}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-sm active:scale-95 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" /> Save PG & Hostel
                </>
              )}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
