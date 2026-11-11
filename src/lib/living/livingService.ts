import { supabase } from '@/integrations/supabase/client';
import {
  type MessWithDetails,
  type MessProfile,
  type MessDailyMenu,
  type MessMenuItem,
  type PGWithDetails,
  type PGProfile,
  type PGRoomItem,
  type PGGender,
  getTodayDateString,
} from './livingTypes';
import { DEMO_MESSES, DEMO_PGS } from './demoLivingData';

export { getTodayDateString };
export const REGULAR_MENU_DATE = '1970-01-01';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Fetch a single mess or hotel listing by its slug or UUID.
 * Checks the Supabase database first and falls back to rich demo data.
 */
export async function fetchMessBySlugOrId(
  slugOrId: string,
  cityId?: string
): Promise<MessWithDetails | null> {
  if (!slugOrId) return null;
  const today = getTodayDateString();

  try {
    const isUuid = UUID_RE.test(slugOrId);
    let q = (supabase as any).from('shops').select('*').eq('is_active', true);
    if (isUuid) {
      q = q.or(`id.eq.${slugOrId},slug.eq.${slugOrId}`);
    } else {
      q = q.eq('slug', slugOrId);
    }
    if (cityId) {
      q = q.eq('city_id', cityId);
    }

    const { data: shop, error } = await q.maybeSingle();

    if (!error && shop) {
      // 1. Fetch profile
      const { data: profile } = await supabase
        .from('mess_profiles')
        .select('*')
        .eq('shop_id', shop.id)
        .maybeSingle();

      // 2. Fetch menus
      const { data: menus } = await supabase
        .from('mess_daily_menus')
        .select('*')
        .eq('shop_id', shop.id)
        .order('menu_date', { ascending: false });

      let todayMenu: MessDailyMenu | null = null;
      let latestMenu: MessDailyMenu | null = null;
      let menuItems: MessMenuItem[] = [];

      (menus || []).forEach((m: any) => {
        if (m.menu_date === REGULAR_MENU_DATE && m.lunch_text) {
          try {
            const parsed = JSON.parse(m.lunch_text);
            if (Array.isArray(parsed)) menuItems = parsed;
          } catch { /* ignore parse error */ }
          return;
        }
        if (!latestMenu) latestMenu = m as MessDailyMenu;
        if (m.menu_date === today && !todayMenu) todayMenu = m as MessDailyMenu;
      });

      const isNonVeg = (shop.amenities || []).some((a: string) => /non[\s-]?veg/i.test(a));
      const resolvedProfile: MessProfile = (profile as MessProfile) || {
        shop_id: shop.id,
        mess_type: isNonVeg ? 'veg_nonveg' : 'pure_veg',
        monthly_rate: null,
        single_thali_rate: null,
        tiffin_delivery: (shop.amenities || []).some((a: string) => /tiffin|delivery/i.test(a)),
        lunch_timing: '11:00 AM - 03:30 PM',
        dinner_timing: '07:00 PM - 11:00 PM',
        sunday_feast: false,
      };

      return {
        ...(shop as any),
        mess_profile: resolvedProfile,
        menu_items: menuItems,
        today_menu: todayMenu,
        latest_menu: latestMenu,
      } as MessWithDetails;
    }
  } catch (err) {
    console.warn('[fetchMessBySlugOrId] Query error:', err);
  }

  if (import.meta.env.DEV) {
    const demoMatch = DEMO_MESSES.find(
      (m) => m.slug === slugOrId || m.id === slugOrId
    );
    if (demoMatch) return demoMatch;
  }

  return null;
}

/**
 * Fetch a single Paying Guest or Hostel by its slug or UUID.
 */
export async function fetchPGBySlugOrId(
  slugOrId: string,
  cityId?: string
): Promise<PGWithDetails | null> {
  if (!slugOrId) return null;

  try {
    const isUuid = UUID_RE.test(slugOrId);
    let q = (supabase as any).from('shops').select('*').eq('is_active', true);
    if (isUuid) {
      q = q.or(`id.eq.${slugOrId},slug.eq.${slugOrId}`);
    } else {
      q = q.eq('slug', slugOrId);
    }
    if (cityId) {
      q = q.eq('city_id', cityId);
    }

    const { data: shop, error } = await q.maybeSingle();

    if (!error && shop) {
      const { data: profile } = await supabase
        .from('pg_profiles')
        .select('*')
        .eq('shop_id', shop.id)
        .maybeSingle();

      return {
        ...(shop as any),
        pg_profile: (profile as PGProfile) || null,
      } as PGWithDetails;
    }
  } catch (err) {
    console.warn('[fetchPGBySlugOrId] Query error:', err);
  }

  if (import.meta.env.DEV) {
    const demoMatch = DEMO_PGS.find(
      (p) => p.slug === slugOrId || p.id === slugOrId
    );
    if (demoMatch) return demoMatch;
  }

  return null;
}

