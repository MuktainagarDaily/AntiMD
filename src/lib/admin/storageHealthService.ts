/**
 * Storage & System Health diagnostic, audit, cleanup, and repair services.
 *
 * Covers:
 *  - Paginated PostgREST table fetching (>1,000-row safe)
 *  - Exhaustive 8-table media reference extraction (never leaks active files as orphans)
 *  - Recursive `shop-images` bucket audit + expired resolved claim proof PII purge
 *  - Unified `verifyImageUrl()` broken media probe + safe broken-link cleanup
 *  - Multi-photo aware image slug rename planner (syncing `image_url` + `photos[0]`)
 *  - Database, RLS/schema readiness, Edge Functions, MV drift, and PWA/localStorage diagnostics
 */
import type { QueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { extractStoragePath } from '@/components/admin/adminHelpers';
import { isMissingRelationErr } from '@/lib/entities/claimEntity';
import { verifyImageUrl } from '@/lib/imageVerify';
import {
  extractEntityStoragePaths,
  getShopImagePublicUrl,
  listAllShopImageObjects,
  moveShopImage,
  removeShopImages,
  slugifyShopName,
  type StorageObjectEntry,
} from '@/lib/storageNaming';

/* ── Error & Schema Helpers ────────────────────────────────────────────────── */

export function isMissingColumnErr(error: any): boolean {
  if (!error) return false;
  const code = String(error.code ?? '');
  const msg = String(error.message ?? '').toLowerCase();
  return (
    code === '42703' ||
    code === 'PGRST204' ||
    msg.includes('column') && msg.includes('does not exist') ||
    msg.includes('schema cache')
  );
}

export function isMissingRpcErr(error: any): boolean {
  if (!error) return false;
  const code = String(error.code ?? '');
  const msg = String(error.message ?? '').toLowerCase();
  return (
    code === '42883' ||
    code === 'PGRST202' ||
    msg.includes('could not find the function') ||
    msg.includes('does not exist')
  );
}

/* ── Paginated Fetch ──────────────────────────────────────────────────────── */

export interface FetchPaginatedOptions {
  orderBy?: string;
  ascending?: boolean;
  pageSize?: number;
  maxPages?: number;
  optional?: boolean;
}

/**
 * Fetch every row from a Supabase table cleanly past PostgREST's 1,000-row cap
 * using `.range(from, to)`. When `optional` is true and the table doesn't exist
 * yet (`42P01` / `PGRST205`), returns `[]` instead of throwing.
 */
export async function fetchAllPaginated<T = Record<string, any>>(
  table: string,
  select = '*',
  opts: FetchPaginatedOptions = {},
): Promise<T[]> {
  const pageSize = Math.max(1, Math.min(opts.pageSize ?? 1000, 1000));
  const maxPages = opts.maxPages ?? 100;
  const out: T[] = [];
  let from = 0;

  for (let page = 0; page < maxPages; page++) {
    let q = (supabase as any)
      .from(table)
      .select(select)
      .range(from, from + pageSize - 1);

    if (opts.orderBy) {
      q = q.order(opts.orderBy, { ascending: opts.ascending ?? true });
    }

    const { data, error } = await q;
    if (error) {
      if (opts.optional && isMissingRelationErr(error)) return [];
      throw error;
    }

    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }

  return out;
}

/* ── Referenced Media Index ──────────────────────────────────────────────── */

export interface ClaimMediaRow {
  id: string;
  source: 'shop_claims' | 'school_claims';
  status: string;
  proof_image_path: string;
  created_at: string;
  entity_id?: string | null;
}

export interface ReferencedMediaSummary {
  pathSet: Set<string>;
  counts: {
    shops: number;
    shop_requests: number;
    schools: number;
    banners: number;
    mess_daily_menus: number;
    shop_claims: number;
    school_claims: number;
    local_news: number;
  };
  claimRows: ClaimMediaRow[];
  unavailableTables: string[];
}

export interface ReferencedSourcesInput {
  shops?: Array<{ image_url?: string | null; photos?: (string | null)[] | null }>;
  shop_requests?: Array<{ image_url?: string | null; photos?: (string | null)[] | null }>;
  schools?: Array<{ image_url?: string | null; photos?: (string | null)[] | null }>;
  banners?: Array<{ image_url?: string | null }>;
  mess_daily_menus?: Array<{ photo_url?: string | null }>;
  shop_claims?: Array<{ proof_image_path?: string | null }>;
  school_claims?: Array<{ proof_image_path?: string | null }>;
  local_news?: Array<{ image_url?: string | null }>;
}

/**
 * Pure helper to build a deduplicated `Set<string>` of referenced `shop-images`
 * storage paths from already-loaded DB rows across all media-bearing tables.
 */
export function computeReferencedPathsFromRows(sources: ReferencedSourcesInput): Set<string> {
  const pathSet = new Set<string>();
  const ingest = (rows: any[] | undefined) => {
    if (!rows) return;
    for (const row of rows) {
      for (const p of extractEntityStoragePaths(row)) {
        pathSet.add(p);
      }
    }
  };

  ingest(sources.shops);
  ingest(sources.shop_requests);
  ingest(sources.schools);
  ingest(sources.banners);
  ingest(sources.mess_daily_menus);
  ingest(sources.shop_claims);
  ingest(sources.school_claims);
  ingest(sources.local_news);

  return pathSet;
}

/**
 * Queries every media-holding table in parallel (`shops`, `shop_requests`,
 * `schools`, `banners`, `mess_daily_menus`, `shop_claims`, `school_claims`,
 * `local_news`) so no active banner, menu, gallery slot, or claim proof is
 * misclassified as an orphan.
 */
export async function buildReferencedMediaSet(): Promise<ReferencedMediaSummary> {
  const unavailableTables: string[] = [];

  const loadOptional = async <T = any>(table: string, select: string): Promise<T[]> => {
    try {
      return await fetchAllPaginated<T>(table, select, { optional: false });
    } catch (err: any) {
      if (isMissingRelationErr(err) || isMissingColumnErr(err)) {
        unavailableTables.push(table);
        return [];
      }
      throw err;
    }
  };

  const [
    shops,
    shop_requests,
    schools,
    banners,
    mess_daily_menus,
    shop_claims,
    school_claims,
    local_news,
  ] = await Promise.all([
    fetchAllPaginated<{ id: string; image_url: string | null; photos?: string[] | null }>(
      'shops',
      'id, image_url, photos',
    ),
    loadOptional<{ id: string; image_url: string | null; photos?: string[] | null }>(
      'shop_requests',
      'id, image_url, photos',
    ),
    loadOptional<{ id: string; image_url: string | null; photos?: string[] | null }>(
      'schools',
      'id, image_url, photos',
    ),
    loadOptional<{ id: string; image_url: string | null }>('banners', 'id, image_url'),
    loadOptional<{ id: string; photo_url: string | null }>('mess_daily_menus', 'id, photo_url'),
    loadOptional<{
      id: string;
      shop_id: string | null;
      status: string;
      proof_image_path: string | null;
      created_at: string;
    }>('shop_claims', 'id, shop_id, status, proof_image_path, created_at'),
    loadOptional<{
      id: string;
      school_id: string | null;
      status: string;
      proof_image_path: string | null;
      created_at: string;
    }>('school_claims', 'id, school_id, status, proof_image_path, created_at'),
    loadOptional<{ id: string; image_url: string | null }>('local_news', 'id, image_url'),
  ]);

  const pathSet = computeReferencedPathsFromRows({
    shops,
    shop_requests,
    schools,
    banners,
    mess_daily_menus,
    shop_claims,
    school_claims,
    local_news,
  });

  const claimRows: ClaimMediaRow[] = [
    ...shop_claims
      .filter((c) => !!c.proof_image_path)
      .map((c) => ({
        id: c.id,
        source: 'shop_claims' as const,
        status: c.status,
        proof_image_path: c.proof_image_path!,
        created_at: c.created_at,
        entity_id: c.shop_id,
      })),
    ...school_claims
      .filter((c) => !!c.proof_image_path)
      .map((c) => ({
        id: c.id,
        source: 'school_claims' as const,
        status: c.status,
        proof_image_path: c.proof_image_path!,
        created_at: c.created_at,
        entity_id: c.school_id,
      })),
  ];

  return {
    pathSet,
    counts: {
      shops: shops.length,
      shop_requests: shop_requests.length,
      schools: schools.length,
      banners: banners.length,
      mess_daily_menus: mess_daily_menus.length,
      shop_claims: shop_claims.length,
      school_claims: school_claims.length,
      local_news: local_news.length,
    },
    claimRows,
    unavailableTables,
  };
}

/* ── Recursive Storage Audit & Claim Proof Retention ─────────────────────── */

export type StorageFolderGroup = 'root' | 'banners' | 'menus' | 'claims' | 'other';

export interface AuditOrphanObject extends StorageObjectEntry {
  folderGroup: StorageFolderGroup;
  publicUrl: string | null;
}

export interface ExpiredClaimProofItem extends ClaimMediaRow {
  ageDays: number;
  sizeBytes: number | null;
  existsInStorage: boolean;
}

export interface StorageAuditReport {
  scannedAt: string;
  totalObjects: number;
  totalBytes: number;
  referencedPathCount: number;
  folderCounts: Record<StorageFolderGroup, { total: number; orphans: number; bytes: number }>;
  orphans: AuditOrphanObject[];
  expiredClaimProofs: ExpiredClaimProofItem[];
  truncatedFolders: string[];
  unavailableTables: string[];
  storageError: string | null;
  rootOnlyFoldersWarning: boolean;
}

export function classifyFolderGroup(path: string): StorageFolderGroup {
  if (!path.includes('/')) return 'root';
  const top = path.split('/')[0].toLowerCase();
  if (top === 'banners') return 'banners';
  if (top === 'menus') return 'menus';
  if (top === 'claims') return 'claims';
  return 'other';
}

/**
 * Pure audit classification engine: classifies bucket objects against the
 * referenced DB path set and flags resolved claim proofs older than retention.
 */
export function classifyStorageAudit(
  objects: StorageObjectEntry[],
  referencedPaths: Set<string>,
  claimRows: ClaimMediaRow[],
  opts?: {
    retentionDays?: number;
    nowMs?: number;
    truncatedFolders?: string[];
    unavailableTables?: string[];
    storageError?: string | null;
  },
): StorageAuditReport {
  const retentionDays = opts?.retentionDays ?? 90;
  const nowMs = opts?.nowMs ?? Date.now();
  const objectByPath = new Map<string, StorageObjectEntry>();

  const folderCounts: Record<StorageFolderGroup, { total: number; orphans: number; bytes: number }> = {
    root: { total: 0, orphans: 0, bytes: 0 },
    banners: { total: 0, orphans: 0, bytes: 0 },
    menus: { total: 0, orphans: 0, bytes: 0 },
    claims: { total: 0, orphans: 0, bytes: 0 },
    other: { total: 0, orphans: 0, bytes: 0 },
  };

  let totalBytes = 0;
  const orphans: AuditOrphanObject[] = [];

  for (const obj of objects) {
    objectByPath.set(obj.path, obj);
    const group = classifyFolderGroup(obj.path);
    const sz = obj.size || 0;
    totalBytes += sz;
    folderCounts[group].total += 1;
    folderCounts[group].bytes += sz;

    if (!referencedPaths.has(obj.path)) {
      folderCounts[group].orphans += 1;
      orphans.push({
        ...obj,
        folderGroup: group,
        publicUrl: group === 'claims' ? null : getShopImagePublicUrl(obj.path),
      });
    }
  }

  const expiredClaimProofs: ExpiredClaimProofItem[] = [];
  for (const c of claimRows) {
    if (c.status !== 'approved' && c.status !== 'rejected') continue;
    const createdMs = c.created_at ? new Date(c.created_at).getTime() : NaN;
    if (!Number.isFinite(createdMs)) continue;
    const ageDays = Math.floor((nowMs - createdMs) / 86_400_000);
    if (ageDays < retentionDays) continue;
    const cleanPath = c.proof_image_path.replace(/^\/+/, '');
    const obj = objectByPath.get(cleanPath);
    expiredClaimProofs.push({
      ...c,
      ageDays,
      sizeBytes: obj?.size ?? null,
      existsInStorage: Boolean(obj),
    });
  }

  expiredClaimProofs.sort((a, b) => b.ageDays - a.ageDays);
  orphans.sort((a, b) => a.path.localeCompare(b.path));

  // Detect the classic RLS quirk where root returns 0 files while banners/ returns files
  const rootOnlyFoldersWarning =
    folderCounts.root.total === 0 && (folderCounts.banners.total > 0 || folderCounts.menus.total > 0);

  return {
    scannedAt: new Date(nowMs).toISOString(),
    totalObjects: objects.length,
    totalBytes,
    referencedPathCount: referencedPaths.size,
    folderCounts,
    orphans,
    expiredClaimProofs,
    truncatedFolders: opts?.truncatedFolders ?? [],
    unavailableTables: opts?.unavailableTables ?? [],
    storageError: opts?.storageError ?? null,
    rootOnlyFoldersWarning,
  };
}

export async function runRecursiveStorageAudit(opts?: {
  claimRetentionDays?: number;
}): Promise<StorageAuditReport> {
  const [bucketRes, refSummary] = await Promise.all([
    listAllShopImageObjects(),
    buildReferencedMediaSet(),
  ]);

  return classifyStorageAudit(bucketRes.files, refSummary.pathSet, refSummary.claimRows, {
    retentionDays: opts?.claimRetentionDays ?? 90,
    truncatedFolders: bucketRes.truncatedFolders,
    unavailableTables: refSummary.unavailableTables,
    storageError: bucketRes.error,
  });
}

export async function purgeResolvedClaimProofs(
  items: Pick<ExpiredClaimProofItem, 'id' | 'source' | 'proof_image_path'>[],
): Promise<{ purged: number; failed: number; errors: string[] }> {
  const paths = items.map((i) => i.proof_image_path.replace(/^\/+/, '')).filter(Boolean);
  const errors: string[] = [];

  if (paths.length > 0) {
    const { error: rmErr } = await removeShopImages(paths);
    if (rmErr) errors.push(rmErr);
  }

  let purged = 0;
  let failed = 0;
  for (const item of items) {
    try {
      const { error } = await (supabase as any)
        .from(item.source)
        .update({ proof_image_path: null })
        .eq('id', item.id);
      if (error) {
        failed++;
        errors.push(`${item.source}:${item.id} — ${error.message}`);
      } else {
        purged++;
      }
    } catch (err: any) {
      failed++;
      errors.push(err?.message ?? 'Update failed');
    }
  }

  return { purged, failed, errors };
}

/* ── Unified Broken Media Probe ─────────────────────────────────────────── */

export type MediaEntityType = 'shop' | 'school' | 'banner' | 'mess_menu';

export interface BrokenMediaItem {
  key: string;
  entityType: MediaEntityType;
  entityId: string;
  entityName: string;
  cityId: string | null;
  field: 'image_url' | 'photos' | 'photo_url';
  photoIndex?: number;
  url: string;
  storagePath: string | null;
  fallbackReplacementUrl?: string | null;
}

export interface BrokenMediaScanResult {
  probedCount: number;
  uniqueUrlsChecked: number;
  brokenItems: BrokenMediaItem[];
  schemaColsMissing: boolean;
}

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let idx = 0;
  const runNext = async (): Promise<void> => {
    while (idx < items.length) {
      const current = items[idx++];
      await worker(current);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => runNext()));
}

