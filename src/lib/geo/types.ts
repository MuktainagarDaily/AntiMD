/**
 * Geographic hierarchy types for nationwide multi-town scale.
 * Country (IN) -> State (MH) -> District -> City/Taluka -> Village/Locality.
 */

export interface GeoState {
  id: string;
  code: string;           // 'MH'
  name: string;           // 'Maharashtra'
  name_mr: string | null; // 'महाराष्ट्र'
  is_active: boolean;
}

export interface GeoDistrict {
  id: string;
  state_id: string;
  slug: string;           // 'jalgaon'
  name: string;           // 'Jalgaon'
  name_mr: string | null; // 'जळगाव'
  is_active: boolean;
}

export interface GeoCity {
  id: string;
  district_id: string;
  slug: string;           // 'muktainagar', 'bhusawal', 'varangaon'
  name: string;           // 'Muktainagar'
  name_mr: string | null; // 'मुक्ताईनगर'
  type: 'city' | 'taluka' | 'town';
  latitude: number | null;
  longitude: number | null;
  is_active: boolean;
  sort_order: number;
  district?: GeoDistrict | null;
  /** Denormalized from district.state_id — populated by multi-town hierarchy SQL patch. */
  state_id?: string | null;
}

export interface GeoVillage {
  id: string;
  city_id: string;
  slug: string;           // 'kurha', 'anturli'
  name: string;           // 'Kurha'
  name_mr: string | null; // 'कुऱ्हा'
  pincode: string | null; // '425306'
  latitude: number | null;
  longitude: number | null;
  is_active: boolean;
  sort_order: number;
}

export interface TownBranding {
  name: string;           // 'Muktainagar'
  name_mr: string;        // 'मुक्ताईनगर'
  brandTitle: string;     // 'ApnaTown · Muktainagar'
  brandTitle_mr: string;  // 'ApnaTown · मुक्ताईनगर'
  tagline: string;        // 'Your town. Everything local.'
  tagline_mr: string;     // 'आपलं शहर. स्थानिक सर्वकाही.'
  centerCoords: { lat: number; lng: number };
  /** Optional SEO description for PageSeo component. */
  metaDescription?: string;
}