/**
 * Fetch all messes in the specified city/village with their profile and latest daily menu.
 */
export async function fetchMessesForCity(
  cityId: string,
  villageId?: string | null
): Promise<MessWithDetails[]> {
  const today = getTodayDateString();

  try {
    // 1. Fetch mess & restaurant/hotel category IDs if available
    const { data: catData } = await supabase
      .from('categories')
      .select('id, name')
      .or('name.ilike.%mess%,name.ilike.%dining%,name.ilike.%restaurant%,name.ilike.%hotel%');

    const foodCatIds = (catData || []).map((c: any) => c.id);

    // 2. Fetch shops in this location using all columns (including updated_at, photos, etc.)
    let query = (supabase as any)
      .from('shops')
      .select('*')
      .eq('is_active', true)
      .eq('city_id', cityId);

    if (villageId) {
      query = query.eq('village_id', villageId);
    }

    const { data: shops, error: shopsErr } = await query;
    if (shopsErr || !shops || shops.length === 0) {
      return [];
    }

    const shopIds = shops.map((s: any) => s.id);

    // 3. Filter shops that have mess_profile or are tagged with mess/hotel/restaurant category
    let messShopIds = new Set<string>();

    const { data: profiles, error: profErr } = await supabase
      .from('mess_profiles')
      .select('*')
      .in('shop_id', shopIds);

    if (!profErr && profiles) {
      profiles.forEach((p: any) => messShopIds.add(p.shop_id));
    }

    if (foodCatIds.length > 0) {
      const { data: catLinks } = await supabase
        .from('shop_categories')
        .select('shop_id')
        .in('category_id', foodCatIds)
        .in('shop_id', shopIds);
      (catLinks || []).forEach((c: any) => messShopIds.add(c.shop_id));
    }

    // Also include any shop whose name contains "mess", "hotel", "bhojanalay", "restaurant", "dhaba"
    shops.forEach((s: any) => {
      const lower = (s.name || '').toLowerCase();
      if (
        lower.includes('mess') ||
        lower.includes('bhojanalay') ||
        lower.includes('भोजनालय') ||
        lower.includes('dining') ||
        lower.includes('hotel') ||
        lower.includes('हॉटेल') ||
        lower.includes('restaurant') ||
        lower.includes('रेस्टॉरंट') ||
        lower.includes('dhaba') ||
        lower.includes('ढाबा') ||
        lower.includes('tiffin') ||
        lower.includes('टिफिन')
      ) {
        messShopIds.add(s.id);
      }
    });

    const targetShops = shops.filter((s: any) => messShopIds.has(s.id));
    if (targetShops.length === 0) {
      return [];
    }

    // 4. Fetch daily menus for these messes
    const profileMap = new Map<string, MessProfile>();
    (profiles || []).forEach((p: any) => profileMap.set(p.shop_id, p as MessProfile));

    const { data: menus } = await supabase
      .from('mess_daily_menus')
      .select('*')
      .in('shop_id', Array.from(messShopIds))
      .order('menu_date', { ascending: false });

    const latestMenuMap = new Map<string, MessDailyMenu>();
    const todayMenuMap = new Map<string, MessDailyMenu>();
    const menuItemsMap = new Map<string, MessMenuItem[]>();

    (menus || []).forEach((m: any) => {
      // Sentinel row for permanent regular menu card
      if (m.menu_date === REGULAR_MENU_DATE && m.lunch_text) {
        try {
          const parsed = JSON.parse(m.lunch_text);
          if (Array.isArray(parsed)) menuItemsMap.set(m.shop_id, parsed);
        } catch { /* ignore parse error */ }
        return;
      }

      if (!latestMenuMap.has(m.shop_id)) {
        latestMenuMap.set(m.shop_id, m as MessDailyMenu);
      }
      if (m.menu_date === today && !todayMenuMap.has(m.shop_id)) {
        todayMenuMap.set(m.shop_id, m as MessDailyMenu);
      }
    });

    return targetShops.map((shop: any) => {
      const existingProfile = profileMap.get(shop.id);
      const isNonVeg = (shop.amenities || []).some((a: string) => /non[\s-]?veg/i.test(a));
      const profile: MessProfile = existingProfile || {
        shop_id: shop.id,
        mess_type: isNonVeg ? 'veg_nonveg' : 'pure_veg',
        monthly_rate: null,
        single_thali_rate: null,
        tiffin_delivery: (shop.amenities || []).some((a: string) => /tiffin|delivery/i.test(a)),
        lunch_timing: '11:00 AM - 03:30 PM',
        dinner_timing: '07:00 PM - 11:00 PM',
        sunday_feast: false,
      };

      return {
        ...shop,
        mess_profile: profile,
        menu_items: menuItemsMap.get(shop.id) || [],
        today_menu: todayMenuMap.get(shop.id) || null,
        latest_menu: latestMenuMap.get(shop.id) || null,
      };
    });
  } catch (err) {
    console.warn('Error fetching messes:', err);
    return [];
  }
}

