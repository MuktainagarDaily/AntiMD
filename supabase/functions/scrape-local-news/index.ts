import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MONTH_MAP: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2,
  apr: 3, april: 3, may: 4, jun: 5, june: 5, jul: 6, july: 6,
  aug: 7, august: 7, sep: 8, sept: 8, september: 8,
  oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
};

function decodeEntities(input: string): string {
  return input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function stripHtml(html: string): string {
  return decodeEntities(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseNewsDate(raw?: string | null): Date | null {
  if (!raw) return null;
  const cleaned = raw
    .trim()
    .replace(/\bIST\b/i, "+0530")
    .replace(/\bGMT\b/i, "+0000")
    .replace(/\bUTC\b/i, "+0000");
  if (!cleaned) return null;

  let parsed: Date | null = null;
  const dmy = cleaned.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]) - 1;
    const year = Number(dmy[3]);
    const hour = dmy[4] ? Number(dmy[4]) : 9;
    const min = dmy[5] ? Number(dmy[5]) : 0;
    const sec = dmy[6] ? Number(dmy[6]) : 0;
    if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      parsed = new Date(Date.UTC(year, month, day, hour, min, sec) - 5.5 * 60 * 60 * 1000);
    }
  }
  if (!parsed) {
    const txt = cleaned.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
    if (txt && MONTH_MAP[txt[2].toLowerCase()] !== undefined) {
      parsed = new Date(
        Date.UTC(Number(txt[3]), MONTH_MAP[txt[2].toLowerCase()], Number(txt[1]), 9, 0, 0) -
          5.5 * 60 * 60 * 1000,
      );
    }
  }
  if (!parsed) {
    const nat = new Date(cleaned);
    if (!Number.isNaN(nat.getTime())) parsed = nat;
  }
  if (!parsed || Number.isNaN(parsed.getTime())) return null;
  const now = Date.now();
  if (parsed.getTime() < Date.UTC(2015, 0, 1) || parsed.getTime() > now + 24 * 60 * 60 * 1000) {
    return null;
  }
  return parsed;
}

function inferCategory(title: string, summary: string | null, fallback: string): string {
  const hay = `${title} ${summary || ""}`.toLowerCase();
  if (/alert|warning|heavy rain|curfew|emergency|accident|इशारा|अतिवृष्टी|अपघात/.test(hay)) return "alerts";
  if (/water|electricity|msedcl|road|municipal|panchayat|पाणी|वीज|रस्ता|नगर|पंचायत/.test(hay)) return "civic";
  if (/farmer|cotton|banana|crop|soybean|krishi|monsoon|शेतकरी|कापूस|केळी|पीक|पाऊस/.test(hay)) return "agriculture";
  if (/school|college|exam|university|admission|शाळा|कॉलेज|परीक्षा|शिक्षण/.test(hay)) return "education";
  if (/market|mandi|rate|price|gold|apmc|बाजार|भाव|मंडी|सोने/.test(hay)) return "markets";
  if (/cricket|tournament|kabaddi|sports|medal|स्पर्धा|क्रिकेट|क्रीडा/.test(hay)) return "sports";
  return fallback || "local";
}

function extractTag(block: string, tag: string): string {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = block.match(re);
  return m ? m[1].trim() : "";
}

function extractAttr(block: string, tag: string, attr: string): string {
  const re = new RegExp(`<${tag}[^>]*\\b${attr}=["']([^"']+)["'][^>]*>`, "i");
  const m = block.match(re);
  return m ? m[1].trim() : "";
}

function isBlockedIp(ip: string): boolean {
  const clean = ip.replace(/^\[|\]$/g, "").split("%")[0].toLowerCase();
  if (!clean) return true;

  // IPv6 checks
  if (clean.includes(":")) {
    if (clean === "::" || clean === "::1") return true;
    // IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1 or ::ffff:7f00:1)
    if (clean.startsWith("::ffff:")) {
      const tail = clean.slice(7);
      if (tail.includes(".")) return isBlockedIp(tail);
      const parts = tail.split(":");
      if (parts.length === 2) {
        const hi = parseInt(parts[0], 16);
        const lo = parseInt(parts[1], 16);
        if (!Number.isNaN(hi) && !Number.isNaN(lo)) {
          const v4 = `${(hi >> 8) & 255}.${hi & 255}.${(lo >> 8) & 255}.${lo & 255}`;
          return isBlockedIp(v4);
        }
      }
      return true;
    }
    // Unique local (fc00::/7) and link-local (fe80::/10)
    if (/^(fc|fd|fe[89ab])[0-9a-f]/i.test(clean)) return true;
    return false;
  }

  // IPv4 checks
  const octets = clean.split(".").map((s) => Number(s));
  if (octets.length !== 4 || octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b] = octets;
  if (a === 0 || a === 10 || a === 127) return true; // 0/8, 10/8, 127/8
  if (a === 169 && b === 254) return true; // Link-local / Cloud metadata 169.254.169.254
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12
  if (a === 192 && b === 168) return true; // 192.168/16
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64/10
  if (a === 192 && b === 0) return true; // 192.0.0/24, 192.0.2/24
  if (a >= 224) return true; // Multicast & reserved
  return false;
}

