/**
 * Entity Framework — foundation types.
 *
 * Recommendation #1 from `docs/FORGE_REPORT.md` (Forge Run 2026-06-30).
 * Goal: Shops / Bus / Schools / Hospitals are *instances of one model*, not
 * five hand-rolled CRUD tabs. This file declares the shared descriptor;
 * `<EntityTab/>` in `src/components/admin/_shared/EntityTab.tsx` consumes it.
 *
 * Sentinel note: Business Critical entities (Shop, Request) intentionally
 * keep their bespoke tabs for now per the report's "migrate last" phasing.
 * Only `CategoryEntity` is wired up in this pass.
 */
import type { ReactNode } from 'react';

/** Column descriptor for a row of T. Render is required; the cell only sees
 *  the row, never the framework — keeps columns trivially testable. */
export interface EntityColumn<T> {
  key: string;
  header: string;
  /** Cell renderer. Return any ReactNode. */
  render: (row: T) => ReactNode;
  /** Hide on small screens (`hidden sm:table-cell`). Default: false. */
  hideOnMobile?: boolean;
  /** Tailwind alignment class. Default: `text-left`. */
  align?: 'left' | 'right';
  /** Optional extra td className. */
  className?: string;
}

/** A first-class entity descriptor. Each section (shops, categories, bus,
 *  schools, …) eventually exports one of these. It is the single source of
 *  truth for admin tab columns, default query, and human-readable labels.
 *
 *  Kept intentionally small in this first cut. Forms, CSV schema, and
 *  per-entity repos (FORGE recs #4, #6, #11) attach here in later phases. */
export interface EntityDef<T> {
  /** Stable identifier — used for queryKey prefix and a11y. */
  key: string;
  /** Singular human label, e.g. "Category". */
  labelSingular: string;
  /** Plural human label, e.g. "Categories". */
  labelPlural: string;
  /** Stable react-query key for the list query. */
  listQueryKey: readonly unknown[];
  /** Async loader for the list. The framework does not paginate yet —
   *  return the full list for now (admin volumes are small). */
  listFn: () => Promise<T[]>;
  /** Stable row identity. Defaults to `(row as any).id`. */
  getRowKey?: (row: T) => string;
  /** Default columns. A tab may override per-render if it needs to. */
  columns: EntityColumn<T>[];
}
