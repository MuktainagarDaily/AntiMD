/**
 * Pure Data Quality, Multi-Town Scoping, Duplicate Detection & Listing Hygiene Helpers.
 *
 * Designed specifically to prevent:
 *  - Devanagari text stripping collisions (`"बस स्टँड"` and `"गांधी चौक"` collapsing to `""`)
 *  - Cross-town area merge corruption (`College Road` in Muktainagar vs Talegaon/Maval)
 *  - Name-prefix false duplicates (`"Shree Ganesh"` vs `"Shree Swami"`)
 *  - Unchecked WhatsApp duplicates & malformed placeholder phone numbers (`0000000000`)
 */

export const dqHasDevanagari = (s: string): boolean => /[\u0900-\u097F]/.test(s);

/**
 * Normalize an area name for near-duplicate comparison WITHOUT stripping
 * Devanagari characters. Returns `'__empty__'` for blank input so empty areas
 * never collide with anything else.
 */
export function dqAreaCompareKey(area: string | null | undefined): string {
  if (!area || !area.trim()) return '__empty__';
  const normalized = area
    .normalize('NFC')
    .trim()
    .toLowerCase()
    // Strip ASCII punctuation/symbols while keeping Latin, digits, spaces, and full Devanagari block
    .replace(/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~।॥]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return normalized || '__empty__';
}

export function dqNormalizeAreaValue(s: string): string {
  return s
    .normalize('NFC')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/(^|[\s,/.-])([a-z])/g, (_, sep, c) => sep + c.toUpperCase());
}

const PLACEHOLDER_AREAS = new Set([
  'na',
  'n/a',
  'none',
  'null',
  'test',
  'testing',
  'unknown',
  'xyz',
  'abc',
  'area',
  'other',
  'demo',
]);

export function dqIsSuspiciousArea(area: string): boolean {
  const t = area.trim();
  if (t.length < 3) return true;
  if (/^\d+$/.test(t)) return true;
  if (PLACEHOLDER_AREAS.has(t.toLowerCase())) return true;
  if (!dqHasDevanagari(t) && t === t.toUpperCase() && /[A-Z]{3,}/.test(t)) return true;
  return false;
}

/* ── City Scoping & City-Safe Area Summary ────────────────────────────────── */

export function resolveEntityCityKey(
  cityId: string | null | undefined,
  defaultCityId?: string | null,
): string {
  if (cityId) return cityId;
  if (defaultCityId) return defaultCityId;
  return '__unassigned__';
}

export function matchesCityFilter(
  rowCityId: string | null | undefined,
  cityFilter: string | undefined,
  defaultCityId?: string | null,
): boolean {
  if (!cityFilter || cityFilter === 'all') return true;
  if (rowCityId === cityFilter) return true;
  if (defaultCityId && cityFilter === defaultCityId && !rowCityId) return true;
  return false;
}

export interface AreaSummaryItem {
  compositeKey: string; // `${cityKey}::${area}`
  cityKey: string;
  cityName: string;
  area: string;
  count: number;
  compareKey: string;
  suspicious: boolean;
}

export function buildCityAreaSummary(
  shops: Array<{ area?: string | null; city_id?: string | null }>,
  opts: {
    cityFilter?: string;
    defaultCityId?: string | null;
    cityNameMap?: Map<string, string>;
  } = {},
): AreaSummaryItem[] {
  const map = new Map<string, AreaSummaryItem>();

  for (const s of shops) {
    if (!matchesCityFilter(s.city_id, opts.cityFilter, opts.defaultCityId)) continue;
    const area = s.area?.trim();
    if (!area) continue;
    const cityKey = resolveEntityCityKey(s.city_id, opts.defaultCityId);
    const compositeKey = `${cityKey}::${area}`;
    const existing = map.get(compositeKey);
    if (existing) {
      existing.count += 1;
    } else {
      const cityName =
        opts.cityNameMap?.get(cityKey) ||
        (cityKey === opts.defaultCityId ? 'Muktainagar' : 'Unassigned Town');
      map.set(compositeKey, {
        compositeKey,
        cityKey,
        cityName,
        area,
        count: 1,
        compareKey: dqAreaCompareKey(area),
        suspicious: dqIsSuspiciousArea(area),
      });
    }
  }

  return Array.from(map.values()).sort(
    (a, b) => b.count - a.count || a.cityName.localeCompare(b.cityName) || a.area.localeCompare(b.area),
  );
}

