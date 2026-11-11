/**
 * Fuzzy shop search with typo tolerance, bilingual (EN + MR) matching,
 * and tiered ranking that prefers exact / prefix matches before fuzzy ones.
 *
 * Ranking tiers (best → worst):
 *   0. Exact name match (EN or MR), case-insensitive
 *   1. Name starts-with query
 *   2. Name contains query (substring)
 *   3. Area / sub-area / category contains query
 *   4. Address / keywords / description contains query
 *   5. Remaining fuzzy (typo-tolerant) matches from Fuse.js
 *
 * Pure numeric queries (≥3 digits) fall back to exact phone/whatsapp match.
 */
import Fuse, { type IFuseOptions } from 'fuse.js';
import type { ShopTranslation, CategoryTranslation } from '@/hooks/useTranslationsCache';
import { synonymTokensFor } from './searchSynonyms';

export interface SearchableShop {
  id: string;
  name?: string | null;
  area?: string | null;
  sub_area?: string | null;
  address?: string | null;
  description?: string | null;
  keywords?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  shop_categories?: Array<{ category_id?: string; categories?: { name?: string | null } | null }> | null;
}

interface IndexedShop {
  shop: SearchableShop;
  name: string;
  area: string;
  address: string;
  description: string;
  keywords: string;
  categories: string;
  phone: string;
  // Pre-computed lower-case strings for fast tiered ranking.
  _nameEn: string;
  _nameMr: string;
  _areaAll: string;
  _categoriesAll: string;
  _addressAll: string;
  _descAll: string;
  _keywordsAll: string;
}

function buildIndexed(
  shop: SearchableShop,
  trMap?: Map<string, ShopTranslation>,
  catTrMap?: Map<string, CategoryTranslation>,
): IndexedShop {
  const t = trMap?.get(shop.id);
  const catParts: string[] = [];
  (shop.shop_categories || []).forEach((sc) => {
    const enName = sc.categories?.name;
    if (enName) catParts.push(enName);
    const mr = sc.category_id ? catTrMap?.get(sc.category_id)?.name : null;
    if (mr) catParts.push(mr);
  });
  return {
    shop,
    name: [shop.name, t?.name].filter(Boolean).join(' | '),
    area: [shop.area, shop.sub_area, t?.area, t?.sub_area].filter(Boolean).join(' | '),
    address: [shop.address, t?.address].filter(Boolean).join(' | '),
    description: [shop.description, t?.description].filter(Boolean).join(' | '),
    keywords: [shop.keywords, t?.keywords].filter(Boolean).join(' | '),
    categories: catParts.join(' | '),
    phone: [shop.phone, shop.whatsapp].filter(Boolean).join(' '),
    _nameEn: (shop.name || '').toLowerCase(),
    _nameMr: (t?.name || '').toLowerCase(),
    _areaAll: [shop.area, shop.sub_area, t?.area, t?.sub_area].filter(Boolean).join(' ').toLowerCase(),
    _categoriesAll: catParts.join(' ').toLowerCase(),
    _addressAll: [shop.address, t?.address].filter(Boolean).join(' ').toLowerCase(),
    _descAll: [shop.description, t?.description].filter(Boolean).join(' ').toLowerCase(),
    _keywordsAll: [shop.keywords, t?.keywords].filter(Boolean).join(' ').toLowerCase(),
  };
}

const FUSE_OPTIONS: IFuseOptions<IndexedShop> = {
  includeScore: true,
  threshold: 0.4,
  ignoreLocation: true,
  minMatchCharLength: 2,
  keys: [
    { name: 'name', weight: 0.45 },
    { name: 'categories', weight: 0.18 },
    { name: 'area', weight: 0.14 },
    { name: 'keywords', weight: 0.1 },
    { name: 'address', weight: 0.08 },
    { name: 'description', weight: 0.05 },
  ],
};

export function buildShopFuse(
  shops: SearchableShop[],
  trMap?: Map<string, ShopTranslation>,
  catTrMap?: Map<string, CategoryTranslation>,
) {
  const indexed = shops.map((s) => buildIndexed(s, trMap, catTrMap));
  const fuse = new Fuse(indexed, FUSE_OPTIONS);
  // Attach indexed list so consumers can re-use it without rebuilding.
  (fuse as any).__indexed = indexed;
  return fuse;
}

function tierFor(item: IndexedShop, q: string): number {
  const eq = item._nameEn === q || item._nameMr === q;
  if (eq) return 0;
  if (item._nameEn.startsWith(q) || item._nameMr.startsWith(q)) return 1;
  if (item._nameEn.includes(q) || item._nameMr.includes(q)) return 2;
  if (item._areaAll.includes(q) || item._categoriesAll.includes(q)) return 3;
  if (item._addressAll.includes(q) || item._keywordsAll.includes(q) || item._descAll.includes(q)) return 4;
  return 5; // fuzzy-only
}

