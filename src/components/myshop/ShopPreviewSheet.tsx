/**
 * Preview sheet for shopkeepers: shows their live edits the way
 * customers will see them — both as a list card and as the detail page.
 *
 * Pure presentational; data comes from the in-memory form state in
 * MyShop so unsaved edits preview instantly.
 */
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Phone, MessageCircle, MapPin, Clock, ShieldCheck, Eye, Navigation, Tag } from 'lucide-react';
import { ShopCard } from '@/components/ShopCard';
import { ShopImage } from '@/components/shared/ShopImage';
import { PhotoSlider } from '@/components/shared/PhotoSlider';
import { StatusChip } from '@/components/shared/StatusChip';
import { ClaimedBadge } from '@/components/shared/ClaimedBadge';
import { formatTime, isShopOpen } from '@/lib/shopUtils';
import { useT } from '@/i18n';

interface FormShape {
  name: string;
  description: string;
  address: string;
  area: string;
  sub_area: string;
  phone: string;
  whatsapp: string;
  opening_time: string;
  closing_time: string;
  is_open: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  shop: any;            // the saved shop row (for categories, verified flag, slug, id…)
  form: FormShape;      // unsaved editable values
  imageUrl: string | null;
  previewBlobUrl?: string | null; // local blob preview if user picked a new image
}

