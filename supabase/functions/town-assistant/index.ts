import { createClient } from "npm:@supabase/supabase-js@2";
import { GoogleGenAI, Type } from "npm:@google/genai";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type EntityType = "mess" | "pg" | "shop" | "bus" | "school";

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
  detectedLanguage: "en" | "mr" | "hinglish";
  mode: "gemini" | "local-fallback";
  recommendations: AssistantRecommendation[];
  followUpSuggestions: string[];
}

function getTodayISTDate(): string {
  const now = new Date();
  // Shift to IST (+5:30)
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
  if (/\b(kay|kuthe|kashi|kasa|ahe|aahe|madhe|swast|jevan|khana|kaha|sasta|batao|pudchi|kadi)\b/i.test(q)) {
    return "hinglish";
  }
  return "en";
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
  }
): AssistantResponsePayload {
  const q = query.toLowerCase();
  const lang = detectQueryLanguage(query);
  const recs: AssistantRecommendation[] = [];

  const isSpecialFood = /special|cooked|menu|thali|today|spcl|स्पेशल|मेनू|आज|जेवण|खास/i.test(q);
  const isAffordableFood = /cheap|afford|budget|meal|food|mess|tiffin|lunch|dinner|eat|स्वस्त|जेवण|मेस|थाळी|टिफिन/i.test(q);
  const isPg = /pg|hostel|room|bed|rent|stay|accommodation|खोली|पीजी|वसतिगृह|राहण्यासाठी/i.test(q);
  const isBus = /bus|stand|timetable|schedule|depart|pune|jalgaon|malkapur|bhusawal|बस|वेळापत्रक|कधी/i.test(q);
  const isSchool = /school|college|class|coaching|education|study|शाळा|कॉलेज|महाविद्यालय/i.test(q);

  if (isSpecialFood || isAffordableFood) {
    const sortedMesses = [...context.messes].sort((a, b) => {
      if (isSpecialFood) {
        const aSpcl = a.special_tag ? 1 : 0;
        const bSpcl = b.special_tag ? 1 : 0;
        if (aSpcl !== bSpcl) return bSpcl - aSpcl;
      }
      const aRate = a.single_thali_rate ?? a.monthly_rate ?? 99999;
      const bRate = b.single_thali_rate ?? b.monthly_rate ?? 99999;
      return aRate - bRate;
    });

    for (const m of sortedMesses.slice(0, 4)) {
      const rateBadge = m.single_thali_rate
        ? `₹${m.single_thali_rate} Thali`
        : m.monthly_rate
        ? `₹${m.monthly_rate}/mo`
        : "Mess";
      const badge = m.special_tag ? `Special: ${m.special_tag}` : rateBadge;
      const menuSnippet = m.lunch_text || m.dinner_text || m.special_tag;
      recs.push({
        entityType: "mess",
        id: m.id,
        slug: m.slug,
        title: lang === "mr" && m.name_mr ? m.name_mr : m.name,
        highlightBadge: badge,
        reason: menuSnippet
          ? `Menu: ${menuSnippet}${m.single_thali_rate ? ` · ₹${m.single_thali_rate}` : ""}`
          : `${m.mess_type === "pure_veg" ? "Pure Veg" : "Veg / Non-Veg"}${m.area ? ` in ${m.area}` : ""}`,
        area: m.area,
      });
    }
  } else if (isPg) {
    const sortedPgs = [...context.pgs].sort((a, b) => (b.available_beds || 0) - (a.available_beds || 0));
    for (const p of sortedPgs.slice(0, 4)) {
      recs.push({
        entityType: "pg",
        id: p.id,
        slug: p.slug,
        title: lang === "mr" && p.name_mr ? p.name_mr : p.name,
        highlightBadge:
          typeof p.available_beds === "number" && p.available_beds > 0
            ? `${p.available_beds} Beds Open`
            : p.gender || "PG / Hostel",
        reason: `${p.gender || "Open"}${p.food_included ? " · Food Included" : ""}${p.area ? ` · ${p.area}` : ""}`,
        area: p.area,
      });
    }
  } else if (isBus) {
    const nowMin = getNowISTMinutes();
    const matchedBuses = context.buses.filter((b) => {
      const hay = `${b.destination} ${b.destination_mr || ""} ${b.notes || ""}`.toLowerCase();
      const tokens = q.split(/\s+/).filter((t) => t.length > 2 && !/bus|next|when|depart|time|from|for|कधी|बस/.test(t));
      return tokens.length === 0 || tokens.some((tok) => hay.includes(tok));
    });
    for (const b of matchedBuses.slice(0, 4)) {
      const nextDep = (b.departure_times || []).find((t: string) => {
        const m = t.match(/^(\d{1,2}):(\d{2})$/);
        if (!m) return false;
        return parseInt(m[1], 10) * 60 + parseInt(m[2], 10) >= nowMin;
      });
      recs.push({
        entityType: "bus",
        id: b.id,
        title: lang === "mr" && b.destination_mr ? b.destination_mr : b.destination,
        highlightBadge: nextDep ? `Next: ${nextDep}` : `${(b.departure_times || []).length} buses/day`,
        reason: b.notes || `Departures: ${(b.departure_times || []).slice(0, 4).join(", ")}`,
      });
    }
  } else if (isSchool) {
    for (const s of context.schools.slice(0, 4)) {
      recs.push({
        entityType: "school",
        id: s.id,
        title: lang === "mr" && s.name_mr ? s.name_mr : s.name,
        highlightBadge: s.medium ? `${s.medium} Medium` : s.school_type || "School",
        reason: s.address || s.area || locationLabel,
        area: s.area,
      });
    }
  } else {
    const tokens = q.split(/\s+/).filter((t) => t.length > 2);
    const matchingShops = context.shops.filter((s) => {
      const hay = `${s.name} ${s.name_mr || ""} ${s.area || ""} ${(s.categories || []).join(" ")}`.toLowerCase();
      return tokens.length === 0 || tokens.some((tok) => hay.includes(tok));
    });
    for (const s of (matchingShops.length ? matchingShops : context.shops).slice(0, 4)) {
      recs.push({
        entityType: "shop",
        id: s.id,
        slug: s.slug,
        title: lang === "mr" && s.name_mr ? s.name_mr : s.name,
        highlightBadge: s.is_verified ? "Verified" : (s.categories?.[0] || "Local Shop"),
        reason: `${s.area || locationLabel}${s.opening_time ? ` · ${s.opening_time}–${s.closing_time || ""}` : ""}`,
        area: s.area,
      });
    }
  }

  let replyText = "";
  if (recs.length === 0) {
    replyText =
      lang === "mr"
        ? `${locationLabel} मध्ये तुमच्या प्रश्नाशी जुळणारी माहिती सध्या उपलब्ध नाही. कृपया इतर शब्द वापरून शोधा.`
        : `I couldn't find an exact match in ${locationLabel} right now. Try asking about affordable mess meals, PG rooms, bus timings, or medical shops.`;
  } else {
    replyText =
      lang === "mr"
        ? `${locationLabel} मधील तुमच्या शोधासाठी ही सर्वात योग्य ठिकाणे आहेत:`
        : `Here are the top matches found in ${locationLabel} from our live directory:`;
  }

  return {
    replyText,
    detectedLanguage: lang,
    mode: "local-fallback",
    recommendations: recs,
    followUpSuggestions:
      lang === "mr"
        ? ["आज मेसमध्ये स्पेशल काय आहे?", "स्वस्त जेवण कुठे मिळेल?", "पुढची बस कधी आहे?"]
        : ["What's special cooked today?", "Affordable meals near me", "Next bus departing soon"],
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const query = typeof body?.query === "string" ? body.query.trim().slice(0, 400) : "";
    const cityId = typeof body?.cityId === "string" ? body.cityId.trim() : "";
    const villageId = typeof body?.villageId === "string" && UUID_RE.test(body.villageId) ? body.villageId : null;
    const locationLabel = typeof body?.locationLabel === "string" ? body.locationLabel.trim() : "your town";

    if (!query || !cityId || !UUID_RE.test(cityId)) {
      return new Response(
        JSON.stringify({ error: "Valid query and cityId are required." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    const today = getTodayISTDate();

    // Parallel geo-scoped queries strictly bounded to cityId
    const [shopsRes, busesRes, schoolsRes] = await Promise.all([
      sb
        .from("shops")
        .select("*, shop_categories(categories(name))")
        .eq("is_active", true)
        .eq("city_id", cityId)
        .limit(80),
      sb
        .from("bus_timetable")
        .select("id, destination, destination_mr, departure_times, notes")
        .eq("is_active", true)
        .eq("city_id", cityId)
        .order("sort_order", { ascending: true })
        .limit(40),
      sb
        .from("schools")
        .select("id, name, name_mr, school_type, medium, area, address")
        .eq("is_active", true)
        .eq("city_id", cityId)
        .limit(30),
    ]);

    const rawShops = shopsRes.data || [];
    // Prioritize village matches first if villageId is active
    const sortedShops = [...rawShops].sort((a, b) => {
      if (!villageId) return 0;
      const aMatch = a.village_id === villageId ? 1 : 0;
      const bMatch = b.village_id === villageId ? 1 : 0;
      return bMatch - aMatch;
    });

    const shopIds = sortedShops.map((s) => s.id);

    const [messProfRes, messMenuRes, pgProfRes] = shopIds.length
      ? await Promise.all([
          sb.from("mess_profiles").select("*").in("shop_id", shopIds),
          sb
            .from("mess_daily_menus")
            .select("shop_id, menu_date, lunch_text, dinner_text, special_tag")
            .in("shop_id", shopIds)
            .gte("menu_date", "2020-01-01")
            .order("menu_date", { ascending: false })
            .limit(80),
          sb.from("pg_profiles").select("*").in("shop_id", shopIds),
        ])
      : [{ data: [] }, { data: [] }, { data: [] }];

    const shopMap = new Map(sortedShops.map((s) => [s.id, s]));

    // Compact context builders
    const menuByShop = new Map<string, any>();
    for (const m of messMenuRes.data || []) {
      if (!menuByShop.has(m.shop_id) || m.menu_date === today) {
        menuByShop.set(m.shop_id, m);
      }
    }

    const messes = (messProfRes.data || []).map((mp: any) => {
      const s = shopMap.get(mp.shop_id) || {};
      const menu = menuByShop.get(mp.shop_id);
      return {
        id: mp.shop_id,
        slug: s.slug,
        name: s.name,
        name_mr: s.name_mr,
        area: s.area,
        mess_type: mp.mess_type,
        single_thali_rate: mp.single_thali_rate,
        monthly_rate: mp.monthly_rate,
        tiffin_delivery: mp.tiffin_delivery,
        sunday_feast: mp.sunday_feast,
        menu_date: menu?.menu_date || null,
        special_tag: menu?.special_tag || null,
        lunch_text: menu?.lunch_text || null,
        dinner_text: menu?.dinner_text || null,
      };
    });

    const pgs = (pgProfRes.data || []).map((pg: any) => {
      const s = shopMap.get(pg.shop_id) || {};
      return {
        id: pg.shop_id,
        slug: s.slug,
        name: s.name,
        name_mr: s.name_mr,
        area: s.area,
        gender: pg.gender,
        available_beds: pg.available_beds,
        food_included: pg.food_included,
        sharing_rates: pg.sharing_rates,
      };
    });

    const shops = sortedShops.slice(0, 40).map((s: any) => ({
      id: s.id,
      slug: s.slug,
      name: s.name,
      name_mr: s.name_mr,
      area: s.area,
      opening_time: s.opening_time,
      closing_time: s.closing_time,
      is_verified: s.is_verified,
      categories: (s.shop_categories || []).map((sc: any) => sc?.categories?.name).filter(Boolean),
    }));

    const buses = busesRes.data || [];
    const schools = schoolsRes.data || [];

    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiKey) {
      const fallback = buildLocalFallbackResponse(query, locationLabel, {
        messes,
        pgs,
        shops,
        buses,
        schools,
      });
      return new Response(JSON.stringify(fallback), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Call Google Gemini API with structured JSON schema
    const ai = new GoogleGenAI({ apiKey: geminiKey });

    const compactContext = {
      location: locationLabel,
      currentTimeIST: getCurrentISTFormatted(),
      messes: messes.slice(0, 20),
      pgs: pgs.slice(0, 15),
      buses: buses.slice(0, 20),
      schools: schools.slice(0, 15),
      shops: shops.slice(0, 25),
    };

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `User location: ${locationLabel}\nUser question: "${query}"\n\nLive Database Records:\n${JSON.stringify(compactContext)}`,
      config: {
        systemInstruction:
          "You are ApnaLocal Sahayak, a helpful, concise hyper-local town assistant for citizens and students in Maharashtra, India. " +
          "ONLY cite places, prices, menus, bus times, and entity IDs present in the supplied JSON database records. Never invent places or prices. " +
          "Detect the user's query language: reply in Marathi (Devanagari) if asked in Marathi, or natural English/Hinglish matching the user's style. " +
          "Prioritize cheapest thali rates for affordable meal queries, today's special_tag/lunch_text/dinner_text for special food queries, and upcoming departures after currentTimeIST for bus queries.",
        responseMimeType: "application/json",
        responseJsonSchema: {
          type: Type.OBJECT,
          properties: {
            replyText: {
              type: Type.STRING,
              description: "Concise natural response in the user's language summarizing the findings.",
            },
            detectedLanguage: {
              type: Type.STRING,
              description: "One of: en, mr, hinglish",
            },
            recommendations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  entityType: {
                    type: Type.STRING,
                    description: "One of: mess, pg, shop, bus, school",
                  },
                  id: {
                    type: Type.STRING,
                    description: "Exact UUID from the supplied database records.",
                  },
                  title: {
                    type: Type.STRING,
                    description: "Display name of the shop, mess, PG, bus route, or school.",
                  },
                  highlightBadge: {
                    type: Type.STRING,
                    description: "Short badge e.g. '₹60 Thali', 'Special: Puran Poli', 'Next: 14:30', '3 Beds Open'.",
                  },
                  reason: {
                    type: Type.STRING,
                    description: "1-line reason grounded strictly in the DB record.",
                  },
                },
                required: ["entityType", "id", "title", "highlightBadge", "reason"],
              },
            },
            followUpSuggestions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "2 to 3 short follow-up prompt chips in the same language.",
            },
          },
          required: ["replyText", "detectedLanguage", "recommendations", "followUpSuggestions"],
        },
      },
    });

    const parsed = JSON.parse(response.text || "{}");

    // Hydrate slugs/areas and drop any hallucinated IDs not in DB
    const validIds = new Set([
      ...messes.map((x: any) => x.id),
      ...pgs.map((x: any) => x.id),
      ...shops.map((x: any) => x.id),
      ...buses.map((x: any) => x.id),
      ...schools.map((x: any) => x.id),
    ]);

    const hydratedRecs: AssistantRecommendation[] = (parsed.recommendations || [])
      .filter((r: any) => r?.id && validIds.has(r.id))
      .slice(0, 5)
      .map((r: any) => {
        const s = shopMap.get(r.id);
        return {
          entityType: r.entityType,
          id: r.id,
          slug: s?.slug || null,
          title: r.title,
          highlightBadge: r.highlightBadge,
          reason: r.reason,
          area: s?.area || null,
        };
      });

    const payload: AssistantResponsePayload = {
      replyText: parsed.replyText || "Here is what I found in our local directory:",
      detectedLanguage: parsed.detectedLanguage || detectQueryLanguage(query),
      mode: "gemini",
      recommendations: hydratedRecs,
      followUpSuggestions: Array.isArray(parsed.followUpSuggestions) ? parsed.followUpSuggestions.slice(0, 3) : [],
    };

    return new Response(JSON.stringify(payload), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[town-assistant] Error:", err);
    return new Response(
      JSON.stringify({ error: err?.message || "Assistant error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
