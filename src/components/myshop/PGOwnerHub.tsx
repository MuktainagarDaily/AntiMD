import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BedDouble,
  Users,
  Settings,
  Eye,
  Clock,
  Sparkles,
  ExternalLink,
  Share2,
  Check,
  CheckCircle2,
  MapPin,
  Phone,
  Power,
  Plus,
  Minus,
  Trash2,
  Save,
  Loader2,
  Wifi,
  Flame,
  Droplets,
  Utensils,
  Zap,
  Shield,
  BookOpen,
  DoorOpen,
  List,
  Layers,
  MessageCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useT } from '@/i18n';
import { useCity } from '@/hooks/useCity';
import { supabase } from '@/integrations/supabase/client';
import { updateShopWithConcurrency } from '@/lib/shopConcurrency';
import {
  savePGProfile,
  calculatePGBedsFromRooms,
  formatPGWhatsAppBroadcast,
} from '@/lib/living/livingService';
import type { PGProfile, PGGender, PGSharingRates, PGRoomItem } from '@/lib/living/livingTypes';
import { ClaimedBadge } from '@/components/shared/ClaimedBadge';
import { MultiImageCropPicker } from '@/components/shared/MultiImageCropPicker';
import { uploadShopImage } from '@/lib/storageNaming';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

interface PGOwnerHubProps {
  shop: any;
  onSaved?: () => void;
}

type PGTab = 'vacancies' | 'rules' | 'amenities_photos' | 'preview';

const PG_AMENITIES_OPTIONS = [
  { name: 'WiFi', label_mr: 'हाय-स्पीड वायफाय', icon: Wifi },
  { name: 'Geyser', label_mr: 'गरम पाण्यासाठी गिझर', icon: Flame },
  { name: 'RO Water', label_mr: 'RO पिण्याचे शुद्ध पाणी', icon: Droplets },
  { name: 'Food / Mess', label_mr: 'जेवण / मेस सुविधा', icon: Utensils },
  { name: 'Inverter', label_mr: 'पॉवर बॅकअप / इन्व्हर्टर', icon: Zap },
  { name: 'CCTV Security', label_mr: 'सीसीटीव्ही सुरक्षा', icon: Shield },
  { name: 'Study Desk', label_mr: 'अभ्यासासाठी टेबल व खुर्ची', icon: BookOpen },
  { name: 'Attached Washroom', label_mr: 'अटॅच टॉयलेट / बाथ', icon: DoorOpen },
  { name: 'Housekeeping', label_mr: 'दररोज रूम स्वच्छता', icon: Check },
  { name: '2-Wheeler Parking', label_mr: '२-चाकी सुरक्षित पार्किंग', icon: Check },
  { name: 'Washing Machine', label_mr: 'वॉशिंग मशीन / लाँड्री', icon: Check },
  { name: 'Almirah / Cupboard', label_mr: 'स्वतंत्र कपाट / लॉकर', icon: Check },
];

