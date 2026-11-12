// @ts-nocheck -- synced from upstream; loosely typed Supabase/AI Gateway calls fail strict Deno checks.
import { createClient } from "npm:@supabase/supabase-js@2";
import { generateChatCompletion } from "npm:@lovable.dev/ai-gateway";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type EntityType = "mess" | "pg" | "shop" | "bus" | "school" | "news" | "service";

export interface AssistantRecommendation {
  entityType: EntityType;
  id: string;
  slug?: string | null;
  title: string;
  highlightBadge: string;
  reason: string;
  area?: string | null;
  phone?: string | null;
  externalUrl?: string | null;
  priority?: "low" | "medium" | "high" | "critical";
}

export interface AssistantResponsePayload {
  replyText: string;
  detectedLanguage: "en" | "mr" | "hinglish";
  mode: "gemini" | "local-fallback";
  recommendations: AssistantRecommendation[];
  followUpSuggestions: string[];
}

const PARANDWADI_SEED_BUSES = [
  {
    id: "parandwadi-seed-1",
    destination: "Nigdi (Bhakti Shakti / Pawale Chowk)",
    destination_mr: "निगडी (भक्ती शक्ती / पावले चौक)",
    departure_times: ["07:30", "09:30", "12:05", "16:35", "18:35"],
    notes: "[Outgoing] · [PMPML] · via Somatane Phata, Dehu Road · PMPML Route 342: Urse -> Parandwadi ZP School -> Nigdi",
  },
  {
    id: "parandwadi-seed-2",
    destination: "Urse Gaon (Vasudev Ashram)",
    destination_mr: "उर्से गाव (वासुदेव आश्रम)",
    departure_times: ["07:15", "09:10", "11:45", "16:20", "18:25"],
    notes: "[Incoming] · [PMPML] · via Parandwadi · PMPML Route 342: Nigdi -> Dehu Road -> Parandwadi -> Urse Gaon",
  },
  {
    id: "parandwadi-seed-3",
    destination: "Somatane Phata (Highway Junction)",
    destination_mr: "सोमाटणे फाटा (हायवे जंक्शन)",
    departure_times: ["06:30", "07:30", "08:30", "09:30", "10:30", "11:30", "12:05", "13:30", "14:30", "15:30", "16:35", "17:30", "18:35", "19:30", "20:30"],
    notes: "[Outgoing] · [Local Shuttle] · Highway feeder connecting Parandwadi to Pune & Talegaon",
  },
  {
    id: "parandwadi-seed-4",
    destination: "Talegaon Dabhade ST Stand",
    destination_mr: "तळेगाव दाभाडे एसटी बसस्थानक",
    departure_times: ["06:45", "07:45", "08:45", "09:45", "11:15", "12:45", "14:15", "15:45", "17:15", "18:45", "20:00"],
    notes: "[Outgoing] · [MSRTC Ordinary] · via Somatane Phata, Talegaon Station Road",
  },
  {
    id: "parandwadi-seed-5",
    destination: "Pune Station / Shivajinagar",
    destination_mr: "पुणे स्टेशन / शिवाजीनगर",
    departure_times: ["06:30", "07:30", "08:30", "10:00", "12:00", "14:00", "16:00", "17:30", "19:00"],
    notes: "[Outgoing] · [Express] · via Somatane Phata, Dehu Road connecting MSRTC Express & PMPML",
  },
];

function getTodayISTDate(): string {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().slice(0, 10);
}

function getNowISTMinutes(): number {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.getUTCHours() * 60 + ist.getUTCMinutes();
}

function getCurrentISTFormatted(): string {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  const hh = String(ist.getUTCHours()).padStart(2, "0");
  const mm = String(ist.getUTCMinutes()).padStart(2, "0");
  return `${getTodayISTDate()} ${hh}:${mm} IST`;
}

function detectQueryLanguage(q: string): "en" | "mr" | "hinglish" {
  if (/[\u0900-\u097F]/.test(q)) return "mr";
  if (
    /\b(kay|kuthe|kashi|kasa|ahe|aahe|madhe|swast|jevan|khana|kaha|sasta|batao|pudchi|kadi|kadhi|batmya|taajya|taja|shala|pravesh|paani|pani|vij|band|kiti|bhada)\b/i.test(
      q,
    )
  ) {
    return "hinglish";
  }
  return "en";
}

const REGULAR_MENU_DATE = "1970-01-01";

const QUERY_STOP_WORDS = new Set([
  "the", "and", "for", "with", "near", "from", "that", "this", "what", "when", "where",
  "which", "who", "how", "are", "was", "were", "can", "you", "your", "our", "any",
  "best", "good", "top", "find", "show", "give", "tell", "me", "please", "about",
  "hai", "ahe", "aahe", "kaha", "kuthe", "madhe",
]);

