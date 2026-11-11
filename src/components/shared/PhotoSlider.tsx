import { useState, useRef, useCallback, useEffect, type ReactNode, type MouseEvent, type TouchEvent } from 'react';
import { ChevronLeft, ChevronRight, Camera, Maximize2 } from 'lucide-react';
import { ShopImage } from '@/components/shared/ShopImage';
import { ImageLightbox } from '@/components/shared/ImageLightbox';
import { cn } from '@/lib/utils';
import { haptic } from '@/lib/uxUtils';

export interface PhotoSliderProps {
  /** Array of photo URLs */
  photos?: (string | null | undefined)[] | null;
  /** Primary cover / single fallback URL */
  imageUrl?: string | null;
  /** Alt text for screen readers */
  alt: string;
  /** Fixed aspect ratio or CSS height class (e.g. '16/9', 'h-44', 'h-56'). Default '16/9' */
  aspectRatio?: string;
  /** Height class if using fixed height instead of aspect ratio (e.g. 'h-44 sm:h-52') */
  heightClass?: string;
  /** Outer container className */
  className?: string;
  /** Image className */
  imageClassName?: string;
  /** Target width for optimized srcset / transforms */
  targetWidth?: number;
  /** Show Next / Prev arrow buttons when > 1 image */
  showArrows?: boolean;
  /** Show bottom pagination dots when > 1 image */
  showDots?: boolean;
  /** Show counter pill (e.g. '1 / 4') when > 1 image */
  showCounter?: boolean;
  /** Show horizontal thumbnail strip below slider */
  showThumbnails?: boolean;
  /** Enable tapping photo to open fullscreen Lightbox with pinch-zoom */
  enableLightbox?: boolean;
  /** Optional custom click handler when photo is tapped */
  onPhotoClick?: (index: number) => void;
  /** Overlay node placed top-left (e.g. live serving pill, badges) */
  overlayTopLeft?: ReactNode;
  /** Overlay node placed top-right (e.g. open/closed status badge) */
  overlayTopRight?: ReactNode;
  /** Overlay node placed bottom-left (e.g. pricing, rent pill) */
  overlayBottomLeft?: ReactNode;
  /** Overlay node placed bottom-right */
  overlayBottomRight?: ReactNode;
  /** Image loading priority */
  priority?: boolean;
}

/**
 * High-performance, touch-swipeable photo slider for entity listings & details.
 * Supports:
 * - Touch swipe left/right on mobile
 * - Accessible floating Next / Previous chevrons
 * - Bottom slide indicator dots
 * - Slide counter badge with camera icon
 * - Thumbnail strip navigation (optional)
 * - Safe event propagation (never accidentally clicks parent cards)
 * - Built-in full-resolution pinch-to-zoom Lightbox on tap
 */
