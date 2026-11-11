import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft } from 'lucide-react';
import { useSmartBack } from '@/hooks/useSmartBack';
import { haptic } from '@/lib/uxUtils';

export interface UseEdgeSwipeBackOptions {
  /** Optional custom back handler */
  onBack?: () => void;
  /** Fallback route if browser in-app history is empty */
  fallbackPath?: string;
  /** Maximum px from left edge to initiate edge swipe (default: 28) */
  edgeZonePx?: number;
  /** Minimum drag px to trigger navigation (default: 65) */
  thresholdPx?: number;
  /** Whether the gesture is enabled (default: true) */
  enabled?: boolean;
}

/**
 * useEdgeSwipeBack
 * Native-style mobile edge swipe-to-go-back gesture.
 * When the user swipes rightwards starting from the left edge (<=28px),
 * an edge indicator slides in and triggers back navigation upon release.
 */
export function useEdgeSwipeBack({
  onBack,
  fallbackPath = '/',
  edgeZonePx = 28,
  thresholdPx = 65,
  enabled = true,
}: UseEdgeSwipeBackOptions = {}) {
  const smartBack = useSmartBack();
  const [swipeDistance, setSwipeDistance] = useState(0);
  const [currentY, setCurrentY] = useState(0);
  const isTrackingRef = useRef(false);
  const canSwipeRef = useRef(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const startTimeRef = useRef(0);

  const handleNavigateBack = useCallback(() => {
    try {
      haptic('light');
    } catch {
      // Ignore if haptic not supported
    }
    if (onBack) {
      onBack();
    } else {
      smartBack(fallbackPath);
    }
  }, [onBack, smartBack, fallbackPath]);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      // Only initiate if touch starts close to the left edge
      if (touch.clientX > edgeZonePx) {
        canSwipeRef.current = false;
        return;
      }
      startXRef.current = touch.clientX;
      startYRef.current = touch.clientY;
      startTimeRef.current = Date.now();
      canSwipeRef.current = true;
      isTrackingRef.current = false;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!canSwipeRef.current || e.touches.length !== 1) return;
      const touch = e.touches[0];
      const deltaX = touch.clientX - startXRef.current;
      const deltaY = touch.clientY - startYRef.current;

      // Determine intent: must be predominantly horizontal rightward drag
      if (!isTrackingRef.current) {
        if (deltaX > 8 && deltaX > Math.abs(deltaY) * 1.5) {
          isTrackingRef.current = true;
        } else if (Math.abs(deltaY) > 8) {
          // User is scrolling vertically, abort edge swipe
          canSwipeRef.current = false;
          return;
        }
      }

      if (isTrackingRef.current && deltaX > 0) {
        setSwipeDistance(deltaX);
        setCurrentY(touch.clientY);
        // Prevent accidental page gestures
        if (e.cancelable && deltaX > 15) {
          e.preventDefault();
        }
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!isTrackingRef.current) {
        canSwipeRef.current = false;
        setSwipeDistance(0);
        return;
      }

      const touch = e.changedTouches[0];
      const deltaX = touch ? touch.clientX - startXRef.current : 0;
      const elapsed = Date.now() - startTimeRef.current;
      const velocity = elapsed > 0 ? deltaX / elapsed : 0;

      if (deltaX >= thresholdPx || (deltaX > 30 && velocity >= 0.35)) {
        handleNavigateBack();
      }

      isTrackingRef.current = false;
      canSwipeRef.current = false;
      setSwipeDistance(0);
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('touchcancel', onTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [enabled, edgeZonePx, thresholdPx, handleNavigateBack]);

  // Render floating edge indicator into body when active
  const indicatorNode =
    swipeDistance > 8 && typeof document !== 'undefined'
      ? createPortal(
          <div
            role="presentation"
            aria-hidden="true"
            data-testid="edge-swipe-indicator"
            className="fixed left-0 z-[9999] pointer-events-none flex items-center justify-center transition-transform"
            style={{
              top: `${Math.max(60, Math.min(window.innerHeight - 90, currentY - 24))}px`,
              transform: `translate3d(${Math.min(swipeDistance * 0.65, 48)}px, 0, 0)`,
              opacity: Math.min(1, swipeDistance / 30),
            }}
          >
            <div
              className={`flex items-center justify-center w-11 h-11 rounded-r-2xl shadow-xl border border-l-0 transition-all ${
                swipeDistance >= thresholdPx
                  ? 'bg-primary text-primary-foreground border-primary scale-110'
                  : 'bg-card/95 text-foreground border-border/80 backdrop-blur-md'
              }`}
            >
              <ChevronLeft className="w-5 h-5 -ml-1 transition-transform" />
            </div>
          </div>,
          document.body
        )
      : null;

  return {
    isSwiping: swipeDistance > 8,
    swipeDistance,
    indicatorNode,
  };
}
