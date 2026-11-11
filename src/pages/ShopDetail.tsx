import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { PageSeo } from '@/components/seo/PageSeo';

import { useSmartBack } from '@/hooks/useSmartBack';
import { useEdgeSwipeBack } from '@/hooks/useEdgeSwipeBack';
import { useQuery } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Phone, MessageCircle, ArrowLeft, MapPin, Clock, Tag, Share2, ShieldCheck, Navigation, Sparkles, BadgePlus, ChevronRight } from 'lucide-react';
import { UserMenuDrawer } from '@/components/UserMenuDrawer';
import { DesktopNav } from '@/components/DesktopNav';
import { BookmarkButton } from '@/components/BookmarkButton';
import { ClaimShopModal } from '@/components/ClaimShopModal';
import { ClaimedBadge } from '@/components/shared/ClaimedBadge';
import { CategoryIcon } from '@/components/shared/CategoryIcon';
import { ShopImage } from '@/components/shared/ShopImage';
import { PhotoSlider } from '@/components/shared/PhotoSlider';
import { ShopCard } from '@/components/ShopCard';
import { ImageLightbox } from '@/components/shared/ImageLightbox';
import { useAuth } from '@/hooks/useAuth';
import { formatTime, isShopOpen } from '@/lib/shopUtils';
import { toast } from 'sonner';
import { useT } from '@/i18n';
import { useLocalizedShop, useLocalizeCategoryName } from '@/hooks/useTranslationsCache';
import { useCity } from '@/hooks/useCity';
import { BannerSlot } from '@/components/banners/BannerSlot';
import { Skeleton } from '@/components/ui/skeleton';
import { logShopEngagement } from '@/lib/engagement';
import { RatingStars } from '@/components/shared/rating/RatingStars';
import { ReviewsSection } from '@/components/reviews/ReviewsSection';
import { useShopRating } from '@/lib/reviewsApi';

/** Fire-and-forget engagement log — routed through the shared helper so the
 *  500ms dedupe (MPULSE Rec #5) applies here too. */
const logEngagement = (shopId: string, eventType: 'call' | 'whatsapp') =>
  logShopEngagement(shopId, eventType);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sameSearchParams(a: URLSearchParams, b: URLSearchParams) {
  return a.toString() === b.toString();
}

