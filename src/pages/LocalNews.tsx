import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  ChevronLeft,
  ExternalLink,
  Newspaper,
  Pin,
  RefreshCw,
  Search,
  Share2,
  X,
} from 'lucide-react';
import { PageSeo } from '@/components/seo/PageSeo';
import { Footer } from '@/components/shared/Footer';
import { BannerSlot } from '@/components/banners/BannerSlot';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCity } from '@/hooks/useCity';
import { useT } from '@/i18n';
import {
  formatNewsDateIST,
  getISTDateKey,
  getNewsDateGroupLabel,
} from '@/lib/news/newsParser';
import {
  fetchLocalNewsForCity,
  fetchNewsSources,
  scrapeInternetNews,
} from '@/lib/news/newsService';
import {
  NEWS_CATEGORIES,
  type LocalNewsItem,
  type NewsCategory,
  type NewsDateRange,
} from '@/lib/news/newsTypes';

export default function LocalNews() {
  const navigate = useNavigate();
  const { currentCity, townBrand, townName, getPageTitle } = useCity();
  const { locale, t } = useT();
  const isMr = locale === 'mr';

  const [items, setItems] = useState<LocalNewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | NewsCategory>('all');
  const [dateRange, setDateRange] = useState<NewsDateRange>('all');

  const loadNews = async (range: NewsDateRange = dateRange) => {
    setLoading(true);
    try {
      const { items: fetched } = await fetchLocalNewsForCity(currentCity.id, {
        activeOnly: true,
        dateRange: range,
      });
      setItems(fetched);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadNews(dateRange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCity.id, dateRange]);

  const handleRefreshFromSources = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const { sources } = await fetchNewsSources(
        currentCity.id,
        currentCity.name,
        currentCity.slug,
      );
      await scrapeInternetNews({
        cityId: currentCity.id,
        cityName: currentCity.name,
        citySlug: currentCity.slug,
        sources,
      });
      const { items: fresh } = await fetchLocalNewsForCity(currentCity.id, {
        activeOnly: true,
        dateRange,
      });
      setItems(fresh);
    } finally {
      setRefreshing(false);
    }
  };

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return items.filter((item) => {
      if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;
      if (!q) return true;
      const hay = `${item.title} ${item.title_mr || ''} ${item.summary || ''} ${item.summary_mr || ''} ${item.source_name}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, selectedCategory, searchQuery]);

  const pinnedItems = useMemo(() => filteredItems.filter((i) => i.is_pinned), [filteredItems]);
  const regularItems = useMemo(() => filteredItems.filter((i) => !i.is_pinned), [filteredItems]);

  const groupedByDate = useMemo(() => {
    const groups: Array<{ dateKey: string; label: string; articles: LocalNewsItem[] }> = [];
    const map = new Map<string, LocalNewsItem[]>();
    for (const article of regularItems) {
      const key = getISTDateKey(article.published_at);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(article);
    }
    for (const [dateKey, articles] of map.entries()) {
      groups.push({
        dateKey,
        label: getNewsDateGroupLabel(articles[0].published_at, locale),
        articles,
      });
    }
    return groups;
  }, [regularItems, locale]);

  const handleShare = (article: LocalNewsItem) => {
    const title = isMr && article.title_mr ? article.title_mr : article.title;
    const dateLabel = formatNewsDateIST(article.published_at, locale);
    const shareText = `${title}\n${dateLabel} · ${article.source_name}\n${article.source_url || window.location.href}`;
    if (typeof navigator !== 'undefined' && navigator.share) {
      void navigator.share({ title, text: shareText, url: article.source_url || window.location.href }).catch(() => {});
      return;
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank', 'noopener,noreferrer');
  };

  const getCategoryLabel = (cat: NewsCategory) => {
    const meta = NEWS_CATEGORIES.find((c) => c.value === cat);
    if (!meta) return cat;
    return isMr ? meta.labelMr : meta.labelEn;
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PageSeo
        title={getPageTitle(t('news.pageTitle') || 'Local News')}
        description={
          t('news.metaDesc', { town: townName, brand: townBrand }) ||
          `Latest dated local news and town updates for ${townName} on ${townBrand}.`
        }
        path={`/${currentCity.slug}/news`}
      />

      <header className="sticky top-0 z-40 shadow-sm">
        <div className="bg-primary text-primary-foreground">
          <div className="max-w-4xl mx-auto px-3 sm:px-4 py-3 flex items-center justify-between gap-2 sm:gap-3">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
              <button
                type="button"
                onClick={() => navigate(`/${currentCity.slug}`)}
                className="inline-flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-primary-foreground/10 hover:bg-primary-foreground/20 active:scale-95 transition-all shrink-0"
                aria-label={t('common.back') || 'Back'}
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                <Newspaper className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                <div className="min-w-0">
                  <h1 className="text-sm sm:text-lg font-bold leading-tight truncate">
                    {isMr ? `${townName} स्थानिक बातम्या` : `${townName} Local News`}
                  </h1>
                  <p className="text-[11px] sm:text-xs text-primary-foreground/80 leading-tight truncate">
                    {isMr
                      ? 'तारीख आणि वेळेनुसार ताज्या शहर व तालुका बातम्या'
                      : 'Dated headlines & verified updates from internet & local desk'}
                  </p>
                </div>
              </div>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void handleRefreshFromSources()}
              disabled={refreshing}
              aria-label={isMr ? 'ताज्या करा' : 'Refresh'}
              className="shrink-0 gap-1.5 text-xs bg-primary-foreground/15 text-primary-foreground border border-primary-foreground/25 hover:bg-primary-foreground/25 hover:text-primary-foreground"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{isMr ? 'ताज्या करा' : 'Refresh'}</span>
            </Button>
          </div>
        </div>

        {/* Search & Date / Category filters */}
        <div className="bg-background/95 backdrop-blur-md text-foreground border-b border-border">
          <div className="max-w-4xl mx-auto px-3 sm:px-4 py-2.5 space-y-2.5">
          <div className="relative">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isMr ? 'बातम्या किंवा स्रोत शोधा...' : 'Search headlines, topics, or sources...'}
              className="w-full rounded-xl border border-border bg-muted/40 pl-9 pr-9 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
            {(
              [
                { v: 'all', en: 'All Dates', mr: 'सर्व तारखा' },
                { v: 'today', en: 'Today', mr: 'आज' },
                { v: '7d', en: 'Last 7 Days', mr: 'मागील ७ दिवस' },
                { v: '30d', en: 'Last 30 Days', mr: 'मागील ३० दिवस' },
              ] as const
            ).map((d) => (
              <button
                key={d.v}
                type="button"
                onClick={() => setDateRange(d.v)}
                className={`shrink-0 inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                  dateRange === d.v
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-muted-foreground border-border hover:text-foreground'
                }`}
              >
                <Calendar className="w-3 h-3" />
                {isMr ? d.mr : d.en}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                selectedCategory === 'all'
                  ? 'bg-secondary text-secondary-foreground border-secondary'
                  : 'bg-muted/50 text-muted-foreground border-transparent hover:text-foreground'
              }`}
            >
              {isMr ? 'सर्व विषय' : 'All Topics'}
            </button>
            {NEWS_CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                type="button"
                onClick={() => setSelectedCategory(cat.value)}
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                  selectedCategory === cat.value
                    ? 'bg-secondary text-secondary-foreground border-secondary'
                    : 'bg-muted/50 text-muted-foreground border-transparent hover:text-foreground'
                }`}
              >
                {isMr ? cat.labelMr : cat.labelEn}
              </button>
            ))}
          </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-5 space-y-6">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 rounded-2xl border bg-muted/40 animate-pulse" />
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-card p-10 text-center space-y-3">
            <Newspaper className="w-10 h-10 text-muted-foreground mx-auto" />
            <h2 className="text-base font-semibold text-foreground">
              {isMr ? 'निवडलेल्या कालावधीत बातम्या उपलब्ध नाहीत' : 'No news articles match this filter yet'}
            </h2>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              {isMr
                ? 'वरील तारीख किंवा विषय फिल्टर बदलून पहा, किंवा ताज्या इंटरनेट बातम्या लोड करण्यासाठी Refresh बटण दाबा.'
                : 'Try switching the date range or topic chip above, or tap Refresh to fetch live dated headlines for your town.'}
            </p>
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={() => void handleRefreshFromSources()}
              disabled={refreshing}
              className="gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              {isMr ? 'ताज्या बातम्या आणा' : 'Fetch Live Headlines'}
            </Button>
          </div>
        ) : (
          <>
            {pinnedItems.length > 0 && (
              <section className="space-y-2.5" aria-label="Pinned headlines">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-600">
                  <Pin className="w-3.5 h-3.5" />
                  <span>{isMr ? 'महत्त्वाच्या बातम्या' : 'Pinned Updates'}</span>
                </div>
                <div className="grid gap-3">
                  {pinnedItems.map((article) => (
                    <NewsArticleCard
                      key={article.id}
                      article={article}
                      isMr={isMr}
                      locale={locale}
                      categoryLabel={getCategoryLabel(article.category)}
                      onShare={() => handleShare(article)}
                      pinned
                    />
                  ))}
                </div>
              </section>
            )}

            {groupedByDate.map((group) => (
              <section key={group.dateKey} className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-bold">
                    <Calendar className="w-3.5 h-3.5" />
                    {group.label}
                  </span>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <div className="grid gap-3">
                  {group.articles.map((article) => (
                    <NewsArticleCard
                      key={article.id}
                      article={article}
                      isMr={isMr}
                      locale={locale}
                      categoryLabel={getCategoryLabel(article.category)}
                      onShare={() => handleShare(article)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </>
        )}

        <BannerSlot placement="shops_inline" fallback="homepage_inline" className="pt-2" />
      </main>

      <Footer />
    </div>
  );
}

function NewsArticleCard({
  article,
  isMr,
  locale,
  categoryLabel,
  onShare,
  pinned = false,
}: {
  article: LocalNewsItem;
  isMr: boolean;
  locale: 'en' | 'mr';
  categoryLabel: string;
  onShare: () => void;
  pinned?: boolean;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const title = isMr && article.title_mr ? article.title_mr : article.title;
  const summary = isMr && article.summary_mr ? article.summary_mr : article.summary;
  const formattedDate = formatNewsDateIST(article.published_at, locale);

  return (
    <article
      className={`rounded-2xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md ${
        pinned ? 'border-amber-400/60 bg-amber-50/40 dark:bg-amber-950/10' : 'border-border'
      }`}
    >
      <div className="space-y-2.5">
        <div className="flex gap-3 sm:gap-3.5 items-start">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="secondary" className="text-[10px] font-semibold">
                {categoryLabel}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {article.source_name}
              </Badge>
              {pinned && (
                <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 text-[10px]">
                  {isMr ? 'पिन केलेले' : 'Pinned'}
                </Badge>
              )}
            </div>

            <h3 className="text-sm sm:text-base font-bold text-foreground leading-snug">
              {title}
            </h3>

            {summary && (
              <p className="text-xs sm:text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                {summary}
              </p>
            )}
          </div>

          {article.image_url && !imgFailed && (
            <img
              src={article.image_url}
              alt={title}
              loading="lazy"
              onError={() => setImgFailed(true)}
              className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl object-cover shrink-0 border border-border"
            />
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-border/50">
          <time
            dateTime={article.published_at}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground"
          >
            <Calendar className="w-3 h-3 text-primary" />
            {formattedDate}
          </time>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={onShare}
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-primary px-2 py-1 rounded-lg hover:bg-muted transition-colors"
              aria-label={isMr ? 'शेअर करा' : 'Share news'}
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>{isMr ? 'शेअर' : 'Share'}</span>
            </button>

            {article.source_url && (
              <a
                href={article.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline px-2 py-1 rounded-lg hover:bg-primary/5"
              >
                <span>{isMr ? 'मूळ बातमी वाचा' : 'Read Source'}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
