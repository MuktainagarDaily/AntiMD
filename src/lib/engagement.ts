import { supabase } from '@/integrations/supabase/client';

/**
 * Fire-and-forget engagement log used by ShopCard / ShopDetail / compact cards.
 * Never blocks the user action and never throws — analytics under-count
 * was caused by some surfaces (cards) skipping the call entirely.
 *
 * MPULSE Rec #5 — an in-memory 500ms dedupe map collapses rapid duplicate
 * clicks (double-tap "Call", bouncing between shops) into a single insert.
 * Keyed by `${shopId}:${eventType}`.
 */
/** Canonical engagement event types. Matches the DB CHECK constraint
 *  `shop_engagement_event_type_check` added 2026-07-08. Historical value
 *  `'directions'` is accepted at the callsite for backward compat but
 *  normalised to `'maps'` before insert so the DB constraint holds. */
export type EngagementEventType = 'call' | 'whatsapp' | 'maps';

const DEDUPE_MS = 1500;
const recent = new Map<string, number>();

export async function logShopEngagement(
  shopId: string,
  eventType: EngagementEventType | 'directions',
) {
  const normalized: EngagementEventType =
    eventType === 'directions' ? 'maps' : eventType;
  const key = `${shopId}:${normalized}`;
  const now = Date.now();
  const last = recent.get(key) ?? 0;
  if (now - last < DEDUPE_MS) return;
  recent.set(key, now);
  // Opportunistic cleanup: prune entries older than 5s so the map stays small.
  if (recent.size > 200) {
    for (const [k, t] of recent) if (now - t > 5_000) recent.delete(k);
  }
  try {
    await supabase.from('shop_engagement').insert({ shop_id: shopId, event_type: normalized });
  } catch {
    // non-blocking
  }
}

/**
 * Heuristic: coarse pointer + no hover usually = phone/tablet that can dial.
 * Desktop browsers fail with `Failed to launch 'tel:...' because the scheme
 * does not have a registered handler`, so we intercept desktop clicks and open
 * an in-app call modal showing the formatted number + one-tap copy.
 */
export function canDialTel(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return true;
  return window.matchMedia('(pointer: coarse)').matches;
}

export const OPEN_CALL_DIALOG_EVENT = 'open-call-dialog';

export interface CallDialogDetail {
  phone: string;
  label?: string;
}

/**
 * Handles clicks on `<a href="tel:...">` links cleanly:
 * - Always invokes `onDial?.()` (for telemetry/analytics).
 * - On mobile touch devices (`canDialTel() === true`), lets native `tel:` dialer open.
 * - On desktop (`canDialTel() === false`), calls `e.preventDefault()` to avoid Chromium's
 *   `Failed to launch 'tel:...'` console error and opens `<CallNumberDialog />`.
 */
export function handleTelLinkClick(
  e: { preventDefault: () => void } | null | undefined,
  phone: string | null | undefined,
  label?: string,
  onDial?: () => void,
): boolean {
  onDial?.();
  if (!phone) return false;
  if (canDialTel()) {
    return true;
  }
  e?.preventDefault?.();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent<CallDialogDetail>(OPEN_CALL_DIALOG_EVENT, {
        detail: { phone: phone.trim(), label },
      }),
    );
  }
  return false;
}
