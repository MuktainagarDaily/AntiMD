interface Chip<T extends string> {
  value: T;
  label: string;
  count?: number;
}

interface Props<T extends string> {
  value: T;
  options: Chip<T>[];
  onChange: (v: T) => void;
}

export function QuickFilters<T extends string>({ value, options, onChange }: Props<T>) {
  return (
    <div className="flex gap-1.5 overflow-x-auto scrollbar-none -mx-4 px-4 pb-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={`shrink-0 inline-flex items-center gap-1 px-3 h-8 rounded-full text-xs font-semibold border transition-colors ${
              active
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card text-muted-foreground border-border hover:text-foreground'
            }`}
          >
            {o.label}
            {o.count != null && (
              <span
                className={`ml-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold ${
                  active ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-foreground'
                }`}
              >
                {o.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}