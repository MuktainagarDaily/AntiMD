import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PageSeo } from '@/components/seo/PageSeo';
import {
  ArrowLeft,
  UtensilsCrossed,
  Phone,
  MessageCircle,
  MapPin,
  Sparkles,
  Plus,
  Search,
  Clock,
  ShieldCheck,
  ImageIcon,
  X,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';
import { useCity } from '@/hooks/useCity';
import { useT } from '@/i18n';
import { fetchMessesForCity, getTodayDateString, getMessServingStatus, isSundaySpecialActive } from '@/lib/living/livingService';
import { type MessWithDetails, getEstablishmentCategory } from '@/lib/living/livingTypes';
import { CityPickerModal } from '@/components/shared/CityPickerModal';
import { Footer } from '@/components/shared/Footer';
import { PhotoSlider } from '@/components/shared/PhotoSlider';
import { DesktopNav } from '@/components/DesktopNav';
import { UserMenuDrawer } from '@/components/UserMenuDrawer';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export default function Mess() {
  const { currentCity, currentVillage, currentCitySlug: citySlugFromCtx, townBrand } = useCity();
  const currentCitySlug = currentCity?.slug || citySlugFromCtx || 'muktainagar';
  const { t, locale } = useT();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'hotel' | 'mess' | 'pure_veg' | 'veg_nonveg' | 'tiffin'>('all');
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);
  const [cityPickerOpen, setCityPickerOpen] = useState(false);

  const todayIso = getTodayDateString();

  const cityName = locale === 'mr' && currentCity.name_mr ? currentCity.name_mr : currentCity.name;
  const villageName = currentVillage ? (locale === 'mr' && currentVillage.name_mr ? currentVillage.name_mr : currentVillage.name) : null;
  const locationLabel = villageName ? `${villageName}, ${cityName}` : cityName;

  const { data: messes = [], isLoading } = useQuery<MessWithDetails[]>({
    queryKey: ['living-messes', currentCity.id, currentVillage?.id],
    queryFn: () => fetchMessesForCity(currentCity.id, currentVillage?.id),
    staleTime: 2 * 60 * 1000,
  });

  const filteredMesses = useMemo(() => {
    return messes.filter((m) => {
      const q = search.trim().toLowerCase();
      const matchSearch =
        !q ||
        m.name.toLowerCase().includes(q) ||
        (m.name_mr && m.name_mr.toLowerCase().includes(q)) ||
        (m.area && m.area.toLowerCase().includes(q)) ||
        (m.today_menu?.lunch_text && m.today_menu.lunch_text.toLowerCase().includes(q)) ||
        (m.today_menu?.dinner_text && m.today_menu.dinner_text.toLowerCase().includes(q));

      if (!matchSearch) return false;

      if (selectedFilter === 'hotel') {
        return getEstablishmentCategory(m) === 'hotel';
      }
      if (selectedFilter === 'mess') {
        return getEstablishmentCategory(m) === 'mess';
      }
      if (selectedFilter === 'pure_veg') {
        return m.mess_profile?.mess_type === 'pure_veg' || m.mess_profile?.mess_type === 'jain_available';
      }
      if (selectedFilter === 'veg_nonveg') {
        return m.mess_profile?.mess_type === 'veg_nonveg';
      }
      if (selectedFilter === 'tiffin') {
        return !!m.mess_profile?.tiffin_delivery || getEstablishmentCategory(m) === 'tiffin';
      }
      return true;
    });
  }, [messes, search, selectedFilter]);

  const hasAnyTodayMenu = useMemo(() => {
    return messes.some((m) => m.today_menu !== null);
  }, [messes]);

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <PageSeo
        title={locale === 'mr' ? `मेस, हॉटेल्स व भोजनालय - ${locationLabel}` : `Mess, Hotels & Dining in ${locationLabel}`}
        description={
          locale === 'mr'
            ? `${locationLabel} मधील मेस, हॉटेल्स, रेस्टॉरंट्स, आजचा मेनू, थाळी आणि टिफिन सेवा.`
            : `Daily food menus, thali rates, hotels, restaurants, and tiffin delivery in ${locationLabel}.`
        }
      />

      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="max-w-2xl md:max-w-4xl lg:max-w-6xl xl:max-w-7xl mx-auto px-4 md:px-6 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => navigate('/')}
              aria-label="Back"
              className="p-2 -ml-2 rounded-full hover:bg-muted active:scale-95 transition-all text-muted-foreground"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="text-base font-bold flex items-center gap-1.5 truncate">
                <UtensilsCrossed className="w-4 h-4 text-primary shrink-0" />
                <span>{locale === 'mr' ? 'मेस, हॉटेल्स व भोजनालय' : 'Mess, Hotels & Dining'}</span>
              </h1>
            </div>
          </div>

          <DesktopNav variant="default" />

          <div className="flex items-center gap-2 shrink-0">
            {/* Location Switcher Pill */}
            <button
              onClick={() => setCityPickerOpen(true)}
              className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 shrink-0 hover:bg-primary/15 transition-colors"
            >
              <MapPin className="w-3 h-3" />
              <span className="truncate max-w-[100px] sm:max-w-[140px]">{locationLabel}</span>
            </button>
            <div className="hidden md:block">
              <UserMenuDrawer />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl md:max-w-4xl lg:max-w-6xl xl:max-w-7xl mx-auto px-4 md:px-6 pt-4 space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              locale === 'mr'
                ? 'मेस, हॉटेल किंवा डिश शोधा (उदा. थाळी, पनीर, शेव भाजी)...'
                : 'Search mess, hotel, or dish (e.g. Thali, Paneer, Sev Bhaji)...'
            }
            className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-input bg-card text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary shadow-xs"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Quick Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto md:flex-wrap no-scrollbar py-1">
          <button
            onClick={() => setSelectedFilter('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
              selectedFilter === 'all'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'bg-card border border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            {locale === 'mr' ? 'सर्व' : 'All'}
          </button>
          <button
            onClick={() => setSelectedFilter('hotel')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1 ${
              selectedFilter === 'hotel'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'bg-card border border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            <span>🏨</span>
            <span>{locale === 'mr' ? 'हॉटेल्स व जेवण' : 'Hotels & Dining'}</span>
          </button>
          <button
            onClick={() => setSelectedFilter('mess')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1 ${
              selectedFilter === 'mess'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'bg-card border border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            <span>🍽️</span>
            <span>{locale === 'mr' ? 'मेस व भोजनालय' : 'Mess & Dining'}</span>
          </button>
          <button
            onClick={() => setSelectedFilter('pure_veg')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1 ${
              selectedFilter === 'pure_veg'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-card border border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            <span>🥦</span>
            <span>{locale === 'mr' ? 'शुद्ध शाकाहारी' : 'Pure Veg'}</span>
          </button>
          <button
            onClick={() => setSelectedFilter('veg_nonveg')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1 ${
              selectedFilter === 'veg_nonveg'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-card border border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            <span>🍗</span>
            <span>{locale === 'mr' ? 'व्हेज व नॉनव्हेज' : 'Veg & Non-Veg'}</span>
          </button>
          <button
            onClick={() => setSelectedFilter('tiffin')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1 ${
              selectedFilter === 'tiffin'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'bg-card border border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            <span>🍱</span>
            <span>{locale === 'mr' ? 'टिफिन सुविधा' : 'Tiffin Delivery'}</span>
          </button>
        </div>

        {/* Today's Menu Live Ribbon banner */}
        {hasAnyTodayMenu && (
          <div className="p-3 rounded-xl bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/20 flex items-center gap-2.5">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
              {locale === 'mr'
                ? 'आजचा ताजा मेनू अपडेट केला गेला आहे! खालील मेस तपासा.'
                : "Today's fresh menu is live! Check the dishes below."}
            </p>
          </div>
        )}

        {/* Mess Cards Listing */}
        {isLoading ? (
          <div className="space-y-3 py-8 text-center text-muted-foreground">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs">{locale === 'mr' ? 'मेस माहिती लोड होत आहे...' : 'Loading mess details...'}</p>
          </div>
        ) : filteredMesses.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
            {filteredMesses.map((mess) => (
              <MessCardItem
                key={mess.id}
                mess={mess}
                locale={locale}
                currentCitySlug={currentCitySlug}
                townBrand={townBrand}
                onPreviewPhoto={(url) => setPreviewPhotoUrl(url)}
                onNavigate={(path) => navigate(path)}
              />
            ))}
          </div>
        ) : (
          /* Empty State / Merchant Funnel */
          <div className="p-6 rounded-2xl border border-dashed border-border bg-card text-center space-y-3 mt-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
              <UtensilsCrossed className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-foreground">
              {locale === 'mr' ? `${locationLabel} मध्ये मेस किंवा हॉटेल उपलब्ध नाही` : `No Messes or Hotels Listed in ${locationLabel} Yet`}
            </h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              {locale === 'mr'
                ? 'तुम्ही मेस, हॉटेल किंवा टिफिन सेवा चालवता का? आजच आपली नोंदणी मोफत करा आणि ग्राहकांना दररोजचा मेनू दाखवा!'
                : 'Do you run a mess, hotel, or tiffin service? List it for free to reach hundreds of local customers daily!'}
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('open-list-shop-modal'))}
                className="inline-flex items-center justify-center gap-1.5 bg-primary text-primary-foreground px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-xs hover:bg-primary/90 active:scale-95 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>{locale === 'mr' ? '+ मेस किंवा हॉटेल मोफत नोंदवा' : '+ List Your Mess / Hotel'}</span>
              </button>
            </div>
          </div>
        )}
      </main>

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
              <button
                onClick={() => setPreviewPhotoUrl(null)}
                className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* City Picker Modal */}
      <CityPickerModal open={cityPickerOpen} onOpenChange={setCityPickerOpen} />
    </div>
  );
}

interface MessCardItemProps {
  mess: MessWithDetails;
  locale: string;
  currentCitySlug: string;
  townBrand: string;
  onPreviewPhoto: (url: string) => void;
  onNavigate: (path: string) => void;
}

function MessCardItem({
  mess,
  locale,
  currentCitySlug,
  townBrand,
  onPreviewPhoto,
  onNavigate,
}: MessCardItemProps) {
  const displayName = locale === 'mr' && mess.name_mr ? mess.name_mr : mess.name;
  const hasTodayMenu = !!mess.today_menu;
  const activeMenu = mess.today_menu || mess.latest_menu;
  const isYesterday = !hasTodayMenu && !!mess.latest_menu;
  const profile = mess.mess_profile;
  const phone = mess.phone || mess.whatsapp;
  const menuItems = mess.menu_items || [];
  const servingInfo = getMessServingStatus(mess, locale);
  const isSundayFeastToday = isSundaySpecialActive(profile);
  const estType = getEstablishmentCategory(mess);

  // If no today/yesterday menu but menu card items exist, default view to menu_card
  const [viewMode, setViewMode] = useState<'today' | 'menu_card'>(() => {
    if (!activeMenu && menuItems.length > 0) return 'menu_card';
    return 'today';
  });

  const messPhotos = Array.isArray(mess.photos) && mess.photos.length > 0
    ? mess.photos
    : (mess.image_url ? [mess.image_url] : []);
  const hasPhotos = messPhotos.length > 0;

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-xs hover:shadow-md transition-shadow">
      {/* Cover / Multi-Photo Carousel */}
      {hasPhotos && (
        <PhotoSlider
          photos={messPhotos}
          imageUrl={mess.image_url}
          alt={displayName}
          heightClass="h-44 sm:h-52 w-full"
          showArrows
          showDots
          showCounter
          enableLightbox
          overlayTopLeft={
            <span className={cn(
              'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border backdrop-blur-md shadow-xs',
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
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-xs border border-white/20 text-white">
                {estType === 'hotel' ? '🏨 Hotel' : estType === 'tiffin' ? '🍱 Tiffin' : '🍽️ Mess'}
              </span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-xs border border-white/20 text-white">
                {profile?.mess_type === 'pure_veg'
                  ? '🥦 Pure Veg'
                  : profile?.mess_type === 'jain_available'
                  ? '🥬 Jain Available'
                  : '🍗 Veg & Non-Veg'}
              </span>
            </div>
          }
          overlayBottomRight={
            profile?.monthly_rate ? (
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-primary text-primary-foreground shadow-xs">
                ₹{profile.monthly_rate}/mo
              </span>
            ) : undefined
          }
        />
      )}

      {/* Sunday Special Feast Alert Banner */}
      {isSundayFeastToday && (
        <div className="p-2.5 bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-transparent border-b border-amber-500/30 flex items-center gap-2">
          <span className="text-sm">✨</span>
          <div className="min-w-0">
            <p className="text-xs font-bold text-amber-800 dark:text-amber-300">
              {locale === 'mr' ? 'आज रविवार स्पेशल मेजवानी उपलब्ध आहे!' : 'Sunday Special Feast Serving Today!'}
            </p>
            <p className="text-[10px] text-amber-700/80 dark:text-amber-400">
              {locale === 'mr' ? 'पुरणपोळी, गोड पदार्थ व विशेष बेत — त्वरित भेट द्या किंवा डबा बुक करा!' : 'Special feast menu available — visit or call now!'}
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="p-4 border-b border-border/50">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h2
                onClick={() => onNavigate(`/${currentCitySlug}/mess/${mess.slug || mess.id}`)}
                className="text-base font-bold text-foreground leading-tight hover:text-primary cursor-pointer transition-colors"
              >
                {displayName}
              </h2>
              {mess.is_verified && (
                <span className="inline-flex items-center text-xs font-medium text-primary">
                  <ShieldCheck className="w-3.5 h-3.5 fill-primary/20" />
                </span>
              )}
            </div>
            {mess.area && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <MapPin className="w-3 h-3 text-muted-foreground/70" />
                <span>{mess.area}</span>
              </p>
            )}

            {/* Live Serving Status Pill when no photo is uploaded */}
            {!hasPhotos && (
              <div className="mt-1.5">
                <span className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border',
                  servingInfo.colorCls
                )}>
                  {servingInfo.isLive && (
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                    </span>
                  )}
                  <span>{servingInfo.label}</span>
                </span>
              </div>
            )}
          </div>

          {!hasPhotos && (
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-muted/60 border-border">
                {estType === 'hotel' ? '🏨 Hotel' : estType === 'tiffin' ? '🍱 Tiffin' : '🍽️ Mess'}
              </span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-muted/50 border-border">
                {profile?.mess_type === 'pure_veg'
                  ? '🥦 Pure Veg'
                  : profile?.mess_type === 'jain_available'
                  ? '🥬 Jain Available'
                  : '🍗 Veg & Non-Veg'}
              </span>
            </div>
          )}
        </div>

        {/* Rates & Tiffin Tags */}
        <div className="flex items-center gap-2 mt-2.5 flex-wrap text-xs">
          {profile?.monthly_rate && !hasPhotos && (
            <span className="font-bold text-foreground bg-muted/60 px-2 py-0.5 rounded-md">
              ₹{profile.monthly_rate}
              <span className="text-[10px] font-normal text-muted-foreground">/mo</span>
            </span>
          )}
          {profile?.single_thali_rate && (
            <span className="font-medium text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-md">
              ₹{profile.single_thali_rate}
              <span className="text-[10px] text-muted-foreground">/{estType === 'hotel' ? 'meal' : 'thali'}</span>
            </span>
          )}
          {profile?.tiffin_delivery && (
            <span className="text-[10px] font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded-md">
              🍱 {locale === 'mr' ? 'डबा / टिफिन उपलब्ध' : 'Tiffin Delivery'}
            </span>
          )}
          {profile?.sunday_feast && (
            <span className="text-[10px] font-medium text-amber-700 dark:text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-md">
              ✨ {locale === 'mr' ? 'रविवार स्पेशल मेजवानी' : 'Sunday Feast'}
            </span>
          )}
        </div>

        {/* Amenities */}
        {mess.amenities && mess.amenities.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2.5 pt-2 border-t border-border/40">
            {mess.amenities.map((a) => (
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

      {/* Segmented Switch for Today's Menu vs Full Menu Card if items exist */}
      <div className="p-4 bg-muted/20 space-y-3">
        {menuItems.length > 0 && (
          <div className="flex items-center gap-1 p-1 rounded-xl bg-card border border-border shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode('today')}
              className={cn(
                'flex-1 py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5',
                viewMode === 'today'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <span>🍲</span>
              <span>{locale === 'mr' ? 'आजचा मेनू' : "Today's Menu"}</span>
              {hasTodayMenu && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
            </button>

            <button
              type="button"
              onClick={() => setViewMode('menu_card')}
              className={cn(
                'flex-1 py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5',
                viewMode === 'menu_card'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <span>📋</span>
              <span>{locale === 'mr' ? 'मेनू कार्ड व दर' : 'Menu Card & Rates'}</span>
              <span className={cn(
                'text-[10px] px-1.5 py-0.2 rounded-full font-bold',
                viewMode === 'menu_card' ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-primary/10 text-primary'
              )}>
                {menuItems.length}
              </span>
            </button>
          </div>
        )}

        {/* View Mode: Menu Card */}
        {viewMode === 'menu_card' && menuItems.length > 0 ? (
          <div className="p-3.5 rounded-xl border border-border bg-card space-y-2.5 shadow-2xs">
            <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground border-b border-border/60 pb-1.5">
              <span>{locale === 'mr' ? 'थाळी / पदार्थ' : 'Regular Dish / Thali'}</span>
              <span>{locale === 'mr' ? 'दर' : 'Price'}</span>
            </div>
            <div className="space-y-2 divide-y divide-border/40">
              {menuItems.map((item) => (
                <div key={item.id} className="pt-2 first:pt-0 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 min-w-0 pr-2">
                    <span className={item.is_available ? 'text-foreground font-semibold truncate' : 'text-muted-foreground line-through truncate'}>
                      {item.name}
                    </span>
                    {!item.is_available && (
                      <span className="text-[10px] text-destructive bg-destructive/10 px-1 py-0.2 rounded font-semibold shrink-0">
                        {locale === 'mr' ? 'संपले' : 'Out'}
                      </span>
                    )}
                  </div>
                  <span className="font-bold text-foreground bg-muted/60 px-2 py-0.5 rounded-md shrink-0">
                    ₹{item.price}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* View Mode: Today's Menu */
          <>
            {activeMenu ? (
              <div
                className={cn(
                  'p-3 rounded-xl border transition-all',
                  hasTodayMenu
                    ? 'bg-emerald-500/5 border-emerald-500/30'
                    : 'bg-amber-500/5 border-amber-500/30'
                )}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 text-xs font-bold px-2 py-0.5 rounded-md',
                      hasTodayMenu ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'
                    )}
                  >
                    <span>{hasTodayMenu ? '🟢' : '🟠'}</span>
                    <span>
                      {hasTodayMenu
                        ? locale === 'mr'
                          ? 'आजचा मेनू (Today)'
                          : "Today's Menu"
                        : locale === 'mr'
                        ? 'कालचा मेनू (Yesterday)'
                        : "Yesterday's Menu"}
                    </span>
                  </span>

                  {activeMenu.special_tag && (
                    <span className="text-[10px] font-semibold text-primary truncate max-w-[140px]">
                      {activeMenu.special_tag}
                    </span>
                  )}
                </div>

                {/* Lunch & Dinner Text */}
                <div className="space-y-1.5 text-xs">
                  {activeMenu.lunch_text && (
                    <div className="flex items-start gap-1.5">
                      <span className="font-semibold text-muted-foreground shrink-0">
                        🍲 {locale === 'mr' ? 'दुपारी:' : 'Lunch:'}
                      </span>
                      <span className="text-foreground font-medium">{activeMenu.lunch_text}</span>
                    </div>
                  )}
                  {activeMenu.dinner_text && (
                    <div className="flex items-start gap-1.5">
                      <span className="font-semibold text-muted-foreground shrink-0">
                        🌙 {locale === 'mr' ? 'रात्री:' : 'Dinner:'}
                      </span>
                      <span className="text-foreground font-medium">{activeMenu.dinner_text}</span>
                    </div>
                  )}
                </div>

                {/* Photo Preview if attached */}
                {activeMenu.photo_url && (
                  <div className="mt-2.5 pt-2 border-t border-border/50">
                    <button
                      type="button"
                      onClick={() => onPreviewPhoto(activeMenu.photo_url!)}
                      className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-semibold"
                    >
                      <ImageIcon className="w-3.5 h-3.5" />
                      <span>{locale === 'mr' ? 'आजचा मेनू बोर्ड / थाळी फोटो पहा' : 'View Menu Photo / Thali'}</span>
                    </button>
                  </div>
                )}

                {isYesterday && (
                  <p className="text-[10px] text-muted-foreground mt-2 italic">
                    {locale === 'mr'
                      ? '* आजचा स्पेशल मेनू विचारण्यासाठी कृपया कॉल करा.'
                      : '* Please call to confirm today’s menu specials.'}
                  </p>
                )}
              </div>
            ) : (
              <div className="p-3 rounded-xl border border-dashed border-border bg-card text-center">
                <p className="text-xs text-muted-foreground">
                  {locale === 'mr'
                    ? 'आजचा मेनू अजून अपलोड केलेला नाही. मेनू विचारण्यासाठी खाली कॉल करा.'
                    : 'Menu not posted today yet. Tap Call below to ask today’s dishes.'}
                </p>
              </div>
            )}
          </>
        )}

        {/* Timings */}
        {(profile?.lunch_timing || profile?.dinner_timing) && (
          <div className="flex items-center gap-3 mt-2.5 text-[11px] text-muted-foreground">
            <Clock className="w-3.5 h-3.5 shrink-0 opacity-70" />
            <div className="flex items-center gap-2 flex-wrap">
              {profile.lunch_timing && <span>Lunch: {profile.lunch_timing}</span>}
              {profile.dinner_timing && <span>· Dinner: {profile.dinner_timing}</span>}
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="p-3 bg-card border-t border-border flex items-center gap-2">
        {phone && (
          <a
            href={`tel:${phone}`}
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 transition-all shadow-xs"
          >
            <Phone className="w-3.5 h-3.5" />
            <span>{locale === 'mr' ? 'कॉल करा' : 'Call Mess'}</span>
          </a>
        )}
        {mess.whatsapp && (
          <a
            href={`https://wa.me/91${mess.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(
              locale === 'mr'
                ? `नमस्ते, मी ${townBrand} वर ${displayName} चा मेनू पाहिला. मला जेवणाबद्दल विचारायचे आहे.`
                : `Hello, I saw ${displayName} on ${townBrand}. I want to inquire about daily meals/tiffin.`
            )}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95 transition-all shadow-xs"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span>WhatsApp</span>
          </a>
        )}
        <button
          onClick={() => onNavigate(`/${currentCitySlug}/mess/${mess.slug || mess.id}`)}
          className="inline-flex items-center gap-1 py-2 px-2.5 sm:px-3 rounded-xl border border-border hover:bg-muted text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors shrink-0"
          title="View Details"
          aria-label="View Details"
        >
          <span>{locale === 'mr' ? 'तपशील' : 'Details'}</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
