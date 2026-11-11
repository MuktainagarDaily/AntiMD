/**
 * Fire-and-forget engagement logging for Educational Institutes (`school_engagement`).
 * Mirrors `src/lib/engagement.ts` with a 1500ms dedupe guard and fails silently
 * if offline or if the migration table hasn't been created yet.
 */
import { supabase } from '@/integrations/supabase/client';

export type SchoolEngagementEventType =
  | 'call'
  | 'whatsapp'
  | 'website'
  | 'maps'
  | 'prospectus';

const DEDUPE_MS = 1500;
const recent = new Map<string, number>();

export async function logSchoolEngagement(
  schoolId: string,
  eventType: SchoolEngagementEventType | 'directions',
): Promise<void> {
  if (!schoolId) return;
  const normalized: SchoolEngagementEventType =
    eventType === 'directions' ? 'maps' : eventType;

  const key = `${schoolId}:${normalized}`;
  const now = Date.now();
  const last = recent.get(key) ?? 0;
  if (now - last < DEDUPE_MS) return;
  recent.set(key, now);

  if (recent.size > 200) {
    for (const [k, t] of recent) {
      if (now - t > 5_000) recent.delete(k);
    }
  }

  try {
    await (supabase as any)
      .from('school_engagement')
      .insert({ school_id: schoolId, event_type: normalized });
  } catch {
    // Non-blocking analytics
  }
}