/**
 * Fetch all Paying Guests (PGs & Hostels) in the specified city/village with their profile details.
 */
export async function fetchPGsForCity(
  cityId: string,
  villageId?: string | null
): Promise<PGWithDetails[]> {
  try {
    const { data: catData } = await supabase
      .from('categories')
      .select('id')
      .or('name.ilike.%pg%,name.ilike.%hostel%')
      .maybeSingle();

    const pgCatId = catData?.id;

    let query = (supabase as any)
      .from('shops')
      .select('*')
      .eq('is_active', true)
      .eq('city_id', cityId);

    if (villageId) {
      query = query.eq('village_id', villageId);
    }

    const { data: shops, error: shopsErr } = await query;
    if (shopsErr || !shops || shops.length === 0) {
      return [];
    }

    const shopIds = shops.map((s: any) => s.id);
    let pgShopIds = new Set<string>();

    const { data: profiles, error: profErr } = await supabase
      .from('pg_profiles')
      .select('*')
      .in('shop_id', shopIds);

    if (!profErr && profiles) {
      profiles.forEach((p: any) => pgShopIds.add(p.shop_id));
    }

    if (pgCatId) {
      const { data: catLinks } = await supabase
        .from('shop_categories')
        .select('shop_id')
        .eq('category_id', pgCatId)
        .in('shop_id', shopIds);
      (catLinks || []).forEach((c: any) => pgShopIds.add(c.shop_id));
    }

    // Also include shops whose name has "pg", "hostel", or "वसतिगृह"
    shops.forEach((s: any) => {
      const lower = (s.name || '').toLowerCase();
      if (
        lower.includes('pg') ||
        lower.includes('hostel') ||
        lower.includes('rooms')
      ) {
        pgShopIds.add(s.id);
      }
    });

    const targetShops = shops.filter((s: any) => pgShopIds.has(s.id));
    if (targetShops.length === 0) {
      return [];
    }

    const profileMap = new Map<string, PGProfile>();
    (profiles || []).forEach((p: any) => profileMap.set(p.shop_id, p as PGProfile));

    return targetShops.map((shop: any) => ({
      ...shop,
      pg_profile: profileMap.get(shop.id) || null,
    }));
  } catch (err) {
    console.warn('Error fetching PGs:', err);
    return [];
  }
}

/**
 * Save or publish today's menu for a mess (Shop owner or Admin).
 */
export async function saveMessDailyMenu(menu: {
  shop_id: string;
  lunch_text?: string | null;
  dinner_text?: string | null;
  photo_url?: string | null;
  special_tag?: string | null;
  menu_date?: string;
}): Promise<{ data: any; error: any }> {
  const menuDate = menu.menu_date || getTodayDateString();

  const { data, error } = await supabase
    .from('mess_daily_menus')
    .upsert(
      {
        shop_id: menu.shop_id,
        menu_date: menuDate,
        lunch_text: menu.lunch_text || null,
        dinner_text: menu.dinner_text || null,
        photo_url: menu.photo_url || null,
        special_tag: menu.special_tag || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'shop_id,menu_date' }
    )
    .select()
    .single();

  return { data, error };
}

/**
 * Save or update PG vacancies and profile data.
 */
export async function savePGProfile(profile: Partial<PGProfile> & { shop_id: string }): Promise<{ data: any; error: any }> {
  const { data, error } = await supabase
    .from('pg_profiles')
    .upsert(
      {
        ...profile,
        vacancies_updated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'shop_id' }
    )
    .select()
    .single();

  return { data, error };
}

/**
 * Save or update Mess profile data (rates, timings, veg/nonveg).
 */
export async function saveMessProfile(profile: Partial<MessProfile> & { shop_id: string }): Promise<{ data: any; error: any }> {
  const { data, error } = await supabase
    .from('mess_profiles')
    .upsert(
      {
        ...profile,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'shop_id' }
    )
    .select()
    .single();

  return { data, error };
}