/**
 * Group similar area spellings STRICTLY WITHIN THE SAME TOWN (`cityKey`),
 * returning maps keyed by `${cityKey}::${compareKey}` and candidate targets by `compositeKey`.
 */
export function findSimilarAreaGroups(areaSummary: AreaSummaryItem[]): {
  groups: Map<string, AreaSummaryItem[]>;
  bestCandidateByCompositeKey: Map<string, string | null>;
} {
  const byCityAndKey = new Map<string, AreaSummaryItem[]>();
  for (const item of areaSummary) {
    if (item.compareKey === '__empty__') continue;
    const groupKey = `${item.cityKey}::${item.compareKey}`;
    const arr = byCityAndKey.get(groupKey) ?? [];
    arr.push(item);
    byCityAndKey.set(groupKey, arr);
  }

  const groups = new Map<string, AreaSummaryItem[]>();
  const bestCandidateByCompositeKey = new Map<string, string | null>();

  byCityAndKey.forEach((items, groupKey) => {
    if (items.length <= 1) return;
    groups.set(groupKey, items);
    const sorted = [...items].sort(
      (a, b) =>
        b.count - a.count ||
        (dqHasDevanagari(b.area) ? 1 : 0) - (dqHasDevanagari(a.area) ? 1 : 0) ||
        a.area.length - b.area.length,
    );
    const best = sorted[0].area;
    items.forEach((it) => {
      bestCandidateByCompositeKey.set(it.compositeKey, it.area === best ? null : best);
    });
  });

  return { groups, bestCandidateByCompositeKey };
}

/* ── Phone Validation & Duplicate Detection ──────────────────────────────── */

const OBVIOUS_FAKE_PHONES = new Set([
  '0000000000',
  '1234567890',
  '0123456789',
  '9876543210',
]);

/**
 * Canonical 10-digit phone normalization for duplicate comparisons.
 * Rejects placeholders (<10 digits, repeated `9999999999`, `0000000000`, `1234567890`).
 */
export function normalizePhone10(raw?: string | null): string | null {
  if (!raw) return null;
  let d = String(raw).replace(/\D/g, '');
  if (!d) return null;
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  else if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  else if (d.length === 13 && d.startsWith('091')) d = d.slice(3);

  if (d.length !== 10) return null;
  if (/^(\d)\1{9}$/.test(d)) return null;
  if (OBVIOUS_FAKE_PHONES.has(d)) return null;
  return d;
}

/**
 * Strict phone validity for Listing Hygiene checks:
 * accepts valid 10-digit Indian mobile numbers (`6-9...`, with optional 0/91 prefix)
 * as well as valid Indian STD landline numbers (`0` + STD + subscriber, 10–11 digits),
 * while rejecting placeholder/repeated/short strings.
 */
export function isValidListingPhone(raw?: string | null): boolean {
  if (!raw || !raw.trim()) return false;
  const digits = String(raw).replace(/\D/g, '');
  if (/^(\d)\1+$/.test(digits)) return false;

  // Mobile number (10 digits starting 6-9, or with 0 / 91 prefix)
  const n10 = normalizePhone10(raw);
  if (n10 && /^[6-9]\d{9}$/.test(n10)) return true;

  // Indian STD landline: e.g. 02583-234567 (11 digits starting with 02..08) or 10-digit STD starting 2..8
  if (digits.length === 11 && /^0[2-8]\d{9}$/.test(digits) && !OBVIOUS_FAKE_PHONES.has(digits.slice(1))) {
    return true;
  }
  if (digits.length === 10 && /^[2-8]\d{9}$/.test(digits) && !OBVIOUS_FAKE_PHONES.has(digits)) {
    return true;
  }
  return false;
}

const NAME_STOP_WORDS = new Set([
  'shree',
  'shri',
  'sri',
  'sai',
  'new',
  'the',
  'store',
  'stores',
  'shop',
  'center',
  'centre',
  'enterprise',
  'enterprises',
  'traders',
  'trading',
  'and',
  'pvt',
  'ltd',
  'co',
  'mr',
  'श्री',
  'न्यू',
  'दुकान',
  'स्टोअर',
  'स्टोअर्स',
  'सेंटर',
  'अँड',
]);

