import { useT } from '@/i18n';
import { cn } from '@/lib/utils';

export const PARANDWADI_VILLAGE_ID = 'eea5f1fb-04a7-4f53-b3a4-497a781324b3';

const PARANDWADI_TEXT_RE = /parandwadi|परंदवडी/i;

export interface DemoDetectableEntity {
  village_id?: string | null;
  slug?: string | null;
  area?: string | null;
  address?: string | null;
}

export interface DemoDetectableVillage {
  id?: string | null;
  slug?: string | null;
}

export function isParandwadiDemoListing(
  entity?: DemoDetectableEntity | null,
  currentVillage?: DemoDetectableVillage | null,
): boolean {
  if (entity?.village_id === PARANDWADI_VILLAGE_ID) return true;
  if (
    currentVillage &&
    (currentVillage.id === PARANDWADI_VILLAGE_ID || currentVillage.slug?.toLowerCase() === 'parandwadi')
  ) {
    return true;
  }
  const combined = [entity?.slug, entity?.area, entity?.address].filter(Boolean).join(' ');
  return combined.length > 0 && PARANDWADI_TEXT_RE.test(combined);
}

export function DemoBadge({
  size = 'sm',
  className,
}: {
  size?: 'sm' | 'md';
  className?: string;
}) {
  const { locale } = useT();
  const isMr = locale === 'mr';
  const label = isMr ? 'डेमो' : 'Demo';
  const title = isMr
    ? 'परंदवडीसाठी नमुना (डेमो) नोंदणी'
    : 'Sample demo data for Parandwadi';

  return (
    <span
      title={title}
      aria-label={title}
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-semibold leading-none shrink-0 border border-amber-500/35 bg-amber-500/15 text-amber-800 dark:text-amber-300 select-none',
        size === 'md' ? 'text-[11px] px-2 py-0.5' : 'text-[9px] sm:text-[10px] px-1.5 py-0.5',
        className,
      )}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
      <span>{label}</span>
    </span>
  );
}
