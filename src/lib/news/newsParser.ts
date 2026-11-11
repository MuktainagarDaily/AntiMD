import type { LocalNewsItem, NewsCategory, NewsLanguage, NewsSource } from './newsTypes';

const MONTH_MAP: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

/**
 * Parses RFC-2822, ISO-8601, DD/MM/YYYY, and common Indian portal date strings
 * into a validated Date object, returning null for unparseable or implausible dates.
 */
export function parseNewsDate(raw?: string | null, referenceNow = new Date()): Date | null {
  if (!raw || typeof raw !== 'string') return null;
  const cleaned = raw
    .trim()
    .replace(/\bIST\b/i, '+0530')
    .replace(/\bGMT\b/i, '+0000')
    .replace(/\bUTC\b/i, '+0000');

  if (!cleaned) return null;

  let parsed: Date | null = null;

  // Handle DD/MM/YYYY or DD-MM-YYYY (with optional HH:mm)
  const dmyMatch = cleaned.match(
    /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/,
  );
  if (dmyMatch) {
    const day = Number(dmyMatch[1]);
    const month = Number(dmyMatch[2]) - 1;
    const year = Number(dmyMatch[3]);
    const hour = dmyMatch[4] ? Number(dmyMatch[4]) : 9;
    const minute = dmyMatch[5] ? Number(dmyMatch[5]) : 0;
    const second = dmyMatch[6] ? Number(dmyMatch[6]) : 0;
    if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      // Treat Indian DD/MM/YYYY portal strings as IST (+05:30)
      const utcMs = Date.UTC(year, month, day, hour, minute, second) - 5.5 * 60 * 60 * 1000;
      parsed = new Date(utcMs);
    }
  }

  // Handle "11 Nov 2026" or "Nov 11, 2026" without timezone
  if (!parsed) {
    const textMatch = cleaned.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
    if (textMatch) {
      const m = MONTH_MAP[textMatch[2].toLowerCase()];
      if (m !== undefined) {
        const utcMs =
          Date.UTC(Number(textMatch[3]), m, Number(textMatch[1]), 9, 0, 0) - 5.5 * 60 * 60 * 1000;
        parsed = new Date(utcMs);
      }
    }
  }

  if (!parsed) {
    const native = new Date(cleaned);
    if (!Number.isNaN(native.getTime())) {
      parsed = native;
    }
  }

  if (!parsed || Number.isNaN(parsed.getTime())) return null;

  const minEpoch = Date.UTC(2015, 0, 1);
  const maxAllowed = referenceNow.getTime() + 24 * 60 * 60 * 1000;
  if (parsed.getTime() < minEpoch || parsed.getTime() > maxAllowed) {
    return null;
  }

  return parsed;
}

export function getISTDateKey(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) return '1970-01-01';
  const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().slice(0, 10);
}

export function formatNewsDateIST(iso: string, locale: 'en' | 'mr' = 'en'): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return new Intl.DateTimeFormat(locale === 'mr' ? 'mr-IN' : 'en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(d);
  } catch {
    const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
    return ist.toISOString().slice(0, 16).replace('T', ' ');
  }
}

export function getNewsDateGroupLabel(
  iso: string,
  locale: 'en' | 'mr' = 'en',
  now = new Date(),
): string {
  const itemKey = getISTDateKey(iso);
  const todayKey = getISTDateKey(now);
  const yesterdayKey = getISTDateKey(new Date(now.getTime() - 24 * 60 * 60 * 1000));

  const d = new Date(iso);
  let shortDate = itemKey;
  if (!Number.isNaN(d.getTime())) {
    try {
      shortDate = new Intl.DateTimeFormat(locale === 'mr' ? 'mr-IN' : 'en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).format(d);
    } catch {
      shortDate = itemKey;
    }
  }

  if (itemKey === todayKey) {
    return locale === 'mr' ? `आज · ${shortDate}` : `Today · ${shortDate}`;
  }
  if (itemKey === yesterdayKey) {
    return locale === 'mr' ? `काल · ${shortDate}` : `Yesterday · ${shortDate}`;
  }
  return shortDate;
}

export function toDatetimeLocalValue(iso?: string | null): string {
  const d = iso ? new Date(iso) : new Date();
  const valid = Number.isNaN(d.getTime()) ? new Date() : d;
  const ist = new Date(valid.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().slice(0, 16);
}

export function fromDatetimeLocalValue(localValue: string): string {
  const match = localValue.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) return new Date().toISOString();
  const [, y, m, d, hh, mm] = match;
  // Interpret input as IST (+05:30) and normalize to UTC ISO
  const utcMs =
    Date.UTC(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), 0) -
    5.5 * 60 * 60 * 1000;
  return new Date(utcMs).toISOString();
}