async function assertSafeExternalUrl(rawUrl: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("Invalid URL syntax");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http and https URLs are allowed");
  }
  if (parsed.username || parsed.password) {
    throw new Error("URLs with embedded credentials are not allowed");
  }

  const host = parsed.hostname.toLowerCase().replace(/\.$/, "");
  if (
    !host ||
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "metadata.google.internal" ||
    host === "metadata"
  ) {
    throw new Error("Internal/metadata hosts are blocked");
  }

  // Literal IP check
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(":")) {
    if (isBlockedIp(host)) {
      throw new Error("Private or loopback IP address blocked");
    }
    return parsed;
  }

  // DNS resolution check (guards against DNS rebinding / localtest.me aliases)
  try {
    const resolvedA = await Deno.resolveDns(host, "A").catch(() => [] as string[]);
    const resolvedAAAA = await Deno.resolveDns(host, "AAAA").catch(() => [] as string[]);
    const allIps = [...resolvedA, ...resolvedAAAA];
    if (allIps.length === 0) {
      throw new Error("Could not resolve target hostname");
    }
    for (const ip of allIps) {
      if (isBlockedIp(ip)) {
        throw new Error(`Target host resolved to blocked IP (${ip})`);
      }
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes("blocked")) throw err;
    throw new Error("DNS resolution blocked or failed for target URL");
  }

  return parsed;
}

async function fetchWithTimeout(url: string, ms = 12000, maxRedirects = 2): Promise<string> {
  let currentUrl = (await assertSafeExternalUrl(url)).toString();

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), ms);
    try {
      const res = await fetch(currentUrl, {
        signal: controller.signal,
        redirect: "manual",
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; ApnaTownNewsBot/1.0; +https://apnatown.in)",
          Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, text/html",
        },
      });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        try {
          await res.body?.cancel();
        } catch {
          /* ignore */
        }
        if (!loc || hop === maxRedirects) {
          throw new Error(`Unsafe or excessive redirect (${res.status})`);
        }
        currentUrl = (await assertSafeExternalUrl(new URL(loc, currentUrl).toString())).toString();
        continue;
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      return await res.text();
    } finally {
      clearTimeout(id);
    }
  }
  throw new Error("Too many redirects");
}

function parseRssXml(xml: string, meta: { cityId: string; sourceId?: string | null; sourceName: string; language: string; defaultCategory: string }) {
  const isAtom = /<entry[\s>]/i.test(xml) && !/<item[\s>]/i.test(xml);
  const blockRe = isAtom ? /<entry\b[^>]*>([\s\S]*?)<\/entry>/gi : /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  const items: any[] = [];
  let skippedInvalidDate = 0;

  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(xml)) !== null) {
    const b = m[1];
    const rawTitle = stripHtml(extractTag(b, "title"));
    if (!rawTitle) continue;
    const rawLink = stripHtml(extractTag(b, "link")) || extractAttr(b, "link", "href") || stripHtml(extractTag(b, "guid"));
    const rawDate = stripHtml(extractTag(b, "pubDate")) || stripHtml(extractTag(b, "dc:date")) || stripHtml(extractTag(b, "published")) || stripHtml(extractTag(b, "updated"));
    const parsedDate = parseNewsDate(rawDate);
    if (!parsedDate) {
      skippedInvalidDate += 1;
      continue;
    }

    const rawDesc = extractTag(b, "description") || extractTag(b, "summary") || extractTag(b, "content:encoded");
    const splitIdx = rawTitle.lastIndexOf(" - ");
    const title = splitIdx > 15 ? rawTitle.slice(0, splitIdx).trim() : rawTitle;
    const tagSource = stripHtml(extractTag(b, "source"));
    const splitSource = splitIdx > 15 ? rawTitle.slice(splitIdx + 3).trim() : "";
    const sourceName = tagSource || splitSource || meta.sourceName;

    const cleanSummary = stripHtml(rawDesc).slice(0, 320);
    const lang = /[\u0900-\u097F]/.test(title) ? "mr" : meta.language || "en";
    const imageUrl =
      extractAttr(b, "media:content", "url") ||
      extractAttr(b, "media:thumbnail", "url") ||
      extractAttr(b, "enclosure", "url") ||
      rawDesc.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] ||
      null;

    items.push({
      city_id: meta.cityId,
      source_id: meta.sourceId || null,
      title,
      title_mr: lang === "mr" ? title : null,
      summary: cleanSummary && cleanSummary !== title ? cleanSummary : null,
      summary_mr: lang === "mr" && cleanSummary && cleanSummary !== title ? cleanSummary : null,
      category: inferCategory(title, cleanSummary, meta.defaultCategory),
      language: lang,
      source_name: sourceName,
      source_url: rawLink || null,
      image_url: imageUrl,
      published_at: parsedDate.toISOString(),
      scraped_at: new Date().toISOString(),
      is_pinned: false,
      is_active: true,
    });
  }
  return { items, skippedInvalidDate };
}

