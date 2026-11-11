import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Award,
  BedDouble,
  Bell,
  BookOpen,
  Building2,
  Bus,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Clock,
  ExternalLink,
  FileCheck2,
  FileText,
  Globe,
  GraduationCap,
  IndianRupee,
  Mail,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  Pin,
  Send,
  Share2,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Users,
  UtensilsCrossed,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageSeo } from '@/components/seo/PageSeo';
import { DesktopNav } from '@/components/DesktopNav';
import { UserMenuDrawer } from '@/components/UserMenuDrawer';
import { Footer } from '@/components/shared/Footer';
import { CityPickerModal } from '@/components/shared/CityPickerModal';
import { ClaimedBadge } from '@/components/shared/ClaimedBadge';
import { PhotoSlider } from '@/components/shared/PhotoSlider';
import { RatingInline } from '@/components/shared/rating/RatingInline';
import { ReviewsSection } from '@/components/reviews/ReviewsSection';
import { ClaimSchoolModal } from '@/components/ClaimSchoolModal';
import { useEdgeSwipeBack } from '@/hooks/useEdgeSwipeBack';
import { useCity } from '@/hooks/useCity';
import { useAuth } from '@/hooks/useAuth';
import { useT } from '@/i18n';
import { supabase } from '@/integrations/supabase/client';
import { schoolsRepo, type SchoolRow } from '@/lib/repos/schoolsRepo';
import { schoolNoticesRepo, type SchoolNotice } from '@/lib/schools/schoolNoticesRepo';
import { useShopRating } from '@/lib/reviewsApi';
import { logSchoolEngagement } from '@/lib/schoolEngagement';
import { fetchPGsForCity, fetchMessesForCity } from '@/lib/living/livingService';
import { normalizeWhatsApp } from '@/components/admin/adminHelpers';
import { isMissingRelationErr } from '@/lib/entities/claimEntity';
import { canDialTel } from '@/lib/engagement';
import { isSafeHttpUrl, isValidIndianPhone } from '@/lib/utils';
import {
  SCHOOL_TYPE_CONFIG,
  SCHOOL_MEDIUM_CONFIG,
  ADMISSION_STATUS_CONFIG,
  MANAGEMENT_TYPE_CONFIG,
  GENDER_TYPE_CONFIG,
  FEE_TIER_CONFIG,
  NOTICE_CATEGORY_CONFIG,
  getSchoolResolvedMeta,
  resolveSchoolType,
  formatSchoolWhatsAppEnquiry,
  type SchoolMedium,
} from '@/lib/schools/schoolHelpers';