export async function probeUnifiedBrokenMedia(opts?: {
  cityId?: string;
  defaultCityId?: string;
  includeGallery?: boolean;
  onProgress?: (done: number, total: number) => void;
}): Promise<BrokenMediaScanResult> {
  const cityFilter = opts?.cityId && opts.cityId !== 'all' ? opts.cityId : null;
  const includeGallery = opts?.includeGallery ?? true;

  const [shops, schools, banners, menus] = await Promise.all([
    fetchAllPaginated<any>('shops', 'id, name, city_id, image_url, photos', { optional: false }),
    fetchAllPaginated<any>('schools', 'id, name, city_id, image_url, photos', { optional: true }),
    fetchAllPaginated<any>('banners', 'id, title, target_city_id, target_level, image_url', {
      optional: true,
    }),
    fetchAllPaginated<any>('mess_daily_menus', 'id, shop_id, title, photo_url', { optional: true }),
  ]);

  const shopById = new Map<string, any>();
  shops.forEach((s) => shopById.set(s.id, s));

  const matchesCity = (rowCityId?: string | null) => {
    if (!cityFilter) return true;
    if (rowCityId === cityFilter) return true;
    if (opts?.defaultCityId && cityFilter === opts.defaultCityId && !rowCityId) return true;
    return false;
  };

  const candidates: BrokenMediaItem[] = [];

  for (const s of shops) {
    if (!matchesCity(s.city_id)) continue;
    const gallery: string[] = Array.isArray(s.photos) ? s.photos.filter(Boolean) : [];
    if (s.image_url) {
      candidates.push({
        key: `shop:${s.id}:cover`,
        entityType: 'shop',
        entityId: s.id,
        entityName: s.name || 'Unnamed shop',
        cityId: s.city_id ?? null,
        field: 'image_url',
        url: s.image_url,
        storagePath: extractStoragePath(s.image_url),
        fallbackReplacementUrl: gallery.find((g) => g && g !== s.image_url) ?? null,
      });
    }
    if (includeGallery && gallery.length > 0) {
      gallery.forEach((url, index) => {
        if (!url || url === s.image_url) return;
        candidates.push({
          key: `shop:${s.id}:photo:${index}`,
          entityType: 'shop',
          entityId: s.id,
          entityName: `${s.name || 'Shop'} (Gallery #${index + 1})`,
          cityId: s.city_id ?? null,
          field: 'photos',
          photoIndex: index,
          url,
          storagePath: extractStoragePath(url),
        });
      });
    }
  }

  for (const sc of schools) {
    if (!matchesCity(sc.city_id)) continue;
    const gallery: string[] = Array.isArray(sc.photos) ? sc.photos.filter(Boolean) : [];
    if (sc.image_url) {
      candidates.push({
        key: `school:${sc.id}:cover`,
        entityType: 'school',
        entityId: sc.id,
        entityName: sc.name || 'Unnamed institute',
        cityId: sc.city_id ?? null,
        field: 'image_url',
        url: sc.image_url,
        storagePath: extractStoragePath(sc.image_url),
        fallbackReplacementUrl: gallery.find((g) => g && g !== sc.image_url) ?? null,
      });
    }
    if (includeGallery && gallery.length > 0) {
      gallery.forEach((url, index) => {
        if (!url || url === sc.image_url) return;
        candidates.push({
          key: `school:${sc.id}:photo:${index}`,
          entityType: 'school',
          entityId: sc.id,
          entityName: `${sc.name || 'Institute'} (Gallery #${index + 1})`,
          cityId: sc.city_id ?? null,
          field: 'photos',
          photoIndex: index,
          url,
          storagePath: extractStoragePath(url),
        });
      });
    }
  }

  for (const b of banners) {
    if (cityFilter && b.target_city_id && b.target_city_id !== cityFilter) continue;
    if (!b.image_url) continue;
    candidates.push({
      key: `banner:${b.id}`,
      entityType: 'banner',
      entityId: b.id,
      entityName: b.title || 'Ad Banner',
      cityId: b.target_city_id ?? null,
      field: 'image_url',
      url: b.image_url,
      storagePath: extractStoragePath(b.image_url),
    });
  }

  for (const m of menus) {
    if (!m.photo_url) continue;
    const parentShop = m.shop_id ? shopById.get(m.shop_id) : null;
    if (cityFilter && parentShop && !matchesCity(parentShop.city_id)) continue;
    candidates.push({
      key: `menu:${m.id}`,
      entityType: 'mess_menu',
      entityId: m.id,
      entityName: parentShop?.name ? `${parentShop.name} — Menu` : m.title || 'Mess Menu Photo',
      cityId: parentShop?.city_id ?? null,
      field: 'photo_url',
      url: m.photo_url,
      storagePath: extractStoragePath(m.photo_url),
    });
  }

  const uniqueUrls = Array.from(new Set(candidates.map((c) => c.url)));
  const urlStatus = new Map<string, 'ok' | 'broken'>();
  let done = 0;

  await runWithConcurrency(uniqueUrls, 5, async (url) => {
    const res = await verifyImageUrl(url);
    urlStatus.set(url, res);
    done++;
    opts?.onProgress?.(done, uniqueUrls.length);
  });

  const brokenItems = candidates.filter((c) => urlStatus.get(c.url) === 'broken');

  // Best-effort persist image_checked_at / image_broken_at for cover URLs
  let schemaColsMissing = false;
  const nowIso = new Date().toISOString();
  const brokenShopIds = new Set(
    brokenItems.filter((i) => i.entityType === 'shop' && i.field === 'image_url').map((i) => i.entityId),
  );
  const healthyShopIds = candidates
    .filter((c) => c.entityType === 'shop' && c.field === 'image_url' && !brokenShopIds.has(c.entityId))
    .map((c) => c.entityId);

  try {
    if (brokenShopIds.size > 0) {
      const { error } = await supabase
        .from('shops')
        .update({ image_checked_at: nowIso, image_broken_at: nowIso } as any)
        .in('id', Array.from(brokenShopIds));
      if (error && isMissingColumnErr(error)) schemaColsMissing = true;
    }
    if (!schemaColsMissing && healthyShopIds.length > 0) {
      for (let i = 0; i < healthyShopIds.length; i += 200) {
        const { error } = await supabase
          .from('shops')
          .update({ image_checked_at: nowIso, image_broken_at: null } as any)
          .in('id', healthyShopIds.slice(i, i + 200));
        if (error && isMissingColumnErr(error)) {
          schemaColsMissing = true;
          break;
        }
      }
    }
  } catch {
    schemaColsMissing = true;
  }

  return {
    probedCount: candidates.length,
    uniqueUrlsChecked: uniqueUrls.length,
    brokenItems,
    schemaColsMissing,
  };
}

