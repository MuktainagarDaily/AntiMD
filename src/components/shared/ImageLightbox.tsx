import { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import { optimizedImage, optimizedSrcSet } from '@/lib/uxUtils';
import { useT } from '@/i18n';

/**
 * Fullscreen image viewer with close button + optional carousel.
 * - Click backdrop or press Esc to close
 * - Arrow keys / on-screen arrows / swipe to navigate when multiple images
 * - Pinch-to-zoom on touch, wheel-to-zoom on desktop, double-tap to toggle zoom
 * - Pan while zoomed; swipe-nav disabled when zoomed
 * - Locks body scroll while open
 */
export function ImageLightbox({
  images,
  startIndex = 0,
  alt,
  onClose,
}: {
  images: string[];
  startIndex?: number;
  alt: string;
  onClose: () => void;
}) {
  const { t } = useT();
  const total = images.length;
  const [index, setIndex] = useState(() => Math.min(Math.max(0, startIndex), Math.max(0, total - 1)));
  const [dragY, setDragY] = useState(0);

  const prev = useCallback(() => setIndex((i) => (i - 1 + total) % total), [total]);
  const next = useCallback(() => setIndex((i) => (i + 1) % total), [total]);

  // Compute backdrop opacity smoothly based on downward drag distance
  const backdropOpacity = Math.max(0.2, 0.95 - (Math.max(0, dragY) / 350) * 0.75);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft' && total > 1) prev();
      else if (e.key === 'ArrowRight' && total > 1) next();
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, prev, next, total]);

  if (total === 0) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${alt} — image viewer`}
      className="fixed inset-0 z-[1000] flex items-center justify-center backdrop-blur-sm transition-colors duration-150 animate-in fade-in duration-200"
      style={{ backgroundColor: `rgba(0, 0, 0, ${backdropOpacity})` }}
      onClick={onClose}
    >
      {/* Visual swipe hint pill at top for mobile users */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 w-10 h-1 rounded-full bg-white/40 pointer-events-none sm:hidden" />

      {/* Counter */}
      {total > 1 && (
        <div className="absolute top-5 left-1/2 -translate-x-1/2 z-20 text-white/85 text-xs font-medium px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm">
          {index + 1} / {total}
        </div>
      )}

      {/* Prev/Next */}
      {total > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); prev(); }}
            aria-label={t('lightbox.prevAria')}
            className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white flex items-center justify-center backdrop-blur-sm transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); next(); }}
            aria-label={t('lightbox.nextAria')}
            className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white flex items-center justify-center backdrop-blur-sm transition-colors"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </>
      )}

      {/* Image stage — fills most of the viewport */}
      <div
        className="relative w-full h-[100dvh] flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <ZoomableImage
          key={images[index]}
          src={images[index]}
          alt={`${alt} (${index + 1} of ${total})`}
          onSwipeLeft={total > 1 ? next : undefined}
          onSwipeRight={total > 1 ? prev : undefined}
          onDragY={setDragY}
          onBackdropTap={onClose}
          onClose={onClose}
        />
      </div>

      {/* Dot indicators */}
      {total > 1 && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex gap-1.5">
          {images.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={(e) => { e.stopPropagation(); setIndex(i); }}
              aria-label={`Go to image ${i + 1}`}
              className={`h-2 rounded-full transition-all ${i === index ? 'w-6 bg-white' : 'w-2 bg-white/40 hover:bg-white/70'}`}
            />
          ))}
        </div>
      )}
    </div>,
    document.body
  );
}

/**
 * Full-size image with pinch-zoom, wheel-zoom, double-tap zoom, and pan.
 * Close (X) sits at the top-right corner of the actual image bounds.
 */
function ZoomableImage({
  src,
  alt,
  onSwipeLeft,
  onSwipeRight,
  onDragY,
  onBackdropTap,
  onClose,
}: {
  src: string;
  alt: string;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onDragY?: (dy: number) => void;
  onBackdropTap: () => void;
  onClose: () => void;
}) {
  const { t } = useT();
  const [loaded, setLoaded] = useState(false);
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [isDismissing, setIsDismissing] = useState(false);

  const imgWrapRef = useRef<HTMLDivElement | null>(null);
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStart = useRef<{ dist: number; scale: number } | null>(null);
  const panStart = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const lastTap = useRef<number>(0);
  const swipeStart = useRef<{ x: number; y: number; t: number } | null>(null);

  const sized = optimizedImage(src, { width: 1920, quality: 88 }) || src;
  const srcSet = optimizedSrcSet(src, 1920, 88);

  const MIN = 1;
  const MAX = 4;

  const clampPan = useCallback((s: number, x: number, y: number) => {
    const el = imgWrapRef.current;
    if (!el) return { x, y };
    const rect = el.getBoundingClientRect();
    const maxX = (rect.width * (s - 1)) / 2;
    const maxY = (rect.height * (s - 1)) / 2;
    return {
      x: Math.max(-maxX, Math.min(maxX, x)),
      y: Math.max(-maxY, Math.min(maxY, y)),
    };
  }, []);

  const reset = useCallback(() => {
    setScale(1);
    setTx(0);
    setTy(0);
  }, []);

  const toggleZoom = useCallback(() => {
    if (scale > 1) reset();
    else setScale(2);
  }, [scale, reset]);

  // Wheel zoom (desktop)
  useEffect(() => {
    const el = imgWrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = -e.deltaY * 0.003;
      setScale((s) => {
        const ns = Math.max(MIN, Math.min(MAX, s + delta * s));
        if (ns === 1) { setTx(0); setTy(0); }
        return ns;
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    const pid = e.pointerId ?? 0;
    (e.target as Element).setPointerCapture?.(pid);
    pointers.current.set(pid, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values());
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      pinchStart.current = { dist, scale };
      panStart.current = null;
      swipeStart.current = null;
    } else {
      if (scale > 1) {
        panStart.current = { x: e.clientX, y: e.clientY, tx, ty };
        swipeStart.current = null;
      } else {
        swipeStart.current = { x: e.clientX, y: e.clientY, t: Date.now() };
        panStart.current = null;
      }
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const pid = e.pointerId ?? 0;
    pointers.current.set(pid, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 2 && pinchStart.current) {
      const [a, b] = Array.from(pointers.current.values());
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const ns = Math.max(MIN, Math.min(MAX, (dist / pinchStart.current.dist) * pinchStart.current.scale));
      setScale(ns);
      if (ns === 1) { setTx(0); setTy(0); }
      else {
        const { x, y } = clampPan(ns, tx, ty);
        setTx(x); setTy(y);
      }
    } else if (panStart.current && scale > 1) {
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      const { x, y } = clampPan(scale, panStart.current.tx + dx, panStart.current.ty + dy);
      setTx(x); setTy(y);
    } else if (swipeStart.current && scale <= 1) {
      const dx = e.clientX - swipeStart.current.x;
      const dy = e.clientY - swipeStart.current.y;
      // Downward pull gesture to dismiss
      if (dy > 8 && dy > Math.abs(dx)) {
        setTy(dy);
        const pullScale = Math.max(0.82, 1 - (dy / 1400));
        setScale(pullScale);
        onDragY?.(dy);
      }
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const pid = e.pointerId ?? 0;
    pointers.current.delete(pid);
    if (pointers.current.size < 2) pinchStart.current = null;
    if (pointers.current.size === 0) panStart.current = null;

    // Check if user was dragging down to dismiss
    if (swipeStart.current && scale <= 1 && ty > 0) {
      const dy = e.clientY - swipeStart.current.y;
      const dt = Date.now() - swipeStart.current.t;
      const velocity = dt > 0 ? dy / dt : 0;
      if (dy >= 80 || (dy > 30 && velocity >= 0.35)) {
        setIsDismissing(true);
        setTy(window.innerHeight * 1.2);
        onDragY?.(window.innerHeight);
        window.setTimeout(() => {
          onClose();
        }, 160);
        swipeStart.current = null;
        return;
      } else {
        // Snap back
        setTy(0);
        setScale(1);
        onDragY?.(0);
      }
    }

    // Swipe nav (only when not zoomed and not pulling down)
    if (swipeStart.current && scale === 1 && ty === 0) {
      const dx = e.clientX - swipeStart.current.x;
      const dy = e.clientY - swipeStart.current.y;
      const dt = Date.now() - swipeStart.current.t;
      if (dt < 500 && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        if (dx < 0) onSwipeLeft?.(); else onSwipeRight?.();
      } else if (dt < 300 && Math.abs(dx) < 8 && Math.abs(dy) < 8) {
        // Tap / double-tap
        const now = Date.now();
        if (now - lastTap.current < 300) {
          toggleZoom();
          lastTap.current = 0;
        } else {
          lastTap.current = now;
        }
      }
    }
    swipeStart.current = null;
  };

  return (
    <div className="relative w-full h-full flex items-center justify-center select-none">
      <div
        ref={imgWrapRef}
        className="relative max-w-[100vw] max-h-[100dvh] w-auto h-auto flex items-center justify-center touch-none overflow-hidden"
        style={{ width: '100vw', height: '100dvh' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={(e) => { e.stopPropagation(); toggleZoom(); }}
      >
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-10 h-10 rounded-full border-2 border-white/30 border-t-white animate-spin" />
          </div>
        )}
        <img
          src={sized}
          srcSet={srcSet}
          alt={alt}
          draggable={false}
          decoding="async"
          // @ts-ignore
          fetchpriority="high"
          className="max-w-[100vw] max-h-[100dvh] w-auto h-auto object-contain mx-auto"
          style={{
            opacity: loaded ? 1 : 0,
            transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
            transition: pointers.current.size === 0 ? 'transform 180ms ease-out, opacity 200ms' : 'none',
            transformOrigin: 'center center',
            cursor: scale > 1 ? 'grab' : 'zoom-in',
          }}
          onLoad={() => setLoaded(true)}
        />

        {/* Close — anchored to top-right of the image stage */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          aria-label={t('lightbox.closeAria')}
          className="absolute top-3 right-3 sm:top-4 sm:right-4 z-30 w-11 h-11 rounded-full bg-black/60 hover:bg-black/80 active:scale-95 text-white flex items-center justify-center backdrop-blur-sm transition-colors shadow-lg ring-1 ring-white/20"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Zoom controls */}
        <div className="absolute bottom-20 right-3 sm:right-4 z-30 flex flex-col gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setScale((s) => {
                const ns = Math.min(MAX, s + 0.5);
                return ns;
              });
            }}
            aria-label={t('lightbox.zoomInAria')}
            className="w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-sm ring-1 ring-white/20"
          >
            <ZoomIn className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setScale((s) => {
                const ns = Math.max(MIN, s - 0.5);
                if (ns === 1) { setTx(0); setTy(0); }
                return ns;
              });
            }}
            aria-label={t('lightbox.zoomOutAria')}
            className="w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-sm ring-1 ring-white/20"
          >
            <ZoomOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