export default function SchoolDetail() {
  const { citySlug, id } = useParams<{ citySlug: string; id: string }>();
  const navigate = useNavigate();
  const { currentCity, currentVillage } = useCity();
  const { user, isAdmin } = useAuth();
  const { locale } = useT();
  const isMr = locale === 'mr';

  const [cityPickerOpen, setCityPickerOpen] = useState(false);
  const [claimOpen, setClaimOpen] = useState(false);

  // WhatsApp admission enquiry builder fields
  const [studentName, setStudentName] = useState('');
  const [targetClass, setTargetClass] = useState('');
  const [enquiryVillage, setEnquiryVillage] = useState(currentVillage?.name || '');
  const [enquiryQuestion, setEnquiryQuestion] = useState('');

  const { indicatorNode } = useEdgeSwipeBack({
    fallbackPath: `/${citySlug || currentCity.slug}/schools`,
  });

  const cityName = isMr && currentCity.name_mr ? currentCity.name_mr : currentCity.name;
  const villageName = currentVillage
    ? isMr && currentVillage.name_mr
      ? currentVillage.name_mr
      : currentVillage.name
    : null;
  const locationLabel = villageName ? `${villageName}, ${cityName}` : cityName;

  const {
    data: school,
    isLoading,
    error,
  } = useQuery<SchoolRow | null>({
    queryKey: ['public-school-detail', id, currentCity.id],
    enabled: !!id,
    queryFn: () => schoolsRepo.getBySlugOrId(id!, currentCity.id),
    staleTime: 60_000,
  });

  const { data: notices = [] } = useQuery<SchoolNotice[]>({
    queryKey: ['public-school-notices', school?.id],
    enabled: !!school?.id,
    queryFn: () => schoolNoticesRepo.listPublic(school!.id),
    staleTime: 60_000,
  });

  const { data: rating } = useShopRating(school?.id, 'school');

  const { data: isOwner = false } = useQuery<boolean>({
    queryKey: ['is-school-owner', school?.id, user?.id],
    enabled: !!school?.id && !!user?.id,
    queryFn: async () => {
      try {
        const { data, error: ownErr } = await (supabase as any)
          .from('school_owners')
          .select('id')
          .eq('school_id', school!.id)
          .eq('user_id', user!.id)
          .maybeSingle();
        if (ownErr) {
          if (isMissingRelationErr(ownErr)) return false;
          return false;
        }
        return Boolean(data);
      } catch {
        return false;
      }
    },
  });

  const targetCityId = school?.city_id || currentCity.id;

  const { data: nearbyLiving } = useQuery({
    queryKey: ['school-nearby-living', targetCityId, school?.area],
    enabled: !!school?.id && !!targetCityId,
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const [pgs, messes] = await Promise.all([
        fetchPGsForCity(targetCityId),
        fetchMessesForCity(targetCityId),
      ]);

      const areaTokens = (school?.area || '')
        .toLowerCase()
        .split(/[\s,/-]+/)
        .filter((w) => w.length >= 3);

      const rankByArea = <T extends { area?: string | null; address?: string | null }>(list: T[]) =>
        [...list].sort((a, b) => {
          const ah = `${a.area || ''} ${a.address || ''}`.toLowerCase();
          const bh = `${b.area || ''} ${b.address || ''}`.toLowerCase();
          const aMatch = areaTokens.some((tok) => ah.includes(tok));
          const bMatch = areaTokens.some((tok) => bh.includes(tok));
          if (aMatch !== bMatch) return aMatch ? -1 : 1;
          return 0;
        });

      return {
        pgs: rankByArea(pgs).slice(0, 3),
        messes: rankByArea(messes).slice(0, 3),
      };
    },
  });

  const meta = useMemo(() => (school ? getSchoolResolvedMeta(school) : null), [school]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs text-muted-foreground">
          {isMr ? 'शिक्षण संस्थेची माहिती लोड होत आहे…' : 'Loading institute details…'}
        </p>
      </div>
    );
  }

  if (error || !school || !meta) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
          <GraduationCap className="w-7 h-7" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground">
            {isMr ? 'शिक्षण संस्था सापडली नाही' : 'Institute Not Found'}
          </h2>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs">
            {isMr
              ? 'ही शिक्षण संस्था सध्या उपलब्ध नाही किंवा लिंक बदलली आहे.'
              : 'This school or college listing is unavailable or the link may have changed.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate(`/${citySlug || currentCity.slug}/schools`)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold shadow-xs"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{isMr ? 'सर्व शिक्षण संस्था पहा' : 'Browse All Institutes'}</span>
        </button>
      </div>
    );
  }

  const displayName = isMr && school.name_mr ? school.name_mr : school.name;
  const altName = isMr && school.name_mr ? school.name : school.name_mr;
  const displayAddress = isMr && school.address_mr ? school.address_mr : school.address;

  const photos = Array.isArray(school.photos) && school.photos.length > 0
    ? school.photos.filter(Boolean)
    : school.image_url
      ? [school.image_url]
      : [];

  const resolvedType = resolveSchoolType(school);
  const typeCfg = SCHOOL_TYPE_CONFIG[resolvedType] || SCHOOL_TYPE_CONFIG.other;
  const typeLabel = isMr ? typeCfg.labelMr : typeCfg.labelEn;

  const admCfg = meta.admission_status ? ADMISSION_STATUS_CONFIG[meta.admission_status] : null;
  const mgmtCfg = meta.management_type ? MANAGEMENT_TYPE_CONFIG[meta.management_type] : null;
  const genderCfg = meta.gender_type ? GENDER_TYPE_CONFIG[meta.gender_type] : null;
  const feeCfg = meta.fee_tier ? FEE_TIER_CONFIG[meta.fee_tier] : null;

  const rawWa =
    school.whatsapp ||
    (school.phone && isValidIndianPhone(school.phone) ? school.phone : '');
  const waDigits = normalizeWhatsApp(rawWa);
  const websiteHref = isSafeHttpUrl(school.website) ? school.website! : null;
  const applyHref = isSafeHttpUrl(meta.admission_url) ? meta.admission_url! : null;
  const prospectusHref = isSafeHttpUrl(meta.prospectus_url) ? meta.prospectus_url! : null;

  const mapsHref =
    school.latitude && school.longitude
      ? `https://www.google.com/maps?q=${school.latitude},${school.longitude}`
      : `https://www.google.com/maps/search/${encodeURIComponent(
          `${school.name} ${school.address || school.area || ''} ${cityName}`,
        )}`;

  const handleShare = async () => {
    const shareUrl = window.location.href;
    const shareText = isMr
      ? `${displayName} — प्रवेश, फी, सूचना आणि बस मार्ग (${locationLabel})`
      : `${displayName} — Admissions, Fees, Notices & Bus Routes in ${locationLabel}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: displayName, text: shareText, url: shareUrl });
        return;
      } catch {
        // user dismissed
      }
    }
    await navigator.clipboard.writeText(shareUrl);
    toast.success(isMr ? 'लिंक कॉपी केली!' : 'Link copied to clipboard!');
  };

  const handleCall = () => {
    if (!school.phone) return;
    void logSchoolEngagement(school.id, 'call');
    if (canDialTel()) {
      toast.success(isMr ? `${displayName} ला कॉल करत आहे…` : `Calling ${displayName}`);
    } else {
      toast.info(school.phone, { duration: 6000 });
    }
  };

  const sendWhatsAppEnquiry = () => {
    if (!waDigits) return;
    const msg = formatSchoolWhatsAppEnquiry({
      schoolName: displayName,
      studentName,
      targetClassOrCourse: targetClass,
      villageOrArea: enquiryVillage,
      question: enquiryQuestion,
      isMr,
    });
    void logSchoolEngagement(school.id, 'whatsapp');
    window.open(`https://wa.me/${waDigits}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
  };

  const mediumLabels = (meta.mediums && meta.mediums.length > 0
    ? meta.mediums
    : school.medium
      ? [school.medium]
      : []
  ).map((m) => {
    const cfg = SCHOOL_MEDIUM_CONFIG[m as SchoolMedium];
    return cfg ? (isMr ? cfg.labelMr : cfg.labelEn) : m;
  });

  const canManage = isOwner || isAdmin;
  const activeVillageNeedle = currentVillage?.name?.trim().toLowerCase() || '';

  return (
    <div className="min-h-screen bg-background text-foreground pb-28">
      {indicatorNode}
      <PageSeo
        title={`${displayName} — ${typeLabel} | ${locationLabel}`}
        description={
          meta.raw_description ||
          (isMr
            ? `${displayName} (${locationLabel}) — प्रवेश माहिती, मंडळ, फी, शिष्यवृत्ती व थेट संपर्क.`
            : `${displayName} in ${locationLabel} — Admissions, courses, fees, live circulars, scholarships & contact.`)
        }
        path={`/${citySlug || currentCity.slug}/schools/${school.slug || school.id}`}
      />

      {/* Sticky App Bar */}
      <header className="sticky top-0 z-40 bg-primary text-primary-foreground shadow-md">
        <div className="max-w-5xl mx-auto px-3 sm:px-4 py-3 flex items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <button
              type="button"
              onClick={() => navigate(`/${citySlug || currentCity.slug}/schools`)}
              aria-label="Back to Institutes"
              className="inline-flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-primary-foreground/10 hover:bg-primary-foreground/20 active:scale-95 transition-all shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-sm sm:text-base font-bold leading-tight truncate">{displayName}</h1>
          </div>

          <DesktopNav variant="primary" />

          <div className="flex items-center gap-1.5 shrink-0">
            {canManage && (
              <Link
                to={`/my-shop?type=school&id=${school.id}`}
                className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary-foreground text-primary text-xs font-bold hover:bg-primary-foreground/90 transition-colors whitespace-nowrap shrink-0"
              >
                <GraduationCap className="w-3.5 h-3.5 shrink-0" />
                {isMr ? 'संस्था व्यवस्थापित करा' : 'Manage Institute'}
              </Link>
            )}
            <button
              type="button"
              onClick={handleShare}
              aria-label="Share"
              className="inline-flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-lg hover:bg-primary-foreground/10 active:scale-95 transition-all shrink-0"
            >
              <Share2 className="w-4 h-4" />
            </button>
            <UserMenuDrawer />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-3 sm:px-4 pt-4 space-y-4">
        {/* Owner Quick-Manage Strip */}
        {canManage && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-primary">
              <Sparkles className="w-4 h-4 shrink-0" />
              <span>
                {isOwner
                  ? isMr
                    ? 'तुम्ही या शिक्षण संस्थेचे व्यवस्थापक आहात'
                    : 'You manage this institute'
                  : isMr
                    ? 'अ‍ॅडमिन दृश्य — संस्था हब उघडा'
                    : 'Admin view — open Owner Hub to post circulars or edit details'}
              </span>
            </div>
            <Link
              to={`/my-shop?type=school&id=${school.id}`}
              className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90"
            >
              {isMr ? 'हब उघडा →' : 'Manage Hub →'}
            </Link>
          </div>
        )}

        {/* Photo Gallery */}
        {photos.length > 0 && (
          <div className="rounded-2xl overflow-hidden border border-border shadow-xs">
            <PhotoSlider
              photos={photos}
              imageUrl={school.image_url}
              alt={displayName}
              heightClass="h-56 sm:h-72 w-full"
              showArrows
              showDots
              showCounter
              showThumbnails={photos.length > 1}
              enableLightbox
              overlayTopLeft={
                admCfg ? (
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border backdrop-blur-md shadow-xs ${admCfg.badgeClass}`}
                  >
                    <span className={`w-2 h-2 rounded-full ${admCfg.dotClass}`} />
                    {isMr ? admCfg.labelMr : admCfg.labelEn}
                  </span>
                ) : undefined
              }
              overlayBottomLeft={
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-black/65 backdrop-blur-xs border border-white/20 text-white">
                  {typeLabel}
                </span>
              }
              overlayBottomRight={
                rating && rating.count > 0 ? (
                  <div className="px-2.5 py-1 rounded-full bg-background/90 backdrop-blur-xs border border-border shadow-xs">
                    <RatingInline value={rating.average} count={rating.count} size="sm" />
                  </div>
                ) : undefined
              }
            />
          </div>
        )}

        {/* Identity & Key Badges Card */}
        <div className="bg-card rounded-2xl border border-border p-4 sm:p-5 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center flex-wrap gap-2">
                <h1 className="text-xl sm:text-2xl font-extrabold text-foreground leading-tight">
                  {displayName}
                </h1>
                {school.is_verified && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    {isMr ? 'पडताळणी पूर्ण' : 'Verified'}
                  </span>
                )}
                {school.is_claimed && <ClaimedBadge size="md" />}
              </div>
              {altName && altName !== displayName && (
                <p className="text-xs text-muted-foreground">{altName}</p>
              )}
            </div>

            {rating && rating.count > 0 && (
              <a
                href="#reviews"
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-muted/60 border border-border hover:bg-muted shrink-0 self-start"
              >
                <RatingInline value={rating.average} count={rating.count} size="md" />
              </a>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${typeCfg.badgeClass}`}>
              {typeLabel}
            </span>
            {meta.board && (
              <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold border border-border bg-muted/50 text-foreground">
                🏛️ {meta.board}
              </span>
            )}
            {mgmtCfg && (
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${mgmtCfg.badgeClass}`}>
                {isMr ? mgmtCfg.labelMr : mgmtCfg.labelEn}
              </span>
            )}
            {genderCfg && (
              <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-muted text-foreground">
                {isMr ? genderCfg.labelMr : genderCfg.labelEn}
              </span>
            )}
            {meta.udise_aishe_code && (
              <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-muted/70 border border-border text-muted-foreground">
                ID: {meta.udise_aishe_code}
              </span>
            )}
            {meta.established_year && (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-muted/60 text-muted-foreground">
                Est. {meta.established_year}
              </span>
            )}
            {meta.accreditation && (
              <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/25 font-semibold">
                <Award className="w-3 h-3" /> {meta.accreditation}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs text-muted-foreground">
            <div className="flex items-start gap-1.5">
              <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <span className="text-foreground/90">
                {displayAddress || [school.area, school.sub_area, cityName].filter(Boolean).join(', ')}
              </span>
            </div>
            {meta.office_timing && (
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-primary shrink-0" />
                <span>
                  <strong className="text-foreground">{isMr ? 'कार्यालय वेळ:' : 'Office Hours:'}</strong>{' '}
                  {meta.office_timing}
                </span>
              </div>
            )}
            {meta.principal_name && (
              <div className="flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-primary shrink-0" />
                <span>
                  <strong className="text-foreground">{isMr ? 'प्राचार्य / प्रमुख:' : 'Principal / Head:'}</strong>{' '}
                  {meta.principal_name}
                </span>
              </div>
            )}
            {mediumLabels.length > 0 && (
              <div className="flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-primary shrink-0" />
                <span>
                  <strong className="text-foreground">{isMr ? 'माध्यम:' : 'Medium:'}</strong>{' '}
                  {mediumLabels.join(', ')}
                </span>
              </div>
            )}
          </div>

          {/* Primary Action Row */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
            {school.phone && (
              <a
                href={`tel:${school.phone}`}
                onClick={handleCall}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90"
              >
                <Phone className="w-3.5 h-3.5" />
                {isMr ? 'कॉल करा' : 'Call Office'} ({school.phone})
              </a>
            )}
            {waDigits && (
              <a
                href={`https://wa.me/${waDigits}?text=${encodeURIComponent(
                  isMr
                    ? `नमस्कार ${displayName}, मला प्रवेशाबाबत माहिती हवी आहे.`
                    : `Hello ${displayName}, I would like to enquire about admissions.`,
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => void logSchoolEngagement(school.id, 'whatsapp')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#25D366] text-white text-xs font-bold hover:opacity-95"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                WhatsApp
              </a>
            )}
            {websiteHref && (
              <a
                href={websiteHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => void logSchoolEngagement(school.id, 'website')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-border bg-background hover:bg-muted text-xs font-bold"
              >
                <Globe className="w-3.5 h-3.5 text-primary" />
                {isMr ? 'वेबसाइट' : 'Official Website'}
                <ExternalLink className="w-3 h-3 opacity-70" />
              </a>
            )}
            {school.email && (
              <a
                href={`mailto:${school.email}`}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-background hover:bg-muted text-xs font-semibold"
              >
                <Mail className="w-3.5 h-3.5 text-primary" />
                {school.email}
              </a>
            )}
            <a
              href={mapsHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => void logSchoolEngagement(school.id, 'maps')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-background hover:bg-muted text-xs font-semibold"
            >
              <Navigation className="w-3.5 h-3.5 text-primary" />
              {isMr ? 'नकाशा / रस्ता' : 'Directions'}
            </a>
          </div>
        </div>

        {/* Admissions Status, Deadline, Seats & Prospectus Hero */}
        <div className="bg-gradient-to-br from-primary/5 via-card to-card rounded-2xl border border-primary/20 p-4 sm:p-5 shadow-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-primary/10 text-primary">
                <GraduationCap className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-foreground">
                  {isMr ? 'प्रवेश व जागांची माहिती' : 'Admissions & Seat Availability'}
                </h2>
                <p className="text-[11px] text-muted-foreground">
                  {meta.classes_offered || typeLabel}
                </p>
              </div>
            </div>

            {admCfg && (
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border ${admCfg.badgeClass}`}
              >
                <span className={`w-2 h-2 rounded-full ${admCfg.dotClass}`} />
                {isMr ? admCfg.labelMr : admCfg.labelEn}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
            <div className="p-3 rounded-xl bg-background/80 border border-border">
              <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-primary" />
                {isMr ? 'अंतिम दिनांक' : 'Admission Deadline'}
              </div>
              <div className="font-bold text-foreground mt-1 text-sm">
                {meta.admission_deadline
                  ? new Date(meta.admission_deadline).toLocaleDateString(isMr ? 'mr-IN' : 'en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })
                  : admCfg?.value === 'closed'
                    ? isMr
                      ? 'सध्या बंद'
                      : 'Closed'
                    : isMr
                      ? 'संस्थेशी संपर्क करा'
                      : 'Rolling / Contact Office'}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-background/80 border border-border">
              <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-primary" />
                {isMr ? 'उपलब्ध जागा / प्रवेश क्षमता' : 'Available / Total Seats'}
              </div>
              <div className="font-bold text-foreground mt-1 text-sm">
                {meta.available_seats != null && meta.total_seats != null
                  ? `${meta.available_seats} / ${meta.total_seats}`
                  : meta.available_seats != null
                    ? `${meta.available_seats} ${isMr ? 'जागा उपलब्ध' : 'seats open'}`
                    : meta.total_seats != null
                      ? `${meta.total_seats} ${isMr ? 'एकूण क्षमता' : 'total intake'}`
                      : isMr
                        ? 'कार्यालयात विचारा'
                        : 'Enquire at Office'}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-background/80 border border-border">
              <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                <IndianRupee className="w-3.5 h-3.5 text-primary" />
                {isMr ? 'वार्षिक शुल्क श्रेणी' : 'Fee Structure Tier'}
              </div>
              <div className="font-bold text-foreground mt-1 text-sm">
                {meta.annual_fee_min != null || meta.annual_fee_max != null
                  ? `₹${(meta.annual_fee_min ?? 0).toLocaleString('en-IN')}${
                      meta.annual_fee_max
                        ? ` – ₹${meta.annual_fee_max.toLocaleString('en-IN')}`
                        : '+'
                    } / yr`
                  : feeCfg
                    ? isMr
                      ? feeCfg.labelMr
                      : feeCfg.labelEn
                    : isMr
                      ? 'तपशीलासाठी संपर्क साधा'
                      : 'Contact for Fees'}
              </div>
            </div>
          </div>

          {(applyHref || prospectusHref) && (
            <div className="flex flex-wrap gap-2 pt-1">
              {applyHref && (
                <a
                  href={applyHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => void logSchoolEngagement(school.id, 'website')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  {isMr ? 'ऑनलाइन अर्ज करा (Apply Online)' : 'Apply Online / Admission Portal'}
                </a>
              )}
              {prospectusHref && (
                <a
                  href={prospectusHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => void logSchoolEngagement(school.id, 'prospectus')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border bg-background hover:bg-muted text-xs font-bold"
                >
                  <FileText className="w-3.5 h-3.5 text-primary" />
                  {isMr ? 'माहितीपत्रक डाउनलोड (Prospectus)' : 'View Prospectus / Brochure'}
                </a>
              )}
            </div>
          )}
        </div>

        {/* Live Notice Board & Circulars */}
        <section className="bg-card rounded-2xl border border-border p-4 sm:p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-300">
                <Bell className="w-4 h-4" />
              </span>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-foreground">
                  {isMr ? 'ताज्या सूचना व परिपत्रके' : 'Live Notice Board & Circulars'}
                </h2>
                <p className="text-[11px] text-muted-foreground">
                  {isMr ? 'संस्थेने प्रसिद्ध केलेले अधिकृत संदेश' : 'Official announcements posted by institute administration'}
                </p>
              </div>
            </div>
            {notices.length > 0 && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                {notices.length}
              </span>
            )}
          </div>

          {notices.length === 0 ? (
            <div className="p-4 rounded-xl bg-muted/40 border border-dashed border-border text-xs text-muted-foreground text-center">
              {isMr
                ? 'सध्या कोणतीही नवीन सूचना प्रसिद्ध केलेली नाही.'
                : 'No active circulars or notices posted yet.'}
            </div>
          ) : (
            <div className="space-y-2.5">
              {notices.map((n) => {
                const catCfg = NOTICE_CATEGORY_CONFIG[n.category] || NOTICE_CATEGORY_CONFIG.general;
                const nTitle = isMr && n.title_mr ? n.title_mr : n.title;
                const nBody = isMr && n.body_mr ? n.body_mr : n.body;
                return (
                  <article
                    key={n.id}
                    className={`p-3.5 rounded-xl border ${
                      n.is_pinned ? 'border-amber-500/40 bg-amber-500/5' : 'border-border bg-background'
                    } space-y-1.5`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {n.is_pinned && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                            <Pin className="w-2.5 h-2.5" /> {isMr ? 'महत्त्वाचे' : 'Pinned'}
                          </span>
                        )}
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${catCfg.badgeClass}`}
                        >
                          {catCfg.emoji} {isMr ? catCfg.labelMr : catCfg.labelEn}
                        </span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(n.created_at).toLocaleDateString(isMr ? 'mr-IN' : 'en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-foreground">{nTitle}</h3>
                    {nBody && <p className="text-xs text-muted-foreground whitespace-pre-line">{nBody}</p>}
                    {isSafeHttpUrl(n.attachment_url) && (
                      <a
                        href={n.attachment_url!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline pt-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        {isMr ? 'संलग्नक / परिपत्रक पहा' : 'View Circular / Attachment'}
                      </a>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* Academics, About, Streams & Coaching Focus */}
        {(meta.raw_description ||
          (meta.streams && meta.streams.length > 0) ||
          (meta.coaching_focus && meta.coaching_focus.length > 0)) && (
          <section className="bg-card rounded-2xl border border-border p-4 sm:p-5 shadow-xs space-y-3">
            <h2 className="text-sm sm:text-base font-bold text-foreground flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-primary" />
              {isMr ? 'अभ्यासक्रम आणि संस्थेविषयी' : 'Academics, Courses & Overview'}
            </h2>

            {meta.raw_description && (
              <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed whitespace-pre-line">
                {meta.raw_description}
              </p>
            )}

            {meta.streams && meta.streams.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  {isMr ? 'उपलब्ध शाखा / अभ्यासक्रम' : 'Streams / Branches / Courses'}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {meta.streams.map((st) => (
                    <span
                      key={st}
                      className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-primary/10 text-primary border border-primary/20"
                    >
                      {st}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {meta.coaching_focus && meta.coaching_focus.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  {isMr ? 'स्पर्धा परीक्षा / कोचिंग बॅचेस' : 'Exam Focus & Coaching Batches'}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {meta.coaching_focus.map((cf) => (
                    <span
                      key={cf}
                      className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/25"
                    >
                      {cf}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Scholarships & Required Documents (2-Column Responsive Grid) */}
        {((meta.scholarships && meta.scholarships.length > 0) ||
          (meta.required_documents && meta.required_documents.length > 0)) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {meta.scholarships && meta.scholarships.length > 0 && (
              <section className="bg-card rounded-2xl border border-border p-4 sm:p-5 shadow-xs space-y-2.5">
                <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  {isMr ? 'शिष्यवृत्ती व सवलती' : 'Scholarships & Fee Concessions'}
                </h2>
                <ul className="space-y-1.5">
                  {meta.scholarships.map((sc) => (
                    <li
                      key={sc}
                      className="flex items-start gap-2 text-xs text-foreground/90 p-2 rounded-lg bg-muted/40 border border-border/60"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
                      <span>{sc}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {meta.required_documents && meta.required_documents.length > 0 && (
              <section className="bg-card rounded-2xl border border-border p-4 sm:p-5 shadow-xs space-y-2.5">
                <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                  <ClipboardList className="w-4 h-4 text-primary" />
                  {isMr ? 'प्रवेशासाठी आवश्यक कागदपत्रे' : 'Required Admission Documents'}
                </h2>
                <ul className="space-y-1.5">
                  {meta.required_documents.map((doc) => (
                    <li
                      key={doc}
                      className="flex items-start gap-2 text-xs text-foreground/90 p-2 rounded-lg bg-muted/40 border border-border/60"
                    >
                      <FileCheck2 className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                      <span>{doc}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}

        {/* Campus Facilities & Bus Routes */}
        {((meta.facilities && meta.facilities.length > 0) ||
          (meta.transport_villages && meta.transport_villages.length > 0)) && (
          <div className="bg-card rounded-2xl border border-border p-4 sm:p-5 shadow-xs space-y-4">
            {meta.facilities && meta.facilities.length > 0 && (
              <div className="space-y-2.5">
                <h2 className="text-sm sm:text-base font-bold text-foreground flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-primary" />
                  {isMr ? 'कॅम्पस व शैक्षणिक सुविधा' : 'Campus Facilities'}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {meta.facilities.map((fac) => (
                    <div
                      key={fac}
                      className="flex items-center gap-2 p-2.5 rounded-xl bg-muted/40 border border-border text-xs font-medium"
                    >
                      <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                      <span className="truncate">{fac}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {meta.transport_villages && meta.transport_villages.length > 0 && (
              <div className="space-y-2 pt-3 border-t border-border">
                <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                  <Bus className="w-4 h-4 text-emerald-600" />
                  {isMr ? 'बस / वाहतूक मार्ग गावे' : 'Bus / Transport Village Coverage'}
                </h2>
                <div className="flex flex-wrap gap-1.5">
                  {meta.transport_villages.map((village) => {
                    const isCurrent =
                      activeVillageNeedle && village.toLowerCase().includes(activeVillageNeedle);
                    return (
                      <span
                        key={village}
                        className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${
                          isCurrent
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40'
                            : 'bg-muted/60 text-foreground border-border'
                        }`}
                      >
                        <Bus className="w-3 h-3" />
                        {village}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Direct Parent / Student WhatsApp Enquiry Builder */}
        {waDigits && (
          <section className="bg-gradient-to-br from-emerald-500/5 via-card to-card rounded-2xl border border-emerald-500/25 p-4 sm:p-5 shadow-xs space-y-3">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
                <MessageCircle className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-foreground">
                  {isMr ? 'थेट WhatsApp प्रवेश चौकशी' : 'Direct Admission Enquiry on WhatsApp'}
                </h2>
                <p className="text-[11px] text-muted-foreground">
                  {isMr
                    ? 'विद्यार्थ्याची माहिती भरून संस्थेला थेट WhatsApp संदेश पाठवा.'
                    : 'Fill quick details to send a structured enquiry directly to the admissions office.'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <input
                type="text"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder={isMr ? 'विद्यार्थ्याचे नाव (ऐच्छिक)' : 'Student Name (optional)'}
                className="px-3 py-2 rounded-lg border border-input bg-background text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <input
                type="text"
                value={targetClass}
                onChange={(e) => setTargetClass(e.target.value)}
                placeholder={isMr ? 'इयत्ता / कोर्स (उदा. 11th Sci)' : 'Class / Course (e.g. 11th Sci)'}
                className="px-3 py-2 rounded-lg border border-input bg-background text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <input
                type="text"
                value={enquiryVillage}
                onChange={(e) => setEnquiryVillage(e.target.value)}
                placeholder={isMr ? 'गाव / परिसर' : 'Village / Area'}
                className="px-3 py-2 rounded-lg border border-input bg-background text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={enquiryQuestion}
                onChange={(e) => setEnquiryQuestion(e.target.value)}
                placeholder={
                  isMr
                    ? 'तुमचा प्रश्न (उदा. फी, बस वेळापत्रक, RTE / शिष्यवृत्ती)…'
                    : 'Your question (e.g. fees, bus timing, hostel, scholarship)…'
                }
                className="flex-1 px-3 py-2 rounded-lg border border-input bg-background text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="button"
                onClick={sendWhatsAppEnquiry}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#25D366] text-white text-xs sm:text-sm font-bold hover:opacity-95 active:scale-[0.99] shrink-0"
              >
                <Send className="w-4 h-4" />
                {isMr ? 'WhatsApp वर पाठवा' : 'Send WhatsApp Enquiry'}
              </button>
            </div>
          </section>
        )}

        {/* Nearby Student Hostels, PGs & Mess */}
        {nearbyLiving && (nearbyLiving.pgs.length > 0 || nearbyLiving.messes.length > 0) && (
          <section className="bg-card rounded-2xl border border-border p-4 sm:p-5 shadow-xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-foreground">
                  {isMr ? 'जवळपासचे विद्यार्थी वसतिगृह, पीजी व मेस' : 'Nearby Student Hostels, PGs & Mess'}
                </h2>
                <p className="text-[11px] text-muted-foreground">
                  {isMr
                    ? `${cityName} मधील विद्यार्थ्यांसाठी राहण्याची व भोजनाची सोय`
                    : `Student accommodation and daily tiffin/mess options around ${cityName}`}
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold">
                <Link to={`/${currentCity.slug}/pg`} className="text-primary hover:underline">
                  PGs
                </Link>
                <span className="text-muted-foreground">·</span>
                <Link to={`/${currentCity.slug}/mess`} className="text-primary hover:underline">
                  Mess
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {nearbyLiving.pgs.map((pg) => (
                <Link
                  key={`pg-${pg.id}`}
                  to={`/${currentCity.slug}/pg/${pg.slug || pg.id}`}
                  className="p-3 rounded-xl border border-border bg-background hover:bg-muted/50 transition-colors flex items-start gap-2.5"
                >
                  <span className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600 shrink-0">
                    <BedDouble className="w-4 h-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-foreground truncate">
                      {isMr && pg.name_mr ? pg.name_mr : pg.name}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                      {pg.area || cityName}
                    </div>
                    <div className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-300 mt-1">
                      {pg.pg_profile?.available_beds != null && pg.pg_profile.available_beds > 0
                        ? `${pg.pg_profile.available_beds} ${isMr ? 'खाटा रिक्त' : 'beds vacant'}`
                        : isMr
                          ? 'पीजी / वसतिगृह पहा →'
                          : 'View Hostel / PG →'}
                    </div>
                  </div>
                </Link>
              ))}

              {nearbyLiving.messes.map((m) => (
                <Link
                  key={`mess-${m.id}`}
                  to={`/${currentCity.slug}/mess/${m.slug || m.id}`}
                  className="p-3 rounded-xl border border-border bg-background hover:bg-muted/50 transition-colors flex items-start gap-2.5"
                >
                  <span className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 shrink-0">
                    <UtensilsCrossed className="w-4 h-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-foreground truncate">
                      {isMr && m.name_mr ? m.name_mr : m.name}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                      {m.area || cityName}
                    </div>
                    <div className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-300 mt-1">
                      {m.mess_profile?.monthly_rate
                        ? `₹${m.mess_profile.monthly_rate}/mo`
                        : isMr
                          ? 'दैनिक मेस मेन्यू पहा →'
                          : 'View Mess Menu →'}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Community Ratings & Reviews */}
        <ReviewsSection shopId={school.id} entityType="school" shopName={displayName} />

        {/* Unclaimed Institute CTA */}
        {!school.is_claimed && (
          <div className="rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-primary" />
                {isMr
                  ? 'तुम्ही प्राचार्य किंवा अधिकृत कर्मचारी आहात का?'
                  : 'Are you the Principal, Trustee, or Authorized Staff?'}
              </p>
              <p className="text-xs text-muted-foreground">
                {isMr
                  ? 'ही संस्था दावा करून थेट प्रवेश स्थिती, परिपत्रके, फी आणि रिक्त जागा अद्यतनित करा.'
                  : 'Claim this institute to post live notices, update admissions status, fee tiers, and bus routes.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setClaimOpen(true)}
              className="shrink-0 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 active:scale-[0.98]"
            >
              <ShieldCheck className="w-4 h-4" />
              {isMr ? 'संस्थेवर दावा करा' : 'Claim this Institute'}
            </button>
          </div>
        )}
      </main>

      {/* Sticky Mobile Bottom Connect Bar */}
      <div
        className="fixed bottom-0 inset-x-0 z-30 bg-background/95 backdrop-blur-md border-t border-border p-3"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="max-w-3xl mx-auto flex items-center gap-2">
          {school.phone && (
            <a
              href={`tel:${school.phone}`}
              onClick={handleCall}
              className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98] transition-all shadow-sm"
            >
              <Phone className="w-4 h-4" />
              <span>{isMr ? 'कॉल करा' : 'Call Now'}</span>
            </a>
          )}
          {waDigits && (
            <a
              href={`https://wa.me/${waDigits}?text=${encodeURIComponent(
                isMr
                  ? `नमस्कार ${displayName}, मला प्रवेशाबाबत माहिती हवी आहे.`
                  : `Hello ${displayName}, I would like to enquire about admissions.`,
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => void logSchoolEngagement(school.id, 'whatsapp')}
              className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold bg-[#25D366] text-white hover:opacity-95 active:scale-[0.98] transition-all shadow-sm"
            >
              <MessageCircle className="w-4 h-4" />
              <span>WhatsApp</span>
            </a>
          )}
          <a
            href={mapsHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => void logSchoolEngagement(school.id, 'maps')}
            className="p-2.5 rounded-xl border border-border bg-card hover:bg-muted text-foreground transition-colors shrink-0"
            title={isMr ? 'नकाशा' : 'Directions'}
            aria-label="Directions"
          >
            <Navigation className="w-4 h-4 text-primary" />
          </a>
        </div>
      </div>

      <Footer />

      <CityPickerModal open={cityPickerOpen} onOpenChange={setCityPickerOpen} />

      {claimOpen && (
        <ClaimSchoolModal
          schoolId={school.id}
          schoolName={displayName}
          defaultUdise={meta.udise_aishe_code}
          onClose={() => setClaimOpen(false)}
        />
      )}
    </div>
  );
}