/**
 * Cleanly remove a broken media reference from the database (promoting the next
 * healthy photo if clearing a cover image while gallery slots exist), and best-
 * effort clean up the broken storage object.
 */
export async function clearBrokenMediaReference(item: BrokenMediaItem): Promise<void> {
  if (item.entityType === 'mess_menu') {
    const { error } = await (supabase as any)
      .from('mess_daily_menus')
      .update({ photo_url: null })
      .eq('id', item.entityId);
    if (error) throw error;
    if (item.storagePath) await removeShopImages([item.storagePath]);
    return;
  }

  if (item.entityType === 'banner') {
    const { error } = await supabase
      .from('banners')
      .update({ image_url: '' })
      .eq('id', item.entityId);
    if (error) throw error;
    if (item.storagePath) await removeShopImages([item.storagePath]);
    return;
  }

  const table = item.entityType === 'school' ? 'schools' : 'shops';
  const { data: row, error: fetchErr } = await (supabase as any)
    .from(table)
    .select('image_url, photos')
    .eq('id', item.entityId)
    .maybeSingle();
  if (fetchErr) throw fetchErr;

  const existingPhotos: string[] = Array.isArray(row?.photos) ? row.photos.filter(Boolean) : [];
  const nextPhotos = existingPhotos.filter((u) => u !== item.url);
  const nextCover =
    row?.image_url === item.url ? (nextPhotos[0] ?? null) : (row?.image_url ?? null);

  const patch: Record<string, any> = {
    image_url: nextCover,
    photos: nextPhotos.length > 0 ? nextPhotos : null,
  };

  const { error: updErr } = await (supabase as any).from(table).update(patch).eq('id', item.entityId);
  if (updErr) throw updErr;

  // Clear image_broken_at best-effort without failing if column is missing
  await (supabase as any)
    .from(table)
    .update({ image_broken_at: null })
    .eq('id', item.entityId)
    .then(() => {}, () => {});

  if (item.storagePath) await removeShopImages([item.storagePath]);
}

