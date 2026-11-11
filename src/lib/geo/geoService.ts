/**
 * Geographic data service for multi-town hierarchy.
 * Fetches states, districts, cities, and villages with resilient offline fallbacks.
 */
import { supabase } from '@/integrations/supabase/client';
import type { GeoState, GeoDistrict, GeoCity, GeoVillage } from './types';

// Real Supabase baseline seed for Muktainagar & Jalgaon District & Pune / Maval
export const DEFAULT_STATE: GeoState = {
  id: 'aca9c33c-aee7-4f19-bced-1a025ab851cd',
  code: 'MH',
  name: 'Maharashtra',
  name_mr: 'महाराष्ट्र',
  is_active: true,
};

export const DEFAULT_DISTRICT: GeoDistrict = {
  id: '603e0eb6-1cf5-424e-9f37-9d5824470f28',
  state_id: 'aca9c33c-aee7-4f19-bced-1a025ab851cd',
  slug: 'jalgaon',
  name: 'Jalgaon',
  name_mr: 'जळगाव',
  is_active: true,
};

export const DEFAULT_DISTRICT_PUNE: GeoDistrict = {
  id: '16fd81b5-f870-474d-97a6-9eb125d8acaa',
  state_id: 'aca9c33c-aee7-4f19-bced-1a025ab851cd',
  slug: 'pune',
  name: 'Pune',
  name_mr: 'पुणे',
  is_active: true,
};

export const DEFAULT_CITIES: GeoCity[] = [
  {
    id: '644b68eb-472c-40d3-9f83-c7d26e121498',
    district_id: '603e0eb6-1cf5-424e-9f37-9d5824470f28',
    slug: 'muktainagar',
    name: 'Muktainagar',
    name_mr: 'मुक्ताईनगर',
    type: 'taluka',
    latitude: 21.0758,
    longitude: 75.9817,
    is_active: true,
    sort_order: 1,
    district: DEFAULT_DISTRICT,
  },
  {
    id: '7706db04-fb9e-4c11-9c45-c1959b3daf42',
    district_id: '603e0eb6-1cf5-424e-9f37-9d5824470f28',
    slug: 'bhusawal',
    name: 'Bhusawal',
    name_mr: 'भुसावळ',
    type: 'city',
    latitude: 21.0455,
    longitude: 75.8011,
    is_active: true,
    sort_order: 2,
    district: DEFAULT_DISTRICT,
  },
  {
    id: '30ff4af4-8894-487b-9d05-e442374d3978',
    district_id: '603e0eb6-1cf5-424e-9f37-9d5824470f28',
    slug: 'varangaon',
    name: 'Varangaon',
    name_mr: 'वरणगाव',
    type: 'town',
    latitude: 21.0182,
    longitude: 75.9038,
    is_active: true,
    sort_order: 3,
    district: DEFAULT_DISTRICT,
  },
  {
    id: '80bb0d78-b4d6-43fc-a730-d6aa277e5519',
    district_id: '603e0eb6-1cf5-424e-9f37-9d5824470f28',
    slug: 'bodwad',
    name: 'Bodwad',
    name_mr: 'बोदवड',
    type: 'taluka',
    latitude: 20.8837,
    longitude: 76.0028,
    is_active: true,
    sort_order: 4,
    district: DEFAULT_DISTRICT,
  },
  {
    id: '98aba7d0-ba7f-443f-a9bc-2f3079b06fe6',
    district_id: '16fd81b5-f870-474d-97a6-9eb125d8acaa',
    slug: 'maval',
    name: 'Maval',
    name_mr: 'मावळ',
    type: 'taluka',
    latitude: 18.7546,
    longitude: 73.5414,
    is_active: true,
    sort_order: 5,
    district: DEFAULT_DISTRICT_PUNE,
  },
  {
    id: 'ea3a297d-feac-4e74-8834-f6df43a9e6b7',
    district_id: '16fd81b5-f870-474d-97a6-9eb125d8acaa',
    slug: 'pune',
    name: 'Pune',
    name_mr: 'पुणे',
    type: 'city',
    latitude: 18.5204,
    longitude: 73.8567,
    is_active: true,
    sort_order: 6,
    district: DEFAULT_DISTRICT_PUNE,
  },
];

