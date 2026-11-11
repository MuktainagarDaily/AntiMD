/**
 * ShopList — extracted from Home.tsx (MPULSE Phase 2 #7).
 * Horizontal "Recently Added" row that renders CompactShopCards. The
 * first card gets the LCP priority hint (MPULSE Image #1).
 */
import { useRef } from 'react';
import { Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CompactShopCard } from './CompactShopCard';
import { useT } from '@/i18n';
import { useCity } from '@/hooks/useCity';

export function ShopList({ shops }: { shops: any[] }) {
  const { t, locale } = useT();
  const navigate = useNavigate();
  const { currentCity } = useCity();
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  if (shops.length < 3) return null;

  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -420, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 420, behavior: 'smooth' });
    }
  };

  return (
    <section className="mb-6">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <Sparkles className="w-4 h-4 text-primary shrink-0" />
          <h2 className="text-base sm:text-lg font-bold text-foreground">{t('home.recentlyAdded')}</h2>
          <span className="text-[10px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full shrink-0">
            {t('home.recentlyAdded.badge')}
          </span>
        </div>

        {/* Desktop Controls & View All link */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => navigate(`/${currentCity.slug}/shops`)}
            className="text-xs font-semibold text-primary hover:underline flex items-center gap-0.5"
          >
            <span>{locale === 'mr' ? 'सर्व दुकाने पहा' : 'View all'}</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          {/* Desktop Left / Right Scroll Arrows (>= md) */}
          <div className="hidden md:flex items-center gap-1 ml-1">
            <button
              type="button"
              onClick={scrollLeft}
              aria-label="Scroll left"
              className="w-7 h-7 rounded-full border border-border bg-card hover:bg-muted active:scale-95 transition-all flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer shadow-xs"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={scrollRight}
              aria-label="Scroll right"
              className="w-7 h-7 rounded-full border border-border bg-card hover:bg-muted active:scale-95 transition-all flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer shadow-xs"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div
        ref={scrollContainerRef}
        className="flex gap-3 overflow-x-auto pb-2 scrollbar-none -mx-1 px-1 snap-x snap-mandatory scroll-smooth"
      >
        {shops.map((shop, idx) => (
          <div key={shop.id} className="snap-start shrink-0">
            <CompactShopCard shop={shop} priority={idx === 0} />
          </div>
        ))}
      </div>
    </section>
  );
}