/* ── Safe Slug Image Rename Planner ─────────────────────────────────────── */

export interface RenamePlanRow {
  key: string;
  shopId: string;
  shopName: string;
  cityId: string | null;
  cityName: string;
  slotIndex: number; // 0 = cover, >0 = gallery
  currentPath: string;
  currentFilename: string;
  proposedFilename: string;
  existingPhotos: string[];
  status: 'ok' | 'unchanged' | 'skip';
  reason?: string;
}

export async function buildSafeRenamePlan(opts?: {
  cityId?: string;
  defaultCityId?: string;
  cityNameMap?: Map<string, string>;
  includeGallery?: boolean;
  verifyBeforeMove?: boolean;
}): Promise<RenamePlanRow[]> {
  let shops = await fetchAllPaginated<any>('shops', 'id, name, city_id, image_url, photos', {
    orderBy: 'created_at',
    ascending: false,
  });

  if (opts?.cityId && opts.cityId !== 'all') {
    shops = shops.filter((s) => {
      if (s.city_id === opts.cityId) return true;
      if (opts.defaultCityId && opts.cityId === opts.defaultCityId && !s.city_id) return true;
      return false;
    });
  }

  shops = shops.filter((s) => !!s.image_url || (Array.isArray(s.photos) && s.photos.length > 0));

  const bucketList = await listAllShopImageObjects();
  if (bucketList.error) throw new Error(bucketList.error);

  const existingRootPaths = new Set(
    bucketList.files.filter((f) => !f.path.includes('/')).map((f) => f.path),
  );
  const existingAllPaths = new Set(bucketList.files.map((f) => f.path));
  const reservedNames = new Set(existingRootPaths);

  const rows: RenamePlanRow[] = [];
  const includeGallery = opts?.includeGallery ?? false;

  for (const s of shops) {
    const gallery: string[] = Array.isArray(s.photos) ? s.photos.filter(Boolean) : [];
    const effectivePhotos =
      gallery.length > 0 ? gallery : s.image_url ? [s.image_url] : [];
    const slots = includeGallery ? effectivePhotos : effectivePhotos.slice(0, 1);
    const cityName =
      (s.city_id && opts?.cityNameMap?.get(s.city_id)) ||
      (!s.city_id && opts?.defaultCityId && opts?.cityNameMap?.get(opts.defaultCityId)) ||
      'Muktainagar';

    for (let slotIndex = 0; slotIndex < slots.length; slotIndex++) {
      const url = slots[slotIndex];
      const currentPath = extractStoragePath(url);
      if (!currentPath) {
        rows.push({
          key: `${s.id}:${slotIndex}`,
          shopId: s.id,
          shopName: slotIndex === 0 ? s.name : `${s.name} (#${slotIndex + 1})`,
          cityId: s.city_id ?? null,
          cityName,
          slotIndex,
          currentPath: url,
          currentFilename: '(external URL)',
          proposedFilename: '—',
          existingPhotos: effectivePhotos,
          status: 'skip',
          reason: 'Image is outside the shop-images bucket',
        });
        continue;
      }

      const currentFilename = currentPath.split('/').pop() || currentPath;
      const slug = slugifyShopName(s.name);
      const slugRe = new RegExp(`^${slug}(?:-\\d+)?\\.webp$`);

      // Skip if source file isn't visible/missing in storage (when root listing is working)
      const rootVisible = existingRootPaths.size > 0;
      if (rootVisible && !existingAllPaths.has(currentPath)) {
        const reachable = opts?.verifyBeforeMove ? (await verifyImageUrl(url)) === 'ok' : false;
        if (!reachable) {
          rows.push({
            key: `${s.id}:${slotIndex}`,
            shopId: s.id,
            shopName: slotIndex === 0 ? s.name : `${s.name} (#${slotIndex + 1})`,
            cityId: s.city_id ?? null,
            cityName,
            slotIndex,
            currentPath,
            currentFilename,
            proposedFilename: '—',
            existingPhotos: effectivePhotos,
            status: 'skip',
            reason: 'Source object missing or unreachable in storage',
          });
          continue;
        }
      }

      if (!currentPath.includes('/') && slugRe.test(currentFilename)) {
        rows.push({
          key: `${s.id}:${slotIndex}`,
          shopId: s.id,
          shopName: slotIndex === 0 ? s.name : `${s.name} (#${slotIndex + 1})`,
          cityId: s.city_id ?? null,
          cityName,
          slotIndex,
          currentPath,
          currentFilename,
          proposedFilename: currentFilename,
          existingPhotos: effectivePhotos,
          status: 'unchanged',
        });
        continue;
      }

      let proposed = slotIndex === 0 ? `${slug}.webp` : `${slug}-${slotIndex}.webp`;
      if (reservedNames.has(proposed)) {
        for (let i = Math.max(1, slotIndex); i < 2000; i++) {
          const candidate = `${slug}-${i}.webp`;
          if (!reservedNames.has(candidate)) {
            proposed = candidate;
            break;
          }
        }
      }
      reservedNames.add(proposed);

      rows.push({
        key: `${s.id}:${slotIndex}`,
        shopId: s.id,
        shopName: slotIndex === 0 ? s.name : `${s.name} (#${slotIndex + 1})`,
        cityId: s.city_id ?? null,
        cityName,
        slotIndex,
        currentPath,
        currentFilename,
        proposedFilename: proposed,
        existingPhotos: effectivePhotos,
        status: 'ok',
      });
    }
  }

  return rows;
}

