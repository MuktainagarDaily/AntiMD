import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PageSeo } from '@/components/seo/PageSeo';
import {
  ArrowLeft,
  UtensilsCrossed,
  Phone,
  MessageCircle,
  MapPin,
  Clock,
  Share2,
  Navigation,
  ShieldCheck,
  Sparkles,
  Check,
  Calendar,
  X,
  Plus,
  AlertCircle,
  ChefHat,
  BadgeCheck,
} from 'lucide-react';
import { useCity } from '@/hooks/useCity';
import { useT } from '@/i18n';
import { fetchMessBySlugOrId, getMessServingStatus, isSundaySpecialActive } from '@/lib/living/livingService';
import { getEstablishmentCategory, type MessWithDetails } from '@/lib/living/livingTypes';
import { BookmarkButton } from '@/components/BookmarkButton';
import { DesktopNav } from '@/components/DesktopNav';
import { UserMenuDrawer } from '@/components/UserMenuDrawer';
import { PhotoSlider } from '@/components/shared/PhotoSlider';
import { ReviewsSection } from '@/components/reviews/ReviewsSection';
import { Footer } from '@/components/shared/Footer';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { CityPickerModal } from '@/components/shared/CityPickerModal';
import { useEdgeSwipeBack } from '@/hooks/useEdgeSwipeBack';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { handleTelLinkClick } from '@/lib/engagement';
import { DemoBadge, isParandwadiDemoListing } from '@/components/shared/DemoBadge';

