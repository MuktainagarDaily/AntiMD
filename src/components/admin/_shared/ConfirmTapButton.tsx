import { ReactNode, useEffect, useRef, useState } from 'react';

interface Props {
  onConfirm: () => void;
  className?: string;
  confirmClassName?: string;
  children: ReactNode;
  confirmLabel?: ReactNode;
  title?: string;
  disabled?: boolean;
}

/**
 * Two-tap safety button: first tap arms; second tap within 2s confirms.
 * Prevents accidental destructive toggles on touch devices.
 */
export function ConfirmTapButton({
  onConfirm, className = '', confirmClassName = '', children,
  confirmLabel = 'Tap to confirm', title, disabled = false,
}: Props) {
  const [armed, setArmed] = useState(false);
  const t = useRef<number | null>(null);
  useEffect(() => () => { if (t.current) window.clearTimeout(t.current); }, []);
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        if (disabled) return;
        if (armed) {
          if (t.current) window.clearTimeout(t.current);
          setArmed(false);
          onConfirm();
        } else {
          setArmed(true);
          t.current = window.setTimeout(() => setArmed(false), 2000);
        }
      }}
      className={armed ? confirmClassName : className}
    >
      {armed ? confirmLabel : children}
    </button>
  );
}