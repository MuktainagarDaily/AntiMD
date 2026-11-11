import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  UtensilsCrossed,
  Save,
  Loader2,
  Clock,
  Phone,
  MessageCircle,
  MapPin,
  Sparkles,
  Check,
  CheckCircle2,
  ShieldCheck,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';
import { updateShopWithConcurrency } from '@/lib/shopConcurrency';
import { saveMessProfile } from '@/lib/living/livingService';
import type { MessType, MessProfile } from '@/lib/living/livingTypes';
import { MultiImageCropPicker } from '@/components/shared/MultiImageCropPicker';
import { uploadShopImage } from '@/lib/storageNaming';
import { isValidIndianPhone, cn } from '@/lib/utils';
import { useT } from '@/i18n';

interface MessProfileManagerProps {
  shop: any;
  onSaved?: () => void;
}

const COMMON_AMENITIES = [
  'शुद्ध शाकाहारी',
  'अनलिमिटेड थाळी',
  'डबा / टिफिन सुविधा',
  'RO पिण्याचे पाणी',
  'मासिक पास उपलब्ध',
  'रविवार स्पेशल मेजवानी',
  'Google Pay / PhonePe',
  'स्वच्छ व हवेशीर डायनिंग',
  'जैन जेवण उपलब्ध',
];

