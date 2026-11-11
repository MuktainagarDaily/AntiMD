import { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  Globe,
  Link2,
  Loader2,
  Newspaper,
  Pencil,
  Pin,
  Plus,
  RefreshCw,
  Rss,
  Search,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import { useCity } from '@/hooks/useCity';
import { downloadCsv, townCsvFilename } from '@/lib/csvUtils';
import { NewsCsvImportModal } from './NewsCsvImportModal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ConfirmTapButton } from '@/components/admin/_shared/ConfirmTapButton';
import {
  formatNewsDateIST,
  fromDatetimeLocalValue,
  getISTDateKey,
  toDatetimeLocalValue,
} from '@/lib/news/newsParser';
import {
  deleteNewsItem,
  deleteNewsSource,
  fetchLocalNewsForCity,
  fetchNewsSources,
  patchNewsFlags,
  saveNewsItem,
  saveNewsSource,
  scrapeInternetNews,
  seedDefaultNewsSources,
} from '@/lib/news/newsService';
import {
  NEWS_CATEGORIES,
  type LocalNewsItem,
  type NewsCategory,
  type NewsLanguage,
  type NewsSource,
  type NewsSourceType,
  type ScrapeSourceReport,
} from '@/lib/news/newsTypes';

interface NewsFormState {
  id?: string;
  title: string;
  title_mr: string;
  summary: string;
  summary_mr: string;
  category: NewsCategory;
  language: NewsLanguage;
  source_name: string;
  source_url: string;
  image_url: string;
  published_at_local: string;
  is_pinned: boolean;
  is_active: boolean;
}

function emptyNewsForm(): NewsFormState {
  return {
    title: '',
    title_mr: '',
    summary: '',
    summary_mr: '',
    category: 'local',
    language: 'mr',
    source_name: 'Town Desk',
    source_url: '',
    image_url: '',
    published_at_local: toDatetimeLocalValue(new Date().toISOString()),
    is_pinned: false,
    is_active: true,
  };
}

export function LocalNewsTab() {
  const { currentCity, allCities } = useCity();
  const [selectedCityId, setSelectedCityId] = useState<string>(currentCity.id);
  const activeCity = allCities.find((c) => c.id === selectedCityId) || currentCity;

  const [items, setItems] = useState<LocalNewsItem[]>([]);
  const [sources, setSources] = useState<NewsSource[]>([]);
  const [storageMode, setStorageMode] = useState<'supabase' | 'local-cache'>('supabase');
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [customScrapeUrl, setCustomScrapeUrl] = useState('');
  const [lastReports, setLastReports] = useState<ScrapeSourceReport[]>([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | NewsCategory>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft' | 'pinned'>('all');

  // Article modal
  const [modalOpen, setModalOpen] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [savingArticle, setSavingArticle] = useState(false);
  const [form, setForm] = useState<NewsFormState>(emptyNewsForm);

  // Add Source inline state
  const [showSourcesPanel, setShowSourcesPanel] = useState(false);
  const [newSourceName, setNewSourceName] = useState('');
  const [newSourceUrl, setNewSourceUrl] = useState('');
  const [newSourceType, setNewSourceType] = useState<NewsSourceType>('rss');
  const [newSourceLang, setNewSourceLang] = useState<NewsLanguage>('mr');
  const [newSourceCat, setNewSourceCat] = useState<NewsCategory>('local');

  const loadData = async () => {
    setLoading(true);
    try {
      const [newsRes, srcRes] = await Promise.all([
        fetchLocalNewsForCity(activeCity.id, { activeOnly: false }),
        fetchNewsSources(activeCity.id, activeCity.name, activeCity.slug),
      ]);
      setItems(newsRes.items);
      setStorageMode(newsRes.storageMode);
      setSources(srcRes.sources);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCity.id]);

  const handleScrapeAll = async () => {
    setScraping(true);
    try {
      const activeSources = sources.filter((s) => s.is_active);
      if (activeSources.length === 0) {
        toast.error('Enable or add at least one active news source first.');
        return;
      }
      const res = await scrapeInternetNews({
        cityId: activeCity.id,
        cityName: activeCity.name,
        citySlug: activeCity.slug,
        sources: activeSources,
      });
      setItems(res.items);
      setStorageMode(res.storageMode);
      setLastReports(res.reports);
      toast.success(
        `Scraped ${res.fetchedCount} dated articles (${res.insertedCount} new) for ${activeCity.name}.`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to scrape internet sources');
    } finally {
      setScraping(false);
    }
  };

  const handleScrapeCustomUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = customScrapeUrl.trim();
    if (!url || !/^https?:\/\//i.test(url)) {
      toast.error('Enter a valid http:// or https:// website or RSS URL.');
      return;
    }
    setScraping(true);
    try {
      const res = await scrapeInternetNews({
        cityId: activeCity.id,
        cityName: activeCity.name,
        citySlug: activeCity.slug,
        sources,
        customUrl: url,
      });
      setItems(res.items);
      setStorageMode(res.storageMode);
      setLastReports(res.reports);
      if (res.fetchedCount > 0) {
        setCustomScrapeUrl('');
        toast.success(`Scraped ${res.fetchedCount} dated article(s) from URL.`);
      } else {
        toast.error('Could not extract a dated article from that URL.');
      }
    } finally {
      setScraping(false);
    }
  };

  const handleSeedDefaultSources = async () => {
    const updated = await seedDefaultNewsSources(activeCity.id, activeCity.name, activeCity.slug);
    setSources(updated);
    toast.success(`Loaded default internet RSS sources for ${activeCity.name}.`);
  };

  const handleAddSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSourceName.trim() || !/^https?:\/\//i.test(newSourceUrl.trim())) {
      toast.error('Provide a source name and valid http(s) URL.');
      return;
    }
    const saved = await saveNewsSource({
      city_id: activeCity.id,
      name: newSourceName.trim(),
      url: newSourceUrl.trim(),
      source_type: newSourceType,
      language: newSourceLang,
      category_default: newSourceCat,
      is_active: true,
    });
    setSources((prev) => [...prev, saved]);
    setNewSourceName('');
    setNewSourceUrl('');
    toast.success('News source added.');
  };

  const handleToggleSource = async (src: NewsSource) => {
    const updated = await saveNewsSource({ ...src, is_active: !src.is_active });
    setSources((prev) => prev.map((s) => (s.id === src.id ? updated : s)));
  };

  const handleRemoveSource = async (id: string) => {
    await deleteNewsSource(activeCity.id, id);
    setSources((prev) => prev.filter((s) => s.id !== id));
    toast.success('Source removed.');
  };

  const openEditModal = (item?: LocalNewsItem) => {
    if (!item) {
      setForm(emptyNewsForm());
    } else {
      setForm({
        id: item.id,
        title: item.title,
        title_mr: item.title_mr || '',
        summary: item.summary || '',
        summary_mr: item.summary_mr || '',
        category: item.category,
        language: item.language,
        source_name: item.source_name,
        source_url: item.source_url || '',
        image_url: item.image_url || '',
        published_at_local: toDatetimeLocalValue(item.published_at),
        is_pinned: item.is_pinned,
        is_active: item.is_active,
      });
    }
    setModalOpen(true);
  };

  const handleSaveArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error('Headline is required.');
      return;
    }
    setSavingArticle(true);
    try {
      const publishedIso = fromDatetimeLocalValue(form.published_at_local);
      const { item: saved, storageMode: mode } = await saveNewsItem({
        id: form.id,
        city_id: activeCity.id,
        title: form.title,
        title_mr: form.title_mr || null,
        summary: form.summary || null,
        summary_mr: form.summary_mr || null,
        category: form.category,
        language: form.language,
        source_name: form.source_name || 'Town Desk',
        source_url: form.source_url || null,
        image_url: form.image_url || null,
        published_at: publishedIso,
        is_pinned: form.is_pinned,
        is_active: form.is_active,
      });
      setStorageMode(mode);
      setItems((prev) => {
        const exists = prev.some((p) => p.id === saved.id);
        const next = exists ? prev.map((p) => (p.id === saved.id ? saved : p)) : [saved, ...prev];
        return [...next].sort((a, b) => {
          if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
          return new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
        });
      });
      setModalOpen(false);
      toast.success(form.id ? 'News article updated.' : 'News article published.');
    } finally {
      setSavingArticle(false);
    }
  };

  const handleTogglePin = async (item: LocalNewsItem) => {
    const nextPinned = !item.is_pinned;
    await patchNewsFlags(activeCity.id, item.id, { is_pinned: nextPinned });
    setItems((prev) =>
      [...prev.map((i) => (i.id === item.id ? { ...i, is_pinned: nextPinned } : i))].sort((a, b) => {
        if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
        return new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
      }),
    );
  };

  const handleToggleActive = async (item: LocalNewsItem) => {
    const nextActive = !item.is_active;
    await patchNewsFlags(activeCity.id, item.id, { is_active: nextActive });
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, is_active: nextActive } : i)));
  };

  const handleDeleteArticle = async (id: string) => {
    await deleteNewsItem(activeCity.id, id);
    setItems((prev) => prev.filter((i) => i.id !== id));
    toast.success('Article deleted.');
  };

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return items.filter((item) => {
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
      if (statusFilter === 'published' && !item.is_active) return false;
      if (statusFilter === 'draft' && item.is_active) return false;
      if (statusFilter === 'pinned' && !item.is_pinned) return false;
      if (!q) return true;
      return `${item.title} ${item.title_mr || ''} ${item.source_name}`.toLowerCase().includes(q);
    });
  }, [items, categoryFilter, statusFilter, searchQuery]);

  const todayIst = getISTDateKey(new Date());
  const stats = useMemo(
    () => ({
      total: items.length,
      published: items.filter((i) => i.is_active).length,
      pinned: items.filter((i) => i.is_pinned).length,
      today: items.filter((i) => getISTDateKey(i.published_at) === todayIst).length,
    }),
    [items, todayIst],
  );

  const handleExportCsv = () => {
    if (filteredItems.length === 0) {
      toast.info('No news articles to export');
      return;
    }
    const headers = [
      'Title',
      'Title (Marathi)',
      'Summary',
      'Summary (Marathi)',
      'Category',
      'Language',
      'Source Name',
      'Source URL',
      'Image URL',
      'Published At',
      'Pinned',
      'Active',
    ];
    const csvRows = filteredItems.map((item) => [
      item.title,
      item.title_mr || '',
      item.summary || '',
      item.summary_mr || '',
      item.category,
      item.language,
      item.source_name,
      item.source_url || '',
      item.image_url || '',
      item.published_at,
      item.is_pinned ? 'Yes' : 'No',
      item.is_active ? 'Yes' : 'No',
    ]);
    downloadCsv(townCsvFilename(activeCity.slug, 'local-news'), headers, csvRows);
    toast.success(`Exported ${csvRows.length} article${csvRows.length === 1 ? '' : 's'} to CSV`);
  };

  return (
    <div className="space-y-5">
      {/* Top Toolbar: Town Selector & Quick Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label htmlFor="news-city-select" className="block text-[11px] font-medium text-muted-foreground mb-1">
              Selected Town
            </label>
            <select
              id="news-city-select"
              value={activeCity.id}
              onChange={(e) => setSelectedCityId(e.target.value)}
              className="rounded-lg border bg-background px-3 py-1.5 text-sm font-semibold"
            >
              {allCities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:pt-4 flex flex-wrap items-center gap-2">
            <Badge variant={storageMode === 'supabase' ? 'default' : 'secondary'} className="text-[11px]">
              {storageMode === 'supabase' ? 'Supabase DB Synced' : 'Local Cache Mode'}
            </Badge>
            <a
              href={`/${activeCity.slug}/news`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              View Public Feed <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            disabled={filteredItems.length === 0}
            className="gap-1.5"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowImportModal(true)}
            className="gap-1.5"
          >
            <Upload className="w-4 h-4" />
            Import CSV
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowSourcesPanel((v) => !v)}
            className="gap-1.5"
          >
            <Rss className="w-4 h-4" />
            Sources ({sources.filter((s) => s.is_active).length})
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void handleScrapeAll()}
            disabled={scraping}
            className="gap-1.5"
          >
            {scraping ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Scrape Internet Sources
          </Button>
          <Button type="button" size="sm" onClick={() => openEditModal()} className="gap-1.5">
            <Plus className="w-4 h-4" />
            Publish Article
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total Articles" value={stats.total} />
        <StatCard label="Published Live" value={stats.published} />
        <StatCard label="Today (IST)" value={stats.today} />
        <StatCard label="Pinned" value={stats.pinned} />
      </div>

      {/* Quick URL Scraper */}
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-bold">Scrape Any News URL / Portal</h2>
          </div>
          <span className="text-[11px] text-muted-foreground">
            Extracts headline, summary, source & verified publication date
          </span>
        </div>

        <form onSubmit={(e) => void handleScrapeCustomUrl(e)} className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Link2 className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="url"
              value={customScrapeUrl}
              onChange={(e) => setCustomScrapeUrl(e.target.value)}
              placeholder="Paste news article URL or RSS feed (https://...)"
              className="w-full rounded-lg border bg-background pl-9 pr-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
          </div>
          <Button type="submit" disabled={scraping} size="sm" className="gap-1.5 shrink-0">
            <Sparkles className="w-4 h-4" />
            Scrape URL & Publish
          </Button>
        </form>

        {lastReports.length > 0 && (
          <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
            <div className="text-xs font-semibold text-foreground">Latest Scrape Report</div>
            <div className="grid gap-1">
              {lastReports.map((r) => (
                <div key={r.url} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-medium truncate">{r.sourceName}</span>
                  {r.error ? (
                    <span className="text-destructive">{r.error}</span>
                  ) : (
                    <span className="text-emerald-600">
                      {r.fetched} dated articles fetched
                      {r.skippedInvalidDate > 0 ? ` (${r.skippedInvalidDate} undated skipped)` : ''}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Collapsible Internet Sources Manager */}
      {showSourcesPanel && (
        <div className="rounded-xl border bg-card p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold">Configured Internet Sources ({activeCity.name})</h3>
              <p className="text-xs text-muted-foreground">
                RSS feeds and local news portals scraped for {activeCity.name}.
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => void handleSeedDefaultSources()}>
              Load Default Town Feeds
            </Button>
          </div>

          <div className="divide-y rounded-lg border">
            {sources.length === 0 ? (
              <div className="p-4 text-xs text-muted-foreground text-center">
                No sources configured yet. Click "Load Default Town Feeds" or add one below.
              </div>
            ) : (
              sources.map((src) => (
                <div key={src.id} className="p-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold truncate">{src.name}</span>
                      <Badge variant="outline" className="text-[10px] uppercase">
                        {src.source_type}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px] uppercase">
                        {src.language}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">{src.url}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant={src.is_active ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => void handleToggleSource(src)}
                      className="h-7 text-xs"
                    >
                      {src.is_active ? 'Active' : 'Paused'}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => void handleRemoveSource(src.id)}
                      aria-label={`Delete ${src.name}`}
                      className="h-7 w-7 text-destructive"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          <form onSubmit={(e) => void handleAddSource(e)} className="grid grid-cols-1 sm:grid-cols-6 gap-2 pt-2 border-t">
            <input
              type="text"
              value={newSourceName}
              onChange={(e) => setNewSourceName(e.target.value)}
              placeholder="Source name (e.g. Lokmat Jalgaon)"
              className="sm:col-span-2 rounded-lg border bg-background px-3 py-1.5 text-xs"
            />
            <input
              type="url"
              value={newSourceUrl}
              onChange={(e) => setNewSourceUrl(e.target.value)}
              placeholder="https://.../rss"
              className="sm:col-span-2 rounded-lg border bg-background px-3 py-1.5 text-xs"
            />
            <select
              value={newSourceType}
              onChange={(e) => setNewSourceType(e.target.value as NewsSourceType)}
              className="rounded-lg border bg-background px-2 py-1.5 text-xs"
            >
              <option value="rss">RSS / Atom</option>
              <option value="webpage">Webpage</option>
            </select>
            <Button type="submit" size="sm" className="gap-1">
              <Plus className="w-3.5 h-3.5" /> Add
            </Button>
            <div className="sm:col-span-6 flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-muted-foreground">
              <span>Language:</span>
              <select
                value={newSourceLang}
                onChange={(e) => setNewSourceLang(e.target.value as NewsLanguage)}
                className="rounded border bg-background px-2 py-1 text-xs text-foreground"
              >
                <option value="mr">Marathi</option>
                <option value="en">English</option>
                <option value="hi">Hindi</option>
              </select>
              <span>Default Category:</span>
              <select
                value={newSourceCat}
                onChange={(e) => setNewSourceCat(e.target.value as NewsCategory)}
                className="rounded border bg-background px-2 py-1 text-xs text-foreground"
              >
                {NEWS_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.labelEn}
                  </option>
                ))}
              </select>
            </div>
          </form>
        </div>
      )}

      {/* Search & Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter articles by headline or source..."
            className="w-full rounded-lg border bg-background pl-9 pr-3 py-2 text-sm"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as 'all' | NewsCategory)}
          className="rounded-lg border bg-background px-3 py-2 text-sm"
        >
          <option value="all">All Categories</option>
          {NEWS_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.labelEn}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'all' | 'published' | 'draft' | 'pinned')}
          className="rounded-lg border bg-background px-3 py-2 text-sm"
        >
          <option value="all">All Status</option>
          <option value="published">Published</option>
          <option value="draft">Hidden / Draft</option>
          <option value="pinned">Pinned Only</option>
        </select>
      </div>

      {/* Articles List */}
      {loading ? (
        <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">
          Loading local news for {activeCity.name}...
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card p-10 text-center space-y-3">
          <Newspaper className="w-10 h-10 text-muted-foreground mx-auto" />
          <p className="text-sm font-medium text-foreground">
            No news articles in {activeCity.name} yet.
          </p>
          <p className="text-xs text-muted-foreground">
            Click "Scrape Internet Sources" to pull dated town news from online feeds, or publish one manually.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className={`rounded-xl border bg-card p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                !item.is_active ? 'opacity-65' : ''
              }`}
            >
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="secondary" className="text-[10px]">
                    {item.category}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {item.source_name}
                  </Badge>
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Calendar className="w-3 h-3 text-primary" />
                    {formatNewsDateIST(item.published_at, 'en')}
                  </span>
                  {item.is_pinned && (
                    <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/30 text-[10px]">
                      Pinned
                    </Badge>
                  )}
                  {!item.is_active && (
                    <Badge variant="destructive" className="text-[10px]">
                      Hidden
                    </Badge>
                  )}
                </div>
                <p className="font-semibold text-sm text-foreground leading-snug">{item.title}</p>
                {item.title_mr && item.title_mr !== item.title && (
                  <p className="text-xs text-muted-foreground">{item.title_mr}</p>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  type="button"
                  variant={item.is_pinned ? 'secondary' : 'ghost'}
                  size="icon"
                  onClick={() => void handleTogglePin(item)}
                  aria-label={item.is_pinned ? 'Unpin article' : 'Pin article'}
                  className="h-8 w-8"
                >
                  <Pin className="w-3.5 h-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => void handleToggleActive(item)}
                  aria-label={item.is_active ? 'Hide article' : 'Publish article'}
                  className="h-8 w-8"
                >
                  {item.is_active ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => openEditModal(item)}
                  aria-label="Edit article"
                  className="h-8 w-8"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <ConfirmTapButton
                  onConfirm={() => void handleDeleteArticle(item.id)}
                  confirmLabel="Delete?"
                  className="h-8 px-2 text-xs text-destructive hover:bg-destructive/10 rounded-md"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </ConfirmTapButton>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit News Article Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Edit News Article' : 'Publish Local News'}</DialogTitle>
            <DialogDescription>
              Set accurate publication date/time (IST), category, and optional Marathi translation.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={(e) => void handleSaveArticle(e)} className="space-y-3">
            <div>
              <label className="block text-xs font-medium mb-1">Headline *</label>
              <input
                type="text"
                required
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                placeholder="Enter news headline..."
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">Marathi Headline (optional)</label>
              <input
                type="text"
                value={form.title_mr}
                onChange={(e) => setForm((f) => ({ ...f, title_mr: e.target.value }))}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                placeholder="मराठी बातमीचे शीर्षक..."
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">Summary</label>
              <textarea
                rows={3}
                value={form.summary}
                onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                placeholder="Brief details..."
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">Published Date & Time (IST) *</label>
                <input
                  type="datetime-local"
                  required
                  value={form.published_at_local}
                  onChange={(e) => setForm((f) => ({ ...f, published_at_local: e.target.value }))}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Category</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as NewsCategory }))}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                >
                  {NEWS_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.labelEn}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">Source Name</label>
                <input
                  type="text"
                  value={form.source_name}
                  onChange={(e) => setForm((f) => ({ ...f, source_name: e.target.value }))}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Source URL</label>
                <input
                  type="url"
                  value={form.source_url}
                  onChange={(e) => setForm((f) => ({ ...f, source_url: e.target.value }))}
                  placeholder="https://..."
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="flex items-center gap-5 pt-1">
              <label className="inline-flex items-center gap-2 text-xs font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_pinned}
                  onChange={(e) => setForm((f) => ({ ...f, is_pinned: e.target.checked }))}
                />
                Pin to Top
              </label>
              <label className="inline-flex items-center gap-2 text-xs font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                />
                Published (Visible to Public)
              </label>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={savingArticle}>
                {savingArticle ? 'Saving...' : form.id ? 'Save Changes' : 'Publish'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {showImportModal && (
        <NewsCsvImportModal
          cityId={activeCity.id}
          cityName={activeCity.name}
          existingItems={items}
          onClose={() => setShowImportModal(false)}
          onDone={() => {
            setShowImportModal(false);
            void loadData();
          }}
        />
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-card p-3.5">
      <div className="text-[11px] text-muted-foreground font-medium">{label}</div>
      <div className="text-xl font-bold text-foreground mt-0.5">{value}</div>
    </div>
  );
}
