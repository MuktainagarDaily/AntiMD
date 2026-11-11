/**
 * Slug-based naming for files in the `shop-images` storage bucket.
 *
 * Goal: make every uploaded image's filename derive from the shop's name,
 * so the bucket is browseable and easy to match back to a shop.
 *
 * Format:  `{slug}.webp` or `{slug}-{n}.webp` when the base name is taken.
 * Requests use prefix `request-{slug}` until the admin approves them, then
 * the file is renamed to the final shop slug via `renameShopImage`.
 */
import { supabase } from '@/integrations/supabase/client';
import { extractStoragePath } from '@/components/admin/adminHelpers';

export const SHOP_IMAGE_BUCKET = 'shop-images';
const BUCKET = SHOP_IMAGE_BUCKET;
const MAX_SLUG_LEN = 60;

/* ── Bucket call-site consolidation (Forge #7, partial) ─────────────
 * Every `supabase.storage.from('shop-images').…` in the codebase should
 * eventually flow through these helpers so the storage prefix policy
 * stays enforced in one place. Wrapper-only — no behaviour change. */

/** Delete one or more paths from the shop-images bucket. Never throws. */
export async function removeShopImages(paths: string[]): Promise<{ error: string | null }> {
  if (!paths.length) return { error: null };
  const { error } = await supabase.storage.from(BUCKET).remove(paths);
  return { error: error?.message ?? null };
}

/** Delete a single image path, silently swallowing storage errors. */
export async function removeShopImageQuiet(path: string | null | undefined): Promise<void> {
  if (!path) return;
  try { await supabase.storage.from(BUCKET).remove([path]); } catch { /* ignore */ }
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

/** List a page of files in the bucket. Thin passthrough for admin tooling. */
export async function listShopImages(opts: { limit: number; offset: number; search?: string }) {
  return supabase.storage.from(BUCKET).list('', opts);
}

/** Create a short-lived signed URL for a private path (e.g. claim proofs). */
export async function createShopImageSignedUrl(path: string, expiresInSec: number) {
  return supabase.storage.from(BUCKET).createSignedUrl(path, expiresInSec);
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
    const msg = (error.message || '').toLowerCase();
    const isDuplicate =
      msg.includes('already exists') ||
      msg.includes('duplicate') ||
      (error as any).statusCode === 409 ||
      (error as any).statusCode === '409' ||
      (error as any).status === 409;
    if (isDuplicate) {
      const publicUrl = getShopImagePublicUrl(path);
      return { error: null, publicUrl, isExisting: true };
    }
    return { error: error?.message ?? null };
  }
  const publicUrl = getShopImagePublicUrl(path);
  return { error: null, publicUrl, isExisting: false };
}


/** Convert a shop name into a safe storage slug. */
export function slugifyShopName(name: string | null | undefined): string {
  if (!name) return 'shop';
  const slug = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')      // strip accents
    .replace(/[\u0900-\u097F]+/g, '')      // strip Devanagari
    .replace(/[^a-z0-9\s-]/g, '')          // keep alnum + space + hyphen
    .replace(/[\s-]+/g, '-')               // collapse to single hyphen
    .replace(/^-+|-+$/g, '')               // trim hyphens
    .slice(0, MAX_SLUG_LEN)
    .replace(/-+$/g, '');
  return slug || 'shop';
}

/**
 * List existing files in the bucket with the given slug prefix and pick the
 * first available `slug.webp` / `slug-1.webp` / `slug-2.webp` etc.
 *
 * Pages through results so we don't miss collisions when a slug prefix
 * matches more than a single page of files (Supabase `list` caps page
 * size, so a substring match on a busy bucket can otherwise be truncated).
 */
const LIST_PAGE_SIZE = 1000;
const MAX_COLLISION_PROBE = 100000;

export async function findAvailableImagePath(baseSlug: string): Promise<string> {
  const safe = baseSlug || 'shop';
  const taken = new Set<string>();
  let offset = 0;
  try {
    // Supabase storage `list` filters by `search` (substring on filename in the given folder).
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
    // If listing fails for any reason, fall back to a timestamp suffix to
    // guarantee uniqueness rather than risk overwriting a sibling file.
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
 * Does NOT upsert — collisions automatically resolve to the existing resource.
 */
export async function uploadShopImage(
  blob: Blob,
  shopName: string,
  opts: UploadOpts = {}
): Promise<UploadShopImageResult> {
  const slug = slugifyShopName(shopName);
  const baseSlug = opts.prefix ? `${opts.prefix}-${slug}` : slug;
  const path = await findAvailableImagePath(baseSlug);
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: 'image/webp', upsert: false });

  if (error) {
    const msg = (error.message || '').toLowerCase();
    const isDuplicate =
      msg.includes('already exists') ||
      msg.includes('duplicate') ||
      (error as any).statusCode === 409 ||
      (error as any).statusCode === '409' ||
      (error as any).status === 409;

    if (isDuplicate) {
      // Re-use existing resource directly instead of failing
      const publicUrl = getShopImagePublicUrl(path);
      return { path, publicUrl, isExisting: true };
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
  // If the current filename already starts with the desired slug, do nothing.
  // This covers `slug.webp` and `slug-1.webp` style names.
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
    const msg = (error.message || '').toLowerCase();
    const isDuplicate =
      msg.includes('already exists') ||
      msg.includes('duplicate') ||
      (error as any).statusCode === 409 ||
      (error as any).statusCode === '409' ||
      (error as any).status === 409;
    if (isDuplicate) {
      const publicUrl = getShopImagePublicUrl(newPath);
      return { path: newPath, publicUrl, isExisting: true };
    }
    throw error;
  }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(newPath);
  return { path: newPath, publicUrl: data.publicUrl, isExisting: false };
}