export async function applyRenamePlanRow(row: RenamePlanRow): Promise<string> {
  const newPath = row.proposedFilename;
  const { error: moveErr } = await moveShopImage(row.currentPath, newPath);
  if (moveErr) throw new Error(moveErr);

  const publicUrl = getShopImagePublicUrl(newPath);
  const { data: freshShop, error: readErr } = await supabase
    .from('shops')
    .select('image_url, photos')
    .eq('id', row.shopId)
    .maybeSingle();

  if (readErr) {
    await moveShopImage(newPath, row.currentPath);
    throw readErr;
  }

  const currentPhotos: string[] = Array.isArray(freshShop?.photos)
    ? [...freshShop.photos]
    : [...row.existingPhotos];

  const oldUrl = getShopImagePublicUrl(row.currentPath);
  const idx = currentPhotos.findIndex((u) => u === oldUrl || extractStoragePath(u) === row.currentPath);
  if (idx !== -1) {
    currentPhotos[idx] = publicUrl;
  } else if (row.slotIndex === 0) {
    if (currentPhotos.length > 0) currentPhotos[0] = publicUrl;
    else currentPhotos.push(publicUrl);
  }

  const patch: Record<string, any> = {};
  if (row.slotIndex === 0 || freshShop?.image_url === oldUrl) {
    patch.image_url = publicUrl;
  }
  if (Array.isArray(freshShop?.photos) || currentPhotos.length > 0) {
    patch.photos = currentPhotos;
  }

  const { error: dbErr } = await supabase.from('shops').update(patch).eq('id', row.shopId);
  if (dbErr) {
    await moveShopImage(newPath, row.currentPath);
    throw dbErr;
  }
  return publicUrl;
}

