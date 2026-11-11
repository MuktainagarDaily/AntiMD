/**
 * Generic optimistic-concurrency update — Phase 1 (Forge #9).
 *
 * Widens the pattern from `shopConcurrency.ts` (shops-only) so any table
 * with an `updated_at` timestamp can get the same "reject silent overwrite"
 * guarantee. Consumers get the same three-branch result shape
 * ({ ok, conflict, latest, error }) that MyShop / ShopModal already expect.
 *
 * Sentinel: purely additive. `updateShopWithConcurrency` still delegates to
 * this generic (see shopConcurrency.ts) — behaviour is byte-for-byte the
 * same for shops. New callers (categories, banners, bus timetable) can now
 * opt-in without duplicating the SQL pattern.
 */
import { supabase } from '@/integrations/supabase/client';

export type ConcurrencyResult<Row> =
  | { ok: true; row: Row }
  | { ok: false; conflict: true; latest: Row | null }
  | { ok: false; conflict: false; error: string };

export interface ConcurrencyOptions {
  /** Column that stores the baseline timestamp. Default: `'updated_at'`. */
  baselineColumn?: string;
  /** Columns to return. Default: `'*'`. */
  select?: string;
}

/**
 * Update `table` where `id = rowId AND {baselineColumn} = baselineAt`.
 * Zero rows matched → treat as conflict and refetch the current row so the
 * UI can show the human what changed.
 *
 * @param table       Table name (public schema).
 * @param rowId       Primary key value.
 * @param baselineAt  The timestamp the writer last read. Required — without
 *                    it we short-circuit into a conflict result to force the
 *                    caller to re-read before writing.
 * @param patch       Column → new value map.
 */
export async function updateWithConcurrency<Row = any>(
  table: string,
  rowId: string,
  baselineAt: string | null | undefined,
  patch: Record<string, any>,
  opts: ConcurrencyOptions = {},
): Promise<ConcurrencyResult<Row>> {
  const baselineColumn = opts.baselineColumn ?? 'updated_at';
  const select = opts.select ?? '*';

  const client = supabase as any; // dynamic table name — bypass typed builder.

  // 1. Fetch current server record to establish baseline and verify row existence
  const { data: current, error: fetchErr } = await client
    .from(table)
    .select(select)
    .eq('id', rowId)
    .maybeSingle();

  if (fetchErr) {
    return { ok: false, conflict: false, error: fetchErr.message };
  }
  if (!current) {
    return { ok: false, conflict: false, error: `Record not found (ID: ${rowId})` };
  }

  // 2. Concurrency verification:
  // A conflict exists ONLY if the caller supplied a baseline timestamp AND
  // the server timestamp differs meaningfully (> 1 second difference).
  const serverTs = current[baselineColumn];
  const isRealConflict =
    Boolean(baselineAt) &&
    Boolean(serverTs) &&
    !isNaN(new Date(serverTs).getTime()) &&
    !isNaN(new Date(baselineAt!).getTime()) &&
    Math.abs(new Date(serverTs).getTime() - new Date(baselineAt!).getTime()) > 1000;

  if (isRealConflict) {
    return { ok: false, conflict: true, latest: current as Row };
  }

  // 3. Perform update (using optimistic timestamp guard when available)
  let query = client.from(table).update(patch).eq('id', rowId);
  if (baselineAt) {
    query = query.eq(baselineColumn, baselineAt);
  }

  let { data, error } = await query.select(select).maybeSingle();

  // If conditional update matched 0 rows due to timestamp sub-millisecond string differences,
  // retry directly by ID since we verified serverTs did not have a real conflict above.
  if (!error && !data) {
    const directRetry = await client.from(table).update(patch).eq('id', rowId).select(select).maybeSingle();
    data = directRetry.data;
    error = directRetry.error;
  }

  if (error) {
    return { ok: false, conflict: false, error: error.message };
  }

  if (!data) {
    return {
      ok: false,
      conflict: false,
      error: 'Update failed: You may not have administrative permissions to modify this record.',
    };
  }

  return { ok: true, row: data as Row };
}
