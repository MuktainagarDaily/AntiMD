import { supabase } from '@/integrations/supabase/client';
import { fetchMessesForCity, fetchPGsForCity } from '@/lib/living/livingService';
import type { MessMenuItem, MessProfile, PGProfile } from '@/lib/living/livingTypes';
import { filterRetailShops, getSpecializedEntityDomain } from '@/lib/shopUtils';
import { schoolsRepo, type SchoolRow } from '@/lib/repos/schoolsRepo';
import {
  getSchoolResolvedMeta,
  resolveSchoolType,
  SCHOOL_TYPE_CONFIG,
} from '@/lib/schools/schoolHelpers';
import type { SchoolNotice } from '@/lib/schools/schoolNoticesRepo';
import { fetchLocalNewsForCity } from '@/lib/news/newsService';
import { NEWS_CATEGORIES, type LocalNewsItem } from '@/lib/news/newsTypes';
import {
  fetchAnnouncementsForCity,
  fetchOrganizationsForCity,
} from '@/lib/services/authorityService';
import type {
  AuthorityAnnouncement,
  AuthorityOrganization,
} from '@/lib/services/authorityTypes';
import { PARANDWADI_DEPOT_SEEDS } from '@/lib/bus/busHelpers';

export type EntityType =
  | 'mess'
  | 'pg'
  | 'shop'
  | 'bus'
  | 'school'
  | 'news'
  | 'service';

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
  priority?: 'low' | 'medium' | 'high' | 'critical';
}

export interface AssistantResponsePayload {
  replyText: string;
  detectedLanguage: 'en' | 'mr' | 'hinglish';
  mode: 'gemini' | 'local-fallback';
  recommendations: AssistantRecommendation[];
  followUpSuggestions: string[];
}

export interface AssistantHistoryTurn {
  role: 'user' | 'assistant';
  text: string;
}

export interface AskAssistantParams {
  query: string;
  cityId: string;
  citySlug: string;
  villageId?: string | null;
  villageName?: string | null;
  locationLabel: string;
  history?: AssistantHistoryTurn[];
}

function getNowISTMinutes(): number {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.getUTCHours() * 60 + ist.getUTCMinutes();
}

export function detectQueryLanguage(q: string): 'en' | 'mr' | 'hinglish' {
  if (/[\u0900-\u097F]/.test(q)) return 'mr';
  if (
    /\b(kay|kuthe|kashi|kasa|ahe|aahe|madhe|swast|jevan|khana|kaha|sasta|batao|pudchi|kadi|kadhi|batmya|taajya|taja|shala|pravesh|paani|pani|vij|band|kiti|bhada)\b/i.test(
      q,
    )
  ) {
    return 'hinglish';
  }
  return 'en';
}

interface BusRow {
  id: string;
  destination: string;
  destination_mr?: string | null;
  departure_times?: string[] | null;
  notes?: string | null;
}

interface ShopRow {
  id: string;
  slug?: string | null;
  name: string;
  name_mr?: string | null;
  area?: string | null;
  village_id?: string | null;
  opening_time?: string | null;
  closing_time?: string | null;
  phone?: string | null;
  is_verified?: boolean | null;
  shop_categories?: Array<{ categories?: { name?: string | null } | null }> | null;
}

function extractCategories(shop: ShopRow): string[] {
  return (shop.shop_categories || [])
    .map((sc) => sc?.categories?.name)
    .filter((name): name is string => Boolean(name));
}

function tokenizeQuery(q: string, stopPattern?: RegExp): string[] {
  return q
    .toLowerCase()
    .replace(/[?.,!'"()]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 2 && (!stopPattern || !stopPattern.test(t)));
}

type NoticeQueryResult = Promise<{ data: SchoolNotice[] | null; error: unknown }>;

interface NoticesQueryClient {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: boolean) => {
        order: (col: string, opts: { ascending: boolean }) => {
          order: (col: string, opts: { ascending: boolean }) => {
            limit: (n: number) => NoticeQueryResult;
          };
        };
      };
    };
  };
}

async function fetchActiveSchoolNoticesSafe(schoolIds: string[]): Promise<SchoolNotice[]> {
  if (schoolIds.length === 0) return [];
  try {
    const idSet = new Set(schoolIds);
    const client = supabase as unknown as NoticesQueryClient;
    const { data, error } = await client
      .from('school_notices')
      .select('id, school_id, title, title_mr, body, body_mr, category, is_pinned, is_active, attachment_url, expires_at, created_at')
      .eq('is_active', true)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(80);

    if (error || !Array.isArray(data)) return [];
    const now = Date.now();
    return data.filter(
      (n) => idSet.has(n.school_id) && (!n.expires_at || +new Date(n.expires_at) >= now),
    );
  } catch {
    return [];
  }
}

interface IntentFlags {
  isService: boolean;
  isNews: boolean;
  isSpecialFood: boolean;
  isAffordableFood: boolean;
  isPg: boolean;
  isBus: boolean;
  isSchool: boolean;
}

