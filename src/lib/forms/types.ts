/**
 * Form framework — foundation types.
 *
 * Recommendation #6 from `docs/FORGE_RECOMMENDATIONS.md` (Phase 3).
 * Goal: RequestListingModal / ShopModal / BannerModal / CategoryModal are
 * *instances of one schema-driven form*, not four bespoke `useState`
 * spaghettis. This file declares the shared descriptor; `<EntityForm/>`
 * in `src/lib/forms/EntityForm.tsx` consumes it.
 *
 * Sentinel note: `RequestListingModal` is Business Critical — the
 * `open-list-shop-modal` custom-event contract and the `listShopDraft`
 * localStorage key must survive any migration. Migration is deferred
 * to a later pass; this file only lands the framework.
 */
import type { ReactNode } from 'react';
import type { ZodTypeAny } from 'zod';

export type FieldKind =
  | 'text'
  | 'textarea'
  | 'email'
  | 'tel'
  | 'url'
  | 'number'
  | 'select'
  | 'checkbox'
  | 'time'
  | 'date'
  | 'custom';

export interface FieldOption {
  value: string;
  label: string;
}

/** Descriptor for a single form field. `custom` fields hand the row
 *  and change handler to a caller-supplied render prop — the escape
 *  hatch for image pickers, location pickers, amenity lists, etc. */
export interface FieldDef<T> {
  /** Object key on the form state (e.g. `"name"`, `"opening_time"`). */
  name: keyof T & string;
  /** Human label rendered above the input. */
  label: ReactNode;
  /** Widget kind. Defaults to `"text"`. */
  kind?: FieldKind;
  /** Placeholder / autofill hint. */
  placeholder?: string;
  /** HTML autoComplete attribute passthrough. */
  autoComplete?: string;
  /** Required marker (adds `*` and `required` on the input). */
  required?: boolean;
  /** Optional maxLength for text-ish fields. */
  maxLength?: number;
  /** Only used when `kind === 'select'`. */
  options?: FieldOption[];
  /** Only used when `kind === 'custom'`. Return the widget. */
  render?: (ctx: FieldRenderCtx<T>) => ReactNode;
  /** Helper text shown below the input in muted colour. */
  help?: ReactNode;
  /** Grid span at md+ breakpoint. Defaults to `12` (full width). */
  colSpan?: 6 | 12;
  /** Hide the field entirely when this returns false. */
  visible?: (values: T) => boolean;
}

export interface FieldRenderCtx<T> {
  values: T;
  setField: <K extends keyof T>(key: K, value: T[K]) => void;
  error?: string;
  disabled: boolean;
}

/** A form descriptor. Each modal eventually exports one of these. */
export interface FormDef<T> {
  /** Stable identifier — used for a11y ids and draft-storage keys. */
  key: string;
  /** Title shown in the modal header when creating (isEdit === false). */
  createTitle: string;
  /** Title shown when editing an existing row. */
  editTitle: string;
  /** Ordered field list. Grouping is by array-position; no sections yet. */
  fields: FieldDef<T>[];
  /** Runtime + submit validation. Optional. */
  schema?: ZodTypeAny;
  /** Produce the empty state used by "Create" flows. */
  defaults: () => T;
  /** Submit handler. Framework only awaits — success/error toasts are
   *  the caller's responsibility (business-side effects vary). */
  onSubmit: (values: T, mode: 'create' | 'edit') => Promise<void>;
}
