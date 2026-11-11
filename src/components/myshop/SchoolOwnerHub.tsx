import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Award,
  BadgeCheck,
  Bell,
  BookOpen,
  Building2,
  Bus,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  Eye,
  FileText,
  GraduationCap,
  IndianRupee,
  Link2,
  Loader2,
  Lock,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  Pin,
  Plus,
  RefreshCw,
  Save,
  Share2,
  Sparkles,
  Trash2,
  TrendingUp,
  AlertTriangle,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useT } from '@/i18n';
import { useCity } from '@/hooks/useCity';
import { supabase } from '@/integrations/supabase/client';
import type { SchoolRow } from '@/lib/repos/schoolsRepo';
import { updateSchoolAsOwner } from '@/lib/schoolConcurrency';
import { schoolNoticesRepo, type SchoolNotice } from '@/lib/schools/schoolNoticesRepo';
import {
  SCHOOL_TYPE_CONFIG,
  SCHOOL_MEDIUM_CONFIG,
  ADMISSION_STATUS_CONFIG,
  ADMISSION_STATUS_OPTIONS,
  MANAGEMENT_TYPE_OPTIONS,
  GENDER_TYPE_OPTIONS,
  FEE_TIER_OPTIONS,
  NOTICE_CATEGORY_CONFIG,
  NOTICE_CATEGORY_OPTIONS,
  COMMON_BOARDS,
  COMMON_FACILITIES,
  COMMON_SCHOLARSHIPS,
  COMMON_DOCUMENTS,
  COACHING_FOCUS_OPTIONS,
  getSchoolResolvedMeta,
  resolveSchoolType,
  serializeSchoolDescription,
  formatSchoolWhatsAppBroadcast,
  type AdmissionStatus,
  type ManagementType,
  type GenderType,
  type FeeTier,
  type NoticeCategory,
} from '@/lib/schools/schoolHelpers';
import { ClaimedBadge } from '@/components/shared/ClaimedBadge';
import { MultiImageCropPicker } from '@/components/shared/MultiImageCropPicker';
import { MarathiMirrorField } from '@/components/shared/MarathiMirrorField';
import { TranslateAllButton } from '@/components/shared/TranslateAllButton';
import { LocationMapPicker, MUKTAINAGAR_CENTER } from '@/components/shared/LocationMapPicker';
import { uploadShopImage } from '@/lib/storageNaming';
import { parseGoogleMapsLink } from '@/lib/mapsUtils';
import { isMissingRelationErr } from '@/lib/entities/claimEntity';
import { normalizeWhatsApp } from '@/components/admin/adminHelpers';
import { isSafeHttpUrl, isValidIndianPhone, cn } from '@/lib/utils';

interface SchoolOwnerHubProps {
  school: SchoolRow;
  roleTitle?: string | null;
  onUpdated?: (freshRow: SchoolRow) => void;
}

type SchoolTab = 'notices' | 'admissions' | 'campus' | 'analytics';

const inputCls =
  'w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm transition-shadow';

function normalizeHttpUrl(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  const candidate = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  return isSafeHttpUrl(candidate) ? candidate : null;
}