/**
 * Run a fuzzy search and return matched shops in tiered + score order.
 * Exact and prefix matches always beat typo matches.
 */
export function fuzzySearchShops(
  fuse: Fuse<IndexedShop>,
  shops: SearchableShop[],
  query: string,
  trMap?: Map<string, ShopTranslation>,
  catTrMap?: Map<string, CategoryTranslation>,
  limit?: number,
): SearchableShop[] {
  const q = query.trim();
  if (!q) return shops;

  // Numeric search → exact phone/whatsapp match
  if (/^\d{3,}$/.test(q)) {
    const out = shops.filter(
      (s) => (s.phone || '').includes(q) || (s.whatsapp || '').includes(q),
    );
    return limit ? out.slice(0, limit) : out;
  }

  const qLower = q.toLowerCase();
  const synonymTokens = synonymTokensFor(q);
  const indexed: IndexedShop[] = (fuse as any).__indexed || [];

  // 1) Collect tiered exact/substring hits across all indexed shops.
  const byId = new Map<string, { item: IndexedShop; tier: number; score: number }>();
  indexed.forEach((item) => {
    let tier = tierFor(item, qLower);
    if (tier === 5 && synonymTokens.length) {
      // Synonym-driven category/keyword hit → tier 3 (same as direct category match).
      const hit = synonymTokens.some(
        (t) => item._categoriesAll.includes(t) || item._keywordsAll.includes(t),
      );
      if (hit) tier = 3;
    }
    if (tier < 5) byId.set(item.shop.id, { item, tier, score: 0 });
  });

  // 2) Add fuzzy hits (original query + synonym-expanded query) for typo tolerance.
  const fuseQuery = synonymTokens.length ? `${q} ${synonymTokens.join(' ')}` : q;
  const fuseResults = fuse.search(fuseQuery);
  fuseResults.forEach((r) => {
    if (!byId.has(r.item.shop.id)) {
      byId.set(r.item.shop.id, { item: r.item, tier: 5, score: r.score ?? 1 });
    } else {
      // If a literal-match shop also has a fuse score, keep the better score for stable ordering.
      const existing = byId.get(r.item.shop.id)!;
      existing.score = Math.min(existing.score, r.score ?? 1);
    }
  });

  const sorted = Array.from(byId.values()).sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    if (a.score !== b.score) return a.score - b.score;
    return a.item._nameEn.localeCompare(b.item._nameEn);
  });

  const mapped = sorted.map((r) => r.item.shop);
  return limit ? mapped.slice(0, limit) : mapped;
}

// ---------------------------------------------------------------------------
// Highlighting helpers
// ---------------------------------------------------------------------------

/**
 * Build the set of query tokens used for literal highlight rendering.
 * Splits on whitespace, drops short tokens, lower-cases.
 */
export function buildHighlightTokens(query: string): string[] {
  return query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length >= 2);
}

export interface HighlightPart {
  text: string;
  match: boolean;
}

/**
 * Split a display string into highlight parts based on literal token matches
 * (case-insensitive). Works for both English and Marathi text because it
 * relies purely on substring positions in the original string.
 */
export function highlightParts(text: string | null | undefined, tokens: string[]): HighlightPart[] {
  if (!text) return [];
  if (!tokens.length) return [{ text, match: false }];

  const lower = text.toLowerCase();
  // Find all match ranges, then merge overlapping/adjacent ones.
  const ranges: Array<[number, number]> = [];
  tokens.forEach((tok) => {
    if (!tok) return;
    let from = 0;
    while (from <= lower.length) {
      const idx = lower.indexOf(tok, from);
      if (idx === -1) break;
      ranges.push([idx, idx + tok.length]);
      from = idx + tok.length;
    }
  });
  if (!ranges.length) return [{ text, match: false }];

  ranges.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  ranges.forEach((r) => {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) {
      last[1] = Math.max(last[1], r[1]);
    } else {
      merged.push([r[0], r[1]]);
    }
  });

  const parts: HighlightPart[] = [];
  let cursor = 0;
  merged.forEach(([start, end]) => {
    if (start > cursor) parts.push({ text: text.slice(cursor, start), match: false });
    parts.push({ text: text.slice(start, end), match: true });
    cursor = end;
  });
  if (cursor < text.length) parts.push({ text: text.slice(cursor), match: false });
  return parts;
}
