/**
 * Verify that an image URL is actually loadable from the browser.
 *
 * Strategy (in order, stops at first conclusive result):
 *   1. HEAD request — cheap, works for same-origin and CORS-friendly hosts.
 *      • 2xx              → OK
 *      • 405 Method Not Allowed → fall through to GET range probe
 *      • 4xx / 5xx        → BROKEN
 *      • network error    → fall through (could be CORS, not "broken")
 *   2. GET with `Range: bytes=0-0` — many CDNs reject HEAD but allow
 *      partial GETs. 200/206 → OK, 4xx/5xx → BROKEN, error → fall through.
 *   3. <img> probe with timeout — the only check that bypasses CORS
 *      entirely. The browser will decode the bytes whether or not the
 *      server sends `Access-Control-Allow-Origin`, so this is the
 *      ground truth: if `img.onerror` fires (or the timeout elapses),
 *      the URL really is broken/unreachable; `img.onload` proves it is
 *      a real, viewable image.
 *
 * This eliminates the previous false-positive where a CORS-blocked HEAD
 * was silently treated as success and a fake URL slipped through.
 */
export type VerifyResult = 'ok' | 'broken';

const IMG_PROBE_TIMEOUT_MS = 6000;

async function probeWithImage(url: string): Promise<VerifyResult> {
  return new Promise<VerifyResult>((resolve) => {
    if (typeof window === 'undefined') {
      resolve('broken');
      return;
    }
    const img = new Image();
    let settled = false;
    const done = (r: VerifyResult) => {
      if (settled) return;
      settled = true;
      img.onload = null;
      img.onerror = null;
      clearTimeout(timer);
      resolve(r);
    };
    const timer = window.setTimeout(() => done('broken'), IMG_PROBE_TIMEOUT_MS);
    img.onload = () => {
      // 0×0 means the response decoded to nothing — treat as broken.
      if ((img.naturalWidth || 0) === 0 && (img.naturalHeight || 0) === 0) {
        done('broken');
      } else {
        done('ok');
      }
    };
    img.onerror = () => done('broken');
    // Cache-bust so the browser doesn't return a stale negative cache entry.
    const sep = url.includes('?') ? '&' : '?';
    img.src = `${url}${sep}_iv=${Date.now()}`;
  });
}

export async function verifyImageUrl(url: string): Promise<VerifyResult> {
  if (!url || typeof url !== 'string') return 'broken';

  // 1) HEAD
  try {
    const res = await fetch(url, { method: 'HEAD', cache: 'no-store' });
    if (res.ok) return 'ok';
    if (res.status !== 405 && res.status >= 400 && res.status < 600) {
      // Definitive server "no" (404, 410, 403, 5xx) — image is broken.
      return 'broken';
    }
    // 405 → try GET range
  } catch {
    // Network/CORS error — inconclusive, fall through to <img> probe.
  }

  // 2) GET range
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Range: 'bytes=0-0' },
      cache: 'no-store',
    });
    if (res.ok || res.status === 206) return 'ok';
    if (res.status >= 400 && res.status < 600) return 'broken';
  } catch {
    // still inconclusive — fall through to <img> probe.
  }

  // 3) <img> probe — bypasses CORS entirely.
  return probeWithImage(url);
}