import { supabase } from '@/integrations/supabase/client';
import { fetchMessesForCity, fetchPGsForCity } from '@/lib/living/livingService';
import { schoolsRepo } from '@/lib/repos/schoolsRepo';

export type EntityType = 'mess' | 'pg' | 'shop' | 'bus' | 'school';

export interface AssistantRecommendation {
  entityType: EntityType;
  id: string;
  slug?: string | null;
  title: string;
  highlightBadge: string;
  reason: string;
  area?: string | null;
}

export interface AssistantResponsePayload {
  replyText: string;
  detectedLanguage: 'en' | 'mr' | 'hinglish';
  mode: 'gemini' | 'local-fallback';
  recommendations: AssistantRecommendation[];
  followUpSuggestions: string[];
}

export interface AskAssistantParams {
  query: string;
  cityId: string;
  citySlug: string;
  villageId?: string | null;
  locationLabel: string;
}

function getNowISTMinutes(): number {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.getUTCHours() * 60 + ist.getUTCMinutes();
}

export function detectQueryLanguage(q: string): 'en' | 'mr' | 'hinglish' {
  if (/[\u0900-\u097F]/.test(q)) return 'mr';
  if (
    /\b(kay|kuthe|kashi|kasa|ahe|aahe|madhe|swast|jevan|khana|kaha|sasta|batao|pudchi|kadi|kadhi)\b/i.test(
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
  is_verified?: boolean | null;
  shop_categories?: Array<{ categories?: { name?: string | null } | null }> | null;
}

function extractCategories(shop: ShopRow): string[] {
  return (shop.shop_categories || [])
    .map((sc) => sc?.categories?.name)
    .filter((name): name is string => Boolean(name));
}

export async function runLocalClientFallback(
  params: AskAssistantParams,
): Promise<AssistantResponsePayload> {
  const { query, cityId, citySlug, villageId, locationLabel } = params;
  const q = query.trim().toLowerCase();
  const lang = detectQueryLanguage(query);

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
    .limit(60);

  if (citySlug === 'muktainagar') {
    shopQuery = shopQuery.or(`city_id.eq.${cityId},city_id.is.null`);
  } else {
    shopQuery = shopQuery.eq('city_id', cityId);
  }

  const [messesRes, pgsRes, schoolsRes, busesRes, shopsRes] = await Promise.allSettled([
    fetchMessesForCity(cityId, villageId),
    fetchPGsForCity(cityId, villageId),
    schoolsRepo.list({ activeOnly: true, cityId, citySlug, limit: 30 }),
    busQuery,
    shopQuery,
  ]);

  const messes = messesRes.status === 'fulfilled' ? messesRes.value : [];
  const pgs = pgsRes.status === 'fulfilled' ? pgsRes.value : [];
  const schools = schoolsRes.status === 'fulfilled' ? schoolsRes.value : [];
  const buses: BusRow[] =
    busesRes.status === 'fulfilled' && Array.isArray(busesRes.value.data)
      ? (busesRes.value.data as BusRow[])
      : [];
  const rawShops: ShopRow[] =
    shopsRes.status === 'fulfilled' && Array.isArray(shopsRes.value.data)
      ? (shopsRes.value.data as ShopRow[])
      : [];

  const shops = villageId
    ? [...rawShops].sort((a, b) => {
        const aMatch = a.village_id === villageId ? 1 : 0;
        const bMatch = b.village_id === villageId ? 1 : 0;
        return bMatch - aMatch;
      })
    : rawShops;

  const isSpecialFood =
    /special|cooked|menu|thali|today|spcl|स्पेशल|मेनू|आज|जेवण|खास|kay banla|kya bana/i.test(q);
  const isAffordableFood =
    /cheap|afford|budget|meal|food|mess|tiffin|lunch|dinner|eat|thali|khana|jevan|swast|sasta|स्वस्त|जेवण|मेस|थाळी|टिफिन/i.test(
      q,
    );
  const isPg =
    /\bpg\b|hostel|room|bed|rent|stay|accommodation|boys|girls|खोली|पीजी|वसतिगृह|राहण्यासाठी/i.test(
      q,
    );
  const isBus =
    /bus|stand|timetable|schedule|depart|departure|pune|jalgaon|malkapur|bhusawal|बस|वेळापत्रक|कधी|पुढची/i.test(
      q,
    );
  const isSchool =
    /school|college|class|coaching|education|study|शाळा|कॉलेज|महाविद्यालय/i.test(q);

  const recs: AssistantRecommendation[] = [];

  if (isSpecialFood || isAffordableFood) {
    const sortedMesses = [...messes].sort((a, b) => {
      if (isSpecialFood) {
        const aSpcl = a.latestMenu?.special_tag || a.latestMenu?.lunch_text || a.latestMenu?.dinner_text ? 1 : 0;
        const bSpcl = b.latestMenu?.special_tag || b.latestMenu?.lunch_text || b.latestMenu?.dinner_text ? 1 : 0;
        if (aSpcl !== bSpcl) return bSpcl - aSpcl;
      }
      const aRate = a.profile.single_thali_rate ?? a.profile.monthly_rate ?? 99999;
      const bRate = b.profile.single_thali_rate ?? b.profile.monthly_rate ?? 99999;
      return aRate - bRate;
    });

    for (const m of sortedMesses.slice(0, 4)) {
      const rateBadge = m.profile.single_thali_rate
        ? `₹${m.profile.single_thali_rate} Thali`
        : m.profile.monthly_rate
          ? `₹${m.profile.monthly_rate}/mo`
          : 'Mess';
      const badge = m.latestMenu?.special_tag ? `Special: ${m.latestMenu.special_tag}` : rateBadge;
      const menuSnippet =
        m.latestMenu?.lunch_text || m.latestMenu?.dinner_text || m.latestMenu?.special_tag;
      recs.push({
        entityType: 'mess',
        id: m.shop.id,
        slug: m.shop.slug,
        title: lang === 'mr' && m.shop.name_mr ? m.shop.name_mr : m.shop.name,
        highlightBadge: badge,
        reason: menuSnippet
          ? `Menu: ${menuSnippet}${m.profile.single_thali_rate ? ` · ₹${m.profile.single_thali_rate}` : ''}`
          : `${m.profile.mess_type === 'pure_veg' ? 'Pure Veg' : 'Veg / Non-Veg'}${m.shop.area ? ` in ${m.shop.area}` : ''}`,
        area: m.shop.area,
      });
    }
  } else if (isPg) {
    const wantsBoys = /\b(boy|boys|male|mulanchya)\b|मुलां/i.test(q);
    const wantsGirls = /\b(girl|girls|female|ladies|mulinchya)\b|मुलीं/i.test(q);
    const filteredPgs = pgs.filter((p) => {
      if (wantsBoys) return p.profile.gender === 'boys' || p.profile.gender === 'coed';
      if (wantsGirls) return p.profile.gender === 'girls' || p.profile.gender === 'coed';
      return true;
    });
    const sortedPgs = [...(filteredPgs.length ? filteredPgs : pgs)].sort(
      (a, b) => (b.profile.available_beds || 0) - (a.profile.available_beds || 0),
    );

    for (const p of sortedPgs.slice(0, 4)) {
      const beds = p.profile.available_beds;
      recs.push({
        entityType: 'pg',
        id: p.shop.id,
        slug: p.shop.slug,
        title: lang === 'mr' && p.shop.name_mr ? p.shop.name_mr : p.shop.name,
        highlightBadge:
          typeof beds === 'number' && beds > 0
            ? `${beds} Beds Open`
            : p.profile.gender || 'PG / Hostel',
        reason: `${p.profile.gender || 'Open'}${p.profile.food_included ? ' · Food Included' : ''}${p.shop.area ? ` · ${p.shop.area}` : ''}`,
        area: p.shop.area,
      });
    }
  } else if (isBus) {
    const nowMin = getNowISTMinutes();
    const tokens = q
      .split(/\s+/)
      .filter((t) => t.length > 2 && !/^(bus|next|when|depart|departing|soon|time|from|for|कधी|बस|पुढची)$/.test(t));

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
        title: lang === 'mr' && b.destination_mr ? b.destination_mr : b.destination,
        highlightBadge: nextDep ? `Next: ${nextDep}` : `${times.length} buses/day`,
        reason: b.notes || (times.length ? `Departures: ${times.slice(0, 4).join(', ')}` : 'Check full bus timetable'),
      });
    }
  } else if (isSchool) {
    const tokens = q
      .split(/\s+/)
      .filter((t) => t.length > 2 && !/^(school|schools|college|colleges|best|top|near|शाळा|कॉलेज)$/.test(t));
    const matchedSchools = schools.filter((s) => {
      if (tokens.length === 0) return true;
      const hay = `${s.name} ${s.name_mr || ''} ${s.area || ''} ${s.medium || ''} ${s.school_type || ''}`.toLowerCase();
      return tokens.some((tok) => hay.includes(tok));
    });

    for (const s of (matchedSchools.length ? matchedSchools : schools).slice(0, 4)) {
      recs.push({
        entityType: 'school',
        id: s.id,
        title: lang === 'mr' && s.name_mr ? s.name_mr : s.name,
        highlightBadge: s.medium ? `${s.medium} Medium` : s.school_type || 'School',
        reason: s.address || s.area || locationLabel,
        area: s.area,
      });
    }
  } else {
    const tokens = q.split(/\s+/).filter((t) => t.length > 2);
    const matchingShops = shops.filter((s) => {
      if (tokens.length === 0) return true;
      const cats = extractCategories(s).join(' ');
      const hay = `${s.name} ${s.name_mr || ''} ${s.area || ''} ${cats}`.toLowerCase();
      return tokens.some((tok) => hay.includes(tok));
    });

    for (const s of (matchingShops.length ? matchingShops : shops).slice(0, 4)) {
      const cats = extractCategories(s);
      recs.push({
        entityType: 'shop',
        id: s.id,
        slug: s.slug,
        title: lang === 'mr' && s.name_mr ? s.name_mr : s.name,
        highlightBadge: s.is_verified ? 'Verified' : cats[0] || 'Local Shop',
        reason: `${s.area || locationLabel}${s.opening_time ? ` · ${s.opening_time}–${s.closing_time || ''}` : ''}`,
        area: s.area,
      });
    }
  }

  let replyText = '';
  if (recs.length === 0) {
    replyText =
      lang === 'mr'
        ? `${locationLabel} मध्ये तुमच्या प्रश्नाशी जुळणारी माहिती सध्या उपलब्ध नाही. कृपया इतर शब्द वापरून शोधा.`
        : `I couldn't find an exact match in ${locationLabel} right now. Try asking about affordable mess meals, PG rooms, bus timings, or local shops.`;
  } else if (lang === 'mr') {
    replyText = `${locationLabel} मधील तुमच्या शोधासाठी ही सर्वात योग्य ठिकाणे आहेत:`;
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
        ? ['आज मेसमध्ये स्पेशल काय आहे?', 'स्वस्त जेवण कुठे मिळेल?', 'पुढची बस कधी आहे?']
        : ["What's special cooked today?", 'Affordable meals near me', 'Next bus departing soon'],
  };
}

let edgeFunctionUnavailable = false;

export function resetAssistantEdgeAvailability(): void {
  edgeFunctionUnavailable = false;
}

export async function askTownAssistant(
  params: AskAssistantParams,
): Promise<AssistantResponsePayload> {
  const trimmedQuery = params.query.trim();
  if (!trimmedQuery) {
    return runLocalClientFallback(params);
  }

  const aiEnabled = import.meta.env.VITE_ENABLE_TOWN_ASSISTANT_AI === 'true';

  if (aiEnabled && !edgeFunctionUnavailable) {
    try {
      const { data, error } = await supabase.functions.invoke('town-assistant', {
        body: {
          query: trimmedQuery,
          cityId: params.cityId,
          villageId: params.villageId || null,
          locationLabel: params.locationLabel,
        },
      });

      if (!error && data && typeof data.replyText === 'string') {
        return data as AssistantResponsePayload;
      }

      // Avoid repeated CORS/404 preflight spam if the Edge Function isn't deployed yet
      edgeFunctionUnavailable = true;
    } catch {
      edgeFunctionUnavailable = true;
    }
  }

  return runLocalClientFallback(params);
}
