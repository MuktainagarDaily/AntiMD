import { useState } from 'react';
import { Phone, MessageCircle, MapPin, Clock, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { formatTime } from '@/lib/shopUtils';
import { logShopEngagement, canDialTel } from '@/lib/engagement';
import { StatusChip } from '@/components/shared/StatusChip';
import { ClaimedBadge } from '@/components/shared/ClaimedBadge';
import { CategoryIcon } from '@/components/shared/CategoryIcon';
import { EntityCard, type EntityAction } from '@/components/shared/EntityCard';
import { useT } from '@/i18n';
import { useLocalizedShop, useLocalizeCategoryName } from '@/hooks/useTranslationsCache';
import { useCity } from '@/hooks/useCity';
import { RatingInline } from '@/components/shared/rating/RatingInline';
import { useShopRating } from '@/lib/reviewsApi';


/**
 * ShopCard — thin wrapper over `<EntityCard/>` (Forge Recommendation #10).
 *
 * All display behaviour (haptics, engagement logging, toast messages, brand
 * colours, verified/claimed badges, category chip layout) is preserved
 * byte-for-byte from the pre-refactor version so Sentinel's "Business
 * Critical" contract on this file remains intact — only the layout scaffold
 * moved into the shared EntityCard primitive.
 */

interface Shop {
  id: string;
  slug?: string | null;
  name: string;
  area?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  opening_time?: string | null;
  closing_time?: string | null;
  is_open: boolean;
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  image_url?: string | null;
  photos?: string[] | null;
  is_claimed?: boolean;
  // BUG-07: include is_active on category so the runtime cast has type backing
  shop_categories?: { categories: { name: string; icon: string; is_active?: boolean } | null }[];
  categories?: { name: string; icon: string; is_active?: boolean } | null;
}

export function ShopCard({ shop: rawShop, priority = false }: { shop: Shop; priority?: boolean }) {
  const { t } = useT();
  const { currentCity, townName } = useCity();
  const shop = useLocalizedShop(rawShop) as Shop;
  const localizeCat = useLocalizeCategoryName();
  const [imgError, setImgError] = useState(false);
  const shopPath = shop.slug ? `/${currentCity.slug}/shop/${shop.slug}` : `/${currentCity.slug}/shop/${shop.id}`;

  // Flatten M:N shop_categories → [{id,name,icon}]; falls back to legacy 1:1 `categories`.
  const allCats: { id?: string; name: string; icon: string }[] = [];
  if (shop.shop_categories?.length) {
    shop.shop_categories.forEach((sc: any) => {
      if (sc.categories && sc.categories.is_active !== false) {
        allCats.push({ id: sc.category_id ?? sc.categories.id, ...sc.categories });
      }
    });
  } else if (shop.categories && (shop.categories as any).is_active !== false) {
    allCats.push(shop.categories as any);
  }

  const hasCoords = shop.latitude && shop.longitude;
  const mapsUrl = hasCoords
    ? `https://www.google.com/maps?q=${shop.latitude},${shop.longitude}`
    : shop.address
    ? `https://www.google.com/maps/search/${encodeURIComponent(
        shop.address + ' ' + (shop.area || '') + ` ${townName}`,
      )}`
    : null;

  const waNumber = shop.whatsapp
    ? (() => {
        let n = shop.whatsapp.replace(/\D/g, '');
        if (n.length === 10) n = '91' + n;
        return n;
      })()
    : null;

  const showImage = !!shop.image_url && !imgError;

  // ---- Slots ---------------------------------------------------------------

  const titleIcon = allCats.slice(0, 1).map((c, i) => (
    <CategoryIcon key={i} name={c.name} className="w-4 h-4 shrink-0 text-primary" />
  ));

  const { data: rating } = useShopRating(shop.id);

  const badges =
    (shop as any).is_verified || shop.is_claimed ? (
      <>
        {(shop as any).is_verified && (
          <span
            className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-semibold leading-none"
            style={{ background: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))' }}
            title={t('shop.verifiedTitle')}
          >
            <ShieldCheck className="w-2.5 h-2.5" /> {t('common.verified')}
          </span>
        )}
        {shop.is_claimed && <ClaimedBadge size="sm" />}
      </>
    ) : null;

  const metaRows: React.ReactNode[] = [];
  if (rating) {
    metaRows.push(
      <div className="mt-0.5">
        <RatingInline value={rating.average} count={rating.count} size="sm" />
      </div>,
    );
  }
  if (shop.area) {
    metaRows.push(
      <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
        <MapPin className="w-3 h-3 shrink-0" /> {shop.area}
      </p>,
    );
  }
  if (shop.opening_time || shop.closing_time) {
    metaRows.push(
      <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-1">
        <Clock className="w-3 h-3 shrink-0" />
        {formatTime(shop.opening_time)} – {formatTime(shop.closing_time)}
      </p>,
    );
  }


  const chips =
    allCats.length > 0 ? (
      <>
        {allCats.slice(0, 2).map((c, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 text-[11px] px-1.5 sm:px-2 py-0.5 rounded-full font-medium"
            style={{ background: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))' }}
          >
            <CategoryIcon name={c.name} className="w-3 h-3" />
            {localizeCat(c.id, c.name)}
          </span>
        ))}
        {allCats.length > 2 && (
          <span className="text-[11px] px-1.5 py-0.5 rounded-full font-medium bg-muted text-muted-foreground">
            +{allCats.length - 2}
          </span>
        )}
      </>
    ) : null;

  const actions: EntityAction[] = [];
  if (shop.phone) {
    actions.push({
      key: 'call',
      label: t('shop.call'),
      icon: <Phone className="w-3.5 h-3.5 shrink-0" />,
      href: `tel:${shop.phone}`,
      ariaLabel: `${t('shop.call')} ${shop.name} ${shop.phone}`,
      style: { background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' },
      onClick: () => {
        logShopEngagement(shop.id, 'call');
        if (canDialTel()) {
          toast.success(t('shop.calling', { name: shop.name }));
        } else {
          toast.info(t('shop.callDesktop', { phone: shop.phone! }), { duration: 6000 });
        }
      },
    });
  }
  if (waNumber) {
    actions.push({
      key: 'whatsapp',
      label: t('shop.whatsapp'),
      icon: <MessageCircle className="w-3.5 h-3.5 shrink-0" />,
      href: `https://wa.me/${waNumber}`,
      external: true,
      ariaLabel: `${t('shop.whatsapp')} ${shop.name}`,
      className: 'text-white',
      style: { background: '#25D366' },
      onClick: () => {
        logShopEngagement(shop.id, 'whatsapp');
        toast.success(t('shop.openingWhatsApp'));
      },
    });
  }
  if (mapsUrl) {
    actions.push({
      key: 'maps',
      label: t('shop.maps'),
      icon: <MapPin className="w-3.5 h-3.5 shrink-0" />,
      href: mapsUrl,
      external: true,
      ariaLabel: `${t('shop.directions')} ${shop.name}`,
      className: 'text-white',
      style: { background: 'hsl(211 100% 45%)' },
      onClick: () => {
        logShopEngagement(shop.id, 'directions');
        toast.success(t('shop.openingMaps'));
      },
    });
  }

  return (
    <EntityCard
      href={shopPath}
      photos={Array.isArray(shop.photos) && shop.photos.length > 1 ? shop.photos : undefined}
      image={
        showImage
          ? {
              src: shop.image_url!,
              alt: shop.name,
              targetWidth: 400,
              loading: priority ? 'eager' : 'lazy',
              fetchPriority: priority ? 'high' : undefined,
              onError: () => setImgError(true),
            }
          : undefined
      }
      imageOverlay={showImage ? <StatusChip shop={shop} variant="overlay" size="sm" /> : undefined}
      title={shop.name}
      titleIcon={titleIcon}
      badges={badges}
      meta={metaRows}
      chips={chips}
      rightAdornment={
        !showImage ? <StatusChip shop={shop} variant="inline" size="sm" /> : undefined
      }

      actions={actions}
    />
  );
}