/** Skeleton placeholder that mirrors the ShopCard layout for the related-shops strip. */
function RelatedShopSkeleton() {
  return (
    <div className="shrink-0 w-[82vw] sm:w-[46%] lg:w-[300px] snap-start bg-card rounded-xl border border-border overflow-hidden">
      {/* Image */}
      <div className="relative w-full" style={{ aspectRatio: '16/9' }}>
        <Skeleton className="absolute inset-0 rounded-none" />
      </div>
      {/* Content */}
      <div className="p-3 sm:p-4 space-y-2.5">
        <div className="flex items-center gap-1.5">
          <Skeleton className="w-4 h-4 rounded-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        <Skeleton className="h-3 w-1/2" />
        <div className="flex gap-1.5">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
        <Skeleton className="h-3 w-5/12" />
        {/* Action buttons */}
        <div className="flex gap-2 pt-1">
          <Skeleton className="h-10 flex-1 rounded-lg" />
          <Skeleton className="h-10 flex-1 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export default function ShopDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const goBack = useSmartBack();
  const { currentCity, townBrand, townName, stateName } = useCity();
  const { indicatorNode } = useEdgeSwipeBack({
    fallbackPath: `/${currentCity.slug}/shops`,
  });
  const [imgError, setImgError] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const { user, isAdmin } = useAuth();
  const [params, setParams] = useSearchParams();
  const [showClaim, setShowClaim] = useState(false);
  const { t } = useT();
  const localizeCat = useLocalizeCategoryName();

  const { data: rawShop, isLoading } = useQuery({
    queryKey: ['shop', id],
    placeholderData: (previousData) => previousData,
    queryFn: async () => {
      const isUuid = UUID_RE.test(id!);
      // Try slug first; fall back to id for legacy UUID links
      let query = supabase
        .from('shops')
        .select('*, shop_categories(category_id, categories(name, icon, is_active))')
        .eq('is_active', true);

      if (isUuid) {
        query = query.eq('id', id!);
      } else {
        query = (query as any).eq('slug', id!);
      }

      const { data, error } = await (query as any).single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!id,
  });

  // Related shops: other active shops sharing category within the SAME geographic location
  const currentShopId: string | undefined = (rawShop as any)?.id;
  const currentShopCityId: string | undefined = (rawShop as any)?.city_id || currentCity.id;
  const currentShopVillageId: string | undefined = (rawShop as any)?.village_id;
  const relatedCategoryIds: string[] = ((rawShop as any)?.shop_categories ?? [])
    .filter((sc: any) => sc?.categories?.is_active !== false)
    .map((sc: any) => sc.category_id)
    .filter(Boolean);
  const { data: relatedShops = [], isLoading: relatedLoading } = useQuery({
    queryKey: [
      'related-shops',
      currentShopId,
      currentShopCityId,
      currentShopVillageId,
      relatedCategoryIds.sort().join(','),
    ],
    enabled: !!currentShopId && !!currentShopCityId && relatedCategoryIds.length > 0,
    queryFn: async () => {
      // 1. Fetch active shops in shared categories strictly bounded to the same city_id
      const { data, error } = await supabase
        .from('shop_categories')
        .select('shop_id, shops!inner(*, shop_categories(category_id, categories(name, icon, is_active)))')
        .in('category_id', relatedCategoryIds)
        .neq('shop_id', currentShopId!)
        .eq('shops.is_active', true)
        .eq('shops.city_id', currentShopCityId!)
        .limit(60);
      if (error) throw error;
      const seen = new Set<string>();
      const hyperLocal: any[] = [];
      const townWide: any[] = [];
      for (const row of (data as any[]) ?? []) {
        const s = row.shops;
        if (!s || seen.has(s.id)) continue;
        seen.add(s.id);
        // Hyper-local prioritization: match same village/ward first
        if (currentShopVillageId && s.village_id === currentShopVillageId) {
          hyperLocal.push(s);
        } else {
          townWide.push(s);
        }
      }
      // Merge: same village/locality first, then remaining shops from same city
      return [...hyperLocal, ...townWide].slice(0, 12);
    },
  });

  // Overlay Marathi translations (name/address/area/desc) when locale = mr.
  const shop = useLocalizedShop(rawShop) || rawShop;

  // If loaded by UUID and has a slug, redirect to clean slug URL.
  // Preserve query (?claim=1, etc.) and hash so deep-links still fire.
  useEffect(() => {
    if (shop && UUID_RE.test(id!) && (shop as any).slug) {
      const { search, hash } = window.location;
      navigate(`/${currentCity.slug}/shop/${(shop as any).slug}${search}${hash}`, { replace: true });
    }
  }, [shop, id, currentCity.slug, navigate]);

  // Per-route SEO (title/meta/JSON-LD) is rendered declaratively via <PageSeo> below.


  // Auto-open claim modal when ?claim=1 (after sign-in deep-link)
  useEffect(() => {
    if (shop && user && params.get('claim') === '1') {
      setShowClaim(true);
      const nextParams = new URLSearchParams(params);
      nextParams.delete('claim');
      if (!sameSearchParams(nextParams, params)) {
        setParams(nextParams, { replace: true });
      }
    }
  }, [shop, user, params, setParams]);

  // Is this shop claimed by anyone? (uses SECURITY DEFINER RPC so anon can read)
  const { data: isClaimed } = useQuery({
    queryKey: ['shop-claimed', shop?.id],
    enabled: !!shop?.id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('shop_is_claimed' as any, { _shop_id: shop!.id });
      if (!error && typeof data === 'boolean') return data;
      // Fallback: direct count (works for admins/owners under RLS)
      const { count } = await supabase
        .from('shop_owners')
        .select('id', { count: 'exact', head: true })
        .eq('shop_id', shop!.id);
      return (count ?? 0) > 0;
    },
  });

  // Is the current user already an owner of this shop?
  const { data: isOwner } = useQuery({
    queryKey: ['is-owner', shop?.id, user?.id],
    enabled: !!shop?.id && !!user?.id,
    queryFn: async () => {
      const { count } = await supabase
        .from('shop_owners')
        .select('id', { count: 'exact', head: true })
        .eq('shop_id', shop!.id).eq('user_id', user!.id);
      return (count ?? 0) > 0;
    },
  });

  const handleShare = async () => {
    const url = window.location.href;
    const shareData = {
      title: shop?.name ? `${shop.name} on ${townBrand}` : townBrand,
      text: `Check out ${shop?.name} on ${townBrand}`,
      url,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err: any) {
        // User cancellation surfaces as AbortError — stay silent.
        // Real failures (permission, no target picked on some browsers) fall
        // through to a clipboard fallback so the user is never left guessing.
        if (err?.name === 'AbortError') return;
        try {
          await navigator.clipboard.writeText(url);
          toast.message(t('shop.shareFailed') || 'Couldn\'t share — link copied instead');
        } catch {
          toast.error(t('shop.shareError') || 'Couldn\'t share or copy link');
        }
      }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        toast.success(t('shop.shareCopied') || 'Link copied to clipboard!');
      } catch {
        toast.error(t('shop.shareError') || 'Could not copy link');
      }
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="h-16 skeleton-shimmer" />
        <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
          <div className="rounded-xl skeleton-shimmer h-40 border border-border" />
          <div className="rounded-xl skeleton-shimmer h-28 border border-border" />
          <div className="rounded-xl skeleton-shimmer h-40 border border-border" />
        </div>
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3 px-4">
        <p className="text-4xl">😕</p>
        <p className="font-semibold text-foreground">{t('shop.notFound')}</p>
        <button
          onClick={() => navigate('/')}
          className="bg-primary text-primary-foreground px-6 py-2 rounded-lg font-semibold"
        >
          {t('error.goHome')}
        </button>
      </div>
    );
  }

  const open = isShopOpen(shop);

  const allCats: { id: string; name: string; icon: string }[] = (shop as any).shop_categories
    ?.map((sc: any) => sc.categories ? { ...sc.categories, id: sc.category_id } : null)
    .filter((c: any) => c && c.is_active !== false) || [];


  const hasCoords = shop.latitude && shop.longitude;
  const mapsUrl = hasCoords
    ? `https://www.google.com/maps?q=${shop.latitude},${shop.longitude}`
    : shop.address
    ? `https://www.google.com/maps/search/${encodeURIComponent(
        shop.address + ' ' + (shop.area || '') + ` ${townName}`
      )}`
    : null;

  // Normalize WhatsApp number for wa.me (digits only, with 91 country code)
  const waNumber = shop.whatsapp
    ? (() => {
        let n = shop.whatsapp.replace(/\D/g, '');
        if (n.length === 10) n = '91' + n;
        else if (n.startsWith('91') && n.length === 12) { /* already correct */ }
        return n;
      })()
    : null;

  const isVerified = (shop as any).is_verified;

  // Count visible action buttons to determine grid columns
  const actionCount = [shop.phone, waNumber, mapsUrl, true /* share always shown */].filter(Boolean).length;
  const gridCols = actionCount === 4 ? 'grid-cols-4' : actionCount === 3 ? 'grid-cols-3' : actionCount === 2 ? 'grid-cols-2' : 'grid-cols-1';

  // Build per-shop SEO meta + LocalBusiness JSON-LD
  const slugSeg = (shop as any).slug || shop.id;
  const where = [shop.area, (shop as any).sub_area].filter(Boolean).join(', ');
  // Keep <title> under ~60 chars: prefer "Name — Area"; drop area if name alone is long; only add brand suffix if room.
  const baseTitle = where && `${shop.name} — ${where}`.length <= 60
    ? `${shop.name} — ${where}`
    : shop.name;
  const seoTitle = `${baseTitle} | ${townBrand}`.length <= 60
    ? `${baseTitle} | ${townBrand}`
    : baseTitle;
  const seoDesc = (shop.description && String(shop.description).slice(0, 155)) ||
    `Contact ${shop.name}${where ? ` in ${where}` : ''}, ${townName}. Phone, WhatsApp, hours and directions.`;
  const localBusinessLd: any = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': `https://muktainagar-daily.lovable.app/${currentCity.slug}/shop/${slugSeg}`,
    name: shop.name,
    url: `https://muktainagar-daily.lovable.app/${currentCity.slug}/shop/${slugSeg}`,
  };
  if (shop.image_url) localBusinessLd.image = shop.image_url;
  if (shop.phone) localBusinessLd.telephone = shop.phone;
  if (shop.address || shop.area) {
    localBusinessLd.address = {
      '@type': 'PostalAddress',
      streetAddress: shop.address || undefined,
      addressLocality: shop.area || townName,
      addressRegion: stateName || 'Maharashtra',
      addressCountry: 'IN',
    };
  }
  if (hasCoords) {
    localBusinessLd.geo = { '@type': 'GeoCoordinates', latitude: shop.latitude, longitude: shop.longitude };
  }
  if (shop.opening_time && shop.closing_time) {
    localBusinessLd.openingHoursSpecification = {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'],
      opens: shop.opening_time,
      closes: shop.closing_time,
    };
  }

  return (
    <div className="min-h-screen bg-background">
      {indicatorNode}
      <PageSeo
        title={seoTitle}
        description={seoDesc}
        path={`/${currentCity.slug}/shop/${slugSeg}`}
        image={shop.image_url || undefined}
        ogType="website"
        jsonLd={localBusinessLd}
      />

      <header className="bg-primary text-primary-foreground px-4 py-4 sticky top-0 z-40 shadow-md">
        <div className="max-w-lg md:max-w-4xl lg:max-w-6xl xl:max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => goBack(`/${currentCity.slug}/shops`)}
              aria-label={t('common.back')}
              className="p-1 hover:bg-primary-foreground/10 rounded-lg transition-colors shrink-0"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="font-bold text-lg leading-tight truncate">{shop.name}</h1>
          </div>

          <DesktopNav variant="primary" />

          <div className="flex items-center gap-2 shrink-0">
            <BookmarkButton shopId={shop.id} />
            <UserMenuDrawer />
          </div>
        </div>
      </header>

      {/* Extra bottom padding to clear the sticky action bar */}
      <main className="max-w-lg md:max-w-4xl lg:max-w-6xl xl:max-w-7xl mx-auto px-4 md:px-6 py-5 space-y-4 pb-32">
        {/* Shop Image Carousel & Gallery */}
        {(() => {
          const rawGallery = Array.isArray(shop.photos) && shop.photos.length > 0
            ? shop.photos
            : Array.isArray((shop as any).images) && (shop as any).images.length > 0
            ? (shop as any).images
            : (shop.image_url ? [shop.image_url] : []);
          const galleryImages = Array.from(new Set(rawGallery.filter(Boolean) as string[]));

          if (galleryImages.length === 0 || imgError) return null;

          return (
            <div className="rounded-xl overflow-hidden border border-border shadow-sm">
              <PhotoSlider
                photos={galleryImages}
                alt={shop.name}
                targetWidth={800}
                priority
                showThumbnails
                showArrows
                showDots
                showCounter
                enableLightbox
                overlayTopRight={
                  <div
                    className={`flex flex-col items-center justify-center px-3 py-1.5 rounded-full text-xs font-bold border backdrop-blur-md min-w-[75px] text-center shadow-xs ${
                      open ? 'border-success/40 text-success' : 'border-destructive/30 text-destructive'
                    }`}
                    style={{ background: 'hsl(var(--card) / 0.88)' }}
                  >
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${open ? 'animate-pulse-open' : ''}`}
                        style={{ background: open ? 'hsl(var(--success))' : 'hsl(var(--destructive))' }}
                      />
                      <span>{open ? 'OPEN' : 'CLOSED'}</span>
                    </div>
                    {!open && shop.opening_time && (
                      <span className="text-[10px] font-medium mt-0.5 opacity-80 whitespace-nowrap">
                        Open at {formatTime(shop.opening_time)}
                      </span>
                    )}
                  </div>
                }
              />
            </div>
          );
        })()}

        {/* Name + Status */}
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-foreground">{shop.name}</h1>

                {/* Verified badge — CSS tooltip on hover/focus */}
                {isVerified && (
                  <div className="relative group">
                    <span
                      className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold cursor-default select-none"
                      style={{ background: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))' }}
                    >
                      <ShieldCheck className="w-3.5 h-3.5" /> Verified
                    </span>
                    {/* Tooltip */}
                    <div
                      className="absolute left-0 top-full mt-1.5 z-20 w-max max-w-[200px] rounded-lg px-2.5 py-1.5 text-xs font-medium shadow-md pointer-events-none
                                 invisible opacity-0 translate-y-1
                                 group-hover:visible group-hover:opacity-100 group-hover:translate-y-0
                                 transition-all duration-150"
                      style={{
                        background: 'hsl(var(--primary))',
                        color: 'hsl(var(--primary-foreground))',
                      }}
                    >
                      <span className="inline-flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Verified by {townBrand}</span>
                      {/* Arrow */}
                      <span
                        className="absolute -top-1 left-3 w-2 h-2 rotate-45"
                        style={{ background: 'hsl(var(--primary))' }}
                      />
                    </div>
                  </div>
                )}

                {/* Claimed chip — sibling to Verified, hover tooltip */}
                {isClaimed && <ClaimedBadge size="md" />}
              </div>

              <ShopRatingJump shopId={shop.id} label={t('reviews.jumpCta') || 'See reviews'} />



              {/* Clickable category chips */}
              {allCats.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {allCats.map((c, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => navigate(`/${currentCity.slug}/shops?category=${encodeURIComponent(c.name)}`)}
                      className="flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium transition-all hover:opacity-80 active:scale-95"
                      style={{ background: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))' }}
                    >
                      <CategoryIcon name={c.name} className="w-3 h-3" /> {localizeCat(c.id, c.name)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Open/Closed indicator — only shown when no image (image has its own overlay badge) */}
            {(!shop.image_url || imgError) && (
              <div
                className={`shrink-0 flex flex-col items-center justify-center px-3 py-1.5 rounded-full text-sm font-bold border min-w-[80px] text-center ${
                  open
                    ? 'border-success/30 text-success'
                    : 'border-destructive/20 text-destructive'
                }`}
                style={{
                  background: open ? 'hsl(var(--success) / 0.1)' : 'hsl(var(--destructive) / 0.08)',
                }}
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className={`w-2.5 h-2.5 rounded-full shrink-0 ${open ? 'animate-pulse-open' : ''}`}
                    style={{ background: open ? 'hsl(var(--success))' : 'hsl(var(--destructive))' }}
                  />
                  <span>{open ? 'OPEN' : 'CLOSED'}</span>
                </div>
                {!open && shop.opening_time && (
                  <span className="text-[10px] font-medium mt-0.5 opacity-80 whitespace-nowrap">
                    Open at {formatTime(shop.opening_time)}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Description — only when present */}
        {shop.description && shop.description.trim() && (
          <div className="bg-card rounded-xl border border-border p-4">
            <h2 className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1.5">
              About
            </h2>
            <p className="text-foreground text-sm leading-relaxed whitespace-pre-line break-words">
              {shop.description}
            </p>
          </div>
        )}

        {/* Inline ad — hidden only for the shop owner */}
        {!isOwner && (
          <BannerSlot placement="shop_detail_inline" fallback="homepage_inline" />
        )}



        {/* Amenities — only when present. Accepts text[] or comma-separated string. */}
        {(() => {
          const raw = (shop as any).amenities;
          const items: string[] = Array.isArray(raw)
            ? raw.map((s) => String(s).trim()).filter(Boolean)
            : typeof raw === 'string'
            ? raw.split(',').map((s) => s.trim()).filter(Boolean)
            : [];
          if (items.length === 0) return null;
          return (
            <div className="bg-card rounded-xl border border-border p-4">
              <div className="flex items-center gap-1.5 mb-2.5">
                <Sparkles className="w-4 h-4 text-primary" />
                <h2 className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                  Amenities
                </h2>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {items.map((label, i) => (
                  <span
                    key={`${label}-${i}`}
                    className="text-xs px-2.5 py-1 rounded-full font-medium border border-border bg-muted text-foreground"
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Details */}
        <div className="bg-card rounded-xl border border-border divide-y divide-border">
          {/* Merge address + sub_area + area into one Location row */}
          {(() => {
            const parts = [shop.address, (shop as any).sub_area, shop.area].filter(
              (p) => p && String(p).trim()
            );
            if (parts.length === 0) return null;
            const label = parts.length === 1 && shop.address ? 'Address'
              : parts.length === 1 && shop.area ? 'Area'
              : 'Location';
            return (
              <DetailRow
                icon={<MapPin className="w-5 h-5 text-primary" />}
                label={label}
                value={parts.join(', ')}
              />
            );
          })()}
          {(shop.opening_time || shop.closing_time) && (
            <DetailRow
              icon={<Clock className="w-5 h-5 text-primary" />}
              label="Hours"
              value={`${formatTime(shop.opening_time) || '--'} – ${formatTime(shop.closing_time) || '--'}`}
            />
          )}
          {allCats.length > 0 && (
            <DetailRow
              icon={<Tag className="w-5 h-5 text-primary" />}
              label="Categories"
              value={allCats.map((c) => c.name).join('  •  ')}
            />
          )}
        </div>

        {/* ── Ratings & Reviews — promoted above the claim/owner CTAs so the
             single most decision-driving section on a shop page sits within
             the first scroll on mobile. ── */}
        <ReviewsSection shopId={shop.id} shopName={shop.name} />

        {!isOwner && !isAdmin && !isClaimed && (
          <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-accent/5 to-primary/10 p-4 shadow-soft">
            <div className="pointer-events-none absolute -top-8 -right-8 w-32 h-32 rounded-full bg-accent/20 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-10 -left-10 w-32 h-32 rounded-full bg-primary/20 blur-2xl" />
            <div className="relative flex items-center gap-3">
              <div className="shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground flex items-center justify-center shadow-md shadow-primary/20">
                <BadgePlus className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-display font-bold text-sm text-foreground leading-tight">
                  Is this your shop?
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">
                  Claim it to manage details, hours &amp; photos
                </p>
              </div>
              <button
                onClick={() => setShowClaim(true)}
                className="shrink-0 inline-flex items-center gap-1 px-3.5 py-2 rounded-full bg-primary text-primary-foreground text-xs font-bold shadow-md shadow-primary/30 hover:shadow-lg hover:shadow-primary/40 active:scale-95 transition-all"
              >
                Claim
                <ShieldCheck className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
        {isOwner && (
          <button
            onClick={() => navigate(`/my-shop?id=${shop.id}`)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-success/10 text-success font-semibold text-sm border border-success/30"
          >
            <ShieldCheck className="w-4 h-4" />
            You own this shop — Manage
          </button>
        )}



        {/* ── Related Shops (same-category horizontal strip) ── */}
        {(relatedLoading || relatedShops.length > 0) && (
          <section className="mt-8" aria-labelledby="related-shops-title">
            <div className="flex items-baseline justify-between mb-3">
              <h2 id="related-shops-title" className="text-base font-bold text-foreground">
                {t('shopDetail.relatedTitle')}
              </h2>
              {allCats[0]?.name && (
                <p className="text-xs text-muted-foreground truncate ml-3">
                  {t('shopDetail.relatedSubtitle', { category: localizeCat(allCats[0].id, allCats[0].name) })}
                </p>
              )}
            </div>
            <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 -mx-4 px-4 scrollbar-thin">
              {relatedLoading
                ? Array.from({ length: 3 }).map((_, i) => <RelatedShopSkeleton key={i} />)
                : relatedShops.map((s: any) => (
                    <div
                      key={s.id}
                      className="shrink-0 w-[82vw] sm:w-[46%] lg:w-[300px] snap-start"
                    >
                      <ShopCard shop={s} />
                    </div>
                  ))}
            </div>
          </section>
        )}
      </main>


      {showClaim && shop && (
        <ClaimShopModal shopId={shop.id} shopName={shop.name} onClose={() => setShowClaim(false)} />
      )}

      {/* ── Sticky Bottom Action Bar ── */}
      <div
        className="fixed bottom-0 left-0 right-0 z-20 border-t border-border shadow-2xl"
        style={{ background: 'hsl(var(--card))' }}
      >
        {/* iOS safe-area bottom */}
        <div className={`max-w-lg mx-auto px-3 py-2.5 grid gap-2 ${gridCols}`}>
          {shop.phone && (
            <a
              href={`tel:${shop.phone}`}
              onClick={() => logEngagement(shop.id, 'call')}
              className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl font-semibold text-[11px] active:scale-95 transition-all"
              style={{ background: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))' }}
            >
              <Phone className="w-5 h-5" />
              <span>{t('shop.call')}</span>
            </a>
          )}
          {waNumber && (
            <a
              href={`https://wa.me/${waNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => logEngagement(shop.id, 'whatsapp')}
              className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl font-semibold text-[11px] active:scale-95 transition-all"
              style={{ background: 'hsl(var(--whatsapp-soft))', color: 'hsl(var(--whatsapp))' }}
            >
              <MessageCircle className="w-5 h-5" />
              <span>{t('shop.whatsapp')}</span>
            </a>
          )}
          {mapsUrl && (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl font-semibold text-[11px] active:scale-95 transition-all"
              style={{ background: 'hsl(var(--maps-soft))', color: 'hsl(var(--maps))' }}
            >
              <Navigation className="w-5 h-5" />
              <span>{t('shop.maps')}</span>
            </a>
          )}
          <button
            onClick={handleShare}
            className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl font-semibold text-[11px] active:scale-95 transition-all"
            style={{
              background: 'hsl(var(--muted))',
              color: 'hsl(var(--muted-foreground))',
            }}
          >
            <Share2 className="w-5 h-5" />
            <span>{t('shop.share')}</span>
          </button>
        </div>
        {/* iOS safe-area spacer */}
        <div className="pb-safe" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }} />
      </div>
    </div>
  );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
        <p className="text-foreground font-medium mt-0.5 break-words">{value}</p>
      </div>
    </div>
  );
}

function ShopRatingJump({ shopId, label }: { shopId: string; label: string }) {
  const { data: r } = useShopRating(shopId);
  if (!r) return null;
  return (
    <a
      href="#reviews"
      onClick={(e) => {
        e.preventDefault();
        document.getElementById('reviews')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }}
      className="mt-1.5 group inline-flex items-center gap-2 rounded-full py-1 pl-0.5 pr-1.5 -ml-0.5 hover:bg-muted/60 active:bg-muted transition-colors"
      aria-label={`Rated ${r.average.toFixed(1)} out of 5, ${r.count} reviews — jump to reviews`}
    >
      <RatingStars value={r.average} size="sm" showValue count={r.count} />
      <span className="text-[11px] font-semibold text-primary inline-flex items-center gap-0.5">
        {label}
        <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
      </span>
    </a>
  );
}

