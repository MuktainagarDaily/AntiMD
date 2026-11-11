/**
 * Slug-based naming & storage helpers for the `shop-images` storage bucket.
 *
 * Goal: make every uploaded image's filename derive from the listing's name,
 * support recursive folder-aware audits (`root`, `banners/`, `menus/`,
 * `claims/`), handle Devanagari names cleanly without collapsing to `shop`,
 * and avoid silent cross-shop image reuse on 409 collisions.
 */
import { supabase } from '@/integrations/supabase/client';
import { extractStoragePath } from '@/components/admin/adminHelpers';

export const SHOP_IMAGE_BUCKET = 'shop-images';
const BUCKET = SHOP_IMAGE_BUCKET;
const MAX_SLUG_LEN = 60;

/* ── Bucket call-site consolidation ────────────────────────────────────────── */

/** Delete one or more paths from the shop-images bucket. Never throws. */
export async function removeShopImages(paths: string[]): Promise<{ error: string | null }> {
  const clean = Array.from(new Set(paths.map((p) => p?.trim()).filter((p): p is string => !!p)));
  if (!clean.length) return { error: null };
  // Supabase storage `.remove` handles batches cleanly; chunk by 100 for safety.
  for (let i = 0; i < clean.length; i += 100) {
    const { error } = await supabase.storage.from(BUCKET).remove(clean.slice(i, i + 100));
    if (error) return { error: error.message ?? 'Delete failed' };
  }
  return { error: null };
}

/** Delete a single image path, silently swallowing storage errors. */
export async function removeShopImageQuiet(path: string | null | undefined): Promise<void> {
  if (!path) return;
  try {
    await supabase.storage.from(BUCKET).remove([path]);
  } catch {
    /* ignore */
  }
}

