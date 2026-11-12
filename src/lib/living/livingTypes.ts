export type MessType = 'pure_veg' | 'veg_nonveg' | 'jain_available';
export type PGGender = 'boys' | 'girls' | 'both';

export type MessMenuCategory = 'thali' | 'extra' | 'sweet_beverage' | 'pass' | 'other';

export interface MessMenuItem {
  id: string;
  name: string;
  price: number;
  is_available: boolean;
  category?: MessMenuCategory;
}

export interface MessProfile {
  shop_id: string;
  mess_type: MessType;
  monthly_rate: number | null;
  single_thali_rate: number | null;
  tiffin_delivery: boolean;
  lunch_timing: string | null;
  dinner_timing: string | null;
  sunday_feast: boolean;
  menu_items?: MessMenuItem[];
  created_at?: string;
  updated_at?: string;
}

export interface MessDailyMenu {
  id: string;
  shop_id: string;
  menu_date: string; // YYYY-MM-DD
  lunch_text: string | null;
  dinner_text: string | null;
  photo_url: string | null;
  special_tag: string | null;
  created_at: string;
  updated_at: string;
}

export interface MessWithDetails {
  id: string;
  name: string;
  name_mr?: string | null;
  description?: string | null;
  slug?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  address?: string | null;
  area?: string | null;
  city_id?: string | null;
  village_id?: string | null;
  image_url?: string | null;
  photos?: string[] | null;
  amenities?: string[] | null;
  is_verified?: boolean;
  is_active?: boolean;
  mess_profile: MessProfile | null;
  menu_items?: MessMenuItem[];
  today_menu: MessDailyMenu | null;
  latest_menu: MessDailyMenu | null;
}

export interface PGRoomItem {
  id: string;
  room_number: string;
  total_beds: number;
  available_beds: number;
  sharing_type?: '1_sharing' | '2_sharing' | '3_sharing' | '4_sharing' | 'other';
}

export interface PGSharingRates {
  '1_sharing'?: number | null;
  '2_sharing'?: number | null;
  '3_sharing'?: number | null;
  '4_sharing'?: number | null;
  rooms?: PGRoomItem[];
  [key: string]: any;
}

export interface PGProfile {
  shop_id: string;
  gender: PGGender;
  occupancy_target: 'students' | 'professionals' | 'any';
  total_beds: number;
  available_beds: number;
  deposit_amount: number;
  notice_period_days: number;
  gate_closing_time: string | null;
  food_included: boolean;
  amenities: string[];
  sharing_rates: PGSharingRates;
  rooms?: PGRoomItem[];
  vacancies_updated_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PGWithDetails {
  id: string;
  name: string;
  name_mr?: string | null;
  slug?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  address?: string | null;
  area?: string | null;
  city_id?: string | null;
  village_id?: string | null;
  image_url?: string | null;
  photos?: string[] | null;
  amenities?: string[] | null;
  is_verified?: boolean;
  is_active?: boolean;
  pg_profile: PGProfile | null;
}

export function getTodayDateString(): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' });
    return formatter.format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export type FoodEstablishmentType = 'hotel' | 'mess' | 'tiffin';

/**
 * Determine whether a listing is a Hotel/Restaurant, Tiffin Delivery service, or Mess/Bhojanalay.
 */
export function getEstablishmentCategory(entity: {
  name?: string | null;
  name_mr?: string | null;
  amenities?: string[] | null;
}): FoodEstablishmentType {
  const raw = (entity.name || '').toLowerCase();
  const rawMr = (entity.name_mr || '').toLowerCase();
  const ams = (entity.amenities || []).join(' ').toLowerCase();
  const combined = `${raw} ${rawMr} ${ams}`;

  if (
    combined.includes('hotel') ||
    combined.includes('हॉटेल') ||
    combined.includes('restaurant') ||
    combined.includes('रेस्टॉरंट') ||
    combined.includes('dhaba') ||
    combined.includes('ढाबा') ||
    combined.includes('dining hall') ||
    combined.includes('family restaurant')
  ) {
    return 'hotel';
  }
  if (
    combined.includes('tiffin') ||
    combined.includes('टिफिन') ||
    combined.includes('daba') ||
    combined.includes('डबा')
  ) {
    return 'tiffin';
  }
  return 'mess';
}