function parseWebpageHtml(html: string, url: string, meta: { cityId: string; sourceId?: string | null; sourceName: string; language: string; defaultCategory: string }) {
  const getMeta = (attr: string, name: string) => {
    const p1 = new RegExp(`<meta[^>]+${attr}=["']${name}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i");
    const p2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+${attr}=["']${name}["'][^>]*>`, "i");
    return decodeEntities((html.match(p1)?.[1] || html.match(p2)?.[1] || "").trim());
  };

  const title = getMeta("property", "og:title") || getMeta("name", "twitter:title") || stripHtml(extractTag(html, "title"));
  if (!title) return null;

  const rawDate =
    getMeta("property", "article:published_time") ||
    getMeta("name", "pubdate") ||
    getMeta("name", "publish-date") ||
    getMeta("property", "og:updated_time") ||
    html.match(/"datePublished"\s*:\s*"([^"]+)"/i)?.[1] ||
    html.match(/<time[^>]+datetime=["']([^"']+)["']/i)?.[1];

  const parsedDate = parseNewsDate(rawDate);
  if (!parsedDate) return null;

  const summary = getMeta("property", "og:description") || getMeta("name", "description") || null;
  const imageUrl = getMeta("property", "og:image") || getMeta("name", "twitter:image") || null;
  const lang = /[\u0900-\u097F]/.test(title) ? "mr" : meta.language || "en";
  let sourceName = meta.sourceName;
  try {
    sourceName = getMeta("property", "og:site_name") || new URL(url).hostname.replace(/^www\./, "");
  } catch { /* ignore */ }

  return {
    city_id: meta.cityId,
    source_id: meta.sourceId || null,
    title,
    title_mr: lang === "mr" ? title : null,
    summary: summary ? summary.slice(0, 320) : null,
    summary_mr: lang === "mr" && summary ? summary.slice(0, 320) : null,
    category: inferCategory(title, summary, meta.defaultCategory),
    language: lang,
    source_name: sourceName,
    source_url: url,
    image_url: imageUrl,
    published_at: parsedDate.toISOString(),
    scraped_at: new Date().toISOString(),
    is_pinned: false,
    is_active: true,
  };
}