/* ── System Diagnostics, Edge Functions & Cache Health ────────────────────── */

export interface EdgeFunctionCheck {
  name: string;
  label: string;
  status: 'online' | 'reachable' | 'not_deployed' | 'error';
  httpStatus: number | null;
  latencyMs: number | null;
  detail: string;
}

export interface LocalStorageBucketItem {
  category: 'auth' | 'translations' | 'news' | 'bus' | 'banners' | 'city' | 'other';
  label: string;
  keyCount: number;
  bytes: number;
  preservedOnClear: boolean;
}

export interface BrowserCacheInventory {
  serviceWorkers: { scope: string; state: string; scriptURL: string }[];
  cacheStorageNames: string[];
  localStorageTotalBytes: number;
  localStorageKeys: number;
  breakdown: LocalStorageBucketItem[];
}

export interface SystemDiagnosticsReport {
  checkedAt: string;
  dbLatencyMs: number | null;
  dbOk: boolean;
  dbError: string | null;
  rpcAvailable: boolean;
  schema: {
    shopsImageVerification: boolean;
    schoolsImageVerification: boolean;
    bannersImageVerification: boolean;
    storageRootListingFixed: boolean;
  };
  sqlPatchPending: boolean;
  storageBucketOk: boolean;
  storageRootSampleCount: number;
  storageSubfoldersFound: string[];
  storageError: string | null;
  materializedView: {
    exists: boolean;
    mvCountSum: number;
    liveCountSum: number;
    drift: number;
  };
  counts: Record<string, number>;
  edgeFunctions: EdgeFunctionCheck[];
  browserCache: BrowserCacheInventory;
}