function extractMeaningfulNameTokens(name: string): {
  tokens: string[];
  joined: string;
} {
  const cleaned = name
    .normalize('NFC')
    .toLowerCase()
    .replace(/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~।॥]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const rawTokens = cleaned.split(' ').filter(Boolean);
  // Keep at least one word if every word happens to be a stop word (e.g. "Sai Stores")
  const filtered = rawTokens.filter((w) => !NAME_STOP_WORDS.has(w));
  const tokens = filtered.length > 0 ? filtered : rawTokens;
  return { tokens, joined: tokens.join(' ') };
}

function charBigrams(str: string): Map<string, number> {
  const s = str.replace(/\s+/g, '');
  const map = new Map<string, number>();
  if (s.length < 2) {
    if (s) map.set(s, 1);
    return map;
  }
  for (let i = 0; i < s.length - 1; i++) {
    const bg = s.slice(i, i + 2);
    map.set(bg, (map.get(bg) || 0) + 1);
  }
  return map;
}

/**
 * Compute normalized similarity `[0, 1]` between two listing names after removing
 * generic honorific/suffix stop words (`shree`, `stores`, `center`, etc.).
 */
export function nameSimilarityScore(aRaw: string, bRaw: string): number {
  if (!aRaw?.trim() || !bRaw?.trim()) return 0;
  const a = extractMeaningfulNameTokens(aRaw);
  const b = extractMeaningfulNameTokens(bRaw);
  if (!a.joined || !b.joined) return 0;
  if (a.joined === b.joined) return 1;

  // If the full names only differ by generic suffix (meaningful tokens identical or plural 's')
  const aCompact = a.joined.replace(/\s+/g, '');
  const bCompact = b.joined.replace(/\s+/g, '');
  if (aCompact + 's' === bCompact || bCompact + 's' === aCompact) return 0.95;

  const bgA = charBigrams(a.joined);
  const bgB = charBigrams(b.joined);
  let totalA = 0;
  let totalB = 0;
  let intersection = 0;
  bgA.forEach((cnt, bg) => {
    totalA += cnt;
    const other = bgB.get(bg) || 0;
    intersection += Math.min(cnt, other);
  });
  bgB.forEach((cnt) => {
    totalB += cnt;
  });

  if (totalA + totalB === 0) return 0;
  return (2 * intersection) / (totalA + totalB);
}

export type DuplicateMatchReason =
  | 'Phone'
  | 'WhatsApp'
  | 'Phone ↔ WhatsApp'
  | 'Similar Name & Area'
  | 'Cross-Town Phone';

export interface DuplicateGroup {
  id: string;
  reasons: DuplicateMatchReason[];
  cityKey: string;
  cityName: string;
  crossTown: boolean;
  shops: any[];
}