function parseWebpageListingOrArticle(
  html: string,
  url: string,
  meta: { cityId: string; sourceId?: string | null; sourceName: string; language: string; defaultCategory: string },
) {
  const resolveAbs = (href: string) => {
    const c = decodeEntities(href).trim();
    if (!c || c.startsWith("#") || /^javascript:/i.test(c)) return null;
    try {
      return new URL(c, url).toString();
    } catch {
      return null;
    }
  };

  let hostSite = meta.sourceName;
  const ogSite = html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i)?.[1];
  if (ogSite) hostSite = decodeEntities(ogSite.trim());
  else {
    try {
      hostSite = new URL(url).hostname.replace(/^www\./, "");
    } catch { /* ignore */ }
  }

  const items: any[] = [];
  const seen = new Set<string>();
  let skippedInvalidDate = 0;

  for (const m of html.matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/gi)) {
    if (items.length >= 25) break;
    const b = m[1];
    const candidates: Array<{ title: string; href: string; score: number }> = [];
    for (const hm of [
      ...b.matchAll(/<(?:h[1-4]|div|span)[^>]*\b(?:title|headline|entry-title)[^>]*>[\s\S]*?<a\b([^>]*)>([\s\S]*?)<\/a>/gi),
      ...b.matchAll(/<h[1-4]\b[^>]*>[\s\S]*?<a\b([^>]*)>([\s\S]*?)<\/a>/gi),
    ]) {
      const href = hm[1].match(/\bhref=["']([^"']+)["']/i)?.[1];
      const abs = href ? resolveAbs(href) : null;
      const title = stripHtml(hm[2] || "");
      if (abs && title.length >= 10) candidates.push({ title, href: abs, score: 100 });
    }
    for (const am of b.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
      const href = am[1].match(/\bhref=["']([^"']+)["']/i)?.[1];
      const abs = href ? resolveAbs(href) : null;
      if (!abs || /\/(author|tag|category|about)\//i.test(abs)) continue;
      const txt = stripHtml(am[2] || "");
      if (txt.length >= 10) candidates.push({ title: txt, href: abs, score: 60 });
    }
    if (candidates.length === 0) continue;
    candidates.sort((a, c2) => c2.score - a.score);
    const chosen = candidates[0];

    let parsedDate: Date | null = null;
    for (const tm of b.matchAll(/<time\b([^>]*)>([\s\S]*?)<\/time>/gi)) {
      const dtAttr = tm[1].match(/\bdatetime=["']([^"']+)["']/i)?.[1];
      parsedDate = parseNewsDate(dtAttr) || parseNewsDate(stripHtml(tm[2]).replace(/^Updated:\s*/i, ""));
      if (parsedDate) break;
    }
    if (!parsedDate) {
      skippedInvalidDate += 1;
      continue;
    }
    if (seen.has(chosen.href)) continue;
    seen.add(chosen.href);

    const pText = stripHtml(b.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i)?.[1] || "");
    const summary = pText && pText !== chosen.title ? pText.slice(0, 320) : null;
    const imgAttrs = b.match(/<img\b([^>]*)>/i)?.[1] || "";
    const rawImg =
      imgAttrs.match(/\bdata-(?:lazy-)?src=["']([^"']+)["']/i)?.[1] ||
      imgAttrs.match(/\bsrc=["']([^"']+)["']/i)?.[1];
    const imageUrl = rawImg && !/default-ie\.jpg|placeholder|1x1|\.svg$/i.test(rawImg) ? resolveAbs(rawImg) : null;
    const lang = /[\u0900-\u097F]/.test(chosen.title) ? "mr" : meta.language || "en";

    items.push({
      city_id: meta.cityId,
      source_id: meta.sourceId || null,
      title: chosen.title,
      title_mr: lang === "mr" ? chosen.title : null,
      summary,
      summary_mr: lang === "mr" && summary ? summary : null,
      category: inferCategory(chosen.title, summary, meta.defaultCategory),
      language: lang,
      source_name: hostSite,
      source_url: chosen.href,
      image_url: imageUrl,
      published_at: parsedDate.toISOString(),
      scraped_at: new Date().toISOString(),
      is_pinned: false,
      is_active: true,
    });
  }

  if (items.length > 0) return { items, skippedInvalidDate };
  const single = parseWebpageHtml(html, url, meta);
  return single ? { items: [single], skippedInvalidDate } : { items: [], skippedInvalidDate: Math.max(1, skippedInvalidDate) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceKey) {
      return new Response(JSON.stringify({ error: "Server configuration missing" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Require valid authenticated admin JWT (never allow anonymous scraping or service-role writes)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized: admin bearer token required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userSb = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: authErr } = await userSb.auth.getUser();
    if (authErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized: invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: isAdmin, error: roleErr } = await userSb.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (roleErr || !isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden: admin role required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const cityId = typeof body?.cityId === "string" ? body.cityId.trim() : "";
    const customUrl = typeof body?.customUrl === "string" ? body.customUrl.trim() : "";
    const saveToDb = body?.saveToDb !== false;
    const sourcesInput = Array.isArray(body?.sources) ? body.sources.slice(0, 15) : [];

    if (!cityId || !UUID_RE.test(cityId)) {
      return new Response(JSON.stringify({ error: "Valid cityId UUID is required." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (customUrl) {
      try {
        await assertSafeExternalUrl(customUrl);
      } catch (ssrfErr: any) {
        return new Response(JSON.stringify({ error: ssrfErr?.message || "Invalid or blocked target URL" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const sb = createClient(supabaseUrl, serviceKey);

    let targets = sourcesInput;
    if (!customUrl && targets.length === 0) {
      const { data: dbSources } = await sb
        .from("news_sources")
        .select("*")
        .eq("city_id", cityId)
        .eq("is_active", true);
      targets = dbSources || [];
    }

    if (customUrl) {
      targets = [
        {
          id: null,
          name: body?.customSourceName || "Web Article",
          source_type: body?.customSourceType === "rss" ? "rss" : "webpage",
          url: customUrl,
          language: body?.language || "mr",
          category_default: body?.category || "local",
        },
      ];
    }

    const allItems: any[] = [];
    const reports: any[] = [];
    const seenUrls = new Set<string>();

    for (const src of targets) {
      const url = typeof src?.url === "string" ? src.url.trim() : "";
      if (!url || !/^https?:\/\//i.test(url)) continue;

      try {
        const rawText = await fetchWithTimeout(url);
        let parsedItems: any[] = [];
        let skippedInvalidDate = 0;

        if (src.source_type === "webpage" && !/<(rss|feed|channel)\b/i.test(rawText.slice(0, 500))) {
          const parsedPage = parseWebpageListingOrArticle(rawText, url, {
            cityId,
            sourceId: src.id || null,
            sourceName: src.name || "Web Source",
            language: src.language || "mr",
            defaultCategory: src.category_default || "local",
          });
          parsedItems = parsedPage.items;
          skippedInvalidDate = parsedPage.skippedInvalidDate;
        } else {
          const rss = parseRssXml(rawText, {
            cityId,
            sourceId: src.id || null,
            sourceName: src.name || "RSS Feed",
            language: src.language || "mr",
            defaultCategory: src.category_default || "local",
          });
          parsedItems = rss.items;
          skippedInvalidDate = rss.skippedInvalidDate;
        }

        const uniqueForSource = parsedItems.slice(0, 20).filter((it) => {
          const key = it.source_url || it.title.toLowerCase();
          if (seenUrls.has(key)) return false;
          seenUrls.add(key);
          return true;
        });

        allItems.push(...uniqueForSource);
        reports.push({
          sourceName: src.name || url,
          url,
          fetched: uniqueForSource.length,
          inserted: uniqueForSource.length,
          skippedInvalidDate,
        });

        if (src.id && saveToDb) {
          await sb
            .from("news_sources")
            .update({
              last_scraped_at: new Date().toISOString(),
              last_status: `OK (${uniqueForSource.length} items)`,
            })
            .eq("id", src.id);
        }
      } catch (err: any) {
        reports.push({
          sourceName: src.name || url,
          url,
          fetched: 0,
          inserted: 0,
          skippedInvalidDate: 0,
          error: err?.message || "Fetch failed",
        });
      }
    }

    allItems.sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime());

    let insertedCount = 0;
    if (saveToDb && allItems.length > 0) {
      const withUrls = allItems.filter((i) => i.source_url);
      if (withUrls.length > 0) {
        const { data: existingRows } = await sb
          .from("local_news")
          .select("id, source_url")
          .eq("city_id", cityId)
          .not("source_url", "is", null)
          .limit(1000);

        const existingMap = new Map<string, string>();
        for (const r of existingRows || []) {
          if (r?.source_url && r?.id) existingMap.set(r.source_url, r.id);
        }

        const toInsert = withUrls.filter((r) => !existingMap.has(r.source_url));
        const toUpdate = withUrls.filter((r) => existingMap.has(r.source_url));

        if (toInsert.length > 0) {
          const { data: inserted } = await sb.from("local_news").insert(toInsert).select("id");
          insertedCount = inserted?.length || toInsert.length;
        }
        if (toUpdate.length > 0) {
          await Promise.all(
            toUpdate.map((r) =>
              sb
                .from("local_news")
                .update({
                  title: r.title,
                  title_mr: r.title_mr,
                  summary: r.summary,
                  summary_mr: r.summary_mr,
                  category: r.category,
                  language: r.language,
                  source_name: r.source_name,
                  image_url: r.image_url,
                  published_at: r.published_at,
                  scraped_at: r.scraped_at,
                })
                .eq("id", existingMap.get(r.source_url)!),
            ),
          );
        }
      }
    }

    return new Response(
      JSON.stringify({
        items: allItems,
        fetchedCount: allItems.length,
        insertedCount,
        reports,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message || "Unexpected scraper error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
