import { supabase } from '@/integrations/supabase/client';
import {
  buildDefaultTownNewsSources,
  detectArticleLanguage,
  inferNewsCategory,
  parseHtmlNewsDocument,
  parseNewsDate,
  parseRssOrAtomXml,
} from './newsParser';
import type {
  LocalNewsItem,
  NewsDateRange,
  NewsSource,
  ScrapeNewsResult,
  ScrapeSourceReport,
} from './newsTypes';

const NEWS_CACHE_PREFIX = 'md.local_news.cache.';
const SOURCES_CACHE_PREFIX = 'md.news_sources.cache.';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let scraperEdgeUnavailable = false;

export function resetNewsScraperAvailability(): void {
  scraperEdgeUnavailable = false;
}

function readLocalCache<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeLocalCache<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // ignore quota errors
  }
}

function isMissingTableError(error: unknown): boolean {
  const msg = String((error as { message?: string; code?: string })?.message || '').toLowerCase();
  const code = String((error as { code?: string })?.code || '');
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    msg.includes('could not find the table') ||
    msg.includes('does not exist')
  );
}

function sortNewsChronologically(items: LocalNewsItem[]): LocalNewsItem[] {
  return [...items].sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
    return new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
  });
}

function filterByDateRange(items: LocalNewsItem[], range?: NewsDateRange): LocalNewsItem[] {
  if (!range || range === 'all') return items;
  const now = Date.now();
  const cutoffMs =
    range === 'today'
      ? 24 * 60 * 60 * 1000
      : range === '7d'
        ? 7 * 24 * 60 * 60 * 1000
        : 30 * 24 * 60 * 60 * 1000;

  return items.filter((item) => {
    if (range === 'today') {
      const istNow = new Date(now + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const istItem = new Date(new Date(item.published_at).getTime() + 5.5 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
      return istItem === istNow;
    }
    return now - new Date(item.published_at).getTime() <= cutoffMs;
  });
}

function mergeDeduplicatedNews(existing: LocalNewsItem[], incoming: LocalNewsItem[]): {
  merged: LocalNewsItem[];
  insertedCount: number;
} {
  const map = new Map<string, LocalNewsItem>();
  const keyOf = (item: LocalNewsItem) =>
    item.source_url?.trim() || `${item.city_id}::${item.title.trim().toLowerCase()}`;

  for (const item of existing) {
    map.set(keyOf(item), item);
  }

  let insertedCount = 0;
  for (const item of incoming) {
    const k = keyOf(item);
    if (!map.has(k)) {
      insertedCount += 1;
      map.set(k, item);
    } else {
      const prev = map.get(k)!;
      map.set(k, {
        ...prev,
        ...item,
        id: prev.id,
        is_pinned: prev.is_pinned,
        is_active: prev.is_active,
      });
    }
  }

  return {
    merged: sortNewsChronologically(Array.from(map.values())),
    insertedCount,
  };
}

export async function fetchLocalNewsForCity(
  cityId: string,
  options?: {
    activeOnly?: boolean;
    dateRange?: NewsDateRange;
  },
): Promise<{ items: LocalNewsItem[]; storageMode: 'supabase' | 'local-cache' }> {
  const activeOnly = options?.activeOnly ?? true;
  const cacheKey = `${NEWS_CACHE_PREFIX}${cityId}`;

  try {
    let q = (supabase as any)
      .from('local_news')
      .select('*')
      .eq('city_id', cityId)
      .order('is_pinned', { ascending: false })
      .order('published_at', { ascending: false })
      .limit(100);

    if (activeOnly) {
      q = q.eq('is_active', true);
    }

    const { data, error } = await q;
    if (error) throw error;

    const rows = sortNewsChronologically((data || []) as LocalNewsItem[]);
    if (!activeOnly || rows.length > 0) {
      writeLocalCache(cacheKey, rows);
    }
    return {
      items: filterByDateRange(rows, options?.dateRange),
      storageMode: 'supabase',
    };
  } catch (err) {
    const cached = sortNewsChronologically(readLocalCache<LocalNewsItem[]>(cacheKey, []));
    const filtered = activeOnly ? cached.filter((i) => i.is_active) : cached;
    if (isMissingTableError(err)) {
      return {
        items: filterByDateRange(filtered, options?.dateRange),
        storageMode: 'local-cache',
      };
    }
    return {
      items: filterByDateRange(filtered, options?.dateRange),
      storageMode: 'local-cache',
    };
  }
}

export async function saveNewsItem(
  item: Omit<LocalNewsItem, 'id' | 'scraped_at'> & { id?: string; scraped_at?: string },
): Promise<{ item: LocalNewsItem; storageMode: 'supabase' | 'local-cache' }> {
  const nowIso = new Date().toISOString();
  const cacheKey = `${NEWS_CACHE_PREFIX}${item.city_id}`;
  const isNew = !item.id || !UUID_RE.test(item.id);

  const payload = {
    city_id: item.city_id,
    village_id: item.village_id && UUID_RE.test(item.village_id) ? item.village_id : null,
    source_id: item.source_id && UUID_RE.test(item.source_id) ? item.source_id : null,
    title: item.title.trim(),
    title_mr: item.title_mr?.trim() || null,
    summary: item.summary?.trim() || null,
    summary_mr: item.summary_mr?.trim() || null,
    category: item.category || 'local',
    language: item.language || 'mr',
    source_name: item.source_name?.trim() || 'Town Desk',
    source_url: item.source_url?.trim() || null,
    image_url: item.image_url?.trim() || null,
    published_at: item.published_at || nowIso,
    scraped_at: item.scraped_at || nowIso,
    is_pinned: Boolean(item.is_pinned),
    is_active: item.is_active !== false,
  };

  let hasSession = false;
  try {
    const sessionRes = await supabase.auth?.getSession?.();
    hasSession = Boolean(sessionRes?.data?.session);

    let saved: LocalNewsItem | null = null;
    if (isNew) {
      const { data, error } = await (supabase as any)
        .from('local_news')
        .insert(payload)
        .select('*')
        .single();
      if (error) throw error;
      saved = data as LocalNewsItem;
    } else {
      const { data, error } = await (supabase as any)
        .from('local_news')
        .update(payload)
        .eq('id', item.id)
        .select('*')
        .single();
      if (error) throw error;
      saved = data as LocalNewsItem;
    }

    const cached = readLocalCache<LocalNewsItem[]>(cacheKey, []);
    const { merged } = mergeDeduplicatedNews(cached, [saved]);
    writeLocalCache(cacheKey, merged);
    return { item: saved, storageMode: 'supabase' };
  } catch (err) {
    if (hasSession && !isMissingTableError(err)) {
      throw err;
    }
    const localRecord: LocalNewsItem = {
      id: item.id || `news-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      ...payload,
      created_at: nowIso,
      updated_at: nowIso,
    };
    const cached = readLocalCache<LocalNewsItem[]>(cacheKey, []);
    const updated = cached.some((c) => c.id === localRecord.id)
      ? cached.map((c) => (c.id === localRecord.id ? localRecord : c))
      : [localRecord, ...cached];
    writeLocalCache(cacheKey, sortNewsChronologically(updated));
    return { item: localRecord, storageMode: 'local-cache' };
  }
}

export async function deleteNewsItem(cityId: string, id: string): Promise<void> {
  const cacheKey = `${NEWS_CACHE_PREFIX}${cityId}`;
  let hasSession = false;
  try {
    const sessionRes = await supabase.auth?.getSession?.();
    hasSession = Boolean(sessionRes?.data?.session);
    const { error } = await (supabase as any).from('local_news').delete().eq('id', id);
    if (error) throw error;
  } catch (err) {
    if (hasSession && !isMissingTableError(err)) {
      throw err;
    }
  }
  const cached = readLocalCache<LocalNewsItem[]>(cacheKey, []);
  writeLocalCache(
    cacheKey,
    cached.filter((item) => item.id !== id),
  );
}

export async function patchNewsFlags(
  cityId: string,
  id: string,
  patch: Partial<Pick<LocalNewsItem, 'is_active' | 'is_pinned'>>,
): Promise<void> {
  const cacheKey = `${NEWS_CACHE_PREFIX}${cityId}`;
  try {
    await (supabase as any).from('local_news').update(patch).eq('id', id);
  } catch {
    // ignore if local cache only
  }
  const cached = readLocalCache<LocalNewsItem[]>(cacheKey, []);
  writeLocalCache(
    cacheKey,
    sortNewsChronologically(cached.map((item) => (item.id === id ? { ...item, ...patch } : item))),
  );
}

export async function fetchNewsSources(
  cityId: string,
  cityName: string,
  citySlug: string,
): Promise<{ sources: NewsSource[]; storageMode: 'supabase' | 'local-cache' }> {
  const cacheKey = `${SOURCES_CACHE_PREFIX}${cityId}`;
  try {
    const { data, error } = await (supabase as any)
      .from('news_sources')
      .select('*')
      .eq('city_id', cityId)
      .order('created_at', { ascending: true });
    if (error) throw error;

    const rows = (data || []) as NewsSource[];
    writeLocalCache(cacheKey, rows);
    return { sources: rows, storageMode: 'supabase' };
  } catch {
    const cached = readLocalCache<NewsSource[]>(cacheKey, []);
    if (cached.length > 0) {
      return { sources: cached, storageMode: 'local-cache' };
    }
    const seeded: NewsSource[] = buildDefaultTownNewsSources(cityId, cityName, citySlug).map(
      (s, idx) => ({
        ...s,
        id: `src-${citySlug}-${idx + 1}`,
      }),
    );
    writeLocalCache(cacheKey, seeded);
    return { sources: seeded, storageMode: 'local-cache' };
  }
}

export async function seedDefaultNewsSources(
  cityId: string,
  cityName: string,
  citySlug: string,
): Promise<NewsSource[]> {
  const defaults = buildDefaultTownNewsSources(cityId, cityName, citySlug);
  const cacheKey = `${SOURCES_CACHE_PREFIX}${cityId}`;

  try {
    const { data, error } = await (supabase as any)
      .from('news_sources')
      .upsert(defaults, { onConflict: 'city_id,url', ignoreDuplicates: true })
      .select('*');
    if (error) throw error;
    const { sources } = await fetchNewsSources(cityId, cityName, citySlug);
    return sources.length ? sources : ((data || []) as NewsSource[]);
  } catch {
    const existing = readLocalCache<NewsSource[]>(cacheKey, []);
    const existingUrls = new Set(existing.map((s) => s.url));
    const added: NewsSource[] = defaults
      .filter((d) => !existingUrls.has(d.url))
      .map((d, idx) => ({ ...d, id: `src-${Date.now()}-${idx}` }));
    const merged = [...existing, ...added];
    writeLocalCache(cacheKey, merged);
    return merged;
  }
}

export async function saveNewsSource(
  source: Omit<NewsSource, 'id'> & { id?: string },
): Promise<NewsSource> {
  const cacheKey = `${SOURCES_CACHE_PREFIX}${source.city_id}`;
  const isNew = !source.id || !UUID_RE.test(source.id);
  const payload = {
    city_id: source.city_id,
    name: source.name.trim(),
    source_type: source.source_type,
    url: source.url.trim(),
    language: source.language,
    category_default: source.category_default,
    is_active: source.is_active !== false,
  };

  try {
    const query = isNew
      ? (supabase as any).from('news_sources').insert(payload).select('*').single()
      : (supabase as any).from('news_sources').update(payload).eq('id', source.id).select('*').single();
    const { data, error } = await query;
    if (error) throw error;
    const saved = data as NewsSource;
    const existing = readLocalCache<NewsSource[]>(cacheKey, []);
    writeLocalCache(
      cacheKey,
      existing.some((s) => s.id === saved.id)
        ? existing.map((s) => (s.id === saved.id ? saved : s))
        : [...existing, saved],
    );
    return saved;
  } catch {
    const localSaved: NewsSource = {
      id: source.id || `src-${Date.now()}`,
      ...payload,
    };
    const existing = readLocalCache<NewsSource[]>(cacheKey, []);
    writeLocalCache(
      cacheKey,
      existing.some((s) => s.id === localSaved.id)
        ? existing.map((s) => (s.id === localSaved.id ? localSaved : s))
        : [...existing, localSaved],
    );
    return localSaved;
  }
}

export async function deleteNewsSource(cityId: string, id: string): Promise<void> {
  const cacheKey = `${SOURCES_CACHE_PREFIX}${cityId}`;
  try {
    await (supabase as any).from('news_sources').delete().eq('id', id);
  } catch {
    // ignore if local cache only
  }
  const existing = readLocalCache<NewsSource[]>(cacheKey, []);
  writeLocalCache(
    cacheKey,
    existing.filter((s) => s.id !== id),
  );
}

async function fetchWithTimeout(
  url: string,
  timeoutMs = 10000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchRawUrlText(targetUrl: string): Promise<string> {
  // 1. Same-origin Vite dev/preview proxy (/api/news-proxy) — zero CORS, direct Node fetch
  if (typeof window !== 'undefined' && window.location?.origin) {
    try {
      const localProxyUrl = `${window.location.origin}/api/news-proxy?url=${encodeURIComponent(targetUrl)}`;
      const res = await fetchWithTimeout(localProxyUrl, 14000);
      const ctype = res.headers.get('content-type') || '';
      if (ctype.includes('application/json')) {
        const payload = await res.json();
        if (payload?.ok && typeof payload.body === 'string') {
          return payload.body;
        }
        if (payload?.error || payload?.status) {
          throw new Error(payload.error || `Upstream HTTP ${payload.status}`);
        }
      }
    } catch (err) {
      // Only rethrow if the local Vite proxy itself responded cleanly with an upstream error
      if (err instanceof Error && /^Upstream HTTP \d+/.test(err.message)) {
        throw err;
      }
      // Otherwise (e.g., static hosting / Vitest where /api/news-proxy is absent) fall through
    }
  }

  // 2. Public CORS proxy waterfall for static browser deployments without Edge Function
  const errors: string[] = [];

  try {
    const res = await fetchWithTimeout(
      `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`,
      10000,
    );
    if (res.ok) {
      const text = await res.text();
      if (text.length > 50) return text;
    }
    errors.push(`codetabs HTTP ${res.status}`);
  } catch (e) {
    errors.push(e instanceof Error ? e.message : 'codetabs failed');
  }

  try {
    const res = await fetchWithTimeout(
      `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`,
      10000,
    );
    if (res.ok) {
      const json = await res.json();
      if (typeof json?.contents === 'string' && json.contents.length > 50) {
        return json.contents;
      }
    }
    errors.push(`allorigins HTTP ${res.status}`);
  } catch (e) {
    errors.push(e instanceof Error ? e.message : 'allorigins failed');
  }

  throw new Error(
    errors[0] || 'Unable to fetch URL (site blocked browser proxy; enable scrape-local-news Edge Function in production)',
  );
}

async function fetchRssViaClientFallback(source: NewsSource): Promise<{
  items: LocalNewsItem[];
  skippedInvalidDate: number;
}> {
  // Prefer direct XML/HTML fetch via local same-origin proxy first (no rss2json rate limits)
  try {
    const text = await fetchRawUrlText(source.url);
    const trimmedHead = text.trimStart().slice(0, 500);
    const looksLikeXml =
      trimmedHead.startsWith('<?xml') || /<(rss|feed|channel)\b/i.test(trimmedHead);

    if (looksLikeXml) {
      const xmlParsed = parseRssOrAtomXml(text, {
        cityId: source.city_id,
        sourceId: source.id,
        sourceName: source.name,
        language: source.language,
        defaultCategory: source.category_default,
      });
      if (xmlParsed.items.length > 0 || source.source_type === 'rss') {
        return xmlParsed;
      }
    }

    return parseHtmlNewsDocument(text, source.url, {
      cityId: source.city_id,
      sourceId: source.id,
      sourceName: source.name,
      language: source.language,
      defaultCategory: source.category_default,
    });
  } catch (rawErr) {
    // If RSS source failed via raw fetch (e.g., on static CDN host), try rss2json bridge
    if (source.source_type === 'rss') {
      try {
        const rss2jsonUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(source.url)}`;
        const res = await fetchWithTimeout(rss2jsonUrl, 10000);
        if (res.ok) {
          const json = await res.json();
          if (json?.status === 'ok' && Array.isArray(json.items)) {
            const items: LocalNewsItem[] = [];
            let skippedInvalidDate = 0;
            const nowIso = new Date().toISOString();

            for (const entry of json.items.slice(0, 20)) {
              const parsedDate = parseNewsDate(entry.pubDate);
              if (!parsedDate) {
                skippedInvalidDate += 1;
                continue;
              }
              const rawTitle = String(entry.title || '').trim();
              if (!rawTitle) continue;
              const splitIdx = rawTitle.lastIndexOf(' - ');
              const title = splitIdx > 15 ? rawTitle.slice(0, splitIdx).trim() : rawTitle;
              const splitSource = splitIdx > 15 ? rawTitle.slice(splitIdx + 3).trim() : '';
              const cleanSummary = String(entry.description || '')
                .replace(/<[^>]+>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim()
                .slice(0, 320);
              const lang = detectArticleLanguage(title, source.language);

              items.push({
                id: `news-${Date.now()}-${items.length + 1}`,
                city_id: source.city_id,
                source_id: source.id,
                title,
                title_mr: lang === 'mr' ? title : null,
                summary: cleanSummary && cleanSummary !== title ? cleanSummary : null,
                summary_mr: lang === 'mr' && cleanSummary && cleanSummary !== title ? cleanSummary : null,
                category: inferNewsCategory(title, cleanSummary, source.category_default),
                language: lang,
                source_name: splitSource || entry.author || source.name,
                source_url: entry.link || null,
                image_url: entry.thumbnail || entry.enclosure?.link || null,
                published_at: parsedDate.toISOString(),
                scraped_at: nowIso,
                is_pinned: false,
                is_active: true,
              });
            }

            return { items, skippedInvalidDate };
          }
        }
      } catch {
        // fall through and rethrow original error
      }
    }
    throw rawErr;
  }
}

export async function scrapeInternetNews(params: {
  cityId: string;
  cityName: string;
  citySlug: string;
  sources: NewsSource[];
  customUrl?: string;
}): Promise<ScrapeNewsResult> {
  const { cityId, sources, customUrl } = params;
  const edgeEnabled = import.meta.env.VITE_ENABLE_NEWS_SCRAPER_EDGE === 'true';
  const sessionRes = edgeEnabled ? await supabase.auth?.getSession?.() : null;
  const hasSession = Boolean(sessionRes?.data?.session);

  if (edgeEnabled && hasSession && !scraperEdgeUnavailable) {
    try {
      const { data, error } = await supabase.functions.invoke('scrape-local-news', {
        body: {
          cityId,
          sources: customUrl ? [] : sources.filter((s) => s.is_active),
          customUrl: customUrl?.trim() || undefined,
          saveToDb: true,
        },
      });
      if (!error && data && Array.isArray(data.items)) {
        const refreshed = await fetchLocalNewsForCity(cityId, { activeOnly: false });
        return {
          items: refreshed.items.length ? refreshed.items : (data.items as LocalNewsItem[]),
          insertedCount: Number(data.insertedCount || data.items.length),
          fetchedCount: Number(data.fetchedCount || data.items.length),
          storageMode: refreshed.storageMode,
          reports: (data.reports || []) as ScrapeSourceReport[],
        };
      }
      scraperEdgeUnavailable = true;
    } catch {
      scraperEdgeUnavailable = true;
    }
  }

  const targetSources: NewsSource[] = customUrl?.trim()
    ? [
        {
          id: `custom-${Date.now()}`,
          city_id: cityId,
          name: 'Custom Web URL',
          source_type: 'webpage',
          url: customUrl.trim(),
          language: 'mr',
          category_default: 'local',
          is_active: true,
        },
      ]
    : sources.filter((s) => s.is_active);

  const reports: ScrapeSourceReport[] = [];
  const scrapedItems: LocalNewsItem[] = [];

  for (const src of targetSources) {
    try {
      const { items, skippedInvalidDate } = await fetchRssViaClientFallback(src);
      scrapedItems.push(...items);
      reports.push({
        sourceName: src.name,
        url: src.url,
        fetched: items.length,
        inserted: items.length,
        skippedInvalidDate,
      });
    } catch (err) {
      reports.push({
        sourceName: src.name,
        url: src.url,
        fetched: 0,
        inserted: 0,
        skippedInvalidDate: 0,
        error: err instanceof Error ? err.message : 'Unable to scrape source',
      });
    }
  }

  // Deduplicate scraped rows by source_url before caching/writing to Postgres
  const uniqueByUrl = new Map<string, LocalNewsItem>();
  for (const item of scrapedItems) {
    const key = item.source_url?.trim() || `${item.city_id}::${item.title.trim().toLowerCase()}`;
    if (!uniqueByUrl.has(key)) {
      uniqueByUrl.set(key, item);
    }
  }
  const uniqueScraped = Array.from(uniqueByUrl.values());

  const cacheKey = `${NEWS_CACHE_PREFIX}${cityId}`;
  const existingLocal = readLocalCache<LocalNewsItem[]>(cacheKey, []);
  const { merged, insertedCount } = mergeDeduplicatedNews(existingLocal, uniqueScraped);
  writeLocalCache(cacheKey, merged);

  // Best-effort persist into Supabase local_news when authenticated & migration exists
  let storageMode: 'supabase' | 'local-cache' = 'local-cache';
  const dbRows = uniqueScraped
    .filter((i) => i.source_url)
    .map((i) => ({
      city_id: i.city_id,
      source_id: i.source_id && UUID_RE.test(i.source_id) ? i.source_id : null,
      title: i.title,
      title_mr: i.title_mr || null,
      summary: i.summary || null,
      summary_mr: i.summary_mr || null,
      category: i.category,
      language: i.language,
      source_name: i.source_name,
      source_url: i.source_url,
      image_url: i.image_url || null,
      published_at: i.published_at,
      scraped_at: i.scraped_at,
      is_pinned: false,
      is_active: true,
    }));

  if (dbRows.length > 0 && UUID_RE.test(cityId)) {
    try {
      const sessionRes = await supabase.auth?.getSession?.();
      const hasSession = Boolean(sessionRes?.data?.session);

      if (hasSession) {
        const { data: existingRows, error: lookupError } = await (supabase as any)
          .from('local_news')
          .select('id, source_url')
          .eq('city_id', cityId)
          .not('source_url', 'is', null)
          .limit(1000);

        if (!lookupError) {
          const existingMap = new Map<string, string>();
          for (const row of existingRows || []) {
            if (row?.source_url && row?.id) {
              existingMap.set(row.source_url, row.id);
            }
          }

          const toInsert = dbRows.filter((r) => !existingMap.has(r.source_url!));
          const toUpdate = dbRows.filter((r) => existingMap.has(r.source_url!));

          let writeOk = true;
          if (toInsert.length > 0) {
            const { error: insertErr } = await (supabase as any)
              .from('local_news')
              .insert(toInsert);
            if (insertErr) {
              writeOk = false;
              console.warn('[local_news] DB insert error:', insertErr.message);
            }
          }

          if (writeOk && toUpdate.length > 0) {
            await Promise.all(
              toUpdate.map((row) =>
                (supabase as any)
                  .from('local_news')
                  .update({
                    title: row.title,
                    title_mr: row.title_mr,
                    summary: row.summary,
                    summary_mr: row.summary_mr,
                    category: row.category,
                    language: row.language,
                    source_name: row.source_name,
                    image_url: row.image_url,
                    published_at: row.published_at,
                    scraped_at: row.scraped_at,
                  })
                  .eq('id', existingMap.get(row.source_url!)!),
              ),
            );
          }

          if (writeOk) {
            storageMode = 'supabase';
            const refreshed = await fetchLocalNewsForCity(cityId, { activeOnly: false });
            return {
              items: refreshed.items.length ? refreshed.items : merged,
              insertedCount: toInsert.length,
              fetchedCount: uniqueScraped.length,
              storageMode: refreshed.storageMode,
              reports,
            };
          }
        }
      }
    } catch {
      // keep local-cache mode cleanly
    }
  }

  return {
    items: merged,
    insertedCount,
    fetchedCount: uniqueScraped.length,
    storageMode,
    reports,
  };
}