export function findDuplicateShops(
  shops: any[],
  opts: {
    cityFilter?: string;
    defaultCityId?: string | null;
    cityNameMap?: Map<string, string>;
    includeCrossTownPhones?: boolean;
    nameThreshold?: number;
  } = {},
): DuplicateGroup[] {
  const threshold = opts.nameThreshold ?? 0.75;
  const scopedShops = shops.filter((s) =>
    matchesCityFilter(s.city_id, opts.cityFilter, opts.defaultCityId),
  );

  // Union-Find per same-town bucket so overlapping matches merge cleanly into one group
  const parent = new Map<string, string>();
  const reasonsByRoot = new Map<string, Set<DuplicateMatchReason>>();

  const find = (id: string): string => {
    let cur = id;
    while (parent.get(cur) !== cur) {
      cur = parent.get(cur)!;
    }
    return cur;
  };

  const union = (aId: string, bId: string, reason: DuplicateMatchReason) => {
    const ra = find(aId);
    const rb = find(bId);
    const root = ra <= rb ? ra : rb;
    const other = ra <= rb ? rb : ra;
    if (root !== other) {
      parent.set(other, root);
      const merged = new Set<DuplicateMatchReason>([
        ...(reasonsByRoot.get(root) ?? []),
        ...(reasonsByRoot.get(other) ?? []),
        reason,
      ]);
      reasonsByRoot.set(root, merged);
      reasonsByRoot.delete(other);
    } else {
      const set = reasonsByRoot.get(root) ?? new Set<DuplicateMatchReason>();
      set.add(reason);
      reasonsByRoot.set(root, set);
    }
  };

  const shopById = new Map<string, any>();
  for (const s of scopedShops) {
    parent.set(s.id, s.id);
    shopById.set(s.id, s);
  }

  // 1) Phone & WhatsApp exact normalized matches WITHIN the same town
  const phoneIndex = new Map<string, { id: string; via: 'phone' | 'whatsapp' }[]>();
  for (const s of scopedShops) {
    const cityKey = resolveEntityCityKey(s.city_id, opts.defaultCityId);
    const p10 = normalizePhone10(s.phone);
    const w10 = normalizePhone10(s.whatsapp);
    if (p10) {
      const key = `${cityKey}::${p10}`;
      const list = phoneIndex.get(key) ?? [];
      list.push({ id: s.id, via: 'phone' });
      phoneIndex.set(key, list);
    }
    if (w10 && w10 !== p10) {
      const key = `${cityKey}::${w10}`;
      const list = phoneIndex.get(key) ?? [];
      list.push({ id: s.id, via: 'whatsapp' });
      phoneIndex.set(key, list);
    }
  }

  phoneIndex.forEach((entries) => {
    const uniqueShopIds = Array.from(new Set(entries.map((e) => e.id)));
    if (uniqueShopIds.length <= 1) return;
    const vias = new Set(entries.map((e) => e.via));
    const reason: DuplicateMatchReason =
      vias.size > 1
        ? 'Phone ↔ WhatsApp'
        : vias.has('whatsapp')
          ? 'WhatsApp'
          : 'Phone';
    for (let i = 1; i < uniqueShopIds.length; i++) {
      union(uniqueShopIds[0], uniqueShopIds[i], reason);
    }
  });

  // 2) Similar Name & Area WITHIN the same (cityKey, areaKey)
  const byCityArea = new Map<string, any[]>();
  for (const s of scopedShops) {
    const cityKey = resolveEntityCityKey(s.city_id, opts.defaultCityId);
    const areaKey = dqAreaCompareKey(s.area);
    if (areaKey === '__empty__' || !s.name?.trim()) continue;
    const key = `${cityKey}::${areaKey}`;
    const list = byCityArea.get(key) ?? [];
    list.push(s);
    byCityArea.set(key, list);
  }

  byCityArea.forEach((bucket) => {
    if (bucket.length <= 1) return;
    for (let i = 0; i < bucket.length; i++) {
      for (let j = i + 1; j < bucket.length; j++) {
        if (nameSimilarityScore(bucket[i].name, bucket[j].name) >= threshold) {
          union(bucket[i].id, bucket[j].id, 'Similar Name & Area');
        }
      }
    }
  });

  // Collect same-town groups
  const grouped = new Map<string, any[]>();
  for (const s of scopedShops) {
    const root = find(s.id);
    const list = grouped.get(root) ?? [];
    list.push(s);
    grouped.set(root, list);
  }

  const results: DuplicateGroup[] = [];
  grouped.forEach((list, root) => {
    if (list.length <= 1) return;
    const cityKey = resolveEntityCityKey(list[0].city_id, opts.defaultCityId);
    const cityName =
      opts.cityNameMap?.get(cityKey) ||
      (cityKey === opts.defaultCityId ? 'Muktainagar' : 'Unassigned Town');
    results.push({
      id: `town:${root}`,
      reasons: Array.from(reasonsByRoot.get(root) ?? ['Phone']),
      cityKey,
      cityName,
      crossTown: false,
      shops: list,
    });
  });

  // 3) Optional separate cross-town phone matches across ALL towns
  if (opts.includeCrossTownPhones) {
    const globalPhoneMap = new Map<string, any[]>();
    for (const s of shops) {
      const nums = new Set<string>();
      const p10 = normalizePhone10(s.phone);
      const w10 = normalizePhone10(s.whatsapp);
      if (p10) nums.add(p10);
      if (w10) nums.add(w10);
      nums.forEach((num) => {
        const list = globalPhoneMap.get(num) ?? [];
        list.push(s);
        globalPhoneMap.set(num, list);
      });
    }

    globalPhoneMap.forEach((list, num) => {
      if (list.length <= 1) return;
      const distinctCities = new Set(
        list.map((s) => resolveEntityCityKey(s.city_id, opts.defaultCityId)),
      );
      if (distinctCities.size <= 1) return; // already captured by same-town check
      results.push({
        id: `cross:${num}`,
        reasons: ['Cross-Town Phone'],
        cityKey: 'cross-town',
        cityName: Array.from(distinctCities)
          .map((ck) => opts.cityNameMap?.get(ck) || 'Unknown Town')
          .join(' · '),
        crossTown: true,
        shops: list,
      });
    });
  }

  return results;
}

