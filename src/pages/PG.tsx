import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PageSeo } from '@/components/seo/PageSeo';
import {
  ArrowLeft,
  BedDouble,
  Phone,
  MessageCircle,
  MapPin,
  Search,
  Plus,
  ShieldCheck,
  Check,
  Clock,
  Sparkles,
  ChevronRight,
  X,
  Users,
  Wifi,
  Droplets,
  Flame,
  Zap,
  Shield,
  Utensils,
  BookOpen,
} from 'lucide-react';
import { useCity } from '@/hooks/useCity';
import { useT } from '@/i18n';
import { fetchPGsForCity } from '@/lib/living/livingService';
import type { PGWithDetails, PGGender } from '@/lib/living/livingTypes';
import { CityPickerModal } from '@/components/shared/CityPickerModal';
import { BannerSlot } from '@/components/banners/BannerSlot';
import { PhotoSlider } from '@/components/shared/PhotoSlider';
import { DesktopNav } from '@/components/DesktopNav';
import { UserMenuDrawer } from '@/components/UserMenuDrawer';
import { Footer } from '@/components/shared/Footer';
import { handleTelLinkClick } from '@/lib/engagement';
import { DemoBadge, isParandwadiDemoListing } from '@/components/shared/DemoBadge';

export default function PG() {
  const { currentCity, currentVillage, currentCitySlug: citySlugFromCtx, townBrand } = useCity();
  const currentCitySlug = currentCity?.slug || citySlugFromCtx || 'muktainagar';
  const { t, locale } = useT();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [genderFilter, setGenderFilter] = useState<'all' | PGGender>('all');
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [cityPickerOpen, setCityPickerOpen] = useState(false);

  const cityName = locale === 'mr' && currentCity.name_mr ? currentCity.name_mr : currentCity.name;
  const villageName = currentVillage ? (locale === 'mr' && currentVillage.name_mr ? currentVillage.name_mr : currentVillage.name) : null;
  const locationLabel = villageName ? `${villageName}, ${cityName}` : cityName;

  const { data: pgs = [], isLoading } = useQuery<PGWithDetails[]>({
    queryKey: ['living-pgs', currentCity.id, currentVillage?.id],
    queryFn: () => fetchPGsForCity(currentCity.id, currentVillage?.id),
    staleTime: 2 * 60 * 1000,
  });

  const filteredPGs = useMemo(() => {
    return pgs.filter((pg) => {
      const q = search.trim().toLowerCase();
      const matchSearch =
        !q ||
        pg.name.toLowerCase().includes(q) ||
        (pg.name_mr && pg.name_mr.toLowerCase().includes(q)) ||
        (pg.area && pg.area.toLowerCase().includes(q));

      if (!matchSearch) return false;

      if (genderFilter !== 'all') {
        if (pg.pg_profile && pg.pg_profile.gender !== genderFilter && pg.pg_profile.gender !== 'both') {
          return false;
        }
      }

      if (onlyAvailable) {
        if (!pg.pg_profile || (pg.pg_profile.available_beds || 0) <= 0) {
          return false;
        }
      }

      return true;
    });
  }, [pgs, search, genderFilter, onlyAvailable]);

  // Amenity icon mapper
  const renderAmenity = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('wifi')) return <span key={name} className="inline-flex items-center gap-1 text-[11px] bg-muted/70 px-2 py-0.5 rounded-md"><Wifi className="w-3 h-3 text-primary" /> WiFi</span>;
    if (n.includes('hot') || n.includes('geyser')) return <span key={name} className="inline-flex items-center gap-1 text-[11px] bg-muted/70 px-2 py-0.5 rounded-md"><Flame className="w-3 h-3 text-amber-500" /> Geyser</span>;
    if (n.includes('ro') || n.includes('water')) return <span key={name} className="inline-flex items-center gap-1 text-[11px] bg-muted/70 px-2 py-0.5 rounded-md"><Droplets className="w-3 h-3 text-blue-500" /> RO Water</span>;
    if (n.includes('mess') || n.includes('food')) return <span key={name} className="inline-flex items-center gap-1 text-[11px] bg-muted/70 px-2 py-0.5 rounded-md"><Utensils className="w-3 h-3 text-emerald-500" /> Food</span>;
    if (n.includes('inverter') || n.includes('backup') || n.includes('power')) return <span key={name} className="inline-flex items-center gap-1 text-[11px] bg-muted/70 px-2 py-0.5 rounded-md"><Zap className="w-3 h-3 text-yellow-500" /> Inverter</span>;
    if (n.includes('cctv') || n.includes('security')) return <span key={name} className="inline-flex items-center gap-1 text-[11px] bg-muted/70 px-2 py-0.5 rounded-md"><Shield className="w-3 h-3 text-rose-500" /> CCTV</span>;
    if (n.includes('study') || n.includes('desk') || n.includes('table')) return <span key={name} className="inline-flex items-center gap-1 text-[11px] bg-muted/70 px-2 py-0.5 rounded-md"><BookOpen className="w-3 h-3 text-purple-500" /> Study Desk</span>;
    if (n.includes('parking')) return <span key={name} className="inline-flex items-center gap-1 text-[11px] bg-muted/70 px-2 py-0.5 rounded-md">🅿️ Parking</span>;
    if (n.includes('washroom') || n.includes('bath')) return <span key={name} className="inline-flex items-center gap-1 text-[11px] bg-muted/70 px-2 py-0.5 rounded-md">🚿 Attached Washroom</span>;
    if (n.includes('housekeeping') || n.includes('cleaning')) return <span key={name} className="inline-flex items-center gap-1 text-[11px] bg-muted/70 px-2 py-0.5 rounded-md">🧹 Housekeeping</span>;
    if (n.includes('laundry') || n.includes('washing')) return <span key={name} className="inline-flex items-center gap-1 text-[11px] bg-muted/70 px-2 py-0.5 rounded-md">🧺 Laundry</span>;
    if (n.includes('cupboard') || n.includes('almirah')) return <span key={name} className="inline-flex items-center gap-1 text-[11px] bg-muted/70 px-2 py-0.5 rounded-md">🚪 Almirah</span>;
    return <span key={name} className="inline-flex items-center gap-1 text-[11px] bg-muted/70 px-2 py-0.5 rounded-md"><Check className="w-3 h-3 text-primary" /> {name}</span>;
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <PageSeo
        title={locale === 'mr' ? `पीजी आणि हॉस्टेल - ${locationLabel}` : `PG & Hostels in ${locationLabel}`}
        description={
          locale === 'mr'
            ? `${locationLabel} मधील मुला-मुलींचे पीजी, वसतिगृह, उपलब्ध खोल्या आणि भाडे.`
            : `Boys and girls PG, hostels, vacant bed availability, and room rent in ${locationLabel}.`
        }
      />

      {/* Header */}
      <header className="sticky top-0 z-40 bg-primary text-primary-foreground shadow-md">
        <div className="max-w-2xl md:max-w-4xl lg:max-w-6xl xl:max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-3 flex items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
            <button
              onClick={() => navigate(`/${currentCitySlug}`)}
              aria-label="Back"
              className="inline-flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-primary-foreground/10 hover:bg-primary-foreground/20 active:scale-95 transition-all shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <BedDouble className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
              <div className="min-w-0">
                <h1 className="text-sm sm:text-lg font-bold leading-tight truncate">
                  {locale === 'mr' ? 'पीजी व वसतिगृह' : 'PG & Hostels'}
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
              className="inline-flex items-center gap-1 text-xs font-semibold px-2 sm:px-2.5 py-1 rounded-full bg-primary-foreground/15 text-primary-foreground border border-primary-foreground/25 shrink-0 hover:bg-primary-foreground/25 transition-colors"
              title={locale === 'mr' ? 'स्थान बदला' : 'Change Location'}
            >
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate max-w-[78px] sm:max-w-[130px]">{locationLabel}</span>
            </button>
            <UserMenuDrawer />
          </div>
        </div>
      </header>

      <main className="max-w-2xl md:max-w-4xl lg:max-w-6xl xl:max-w-7xl mx-auto px-4 md:px-6 pt-4 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              locale === 'mr'
                ? 'हॉस्टेल किंवा परिसर शोधा (उदा. स्टेशन रोड, कॉलेज परिसर)...'
                : 'Search hostel or locality (e.g. College Area)...'
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

        {/* Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto md:flex-wrap no-scrollbar py-1">
          <button
            onClick={() => setGenderFilter('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
              genderFilter === 'all'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'bg-card border border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            {locale === 'mr' ? 'सर्व (All)' : 'All PGs'}
          </button>
          <button
            onClick={() => setGenderFilter('boys')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1 ${
              genderFilter === 'boys'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-card border border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            <span>👦</span>
            <span>{locale === 'mr' ? 'मुलांचे हॉस्टेल' : 'Boys Only'}</span>
          </button>
          <button
            onClick={() => setGenderFilter('girls')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1 ${
              genderFilter === 'girls'
                ? 'bg-pink-600 text-white shadow-xs'
                : 'bg-card border border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            <span>👧</span>
            <span>{locale === 'mr' ? 'मुलींचे हॉस्टेल' : 'Girls Only'}</span>
          </button>
          <button
            onClick={() => setOnlyAvailable(!onlyAvailable)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              onlyAvailable
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-card border border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${onlyAvailable ? 'bg-white' : 'bg-emerald-500'}`} />
            <span>{locale === 'mr' ? 'फक्त रिक्त जागा असलेले' : 'Vacancies Available'}</span>
          </button>
        </div>

        {/* Listings */}
        {isLoading ? (
          <div className="space-y-3 py-8 text-center text-muted-foreground">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs">{locale === 'mr' ? 'पीजी माहिती लोड होत आहे...' : 'Loading PG details...'}</p>
          </div>
        ) : filteredPGs.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
            {filteredPGs.map((pg) => {
              const displayName = locale === 'mr' && pg.name_mr ? pg.name_mr : pg.name;
              const profile = pg.pg_profile;
              const availableBeds = profile?.available_beds ?? 0;
              const hasVacancy = availableBeds > 0;
              const phone = pg.phone || pg.whatsapp;

              const sharing = profile?.sharing_rates || {};
              const lowestRent = Math.min(
                ...[sharing['1_sharing'], sharing['2_sharing'], sharing['3_sharing'], sharing['4_sharing']].filter(
                  (v): v is number => typeof v === 'number' && v > 0
                )
              );

              const pgPhotos = Array.isArray(pg.photos) && pg.photos.length > 0
                ? pg.photos
                : (pg.image_url ? [pg.image_url] : []);

              return (
                <div
                  key={pg.id}
                  className="bg-card rounded-2xl border border-border overflow-hidden shadow-xs hover:shadow-md transition-shadow"
                >
                  {/* Photo Banner / Multi-Photo Carousel */}
                  {pgPhotos.length > 0 && (
                    <PhotoSlider
                      photos={pgPhotos}
                      imageUrl={pg.image_url}
                      alt={displayName}
                      heightClass="h-44 sm:h-52 w-full"
                      showArrows
                      showDots
                      showCounter
                      enableLightbox
                      overlayBottomLeft={
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-xs border border-white/20 text-white">
                          {profile?.gender === 'girls'
                            ? '👧 Girls PG'
                            : profile?.gender === 'boys'
                            ? '👦 Boys PG'
                            : '👫 Co-ed / Separate'}
                        </span>
                      }
                      overlayBottomRight={
                        lowestRent && lowestRent !== Infinity ? (
                          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-primary text-primary-foreground shadow-xs">
                            From ₹{lowestRent}/mo
                          </span>
                        ) : undefined
                      }
                    />
                  )}

                  {/* Card Header & Vacancy Ribbon */}
                  <div className="p-4 border-b border-border/50">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h2
                            onClick={() => navigate(`/${currentCitySlug}/pg/${pg.slug || pg.id}`)}
                            className="text-base font-bold text-foreground leading-tight hover:text-primary cursor-pointer transition-colors"
                          >
                            {displayName}
                          </h2>
                          {pg.is_verified && (
                            <span className="inline-flex items-center text-xs font-medium text-primary">
                              <ShieldCheck className="w-3.5 h-3.5 fill-primary/20" />
                            </span>
                          )}
                          {isParandwadiDemoListing(pg, currentVillage) && <DemoBadge size="sm" />}
                        </div>
                        {pg.area && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3 text-muted-foreground/70" />
                            <span>{pg.area}</span>
                          </p>
                        )}
                      </div>

                      {/* Vacancy Badge */}
                      <span
                        className={`text-xs font-bold px-2.5 py-1 rounded-full shrink-0 flex items-center gap-1 shadow-xs ${
                          hasVacancy
                            ? 'bg-emerald-500 text-white'
                            : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${hasVacancy ? 'bg-white' : 'bg-rose-500'}`} />
                        <span>
                          {hasVacancy
                            ? locale === 'mr'
                              ? `${availableBeds} जागा उपलब्ध`
                              : `${availableBeds} Beds Vacant`
                            : locale === 'mr'
                            ? 'पूर्ण (Full)'
                            : 'Fully Occupied'}
                        </span>
                      </span>
                    </div>

                    {/* Gender and Rent Highlights */}
                    <div className="flex items-center gap-2 mt-2.5 flex-wrap text-xs">
                      <span
                        className={`font-semibold px-2 py-0.5 rounded-md ${
                          profile?.gender === 'girls'
                            ? 'bg-pink-500/10 text-pink-600 dark:text-pink-400'
                            : profile?.gender === 'boys'
                            ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                            : 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                        }`}
                      >
                        {profile?.gender === 'girls'
                          ? '👧 Girls PG'
                          : profile?.gender === 'boys'
                          ? '👦 Boys PG'
                          : '👫 Co-ed / Separate'}
                      </span>

                      {lowestRent && lowestRent !== Infinity ? (
                        <span className="font-bold text-foreground bg-muted/60 px-2 py-0.5 rounded-md">
                          From ₹{lowestRent}
                          <span className="text-[10px] font-normal text-muted-foreground">/bed/mo</span>
                        </span>
                      ) : null}

                      {profile?.food_included && (
                        <span className="text-[10px] font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                          🍲 {locale === 'mr' ? 'जेवण समाविष्ट' : 'Food Included'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Sharing Rates & Details */}
                  <div className="p-4 bg-muted/15 space-y-3">
                    {/* Sharing rates grid */}
                    <div className="flex flex-wrap gap-2 text-center text-xs">
                      {sharing['1_sharing'] && (
                        <div className="flex-1 min-w-[78px] p-2 rounded-xl bg-card border border-border">
                          <p className="text-[10px] text-muted-foreground">1-Sharing</p>
                          <p className="font-bold text-foreground mt-0.5">₹{sharing['1_sharing']}</p>
                        </div>
                      )}
                      {sharing['2_sharing'] && (
                        <div className="flex-1 min-w-[78px] p-2 rounded-xl bg-card border border-border">
                          <p className="text-[10px] text-muted-foreground">2-Sharing</p>
                          <p className="font-bold text-foreground mt-0.5">₹{sharing['2_sharing']}</p>
                        </div>
                      )}
                      {sharing['3_sharing'] && (
                        <div className="flex-1 min-w-[78px] p-2 rounded-xl bg-card border border-border">
                          <p className="text-[10px] text-muted-foreground">3-Sharing</p>
                          <p className="font-bold text-foreground mt-0.5">₹{sharing['3_sharing']}</p>
                        </div>
                      )}
                      {sharing['4_sharing'] && (
                        <div className="flex-1 min-w-[78px] p-2 rounded-xl bg-card border border-border">
                          <p className="text-[10px] text-muted-foreground">4-Sharing</p>
                          <p className="font-bold text-foreground mt-0.5">₹{sharing['4_sharing']}</p>
                        </div>
                      )}
                    </div>

                    {/* Amenities list */}
                    {profile?.amenities && profile.amenities.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                          {locale === 'mr' ? 'सुविधा (Facilities)' : 'Amenities & Facilities'}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {profile.amenities.map((a) => renderAmenity(a))}
                        </div>
                      </div>
                    )}

                    {/* Rules & Timings */}
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/50 flex-wrap gap-2">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 opacity-70" />
                        <span>Gate Closes: {profile?.gate_closing_time || '10:00 PM'}</span>
                      </div>
                      {profile?.deposit_amount ? (
                        <span>Deposit: ₹{profile.deposit_amount}</span>
                      ) : null}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="p-3 bg-card border-t border-border flex flex-wrap sm:flex-nowrap items-center gap-2">
                    {phone && (
                      <a
                        href={`tel:${phone}`}
                        onClick={(e) => handleTelLinkClick(e, phone, displayName)}
                        className="flex-1 min-w-0 inline-flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 transition-all shadow-xs"
                      >
                        <Phone className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{locale === 'mr' ? 'कॉल करा' : 'Call Owner'}</span>
                      </a>
                    )}
                    {pg.whatsapp && (
                      <a
                        href={`https://wa.me/91${pg.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(
                          locale === 'mr'
                            ? `नमस्ते, मी ${townBrand} वर ${displayName} बद्दल माहिती पाहिली. मला खोली व उपलब्ध जागेबद्दल विचारायचे आहे.`
                            : `Hello, I saw ${displayName} on ${townBrand}. I want to inquire about room and bed availability.`
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
                      onClick={() => navigate(`/${currentCitySlug}/pg/${pg.slug || pg.id}`)}
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
            })}
          </div>
        ) : (
          /* Empty State / Merchant Funnel */
          <div className="p-6 rounded-2xl border border-dashed border-border bg-card text-center space-y-3 mt-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
              <BedDouble className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-foreground">
              {locale === 'mr' ? `${locationLabel} मध्ये पीजी उपलब्ध नाही` : `No PGs Listed in ${locationLabel} Yet`}
            </h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              {locale === 'mr'
                ? 'तुम्ही वसतिगृह, पीजी किंवा भाड्याने खोल्या देता का? आजच आपली जागा मोफत नोंदवा आणि विद्यार्थ्यांना रिक्त जागा दाखवा!'
                : 'Do you manage a PG, hostel, or rental rooms? List your property for free to connect with students looking for accommodation!'}
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('open-list-shop-modal', { detail: { entityType: 'pg' } }))}
                className="inline-flex items-center justify-center gap-1.5 bg-primary text-primary-foreground px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-xs hover:bg-primary/90 active:scale-95 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>{locale === 'mr' ? '+ आपले पीजी मोफत नोंदवा' : '+ List Your PG Free'}</span>
              </button>
            </div>
          </div>
        )}

        {filteredPGs.length > 0 && (
          <div className="p-4 rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-card to-secondary/10 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-center sm:text-left">
              <p className="text-xs sm:text-sm font-bold text-foreground">
                {locale === 'mr' ? 'वसतिगृह, पीजी किंवा भाड्याच्या खोल्या आहेत का?' : 'Own a PG, hostel, or student rooms?'}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {locale === 'mr' ? 'मोफत नोंदणी करा आणि रिक्त बेड्सची संख्या दाखवा.' : 'List your property for free and keep vacant bed counts updated.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('open-list-shop-modal', { detail: { entityType: 'pg' } }))}
              className="shrink-0 inline-flex items-center justify-center gap-1.5 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-xs font-bold shadow-xs hover:bg-primary/90 active:scale-95 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{locale === 'mr' ? 'पीजी / हॉस्टेल नोंदवा' : 'List Your PG'}</span>
            </button>
          </div>
        )}

        <BannerSlot placement="shops_inline" fallback="homepage_inline" className="mt-6" />
      </main>

      <Footer />

      {/* City Picker Modal */}
      <CityPickerModal open={cityPickerOpen} onOpenChange={setCityPickerOpen} />
    </div>
  );
}
