/**
 * Tiny UX helpers — haptic feedback + image transforms.
 *
 * Non-technical summary:
 *  - haptic(): a barely-noticeable phone buzz when users tap important buttons
 *    (Call, WhatsApp, filter chips). No-op on desktop and on browsers that
 *    don't support vibration.
 *  - imageThumb(): asks Supabase Storage to deliver a tiny, blurred preview
 *    of a shop image so the card has something to show while the full
 *    picture downloads.
 */

const VIBRATION_OK =
  typeof navigator !== 'undefined' &&
  typeof navigator.vibrate === 'function';

/**
 * Fire a short haptic pulse. Safe to call anywhere — it silently no-ops if
 * the device doesn't support vibration or the user has disabled it.
 *
 * Variants:
 *  - 'tap'    →  6ms  (filter chip toggle, small actions)
 *  - 'press'  → 10ms  (Call/WhatsApp/Maps tap)
 *  - 'success'→ [10,40,10] (after a confirm action — e.g. submit succeeded)
 */
export function haptic(kind: 'tap' | 'press' | 'success' | 'light' = 'tap'): void {
  if (!VIBRATION_OK) return;
  try {
    if (kind === 'tap' || kind === 'light') navigator.vibrate(6);
    else if (kind === 'press') navigator.vibrate(10);
    else navigator.vibrate([10, 40, 10]);
  } catch {
    /* never block the user action */
  }
}

/** Standard width tiers to prevent cache fragmentation and transformation quota exhaustion */
const STANDARD_IMAGE_WIDTHS = [32, 64, 96, 160, 200, 400, 600, 800, 1200, 1600];

function clampToStandardWidth(target: number): number {
  if (target <= 0) return 400;
  for (const w of STANDARD_IMAGE_WIDTHS) {
    if (w >= target) return w;
  }
  return 1600;
}

/**
 * Build a Supabase image-transform URL.
 *
 * Supabase's `/render/image/public/` endpoint resizes on the edge and
 * returns a small, well-compressed JPEG/WebP with a long
 * `Cache-Control: max-age=31536000` header — so once a sized URL has
 * been fetched it is reused from the browser's HTTP cache forever.
 *
 * Returns the original URL untouched for non-Supabase images so external
 * /CDN URLs keep working.
 */
export function optimizedImage(
  url: string | null | undefined,
  opts: { width: number; quality?: number; resize?: 'cover' | 'contain' | 'fill' } = { width: 400 },
): string | null {
  if (!url) return null;
  if (!url.includes('/storage/v1/object/public/')) return url;
  const transformed = url.replace(
    '/storage/v1/object/public/',
    '/storage/v1/render/image/public/',
  );
  const sep = transformed.includes('?') ? '&' : '?';
  const safeWidth = clampToStandardWidth(opts.width);
  const q = Math.min(85, Math.max(30, opts.quality ?? 70));
  const r = opts.resize === 'contain' || opts.resize === 'fill' ? opts.resize : 'cover';
  return `${transformed}${sep}width=${safeWidth}&quality=${q}&resize=${r}`;
}

/**
 * Build a `srcSet` string for retina/high-DPR screens. We request 1x and
 * 2x widths and let the browser pick. Both versions are cached
 * independently and never re-downloaded after first paint.
 */
export function optimizedSrcSet(
  url: string | null | undefined,
  baseWidth: number,
  quality = 70,
): string | undefined {
  const a = optimizedImage(url, { width: baseWidth, quality });
  const b = optimizedImage(url, { width: baseWidth * 2, quality });
  if (!a || !b || a === url) return undefined; // skip srcset for non-Supabase URLs
  return `${a} 1x, ${b} 2x`;
}

/**
 * Tiny low-quality placeholder (~1 KB) — used for the blur-up effect.
 * Kept for backwards compatibility with `ShopImage`.
 */
export function imageThumb(url: string | null | undefined, width = 32): string | null {
  return optimizedImage(url, { width, quality: 30 });
}

