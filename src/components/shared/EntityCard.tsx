/**
 * EntityCard — Forge Recommendation #10.
 *
 * Generic card layout shared by shops, and (planned) buses, schools,
 * hospitals, etc. This is a **layout primitive with slots**, not a data
 * component: callers pass fully-formed React nodes / props and EntityCard
 * arranges them consistently.
 *
 * Wrapper-first migration (Sentinel guardrail on ShopCard):
 *   • `ShopCard` maps a `Shop` row → EntityCard props and renders identically.
 *   • Future `CompactShopCard`, `BusRow`, `SchoolCard` do the same.
 *
 * The shape below intentionally mirrors what `ShopCard.tsx` renders today
 * (image with overlay chip, title with leading icon, badge row, meta rows,
 * chip row, action button row). Any tweak here shows up everywhere — treat
 * as UI-load-bearing.
 */
import { type ReactNode, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShopImage } from '@/components/shared/ShopImage';
import { PhotoSlider } from '@/components/shared/PhotoSlider';
import { haptic } from '@/lib/uxUtils';

/** One action button rendered in the card footer row. */
export interface EntityAction {
  key: string;
  label: ReactNode;
  icon?: ReactNode;
  href?: string;
  onClick?: (e: MouseEvent) => void;
  external?: boolean;              // adds target=_blank + rel
  ariaLabel?: string;
  /** Inline style (used today for brand colours like WhatsApp green). */
  style?: React.CSSProperties;
  /** Extra classes appended to the shared button classes. */
  className?: string;
}

export interface EntityCardImage {
  src: string;
  alt: string;
  targetWidth?: number;
  /** Rendered as inline `aspect-ratio: <value>`. Default '16/9' — matches ShopCard. */
  aspectRatio?: string;
  onError?: () => void;
  loading?: 'eager' | 'lazy';
  fetchPriority?: 'high' | 'low' | 'auto';
}

export interface EntityCardProps {
  /** Image block; when omitted, no image area is rendered. */
  image?: EntityCardImage;
  /** Multi-photo gallery array. When provided with > 1 photo, renders an interactive PhotoSlider */
  photos?: (string | null | undefined)[] | null;
  /** Node rendered absolutely at the image top-right (e.g. StatusChip overlay). */
  imageOverlay?: ReactNode;
  /** Node rendered absolutely at the image bottom-left (e.g. rating badge). */
  imageOverlayBottomLeft?: ReactNode;

  /** Title text. */
  title: ReactNode;
  /** Small icon rendered to the left of the title (e.g. category icon). */
  titleIcon?: ReactNode;

  /** Badge row rendered under the title (verified / claimed / etc). */
  badges?: ReactNode;
  /** Chip row (e.g. category chips). */
  chips?: ReactNode;
  /**
   * Free-form meta rows rendered between badges and chips (area, hours, …).
   * Pass an array to control spacing per row; a single node also works.
   */
  meta?: ReactNode | ReactNode[];

  /** Rendered on the right of the top row (used when there's no image, e.g. inline StatusChip). */
  rightAdornment?: ReactNode;

  /** Action buttons in the bottom row. */
  actions?: EntityAction[];

  /** Navigate on card click. Takes precedence over onClick. */
  href?: string;
  onClick?: () => void;

  /** Container className override. */
  className?: string;
}

const DEFAULT_CARD_CLASS =
  'bg-card rounded-xl border border-border hover:shadow-md transition-all cursor-pointer active:scale-[0.99] overflow-hidden isolate';

const DEFAULT_ACTION_CLASS =
  'flex-1 min-w-0 flex items-center justify-center gap-1 px-1.5 min-h-[44px] rounded-lg text-[11px] sm:text-xs font-semibold active:scale-95 transition-all whitespace-nowrap overflow-hidden';

export function EntityCard({
  image,
  photos,
  imageOverlay,
  imageOverlayBottomLeft,
  title,
  titleIcon,
  badges,
  chips,
  meta,
  rightAdornment,
  actions,
  href,
  onClick,
  className,
}: EntityCardProps) {
  const navigate = useNavigate();
  const handleCardClick = () => {
    haptic('tap');
    if (href) navigate(href);
    else onClick?.();
  };

  const metaRows = Array.isArray(meta) ? meta : meta ? [meta] : [];

  const validPhotos = Array.isArray(photos) ? photos.filter(Boolean) : [];
  const isMultiPhoto = validPhotos.length > 1;

  return (
    <div className={className ?? DEFAULT_CARD_CLASS} onClick={handleCardClick}>
      {isMultiPhoto ? (
        <PhotoSlider
          photos={validPhotos}
          imageUrl={image?.src}
          alt={image?.alt || (typeof title === 'string' ? title : '')}
          aspectRatio={image?.aspectRatio ?? '16/9'}
          targetWidth={image?.targetWidth ?? 400}
          priority={image?.loading === 'eager'}
          showArrows
          showDots
          showCounter
          enableLightbox={false}
          overlayTopRight={imageOverlay}
          overlayBottomLeft={imageOverlayBottomLeft}
        />
      ) : image ? (
        <div
          className="relative w-full overflow-hidden"
          style={{ aspectRatio: image.aspectRatio ?? '16/9' }}
        >
          <ShopImage
            src={image.src}
            alt={image.alt}
            targetWidth={image.targetWidth ?? 400}
            loading={image.loading}
            fetchPriority={image.fetchPriority}
            onError={image.onError}
          />
          {/* Subtle bottom gradient so content below reads clearly. */}
          <div
            className="absolute inset-x-0 bottom-0 h-12 pointer-events-none"
            style={{ background: 'linear-gradient(to top, hsl(var(--card) / 0.7), transparent)' }}
          />
          {imageOverlay && <div className="absolute top-2 right-2">{imageOverlay}</div>}
          {imageOverlayBottomLeft && (
            <div className="absolute bottom-2 left-2">{imageOverlayBottomLeft}</div>
          )}
        </div>
      ) : null}

      <div className="p-3 sm:p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              {titleIcon}
              <h2 className="font-bold text-foreground text-sm sm:text-base leading-snug truncate min-w-0">
                {title}
              </h2>
            </div>

            {badges && (
              <div className="flex items-center flex-wrap gap-1 mb-0.5">{badges}</div>
            )}

            {metaRows.map((row, i) => (
              <div key={i}>{row}</div>
            ))}

            {chips && <div className="flex flex-wrap gap-1 mt-1">{chips}</div>}
          </div>

          {rightAdornment && <div className="shrink-0">{rightAdornment}</div>}
        </div>

        {actions && actions.length > 0 && (
          <div className="flex gap-2 mt-2.5" onClick={(e) => e.stopPropagation()}>
            {actions.map((a) => {
              const cls = `${DEFAULT_ACTION_CLASS} ${a.className ?? ''}`.trim();
              const commonProps = {
                'aria-label': a.ariaLabel,
                className: cls,
                style: a.style,
              } as const;
              if (a.href) {
                return (
                  <a
                    key={a.key}
                    href={a.href}
                    {...(a.external
                      ? { target: '_blank', rel: 'noopener noreferrer' }
                      : {})}
                    onClick={a.onClick}
                    {...commonProps}
                  >
                    {a.icon}
                    <span className="truncate">{a.label}</span>
                  </a>
                );
              }
              return (
                <button key={a.key} type="button" onClick={a.onClick} {...commonProps}>
                  {a.icon}
                  <span className="truncate">{a.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
