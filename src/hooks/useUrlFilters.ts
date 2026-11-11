/**
 * useUrlFilters — Phase 1 (Forge #5).
 *
 * Typed helpers on top of react-router's `useSearchParams`. Every list/detail
 * page in the app hand-rolls `params.get(...)`, `params.getAll(...)`, and
 * mutable updates via `setSearchParams(new URLSearchParams(...))`. This hook
 * centralises those patterns so filter state stays URL-canonical and history
 * pushes are consistent.
 *
 * Sentinel: additive only. Existing pages continue to work with the raw
 * `useSearchParams` API — this is opt-in as pages are refactored.
 */
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

export type UrlFilterValue = string | number | boolean | null | undefined;
export type UrlFilterPatch = Record<string, UrlFilterValue | UrlFilterValue[]>;

interface Options {
  /** Push to history (default) or replace it. */
  replace?: boolean;
}

export function useUrlFilters(defaults: Options = {}) {
  const [params, setParams] = useSearchParams();

  /** Read a single value (first occurrence), or a fallback. */
  const get = useCallback(
    (key: string, fallback = ''): string => params.get(key) ?? fallback,
    [params],
  );

  /** Read all values for a repeated key (e.g. `?area=A&area=B`). */
  const getAll = useCallback(
    (key: string): string[] => params.getAll(key),
    [params],
  );

  /** Parse an integer param with a fallback. */
  const getInt = useCallback(
    (key: string, fallback = 0): number => {
      const raw = params.get(key);
      if (raw == null) return fallback;
      const n = parseInt(raw, 10);
      return Number.isFinite(n) ? n : fallback;
    },
    [params],
  );

  /** Parse a boolean flag: '1', 'true', 'yes' → true. */
  const getBool = useCallback(
    (key: string): boolean => {
      const raw = params.get(key);
      if (!raw) return false;
      return raw === '1' || raw === 'true' || raw === 'yes';
    },
    [params],
  );

  /**
   * Apply a batch patch. Null/undefined/empty-string removes the key.
   * Arrays are expanded into repeated `?key=v1&key=v2` entries.
   * Boolean `false` also removes; boolean `true` becomes `'1'`.
   */
  const setMany = useCallback(
    (patch: UrlFilterPatch, opts: Options = {}) => {
      const next = new URLSearchParams(params);
      for (const [key, raw] of Object.entries(patch)) {
        next.delete(key);
        const values = Array.isArray(raw) ? raw : [raw];
        for (const v of values) {
          if (v == null || v === '' || v === false) continue;
          next.append(key, v === true ? '1' : String(v));
        }
      }
      setParams(next, { replace: opts.replace ?? defaults.replace ?? false });
    },
    [params, setParams, defaults.replace],
  );

  /** Convenience: set one key. */
  const set = useCallback(
    (key: string, value: UrlFilterValue | UrlFilterValue[], opts: Options = {}) => {
      setMany({ [key]: value }, opts);
    },
    [setMany],
  );

  /** Remove one or more keys. */
  const remove = useCallback(
    (keys: string | string[], opts: Options = {}) => {
      const list = Array.isArray(keys) ? keys : [keys];
      setMany(Object.fromEntries(list.map((k) => [k, null])), opts);
    },
    [setMany],
  );

  /** Clear every param on the URL. */
  const clear = useCallback(
    (opts: Options = {}) => {
      setParams(new URLSearchParams(), { replace: opts.replace ?? defaults.replace ?? false });
    },
    [setParams, defaults.replace],
  );

  return useMemo(
    () => ({ params, get, getAll, getInt, getBool, set, setMany, remove, clear }),
    [params, get, getAll, getInt, getBool, set, setMany, remove, clear],
  );
}
