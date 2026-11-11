import { ReactNode } from 'react';

interface Props {
  icon: ReactNode;
  title: string;
  hint?: string;
  cta?: { label: string; onClick: () => void };
}

export function EmptyState({ icon, title, hint, cta }: Props) {
  return (
    <div className="bg-card border border-border rounded-2xl px-6 py-12 text-center">
      <div className="mx-auto w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-3 text-muted-foreground">
        {icon}
      </div>
      <p className="font-semibold text-foreground">{title}</p>
      {hint && <p className="text-sm text-muted-foreground mt-1">{hint}</p>}
      {cta && (
        <button
          onClick={cta.onClick}
          className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors"
        >
          {cta.label}
        </button>
      )}
    </div>
  );
}