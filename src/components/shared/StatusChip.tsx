import { getShopStatus, type ShopStatus } from '@/lib/shopUtils';

/**
 * Shows the smart "Open · Closes in 35 min" / "Closed · Opens at 9:00 AM"
 * status chip. Uses getShopStatus() so it stays in sync with isShopOpen().
 *
 * Variants:
 *  - 'overlay' — translucent pill for placement on top of an image
 *  - 'inline'  — solid pill for use in card body / no-image fallbacks
 *  - 'dot'     — minimal coloured dot (used by compact card thumbnails)
 */
export function StatusChip({
  shop,
  variant = 'inline',
  size = 'md',
}: {
  shop: { is_open: boolean; opening_time?: string | null; closing_time?: string | null };
  variant?: 'overlay' | 'inline' | 'dot';
  size?: 'sm' | 'md';
}) {
  const status: ShopStatus = getShopStatus(shop);

  if (variant === 'dot') {
    return (
      <span
        className={`w-2.5 h-2.5 rounded-full shrink-0 ring-2 ring-card ${status.open ? 'animate-pulse-open' : 'opacity-60'}`}
        style={{
          background: status.open
            ? status.urgency === 'imminent' ? 'hsl(var(--secondary))' : 'hsl(var(--success))'
            : 'hsl(var(--muted-foreground))',
        }}
        title={status.label}
      />
    );
  }

  // Pick colors based on open + urgency
  const bgColor = status.open
    ? status.urgency === 'imminent' ? 'hsl(var(--secondary) / 0.12)' : 'hsl(var(--success) / 0.10)'
    : 'hsl(var(--destructive) / 0.08)';
  const textColor = status.open
    ? status.urgency === 'imminent' ? 'hsl(var(--secondary))' : 'hsl(var(--success))'
    : 'hsl(var(--destructive))';
  const dotColor = status.open
    ? status.urgency === 'imminent' ? 'hsl(var(--secondary))' : 'hsl(var(--success))'
    : 'hsl(var(--destructive))';
  const borderColor = status.open
    ? status.urgency === 'imminent' ? 'hsl(var(--secondary) / 0.40)' : 'hsl(var(--success) / 0.30)'
    : 'hsl(var(--destructive) / 0.25)';

  const padding = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs';
  const overlayBg = variant === 'overlay'
    ? 'hsl(var(--card) / 0.88)'
    : bgColor;

  return (
    <div
      className={`flex items-center gap-1.5 rounded-full font-bold border whitespace-nowrap ${padding} ${variant === 'overlay' ? 'backdrop-blur-sm' : ''}`}
      style={{
        background: overlayBg,
        color: textColor,
        borderColor: borderColor,
      }}
      title={status.label}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full shrink-0 ${status.open ? 'animate-pulse-open' : ''}`}
        style={{ background: dotColor }}
      />
      <span className="leading-none">{status.label}</span>
    </div>
  );
}
