import { useEffect, useRef } from 'react';
import { Banner } from '@/lib/banners/types';
import { trackView, trackClick } from '@/lib/banners/store';
import { useT } from '@/i18n';
import { isSafeHttpUrl } from '@/lib/utils';
import { optimizedImage, optimizedSrcSet } from '@/lib/uxUtils';

interface Props { banner: Banner; }

/** Compact, mobile-first inline banner.
 *  The `Sponsored` pill is mandatory — it is the visual contract that this
 *  surface is paid placement and NOT part of the curated directory. Do not
 *  remove it without product approval. */
export function InlineBanner({ banner }: Props) {
  const ref = useRef<HTMLAnchorElement>(null);
  const { t } = useT();

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      trackView(banner.id);
      return;
    }
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          trackView(banner.id);
          io.disconnect();
          break;
        }
      }
    }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, [banner.id]);

  // Defence-in-depth: even though BannerModal validates target_url on save
  // and a DB CHECK constraint enforces http(s)://, refuse to render any URL
  // that isn't safely http/https so a compromised admin row cannot ship
  // `javascript:` / `data:` XSS to every public visitor.
  const safeHref = isSafeHttpUrl(banner.target_url) ? banner.target_url : '#';
  const sized = optimizedImage(banner.image_url, { width: 800 }) || banner.image_url;
  const srcSet = optimizedSrcSet(banner.image_url, 800);

  return (
    <a
      ref={ref}
      href={safeHref}
      target="_blank"
      rel="noopener noreferrer sponsored"
      aria-label={`${t('banner.sponsored')}: ${banner.title}`}
      onClick={(e) => { if (safeHref === '#') e.preventDefault(); trackClick(banner.id); }}
      className="block relative w-full overflow-hidden rounded-2xl border border-dashed border-border/80 shadow-sm hover:shadow-md transition-shadow group aspect-[16/9] sm:aspect-[3/1]"
    >
      <img
        src={sized}
        srcSet={srcSet}
        alt={banner.title}
        loading="lazy"
        decoding="async"
        className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
      />
      {/* Visible to users: clear "Sponsored" label distinguishes paid ads
          from curated directory listings. */}
      <span
        title={t('banner.sponsoredFull')}
        className="absolute top-1.5 left-1.5 z-10 text-[9px] sm:text-[10px] font-bold tracking-wide uppercase px-1.5 sm:px-2 py-px sm:py-0.5 rounded-md bg-background/85 text-foreground backdrop-blur-sm border border-border/60"
      >
        {t('banner.sponsored')}
      </span>
    </a>
  );
}