export function decodeHtmlEntities(input: string): string {
  return input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(Number(num)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

export function stripHtml(html: string): string {
  return decodeHtmlEntities(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function inferNewsCategory(
  title: string,
  summary?: string | null,
  fallback: NewsCategory = 'local',
): NewsCategory {
  const hay = `${title} ${summary || ''}`.toLowerCase();
  if (/alert|warning|heavy rain|curfew|shut|emergency|accident|इशारा|अतिवृष्टी|अपघात|बंद/.test(hay)) {
    return 'alerts';
  }
  if (/water|electricity|msedcl|mahavitaran|road|municipal|panchayat|gram|drain|पाणी|वीज|रस्ता|ग्राम\s*पंचायत|नगर\s*परिषद|नगर\s*पंचायत|नगरपालिका|महावितरण/.test(hay)) {
    return 'civic';
  }
  if (/farmer|cotton|banana|crop|soybean|krishi|monsoon|rain|शेतकरी|कापूस|केळी|पीक|हवामान|पाऊस|कृषी/.test(hay)) {
    return 'agriculture';
  }
  if (/school|college|exam|university|admission|scholarship|student|शाळा|कॉलेज|परीक्षा|विद्यार्थी|शिक्षण/.test(hay)) {
    return 'education';
  }
  if (/market|mandi|rate|price|gold|bazaar|apmc|बाजार|भाव|मंडी|सोने|व्यापार/.test(hay)) {
    return 'markets';
  }
  if (/cricket|tournament|kabaddi|sports|medal|match|स्पर्धा|क्रिकेट|क्रीडा|विजेते/.test(hay)) {
    return 'sports';
  }
  return fallback;
}

export function detectArticleLanguage(text: string, fallback: NewsLanguage = 'mr'): NewsLanguage {
  if (/[\u0900-\u097F]/.test(text)) return 'mr';
  if (/[a-zA-Z]{4,}/.test(text)) return 'en';
  return fallback;
}

function extractTag(block: string, tagName: string): string {
  const re = new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const m = block.match(re);
  return m ? m[1].trim() : '';
}

function extractAttr(block: string, tagName: string, attrName: string): string {
  const re = new RegExp(`<${tagName}[^>]*\\b${attrName}=["']([^"']+)["'][^>]*>`, 'i');
  const m = block.match(re);
  return m ? m[1].trim() : '';
}

function splitGoogleNewsTitle(rawTitle: string): { title: string; source?: string } {
  const idx = rawTitle.lastIndexOf(' - ');
  if (idx > 15 && idx < rawTitle.length - 3) {
    return {
      title: rawTitle.slice(0, idx).trim(),
      source: rawTitle.slice(idx + 3).trim(),
    };
  }
  return { title: rawTitle };
}

export interface ParseFeedOptions {
  cityId: string;
  sourceId?: string | null;
  sourceName: string;
  language: NewsLanguage;
  defaultCategory: NewsCategory;
  now?: Date;
}

export function parseRssOrAtomXml(
  xml: string,
  options: ParseFeedOptions,
): { items: LocalNewsItem[]; skippedInvalidDate: number } {
  const now = options.now || new Date();
  const isAtom = /<entry[\s>]/i.test(xml) && !/<item[\s>]/i.test(xml);
  const blockRegex = isAtom ? /<entry\b[^>]*>([\s\S]*?)<\/entry>/gi : /<item\b[^>]*>([\s\S]*?)<\/item>/gi;

  const items: LocalNewsItem[] = [];
  let skippedInvalidDate = 0;

  let match: RegExpExecArray | null;
  while ((match = blockRegex.exec(xml)) !== null) {
    const block = match[1];
    const rawTitle = stripHtml(extractTag(block, 'title'));
    if (!rawTitle) continue;

    const rawLink =
      stripHtml(extractTag(block, 'link')) ||
      extractAttr(block, 'link', 'href') ||
      stripHtml(extractTag(block, 'guid'));

    const rawDateStr =
      stripHtml(extractTag(block, 'pubDate')) ||
      stripHtml(extractTag(block, 'dc:date')) ||
      stripHtml(extractTag(block, 'published')) ||
      stripHtml(extractTag(block, 'updated'));

    const parsedDate = parseNewsDate(rawDateStr, now);
    if (!parsedDate) {
      skippedInvalidDate += 1;
      continue;
    }

    const rawDesc =
      extractTag(block, 'description') ||
      extractTag(block, 'summary') ||
      extractTag(block, 'content:encoded') ||
      extractTag(block, 'content');

    const imgFromHtml = rawDesc.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1];
    const imageUrl =
      extractAttr(block, 'media:content', 'url') ||
      extractAttr(block, 'media:thumbnail', 'url') ||
      extractAttr(block, 'enclosure', 'url') ||
      imgFromHtml ||
      null;

    const tagSource = stripHtml(extractTag(block, 'source'));
    const split = splitGoogleNewsTitle(rawTitle);
    const title = split.title;
    const sourceName = tagSource || split.source || options.sourceName;

    const cleanSummary = stripHtml(rawDesc).slice(0, 320);
    const lang = detectArticleLanguage(title, options.language);
    const category = inferNewsCategory(title, cleanSummary, options.defaultCategory);

    items.push({
      id: `news-${now.getTime()}-${items.length + 1}`,
      city_id: options.cityId,
      source_id: options.sourceId || null,
      title,
      title_mr: lang === 'mr' ? title : null,
      summary: cleanSummary && cleanSummary !== title ? cleanSummary : null,
      summary_mr: lang === 'mr' && cleanSummary && cleanSummary !== title ? cleanSummary : null,
      category,
      language: lang,
      source_name: sourceName,
      source_url: rawLink || null,
      image_url: imageUrl,
      published_at: parsedDate.toISOString(),
      scraped_at: now.toISOString(),
      is_pinned: false,
      is_active: true,
    });
  }

  return { items, skippedInvalidDate };
}

export function parseHtmlArticleMeta(
  html: string,
  pageUrl: string,
  options: ParseFeedOptions,
): LocalNewsItem | null {
  const now = options.now || new Date();

  const metaContent = (attr: string, name: string): string => {
    const p1 = new RegExp(
      `<meta[^>]+${attr}=["']${name}["'][^>]+content=["']([^"']+)["'][^>]*>`,
      'i',
    );
    const p2 = new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+${attr}=["']${name}["'][^>]*>`,
      'i',
    );
    return decodeHtmlEntities((html.match(p1)?.[1] || html.match(p2)?.[1] || '').trim());
  };

  const title =
    metaContent('property', 'og:title') ||
    metaContent('name', 'twitter:title') ||
    stripHtml(extractTag(html, 'title'));

  if (!title) return null;

  const jsonLdDate = html.match(/"datePublished"\s*:\s*"([^"]+)"/i)?.[1];
  const timeDatetime = html.match(/<time[^>]+datetime=["']([^"']+)["']/i)?.[1];
  const rawDate =
    metaContent('property', 'article:published_time') ||
    metaContent('name', 'pubdate') ||
    metaContent('name', 'publish-date') ||
    metaContent('property', 'og:updated_time') ||
    jsonLdDate ||
    timeDatetime;

  const parsedDate = parseNewsDate(rawDate, now);
  if (!parsedDate) return null;

  const summary =
    metaContent('property', 'og:description') ||
    metaContent('name', 'description') ||
    metaContent('name', 'twitter:description') ||
    null;

  const imageUrl =
    metaContent('property', 'og:image') ||
    metaContent('name', 'twitter:image') ||
    null;

  let hostname = options.sourceName;
  try {
    hostname = metaContent('property', 'og:site_name') || new URL(pageUrl).hostname.replace(/^www\./, '');
  } catch {
    // keep fallback
  }

  const lang = detectArticleLanguage(title, options.language);
  const category = inferNewsCategory(title, summary, options.defaultCategory);

  return {
    id: `news-${now.getTime()}-1`,
    city_id: options.cityId,
    source_id: options.sourceId || null,
    title,
    title_mr: lang === 'mr' ? title : null,
    summary: summary ? summary.slice(0, 320) : null,
    summary_mr: lang === 'mr' && summary ? summary.slice(0, 320) : null,
    category,
    language: lang,
    source_name: hostname,
    source_url: pageUrl,
    image_url: imageUrl,
    published_at: parsedDate.toISOString(),
    scraped_at: now.toISOString(),
    is_pinned: false,
    is_active: true,
  };
}

function resolveAbsoluteUrl(href: string, baseUrl: string): string | null {
  const clean = decodeHtmlEntities(href).trim();
  if (!clean || clean.startsWith('#') || /^javascript:/i.test(clean)) return null;
  try {
    return new URL(clean, baseUrl).toString();
  } catch {
    return null;
  }
}

function extractArticleHeadlineAndUrl(
  block: string,
  pageUrl: string,
): { title: string; url: string | null } | null {
  const anchorCandidates: Array<{ url: string; title: string; score: number }> = [];

  // Prefer anchors wrapped inside heading tags or title containers
  const titleContainers = [
    ...block.matchAll(
      /<(?:h[1-4]|div|span|p)[^>]*\b(?:title|headline|entry-title|card-title)[^>]*>[\s\S]*?<a\b([^>]*)>([\s\S]*?)<\/a>/gi,
    ),
    ...block.matchAll(/<h[1-4]\b[^>]*>[\s\S]*?<a\b([^>]*)>([\s\S]*?)<\/a>/gi),
  ];

  for (const m of titleContainers) {
    const attrs = m[1] || '';
    const inner = stripHtml(m[2] || '');
    const hrefMatch = attrs.match(/\bhref=["']([^"']+)["']/i);
    const resolved = hrefMatch ? resolveAbsoluteUrl(hrefMatch[1], pageUrl) : null;
    if (resolved && inner.length >= 10) {
      anchorCandidates.push({ url: resolved, title: inner, score: 100 });
    }
  }

  // Scan all anchors in card as fallback (skipping /author/, /tag/, /category/ and empty image wrappers)
  for (const m of block.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const attrs = m[1] || '';
    const hrefMatch = attrs.match(/\bhref=["']([^"']+)["']/i);
    if (!hrefMatch) continue;
    const resolved = resolveAbsoluteUrl(hrefMatch[1], pageUrl);
    if (!resolved) continue;
    if (/\/(author|tag|category|about)\//i.test(resolved)) continue;

    const innerText = stripHtml(m[2] || '');
    const ariaMatch = attrs.match(/\baria-label=["']([^"']+)["']/i);
    const labelText = innerText.length >= 10 ? innerText : decodeHtmlEntities(ariaMatch?.[1] || '').trim();
    if (labelText.length >= 10) {
      const score = innerText.length >= 10 ? 60 : 30;
      anchorCandidates.push({ url: resolved, title: labelText, score });
    }
  }

  if (anchorCandidates.length === 0) return null;
  anchorCandidates.sort((a, b) => b.score - a.score);
  return { title: anchorCandidates[0].title, url: anchorCandidates[0].url };
}

function extractArticleDate(block: string, now: Date): Date | null {
  for (const m of block.matchAll(/<time\b([^>]*)>([\s\S]*?)<\/time>/gi)) {
    const attrs = m[1] || '';
    const dtAttr = attrs.match(/\bdatetime=["']([^"']+)["']/i)?.[1];
    const fromAttr = parseNewsDate(dtAttr, now);
    if (fromAttr) return fromAttr;

    const textDate = stripHtml(m[2] || '').replace(/^Updated:\s*/i, '');
    const fromText = parseNewsDate(textDate, now);
    if (fromText) return fromText;
  }

  const jsonDate = block.match(/"datePublished"\s*:\s*"([^"]+)"/i)?.[1];
  if (jsonDate) {
    const d = parseNewsDate(jsonDate, now);
    if (d) return d;
  }

  const dataDate = block.match(/\bdata-(?:published|date|time)=["']([^"']+)["']/i)?.[1];
  if (dataDate) {
    const d = parseNewsDate(dataDate, now);
    if (d) return d;
  }

  return null;
}

function extractCardImage(block: string, pageUrl: string): string | null {
  const imgMatch = block.match(/<img\b([^>]*)>/i);
  if (!imgMatch) return null;
  const attrs = imgMatch[1] || '';
  const dataSrc =
    attrs.match(/\bdata-(?:lazy-)?src=["']([^"']+)["']/i)?.[1] ||
    attrs.match(/\bdata-original=["']([^"']+)["']/i)?.[1] ||
    attrs.match(/\bsrc=["']([^"']+)["']/i)?.[1];
  if (!dataSrc || /default-ie\.jpg|placeholder|spacer|1x1|\.svg$/i.test(dataSrc)) {
    return null;
  }
  return resolveAbsoluteUrl(dataSrc, pageUrl);
}

/**
 * Extracts multiple dated articles from topic, district, tag, or homepage listing HTML
 * (e.g. loksatta.com/about/..., lokmat.com, WordPress/Indian Express news portals).
 */
export function parseHtmlListingArticles(
  html: string,
  pageUrl: string,
  options: ParseFeedOptions,
): { items: LocalNewsItem[]; skippedInvalidDate: number } {
  const now = options.now || new Date();
  const items: LocalNewsItem[] = [];
  const seen = new Set<string>();
  let skippedInvalidDate = 0;

  let hostSiteName = options.sourceName;
  const ogSite = html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i)?.[1];
  if (ogSite) {
    hostSiteName = decodeHtmlEntities(ogSite.trim());
  } else {
    try {
      hostSiteName = new URL(pageUrl).hostname.replace(/^www\./, '');
    } catch {
      // keep fallback
    }
  }

  // 1. Parse standard <article>...</article> cards
  for (const m of html.matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/gi)) {
    if (items.length >= 25) break;
    const block = m[1];
    const headline = extractArticleHeadlineAndUrl(block, pageUrl);
    if (!headline) continue;

    const parsedDate = extractArticleDate(block, now);
    if (!parsedDate) {
      skippedInvalidDate += 1;
      continue;
    }

    const dedupeKey = headline.url || headline.title.toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const pMatch = block.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i);
    const rawSummary = pMatch ? stripHtml(pMatch[1]) : '';
    const summary = rawSummary && rawSummary !== headline.title ? rawSummary.slice(0, 320) : null;
    const imageUrl = extractCardImage(block, pageUrl);
    const lang = detectArticleLanguage(headline.title, options.language);
    const category = inferNewsCategory(headline.title, summary, options.defaultCategory);

    items.push({
      id: `news-${now.getTime()}-${items.length + 1}`,
      city_id: options.cityId,
      source_id: options.sourceId || null,
      title: headline.title,
      title_mr: lang === 'mr' ? headline.title : null,
      summary,
      summary_mr: lang === 'mr' && summary ? summary : null,
      category,
      language: lang,
      source_name: hostSiteName,
      source_url: headline.url,
      image_url: imageUrl,
      published_at: parsedDate.toISOString(),
      scraped_at: now.toISOString(),
      is_pinned: false,
      is_active: true,
    });
  }

  // 2. Fallback: extract NewsArticle / ItemList items from JSON-LD scripts if <article> yielded nothing
  if (items.length === 0) {
    for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
      try {
        const data = JSON.parse(m[1].trim());
        const candidates = Array.isArray(data)
          ? data
          : Array.isArray(data?.itemListElement)
            ? data.itemListElement.map((el: any) => el?.item || el)
            : [data];
        for (const obj of candidates) {
          if (!obj || typeof obj !== 'object') continue;
          const title = stripHtml(String(obj.headline || obj.name || ''));
          const dateVal = parseNewsDate(obj.datePublished || obj.dateModified, now);
          const itemUrl = typeof obj.url === 'string' ? resolveAbsoluteUrl(obj.url, pageUrl) : null;
          if (!title || !dateVal || !itemUrl) continue;
          if (seen.has(itemUrl)) continue;
          seen.add(itemUrl);

          const lang = detectArticleLanguage(title, options.language);
          const summary = obj.description ? stripHtml(String(obj.description)).slice(0, 320) : null;
          items.push({
            id: `news-${now.getTime()}-${items.length + 1}`,
            city_id: options.cityId,
            source_id: options.sourceId || null,
            title,
            title_mr: lang === 'mr' ? title : null,
            summary,
            summary_mr: lang === 'mr' && summary ? summary : null,
            category: inferNewsCategory(title, summary, options.defaultCategory),
            language: lang,
            source_name: hostSiteName,
            source_url: itemUrl,
            image_url: typeof obj.image === 'string' ? obj.image : obj.image?.url || null,
            published_at: dateVal.toISOString(),
            scraped_at: now.toISOString(),
            is_pinned: false,
            is_active: true,
          });
        }
      } catch {
        // ignore malformed JSON-LD block
      }
    }
  }

  return { items, skippedInvalidDate };
}

