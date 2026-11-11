import { ReactNode } from 'react';

interface Props {
  onClick: () => void;
  icon: ReactNode;
  label: string;
}

/** Floating action button — visible only on small screens. */
export function AdminFab({ onClick, icon, label }: Props) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="md:hidden fixed bottom-5 right-4 z-40 inline-flex items-center gap-2 px-4 h-12 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 font-semibold text-sm active:scale-95 transition-transform"
      style={{ bottom: 'calc(1.25rem + env(safe-area-inset-bottom, 0px))' }}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}