function getSupabaseHttpConfig(): { url: string; anonKey: string } {
  const url =
    (import.meta as any).env?.VITE_SUPABASE_URL ||
    'https://fhlaqgzensagjangkpop.supabase.co';
  const anonKey =
    (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY ||
    (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ||
    '';
  return { url: url.replace(/\/$/, ''), anonKey };
}

export async function probeEdgeFunction(name: string, label: string): Promise<EdgeFunctionCheck> {
  const { url, anonKey } = getSupabaseHttpConfig();
  const endpoint = `${url}/functions/v1/${name}`;
  const t0 = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(endpoint, {
      method: 'OPTIONS',
      headers: anonKey ? { apikey: anonKey } : {},
      signal: controller.signal,
    });
    const latencyMs = Math.round(performance.now() - t0);

    if (res.ok || res.status === 204) {
      return {
        name,
        label,
        status: 'online',
        httpStatus: res.status,
        latencyMs,
        detail: `Preflight OK (${res.status}) · ${latencyMs} ms`,
      };
    }
    if (res.status === 404) {
      return {
        name,
        label,
        status: 'not_deployed',
        httpStatus: 404,
        latencyMs,
        detail: 'Not deployed on this Supabase project (HTTP 404)',
      };
    }
    if (res.status === 401 || res.status === 403 || res.status === 405) {
      return {
        name,
        label,
        status: 'reachable',
        httpStatus: res.status,
        latencyMs,
        detail: `Deployed (HTTP ${res.status}) · ${latencyMs} ms`,
      };
    }
    return {
      name,
      label,
      status: 'error',
      httpStatus: res.status,
      latencyMs,
      detail: `Unexpected HTTP ${res.status}`,
    };
  } catch (err: any) {
    return {
      name,
      label,
      status: 'error',
      httpStatus: null,
      latencyMs: null,
      detail: err?.name === 'AbortError' ? 'Timed out (5s)' : err?.message || 'Network unreachable',
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function getBrowserCacheInventory(): Promise<BrowserCacheInventory> {
  const serviceWorkers: BrowserCacheInventory['serviceWorkers'] = [];
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const r of regs) {
        const w = r.active || r.waiting || r.installing;
        serviceWorkers.push({
          scope: r.scope,
          state: w?.state || 'registered',
          scriptURL: w?.scriptURL || '/sw.js',
        });
      }
    } catch {
      /* ignore */
    }
  }

  let cacheStorageNames: string[] = [];
  if (typeof window !== 'undefined' && 'caches' in window) {
    try {
      cacheStorageNames = await caches.keys();
    } catch {
      /* ignore */
    }
  }

  const buckets: Record<LocalStorageBucketItem['category'], LocalStorageBucketItem> = {
    auth: {
      category: 'auth',
      label: 'Auth Tokens (sb-*)',
      keyCount: 0,
      bytes: 0,
      preservedOnClear: true,
    },
    translations: {
      category: 'translations',
      label: 'Marathi Translation Cache',
      keyCount: 0,
      bytes: 0,
      preservedOnClear: false,
    },
    news: {
      category: 'news',
      label: 'Local News & Sources Cache',
      keyCount: 0,
      bytes: 0,
      preservedOnClear: false,
    },
    bus: {
      category: 'bus',
      label: 'Bus Timetable Offline Cache',
      keyCount: 0,
      bytes: 0,
      preservedOnClear: false,
    },
    banners: {
      category: 'banners',
      label: 'Ad Flags & Banner Impression Keys',
      keyCount: 0,
      bytes: 0,
      preservedOnClear: false,
    },
    city: {
      category: 'city',
      label: 'Selected Town Preference',
      keyCount: 0,
      bytes: 0,
      preservedOnClear: true,
    },
    other: {
      category: 'other',
      label: 'Drafts & Other Keys',
      keyCount: 0,
      bytes: 0,
      preservedOnClear: false,
    },
  };

  let totalBytes = 0;
  let totalKeys = 0;
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      totalKeys++;
      const val = localStorage.getItem(k) || '';
      const bytes = (k.length + val.length) * 2;
      totalBytes += bytes;

      let cat: LocalStorageBucketItem['category'] = 'other';
      if (k.startsWith('sb-') || k === 'supabase.auth.token') cat = 'auth';
      else if (k.startsWith('md.tx.')) cat = 'translations';
      else if (k.startsWith('md.local_news.') || k.startsWith('md.news_sources.')) cat = 'news';
      else if (k.startsWith('md.bus.')) cat = 'bus';
      else if (k.startsWith('md_banner_') || k === 'md_ads_runtime') cat = 'banners';
      else if (k.startsWith('md.selected_')) cat = 'city';

      buckets[cat].keyCount += 1;
      buckets[cat].bytes += bytes;
    }
  }

  return {
    serviceWorkers,
    cacheStorageNames,
    localStorageTotalBytes: totalBytes,
    localStorageKeys: totalKeys,
    breakdown: Object.values(buckets).filter((b) => b.keyCount > 0),
  };
}

export async function clearAppHealthCache(opts?: {
  queryClient?: QueryClient;
}): Promise<{ clearedStorageKeys: number; clearedCacheBuckets: number }> {
  let clearedStorageKeys = 0;
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    const keysToDelete: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (
        k.startsWith('sb-') ||
        k === 'supabase.auth.token' ||
        k.startsWith('md.selected_')
      ) {
        continue;
      }
      keysToDelete.push(k);
    }
    keysToDelete.forEach((k) => {
      localStorage.removeItem(k);
      clearedStorageKeys++;
    });
  }

  if (typeof window !== 'undefined' && typeof sessionStorage !== 'undefined') {
    try {
      sessionStorage.clear();
    } catch {
      /* ignore */
    }
  }

  if (opts?.queryClient) {
    await opts.queryClient.cancelQueries();
    opts.queryClient.clear();
  }

  let clearedCacheBuckets = 0;
  if (typeof window !== 'undefined' && 'caches' in window) {
    try {
      const names = await caches.keys();
      const results = await Promise.allSettled(names.map((n) => caches.delete(n)));
      clearedCacheBuckets = results.filter((r) => r.status === 'fulfilled' && r.value).length;
    } catch {
      /* ignore */
    }
  }

  return { clearedStorageKeys, clearedCacheBuckets };
}