export function ShopPreviewSheet({ open, onOpenChange, shop, form, imageUrl, previewBlobUrl }: Props) {
  const { t } = useT();
  const effectiveImage = previewBlobUrl || imageUrl || null;

  const previewPhotos = Array.isArray(shop?.photos) && shop.photos.length > 0
    ? (effectiveImage && effectiveImage !== shop.photos[0] ? [effectiveImage, ...shop.photos.slice(1)] : shop.photos)
    : (effectiveImage ? [effectiveImage] : []);

  // Build a shop-shaped object that ShopCard understands, mixing saved
  // fields (categories, slug, verified flag) with live edited values.
  const previewShop = {
    ...shop,
    name: form.name || shop.name,
    area: form.area || null,
    address: form.address || null,
    phone: form.phone || null,
    whatsapp: form.whatsapp || null,
    opening_time: form.opening_time || null,
    closing_time: form.closing_time || null,
    is_open: form.is_open,
    image_url: effectiveImage,
    photos: previewPhotos,
    description: form.description || null,
  };

  const waNumber = form.whatsapp
    ? (() => { let n = form.whatsapp.replace(/\D/g, ''); if (n.length === 10) n = '91' + n; return n; })()
    : null;

  const categories: Array<{ name: string; icon?: string | null }> = Array.isArray(shop?.shop_categories)
    ? shop.shop_categories
        .map((sc: any) => sc?.categories)
        .filter((c: any) => c && c.is_active !== false)
    : [];

  const openNow = (form.opening_time && form.closing_time)
    ? isShopOpen({
        is_open: form.is_open,
        opening_time: form.opening_time,
        closing_time: form.closing_time,
      })
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Eye className="w-4 h-4 text-primary" /> {t('myshop.preview.title')}
          </DialogTitle>
          <p className="text-[11px] text-muted-foreground">
            {t('myshop.preview.subtitle')}
          </p>
        </DialogHeader>

        <Tabs defaultValue="card" className="w-full">
          <div className="px-4">
            <TabsList className="w-full grid grid-cols-2">
              <TabsTrigger value="card">{t('myshop.preview.cardTab')}</TabsTrigger>
              <TabsTrigger value="detail">{t('myshop.preview.detailTab')}</TabsTrigger>
            </TabsList>
          </div>

          {/* ─── Card view — uses the real ShopCard ─────────────── */}
          <TabsContent value="card" className="px-4 pb-4 pt-3 m-0">
            <div className="bg-muted/50 rounded-2xl p-3">
              <ShopCard shop={previewShop} />
            </div>
            <p className="text-[10px] text-muted-foreground mt-2 text-center">
              This is the exact card shown on the Shops listing page.
            </p>
          </TabsContent>

          {/* ─── Detail view — faithful mini-mirror ─────────────── */}
          <TabsContent value="detail" className="m-0">
            <div className="max-h-[75dvh] overflow-y-auto bg-muted/30 pb-6">
              {/* Hero image / PhotoSlider */}
              {previewPhotos.length > 0 ? (
                <PhotoSlider
                  photos={previewPhotos}
                  imageUrl={effectiveImage}
                  alt={previewShop.name}
                  aspectRatio="16/9"
                  targetWidth={600}
                  showThumbnails
                  showArrows
                  showDots
                  showCounter
                  enableLightbox
                  overlayBottomRight={
                    <StatusChip shop={previewShop} variant="overlay" size="sm" />
                  }
                />
              ) : (
                <div className="w-full aspect-[16/9] bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center text-muted-foreground text-xs">
                  No shop photo yet
                </div>
              )}

              <div className="bg-background p-4 space-y-3">
                <div>
                  <h2 className="text-lg font-bold text-foreground leading-tight">{previewShop.name || 'Your shop name'}</h2>
                  <div className="flex items-center flex-wrap gap-1.5 mt-1.5">
                    {shop.is_verified && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                            style={{ background: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))' }}>
                        <ShieldCheck className="w-2.5 h-2.5" /> Verified
                      </span>
                    )}
                    {shop.is_claimed && <ClaimedBadge size="sm" />}
                  </div>
                </div>

                {/* Categories row */}
                {categories.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {categories.map((c, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border"
                      >
                        <Tag className="w-3 h-3" /> {c.icon ? `${c.icon} ` : ''}{c.name}
                      </span>
                    ))}
                  </div>
                )}

                {/* Address block */}
                {(form.area || form.sub_area || form.address) && (
                  <div className="rounded-xl bg-muted/40 p-3 space-y-1">
                    {(form.area || form.sub_area) && (
                      <p className="text-xs text-foreground flex items-start gap-1.5">
                        <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary" />
                        <span className="font-medium">{[form.area, form.sub_area].filter(Boolean).join(' · ')}</span>
                      </p>
                    )}
                    {form.address && (
                      <p className="text-xs text-muted-foreground pl-5 leading-snug">{form.address}</p>
                    )}
                  </div>
                )}

                {/* Hours block */}
                {(form.opening_time || form.closing_time) && (
                  <div className="rounded-xl bg-muted/40 p-3 flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 shrink-0 text-primary" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground font-medium">
                        {formatTime(form.opening_time)} – {formatTime(form.closing_time)}
                      </p>
                    </div>
                    {openNow !== null && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${
                        openNow
                          ? 'bg-success/15 text-success border border-success/30'
                          : 'bg-muted text-muted-foreground border border-border'
                      }`}>
                        {openNow ? 'Open now' : 'Closed'}
                      </span>
                    )}
                  </div>
                )}

                {/* Description */}
                {form.description && (
                  <div className="rounded-xl bg-muted/40 p-3">
                    <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line">{form.description}</p>
                  </div>
                )}

                {/* Action row — Call / WhatsApp / Maps */}
                <div className="flex gap-2 pt-1">
                  {form.phone && (
                    <div className="flex-1 h-11 flex items-center justify-center gap-1.5 rounded-xl text-xs font-semibold"
                         style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}>
                      <Phone className="w-4 h-4" /> Call
                    </div>
                  )}
                  {waNumber && (
                    <div className="flex-1 h-11 flex items-center justify-center gap-1.5 rounded-xl text-xs font-semibold text-white"
                         style={{ background: '#25D366' }}>
                      <MessageCircle className="w-4 h-4" /> WhatsApp
                    </div>
                  )}
                  <div className="flex-1 h-11 flex items-center justify-center gap-1.5 rounded-xl text-xs font-semibold text-white"
                       style={{ background: 'hsl(211 100% 45%)' }}>
                    <Navigation className="w-4 h-4" /> Maps
                  </div>
                </div>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground py-2 text-center bg-background border-t border-border sticky bottom-0">
              Preview only — buttons disabled. Save changes to publish.
            </p>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
