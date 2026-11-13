/**
 * Build-time prerender pass.
 *
 * Runs after `vite build`. For each public route, clones dist/index.html,
 * injects route-specific <title>, meta, canonical, og:* and JSON-LD into
 * <head>, and writes a static HTML file at dist/<route>/index.html.
 *
 * Result: crawlers and social-preview bots hitting /shop/<slug> get correct
 * meta + LocalBusiness JSON-LD before any JS executes. The SPA still
 * hydrates normally on top of the same shell.
 *
 * This is intentionally NOT a full DOM prerender (no headless Chromium —
 * would not run reliably in the build sandbox). It is the SEO-critical
 * subset: head meta + structured data.
 */
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';

const BASE_URL = process.env.VITE_SITE_URL || 'https://apnatownn.lovable.app';
const SITE_NAME = 'Muktainagar Daily';
const DEFAULT_DESCRIPTION =
  'Find local shops and services in Muktainagar. Your hyperlocal business directory — grocery, medical, restaurants and more.';
const DEFAULT_IMAGE = `${BASE_URL}/og-image.png`;

// --- .env loader (no dotenv dep) ----------------------------------------
function loadEnv() {
  const path = resolve('.env');
  if (!existsSync(path)) return;
  for (const raw of readFileSync(path, 'utf8').split('\n')) {
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

async function fetchRows<T>(table: string, query: string): Promise<T[]> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return [];
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));
    if (!res.ok) return [];
    return (await res.json()) as T[];
  } catch {
    return [];
  }
}

