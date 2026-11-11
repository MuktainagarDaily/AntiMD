/**
 * Marathi mirror field — simple labelled input/textarea bound to a Marathi
 * value. Translation is now handled by a single shared `TranslateAllButton`
 * placed at the top of the Marathi section, so this component intentionally
 * has no per-field translate button or auto-translate-on-blur logic.
 */
const baseInputCls =
  'w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm';

interface Props {
  label: string;
  /** English source text (kept for backwards compat; not used internally). */
  source?: string;
  value: string;
  onChange: (v: string) => void;
  textarea?: boolean;
  rows?: number;
  maxLength?: number;
  placeholder?: string;
}

export function MarathiMirrorField({
  label,
  value,
  onChange,
  textarea,
  rows = 3,
  maxLength,
  placeholder,
}: Props) {
  return (
    <div>
      <label className="block text-sm font-semibold text-foreground mb-1.5">{label}</label>
      {textarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={baseInputCls + ' resize-y min-h-[72px]'}
          rows={rows}
          lang="mr"
          maxLength={maxLength}
          placeholder={placeholder}
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={baseInputCls}
          lang="mr"
          maxLength={maxLength}
          placeholder={placeholder}
        />
      )}
    </div>
  );
}