export function PhotoSlider({
  photos,
  imageUrl,
  alt,
  aspectRatio = '16/9',
  heightClass,
  className,
  imageClassName = 'w-full h-full object-cover',
  targetWidth = 600,
  showArrows = true,
  showDots = true,
  showCounter = true,
  showThumbnails = false,
  enableLightbox = true,
  onPhotoClick,
  overlayTopLeft,
  overlayTopRight,
  overlayBottomLeft,
  overlayBottomRight,
  priority = false,
}: PhotoSliderProps) {
  // Normalize & dedupe all valid image URLs
  const candidateImages: string[] = [];
  if (Array.isArray(photos)) {
    for (const p of photos) {
      if (typeof p === 'string' && p.trim()) candidateImages.push(p.trim());
    }
  }
  if (imageUrl && typeof imageUrl === 'string' && imageUrl.trim()) {
    candidateImages.push(imageUrl.trim());
  }

  // Deduplicate while preserving order
  const images = Array.from(new Set(candidateImages));
  const total = images.length;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // Reset index if image set shrinks
  useEffect(() => {
    if (currentIndex >= total && total > 0) {
      setCurrentIndex(total - 1);
    }
  }, [total, currentIndex]);

  // Touch tracking for swipe gestures
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const isSwiping = useRef(false);

  const prev = useCallback((e?: MouseEvent | TouchEvent) => {
    if (e) e.stopPropagation();
    haptic('tap');
    setCurrentIndex((i) => (i - 1 + total) % total);
  }, [total]);

  const next = useCallback((e?: MouseEvent | TouchEvent) => {
    if (e) e.stopPropagation();
    haptic('tap');
    setCurrentIndex((i) => (i + 1) % total);
  }, [total]);

  const goTo = useCallback((index: number, e?: MouseEvent) => {
    if (e) e.stopPropagation();
    haptic('tap');
    setCurrentIndex(index);
  }, []);

  const handleTouchStart = (e: TouchEvent) => {
    if (total <= 1) return;
    const t = e.touches[0];
    touchStartX.current = t.clientX;
    touchStartY.current = t.clientY;
    isSwiping.current = false;
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const t = e.touches[0];
    const dx = t.clientX - touchStartX.current;
    const dy = t.clientY - touchStartY.current;

    // If horizontal motion exceeds vertical, mark as swiping
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
      isSwiping.current = true;
    }
  };

  const handleTouchEnd = (e: TouchEvent) => {
    if (touchStartX.current === null) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartX.current;
    const threshold = 40; // minimum pixels to count as swipe

    if (Math.abs(dx) > threshold) {
      e.stopPropagation();
      if (dx < 0) {
        next();
      } else {
        prev();
      }
    }
    touchStartX.current = null;
    touchStartY.current = null;
    setTimeout(() => {
      isSwiping.current = false;
    }, 50);
  };

  const handleImageClick = (e: MouseEvent) => {
    if (isSwiping.current) return;
    if (onPhotoClick) {
      e.stopPropagation();
      onPhotoClick(currentIndex);
    } else if (enableLightbox) {
      e.stopPropagation();
      setLightboxOpen(true);
    }
  };

  if (total === 0) return null;

  const currentImage = images[currentIndex] || images[0];

  return (
    <div className={cn('relative w-full select-none isolate', className)}>
      {/* Main Slide Stage */}
      <div
        className={cn(
          'relative w-full overflow-hidden bg-muted group',
          heightClass ? heightClass : undefined
        )}
        style={!heightClass && aspectRatio ? { aspectRatio } : undefined}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Active Image */}
        <div
          onClick={handleImageClick}
          className={cn(
            'w-full h-full cursor-pointer relative',
            enableLightbox && 'group-hover:opacity-95 transition-opacity'
          )}
          title={enableLightbox ? 'Click to enlarge photo' : undefined}
        >
          <ShopImage
            src={currentImage}
            alt={`${alt} - photo ${currentIndex + 1} of ${total}`}
            className={imageClassName}
            targetWidth={targetWidth}
            loading={priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : undefined}
          />
        </div>

        {/* Subtle dark gradient overlay for bottom readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30 pointer-events-none" />

        {/* Top Overlay Row (Left + Right/Counter) */}
        {(overlayTopLeft || overlayTopRight || (total > 1 && showCounter)) && (
          <div className="absolute top-2.5 inset-x-2.5 z-10 flex items-start justify-between gap-2 pointer-events-none">
            <div className="min-w-0 pointer-events-auto">
              {overlayTopLeft}
            </div>
            <div className="shrink-0 flex items-center gap-1.5 pointer-events-auto">
              {overlayTopRight}
              {total > 1 && showCounter && (
                <div className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-black/60 text-white backdrop-blur-md border border-white/15 shadow-2xs">
                  <Camera className="w-3 h-3 text-white/80" />
                  <span>
                    {currentIndex + 1}/{total}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Next / Previous Floating Arrow Controls (only if multi-photo) */}
        {total > 1 && showArrows && (
          <>
            <button
              type="button"
              onClick={prev}
              aria-label="Previous photo"
              className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-black/50 hover:bg-black/75 active:scale-90 text-white flex items-center justify-center backdrop-blur-md transition-all shadow-md opacity-90 sm:opacity-0 sm:group-hover:opacity-100"
            >
              <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="Next photo"
              className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-black/50 hover:bg-black/75 active:scale-90 text-white flex items-center justify-center backdrop-blur-md transition-all shadow-md opacity-90 sm:opacity-0 sm:group-hover:opacity-100"
            >
              <ChevronRight className="w-4 h-4 stroke-[2.5]" />
            </button>
          </>
        )}

        {/* Bottom Center Slide Dots — lifted clear of bottom overlays when present */}
        {total > 1 && showDots && (
          <div
            className={cn(
              'absolute left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/45 backdrop-blur-xs pointer-events-auto',
              overlayBottomLeft || overlayBottomRight ? 'bottom-10' : 'bottom-2'
            )}
          >
            {images.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={(e) => goTo(i, e)}
                aria-label={`Jump to photo ${i + 1}`}
                className={cn(
                  'h-1.5 rounded-full transition-all duration-200',
                  i === currentIndex
                    ? 'w-4 bg-white shadow-2xs'
                    : 'w-1.5 bg-white/50 hover:bg-white/80'
                )}
              />
            ))}
          </div>
        )}

        {/* Bottom Overlay Row (Left + Right/Lightbox) */}
        {(overlayBottomLeft || overlayBottomRight || enableLightbox) && (
          <div className="absolute bottom-2.5 inset-x-2.5 z-10 flex items-end justify-between gap-2 pointer-events-none">
            <div className="min-w-0 flex-1 pointer-events-auto">
              {overlayBottomLeft}
            </div>
            <div className="shrink-0 flex items-center gap-1.5 pointer-events-auto">
              {overlayBottomRight}
              {enableLightbox && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLightboxOpen(true);
                  }}
                  title="Full screen view"
                  className="p-1 rounded-full bg-black/50 hover:bg-black/70 text-white/90 backdrop-blur-md text-[10px] sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                >
                  <Maximize2 className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Horizontal Thumbnail Strip (Optional, for detail hero) */}
      {total > 1 && showThumbnails && (
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-2 px-1">
          {images.map((img, i) => (
            <button
              key={i}
              type="button"
              onClick={(e) => goTo(i, e)}
              className={cn(
                'relative shrink-0 w-16 h-12 rounded-lg overflow-hidden border-2 transition-all',
                i === currentIndex
                  ? 'border-primary ring-2 ring-primary/30 scale-102'
                  : 'border-border/70 opacity-70 hover:opacity-100'
              )}
            >
              <img
                src={img}
                alt={`${alt} thumbnail ${i + 1}`}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}

      {/* Lightbox Modal */}
      {lightboxOpen && enableLightbox && (
        <ImageLightbox
          images={images}
          startIndex={currentIndex}
          alt={alt}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </div>
  );
}