function htmlEscape(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

type Meta = {
  title: string;
  description: string;
  path: string;
  image?: string;
  noindex?: boolean;
  jsonLd?: object[];
  ogType?: string;
};

/** Strip existing tags we plan to replace, then inject ours. */
function injectMeta(shell: string, meta: Meta): string {
  let html = shell;

  // Remove existing per-page-overridable tags (keep viewport, charset, etc.).
  html = html
    .replace(/<title>[\s\S]*?<\/title>/i, '')
    .replace(/<meta\s+name=["']description["'][^>]*>/gi, '')
    .replace(/<meta\s+name=["']robots["'][^>]*>/gi, '')
    .replace(/<link\s+rel=["']canonical["'][^>]*>/gi, '')
    .replace(/<meta\s+property=["']og:(title|description|url|image|type|site_name)["'][^>]*>/gi, '')
    .replace(/<meta\s+name=["']twitter:(card|title|description|image)["'][^>]*>/gi, '');

  const absImg = meta.image
    ? meta.image.startsWith('http')
      ? meta.image
      : `${BASE_URL}${meta.image.startsWith('/') ? '' : '/'}${meta.image}`
    : DEFAULT_IMAGE;
  const url = `${BASE_URL}${meta.path}`;

  const tags: string[] = [
    `<title>${htmlEscape(meta.title)}</title>`,
    `<meta name="description" content="${htmlEscape(meta.description)}" />`,
    `<link rel="canonical" href="${htmlEscape(url)}" />`,
    `<meta property="og:site_name" content="${htmlEscape(SITE_NAME)}" />`,
    `<meta property="og:title" content="${htmlEscape(meta.title)}" />`,
    `<meta property="og:description" content="${htmlEscape(meta.description)}" />`,
    `<meta property="og:url" content="${htmlEscape(url)}" />`,
    `<meta property="og:type" content="${htmlEscape(meta.ogType || 'website')}" />`,
    `<meta property="og:image" content="${htmlEscape(absImg)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${htmlEscape(meta.title)}" />`,
    `<meta name="twitter:description" content="${htmlEscape(meta.description)}" />`,
    `<meta name="twitter:image" content="${htmlEscape(absImg)}" />`,
  ];
  if (meta.noindex) tags.push(`<meta name="robots" content="noindex, nofollow" />`);
  for (const ld of meta.jsonLd ?? []) {
    tags.push(
      `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`,
    );
  }

  return html.replace('</head>', `    ${tags.join('\n    ')}\n  </head>`);
}

function writeRoute(routePath: string, html: string) {
  // "/" → dist/index.html (overwrite); "/shop/abc" → dist/shop/abc/index.html
  const out =
    routePath === '/'
      ? resolve('dist/index.html')
      : resolve('dist' + routePath.replace(/\/$/, '') + '/index.html');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html);
}

async function main() {
  const shellPath = resolve('dist/index.html');
  if (!existsSync(shellPath)) {
    console.warn('[prerender] dist/index.html missing — skipping (run after vite build).');
    return;
  }
  const shell = readFileSync(shellPath, 'utf8');

  let count = 0;

  // --- Home ---------------------------------------------------------------
  const homeMeta = {
    title: 'Muktainagar Daily — Local Business Directory',
    description: DEFAULT_DESCRIPTION,
    path: '/',
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: SITE_NAME,
        url: BASE_URL,
        potentialAction: {
          '@type': 'SearchAction',
          target: `${BASE_URL}/muktainagar/shops?search={search_term_string}`,
          'query-input': 'required name=search_term_string',
        },
      },
      {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: SITE_NAME,
        url: BASE_URL,
        logo: `${BASE_URL}/icons/icon-512.png`,
        areaServed: {
          '@type': 'City',
          name: 'Muktainagar',
          containedInPlace: { '@type': 'AdministrativeArea', name: 'Jalgaon, Maharashtra, India' },
        },
      },
    ],
  };
  writeRoute('/', injectMeta(shell, homeMeta));
  writeRoute('/muktainagar', injectMeta(shell, { ...homeMeta, path: '/muktainagar' }));
  count += 2;

  // --- /shops -------------------------------------------------------------
  const shopsMeta = {
    title: 'All Shops in Muktainagar — Muktainagar Daily',
    description:
      'Browse all local shops and services in Muktainagar. Filter by category, area, and open now.',
    path: '/shops',
  };
  writeRoute('/shops', injectMeta(shell, shopsMeta));
  writeRoute('/muktainagar/shops', injectMeta(shell, { ...shopsMeta, path: '/muktainagar/shops' }));
  count += 2;

  // --- /shop/:slug --------------------------------------------------------
  type Shop = {
    id: string;
    slug: string | null;
    name: string;
    description: string | null;
    address: string | null;
    area: string | null;
    sub_area: string | null;
    phone: string | null;
    image_url: string | null;
    latitude: number | null;
    longitude: number | null;
    opening_time: string | null;
    closing_time: string | null;
    is_verified?: boolean | null;
  };
  const shops = await fetchRows<Shop>(
    'shops',
    'select=id,slug,name,description,address,area,sub_area,phone,image_url,latitude,longitude,opening_time,closing_time,is_verified&is_active=eq.true',
  );

  for (const s of shops) {
    const seg = s.slug || s.id;
    const where = [s.area, s.sub_area].filter(Boolean).join(', ');
    const title = `${s.name}${where ? ` — ${where}` : ''} | Muktainagar Daily`;
    const description =
      s.description?.slice(0, 155) ||
      `Contact ${s.name}${where ? ` in ${where}` : ''}, Muktainagar. Phone, WhatsApp, hours and directions.`;

    const localBusiness: any = {
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      '@id': `${BASE_URL}/shop/${seg}`,
      name: s.name,
      url: `${BASE_URL}/shop/${seg}`,
    };
    if (s.image_url) localBusiness.image = s.image_url;
    if (s.phone) localBusiness.telephone = s.phone;
    if (s.address || s.area) {
      localBusiness.address = {
        '@type': 'PostalAddress',
        streetAddress: s.address || undefined,
        addressLocality: s.area || 'Muktainagar',
        addressRegion: 'Maharashtra',
        addressCountry: 'IN',
      };
    }
    if (s.latitude && s.longitude) {
      localBusiness.geo = {
        '@type': 'GeoCoordinates',
        latitude: s.latitude,
        longitude: s.longitude,
      };
    }
    if (s.opening_time && s.closing_time) {
      localBusiness.openingHoursSpecification = {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        opens: s.opening_time,
        closes: s.closing_time,
      };
    }

    const shopHtml = injectMeta(shell, {
      title,
      description,
      path: `/muktainagar/shop/${seg}`,
      image: s.image_url || undefined,
      jsonLd: [localBusiness],
    });
    writeRoute(`/shop/${seg}`, shopHtml);
    writeRoute(`/muktainagar/shop/${seg}`, shopHtml);
    count += 2;
  }

  console.log(`[prerender] wrote ${count} static HTML files into dist/`);
}

main().catch((e) => {
  console.error('[prerender] failed:', e);
  // Non-fatal: build artifacts still ship; we just lose the per-route meta.
});