/**
 * Fetch permanent regular menu items for a mess.
 */
export async function fetchMessMenuItems(shopId: string): Promise<MessMenuItem[]> {
  try {
    const { data, error } = await supabase
      .from('mess_daily_menus')
      .select('lunch_text')
      .eq('shop_id', shopId)
      .eq('menu_date', REGULAR_MENU_DATE)
      .maybeSingle();

    if (!error && data?.lunch_text) {
      try {
        const parsed = JSON.parse(data.lunch_text);
        if (Array.isArray(parsed)) return parsed as MessMenuItem[];
      } catch { /* ignore parse error */ }
    }
  } catch (err) {
    console.warn('Error fetching mess menu items:', err);
  }

  // Fallback demo menu items if demo mess
  if (shopId.startsWith('demo-')) {
    return [
      { id: 'item-1', name: 'साधी थाळी (Regular Thali)', price: 70, is_available: true },
      { id: 'item-2', name: 'स्पेशल गोड थाळी (Special Sweet Thali)', price: 100, is_available: true },
      { id: 'item-3', name: 'जादा गरम चपाती (Extra Roti)', price: 10, is_available: true },
      { id: 'item-4', name: 'मसाला ताक (Masala Taak)', price: 15, is_available: true },
      { id: 'item-5', name: 'गुलाबजाम २ नग (Gulabjamun)', price: 30, is_available: true },
    ];
  }

  return [];
}

/**
 * Save or update permanent regular menu items for a mess.
 */
export async function saveMessMenuItems(shopId: string, items: MessMenuItem[]): Promise<{ error: any }> {
  const jsonText = JSON.stringify(items);

  const { error } = await supabase
    .from('mess_daily_menus')
    .upsert(
      {
        shop_id: shopId,
        menu_date: REGULAR_MENU_DATE,
        lunch_text: jsonText,
        special_tag: 'MENU_CARD',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'shop_id,menu_date' }
    );

  return { error };
}

export type MessServingSlot = 'serving_lunch' | 'serving_dinner' | 'opens_lunch' | 'opens_dinner' | 'closed';

export interface MessServingInfo {
  slot: MessServingSlot;
  label: string;
  isLive: boolean;
  colorCls: string;
}

/**
 * Computes live serving status (Lunch / Dinner window / Closed) for meal badges.
 */
export function getMessServingStatus(
  mess: { is_open?: boolean; mess_profile?: MessProfile | null },
  locale: string = 'en'
): MessServingInfo {
  const isMr = locale === 'mr';
  if (mess.is_open === false) {
    return {
      slot: 'closed',
      label: isMr ? 'मेस बंद आहे' : 'Closed',
      isLive: false,
      colorCls: 'bg-rose-500/10 text-rose-600 border-rose-500/20',
    };
  }

  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();

  // Lunch window: 11:30 AM to 3:30 PM (690 to 930 mins)
  const lunchStart = 11 * 60 + 30;
  const lunchEnd = 15 * 60 + 30;

  // Dinner window: 7:00 PM to 11:00 PM (1140 to 1380 mins)
  const dinnerStart = 19 * 60;
  const dinnerEnd = 23 * 60;

  if (mins >= lunchStart && mins < lunchEnd) {
    return {
      slot: 'serving_lunch',
      label: isMr ? 'दुपारचे जेवण सुरू आहे' : 'Serving Hot Lunch Now',
      isLive: true,
      colorCls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    };
  }

  if (mins >= dinnerStart && mins < dinnerEnd) {
    return {
      slot: 'serving_dinner',
      label: isMr ? 'रात्रीचे जेवण सुरू आहे' : 'Serving Dinner Now',
      isLive: true,
      colorCls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    };
  }

  if (mins >= lunchEnd && mins < dinnerStart) {
    return {
      slot: 'opens_dinner',
      label: isMr ? 'संध्या. ७:०० वा. सुरू होईल' : 'Dinner opens 7:00 PM',
      isLive: false,
      colorCls: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20',
    };
  }

  return {
    slot: 'opens_lunch',
    label: isMr ? 'दुपारी ११:३० वा. सुरू होईल' : 'Lunch opens 11:30 AM',
    isLive: false,
    colorCls: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20',
  };
}

/**
 * Returns true if today is Sunday and the mess has Sunday Feast enabled.
 */
export function isSundaySpecialActive(mess_profile?: MessProfile | null): boolean {
  if (!mess_profile?.sunday_feast) return false;
  return new Date().getDay() === 0;
}

/**
 * Calculates total and available beds from room-by-room items.
 */