/** Resolve a storage path to its public URL. */
export function getShopImagePublicUrl(path: string): string {
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Rename/move a file within the bucket. Returns the storage error if any. */
export async function moveShopImage(from: string, to: string): Promise<{ error: string | null }> {
  const { error } = await supabase.storage.from(BUCKET).move(from, to);
  return { error: error?.message ?? null };
}

/** List a page of files/folders in a specific folder prefix (defaults to root ''). */
export async function listShopImages(opts: {
  limit: number;
  offset: number;
  search?: string;
  prefix?: string;
}) {
  const { prefix = '', ...rest } = opts;
  return supabase.storage.from(BUCKET).list(prefix, rest);
}

export interface StorageObjectEntry {
  path: string;
  name: string;
  folder: string;
  size: number;
  created_at: string;
  updated_at: string;
  id: string | null;
}

/**
 * Recursively walk `shop-images` across root and subfolders (`banners/`,
 * `menus/`, `claims/<user_id>/`, etc.) using 1,000-row pagination.
 */
export async function listAllShopImageObjects(opts?: {
  extraPrefixes?: string[];
}): Promise<{ files: StorageObjectEntry[]; truncatedFolders: string[]; error: string | null }> {
  const PAGE = 1000;
  const queue: string[] = Array.from(
    new Set(['', 'banners', 'menus', 'claims', ...(opts?.extraPrefixes ?? [])])
  );
  const visitedPrefixes = new Set<string>();
  const fileMap = new Map<string, StorageObjectEntry>();
  const truncatedFolders: string[] = [];

  try {
    while (queue.length > 0) {
      const prefix = queue.shift()!;
      if (visitedPrefixes.has(prefix)) continue;
      visitedPrefixes.add(prefix);

      let offset = 0;
      let loops = 0;
      while (loops < 50) {
        loops++;
        const { data, error } = await supabase.storage
          .from(BUCKET)
          .list(prefix, { limit: PAGE, offset });
        if (error) {
          // If an unpopulated prefix isn't readable or doesn't exist, skip only for non-root probes.
          if (prefix === '') {
            return { files: [], truncatedFolders, error: error.message };
          }
          break;
        }
        const rows = (data ?? []) as any[];
        for (const item of rows) {
          if (!item?.name || item.name === '.emptyFolderPlaceholder') continue;
          const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
          // Supabase Storage sets `id === null` (and no metadata) for virtual subfolders.
          if (!item.id && !item.metadata) {
            if (!visitedPrefixes.has(fullPath)) queue.push(fullPath);
            continue;
          }
          fileMap.set(fullPath, {
            path: fullPath,
            name: item.name,
            folder: prefix || '(root)',
            size: item.metadata?.size ?? 0,
            created_at: item.created_at ?? '',
            updated_at: item.updated_at ?? '',
            id: item.id ?? null,
          });
        }
        if (rows.length < PAGE) break;
        offset += PAGE;
        if (loops === 50) truncatedFolders.push(prefix || '(root)');
      }
    }
    const files = Array.from(fileMap.values()).sort((a, b) => a.path.localeCompare(b.path));
    return { files, truncatedFolders, error: null };
  } catch (err: any) {
    return { files: Array.from(fileMap.values()), truncatedFolders, error: err?.message ?? 'Storage list failed' };
  }
}

/** Create a short-lived signed URL for a private path (e.g. claim proofs). */
export async function createShopImageSignedUrl(path: string, expiresInSec: number) {
  return supabase.storage.from(BUCKET).createSignedUrl(path, expiresInSec);
}

/**
 * Extract all normalized `shop-images` storage paths referenced by an entity
 * row (`image_url`, `photos[]`, `photo_url`, `proof_image_path`).
 */
export function extractEntityStoragePaths(record: {
  image_url?: string | null;
  photos?: (string | null)[] | null;
  photo_url?: string | null;
  proof_image_path?: string | null;
}): string[] {
  const paths = new Set<string>();
  const addUrl = (u?: string | null) => {
    if (!u) return;
    const p = extractStoragePath(u);
    if (p) paths.add(p);
  };
  addUrl(record.image_url);
  addUrl(record.photo_url);
  if (Array.isArray(record.photos)) {
    for (const u of record.photos) addUrl(u);
  }
  if (record.proof_image_path && typeof record.proof_image_path === 'string') {
    const clean = record.proof_image_path.replace(/^\/+/, '');
    if (clean && !/^https?:\/\//i.test(clean)) {
      paths.add(clean);
    } else {
      addUrl(record.proof_image_path);
    }
  }
  return Array.from(paths);
}

/**
 * Return unique storage paths present in `previousUrls` that are no longer
 * present in `nextUrls` (used when removing/replacing modal photos cleanly).
 */
export function diffRemovedStoragePaths(
  previousUrls: (string | null | undefined)[],
  nextUrls: (string | null | undefined)[],
): string[] {
  const nextSet = new Set(
    nextUrls
      .map((u) => extractStoragePath(u))
      .filter((p): p is string => !!p),
  );
  const removed = new Set<string>();
  for (const u of previousUrls) {
    const p = extractStoragePath(u);
    if (p && !nextSet.has(p)) removed.add(p);
  }
  return Array.from(removed);
}

function isDuplicateUploadError(error: any): boolean {
  if (!error) return false;
  const msg = (error.message || '').toLowerCase();
  return (
    msg.includes('already exists') ||
    msg.includes('duplicate') ||
    error.statusCode === 409 ||
    error.statusCode === '409' ||
    error.status === 409
  );
}

/**
 * Upload a blob to a caller-supplied path (no slug computation).
 * Used by flows that need a deterministic path — e.g. `claims/<user>/<uuid>.webp`
 * where storage RLS enforces the prefix.
 */
export async function uploadShopImageAtPath(
  path: string,
  blob: Blob,
  opts: { contentType?: string; upsert?: boolean } = {},
): Promise<{ error: string | null; publicUrl?: string; isExisting?: boolean }> {
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: opts.contentType ?? 'image/webp',
    upsert: opts.upsert ?? false,
  });
  if (error) {
    if (isDuplicateUploadError(error)) {
      const publicUrl = getShopImagePublicUrl(path);
      return { error: null, publicUrl, isExisting: true };
    }
    return { error: error?.message ?? null };
  }
  const publicUrl = getShopImagePublicUrl(path);
  return { error: null, publicUrl, isExisting: false };
}

/* ── Devanagari-aware slugification ──────────────────────────────────────── */

const DEV_MAP: Record<string, string> = {
  // Vowels & matras
  'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'ee', 'उ': 'u', 'ऊ': 'oo',
  'ऋ': 'ri', 'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au',
  'ा': 'a', 'ि': 'i', 'ी': 'ee', 'ु': 'u', 'ू': 'oo',
  'ृ': 'ri', 'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au',
  'ं': 'n', 'ः': 'h', 'ँ': 'n', 'ॅ': 'e', 'ॉ': 'o', '्': '',
  // Consonants
  'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'n',
  'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'n',
  'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n',
  'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
  'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm',
  'य': 'y', 'र': 'r', 'ल': 'l', 'ळ': 'l', 'व': 'v',
  'श': 'sh', 'ष': 'sh', 'स': 's', 'ह': 'h',
  // Devanagari digits
  '०': '0', '१': '1', '२': '2', '३': '3', '४': '4',
  '५': '5', '६': '6', '७': '7', '८': '8', '९': '9',
};

function transliterateDevanagari(input: string): string {
  let out = '';
  for (const ch of input) {
    out += DEV_MAP[ch] ?? ch;
  }
  return out;
}

function shortStableHash(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36).slice(0, 5);
}