/* ── Listing Hygiene & Completeness Scanner ──────────────────────────────── */

export type HygieneFlag =
  | 'missing_phone'
  | 'invalid_phone'
  | 'unverified'
  | 'no_photo'
  | 'broken_photo'
  | 'no_gps'
  | 'missing_marathi';

export interface HygieneListingRow {
  entityKind: 'shop' | 'school';
  id: string;
  name: string;
  area: string | null;
  cityKey: string;
  cityName: string;
  phone: string | null;
  whatsapp: string | null;
  isVerified: boolean;
  isActive: boolean;
  imageUrl: string | null;
  hasGps: boolean;
  flags: HygieneFlag[];
  raw: any;
}

export interface ListingHygieneReport {
  items: HygieneListingRow[];
  totalScanned: number;
  counts: Record<HygieneFlag, number>;
}

export function buildListingHygieneReport(opts: {
  shops: any[];
  schools?: any[];
  translatedShopIds: Set<string>;
  cityFilter?: string;
  defaultCityId?: string | null;
  cityNameMap?: Map<string, string>;
}): ListingHygieneReport {
  const items: HygieneListingRow[] = [];
  const counts: Record<HygieneFlag, number> = {
    missing_phone: 0,
    invalid_phone: 0,
    unverified: 0,
    no_photo: 0,
    broken_photo: 0,
    no_gps: 0,
    missing_marathi: 0,
  };

  let totalScanned = 0;

  const inspectRow = (row: any, entityKind: 'shop' | 'school') => {
    if (!matchesCityFilter(row.city_id, opts.cityFilter, opts.defaultCityId)) return;
    totalScanned++;

    const flags: HygieneFlag[] = [];
    const hasPhone = Boolean(row.phone && String(row.phone).trim());
    const hasWhatsapp = Boolean(row.whatsapp && String(row.whatsapp).trim());

    if (!hasPhone) {
      flags.push('missing_phone');
      counts.missing_phone++;
    } else if (!isValidListingPhone(row.phone)) {
      flags.push('invalid_phone');
      counts.invalid_phone++;
    } else if (hasWhatsapp && !isValidListingPhone(row.whatsapp)) {
      flags.push('invalid_phone');
      counts.invalid_phone++;
    }

    if (!row.is_verified) {
      flags.push('unverified');
      counts.unverified++;
    }

    if (!row.image_url || !String(row.image_url).trim()) {
      flags.push('no_photo');
      counts.no_photo++;
    }

    if (row.image_broken_at) {
      flags.push('broken_photo');
      counts.broken_photo++;
    }

    const hasGps = row.latitude != null && row.longitude != null;
    if (!hasGps) {
      flags.push('no_gps');
      counts.no_gps++;
    }

    const hasMarathi =
      entityKind === 'school'
        ? Boolean(row.name_mr && String(row.name_mr).trim())
        : opts.translatedShopIds.has(row.id) || dqHasDevanagari(row.name || '');

    if (!hasMarathi) {
      flags.push('missing_marathi');
      counts.missing_marathi++;
    }

    if (flags.length > 0) {
      const cityKey = resolveEntityCityKey(row.city_id, opts.defaultCityId);
      const cityName =
        opts.cityNameMap?.get(cityKey) ||
        (cityKey === opts.defaultCityId ? 'Muktainagar' : 'Unassigned Town');

      items.push({
        entityKind,
        id: row.id,
        name: row.name || 'Unnamed',
        area: row.area ?? null,
        cityKey,
        cityName,
        phone: row.phone ?? null,
        whatsapp: row.whatsapp ?? null,
        isVerified: Boolean(row.is_verified),
        isActive: row.is_active !== false,
        imageUrl: row.image_url ?? null,
        hasGps,
        flags,
        raw: row,
      });
    }
  };

  opts.shops.forEach((s) => inspectRow(s, 'shop'));
  (opts.schools ?? []).forEach((sc) => inspectRow(sc, 'school'));

  items.sort((a, b) => b.flags.length - a.flags.length || a.name.localeCompare(b.name));

  return { items, totalScanned, counts };
}
