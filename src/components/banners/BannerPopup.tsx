import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useT } from '@/i18n';
import { isSafeHttpUrl } from '@/lib/utils';
import { useBannersForPlacement } from '@/hooks/useBanners';
import { optimizedImage, optimizedSrcSet } from '@/lib/uxUtils';
import {
  markPopupSeen,
  markPopupShownThisSession,
  trackClick,
  trackView,
  wasPopupSeenToday,
  wasPopupShownThisSession,
} from '@/lib/banners/store';

// Gating constants
const MIN_DELAY_MS = 20_000; // 20s minimum dwell time
const SCROLL_DEPTH = 0.3;    // 30% of document height OR
const SCROLL_PX = 600;       // 600px scrolled, whichever first

/**
 * Full-screen popup banner. Gated so it never punches a first-time user
 * in the face: requires ALL of
 *   1. Banner not already seen today (per device)
 *   2. Banner not already shown in this tab session
 *   3. At least 20s elapsed on the page
 *   4. User has scrolled past 30% of document OR 600px
 * Admin-configured `popup_delay_seconds` only widens the delay (never shrinks
 * below 20s). X is disabled until `close_enable_seconds` countdown reaches 0.
 */
export function BannerPopup() {
  const { t } = useT();
  const banners = useBannersForPlacement('popup');
  const banner = banners[0];


  const [open, setOpen] = useState(false);
  const [remaining, setRemaining] = useState(0);

  // Decide whether & when to open — requires time + scroll-depth both satisfied.
  useEffect(() => {
    if (!banner) return;
    if (wasPopupSeenToday(banner.id)) return;
    if (wasPopupShownThisSession(banner.id)) return;

    const mountedAt = Date.now();
    const minDelay = Math.max(MIN_DELAY_MS, (banner.popup_delay_seconds || 0) * 1000);
    let scrolledEnough = false;
    let cancelled = false;

    const show = () => {
      if (cancelled) return;
      cancelled = true;
      cleanup();
      markPopupShownThisSession(banner.id);
      setOpen(true);
      setRemaining(Math.max(0, banner.close_enable_seconds || 0));
      trackView(banner.id);
    };

    const tryShow = () => {
      if (cancelled) return;
      if (Date.now() - mountedAt < minDelay) return;
      if (!scrolledEnough) return;
      show();
    };

    const onScroll = () => {
      const doc = document.documentElement;
      const max = Math.max(doc.scrollHeight - window.innerHeight, 1);
      const y = window.scrollY || doc.scrollTop || 0;
      if (y >= SCROLL_PX || y / max >= SCROLL_DEPTH) {
        scrolledEnough = true;
        window.removeEventListener('scroll', onScroll);
        tryShow();
      }
    };

    const timer = window.setTimeout(tryShow, minDelay);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll(); // in case page is already scrolled

    function cleanup() {
      window.clearTimeout(timer);
      window.removeEventListener('scroll', onScroll);
    }

    return () => { cancelled = true; cleanup(); };
  }, [banner?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Countdown for close button
  useEffect(() => {
    if (!open || remaining <= 0) return;
    const t = window.setInterval(() => {
      setRemaining((r) => (r <= 1 ? 0 : r - 1));
    }, 1000);
    return () => window.clearInterval(t);
  }, [open, remaining]);

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!banner || !open) return null;

  const canClose = remaining <= 0;

  const handleClose = () => {
    if (!canClose) return;
    markPopupSeen(banner.id);
    setOpen(false);
  };

  const handleVisit = () => {
    trackClick(banner.id);
    markPopupSeen(banner.id);
    // Defence-in-depth: never open non-http(s) URLs — blocks stored
    // `javascript:` / `data:` XSS if a bad row ever reaches the client.
    if (isSafeHttpUrl(banner.target_url)) {
      window.open(banner.target_url, '_blank', 'noopener,noreferrer');
    }
    setOpen(false);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={banner.title}
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => { if (canClose && e.target === e.currentTarget) handleClose(); }}
    >
      <div className="relative w-full max-w-sm max-h-[90dvh] rounded-3xl overflow-hidden bg-card shadow-2xl flex flex-col">
        {/* Close button */}
        <button
          type="button"
          onClick={handleClose}
          disabled={!canClose}
          aria-label={canClose ? 'Close advertisement' : `Close available in ${remaining}s`}
          className={`absolute top-2.5 right-2.5 z-10 inline-flex items-center justify-center rounded-full text-white transition shadow-md ${
            canClose
              ? 'w-10 h-10 bg-black/70 hover:bg-black/85 active:scale-95 cursor-pointer'
              : 'h-8 min-w-[40px] px-2.5 bg-black/65 cursor-not-allowed text-[11px] font-bold gap-1'
          }`}
        >
          {canClose ? <X className="w-5 h-5" /> : <><X className="w-3 h-3 opacity-70" /> {remaining}s</>}
        </button>

        {/* Image — clickable */}
        <button
          type="button"
          onClick={handleVisit}
          className="block w-full overflow-hidden bg-muted aspect-[3/4] sm:aspect-[4/5] max-h-[62dvh]"
        >
          <img
            src={optimizedImage(banner.image_url, { width: 600 }) || banner.image_url}
            srcSet={optimizedSrcSet(banner.image_url, 600)}
            alt={banner.title}
            width={384}
            height={512}
            decoding="async"
            className="w-full h-full object-cover"
          />
        </button>

        {/* Footer CTA */}
        <div className="mt-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))] flex items-center gap-3 border-t border-border/50 bg-card">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{banner.title}</p>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{t('banner.sponsored')}</p>
          </div>
          <button
            type="button"
            onClick={handleVisit}
            className="shrink-0 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-bold active:scale-95 transition"
          >
            {t('banner.visit')}
          </button>
        </div>
      </div>
    </div>
  );
}