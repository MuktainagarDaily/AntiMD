/**
 * MyMemory translation client (EN ⇄ MR) with multi-layer caching.
 *
 * Cache layers (checked in order, cheapest first):
 *   1. **In-memory Map** — instant, survives across components in the SPA.
 *   2. **localStorage** — survives reloads on the same device.
 *      Capped to MAX_CACHE entries (LRU-ish).
 *   3. **Shared DB cache** (`public.translation_cache`) — shared across ALL
 *      users/devices. First user to translate a phrase pays the MyMemory
 *      call; everyone after that gets it free. RLS lets anon+auth read,
 *      insert, and bump hit_count.
 *   4. **MyMemory API** — last resort (50,000 chars/day tier unlocked via &de=).
 *
 * Pending-promise dedupe prevents duplicate concurrent requests for the
 * same phrase within a single tab.
 */
import { supabase } from '@/integrations/supabase/client';

const CACHE_KEY = 'md.tx.cache.v1';
const MAX_CACHE = 500;
const ENDPOINT = 'https://api.mymemory.translated.net/get';

type Direction = 'en|mr' | 'mr|en';

let memCache: Map<string, string> | null = null;
const pending = new Map<string, Promise<string>>();
let quotaExceededFlag = false;

/** Check if MyMemory API reported a quota or rate limit during this session. */
export function isQuotaExceeded(): boolean {
  return quotaExceededFlag;
}

/** Reset quota exceeded state (e.g. before starting a fresh backfill run). */
export function resetQuotaExceeded(): void {
  quotaExceededFlag = false;
}

/** Clear in-memory and pending caches (useful for testing or cache reset). */
export function clearMemoryCache(): void {
  if (memCache) memCache.clear();
  pending.clear();
}

/** Check if a text is a corrupt API warning or quota exceeded message. */
export function isWarningText(text: string): boolean {
  if (!text) return false;
  return (
    /^MYMEMORY WARNING/i.test(text) ||
    /LIMIT EXCEEDED/i.test(text) ||
    /FREE TRANSLATIONS/i.test(text) ||
    /INVALID EMAIL/i.test(text)
  );
}

function normalize(s: string): string {
  return s.trim().replace(/\s+/g, ' ').toLowerCase();
}

function cacheKey(text: string, dir: Direction): string {
  // Lowercase the direction defensively so callers passing 'EN|MR' (etc.)
  // don't create duplicate entries from the normalized variant.
  return `${dir.toLowerCase()}::${normalize(text)}`;
}

function loadCache(): Map<string, string> {
  if (memCache) return memCache;
  memCache = new Map();
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const obj = JSON.parse(raw) as Record<string, string>;
      Object.entries(obj).forEach(([k, v]) => {
        if (v && !isWarningText(v)) {
          memCache!.set(k, v);
        }
      });
    }
  } catch {
    /* corrupt cache — ignore */
  }
  return memCache;
}

function persistCache() {
  if (!memCache) return;
  try {
    const entries = Array.from(memCache.entries());
    const trimmed = entries.slice(-MAX_CACHE);
    if (trimmed.length !== entries.length) {
      memCache = new Map(trimmed);
    }
    const obj: Record<string, string> = {};
    trimmed.forEach(([k, v]) => (obj[k] = v));
    localStorage.setItem(CACHE_KEY, JSON.stringify(obj));
  } catch {
    /* quota — ignore */
  }
}

function storeLocal(k: string, value: string) {
  if (!value || isWarningText(value)) return;
  const cache = loadCache();
  cache.set(k, value);
  persistCache();
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}

/** Synchronous cache check (no network). Returns null on miss. */
export function getCachedTranslation(text: string, dir: Direction = 'en|mr'): string | null {
  const k = cacheKey(text, dir);
  if (!k.endsWith('::') && k.split('::')[1]) {
    const hit = loadCache().get(k) ?? null;
    if (hit && isWarningText(hit)) {
      loadCache().delete(k);
      return null;
    }
    return hit;
  }
  return null;
}

/** Look up the shared DB cache. Returns null on miss. */
async function fetchSharedCache(srcNorm: string, dir: Direction): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('translation_cache' as any)
      .select('id, translated, hit_count')
      .eq('direction', dir)
      .eq('source_text', srcNorm)
      .maybeSingle();
    if (error || !data) return null;
    const row = data as unknown as { id: string; translated: string; hit_count: number };
    if (!row.translated || isWarningText(row.translated)) return null;
    // Best-effort bump; don't block on it.
    void supabase
      .from('translation_cache' as any)
      .update({ hit_count: (row.hit_count ?? 0) + 1, last_used_at: new Date().toISOString() })
      .eq('id', row.id);
    return row.translated;
  } catch {
    return null;
  }
}

/** Write to the shared DB cache. Fire-and-forget. */
async function writeSharedCache(srcNorm: string, dir: Direction, translated: string) {
  if (!translated || isWarningText(translated)) return;
  try {
    await supabase
      .from('translation_cache' as any)
      .insert({ source_text: srcNorm, direction: dir, translated });
  } catch {
    /* duplicate key or RLS hiccup — ignore */
  }
}

/** Translate text via MyMemory, using all cache layers first. */
export async function translate(text: string, dir: Direction = 'en|mr'): Promise<string> {
  const src = text.trim();
  if (!src) return '';
  const srcNorm = normalize(src);
  const k = cacheKey(src, dir);
  const cache = loadCache();
  const hit = cache.get(k);
  if (hit) {
    if (isWarningText(hit)) {
      cache.delete(k);
    } else {
      return hit;
    }
  }
  if (pending.has(k)) return pending.get(k)!;

  const promise = (async () => {
    // Layer 3: shared DB cache
    const shared = await fetchSharedCache(srcNorm, dir);
    if (shared && !isWarningText(shared)) {
      storeLocal(k, shared);
      return shared;
    }

    // Layer 4: MyMemory API (with &de= to unlock 50,000 characters/day free tier)
    try {
      const url = `${ENDPOINT}?q=${encodeURIComponent(src)}&langpair=${dir}&de=admin@muktainagardaily.com`;
      const res = await fetch(url);
      if (!res.ok || res.status !== 200) {
        if (res.status === 403 || res.status === 429) {
          quotaExceededFlag = true;
        }
        return '';
      }
      const json = (await res.json()) as {
        responseData?: { translatedText?: string; match?: number };
        responseStatus?: number;
      };
      if (json?.responseStatus !== 200) {
        if (json?.responseStatus === 403 || json?.responseStatus === 429) {
          quotaExceededFlag = true;
        }
        return '';
      }
      const raw = json?.responseData?.translatedText || '';
      const out = decodeEntities(raw).trim();
      if (!out || isWarningText(out)) {
        if (isWarningText(out)) {
          quotaExceededFlag = true;
        }
        return '';
      }
      storeLocal(k, out);
      void writeSharedCache(srcNorm, dir, out);
      return out;
    } catch {
      return '';
    }
  })().finally(() => pending.delete(k));

  pending.set(k, promise);
  return promise;
}

/** Convenience wrapper for the common EN → MR direction. */
export const translateEnToMr = (text: string) => translate(text, 'en|mr');
