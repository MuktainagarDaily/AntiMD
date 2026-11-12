import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X, Loader2, CheckCircle2, Store, MapPin, Navigation, Send, FlaskConical,
  ShieldCheck, LogIn, ArrowLeft, ArrowRight, Sparkles, Pencil, Phone,
  Clock, Image as ImageIcon, Tag, Check, RotateCcw, UtensilsCrossed,
  BedDouble, GraduationCap, Users, BookOpen, Flame, Droplets, Building2, Bookmark,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { formatTime, normalizePhone } from '@/lib/shopUtils';
import { compressImage } from '@/lib/imageUtils';
import { TimePickerField } from '@/components/shared/TimePickerField';
import { MultiImageCropPicker } from '@/components/shared/MultiImageCropPicker';
import { AmenitiesPicker } from '@/components/shared/AmenitiesPicker';
import { LocationMapPicker, MUKTAINAGAR_CENTER, clearGeocodeCacheNear, type Coords } from '@/components/shared/LocationMapPicker';
import { MarathiMirrorField } from '@/components/shared/MarathiMirrorField';
import { TranslateAllButton } from '@/components/shared/TranslateAllButton';
import { DEV_AUTOFILL, getEntityAutofillSample } from '@/lib/devHelpers';
import { uploadShopImage } from '@/lib/storageNaming';
import { isValidIndianPhone, isSafeHttpUrl, inputCls } from '@/lib/utils';
import { normalizeWhatsApp } from '@/components/admin/adminHelpers';
import {
  SCHOOL_TYPE_OPTIONS,
  SCHOOL_MEDIUM_OPTIONS,
  ADMISSION_STATUS_OPTIONS,
  MANAGEMENT_TYPE_OPTIONS,
  COMMON_BOARDS,
  SCHOOL_TYPE_CONFIG,
  ADMISSION_STATUS_CONFIG,
  MANAGEMENT_TYPE_CONFIG,
  type SchoolType,
  type SchoolMedium,
  type AdmissionStatus,
  type ManagementType,
} from '@/lib/schools/schoolHelpers';
import { useCity } from '@/hooks/useCity';
import { useT } from '@/i18n';
import { z } from 'zod';
import { checkCooldown } from '@/lib/rateLimit';
import { cn } from '@/lib/utils';

export type RequestEntityType = 'shop' | 'mess' | 'pg' | 'school';

/* ── Zod schema (single source of truth for runtime + client validation) ── */
const optTrim = (max: number) =>
  z.string().trim().max(max).optional().or(z.literal('')).transform((v) => (v ? v.trim() : ''));
const phoneSchema = z
  .string()
  .trim()
  .refine((v) => isValidIndianPhone(v), { message: 'Enter a valid 10-digit Indian mobile number (e.g. 9876543210)' });
const optPhoneSchema = z
  .string()
  .trim()
  .optional()
  .or(z.literal(''))
  .refine((v) => !v || isValidIndianPhone(v), { message: 'Enter a valid 10-digit Indian mobile number' });
const latLngSchema = z
  .string()
  .optional()
  .or(z.literal(''))
  .refine((v) => !v || !Number.isNaN(parseFloat(v)), { message: 'Invalid coordinate' });

export const requestListingSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(120, 'Max 120 characters'),
    phone: phoneSchema,
    whatsapp: optPhoneSchema,
    address: z.string().trim().min(1, 'Address is required').max(250, 'Max 250 characters'),
    area: z.string().trim().min(1, 'Area / Locality is required').max(100, 'Max 100 characters'),
    sub_area: optTrim(100),
    description: optTrim(500),
    keywords: optTrim(200),
    category_text: optTrim(80),
    opening_time: z.string().regex(/^(\d{2}:\d{2})?$/, 'Invalid time').optional().or(z.literal('')),
    closing_time: z.string().regex(/^(\d{2}:\d{2})?$/, 'Invalid time').optional().or(z.literal('')),
    submitter_name: optTrim(80),
    latitude: latLngSchema,
    longitude: latLngSchema,
    truthConfirmed: z.literal(true, { error: 'Please confirm the information is accurate' }),
  })
  .superRefine((data, ctx) => {
    if (data.opening_time && data.closing_time) {
      const [oh, om] = data.opening_time.split(':').map(Number);
      const [ch, cm] = data.closing_time.split(':').map(Number);
      if (oh * 60 + om === ch * 60 + cm) {
        ctx.addIssue({ code: 'custom', path: ['closing_time'], message: 'Closing time must differ from opening time' });
      }
    }
    if ((data.latitude && !data.longitude) || (!data.latitude && data.longitude)) {
      ctx.addIssue({ code: 'custom', path: ['latitude'], message: 'Both latitude and longitude are required' });
    }
    if (data.latitude && data.longitude) {
      const lat = parseFloat(data.latitude); const lng = parseFloat(data.longitude);
      if (lat < -90 || lat > 90) ctx.addIssue({ code: 'custom', path: ['latitude'], message: 'Latitude out of range' });
      if (lng < -180 || lng > 180) ctx.addIssue({ code: 'custom', path: ['longitude'], message: 'Longitude out of range' });
    }
  });

function normalizeArea(s: string): string {
  return s.trim().replace(/(^|[\s,])([a-z])/g, (_, sep, c) => sep + c.toUpperCase());
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-foreground mb-1.5">{label}</label>
      {children}
    </div>
  );
}

/* ── component ─────────────────────────────────────────────────── */
interface Props {
  onClose: () => void;
  initialEntityType?: RequestEntityType;
}

