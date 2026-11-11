import { useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  X, Loader2, ShieldCheck, GraduationCap, MapPin, Link2, Plus,
  Trash2, UserCheck, ChevronDown, ChevronRight, Sparkles, Bus, Award, FileCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { MultiImageCropPicker } from '@/components/shared/MultiImageCropPicker';
import { LocationMapPicker, MUKTAINAGAR_CENTER } from '@/components/shared/LocationMapPicker';
import { MarathiMirrorField } from '@/components/shared/MarathiMirrorField';
import { TranslateAllButton } from '@/components/shared/TranslateAllButton';
import { uploadShopImage, removeShopImages, diffRemovedStoragePaths } from '@/lib/storageNaming';
import { parseGoogleMapsLink } from '@/lib/mapsUtils';
import { isSafeHttpUrl, inputCls } from '@/lib/utils';
import {
  schoolsRepo,
  type SchoolRow,
  type SchoolType,
  type SchoolMedium,
} from '@/lib/repos/schoolsRepo';
import {
  SCHOOL_TYPE_OPTIONS,
  SCHOOL_MEDIUM_CONFIG,
  COMMON_BOARDS,
  COMMON_FACILITIES,
  COMMON_SCHOLARSHIPS,
  COMMON_DOCUMENTS,
  COACHING_FOCUS_OPTIONS,
  ADMISSION_STATUS_OPTIONS,
  MANAGEMENT_TYPE_OPTIONS,
  GENDER_TYPE_OPTIONS,
  FEE_TIER_OPTIONS,
  getSchoolResolvedMeta,
  serializeSchoolDescription,
  toDbSchoolType,
  resolveSchoolType,
  type AdmissionStatus,
  type ManagementType,
  type GenderType,
  type FeeTier,
} from '@/lib/schools/schoolHelpers';
import { useCity } from '@/hooks/useCity';
import { fetchVillagesForCity } from '@/lib/geo/geoService';
import { normalizeWhatsApp } from '@/components/admin/adminHelpers';

interface Props {
  school: Partial<SchoolRow> & { id?: string };
  onClose: () => void;
  onSaved: () => void;
}

function normalizeHttpUrl(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  const candidate = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  return isSafeHttpUrl(candidate) ? candidate : null;
}

export function SchoolModal({ school, onClose, onSaved }: Props) {
  const { currentCity, allCities, townName } = useCity();
  const qc = useQueryClient();
  const isEdit = Boolean(school.id);

  const meta = useMemo(() => getSchoolResolvedMeta(school), [school]);
  const initialType = resolveSchoolType({
    school_type: (school.school_type as string) || 'other',
    description: school.description,
  });

  const initialPhotos = useMemo(() => {
    if (Array.isArray(school.photos) && school.photos.length > 0) return school.photos;
    if (school.image_url) return [school.image_url];
    return [];
  }, [school.photos, school.image_url]);

  const initialMediums = useMemo(() => {
    const set = new Set<string>();
    if (Array.isArray(meta.mediums)) meta.mediums.forEach((m) => m && set.add(m));
    if (school.medium) set.add(school.medium);
    return Array.from(set);
  }, [meta.mediums, school.medium]);

  // Photos & geography
  const initialSavedUrlsRef = useRef<string[]>(initialPhotos);
  const sessionUploadedUrlsRef = useRef<Set<string>>(new Set());
  const [photos, setPhotos] = useState<string[]>(initialPhotos);
  const [uploadingImage, setUploadingImage] = useState(false);

  const handleClose = () => {
    if (saving) return;
    const unsavedPaths = diffRemovedStoragePaths(
      Array.from(sessionUploadedUrlsRef.current),
      initialSavedUrlsRef.current,
    );
    if (unsavedPaths.length > 0) void removeShopImages(unsavedPaths);
    onClose();
  };
  const [cityId, setCityId] = useState<string>(school.city_id || currentCity.id);
  const [villageId, setVillageId] = useState<string>(school.village_id || '');

  // Identity & verification
  const [name, setName] = useState(school.name ?? '');
  const [nameMr, setNameMr] = useState(school.name_mr ?? '');
  const [schoolType, setSchoolType] = useState<SchoolType>(initialType || 'secondary');
  const [managementType, setManagementType] = useState<ManagementType | ''>(
    (meta.management_type as ManagementType) || ''
  );
  const [genderType, setGenderType] = useState<GenderType>(
    (meta.gender_type as GenderType) || 'coed'
  );
  const [udiseCode, setUdiseCode] = useState(meta.udise_aishe_code ?? '');
  const [establishedYear, setEstablishedYear] = useState(
    meta.established_year ? String(meta.established_year) : ''
  );
  const [accreditation, setAccreditation] = useState(meta.accreditation ?? '');
  const [isActive, setIsActive] = useState<boolean>(school.is_active ?? true);
  const [isVerified, setIsVerified] = useState<boolean>(Boolean(school.is_verified));

  // Academics & Admissions
  const [board, setBoard] = useState(meta.board ?? '');
  const [classesOffered, setClassesOffered] = useState(meta.classes_offered ?? '');
  const [mediums, setMediums] = useState<string[]>(initialMediums);
  const [streams, setStreams] = useState((meta.streams || []).join(', '));
  const [coachingFocus, setCoachingFocus] = useState<string[]>(meta.coaching_focus ?? []);
  const [admissionStatus, setAdmissionStatus] = useState<AdmissionStatus | 'unknown'>(
    (meta.admission_status as AdmissionStatus) || 'unknown'
  );
  const [admissionDeadline, setAdmissionDeadline] = useState(
    meta.admission_deadline ? String(meta.admission_deadline).slice(0, 10) : ''
  );
  const [admissionUrl, setAdmissionUrl] = useState(meta.admission_url ?? '');
  const [prospectusUrl, setProspectusUrl] = useState(meta.prospectus_url ?? '');
  const [feeTier, setFeeTier] = useState<FeeTier | 'unspecified'>(
    (meta.fee_tier as FeeTier) || 'unspecified'
  );
  const [feeMin, setFeeMin] = useState(
    meta.annual_fee_min != null ? String(meta.annual_fee_min) : ''
  );
  const [feeMax, setFeeMax] = useState(
    meta.annual_fee_max != null ? String(meta.annual_fee_max) : ''
  );
  const [totalSeats, setTotalSeats] = useState(
    meta.total_seats != null ? String(meta.total_seats) : ''
  );
  const [availableSeats, setAvailableSeats] = useState(
    meta.available_seats != null ? String(meta.available_seats) : ''
  );
  const [scholarships, setScholarships] = useState<string[]>(meta.scholarships ?? []);
  const [requiredDocuments, setRequiredDocuments] = useState<string[]>(
    meta.required_documents ?? []
  );

  // Contact, Facilities, Bus Routes
  const [phone, setPhone] = useState(school.phone ?? '');
  const [whatsapp, setWhatsapp] = useState(school.whatsapp ?? '');
  const [email, setEmail] = useState(school.email ?? '');
  const [website, setWebsite] = useState(school.website ?? '');
  const [principalName, setPrincipalName] = useState(meta.principal_name ?? '');
  const [officeTiming, setOfficeTiming] = useState(meta.office_timing ?? '');
  const [facilities, setFacilities] = useState<string[]>(meta.facilities ?? []);
  const [transportVillages, setTransportVillages] = useState<string[]>(
    meta.transport_villages ?? []
  );
  const [villageChipInput, setVillageChipInput] = useState('');
  const [customScholarship, setCustomScholarship] = useState('');
  const [description, setDescription] = useState(meta.raw_description ?? '');

  // Location & Marathi address
  const [area, setArea] = useState(school.area ?? '');
  const [subArea, setSubArea] = useState(school.sub_area ?? '');
  const [address, setAddress] = useState(school.address ?? '');
  const [addressMr, setAddressMr] = useState(school.address_mr ?? '');
  const [latitude, setLatitude] = useState(
    school.latitude != null ? String(school.latitude) : ''
  );
  const [longitude, setLongitude] = useState(
    school.longitude != null ? String(school.longitude) : ''
  );
  const [mapsLink, setMapsLink] = useState('');

  // Accordion UI sections & saving state
  const [openSection, setOpenSection] = useState<
    'identity' | 'academics' | 'facilities' | 'location' | 'owners'
  >('identity');
  const [saving, setSaving] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const selectedCityObj = useMemo(
    () => allCities.find((c) => c.id === cityId) || currentCity,
    [allCities, cityId, currentCity]
  );

  const { data: cityVillages = [] } = useQuery({
    queryKey: ['admin-school-villages', cityId],
    queryFn: () => fetchVillagesForCity(cityId),
    enabled: !!cityId,
  });

  const { data: owners = [], refetch: refetchOwners } = useQuery({
    queryKey: ['school-owners-modal', school.id],
    queryFn: () => schoolsRepo.listOwnersForSchool(school.id!),
    enabled: isEdit && Boolean(school.id),
  });

  const toggleArrItem = (
    list: string[],
    setter: (next: string[]) => void,
    item: string
  ) => {
    setter(list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);
  };

  const handleAddTransportVillage = (raw?: string) => {
    const val = (raw ?? villageChipInput).trim();
    if (!val) return;
    if (!transportVillages.some((v) => v.toLowerCase() === val.toLowerCase())) {
      setTransportVillages([...transportVillages, val]);
    }
    if (!raw) setVillageChipInput('');
  };

  const handleParseMapsLink = () => {
    if (!mapsLink.trim()) return;
    const coords = parseGoogleMapsLink(mapsLink);
    if (!coords) {
      toast.error('Could not extract lat/lng from link. Paste a Google Maps URL with @lat,lng or ?q=lat,lng');
      return;
    }
    setLatitude(coords.lat.toFixed(6));
    setLongitude(coords.lng.toFixed(6));
    toast.success(`Coordinates extracted: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`);
    setMapsLink('');
  };

  const handleRevokeOwner = async (userId: string, fullName: string | null) => {
    if (!school.id) return;
    setRevokingId(userId);
    try {
      const { error } = await supabase.rpc('revoke_school_owner' as any, {
        _school_id: school.id,
        _user_id: userId,
      });
      if (error) throw error;
      toast.success(`Removed access for ${fullName || 'user'}`);
      await refetchOwners();
      qc.invalidateQueries({ queryKey: ['admin-owners-grouped'] });
      qc.invalidateQueries({ queryKey: ['admin-schools'] });
    } catch (err: any) {
      toast.error(err?.message || 'Failed to revoke institute owner');
    } finally {
      setRevokingId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error('Institute Name (English) is required');
      setOpenSection('identity');
      return;
    }

    if (website.trim() && !normalizeHttpUrl(website)) {
      toast.error('Website URL must be a valid http:// or https:// link');
      setOpenSection('facilities');
      return;
    }
    if (admissionUrl.trim() && !normalizeHttpUrl(admissionUrl)) {
      toast.error('Admission Portal URL must be a valid http:// or https:// link');
      setOpenSection('academics');
      return;
    }
    if (prospectusUrl.trim() && !normalizeHttpUrl(prospectusUrl)) {
      toast.error('Prospectus PDF/Link URL must be a valid http:// or https:// link');
      setOpenSection('academics');
      return;
    }

    setSaving(true);
    try {
      const dbType = toDbSchoolType(schoolType);
      const parsedStreams = streams
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const finalDescription = serializeSchoolDescription({
        type_override: schoolType !== dbType ? schoolType : undefined,
        board: board.trim() || undefined,
        streams: parsedStreams.length > 0 ? parsedStreams : undefined,
        facilities: facilities.length > 0 ? facilities : undefined,
        principal_name: principalName.trim() || undefined,
        office_timing: officeTiming.trim() || undefined,
        raw_description: description.trim(),
      });

      const primaryMedium = (mediums[0] || null) as SchoolMedium | null;
      const latNum = latitude.trim() ? Number(latitude) : null;
      const lngNum = longitude.trim() ? Number(longitude) : null;
      const estYearNum = establishedYear.trim() ? Number(establishedYear) : null;
      const feeMinNum = feeMin.trim() ? Number(feeMin) : null;
      const feeMaxNum = feeMax.trim() ? Number(feeMax) : null;
      const totalSeatsNum = totalSeats.trim() ? Number(totalSeats) : null;
      const availSeatsNum = availableSeats.trim() ? Number(availableSeats) : null;

      const resolvedStateId =
        selectedCityObj?.district?.state_id ??
        (selectedCityObj as any)?.state_id ??
        null;

      const payload: Record<string, any> = {
        name: trimmedName,
        name_mr: nameMr.trim() || null,
        school_type: dbType,
        medium: primaryMedium,
        mediums: mediums,
        area: area.trim() || null,
        sub_area: subArea.trim() || null,
        address: address.trim() || null,
        address_mr: addressMr.trim() || null,
        phone: phone.trim() || null,
        whatsapp: whatsapp.trim() ? normalizeWhatsApp(whatsapp.trim()) : null,
        email: email.trim() || null,
        website: normalizeHttpUrl(website),
        description: finalDescription || null,
        image_url: photos[0] || null,
        photos: photos,
        latitude: latNum !== null && !Number.isNaN(latNum) ? latNum : null,
        longitude: lngNum !== null && !Number.isNaN(lngNum) ? lngNum : null,
        is_active: isActive,
        is_verified: isVerified,
        management_type: managementType || null,
        gender_type: genderType || 'coed',
        udise_aishe_code: udiseCode.trim() || null,
        established_year: estYearNum && !Number.isNaN(estYearNum) ? estYearNum : null,
        accreditation: accreditation.trim() || null,
        board: board.trim() || null,
        classes_offered: classesOffered.trim() || null,
        streams: parsedStreams,
        facilities: facilities,
        principal_name: principalName.trim() || null,
        office_timing: officeTiming.trim() || null,
        admission_status: admissionStatus || 'unknown',
        admission_deadline: admissionDeadline || null,
        admission_url: normalizeHttpUrl(admissionUrl),
        prospectus_url: normalizeHttpUrl(prospectusUrl),
        fee_tier: feeTier || 'unspecified',
        annual_fee_min: feeMinNum !== null && !Number.isNaN(feeMinNum) ? feeMinNum : null,
        annual_fee_max: feeMaxNum !== null && !Number.isNaN(feeMaxNum) ? feeMaxNum : null,
        scholarships: scholarships,
        required_documents: requiredDocuments,
        transport_villages: transportVillages,
        coaching_focus: coachingFocus,
        total_seats: totalSeatsNum !== null && !Number.isNaN(totalSeatsNum) ? totalSeatsNum : null,
        available_seats: availSeatsNum !== null && !Number.isNaN(availSeatsNum) ? availSeatsNum : null,
        city_id: cityId,
        village_id: villageId || null,
        district_id: selectedCityObj?.district_id || null,
        state_id: resolvedStateId,
      };

      const result = isEdit
        ? await schoolsRepo.updateWithConcurrency(school.id!, school.updated_at, payload)
        : await schoolsRepo.insert(payload);

      if (!result.ok) {
        const msg = 'error' in result ? result.error : 'Save conflict — someone edited this institute. Reload and try again.';
        toast.error(`Failed to save: ${msg}`);
        return;
      }

      const discardedPaths = diffRemovedStoragePaths(
        [...initialSavedUrlsRef.current, ...Array.from(sessionUploadedUrlsRef.current)],
        photos,
      );
      if (discardedPaths.length > 0) {
        void removeShopImages(discardedPaths);
      }

      toast.success(isEdit ? 'Institute updated' : 'Institute added');
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/55 backdrop-blur-xs z-50 flex items-start sm:items-center justify-center p-2 sm:p-4 overflow-y-auto"
      onClick={handleClose}
    >
      <div
        className="bg-card rounded-2xl border border-border w-full max-w-3xl shadow-2xl my-auto flex flex-col max-h-[94dvh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky Header */}
        <div className="flex items-center justify-between gap-2 px-4 sm:px-5 py-3.5 border-b border-border bg-card rounded-t-2xl shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <GraduationCap className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-base sm:text-lg text-foreground truncate">
                {isEdit ? `Edit: ${school.name || 'Institute'}` : 'Add New Educational Institute'}
              </h2>
              <p className="text-[11px] text-muted-foreground truncate">
                Admissions, scholarships, coaching seats, Marathi mirror, GPS & verification
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-4 sm:p-5 space-y-3 flex-1">
          {/* ── 1. Identity, Photos, Marathi & Governance ── */}
          <SectionBox
            title="1. Identity, Campus Photos & Marathi Mirror"
            open={openSection === 'identity'}
            onToggle={() => setOpenSection(openSection === 'identity' ? 'academics' : 'identity')}
            badge={isVerified ? 'Verified' : undefined}
          >
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Campus Photos (Slot 1 = Cover Photo, Up to 5)
              </label>
              <MultiImageCropPicker
                photos={photos}
                onChange={setPhotos}
                maxPhotos={5}
                uploading={uploadingImage}
                onUploadFile={async (blob) => {
                  setUploadingImage(true);
                  try {
                    const { publicUrl, isExisting } = await uploadShopImage(
                      blob,
                      name || 'school',
                      { prefix: 'school' }
                    );
                    if (!isExisting) sessionUploadedUrlsRef.current.add(publicUrl);
                    return publicUrl;
                  } catch (err: any) {
                    toast.error(`Image upload failed: ${err?.message ?? 'error'}`);
                    throw err;
                  } finally {
                    setUploadingImage(false);
                  }
                }}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">City / Taluka *</label>
                <select
                  value={cityId}
                  onChange={(e) => {
                    setCityId(e.target.value);
                    setVillageId('');
                  }}
                  className={inputCls}
                >
                  {allCities.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.name_mr ? `(${c.name_mr})` : ''} — {c.type}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Village / Locality</label>
                <select
                  value={villageId}
                  onChange={(e) => setVillageId(e.target.value)}
                  className={inputCls}
                >
                  <option value="">Main City / General Area</option>
                  {cityVillages.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} {v.name_mr ? `(${v.name_mr})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <span className="text-[11px] text-muted-foreground min-w-[180px] flex-1">
                Fill English names/address first, then click Translate to auto-populate Marathi.
              </span>
              <TranslateAllButton
                pairs={[
                  { source: name, value: nameMr, onChange: setNameMr },
                  { source: address, value: addressMr, onChange: setAddressMr },
                ]}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Institute Name (English) *
                </label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={140}
                  placeholder="e.g. Z.P. Primary School, Parandwadi"
                  className={inputCls}
                />
              </div>
              <MarathiMirrorField
                label="Institute Name (मराठी)"
                value={nameMr}
                onChange={setNameMr}
                maxLength={140}
                placeholder="उदा. जि.प. प्राथमिक शाळा, परंदवडी"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Category / Level *</label>
                <select
                  value={schoolType}
                  onChange={(e) => setSchoolType(e.target.value as SchoolType)}
                  className={inputCls}
                >
                  {SCHOOL_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Management Type</label>
                <select
                  value={managementType}
                  onChange={(e) => setManagementType(e.target.value as ManagementType | '')}
                  className={inputCls}
                >
                  <option value="">Unspecified</option>
                  {MANAGEMENT_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Student Composition</label>
                <select
                  value={genderType}
                  onChange={(e) => setGenderType(e.target.value as GenderType)}
                  className={inputCls}
                >
                  {GENDER_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">UDISE+ / AISHE / DTE Code</label>
                <input
                  value={udiseCode}
                  onChange={(e) => setUdiseCode(e.target.value)}
                  placeholder="e.g. 27250804501 or C-41298"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Established Year</label>
                <input
                  type="number"
                  min={1800}
                  max={2099}
                  value={establishedYear}
                  onChange={(e) => setEstablishedYear(e.target.value)}
                  placeholder="e.g. 1968"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Accreditation / NAAC Grade</label>
                <input
                  value={accreditation}
                  onChange={(e) => setAccreditation(e.target.value)}
                  placeholder="e.g. NAAC Grade A, ISO 9001"
                  className={inputCls}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-4 pt-2 border-t border-border/60">
              <label className="flex items-center gap-2 text-xs font-semibold text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 accent-primary rounded"
                />
                <span>Active (Visible in Public Directory)</span>
              </label>
              <label className="flex items-center gap-2 text-xs font-semibold text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={isVerified}
                  onChange={(e) => setIsVerified(e.target.checked)}
                  className="w-4 h-4 accent-emerald-600 rounded"
                />
                <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Verified Institute (Official Checkmark)
                </span>
              </label>
            </div>
          </SectionBox>

          {/* ── 2. Academics, Admissions, Fees & Scholarships ── */}
          <SectionBox
            title="2. Academics, Admissions, Seats, Fees & Scholarships"
            open={openSection === 'academics'}
            onToggle={() => setOpenSection(openSection === 'academics' ? 'facilities' : 'academics')}
            badge={admissionStatus !== 'unknown' ? admissionStatus.toUpperCase() : undefined}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Board / University Affiliation</label>
                <select
                  value={COMMON_BOARDS.some((b) => b.value === board) ? board : (board ? '__custom__' : '')}
                  onChange={(e) => {
                    if (e.target.value !== '__custom__') setBoard(e.target.value);
                  }}
                  className={inputCls}
                >
                  <option value="">Select Board / University</option>
                  {COMMON_BOARDS.map((b) => (
                    <option key={b.value} value={b.value}>{b.label}</option>
                  ))}
                  {board && !COMMON_BOARDS.some((b) => b.value === board) && (
                    <option value="__custom__">{board}</option>
                  )}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Classes / Degrees Offered</label>
                <input
                  value={classesOffered}
                  onChange={(e) => setClassesOffered(e.target.value)}
                  placeholder="e.g. 1st to 10th (SSC), or B.E. / M.E."
                  className={inputCls}
                />
              </div>
            </div>

            {/* Multi-select Mediums */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Medium(s) of Instruction (first picked is primary)
              </label>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(SCHOOL_MEDIUM_CONFIG) as SchoolMedium[]).map((mKey) => {
                  const active = mediums.includes(mKey);
                  return (
                    <button
                      key={mKey}
                      type="button"
                      onClick={() => toggleArrItem(mediums, setMediums, mKey)}
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${
                        active
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background text-foreground border-border hover:bg-muted'
                      }`}
                    >
                      {SCHOOL_MEDIUM_CONFIG[mKey].labelEn}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Streams / Key Courses / Departments (comma-separated)
              </label>
              <input
                value={streams}
                onChange={(e) => setStreams(e.target.value)}
                placeholder="e.g. Science, Commerce, Arts, Computer Engg, Mechanical"
                className={inputCls}
              />
            </div>

            {schoolType === 'coaching' && (
              <div className="p-3 rounded-xl border border-cyan-500/30 bg-cyan-500/5 space-y-2">
                <label className="block text-xs font-bold text-cyan-800 dark:text-cyan-300">
                  Coaching / Competitive Exam Focus
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {COACHING_FOCUS_OPTIONS.map((opt) => (
                    <label key={opt} className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={coachingFocus.includes(opt)}
                        onChange={() => toggleArrItem(coachingFocus, setCoachingFocus, opt)}
                        className="w-4 h-4 accent-cyan-600 rounded"
                      />
                      <span>{opt}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Admissions Row */}
            <div className="p-3 rounded-xl border border-emerald-500/25 bg-emerald-500/5 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Live Admission Status</label>
                  <select
                    value={admissionStatus}
                    onChange={(e) => setAdmissionStatus(e.target.value as AdmissionStatus | 'unknown')}
                    className={inputCls}
                  >
                    <option value="unknown">Unspecified / Standard</option>
                    {ADMISSION_STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Admission Deadline</label>
                  <input
                    type="date"
                    value={admissionDeadline}
                    onChange={(e) => setAdmissionDeadline(e.target.value)}
                    className={inputCls}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Online Apply / CAP Form URL</label>
                  <input
                    type="url"
                    value={admissionUrl}
                    onChange={(e) => setAdmissionUrl(e.target.value)}
                    placeholder="https://…"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Prospectus / Brochure PDF URL</label>
                  <input
                    type="url"
                    value={prospectusUrl}
                    onChange={(e) => setProspectusUrl(e.target.value)}
                    placeholder="https://…"
                    className={inputCls}
                  />
                </div>
              </div>
            </div>

            {/* Fee & Seats Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-2.5">
              <div className="sm:col-span-2 md:col-span-2">
                <label className="block text-xs font-semibold text-foreground mb-1">Fee Tier</label>
                <select
                  value={feeTier}
                  onChange={(e) => setFeeTier(e.target.value as FeeTier | 'unspecified')}
                  className={inputCls}
                >
                  <option value="unspecified">Unspecified</option>
                  {FEE_TIER_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Min Fee (₹/yr)</label>
                <input
                  type="number"
                  min={0}
                  value={feeMin}
                  onChange={(e) => setFeeMin(e.target.value)}
                  placeholder="0"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Max Fee (₹/yr)</label>
                <input
                  type="number"
                  min={0}
                  value={feeMax}
                  onChange={(e) => setFeeMax(e.target.value)}
                  placeholder="45000"
                  className={inputCls}
                />
              </div>
              <div className="sm:col-span-2 md:col-span-2">
                <label className="block text-xs font-semibold text-foreground mb-1">Seats (Avail / Total)</label>
                <div className="flex gap-1.5">
                  <input
                    type="number"
                    min={0}
                    value={availableSeats}
                    onChange={(e) => setAvailableSeats(e.target.value)}
                    placeholder="Avl"
                    aria-label="Available Seats"
                    className={inputCls + ' px-2 min-w-0 flex-1'}
                  />
                  <input
                    type="number"
                    min={0}
                    value={totalSeats}
                    onChange={(e) => setTotalSeats(e.target.value)}
                    placeholder="Tot"
                    aria-label="Total Seats"
                    className={inputCls + ' px-2 min-w-0 flex-1'}
                  />
                </div>
              </div>
            </div>

            {/* Scholarships */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Award className="w-3.5 h-3.5 text-purple-600" />
                Scholarships & Fee Waivers Accepted
              </label>
              <div className="flex flex-wrap gap-1.5">
                {COMMON_SCHOLARSHIPS.map((sch) => {
                  const active = scholarships.includes(sch);
                  return (
                    <button
                      key={sch}
                      type="button"
                      onClick={() => toggleArrItem(scholarships, setScholarships, sch)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                        active
                          ? 'bg-purple-600 text-white border-purple-600'
                          : 'bg-background text-foreground border-border hover:bg-muted'
                      }`}
                    >
                      {sch}
                    </button>
                  );
                })}
                {scholarships
                  .filter((s) => !COMMON_SCHOLARSHIPS.includes(s))
                  .map((s) => (
                    <span
                      key={s}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-purple-600 text-white"
                    >
                      {s}
                      <button
                        type="button"
                        onClick={() => toggleArrItem(scholarships, setScholarships, s)}
                        aria-label={`Remove ${s}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
              </div>
              <div className="flex flex-wrap sm:flex-nowrap gap-1.5 pt-1">
                <input
                  value={customScholarship}
                  onChange={(e) => setCustomScholarship(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const t = customScholarship.trim();
                      if (t && !scholarships.includes(t)) {
                        setScholarships([...scholarships, t]);
                        setCustomScholarship('');
                      }
                    }
                  }}
                  placeholder="Add custom scholarship & press Enter…"
                  className={inputCls + ' py-1.5 text-xs min-w-[160px] flex-1'}
                />
                <button
                  type="button"
                  onClick={() => {
                    const t = customScholarship.trim();
                    if (t && !scholarships.includes(t)) {
                      setScholarships([...scholarships, t]);
                      setCustomScholarship('');
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold hover:bg-muted shrink-0"
                >
                  + Add
                </button>
              </div>
            </div>

            {/* Required Documents */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <FileCheck className="w-3.5 h-3.5 text-primary" />
                Required Admission Documents Checklist
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 bg-muted/30 p-2.5 rounded-xl border border-border/60">
                {COMMON_DOCUMENTS.map((doc) => (
                  <label key={doc} className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={requiredDocuments.includes(doc)}
                      onChange={() => toggleArrItem(requiredDocuments, setRequiredDocuments, doc)}
                      className="w-4 h-4 accent-primary rounded"
                    />
                    <span>{doc}</span>
                  </label>
                ))}
              </div>
            </div>
          </SectionBox>

          {/* ── 3. Facilities, Contact & Bus Route Villages ── */}
          <SectionBox
            title="3. Contact, Facilities, Overview & School Bus Villages"
            open={openSection === 'facilities'}
            onToggle={() => setOpenSection(openSection === 'facilities' ? 'location' : 'facilities')}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Phone / Helpline</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" placeholder="10-digit or STD phone" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Admission WhatsApp</label>
                <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} type="tel" placeholder="9876543210" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Official Email</label>
                <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="admissions@institute.edu.in" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Website</label>
                <input value={website} onChange={(e) => setWebsite(e.target.value)} type="url" placeholder="https://…" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Principal / Contact Person</label>
                <input value={principalName} onChange={(e) => setPrincipalName(e.target.value)} placeholder="e.g. Dr. A. B. Patil" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Office / Admission Hours</label>
                <input value={officeTiming} onChange={(e) => setOfficeTiming(e.target.value)} placeholder="09:00 AM - 04:30 PM" className={inputCls} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">Campus Facilities</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-muted/30 p-3 rounded-xl border border-border/60">
                {COMMON_FACILITIES.map((facility) => (
                  <label key={facility} className="flex items-center gap-2 text-xs text-foreground cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={facilities.includes(facility)}
                      onChange={() => toggleArrItem(facilities, setFacilities, facility)}
                      className="rounded border-input text-primary focus:ring-primary w-4 h-4"
                    />
                    <span>{facility}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Bus Route Villages */}
            <div className="space-y-2 p-3 rounded-xl border border-amber-500/25 bg-amber-500/5">
              <label className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                <Bus className="w-3.5 h-3.5 text-amber-600" />
                School Bus / Pickup Villages ({transportVillages.length})
              </label>
              <div className="flex flex-wrap sm:flex-nowrap gap-2">
                <input
                  value={villageChipInput}
                  onChange={(e) => setVillageChipInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ',') {
                      e.preventDefault();
                      handleAddTransportVillage();
                    }
                  }}
                  placeholder={`Type village name near ${townName} & press Enter…`}
                  className={inputCls + ' py-1.5 text-xs bg-background min-w-[160px] flex-1'}
                />
                <button
                  type="button"
                  onClick={() => handleAddTransportVillage()}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>
              {cityVillages.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {cityVillages.slice(0, 10).map((v) => {
                    const added = transportVillages.some(
                      (tv) => tv.toLowerCase() === v.name.toLowerCase()
                    );
                    if (added) return null;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => handleAddTransportVillage(v.name)}
                        className="text-[10.5px] px-2 py-0.5 rounded-full border border-dashed border-border bg-card hover:bg-muted text-muted-foreground"
                      >
                        + {v.name}
                      </button>
                    );
                  })}
                </div>
              )}
              {transportVillages.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {transportVillages.map((v) => (
                    <span
                      key={v}
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30"
                    >
                      🚌 {v}
                      <button
                        type="button"
                        onClick={() => setTransportVillages(transportVillages.filter((x) => x !== v))}
                        aria-label={`Remove ${v}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">About / Overview</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                maxLength={1000}
                placeholder="Brief history, results, faculty highlights, or special programs…"
                className={inputCls + ' resize-y'}
              />
            </div>
          </SectionBox>

          {/* ── 4. Address, Marathi Address & Campus GPS Pin ── */}
          <SectionBox
            title="4. Campus Address & Interactive GPS Map"
            open={openSection === 'location'}
            onToggle={() => setOpenSection(openSection === 'location' ? (isEdit ? 'owners' : 'identity') : 'location')}
            badge={latitude && longitude ? 'GPS Set' : undefined}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Area / Landmark</label>
                <input value={area} onChange={(e) => setArea(e.target.value)} placeholder={`e.g. Near Bus Stand, ${townName}`} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Sub-area / Road</label>
                <input value={subArea} onChange={(e) => setSubArea(e.target.value)} placeholder="Optional sub-locality" className={inputCls} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Full Street Address (English)</label>
                <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Complete street address" className={inputCls} />
              </div>
              <MarathiMirrorField
                label="Full Street Address (मराठी)"
                value={addressMr}
                onChange={setAddressMr}
                placeholder="संपूर्ण पत्ता (मराठीत)"
              />
            </div>

            {/* Google Maps link paste */}
            <div className="p-3 rounded-xl border border-border bg-muted/30 space-y-2">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Link2 className="w-3.5 h-3.5 text-primary shrink-0" />
                Paste Google Maps Share URL (Auto-extract Lat/Lng)
              </label>
              <div className="flex flex-wrap sm:flex-nowrap gap-2">
                <input
                  value={mapsLink}
                  onChange={(e) => setMapsLink(e.target.value)}
                  placeholder="https://www.google.com/maps/@18.7234,73.6543,17z..."
                  className={inputCls + ' py-1.5 text-xs min-w-[160px] flex-1'}
                />
                <button
                  type="button"
                  onClick={handleParseMapsLink}
                  className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold shrink-0"
                >
                  Extract Pin
                </button>
              </div>
            </div>

            <LocationMapPicker
              value={
                latitude && longitude && !Number.isNaN(Number(latitude)) && !Number.isNaN(Number(longitude))
                  ? { lat: Number(latitude), lng: Number(longitude) }
                  : null
              }
              onChange={(c) => {
                setLatitude(c.lat.toFixed(6));
                setLongitude(c.lng.toFixed(6));
              }}
              initialCenter={
                selectedCityObj?.latitude && selectedCityObj?.longitude
                  ? { lat: selectedCityObj.latitude, lng: selectedCityObj.longitude }
                  : MUKTAINAGAR_CENTER
              }
              height={200}
              onGeocode={(g) => {
                if (!address.trim() && g.address) setAddress(g.address);
                if (!area.trim() && g.area) setArea(g.area);
              }}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Latitude</label>
                <input value={latitude} onChange={(e) => setLatitude(e.target.value)} placeholder="18.723400" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Longitude</label>
                <input value={longitude} onChange={(e) => setLongitude(e.target.value)} placeholder="73.654300" className={inputCls} />
              </div>
            </div>
          </SectionBox>

          {/* ── 5. Assigned Owners (Edit mode) ── */}
          {isEdit && (
            <SectionBox
              title="5. Institute Owners / Principals with Portal Access"
              open={openSection === 'owners'}
              onToggle={() => setOpenSection(openSection === 'owners' ? 'identity' : 'owners')}
              badge={owners.length > 0 ? `${owners.length}` : undefined}
            >
              {owners.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No principal or coordinator assigned yet. Use <strong>Inbox → Assign</strong> (or approve a claim in <strong>Inbox → Claims</strong>) to grant access to `/my-shop` / `/my-institute`.
                </p>
              ) : (
                <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
                  {owners.map((o) => (
                    <div key={o.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-background">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-foreground flex items-center gap-1.5 truncate">
                          <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="truncate">{o.full_name || `User ${o.user_id.slice(0, 8)}`}</span>
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {o.role_title || 'Principal / Owner'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRevokeOwner(o.user_id, o.full_name)}
                        disabled={revokingId === o.user_id}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-destructive/10 text-destructive text-xs font-semibold hover:bg-destructive/20 disabled:opacity-50 shrink-0"
                      >
                        {revokingId === o.user_id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                        Revoke
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </SectionBox>
          )}
        </form>

        {/* Footer */}
        <div className="px-4 sm:px-5 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom,0px))] border-t border-border bg-card rounded-b-2xl flex flex-wrap items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={handleClose}
            disabled={saving}
            className="px-4 py-2 rounded-xl border border-border text-xs sm:text-sm font-semibold hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit as any}
            disabled={saving || uploadingImage}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-primary text-primary-foreground text-xs sm:text-sm font-bold hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {isEdit ? 'Update Institute' : 'Add Institute'}
          </button>
        </div>
      </div>
    </div>
  );
}

function SectionBox({
  title,
  badge,
  open,
  onToggle,
  children,
}: {
  title: string;
  badge?: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border overflow-hidden bg-background">
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-4 py-2.5 flex items-center justify-between gap-2 bg-muted/40 hover:bg-muted/70 text-left transition-colors"
      >
        <span className="text-xs sm:text-sm font-bold text-foreground">{title}</span>
        <div className="flex items-center gap-2 shrink-0">
          {badge && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/25">
              {badge}
            </span>
          )}
          {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>
      {open && <div className="p-4 space-y-3 border-t border-border/70">{children}</div>}
    </div>
  );
}