/**
 * Convert a shop/entity name into a safe storage slug.
 * Uses ASCII characters directly when present, and transliterates Devanagari
 * names so Marathi-only shops don't all collapse onto `shop.webp`.
 */
export function slugifyShopName(name: string | null | undefined): string {
  if (!name || !name.trim()) return 'shop';
  const normalized = name.trim().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');

  const cleanAscii = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/[\s-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, MAX_SLUG_LEN)
      .replace(/-+$/g, '');

  const latinFirst = cleanAscii(normalized.replace(/[\u0900-\u097F]+/g, ' '));
  if (latinFirst) return latinFirst;

  const transliterated = cleanAscii(transliterateDevanagari(normalized));
  if (transliterated) return transliterated;

  return `shop-${shortStableHash(name.trim())}`;
}

/**
 * List existing files in the bucket with the given slug prefix and pick the
 * first available `slug.webp` / `slug-1.webp` / `slug-2.webp` etc.
 */
const LIST_PAGE_SIZE = 1000;
const MAX_COLLISION_PROBE = 100000;

export async function findAvailableImagePath(baseSlug: string): Promise<string> {
  const safe = baseSlug || 'shop';
  const taken = new Set<string>();
  let offset = 0;
  try {
    while (true) {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .list('', { limit: LIST_PAGE_SIZE, offset, search: safe });
      if (error) throw error;
      const page = data || [];
      for (const f of page) if (f?.name) taken.add(f.name);
      if (page.length < LIST_PAGE_SIZE) break;
      offset += LIST_PAGE_SIZE;
    }
  } catch {
    return `${safe}-${Date.now()}.webp`;
  }
  if (!taken.has(`${safe}.webp`)) return `${safe}.webp`;
  for (let i = 1; i < MAX_COLLISION_PROBE; i++) {
    const candidate = `${safe}-${i}.webp`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${safe}-${Date.now()}.webp`;
}

interface UploadOpts {
  /** Optional prefix prepended to the slug, e.g. 'request' for pre-approval uploads. */
  prefix?: string;
}

export interface UploadShopImageResult {
  path: string;
  publicUrl: string;
  isExisting: boolean;
}

/**
 * Upload a (compressed) image blob using a slug-based filename.
 * If an unexpected 409 occurs (e.g. RLS prevented listing existing files),
 * retries with a unique suffix rather than silently attaching a sibling shop's photo.
 */
export async function uploadShopImage(
  blob: Blob,
  shopName: string,
  opts: UploadOpts = {}
): Promise<UploadShopImageResult> {
  const slug = slugifyShopName(shopName);
  const baseSlug = opts.prefix ? `${opts.prefix}-${slug}` : slug;
  let path = await findAvailableImagePath(baseSlug);
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: 'image/webp', upsert: false });

  if (error) {
    if (isDuplicateUploadError(error)) {
      const uniqueSuffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
      const retryPath = `${baseSlug}-${uniqueSuffix}.webp`;
      const retry = await supabase.storage
        .from(BUCKET)
        .upload(retryPath, blob, { contentType: 'image/webp', upsert: false });
      if (!retry.error) {
        const { data } = supabase.storage.from(BUCKET).getPublicUrl(retryPath);
        return { path: retryPath, publicUrl: data.publicUrl, isExisting: false };
      }
      if (isDuplicateUploadError(retry.error)) {
        const publicUrl = getShopImagePublicUrl(retryPath);
        return { path: retryPath, publicUrl, isExisting: true };
      }
      throw retry.error;
    }
    throw error;
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { path, publicUrl: data.publicUrl, isExisting: false };
}

/**
 * Rename an existing image to follow a new shop name.
 * Returns the new path + public URL, or the original info if no rename was needed.
 */
export async function renameShopImage(
  currentImageUrl: string,
  newShopName: string
): Promise<{ path: string; publicUrl: string; isExisting?: boolean } | null> {
  const oldPath = extractStoragePath(currentImageUrl);
  if (!oldPath) return null;
  const desiredSlug = slugifyShopName(newShopName);
  const filename = oldPath.split('/').pop() || oldPath;
  if (
    filename === `${desiredSlug}.webp` ||
    new RegExp(`^${desiredSlug}-\\d+\\.webp$`).test(filename)
  ) {
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(oldPath);
    return { path: oldPath, publicUrl: data.publicUrl, isExisting: false };
  }
  const newPath = await findAvailableImagePath(desiredSlug);
  const { error } = await supabase.storage.from(BUCKET).move(oldPath, newPath);
  if (error) {
    if (isDuplicateUploadError(error)) {
      const publicUrl = getShopImagePublicUrl(newPath);
      return { path: newPath, publicUrl, isExisting: true };
    }
    throw error;
  }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(newPath);
  return { path: newPath, publicUrl: data.publicUrl, isExisting: false };
}