export function RequestListingModal({ onClose, initialEntityType }: Props) {
  const { user } = useAuth();
  const { t, locale } = useT();
  const { currentCity, currentVillage, townName } = useCity();
  const navigate = useNavigate();
  const DRAFT_KEY = `mn-entity-request-draft-v3-${currentCity.slug}`;
  const TOTAL_STEPS = 5;

  const [step, setStep] = useState(1);
  const [entityType, setEntityType] = useState<RequestEntityType>(initialEntityType ?? 'shop');

  useEffect(() => {
    if (initialEntityType) {
      setEntityType(initialEntityType);
    }
  }, [initialEntityType]);
  const [draftStatus, setDraftStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [resumePrompt, setResumePrompt] = useState(false);

  // Common listing fields
  const [form, setForm] = useState({
    name: '',
    phone: '',
    whatsapp: '',
    address: '',
    area: '',
    sub_area: '',
    description: '',
    keywords: '',
    category_text: '',
    opening_time: '',
    closing_time: '',
    submitter_name: '',
    latitude: '',
    longitude: '',
  });

  // Photos (up to 5, Slot 1 = Cover)
  const [photos, setPhotos] = useState<string[]>([]);
  const [amenities, setAmenities] = useState<string[]>([]);

  // Specialized Mess Meta
  const [messType, setMessType] = useState<'pure_veg' | 'veg_nonveg' | 'jain_available'>('pure_veg');
  const [monthlyRate, setMonthlyRate] = useState('');
  const [singleThaliRate, setSingleThaliRate] = useState('');
  const [tiffinDelivery, setTiffinDelivery] = useState(true);
  const [sundayFeast, setSundayFeast] = useState(true);
  const [lunchTiming, setLunchTiming] = useState('11:30 AM - 02:30 PM');
  const [dinnerTiming, setDinnerTiming] = useState('07:30 PM - 10:30 PM');

  // Specialized PG Meta
  const [pgGender, setPgGender] = useState<'boys' | 'girls' | 'both'>('boys');
  const [occupancyTarget, setOccupancyTarget] = useState<'students' | 'professionals' | 'any'>('students');
  const [totalBeds, setTotalBeds] = useState('');
  const [availableBeds, setAvailableBeds] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [gateClosingTime, setGateClosingTime] = useState('10:00 PM');
  const [foodIncluded, setFoodIncluded] = useState(false);
  const [rateSingle, setRateSingle] = useState('');
  const [rateDouble, setRateDouble] = useState('');
  const [rateTriple, setRateTriple] = useState('');

  // Specialized School Meta
  const [schoolType, setSchoolType] = useState<SchoolType>('secondary');
  const [schoolMedium, setSchoolMedium] = useState<SchoolMedium>('marathi');
  const [schoolBoard, setSchoolBoard] = useState('State Board (SSC/HSC)');
  const [schoolManagement, setSchoolManagement] = useState<ManagementType | ''>('');
  const [schoolAdmissionStatus, setSchoolAdmissionStatus] = useState<AdmissionStatus>('open');
  const [schoolStreams, setSchoolStreams] = useState('');
  const [schoolEmail, setSchoolEmail] = useState('');
  const [schoolWebsite, setSchoolWebsite] = useState('');
  const [schoolIsOwner, setSchoolIsOwner] = useState(false);

  // Marathi mirror values
  const [mr, setMr] = useState({
    name: '', area: '', sub_area: '', address: '', description: '', keywords: '',
  });
  const [showMr, setShowMr] = useState(false);

  // Embedded map center
  const mapInitialCenter: Coords = {
    lat: currentCity.latitude || MUKTAINAGAR_CENTER.lat,
    lng: currentCity.longitude || MUKTAINAGAR_CENTER.lng,
  };

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [truthConfirmed, setTruthConfirmed] = useState(false);
  const [done, setDone] = useState(false);
  const [locating, setLocating] = useState(false);
  const [gpsMessage, setGpsMessage] = useState<string>('');
  const [geocoding, setGeocoding] = useState(false);

  /* ── Draft persistence ─────────────────────────────────────── */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      const hasContent = draft && (
        (draft.form && Object.values(draft.form).some((v) => typeof v === 'string' && v.trim())) ||
        (Array.isArray(draft.amenities) && draft.amenities.length > 0) ||
        (Array.isArray(draft.photos) && draft.photos.length > 0)
      );
      const draftMatchesContext = !initialEntityType || !draft?.entityType || draft.entityType === initialEntityType;
      if (hasContent && draftMatchesContext) {
        setResumePrompt(true);
        setDraftStatus('saved');
      }
    } catch { /* ignore */ }
  }, [DRAFT_KEY, initialEntityType]);

  const restoreDraft = () => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) { setResumePrompt(false); return; }
      const draft = JSON.parse(raw);
      if (draft.entityType) setEntityType(draft.entityType);
      if (draft.form) setForm((f) => ({ ...f, ...draft.form }));
      if (Array.isArray(draft.amenities)) setAmenities(draft.amenities);
      if (Array.isArray(draft.photos)) setPhotos(draft.photos);
      if (draft.mr) setMr((m) => ({ ...m, ...draft.mr }));
      if (draft.messMeta) {
        if (draft.messMeta.messType) setMessType(draft.messMeta.messType);
        if (draft.messMeta.monthlyRate) setMonthlyRate(draft.messMeta.monthlyRate);
        if (draft.messMeta.singleThaliRate) setSingleThaliRate(draft.messMeta.singleThaliRate);
        if (draft.messMeta.tiffinDelivery !== undefined) setTiffinDelivery(draft.messMeta.tiffinDelivery);
        if (draft.messMeta.sundayFeast !== undefined) setSundayFeast(draft.messMeta.sundayFeast);
        if (draft.messMeta.lunchTiming) setLunchTiming(draft.messMeta.lunchTiming);
        if (draft.messMeta.dinnerTiming) setDinnerTiming(draft.messMeta.dinnerTiming);
      }
      if (draft.pgMeta) {
        if (draft.pgMeta.pgGender) setPgGender(draft.pgMeta.pgGender);
        if (draft.pgMeta.totalBeds) setTotalBeds(draft.pgMeta.totalBeds);
        if (draft.pgMeta.availableBeds) setAvailableBeds(draft.pgMeta.availableBeds);
        if (draft.pgMeta.depositAmount) setDepositAmount(draft.pgMeta.depositAmount);
        if (draft.pgMeta.foodIncluded !== undefined) setFoodIncluded(draft.pgMeta.foodIncluded);
        if (draft.pgMeta.rateSingle) setRateSingle(draft.pgMeta.rateSingle);
        if (draft.pgMeta.rateDouble) setRateDouble(draft.pgMeta.rateDouble);
        if (draft.pgMeta.rateTriple) setRateTriple(draft.pgMeta.rateTriple);
      }
      if (draft.schoolMeta) {
        if (draft.schoolMeta.schoolType) setSchoolType(draft.schoolMeta.schoolType);
        if (draft.schoolMeta.schoolMedium) setSchoolMedium(draft.schoolMeta.schoolMedium);
        if (draft.schoolMeta.schoolBoard) setSchoolBoard(draft.schoolMeta.schoolBoard);
        if (draft.schoolMeta.schoolManagement !== undefined) setSchoolManagement(draft.schoolMeta.schoolManagement);
        if (draft.schoolMeta.schoolAdmissionStatus) setSchoolAdmissionStatus(draft.schoolMeta.schoolAdmissionStatus);
        if (draft.schoolMeta.schoolStreams !== undefined) setSchoolStreams(draft.schoolMeta.schoolStreams);
        if (draft.schoolMeta.schoolEmail !== undefined) setSchoolEmail(draft.schoolMeta.schoolEmail);
        if (draft.schoolMeta.schoolWebsite !== undefined) setSchoolWebsite(draft.schoolMeta.schoolWebsite);
        if (draft.schoolMeta.schoolIsOwner !== undefined) setSchoolIsOwner(Boolean(draft.schoolMeta.schoolIsOwner));
      }
      if (typeof draft.step === 'number' && draft.step >= 1 && draft.step <= TOTAL_STEPS) setStep(draft.step);
      setResumePrompt(false);
      setDraftStatus('saved');
      toast.success(t('request.wizard.draftRestored') || 'Draft restored');
    } catch { setResumePrompt(false); }
  };

  const discardDraft = () => {
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
    setResumePrompt(false);
    setDraftStatus('idle');
  };

  // Manual save triggered ONLY when the user clicks the "Save Draft" button
  const handleManualSaveDraft = () => {
    try {
      const hasContent = Object.values(form).some((v) => typeof v === 'string' && v.trim()) || amenities.length > 0;
      if (!hasContent) {
        toast.info(locale === 'mr' ? 'जतन करण्यासाठी कृपया काही माहिती भरा' : 'Please fill in some details before saving a draft');
        return;
      }
      // Save text and configuration only (exclude base64 strings to prevent resource/storage bloat)
      const nonDataPhotos = photos.filter((p) => !p.startsWith('data:'));
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        entityType,
        form,
        amenities,
        photos: nonDataPhotos,
        mr,
        step,
        messMeta: { messType, monthlyRate, singleThaliRate, tiffinDelivery, sundayFeast, lunchTiming, dinnerTiming },
        pgMeta: { pgGender, occupancyTarget, totalBeds, availableBeds, depositAmount, gateClosingTime, foodIncluded, rateSingle, rateDouble, rateTriple },
        schoolMeta: {
          schoolType,
          schoolMedium,
          schoolBoard,
          schoolManagement,
          schoolAdmissionStatus,
          schoolStreams,
          schoolEmail,
          schoolWebsite,
          schoolIsOwner,
        },
        savedAt: Date.now(),
      }));
      setDraftStatus('saved');
      toast.success(locale === 'mr' ? 'ड्राफ्ट जतन झाला आहे!' : 'Draft saved! You can resume it anytime.');
    } catch {
      toast.error('Failed to save draft');
    }
  };

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase.from('categories').select('*').eq('is_active', true).order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: areaOptions = [] } = useQuery<string[]>({
    queryKey: ['shop-areas-distinct'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shops')
        .select('area')
        .not('area', 'is', null)
        .limit(1000);
      if (error) throw error;
      const seen = new Set<string>();
      (data as any[]).forEach((r) => { const a = (r.area as string)?.trim(); if (a) seen.add(a); });
      return Array.from(seen).sort((a, b) => a.localeCompare(b));
    },
    staleTime: 5 * 60 * 1000,
  });

  // Prefill submitter from profile
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('full_name, phone')
        .eq('id', user.id)
        .maybeSingle();
      if (cancelled || !data) return;
      setForm((f) => ({
        ...f,
        submitter_name: f.submitter_name || data.full_name || (user.user_metadata?.full_name as string) || '',
        phone: f.phone || data.phone || '',
      }));
    })();
    return () => { cancelled = true; };
  }, [user]);

  const set = (key: string, val: string) => setForm((f) => ({ ...f, [key]: val }));

  /* ── Examiner / Sample autofill ──────────────────────────────── */
  const handleDevFill = () => {
    const sample = getEntityAutofillSample(entityType, currentCity);
    const common = sample.common;

    // Resolve exact <select> category option when categories are loaded for Shop
    let resolvedCategory = common.category_text;
    if (entityType === 'shop' && categories.length > 0) {
      const targetTokens = common.category_text
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((tok) => tok.length > 2);
      const exactMatch = categories.find(
        (c) => c.name.toLowerCase() === common.category_text.toLowerCase(),
      );
      const fuzzyMatch = exactMatch || categories.find((c) => {
        const cname = c.name.toLowerCase();
        return targetTokens.some((tok) => cname.includes(tok));
      }) || categories[0];
      if (fuzzyMatch?.name) resolvedCategory = fuzzyMatch.name;
    }

    setForm((f) => ({
      ...f,
      name: common.name,
      phone: common.phone,
      whatsapp: common.whatsapp,
      address: common.address,
      area: common.area,
      sub_area: common.sub_area,
      description: common.description,
      keywords: common.keywords,
      category_text: resolvedCategory,
      opening_time: common.opening_time,
      closing_time: common.closing_time,
      submitter_name: common.submitter_name,
      latitude: common.latitude,
      longitude: common.longitude,
    }));

    setAmenities(common.amenities || []);
    if (common.mr) {
      setMr(common.mr);
    }

    if (entityType === 'mess' && sample.mess) {
      setMessType(sample.mess.messType);
      setMonthlyRate(sample.mess.monthlyRate);
      setSingleThaliRate(sample.mess.singleThaliRate);
      setTiffinDelivery(sample.mess.tiffinDelivery);
      setSundayFeast(sample.mess.sundayFeast);
      setLunchTiming(sample.mess.lunchTiming);
      setDinnerTiming(sample.mess.dinnerTiming);
      setPhotos(
        sample.mess.messType === 'veg_nonveg'
          ? ['/images/demo/ruchira-nonveg-thali.jpg', '/images/demo/daily-menu-board.jpg']
          : ['/images/demo/swami-samarth-thali.jpg', '/images/demo/daily-menu-board.jpg'],
      );
    } else if (entityType === 'pg' && sample.pg) {
      setPgGender(sample.pg.pgGender);
      setOccupancyTarget(sample.pg.occupancyTarget);
      setTotalBeds(sample.pg.totalBeds);
      setAvailableBeds(sample.pg.availableBeds);
      setDepositAmount(sample.pg.depositAmount);
      setGateClosingTime(sample.pg.gateClosingTime);
      setFoodIncluded(sample.pg.foodIncluded);
      setRateSingle(sample.pg.rateSingle);
      setRateDouble(sample.pg.rateDouble);
      setRateTriple(sample.pg.rateTriple);
      setPhotos(
        sample.pg.pgGender === 'girls'
          ? ['/images/demo/matoshree-girls-pg.jpg']
          : ['/images/demo/sai-boys-hostel.jpg'],
      );
    } else if (entityType === 'school' && sample.school) {
      setSchoolType(sample.school.schoolType);
      setSchoolMedium(sample.school.schoolMedium);
      setSchoolBoard(sample.school.schoolBoard);
      setSchoolManagement(sample.school.schoolManagement);
      setSchoolAdmissionStatus(sample.school.schoolAdmissionStatus);
      setSchoolStreams(sample.school.schoolStreams);
      setSchoolEmail(sample.school.schoolEmail);
      setSchoolWebsite(sample.school.schoolWebsite);
      setSchoolIsOwner(true);
      setPhotos([]);
    } else {
      setPhotos([]);
    }

    setTruthConfirmed(true);
    setErrors({});
    toast.success(
      locale === 'mr'
        ? `नमुना ${entityType.toUpperCase()} माहिती भरली!`
        : `Sample ${entityType.toUpperCase()} details filled!`,
    );
  };

  /* ── Validation ───────────────────────────────────────────── */
  const buildPayload = () => ({ ...form, truthConfirmed });
  const validate = (): boolean => {
    const result = requestListingSchema.safeParse(buildPayload());
    if (result.success) { setErrors({}); return true; }
    const errs: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const key = (issue.path[0] as string) ?? 'form';
      const mappedKey = key === 'truthConfirmed' ? 'truth' : key;
      if (!errs[mappedKey]) errs[mappedKey] = issue.message;
    }
    setErrors(errs);
    return false;
  };

  const validateField = (key: keyof typeof form) => {
    const result = requestListingSchema.safeParse(buildPayload());
    if (result.success) { setErrors((e) => ({ ...e, [key]: '' })); return; }
    const issue = result.error.issues.find((i) => i.path[0] === key);
    setErrors((e) => ({ ...e, [key]: issue ? issue.message : '' }));
  };

  /* ── Location ───────────────────────────────────────────────── */
  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setGpsMessage(t('request.gps.unsupported'));
      return;
    }
    setLocating(true);
    setGpsMessage('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        set('latitude', pos.coords.latitude.toFixed(6));
        set('longitude', pos.coords.longitude.toFixed(6));
        setLocating(false); setErrors((e) => ({ ...e, location: '' }));
        toast.success(t('request.toast.locationCaptured'));
      },
      (err) => {
        setLocating(false);
        if (err.code === err.PERMISSION_DENIED) setGpsMessage(t('request.gps.denied'));
        else if (err.code === err.POSITION_UNAVAILABLE) setGpsMessage(t('request.gps.unavailable'));
        else setGpsMessage(t('request.gps.failed'));
      },
      { timeout: 10000, maximumAge: 60000 }
    );
  };

  const handleMapPick = (c: Coords) => {
    set('latitude', c.lat.toFixed(6));
    set('longitude', c.lng.toFixed(6));
    setErrors((e) => ({ ...e, location: '' }));
  };

  const clearLocation = () => {
    if (form.latitude && form.longitude) {
      const lat = parseFloat(form.latitude);
      const lng = parseFloat(form.longitude);
      if (!Number.isNaN(lat) && !Number.isNaN(lng)) clearGeocodeCacheNear(lat, lng);
    }
    set('latitude', ''); set('longitude', '');
    setGeocoding(false);
    setErrors((e) => ({ ...e, location: '', latitude: '', longitude: '' }));
  };

  const handleGeocode = ({ address, area }: { address: string; area: string }) => {
    setForm((f) => ({
      ...f,
      address: f.address.trim() ? f.address : (address || ''),
      area: f.area.trim() ? f.area : (area || ''),
    }));
    setGeocoding(false);
  };

  /* ── Multi-image Upload helper ─────────────────────────────── */
  const uploadAllPhotos = async (): Promise<string[]> => {
    if (!photos || photos.length === 0) return [];
    setUploading(true);
    const finalUrls: string[] = [];

    for (let i = 0; i < photos.length; i++) {
      const p = photos[i];
      if (p.startsWith('data:')) {
        try {
          const res = await fetch(p);
          const blob = await res.blob();
          const compressed = await compressImage(blob as unknown as File, 1200, 0.85);
          const { publicUrl, isExisting } = await uploadShopImage(compressed, form.name || entityType, { prefix: `req-${entityType}` });
          if (isExisting) {
            toast.info(locale === 'mr' ? 'विद्यमान फोटो स्टोरेजमधून लिंक केला आहे.' : 'Existing image found in storage and linked.');
          }
          finalUrls.push(publicUrl);
        } catch (err) {
          console.warn('Photo upload failed for slot', i, err);
          // Skip this photo — do NOT persist data: URLs to the database.
          toast.warning(locale === 'mr' ? `फोटो ${i + 1} अपलोड अयशस्वी — वगळला.` : `Photo ${i + 1} upload failed — skipped.`);
        }
      } else {
        finalUrls.push(p);
      }
    }
    setUploading(false);
    return finalUrls;
  };

  /* ── Submit ─────────────────────────────────────────────────── */
  const submitRequest = async (uploadedPhotoUrls: string[]) => {
    // Build specialized metadata JSON
    const entityMeta: Record<string, any> = {};
    if (entityType === 'mess') {
      entityMeta.mess_type = messType;
      entityMeta.monthly_rate = monthlyRate ? Number(monthlyRate) : null;
      entityMeta.single_thali_rate = singleThaliRate ? Number(singleThaliRate) : null;
      entityMeta.tiffin_delivery = tiffinDelivery;
      entityMeta.sunday_feast = sundayFeast;
      entityMeta.lunch_timing = lunchTiming;
      entityMeta.dinner_timing = dinnerTiming;
    } else if (entityType === 'pg') {
      entityMeta.gender = pgGender;
      entityMeta.occupancy_target = occupancyTarget;
      entityMeta.total_beds = totalBeds ? Number(totalBeds) : 0;
      entityMeta.available_beds = availableBeds ? Number(availableBeds) : 0;
      entityMeta.deposit_amount = depositAmount ? Number(depositAmount) : 0;
      entityMeta.gate_closing_time = gateClosingTime;
      entityMeta.food_included = foodIncluded;
      entityMeta.sharing_rates = {
        '1_sharing': rateSingle ? Number(rateSingle) : null,
        '2_sharing': rateDouble ? Number(rateDouble) : null,
        '3_sharing': rateTriple ? Number(rateTriple) : null,
      };
    } else if (entityType === 'school') {
      const normalizedWeb = (() => {
        const w = schoolWebsite.trim();
        if (!w) return null;
        const candidate = /^https?:\/\//i.test(w) ? w : `https://${w}`;
        return isSafeHttpUrl(candidate) ? candidate : null;
      })();
      entityMeta.school_type = schoolType;
      entityMeta.medium = schoolMedium;
      entityMeta.board = schoolBoard.trim() || null;
      entityMeta.management_type = schoolManagement || null;
      entityMeta.admission_status = schoolAdmissionStatus;
      entityMeta.streams = schoolStreams
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      entityMeta.email = schoolEmail.trim() || null;
      entityMeta.website = normalizedWeb;
      entityMeta.is_owner = schoolIsOwner;
      if (mr.name.trim()) entityMeta.name_mr = mr.name.trim();
      if (mr.address.trim()) entityMeta.address_mr = mr.address.trim();
    }

    const categoryTextResolved =
      entityType === 'mess' ? 'Mess & Dining' :
      entityType === 'pg' ? 'PG & Hostels' :
      entityType === 'school' ? 'Schools' :
      (form.category_text.trim() || null);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('shop_requests') as any).insert({
      name: form.name.trim(),
      phone: normalizePhone(form.phone),
      whatsapp: form.whatsapp.trim() ? normalizeWhatsApp(form.whatsapp) : null,
      address: form.address.trim() || null,
      area: form.area.trim() ? normalizeArea(form.area) : null,
      sub_area: form.sub_area.trim() || null,
      description: form.description.trim() || null,
      keywords: form.keywords.trim() || null,
      category_text: categoryTextResolved,
      opening_time: form.opening_time || null,
      closing_time: form.closing_time || null,
      image_url: uploadedPhotoUrls[0] || null,
      photos: uploadedPhotoUrls,
      entity_type: entityType,
      meta: entityMeta,
      submitter_name: form.submitter_name.trim() || null,
      status: 'pending',
      latitude: form.latitude ? parseFloat(form.latitude) : null,
      longitude: form.longitude ? parseFloat(form.longitude) : null,
      maps_link: null,
      amenities: amenities,
      submitter_user_id: user?.id ?? null,
      city_id: currentCity.id,
      village_id: currentVillage?.id ?? null,
      district_id: currentCity.district_id ?? null,
      state_id: currentCity.district?.state_id ?? (currentCity as any).state_id ?? null,
    }).select('id').single();

    setSaving(false);
    if (error) { toast.error(t('request.toast.submitFailed')); return; }
    setDone(true);
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (!checkCooldown('shop-request-submit', 3000)) {
      toast.error(t('rate.tooFast'));
      return;
    }
    setSaving(true);
    let uploadedUrls: string[] = [];
    try {
      uploadedUrls = await uploadAllPhotos();
    } catch {
      uploadedUrls = photos;
    }
    await submitRequest(uploadedUrls);
  };

  /* Completion progress */
  const completion = useMemo(() => {
    const required = ['name', 'phone', 'address', 'area'] as const;
    const bonus = ['latitude', 'description', 'opening_time'] as const;
    const reqFilled = required.filter((k) => form[k as keyof typeof form]?.toString().trim()).length;
    const bonusFilled = bonus.filter((k) => form[k as keyof typeof form]?.toString().trim()).length
      + (photos.length > 0 ? 1 : 0)
      + (amenities.length > 0 ? 1 : 0);
    const pct = Math.round((reqFilled / required.length) * 70 + (bonusFilled / (bonus.length + 2)) * 30);
    return Math.min(100, pct);
  }, [form, photos, amenities]);

  /* ── Success screen ─────────────────────────────────────────── */
  if (done) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4">
        <div className="bg-card rounded-2xl border border-border w-full max-w-sm shadow-2xl p-8 text-center">
          <CheckCircle2 className="w-14 h-14 mx-auto mb-4" style={{ color: 'hsl(var(--success))' }} />
          <h2 className="text-xl font-bold text-foreground mb-2">{t('request.submitted')}</h2>
          <p className="text-sm text-muted-foreground mb-1">{t('request.receivedDesc')}</p>
          <p className="text-sm text-muted-foreground mb-4">{t('request.reviewDesc')}</p>
          {user ? (
            <>
              <div className="mb-4 rounded-xl px-3 py-2.5 text-left text-xs leading-relaxed"
                style={{ background: 'hsl(var(--primary) / 0.08)', border: '1px solid hsl(var(--primary) / 0.2)' }}>
                <p className="font-semibold text-foreground mb-0.5">{t('request.trackTitle')}</p>
                <p className="text-muted-foreground">{t('request.trackDesc')}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => { onClose(); navigate('/my-shop'); }}
                  className="py-3 bg-primary text-primary-foreground rounded-xl font-bold text-sm hover:bg-primary/90 transition-colors">
                  {t('request.track')}
                </button>
                <button onClick={onClose}
                  className="py-3 border border-border rounded-xl font-semibold text-sm hover:bg-muted transition-colors">
                  {t('request.done')}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="mb-4 rounded-xl px-3 py-2.5 text-left text-xs leading-relaxed"
                style={{ background: 'hsl(var(--primary) / 0.08)', border: '1px solid hsl(var(--primary) / 0.2)' }}>
                <p className="font-semibold text-foreground mb-0.5">{t('request.trackSignUp.title')}</p>
                <p className="text-muted-foreground">{t('request.trackSignUp.desc')}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => { onClose(); navigate('/auth?next=/my-shop'); }}
                  className="py-3 bg-primary text-primary-foreground rounded-xl font-bold text-sm hover:bg-primary/90 transition-colors flex items-center justify-center gap-1.5">
                  <LogIn className="w-4 h-4" /> {t('request.signUp')}
                </button>
                <button onClick={onClose}
                  className="py-3 border border-border rounded-xl font-semibold text-sm hover:bg-muted transition-colors">
                  {t('request.done')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  const hasCoords = !!(form.latitude && form.longitude);

  /* Step field mapping for 5 steps */
  const stepFieldMap: Record<number, string[]> = {
    1: [], // Entity selection
    2: ['name', 'phone', 'whatsapp'],
    3: ['address', 'area', 'sub_area', 'latitude', 'longitude'],
    4: ['opening_time', 'closing_time', 'category_text', 'description', 'keywords', 'submitter_name'],
    5: [], // Review step
  };

  const validateStep = (n: number): boolean => {
    const result = requestListingSchema.safeParse(buildPayload());
    if (result.success) { setErrors({}); return true; }
    const fields = stepFieldMap[n] ?? [];
    const fieldErrors: Record<string, string> = {};
    let invalid = false;
    for (const issue of result.error.issues) {
      const key = issue.path[0] as string;
      if (fields.includes(key)) {
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
        invalid = true;
      }
    }
    setErrors((e) => ({ ...e, ...fieldErrors }));
    return !invalid;
  };

  const goNext = () => {
    if (!validateStep(step)) {
      toast.error('Please complete the required fields to continue', { id: 'wizard-step' });
      return;
    }
    if (step < TOTAL_STEPS) setStep(step + 1);
  };
  const goBack = () => { if (step > 1) setStep(step - 1); };

  /* ── Resume prompt ─────────────────────────────────────────── */
  if (resumePrompt) {
    return (
      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4">
        <div className="bg-card rounded-2xl border border-border w-full max-w-sm shadow-2xl p-6 text-center">
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl flex items-center justify-center"
               style={{ background: 'hsl(var(--primary) / 0.1)' }}>
            <RotateCcw className="w-6 h-6" style={{ color: 'hsl(var(--primary))' }} />
          </div>
          <h2 className="text-lg font-bold text-foreground mb-1.5">{t('request.wizard.resumeTitle')}</h2>
          <p className="text-sm text-muted-foreground mb-5">{t('request.wizard.resumeDesc')}</p>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={discardDraft}
              className="py-2.5 rounded-xl border border-border font-semibold text-sm text-muted-foreground hover:bg-muted transition-colors">
              {t('request.wizard.resumeNo')}
            </button>
            <button onClick={restoreDraft}
              className="py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-colors">
              {t('request.wizard.resumeYes')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const encouragement =
    step === TOTAL_STEPS ? (t('request.wizard.encourage.final') || 'Final step — review & submit!') :
    step >= 3 ? (t('request.wizard.encourage.great') || 'Looking great so far.') :
    (t('request.wizard.encourage.almost') || 'Almost there!');

  const stepTitles = [
    { title: locale === 'mr' ? 'प्रकार निवडा' : 'Choose Category', sub: locale === 'mr' ? 'तुम्हाला कोणती नोंदणी करायची आहे?' : 'What kind of listing would you like to create?' },
    { title: locale === 'mr' ? 'मूलभूत संपर्क माहिती' : 'Basic Contact & Details', sub: locale === 'mr' ? 'ग्राहक सहज संपर्क साधू शकतील.' : 'Quick details so people can identify and reach you.' },
    { title: locale === 'mr' ? 'पत्ता आणि नकाशा' : 'Location & Address', sub: locale === 'mr' ? 'ग्राहकांना तुमच्या पत्त्यावर पोहोचण्यास मदत करा.' : 'Help people find and navigate to your doorstep.' },
    { title: locale === 'mr' ? 'वैशिष्ट्ये आणि फोटो' : 'Specialized Details & Photos', sub: locale === 'mr' ? '५ फोटो पर्यंत जोडा व तुमचे दर/सुविधा नोंदवा.' : 'Add up to 5 photos, rates, and amenities.' },
    { title: locale === 'mr' ? 'तपासा आणि सबमिट करा' : 'Review & Submit', sub: locale === 'mr' ? 'माहिती तपासा आणि मंजुरीसाठी पाठवा.' : 'Ensure all details look accurate, confirm, and finish.' },
  ];

  /* ── Wizard Rendering ────────────────────────────────────────── */
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center sm:px-4 sm:py-6">
      <div className="bg-card border border-border w-full max-w-xl sm:rounded-2xl rounded-t-3xl shadow-2xl flex flex-col max-h-[96vh] sm:max-h-[92vh]">
        {/* Sticky header with progress */}
        <div className="px-4 sm:px-6 pt-4 sm:pt-5 pb-3 border-b border-border bg-card sm:rounded-t-2xl rounded-t-3xl">
          <div className="flex items-start justify-between gap-2 sm:gap-3 mb-3">
            <div className="flex items-center gap-2 sm:gap-2.5 flex-1 min-w-0">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                   style={{ background: 'hsl(var(--primary) / 0.12)' }}>
                {entityType === 'mess' ? <UtensilsCrossed className="w-4.5 h-4.5 text-primary" /> :
                 entityType === 'pg' ? <BedDouble className="w-4.5 h-4.5 text-primary" /> :
                 entityType === 'school' ? <GraduationCap className="w-4.5 h-4.5 text-primary" /> :
                 <Store className="w-4.5 h-4.5 text-primary" />}
              </div>
              <div className="min-w-0">
                <h2 className="font-bold text-base sm:text-lg text-foreground leading-tight truncate">
                  {entityType === 'mess' ? (locale === 'mr' ? 'मेस नोंदणी' : 'List a Mess / Bhojanalay') :
                   entityType === 'pg' ? (locale === 'mr' ? 'पीजी व वसतिगृह नोंदणी' : 'List a PG / Hostel') :
                   entityType === 'school' ? (locale === 'mr' ? 'शाळा नोंदणी' : 'List a School') :
                   t('request.modalTitle')}
                </h2>
                <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
                  <span>{t('request.wizard.stepOf', { current: String(step), total: String(TOTAL_STEPS) })}</span>
                  <span className="opacity-50">·</span>
                  <span className="font-medium" style={{ color: 'hsl(var(--primary))' }}>
                    {t('request.wizard.completion', { percent: String(completion) })}
                  </span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <button
                type="button"
                onClick={handleManualSaveDraft}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border border-border bg-muted/50 hover:bg-muted text-xs font-semibold text-foreground transition-all active:scale-95 shadow-xs whitespace-nowrap"
                title={locale === 'mr' ? 'ड्राफ्ट जतन करा' : 'Save draft'}
              >
                <Bookmark className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="sm:hidden">{locale === 'mr' ? 'सेव्ह' : 'Save'}</span>
                <span className="hidden sm:inline">{locale === 'mr' ? 'ड्राफ्ट सेव्ह' : 'Save Draft'}</span>
              </button>
              <button onClick={onClose} aria-label={t('claim.closeAria')}
                className="p-1.5 hover:bg-muted rounded-lg transition-colors shrink-0">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="flex items-center gap-1.5">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => {
              const idx = i + 1;
              const reached = idx <= step;
              return (
                <div key={i} className="flex-1 h-1.5 rounded-full overflow-hidden bg-muted">
                  <div className="h-full transition-all duration-500 ease-out"
                       style={{
                         width: reached ? '100%' : '0%',
                         background: idx === step
                           ? 'linear-gradient(90deg, hsl(var(--primary)), hsl(var(--primary) / 0.7))'
                           : 'hsl(var(--primary))',
                       }} />
                </div>
              );
            })}
          </div>

          {/* Draft status */}
          <div className="mt-2 flex flex-wrap items-center justify-between gap-1.5 text-[10.5px]">
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              {draftStatus === 'saved' && (<><Check className="w-3 h-3 text-emerald-600" /> {locale === 'mr' ? 'ड्राफ्ट जतन झाला' : (t('request.wizard.draftSaved') || 'Draft saved')}</>)}
              {draftStatus === 'idle'   && <span className="text-[10px] text-muted-foreground/60 italic">{locale === 'mr' ? 'नोंदणी कधीही सुरू ठेवण्यासाठी ड्राफ्ट सेव्ह करा' : 'Tap Save Draft to resume anytime'}</span>}
            </span>
            {draftStatus === 'saved' && (
              <button type="button" onClick={() => { discardDraft(); toast.message(t('request.wizard.draftDiscarded') || 'Draft discarded'); }}
                className="font-medium text-muted-foreground hover:text-destructive transition-colors">
                {t('request.wizard.draftDiscard')}
              </button>
            )}
          </div>
        </div>

        {/* Scrollable step body */}
        <div className="overflow-y-auto px-5 sm:px-6 py-5 flex-1">
          <div className="mb-5">
            <h3 className="text-base sm:text-lg font-bold text-foreground leading-snug">
              {stepTitles[step - 1].title}
            </h3>
            <p className="text-xs sm:text-[13px] text-muted-foreground mt-1 leading-relaxed">
              {stepTitles[step - 1].sub}
            </p>
            <div className="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                 style={{ background: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))' }}>
              <Sparkles className="w-3 h-3" /> {encouragement}
            </div>
          </div>

          {DEV_AUTOFILL && step >= 1 && step <= 4 && (
            <button type="button" onClick={handleDevFill}
              className="w-full mb-4 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold border border-dashed border-secondary text-secondary bg-secondary/10 hover:bg-secondary/20 transition-colors">
              <FlaskConical className="w-3.5 h-3.5" />
              <span>{t('request.devAutofill')}</span>
              <span className="opacity-75">({entityType.toUpperCase()})</span>
            </button>
          )}

          {step === 1 && !user && (
            <div className="px-3.5 py-2.5 rounded-xl text-[11.5px] mb-4 flex items-start gap-2 leading-snug"
                 style={{ background: 'hsl(var(--primary) / 0.08)', border: '1px solid hsl(var(--primary) / 0.18)' }}>
              <ShieldCheck className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: 'hsl(var(--primary))' }} />
              <span className="text-muted-foreground">
                {t('request.freeListing')} ·{' '}
                <button type="button" onClick={() => { onClose(); navigate(`/auth?next=${encodeURIComponent(window.location.pathname)}&list-shop=${encodeURIComponent(entityType)}`); }}
                  className="font-semibold text-primary hover:underline">{t('request.signInLink')}</button>{' '}
                {t('request.signInToTrackInline')}
              </span>
            </div>
          )}

          {/* ── STEP 1: Entity Type Selection ────────────────────── */}
          {step === 1 && (
            <div className="space-y-3">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {locale === 'mr' ? 'नोंदणी प्रकार निवडा' : 'Select Listing Type'}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Shop Card */}
                <button
                  type="button"
                  onClick={() => setEntityType('shop')}
                  className={cn(
                    'p-4 rounded-2xl border text-left transition-all relative overflow-hidden flex flex-col justify-between group',
                    entityType === 'shop'
                      ? 'border-primary bg-primary/5 shadow-md shadow-primary/10'
                      : 'border-border bg-card hover:border-border/80 hover:bg-muted/30'
                  )}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                      <Store className="w-5 h-5" />
                    </div>
                    {entityType === 'shop' && (
                      <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs">✓</span>
                    )}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-foreground">
                      {locale === 'mr' ? '🏪 दुकान / व्यवसाय' : '🏪 Shop / Business'}
                    </h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                      {locale === 'mr' ? 'किराणा, कपडे, इलेक्ट्रॉनिक्स, सर्व्हिस सेंटर इत्यादी.' : 'Retail stores, services, grocery, medical, electronics.'}
                    </p>
                  </div>
                </button>

                {/* Mess Card */}
                <button
                  type="button"
                  onClick={() => setEntityType('mess')}
                  className={cn(
                    'p-4 rounded-2xl border text-left transition-all relative overflow-hidden flex flex-col justify-between group',
                    entityType === 'mess'
                      ? 'border-primary bg-primary/5 shadow-md shadow-primary/10'
                      : 'border-border bg-card hover:border-border/80 hover:bg-muted/30'
                  )}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                      <UtensilsCrossed className="w-5 h-5" />
                    </div>
                    {entityType === 'mess' && (
                      <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs">✓</span>
                    )}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-foreground">
                      {locale === 'mr' ? '🍲 मेस / भोजनालय' : '🍲 Mess & Dining'}
                    </h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                      {locale === 'mr' ? 'थाळी, आजचा मेनू, मासिक फी आणि टिफिन डिलिव्हरी.' : 'Daily food menus, thali rates, monthly passes, tiffin delivery.'}
                    </p>
                  </div>
                </button>

                {/* PG Card */}
                <button
                  type="button"
                  onClick={() => setEntityType('pg')}
                  className={cn(
                    'p-4 rounded-2xl border text-left transition-all relative overflow-hidden flex flex-col justify-between group',
                    entityType === 'pg'
                      ? 'border-primary bg-primary/5 shadow-md shadow-primary/10'
                      : 'border-border bg-card hover:border-border/80 hover:bg-muted/30'
                  )}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                      <BedDouble className="w-5 h-5" />
                    </div>
                    {entityType === 'pg' && (
                      <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs">✓</span>
                    )}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-foreground">
                      {locale === 'mr' ? '🛏️ पीजी / वसतिगृह' : '🛏️ PG & Hostels'}
                    </h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                      {locale === 'mr' ? 'मुले/मुलींचे वसतिगृह, रिक्त खाटांची संख्या, भाडे व सुविधा.' : 'Student & working hostel, vacant beds, sharing rates, facilities.'}
                    </p>
                  </div>
                </button>

                {/* School Card */}
                <button
                  type="button"
                  onClick={() => setEntityType('school')}
                  className={cn(
                    'p-4 rounded-2xl border text-left transition-all relative overflow-hidden flex flex-col justify-between group',
                    entityType === 'school'
                      ? 'border-primary bg-primary/5 shadow-md shadow-primary/10'
                      : 'border-border bg-card hover:border-border/80 hover:bg-muted/30'
                  )}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center">
                      <GraduationCap className="w-5 h-5" />
                    </div>
                    {entityType === 'school' && (
                      <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs">✓</span>
                    )}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-foreground">
                      {locale === 'mr' ? '🎓 शाळा / महाविद्यालय' : '🎓 School / College'}
                    </h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                      {locale === 'mr' ? 'प्राथमिक, माध्यमिक शाळा, कनिष्ठ महाविद्यालय व क्लासेस.' : 'Primary, secondary, junior college, mediums and admissions.'}
                    </p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 2: Basic Contact & Identity ────────────────── */}
          {step === 2 && (
            <div className="space-y-4">
              <Field
                label={
                  entityType === 'mess' ? (locale === 'mr' ? 'मेस / भोजनालयाचे नाव *' : 'Mess / Bhojanalay Name *') :
                  entityType === 'pg' ? (locale === 'mr' ? 'पीजी / वसतिगृहाचे नाव *' : 'PG / Hostel Name *') :
                  entityType === 'school' ? (locale === 'mr' ? 'शाळा / महाविद्यालयाचे नाव *' : 'School / College Name *') :
                  t('request.field.shopNameRequired')
                }
              >
                <input
                  value={form.name}
                  onChange={(e) => { set('name', e.target.value); clearErr('name'); }}
                  onBlur={() => validateField('name')}
                  className={inputCls + (errors.name ? ' border-destructive' : '')}
                  placeholder={
                    entityType === 'mess' ? 'उदा. श्री स्वामी समर्थ भोजनालय' :
                    entityType === 'pg' ? 'उदा. श्री साई बॉईज हॉस्टेल' :
                    entityType === 'school' ? 'उदा. जिल्हा परिषद प्राथमिक शाळा' :
                    t('request.placeholder.shopName')
                  }
                  maxLength={120}
                />
                {errors.name && <Err msg={errors.name} />}
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label={t('request.field.phoneRequired')}>
                  <input
                    value={form.phone}
                    onChange={(e) => { set('phone', e.target.value); clearErr('phone'); }}
                    onBlur={() => validateField('phone')}
                    className={inputCls + (errors.phone ? ' border-destructive' : '')}
                    placeholder={t('request.placeholder.phone')}
                    inputMode="numeric"
                    maxLength={13}
                  />
                  {errors.phone && <Err msg={errors.phone} />}
                </Field>
                <Field label={t('request.field.whatsappOptional')}>
                  <input
                    value={form.whatsapp}
                    onChange={(e) => { set('whatsapp', e.target.value); clearErr('whatsapp'); }}
                    onBlur={() => validateField('whatsapp')}
                    className={inputCls + (errors.whatsapp ? ' border-destructive' : '')}
                    placeholder={t('request.placeholder.phone')}
                    inputMode="numeric"
                    maxLength={13}
                  />
                  {errors.whatsapp && <Err msg={errors.whatsapp} />}
                </Field>
              </div>
            </div>
          )}

          {/* ── STEP 3: Location ────────────────────────────────── */}
          {step === 3 && (
            <div className="space-y-4">
              <Field label={t('request.field.addressRequired')}>
                <input
                  value={form.address}
                  onChange={(e) => { set('address', e.target.value); clearErr('address'); }}
                  onBlur={() => validateField('address')}
                  className={inputCls + (errors.address ? ' border-destructive' : '')}
                  placeholder={t('request.placeholder.address')}
                  maxLength={250}
                />
                {errors.address && <Err msg={errors.address} />}
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label={t('request.field.areaRequired')}>
                  <input
                    value={form.area}
                    onChange={(e) => { set('area', e.target.value); clearErr('area'); }}
                    onBlur={() => validateField('area')}
                    className={inputCls + (errors.area ? ' border-destructive' : '')}
                    placeholder={t('request.placeholder.area')}
                    list="req-common-areas"
                    maxLength={100}
                  />
                  <datalist id="req-common-areas">
                    {areaOptions.map((v) => <option key={v} value={v} />)}
                  </datalist>
                  {errors.area && <Err msg={errors.area} />}
                </Field>
                <Field label={t('request.field.subAreaOptional')}>
                  <input
                    value={form.sub_area}
                    onChange={(e) => set('sub_area', e.target.value)}
                    className={inputCls}
                    placeholder={t('request.placeholder.subArea')}
                    maxLength={100}
                  />
                </Field>
              </div>

              {/* Interactive Location Map Picker */}
              <div className="rounded-xl border border-border overflow-hidden" style={{ background: 'hsl(var(--muted) / 0.4)' }}>
                <div className="flex items-center gap-1.5 px-4 pt-3 pb-2">
                  <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                  <p className="text-xs font-semibold text-foreground">{t('request.locationTitle')}</p>
                  <span className="ml-auto text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                    {t('request.wizard.skip').replace(' for now','')}
                  </span>
                </div>
                <div className="px-4 pb-4 space-y-2.5">
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{t('request.locationHint')}</p>
                  <LocationMapPicker
                    value={hasCoords ? { lat: parseFloat(form.latitude), lng: parseFloat(form.longitude) } : null}
                    onChange={(c) => { setGeocoding(true); handleMapPick(c); }}
                    onGeocode={handleGeocode}
                    initialCenter={mapInitialCenter ?? MUKTAINAGAR_CENTER}
                    height={190}
                  />
                  {hasCoords ? (
                    <div className="px-3 py-2 rounded-lg flex items-center justify-between gap-2"
                         style={{ background: 'hsl(var(--primary) / 0.08)', border: '1px solid hsl(var(--primary) / 0.2)' }}>
                      <span className="text-[11px] font-mono text-foreground truncate inline-flex items-center gap-1">
                        <MapPin className="w-3 h-3" />{form.latitude}, {form.longitude}
                        {geocoding && <span className="ml-1 text-muted-foreground">· {t('request.location.fetchingAddress')}</span>}
                      </span>
                      <button type="button" onClick={clearLocation} className="shrink-0 text-xs text-destructive font-semibold hover:opacity-70">
                        {t('request.location.clear')}
                      </button>
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground italic">{t('request.noLocationYet')}</p>
                  )}
                  {gpsMessage && (
                    <div className="px-3 py-2 rounded-lg text-[11px] leading-relaxed"
                         style={{ background: 'hsl(var(--destructive) / 0.08)', border: '1px solid hsl(var(--destructive) / 0.25)', color: 'hsl(var(--destructive))' }}>
                      {gpsMessage}
                    </div>
                  )}
                  <button type="button" onClick={handleGetLocation} disabled={locating}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors disabled:opacity-60 border border-border bg-background hover:bg-muted">
                    {locating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Navigation className="w-3.5 h-3.5 text-primary" />}
                    {locating ? t('request.gettingGps') : t('request.useGps')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 4: Specialized Details & Multi-Photo ─────────── */}
          {step === 4 && (
            <div className="space-y-4">
              {/* Specialized Section for MESS */}
              {entityType === 'mess' && (
                <div className="p-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 space-y-4">
                  <div className="flex items-center gap-2">
                    <UtensilsCrossed className="w-4 h-4 text-amber-600" />
                    <h4 className="font-bold text-sm text-foreground">
                      {locale === 'mr' ? 'मेस तपशील व दर' : 'Mess Details & Rates'}
                    </h4>
                  </div>

                  <Field label={locale === 'mr' ? 'मेसचा प्रकार' : 'Mess Type'}>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {[
                        { id: 'pure_veg', label: '🟢 Pure Veg', mr: '🟢 शुद्ध शाकाहारी' },
                        { id: 'veg_nonveg', label: '🔴 Veg & Non-Veg', mr: '🔴 व्हेज / नॉन-व्हेज' },
                        { id: 'jain_available', label: '🟡 Jain Option', mr: '🟡 जैन उपलब्ध' },
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setMessType(item.id as any)}
                          className={cn(
                            'py-2 px-2 rounded-xl text-xs font-semibold border transition-all text-center',
                            messType === item.id
                              ? 'border-amber-600 bg-amber-600/15 text-foreground shadow-xs'
                              : 'border-border bg-card text-muted-foreground hover:bg-muted'
                          )}
                        >
                          {locale === 'mr' ? item.mr : item.label}
                        </button>
                      ))}
                    </div>
                  </Field>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label={locale === 'mr' ? 'मासिक दर (₹ / महिना)' : 'Monthly Pass Rate (₹)'}>
                      <input
                        type="number"
                        value={monthlyRate}
                        onChange={(e) => setMonthlyRate(e.target.value)}
                        className={inputCls}
                        placeholder="e.g. 2200"
                      />
                    </Field>
                    <Field label={locale === 'mr' ? 'एक थाळी दर (₹)' : 'Single Thali Rate (₹)'}>
                      <input
                        type="number"
                        value={singleThaliRate}
                        onChange={(e) => setSingleThaliRate(e.target.value)}
                        className={inputCls}
                        placeholder="e.g. 70"
                      />
                    </Field>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="flex items-center gap-2 cursor-pointer p-2.5 rounded-xl border border-border bg-card">
                      <input
                        type="checkbox"
                        checked={tiffinDelivery}
                        onChange={(e) => setTiffinDelivery(e.target.checked)}
                        className="w-4 h-4 accent-amber-600 rounded"
                      />
                      <span className="text-xs font-semibold text-foreground">
                        {locale === 'mr' ? 'टिफिन डिलिव्हरी उपलब्ध' : 'Tiffin Delivery'}
                      </span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer p-2.5 rounded-xl border border-border bg-card">
                      <input
                        type="checkbox"
                        checked={sundayFeast}
                        onChange={(e) => setSundayFeast(e.target.checked)}
                        className="w-4 h-4 accent-amber-600 rounded"
                      />
                      <span className="text-xs font-semibold text-foreground">
                        {locale === 'mr' ? 'रविवार विशेष मेजवानी' : 'Sunday Feast'}
                      </span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label={locale === 'mr' ? 'दुपारी जेवण वेळ' : 'Lunch Timing'}>
                      <input
                        value={lunchTiming}
                        onChange={(e) => setLunchTiming(e.target.value)}
                        className={inputCls + ' text-xs'}
                        placeholder="11:30 AM - 02:30 PM"
                      />
                    </Field>
                    <Field label={locale === 'mr' ? 'रात्री जेवण वेळ' : 'Dinner Timing'}>
                      <input
                        value={dinnerTiming}
                        onChange={(e) => setDinnerTiming(e.target.value)}
                        className={inputCls + ' text-xs'}
                        placeholder="07:30 PM - 10:30 PM"
                      />
                    </Field>
                  </div>
                </div>
              )}

              {/* Specialized Section for PG & HOSTEL */}
              {entityType === 'pg' && (
                <div className="p-4 rounded-2xl border border-blue-500/20 bg-blue-500/5 space-y-4">
                  <div className="flex items-center gap-2">
                    <BedDouble className="w-4 h-4 text-blue-600" />
                    <h4 className="font-bold text-sm text-foreground">
                      {locale === 'mr' ? 'पीजी तपशील, खाटा व भाडे' : 'PG Details, Beds & Rent'}
                    </h4>
                  </div>

                  <Field label={locale === 'mr' ? 'कोणासाठी आहे?' : 'Target Gender'}>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {[
                        { id: 'boys', label: '👦 Boys Only', mr: '👦 फक्त मुले' },
                        { id: 'girls', label: '👧 Girls Only', mr: '👧 फक्त मुली' },
                        { id: 'both', label: '👥 Both / Co-ed', mr: '👥 मुले व मुली' },
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setPgGender(item.id as any)}
                          className={cn(
                            'py-2 px-2 rounded-xl text-xs font-semibold border transition-all text-center',
                            pgGender === item.id
                              ? 'border-blue-600 bg-blue-600/15 text-foreground shadow-xs'
                              : 'border-border bg-card text-muted-foreground hover:bg-muted'
                          )}
                        >
                          {locale === 'mr' ? item.mr : item.label}
                        </button>
                      ))}
                    </div>
                  </Field>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label={locale === 'mr' ? 'एकूण खाटा (Total Beds)' : 'Total Beds'}>
                      <input
                        type="number"
                        value={totalBeds}
                        onChange={(e) => setTotalBeds(e.target.value)}
                        className={inputCls}
                        placeholder="e.g. 20"
                      />
                    </Field>
                    <Field label={locale === 'mr' ? 'सध्या रिक्त खाटा (Vacant Beds)' : 'Vacant Beds Now'}>
                      <input
                        type="number"
                        value={availableBeds}
                        onChange={(e) => setAvailableBeds(e.target.value)}
                        className={inputCls}
                        placeholder="e.g. 3"
                      />
                    </Field>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <Field label={locale === 'mr' ? '१ शेअरींग (₹)' : '1-Bed (₹)'}>
                      <input
                        type="number"
                        value={rateSingle}
                        onChange={(e) => setRateSingle(e.target.value)}
                        className={inputCls + ' text-xs'}
                        placeholder="3500"
                      />
                    </Field>
                    <Field label={locale === 'mr' ? '२ शेअरींग (₹)' : '2-Sharing (₹)'}>
                      <input
                        type="number"
                        value={rateDouble}
                        onChange={(e) => setRateDouble(e.target.value)}
                        className={inputCls + ' text-xs'}
                        placeholder="2500"
                      />
                    </Field>
                    <Field label={locale === 'mr' ? '३ शेअरींग (₹)' : '3-Sharing (₹)'}>
                      <input
                        type="number"
                        value={rateTriple}
                        onChange={(e) => setRateTriple(e.target.value)}
                        className={inputCls + ' text-xs'}
                        placeholder="2000"
                      />
                    </Field>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="flex items-center gap-2 cursor-pointer p-2.5 rounded-xl border border-border bg-card">
                      <input
                        type="checkbox"
                        checked={foodIncluded}
                        onChange={(e) => setFoodIncluded(e.target.checked)}
                        className="w-4 h-4 accent-blue-600 rounded"
                      />
                      <span className="text-xs font-semibold text-foreground">
                        {locale === 'mr' ? 'मेस / जेवण समाविष्ट' : 'Food Included'}
                      </span>
                    </label>
                    <Field label={locale === 'mr' ? 'गेट बंद होण्याची वेळ' : 'Gate Closing'}>
                      <input
                        value={gateClosingTime}
                        onChange={(e) => setGateClosingTime(e.target.value)}
                        className={inputCls + ' text-xs'}
                        placeholder="10:00 PM"
                      />
                    </Field>
                  </div>
                </div>
              )}

              {/* Specialized Section for SCHOOL / INSTITUTE */}
              {entityType === 'school' && (
                <div className="p-4 rounded-2xl border border-purple-500/20 bg-purple-500/5 space-y-4">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-purple-600" />
                    <h4 className="font-bold text-sm text-foreground">
                      {locale === 'mr' ? 'शिक्षण संस्था तपशील, माध्यम व प्रवेश' : 'Institute Category, Board & Admissions'}
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label={locale === 'mr' ? 'संस्थेचा स्तर' : 'Institute Level'}>
                      <select
                        value={schoolType}
                        onChange={(e) => setSchoolType(e.target.value as SchoolType)}
                        className={inputCls + ' cursor-pointer'}
                      >
                        {SCHOOL_TYPE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label={locale === 'mr' ? 'शिक्षणाचे माध्यम' : 'Primary Medium'}>
                      <select
                        value={schoolMedium}
                        onChange={(e) => setSchoolMedium(e.target.value as SchoolMedium)}
                        className={inputCls + ' cursor-pointer'}
                      >
                        {SCHOOL_MEDIUM_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </Field>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label={locale === 'mr' ? 'व्यवस्थापन प्रकार' : 'Management Type'}>
                      <select
                        value={schoolManagement}
                        onChange={(e) => setSchoolManagement((e.target.value || '') as ManagementType | '')}
                        className={inputCls + ' cursor-pointer'}
                      >
                        <option value="">{locale === 'mr' ? '— निवडा (ऐच्छिक) —' : '— Select (Optional) —'}</option>
                        {MANAGEMENT_TYPE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label={locale === 'mr' ? 'प्रवेश स्थिती' : 'Admission Status'}>
                      <select
                        value={schoolAdmissionStatus}
                        onChange={(e) => setSchoolAdmissionStatus(e.target.value as AdmissionStatus)}
                        className={inputCls + ' cursor-pointer'}
                      >
                        {ADMISSION_STATUS_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </Field>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label={locale === 'mr' ? 'बोर्ड / विद्यापीठ संलग्नता' : 'Board / University Affiliation'}>
                      <input
                        value={schoolBoard}
                        onChange={(e) => setSchoolBoard(e.target.value)}
                        list="req-school-boards"
                        className={inputCls}
                        placeholder="State Board / CBSE / SPPU"
                        maxLength={120}
                      />
                      <datalist id="req-school-boards">
                        {COMMON_BOARDS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
                      </datalist>
                    </Field>
                    <Field label={locale === 'mr' ? 'शाखा / कोर्सेस (ऐच्छिक)' : 'Streams / Courses (Optional)'}>
                      <input
                        value={schoolStreams}
                        onChange={(e) => setSchoolStreams(e.target.value)}
                        className={inputCls}
                        placeholder="e.g. Science, Commerce, Engineering"
                        maxLength={160}
                      />
                    </Field>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label={locale === 'mr' ? 'ईमेल (ऐच्छिक)' : 'Official Email (Optional)'}>
                      <input
                        type="email"
                        value={schoolEmail}
                        onChange={(e) => setSchoolEmail(e.target.value)}
                        className={inputCls}
                        placeholder="admissions@institute.edu.in"
                        maxLength={120}
                      />
                    </Field>
                    <Field label={locale === 'mr' ? 'वेबसाईट (ऐच्छिक)' : 'Website URL (Optional)'}>
                      <input
                        type="url"
                        value={schoolWebsite}
                        onChange={(e) => setSchoolWebsite(e.target.value)}
                        className={inputCls}
                        placeholder="https://institute.edu.in"
                        maxLength={200}
                      />
                    </Field>
                  </div>

                  <label className="flex items-start gap-2.5 cursor-pointer p-3 rounded-xl border border-purple-500/30 bg-background">
                    <input
                      type="checkbox"
                      checked={schoolIsOwner}
                      onChange={(e) => setSchoolIsOwner(e.target.checked)}
                      className="mt-0.5 w-4 h-4 accent-purple-600 rounded shrink-0"
                    />
                    <span className="text-xs leading-relaxed text-foreground">
                      <strong className="block">
                        {locale === 'mr'
                          ? 'मी प्राचार्य / संस्था चालक / अधिकृत प्रतिनिधी आहे'
                          : 'I am Principal / Owner / Authorized Coordinator'}
                      </strong>
                      <span className="text-muted-foreground">
                        {locale === 'mr'
                          ? 'मंजुरीनंतर मला नोटीस बोर्ड व प्रवेश स्थिती अद्यतनित करण्यासाठी पोर्टल प्रवेश द्या.'
                          : 'Grant me School Owner Portal access on approval to post notices & manage admissions.'}
                      </span>
                    </span>
                  </label>
                </div>
              )}

              {/* Regular Category (Shop only) */}
              {entityType === 'shop' && (
                <Field label={t('request.field.categoryOptional')}>
                  {categories.length > 0 ? (
                    <select value={form.category_text} onChange={(e) => set('category_text', e.target.value)} className={inputCls + ' cursor-pointer'}>
                      <option value="">{t('request.categoryPlaceholder')}</option>
                      {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                  ) : (
                    <input value={form.category_text} onChange={(e) => set('category_text', e.target.value)}
                      className={inputCls} placeholder={t('request.placeholder.category')} maxLength={80} />
                  )}
                </Field>
              )}

              {/* Timings */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <TimePickerField label={t('request.field.openingTime')} optional value={form.opening_time} onChange={(v) => { set('opening_time', v); clearErr('closing_time'); }} />
                <TimePickerField label={t('request.field.closingTime')} optional value={form.closing_time} onChange={(v) => { set('closing_time', v); clearErr('closing_time'); }} error={errors.closing_time} />
              </div>

              {/* Description */}
              <Field label={t('request.field.descriptionOptional')}>
                <textarea value={form.description} onChange={(e) => set('description', e.target.value)}
                  className={inputCls + ' min-h-[72px] resize-y'} placeholder={t('request.placeholder.description')} maxLength={500} />
              </Field>

              {/* Keywords */}
              <Field label={t('request.field.keywordsOptional')}>
                <input value={form.keywords} onChange={(e) => set('keywords', e.target.value)}
                  className={inputCls} placeholder={t('request.placeholder.keywords')} maxLength={200} />
                <p className="text-[11px] text-muted-foreground mt-1">{t('request.field.keywordsHint')}</p>
              </Field>

              {/* Amenities */}
              <Field label={t('request.field.amenitiesOptional')}>
                <AmenitiesPicker
                  value={amenities}
                  onChange={setAmenities}
                />
              </Field>

              {/* Multi-Photo Picker (Slot 1 Cover + Slots 2-5 Gallery) */}
              <div className="pt-2">
                <MultiImageCropPicker
                  photos={photos}
                  onChange={setPhotos}
                  maxPhotos={5}
                  label={locale === 'mr' ? 'फोटो (कमाल ५ - स्लॉट १ हा मुख्य कव्हर फोटो असेल)' : 'Photos (Up to 5 - Slot 1 is Primary Cover)'}
                />
              </div>

              {!user && (
                <Field label={t('request.submitterNameLabel')}>
                  <input value={form.submitter_name} onChange={(e) => set('submitter_name', e.target.value)}
                    className={inputCls} placeholder={t('request.followUpPlaceholder')} maxLength={80} />
                </Field>
              )}

              {/* Marathi collapsible */}
              {locale === 'mr' && (
                <div className="border border-border rounded-xl">
                  <button type="button" onClick={() => setShowMr((v) => !v)}
                    className="w-full flex items-center justify-between px-4 py-3 text-sm font-bold text-foreground hover:bg-muted/40 transition-colors rounded-xl">
                    <span className="flex items-center gap-2">{t('request.mrCollapsible')}</span>
                    <span className={cn('text-xs text-muted-foreground font-normal transition-transform', showMr && 'rotate-180')}>▼</span>
                  </button>
                  {showMr && (
                    <div className="px-4 pb-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[11px] text-muted-foreground leading-snug flex-1">{t('request.mrHint')}</p>
                        <TranslateAllButton
                          pairs={[
                            { source: form.name, value: mr.name, onChange: (v) => setMr((m) => ({ ...m, name: v })) },
                            { source: form.area, value: mr.area, onChange: (v) => setMr((m) => ({ ...m, area: v })) },
                            { source: form.sub_area, value: mr.sub_area, onChange: (v) => setMr((m) => ({ ...m, sub_area: v })) },
                            { source: form.address, value: mr.address, onChange: (v) => setMr((m) => ({ ...m, address: v })) },
                            { source: form.description, value: mr.description, onChange: (v) => setMr((m) => ({ ...m, description: v })) },
                            { source: form.keywords, value: mr.keywords, onChange: (v) => setMr((m) => ({ ...m, keywords: v })) },
                          ]}
                        />
                      </div>
                      <MarathiMirrorField label="नाव (मराठी)" value={mr.name} onChange={(v) => setMr((m) => ({ ...m, name: v }))} maxLength={120} />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <MarathiMirrorField label="परिसर (Area)" value={mr.area} onChange={(v) => setMr((m) => ({ ...m, area: v }))} maxLength={80} />
                        <MarathiMirrorField label="उप-परिसर" value={mr.sub_area} onChange={(v) => setMr((m) => ({ ...m, sub_area: v }))} maxLength={80} />
                      </div>
                      <MarathiMirrorField label="पत्ता (Address)" value={mr.address} onChange={(v) => setMr((m) => ({ ...m, address: v }))} maxLength={200} />
                      <MarathiMirrorField label="वर्णन (Description)" value={mr.description} onChange={(v) => setMr((m) => ({ ...m, description: v }))} textarea rows={3} maxLength={500} />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── STEP 5: Review & Submit ──────────────────────────── */}
          {step === 5 && (
            <div className="space-y-3">
              {/* Photos Gallery Preview */}
              {photos.length > 0 && (
                <div className="rounded-xl border border-border p-3 bg-muted/20 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-foreground">
                    <span className="flex items-center gap-1.5"><ImageIcon className="w-3.5 h-3.5 text-primary" /> Photos ({photos.length})</span>
                    <button type="button" onClick={() => setStep(4)} className="text-primary text-[11px] hover:underline">Edit</button>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {photos.map((url, i) => (
                      <div key={i} className="relative aspect-video rounded-lg overflow-hidden border border-border bg-muted group">
                        <img src={url} alt={`Photo ${i+1}`} className="w-full h-full object-cover" />
                        {i === 0 && (
                          <span className="absolute bottom-0 inset-x-0 bg-primary/90 text-primary-foreground text-[8px] font-bold text-center py-0.5">
                            COVER
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Entity & Identity Review */}
              <ReviewCard title={t('request.wizard.reviewSection.basics')} icon={<Phone className="w-3.5 h-3.5" />} onEdit={() => setStep(2)} editLabel={t('request.wizard.reviewEdit')}>
                <ReviewRow label="Category" value={entityType.toUpperCase()} empty="SHOP" />
                <ReviewRow label={t('request.field.name')} value={form.name} empty={t('request.wizard.reviewEmpty')} />
                <ReviewRow label={t('request.field.phone')} value={form.phone} empty={t('request.wizard.reviewEmpty')} />
                <ReviewRow label={t('request.field.whatsapp')} value={form.whatsapp} empty={t('request.wizard.reviewEmpty')} />
              </ReviewCard>

              {/* Location Review */}
              <ReviewCard title={t('request.wizard.reviewSection.location')} icon={<MapPin className="w-3.5 h-3.5" />} onEdit={() => setStep(3)} editLabel={t('request.wizard.reviewEdit')}>
                <ReviewRow label={t('request.field.address')} value={form.address} empty={t('request.wizard.reviewEmpty')} />
                <ReviewRow label={t('request.field.area')} value={form.area} empty={t('request.wizard.reviewEmpty')} />
                <ReviewRow label="GPS" value={hasCoords ? `${form.latitude}, ${form.longitude}` : ''} empty={t('request.wizard.reviewEmpty')} mono />
              </ReviewCard>

              {/* Details & Specialized Review */}
              <ReviewCard title={t('request.wizard.reviewSection.details')} icon={<Tag className="w-3.5 h-3.5" />} onEdit={() => setStep(4)} editLabel={t('request.wizard.reviewEdit')}>
                {entityType === 'mess' && (
                  <>
                    <ReviewRow label="Mess Type" value={messType === 'pure_veg' ? 'Pure Veg' : messType === 'veg_nonveg' ? 'Veg & Non-Veg' : 'Jain Available'} empty="—" />
                    <ReviewRow label="Monthly Pass" value={monthlyRate ? `₹${monthlyRate}/mo` : ''} empty={t('request.wizard.reviewEmpty')} />
                    <ReviewRow label="Single Thali" value={singleThaliRate ? `₹${singleThaliRate}` : ''} empty={t('request.wizard.reviewEmpty')} />
                    <ReviewRow label="Tiffin Delivery" value={tiffinDelivery ? 'Yes' : 'No'} empty="No" />
                  </>
                )}
                {entityType === 'pg' && (
                  <>
                    <ReviewRow label="For Whom" value={pgGender === 'boys' ? 'Boys' : pgGender === 'girls' ? 'Girls' : 'Both'} empty="—" />
                    <ReviewRow label="Available Beds" value={availableBeds ? `${availableBeds} beds` : ''} empty="0" />
                    <ReviewRow label="Sharing Rates" value={[rateSingle && `1: ₹${rateSingle}`, rateDouble && `2: ₹${rateDouble}`, rateTriple && `3: ₹${rateTriple}`].filter(Boolean).join(', ')} empty="—" />
                    <ReviewRow label="Food Included" value={foodIncluded ? 'Yes' : 'No'} empty="No" />
                  </>
                )}
                {entityType === 'school' && (
                  <>
                    <ReviewRow label="Institute Level" value={SCHOOL_TYPE_CONFIG[schoolType]?.labelEn || schoolType} empty="—" />
                    <ReviewRow label="Medium" value={schoolMedium} empty="—" />
                    <ReviewRow label="Board / Univ" value={schoolBoard} empty="—" />
                    <ReviewRow
                      label="Management"
                      value={schoolManagement ? MANAGEMENT_TYPE_CONFIG[schoolManagement]?.labelEn : ''}
                      empty={t('request.wizard.reviewEmpty')}
                    />
                    <ReviewRow
                      label="Admissions"
                      value={ADMISSION_STATUS_CONFIG[schoolAdmissionStatus]?.labelEn || schoolAdmissionStatus}
                      empty="—"
                    />
                    {schoolStreams.trim() && <ReviewRow label="Streams" value={schoolStreams} empty="—" />}
                    {schoolIsOwner && <ReviewRow label="Portal Access" value="Requested as Principal / Owner" empty="—" />}
                  </>
                )}
                <ReviewRow label={t('request.field.openingTime')} value={form.opening_time ? formatTime(form.opening_time) : ''} empty={t('request.wizard.reviewEmpty')} />
                <ReviewRow label={t('request.field.closingTime')} value={form.closing_time ? formatTime(form.closing_time) : ''} empty={t('request.wizard.reviewEmpty')} />
                <ReviewRow label={t('request.field.amenities')} value={amenities.join(', ')} empty={t('request.wizard.reviewEmpty')} />
              </ReviewCard>

              {/* Truth confirmation */}
              <div className={cn('rounded-xl border p-4 space-y-2 transition-colors',
                errors.truth ? 'border-destructive bg-destructive/5' : 'border-border bg-muted/30')}>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={truthConfirmed}
                    onChange={(e) => { setTruthConfirmed(e.target.checked); clearErr('truth'); }}
                    className="mt-0.5 w-4 h-4 accent-primary shrink-0" />
                  <span className="text-sm font-medium text-foreground leading-snug">
                    {t('request.truthConfirm')}
                  </span>
                </label>
                <div className="flex items-start gap-2 ml-7 text-[11px] leading-relaxed text-muted-foreground">
                  <ShieldCheck className="w-3 h-3 shrink-0 mt-0.5" />
                  <span>{t('request.truthWarning')}</span>
                </div>
                {errors.truth && <p className="ml-7 text-xs text-destructive font-semibold">{errors.truth}</p>}
              </div>
            </div>
          )}
        </div>

        {/* Sticky footer */}
        <div
          className="px-4 sm:px-6 pt-3.5 pb-3.5 border-t border-border bg-card sm:rounded-b-2xl flex items-center gap-2.5"
          style={{ paddingBottom: 'max(0.875rem, env(safe-area-inset-bottom, 0px))' }}
        >
          {step > 1 ? (
            <button type="button" onClick={goBack}
              className="flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-muted transition-colors">
              <ArrowLeft className="w-4 h-4" /> {t('request.wizard.back')}
            </button>
          ) : (
            <button type="button" onClick={onClose}
              className="px-4 py-3 rounded-xl text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              {t('request.cancel')}
            </button>
          )}
          {step < TOTAL_STEPS ? (
            <button type="button" onClick={goNext}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all">
              {step === TOTAL_STEPS - 1 ? t('request.wizard.review') : t('request.wizard.next')}
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button type="button" onClick={(e) => handleSubmit(e as unknown as React.FormEvent)} disabled={saving || uploading}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all disabled:opacity-60">
              {saving || uploading
                ? <><Loader2 className="w-4 h-4 animate-spin" />{uploading ? t('request.uploading') : t('request.submitting')}</>
                : <><Send className="w-4 h-4" /> {t('request.submitButton')}</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );

  function clearErr(key: string) { setErrors((e) => ({ ...e, [key]: '' })); }
}

function Err({ msg }: { msg: string }) {
  return <p className="text-xs text-destructive mt-1">{msg}</p>;
}

function ReviewCard({
  title, icon, onEdit, editLabel, children,
}: { title: string; icon: React.ReactNode; onEdit: () => void; editLabel: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/60 bg-background/40">
        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-foreground">
          <span className="text-primary">{icon}</span>
          {title}
        </div>
        <button type="button" onClick={onEdit}
          className="text-[11px] font-semibold text-primary hover:underline">
          {editLabel}
        </button>
      </div>
      <div className="px-4 py-2.5 space-y-1.5">{children}</div>
    </div>
  );
}

function ReviewRow({
  label, value, empty, mono, multiline,
}: { label: string; value?: string; empty: string; mono?: boolean; multiline?: boolean }) {
  const hasValue = !!value?.trim();
  return (
    <div className={`flex ${multiline ? 'flex-col gap-0.5' : 'items-baseline justify-between gap-3'} text-[12.5px]`}>
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className={`${hasValue ? 'text-foreground font-medium' : 'text-muted-foreground italic opacity-60'} ${mono ? 'font-mono text-[11.5px]' : ''} ${multiline ? '' : 'text-right truncate max-w-[60%]'}`}>
        {hasValue ? value : empty}
      </span>
    </div>
  );
}