function classifyIntent(qLower: string): IntentFlags {
  const isService =
    /water\s*supply|water\s*cut|drinking\s*water|\bwater\b|\bpaani\b|\bpani\b|पाणी|electricity|power\s*cut|power\s*outage|load\s*shedding|msedcl|mseb|mahavitaran|transformer|feeder|वीज|विद्युत|बत्ती|municipal|nagar\s*panchayat|nagar\s*parishad|gram\s*panchayat|नगरपंचायत|नगरपरिषद|ग्रामपंचायत|helpline|emergency|ambulance|police|fire\s*brigade|civic\s*service|outage|हेल्पलाईन|तातडी|आपत्कालीन|पोलीस|रुग्णवाहिका/i.test(
      qLower,
    );

  const isSchool =
    /school|schools|college|colleges|class|classes|coaching|tuition|education|study|institute|institutes|academy|admission|admissions|pravesh|scholarship|scholarships|\biti\b|polytechnic|diploma|engineering|university|abhyasika|prospectus|udise|aishe|शाळा|कॉलेज|महाविद्यालय|प्रवेश|शिष्यवृत्ती|अभ्यासिका|परीक्षा|परिपत्रक/i.test(
      qLower,
    );

  const hasExplicitLiving =
    /\bpg\b|\bhostel\b|hostels|paying\s*guest|वसतिगृह|पीजी|खोली|राहण्यासाठी/i.test(qLower);

  const isSpecialFood =
    !hasExplicitLiving &&
    /special|cooked|menu|thali|today|spcl|\bhotel\b|हॉटेल|restaurant|रेस्टॉरंट|dhaba|ढाबा|bhojanalay|भोजनालय|khanawal|खानावळ|misal|biryani|nashta|breakfast|स्पेशल|मेनू|आज|जेवण|खास|kay banla|kya bana/i.test(
      qLower,
    );

  const isAffordableFood =
    !hasExplicitLiving &&
    /cheap|afford|budget|meal|meals|food|mess|tiffin|lunch|dinner|eat|thali|\bhotel\b|हॉटेल|restaurant|रेस्टॉरंट|dhaba|ढाबा|bhojanalay|भोजनालय|khanawal|खानावळ|misal|biryani|khana|jevan|swast|sasta|स्वस्त|जेवण|मेस|थाळी|टिफिन/i.test(
      qLower,
    );

  const isPg =
    /\bpg\b|paying\s*guest|hostel|hostels|room|rooms|bed|beds|rent|stay|accommodation|boys|girls|खोली|पीजी|वसतिगृह|राहण्यासाठी|भाडे/i.test(
      qLower,
    );

  const isNews =
    !isSchool &&
    !isService &&
    /\bnews\b|headline|headlines|batmya|samachar|newspaper|journal|mandi\s*bhav|market\s*rate|बातम्या|ताज्या|वृत्त|घडामोडी|बाजारभाव|शेतकरी/i.test(
      qLower,
    );

  const hasExplicitBusKeyword =
    /\bbus\b|buses|\bstand\b|timetable|schedule|depart|departure|pmpml|msrtc|shuttle|बस|वेळापत्रक|कधी|पुढची/i.test(
      qLower,
    );
  const hasShopEntityKeyword =
    /\bshop\b|shops|store|stores|kirana|grocery|medical|pharmacy|chemist|hardware|electronics|mobile|bakery|dairy|salon|parlour|jeweller|clothes|garment|stationery|bazar|dukan|दुकान|किराणा|मेडिकल/i.test(
      qLower,
    );
  const isBus =
    (hasExplicitBusKeyword &&
      !(hasShopEntityKeyword && !/\btimetable|\bschedule|\bpmpml|\bmsrtc|वेळापत्रक/i.test(qLower)) &&
      !(isSchool && !/\bbus\s*stand|\btimetable|\bschedule|\bpmpml|\bmsrtc|\bbus\b/i.test(qLower))) ||
    (/\b(to|from)\s+(pune|jalgaon|malkapur|bhusawal|parandwadi|talegaon|nigdi|urse|somatane|hinjawadi|lonavala|dehu)\b/i.test(
      qLower,
    ) &&
      !isSchool &&
      !hasShopEntityKeyword &&
      !isService &&
      !isNews);

  return {
    isService,
    isNews,
    isSpecialFood,
    isAffordableFood,
    isPg,
    isBus,
    isSchool,
  };
}

function extractMaxBudget(qLower: string): number | null {
  const m = qLower.match(/(?:under|below|max|upto|less than|<=|₹|rs\.?)\s*(\d{3,5})/i);
  if (!m) return null;
  const num = parseInt(m[1], 10);
  return Number.isFinite(num) && num >= 500 ? num : null;
}

function estimateMinPgRent(profile: Partial<PGProfile>): number | null {
  const rates = profile.sharing_rates;
  if (!rates || typeof rates !== 'object') return null;
  const nums = Object.values(rates)
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n) && n > 0);
  return nums.length > 0 ? Math.min(...nums) : null;
}

function formatNewsBadge(category: LocalNewsItem['category'], isMr: boolean, isPinned: boolean): string {
  const meta = NEWS_CATEGORIES.find((c) => c.value === category);
  const label = isMr ? meta?.labelMr || 'बातम्या' : meta?.labelEn || 'Local News';
  return isPinned ? `📌 ${label}` : label;
}

