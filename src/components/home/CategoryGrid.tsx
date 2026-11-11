/**
 * CategoryGrid — extracted from Home.tsx (MPULSE Phase 2 #7).
 * The "Browse by Shop Category" section, including the expand/collapse
 * toggle and its smooth-scroll behaviour after collapse.
 */
import { forwardRef, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { CategoryIcon } from '@/components/shared/CategoryIcon';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useT } from '@/i18n';
import { useCity } from '@/hooks/useCity';

interface CategoryGridProps {
  categories: any[];
  visibleCategories: any[];
  catShopCounts: Record<string, number>;
  showAllCats: boolean;
  onToggleShowAll: () => void;
  canExpand: boolean;
  loading: boolean;
  localizeCat: (id: string | null | undefined, fallback: string) => string;
}

function CategorySkeleton() {
  return (
    <div className="grid grid-cols-4 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-8 gap-2 sm:gap-3.5">
      {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <div key={i} className="rounded-xl p-2 sm:p-3 border border-border skeleton-shimmer h-[88px]" />
      ))}
    </div>
  );
}

export const CategoryGrid = forwardRef<HTMLElement, CategoryGridProps>(function CategoryGrid(
  { visibleCategories, catShopCounts, showAllCats, onToggleShowAll, canExpand, loading, localizeCat },
  ref,
) {
  const navigate = useNavigate();
  const { currentCity } = useCity();
  const { t, locale } = useT();
  const scrollRafRef = useRef<number | null>(null);

  const handleToggle = () => {
    if (showAllCats) {
      if (scrollRafRef.current !== null) cancelAnimationFrame(scrollRafRef.current);
      scrollRafRef.current = requestAnimationFrame(() => {
        scrollRafRef.current = requestAnimationFrame(() => {
          scrollRafRef.current = null;
          const el = (ref as React.MutableRefObject<HTMLElement | null>)?.current
            ?? document.getElementById('category-section');
          if (el) {
            const top = el.getBoundingClientRect().top + window.scrollY - 8;
            window.scrollTo({ top, behavior: 'smooth' });
          } else {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        });
      });
    }
    onToggleShowAll();
  };

  return (
    <section id="category-section" ref={ref}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="text-base sm:text-lg font-bold text-foreground">{t('home.browseShopCategory')}</h2>
        </div>
        {canExpand && (
          <button
            onClick={handleToggle}
            className="text-xs font-semibold text-primary hover:underline shrink-0 flex items-center gap-0.5"
          >
            {showAllCats ? t('home.showLess') : t('home.viewAll')} <ChevronRight className="w-3 h-3" />
          </button>
        )}
      </div>

      {loading ? (
        <CategorySkeleton />
      ) : visibleCategories.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">{t('home.noCategories')}</div>
      ) : (
        <div className="grid grid-cols-4 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-8 gap-2 sm:gap-3.5">
          {visibleCategories.map((cat) => {
            const count = catShopCounts[cat.id] || 0;
            return (
              <button
                key={cat.id}
                onClick={() => {
                  const lower = (cat.name || '').toLowerCase();
                  if (
                    lower.includes('mess') ||
                    lower.includes('dining') ||
                    lower.includes('restaurant') ||
                    lower.includes('hotel')
                  ) {
                    toast.message(locale === 'mr' ? 'मेस, हॉटेल्स व जेवण विभाग उघडत आहे...' : 'Opening Mess, Hotels & Dining...');
                    navigate(`/${currentCity.slug}/mess`);
                    return;
                  }
                  if (lower.includes('pg') || lower.includes('hostel')) {
                    toast.message(locale === 'mr' ? 'पीजी व वसतिगृह विभाग उघडत आहे...' : 'Opening PG & Hostels...');
                    navigate(`/${currentCity.slug}/pg`);
                    return;
                  }
                  toast.message(t('home.openingCategory', { name: cat.name }));
                  navigate(`/${currentCity.slug}/shops?category=${encodeURIComponent(cat.name)}`);
                }}
                className="group relative flex flex-col items-center gap-1.5 bg-card rounded-xl p-2 sm:p-3 border border-border hover:border-primary/50 hover:shadow-md transition-all duration-200 active:scale-[0.96] min-w-0"
              >
                {count > 0 && (
                  <span
                    className="absolute top-1 right-1 z-10 text-[9px] sm:text-[10px] font-bold min-w-[16px] sm:min-w-[18px] text-center px-1 sm:px-1.5 py-0.5 rounded-full leading-none"
                    style={{ background: 'hsl(var(--secondary))', color: 'hsl(var(--secondary-foreground))' }}
                  >
                    {count}
                  </span>
                )}
                <div
                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center text-primary group-hover:scale-110 transition-transform duration-200"
                  style={{ background: 'linear-gradient(135deg, hsl(var(--primary) / 0.12), hsl(var(--primary) / 0.04))' }}
                >
                  <CategoryIcon name={cat.name} className="w-5 h-5 sm:w-7 sm:h-7" strokeWidth={1.75} />
                </div>
                <span className={cn("font-semibold text-foreground text-center leading-tight line-clamp-2 w-full break-words", locale === 'mr' ? "text-[11px] sm:text-sm" : "text-[10px] sm:text-xs")}>
                  {localizeCat(cat.id, cat.name)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
});
