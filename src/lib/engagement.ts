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
 * Desktop browsers fire tel: but nothing visible happens, so we surface a toast
 * with the number instead of leaving the user staring at a dead click.
 */
export function canDialTel(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return true;
  return window.matchMedia('(pointer: coarse)').matches;
}
