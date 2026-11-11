/**
 * Compact horizontal-row shop card. Extracted from Home.tsx as part of
 * MPULSE Phase 2 #7 (Home.tsx split). Behaviour unchanged — same DOM,
 * same engagement dedupe path via `logShopEngagement`, same LCP hint via
 * the `priority` prop.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, ShieldCheck, Phone, MessageCircle } from 'lucide-react';
import { isShopOpen } from '@/lib/shopUtils';
import { ClaimedBadge } from '@/components/shared/ClaimedBadge';
import { CategoryIcon } from '@/components/shared/CategoryIcon';
import { ShopImage } from '@/components/shared/ShopImage';
import { useT } from '@/i18n';
import { useLocalizedShop } from '@/hooks/useTranslationsCache';
import { useCity } from '@/hooks/useCity';
import { cn } from '@/lib/utils';
import { logShopEngagement } from '@/lib/engagement';
import { RatingInline } from '@/components/shared/rating/RatingInline';
import { useShopRating } from '@/lib/reviewsApi';


export function CompactShopCard({ shop: rawShop, priority = false }: { shop: any; priority?: boolean }) {
  const navigate = useNavigate();
  const { currentCity } = useCity();
  const shop = useLocalizedShop(rawShop) || rawShop;
  const open = isShopOpen(shop);
  const [imgError, setImgError] = useState(false);
  const shopPath = shop.slug ? `/${currentCity.slug}/shop/${shop.slug}` : `/${currentCity.slug}/shop/${shop.id}`;
  const { t, locale } = useT();

  const logEngagement = (type: 'call' | 'whatsapp') => {
    logShopEngagement(shop.id, type);
  };

  const waNumber = useMemo(() => {
    const raw = (shop.whatsapp || shop.phone || '').replace(/\D/g, '');
    if (raw.length === 10) return `91${raw}`;
    if (raw.length === 11 && raw.startsWith('0')) return `91${raw.slice(1)}`;
    if (raw.startsWith('91') && raw.length === 12) return raw;
    return raw;
  }, [shop.whatsapp, shop.phone]);

  const allCats = useMemo(() => {
    const from_sc = (shop.shop_categories || [])
      .map((sc: any) => sc.categories)
      .filter(Boolean);
    if (from_sc.length > 0) return from_sc;
    if (shop.categories) return [shop.categories];
    return [];
  }, [shop]);

  const primaryCatName = allCats[0]?.name as string | undefined;

  return (
    <button
      onClick={() => navigate(shopPath)}
      className="flex flex-col bg-card rounded-xl border border-border hover:border-primary/60 shadow-sm hover:shadow-lg transition-all duration-200 active:scale-[0.97] w-[185px] h-[260px] shrink-0 text-left overflow-hidden group"
    >
      {shop.image_url && !imgError ? (
        <div className="relative w-full overflow-hidden" style={{ aspectRatio: '16/9' }}>
          <ShopImage
            src={shop.image_url}
            alt={shop.name}
            targetWidth={200}
            loading={priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : undefined}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={() => setImgError(true)}
          />
          <div
            className="absolute inset-x-0 bottom-0 h-12 pointer-events-none"
            style={{ background: 'linear-gradient(to top, hsl(var(--card)), hsl(var(--card) / 0.4), transparent)' }}
          />
          <span
            role="img"
            aria-label={open ? 'Open now' : 'Closed'}
            title={open ? 'Open now' : 'Closed'}
            className={`group/dot absolute top-1.5 right-1.5 inline-flex items-center gap-1 rounded-full ring-2 ring-card transition-all ${open ? 'animate-pulse-open' : 'opacity-70'}`}
            style={{ background: open ? 'hsl(var(--success))' : 'hsl(var(--muted-foreground))' }}
          >
            <span className="w-2.5 h-2.5 rounded-full shrink-0" />
            <span className="hidden group-hover/dot:inline pr-1.5 text-[9px] font-bold leading-none text-white whitespace-nowrap">
              {open ? 'Open' : 'Closed'}
            </span>
          </span>
        </div>
      ) : (
        <div
          className="relative w-full flex items-center justify-center py-4"
          style={{ background: 'linear-gradient(135deg, hsl(var(--primary) / 0.06), hsl(var(--primary) / 0.02))' }}
        >
          <CategoryIcon name={primaryCatName} className="w-8 h-8 text-primary/80" />
          <span
            role="img"
            aria-label={open ? 'Open now' : 'Closed'}
            title={open ? 'Open now' : 'Closed'}
            className={`group/dot absolute top-1.5 right-1.5 inline-flex items-center gap-1 rounded-full transition-all ${open ? 'animate-pulse-open' : 'opacity-60'}`}
            style={{ background: open ? 'hsl(var(--success))' : 'hsl(var(--muted-foreground))' }}
          >
            <span className="w-2.5 h-2.5 rounded-full shrink-0" />
            <span className="hidden group-hover/dot:inline pr-1.5 text-[9px] font-bold leading-none text-white whitespace-nowrap">
              {open ? 'Open' : 'Closed'}
            </span>
          </span>
        </div>
      )}
      <div className="flex flex-col gap-1.5 p-3 pt-2 flex-1 min-h-0">
        <p className={cn("font-bold text-foreground leading-tight line-clamp-2 w-full", locale === 'mr' ? "text-sm" : "text-xs")}>{shop.name}</p>
        <RatingInlineForShop shopId={shop.id} />

        {shop.area && (
          <p className="text-[10px] text-muted-foreground leading-tight flex items-center gap-1">
            <MapPin className="w-2.5 h-2.5 shrink-0" />
            <span className="truncate">{shop.area}</span>
          </p>
        )}
        {(shop.is_verified || shop.is_claimed) && (
          <div className="flex items-center flex-wrap gap-1">
            {shop.is_verified && (
              <span
                className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none w-fit"
                style={{ background: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))' }}
              >
                <ShieldCheck className="w-2.5 h-2.5" />
                {t('common.verified')}
              </span>
            )}
            {shop.is_claimed && <ClaimedBadge size="sm" />}
          </div>
        )}

        <div className="flex gap-1.5 w-full mt-auto pt-1.5">
          {shop.phone && (
            <a
              href={`tel:${shop.phone}`}
              onClick={(e) => { e.stopPropagation(); logEngagement('call'); }}
              className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-semibold transition-colors hover:opacity-80"
              style={{ background: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))' }}
            >
              <Phone className="w-3 h-3" /> Call
            </a>
          )}
          {(shop.whatsapp || shop.phone) && (
            <a
              href={`https://wa.me/${waNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => { e.stopPropagation(); logEngagement('whatsapp'); }}
              className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-semibold transition-colors hover:opacity-80"
              style={{ background: 'hsl(var(--whatsapp-soft))', color: 'hsl(var(--whatsapp))' }}
            >
              <MessageCircle className="w-3 h-3" /> WhatsApp
            </a>
          )}
        </div>
      </div>
    </button>
  );
}

function RatingInlineForShop({ shopId }: { shopId: string }) {
  const { data: rating } = useShopRating(shopId);
  if (!rating) return null;
  return <RatingInline value={rating.average} count={rating.count} size="sm" />;
}

