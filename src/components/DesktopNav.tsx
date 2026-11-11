import { useLocation, useNavigate } from 'react-router-dom';
import { useCity } from '@/hooks/useCity';
import { useT } from '@/i18n';
import { Store, UtensilsCrossed, Bed, Bus, Landmark, Home } from 'lucide-react';

interface DesktopNavProps {
  variant?: 'primary' | 'outline' | 'default';
  className?: string;
}

export function DesktopNav({ variant = 'default', className = '' }: DesktopNavProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentCity } = useCity();
  const { locale } = useT();

  const citySlug = currentCity.slug;
  const path = location.pathname;

  const isMr = locale === 'mr';

  const navItems = [
    {
      to: `/${citySlug}`,
      label: isMr ? 'मुख्य' : 'Home',
      icon: Home,
      isActive: path === `/${citySlug}` || path === '/',
    },
    {
      to: `/${citySlug}/shops`,
      label: isMr ? 'दुकाने' : 'Shops',
      icon: Store,
      isActive: path.startsWith(`/${citySlug}/shops`),
    },
    {
      to: `/${citySlug}/mess`,
      label: isMr ? 'मेस व भोजनालय' : 'Food & Mess',
      icon: UtensilsCrossed,
      isActive: path.startsWith(`/${citySlug}/mess`),
    },
    {
      to: `/${citySlug}/pg`,
      label: isMr ? 'पीजी व खोल्या' : 'PG & Rooms',
      icon: Bed,
      isActive: path.startsWith(`/${citySlug}/pg`),
    },
    {
      to: `/${citySlug}/bus-timetable`,
      label: isMr ? 'बस वेळापत्रक' : 'Bus Timetable',
      icon: Bus,
      isActive: path.startsWith(`/${citySlug}/bus-timetable`),
    },
    {
      to: `/${citySlug}/services`,
      label: isMr ? 'नागरी सेवा' : 'Civic Services',
      icon: Landmark,
      isActive: path.startsWith(`/${citySlug}/services`),
    },
  ];

  const isPrimary = variant === 'primary';

  return (
    <nav className={`hidden lg:flex items-center gap-0.5 xl:gap-1.5 min-w-0 ${className}`} aria-label="Desktop Navigation">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = item.isActive;

        let styleClasses = '';
        if (isPrimary) {
          styleClasses = active
            ? 'bg-primary-foreground/20 text-primary-foreground font-bold shadow-2xs border border-primary-foreground/30'
            : 'text-primary-foreground/85 hover:text-primary-foreground hover:bg-primary-foreground/10 font-medium';
        } else {
          styleClasses = active
            ? 'bg-primary/10 text-primary font-bold shadow-2xs border border-primary/20'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted font-medium';
        }

        return (
          <button
            key={item.to}
            type="button"
            onClick={() => navigate(item.to)}
            className={`inline-flex items-center gap-1.5 px-2 xl:px-3 py-1.5 rounded-xl text-xs xl:text-sm transition-all duration-150 cursor-pointer active:scale-95 shrink-0 ${styleClasses}`}
          >
            <Icon className="w-3.5 h-3.5 xl:w-4 xl:h-4 shrink-0" />
            <span className="whitespace-nowrap">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