export function PGOwnerHub({ shop, onSaved }: PGOwnerHubProps) {
  const { locale } = useT();
  const { currentCity } = useCity();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<PGTab>('vacancies');

  // Mode for vacancy tracking: Simple vs Advance (Room-by-Room)
  const [vacancyMode, setVacancyMode] = useState<'simple' | 'advance'>('simple');

  // Fetch PG Profile
  const { data: remoteProfile, isLoading: profileLoading } = useQuery<PGProfile | null>({
    queryKey: ['pg-profile-manage', shop.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pg_profiles')
        .select('*')
        .eq('shop_id', shop.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.warn('Error fetching PG profile:', error);
      }
      return data as PGProfile | null;
    },
  });

  // State
  const [availableBeds, setAvailableBeds] = useState<number>(0);
  const [totalBeds, setTotalBeds] = useState<number>(10);
  const [gender, setGender] = useState<PGGender>('boys');
  const [occupancyTarget, setOccupancyTarget] = useState<'students' | 'professionals' | 'any'>('any');
  const [gateClosingTime, setGateClosingTime] = useState('10:00 PM');
  const [foodIncluded, setFoodIncluded] = useState(false);
  const [depositAmount, setDepositAmount] = useState<number>(2000);
  const [noticePeriodDays, setNoticePeriodDays] = useState<number>(30);
  const [rate1, setRate1] = useState<string>('');
  const [rate2, setRate2] = useState<string>('');
  const [rate3, setRate3] = useState<string>('');
  const [rate4, setRate4] = useState<string>('');
  const [amenities, setAmenities] = useState<string[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [rooms, setRooms] = useState<PGRoomItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Sync profile data when loaded
  useEffect(() => {
    const p = remoteProfile || shop.pg_profile || shop.pg_profiles?.[0];
    if (p) {
      setAvailableBeds(p.available_beds ?? 0);
      setTotalBeds(p.total_beds ?? 10);
      setGender(p.gender || 'boys');
      setOccupancyTarget(p.occupancy_target || 'any');
      setGateClosingTime(p.gate_closing_time || '10:00 PM');
      setFoodIncluded(Boolean(p.food_included));
      setDepositAmount(p.deposit_amount ?? 2000);
      setNoticePeriodDays(p.notice_period_days ?? 30);
      if (Array.isArray(p.amenities)) setAmenities(p.amenities);

      const rates = p.sharing_rates || {};
      setRate1(rates['1_sharing'] != null ? String(rates['1_sharing']) : '');
      setRate2(rates['2_sharing'] != null ? String(rates['2_sharing']) : '');
      setRate3(rates['3_sharing'] != null ? String(rates['3_sharing']) : '');
      setRate4(rates['4_sharing'] != null ? String(rates['4_sharing']) : '');

      if (Array.isArray(rates.rooms) && rates.rooms.length > 0) {
        setRooms(rates.rooms);
        setVacancyMode('advance');
      } else if (Array.isArray(p.rooms) && p.rooms.length > 0) {
        setRooms(p.rooms);
        setVacancyMode('advance');
      }
    }

    if (Array.isArray(shop.photos) && shop.photos.length > 0) {
      setPhotos(shop.photos);
    } else if (shop.image_url) {
      setPhotos([shop.image_url]);
    }
  }, [remoteProfile, shop]);

  // Open/Close toggle
  const [isOpen, setIsOpen] = useState<boolean>(shop.is_open ?? true);
  const [togglingOpen, setTogglingOpen] = useState(false);

  const handleToggleOpen = async () => {
    if (togglingOpen) return;
    try {
      setTogglingOpen(true);
      const next = !isOpen;
      setIsOpen(next);
      const res = await updateShopWithConcurrency(shop.id, shop.updated_at, { is_open: next });
      if (!res.ok) {
        setIsOpen(!next);
        toast.error('Failed to toggle open status');
      } else {
        toast.success(
          next
            ? locale === 'mr' ? 'पीजी प्रवेश सुरू (Open) म्हणून चिन्हांकित केले!' : 'PG marked OPEN for admissions!'
            : locale === 'mr' ? 'पीजी बंद (Closed) म्हणून चिन्हांकित केले!' : 'PG marked CLOSED!'
        );
      }
    } finally {
      setTogglingOpen(false);
    }
  };

  // Quick 1-tap vacancy buttons
  const handleMarkFull = () => {
    setAvailableBeds(0);
    toast.info(locale === 'mr' ? 'सर्व जागा भरल्या म्हणून चिन्हांकित केले!' : 'Marked FULL (0 available beds)!');
  };

  const handleMarkOpen = (count = 2) => {
    setAvailableBeds((b) => (b > 0 ? b : count));
    toast.success(locale === 'mr' ? 'जागा उपलब्ध म्हणून चिन्हांकित केले!' : `Marked OPEN (${count} beds vacant)!`);
  };

  // Room by room helpers
  const handleAddRoom = () => {
    const nextNum = rooms.length + 1;
    const newRoom: PGRoomItem = {
      id: `room-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      room_number: `Room ${nextNum}`,
      total_beds: 2,
      available_beds: 1,
      sharing_type: '2_sharing',
    };
    const updated = [...rooms, newRoom];
    setRooms(updated);
    const { totalBeds: sumTotal, availableBeds: sumAvail } = calculatePGBedsFromRooms(updated);
    setTotalBeds(sumTotal);
    setAvailableBeds(sumAvail);
  };

  const handleUpdateRoom = (id: string, field: keyof PGRoomItem, val: any) => {
    const updated = rooms.map((r) => (r.id === id ? { ...r, [field]: val } : r));
    setRooms(updated);
    if (field === 'total_beds' || field === 'available_beds') {
      const { totalBeds: sumTotal, availableBeds: sumAvail } = calculatePGBedsFromRooms(updated);
      setTotalBeds(sumTotal);
      setAvailableBeds(sumAvail);
    }
  };

  const handleDeleteRoom = (id: string) => {
    const updated = rooms.filter((r) => r.id !== id);
    setRooms(updated);
    const { totalBeds: sumTotal, availableBeds: sumAvail } = calculatePGBedsFromRooms(updated);
    setTotalBeds(sumTotal);
    setAvailableBeds(sumAvail);
  };

  const toggleAmenity = (name: string) => {
    setAmenities((prev) =>
      prev.includes(name) ? prev.filter((a) => a !== name) : [...prev, name]
    );
  };

  const handleUploadPhoto = async (blob: Blob): Promise<string> => {
    setUploading(true);
    try {
      const { publicUrl } = await uploadShopImage(blob, shop.name || 'pg');
      return publicUrl;
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const parsedRates: PGSharingRates = {
        '1_sharing': rate1 ? Number(rate1) : null,
        '2_sharing': rate2 ? Number(rate2) : null,
        '3_sharing': rate3 ? Number(rate3) : null,
        '4_sharing': rate4 ? Number(rate4) : null,
        rooms: vacancyMode === 'advance' ? rooms : [],
      };

      // 1. Update basic shop table (photos, amenities)
      await updateShopWithConcurrency(shop.id, shop.updated_at, {
        amenities: amenities,
        photos: photos,
        image_url: photos[0] || shop.image_url || null,
      });

      // 2. Save PG profile table
      const { error } = await savePGProfile({
        shop_id: shop.id,
        available_beds: Math.max(0, availableBeds),
        total_beds: Math.max(0, totalBeds),
        gender,
        occupancy_target: occupancyTarget,
        gate_closing_time: gateClosingTime.trim() || '10:00 PM',
        food_included: foodIncluded,
        deposit_amount: Number(depositAmount) || 0,
        notice_period_days: Number(noticePeriodDays) || 30,
        amenities,
        sharing_rates: parsedRates,
      });

      if (error) throw error;

      toast.success(
        locale === 'mr'
          ? 'पीजी माहिती, दर आणि रिक्त जागा यशस्वीरित्या जतन झाल्या! ✓'
          : 'PG details, room rates, and vacancies saved successfully! ✓'
      );
      qc.invalidateQueries({ queryKey: ['pg-profile-manage', shop.id] });
      qc.invalidateQueries({ queryKey: ['living-pgs'] });
      qc.invalidateQueries({ queryKey: ['my-shops'] });
      onSaved?.();
    } catch (err: any) {
      console.error('[PGOwnerHub] Error saving:', err);
      toast.error(err?.message || 'Failed to save PG details');
    } finally {
      setSaving(false);
    }
  };

  const copyPublicLink = () => {
    const slug = shop.slug || shop.id;
    const url = `${window.location.origin}/${currentCity.slug}/pg/${slug}`;
    navigator.clipboard.writeText(url).then(
      () => toast.success(locale === 'mr' ? 'पीजी लिंक कॉपी झाली!' : 'PG link copied!'),
      () => toast.error('Failed to copy link')
    );
  };

  const handleShareWhatsApp = () => {
    const fullMsg = formatPGWhatsAppBroadcast({
      shopName: shop.name,
      shopNameMr: shop.name_mr,
      area: shop.area,
      address: shop.address,
      gender,
      availableBeds,
      rates: { rate1, rate2, rate3, rate4 },
      depositAmount,
      foodIncluded,
      gateClosingTime,
      amenities,
      phone: shop.phone,
      whatsapp: shop.whatsapp,
      baseUrl: window.location.origin,
      isMr: locale === 'mr',
    });
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(fullMsg)}`;
    window.open(waUrl, '_blank');
  };

  const displayName = locale === 'mr' && shop.name_mr ? shop.name_mr : shop.name;

  return (
    <div className="space-y-4">
      {/* ─── Hero Summary Header ─── */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-blue-500/10 via-card to-card p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Avatar & Title */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden bg-muted shrink-0 border border-border/80 shadow-xs">
              {photos[0] || shop.image_url ? (
                <img
                  src={photos[0] || shop.image_url}
                  alt={displayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-blue-500/10 text-blue-600">
                  <BedDouble className="w-7 h-7" />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-bold text-foreground truncate">
                  {displayName}
                </h1>
                {shop.is_claimed && <ClaimedBadge size="sm" />}
              </div>

              {shop.area && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
                  <MapPin className="w-3 h-3 text-muted-foreground/70 shrink-0" />
                  <span>{shop.area}</span>
                </p>
              )}

              {/* Status Pills */}
              <div className="flex items-center gap-2 mt-2 flex-wrap text-[11px]">
                {/* Live Vacancy Status */}
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-bold border',
                    availableBeds > 0
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                      : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
                  )}
                >
                  <span
                    className={cn(
                      'w-1.5 h-1.5 rounded-full',
                      availableBeds > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                    )}
                  />
                  <span>
                    {availableBeds > 0
                      ? locale === 'mr' ? `${availableBeds} जागा रिक्त आहेत` : `${availableBeds} Beds Vacant`
                      : locale === 'mr' ? 'सर्व जागा भरल्या (Full)' : 'Full (No Vacancy)'}
                  </span>
                </span>

                {/* Gender Tag */}
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border bg-muted/60 border-border font-semibold text-muted-foreground">
                  {gender === 'girls' ? '👧 Girls Only' : gender === 'boys' ? '👦 Boys Only' : '👫 Co-ed'}
                </span>

                {/* Open / Closed status */}
                <button
                  type="button"
                  onClick={handleToggleOpen}
                  disabled={togglingOpen}
                  className={cn(
                    'inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-full border transition-all text-[11px]',
                    isOpen
                      ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-600 border-rose-500/30 hover:bg-rose-500/20'
                  )}
                  title="क्लिक करून सुरू किंवा बंद करा"
                >
                  <Power className="w-3 h-3" />
                  <span>{isOpen ? (locale === 'mr' ? 'प्रवेश चालू' : 'Admissions Open') : (locale === 'mr' ? 'बंद' : 'Closed')}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center justify-end gap-2 self-stretch sm:self-auto shrink-0">
            <Link
              to={`/${currentCity.slug}/pg`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-border bg-background hover:bg-muted text-foreground transition-all shadow-2xs"
            >
              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
              <span>{locale === 'mr' ? 'पीजी पान पहा' : 'View on PG'}</span>
            </Link>

            <button
              type="button"
              onClick={copyPublicLink}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-border bg-background hover:bg-muted text-foreground transition-all shadow-2xs"
            >
              <Share2 className="w-3.5 h-3.5 text-muted-foreground" />
              <span>{locale === 'mr' ? 'लिंक कॉपी' : 'Copy Link'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ─── Tab Navigation Bar ─── */}
      <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-card border border-border overflow-x-auto no-scrollbar shadow-2xs">
        <button
          type="button"
          onClick={() => setActiveTab('vacancies')}
          className={cn(
            'shrink-0 flex-1 min-w-[125px] py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all whitespace-nowrap',
            activeTab === 'vacancies'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
          )}
        >
          <span>🛏️</span>
          <span>{locale === 'mr' ? 'रिक्त जागा व भाडे' : 'Vacancies & Rent'}</span>
          {availableBeds > 0 && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('rules')}
          className={cn(
            'shrink-0 flex-1 min-w-[120px] py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all whitespace-nowrap',
            activeTab === 'rules'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
          )}
        >
          <span>📋</span>
          <span>{locale === 'mr' ? 'पात्रता व नियम' : 'Rules & Policy'}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('amenities_photos')}
          className={cn(
            'shrink-0 flex-1 min-w-[120px] py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all whitespace-nowrap',
            activeTab === 'amenities_photos'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
          )}
        >
          <span>🛋️</span>
          <span>{locale === 'mr' ? 'सुविधा व फोटो' : 'Amenities & Photos'}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('preview')}
          className={cn(
            'shrink-0 flex-1 min-w-[105px] py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all whitespace-nowrap',
            activeTab === 'preview'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
          )}
        >
          <span>👁️</span>
          <span>{locale === 'mr' ? 'ग्राहक दृश्य' : 'Customer View'}</span>
        </button>
      </div>

      {/* ─── Active Tab Content ─── */}
      <div className="pt-1">
        {/* TAB 1: VACANCIES & RENT */}
        {activeTab === 'vacancies' && (
          <div className="bg-card rounded-2xl border border-border p-4 sm:p-5 space-y-5 shadow-xs">
            {/* Header with Save Button */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/70 pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 border border-blue-500/20">
                    <BedDouble className="w-4 h-4" />
                  </span>
                  <span>{locale === 'mr' ? 'चालू रिक्त जागा आणि मासिक भाडे' : 'Live Bed Vacancy & Monthly Rent'}</span>
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {locale === 'mr'
                    ? 'विद्यार्थ्यांना थेट चालू उपलब्ध बेड आणि प्रत्येक रूमचे दर दाखवा.'
                    : 'Keep available bed counts updated to receive student admissions and inquiries.'}
                </p>
              </div>

              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 transition-all shadow-sm shrink-0 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span>{locale === 'mr' ? 'बदल जतन करा' : 'Save Changes'}</span>
              </button>
            </div>

            {/* Mode Selector: Simple vs Advance (Room-by-Room) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-2 rounded-xl bg-muted/30 border border-border">
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-1 bg-card p-1 rounded-lg border border-border shadow-2xs">
                <button
                  type="button"
                  onClick={() => setVacancyMode('simple')}
                  className={cn(
                    'flex-1 sm:flex-initial justify-center px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all',
                    vacancyMode === 'simple'
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <List className="w-3.5 h-3.5 shrink-0" />
                  <span>{locale === 'mr' ? '⚡ सोपी पद्धत (एकूण बेड)' : '⚡ Simple (Total Beds)'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setVacancyMode('advance')}
                  className={cn(
                    'flex-1 sm:flex-initial justify-center px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all',
                    vacancyMode === 'advance'
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Layers className="w-3.5 h-3.5 shrink-0" />
                  <span>{locale === 'mr' ? '🏢 प्रगत पद्धत (खोल्यांनुसार)' : '🏢 Advance (Room-by-Room)'}</span>
                </button>
              </div>

              <span className="text-[11px] text-muted-foreground">
                {vacancyMode === 'simple'
                  ? locale === 'mr' ? 'लहान पीजीसाठी थेट उपलब्ध बेडची संख्या बदला' : 'Quick +/- counter for total available beds'
                  : locale === 'mr' ? 'प्रत्येक खोलीनुसार स्वतंत्र बेड व रिक्त जागा ट्रॅक करा' : 'Track bed occupancy for individual rooms'}
              </span>
            </div>

            {/* Simple Mode: Available Beds Stepper & 1-Tap Toggles */}
            {vacancyMode === 'simple' ? (
              <div className="p-4 rounded-xl bg-muted/40 border border-border/80 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <label className="text-sm font-bold text-foreground block">
                      {locale === 'mr' ? 'सध्या रिक्त असलेले बेड' : 'Currently Available Beds'}
                    </label>
                    <span className="text-xs text-muted-foreground">
                      {locale === 'mr' ? 'विद्यार्थी हे थेट तुमच्या पीजी कार्डवर पाहतील' : 'Displayed prominently on your public card'}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setAvailableBeds((b) => Math.max(0, b - 1))}
                      className="w-10 h-10 rounded-xl bg-card border border-border flex items-center justify-center hover:bg-muted active:scale-95 transition-all text-foreground shadow-xs"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <div className="w-14 text-center">
                      <span className="text-2xl font-black text-foreground">{availableBeds}</span>
                      <span className="block text-[10px] text-muted-foreground font-semibold">/ {totalBeds}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAvailableBeds((b) => Math.min(totalBeds, b + 1))}
                      className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 active:scale-95 transition-all shadow-xs"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* 1-Tap Quick Actions */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/60">
                  <span className="w-full sm:w-auto text-xs font-semibold text-muted-foreground">{locale === 'mr' ? 'एका क्लिकवर बदला:' : '1-Tap Status:'}</span>
                  <button
                    type="button"
                    onClick={handleMarkFull}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 border border-rose-500/30 transition-colors"
                  >
                    🔴 {locale === 'mr' ? 'पूर्ण भरले (No Vacancy)' : 'Mark FULL (0 Beds)'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMarkOpen(2)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border border-emerald-500/30 transition-colors"
                  >
                    🟢 {locale === 'mr' ? 'जागा उपलब्ध (Open)' : 'Mark OPEN (2 Beds)'}
                  </button>
                </div>
              </div>
            ) : (
              /* Advance Mode: Room-by-Room Breakdown */
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-bold text-foreground">
                      {locale === 'mr' ? 'खोलीनिहाय बेड व्यवस्थापन' : 'Individual Rooms List'}
                    </h4>
                    <p className="text-[11px] text-muted-foreground">
                      {locale === 'mr' ? 'येथे प्रत्येक रूम क्रमांक आणि रिक्त बेड जोडा' : 'Add each room with its total capacity and vacancies'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddRoom}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-2xs transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{locale === 'mr' ? '+ खोली जोडा' : '+ Add Room'}</span>
                  </button>
                </div>

                {rooms.length === 0 ? (
                  <div className="p-6 rounded-xl border border-dashed border-border text-center bg-muted/10 space-y-2">
                    <DoorOpen className="w-8 h-8 mx-auto text-muted-foreground/50" />
                    <p className="text-xs font-semibold text-foreground">
                      {locale === 'mr' ? 'कोणतीही खोली जोडलेली नाही' : 'No rooms configured yet'}
                    </p>
                    <button
                      type="button"
                      onClick={handleAddRoom}
                      className="text-xs font-bold text-primary hover:underline"
                    >
                      {locale === 'mr' ? '+ पहिली खोली जोडा (Room 1)' : '+ Add First Room (Room 1)'}
                    </button>
                  </div>
                ) : (
                  <div className="divide-y divide-border rounded-xl border border-border bg-card overflow-hidden">
                    {rooms.map((room, idx) => (
                      <div key={room.id} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3 min-w-0">
                          <span className="text-xs font-mono font-bold text-muted-foreground w-5 shrink-0">{idx + 1}.</span>
                          <input
                            type="text"
                            value={room.room_number}
                            onChange={(e) => handleUpdateRoom(room.id, 'room_number', e.target.value)}
                            placeholder="Room Number"
                            className="px-2.5 py-1 text-xs font-bold rounded-lg border border-input bg-background min-w-0 flex-1 sm:w-32 sm:flex-none focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                          <select
                            value={room.sharing_type || '2_sharing'}
                            onChange={(e) => handleUpdateRoom(room.id, 'sharing_type', e.target.value)}
                            className="px-2 py-1 text-xs rounded-lg border border-input bg-background text-foreground max-w-full min-w-0"
                          >
                            <option value="1_sharing">Single (1)</option>
                            <option value="2_sharing">Double (2)</option>
                            <option value="3_sharing">Triple (3)</option>
                            <option value="4_sharing">4-Sharing</option>
                          </select>
                        </div>

                        <div className="flex items-center gap-3 self-end sm:self-auto">
                          <div className="flex items-center gap-1.5 text-xs">
                            <span className="text-muted-foreground text-[11px]">{locale === 'mr' ? 'रिक्त:' : 'Vacant:'}</span>
                            <button
                              type="button"
                              onClick={() => handleUpdateRoom(room.id, 'available_beds', Math.max(0, room.available_beds - 1))}
                              className="w-6 h-6 rounded bg-muted hover:bg-muted/80 flex items-center justify-center font-bold"
                            >
                              -
                            </button>
                            <span className="font-bold w-5 text-center">{room.available_beds}</span>
                            <button
                              type="button"
                              onClick={() => handleUpdateRoom(room.id, 'available_beds', Math.min(room.total_beds, room.available_beds + 1))}
                              className="w-6 h-6 rounded bg-muted hover:bg-muted/80 flex items-center justify-center font-bold"
                            >
                              +
                            </button>
                            <span className="text-[10px] text-muted-foreground font-semibold">/ {room.total_beds} beds</span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleDeleteRoom(room.id)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Total Beds Capacity Field */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">
                  {locale === 'mr' ? 'एकूण बेड क्षमता (Total Bed Capacity)' : 'Total Bed Capacity'}
                </label>
                <input
                  type="number"
                  min="1"
                  value={totalBeds}
                  onChange={(e) => setTotalBeds(Math.max(1, Number(e.target.value) || 1))}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-input bg-background text-foreground font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-foreground block mb-1">
                  💰 {locale === 'mr' ? 'डिपॉझिट रक्कम (₹)' : 'Security Deposit (₹)'}
                </label>
                <input
                  type="number"
                  min="0"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(Number(e.target.value) || 0)}
                  placeholder="e.g. 2000"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-input bg-background text-foreground font-bold"
                />
              </div>
            </div>

            {/* Sharing Rates Section */}
            <div className="space-y-2 pt-2 border-t border-border/60">
              <label className="text-xs font-bold text-foreground block">
                💵 {locale === 'mr' ? 'खोली शेअरिंगनुसार मासिक भाडे (₹ / महिना)' : 'Room Sharing Rates (₹ / Month per Bed)'}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <div className="p-2.5 rounded-xl border border-border bg-card">
                  <span className="text-[11px] font-semibold text-muted-foreground block mb-1">Single (1-Sharing)</span>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-bold text-muted-foreground text-xs">₹</span>
                    <input
                      type="number"
                      placeholder="उदा. 4500"
                      value={rate1}
                      onChange={(e) => setRate1(e.target.value)}
                      className="w-full pl-6 pr-2 py-1.5 rounded-lg border border-input bg-background text-foreground text-xs font-bold"
                    />
                  </div>
                </div>

                <div className="p-2.5 rounded-xl border border-border bg-card">
                  <span className="text-[11px] font-semibold text-muted-foreground block mb-1">Double (2-Sharing)</span>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-bold text-muted-foreground text-xs">₹</span>
                    <input
                      type="number"
                      placeholder="उदा. 3200"
                      value={rate2}
                      onChange={(e) => setRate2(e.target.value)}
                      className="w-full pl-6 pr-2 py-1.5 rounded-lg border border-input bg-background text-foreground text-xs font-bold"
                    />
                  </div>
                </div>

                <div className="p-2.5 rounded-xl border border-border bg-card">
                  <span className="text-[11px] font-semibold text-muted-foreground block mb-1">Triple (3-Sharing)</span>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-bold text-muted-foreground text-xs">₹</span>
                    <input
                      type="number"
                      placeholder="उदा. 2500"
                      value={rate3}
                      onChange={(e) => setRate3(e.target.value)}
                      className="w-full pl-6 pr-2 py-1.5 rounded-lg border border-input bg-background text-foreground text-xs font-bold"
                    />
                  </div>
                </div>

                <div className="p-2.5 rounded-xl border border-border bg-card">
                  <span className="text-[11px] font-semibold text-muted-foreground block mb-1">4+ Sharing</span>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-bold text-muted-foreground text-xs">₹</span>
                    <input
                      type="number"
                      placeholder="उदा. 2000"
                      value={rate4}
                      onChange={(e) => setRate4(e.target.value)}
                      className="w-full pl-6 pr-2 py-1.5 rounded-lg border border-input bg-background text-foreground text-xs font-bold"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* WhatsApp Share CTA */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border/60">
              <button
                type="button"
                onClick={handleShareWhatsApp}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95 transition-all shadow-xs"
              >
                <MessageCircle className="w-4 h-4" />
                <span>{locale === 'mr' ? 'WhatsApp वर रिक्त जागा शेअर करा' : 'Broadcast Vacancies on WhatsApp'}</span>
              </button>

              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 transition-all shadow-sm disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span>{locale === 'mr' ? 'सर्व बदल जतन करा' : 'Save Changes'}</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: RULES & POLICY */}
        {activeTab === 'rules' && (
          <div className="bg-card rounded-2xl border border-border p-4 sm:p-5 space-y-5 shadow-xs">
            <div className="border-b border-border/70 pb-3">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 border border-blue-500/20">
                  <Users className="w-4 h-4" />
                </span>
                <span>{locale === 'mr' ? 'पात्रता आणि हॉस्टेल नियम' : 'Eligibility & House Rules'}</span>
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {locale === 'mr'
                  ? 'विद्यार्थी व नोकरदारांसाठी प्रवेश नियम आणि गेट बंद होण्याची वेळ निश्चित करा.'
                  : 'Define tenant eligibility, curfews, and food policy.'}
              </p>
            </div>

            {/* Gender Category */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground block">
                {locale === 'mr' ? 'हॉस्टेल प्रकार (Gender Eligibility)' : 'Gender Category'}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setGender('boys')}
                  className={cn(
                    'p-3 rounded-xl border text-center transition-all font-bold flex flex-col items-center gap-1',
                    gender === 'boys'
                      ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/40 shadow-xs'
                      : 'bg-card border-border text-muted-foreground hover:bg-muted'
                  )}
                >
                  <span className="text-lg">👦</span>
                  <span>{locale === 'mr' ? 'फक्त मुले (Boys)' : 'Boys Only'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setGender('girls')}
                  className={cn(
                    'p-3 rounded-xl border text-center transition-all font-bold flex flex-col items-center gap-1',
                    gender === 'girls'
                      ? 'bg-pink-500/15 text-pink-700 dark:text-pink-300 border-pink-500/40 shadow-xs'
                      : 'bg-card border-border text-muted-foreground hover:bg-muted'
                  )}
                >
                  <span className="text-lg">👧</span>
                  <span>{locale === 'mr' ? 'फक्त मुली (Girls)' : 'Girls Only'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setGender('both')}
                  className={cn(
                    'p-3 rounded-xl border text-center transition-all font-bold flex flex-col items-center gap-1',
                    gender === 'both'
                      ? 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/40 shadow-xs'
                      : 'bg-card border-border text-muted-foreground hover:bg-muted'
                  )}
                >
                  <span className="text-lg">👫</span>
                  <span>{locale === 'mr' ? 'दोन्ही (Co-ed)' : 'Both / Co-ed'}</span>
                </button>
              </div>
            </div>

            {/* Resident Target */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground block">
                {locale === 'mr' ? 'प्राधान्य (Target Residents)' : 'Preferred Occupants'}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setOccupancyTarget('students')}
                  className={cn(
                    'p-2.5 rounded-xl border text-center transition-all font-semibold',
                    occupancyTarget === 'students'
                      ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                      : 'bg-card border-border text-muted-foreground hover:bg-muted'
                  )}
                >
                  🎓 {locale === 'mr' ? 'फक्त विद्यार्थी' : 'Students Only'}
                </button>
                <button
                  type="button"
                  onClick={() => setOccupancyTarget('professionals')}
                  className={cn(
                    'p-2.5 rounded-xl border text-center transition-all font-semibold',
                    occupancyTarget === 'professionals'
                      ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                      : 'bg-card border-border text-muted-foreground hover:bg-muted'
                  )}
                >
                  💼 {locale === 'mr' ? 'फक्त नोकरदार' : 'Professionals'}
                </button>
                <button
                  type="button"
                  onClick={() => setOccupancyTarget('any')}
                  className={cn(
                    'p-2.5 rounded-xl border text-center transition-all font-semibold',
                    occupancyTarget === 'any'
                      ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                      : 'bg-card border-border text-muted-foreground hover:bg-muted'
                  )}
                >
                  🤝 {locale === 'mr' ? 'दोन्ही चालतील' : 'Any / Both'}
                </button>
              </div>
            </div>

            {/* Gate Timing & Notice Period */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">
                  🕒 {locale === 'mr' ? 'गेट बंद होण्याची वेळ (Curfew Time)' : 'Gate Closing Time'}
                </label>
                <input
                  type="text"
                  value={gateClosingTime}
                  onChange={(e) => setGateClosingTime(e.target.value)}
                  placeholder="e.g. 10:00 PM or No Curfew"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-input bg-background text-foreground font-semibold"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-foreground block mb-1">
                  📅 {locale === 'mr' ? 'खोली सोडण्यापूर्वी पूर्वसूचना (Notice Period)' : 'Notice Period (Days)'}
                </label>
                <input
                  type="number"
                  value={noticePeriodDays}
                  onChange={(e) => setNoticePeriodDays(Number(e.target.value) || 30)}
                  placeholder="e.g. 30 days"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-input bg-background text-foreground font-semibold"
                />
              </div>
            </div>

            {/* Food Included Toggle */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-muted/40 border border-border">
              <div className="text-xs min-w-0 flex-1">
                <p className="font-bold text-foreground flex items-center gap-1.5">
                  <Utensils className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{locale === 'mr' ? 'जेवण / मेस भाड्यात समाविष्ट आहे का?' : 'Food / Mess Included in Rent?'}</span>
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {locale === 'mr' ? 'नाश्ता किंवा २ वेळचे जेवण खोली भाड्यात असल्यास होय निवडा' : 'Turn on if morning breakfast or meals are included in the monthly fee'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFoodIncluded(!foodIncluded)}
                className={cn(
                  'shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shadow-2xs',
                  foodIncluded
                    ? 'bg-emerald-600 text-white'
                    : 'bg-muted text-muted-foreground border border-border'
                )}
              >
                {foodIncluded ? (locale === 'mr' ? 'होय (Included)' : 'Included') : (locale === 'mr' ? 'नाही (Separate)' : 'Separate')}
              </button>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 transition-all shadow-sm disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span>{locale === 'mr' ? 'नियम जतन करा' : 'Save Rules'}</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: AMENITIES & PHOTOS */}
        {activeTab === 'amenities_photos' && (
          <div className="bg-card rounded-2xl border border-border p-4 sm:p-5 space-y-5 shadow-xs">
            <div className="border-b border-border/70 pb-3">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 border border-blue-500/20">
                  <Wifi className="w-4 h-4" />
                </span>
                <span>{locale === 'mr' ? 'सुविधा आणि खोल्यांचे फोटो' : 'Hostel Amenities & Photos'}</span>
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {locale === 'mr'
                  ? 'तुमच्या वसतिगृहात उपलब्ध असलेल्या सुविधा निवडा आणि खोल्यांचे आकर्षक फोटो जोडा.'
                  : 'Select included hostel amenities and upload photos of rooms and facilities.'}
              </p>
            </div>

            {/* Amenities Grid */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-foreground block">
                {locale === 'mr' ? 'उपलब्ध सुविधा (Amenities Checklist)' : 'Included Amenities'}
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                {PG_AMENITIES_OPTIONS.map((am) => {
                  const Icon = am.icon;
                  const isChecked = amenities.includes(am.name);
                  return (
                    <button
                      key={am.name}
                      type="button"
                      onClick={() => toggleAmenity(am.name)}
                      className={cn(
                        'p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all',
                        isChecked
                          ? 'bg-primary/10 border-primary/30 text-primary font-bold shadow-2xs'
                          : 'bg-card border-border text-muted-foreground hover:bg-muted'
                      )}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{locale === 'mr' ? am.label_mr : am.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Photos Uploader */}
            <div className="space-y-2 pt-2 border-t border-border/60">
              <label className="text-xs font-bold text-foreground block">
                📸 {locale === 'mr' ? 'खोल्या आणि परिसराचे फोटो (Hostel Photos)' : 'Hostel & Room Photos'}
              </label>
              <MultiImageCropPicker
                photos={photos}
                onChange={setPhotos}
                onUploadFile={handleUploadPhoto}
                maxPhotos={6}
                uploading={uploading}
              />
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || uploading}
                className="flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 transition-all shadow-sm disabled:opacity-50"
              >
                {saving || uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span>{locale === 'mr' ? 'सुविधा व फोटो जतन करा' : 'Save Amenities & Photos'}</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 4: CUSTOMER VIEW PREVIEW */}
        {activeTab === 'preview' && (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-muted/40 border border-border/80 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground min-w-0 flex-1">
                {locale === 'mr'
                  ? 'खालील कार्ड तुमच्या विद्यार्थ्यांना "पीजी व वसतिगृह" पानावर असे दिसेल:'
                  : 'This is how your PG listing appears to students on the PG Directory:'}
              </p>
              <Link
                to={`/${currentCity.slug}/pg/${shop.slug || shop.id}`}
                target="_blank"
                className="text-xs font-bold text-primary hover:underline flex items-center gap-1 shrink-0"
              >
                <span>{locale === 'mr' ? 'सार्वजनिक पान उघडा' : 'Open Public Page'}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* PG Preview Card */}
            <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-md max-w-lg mx-auto">
              {photos[0] && (
                <div className="relative h-44 w-full overflow-hidden bg-muted">
                  <img src={photos[0]} alt={displayName} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent pointer-events-none" />
                  <div className="absolute bottom-2.5 left-3 right-3 flex flex-wrap items-center justify-between gap-1.5 text-white">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-xs border border-white/20">
                      {gender === 'girls' ? '👧 Girls PG' : gender === 'boys' ? '👦 Boys PG' : '👫 Co-ed / Separate'}
                    </span>
                    {rate2 || rate1 ? (
                      <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-primary text-primary-foreground shadow-xs">
                        From ₹{rate2 || rate1}/mo
                      </span>
                    ) : null}
                  </div>
                </div>
              )}

              <div className="p-4 border-b border-border/50">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-base font-bold text-foreground leading-tight">{displayName}</h2>
                    {shop.area && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 text-muted-foreground/70" />
                        <span>{shop.area}</span>
                      </p>
                    )}
                  </div>

                  <span
                    className={cn(
                      'text-xs font-bold px-2.5 py-1 rounded-full border',
                      availableBeds > 0
                        ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                        : 'bg-rose-500/10 text-rose-600 border-rose-500/30'
                    )}
                  >
                    {availableBeds > 0
                      ? locale === 'mr' ? `${availableBeds} जागा उपलब्ध` : `${availableBeds} Beds Vacant`
                      : locale === 'mr' ? 'पूर्ण (Full)' : 'Full'}
                  </span>
                </div>

                {/* Key Tags */}
                <div className="flex items-center gap-2 mt-2.5 flex-wrap text-xs">
                  {foodIncluded && (
                    <span className="text-[10px] font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                      🍲 {locale === 'mr' ? 'जेवण समाविष्ट' : 'Food Included'}
                    </span>
                  )}
                  {gateClosingTime && (
                    <span className="text-[10px] font-medium text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md">
                      🕒 Gate: {gateClosingTime}
                    </span>
                  )}
                  {depositAmount > 0 && (
                    <span className="text-[10px] font-medium text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md">
                      Deposit: ₹{depositAmount}
                    </span>
                  )}
                </div>

                {/* Amenities Badges */}
                {amenities.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2.5 pt-2 border-t border-border/40">
                    {amenities.slice(0, 5).map((a) => (
                      <span
                        key={a}
                        className="inline-flex items-center text-[10px] font-medium text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md"
                      >
                        ✓ {a}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Inquiry Action Bar */}
              <div className="p-3 bg-muted/20 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-foreground">
                  {availableBeds > 0 ? (
                    <span className="text-emerald-600">● {locale === 'mr' ? 'प्रवेश सुरू' : 'Admissions Open'}</span>
                  ) : (
                    <span className="text-rose-600">● {locale === 'mr' ? 'सर्व जागा भरल्या' : 'Currently Full'}</span>
                  )}
                </span>

                <button
                  type="button"
                  onClick={handleShareWhatsApp}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-1.5 transition-all shadow-xs"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>{locale === 'mr' ? 'WhatsApp शेअर' : 'WhatsApp Share'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