export const DEFAULT_VILLAGES_MUKTAINAGAR: GeoVillage[] = [
  { id: 'd9046095-770b-4b71-bfde-2e9a5b2518c2', city_id: '644b68eb-472c-40d3-9f83-c7d26e121498', slug: 'kurha', name: 'Kurha Kakoda', name_mr: 'कुऱ्हा काकोडा', pincode: '425306', latitude: 21.0024, longitude: 76.0451, is_active: true, sort_order: 1 },
  { id: '51fa5553-7eb5-4307-af90-082dde051e20', city_id: '644b68eb-472c-40d3-9f83-c7d26e121498', slug: 'anturli', name: 'Anturli', name_mr: 'अंतुर्ली', pincode: '425306', latitude: 21.1215, longitude: 76.0123, is_active: true, sort_order: 2 },
  { id: '4fe36a20-5a02-4efd-bdac-e842bdf6dec5', city_id: '644b68eb-472c-40d3-9f83-c7d26e121498', slug: 'changdev', name: 'Changdev', name_mr: 'चांगदेव', pincode: '425306', latitude: 21.0924, longitude: 76.0354, is_active: true, sort_order: 3 },
  { id: 'ea22d464-76e8-43ff-bc13-60b5217e1cb9', city_id: '644b68eb-472c-40d3-9f83-c7d26e121498', slug: 'pothara', name: 'Pothara', name_mr: 'पोथरा', pincode: '425306', latitude: 21.0412, longitude: 75.9521, is_active: true, sort_order: 4 },
  { id: '4346ed75-a944-4723-b4e9-bdb9b6e46afe', city_id: '644b68eb-472c-40d3-9f83-c7d26e121498', slug: 'taroda', name: 'Taroda', name_mr: 'तरोडा', pincode: '425306', latitude: 21.0612, longitude: 75.9234, is_active: true, sort_order: 5 },
  { id: 'b7171204-b5c4-408b-bd99-a503ba2ccec2', city_id: '644b68eb-472c-40d3-9f83-c7d26e121498', slug: 'kothali', name: 'Kothali', name_mr: 'कोथळी', pincode: '425306', latitude: 21.0850, longitude: 75.9910, is_active: true, sort_order: 6 },
  { id: 'b83fe333-632a-4d80-b163-22286fba3c43', city_id: '644b68eb-472c-40d3-9f83-c7d26e121498', slug: 'nadgaon', name: 'Nadgaon', name_mr: 'नांदगाव', pincode: '425306', latitude: 21.0345, longitude: 76.0210, is_active: true, sort_order: 7 },
  { id: 'b2fc1e7b-bc12-4fb6-82c2-6ad367d51bc2', city_id: '644b68eb-472c-40d3-9f83-c7d26e121498', slug: 'uchande', name: 'Uchande', name_mr: 'उचंदे', pincode: '425306', latitude: 21.0543, longitude: 76.0421, is_active: true, sort_order: 8 },
];