/**
 * Unified HTML scraper: extracts multiple dated articles from listing/topic pages first,
 * and falls back to single-article metadata parsing for individual story URLs.
 */
export function parseHtmlNewsDocument(
  html: string,
  pageUrl: string,
  options: ParseFeedOptions,
): { items: LocalNewsItem[]; skippedInvalidDate: number } {
  const listing = parseHtmlListingArticles(html, pageUrl, options);
  if (listing.items.length > 0) {
    return listing;
  }

  const single = parseHtmlArticleMeta(html, pageUrl, options);
  if (single) {
    return { items: [single], skippedInvalidDate: listing.skippedInvalidDate };
  }

  return { items: [], skippedInvalidDate: Math.max(1, listing.skippedInvalidDate) };
}

export function buildDefaultTownNewsSources(
  cityId: string,
  cityName: string,
  citySlug: string,
): Array<Omit<NewsSource, 'id'>> {
  const slug = citySlug.toLowerCase();
  const isJalgaonBelt = slug === 'muktainagar' || slug === 'bhusawal' || slug === 'varangaon';
  const regionQuery = isJalgaonBelt ? `${cityName} OR Jalgaon` : `${cityName} Maharashtra`;

  return [
    {
      city_id: cityId,
      name: `Google News · ${cityName} (Marathi)`,
      source_type: 'rss',
      url: `https://news.google.com/rss/search?q=${encodeURIComponent(`${cityName} when:14d`)}&hl=mr&gl=IN&ceid=IN:mr`,
      language: 'mr',
      category_default: 'local',
      is_active: true,
    },
    {
      city_id: cityId,
      name: `Google News · ${cityName} (English)`,
      source_type: 'rss',
      url: `https://news.google.com/rss/search?q=${encodeURIComponent(`${regionQuery} when:14d`)}&hl=en-IN&gl=IN&ceid=IN:en`,
      language: 'en',
      category_default: 'local',
      is_active: true,
    },
    {
      city_id: cityId,
      name: isJalgaonBelt ? 'Lokmat · Jalgaon District' : `Lokmat · Maharashtra`,
      source_type: 'rss',
      url: isJalgaonBelt
        ? 'https://www.lokmat.com/rss/jalgaon-news/'
        : 'https://www.lokmat.com/rss/maharashtra-news/',
      language: 'mr',
      category_default: 'civic',
      is_active: true,
    },
  ];
}
