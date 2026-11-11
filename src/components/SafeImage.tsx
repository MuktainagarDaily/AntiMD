import { useState, useEffect } from 'react';
import { ImageOff } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Renders <img> with a graceful fallback. If `src` is empty/null/whitespace
 * OR the browser fails to load it (404, dead URL, CORS-blocked decode),
 * we render a neutral placeholder instead of the browser's broken-image
 * icon. Use this anywhere a shop image_url might be stale.
 */
export function SafeImage({
  src,
  alt,
  className,
  imgClassName,
  fallbackClassName,
  loading = 'lazy',
}: {
  src?: string | null;
  alt: string;
  className?: string;
  imgClassName?: string;
  fallbackClassName?: string;
  loading?: 'lazy' | 'eager';
}) {
  const [errored, setErrored] = useState(false);
  const clean = typeof src === 'string' ? src.trim() : '';
  const showFallback = !clean || errored;

  useEffect(() => {
    setErrored(false);
  }, [clean]);

  return (
    <div
      className={cn(
        'flex items-center justify-center overflow-hidden bg-muted',
        className,
      )}
    >
      {showFallback ? (
        <div
          className={cn(
            'flex items-center justify-center w-full h-full text-muted-foreground',
            fallbackClassName,
          )}
          aria-label={`${alt} (no image)`}
        >
          <ImageOff className="w-5 h-5" />
        </div>
      ) : (
        <img
          src={clean}
          alt={alt}
          loading={loading}
          decoding="async"
          onError={() => setErrored(true)}
          className={cn('w-full h-full object-cover', imgClassName)}
        />
      )}
    </div>
  );
}