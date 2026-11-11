/**
 * HomeSearch — extracted from Home.tsx (MPULSE Phase 2 #7).
 * Owns the hero search input + autocomplete suggestion list. Parent
 * still owns `search` state, focus flag, submit handler, and suggestion
 * data — this component is purely presentational.
 *
 * Implements rotating contextual placeholder hints:
 *   EN: "Search 'Swami Samarth Mess'...", "Search 'Bus to Jalgaon'...", etc.
 *   MR: "'स्वामी समर्थ मेस' शोधा…", "'जळगाव बस वेळापत्रक' शोधा…", etc.
 * Pauses cycling as soon as the user focuses or starts typing.
 */
import { forwardRef, useState, useEffect, useMemo } from 'react';
import { Search } from 'lucide-react';
import { HighlightedText } from '@/components/shared/HighlightedText';
import { useLocalizedShop } from '@/hooks/useTranslationsCache';
import { useCity } from '@/hooks/useCity';
import { useT } from '@/i18n';

const ROTATING_HINTS_EN = [
  "Search 'Swami Samarth Mess'…",
  "Search 'Bus to Jalgaon'…",
  "Search 'Boys PG near College'…",
  "Search 'Kirana & Grocery'…",
];

const ROTATING_HINTS_MR = [
  "'स्वामी समर्थ मेस' शोधा…",
  "'जळगाव बस वेळापत्रक' शोधा…",
  "'मुलांचे वसतिगृह / पीजी' शोधा…",
  "'किराणा व जनरल स्टोअर्स' शोधा…",
];

function HomeSuggestionRow({
  shop: rawShop,
  query,
  onPick,
  localizeCat,
}: {
  shop: any;
  query: string;
  onPick: (path: string) => void;
  localizeCat: (id: string | null | undefined, fallback: string) => string;
}) {
  const { currentCity } = useCity();
  const shop = useLocalizedShop(rawShop) || rawShop;
  const sc = rawShop.shop_categories?.[0];
  const catLabel = sc?.categories?.name ? localizeCat(sc.category_id, sc.categories.name) : null;
  const shopPath = shop.slug ? `/${currentCity.slug}/shop/${shop.slug}` : `/${currentCity.slug}/shop/${shop.id}`;
  const areaLine = [shop.area, shop.sub_area].filter(Boolean).join(', ');
  return (
    <div
      onMouseDown={(e) => { e.preventDefault(); onPick(shopPath); }}
      onPointerDown={(e) => { e.preventDefault(); onPick(shopPath); }}
      className="flex items-center gap-3 px-3.5 py-2.5 cursor-pointer hover:bg-accent/50 transition-colors border-b border-border/50 last:border-b-0"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">
          <HighlightedText text={shop.name} query={query} />
        </p>
        {areaLine && (
          <p className="text-xs text-muted-foreground truncate">
            <HighlightedText text={areaLine} query={query} />
          </p>
        )}
      </div>
      {catLabel && (
        <span className="shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
          <HighlightedText text={catLabel} query={query} />
        </span>
      )}
    </div>
  );
}

interface HomeSearchProps {
  search: string;
  onSearchChange: (v: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  onSubmit: (e: React.FormEvent) => void;
  searchFocused: boolean;
  suggestions: any[];
  onPickSuggestion: (shop: any, path: string) => void;
  localizeCat: (id: string | null | undefined, fallback: string) => string;
}

export const HomeSearch = forwardRef<HTMLInputElement, HomeSearchProps>(function HomeSearch(
  { search, onSearchChange, onFocus, onBlur, onSubmit, searchFocused, suggestions, onPickSuggestion, localizeCat },
  ref,
) {
  const { t, locale } = useT();
  const hints = useMemo(() => (locale === 'mr' ? ROTATING_HINTS_MR : ROTATING_HINTS_EN), [locale]);
  const [hintIndex, setHintIndex] = useState(0);

  useEffect(() => {
    // Pause rotation when user is focused or typing
    if (searchFocused || search.length > 0) return;

    const interval = setInterval(() => {
      setHintIndex((prev) => (prev + 1) % hints.length);
    }, 2500);

    return () => clearInterval(interval);
  }, [searchFocused, search, hints.length]);

  const currentPlaceholder = hints[hintIndex] || t('home.search.placeholder');

  return (
    <form onSubmit={onSubmit} className="relative mb-3">
      <Search
        className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none transition-colors ${
          searchFocused ? 'text-primary' : 'text-muted-foreground'
        }`}
      />
      <input
        ref={ref}
        type="text"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder={currentPlaceholder}
        className="w-full pl-10 pr-[88px] py-3.5 rounded-xl text-foreground bg-card text-sm shadow-xl focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow"
        autoComplete="off"
      />
      <button
        type="submit"
        aria-label={t('shops.searchSubmit')}
        className="absolute right-2 top-1/2 -translate-y-1/2 font-semibold text-xs sm:text-sm px-3 py-2 rounded-lg transition-colors active:scale-95 whitespace-nowrap"
        style={{ background: 'hsl(var(--secondary))', color: 'hsl(var(--secondary-foreground))' }}
      >
        {t('shops.searchSubmit')}
      </button>

      {searchFocused && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-2xl z-[999] overflow-hidden max-h-[320px] overflow-y-auto">
          {suggestions.map((shop: any) => (
            <HomeSuggestionRow
              key={shop.id}
              shop={shop}
              query={search}
              localizeCat={localizeCat}
              onPick={(p) => onPickSuggestion(shop, p)}
            />
          ))}
        </div>
      )}
    </form>
  );
});
