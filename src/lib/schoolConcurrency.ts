/**
 * Concurrency & Column-Ownership Guards for Institute (`schools`) Owner Edits.
 *
 * Mirrors `src/lib/shopConcurrency.ts`:
 *   1. ADMIN-ONLY FIELDS (never mutable by institute owners):
 *        is_active, is_verified, is_claimed, slug, city_id, district_id, state_id
 *      Both the DB BEFORE UPDATE trigger (`protect_school_admin_columns`) and
 *      `pickOwnerEditableSchool()` reject/strip these keys.
 *
 *   2. OWNER-EDITABLE FIELDS (optimistic concurrency guarded by `updated_at`):
 *        campus metadata, bilingual names/addresses, photos, GPS coords,
 *        admissions status/deadline/URLs, fee structure, scholarships,
 *        required documents, bus/transport villages, seats, facilities.
 */

import { updateWithConcurrency } from './concurrency';
import {
  isMissingSchoolColumnErr,
  pickLegacySchoolColumns,
  type SchoolRow,
} from '@/lib/repos/schoolsRepo';

export const OWNER_EDITABLE_SCHOOL_FIELDS = [
  'name',
  'name_mr',
  'medium',
  'mediums',
  'area',
  'sub_area',
  'address',
  'address_mr',
  'phone',
  'whatsapp',
  'email',
  'website',
  'description',
  'image_url',
  'photos',
  'latitude',
  'longitude',
  'village_id',
  'management_type',
  'gender_type',
  'udise_aishe_code',
  'established_year',
  'accreditation',
  'board',
  'classes_offered',
  'streams',
  'facilities',
  'principal_name',
  'office_timing',
  'admission_status',
  'admission_deadline',
  'admission_url',
  'prospectus_url',
  'fee_tier',
  'annual_fee_min',
  'annual_fee_max',
  'scholarships',
  'required_documents',
  'transport_villages',
  'coaching_focus',
  'total_seats',
  'available_seats',
] as const;

export type OwnerEditableSchoolField = (typeof OWNER_EDITABLE_SCHOOL_FIELDS)[number];

export type SchoolUpdateResult =
  | { ok: true; row: SchoolRow }
  | { ok: false; conflict: true; latest: SchoolRow }
  | { ok: false; conflict: false; error: string };

/** Strip any admin-only or unwhitelisted keys before dispatching an owner update. */
export function pickOwnerEditableSchool<T extends Record<string, any>>(patch: T): Partial<T> {
  const out: Partial<T> = {};
  for (const k of OWNER_EDITABLE_SCHOOL_FIELDS) {
    if (k in patch) {
      (out as any)[k] = patch[k];
    }
  }
  return out;
}

/**
 * Update a `schools` row as an authenticated institute owner using optimistic
 * concurrency control (`WHERE id = $1 AND updated_at = $2`).
 */
export async function updateSchoolAsOwner(
  schoolId: string,
  baselineAt: string | null | undefined,
  patch: Record<string, any>,
): Promise<SchoolUpdateResult> {
  const sanitized = pickOwnerEditableSchool(patch);
  const res = (await updateWithConcurrency<SchoolRow>(
    'schools',
    schoolId,
    baselineAt,
    sanitized,
  )) as SchoolUpdateResult;

  if (res.ok === false && 'conflict' in res && res.conflict === false && isMissingSchoolColumnErr(res.error)) {
    const legacyPatch = pickLegacySchoolColumns(sanitized);
    if (Object.keys(legacyPatch).length > 0) {
      return updateWithConcurrency<SchoolRow>(
        'schools',
        schoolId,
        baselineAt,
        legacyPatch,
      ) as Promise<SchoolUpdateResult>;
    }
  }
  return res;
}