export function SchoolOwnerHub({ school, roleTitle, onUpdated }: SchoolOwnerHubProps) {
  const { t, locale } = useT();
  const isMr = locale === 'mr';
  const { currentCity } = useCity();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<SchoolTab>('notices');
  const [conflictRow, setConflictRow] = useState<SchoolRow | null>(null);

  const meta = useMemo(() => getSchoolResolvedMeta(school), [school]);
  const resolvedType = useMemo(
    () => resolveSchoolType({ school_type: school.school_type, description: school.description }),
    [school.school_type, school.description],
  );
  const typeCfg = SCHOOL_TYPE_CONFIG[resolvedType] || SCHOOL_TYPE_CONFIG.other;

  // Track concurrency baseline across optimistic updates
  const baselineRef = useRef<string | undefined>(school.updated_at);
  useEffect(() => {
    baselineRef.current = school.updated_at;
  }, [school.updated_at]);

  // ── Admissions / Academics Form State ───────────────────────────────────
  const [admissionStatus, setAdmissionStatus] = useState<AdmissionStatus>(
    (meta.admission_status as AdmissionStatus) || 'open',
  );
  const [admissionDeadline, setAdmissionDeadline] = useState(meta.admission_deadline || '');
  const [admissionUrl, setAdmissionUrl] = useState(meta.admission_url || '');
  const [prospectusUrl, setProspectusUrl] = useState(meta.prospectus_url || '');
  const [board, setBoard] = useState(meta.board || '');
  const [managementType, setManagementType] = useState<ManagementType | ''>(
    meta.management_type || '',
  );
  const [genderType, setGenderType] = useState<GenderType>(meta.gender_type || 'coed');
  const [classesOffered, setClassesOffered] = useState(meta.classes_offered || '');
  const [establishedYear, setEstablishedYear] = useState(
    meta.established_year ? String(meta.established_year) : '',
  );
  const [accreditation, setAccreditation] = useState(meta.accreditation || '');
  const [udiseCode, setUdiseCode] = useState(meta.udise_aishe_code || '');
  const [mediums, setMediums] = useState<string[]>(
    meta.mediums && meta.mediums.length > 0
      ? meta.mediums
      : school.medium
        ? [school.medium]
        : ['marathi'],
  );
  const [streamsText, setStreamsText] = useState((meta.streams || []).join(', '));
  const [coachingFocus, setCoachingFocus] = useState<string[]>(meta.coaching_focus || []);
  const [feeTier, setFeeTier] = useState<FeeTier>(meta.fee_tier || 'low');
  const [feeMin, setFeeMin] = useState(meta.annual_fee_min ? String(meta.annual_fee_min) : '');
  const [feeMax, setFeeMax] = useState(meta.annual_fee_max ? String(meta.annual_fee_max) : '');
  const [totalSeats, setTotalSeats] = useState(
    meta.total_seats != null ? String(meta.total_seats) : '',
  );
  const [availableSeats, setAvailableSeats] = useState(
    meta.available_seats != null ? String(meta.available_seats) : '',
  );
  const [scholarships, setScholarships] = useState<string[]>(meta.scholarships || []);
  const [requiredDocs, setRequiredDocs] = useState<string[]>(meta.required_documents || []);

  // ── Campus Profile / Photos / Bus Routes State ──────────────────────────
  const [name, setName] = useState(school.name || '');
  const [nameMr, setNameMr] = useState(school.name_mr || '');
  const [phone, setPhone] = useState(school.phone || '');
  const [whatsapp, setWhatsapp] = useState(school.whatsapp || '');
  const [email, setEmail] = useState(school.email || '');
  const [website, setWebsite] = useState(school.website || '');
  const [principalName, setPrincipalName] = useState(meta.principal_name || '');
  const [officeTiming, setOfficeTiming] = useState(meta.office_timing || '');
  const [area, setArea] = useState(school.area || '');
  const [subArea, setSubArea] = useState(school.sub_area || '');
  const [address, setAddress] = useState(school.address || '');
  const [addressMr, setAddressMr] = useState(school.address_mr || '');
  const [rawDesc, setRawDesc] = useState(meta.raw_description || '');
  const [facilities, setFacilities] = useState<string[]>(meta.facilities || []);
  const [customFacility, setCustomFacility] = useState('');
  const [transportVillages, setTransportVillages] = useState<string[]>(
    meta.transport_villages || [],
  );
  const [villageChipInput, setVillageChipInput] = useState('');
  const [photos, setPhotos] = useState<string[]>(
    Array.isArray(school.photos) && school.photos.length > 0
      ? school.photos
      : school.image_url
        ? [school.image_url]
        : [],
  );
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [latitude, setLatitude] = useState(
    school.latitude != null ? String(school.latitude) : '',
  );
  const [longitude, setLongitude] = useState(
    school.longitude != null ? String(school.longitude) : '',
  );
  const [mapsLinkInput, setMapsLinkInput] = useState('');

  const [savingPatch, setSavingPatch] = useState(false);
  const [quickToggling, setQuickToggling] = useState(false);

  // Sync form from updated server row (when school.id changes or explicit reload)
  const syncFromRow = (row: SchoolRow) => {
    const m = getSchoolResolvedMeta(row);
    baselineRef.current = row.updated_at;
    setAdmissionStatus((m.admission_status as AdmissionStatus) || 'open');
    setAdmissionDeadline(m.admission_deadline || '');
    setAdmissionUrl(m.admission_url || '');
    setProspectusUrl(m.prospectus_url || '');
    setBoard(m.board || '');
    setManagementType(m.management_type || '');
    setGenderType(m.gender_type || 'coed');
    setClassesOffered(m.classes_offered || '');
    setEstablishedYear(m.established_year ? String(m.established_year) : '');
    setAccreditation(m.accreditation || '');
    setUdiseCode(m.udise_aishe_code || '');
    setMediums(
      m.mediums && m.mediums.length > 0
        ? m.mediums
        : row.medium
          ? [row.medium]
          : ['marathi'],
    );
    setStreamsText((m.streams || []).join(', '));
    setCoachingFocus(m.coaching_focus || []);
    setFeeTier(m.fee_tier || 'low');
    setFeeMin(m.annual_fee_min ? String(m.annual_fee_min) : '');
    setFeeMax(m.annual_fee_max ? String(m.annual_fee_max) : '');
    setTotalSeats(m.total_seats != null ? String(m.total_seats) : '');
    setAvailableSeats(m.available_seats != null ? String(m.available_seats) : '');
    setScholarships(m.scholarships || []);
    setRequiredDocs(m.required_documents || []);

    setName(row.name || '');
    setNameMr(row.name_mr || '');
    setPhone(row.phone || '');
    setWhatsapp(row.whatsapp || '');
    setEmail(row.email || '');
    setWebsite(row.website || '');
    setPrincipalName(m.principal_name || '');
    setOfficeTiming(m.office_timing || '');
    setArea(row.area || '');
    setSubArea(row.sub_area || '');
    setAddress(row.address || '');
    setAddressMr(row.address_mr || '');
    setRawDesc(m.raw_description || '');
    setFacilities(m.facilities || []);
    setTransportVillages(m.transport_villages || []);
    setPhotos(
      Array.isArray(row.photos) && row.photos.length > 0
        ? row.photos
        : row.image_url
          ? [row.image_url]
          : [],
    );
    setLatitude(row.latitude != null ? String(row.latitude) : '');
    setLongitude(row.longitude != null ? String(row.longitude) : '');
    setConflictRow(null);
  };

  useEffect(() => {
    syncFromRow(school);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [school.id]);

  // ── Shared concurrency save helper ──────────────────────────────────────
  const dispatchOwnerUpdate = async (patch: Record<string, any>): Promise<SchoolRow | null> => {
    const res = await updateSchoolAsOwner(school.id, baselineRef.current, patch);
    if (res.ok === false) {
      if ('conflict' in res && res.conflict) {
        setConflictRow(res.latest);
        toast.error(
          t('schoolOwner.toast.conflict') ||
            'Updated by an admin or another tab. Please reload latest changes.',
          {
            action: {
              label: isMr ? 'रिफ्रेश करा' : 'Reload Latest',
              onClick: () => {
                syncFromRow(res.latest);
                onUpdated?.(res.latest);
              },
            },
            duration: 9000,
          },
        );
      } else {
        const errMsg = 'error' in res ? res.error : 'Save failed';
        toast.error(errMsg || 'Save failed');
      }
      return null;
    }
    baselineRef.current = res.row.updated_at;
    setConflictRow(null);
    onUpdated?.(res.row);
    qc.invalidateQueries({ queryKey: ['schools'] });
    qc.invalidateQueries({ queryKey: ['school-detail'] });
    return res.row;
  };

  // ── Quick 1-Tap Admission Status Toggle ─────────────────────────────────
  const handleQuickAdmissionStatus = async (status: AdmissionStatus) => {
    if (quickToggling) return;
    const prev = admissionStatus;
    setAdmissionStatus(status);
    setQuickToggling(true);
    const updated = await dispatchOwnerUpdate({ admission_status: status });
    setQuickToggling(false);
    if (!updated) {
      setAdmissionStatus(prev);
      return;
    }
    const cfg = ADMISSION_STATUS_CONFIG[status];
    toast.success(
      isMr
        ? `प्रवेश स्थिती "${cfg.labelMr}" वर अद्यतनित झाली.`
        : `Admissions status updated to "${cfg.labelEn}".`,
    );
  };

  // ── Save Admissions, Fees & Academics Tab ───────────────────────────────
  const handleSaveAdmissions = async () => {
    if (admissionUrl.trim() && !normalizeHttpUrl(admissionUrl)) {
      toast.error('Admission Portal URL must begin with http:// or https://');
      return;
    }
    if (prospectusUrl.trim() && !normalizeHttpUrl(prospectusUrl)) {
      toast.error('Prospectus / Brochure URL must begin with http:// or https://');
      return;
    }
    if (mediums.length === 0) {
      toast.error('Please keep at least one instruction medium selected');
      return;
    }

    const parsedStreams = streamsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const dbType = school.school_type;
    const serializedDescription = serializeSchoolDescription({
      type_override: resolvedType !== dbType ? resolvedType : undefined,
      board: board.trim() || undefined,
      streams: parsedStreams.length > 0 ? parsedStreams : undefined,
      facilities: facilities.length > 0 ? facilities : undefined,
      principal_name: principalName.trim() || undefined,
      office_timing: officeTiming.trim() || undefined,
      raw_description: rawDesc.trim(),
    });

    const feeMinNum = feeMin.trim() ? Number(feeMin) : null;
    const feeMaxNum = feeMax.trim() ? Number(feeMax) : null;
    const totalSeatsNum = totalSeats.trim() ? Number(totalSeats) : null;
    const availSeatsNum = availableSeats.trim() ? Number(availableSeats) : null;
    const estYearNum = establishedYear.trim() ? Number(establishedYear) : null;

    const patch: Record<string, any> = {
      admission_status: admissionStatus,
      admission_deadline: admissionDeadline.trim() || null,
      admission_url: normalizeHttpUrl(admissionUrl),
      prospectus_url: normalizeHttpUrl(prospectusUrl),
      board: board.trim() || null,
      management_type: managementType || null,
      gender_type: genderType || 'coed',
      classes_offered: classesOffered.trim() || null,
      established_year: estYearNum && !Number.isNaN(estYearNum) ? estYearNum : null,
      accreditation: accreditation.trim() || null,
      medium: mediums[0],
      mediums,
      streams: parsedStreams,
      coaching_focus: coachingFocus,
      fee_tier: feeTier,
      annual_fee_min: feeMinNum !== null && !Number.isNaN(feeMinNum) ? feeMinNum : null,
      annual_fee_max: feeMaxNum !== null && !Number.isNaN(feeMaxNum) ? feeMaxNum : null,
      total_seats: totalSeatsNum !== null && !Number.isNaN(totalSeatsNum) ? totalSeatsNum : null,
      available_seats: availSeatsNum !== null && !Number.isNaN(availSeatsNum) ? availSeatsNum : null,
      scholarships,
      required_documents: requiredDocs,
      description: serializedDescription || null,
    };

    // Only allow editing udise_aishe_code while institute is NOT admin-verified
    // (DB trigger protect_school_admin_columns enforces this server-side).
    if (!school.is_verified) {
      patch.udise_aishe_code = udiseCode.trim() || null;
    }

    setSavingPatch(true);
    const saved = await dispatchOwnerUpdate(patch);
    setSavingPatch(false);
    if (saved) {
      toast.success(t('schoolOwner.toast.saved') || 'Institute details saved!');
    }
  };

  // ── Save Campus Profile, Photos & Bus Routes Tab ────────────────────────
  const handleSaveCampus = async () => {
    if (!name.trim()) {
      toast.error('Institute Name (English) is required');
      return;
    }
    if (phone.trim() && !isValidIndianPhone(phone)) {
      toast.error('Enter a valid 10-digit contact phone number');
      return;
    }
    if (whatsapp.trim() && !isValidIndianPhone(whatsapp)) {
      toast.error('Enter a valid 10-digit WhatsApp number');
      return;
    }
    if (website.trim() && !normalizeHttpUrl(website)) {
      toast.error('Website URL must begin with http:// or https://');
      return;
    }

    const latNum = latitude.trim() ? Number(latitude) : null;
    const lngNum = longitude.trim() ? Number(longitude) : null;
    if ((latNum !== null && Number.isNaN(latNum)) || (lngNum !== null && Number.isNaN(lngNum))) {
      toast.error('Invalid latitude or longitude coordinates');
      return;
    }

    const parsedStreams = streamsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const dbType = school.school_type;
    const serializedDescription = serializeSchoolDescription({
      type_override: resolvedType !== dbType ? resolvedType : undefined,
      board: board.trim() || undefined,
      streams: parsedStreams.length > 0 ? parsedStreams : undefined,
      facilities: facilities.length > 0 ? facilities : undefined,
      principal_name: principalName.trim() || undefined,
      office_timing: officeTiming.trim() || undefined,
      raw_description: rawDesc.trim(),
    });

    setSavingPatch(true);
    const saved = await dispatchOwnerUpdate({
      name: name.trim(),
      name_mr: nameMr.trim() || null,
      phone: phone.trim() || null,
      whatsapp: whatsapp.trim() ? normalizeWhatsApp(whatsapp.trim()) : null,
      email: email.trim() || null,
      website: normalizeHttpUrl(website),
      principal_name: principalName.trim() || null,
      office_timing: officeTiming.trim() || null,
      area: area.trim() || null,
      sub_area: subArea.trim() || null,
      address: address.trim() || null,
      address_mr: addressMr.trim() || null,
      description: serializedDescription || null,
      facilities,
      transport_villages: transportVillages,
      image_url: photos[0] || null,
      photos,
      latitude: latNum,
      longitude: lngNum,
    });
    setSavingPatch(false);
    if (saved) {
      toast.success(t('schoolOwner.toast.saved') || 'Campus profile & gallery saved!');
    }
  };

  // ── Helper toggles & actions ────────────────────────────────────────────
  const toggleStringIn = (list: string[], setter: (v: string[]) => void, item: string) => {
    setter(list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);
  };

  const addVillageChip = () => {
    const clean = villageChipInput.trim();
    if (!clean) return;
    if (!transportVillages.some((v) => v.toLowerCase() === clean.toLowerCase())) {
      setTransportVillages([...transportVillages, clean]);
    }
    setVillageChipInput('');
  };

  const addCustomFacility = () => {
    const clean = customFacility.trim();
    if (!clean) return;
    if (!facilities.some((f) => f.toLowerCase() === clean.toLowerCase())) {
      setFacilities([...facilities, clean]);
    }
    setCustomFacility('');
  };

  const handleParseMapsLink = () => {
    if (!mapsLinkInput.trim()) return;
    const coords = parseGoogleMapsLink(mapsLinkInput);
    if (!coords) {
      toast.error('Could not find @lat,lng coordinates in that link.');
      return;
    }
    setLatitude(coords.lat.toFixed(6));
    setLongitude(coords.lng.toFixed(6));
    setMapsLinkInput('');
    toast.success(`Coordinates set: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`);
  };

  const publicSlugPath = `/${currentCity.slug}/schools/${school.slug || school.id}`;
  const publicFullUrl =
    typeof window !== 'undefined' ? `${window.location.origin}${publicSlugPath}` : publicSlugPath;

  const handleShareWhatsApp = () => {
    const streamsList = streamsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const text = formatSchoolWhatsAppBroadcast({
      schoolName: name || school.name,
      schoolNameMr: nameMr || school.name_mr,
      typeLabel: isMr ? typeCfg.labelMr : typeCfg.labelEn,
      area: area || school.area,
      board: board || meta.board,
      admissionStatus,
      admissionDeadline: admissionDeadline || null,
      streams: streamsList,
      scholarships,
      availableSeats: availableSeats ? Number(availableSeats) : null,
      phone: phone || school.phone,
      publicUrl: publicFullUrl,
      isMr,
    });
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };

  const handleCopyPublicLink = () => {
    navigator.clipboard?.writeText(publicFullUrl).then(
      () => toast.success(isMr ? 'लिंक कॉपी झाली!' : 'Institute public link copied!'),
      () => toast.error('Copy failed'),
    );
  };

  const coverUrl = photos[0] || school.image_url || null;
  const admCfg = ADMISSION_STATUS_CONFIG[admissionStatus] || ADMISSION_STATUS_CONFIG.open;

  return (
    <div className="space-y-4">
      {/* ── Concurrency Conflict Banner ──────────────────────────────────── */}
      {conflictRow && (
        <div
          role="alert"
          className="p-3.5 rounded-2xl border border-destructive/40 bg-destructive/10 flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex items-start gap-2.5 min-w-0">
            <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="font-bold text-destructive">
                {t('schoolOwner.toast.conflict') ||
                  'This institute was updated elsewhere since you loaded it.'}
              </p>
              <p className="text-muted-foreground mt-0.5">
                Reload latest values before saving so changes aren't lost.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              syncFromRow(conflictRow);
              onUpdated?.(conflictRow);
              toast.success('Reloaded latest server data');
            }}
            className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-destructive text-destructive-foreground text-xs font-bold hover:opacity-90"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Reload
          </button>
        </div>
      )}

      {/* ── Hero Summary Card ────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-purple-500/10 via-card to-card shadow-sm">
        <div className="p-4 flex items-start gap-3">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden bg-muted shrink-0 ring-2 ring-card shadow flex items-center justify-center">
            {coverUrl ? (
              <img src={coverUrl} alt={name || school.name} className="w-full h-full object-cover" />
            ) : (
              <GraduationCap className="w-8 h-8 text-purple-600" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold border ${typeCfg.badgeClass}`}>
                {isMr ? typeCfg.labelMr : typeCfg.labelEn.split(' (')[0]}
              </span>
              {roleTitle && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-semibold">
                  {roleTitle}
                </span>
              )}
            </div>
            <h2 className="font-bold text-foreground text-base sm:text-lg truncate mt-1 leading-tight">
              {name || school.name}
            </h2>
            {nameMr && (
              <p className="text-xs text-muted-foreground truncate" lang="mr">
                {nameMr}
              </p>
            )}
            <div className="flex items-center flex-wrap gap-1.5 mt-2">
              <span
                className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${admCfg.badgeClass}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${admCfg.dotClass}`} />
                {isMr ? admCfg.labelMr : admCfg.labelEn}
              </span>
              {school.is_verified && (
                <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                  <BadgeCheck className="w-3 h-3" /> Verified
                </span>
              )}
              {school.is_claimed && <ClaimedBadge size="sm" />}
              {!school.is_active && (
                <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-semibold bg-destructive/15 text-destructive">
                  Hidden by Admin
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Hero Action Bar */}
        <div className="px-4 pb-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleShareWhatsApp}
            className="flex-1 min-w-[140px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 active:scale-[0.98] transition-all"
          >
            <Share2 className="w-3.5 h-3.5" />
            {t('schoolOwner.whatsappBroadcast') || 'WhatsApp Broadcast'}
          </button>
          <button
            type="button"
            onClick={handleCopyPublicLink}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-border bg-background hover:bg-muted transition-all"
          >
            <Link2 className="w-3.5 h-3.5" />
            {t('myShop.copyLink') || 'Copy Link'}
          </button>
          <Link
            to={publicSlugPath}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-border bg-background hover:bg-muted transition-all"
            title="Open Public Page"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Public Page</span>
          </Link>
        </div>
      </div>

      {/* ── Navigation Tabs ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 bg-card border border-border p-1.5 rounded-2xl shadow-2xs">
        {(
          [
            {
              key: 'notices',
              icon: Bell,
              label: t('schoolOwner.tab.notices') || 'Notices',
            },
            {
              key: 'admissions',
              icon: GraduationCap,
              label: t('schoolOwner.tab.admissions') || 'Admissions',
            },
            {
              key: 'campus',
              icon: Building2,
              label: t('schoolOwner.tab.campus') || 'Campus',
            },
            {
              key: 'analytics',
              icon: TrendingUp,
              label: t('schoolOwner.tab.analytics') || 'Reach',
            },
          ] as { key: SchoolTab; icon: any; label: string }[]
        ).map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-bold transition-all min-w-0',
                active
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
              )}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── TAB 1: Notices & Circulars ───────────────────────────────────── */}
      {activeTab === 'notices' && <NoticesManager school={school} isMr={isMr} />}

      {/* ── TAB 2: Admissions, Fees & Academics ─────────────────────────── */}
      {activeTab === 'admissions' && (
        <div className="space-y-4">
          {/* Quick 1-tap Admissions Toggle */}
          <div className="bg-card rounded-2xl border border-border p-4 space-y-2.5 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Quick 1-Tap Admissions Toggle
              </p>
              {quickToggling && <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(Object.keys(ADMISSION_STATUS_CONFIG) as AdmissionStatus[]).map((key) => {
                const cfg = ADMISSION_STATUS_CONFIG[key];
                const selected = admissionStatus === key;
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={quickToggling}
                    onClick={() => handleQuickAdmissionStatus(key)}
                    className={cn(
                      'px-3 py-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all',
                      selected
                        ? `${cfg.badgeClass} ring-2 ring-primary/30 shadow-xs`
                        : 'bg-background border-border text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <span className={`w-2 h-2 rounded-full ${cfg.dotClass}`} />
                    <span className="truncate">{isMr ? cfg.labelMr : cfg.labelEn}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-card rounded-2xl border border-border p-4 space-y-4 shadow-sm">
            <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-primary" />
              Admissions, Seats & Recognition
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Admission Status">
                <select
                  value={admissionStatus}
                  onChange={(e) => setAdmissionStatus(e.target.value as AdmissionStatus)}
                  className={inputCls}
                >
                  {ADMISSION_STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Application / Admission Deadline">
                <input
                  value={admissionDeadline}
                  onChange={(e) => setAdmissionDeadline(e.target.value)}
                  className={inputCls}
                  placeholder="e.g. 30 June 2026"
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Online Apply Link (URL)">
                <input
                  type="url"
                  value={admissionUrl}
                  onChange={(e) => setAdmissionUrl(e.target.value)}
                  className={inputCls}
                  placeholder="https://admissions.institute.edu.in"
                />
              </Field>
              <Field label="Prospectus / Brochure PDF Link">
                <input
                  type="url"
                  value={prospectusUrl}
                  onChange={(e) => setProspectusUrl(e.target.value)}
                  className={inputCls}
                  placeholder="https://.../prospectus.pdf"
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <Field label="Total Seats / Batch Capacity">
                <input
                  type="number"
                  min={0}
                  value={totalSeats}
                  onChange={(e) => setTotalSeats(e.target.value)}
                  className={inputCls}
                  placeholder="e.g. 120"
                />
              </Field>
              <Field label="Vacant / Available Seats">
                <input
                  type="number"
                  min={0}
                  value={availableSeats}
                  onChange={(e) => setAvailableSeats(e.target.value)}
                  className={inputCls}
                  placeholder="e.g. 18"
                />
              </Field>
              <Field label="Established Year">
                <input
                  type="number"
                  min={1850}
                  max={2030}
                  value={establishedYear}
                  onChange={(e) => setEstablishedYear(e.target.value)}
                  className={inputCls}
                  placeholder="e.g. 1998"
                />
              </Field>
              <Field label="NAAC / Govt Grade">
                <input
                  value={accreditation}
                  onChange={(e) => setAccreditation(e.target.value)}
                  className={inputCls}
                  placeholder="e.g. NAAC Grade A"
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Board / University">
                <input
                  value={board}
                  onChange={(e) => setBoard(e.target.value)}
                  list="school-owner-boards"
                  className={inputCls}
                  placeholder="State Board / CBSE / SPPU"
                />
                <datalist id="school-owner-boards">
                  {COMMON_BOARDS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
                </datalist>
              </Field>
              <Field label="Classes / Degrees Offered">
                <input
                  value={classesOffered}
                  onChange={(e) => setClassesOffered(e.target.value)}
                  className={inputCls}
                  placeholder="e.g. Nursery to 10th / B.E."
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Management Type">
                <select
                  value={managementType}
                  onChange={(e) => setManagementType((e.target.value || '') as ManagementType | '')}
                  className={inputCls}
                >
                  <option value="">— Select Management —</option>
                  {MANAGEMENT_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Student Gender Policy">
                <select
                  value={genderType}
                  onChange={(e) => setGenderType(e.target.value as GenderType)}
                  className={inputCls}
                >
                  {GENDER_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </Field>
            </div>

            {/* UDISE / AISHE */}
            <Field
              label={
                school.is_verified
                  ? 'UDISE+ / AISHE Code (Locked on Verified Campus)'
                  : 'UDISE+ / AISHE / DTE Code (Optional)'
              }
            >
              <div className="relative">
                <input
                  value={udiseCode}
                  disabled={!!school.is_verified}
                  onChange={(e) => setUdiseCode(e.target.value)}
                  className={cn(inputCls, 'font-mono', school.is_verified && 'opacity-70 bg-muted pr-8')}
                  placeholder="e.g. 27030100101"
                />
                {school.is_verified && (
                  <Lock className="w-3.5 h-3.5 text-emerald-600 absolute right-3 top-1/2 -translate-y-1/2" />
                )}
              </div>
              {school.is_verified && (
                <p className="text-[10.5px] text-muted-foreground mt-1">
                  Contact admin support to update government registration codes on a verified campus.
                </p>
              )}
            </Field>

            {/* Mediums multi-select */}
            <div>
              <p className="text-xs font-semibold text-foreground mb-1.5">
                Instruction Mediums Supported
              </p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(SCHOOL_MEDIUM_CONFIG).map(([key, cfg]) => {
                  const selected = mediums.includes(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleStringIn(mediums, setMediums, key)}
                      className={cn(
                        'px-2.5 py-1 rounded-full text-xs font-semibold border transition-all',
                        selected
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background text-foreground border-border hover:border-primary',
                      )}
                    >
                      {isMr ? cfg.labelMr : cfg.labelEn}
                    </button>
                  );
                })}
              </div>
            </div>

            <Field label="Streams / Branches / Courses (comma-separated)">
              <input
                value={streamsText}
                onChange={(e) => setStreamsText(e.target.value)}
                className={inputCls}
                placeholder="e.g. Science, Commerce, Arts, Computer Engg"
              />
            </Field>

            {(resolvedType === 'coaching' || resolvedType === 'university' || coachingFocus.length > 0) && (
              <div>
                <p className="text-xs font-semibold text-foreground mb-1.5">
                  Competitive / Exam Coaching Focus
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {COACHING_FOCUS_OPTIONS.map((opt) => {
                    const selected = coachingFocus.includes(opt);
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => toggleStringIn(coachingFocus, setCoachingFocus, opt)}
                        className={cn(
                          'px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all',
                          selected
                            ? 'bg-cyan-600 text-white border-cyan-600'
                            : 'bg-background text-foreground border-border hover:border-cyan-500',
                        )}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Fee Structure */}
            <div className="pt-2 border-t border-border space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <IndianRupee className="w-3.5 h-3.5 text-primary" /> Fee Band & Annual Fee Range
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field label="Fee Tier">
                  <select
                    value={feeTier}
                    onChange={(e) => setFeeTier(e.target.value as FeeTier)}
                    className={inputCls}
                  >
                    {FEE_TIER_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Annual Min Fee (₹)">
                  <input
                    type="number"
                    min={0}
                    value={feeMin}
                    onChange={(e) => setFeeMin(e.target.value)}
                    className={inputCls}
                    placeholder="e.g. 0 or 12000"
                  />
                </Field>
                <Field label="Annual Max Fee (₹)">
                  <input
                    type="number"
                    min={0}
                    value={feeMax}
                    onChange={(e) => setFeeMax(e.target.value)}
                    className={inputCls}
                    placeholder="e.g. 45000"
                  />
                </Field>
              </div>
            </div>

            {/* Scholarships */}
            <div className="pt-2 border-t border-border space-y-2">
              <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-purple-600" /> Scholarships & Fee Concessions
              </p>
              <div className="flex flex-wrap gap-1.5">
                {COMMON_SCHOLARSHIPS.map((sc) => {
                  const selected = scholarships.includes(sc);
                  return (
                    <button
                      key={sc}
                      type="button"
                      onClick={() => toggleStringIn(scholarships, setScholarships, sc)}
                      className={cn(
                        'px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all',
                        selected
                          ? 'bg-purple-600 text-white border-purple-600'
                          : 'bg-background text-foreground border-border hover:border-purple-500',
                      )}
                    >
                      {sc}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Required Documents */}
            <div className="pt-2 border-t border-border space-y-2">
              <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <ClipboardList className="w-3.5 h-3.5 text-primary" /> Required Documents for Admission
              </p>
              <div className="flex flex-wrap gap-1.5">
                {COMMON_DOCUMENTS.map((doc) => {
                  const selected = requiredDocs.includes(doc);
                  return (
                    <button
                      key={doc}
                      type="button"
                      onClick={() => toggleStringIn(requiredDocs, setRequiredDocs, doc)}
                      className={cn(
                        'px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all',
                        selected
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background text-foreground border-border hover:border-primary',
                      )}
                    >
                      {doc}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={handleSaveAdmissions}
              disabled={savingPatch}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-50"
            >
              {savingPatch ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Admissions & Academics
            </button>
          </div>
        </div>
      )}

      {/* ── TAB 3: Campus Profile, Photos & Bus Routes ──────────────────── */}
      {activeTab === 'campus' && (
        <div className="bg-card rounded-2xl border border-border p-4 space-y-4 shadow-sm">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" />
              Campus Identity, Gallery & Bus Routes
            </h3>
            <TranslateAllButton
              pairs={[
                { source: name, value: nameMr, onChange: setNameMr },
                { source: address, value: addressMr, onChange: setAddressMr },
              ]}
            />
          </div>

          {/* Multi-photo Campus Gallery */}
          <MultiImageCropPicker
            photos={photos}
            onChange={setPhotos}
            maxPhotos={5}
            uploading={uploadingPhoto}
            label="Campus & Activity Photos (Up to 5 · Slot 1 = Cover Photo)"
            onUploadFile={async (blob) => {
              setUploadingPhoto(true);
              try {
                const { publicUrl } = await uploadShopImage(blob, name || school.name || 'school', {
                  prefix: 'school',
                });
                toast.success('Photo uploaded!');
                return publicUrl;
              } finally {
                setUploadingPhoto(false);
              }
            }}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Institute Name (English) *">
              <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
            </Field>
            <MarathiMirrorField
              label="संस्थेचे नाव (मराठी)"
              value={nameMr}
              onChange={setNameMr}
              placeholder="मराठी नाव"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Office Phone">
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputMode="tel"
                className={inputCls}
                placeholder="02583-234250"
              />
            </Field>
            <Field label="WhatsApp Enquiry Number">
              <input
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                inputMode="tel"
                className={inputCls}
                placeholder="98XXXXXXXX"
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Official Email">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputCls}
                placeholder="info@institute.edu.in"
              />
            </Field>
            <Field label="Website">
              <input
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className={inputCls}
                placeholder="https://institute.edu.in"
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Principal / Headmaster / Director Name">
              <input
                value={principalName}
                onChange={(e) => setPrincipalName(e.target.value)}
                className={inputCls}
                placeholder="e.g. Dr. S. P. Kulkarni"
              />
            </Field>
            <Field label="Office Hours / Timing">
              <input
                value={officeTiming}
                onChange={(e) => setOfficeTiming(e.target.value)}
                className={inputCls}
                placeholder="e.g. 09:00 AM - 05:00 PM"
              />
            </Field>
          </div>

          <Field label="About Institute / Campus Overview">
            <textarea
              value={rawDesc}
              onChange={(e) => setRawDesc(e.target.value)}
              rows={3}
              className={inputCls + ' resize-y'}
              placeholder="Highlights, awards, alumni achievements, student support..."
            />
          </Field>

          {/* Facilities */}
          <div className="pt-2 border-t border-border space-y-2">
            <p className="text-xs font-semibold text-foreground">Campus Facilities</p>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_FACILITIES.map((fac) => {
                const selected = facilities.includes(fac);
                return (
                  <button
                    key={fac}
                    type="button"
                    onClick={() => toggleStringIn(facilities, setFacilities, fac)}
                    className={cn(
                      'px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all',
                      selected
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background text-foreground border-border hover:border-primary',
                    )}
                  >
                    {fac}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <input
                value={customFacility}
                onChange={(e) => setCustomFacility(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCustomFacility();
                  }
                }}
                className={inputCls + ' min-w-0 flex-1 text-xs'}
                placeholder="Add custom facility (e.g. NCC Unit, Olympiad Lab)…"
              />
              <button
                type="button"
                onClick={addCustomFacility}
                className="px-3 py-2 rounded-lg border border-border bg-muted text-xs font-bold shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Bus Route Villages */}
          <div className="pt-2 border-t border-border space-y-2">
            <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Bus className="w-3.5 h-3.5 text-primary" /> School Bus / Transport Served Villages
            </p>
            <div className="flex flex-wrap sm:flex-nowrap gap-2">
              <input
                value={villageChipInput}
                onChange={(e) => setVillageChipInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addVillageChip();
                  }
                }}
                className={inputCls + ' min-w-0 flex-1 text-xs'}
                placeholder="Type village / town name & press Add (e.g. Parandwadi, Somatane)"
              />
              <button
                type="button"
                onClick={addVillageChip}
                className="px-3 py-2 rounded-lg bg-primary/10 text-primary text-xs font-bold shrink-0"
              >
                Add Stop
              </button>
            </div>
            {transportVillages.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {transportVillages.map((v) => (
                  <span
                    key={v}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-muted border border-border"
                  >
                    {v}
                    <button
                      type="button"
                      onClick={() =>
                        setTransportVillages(transportVillages.filter((x) => x !== v))
                      }
                      className="text-muted-foreground hover:text-destructive"
                      aria-label={`Remove ${v}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Address & Map */}
          <div className="pt-2 border-t border-border space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Locality / Area">
                <input value={area} onChange={(e) => setArea(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Sub-Area / Landmark">
                <input value={subArea} onChange={(e) => setSubArea(e.target.value)} className={inputCls} />
              </Field>
            </div>
            <Field label="Full Campus Address (English)">
              <input value={address} onChange={(e) => setAddress(e.target.value)} className={inputCls} />
            </Field>
            <MarathiMirrorField
              label="संपूर्ण पत्ता (मराठी)"
              value={addressMr}
              onChange={setAddressMr}
            />

            <div className="flex flex-wrap sm:flex-nowrap gap-2">
              <input
                value={mapsLinkInput}
                onChange={(e) => setMapsLinkInput(e.target.value)}
                className={inputCls + ' min-w-0 flex-1 text-xs'}
                placeholder="Paste Google Maps share URL to auto-extract GPS pin…"
              />
              <button
                type="button"
                onClick={handleParseMapsLink}
                className="px-3 py-2 rounded-lg border border-border bg-muted text-xs font-bold shrink-0"
              >
                Extract Pin
              </button>
            </div>

            <LocationMapPicker
              value={
                latitude && longitude
                  ? { lat: parseFloat(latitude), lng: parseFloat(longitude) }
                  : null
              }
              initialCenter={{
                lat: currentCity.latitude || MUKTAINAGAR_CENTER.lat,
                lng: currentCity.longitude || MUKTAINAGAR_CENTER.lng,
              }}
              height={210}
              onChange={(c) => {
                setLatitude(c.lat.toFixed(6));
                setLongitude(c.lng.toFixed(6));
              }}
              onGeocode={(g) => {
                if (!address.trim() && g.address) setAddress(g.address);
                if (!area.trim() && g.area) setArea(g.area);
              }}
            />
          </div>

          <button
            type="button"
            onClick={handleSaveCampus}
            disabled={savingPatch || uploadingPhoto}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-50"
          >
            {savingPatch ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Campus Profile & Photos
          </button>
        </div>
      )}

      {/* ── TAB 4: Analytics & Public Card Preview ──────────────────────── */}
      {activeTab === 'analytics' && (
        <SchoolAnalyticsAndPreview
          school={school}
          name={name}
          nameMr={nameMr}
          area={area}
          phone={phone}
          coverUrl={coverUrl}
          admissionStatus={admissionStatus}
          feeTier={feeTier}
          mediums={mediums}
          transportVillages={transportVillages}
          publicSlugPath={publicSlugPath}
          isMr={isMr}
        />
      )}
    </div>
  );
}

/* ─── Notices & Circulars Sub-Panel ──────────────────────────────────────── */
function NoticesManager({ school, isMr }: { school: SchoolRow; isMr: boolean }) {
  const { t } = useT();
  const qc = useQueryClient();
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingNotice, setEditingNotice] = useState<SchoolNotice | null>(null);
  const [title, setTitle] = useState('');
  const [titleMr, setTitleMr] = useState('');
  const [body, setBody] = useState('');
  const [bodyMr, setBodyMr] = useState('');
  const [category, setCategory] = useState<NoticeCategory>('admission');
  const [expiresAt, setExpiresAt] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const { data: notices = [], isLoading } = useQuery<SchoolNotice[]>({
    queryKey: ['school-notices-owner', school.id],
    queryFn: () => schoolNoticesRepo.listForOwner(school.id),
  });

  const resetComposer = () => {
    setEditingNotice(null);
    setTitle('');
    setTitleMr('');
    setBody('');
    setBodyMr('');
    setCategory('admission');
    setExpiresAt('');
    setAttachmentUrl('');
    setIsPinned(false);
    setIsActive(true);
    setComposerOpen(false);
  };

  const openEdit = (n: SchoolNotice) => {
    setEditingNotice(n);
    setTitle(n.title);
    setTitleMr(n.title_mr || '');
    setBody(n.body || '');
    setBodyMr(n.body_mr || '');
    setCategory(n.category || 'general');
    setExpiresAt(n.expires_at ? n.expires_at.slice(0, 10) : '');
    setAttachmentUrl(n.attachment_url || '');
    setIsPinned(Boolean(n.is_pinned));
    setIsActive(Boolean(n.is_active));
    setComposerOpen(true);
  };

  const invalidateNotices = () => {
    qc.invalidateQueries({ queryKey: ['school-notices-owner', school.id] });
    qc.invalidateQueries({ queryKey: ['school-notices-public', school.id] });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Notice title is required');
      return;
    }
    const cleanAttach = attachmentUrl.trim() ? normalizeHttpUrl(attachmentUrl) : null;
    if (attachmentUrl.trim() && !cleanAttach) {
      toast.error('Attachment link must start with http:// or https://');
      return;
    }

    setSubmitting(true);
    try {
      const expiryIso = expiresAt ? new Date(`${expiresAt}T23:59:59`).toISOString() : null;
      if (editingNotice) {
        await schoolNoticesRepo.update(editingNotice.id, {
          title: title.trim(),
          title_mr: titleMr.trim() || null,
          body: body.trim(),
          body_mr: bodyMr.trim() || null,
          category,
          attachment_url: cleanAttach,
          expires_at: expiryIso,
          is_pinned: isPinned,
          is_active: isActive,
        });
        toast.success('Notice updated!');
      } else {
        await schoolNoticesRepo.create({
          school_id: school.id,
          title: title.trim(),
          title_mr: titleMr.trim() || null,
          body: body.trim(),
          body_mr: bodyMr.trim() || null,
          category,
          attachment_url: cleanAttach,
          expires_at: expiryIso,
          is_pinned: isPinned,
          is_active: isActive,
        });
        toast.success(t('schoolOwner.toast.noticePosted') || 'Notice published!');
      }
      invalidateNotices();
      resetComposer();
    } catch (err: any) {
      if (isMissingRelationErr(err)) {
        toast.error('Notice Board table not created yet — apply migration 20261112000000 in Supabase SQL.');
      } else {
        toast.error(err?.message || 'Failed to save notice');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const togglePin = async (n: SchoolNotice) => {
    try {
      await schoolNoticesRepo.update(n.id, { is_pinned: !n.is_pinned });
      invalidateNotices();
      toast.success(n.is_pinned ? 'Unpinned notice' : 'Pinned notice to top');
    } catch (err: any) {
      toast.error(err?.message || 'Update failed');
    }
  };

  const toggleActive = async (n: SchoolNotice) => {
    try {
      await schoolNoticesRepo.update(n.id, { is_active: !n.is_active });
      invalidateNotices();
      toast.success(n.is_active ? 'Notice hidden from public' : 'Notice is now visible');
    } catch (err: any) {
      toast.error(err?.message || 'Update failed');
    }
  };

  const handleDelete = (n: SchoolNotice) => {
    toast('Delete this circular?', {
      description: n.title,
      action: {
        label: 'Delete',
        onClick: async () => {
          try {
            await schoolNoticesRepo.remove(n.id);
            invalidateNotices();
            toast.success('Notice deleted');
          } catch (err: any) {
            toast.error(err?.message || 'Delete failed');
          }
        },
      },
      duration: 6000,
    });
  };

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-2xl border border-border p-4 shadow-sm">
        <div className="flex flex-wrap items-start sm:items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
              <Bell className="w-4 h-4 text-primary" />
              Live Campus Notice Board ({notices.length})
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Post merit lists, scholarship forms, exam schedules, or admission dates directly to your public campus page.
            </p>
          </div>
          {!composerOpen && (
            <button
              type="button"
              onClick={() => setComposerOpen(true)}
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90"
            >
              <Plus className="w-3.5 h-3.5" />
              Post Notice
            </button>
          )}
        </div>

        {composerOpen && (
          <form onSubmit={handleSubmit} className="mt-4 pt-4 border-t border-border space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-foreground">
                {editingNotice ? 'Edit Circular' : 'New Notice / Circular'}
              </span>
              <TranslateAllButton
                pairs={[
                  { source: title, value: titleMr, onChange: setTitleMr },
                  { source: body, value: bodyMr, onChange: setBodyMr },
                ]}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Category">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as NoticeCategory)}
                  className={inputCls}
                >
                  {NOTICE_CATEGORY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Auto-Hide / Expiry Date (Optional)">
                <input
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className={inputCls}
                />
              </Field>
            </div>

            <Field label="Notice Headline (English) *">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={inputCls}
                placeholder="e.g. FYJC Science Merit List Round 1 Declared"
                maxLength={140}
              />
            </Field>
            <MarathiMirrorField
              label="सूचना शीर्षक (मराठी)"
              value={titleMr}
              onChange={setTitleMr}
              placeholder="मराठी शीर्षक"
            />

            <Field label="Details / Instructions (English)">
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={3}
                className={inputCls + ' resize-y'}
                placeholder="Reporting dates, documents to carry, timing..."
              />
            </Field>
            <MarathiMirrorField
              label="तपशील (मराठी)"
              value={bodyMr}
              onChange={setBodyMr}
              textarea
              rows={2}
            />

            <Field label="Circular PDF / Form Link (Optional)">
              <input
                type="url"
                value={attachmentUrl}
                onChange={(e) => setAttachmentUrl(e.target.value)}
                className={inputCls}
                placeholder="https://.../merit-list.pdf"
              />
            </Field>

            <div className="flex flex-wrap gap-4">
              <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPinned}
                  onChange={(e) => setIsPinned(e.target.checked)}
                  className="w-4 h-4 accent-primary rounded"
                />
                Pin to top of notice board
              </label>
              <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 accent-primary rounded"
                />
                Visible to public
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={resetComposer}
                className="px-3.5 py-2 rounded-xl border border-border text-xs font-semibold hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold inline-flex items-center gap-1.5 hover:bg-primary/90 disabled:opacity-50"
              >
                {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                {editingNotice ? 'Update Circular' : 'Publish Notice'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin inline" />
        </div>
      ) : notices.length === 0 ? (
        <div className="bg-card rounded-2xl border border-dashed border-border p-8 text-center">
          <FileText className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-sm font-semibold text-foreground">No notices posted yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Publish your first announcement so parents & students stay informed.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {notices.map((n) => {
            const catCfg = NOTICE_CATEGORY_CONFIG[n.category] || NOTICE_CATEGORY_CONFIG.general;
            const expired = Boolean(n.expires_at && +new Date(n.expires_at) < Date.now());
            return (
              <div
                key={n.id}
                className={cn(
                  'bg-card rounded-xl border p-3.5 space-y-2 transition-all',
                  n.is_pinned ? 'border-primary/40 bg-primary/5' : 'border-border',
                  (!n.is_active || expired) && 'opacity-65',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${catCfg.badgeClass}`}>
                      {catCfg.emoji} {isMr ? catCfg.labelMr : catCfg.labelEn}
                    </span>
                    {n.is_pinned && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary font-bold inline-flex items-center gap-0.5">
                        <Pin className="w-2.5 h-2.5" /> Pinned
                      </span>
                    )}
                    {!n.is_active && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-semibold">
                        Hidden
                      </span>
                    )}
                    {expired && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-destructive/15 text-destructive font-semibold">
                        Expired
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {new Date(n.created_at).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </span>
                </div>

                <div>
                  <h4 className="font-bold text-sm text-foreground">{isMr && n.title_mr ? n.title_mr : n.title}</h4>
                  {(isMr && n.body_mr ? n.body_mr : n.body) && (
                    <p className="text-xs text-muted-foreground mt-1 whitespace-pre-line">
                      {isMr && n.body_mr ? n.body_mr : n.body}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between pt-2 border-t border-border/60 gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => togglePin(n)}
                      className="px-2 py-1 rounded-lg border border-border text-[11px] font-semibold hover:bg-muted inline-flex items-center gap-1"
                    >
                      <Pin className="w-3 h-3" /> {n.is_pinned ? 'Unpin' : 'Pin'}
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleActive(n)}
                      className="px-2 py-1 rounded-lg border border-border text-[11px] font-semibold hover:bg-muted inline-flex items-center gap-1"
                    >
                      <Eye className="w-3 h-3" /> {n.is_active ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => openEdit(n)}
                      className="p-1.5 rounded-lg text-primary hover:bg-primary/10"
                      aria-label="Edit notice"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(n)}
                      className="p-1.5 rounded-lg text-destructive hover:bg-destructive/10"
                      aria-label="Delete notice"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── Analytics & Card Preview Sub-Panel ─────────────────────────────────── */
function SchoolAnalyticsAndPreview({
  school,
  name,
  nameMr,
  area,
  phone,
  coverUrl,
  admissionStatus,
  feeTier,
  mediums,
  transportVillages,
  publicSlugPath,
  isMr,
}: {
  school: SchoolRow;
  name: string;
  nameMr: string;
  area: string;
  phone: string;
  coverUrl: string | null;
  admissionStatus: AdmissionStatus;
  feeTier: FeeTier;
  mediums: string[];
  transportVillages: string[];
  publicSlugPath: string;
  isMr: boolean;
}) {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['school-engagement-30d', school.id],
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await (supabase.from('school_engagement' as any) as any)
        .select('event_type')
        .eq('school_id', school.id)
        .gte('created_at', since);
      if (error) {
        if (isMissingRelationErr(error)) {
          return { calls: 0, whatsapp: 0, website: 0, maps: 0, prospectus: 0, total: 0 };
        }
        throw error;
      }
      const rows = (data || []) as { event_type: string }[];
      const calls = rows.filter((r) => r.event_type === 'call').length;
      const whatsapp = rows.filter((r) => r.event_type === 'whatsapp').length;
      const website = rows.filter((r) => r.event_type === 'website').length;
      const maps = rows.filter((r) => r.event_type === 'maps').length;
      const prospectus = rows.filter((r) => r.event_type === 'prospectus').length;
      return { calls, whatsapp, website, maps, prospectus, total: rows.length };
    },
  });

  const resolvedType = resolveSchoolType({ school_type: school.school_type, description: school.description });
  const typeCfg = SCHOOL_TYPE_CONFIG[resolvedType] || SCHOOL_TYPE_CONFIG.other;
  const admCfg = ADMISSION_STATUS_CONFIG[admissionStatus] || ADMISSION_STATUS_CONFIG.open;
  const medCfg = mediums[0] ? SCHOOL_MEDIUM_CONFIG[mediums[0] as keyof typeof SCHOOL_MEDIUM_CONFIG] : null;

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-2xl border border-border p-4 shadow-sm">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
          Last 30 Days Parent & Student Engagement
        </p>
        {isLoading ? (
          <div className="text-center py-6">
            <Loader2 className="w-5 h-5 animate-spin inline text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
            <MetricBox icon={<Phone className="w-3.5 h-3.5" />} label="Calls" value={stats?.calls ?? 0} />
            <MetricBox icon={<MessageCircle className="w-3.5 h-3.5" />} label="WhatsApp" value={stats?.whatsapp ?? 0} />
            <MetricBox icon={<ExternalLink className="w-3.5 h-3.5" />} label="Website" value={stats?.website ?? 0} />
            <MetricBox icon={<MapPin className="w-3.5 h-3.5" />} label="Directions" value={stats?.maps ?? 0} />
            <MetricBox icon={<FileText className="w-3.5 h-3.5" />} label="Prospectus" value={stats?.prospectus ?? 0} />
          </div>
        )}
      </div>

      {/* Directory Card Preview */}
      <div className="bg-card rounded-2xl border border-border p-4 space-y-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Live Directory Card Preview
          </p>
          <Link to={publicSlugPath} target="_blank" className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1">
            Open Full Page <ExternalLink className="w-3 h-3" />
          </Link>
        </div>

        <div className="rounded-2xl border border-border bg-background overflow-hidden shadow-xs">
          {coverUrl && (
            <img src={coverUrl} alt={name} className="w-full h-36 object-cover" />
          )}
          <div className="p-3.5 space-y-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`text-[10px] px-2 py-0.5 rounded-md font-medium border ${typeCfg.badgeClass}`}>
                {isMr ? typeCfg.labelMr : typeCfg.labelEn.split(' (')[0]}
              </span>
              {medCfg && (
                <span className={`text-[10px] px-2 py-0.5 rounded-md font-medium border ${medCfg.badgeClass}`}>
                  {isMr ? medCfg.labelMr : medCfg.labelEn}
                </span>
              )}
              <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${admCfg.badgeClass}`}>
                {isMr ? admCfg.labelMr : admCfg.labelEn}
              </span>
            </div>
            <div>
              <h4 className="font-bold text-sm text-foreground">{name || school.name}</h4>
              {nameMr && <p className="text-xs text-muted-foreground">{nameMr}</p>}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
              {area && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> {area}
                </span>
              )}
              {phone && (
                <span className="inline-flex items-center gap-1 tabular-nums">
                  <Phone className="w-3 h-3" /> {phone}
                </span>
              )}
              <span className="capitalize">Fee: {feeTier}</span>
            </div>
            {transportVillages.length > 0 && (
              <p className="text-[11px] text-emerald-700 dark:text-emerald-300 font-medium">
                🚌 Bus routes: {transportVillages.slice(0, 4).join(', ')}
                {transportVillages.length > 4 ? ` +${transportVillages.length - 4}` : ''}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricBox({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-muted/40 p-2.5 text-center">
      <div className="inline-flex items-center gap-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
        {icon} {label}
      </div>
      <div className="text-xl font-bold text-foreground mt-0.5">{value}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-foreground mb-1">{label}</span>
      {children}
    </label>
  );
}
