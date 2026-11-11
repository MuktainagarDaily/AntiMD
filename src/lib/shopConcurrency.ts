/**
 * Concurrency / conflict handling for shop edits.
 *
 * Two writers can touch a `shops` row at any time:
 *   • An admin via AdminDashboard → ShopModal (moderation edits: is_active,
 *     is_verified, categories, plus all content fields).
 *   • The shop owner via /my-shop → ShopEditor (owner-editable content fields
 *     only — owners cannot flip moderation flags).
 *
 * PRECEDENCE RULES (single source of truth):
 *
 *   1. ADMIN-ONLY FIELDS (never touched by owners):
 *        is_active, is_verified, slug, category_id, shop_categories[]
 *      Owners cannot send these on the wire. The MyShop editor form has no
 *      inputs for them and `OWNER_EDITABLE_FIELDS` whitelists exactly what
 *      the owner save() may write.
 *
 *   2. OWNER-EDITABLE FIELDS (overlap between admin & owner):
 *        name, description, address, area, sub_area, phone, whatsapp,
 *        opening_time, closing_time, is_open, image_url, amenities,
 *        latitude, longitude, keywords
 *      Both sides may write these. Last-writer-wins is unsafe because a
 *      shop owner could blindly overwrite an admin's moderation cleanup
 *      (or vice versa). To prevent silent overwrites we use optimistic
 *      concurrency via the row's `updated_at` timestamp:
 *
 *        UPDATE ... WHERE id = $1 AND updated_at = $2  RETURNING *
 *
 *      If the row was modified after the writer last read it, the WHERE
 *      clause matches zero rows, the writer gets a CONFLICT result, and
 *      the UI is responsible for showing the latest server values and
 *      asking the human to re-confirm.
 *
 *   3. OPEN/CLOSED TOGGLE (`is_open`) is also concurrency-checked so the
 *      owner's quick toggle can't silently revert an admin closure.
 */

import { updateWithConcurrency } from './concurrency';

export const OWNER_EDITABLE_FIELDS = [
  'name',
  'description',
  'address',
  'area',
  'sub_area',
  'phone',
  'whatsapp',
  'opening_time',
  'closing_time',
  'is_open',
  'image_url',
  'amenities',
  'keywords',
  'latitude',
  'longitude',

] as const;

export type OwnerEditableField = (typeof OWNER_EDITABLE_FIELDS)[number];

export type ShopUpdateResult =
  | { ok: true; row: any }
  | { ok: false; conflict: true; latest: any }
  | { ok: false; conflict: false; error: string };

/**
 * Update a shop row with optimistic concurrency control.
 *
 * @param shopId        Row id to update.
 * @param baselineAt    The `updated_at` the writer last saw. Required.
 * @param patch         Column → new value map.
 */
export function updateShopWithConcurrency(
  shopId: string,
  baselineAt: string | null | undefined,
  patch: Record<string, any>,
): Promise<ShopUpdateResult> {
  // Delegates to the generic table-agnostic implementation (Forge #9).
  // Byte-for-byte the same behaviour as the previous inline version:
  // same baseline column ('updated_at'), same SELECT ('*'), same three-branch result.
  return updateWithConcurrency<any>('shops', shopId, baselineAt, patch) as Promise<ShopUpdateResult>;
}



/** Strip any keys the owner is not allowed to write (defence in depth). */
export function pickOwnerEditable<T extends Record<string, any>>(patch: T): Partial<T> {
  const out: Partial<T> = {};
  for (const k of OWNER_EDITABLE_FIELDS) {
    if (k in patch) (out as any)[k] = patch[k];
  }
  return out;
}