export default function MessDetail() {
  const { citySlug, id } = useParams<{ citySlug: string; id: string }>();
  const navigate = useNavigate();
  const { currentCity, currentVillage, townBrand } = useCity();
  const { t, locale } = useT();

  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);
  const [cityPickerOpen, setCityPickerOpen] = useState(false);

  const { indicatorNode } = useEdgeSwipeBack({
    fallbackPath: `/${citySlug || currentCity.slug}/mess`,
  });

  const cityName = locale === 'mr' && currentCity.name_mr ? currentCity.name_mr : currentCity.name;
  const villageName = currentVillage ? (locale === 'mr' && currentVillage.name_mr ? currentVillage.name_mr : currentVillage.name) : null;
  const locationLabel = villageName ? `${villageName}, ${cityName}` : cityName;

  const { data: mess, isLoading, error } = useQuery<MessWithDetails | null>({
    queryKey: ['living-mess-detail', id, currentCity.id],
    queryFn: () => fetchMessBySlugOrId(id!, currentCity.id),
    staleTime: 2 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs text-muted-foreground">
          {locale === 'mr' ? 'मेस माहिती लोड होत आहे...' : 'Loading mess details...'}
        </p>
      </div>
    );
  }

  if (error || !mess) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
          <UtensilsCrossed className="w-7 h-7" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground">
            {locale === 'mr' ? 'मेस सापडली नाही' : 'Mess Not Found'}
          </h2>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs">
            {locale === 'mr'
              ? 'ही मेस उपलब्ध नाही किंवा लिंक बदलली आहे.'
              : 'This mess listing is unavailable or the link may have changed.'}
          </p>
        </div>
        <button
          onClick={() => navigate(`/${citySlug || currentCity.slug}/mess`)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold shadow-xs"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{locale === 'mr' ? 'सर्व मेस पहा' : 'Browse All Messes'}</span>
        </button>
      </div>
    );
  }

  const displayName = locale === 'mr' && mess.name_mr ? mess.name_mr : mess.name;
  const profile = mess.mess_profile;
  const activeMenu = mess.today_menu || mess.latest_menu;
  const isTodayMenu = !!mess.today_menu;
  const phone = mess.phone || mess.whatsapp || '';
  const cleanPhone = phone.replace(/\D/g, '');
  const menuItems = mess.menu_items || [];
  const servingInfo = getMessServingStatus(mess, locale);
  const isSundayFeast = isSundaySpecialActive(profile) || profile?.sunday_feast;
  const estType = getEstablishmentCategory(mess);

  const photos = Array.isArray(mess.photos) && mess.photos.length > 0
    ? mess.photos
    : (mess.image_url ? [mess.image_url] : []);

  const handleShare = async () => {
    const shareUrl = window.location.href;
    const shareText = locale === 'mr'
      ? `${displayName} - आजचा मेनू, थाळी आणि दर (${locationLabel})`
      : `${displayName} - Daily Menu, Thali Rates in ${locationLabel}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: displayName, text: shareText, url: shareUrl });
        return;
      } catch { /* ignore user cancellation */ }
    }
    await navigator.clipboard.writeText(shareUrl);
    toast.success(locale === 'mr' ? 'लिंक कॉपी केली!' : 'Link copied to clipboard!');
  };

  const mapSearchQuery = encodeURIComponent(`${mess.name} ${mess.address || ''} ${cityName}`);
  const directionsUrl = `https://www.google.com/maps/search/?api=1&query=${mapSearchQuery}`;

  return (
    <div className="min-h-screen bg-background text-foreground pb-28">
      {indicatorNode}
      <PageSeo
        title={`${displayName} - ${locale === 'mr' ? 'मेस, थाळी व आजचा मेनू' : 'Mess, Thali & Daily Menu'} | ${locationLabel}`}
        description={
          locale === 'mr'
            ? `${displayName} (${locationLabel}) मधील आजचा मेनू, थाळीचे दर, मासिक पास आणि टिफिन सेवा.`
            : `Today's menu, thali rates, monthly mess pass, and tiffin delivery at ${displayName} in ${locationLabel}.`
        }
      />

      {/* Top Sticky App Bar */}
      <header className="sticky top-0 z-40 bg-primary text-primary-foreground shadow-md">
        <div className="max-w-2xl md:max-w-4xl lg:max-w-6xl xl:max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-3 flex items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
            <button
              onClick={() => navigate(`/${citySlug || currentCity.slug}/mess`)}
              aria-label="Back to Mess Directory"
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
            <BookmarkButton shopId={mess.id} />
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
              imageUrl={mess.image_url}
              alt={displayName}
              heightClass="h-56 sm:h-72 w-full"
              showArrows
              showDots
              showCounter
              showThumbnails={photos.length > 1}
              enableLightbox
              overlayTopLeft={
                <span className={cn(
                  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border backdrop-blur-md shadow-xs',
                  servingInfo.isLive ? 'bg-black/60 text-emerald-300 border-emerald-400/40' : 'bg-black/60 text-white/90 border-white/20'
                )}>
                  {servingInfo.isLive && (
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                  )}
                  <span>{servingInfo.label}</span>
                </span>
              }
              overlayBottomLeft={
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-black/60 backdrop-blur-xs border border-white/20 text-white">
                    {estType === 'hotel' ? '🏨 Hotel' : estType === 'tiffin' ? '🍱 Tiffin' : '🍽️ Mess'}
                  </span>
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-black/60 backdrop-blur-xs border border-white/20 text-white">
                    {profile?.mess_type === 'pure_veg'
                      ? '🥦 Pure Veg'
                      : profile?.mess_type === 'jain_available'
                      ? '🥬 Jain'
                      : '🍗 Veg & Non-Veg'}
                  </span>
                </div>
              }
              overlayBottomRight={
                profile?.monthly_rate ? (
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-primary text-primary-foreground shadow-xs">
                    ₹{profile.monthly_rate}/mo
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
                {mess.is_verified && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Verified</span>
                  </span>
                )}
                {isParandwadiDemoListing(mess, currentVillage) && <DemoBadge size="md" />}
              </div>

              {/* Area & Address */}
              <div className="mt-1 flex items-start gap-1.5 text-xs text-muted-foreground">
                <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <span className="leading-snug">
                  {mess.address || mess.area || locationLabel}
                </span>
              </div>
            </div>

            {/* Price Pill if no photo */}
            {photos.length === 0 && profile?.monthly_rate && (
              <div className="shrink-0 text-right">
                <div className="text-base font-bold text-primary">₹{profile.monthly_rate}</div>
                <div className="text-[10px] text-muted-foreground">/ month</div>
              </div>
            )}
          </div>

          {/* Quick tags */}
          <div className="flex items-center gap-2 pt-1 flex-wrap text-xs">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-muted text-foreground font-medium">
              {profile?.mess_type === 'pure_veg' ? '🥦 Pure Veg' : profile?.mess_type === 'jain_available' ? '🥬 Jain Available' : '🍗 Veg & Non-Veg'}
            </span>
            {profile?.single_thali_rate && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-muted text-foreground font-medium">
                ₹{profile.single_thali_rate} / {estType === 'hotel' ? 'meal' : 'thali'}
              </span>
            )}
            {profile?.tiffin_delivery && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-500/20">
                🍱 {locale === 'mr' ? 'डबा / टिफिन सेवा' : 'Tiffin Available'}
              </span>
            )}
          </div>
        </div>

        {/* Sunday Special Feast Alert Banner */}
        {isSundayFeast && (
          <div className="p-3 rounded-2xl bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-transparent border border-amber-500/30 flex items-center gap-3">
            <span className="text-xl shrink-0">✨</span>
            <div className="min-w-0">
              <p className="text-xs font-bold text-amber-800 dark:text-amber-300">
                {locale === 'mr' ? 'रविवार स्पेशल मेजवानी उपलब्ध!' : 'Sunday Special Feast Available!'}
              </p>
              <p className="text-[11px] text-amber-700/90 dark:text-amber-400 mt-0.5">
                {locale === 'mr'
                  ? 'पुरणपोळी, गोड पदार्थ किंवा विशेष बेत उपलब्ध असतो. अधिक माहितीसाठी संपर्क करा.'
                  : 'Special feast dishes served on Sundays. Call or visit to confirm this week’s feast.'}
              </p>
            </div>
          </div>
        )}

        {/* Today's Daily Menu (Highlight Feature) */}
        <div className="bg-gradient-to-b from-primary/5 to-card rounded-2xl border border-primary/20 p-4 shadow-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
                <ChefHat className="w-4 h-4" />
              </span>
              <div>
                <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                  <span>{isTodayMenu ? (locale === 'mr' ? 'आजचा ताजा मेनू' : "Today's Fresh Menu") : (locale === 'mr' ? 'नुकताच मेनू' : 'Latest Menu')}</span>
                  {isTodayMenu && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 border border-emerald-500/20">
                      LIVE
                    </span>
                  )}
                </h2>
                {activeMenu && (
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    <span>{activeMenu.menu_date}</span>
                  </p>
                )}
              </div>
            </div>

            {activeMenu?.photo_url && (
              <button
                onClick={() => setPreviewPhotoUrl(activeMenu.photo_url)}
                className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-background border border-border text-foreground hover:border-primary transition-colors"
              >
                <span>📷</span>
                <span>{locale === 'mr' ? 'मेनू बोर्ड' : 'Board Photo'}</span>
              </button>
            )}
          </div>

          {activeMenu ? (
            <div className="space-y-2.5 pt-1">
              {/* Special chef tag */}
              {activeMenu.special_tag && (
                <div className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{activeMenu.special_tag}</span>
                </div>
              )}

              {/* Lunch dishes */}
              {activeMenu.lunch_text && (
                <div className="p-3 rounded-xl bg-card border border-border/70 space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-1.5 text-xs font-bold text-foreground">
                    <span className="flex items-center gap-1">
                      <span>☀️</span> {locale === 'mr' ? 'दुपारचे जेवण (Lunch)' : 'Lunch Menu'}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-normal">
                      {profile?.lunch_timing || '11:30 AM - 02:30 PM'}
                    </span>
                  </div>
                  <p className="text-xs text-foreground/90 leading-relaxed font-medium">
                    {activeMenu.lunch_text}
                  </p>
                </div>
              )}

              {/* Dinner dishes */}
              {activeMenu.dinner_text && (
                <div className="p-3 rounded-xl bg-card border border-border/70 space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-1.5 text-xs font-bold text-foreground">
                    <span className="flex items-center gap-1">
                      <span>🌙</span> {locale === 'mr' ? 'रात्रीचे जेवण (Dinner)' : 'Dinner Menu'}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-normal">
                      {profile?.dinner_timing || '07:30 PM - 10:30 PM'}
                    </span>
                  </div>
                  <p className="text-xs text-foreground/90 leading-relaxed font-medium">
                    {activeMenu.dinner_text}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-card border border-border text-center space-y-1.5">
              <p className="text-xs text-foreground font-medium">
                {locale === 'mr' ? 'आजचा मेनू अद्याप अपडेट केलेला नाही.' : "Today's menu has not been posted yet."}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {locale === 'mr'
                  ? 'आजची भाजी किंवा खास बेत जाणून घेण्यासाठी थेट कॉल किंवा व्हॉट्सअॅप करा.'
                  : 'Call or WhatsApp the mess to inquire about today’s dishes.'}
              </p>
            </div>
          )}
        </div>

        {/* Pricing & Subscription Packages */}
        <div className="bg-card rounded-2xl border border-border p-4 shadow-xs space-y-3">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5">
            <span>💳</span>
            <span>{locale === 'mr' ? 'दर आणि मासिक पास (Rates & Packages)' : 'Rates & Subscription Passes'}</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {profile?.monthly_rate ? (
              <div className="p-3 rounded-xl border border-primary/25 bg-primary/5 space-y-1">
                <span className="text-[11px] font-semibold text-muted-foreground">
                  {locale === 'mr' ? 'मासिक पास (Monthly Pass)' : 'Monthly Pass'}
                </span>
                <div className="text-lg font-bold text-primary">₹{profile.monthly_rate}</div>
                <p className="text-[10px] text-muted-foreground">
                  {locale === 'mr' ? '२ वेळचे जेवण / ३० दिवस' : 'Lunch & dinner included'}
                </p>
              </div>
            ) : null}

            {profile?.single_thali_rate ? (
              <div className="p-3 rounded-xl border border-border bg-muted/30 space-y-1">
                <span className="text-[11px] font-semibold text-muted-foreground">
                  {locale === 'mr' ? 'एक वेळची थाळी (Single Thali)' : 'Single Walk-in Thali'}
                </span>
                <div className="text-lg font-bold text-foreground">₹{profile.single_thali_rate}</div>
                <p className="text-[10px] text-muted-foreground">
                  {locale === 'mr' ? 'गरम चपाती, भाजी, डाळ, भात' : 'Full unlimited thali'}
                </p>
              </div>
            ) : null}

            <div className="p-3 rounded-xl border border-border bg-muted/30 space-y-1">
              <span className="text-[11px] font-semibold text-muted-foreground">
                {locale === 'mr' ? 'टिफिन / डबा डिलिव्हरी' : 'Tiffin Service'}
              </span>
              <div className="text-sm font-bold text-foreground">
                {profile?.tiffin_delivery
                  ? (locale === 'mr' ? '✅ उपलब्ध (Home Delivery)' : '✅ Available')
                  : (locale === 'mr' ? '❌ केवळ डायनिंग' : 'Dine-in only')}
              </div>
              <p className="text-[10px] text-muted-foreground">
                {profile?.tiffin_delivery
                  ? (locale === 'mr' ? 'घर किंवा ऑफिसवर डबा पोहोच' : 'Delivery to rooms/offices')
                  : (locale === 'mr' ? 'मेसमध्ये बसून जेवण' : 'In-hall seating only')}
              </p>
            </div>

            <div className="p-3 rounded-xl border border-border bg-muted/30 space-y-1">
              <span className="text-[11px] font-semibold text-muted-foreground">
                {locale === 'mr' ? 'रविवार मेजवानी' : 'Sunday Feast'}
              </span>
              <div className="text-sm font-bold text-foreground">
                {isSundayFeast ? (locale === 'mr' ? '✨ स्पेशल बेत' : '✨ Special Feast') : (locale === 'mr' ? 'नियमित मेनू' : 'Regular Menu')}
              </div>
              <p className="text-[10px] text-muted-foreground">
                {isSundayFeast
                  ? (locale === 'mr' ? 'पुरणपोळी किंवा गोड पदार्थ' : 'Sweet or special dishes')
                  : (locale === 'mr' ? 'रोजच्या प्रमाणे जेवण' : 'Standard daily meals')}
              </p>
            </div>
          </div>
        </div>

        {/* Regular Menu Items / Rate Card */}
        {menuItems.length > 0 && (
          <div className="bg-card rounded-2xl border border-border p-4 shadow-xs space-y-3">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5">
              <span>📋</span>
              <span>{locale === 'mr' ? 'नियमित मेनू कार्ड (Regular Menu Card)' : 'Menu Items & Extras'}</span>
            </h2>

            <div className="divide-y divide-border/60">
              {menuItems.map((item) => (
                <div key={item.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                    <span className="font-semibold text-foreground">{item.name}</span>
                  </div>
                  <span className="font-bold text-primary">₹{item.price}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Serving Timings */}
        <div className="bg-card rounded-2xl border border-border p-4 shadow-xs space-y-3">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-primary" />
            <span>{locale === 'mr' ? 'जेवणाची वेळ (Serving Timings)' : 'Serving Timings'}</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="p-3 rounded-xl bg-muted/40 border border-border flex flex-wrap items-center justify-between gap-1.5">
              <span className="text-muted-foreground font-medium">
                ☀️ {locale === 'mr' ? 'दुपारची वेळ (Lunch)' : 'Lunch Window'}
              </span>
              <span className="font-bold text-foreground">
                {profile?.lunch_timing || '11:30 AM - 02:30 PM'}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-muted/40 border border-border flex flex-wrap items-center justify-between gap-1.5">
              <span className="text-muted-foreground font-medium">
                🌙 {locale === 'mr' ? 'रात्रीची वेळ (Dinner)' : 'Dinner Window'}
              </span>
              <span className="font-bold text-foreground">
                {profile?.dinner_timing || '07:30 PM - 10:30 PM'}
              </span>
            </div>
          </div>
        </div>

        {/* Amenities & Facilities */}
        {mess.amenities && mess.amenities.length > 0 && (
          <div className="bg-card rounded-2xl border border-border p-4 shadow-xs space-y-3">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5">
              <span>✨</span>
              <span>{locale === 'mr' ? 'सुविधा व वैशिष्ट्ये' : 'Amenities & Facilities'}</span>
            </h2>

            <div className="flex flex-wrap gap-2 text-xs">
              {mess.amenities.map((amenity: string, idx: number) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-muted/50 border border-border text-foreground font-medium"
                >
                  <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span>{amenity}</span>
                </span>
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
            {mess.address || `${mess.area || ''}, ${cityName}`}
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
        <ReviewsSection shopId={mess.id} shopName={mess.name} />
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

          {mess.whatsapp ? (
            <a
              href={`https://wa.me/91${mess.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(
                locale === 'mr'
                  ? `नमस्ते, मी ${townBrand} वर ${displayName} पाहिले. मला मासिक पास व मेनूबद्दल माहिती हवी आहे.`
                  : `Hello, I found ${displayName} on ${townBrand}. I want to inquire about monthly pass and today's menu.`
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

      {/* Photo Lightbox Dialog */}
      <Dialog open={!!previewPhotoUrl} onOpenChange={() => setPreviewPhotoUrl(null)}>
        <DialogContent className="max-w-md p-2 bg-black/90 border-none rounded-2xl overflow-hidden">
          <DialogTitle className="sr-only">Menu Photo</DialogTitle>
          {previewPhotoUrl && (
            <div className="relative">
              <img
                src={previewPhotoUrl}
                alt="Today's Menu Board"
                className="w-full h-auto max-h-[80vh] object-contain rounded-xl"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      <CityPickerModal open={cityPickerOpen} onOpenChange={setCityPickerOpen} />
    </div>
  );
}
