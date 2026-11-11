import { useRef, useCallback, useEffect, useState } from 'react';

export interface UseSwipeDownToCloseOptions {
  isOpen: boolean;
  onClose: () => void;
  beforeClose?: () => boolean | Promise<boolean>;
  threshold?: number;          // Minimum downward distance in px to trigger close (default: 70)
  velocityThreshold?: number;  // Minimum flick velocity in px/ms to trigger close (default: 0.35)
}

/**
 * useSwipeDownToClose
 * Provides a native-like swipe-down gesture to dismiss bottom sheet drawers on mobile devices.
 * 
 * - Allows swiping down from anywhere on the drawer surface.
 * - Detects if content is scrolled down (`scrollTop > 0`); only engages when scrolled to top.
 * - Smoothly translates the drawer following the user's finger in real-time.
 * - Enforces minimum distance / velocity thresholds to differentiate scroll vs swipe-to-close.
 * - Supports an optional `beforeClose` guard (e.g. for confirming discard of unsaved form edits).
 */
export function useSwipeDownToClose({
  isOpen,
  onClose,
  beforeClose,
  threshold = 70,
  velocityThreshold = 0.35,
}: UseSwipeDownToCloseOptions) {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const startYRef = useRef(0);
  const startXRef = useRef(0);
  const startTimeRef = useRef(0);
  const isDraggingRef = useRef(false);
  const canSwipeRef = useRef(false);
  const currentDeltaYRef = useRef(0);
  const [isPulling, setIsPulling] = useState(false);

  // Clean up any remaining transforms when drawer opens or closes
  useEffect(() => {
    if (elementRef.current) {
      elementRef.current.style.transform = '';
      elementRef.current.style.transition = '';
    }
    isDraggingRef.current = false;
    currentDeltaYRef.current = 0;
    setIsPulling(false);
  }, [isOpen]);

  // Find scrollable ancestor between touch target and drawer root
  const findScrollParent = (target: EventTarget | null): HTMLElement | null => {
    let node = target as HTMLElement | null;
    while (node && node !== elementRef.current && node !== document.body) {
      const style = window.getComputedStyle(node);
      const overflowY = style.overflowY;
      if (
        (overflowY === 'auto' || overflowY === 'scroll') &&
        node.scrollHeight > node.clientHeight
      ) {
        return node;
      }
      node = node.parentElement;
    }
    return null;
  };

  useEffect(() => {
    const el = elementRef.current;
    if (!el || !isOpen) return;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      startYRef.current = touch.clientY;
      startXRef.current = touch.clientX;
      startTimeRef.current = Date.now();
      isDraggingRef.current = false;
      currentDeltaYRef.current = 0;

      // Only allow downward swipe if the touched scroll container is at the top
      const scrollParent = findScrollParent(e.target);
      if (scrollParent && scrollParent.scrollTop > 5) {
        canSwipeRef.current = false;
      } else {
        canSwipeRef.current = true;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!canSwipeRef.current || e.touches.length !== 1) return;
      const touch = e.touches[0];
      const deltaY = touch.clientY - startYRef.current;
      const deltaX = touch.clientX - startXRef.current;

      // Check if user scrolled down inside content while touching
      const scrollParent = findScrollParent(e.target);
      if (scrollParent && scrollParent.scrollTop > 5) {
        canSwipeRef.current = false;
        if (isDraggingRef.current && el) {
          el.style.transition = 'transform 0.2s ease-out';
          el.style.transform = '';
          isDraggingRef.current = false;
          setIsPulling(false);
        }
        return;
      }

      // Engage swipe gesture if moving downwards and primarily vertical
      if (deltaY > 8 && Math.abs(deltaY) > Math.abs(deltaX)) {
        isDraggingRef.current = true;
        setIsPulling(true);
        currentDeltaYRef.current = deltaY;

        // Apply slight resistance when pulled beyond 200px
        const displayY = deltaY > 200 ? 200 + (deltaY - 200) * 0.45 : deltaY;
        el.style.transition = 'none';
        el.style.transform = `translate3d(0, ${displayY}px, 0)`;

        // Prevent native page pull-to-refresh
        if (e.cancelable) {
          e.preventDefault();
        }
      }
    };

    const onTouchEnd = async () => {
      if (!isDraggingRef.current) {
        setIsPulling(false);
        return;
      }

      const deltaY = currentDeltaYRef.current;
      const elapsed = Date.now() - startTimeRef.current;
      const velocity = elapsed > 0 ? deltaY / elapsed : 0;
      const shouldClose = deltaY >= threshold || (deltaY > 25 && velocity >= velocityThreshold);

      if (shouldClose) {
        // Evaluate beforeClose guard if provided
        if (beforeClose) {
          const canClose = await beforeClose();
          if (!canClose) {
            // User cancelled confirmation (snap back to original position)
            el.style.transition = 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)';
            el.style.transform = 'translate3d(0, 0, 0)';
            setTimeout(() => {
              if (el) {
                el.style.transform = '';
                el.style.transition = '';
              }
            }, 250);
            isDraggingRef.current = false;
            setIsPulling(false);
            return;
          }
        }

        // Animate off-screen downwards and close
        el.style.transition = 'transform 0.2s cubic-bezier(0.32, 0.72, 0, 1)';
        el.style.transform = 'translate3d(0, 100%, 0)';
        setTimeout(() => {
          onClose();
          if (el) {
            el.style.transform = '';
            el.style.transition = '';
          }
        }, 180);
      } else {
        // Snap back to normal position if threshold wasn't reached
        el.style.transition = 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)';
        el.style.transform = 'translate3d(0, 0, 0)';
        setTimeout(() => {
          if (el) {
            el.style.transform = '';
            el.style.transition = '';
          }
        }, 250);
      }

      isDraggingRef.current = false;
      setIsPulling(false);
    };

    const onTouchCancel = () => {
      if (el) {
        el.style.transition = 'transform 0.2s ease-out';
        el.style.transform = '';
      }
      isDraggingRef.current = false;
      setIsPulling(false);
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchCancel, { passive: true });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchCancel);
    };
  }, [isOpen, threshold, velocityThreshold, beforeClose, onClose]);

  return {
    ref: elementRef,
    isPulling,
  };
}