export async function refreshCategoryCountsMv(): Promise<void> {
  const { error } = await (supabase as any).rpc('refresh_category_shop_counts');
  if (error) throw error;
}

export async function runSystemDiagnostics(): Promise<SystemDiagnosticsReport> {
  const t0 = performance.now();
  let dbOk = false;
  let dbError: string | null = null;
  let dbLatencyMs: number | null = null;

  try {
    const { error } = await supabase.from('shops').select('id', { count: 'exact', head: true });
    dbLatencyMs = Math.round(performance.now() - t0);
    if (error) throw error;
    dbOk = true;
  } catch (err: any) {
    dbLatencyMs = Math.round(performance.now() - t0);
    dbError = err?.message || 'Database connection failed';
  }

  // Probe Storage root
  let storageBucketOk = false;
  let storageRootSampleCount = 0;
  let storageSubfoldersFound: string[] = [];
  let storageError: string | null = null;

  try {
    const { data, error } = await supabase.storage
      .from('shop-images')
      .list('', { limit: 100 });
    if (error) throw error;
    storageBucketOk = true;
    const rows = (data ?? []) as any[];
    storageRootSampleCount = rows.filter((r) => !!r.id || !!r.metadata).length;
    storageSubfoldersFound = rows
      .filter((r) => !r.id && !r.metadata && r.name)
      .map((r) => r.name);
  } catch (err: any) {
    storageError = err?.message || 'Storage probe failed';
  }

  // Probe server RPC get_system_health_snapshot(), falling back gracefully if missing
  let rpcAvailable = false;
  let schema = {
    shopsImageVerification: false,
    schoolsImageVerification: false,
    bannersImageVerification: false,
    storageRootListingFixed: storageRootSampleCount > 0,
  };
  let materializedView = {
    exists: false,
    mvCountSum: 0,
    liveCountSum: 0,
    drift: 0,
  };
  let counts: Record<string, number> = {};

  try {
    const { data, error } = await (supabase as any).rpc('get_system_health_snapshot');
    if (error) throw error;
    if (data && typeof data === 'object') {
      rpcAvailable = true;
      schema = {
        shopsImageVerification: Boolean(data.schema?.shops_image_verification),
        schoolsImageVerification: Boolean(data.schema?.schools_image_verification),
        bannersImageVerification: Boolean(data.schema?.banners_image_verification),
        storageRootListingFixed: Boolean(data.schema?.storage_root_listing_fixed),
      };
      materializedView = {
        exists: Boolean(data.materialized_view?.exists),
        mvCountSum: Number(data.materialized_view?.mv_count_sum ?? 0),
        liveCountSum: Number(data.materialized_view?.live_count_sum ?? 0),
        drift: Number(data.materialized_view?.drift ?? 0),
      };
      counts = (data.counts as Record<string, number>) ?? {};
    }
  } catch (err: any) {
    if (!isMissingRpcErr(err) && !String(err?.message || '').toLowerCase().includes('forbidden')) {
      dbError = dbError || err?.message || null;
    }

    // Fallback: directly probe image_broken_at column & counts
    const checkBrokenCol = async (table: string): Promise<boolean> => {
      try {
        const { error } = await (supabase as any).from(table).select('image_broken_at').limit(1);
        return !error;
      } catch {
        return false;
      }
    };

    const countTable = async (table: string, filterCol?: string, filterVal?: string): Promise<number> => {
      try {
        let q = (supabase as any).from(table).select('id', { count: 'exact', head: true });
        if (filterCol && filterVal) q = q.eq(filterCol, filterVal);
        const { count, error } = await q;
        return error ? 0 : (count ?? 0);
      } catch {
        return 0;
      }
    };

    const [
      shopsCol,
      schoolsCol,
      bannersCol,
      shopsCount,
      schoolsCount,
      bannersCount,
      menusCount,
      newsCount,
      pendingReqs,
      pendingClaims,
    ] = await Promise.all([
      checkBrokenCol('shops'),
      checkBrokenCol('schools'),
      checkBrokenCol('banners'),
      countTable('shops'),
      countTable('schools'),
      countTable('banners'),
      countTable('mess_daily_menus'),
      countTable('local_news'),
      countTable('shop_requests', 'status', 'pending'),
      countTable('shop_claims', 'status', 'pending'),
    ]);

    schema = {
      shopsImageVerification: shopsCol,
      schoolsImageVerification: schoolsCol,
      bannersImageVerification: bannersCol,
      storageRootListingFixed: storageRootSampleCount > 0,
    };
    counts = {
      shops: shopsCount,
      schools: schoolsCount,
      banners: bannersCount,
      mess_daily_menus: menusCount,
      local_news: newsCount,
      pending_requests: pendingReqs,
      pending_shop_claims: pendingClaims,
    };
  }

  const sqlPatchPending =
    !rpcAvailable ||
    !schema.shopsImageVerification ||
    !schema.schoolsImageVerification ||
    !schema.bannersImageVerification ||
    !schema.storageRootListingFixed;

  const [edgeFunctions, browserCache] = await Promise.all([
    Promise.all([
      probeEdgeFunction('scrape-local-news', 'Local News Scraper'),
      probeEdgeFunction('town-assistant', 'AI Town Assistant'),
      probeEdgeFunction('mcp', 'MCP Integrations Server'),
    ]),
    getBrowserCacheInventory(),
  ]);

  return {
    checkedAt: new Date().toISOString(),
    dbLatencyMs,
    dbOk,
    dbError,
    rpcAvailable,
    schema,
    sqlPatchPending,
    storageBucketOk,
    storageRootSampleCount,
    storageSubfoldersFound,
    storageError,
    materializedView,
    counts,
    edgeFunctions,
    browserCache,
  };
}
