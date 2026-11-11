/**
 * /schools — Public Schools & Educational Institutes Directory.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  GraduationCap,
  MapPin,
  Phone,
  Search as SearchIcon,
  Plus,
  MessageCircle,
  ShieldCheck,
  Bus,
  ArrowUpRight,
  Sparkles,
  CheckCircle2,
  X,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PageSeo } from '@/components/seo/PageSeo';
import { EntityCard, type EntityAction } from '@/components/shared/EntityCard';
import { ClaimedBadge } from '@/components/shared/ClaimedBadge';
import { RatingInline } from '@/components/shared/rating/RatingInline';
import { DesktopNav } from '@/components/DesktopNav';
import { Footer } from '@/components/shared/Footer';
import { CityPickerModal } from '@/components/shared/CityPickerModal';
import { UserMenuDrawer } from '@/components/UserMenuDrawer';
import { useEdgeSwipeBack } from '@/hooks/useEdgeSwipeBack';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useCity } from '@/hooks/useCity';
import { useT } from '@/i18n';
import { schoolsRepo, type SchoolRow, type SchoolType } from '@/lib/repos/schoolsRepo';
import {
  SCHOOL_TYPE_CONFIG,
  SCHOOL_MEDIUM_CONFIG,
  ADMISSION_STATUS_CONFIG,
  MANAGEMENT_TYPE_CONFIG,
  MANAGEMENT_TYPE_OPTIONS,
  FEE_TIER_CONFIG,
  filterSchools,
  getSchoolResolvedMeta,
  resolveSchoolType,
  type ManagementType,
  type SchoolMedium,
} from '@/lib/schools/schoolHelpers';
import { useSchoolRatingsMap } from '@/lib/reviewsApi';
import { logSchoolEngagement } from '@/lib/schoolEngagement';
import { canDialTel } from '@/lib/engagement';
import { normalizeWhatsApp } from '@/components/admin/adminHelpers';

interface TypeFilterOption {
  value: 'all' | SchoolType;
  labelEn: string;
  labelMr: string;
}

const TYPE_FILTERS: TypeFilterOption[] = [
  { value: 'all', labelEn: 'All', labelMr: 'सर्व' },
  { value: 'primary', labelEn: 'Primary', labelMr: 'प्राथमिक' },
  { value: 'secondary', labelEn: 'High School', labelMr: 'माध्यमिक' },
  { value: 'higher-secondary', labelEn: 'Jr. College', labelMr: 'कनिष्ठ महा.' },
  { value: 'college', labelEn: 'Degree College', labelMr: 'वरिष्ठ महा.' },
  { value: 'engineering-polytechnic', labelEn: 'Engg / ITI', labelMr: 'इंजिनिअरिंग / ITI' },
  { value: 'university', labelEn: 'University', labelMr: 'विद्यापीठ' },
  { value: 'coaching', labelEn: 'Coaching / Study Room', labelMr: 'क्लासेस / अभ्यासिका' },
];

export default function Schools() {
  const navigate = useNavigate();
  const { t, locale } = useT();
  const isMr = locale === 'mr';
  const { currentCity, currentVillage, getPageTitle } = useCity();

  const [q, setQ] = useState('');
  const debouncedQ = useDebouncedValue(q, 200);
  const [typeFilter, setTypeFilter] = useState<'all' | SchoolType>('all');
  const [admissionOnly, setAdmissionOnly] = useState(false);
  const [managementFilter, setManagementFilter] = useState<'all' | ManagementType>('all');
  const [mediumFilter, setMediumFilter] = useState<'all' | SchoolMedium>('all');
  const [cityPickerOpen, setCityPickerOpen] = useState(false);

  const { indicatorNode } = useEdgeSwipeBack({
    fallbackPath: `/${currentCity.slug}`,
  });

  const cityName = isMr && currentCity.name_mr ? currentCity.name_mr : currentCity.name;
  const villageName = currentVillage
    ? isMr && currentVillage.name_mr
      ? currentVillage.name_mr
      : currentVillage.name
    : null;
  const locationLabel = villageName ? `${villageName}, ${cityName}` : cityName;

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['public-schools', currentCity.id, currentVillage?.id],
    queryFn: () =>
      schoolsRepo.list({
        activeOnly: true,
        cityId: currentCity.id,
        citySlug: currentCity.slug,
      }),
    staleTime: 60_000,
  });

  const schoolIds = useMemo(() => rows.map((r) => r.id), [rows]);
  const { data: ratingsMap } = useSchoolRatingsMap(schoolIds);

  const filtered = useMemo(() => {
    const matched = filterSchools(rows, debouncedQ, typeFilter, 'active', {
      admissionFilter: admissionOnly ? 'open_only' : 'all',
      managementFilter,
      mediumFilter,
    });

    const villageNeedle = currentVillage?.name?.trim().toLowerCase() || '';

    return [...matched].sort((a, b) => {
      const ma = getSchoolResolvedMeta(a);
      const mb = getSchoolResolvedMeta(b);

      if (villageNeedle) {
        const aLocal =
          (a.area || '').toLowerCase().includes(villageNeedle) ||
          (a.sub_area || '').toLowerCase().includes(villageNeedle) ||
          (a.address || '').toLowerCase().includes(villageNeedle) ||
          (ma.transport_villages || []).some((v) => v.toLowerCase().includes(villageNeedle));
        const bLocal =
          (b.area || '').toLowerCase().includes(villageNeedle) ||
          (b.sub_area || '').toLowerCase().includes(villageNeedle) ||
          (b.address || '').toLowerCase().includes(villageNeedle) ||
          (mb.transport_villages || []).some((v) => v.toLowerCase().includes(villageNeedle));
        if (aLocal !== bLocal) return aLocal ? -1 : 1;
      }

      const aOpen = ma.admission_status === 'open' || ma.admission_status === 'ongoing';
      const bOpen = mb.admission_status === 'open' || mb.admission_status === 'ongoing';
      if (aOpen !== bOpen) return aOpen ? -1 : 1;

      if (Boolean(a.is_verified) !== Boolean(b.is_verified)) {
        return a.is_verified ? -1 : 1;
      }

      return (a.name || '').localeCompare(b.name || '');
    });
  }, [rows, debouncedQ, typeFilter, admissionOnly, managementFilter, mediumFilter, currentVillage?.name]);

  const hasActiveFilters =
    q.trim().length > 0 ||
    typeFilter !== 'all' ||
    admissionOnly ||
    managementFilter !== 'all' ||
    mediumFilter !== 'all';

  const resetFilters = () => {
    setQ('');
    setTypeFilter('all');
    setAdmissionOnly(false);
    setManagementFilter('all');
    setMediumFilter('all');
  };

  const pageTitle = isMr
    ? `${locationLabel} मधील शाळा, कॉलेज व क्लासेस`
    : `Schools, Colleges & Institutes in ${locationLabel}`;

  return (
    <div className="min-h-screen bg-background">
      {indicatorNode}
      <PageSeo
        title={getPageTitle(isMr ? 'शाळा व महाविद्यालये' : 'Schools & Colleges')}
        description={
          isMr
            ? `${locationLabel} मधील शाळा, महाविद्यालये, अभियांत्रिकी, आयटीआय, प्रवेश सूचना व बस वाहतूक माहिती.`
            : `Verified schools, colleges, engineering & ITI institutes in ${locationLabel} — admissions, fees, scholarships, notices & bus routes.`
        }
        path={`/${currentCity.slug}/schools`}
      />

      <header className="sticky top-0 z-40 bg-primary text-primary-foreground shadow-md">
        <div className="max-w-5xl mx-auto px-3 sm:px-4 py-3 flex items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
            <button
              onClick={() => navigate(`/${currentCity.slug}`)}
              aria-label={t('common.back')}
              className="inline-flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-primary-foreground/10 hover:bg-primary-foreground/20 shrink-0"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <GraduationCap className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
              <div className="min-w-0">
                <h1 className="font-bold text-sm sm:text-lg leading-tight truncate">
                  {isMr ? 'शाळा व शिक्षण संस्था' : 'Education & Institutes'}
                </h1>
                <p className="text-[11px] sm:text-xs text-primary-foreground/80 leading-tight truncate">
                  {locationLabel}
                </p>
              </div>
            </div>
          </div>

          <DesktopNav variant="primary" />

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              onClick={() => setCityPickerOpen(true)}
              className="inline-flex items-center gap-1 text-xs font-semibold px-2 sm:px-2.5 py-1 rounded-full bg-primary-foreground/15 text-primary-foreground border border-primary-foreground/25 hover:bg-primary-foreground/25 transition-colors"
              title={isMr ? 'स्थान बदला' : 'Change Location'}
            >
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate max-w-[78px] sm:max-w-[130px]">{locationLabel}</span>
            </button>
            <UserMenuDrawer />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-foreground">{pageTitle}</h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              {isMr
                ? 'प्रवेश स्थिती, मंडळ, फी, शिष्यवृत्ती, बस मार्ग व अधिकृत सूचना पहा.'
                : 'Explore admissions, boards, fee tiers, scholarships, live circulars & village bus routes.'}
            </p>
          </div>
          {!isLoading && (
            <span className="text-xs font-semibold text-muted-foreground shrink-0">
              {isMr ? `${filtered.length} संस्था दाखवल्या` : `${filtered.length} institute(s)`}
            </span>
          )}
        </div>

        {/* Search + Quick Filters Bar */}
        <div className="space-y-2.5">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={
                isMr
                  ? 'शाळा, कॉलेज, बोर्ड (CBSE/SPPU), बस गाव किंवा अभ्यासक्रम शोधा…'
                  : 'Search name, board (CBSE / SPPU), course, area or bus village…'
              }
              className="w-full pl-9 pr-3 h-11 rounded-xl border border-input bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary shadow-2xs"
            />
          </div>

          {/* Type filter chips */}
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            {TYPE_FILTERS.map((f) => {
              const active = typeFilter === f.value;
              const label = isMr ? f.labelMr : f.labelEn;
              return (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setTypeFilter(f.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                    active
                      ? 'bg-primary text-primary-foreground border-primary shadow-2xs'
                      : 'bg-card text-foreground border-border hover:bg-muted'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Admissions Open + Management + Medium + Reset row */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setAdmissionOnly((v) => !v)}
              aria-pressed={admissionOnly}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                admissionOnly
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                  : 'bg-card text-foreground border-border hover:bg-muted'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isMr ? 'प्रवेश सुरू असलेले (Open)' : 'Admissions Open'}</span>
            </button>

            <select
              value={managementFilter}
              onChange={(e) => setManagementFilter(e.target.value as 'all' | ManagementType)}
              aria-label={isMr ? 'व्यवस्थापन प्रकार' : 'Filter by management'}
              className="h-8 max-w-full min-w-0 px-2.5 rounded-full border border-border bg-card text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">{isMr ? 'सर्व व्यवस्थापन (Govt/Pvt)' : 'All Management'}</option>
              {MANAGEMENT_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {isMr ? MANAGEMENT_TYPE_CONFIG[opt.value].labelMr : MANAGEMENT_TYPE_CONFIG[opt.value].labelEn}
                </option>
              ))}
            </select>

            <select
              value={mediumFilter}
              onChange={(e) => setMediumFilter(e.target.value as 'all' | SchoolMedium)}
              aria-label={isMr ? 'माध्यम निवडा' : 'Filter by medium'}
              className="h-8 max-w-full min-w-0 px-2.5 rounded-full border border-border bg-card text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">{isMr ? 'सर्व माध्यमे' : 'All Mediums'}</option>
              {(Object.keys(SCHOOL_MEDIUM_CONFIG) as SchoolMedium[]).map((m) => (
                <option key={m} value={m}>
                  {isMr ? SCHOOL_MEDIUM_CONFIG[m].labelMr : SCHOOL_MEDIUM_CONFIG[m].labelEn}
                </option>
              ))}
            </select>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <X className="w-3 h-3" />
                {isMr ? 'फिल्टर काढा' : 'Clear'}
              </button>
            )}
          </div>
        </div>

        {/* Directory List */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-card rounded-xl border border-border h-44 skeleton-shimmer" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 rounded-2xl border border-dashed border-border bg-card text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
              <GraduationCap className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-foreground">
              {rows.length > 0 && hasActiveFilters
                ? isMr
                  ? 'फिल्टरशी जुळणारी कोणतीही संस्था सापडली नाही'
                  : 'No institutes match your active filters'
                : isMr
                  ? `${locationLabel} मध्ये शाळांची माहिती उपलब्ध नाही`
                  : `No Institutes Listed in ${locationLabel} Yet`}
            </h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              {rows.length > 0 && hasActiveFilters
                ? isMr
                  ? 'फिल्टर कमी करून पुन्हा तपासा.'
                  : 'Try clearing a filter or broadening your search query.'
                : isMr
                  ? 'येथील नवीन शाळा, कॉलेज किंवा कोचिंग संस्थेची नोंदणी करा.'
                  : 'Help students & parents by listing local schools, colleges, or coaching institutes.'}
            </p>
            <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
              {rows.length > 0 && hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="px-4 py-2 rounded-xl border border-border text-xs font-bold hover:bg-muted"
                >
                  {isMr ? 'फिल्टर रीसेट करा' : 'Reset Filters'}
                </button>
              )}
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('open-list-shop-modal'))}
                className="inline-flex items-center justify-center gap-1.5 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-xs sm:text-sm font-bold shadow-xs hover:bg-primary/90 active:scale-95 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>{isMr ? 'नवीन शाळा / कॉलेज जोडा' : 'List a School / College'}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {filtered.map((s) => (
              <SchoolCardWrap
                key={s.id}
                school={s}
                citySlug={currentCity.slug}
                locale={locale}
                currentVillageName={currentVillage?.name || null}
                rating={ratingsMap?.get(s.id)}
              />
            ))}
          </div>
        )}
      </main>

      <Footer />

      <CityPickerModal open={cityPickerOpen} onOpenChange={setCityPickerOpen} />
    </div>
  );
}