function tokenizeQuery(q: string): string[] {
  return q
    .toLowerCase()
    .replace(/[?.,!'"()]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !QUERY_STOP_WORDS.has(t));
}

function classifySpecializedShopDomain(
  shop: { name?: string | null; slug?: string | null },
  categories: string[],
  hasMessProfile: boolean,
  hasPgProfile: boolean,
): "mess" | "pg" | null {
  if (hasPgProfile) return "pg";
  if (hasMessProfile) return "mess";

  for (const cat of categories) {
    const lower = cat.toLowerCase();
    if (
      /\bpg\b/i.test(cat) ||
      lower.includes("paying guest") ||
      lower.includes("hostel") ||
      lower.includes("वसतिगृह") ||
      lower.includes("पीजी")
    ) {
      return "pg";
    }
  }

  for (const cat of categories) {
    const lower = cat.toLowerCase();
    if (
      lower.includes("mess") ||
      lower.includes("dining") ||
      lower.includes("tiffin") ||
      lower.includes("bhojanalay") ||
      lower.includes("भोजनालय") ||
      lower.includes("टिफिन") ||
      lower.includes("hotel") ||
      lower.includes("हॉटेल") ||
      lower.includes("restaurant") ||
      lower.includes("रेस्टॉरंट") ||
      lower.includes("dhaba") ||
      lower.includes("ढाबा") ||
      lower.includes("khanawal") ||
      lower.includes("खानावळ")
    ) {
      return "mess";
    }
  }

  const rawName = String(shop?.name || "");
  const slugWords = String(shop?.slug || "").replace(/-/g, " ");
  const combined = `${rawName} ${slugWords}`.trim();
  const lower = combined.toLowerCase();

  if (
    /\bpg\b/i.test(combined) ||
    lower.includes("paying guest") ||
    lower.includes("hostel") ||
    lower.includes("वसतिगृह") ||
    lower.includes("पीजी") ||
    (/\brooms?\b/i.test(combined) && /(boy|girl|student|stay|rent|executive|residency)/i.test(combined))
  ) {
    return "pg";
  }

  if (
    lower.includes("bhojanalay") ||
    lower.includes("भोजनालय") ||
    /\bmess\b/i.test(combined) ||
    lower.includes("tiffin") ||
    lower.includes("टिफिन") ||
    /\bhotel\b/i.test(combined) ||
    lower.includes("हॉटेल") ||
    lower.includes("restaurant") ||
    lower.includes("रेस्टॉरंट") ||
    lower.includes("dhaba") ||
    lower.includes("ढाबा") ||
    lower.includes("khanawal") ||
    lower.includes("खानावळ") ||
    lower.includes("dining hall")
  ) {
    return "mess";
  }

  return null;
}

function formatRegularMenuSummary(lunchText: string | null | undefined): string[] {
  if (!lunchText) return [];
  try {
    const parsed = JSON.parse(lunchText);
    if (!Array.isArray(parsed)) return [];
    const out: string[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      if (item.is_available === false) continue;
      const name = String(item.name || "").trim();
      if (!name) continue;
      const priceNum = Number(item.price);
      out.push(Number.isFinite(priceNum) && priceNum > 0 ? `${name} (₹${priceNum})` : name);
      if (out.length >= 25) break;
    }
    return out;
  } catch {
    return [];
  }
}

function rankByQuery<T>(items: T[], getHaystack: (item: T) => string, tokens: string[]): T[] {
  if (tokens.length === 0) return items;
  return [...items]
    .map((item, idx) => {
      const hay = getHaystack(item).toLowerCase();
      let score = 0;
      for (const t of tokens) {
        if (hay.includes(t)) score += 1;
      }
      return { item, score, idx };
    })
    .sort((a, b) => (b.score !== a.score ? b.score - a.score : a.idx - b.idx))
    .map((x) => x.item);
}

async function fetchGoogleNewsRssFallback(cityId: string, cityName: string): Promise<any[]> {
  try {
    const q = encodeURIComponent(`${cityName} Maharashtra when:14d`);
    const url = `https://news.google.com/rss/search?q=${q}&hl=mr&gl=IN&ceid=IN:mr`;
    const res = await fetch(url, { signal: AbortSignal.timeout(2800) });
    if (!res.ok) return [];
    const xml = await res.text();
    const out: any[] = [];
    const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/gi);
    let idx = 0;
    for (const m of itemMatches) {
      if (idx >= 8) break;
      const block = m[1];
      const titleMatch = block.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
      const linkMatch = block.match(/<link>([\s\S]*?)<\/link>/i);
      const dateMatch = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i);
      const sourceMatch = block.match(/<source[^>]*>([\s\S]*?)<\/source>/i);
      const title = (titleMatch?.[1] || "").replace(/<[^>]+>/g, "").trim();
      const sourceUrl = (linkMatch?.[1] || "").trim() || null;
      if (!title) continue;
      idx += 1;
      out.push({
        id: `rss-${cityId.slice(0, 8)}-${idx}`,
        title,
        title_mr: title,
        summary: null,
        summary_mr: null,
        category: "local",
        source_name: (sourceMatch?.[1] || "Google News").replace(/<[^>]+>/g, "").trim(),
        source_url: sourceUrl,
        published_at: dateMatch?.[1] || new Date().toISOString(),
        is_pinned: false,
      });
    }
    return out;
  } catch {
    return [];
  }
}