export const DEFAULT_VILLAGES_MAVAL: GeoVillage[] = [
  { id: 'eea5f1fb-04a7-4f53-b3a4-497a781324b3', city_id: '98aba7d0-ba7f-443f-a9bc-2f3079b06fe6', slug: 'parandwadi', name: 'Parandwadi', name_mr: 'परंदवडी', pincode: '410506', latitude: 18.7247, longitude: 73.6872, is_active: true, sort_order: 1 },
  { id: 'a2b3150e-3e27-43b8-8413-76d35c3889be', city_id: '98aba7d0-ba7f-443f-a9bc-2f3079b06fe6', slug: 'talegaon-dabhade', name: 'Talegaon Dabhade', name_mr: 'तळेगाव दाभाडे', pincode: '410506', latitude: 18.7344, longitude: 73.6761, is_active: true, sort_order: 2 },
  { id: '90796ddb-7d21-4262-84f7-cfb2634c29e0', city_id: '98aba7d0-ba7f-443f-a9bc-2f3079b06fe6', slug: 'vadgaon', name: 'Vadgaon', name_mr: 'वडगाव', pincode: '412106', latitude: 18.7494, longitude: 73.6457, is_active: true, sort_order: 3 },
  { id: '3e40fbf6-20d3-40c2-9036-8f00f229847e', city_id: '98aba7d0-ba7f-443f-a9bc-2f3079b06fe6', slug: 'somatane', name: 'Somatane', name_mr: 'सोमाटणे', pincode: '410506', latitude: 18.7090, longitude: 73.6790, is_active: true, sort_order: 4 },
  { id: '0977479c-b30b-4c08-af68-189f1bc6beaa', city_id: '98aba7d0-ba7f-443f-a9bc-2f3079b06fe6', slug: 'kamshet', name: 'Kamshet', name_mr: 'कामशेत', pincode: '410405', latitude: 18.7610, longitude: 73.5594, is_active: true, sort_order: 5 },
  { id: '9ce5991d-f882-4007-8f60-0ecaf8f0c1e2', city_id: '98aba7d0-ba7f-443f-a9bc-2f3079b06fe6', slug: 'lonavala', name: 'Lonavala', name_mr: 'लोणावळा', pincode: '410401', latitude: 18.7557, longitude: 73.4091, is_active: true, sort_order: 6 },
];

export async function fetchActiveCities(): Promise<GeoCity[]> {
  try {
    const { data, error } = await supabase
      .from('geo_cities')
      .select('id, district_id, slug, name, name_mr, type, latitude, longitude, is_active, sort_order, geo_districts(id, state_id, slug, name, name_mr)')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error || !data || data.length === 0) {
      return DEFAULT_CITIES;
    }

    return data.map((r: any) => ({
      ...r,
      district: r.geo_districts ?? DEFAULT_DISTRICT,
    }));
  } catch {
    return DEFAULT_CITIES;
  }
}

export async function fetchVillagesForCity(cityId: string): Promise<GeoVillage[]> {
  try {
    const { data, error } = await supabase
      .from('geo_villages')
      .select('id, city_id, slug, name, name_mr, pincode, latitude, longitude, is_active, sort_order')
      .eq('city_id', cityId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error || !data || data.length === 0) {
      if (cityId === DEFAULT_CITIES[0].id || cityId === 'muktainagar') {
        return DEFAULT_VILLAGES_MUKTAINAGAR;
      }
      if (cityId === '98aba7d0-ba7f-443f-a9bc-2f3079b06fe6' || cityId === 'maval') {
        return DEFAULT_VILLAGES_MAVAL;
      }
      return [];
    }

    return data as GeoVillage[];
  } catch {
    if (cityId === DEFAULT_CITIES[0].id || cityId === 'muktainagar') {
      return DEFAULT_VILLAGES_MUKTAINAGAR;
    }
    if (cityId === '98aba7d0-ba7f-443f-a9bc-2f3079b06fe6' || cityId === 'maval') {
      return DEFAULT_VILLAGES_MAVAL;
    }
    return [];
  }
}

export async function fetchAllActiveVillages(): Promise<GeoVillage[]> {
  try {
    const { data, error } = await supabase
      .from('geo_villages')
      .select('id, city_id, slug, name, name_mr, pincode, latitude, longitude, is_active, sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error || !data || data.length === 0) {
      return [...DEFAULT_VILLAGES_MUKTAINAGAR, ...DEFAULT_VILLAGES_MAVAL];
    }
    return data as GeoVillage[];
  } catch {
    return [...DEFAULT_VILLAGES_MUKTAINAGAR, ...DEFAULT_VILLAGES_MAVAL];
  }
}
