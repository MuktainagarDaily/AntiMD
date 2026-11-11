/**
 * Lightweight client-side rate limiting / throttling helpers.
 *
 * These guards exist purely to protect the UI from accidental rapid-fire
 * actions (impatient double-taps, keyboard repeat on the language pill,
 * runaway scripts). They are NOT a security boundary — server-side RLS
 * and SQL triggers remain the source of truth.
 *
 * Usage:
 *   import { checkCooldown, throttle, debounce } from '@/lib/rateLimit';
 *
 *   if (!checkCooldown('lang-switch', 500)) {
 *     toast.error(t('rate.tooFast'));
 *     return;
 *   }
 */

const lastFired = new Map<string, number>();

/**
 * Returns true if the action keyed by `key` is allowed right now (i.e. at
 * least `cooldownMs` has elapsed since the previous allowed call). When it
 * returns true it also records "now" as the most recent fire time.
 */
export function checkCooldown(key: string, cooldownMs: number): boolean {
  const now = Date.now();
  const prev = lastFired.get(key) ?? 0;
  if (now - prev < cooldownMs) return false;
  lastFired.set(key, now);
  return true;
}

/** Milliseconds until the next allowed call (0 if allowed now). */
export function cooldownRemaining(key: string, cooldownMs: number): number {
  const prev = lastFired.get(key) ?? 0;
  return Math.max(0, cooldownMs - (Date.now() - prev));
}

/** Forget a key's history (useful after a user-visible reset, e.g. modal close). */
export function resetCooldown(key: string): void {
  lastFired.delete(key);
}

/**
 * Classic trailing-edge debounce — fires `fn` once after the user stops
 * calling it for `waitMs`. Good for search-as-you-type and similar.
 */
export function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  waitMs: number,
): ((...args: A) => void) & { cancel: () => void } {
  let t: ReturnType<typeof setTimeout> | null = null;
  const wrapped = (...args: A) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => { t = null; fn(...args); }, waitMs);
  };
  wrapped.cancel = () => { if (t) { clearTimeout(t); t = null; } };
  return wrapped;
}

/**
 * Leading-edge throttle — fires `fn` immediately, then ignores further
 * calls until `waitMs` has elapsed. Good for button mash protection.
 */
export function throttle<A extends unknown[]>(
  fn: (...args: A) => void,
  waitMs: number,
): (...args: A) => void {
  let last = 0;
  return (...args: A) => {
    const now = Date.now();
    if (now - last < waitMs) return;
    last = now;
    fn(...args);
  };
}