export function calculatePGBedsFromRooms(rooms: PGRoomItem[]): { totalBeds: number; availableBeds: number } {
  const totalBeds = rooms.reduce((acc, r) => acc + (Number(r.total_beds) || 0), 0);
  const availableBeds = rooms.reduce((acc, r) => acc + (Number(r.available_beds) || 0), 0);
  return { totalBeds, availableBeds };
}

export interface PGWhatsAppBroadcastOptions {
  shopName: string;
  shopNameMr?: string | null;
  area?: string | null;
  address?: string | null;
  gender: PGGender;
  availableBeds: number;
  rates: {
    rate1?: number | string | null;
    rate2?: number | string | null;
    rate3?: number | string | null;
    rate4?: number | string | null;
  };
  depositAmount?: number;
  foodIncluded?: boolean;
  gateClosingTime?: string;
  amenities?: string[];
  phone?: string | null;
  whatsapp?: string | null;
  baseUrl?: string;
  isMr?: boolean;
}

/**
 * Generates formatted 1-tap WhatsApp broadcast text for PG owners to share in student groups.
 */
export function formatPGWhatsAppBroadcast(options: PGWhatsAppBroadcastOptions): string {
  const isMr = options.isMr ?? true;
  const displayName = isMr && options.shopNameMr ? options.shopNameMr : options.shopName;
  const ratesArr = [
    Number(options.rates.rate1),
    Number(options.rates.rate2),
    Number(options.rates.rate3),
    Number(options.rates.rate4),
  ].filter((r) => !isNaN(r) && r > 0);

  const lowestRate = ratesArr.length > 0 ? Math.min(...ratesArr) : null;
  const rentText = lowestRate
    ? `₹${lowestRate}/${isMr ? 'महिन्यापासून' : 'month onwards'}`
    : isMr ? 'माफक दरात' : 'Affordable rates';

  const genderText = options.gender === 'girls'
    ? (isMr ? '👧 मुलींचे वसतिगृह / पीजी' : '👧 Girls Hostel / PG')
    : options.gender === 'boys'
    ? (isMr ? '👦 मुलांचे वसतिगृह / पीजी' : '👦 Boys Hostel / PG')
    : (isMr ? '👫 स्वतंत्र विंग्स पीजी' : '👫 Co-ed / Separate Wings PG');

  const textLines: string[] = [
    `🛏️ *${displayName}* - ${isMr ? 'खोल्या व बेड रिक्त आहेत!' : 'Rooms & Beds Available!'} 🛏️`,
    `━━━━━━━━━━━━━━━━━━`,
    `📍 ${isMr ? 'ठिकाण' : 'Location'}: ${options.area || options.address || (isMr ? 'मुख्य परिसर' : 'Prime Location')}`,
    `🏢 ${isMr ? 'प्रकार' : 'Type'}: ${genderText}`,
    `💰 ${isMr ? 'भाडे' : 'Rent'}: ${rentText}${options.depositAmount ? ` (${isMr ? 'डिपॉझिट' : 'Deposit'}: ₹${options.depositAmount})` : ''}`,
    `✅ ${isMr ? 'रिक्त जागा' : 'Vacancies'}: ${options.availableBeds > 0 ? `${options.availableBeds} ${isMr ? 'बेड उपलब्ध' : 'beds vacant'}` : (isMr ? 'मर्यादित जागा' : 'Few seats left')}`,
    `🍲 ${isMr ? 'जेवण' : 'Food'}: ${options.foodIncluded ? (isMr ? 'नाश्ता / जेवण समाविष्ट आहे' : 'Meals Included') : (isMr ? 'मेस सुविधा जवळ उपलब्ध' : 'Nearby mess available')}`,
    `🕒 ${isMr ? 'गेट वेळ' : 'Gate Closing'}: ${options.gateClosingTime || '10:00 PM'}`,
    `━━━━━━━━━━━━━━━━━━`,
  ];

  if (options.amenities && options.amenities.length > 0) {
    textLines.push(`✨ *${isMr ? 'सुविधा' : 'Amenities'}:* ${options.amenities.slice(0, 6).join(', ')}`);
    textLines.push('');
  }

  const contact = options.phone || options.whatsapp;
  if (contact) {
    textLines.push(`📞 ${isMr ? 'संपर्क' : 'Contact'}: ${contact}`);
  }

  const base = options.baseUrl || 'https://muktainagar.app';
  textLines.push('');
  textLines.push(isMr ? 'फोटो व संपूर्ण माहिती पाहण्यासाठी क्लिक करा:' : 'View photos and full details here:');
  textLines.push(`${base}/pg`);

  return textLines.join('\n');
}