function buildLocalFallbackResponse(
  query: string,
  locationLabel: string,
  context: {
    messes: any[];
    pgs: any[];
    shops: any[];
    buses: any[];
    schools: any[];
    news: any[];
    services: any[];
  },
  history: Array<{ role: string; text: string }> = [],
): AssistantResponsePayload {
  const q = query.toLowerCase();
  const lang = detectQueryLanguage(query);
  const isMr = lang === "mr";
  const recs: AssistantRecommendation[] = [];

  const testIntents = (text: string) => {
    const isService =
      /water\s*supply|water\s*cut|\bwater\b|\bpaani\b|\bpani\b|पाणी|electricity|power\s*cut|outage|load\s*shedding|msedcl|mseb|mahavitaran|वीज|बत्ती|municipal|nagar\s*panchayat|nagar\s*parishad|gram\s*panchayat|नगरपंचायत|नगरपरिषद|helpline|emergency|ambulance|police|हेल्पलाईन|तातडी|पोलीस|रुग्णवाहिका/i.test(
        text,
      );
    const isSchool =
      /school|schools|college|colleges|class|coaching|education|study|institute|admission|admissions|pravesh|scholarship|\biti\b|polytechnic|diploma|engineering|university|abhyasika|शाळा|कॉलेज|महाविद्यालय|प्रवेश|शिष्यवृत्ती|अभ्यासिका|परीक्षा|परिपत्रक/i.test(
        text,
      );
    const hasLiving = /\bpg\b|\bhostel\b|paying\s*guest|वसतिगृह|पीजी|खोली|राहण्यासाठी/i.test(text);
    const isSpecialFood =
      !hasLiving &&
      /\bcook(?:ed|s|ing)?\b|special|menu|thali|today|spcl|\bdish(?:es)?\b|\bhotel\b|हॉटेल|restaurant|रेस्टॉरंट|dhaba|ढाबा|bhojanalay|भोजनालय|khanawal|खानावळ|misal|biryani|nashta|breakfast|स्पेशल|मेनू|आज|जेवण|खास|kay banla|kya bana/i.test(
        text,
      );
    const isAffordableFood =
      !hasLiving &&
      /cheap|afford|budget|meal|meals|food|mess|tiffin|lunch|dinner|eat|\bhotel\b|हॉटेल|restaurant|रेस्टॉरंट|dhaba|ढाबा|bhojanalay|भोजनालय|khanawal|खानावळ|misal|biryani|khana|jevan|swast|sasta|स्वस्त|जेवण|मेस|थाळी|टिफिन/i.test(
        text,
      );
    const isPg = /\bpg\b|hostel|paying\s*guest|room|rooms|bed|beds|rent|stay|accommodation|boys|girls|खोली|पीजी|वसतिगृह|राहण्यासाठी/i.test(
      text,
    );
    const hasExplicitBusKeyword =
      /\bbus\b|buses|\bstand\b|timetable|schedule|depart|pmpml|msrtc|बस|वेळापत्रक|कधी/i.test(text);
    const hasShopKeyword =
      /\bshop\b|shops|store|stores|kirana|grocery|medical|pharmacy|chemist|hardware|electronics|mobile|bakery|dairy|salon|parlour|bazar|dukan|दुकान|किराणा|मेडिकल/i.test(
        text,
      );
    const isBus =
      (hasExplicitBusKeyword &&
        !(hasShopKeyword && !/\btimetable|\bschedule|\bpmpml|\bmsrtc|वेळापत्रक/i.test(text)) &&
        !(isSchool && !/\bbus\s*stand|\btimetable|\bschedule|\bpmpml|\bmsrtc|\bbus\b/i.test(text))) ||
      (/\b(to|from)\s+(pune|jalgaon|malkapur|bhusawal|parandwadi|talegaon|nigdi|urse|somatane|hinjawadi|lonavala|dehu)\b/i.test(
        text,
      ) &&
        !isSchool &&
        !hasShopKeyword &&
        !isService);
    const isNews =
      !isSchool &&
      !isService &&
      /\bnews\b|headline|batmya|samachar|mandi\s*bhav|बातम्या|ताज्या|वृत्त|घडामोडी|बाजारभाव/i.test(text);
    return { isService, isSchool, isSpecialFood, isAffordableFood, isPg, isBus, isNews };
  };

  let intents = testIntents(q);
  if (
    !intents.isService &&
    !intents.isNews &&
    !intents.isSpecialFood &&
    !intents.isAffordableFood &&
    !intents.isPg &&
    !intents.isBus &&
    !intents.isSchool &&
    history.length > 0
  ) {
    const prevUser = [...history].reverse().find((h) => h.role === "user");
    if (prevUser?.text) intents = testIntents(prevUser.text.toLowerCase());
  }

  const formatMessRec = (m: any): AssistantRecommendation => {
    const rateBadge = m.single_thali_rate
      ? `₹${m.single_thali_rate} Thali`
      : m.monthly_rate
        ? `₹${m.monthly_rate}/mo`
        : m.categories?.[0] || "Mess & Dining";
    const badge = m.special_tag ? `Special: ${m.special_tag}` : rateBadge;
    const regularSnippet =
      Array.isArray(m.regular_menu) && m.regular_menu.length > 0
        ? m.regular_menu.slice(0, 4).join(", ")
        : null;
    const menuSnippet = m.lunch_text || m.dinner_text || m.special_tag || regularSnippet;
    return {
      entityType: "mess",
      id: m.id,
      slug: m.slug,
      title: isMr && m.name_mr ? m.name_mr : m.name,
      highlightBadge: badge,
      reason: menuSnippet
        ? `Menu: ${menuSnippet}${m.single_thali_rate ? ` · ₹${m.single_thali_rate}` : ""}`
        : `${m.mess_type === "pure_veg" ? "Pure Veg" : "Veg / Non-Veg"}${m.area ? ` · ${m.area}` : ""}`,
      area: m.area,
      phone: m.phone || null,
    };
  };

  const formatPgRec = (p: any): AssistantRecommendation => ({
    entityType: "pg",
    id: p.id,
    slug: p.slug,
    title: isMr && p.name_mr ? p.name_mr : p.name,
    highlightBadge:
      typeof p.available_beds === "number" && p.available_beds > 0
        ? `${p.available_beds} Beds Open`
        : p.gender || "PG / Hostel",
    reason: `${p.gender || "Open"}${p.food_included ? " · Food Included" : ""}${p.area ? ` · ${p.area}` : ""}`,
    area: p.area,
    phone: p.phone || null,
  });

  if (intents.isService) {
    for (const srv of context.services.slice(0, 5)) {
      recs.push({
        entityType: "service",
        id: srv.id,
        title: isMr && srv.title_mr ? srv.title_mr : srv.title,
        highlightBadge: srv.highlightBadge,
        reason: isMr && srv.reason_mr ? srv.reason_mr : srv.reason,
        area: srv.area || locationLabel,
        phone: srv.phone || null,
        priority: srv.priority,
      });
    }
  } else if (intents.isNews) {
    for (const item of context.news.slice(0, 4)) {
      recs.push({
        entityType: "news",
        id: item.id,
        title: isMr && item.title_mr ? item.title_mr : item.title,
        highlightBadge: item.is_pinned ? `📌 ${item.category || "News"}` : item.category || "Local News",
        reason: (isMr && item.summary_mr ? item.summary_mr : item.summary)?.slice(0, 110) || item.source_name || locationLabel,
        externalUrl: item.source_url || null,
      });
    }
  } else if (intents.isSpecialFood || intents.isAffordableFood) {
    const foodTokens = tokenizeQuery(q).filter(
      (t) =>
        !/^(cheap|afford|affordable|budget|meal|meals|food|mess|tiffin|lunch|dinner|eat|thali|menu|special|today|hotel|restaurant|dhaba|family)$/.test(
          t,
        ),
    );
    const scoreMess = (m: any) => {
      if (foodTokens.length === 0) return 0;
      const hay = `${m.name} ${m.name_mr || ""} ${m.area || ""} ${m.address || ""} ${(m.categories || []).join(" ")} ${m.lunch_text || ""} ${m.dinner_text || ""} ${m.special_tag || ""} ${(m.regular_menu || []).join(" ")}`.toLowerCase();
      return foodTokens.reduce((acc, tok) => acc + (hay.includes(tok) ? 1 : 0), 0);
    };

    const sortedMesses = [...context.messes].sort((a, b) => {
      const scoreDiff = scoreMess(b) - scoreMess(a);
      if (scoreDiff !== 0) return scoreDiff;
      if (intents.isSpecialFood) {
        const aSpcl = a.special_tag || a.lunch_text || a.dinner_text || (a.regular_menu?.length ? 1 : 0) ? 1 : 0;
        const bSpcl = b.special_tag || b.lunch_text || b.dinner_text || (b.regular_menu?.length ? 1 : 0) ? 1 : 0;
        if (aSpcl !== bSpcl) return bSpcl - aSpcl;
      }
      const aRate = a.single_thali_rate ?? a.monthly_rate ?? 99999;
      const bRate = b.single_thali_rate ?? b.monthly_rate ?? 99999;
      return aRate - bRate;
    });

    for (const m of sortedMesses.slice(0, 4)) {
      recs.push(formatMessRec(m));
    }
  } else if (intents.isPg) {
    const wantsBoys = /\b(boy|boys|male)\b|मुलां/i.test(q);
    const wantsGirls = /\b(girl|girls|female|ladies)\b|मुलीं/i.test(q);
    const filteredPgs = context.pgs.filter((p) => {
      if (wantsBoys) return p.gender === "boys" || p.gender === "both";
      if (wantsGirls) return p.gender === "girls" || p.gender === "both";
      return true;
    });
    const sortedPgs = [...(filteredPgs.length ? filteredPgs : context.pgs)].sort(
      (a, b) => (b.available_beds || 0) - (a.available_beds || 0),
    );
    for (const p of sortedPgs.slice(0, 4)) {
      recs.push(formatPgRec(p));
    }
  } else if (intents.isBus) {
    const nowMin = getNowISTMinutes();
    const matchedBuses = context.buses.filter((b) => {
      const hay = `${b.destination} ${b.destination_mr || ""} ${b.notes || ""}`.toLowerCase();
      const tokens = q.split(/\s+/).filter((t) => t.length > 2 && !/^(bus|next|when|depart|time|from|for|कधी|बस)$/.test(t));
      return tokens.length === 0 || tokens.some((tok) => hay.includes(tok));
    });
    for (const b of (matchedBuses.length ? matchedBuses : context.buses).slice(0, 4)) {
      const nextDep = (b.departure_times || []).find((t: string) => {
        const m = t.match(/^(\d{1,2}):(\d{2})$/);
        if (!m) return false;
        return parseInt(m[1], 10) * 60 + parseInt(m[2], 10) >= nowMin;
      });
      recs.push({
        entityType: "bus",
        id: b.id,
        title: isMr && b.destination_mr ? b.destination_mr : b.destination,
        highlightBadge: nextDep ? `Next: ${nextDep}` : `${(b.departure_times || []).length} buses/day`,
        reason: b.notes || `Departures: ${(b.departure_times || []).slice(0, 4).join(", ")}`,
      });
    }
  } else if (intents.isSchool) {
    for (const s of context.schools.slice(0, 4)) {
      const topNotice = Array.isArray(s.notices) ? s.notices[0] : null;
      recs.push({
        entityType: "school",
        id: s.id,
        slug: s.slug || null,
        title: isMr && s.name_mr ? s.name_mr : s.name,
        highlightBadge:
          s.admission_status === "open"
            ? isMr
              ? "प्रवेश सुरू"
              : "Admissions Open"
            : topNotice
              ? "📢 Live Notice"
              : s.medium
                ? `${s.medium} Medium`
                : s.school_type || "School",
        reason: topNotice
          ? `Notice: ${isMr && topNotice.title_mr ? topNotice.title_mr : topNotice.title}`
          : [s.board, s.available_seats ? `${s.available_seats} seats open` : null, s.address || s.area || locationLabel]
              .filter(Boolean)
              .join(" · "),
        area: s.area,
        phone: s.phone || null,
      });
    }
  } else {
    const filteredTokens = tokenizeQuery(
      q,
      /^(near|best|good|open|now|find|show|tell|give|list|want|need|where|what|which|when|with|from|into|onto|for|the|and|shop|shops|store|stores|dukan|in|at|on)$/i,
    );
    const tokens = filteredTokens.length > 0 ? filteredTokens : tokenizeQuery(q);

    const scoreCandidate = (primaryText: string, secondaryText: string): number => {
      if (tokens.length === 0) return 0;
      const pLower = primaryText.toLowerCase();
      const sLower = secondaryText.toLowerCase();
      let score = 0;
      for (const tok of tokens) {
        if (pLower.includes(tok)) score += 3;
        else if (sLower.includes(tok)) score += 1;
      }
      return score;
    };

    const crossCandidates: Array<{ score: number; rec: AssistantRecommendation }> = [];

    if (tokens.length > 0) {
      for (const m of context.messes) {
        const primary = [
          m.name,
          m.name_mr,
          m.lunch_text,
          m.dinner_text,
          m.special_tag,
          ...(m.categories || []),
          ...(m.regular_menu || []),
        ]
          .filter(Boolean)
          .join(" ");
        const score = scoreCandidate(primary, `${m.area || ""} ${m.address || ""}`);
        if (score > 0) {
          crossCandidates.push({ score, rec: formatMessRec(m) });
        }
      }

      for (const p of context.pgs) {
        const score = scoreCandidate(
          `${p.name} ${p.name_mr || ""} ${(p.categories || []).join(" ")}`,
          `${p.area || ""} ${p.address || ""}`,
        );
        if (score > 0) {
          crossCandidates.push({ score, rec: formatPgRec(p) });
        }
      }
    }

    for (const s of context.shops) {
      const score =
        tokens.length === 0
          ? 1
          : scoreCandidate(
              `${s.name} ${s.name_mr || ""} ${(s.categories || []).join(" ")} ${s.keywords || ""}`,
              `${s.area || ""} ${s.address || ""}`,
            );
      if (score > 0) {
        crossCandidates.push({
          score,
          rec: {
            entityType: "shop",
            id: s.id,
            slug: s.slug,
            title: isMr && s.name_mr ? s.name_mr : s.name,
            highlightBadge: s.is_verified ? "Verified" : s.categories?.[0] || "Local Shop",
            reason: `${s.area || locationLabel}${s.opening_time ? ` · ${s.opening_time}–${s.closing_time || ""}` : ""}`,
            area: s.area,
            phone: s.phone || null,
          },
        });
      }
    }

    if (crossCandidates.length > 0) {
      crossCandidates.sort((a, b) => b.score - a.score);
      const maxScore = crossCandidates[0].score;
      const focused =
        maxScore >= 3
          ? crossCandidates.filter((c) => c.score >= 3)
          : crossCandidates;
      for (const item of focused.slice(0, 4)) {
        recs.push(item.rec);
      }
    } else {
      for (const s of context.shops.slice(0, 4)) {
        recs.push({
          entityType: "shop",
          id: s.id,
          slug: s.slug,
          title: isMr && s.name_mr ? s.name_mr : s.name,
          highlightBadge: s.is_verified ? "Verified" : s.categories?.[0] || "Local Shop",
          reason: `${s.area || locationLabel}${s.opening_time ? ` · ${s.opening_time}–${s.closing_time || ""}` : ""}`,
          area: s.area,
          phone: s.phone || null,
        });
      }
    }
  }

  let replyText = "";
  if (recs.length === 0) {
    replyText =
      lang === "mr"
        ? `${locationLabel} मध्ये तुमच्या प्रश्नाशी जुळणारी माहिती सध्या उपलब्ध नाही. कृपया इतर शब्द वापरून शोधा.`
        : `I couldn't find an exact match in ${locationLabel} right now. Try asking about local news, mess meals, PG rooms, bus timings, colleges, or water/electricity helplines.`;
  } else {
    replyText =
      lang === "mr"
        ? `${locationLabel} मधील तुमच्या शोधासाठी ही सर्वात योग्य माहिती आहे:`
        : `Here are the top matches found in ${locationLabel} from our live directory:`;
  }

  return {
    replyText,
    detectedLanguage: lang,
    mode: "local-fallback",
    recommendations: recs,
    followUpSuggestions:
      lang === "mr"
        ? ["आजच्या ताज्या बातम्या", "प्रवेश सुरू असलेली कॉलेजेस?", "वीज / पाणी बंद सूचना व हेल्पलाईन"]
        : ["Today's local news", "College admissions open?", "Power / water helpline"],
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const sb = createClient(supabaseUrl, anonKey || serviceKey!);
    const rateSb = createClient(supabaseUrl, serviceKey || anonKey!);

    const forwardedFor = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || "anon";
    const clientIp = forwardedFor.split(",")[0].trim().slice(0, 64) || "anon";

    // AI Translation Mode (fallback when MyMemory API fails / hits daily limit / echoes English)
    if (body?.mode === "translate") {
      const rawTexts: string[] = Array.isArray(body?.texts)
        ? body.texts
        : typeof body?.text === "string"
          ? [body.text]
          : [];
      const cleanedTexts = rawTexts
        .map((t) => (typeof t === "string" ? t.trim().slice(0, 500) : ""))
        .filter(Boolean)
        .slice(0, 25);

      if (cleanedTexts.length === 0) {
        return new Response(
          JSON.stringify({ translations: [], error: "No valid texts supplied." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      try {
        const { data: allowed, error: rlErr } = await rateSb.rpc("apnatown_check_rate_limit", {
          _key: `translate:${clientIp}`,
          _window_secs: 60,
          _max_calls: 60,
        });
        if (!rlErr && allowed === false) {
          return new Response(
            JSON.stringify({ translations: [], error: "Translation rate limit exceeded." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      } catch {
        // Ignore if rate limit RPC is unavailable
      }

      const sourceLang = body?.sourceLang === "mr" ? "Marathi" : "English";
      const targetLang = body?.targetLang === "en" ? "English" : "Marathi (Devanagari script)";
      const systemPrompt =
        `You are an accurate Maharashtra town-directory translator translating from ${sourceLang} to ${targetLang}. ` +
        `Preserve proper names naturally by transliterating to Marathi Devanagari where helpful (e.g. "Parandwadi" -> "परंदवडी", "General Stores" -> "जनरल स्टोअर्स"). ` +
        `Return ONLY a valid JSON object matching { "translations": string[] } with the EXACT same length and order as the input array. No markdown or commentary.`;
      const userPrompt = JSON.stringify({ texts: cleanedTexts });

      const lovableKey = Deno.env.get("LOVABLE_API_KEY");
      const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
      let translations: string[] = [];

      if (lovableKey) {
        try {
          const aiRes = await generateChatCompletion({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "translations_batch",
                strict: true,
                schema: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    translations: { type: "array", items: { type: "string" } },
                  },
                  required: ["translations"],
                },
              },
            },
          });
          const rawOut = aiRes.choices?.[0]?.message?.content;
          const parsedOut = typeof rawOut === "string" ? JSON.parse(rawOut) : null;
          if (Array.isArray(parsedOut?.translations)) {
            translations = parsedOut.translations.map((x: any) => String(x || "").trim());
          }
        } catch (trErr) {
          console.error("[town-assistant] AI gateway translate error:", trErr);
        }
      }

      if (translations.length !== cleanedTexts.length && geminiApiKey) {
        try {
          const gemRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(geminiApiKey)}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                systemInstruction: { parts: [{ text: systemPrompt }] },
                contents: [{ role: "user", parts: [{ text: userPrompt }] }],
                generationConfig: { responseMimeType: "application/json" },
              }),
            },
          );
          if (gemRes.ok) {
            const gemJson = await gemRes.json();
            const rawText = gemJson?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
            const parsedGem = JSON.parse(rawText);
            if (Array.isArray(parsedGem?.translations)) {
              translations = parsedGem.translations.map((x: any) => String(x || "").trim());
            }
          }
        } catch (gemErr) {
          console.error("[town-assistant] Gemini REST translate error:", gemErr);
        }
      }

      if (translations.length === 0) {
        return new Response(
          JSON.stringify({ translations: [], error: "AI translation service unavailable." }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({ translations, mode: "ai-fallback" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const query = typeof body?.query === "string" ? body.query.trim().slice(0, 400) : "";
    const cityId = typeof body?.cityId === "string" ? body.cityId.trim() : "";
    const citySlug = typeof body?.citySlug === "string" ? body.citySlug.trim().toLowerCase() : "";
    const villageId = typeof body?.villageId === "string" && UUID_RE.test(body.villageId) ? body.villageId : null;
    const villageName = typeof body?.villageName === "string" ? body.villageName.trim() : "";
    const locationLabel = typeof body?.locationLabel === "string" ? body.locationLabel.trim() : "your town";
    const history: Array<{ role: "user" | "assistant"; text: string }> = Array.isArray(body?.history)
      ? body.history
          .filter(
            (h: any) =>
              (h?.role === "user" || h?.role === "assistant") &&
              typeof h?.text === "string" &&
              h.text.trim().length > 0,
          )
          .slice(-6)
          .map((h: any) => ({ role: h.role, text: h.text.trim().slice(0, 300) }))
      : [];

    if (!query || !cityId || !UUID_RE.test(cityId)) {
      return new Response(
        JSON.stringify({ error: "Valid query and cityId are required." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Rate-limit caller before performing heavy retrieval or calling Gemini
    try {
      const { data: allowed, error: rlErr } = await rateSb.rpc("apnatown_check_rate_limit", {
        _key: `sahayak:${clientIp}`,
        _window_secs: 60,
        _max_calls: 15,
      });
      if (!rlErr && allowed === false) {
        return new Response(
          JSON.stringify({
            error: "Too many requests. Please wait a minute before asking Sahayak again.",
          }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "60" },
          },
        );
      }
    } catch {
      // If rate-limit RPC has not been applied yet, do not fail public requests
    }

    const today = getTodayISTDate();
    const isMuktainagar = citySlug === "muktainagar";
    const applyCityScope = (qBuilder: any) =>
      isMuktainagar ? qBuilder.or(`city_id.eq.${cityId},city_id.is.null`) : qBuilder.eq("city_id", cityId);

    const fetchSchoolsWithFallback = async () => {
      const enrichedCols =
        "id, slug, name, name_mr, school_type, medium, mediums, management_type, gender_type, area, address, phone, whatsapp, board, classes_offered, streams, coaching_focus, admission_status, admission_deadline, fee_tier, annual_fee_min, annual_fee_max, scholarships, transport_villages, total_seats, available_seats, is_verified, village_id, description";
      const legacyCols = "id, name, name_mr, school_type, medium, area, address, phone, village_id, description";
      const res = await applyCityScope(sb.from("schools").select(enrichedCols).eq("is_active", true).limit(40));
      if (!res.error) return res.data || [];
      const fallback = await applyCityScope(sb.from("schools").select(legacyCols).eq("is_active", true).limit(40));
      return fallback.data || [];
    };

    const safeSelect = async (fn: () => Promise<any>) => {
      try {
        const res = await fn();
        return res?.error ? [] : res?.data || [];
      } catch {
        return [];
      }
    };

    // Parallel geo-scoped queries across all modules (explicitly include all PG & Mess profiles so they never get truncated by general shop limit)
    const nowIso = new Date().toISOString();
    const shopCols =
      "id, slug, name, category_id, area, address, description, keywords, amenities, phone, whatsapp, opening_time, closing_time, is_verified, is_open, village_id, city_id, shop_categories(categories(name))";
    const [shopsData, directMessRows, directPgRows, categoriesData, busesData, rawSchools, newsDbData, annData, orgData] = await Promise.all([
      safeSelect(() =>
        applyCityScope(
          sb
            .from("shops")
            .select(shopCols)
            .eq("is_active", true)
            .limit(220),
        ),
      ),
      safeSelect(() =>
        sb
          .from("mess_profiles")
          .select(`shop_id, mess_type, single_thali_rate, monthly_rate, tiffin_delivery, lunch_timing, dinner_timing, sunday_feast, shops!inner(${shopCols}, is_active)`)
          .eq("shops.is_active", true)
          .limit(150),
      ),
      safeSelect(() =>
        sb
          .from("pg_profiles")
          .select(`shop_id, gender, occupancy_target, total_beds, available_beds, food_included, sharing_rates, gate_closing_time, shops!inner(${shopCols}, is_active)`)
          .eq("shops.is_active", true)
          .limit(150),
      ),
      safeSelect(() => sb.from("categories").select("id, name")),
      safeSelect(() =>
        applyCityScope(
          sb
            .from("bus_timetable")
            .select("id, destination, destination_mr, departure_times, notes")
            .eq("is_active", true)
            .order("sort_order", { ascending: true })
            .limit(40),
        ),
      ),
      fetchSchoolsWithFallback(),
      safeSelect(() =>
        sb
          .from("local_news")
          .select("id, title, title_mr, summary, summary_mr, category, language, source_name, source_url, published_at, is_pinned")
          .eq("city_id", cityId)
          .eq("is_active", true)
          .order("is_pinned", { ascending: false })
          .order("published_at", { ascending: false })
          .limit(20),
      ),
      safeSelect(() =>
        sb
          .from("authority_announcements")
          .select(
            "id, title, title_mr, description, description_mr, category, priority, status, start_time, end_time, published_at, is_demo, department:authority_departments(name, slug), organization:authority_organizations(name, helpline_phone, emergency_phone), locations:announcement_locations(area_text, village_id)",
          )
          .eq("city_id", cityId)
          .eq("is_demo", false)
          .in("status", ["active", "scheduled"])
          .lte("published_at", nowIso)
          .order("published_at", { ascending: false })
          .limit(15),
      ),
      safeSelect(() =>
        sb
          .from("authority_organizations")
          .select("id, name, name_mr, office_address, visiting_hours, helpline_phone, emergency_phone, whatsapp_number, key_contacts")
          .eq("city_id", cityId)
          .eq("is_active", true)
          .eq("is_demo", false)
          .limit(15),
      ),
    ]);

    const matchesCityRow = (rowCityId: string | null | undefined) =>
      rowCityId === cityId || (isMuktainagar && !rowCityId);

    // Merge direct PG & Mess shop records into unified city shop map so none are evicted by general shop limit
    const mergedShopById = new Map<string, any>();
    for (const s of shopsData || []) {
      mergedShopById.set(s.id, s);
    }
    const scopedDirectMess: any[] = [];
    for (const mp of directMessRows || []) {
      const sh = mp.shops;
      if (sh && matchesCityRow(sh.city_id)) {
        if (!mergedShopById.has(sh.id)) mergedShopById.set(sh.id, sh);
        scopedDirectMess.push(mp);
      }
    }
    const scopedDirectPg: any[] = [];
    for (const pg of directPgRows || []) {
      const sh = pg.shops;
      if (sh && matchesCityRow(sh.city_id)) {
        if (!mergedShopById.has(sh.id)) mergedShopById.set(sh.id, sh);
        scopedDirectPg.push(pg);
      }
    }

    // Optional live RSS fallback ONLY when local_news DB has 0 rows AND query asks for news
    let newsItems = newsDbData;
    const isNewsAsk = /news|headline|batmya|samachar|बातम्या|ताज्या|वृत्त/i.test(query);
    if (newsItems.length === 0 && isNewsAsk) {
      const cityShort = locationLabel.split(",").pop()?.trim() || citySlug || "Maharashtra";
      newsItems = await fetchGoogleNewsRssFallback(cityId, cityShort);
    }

    // Fetch active school notices cleanly (returns [] if school_notices table not migrated yet)
    const schoolIds = rawSchools.map((s: any) => s.id);
    const schoolNoticesData = schoolIds.length
      ? await safeSelect(() =>
          sb
            .from("school_notices")
            .select("id, school_id, title, title_mr, body, category, is_pinned, expires_at, created_at")
            .eq("is_active", true)
            .in("school_id", schoolIds)
            .order("is_pinned", { ascending: false })
            .order("created_at", { ascending: false })
            .limit(60),
        )
      : [];

    const nowMs = Date.now();
    const noticesBySchool = new Map<string, any[]>();
    for (const n of schoolNoticesData) {
      if (n.expires_at && +new Date(n.expires_at) < nowMs) continue;
      const list = noticesBySchool.get(n.school_id) || [];
      list.push(n);
      noticesBySchool.set(n.school_id, list);
    }

    const sortedShops = [...mergedShopById.values()].sort((a, b) => {
      if (!villageId) return 0;
      return (b.village_id === villageId ? 1 : 0) - (a.village_id === villageId ? 1 : 0);
    });

    const shopIds = sortedShops.map((s) => s.id);
    const [messTodayMenuData, messDailyMenuData, regularMenuData, shopTranslationsData] = shopIds.length
      ? await Promise.all([
          safeSelect(() =>
            sb
              .from("mess_daily_menus")
              .select("shop_id, menu_date, lunch_text, dinner_text, special_tag")
              .in("shop_id", shopIds)
              .eq("menu_date", today),
          ),
          safeSelect(() =>
            sb
              .from("mess_daily_menus")
              .select("shop_id, menu_date, lunch_text, dinner_text, special_tag")
              .in("shop_id", shopIds)
              .gte("menu_date", "2020-01-01")
              .order("menu_date", { ascending: false })
              .limit(200),
          ),
          safeSelect(() =>
            sb
              .from("mess_daily_menus")
              .select("shop_id, menu_date, lunch_text, special_tag")
              .in("shop_id", shopIds)
              .eq("menu_date", REGULAR_MENU_DATE)
              .limit(150),
          ),
          safeSelect(() =>
            sb
              .from("shop_translations")
              .select("shop_id, name, area, description")
              .eq("locale", "mr")
              .in("shop_id", shopIds),
          ),
        ])
      : [[], [], [], []];

    const categoryNameById = new Map<string, string>(
      (categoriesData || []).map((c: any) => [c.id, c.name]),
    );
    const messProfileMap = new Map<string, any>(
      scopedDirectMess.map((mp: any) => [mp.shop_id, mp]),
    );
    const pgProfileMap = new Map<string, any>(
      scopedDirectPg.map((pg: any) => [pg.shop_id, pg]),
    );
    const translationByShop = new Map<string, any>(
      (shopTranslationsData || []).map((tr: any) => [tr.shop_id, tr]),
    );

    const shopMap = new Map(sortedShops.map((s) => [s.id, s]));
    const menuByShop = new Map<string, any>();
    for (const m of messTodayMenuData || []) {
      menuByShop.set(m.shop_id, m);
    }
    for (const m of messDailyMenuData || []) {
      if (!menuByShop.has(m.shop_id)) {
        menuByShop.set(m.shop_id, m);
      }
    }

    const regularMenuByShop = new Map<string, string[]>();
    for (const rm of regularMenuData || []) {
      const items = formatRegularMenuSummary(rm.lunch_text);
      if (items.length > 0) {
        regularMenuByShop.set(rm.shop_id, items);
      }
    }

    const tokens = tokenizeQuery(`${query} ${history.map((h) => h.text).join(" ")}`);

    const rawMesses: any[] = [];
    const rawPgs: any[] = [];
    const rawRetailShops: any[] = [];
    const domainByShopId = new Map<string, "mess" | "pg">();

    for (const s of sortedShops) {
      const catSet = new Set<string>();
      for (const sc of s.shop_categories || []) {
        if (sc?.categories?.name) catSet.add(sc.categories.name);
      }
      if (s.category_id && categoryNameById.has(s.category_id)) {
        catSet.add(categoryNameById.get(s.category_id)!);
      }
      const categories = Array.from(catSet);
      const tr = translationByShop.get(s.id);
      const nameMr = tr?.name || null;
      const area = s.area || tr?.area || null;
      const phone = s.phone || s.whatsapp || null;
      const amenities: string[] = Array.isArray(s.amenities) ? s.amenities : [];

      const domain = classifySpecializedShopDomain(
        s,
        categories,
        messProfileMap.has(s.id),
        pgProfileMap.has(s.id),
      );

      if (domain === "mess") {
        domainByShopId.set(s.id, "mess");
        const mp = messProfileMap.get(s.id);
        const menu = menuByShop.get(s.id);
        const regularMenu = regularMenuByShop.get(s.id) || [];
        const isNonVeg = amenities.some((a) => /non[\s-]?veg/i.test(a));
        const hasTiffin =
          Boolean(mp?.tiffin_delivery) ||
          amenities.some((a) => /tiffin|delivery/i.test(a)) ||
          /tiffin|टिफिन/i.test(`${s.name || ""} ${categories.join(" ")}`);

        rawMesses.push({
          id: s.id,
          slug: s.slug,
          name: s.name,
          name_mr: nameMr,
          area,
          address: s.address || null,
          phone,
          categories,
          description: s.description || tr?.description || null,
          mess_type: mp?.mess_type || (isNonVeg ? "veg_nonveg" : "pure_veg"),
          single_thali_rate: mp?.single_thali_rate ?? null,
          monthly_rate: mp?.monthly_rate ?? null,
          tiffin_delivery: hasTiffin,
          lunch_timing: mp?.lunch_timing || null,
          dinner_timing: mp?.dinner_timing || null,
          sunday_feast: Boolean(mp?.sunday_feast),
          menu_date: menu?.menu_date || null,
          menu_is_today: menu?.menu_date === today,
          special_tag: menu?.special_tag || null,
          lunch_text: menu?.lunch_text || null,
          dinner_text: menu?.dinner_text || null,
          regular_menu: regularMenu,
        });
      } else if (domain === "pg") {
        domainByShopId.set(s.id, "pg");
        const pg = pgProfileMap.get(s.id);
        const pgText = `${s.name || ""} ${categories.join(" ")}`.toLowerCase();
        const inferredGender = /\bgirls?\b|मुलीं|ladies|female/i.test(pgText)
          ? "girls"
          : /\bboys?\b|मुलां|gents|male/i.test(pgText)
            ? "boys"
            : "both";

        rawPgs.push({
          id: s.id,
          slug: s.slug,
          name: s.name,
          name_mr: nameMr,
          area,
          address: s.address || null,
          phone,
          categories,
          description: s.description || tr?.description || null,
          gender: pg?.gender || inferredGender,
          occupancy_target: pg?.occupancy_target || "students",
          available_beds: pg?.available_beds ?? null,
          food_included: pg?.food_included ?? false,
          sharing_rates: pg?.sharing_rates || {},
          gate_closing_time: pg?.gate_closing_time || null,
        });
      } else {
        rawRetailShops.push({
          id: s.id,
          slug: s.slug,
          name: s.name,
          name_mr: nameMr,
          area,
          address: s.address || null,
          phone,
          opening_time: s.opening_time,
          closing_time: s.closing_time,
          is_verified: s.is_verified,
          categories,
        });
      }
    }

    const messes = rankByQuery(
      rawMesses,
      (m) =>
        `${m.name} ${m.name_mr || ""} ${m.area || ""} ${m.address || ""} ${m.categories.join(" ")} ${m.description || ""} ${m.special_tag || ""} ${m.lunch_text || ""} ${m.dinner_text || ""} ${(m.regular_menu || []).join(" ")}`,
      tokens,
    );

    const pgs = rankByQuery(
      rawPgs,
      (p) =>
        `${p.name} ${p.name_mr || ""} ${p.area || ""} ${p.address || ""} ${p.categories.join(" ")} ${p.description || ""} ${p.gender || ""}`,
      tokens,
    );

    const shops = rankByQuery(
      rawRetailShops,
      (s) => `${s.name} ${s.name_mr || ""} ${s.area || ""} ${s.address || ""} ${s.categories.join(" ")}`,
      tokens,
    );

    const isMavalOrParandwadi = citySlug === "maval" || /parandwadi|maval/i.test(locationLabel);
    const buses = busesData.length > 0 ? busesData : isMavalOrParandwadi ? PARANDWADI_SEED_BUSES : [];

    const villageNeedle = villageName.toLowerCase();
    const enrichedSchools = rawSchools.map((s: any) => ({
      ...s,
      notices: (noticesBySchool.get(s.id) || []).slice(0, 3),
    }));
    const schools = rankByQuery(
      enrichedSchools,
      (s) => {
        const villageBoost =
          (villageId && s.village_id === villageId) ||
          (villageNeedle &&
            Array.isArray(s.transport_villages) &&
            s.transport_villages.some((v: string) => v.toLowerCase().includes(villageNeedle)))
            ? ` ${query}`
            : "";
        return `${s.name} ${s.name_mr || ""} ${s.area || ""} ${s.school_type || ""} ${s.medium || ""} ${s.board || ""} ${s.admission_status || ""} ${(s.streams || []).join(" ")} ${(s.transport_villages || []).join(" ")} ${(s.notices || []).map((n: any) => n.title).join(" ")}${villageBoost}`;
      },
      tokens,
    );

    const rankedNews = rankByQuery(
      newsItems,
      (n) => `${n.title} ${n.title_mr || ""} ${n.summary || ""} ${n.category || ""} ${n.source_name || ""}`,
      tokens,
    );

    const services = [
      ...annData.map((a: any) => {
        const areas = (a.locations || []).map((l: any) => l.area_text).filter(Boolean).join(", ");
        const phone = a.organization?.emergency_phone || a.organization?.helpline_phone || null;
        return {
          id: a.id,
          type: "announcement",
          title: a.title,
          title_mr: a.title_mr,
          highlightBadge:
            a.priority === "critical" || a.priority === "high"
              ? `🚨 ${String(a.priority).toUpperCase()} Alert`
              : a.department?.name || a.category || "Civic Alert",
          reason: `${String(a.description || "").slice(0, 120)}${areas ? ` · ${areas}` : ""}${phone ? ` · Helpline: ${phone}` : ""}`,
          reason_mr: `${String(a.description_mr || a.description || "").slice(0, 120)}${areas ? ` · ${areas}` : ""}`,
          area: areas || locationLabel,
          phone,
          priority: a.priority,
        };
      }),
      ...orgData.map((o: any) => ({
        id: o.id,
        type: "organization",
        title: o.name,
        title_mr: o.name_mr,
        highlightBadge: `📞 ${o.emergency_phone || o.helpline_phone}`,
        reason: `${o.office_address || locationLabel}${o.visiting_hours ? ` · ${o.visiting_hours}` : ""}`,
        reason_mr: `${o.office_address || locationLabel}${o.visiting_hours ? ` · ${o.visiting_hours}` : ""}`,
        area: o.office_address || locationLabel,
        phone: o.emergency_phone || o.helpline_phone || null,
      })),
    ];

    const schoolMap = new Map(schools.map((s: any) => [s.id, s]));
    const newsMap = new Map(rankedNews.map((n: any) => [n.id, n]));
    const serviceMap = new Map(services.map((srv: any) => [srv.id, srv]));
    const busMap = new Map(buses.map((b: any) => [b.id, b]));

    if (!Deno.env.get("LOVABLE_API_KEY")) {
      const fallback = buildLocalFallbackResponse(
        query,
        locationLabel,
        { messes, pgs, shops, buses, schools, news: rankedNews, services },
        history,
      );
      return new Response(JSON.stringify(fallback), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const compactContext = {
      location: locationLabel,
      currentDateIST: today,
      currentTimeIST: getCurrentISTFormatted(),
      messes: messes.slice(0, 24),
      pgs: pgs.slice(0, 20),
      buses: buses.slice(0, 18),
      schools: schools.slice(0, 18),
      news: rankedNews.slice(0, 15),
      services: services.slice(0, 12),
      shops: shops.slice(0, 25),
    };

    const S = "string";
    const schema = {
      type: "object",
      additionalProperties: false,
      properties: {
        replyText: { type: S },
        detectedLanguage: { type: S, enum: ["en", "mr", "hinglish"] },
        recommendations: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              entityType: {
                type: S,
                enum: ["mess", "pg", "shop", "bus", "school", "news", "service"],
              },
              id: { type: S },
              title: { type: S },
              highlightBadge: { type: S },
              reason: { type: S },
            },
            required: ["entityType", "id", "title", "highlightBadge", "reason"],
          },
        },
        followUpSuggestions: { type: "array", items: { type: S } },
      },
      required: ["replyText", "detectedLanguage", "recommendations", "followUpSuggestions"],
    };

    const geminiMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      {
        role: "system",
        content:
          "You are ApnaTown Sahayak, a helpful, concise hyper-local town assistant for citizens, commuters, parents, and students in Maharashtra, India. " +
          "ONLY cite places, prices, menus, bus times, colleges/notices, news headlines, and civic alerts/helplines present in the supplied JSON database records. Never invent facts, prices, or phone numbers. " +
          "Reply in Marathi (Devanagari) if asked in Marathi, otherwise natural English/Hinglish matching the user's style. " +
          "Use entityType='mess' for all messes, hotels, restaurants, dhabas, bhojanalays, tiffin services, and thali/dining listings (ALWAYS inspect BOTH daily lunch_text/dinner_text/special_tag — prioritizing menu_is_today=true — AND regular_menu items + prices in messes[] before saying any menu or dish is unavailable). " +
          "Use entityType='pg' for all PGs and hostels in pgs[] (check available_beds, sharing_rates, gender, food_included, and area thoroughly before saying no PGs exist), 'school' for schools/colleges/admissions/scholarships/school_notices, 'bus' for bus timings, 'news' for local news headlines, 'service' for water/power/municipal outages and official helplines, and 'shop' ONLY for retail/commercial shops in shops[]. " +
          "Return up to 5 recommendations with exact ids from their matching array and 2-3 short follow-up suggestions in the user's language.",
      },
      ...history.map((h) => ({ role: h.role as "user" | "assistant", content: h.text })),
      {
        role: "user",
        content: `User location: ${locationLabel}\nUser question: "${query}"\n\nLive Database Records:\n${JSON.stringify(compactContext)}`,
      },
    ];

    let response;
    try {
      response = await generateChatCompletion({
        model: "google/gemini-2.5-flash",
        messages: geminiMessages,
        response_format: {
          type: "json_schema",
          json_schema: { name: "assistant_reply", strict: true, schema },
        },
      });
    } catch (aiErr) {
      console.error("[town-assistant] AI call failed, using fallback:", aiErr);
      const fallback = buildLocalFallbackResponse(
        query,
        locationLabel,
        { messes, pgs, shops, buses, schools, news: rankedNews, services },
        history,
      );
      return new Response(JSON.stringify(fallback), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const content = response.choices?.[0]?.message?.content;
    const text = typeof content === "string" ? content : "{}";
    const parsed = JSON.parse(text);

    const validIds = new Set([
      ...messes.map((x: any) => x.id),
      ...pgs.map((x: any) => x.id),
      ...shops.map((x: any) => x.id),
      ...buses.map((x: any) => x.id),
      ...schools.map((x: any) => x.id),
      ...rankedNews.map((x: any) => x.id),
      ...services.map((x: any) => x.id),
    ]);

    const hydratedRecs: AssistantRecommendation[] = (parsed.recommendations || [])
      .filter((r: any) => r?.id && validIds.has(r.id))
      .slice(0, 5)
      .map((r: any) => {
        const s = shopMap.get(r.id);
        const sch = schoolMap.get(r.id);
        const newsItem = newsMap.get(r.id);
        const srv = serviceMap.get(r.id);
        const busItem = busMap.get(r.id);
        const resolvedDomain = domainByShopId.get(r.id);
        const normalizedEntityType: EntityType =
          resolvedDomain === "mess" || resolvedDomain === "pg"
            ? resolvedDomain
            : r.entityType;
        return {
          entityType: normalizedEntityType,
          id: r.id,
          slug: s?.slug || sch?.slug || null,
          title: r.title,
          highlightBadge: r.highlightBadge,
          reason: r.reason,
          area: s?.area || sch?.area || srv?.area || (busItem ? locationLabel : null),
          phone: s?.phone || s?.whatsapp || sch?.phone || srv?.phone || null,
          externalUrl: newsItem?.source_url || null,
          priority: srv?.priority || undefined,
        };
      });

    const payload: AssistantResponsePayload = {
      replyText: parsed.replyText || "Here is what I found in our local directory:",
      detectedLanguage: parsed.detectedLanguage || detectQueryLanguage(query),
      mode: "gemini",
      recommendations: hydratedRecs,
      followUpSuggestions: Array.isArray(parsed.followUpSuggestions)
        ? parsed.followUpSuggestions.slice(0, 3)
        : [],
    };

    return new Response(JSON.stringify(payload), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[town-assistant] Error:", err);
    return new Response(
      JSON.stringify({ error: err?.message || "Assistant error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
