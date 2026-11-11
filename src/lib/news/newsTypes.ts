export type NewsCategory =
  | 'local'
  | 'civic'
  | 'education'
  | 'agriculture'
  | 'markets'
  | 'sports'
  | 'alerts';

export type NewsLanguage = 'mr' | 'en' | 'hi';

export type NewsSourceType = 'rss' | 'webpage';

export type NewsDateRange = 'all' | 'today' | '7d' | '30d';

export interface NewsSource {
  id: string;
  city_id: string;
  name: string;
  source_type: NewsSourceType;
  url: string;
  language: NewsLanguage;
  category_default: NewsCategory;
  is_active: boolean;
  last_scraped_at?: string | null;
  last_status?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface LocalNewsItem {
  id: string;
  city_id: string;
  village_id?: string | null;
  source_id?: string | null;
  title: string;
  title_mr?: string | null;
  summary?: string | null;
  summary_mr?: string | null;
  category: NewsCategory;
  language: NewsLanguage;
  source_name: string;
  source_url?: string | null;
  image_url?: string | null;
  published_at: string;
  scraped_at: string;
  is_pinned: boolean;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface NewsCategoryMeta {
  value: NewsCategory;
  labelEn: string;
  labelMr: string;
}

export const NEWS_CATEGORIES: NewsCategoryMeta[] = [
  { value: 'local', labelEn: 'Town & Village', labelMr: 'शहर व गाव' },
  { value: 'civic', labelEn: 'Civic & Infra', labelMr: 'नागरी व पायाभूत' },
  { value: 'agriculture', labelEn: 'Agriculture', labelMr: 'शेती व बाजार' },
  { value: 'education', labelEn: 'Education', labelMr: 'शिक्षण' },
  { value: 'markets', labelEn: 'Business & Mandi', labelMr: 'व्यापार व मंडी' },
  { value: 'sports', labelEn: 'Sports & Youth', labelMr: 'क्रीडा व युवा' },
  { value: 'alerts', labelEn: 'Public Alerts', labelMr: 'तात्काळ सूचना' },
];

export interface ScrapeSourceReport {
  sourceName: string;
  url: string;
  fetched: number;
  inserted: number;
  skippedInvalidDate: number;
  error?: string;
}

export interface ScrapeNewsResult {
  items: LocalNewsItem[];
  insertedCount: number;
  fetchedCount: number;
  storageMode: 'supabase' | 'local-cache';
  reports: ScrapeSourceReport[];
}
