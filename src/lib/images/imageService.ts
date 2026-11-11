/**
 * Image Service — Forge recommendation #3 (Phase 2 Foundations).
 *
 * Single entry point for the "compress → upload → return public URL" pipeline
 * used by ShopModal, SpeedShopModal, RequestListingModal, MyShop, and
 * ClaimShopModal. Composes the existing primitives:
 *   - `compressImage` from `@/lib/imageUtils`      (WebP canvas compression)
 *   - `uploadShopImage` from `@/lib/storageNaming` (slug-based bucket helper)
 *
 * SENTINEL NOTE: this file is deliberately additive. Existing call sites keep
 * working; migrations to this service are done one file at a time so the
 * storage path conventions (`request-<slug>`, `claims/<user_id>/…`) that
 * `2026-06-28_claim_verification.sql` and the shop-images RLS policy load-bear
 * on remain byte-for-byte identical. Do NOT change path strategies here
 * without also updating the storage RLS patch.
 */
import { compressImage } from '@/lib/imageUtils';
import {
  uploadShopImage,
  removeShopImageQuiet,
  SHOP_IMAGE_BUCKET,
} from '@/lib/storageNaming';
import { supabase } from '@/integrations/supabase/client';

// MPULSE Phase 2 #1 — raised defaults so hero images stay sharp on retina
// while still landing well under 200 KB WebP. Any upload larger than
// MAX_UPLOAD_BYTES is rejected up front to keep the browser encode step
// (and mobile memory) sane.
export const DEFAULT_SHOP_MAX_WIDTH = 1600;
export const DEFAULT_SHOP_QUALITY = 0.80;
export const DEFAULT_CLAIM_MAX_WIDTH = 1600;
export const DEFAULT_CLAIM_QUALITY = 0.82;
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15 MB — hard cap before compression

function assertUnderCap(file: File | Blob) {
  const size = (file as File).size ?? (file as Blob).size ?? 0;
  if (size > MAX_UPLOAD_BYTES) {
    const mb = (size / (1024 * 1024)).toFixed(1);
    throw new Error(`Image too large (${mb} MB). Max ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB.`);
  }
}

export interface UploadShopImageOptions {
  /** Prefix passed to `uploadShopImage`; use `'request'` for pre-approval flows. */
  prefix?: string;
  /** Override the compression max width. Defaults to 800px (shop card display size). */
  maxWidth?: number;
  /** Override WebP quality. Defaults to 0.75. */
  quality?: number;
}

export interface UploadedImage {
  path: string;
  publicUrl: string;
}

/**
 * Compress a File/Blob to WebP and upload it to the shop-images bucket with a
 * slug-based filename derived from `shopName`. Returns the storage path + public URL.
 *
 * Used by: MyShop, ShopModal, SpeedShopModal, RequestListingModal.
 */
export async function compressAndUploadShopImage(
  file: File | Blob,
  shopName: string,
  opts: UploadShopImageOptions = {},
): Promise<UploadedImage> {
  assertUnderCap(file);
  const compressed = await compressImage(
    file as File,
    opts.maxWidth ?? DEFAULT_SHOP_MAX_WIDTH,
    opts.quality ?? DEFAULT_SHOP_QUALITY,
  );
  return uploadShopImage(compressed, shopName, { prefix: opts.prefix });
}

/**
 * Upload a claim-verification proof image to `claims/<user_id>/<uuid>.webp`.
 * The path prefix is enforced by the storage RLS policy created in
 * `docs/patches/2026-06-28_claim_verification.sql` — do not change it here.
 *
 * Used by: ClaimShopModal.
 */
export async function uploadClaimProofImage(
  file: File | Blob,
  userId: string,
): Promise<UploadedImage> {
  assertUnderCap(file);
  const blob = await compressImage(
    file as File,
    DEFAULT_CLAIM_MAX_WIDTH,
    DEFAULT_CLAIM_QUALITY,
  );
  const fileId = crypto.randomUUID();
  const path = `claims/${userId}/${fileId}.webp`;
  const { error } = await supabase.storage
    .from(SHOP_IMAGE_BUCKET)
    .upload(path, blob, { contentType: 'image/webp', upsert: false });
  if (error) throw error;
  // Proof documents are private PII and must only be accessed via signed URLs
  return { path, publicUrl: '' };
}

/** Re-export the quiet delete helper so callers can go through one module. */
export { removeShopImageQuiet };
