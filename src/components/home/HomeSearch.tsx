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
import { Search, Sparkles } from 'lucide-react';
import { HighlightedText } from '@/components/shared/HighlightedText';
import { useLocalizedShop } from '@/hooks/useTranslationsCache';
import { useCity } from '@/hooks/useCity';
import { getEntityDetailPath } from '@/lib/shopUtils';
import { useT } from '@/i18n';

export type OmniSearchEntityType = 'shop' | 'mess' | 'pg' | 'school' | 'bus';

export interface OmniSearchSuggestion {
  id: string;
  entityType: OmniSearchEntityType;
  title: string;
  subtitle?: string;
  badgeLabel?: string;
  path: string;
  raw?: any;
}

const ROTATING_HINTS_EN = [
  "Search 'Swami Samarth Mess'…",
  "Search 'Bus to Nigdi / Jalgaon'…",
  "Search 'Boys PG or College'…",
  "Search 'Kirana & Today's Special'…",
];

const ROTATING_HINTS_MR = [
  "'स्वामी समर्थ मेस' शोधा…",
  "'निगडी / जळगाव बस वेळापत्रक' शोधा…",
  "'पीजी / शाळा व कॉलेज' शोधा…",
  "'किराणा किंवा आजचा मेनू' शोधा…",
];

const ENTITY_TYPE_PILLS: Record<
  OmniSearchEntityType,
  { en: string; mr: string; cls: string }
> = {
  shop: {
    en: 'Shop',
    mr: 'दुकान',
    cls: 'bg-primary/10 text-primary',
  },
  mess: {
    en: 'Mess / Food',
    mr: 'मेस / खाद्य',
    cls: 'bg-amber-500/15 text-amber-800 dark:text-amber-300',
  },
  pg: {
    en: 'PG / Stay',
    mr: 'पीजी / खोली',
    cls: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300',
  },
  school: {
    en: 'Education',
    mr: 'शिक्षण',
    cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  },
  bus: {
    en: 'Bus Route',
    mr: 'बस मार्ग',
    cls: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  },
};

function ShopLocalizedRow({
  rawShop,
  query,
  onPick,
  localizeCat,
}: {
  rawShop: any;
  query: string;
  onPick: (path: string) => void;
  localizeCat: (id: string | null | undefined, fallback: string) => string;
}) {
  const { currentCity } = useCity();
  const { locale } = useT();
  const shop = useLocalizedShop(rawShop) || rawShop;
  const sc = rawShop.shop_categories?.[0];
  const catLabel = sc?.categories?.name ? localizeCat(sc.category_id, sc.categories.name) : null;
  const shopPath = getEntityDetailPath(currentCity.slug, rawShop);
  const areaLine = [shop.area, shop.sub_area].filter(Boolean).join(', ');
  const pill = ENTITY_TYPE_PILLS.shop;

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
      <div className="flex items-center gap-1.5 shrink-0">
        {catLabel && (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground max-w-[110px] truncate">
            <HighlightedText text={catLabel} query={query} />
          </span>
        )}
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${pill.cls}`}>
          {locale === 'mr' ? pill.mr : pill.en}
        </span>
      </div>
    </div>
  );
}

function HomeSuggestionRow({
  item,
  query,
  onPick,
  localizeCat,
}: {
  item: OmniSearchSuggestion | any;
  query: string;
  onPick: (path: string) => void;
  localizeCat: (id: string | null | undefined, fallback: string) => string;
}) {
  const { locale } = useT();

  // Backwards-compatible handling when item is an OmniSearchSuggestion wrapping a shop
  if (item?.entityType === 'shop' && item?.raw) {
    return (
      <ShopLocalizedRow
        rawShop={item.raw}
        query={query}
        onPick={onPick}
        localizeCat={localizeCat}
      />
    );
  }

  // Or legacy raw shop object
  if (!item?.entityType && item?.name) {
    return (
      <ShopLocalizedRow
        rawShop={item}
        query={query}
        onPick={onPick}
        localizeCat={localizeCat}
      />
    );
  }

  const suggestion = item as OmniSearchSuggestion;
  const pill = ENTITY_TYPE_PILLS[suggestion.entityType] || ENTITY_TYPE_PILLS.shop;

  return (
    <div
      onMouseDown={(e) => { e.preventDefault(); onPick(suggestion.path); }}
      onPointerDown={(e) => { e.preventDefault(); onPick(suggestion.path); }}
      className="flex items-center gap-3 px-3.5 py-2.5 cursor-pointer hover:bg-accent/50 transition-colors border-b border-border/50 last:border-b-0"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">
          <HighlightedText text={suggestion.title} query={query} />
        </p>
        {suggestion.subtitle && (
          <p className="text-xs text-muted-foreground truncate">
            <HighlightedText text={suggestion.subtitle} query={query} />
          </p>
        )}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {suggestion.badgeLabel && (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground max-w-[110px] truncate">
            <HighlightedText text={suggestion.badgeLabel} query={query} />
          </span>
        )}
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${pill.cls}`}>
          {locale === 'mr' ? pill.mr : pill.en}
        </span>
      </div>
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
  suggestions: Array<OmniSearchSuggestion | any>;
  onPickSuggestion: (item: OmniSearchSuggestion | any, path: string) => void;
  onAskAi?: (query: string) => void;
  localizeCat: (id: string | null | undefined, fallback: string) => string;
}

export const HomeSearch = forwardRef<HTMLInputElement, HomeSearchProps>(function HomeSearch(
  { search, onSearchChange, onFocus, onBlur, onSubmit, searchFocused, suggestions, onPickSuggestion, onAskAi, localizeCat },
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
  const trimmed = search.trim();
  const showDropdown = searchFocused && (suggestions.length > 0 || trimmed.length >= 2);

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
        className="w-full pl-10 pr-[96px] sm:pr-[104px] py-3.5 rounded-xl text-foreground bg-card text-sm shadow-xl focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow text-ellipsis"
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

      {showDropdown && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-2xl z-[999] overflow-hidden max-h-[340px] overflow-y-auto">
          {suggestions.map((item: any) => (
            <HomeSuggestionRow
              key={`${item.entityType || 'shop'}-${item.id}`}
              item={item}
              query={search}
              localizeCat={localizeCat}
              onPick={(p) => onPickSuggestion(item, p)}
            />
          ))}
          {onAskAi && trimmed.length >= 2 && (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onAskAi(trimmed);
              }}
              onPointerDown={(e) => {
                e.preventDefault();
                onAskAi(trimmed);
              }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-xs font-semibold text-primary hover:bg-primary/5 transition-colors bg-primary/[0.04] border-t border-border/60"
            >
              <Sparkles className="w-4 h-4 shrink-0" />
              <span className="truncate">
                {locale === 'mr'
                  ? suggestions.length === 0
                    ? `"${trimmed}" सापडले नाही — सहाय्यक AI ला विचारा`
                    : `अधिक माहिती हवी? "${trimmed}" बद्दल सहाय्यक AI ला विचारा`
                  : suggestions.length === 0
                    ? `No direct match — Ask Sahayak AI about "${trimmed}"`
                    : `Not finding it? Ask Sahayak AI about "${trimmed}"`}
              </span>
            </button>
          )}
        </div>
      )}
    </form>
  );
});
