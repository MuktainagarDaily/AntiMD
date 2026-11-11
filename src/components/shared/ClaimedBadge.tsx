import { BadgeCheck } from 'lucide-react';
import { useT } from '@/i18n';

/**
 * Inline "Claimed" chip — visually mirrors the Verified chip but in
 * the success color so it reads as a separate signal. Includes a
 * CSS-only hover/focus tooltip ("Claimed by owner").
 *
 * Sizes:
 *  - 'sm' — used on shop cards (compact + standard)
 *  - 'md' — used on the Shop Detail page name row
 */
export function ClaimedBadge({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const { t } = useT();
  const isMd = size === 'md';
  const padding = isMd ? 'text-xs px-2 py-0.5' : 'text-[10px] px-1.5 py-0.5';
  const icon = isMd ? 'w-3.5 h-3.5' : 'w-2.5 h-2.5';
  const tooltip = t('shop.claimedTooltip');

  return (
    <div className="relative group inline-flex">
      <span
        tabIndex={0}
        className={`inline-flex items-center gap-1 rounded-full font-semibold cursor-default select-none leading-none ${padding}`}
        style={{ background: 'hsl(var(--success) / 0.12)', color: 'hsl(var(--success))' }}
        title={tooltip}
      >
        <BadgeCheck className={icon} /> {t('common.claimed')}
      </span>
      {/* Tooltip — same pattern as the Verified badge on Shop Detail */}
      <div
        className="absolute left-0 top-full mt-1.5 z-20 w-max max-w-[220px] rounded-lg px-2.5 py-1.5 text-xs font-medium shadow-md pointer-events-none
                   invisible opacity-0 translate-y-1
                   group-hover:visible group-hover:opacity-100 group-hover:translate-y-0
                   group-focus-within:visible group-focus-within:opacity-100 group-focus-within:translate-y-0
                   transition-all duration-150"
        style={{
          background: 'hsl(var(--success))',
          color: 'hsl(var(--success-foreground))',
        }}
      >
        {tooltip}
        <span
          className="absolute -top-1 left-3 w-2 h-2 rotate-45"
          style={{ background: 'hsl(var(--success))' }}
        />
      </div>
    </div>
  );
}
