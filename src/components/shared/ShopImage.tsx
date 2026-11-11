import { useState, useEffect } from 'react';
import { imageThumb, optimizedImage, optimizedSrcSet } from '@/lib/uxUtils';

/**
 * Shared shop image component with progressive blur-up loading +
 * size-appropriate fetching from Supabase's image transform endpoint.
 *
 * Why this is fast:
 *  - Requests an image sized for the slot (e.g. 200px / 400px / 800px),
 *    not the original (which can be 2-5 MB). 5-20× smaller payload.
 *  - Uses `srcSet` so retina screens get a 2x asset and 1x screens stay
 *    light — both versions are cached independently.
 *  - Supabase's `/render/image/` endpoint returns
 *    `Cache-Control: max-age=31536000`, so the same sized URL is served
 *    from the browser HTTP cache on every later visit (no re-download).
 *  - A ~1 KB blurred thumbnail paints instantly while the real image
 *    streams in.
 *
 * Caller passes `targetWidth` (in CSS pixels) for the slot the image will
 * occupy — e.g. 200 for compact cards, 400 for list cards, 800 for the
 * detail hero.
 */
export function ShopImage({
  src,
  alt,
  className = 'w-full h-full object-cover',
  targetWidth = 400,
  quality = 70,
  thumbWidth = 32,
  onError,
  loading = 'lazy',
  fetchPriority,
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  targetWidth?: number;
  quality?: number;
  thumbWidth?: number;
  onError?: () => void;
  loading?: 'eager' | 'lazy';
  fetchPriority?: 'high' | 'low' | 'auto';
}) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const [fallbackToOriginal, setFallbackToOriginal] = useState(false);

  useEffect(() => {
    setLoaded(false);
    setErrored(false);
    setFallbackToOriginal(false);
  }, [src]);

  if (!src || errored) return null;

  const thumb = !fallbackToOriginal ? imageThumb(src, thumbWidth) : null;
  const sized = !fallbackToOriginal
    ? optimizedImage(src, { width: targetWidth, quality }) || src
    : src;
  const srcSet = !fallbackToOriginal ? optimizedSrcSet(src, targetWidth, quality) : undefined;

  return (
    <>
      {/* Low-quality blurred placeholder — fades out once the real image loads */}
      {thumb && thumb !== sized && !loaded && (
        <img
          src={thumb}
          alt=""
          aria-hidden="true"
          className={`${className} absolute inset-0 scale-110 blur-md transition-opacity duration-300`}
          style={{ opacity: loaded ? 0 : 1 }}
        />
      )}
      <img
        src={sized}
        srcSet={srcSet}
        alt={alt}
        loading={loading}
        decoding="async"
        // @ts-ignore — fetchpriority is a valid HTML attr but typed only in newer React
        fetchpriority={fetchPriority}
        className={`${className} transition-opacity duration-300`}
        style={{ opacity: loaded ? 1 : 0 }}
        onLoad={() => setLoaded(true)}
        onError={() => {
          if (!fallbackToOriginal && sized !== src) {
            // If the transform endpoint failed, try the raw storage URL before giving up
            setFallbackToOriginal(true);
          } else {
            setErrored(true);
            onError?.();
          }
        }}
      />
    </>
  );
}
