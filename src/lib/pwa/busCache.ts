/**
 * Small localStorage layer that lets the Bus Timetable page paint
 * instantly with the last-seen data even when offline / on a flaky
 * network. React Query revalidates in the background.
 *
 * Keys are versioned so future schema changes can bump v and discard
 * old caches without crashing.
 */
const VERSION = "v1";

export interface BusCachePayload<T> {
  v: string;
  at: number;
  data: T;
}

export function readBusCache<T>(key: string): BusCachePayload<T> | null {
  try {
    const raw = localStorage.getItem(`md.bus.${VERSION}.${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BusCachePayload<T>;
    if (parsed?.v !== VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeBusCache<T>(key: string, data: T): void {
  try {
    const payload: BusCachePayload<T> = { v: VERSION, at: Date.now(), data };
    localStorage.setItem(`md.bus.${VERSION}.${key}`, JSON.stringify(payload));
  } catch {
    /* quota or private mode — silently ignore */
  }
}

export function formatCacheAge(at: number, locale: string): string {
  const mins = Math.max(0, Math.floor((Date.now() - at) / 60000));
  if (mins < 1) return locale === "mr" ? "आत्ताच" : "just now";
  if (mins < 60) return locale === "mr" ? `${mins} मि. पूर्वी` : `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return locale === "mr" ? `${hours} तासांपूर्वी` : `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return locale === "mr" ? `${days} दिवसांपूर्वी` : `${days} d ago`;
}
