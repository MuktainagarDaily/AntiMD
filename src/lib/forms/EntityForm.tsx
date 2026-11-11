/**
 * <EntityForm/> — schema-driven admin form shell. v1.
 *
 * Forge recommendation #6 (Phase 3 Platform). Renders a `FormDef<T>`
 * as a two-column responsive grid inside a modal-agnostic container.
 * The caller owns the surrounding dialog chrome (backdrop, close, size
 * class) — this component only owns the field grid + submit row so it
 * can nest inside `<Dialog>`, `<AlertDialog>`, a bottom sheet, or the
 * existing bespoke `fixed inset-0` overlays without conflict.
 *
 * Business-critical carve-outs (Sentinel):
 *  - `RequestListingModal` keeps its own draft key + custom event contract.
 *    When it migrates, it will pass `formDef.key = 'requestListing'` and
 *    hydrate `defaults()` from `localStorage.listShopDraft` itself.
 *  - `ShopModal` keeps concurrency-guard save (`updateShopWithConcurrency`).
 *    Its `onSubmit` calls the guard; the framework only reports errors.
 */
import { useCallback, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { inputCls } from '@/components/admin/adminHelpers';
import type { FieldDef, FormDef } from './types';

interface EntityFormProps<T> {
  formDef: FormDef<T>;
  /** Existing row for edit; `null` / `undefined` for create. */
  initialValues?: Partial<T> | null;
  /** Fired after a successful submit. */
  onSaved?: () => void;
  /** Fired when the user clicks Cancel. */
  onCancel?: () => void;
  /** Extra content rendered inside the modal header, right side. */
  headerExtras?: ReactNode;
  /** Extra rows rendered above the submit bar (e.g. footer banner). */
  footerExtras?: ReactNode;
  /** Override the submit button label. */
  submitLabel?: string;
  /** Force the submit button into a loading state (e.g. parent uploads). */
  externalBusy?: boolean;
  /** Wrap-around class applied to the outer <form> element. */
  className?: string;
}

export function EntityForm<T extends Record<string, any>>({
  formDef,
  initialValues,
  onSaved,
  onCancel,
  headerExtras,
  footerExtras,
  submitLabel,
  externalBusy = false,
  className,
}: EntityFormProps<T>) {
  const mode: 'create' | 'edit' = initialValues && (initialValues as any).id ? 'edit' : 'create';
  const [values, setValues] = useState<T>(() => ({
    ...formDef.defaults(),
    ...(initialValues ?? {}),
  } as T));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const busy = saving || externalBusy;

  const setField = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    // Clear the field-specific error the moment the user edits it.
    setErrors((e) => {
      if (!e[key as string]) return e;
      const { [key as string]: _, ...rest } = e;
      return rest;
    });
  }, []);

  const visibleFields = useMemo(
    () => formDef.fields.filter((f) => (f.visible ? f.visible(values) : true)),
    [formDef.fields, values],
  );

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;

    // Runtime validation via zod (optional per FormDef).
    if (formDef.schema) {
      const result = formDef.schema.safeParse(values);
      if (!result.success) {
        const next: Record<string, string> = {};
        for (const issue of result.error.issues) {
          const path = issue.path.join('.');
          if (path && !next[path]) next[path] = issue.message;
        }
        setErrors(next);
        return;
      }
    }

    setErrors({});
    setSaving(true);
    try {
      await formDef.onSubmit(values, mode);
      onSaved?.();
    } catch (err) {
      // Callers surface their own toast; keep the row-level error map clean.
      // Nothing to do here — parent decides whether to surface a message.
    } finally {
      setSaving(false);
    }
  };

  const title = mode === 'edit' ? formDef.editTitle : formDef.createTitle;

  return (
    <form onSubmit={handleSubmit} className={className} noValidate>
      {(title || headerExtras) && (
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg text-foreground">{title}</h2>
          {headerExtras}
        </div>
      )}

      <div className="grid grid-cols-12 gap-4">
        {visibleFields.map((f) => (
          <FieldRow
            key={f.name}
            field={f}
            value={values[f.name]}
            values={values}
            error={errors[f.name]}
            disabled={busy}
            setField={setField}
          />
        ))}
      </div>

      {footerExtras}

      <div className="flex gap-3 pt-4 mt-4 border-t border-border">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="flex-1 py-3 border border-border rounded-xl font-semibold text-foreground hover:bg-muted transition-colors disabled:opacity-60"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={busy}
          className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}
          {submitLabel ?? (mode === 'edit' ? 'Save Changes' : 'Create')}
        </button>
      </div>
    </form>
  );
}

// ── Field renderer ────────────────────────────────────────────────

interface FieldRowProps<T> {
  field: FieldDef<T>;
  value: any;
  values: T;
  error?: string;
  disabled: boolean;
  setField: <K extends keyof T>(key: K, value: T[K]) => void;
}

function FieldRow<T extends Record<string, any>>({
  field, value, values, error, disabled, setField,
}: FieldRowProps<T>) {
  const kind = field.kind ?? 'text';
  const colSpan = field.colSpan ?? 12;
  const colClass = colSpan === 6 ? 'col-span-12 md:col-span-6' : 'col-span-12';

  // The `custom` escape hatch — render prop takes over completely.
  if (kind === 'custom' && field.render) {
    return (
      <div className={colClass}>
        {field.render({ values, setField, error, disabled })}
      </div>
    );
  }

  if (kind === 'checkbox') {
    return (
      <div className={colClass}>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={!!value}
            disabled={disabled}
            onChange={(e) => setField(field.name as any, e.target.checked as any)}
            className="w-4 h-4 accent-primary"
          />
          <span className="text-sm font-medium text-foreground">{field.label}</span>
        </label>
        {field.help && <p className="text-xs text-muted-foreground mt-1">{field.help}</p>}
        {error && <p className="text-xs text-destructive mt-1">{error}</p>}
      </div>
    );
  }

  const label = (
    <label
      htmlFor={`field-${field.name}`}
      className="block text-sm font-semibold text-foreground mb-1.5"
    >
      {field.label}
      {field.required && <span className="text-destructive ml-0.5">*</span>}
    </label>
  );

  const commonProps = {
    id: `field-${field.name}`,
    name: field.name,
    required: field.required,
    disabled,
    autoComplete: field.autoComplete,
    placeholder: field.placeholder,
    maxLength: field.maxLength,
    value: value ?? '',
    onChange: (e: any) => setField(field.name as any, e.target.value),
    className: inputCls,
    'aria-invalid': !!error || undefined,
  } as const;

  let control: ReactNode;
  if (kind === 'textarea') {
    control = <textarea rows={4} {...commonProps} />;
  } else if (kind === 'select') {
    control = (
      <select {...commonProps}>
        {!field.required && <option value="">—</option>}
        {(field.options ?? []).map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    );
  } else if (kind === 'time') {
    control = <input type="time" {...commonProps} />;
  } else if (kind === 'date') {
    control = <input type="date" {...commonProps} />;
  } else if (kind === 'number') {
    control = <input type="number" {...commonProps} />;
  } else if (kind === 'email') {
    control = <input type="email" {...commonProps} />;
  } else if (kind === 'tel') {
    control = <input type="tel" inputMode="tel" {...commonProps} />;
  } else if (kind === 'url') {
    control = <input type="url" inputMode="url" {...commonProps} />;
  } else {
    control = <input type="text" {...commonProps} />;
  }

  return (
    <div className={colClass}>
      {label}
      {control}
      {field.help && !error && <p className="text-xs text-muted-foreground mt-1">{field.help}</p>}
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  );
}
