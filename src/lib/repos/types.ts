/**
 * Shared repository types.
 *
 * `RepoResult<T>` mirrors the discriminated-union shape callers already use
 * for `updateWithConcurrency` (see `lib/concurrency.ts`). This lets a
 * repository method return `{ ok:false, error }` uniformly instead of
 * throwing, matching the toast-on-failure UI pattern used across the app.
 *
 * Non-mutating reads (`list`, `get`) keep the throw-on-error convention that
 * React Query and existing `.from().select()` call sites already assume.
 */

export type RepoResult<T> =
  | { ok: true; row: T }
  | { ok: false; error: string };

/**
 * Pick only whitelisted keys from a patch. Silently drops any others.
 * Used by `shopsRepo.updateOwner` to enforce `OWNER_EDITABLE_FIELDS`.
 */
export function pickFields<K extends string>(
  patch: Record<string, any>,
  allowed: readonly K[],
): Partial<Record<K, any>> {
  const out: Partial<Record<K, any>> = {};
  for (const k of allowed) {
    if (Object.prototype.hasOwnProperty.call(patch, k)) {
      out[k] = patch[k];
    }
  }
  return out;
}