/** Adapter: SchoolRow → EntityCard props with deep links, ratings, admissions, bus & engagement tracking */
function SchoolCardWrap({
  school,
  citySlug,
  locale,
  currentVillageName,
  rating,
}: {
  school: SchoolRow;
  citySlug: string;
  locale: string;
  currentVillageName: string | null;
  rating?: { average: number; count: number };
}) {
  const navigate = useNavigate();
  const isMr = locale === 'mr';
  const displayName = isMr && school.name_mr ? school.name_mr : school.name;
  const detailPath = `/${citySlug}/schools/${school.slug || school.id}`;
  const metaInfo = getSchoolResolvedMeta(school);

  const photos = Array.isArray(school.photos) ? school.photos.filter(Boolean) : [];
  const heroImage = photos[0] || school.image_url || undefined;

  const resolvedType = resolveSchoolType(school);
  const typeCfg = SCHOOL_TYPE_CONFIG[resolvedType] || SCHOOL_TYPE_CONFIG.other;
  const typeLabel = isMr ? typeCfg.labelMr : typeCfg.labelEn;

  const admStatus = metaInfo.admission_status;
  const admCfg = admStatus ? ADMISSION_STATUS_CONFIG[admStatus] : null;
  const mgmtCfg = metaInfo.management_type ? MANAGEMENT_TYPE_CONFIG[metaInfo.management_type] : null;
  const feeCfg = metaInfo.fee_tier ? FEE_TIER_CONFIG[metaInfo.fee_tier] : null;

  const hasBusToCurrentVillage = Boolean(
    currentVillageName &&
      (metaInfo.transport_villages || []).some((v) =>
        v.toLowerCase().includes(currentVillageName.toLowerCase()),
      ),
  );

  const waDigits = normalizeWhatsApp(school.whatsapp);
  const waHref = waDigits
    ? `https://wa.me/${waDigits}?text=${encodeURIComponent(
        isMr
          ? `नमस्कार ${displayName}, मला प्रवेश व फी माहिती हवी आहे.`
          : `Hello ${displayName}, I would like to enquire about admissions & fee details.`,
      )}`
    : null;

  const mapsHref =
    school.latitude && school.longitude
      ? `https://www.google.com/maps?q=${school.latitude},${school.longitude}`
      : school.address
        ? `https://www.google.com/maps/search/${encodeURIComponent(`${school.name} ${school.address}`)}`
        : null;

  const actions: EntityAction[] = [];
  if (school.phone) {
    actions.push({
      key: 'call',
      label: isMr ? 'कॉल' : 'Call',
      icon: <Phone className="w-3.5 h-3.5 shrink-0" />,
      href: `tel:${school.phone}`,
      ariaLabel: `Call ${displayName}`,
      style: { background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' },
      onClick: () => {
        void logSchoolEngagement(school.id, 'call');
        if (canDialTel()) {
          toast.success(isMr ? `${displayName} ला कॉल करत आहे…` : `Calling ${displayName}`);
        } else {
          toast.info(school.phone!, { duration: 6000 });
        }
      },
    });
  }
  if (waHref) {
    actions.push({
      key: 'whatsapp',
      label: 'WhatsApp',
      icon: <MessageCircle className="w-3.5 h-3.5 shrink-0" />,
      href: waHref,
      external: true,
      ariaLabel: `WhatsApp ${displayName}`,
      className: 'text-white',
      style: { background: '#25D366' },
      onClick: () => {
        void logSchoolEngagement(school.id, 'whatsapp');
      },
    });
  } else if (mapsHref) {
    actions.push({
      key: 'maps',
      label: isMr ? 'नकाशा' : 'Maps',
      icon: <MapPin className="w-3.5 h-3.5 shrink-0" />,
      href: mapsHref,
      external: true,
      ariaLabel: `Directions to ${displayName}`,
      className: 'text-white',
      style: { background: 'hsl(211 100% 45%)' },
      onClick: () => {
        void logSchoolEngagement(school.id, 'maps');
      },
    });
  }
  actions.push({
    key: 'details',
    label: isMr ? 'माहिती पहा' : 'Details',
    icon: <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />,
    ariaLabel: `View full profile of ${displayName}`,
    className: 'border border-border bg-muted/60 text-foreground hover:bg-muted',
    onClick: () => navigate(detailPath),
  });

  const badges =
    school.is_verified || school.is_claimed || (rating && rating.count > 0) ? (
      <>
        {school.is_verified && (
          <span
            className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-semibold leading-none"
            style={{ background: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))' }}
          >
            <ShieldCheck className="w-2.5 h-2.5" /> {isMr ? 'पडताळणी' : 'Verified'}
          </span>
        )}
        {school.is_claimed && <ClaimedBadge size="sm" />}
        {rating && rating.count > 0 && !heroImage && (
          <RatingInline value={rating.average} count={rating.count} size="sm" />
        )}
      </>
    ) : null;

  const metaRows: React.ReactNode[] = [];
  if (school.area || school.sub_area) {
    metaRows.push(
      <p key="area" className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
        <MapPin className="w-3 h-3 shrink-0" />
        {[school.area, school.sub_area].filter(Boolean).join(', ')}
      </p>,
    );
  }
  if (metaInfo.classes_offered) {
    metaRows.push(
      <p key="classes" className="text-[11px] text-muted-foreground mt-0.5 truncate">
        {metaInfo.classes_offered}
        {metaInfo.accreditation ? ` · ${metaInfo.accreditation}` : ''}
      </p>,
    );
  }
  if (hasBusToCurrentVillage && currentVillageName) {
    metaRows.push(
      <p
        key="bus"
        className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 mt-1"
      >
        <Bus className="w-3 h-3 shrink-0" />
        {isMr ? `${currentVillageName} साठी बस सुविधा` : `Bus route covers ${currentVillageName}`}
      </p>,
    );
  }

  const mediumLabel = (() => {
    const key = (metaInfo.mediums?.[0] || school.medium) as SchoolMedium | undefined;
    if (!key) return null;
    const medCfg = SCHOOL_MEDIUM_CONFIG[key];
    return medCfg ? (isMr ? medCfg.labelMr : medCfg.labelEn) : key;
  })();

  const chips = (
    <>
      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${typeCfg.badgeClass}`}>
        {typeLabel}
      </span>
      {mediumLabel && (
        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-muted text-foreground">
          {mediumLabel}
        </span>
      )}
      {metaInfo.board && (
        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium border border-border bg-card text-foreground">
          {metaInfo.board}
        </span>
      )}
      {mgmtCfg && (
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${mgmtCfg.badgeClass}`}>
          {isMr ? mgmtCfg.labelMr : mgmtCfg.labelEn}
        </span>
      )}
      {feeCfg && (
        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-muted/70 text-muted-foreground">
          {feeCfg.value === 'free'
            ? isMr
              ? 'मोफत / सरकारी'
              : 'Free / Govt'
            : feeCfg.value === 'low'
              ? isMr
                ? 'माफक शुल्क'
                : 'Low Fee'
              : feeCfg.value === 'moderate'
                ? isMr
                  ? 'मध्यम शुल्क'
                  : 'Moderate Fee'
                : isMr
                  ? 'व्यावसायिक'
                  : 'Premium Fee'}
        </span>
      )}
    </>
  );

  const admissionChip = admCfg ? (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border backdrop-blur-sm ${admCfg.badgeClass}`}
    >
      <CheckCircle2 className="w-2.5 h-2.5 shrink-0" />
      {isMr ? admCfg.labelMr : admCfg.labelEn}
    </span>
  ) : undefined;

  return (
    <EntityCard
      href={detailPath}
      photos={photos.length > 1 ? photos : undefined}
      image={heroImage ? { src: heroImage, alt: displayName, targetWidth: 420 } : undefined}
      imageOverlay={heroImage ? admissionChip : undefined}
      imageOverlayBottomLeft={
        heroImage && rating && rating.count > 0 ? (
          <div className="px-2 py-1 rounded-full bg-background/90 backdrop-blur-xs border border-border shadow-2xs">
            <RatingInline value={rating.average} count={rating.count} size="sm" />
          </div>
        ) : undefined
      }
      rightAdornment={!heroImage ? admissionChip : undefined}
      title={displayName}
      titleIcon={<GraduationCap className="w-4 h-4 shrink-0 text-primary" />}
      badges={badges}
      meta={metaRows}
      chips={chips}
      actions={actions}
    />
  );
}
