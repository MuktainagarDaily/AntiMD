import { useState } from 'react';
import { MapPin, ChevronDown } from 'lucide-react';
import { useCity } from '@/hooks/useCity';
import { useT } from '@/i18n';
import { CityPickerModal } from './CityPickerModal';

interface LocationPillProps {
  className?: string;
  variant?: 'compact' | 'full' | 'header';
}

export function LocationPill({ className = '', variant = 'header' }: LocationPillProps) {
  const [open, setOpen] = useState(false);
  const { currentCity, currentVillage } = useCity();
  const { locale } = useT();

  const cityName = locale === 'mr' && currentCity.name_mr ? currentCity.name_mr : currentCity.name;
  const villageName = currentVillage ? (locale === 'mr' && currentVillage.name_mr ? currentVillage.name_mr : currentVillage.name) : null;
  const distName = locale === 'mr' && currentCity.district?.name_mr ? currentCity.district.name_mr : currentCity.district?.name;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Change location"
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-border/80 bg-background/80 hover:bg-accent/50 text-foreground transition-all duration-150 active:scale-95 text-xs font-semibold shadow-2xs backdrop-blur-xs ${className}`}
      >
        <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
        <span className="truncate max-w-[130px] sm:max-w-[200px]">
          {villageName ? `${villageName}, ${cityName}` : distName ? `${cityName}, ${distName}` : cityName}
        </span>
        <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
      </button>

      <CityPickerModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