export async function runLocalClientFallback(
  params: AskAssistantParams,
): Promise<AssistantResponsePayload> {
  const { query, cityId, citySlug, villageId, villageName, locationLabel, history } = params;
  const q = query.trim().toLowerCase();
  const lang = detectQueryLanguage(query);
  const isMr = lang === 'mr';

  let busQuery = supabase
    .from('bus_timetable')
    .select('id, destination, destination_mr, departure_times, notes')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .limit(40);

  if (citySlug === 'muktainagar') {
    busQuery = busQuery.or(`city_id.eq.${cityId},city_id.is.null`);
  } else {
    busQuery = busQuery.eq('city_id', cityId);
  }

  let shopQuery = supabase
    .from('shops')
    .select('*, shop_categories(categories(name))')
    .eq('is_active', true)
    .limit(120);

  if (citySlug === 'muktainagar') {
    shopQuery = shopQuery.or(`city_id.eq.${cityId},city_id.is.null`);
  } else {
    shopQuery = shopQuery.eq('city_id', cityId);
  }

  const [messesRes, pgsRes, schoolsRes, busesRes, shopsRes, newsRes, annRes, orgRes] =
    await Promise.allSettled([
      fetchMessesForCity(cityId, villageId),
      fetchPGsForCity(cityId, villageId),
      schoolsRepo.list({ activeOnly: true, cityId, citySlug, limit: 35 }),
      busQuery,
      shopQuery,
      fetchLocalNewsForCity(cityId, { activeOnly: true }),
      fetchAnnouncementsForCity(cityId, { villageId }),
      fetchOrganizationsForCity(cityId),
    ]);

  const messes = (messesRes.status === 'fulfilled' ? messesRes.value : []).map((m) => ({
    shop: m,
    profile: (m.mess_profile ?? {}) as Partial<MessProfile>,
    latestMenu: m.today_menu ?? m.latest_menu,
    menuItems: (m.menu_items ?? []).filter((item: MessMenuItem) => item.is_available !== false),
  }));
  const pgs = (pgsRes.status === 'fulfilled' ? pgsRes.value : []).map((p) => ({
    shop: p,
    profile: (p.pg_profile ?? {}) as Partial<PGProfile>,
  }));
  const schools: SchoolRow[] = schoolsRes.status === 'fulfilled' ? schoolsRes.value : [];
  const rawBuses: BusRow[] =
    busesRes.status === 'fulfilled' && Array.isArray(busesRes.value.data)
      ? (busesRes.value.data as BusRow[])
      : [];

  // Fallback to Parandwadi/Maval built-in bus depot schedule if DB rows aren't seeded yet
  const isMavalOrParandwadi =
    citySlug === 'maval' || /parandwadi|maval/i.test(locationLabel || '');
  const buses: BusRow[] =
    rawBuses.length > 0
      ? rawBuses
      : isMavalOrParandwadi
        ? PARANDWADI_DEPOT_SEEDS.map((b, i) => ({
            id: `parandwadi-seed-${i + 1}`,
            destination: b.destination,
            destination_mr: b.destination_mr || null,
            departure_times: b.departure_times,
            notes: b.notes || null,
          }))
        : [];

  const rawShops: ShopRow[] =
    shopsRes.status === 'fulfilled' && Array.isArray(shopsRes.value.data)
      ? (shopsRes.value.data as unknown as ShopRow[])
      : [];

  // Strictly exclude Mess/Hotel/Restaurant/PG/School entities from retail shops
  const retailShops = filterRetailShops(rawShops);

  const shops = villageId
    ? [...retailShops].sort((a, b) => {
        const aMatch = a.village_id === villageId ? 1 : 0;
        const bMatch = b.village_id === villageId ? 1 : 0;
        return bMatch - aMatch;
      })
    : retailShops;

  const newsItems: LocalNewsItem[] =
    newsRes.status === 'fulfilled' ? newsRes.value.items : [];
  const announcements: AuthorityAnnouncement[] =
    annRes.status === 'fulfilled' ? annRes.value : [];
  const organizations: AuthorityOrganization[] =
    orgRes.status === 'fulfilled' ? orgRes.value : [];

  const schoolNotices = await fetchActiveSchoolNoticesSafe(schools.map((s) => s.id));
  const noticesBySchool = new Map<string, SchoolNotice[]>();
  for (const n of schoolNotices) {
    const arr = noticesBySchool.get(n.school_id) || [];
    arr.push(n);
    noticesBySchool.set(n.school_id, arr);
  }

  let intents = classifyIntent(q);
  const hasAnyDomainIntent =
    intents.isService ||
    intents.isNews ||
    intents.isSpecialFood ||
    intents.isAffordableFood ||
    intents.isPg ||
    intents.isBus ||
    intents.isSchool;

  // Inherit previous user turn's intent for brief follow-ups ("girls?", "fees?", "timing?")
  if (!hasAnyDomainIntent && history && history.length > 0) {
    const prevUser = [...history].reverse().find((h) => h.role === 'user');
    if (prevUser?.text) {
      const prevIntents = classifyIntent(prevUser.text.toLowerCase());
      intents = prevIntents;
    }
  }

  const recs: AssistantRecommendation[] = [];

  const buildMessRec = (m: (typeof messes)[number]): AssistantRecommendation => {
    const rateBadge = m.profile.single_thali_rate
      ? `₹${m.profile.single_thali_rate} Thali`
      : m.profile.monthly_rate
        ? `₹${m.profile.monthly_rate}/mo`
        : 'Mess';
    const badge = m.latestMenu?.special_tag ? `Special: ${m.latestMenu.special_tag}` : rateBadge;
    const regularSnippet = m.menuItems.length
      ? m.menuItems
          .slice(0, 4)
          .map((item) => (Number(item.price) > 0 ? `${item.name} (₹${item.price})` : item.name))
          .join(', ')
      : null;
    const menuSnippet =
      m.latestMenu?.lunch_text ||
      m.latestMenu?.dinner_text ||
      m.latestMenu?.special_tag ||
      regularSnippet;
    return {
      entityType: 'mess',
      id: m.shop.id,
      slug: m.shop.slug,
      title: isMr && m.shop.name_mr ? m.shop.name_mr : m.shop.name,
      highlightBadge: badge,
      reason: menuSnippet
        ? `Menu: ${menuSnippet}${m.profile.single_thali_rate ? ` · ₹${m.profile.single_thali_rate}` : ''}`
        : `${m.profile.mess_type === 'pure_veg' ? 'Pure Veg' : 'Veg / Non-Veg'}${m.shop.area ? ` in ${m.shop.area}` : ''}`,
      area: m.shop.area,
      phone: (m.shop as { phone?: string | null }).phone || null,
    };
  };

  const buildPgRec = (p: (typeof pgs)[number]): AssistantRecommendation => {
    const beds = p.profile.available_beds;
    const minRent = estimateMinPgRent(p.profile);
    return {
      entityType: 'pg',
      id: p.shop.id,
      slug: p.shop.slug,
      title: isMr && p.shop.name_mr ? p.shop.name_mr : p.shop.name,
      highlightBadge:
        typeof beds === 'number' && beds > 0
          ? `${beds} Beds Open`
          : minRent
            ? `From ₹${minRent}/mo`
            : p.profile.gender || 'PG / Hostel',
      reason: `${p.profile.gender || 'Open'}${p.profile.food_included ? ' · Food Included' : ''}${minRent ? ` · ₹${minRent}+/mo` : ''}${p.shop.area ? ` · ${p.shop.area}` : ''}`,
      area: p.shop.area,
      phone: (p.shop as { phone?: string | null }).phone || null,
    };
  };

  if (intents.isService) {
    const tokens = tokenizeQuery(
      q,
      /^(service|services|civic|alert|alerts|helpline|emergency|number|contact|phone|department|status|active|सेवा|हेल्पलाईन|नंबर|माहिती)$/,
    );

    const activeAnns = announcements.filter(
      (a) => a.status === 'active' || a.status === 'scheduled',
    );
    const poolAnns = activeAnns.length > 0 ? activeAnns : announcements;

    const matchedAnns = poolAnns.filter((a) => {
      if (tokens.length === 0) return true;
      const areas = (a.locations || []).map((l) => l.area_text || '').join(' ');
      const hay =
        `${a.title} ${a.title_mr || ''} ${a.description} ${a.description_mr || ''} ${a.department?.name || ''} ${a.department?.slug || ''} ${areas}`.toLowerCase();
      return tokens.some((tok) => hay.includes(tok));
    });

    for (const ann of matchedAnns.slice(0, 3)) {
      const annTitle = isMr && ann.title_mr ? ann.title_mr : ann.title;
      const annDesc = isMr && ann.description_mr ? ann.description_mr : ann.description;
      const areas = (ann.locations || []).map((l) => l.area_text).filter(Boolean).join(', ');
      const phone =
        ann.organization?.emergency_phone || ann.organization?.helpline_phone || null;
      recs.push({
        entityType: 'service',
        id: ann.id,
        title: annTitle,
        highlightBadge:
          ann.priority === 'critical' || ann.priority === 'high'
            ? isMr
              ? '🚨 तातडीची सूचना'
              : `🚨 ${ann.priority.toUpperCase()} Alert`
            : ann.status === 'scheduled'
              ? isMr
                ? 'नियोजित काम'
                : 'Scheduled'
              : ann.department?.name || 'Civic Alert',
        reason: `${annDesc.slice(0, 110)}${areas ? ` · ${areas}` : ''}${phone ? ` · Helpline: ${phone}` : ''}`,
        area: areas || locationLabel,
        phone,
        priority: ann.priority,
      });
    }

    const matchedOrgs = organizations.filter((o) => {
      if (tokens.length === 0) return true;
      const contacts = (o.key_contacts || [])
        .map((c) => `${c.role} ${c.name}`)
        .join(' ');
      const hay =
        `${o.name} ${o.name_mr || ''} ${o.office_address || ''} ${o.helpline_phone} ${o.emergency_phone || ''} ${contacts}`.toLowerCase();
      return tokens.some((tok) => hay.includes(tok));
    });

    for (const org of (matchedOrgs.length ? matchedOrgs : organizations).slice(0, 3)) {
      if (recs.length >= 5) break;
      const primaryPhone = org.emergency_phone || org.helpline_phone;
      recs.push({
        entityType: 'service',
        id: org.id,
        title: isMr && org.name_mr ? org.name_mr : org.name,
        highlightBadge: `📞 ${primaryPhone}`,
        reason: `${org.office_address || locationLabel}${org.visiting_hours ? ` · ${org.visiting_hours}` : ''}`,
        area: org.office_address || locationLabel,
        phone: primaryPhone,
      });
    }

    if (recs.length === 0) {
      recs.push({
        entityType: 'service',
        id: `services-hub-${citySlug}`,
        title: isMr
          ? `${locationLabel} नागरी सेवा व हेल्पलाईन`
          : `${locationLabel} Civic Services & Helplines`,
        highlightBadge: '100 / 108 / 1912',
        reason: isMr
          ? 'पाणी पुरवठा, वीज वितरण (महावितरण) सूचना व नगरपंचायत संपर्क क्रमांक पाहण्यासाठी टॅप करा.'
          : 'View water, MSEDCL electricity outage updates, and municipal emergency helplines.',
        phone: '1912',
      });
    }
  } else if (intents.isNews) {
    const tokens = tokenizeQuery(
      q,
      /^(news|local|today|todays|today's|latest|headline|headlines|batmya|update|updates|talk|show|give|बातम्या|ताज्या|आजच्या|आज|द्या|सांगा)$/,
    );
    const matchedNews = newsItems.filter((n) => {
      if (tokens.length === 0) return true;
      const hay =
        `${n.title} ${n.title_mr || ''} ${n.summary || ''} ${n.summary_mr || ''} ${n.category} ${n.source_name}`.toLowerCase();
      return tokens.some((tok) => hay.includes(tok));
    });

    for (const item of (matchedNews.length ? matchedNews : newsItems).slice(0, 4)) {
      const title = isMr && item.title_mr ? item.title_mr : item.title;
      const summary = isMr && item.summary_mr ? item.summary_mr : item.summary;
      recs.push({
        entityType: 'news',
        id: item.id,
        title,
        highlightBadge: formatNewsBadge(item.category, isMr, item.is_pinned),
        reason: summary
          ? `${summary.slice(0, 110)} · ${item.source_name}`
          : `${item.source_name} · ${new Date(item.published_at).toLocaleDateString(isMr ? 'mr-IN' : 'en-IN', { day: 'numeric', month: 'short' })}`,
        externalUrl: item.source_url || null,
      });
    }

    if (recs.length === 0) {
      recs.push({
        entityType: 'news',
        id: `news-desk-${citySlug}`,
        title: isMr
          ? `${locationLabel} ताज्या स्थानिक बातम्या पहा`
          : `Open Live News Desk for ${locationLabel}`,
        highlightBadge: isMr ? 'ताज्या बातम्या' : 'Live Feed',
        reason: isMr
          ? 'आजच्या स्थानिक मराठी व इंग्रजी बातम्या, शेती व बाजारभाव ताजे करण्यासाठी टॅप करा.'
          : 'Tap to open Local News and automatically fetch today’s Marathi & English town headlines.',
      });
    }
  } else if (intents.isSpecialFood || intents.isAffordableFood) {
    const foodTokens = tokenizeQuery(
      q,
      /^(cheap|afford|affordable|budget|meal|meals|food|mess|tiffin|lunch|dinner|eat|thali|menu|special|today|cooked|spcl|hotel|restaurant|dhaba|family|near|best|good|place|places|the|and|for|with)$/,
    );
    const scoreMess = (m: (typeof messes)[number]) => {
      if (foodTokens.length === 0) return 0;
      const hay = [
        m.shop.name,
        m.shop.name_mr,
        m.shop.area,
        m.shop.address,
        m.latestMenu?.lunch_text,
        m.latestMenu?.dinner_text,
        m.latestMenu?.special_tag,
        ...m.menuItems.map((i) => i.name),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return foodTokens.reduce((acc, tok) => acc + (hay.includes(tok) ? 1 : 0), 0);
    };

    const sortedMesses = [...messes].sort((a, b) => {
      const scoreDiff = scoreMess(b) - scoreMess(a);
      if (scoreDiff !== 0) return scoreDiff;
      if (intents.isSpecialFood) {
        const aSpcl =
          a.latestMenu?.special_tag ||
          a.latestMenu?.lunch_text ||
          a.latestMenu?.dinner_text ||
          a.menuItems.length > 0
            ? 1
            : 0;
        const bSpcl =
          b.latestMenu?.special_tag ||
          b.latestMenu?.lunch_text ||
          b.latestMenu?.dinner_text ||
          b.menuItems.length > 0
            ? 1
            : 0;
        if (aSpcl !== bSpcl) return bSpcl - aSpcl;
      }
      const aRate = a.profile.single_thali_rate ?? a.profile.monthly_rate ?? 99999;
      const bRate = b.profile.single_thali_rate ?? b.profile.monthly_rate ?? 99999;
      return aRate - bRate;
    });

    for (const m of sortedMesses.slice(0, 4)) {
      recs.push(buildMessRec(m));
    }
  } else if (intents.isPg) {
    const wantsBoys = /\b(boy|boys|male|mulanchya)\b|मुलां/i.test(q);
    const wantsGirls = /\b(girl|girls|female|ladies|mulinchya)\b|मुलीं/i.test(q);
    const maxBudget = extractMaxBudget(q);
    const pgTokens = tokenizeQuery(
      q,
      /^(pg|hostel|hostels|room|rooms|bed|beds|rent|stay|accommodation|boys|girls|boy|girl|male|female|ladies|near|best|good|under|below|the|and|for|with)$/,
    );

    const filteredPgs = pgs.filter((p) => {
      if (wantsBoys && p.profile.gender !== 'boys' && p.profile.gender !== 'both') return false;
      if (wantsGirls && p.profile.gender !== 'girls' && p.profile.gender !== 'both') return false;
      if (maxBudget !== null) {
        const minRent = estimateMinPgRent(p.profile);
        if (minRent !== null && minRent > maxBudget) return false;
      }
      return true;
    });

    const scorePg = (p: (typeof pgs)[number]) => {
      if (pgTokens.length === 0) return 0;
      const hay = `${p.shop.name} ${p.shop.name_mr || ''} ${p.shop.area || ''} ${p.shop.address || ''}`.toLowerCase();
      return pgTokens.reduce((acc, tok) => acc + (hay.includes(tok) ? 1 : 0), 0);
    };

    const sortedPgs = [...(filteredPgs.length ? filteredPgs : pgs)].sort((a, b) => {
      const scoreDiff = scorePg(b) - scorePg(a);
      if (scoreDiff !== 0) return scoreDiff;
      return (b.profile.available_beds || 0) - (a.profile.available_beds || 0);
    });

    for (const p of sortedPgs.slice(0, 4)) {
      recs.push(buildPgRec(p));
    }
  } else if (intents.isBus) {
    const nowMin = getNowISTMinutes();
    const tokens = tokenizeQuery(
      q,
      /^(bus|buses|next|when|depart|departing|soon|time|from|for|route|pmpml|msrtc|कधी|बस|पुढची)$/,
    );

    const matchedBuses = buses.filter((b) => {
      if (tokens.length === 0) return true;
      const hay = `${b.destination} ${b.destination_mr || ''} ${b.notes || ''}`.toLowerCase();
      return tokens.some((tok) => hay.includes(tok));
    });

    for (const b of (matchedBuses.length ? matchedBuses : buses).slice(0, 4)) {
      const times = b.departure_times || [];
      const nextDep = times.find((t) => {
        const m = t.match(/^(\d{1,2}):(\d{2})$/);
        if (!m) return false;
        return parseInt(m[1], 10) * 60 + parseInt(m[2], 10) >= nowMin;
      });
      recs.push({
        entityType: 'bus',
        id: b.id,
        title: isMr && b.destination_mr ? b.destination_mr : b.destination,
        highlightBadge: nextDep ? `Next: ${nextDep}` : `${times.length} buses/day`,
        reason:
          b.notes ||
          (times.length ? `Departures: ${times.slice(0, 4).join(', ')}` : 'Check full bus timetable'),
      });
    }
  } else if (intents.isSchool) {
    const tokens = tokenizeQuery(
      q,
      /^(school|schools|college|colleges|best|top|near|institute|institutes|open|status|any|शाळा|कॉलेज|महाविद्यालय|सुरू)$/,
    );
    const wantsOpenAdmission = /admission|admissions|pravesh|open|प्रवेश/i.test(q);
    const wantsNotice = /notice|circular|exam|scholarship|सूचना|परिपत्रक|परीक्षा|शिष्यवृत्ती/i.test(q);
    const villageNeedle = villageName?.trim().toLowerCase() || '';

    const ranked = schools
      .map((s) => {
        const meta = getSchoolResolvedMeta(s);
        const notices = noticesBySchool.get(s.id) || [];
        const hay = [
          s.name,
          s.name_mr,
          s.area,
          s.address,
          s.medium,
          ...(meta.mediums || []),
          s.school_type,
          resolveSchoolType(s),
          meta.board,
          meta.management_type,
          meta.admission_status,
          meta.classes_offered,
          ...(meta.streams || []),
          ...(meta.coaching_focus || []),
          ...(meta.scholarships || []),
          ...(meta.transport_villages || []),
          ...notices.map((n) => `${n.title} ${n.title_mr || ''} ${n.body || ''} ${n.category}`),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        let score = 0;
        if (villageId && s.village_id === villageId) score += 3;
        if (
          villageNeedle &&
          (meta.transport_villages || []).some((v) => v.toLowerCase().includes(villageNeedle))
        ) {
          score += 3;
        }
        if (wantsOpenAdmission && (meta.admission_status === 'open' || meta.admission_status === 'ongoing')) {
          score += 4;
        }
        if (wantsNotice && notices.length > 0) score += 3;
        for (const tok of tokens) {
          if (hay.includes(tok)) score += 2;
        }
        return { school: s, meta, notices, score };
      })
      .sort((a, b) => b.score - a.score);

    const matched = ranked.filter((x) => x.score > 0);
    const chosen = (matched.length ? matched : ranked).slice(0, 4);

    for (const { school: s, meta, notices } of chosen) {
      const resolvedType = resolveSchoolType(s);
      const typeLabel = SCHOOL_TYPE_CONFIG[resolvedType]?.labelEn || 'Institute';
      const topNotice = notices[0];
      const badge =
        meta.admission_status === 'open'
          ? isMr
            ? 'प्रवेश सुरू'
            : 'Admissions Open'
          : meta.admission_status === 'ongoing'
            ? isMr
              ? 'प्रवेश चालू'
              : 'Admissions Ongoing'
            : topNotice
              ? isMr
                ? '📢 नवीन सूचना'
                : '📢 Live Notice'
              : s.medium
                ? `${s.medium} Medium`
                : typeLabel;

      const reasonParts: string[] = [];
      if (topNotice && wantsNotice) {
        reasonParts.push(
          `Notice: ${isMr && topNotice.title_mr ? topNotice.title_mr : topNotice.title}`,
        );
      } else {
        if (meta.board) reasonParts.push(meta.board);
        if (typeof meta.available_seats === 'number' && meta.available_seats > 0) {
          reasonParts.push(`${meta.available_seats} seats open`);
        }
        if (meta.annual_fee_min != null) {
          reasonParts.push(
            `₹${meta.annual_fee_min.toLocaleString('en-IN')}${meta.annual_fee_max ? `–₹${meta.annual_fee_max.toLocaleString('en-IN')}` : '+'}/yr`,
          );
        }
        if (
          villageNeedle &&
          (meta.transport_villages || []).some((v) => v.toLowerCase().includes(villageNeedle))
        ) {
          reasonParts.push(`Bus covers ${villageName}`);
        }
      }
      if (reasonParts.length === 0) {
        reasonParts.push(s.address || s.area || locationLabel);
      }

      recs.push({
        entityType: 'school',
        id: s.id,
        slug: s.slug || null,
        title: isMr && s.name_mr ? s.name_mr : s.name,
        highlightBadge: badge,
        reason: reasonParts.join(' · '),
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
      for (const m of messes) {
        const primary = [
          m.shop.name,
          m.shop.name_mr,
          m.latestMenu?.lunch_text,
          m.latestMenu?.dinner_text,
          m.latestMenu?.special_tag,
          ...m.menuItems.map((i) => i.name),
        ]
          .filter(Boolean)
          .join(' ');
        const score = scoreCandidate(primary, `${m.shop.area || ''}`);
        if (score > 0) {
          crossCandidates.push({ score, rec: buildMessRec(m) });
        }
      }

      for (const p of pgs) {
        const score = scoreCandidate(
          `${p.shop.name} ${p.shop.name_mr || ''}`,
          `${p.shop.area || ''}`,
        );
        if (score > 0) {
          crossCandidates.push({ score, rec: buildPgRec(p) });
        }
      }
    }

    for (const s of shops) {
      const cats = extractCategories(s).join(' ');
      const score =
        tokens.length === 0
          ? 1
          : scoreCandidate(`${s.name} ${s.name_mr || ''} ${cats}`, `${s.area || ''}`);
      if (score > 0) {
        const catArr = extractCategories(s);
        crossCandidates.push({
          score,
          rec: {
            entityType: 'shop',
            id: s.id,
            slug: s.slug,
            title: isMr && s.name_mr ? s.name_mr : s.name,
            highlightBadge: s.is_verified ? 'Verified' : catArr[0] || 'Local Shop',
            reason: `${s.area || locationLabel}${s.opening_time ? ` · ${s.opening_time}–${s.closing_time || ''}` : ''}`,
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
    }

    // Cross-domain rescue if no shop/mess/PG token matched (e.g., query asked for a specific headline or civic alert)
    if (tokens.length > 0 && recs.length === 0) {
      const matchedNews = newsItems.filter((n) => {
        const hay = `${n.title} ${n.title_mr || ''} ${n.summary || ''} ${n.category}`.toLowerCase();
        return tokens.some((t) => hay.includes(t));
      });
      for (const n of matchedNews.slice(0, 2)) {
        recs.push({
          entityType: 'news',
          id: n.id,
          title: isMr && n.title_mr ? n.title_mr : n.title,
          highlightBadge: formatNewsBadge(n.category, isMr, n.is_pinned),
          reason: (isMr && n.summary_mr ? n.summary_mr : n.summary)?.slice(0, 110) || n.source_name,
          externalUrl: n.source_url || null,
        });
      }

      const matchedAnns = announcements.filter((a) => {
        const hay = `${a.title} ${a.title_mr || ''} ${a.description} ${a.department?.name || ''}`.toLowerCase();
        return tokens.some((t) => hay.includes(t));
      });
      for (const a of matchedAnns.slice(0, 2)) {
        recs.push({
          entityType: 'service',
          id: a.id,
          title: isMr && a.title_mr ? a.title_mr : a.title,
          highlightBadge: a.department?.name || 'Civic Alert',
          reason: (isMr && a.description_mr ? a.description_mr : a.description).slice(0, 110),
          phone: a.organization?.emergency_phone || a.organization?.helpline_phone || null,
          priority: a.priority,
        });
      }
    }

    if (recs.length === 0) {
      for (const s of shops.slice(0, 4)) {
        const cats = extractCategories(s);
        recs.push({
          entityType: 'shop',
          id: s.id,
          slug: s.slug,
          title: isMr && s.name_mr ? s.name_mr : s.name,
          highlightBadge: s.is_verified ? 'Verified' : cats[0] || 'Local Shop',
          reason: `${s.area || locationLabel}${s.opening_time ? ` · ${s.opening_time}–${s.closing_time || ''}` : ''}`,
          area: s.area,
          phone: s.phone || null,
        });
      }
    }
  }

  let replyText = '';
  if (recs.length === 0) {
    replyText =
      lang === 'mr'
        ? `${locationLabel} मध्ये तुमच्या प्रश्नाशी जुळणारी माहिती सध्या उपलब्ध नाही. कृपया इतर शब्द वापरून शोधा.`
        : `I couldn't find an exact match in ${locationLabel} right now. Try asking about local news, mess meals, PG rooms, bus timings, colleges, or water/electricity helplines.`;
  } else if (intents.isNews) {
    replyText =
      lang === 'mr'
        ? `${locationLabel} मधील ताज्या बातम्या व अपडेट्स:`
        : `Here are the latest local news updates for ${locationLabel}:`;
  } else if (intents.isService) {
    replyText =
      lang === 'mr'
        ? `${locationLabel} साठी नागरी सेवा सूचना व हेल्पलाईन क्रमांक:`
        : `Here are the civic service alerts and official helplines for ${locationLabel}:`;
  } else if (lang === 'mr') {
    replyText = `${locationLabel} मधील तुमच्या शोधासाठी ही सर्वात योग्य माहिती आहे:`;
  } else if (lang === 'hinglish') {
    replyText = `${locationLabel} madhe tumchya shodha sathi he best options ahet:`;
  } else {
    replyText = `Here are the top matches found in ${locationLabel} from our live directory:`;
  }

  return {
    replyText,
    detectedLanguage: lang,
    mode: 'local-fallback',
    recommendations: recs,
    followUpSuggestions:
      lang === 'mr'
        ? ['आजच्या ताज्या बातम्या', 'प्रवेश सुरू असलेली कॉलेजेस?', 'वीज / पाणी बंद सूचना व हेल्पलाईन']
        : ["Today's local news", 'College admissions open?', 'Power / water helpline'],
  };
}

export function resolveRecommendationEntityType(rec: AssistantRecommendation): EntityType {
  if (rec.entityType !== 'shop') return rec.entityType;
  const domain = getSpecializedEntityDomain({
    name: rec.title,
    slug: rec.slug,
    categories: rec.highlightBadge ? [rec.highlightBadge] : [],
  });
  return domain || rec.entityType;
}

export function normalizeAssistantPayload(
  payload: AssistantResponsePayload,
): AssistantResponsePayload {
  if (!Array.isArray(payload.recommendations) || payload.recommendations.length === 0) {
    return payload;
  }
  let changed = false;
  const normalized = payload.recommendations.map((rec) => {
    const resolvedType = resolveRecommendationEntityType(rec);
    if (resolvedType !== rec.entityType) {
      changed = true;
      return { ...rec, entityType: resolvedType };
    }
    return rec;
  });
  return changed ? { ...payload, recommendations: normalized } : payload;
}

let edgeFailedAt: number | null = null;
const EDGE_COOLDOWN_MS = 60_000;

export function resetAssistantEdgeAvailability(): void {
  edgeFailedAt = null;
}

export async function askTownAssistant(
  params: AskAssistantParams,
): Promise<AssistantResponsePayload> {
  const trimmedQuery = params.query.trim();
  if (!trimmedQuery) {
    return runLocalClientFallback(params);
  }

  const aiEnabled = import.meta.env.VITE_ENABLE_TOWN_ASSISTANT_AI !== 'false';
  const inCooldown = edgeFailedAt !== null && Date.now() - edgeFailedAt < EDGE_COOLDOWN_MS;

  if (aiEnabled && !inCooldown) {
    try {
      const { data, error } = await supabase.functions.invoke('town-assistant', {
        body: {
          query: trimmedQuery,
          cityId: params.cityId,
          citySlug: params.citySlug,
          villageId: params.villageId || null,
          villageName: params.villageName || null,
          locationLabel: params.locationLabel,
          history: (params.history || []).slice(-6),
        },
      });

      if (!error && data && typeof data.replyText === 'string') {
        edgeFailedAt = null;
        return normalizeAssistantPayload(data as AssistantResponsePayload);
      }

      // Cool down Edge Function retries briefly so UI stays responsive when offline/undeployed
      edgeFailedAt = Date.now();
    } catch {
      edgeFailedAt = Date.now();
    }
  }

  return runLocalClientFallback(params);
}
