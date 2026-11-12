import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PageSeo } from '@/components/seo/PageSeo';
import {
  ArrowLeft,
  BedDouble,
  Phone,
  MessageCircle,
  MapPin,
  Clock,
  Share2,
  Navigation,
  ShieldCheck,
  Users,
  CheckCircle2,
  Check,
  Wifi,
  Waves,
  Shield,
  Zap,
  Sparkles,
  Key,
  DoorOpen,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import { useCity } from '@/hooks/useCity';
import { useT } from '@/i18n';
import { fetchPGBySlugOrId } from '@/lib/living/livingService';
import type { PGWithDetails } from '@/lib/living/livingTypes';
import { BookmarkButton } from '@/components/BookmarkButton';
import { DesktopNav } from '@/components/DesktopNav';
import { UserMenuDrawer } from '@/components/UserMenuDrawer';
import { PhotoSlider } from '@/components/shared/PhotoSlider';
import { ReviewsSection } from '@/components/reviews/ReviewsSection';
import { Footer } from '@/components/shared/Footer';
import { CityPickerModal } from '@/components/shared/CityPickerModal';
import { useEdgeSwipeBack } from '@/hooks/useEdgeSwipeBack';
import { toast } from 'sonner';
import { handleTelLinkClick } from '@/lib/engagement';
import { DemoBadge, isParandwadiDemoListing } from '@/components/shared/DemoBadge';

export default function PGDetail() {
  const { citySlug, id } = useParams<{ citySlug: string; id: string }>();
  const navigate = useNavigate();
  const { currentCity, currentVillage, townBrand } = useCity();
  const { t, locale } = useT();

  const [cityPickerOpen, setCityPickerOpen] = useState(false);

  const { indicatorNode } = useEdgeSwipeBack({
    fallbackPath: `/${citySlug || currentCity.slug}/pg`,
  });

  const cityName = locale === 'mr' && currentCity.name_mr ? currentCity.name_mr : currentCity.name;
  const villageName = currentVillage ? (locale === 'mr' && currentVillage.name_mr ? currentVillage.name_mr : currentVillage.name) : null;
  const locationLabel = villageName ? `${villageName}, ${cityName}` : cityName;

  const { data: pg, isLoading, error } = useQuery<PGWithDetails | null>({
    queryKey: ['living-pg-detail', id, currentCity.id],
    queryFn: () => fetchPGBySlugOrId(id!, currentCity.id),
    staleTime: 2 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs text-muted-foreground">
          {locale === 'mr' ? 'पीजी माहिती लोड होत आहे...' : 'Loading PG details...'}
        </p>
      </div>
    );
  }

  if (error || !pg) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
          <BedDouble className="w-7 h-7" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground">
            {locale === 'mr' ? 'पीजी / वसतिगृह सापडले नाही' : 'PG / Hostel Not Found'}
          </h2>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs">
            {locale === 'mr'
              ? 'हे वसतिगृह उपलब्ध नाही किंवा लिंक बदलली आहे.'
              : 'This PG listing is unavailable or the link may have changed.'}
          </p>
        </div>
        <button
          onClick={() => navigate(`/${citySlug || currentCity.slug}/pg`)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold shadow-xs"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{locale === 'mr' ? 'सर्व पीजी पहा' : 'Browse All PGs'}</span>
        </button>
      </div>
    );
  }

  const displayName = locale === 'mr' && pg.name_mr ? pg.name_mr : pg.name;
  const profile = pg.pg_profile;
  const phone = pg.phone || pg.whatsapp || '';
  const cleanPhone = phone.replace(/\D/g, '');

  const photos = Array.isArray(pg.photos) && pg.photos.length > 0
    ? pg.photos
    : (pg.image_url ? [pg.image_url] : []);

  const totalBeds = profile?.total_beds || 0;
  const availableBeds = profile?.available_beds || 0;
  const isVacant = availableBeds > 0;
  const sharingRates = profile?.sharing_rates || {};
  const rooms = profile?.rooms || sharingRates.rooms || [];

  // Lowest starting rent
  const ratesList = [
    sharingRates['1_sharing'],
    sharingRates['2_sharing'],
    sharingRates['3_sharing'],
    sharingRates['4_sharing'],
  ].filter((r): r is number => typeof r === 'number' && r > 0);
  const startingRate = ratesList.length > 0 ? Math.min(...ratesList) : null;

  const handleShare = async () => {
    const shareUrl = window.location.href;
    const shareText = locale === 'mr'
      ? `${displayName} - पीजी, खोल्या व भाडे (${locationLabel})`
      : `${displayName} - PG, Rooms & Rent Rates in ${locationLabel}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: displayName, text: shareText, url: shareUrl });
        return;
      } catch { /* ignore user cancellation */ }
    }
    await navigator.clipboard.writeText(shareUrl);
    toast.success(locale === 'mr' ? 'लिंक कॉपी केली!' : 'Link copied to clipboard!');
  };

  const mapSearchQuery = encodeURIComponent(`${pg.name} ${pg.address || ''} ${cityName}`);
  const directionsUrl = `https://www.google.com/maps/search/?api=1&query=${mapSearchQuery}`;

  const genderLabel = profile?.gender === 'boys'
    ? (locale === 'mr' ? '👨 बॉईज पीजी (Boys Only)' : '👨 Boys PG')
    : profile?.gender === 'girls'
    ? (locale === 'mr' ? '👩 गर्ल्स पीजी (Girls Only)' : '👩 Girls PG')
    : (locale === 'mr' ? '👫 को-एड / सर्वांसाठी' : '👫 Co-ed / Open to All');

  return (
    <div className="min-h-screen bg-background text-foreground pb-28">
      {indicatorNode}
      <PageSeo
        title={`${displayName} - ${locale === 'mr' ? 'पीजी, खोल्या व भाडे' : 'PG & Hostel Rooms'} | ${locationLabel}`}
        description={
          locale === 'mr'
            ? `${displayName} (${locationLabel}) मधील रिक्त खाटा, रूम शेअरिंग भाडे, भोजन आणि वसतिगृह सुविधा.`
            : `Available beds, room sharing rent rates, food, and student amenities at ${displayName} in ${locationLabel}.`
        }
      />

      {/* Top Sticky App Bar */}
      <header className="sticky top-0 z-40 bg-primary text-primary-foreground shadow-md">
        <div className="max-w-2xl md:max-w-4xl lg:max-w-6xl xl:max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-3 flex items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
            <button
              onClick={() => navigate(`/${citySlug || currentCity.slug}/pg`)}
              aria-label="Back to PG Directory"
              className="inline-flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-primary-foreground/10 hover:bg-primary-foreground/20 active:scale-95 transition-all shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-sm sm:text-base font-bold leading-tight truncate">
              {displayName}
            </h1>
          </div>

          <DesktopNav variant="primary" />

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              onClick={handleShare}
              aria-label="Share"
              className="inline-flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-lg hover:bg-primary-foreground/10 active:scale-95 transition-all shrink-0"
              title="Share"
            >
              <Share2 className="w-4 h-4" />
            </button>
            <BookmarkButton shopId={pg.id} />
            <UserMenuDrawer />
          </div>
        </div>
      </header>

      <main className="max-w-2xl md:max-w-4xl lg:max-w-6xl xl:max-w-7xl mx-auto px-4 md:px-6 pt-3 space-y-4">
        {/* Photo Gallery with Overlays */}
        {photos.length > 0 ? (
          <div className="rounded-2xl overflow-hidden border border-border shadow-xs">
            <PhotoSlider
              photos={photos}
              imageUrl={pg.image_url}
              alt={displayName}
              heightClass="h-56 sm:h-72 w-full"
              showArrows
              showDots
              showCounter
              showThumbnails={photos.length > 1}
              enableLightbox
              overlayTopLeft={
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border backdrop-blur-md shadow-xs ${
                  isVacant
                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-400/40'
                    : 'bg-black/80 text-rose-300 border-rose-400/40'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${isVacant ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
                  <span>
                    {isVacant
                      ? (locale === 'mr' ? `${availableBeds} जागा रिक्त` : `${availableBeds} Beds Vacant`)
                      : (locale === 'mr' ? 'सध्या जागा शिल्लक नाही (Full)' : 'Currently Full')}
                  </span>
                </span>
              }
              overlayBottomLeft={
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-black/60 backdrop-blur-xs border border-white/20 text-white">
                  {genderLabel}
                </span>
              }
              overlayBottomRight={
                startingRate ? (
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-primary text-primary-foreground shadow-xs">
                    ₹{startingRate}/mo
                  </span>
                ) : undefined
              }
            />
          </div>
        ) : null}

        {/* Title, Verification & Location Section */}
        <div className="bg-card rounded-2xl border border-border p-4 shadow-xs space-y-2.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold text-foreground leading-tight">
                  {displayName}
                </h1>
                {pg.is_verified && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Verified</span>
                  </span>
                )}
                {isParandwadiDemoListing(pg, currentVillage) && <DemoBadge size="md" />}
              </div>

              {/* Area & Address */}
              <div className="mt-1 flex items-start gap-1.5 text-xs text-muted-foreground">
                <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <span className="leading-snug">
                  {pg.address || pg.area || locationLabel}
                </span>
              </div>
            </div>

            {/* Price Pill if no photo */}
            {photos.length === 0 && startingRate && (
              <div className="shrink-0 text-right">
                <div className="text-base font-bold text-primary">₹{startingRate}</div>
                <div className="text-[10px] text-muted-foreground">/ month</div>
              </div>
            )}
          </div>

          {/* Quick Info Badges */}
          <div className="flex items-center gap-2 pt-1 flex-wrap text-xs">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-muted text-foreground font-semibold">
              {genderLabel}
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-muted text-foreground font-medium">
              👥 {profile?.occupancy_target === 'students'
                ? (locale === 'mr' ? 'केवळ विद्यार्थी (Students)' : 'Students Only')
                : profile?.occupancy_target === 'professionals'
                ? (locale === 'mr' ? 'नोकरदार (Professionals)' : 'Working Professionals')
                : (locale === 'mr' ? 'विद्यार्थी व नोकरदार' : 'Students & Working')}
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-500/20">
              {profile?.food_included
                ? (locale === 'mr' ? '🍲 जेवण समाविष्ट (Food Included)' : '🍲 Food Included')
                : (locale === 'mr' ? '🍳 स्वयंपाक / मेस जवळ' : '🍳 Self Cooking / Mess Nearby')}
            </span>
          </div>
        </div>

        {/* Live Bed Vacancy Card */}
        <div className="bg-gradient-to-b from-indigo-500/5 to-card rounded-2xl border border-indigo-500/20 p-4 shadow-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600">
                <BedDouble className="w-4 h-4" />
              </span>
              <div>
                <h2 className="text-sm font-bold text-foreground">
                  {locale === 'mr' ? 'रिक्त जागांची सद्यस्थिती' : 'Bed Vacancies & Capacity'}
                </h2>
                <p className="text-[10px] text-muted-foreground">
                  {locale === 'mr' ? 'सध्याच्या उपलब्ध खाटा' : 'Real-time bed availability'}
                </p>
              </div>
            </div>

            <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
              isVacant
                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                : 'bg-rose-500/10 text-rose-600 border-rose-500/20'
            }`}>
              {isVacant
                ? (locale === 'mr' ? `${availableBeds} जागा मोकळ्या` : `${availableBeds} Beds Vacant`)
                : (locale === 'mr' ? 'पूर्ण भरले आहे (No vacancy)' : 'Fully Occupied')}
            </span>
          </div>

          {/* Progress / Capacity Bar */}
          {totalBeds > 0 && (
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{locale === 'mr' ? 'एकूण खाटांची क्षमता' : 'Total Capacity'}</span>
                <span className="font-bold text-foreground">{totalBeds} Beds</span>
              </div>
              <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.round(((totalBeds - availableBeds) / totalBeds) * 100))}%` }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground text-right">
                {totalBeds - availableBeds} occupied / {availableBeds} available
              </p>
            </div>
          )}

          {/* Room-by-room breakdown if available */}
          {rooms && rooms.length > 0 && (
            <div className="pt-2 border-t border-border/60 space-y-2">
              <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <DoorOpen className="w-3.5 h-3.5 text-primary" />
                <span>{locale === 'mr' ? 'खोल्यांचे तपशील (Room Breakdown)' : 'Rooms & Occupancy'}</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {rooms.map((room) => (
                  <div key={room.id} className="p-2.5 rounded-xl bg-card border border-border/80 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-foreground">Room {room.room_number}</div>
                      <div className="text-[10px] text-muted-foreground capitalize">
                        {room.sharing_type?.replace('_', ' ') || 'Shared'}
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                      room.available_beds > 0
                        ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                        : 'bg-muted text-muted-foreground border-border'
                    }`}>
                      {room.available_beds > 0 ? `${room.available_beds} vacant` : 'Full'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Room Sharing Rent & Rates Card */}
        <div className="bg-card rounded-2xl border border-border p-4 shadow-xs space-y-3">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5">
            <span>💳</span>
            <span>{locale === 'mr' ? 'मासिक भाडे आणि दर (Monthly Rent)' : 'Sharing Rent & Pricing'}</span>
          </h2>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3 rounded-xl border border-border bg-muted/30 space-y-1">
              <span className="text-[11px] font-semibold text-muted-foreground">
                {locale === 'mr' ? '१-शेअरिंग (Single Room)' : '1-Sharing (Single)'}
              </span>
              <div className="text-base sm:text-lg font-bold text-foreground">
                {sharingRates['1_sharing'] ? `₹${sharingRates['1_sharing']}` : '—'}
                {sharingRates['1_sharing'] && <span className="text-[10px] font-normal text-muted-foreground">/mo</span>}
              </div>
              <p className="text-[10px] text-muted-foreground">
                {locale === 'mr' ? 'स्वतंत्र रूम' : 'Private room'}
              </p>
            </div>

            <div className="p-3 rounded-xl border border-primary/20 bg-primary/5 space-y-1">
              <span className="text-[11px] font-semibold text-muted-foreground">
                {locale === 'mr' ? '२-शेअरिंग (Double Sharing)' : '2-Sharing (Double)'}
              </span>
              <div className="text-base sm:text-lg font-bold text-primary">
                {sharingRates['2_sharing'] ? `₹${sharingRates['2_sharing']}` : '—'}
                {sharingRates['2_sharing'] && <span className="text-[10px] font-normal text-muted-foreground">/mo</span>}
              </div>
              <p className="text-[10px] text-muted-foreground">
                {locale === 'mr' ? '२ जणांमध्ये शेअर' : '2 roommates per room'}
              </p>
            </div>

            <div className="p-3 rounded-xl border border-border bg-muted/30 space-y-1">
              <span className="text-[11px] font-semibold text-muted-foreground">
                {locale === 'mr' ? '३-शेअरिंग (Triple Sharing)' : '3-Sharing (Triple)'}
              </span>
              <div className="text-base sm:text-lg font-bold text-foreground">
                {sharingRates['3_sharing'] ? `₹${sharingRates['3_sharing']}` : '—'}
                {sharingRates['3_sharing'] && <span className="text-[10px] font-normal text-muted-foreground">/mo</span>}
              </div>
              <p className="text-[10px] text-muted-foreground">
                {locale === 'mr' ? '३ जणांमध्ये शेअर' : '3 roommates per room'}
              </p>
            </div>

            <div className="p-3 rounded-xl border border-border bg-muted/30 space-y-1">
              <span className="text-[11px] font-semibold text-muted-foreground">
                {locale === 'mr' ? '४-शेअरिंग (Four Sharing)' : '4-Sharing (Four)'}
              </span>
              <div className="text-base sm:text-lg font-bold text-foreground">
                {sharingRates['4_sharing'] ? `₹${sharingRates['4_sharing']}` : '—'}
                {sharingRates['4_sharing'] && <span className="text-[10px] font-normal text-muted-foreground">/mo</span>}
              </div>
              <p className="text-[10px] text-muted-foreground">
                {locale === 'mr' ? '४ जणांमध्ये शेअर' : '4 roommates per room'}
              </p>
            </div>
          </div>

          {/* Security Deposit and Notice Period */}
          <div className="pt-2 border-t border-border/60 grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded-xl bg-muted/40 border border-border flex flex-col justify-between">
              <span className="text-[11px] text-muted-foreground font-medium">
                🔒 {locale === 'mr' ? 'डिपॉझिट (Deposit)' : 'Security Deposit'}
              </span>
              <span className="text-sm font-bold text-foreground mt-0.5">
                {profile?.deposit_amount ? `₹${profile.deposit_amount}` : (locale === 'mr' ? 'नाही (Nil)' : 'No Deposit')}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-muted/40 border border-border flex flex-col justify-between">
              <span className="text-[11px] text-muted-foreground font-medium">
                ⏳ {locale === 'mr' ? 'नोटीस कालावधी' : 'Notice Period'}
              </span>
              <span className="text-sm font-bold text-foreground mt-0.5">
                {profile?.notice_period_days ? `${profile.notice_period_days} Days` : '30 Days'}
              </span>
            </div>
          </div>
        </div>

        {/* House Rules & Timings */}
        <div className="bg-card rounded-2xl border border-border p-4 shadow-xs space-y-3">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-primary" />
            <span>{locale === 'mr' ? 'वसतिगृहाचे नियम व वेळ' : 'House Rules & Timings'}</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="p-3 rounded-xl bg-muted/40 border border-border flex flex-wrap items-center justify-between gap-1.5">
              <span className="text-muted-foreground font-medium flex items-center gap-1">
                <span>🚪</span> {locale === 'mr' ? 'गेट बंद होण्याची वेळ' : 'Gate Closing Time'}
              </span>
              <span className="font-bold text-foreground">
                {profile?.gate_closing_time || '10:00 PM'}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-muted/40 border border-border flex flex-wrap items-center justify-between gap-1.5">
              <span className="text-muted-foreground font-medium flex items-center gap-1">
                <span>🍲</span> {locale === 'mr' ? 'भोजन व्यवस्था' : 'Food Facility'}
              </span>
              <span className="font-bold text-foreground">
                {profile?.food_included ? 'Included in Rent' : 'Self-cooking / Mess'}
              </span>
            </div>
          </div>
        </div>

        {/* Amenities & Facilities Grid */}
        {profile?.amenities && profile.amenities.length > 0 && (
          <div className="bg-card rounded-2xl border border-border p-4 shadow-xs space-y-3">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-primary" />
              <span>{locale === 'mr' ? 'उपलब्ध सुविधा' : 'Amenities & Facilities'}</span>
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              {profile.amenities.map((amenity: string, idx: number) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 p-2.5 rounded-xl bg-muted/40 border border-border"
                >
                  <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                  <span className="font-medium text-foreground truncate">{amenity}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Location & Directions Card */}
        <div className="bg-card rounded-2xl border border-border p-4 shadow-xs space-y-3">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-primary" />
            <span>{locale === 'mr' ? 'पत्ता आणि मार्ग' : 'Location & Directions'}</span>
          </h2>

          <p className="text-xs text-foreground/90 leading-relaxed">
            {pg.address || `${pg.area || ''}, ${cityName}`}
          </p>

          <a
            href={directionsUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-border bg-background hover:bg-muted font-bold text-xs text-foreground transition-colors"
          >
            <Navigation className="w-4 h-4 text-primary" />
            <span>{locale === 'mr' ? 'गुगल मॅप्सवर रस्ता पहा (Get Directions)' : 'Open in Google Maps'}</span>
          </a>
        </div>

        {/* Community Reviews Section */}
        <ReviewsSection shopId={pg.id} shopName={pg.name} />
      </main>

      {/* Sticky Bottom Contact Bar */}
      <div
        className="fixed bottom-0 inset-x-0 z-30 bg-background/95 backdrop-blur-md border-t border-border p-3"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="max-w-2xl mx-auto flex items-center gap-2">
          {phone ? (
            <a
              href={`tel:${phone}`}
              onClick={(e) => handleTelLinkClick(e, phone, displayName)}
              className="flex-1 inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 active:scale-98 transition-all shadow-sm"
            >
              <Phone className="w-4 h-4" />
              <span>{locale === 'mr' ? 'कॉल करा' : 'Call Now'}</span>
            </a>
          ) : null}

          {pg.whatsapp ? (
            <a
              href={`https://wa.me/91${pg.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(
                locale === 'mr'
                  ? `नमस्ते, मी ${townBrand} वर ${displayName} पाहिले. मला रूम व रिक्त जागांबद्दल माहिती हवी आहे.`
                  : `Hello, I found ${displayName} on ${townBrand}. I want to inquire about room availability and rent.`
              )}`}
              target="_blank"
              rel="noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 active:scale-98 transition-all shadow-sm"
            >
              <MessageCircle className="w-4 h-4" />
              <span>WhatsApp</span>
            </a>
          ) : null}

          <a
            href={directionsUrl}
            target="_blank"
            rel="noreferrer"
            className="p-3 rounded-xl border border-border bg-card hover:bg-muted text-foreground transition-colors shrink-0"
            title="Directions"
            aria-label="Directions"
          >
            <Navigation className="w-4 h-4 text-primary" />
          </a>
        </div>
      </div>

      <Footer />

      <CityPickerModal open={cityPickerOpen} onOpenChange={setCityPickerOpen} />
    </div>
  );
}
