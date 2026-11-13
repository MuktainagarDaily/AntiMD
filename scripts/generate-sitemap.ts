/**
 * Generates public/sitemap.xml by fetching active shops + categories from
 * Supabase via the public REST API. Runs as a `predev` and `prebuild` hook
 * so the file is always up to date before the dev server boots or the
 * production build copies `public/` into `dist/`.
 *
 * Reads VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY from .env.
 */
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const BASE_URL = process.env.VITE_SITE_URL || 'https://apnatownn.lovable.app';

// --- Load .env without a dotenv dependency -------------------------------
function loadEnv() {
  const path = resolve('.env');
  if (!existsSync(path)) return;
  const txt = readFileSync(path, 'utf8');
  for (const raw of txt.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const k = line.slice(0, eq).trim();
    let v = line.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!(k in process.env)) process.env[k] = v;
  }
}
loadEnv();

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || 'https://fhlaqgzensagjangkpop.supabase.co';
const SUPABASE_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZobGFxZ3plbnNhZ2phbmdrcG9wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMzU3NzcsImV4cCI6MjA4NzcxMTc3N30.JoeKwYWsW9LoTya_V8eNpJhqnz0wDHa03bXE1KdlvuQ';

interface SitemapEntry {
  path: string;
  lastmod?: string;
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: string;
}

async function fetchRows<T>(table: string, query: string): Promise<T[]> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return [];
  const url = `${SUPABASE_URL}/rest/v1/${table}?${query}`;
  try {
    const res = await fetch(url, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    if (!res.ok) {
      console.warn(`[sitemap] ${table}: ${res.status} ${res.statusText}`);
      return [];
    }
    return (await res.json()) as T[];
  } catch (e) {
    console.warn(`[sitemap] ${table} fetch failed:`, (e as Error).message);
    return [];
  }
}

function xmlEscape(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function renderSitemap(entries: SitemapEntry[]) {
  const urls = entries.map((e) =>
    [
      `  <url>`,
      `    <loc>${xmlEscape(BASE_URL + e.path)}</loc>`,
      e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
      e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
      e.priority ? `    <priority>${e.priority}</priority>` : null,
      `  </url>`,
    ]
      .filter(Boolean)
      .join('\n'),
  );

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...urls,
    `</urlset>`,
    '',
  ].join('\n');
}

async function main() {
  const entries: SitemapEntry[] = [
    { path: '/', changefreq: 'daily', priority: '1.0' },
  ];

  // Active cities
  const rawCities = await fetchRows<{ slug: string; is_active?: boolean }>(
    'geo_cities',
    'select=slug,is_active&is_active=eq.true',
  );
  const cities = rawCities.length > 0 ? rawCities : [
    { slug: 'muktainagar' },
    { slug: 'varangaon' },
    { slug: 'bodwad' },
    { slug: 'bhusawal' },
    { slug: 'jalgaon' },
  ];

  for (const city of cities) {
    entries.push(
      { path: `/${city.slug}`, changefreq: 'daily', priority: '1.0' },
      { path: `/${city.slug}/shops`, changefreq: 'daily', priority: '0.9' },
      { path: `/${city.slug}/bus-timetable`, changefreq: 'weekly', priority: '0.8' },
      { path: `/${city.slug}/schools`, changefreq: 'monthly', priority: '0.7' },
    );
  }

  // Active shops
  const shops = await fetchRows<{ id: string; slug: string | null; updated_at?: string }>(
    'shops',
    'select=id,slug,updated_at&is_active=eq.true',
  );
  for (const s of shops) {
    const seg = s.slug || s.id;
    // Default town prefix (muktainagar) + legacy redirect support
    entries.push({
      path: `/muktainagar/shop/${encodeURIComponent(seg)}`,
      lastmod: s.updated_at ? s.updated_at.slice(0, 10) : undefined,
      changefreq: 'weekly',
      priority: '0.8',
    });
  }

  // Active categories
  const categories = await fetchRows<{ name: string; is_active?: boolean }>(
    'categories',
    'select=name,is_active&is_active=eq.true',
  );
  for (const c of categories) {
    entries.push({
      path: `/muktainagar/shops?category=${encodeURIComponent(c.name)}`,
      changefreq: 'weekly',
      priority: '0.6',
    });
  }

  const xml = renderSitemap(entries);
  writeFileSync(resolve('public/sitemap.xml'), xml);
  console.log(
    `[sitemap] wrote public/sitemap.xml — ${entries.length} entries (${cities.length} cities, ${shops.length} shops, ${categories.length} categories)`,
  );
}

main().catch((e) => {
  console.error('[sitemap] failed:', e);
  // Don't break dev/build if Supabase is unreachable; emit a minimal sitemap.
  const fallback = renderSitemap([
    { path: '/', changefreq: 'daily', priority: '1.0' },
    { path: '/shops', changefreq: 'daily', priority: '0.9' },
  ]);
  writeFileSync(resolve('public/sitemap.xml'), fallback);
});
