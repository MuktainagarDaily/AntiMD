/**
 * Shared admin-only helpers — extracted from AdminDashboard monolith (RISK-01 fix).
 * Public-facing utilities (normalizePhone, compressImage, parseGoogleMapsLink) remain
 * in their respective shared lib files.
 */
import { SHOP_IMAGE_BUCKET } from '@/lib/storageNaming';

/** Extract the storage file path from a Supabase public URL.
 *  Returns null if the URL is not a recognized shop-images bucket URL. */
export function extractStoragePath(publicUrl: string): string | null {
  try {
    const marker = `/object/public/${SHOP_IMAGE_BUCKET}/`;
    const idx = publicUrl.indexOf(marker);
    if (idx === -1) return null;
    return decodeURIComponent(publicUrl.slice(idx + marker.length).split('?')[0]);
  } catch {
    return null;
  }
}

/** Normalize a WhatsApp number for a wa.me link (digits-only, with 91 prefix) */
export function normalizeWhatsApp(wa: string): string {
  let n = wa.replace(/\D/g, '');
  if (n.length === 10) n = '91' + n;
  if (n.startsWith('91') && n.length === 12) return n;
  return n;
}

/** Check if a phone number has at least 10 digits */
export function isValidPhone(phone: string): boolean {
  return phone.replace(/\D/g, '').length >= 10;
}

// `inputCls` is exported from '@/lib/utils' so all admin + public request
// forms share the same input styling. Re-exported here for backwards
// compatibility with existing admin imports.
export { inputCls } from '@/lib/utils';