export function MessProfileManager({ shop, onSaved }: MessProfileManagerProps) {
  const { locale } = useT();
  const qc = useQueryClient();

  // Fetch or extract mess profile
  const { data: remoteProfile, isLoading: profileLoading } = useQuery<MessProfile | null>({
    queryKey: ['mess-profile', shop.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mess_profiles')
        .select('*')
        .eq('shop_id', shop.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.warn('Error fetching mess profile:', error);
      }
      return (data as MessProfile) || null;
    },
  });

  // Basic shop fields
  const [name, setName] = useState(shop.name || '');
  const [nameMr, setNameMr] = useState(shop.name_mr || '');
  const [phone, setPhone] = useState(shop.phone || '');
  const [whatsapp, setWhatsapp] = useState(shop.whatsapp || '');
  const [area, setArea] = useState(shop.area || '');
  const [address, setAddress] = useState(shop.address || '');
  const [description, setDescription] = useState(shop.description || '');

  // Fetch Marathi translation for this shop
  useEffect(() => {
    let active = true;
    (supabase as any)
      .from('shop_translations')
      .select('name')
      .eq('shop_id', shop.id)
      .eq('locale', 'mr')
      .maybeSingle()
      .then(({ data }: any) => {
        if (active && data?.name) {
          setNameMr(data.name);
        }
      });
    return () => {
      active = false;
    };
  }, [shop.id]);

  // Specialized mess fields
  const [messType, setMessType] = useState<MessType>('pure_veg');
  const [monthlyRate, setMonthlyRate] = useState<string>('');
  const [singleThaliRate, setSingleThaliRate] = useState<string>('');
  const [tiffinDelivery, setTiffinDelivery] = useState<boolean>(false);
  const [sundayFeast, setSundayFeast] = useState<boolean>(false);
  const [lunchTiming, setLunchTiming] = useState<string>('11:30 AM - 02:30 PM');
  const [dinnerTiming, setDinnerTiming] = useState<string>('07:30 PM - 10:30 PM');

  // Amenities
  const [amenities, setAmenities] = useState<string[]>(
    Array.isArray(shop.amenities) ? shop.amenities : []
  );

  // Photos
  const [photos, setPhotos] = useState<string[]>(
    Array.isArray(shop.photos) && shop.photos.length > 0
      ? shop.photos
      : shop.image_url
      ? [shop.image_url]
      : []
  );

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Sync profile data when loaded
  useEffect(() => {
    const profile = remoteProfile || shop.mess_profile || shop.mess_profiles?.[0];
    if (profile) {
      if (profile.mess_type) setMessType(profile.mess_type as MessType);
      if (profile.monthly_rate != null) setMonthlyRate(String(profile.monthly_rate));
      if (profile.single_thali_rate != null) setSingleThaliRate(String(profile.single_thali_rate));
      if (profile.tiffin_delivery != null) setTiffinDelivery(Boolean(profile.tiffin_delivery));
      if (profile.sunday_feast != null) setSundayFeast(Boolean(profile.sunday_feast));
      if (profile.lunch_timing) setLunchTiming(profile.lunch_timing);
      if (profile.dinner_timing) setDinnerTiming(profile.dinner_timing);
    }
  }, [remoteProfile, shop]);

  const toggleAmenity = (item: string) => {
    setAmenities((prev) =>
      prev.includes(item) ? prev.filter((a) => a !== item) : [...prev, item]
    );
  };

  const handleUploadPhoto = async (blob: Blob): Promise<string> => {
    setUploading(true);
    try {
      const { publicUrl } = await uploadShopImage(blob, name.trim() || 'mess');
      return publicUrl;
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error(locale === 'mr' ? 'कृपया मेसचे नाव टाका' : 'Please enter mess name');
      return;
    }
    if (phone.trim() && !isValidIndianPhone(phone)) {
      toast.error(locale === 'mr' ? 'कृपया योग्य १० अंकी फोन नंबर टाका' : 'Invalid phone number');
      return;
    }
    if (whatsapp.trim() && !isValidIndianPhone(whatsapp)) {
      toast.error(locale === 'mr' ? 'कृपया योग्य व्हॉट्सॲप नंबर टाका' : 'Invalid WhatsApp number');
      return;
    }

    try {
      setSaving(true);

      // 1. Update basic shop table with concurrency control
      const shopPatch: any = {
        name: name.trim(),
        phone: phone.trim() || null,
        whatsapp: whatsapp.trim() || null,
        area: area.trim() || null,
        address: address.trim() || null,
        description: description.trim() || null,
        amenities: amenities,
        photos: photos.filter(Boolean),
        image_url: photos[0] || null,
      };

      const result = await updateShopWithConcurrency(shop.id, shop.updated_at, shopPatch);
      if (result.ok === false) {
        const errMsg = 'error' in result ? result.error : 'Conflict detected — please reload and try again';
        throw new Error(errMsg || 'Failed to update shop details');
      }

      // 1b. Save Marathi translation to shop_translations
      if (nameMr.trim()) {
        await (supabase as any)
          .from('shop_translations')
          .upsert(
            {
              shop_id: shop.id,
              locale: 'mr',
              name: nameMr.trim(),
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'shop_id,locale' }
          );
      }

      // 2. Update mess_profiles table
      const parsedMonthly = monthlyRate ? parseInt(monthlyRate, 10) : null;
      const parsedThali = singleThaliRate ? parseInt(singleThaliRate, 10) : null;

      const { error: profileError } = await saveMessProfile({
        shop_id: shop.id,
        mess_type: messType,
        monthly_rate: isNaN(parsedMonthly as number) ? null : parsedMonthly,
        single_thali_rate: isNaN(parsedThali as number) ? null : parsedThali,
        tiffin_delivery: tiffinDelivery,
        sunday_feast: sundayFeast,
        lunch_timing: lunchTiming.trim() || null,
        dinner_timing: dinnerTiming.trim() || null,
      });

      if (profileError) throw profileError;

      toast.success(
        locale === 'mr'
          ? 'मेस प्रोफाईल व दर यशस्वीरित्या सेव्ह झाले! ✓'
          : 'Mess Profile & Rates saved successfully! ✓'
      );

      qc.invalidateQueries({ queryKey: ['my-shops'] });
      qc.invalidateQueries({ queryKey: ['translations'] });
      qc.invalidateQueries({ queryKey: ['mess-profile', shop.id] });
      qc.invalidateQueries({ queryKey: ['living-messes'] });
      if (onSaved) onSaved();
    } catch (err: any) {
      console.error('[MessProfileManager] Error saving:', err);
      toast.error(err?.message || 'Failed to save mess profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* ── 1. Dietary Type (आहार प्रकार) ── */}
      <div className="bg-card rounded-2xl border border-border p-4 sm:p-5 shadow-xs space-y-3">
        <label className="text-xs font-bold text-foreground flex flex-wrap items-center justify-between gap-1">
          <span>🥦 {locale === 'mr' ? 'मेसचा प्रकार निवडा (Dietary Category)' : 'Dietary Category'}</span>
          <span className="text-[10px] text-muted-foreground">१ पर्याय निवडा</span>
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {/* Pure Veg */}
          <button
            type="button"
            onClick={() => setMessType('pure_veg')}
            className={cn(
              'p-3.5 rounded-xl border-2 text-left flex items-start gap-3 transition-all',
              messType === 'pure_veg'
                ? 'bg-emerald-500/10 border-emerald-500 shadow-xs'
                : 'bg-background border-border/70 hover:border-emerald-500/50'
            )}
          >
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-600 flex items-center justify-center shrink-0 text-base font-bold">
              🥦
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-foreground">
                {locale === 'mr' ? 'शुद्ध शाकाहारी' : 'Pure Veg'}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {locale === 'mr' ? 'केवळ शाकाहारी भोजन' : '100% vegetarian meals'}
              </p>
            </div>
          </button>

          {/* Veg & Non-Veg */}
          <button
            type="button"
            onClick={() => setMessType('veg_nonveg')}
            className={cn(
              'p-3.5 rounded-xl border-2 text-left flex items-start gap-3 transition-all',
              messType === 'veg_nonveg'
                ? 'bg-amber-500/10 border-amber-500 shadow-xs'
                : 'bg-background border-border/70 hover:border-amber-500/50'
            )}
          >
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-600 flex items-center justify-center shrink-0 text-base font-bold">
              🍗
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-foreground">
                {locale === 'mr' ? 'व्हेज व नॉन-व्हेज' : 'Veg & Non-Veg'}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {locale === 'mr' ? 'दोन्ही पर्याय उपलब्ध' : 'Both veg & non-veg served'}
              </p>
            </div>
          </button>

          {/* Jain Available */}
          <button
            type="button"
            onClick={() => setMessType('jain_available')}
            className={cn(
              'p-3.5 rounded-xl border-2 text-left flex items-start gap-3 transition-all',
              messType === 'jain_available'
                ? 'bg-teal-500/10 border-teal-500 shadow-xs'
                : 'bg-background border-border/70 hover:border-teal-500/50'
            )}
          >
            <div className="w-8 h-8 rounded-lg bg-teal-500/15 text-teal-600 flex items-center justify-center shrink-0 text-base font-bold">
              🥬
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-foreground">
                {locale === 'mr' ? 'जैन जेवण उपलब्ध' : 'Jain Food Available'}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {locale === 'mr' ? 'कंदमुळांशिवाय सात्विक' : 'Special satvik & Jain meals'}
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* ── 2. Rates & Pricing (दर व मासिक फी) ── */}
      <div className="bg-card rounded-2xl border border-border p-4 sm:p-5 shadow-xs space-y-3">
        <label className="text-xs font-bold text-foreground">
          💰 {locale === 'mr' ? 'थाळी व मासिक दर (Pricing)' : 'Standard Rates & Monthly Pass'}
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
              {locale === 'mr' ? 'एक वेळ थाळी दर (Single Thali Rate)' : 'Single Thali Rate (₹)'}
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">₹</span>
              <input
                type="number"
                min="0"
                value={singleThaliRate}
                onChange={(e) => setSingleThaliRate(e.target.value)}
                placeholder="उदा. 70"
                className="w-full pl-7 pr-3 py-2.5 text-xs sm:text-sm rounded-xl border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-semibold"
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              {locale === 'mr' ? 'विद्यार्थी किंवा पाहुण्यांसाठी एका वेळेचा दर' : 'Price per meal for walk-in customers'}
            </p>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
              {locale === 'mr' ? 'मासिक मेस फी (Monthly Pass Rate)' : 'Monthly Pass Rate (₹)'}
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">₹</span>
              <input
                type="number"
                min="0"
                value={monthlyRate}
                onChange={(e) => setMonthlyRate(e.target.value)}
                placeholder="उदा. 2400"
                className="w-full pl-7 pr-3 py-2.5 text-xs sm:text-sm rounded-xl border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-semibold"
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              {locale === 'mr' ? 'महिनाभराच्या २ वेळेच्या जेवणाची एकूण फी' : 'Full month 2-meal pass rate'}
            </p>
          </div>
        </div>
      </div>

      {/* ── 3. Special Facilities (विशेष सुविधा व टिफिन) ── */}
      <div className="bg-card rounded-2xl border border-border p-4 sm:p-5 shadow-xs space-y-3">
        <label className="text-xs font-bold text-foreground">
          ✨ {locale === 'mr' ? 'महत्त्वाच्या सुविधा (Key Facilities)' : 'Key Facilities & Delivery'}
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Tiffin Delivery Toggle */}
          <div
            onClick={() => setTiffinDelivery((prev) => !prev)}
            className={cn(
              'p-3.5 rounded-xl border cursor-pointer flex items-center justify-between transition-all select-none',
              tiffinDelivery
                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-800 dark:text-emerald-300'
                : 'bg-background border-border text-foreground hover:bg-muted/30'
            )}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-xl">🛵</span>
              <div>
                <p className="text-xs font-bold leading-tight">
                  {locale === 'mr' ? 'घरपोच डबा / टिफिन सुविधा' : 'Tiffin / Dabba Delivery'}
                </p>
                <p className="text-[10px] opacity-75 mt-0.5">
                  {locale === 'mr' ? 'रूम किंवा ऑफिसवर डबा पाठवता का?' : 'Deliver tiffin to rooms / offices'}
                </p>
              </div>
            </div>
            <span
              className={cn(
                'w-5 h-5 rounded-md flex items-center justify-center border text-xs font-bold shrink-0',
                tiffinDelivery
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-muted border-border text-transparent'
              )}
            >
              ✓
            </span>
          </div>

          {/* Sunday Feast Toggle */}
          <div
            onClick={() => setSundayFeast((prev) => !prev)}
            className={cn(
              'p-3.5 rounded-xl border cursor-pointer flex items-center justify-between transition-all select-none',
              sundayFeast
                ? 'bg-amber-500/10 border-amber-500/40 text-amber-800 dark:text-amber-300'
                : 'bg-background border-border text-foreground hover:bg-muted/30'
            )}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-xl">🎉</span>
              <div>
                <p className="text-xs font-bold leading-tight">
                  {locale === 'mr' ? 'रविवार स्पेशल मेजवानी' : 'Sunday Special Feast'}
                </p>
                <p className="text-[10px] opacity-75 mt-0.5">
                  {locale === 'mr' ? 'रविवारी गोड किंवा खास मेनू असतो का?' : 'Special Sunday lunch menu'}
                </p>
              </div>
            </div>
            <span
              className={cn(
                'w-5 h-5 rounded-md flex items-center justify-center border text-xs font-bold shrink-0',
                sundayFeast
                  ? 'bg-amber-600 text-white border-amber-600'
                  : 'bg-muted border-border text-transparent'
              )}
            >
              ✓
            </span>
          </div>
        </div>

        {/* Amenity Chips */}
        <div className="pt-2">
          <p className="text-[11px] font-semibold text-muted-foreground mb-2">
            {locale === 'mr' ? 'अधिक सुविधा निवडा (ग्राहकांना दाखवण्यासाठी):' : 'Select Amenities to highlight:'}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {COMMON_AMENITIES.map((am) => {
              const active = amenities.includes(am);
              return (
                <button
                  key={am}
                  type="button"
                  onClick={() => toggleAmenity(am)}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-xs font-medium border transition-all',
                    active
                      ? 'bg-primary text-primary-foreground border-primary shadow-2xs'
                      : 'bg-background text-muted-foreground border-border hover:border-foreground/40'
                  )}
                >
                  {active ? '✓ ' : '+ '}
                  {am}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── 4. Timings (जेवणाची वेळ) ── */}
      <div className="bg-card rounded-2xl border border-border p-4 sm:p-5 shadow-xs space-y-3">
        <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
          <Clock className="w-4 h-4 text-primary" />
          <span>{locale === 'mr' ? 'मेसच्या वेळा (Timings)' : 'Meal Timings'}</span>
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Lunch Timing */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-semibold text-muted-foreground">
              🍲 {locale === 'mr' ? 'दुपारची वेळ (Lunch Timing)' : 'Lunch Timing'}
            </label>
            <input
              type="text"
              value={lunchTiming}
              onChange={(e) => setLunchTiming(e.target.value)}
              placeholder="उदा. 11:30 AM - 02:30 PM"
              className="w-full px-3 py-2 text-xs rounded-xl border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-medium"
            />
            <div className="flex flex-wrap gap-1 pt-0.5">
              {['11:30 AM - 02:30 PM', '12:00 PM - 03:00 PM'].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setLunchTiming(p)}
                  className="text-[10px] px-2 py-0.5 rounded-md bg-muted text-muted-foreground hover:text-foreground border border-border"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Dinner Timing */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-semibold text-muted-foreground">
              🌙 {locale === 'mr' ? 'रात्रीची वेळ (Dinner Timing)' : 'Dinner Timing'}
            </label>
            <input
              type="text"
              value={dinnerTiming}
              onChange={(e) => setDinnerTiming(e.target.value)}
              placeholder="उदा. 07:30 PM - 10:30 PM"
              className="w-full px-3 py-2 text-xs rounded-xl border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-medium"
            />
            <div className="flex flex-wrap gap-1 pt-0.5">
              {['07:30 PM - 10:30 PM', '08:00 PM - 11:00 PM'].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setDinnerTiming(p)}
                  className="text-[10px] px-2 py-0.5 rounded-md bg-muted text-muted-foreground hover:text-foreground border border-border"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── 5. Basic Details & Contact (नाव, पत्ता, संपर्क) ── */}
      <div className="bg-card rounded-2xl border border-border p-4 sm:p-5 shadow-xs space-y-3">
        <label className="text-xs font-bold text-foreground">
          📍 {locale === 'mr' ? 'मेसचे नाव, संपर्क व पत्ता' : 'Mess Name, Contact & Location'}
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
              {locale === 'mr' ? 'मेसचे नाव (इंग्रजी किंवा मराठी)' : 'Mess Name'} *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="उदा. श्री स्वामी समर्थ भोजनालय"
              className="w-full px-3 py-2 text-xs rounded-xl border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-medium"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
              {locale === 'mr' ? 'नाव मराठीत (Name in Marathi)' : 'Name in Marathi (Optional)'}
            </label>
            <input
              type="text"
              value={nameMr}
              onChange={(e) => setNameMr(e.target.value)}
              placeholder="उदा. श्री स्वामी समर्थ भोजनालय"
              className="w-full px-3 py-2 text-xs rounded-xl border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-medium"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
              📞 {locale === 'mr' ? 'मोबाईल नंबर (कॉलसाठी)' : 'Phone Number'}
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="उदा. 9876543210"
              className="w-full px-3 py-2 text-xs rounded-xl border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-medium"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
              💬 {locale === 'mr' ? 'व्हॉट्सॲप नंबर (WhatsApp)' : 'WhatsApp Number'}
            </label>
            <input
              type="tel"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="उदा. 9876543210"
              className="w-full px-3 py-2 text-xs rounded-xl border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-medium"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
              {locale === 'mr' ? 'परिसर / लँडमार्क (Area)' : 'Area / Landmark'}
            </label>
            <input
              type="text"
              value={area}
              onChange={(e) => setArea(e.target.value)}
              placeholder="उदा. कॉलेज रोड, बस स्टँडजवळ"
              className="w-full px-3 py-2 text-xs rounded-xl border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-medium"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
              {locale === 'mr' ? 'संपूर्ण पत्ता (Full Address)' : 'Full Address'}
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="उदा. प्लॉट नं. १२, गणेश कॉलनी, मुक्ताईनगर"
              className="w-full px-3 py-2 text-xs rounded-xl border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-medium"
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
            {locale === 'mr' ? 'मेसबद्दल माहिती / वर्णन (Description)' : 'About Mess / Tagline'}
          </label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={
              locale === 'mr'
                ? 'उदा. घरगुती चव, स्वच्छ वातावरण, विद्यार्थ्यांसाठी खास सवलत उपलब्ध.'
                : 'e.g. Homely taste, clean atmosphere, special student monthly concession.'
            }
            className="w-full px-3 py-2 text-xs rounded-xl border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-medium resize-none"
          />
        </div>
      </div>

      {/* ── 6. Photos (मेसचे फोटो) ── */}
      <div className="bg-card rounded-2xl border border-border p-4 sm:p-5 shadow-xs space-y-3">
        <label className="text-xs font-bold text-foreground flex flex-wrap items-center justify-between gap-1">
          <span>📸 {locale === 'mr' ? 'मेसचे फोटो (जास्तीत जास्त ५ फोटो)' : 'Mess Photos (Max 5)'}</span>
          <span className="text-[10px] text-muted-foreground">डायनिंग हॉल, स्वयंपाकघर, थाळी</span>
        </label>

        <MultiImageCropPicker
          photos={photos}
          onChange={setPhotos}
          maxPhotos={5}
          onUploadFile={handleUploadPhoto}
          uploading={uploading}
        />
      </div>

      {/* ── 7. Save CTA Button ── */}
      <div className="pt-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || uploading}
          className="w-full py-3 px-4 rounded-xl text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{locale === 'mr' ? 'माहिती जतन करत आहे...' : 'Saving Changes...'}</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>{locale === 'mr' ? 'मेस प्रोफाईल व दर जतन करा' : 'Save Mess Profile & Rates'}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
