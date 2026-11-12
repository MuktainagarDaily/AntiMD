import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Bookmark, Search, X, ChevronDown, CheckSquare, Square, Trash2, Loader2, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ShopCard } from '@/components/ShopCard';
import { BannerSlot } from '@/components/banners/BannerSlot';
import { DesktopNav } from '@/components/DesktopNav';
import { UserMenuDrawer } from '@/components/UserMenuDrawer';
import { PageSeo } from '@/components/seo/PageSeo';
import { isShopOpen } from '@/lib/shopUtils';
import { toast } from 'sonner';
import { useCity } from '@/hooks/useCity';
import { useT } from '@/i18n';
import { getGuestBookmarks, removeGuestBookmark } from '@/lib/guestBookmarks';

type SortKey = 'recent' | 'name' | 'open';

export default function SavedShops() {
  const { t, locale } = useT();
  const { currentCity, townBrand } = useCity();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('recent');
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [removing, setRemoving] = useState(false);

  const { data: shops, isLoading } = useQuery({
    queryKey: ['saved-shops', user ? user.id : 'guest'],
    queryFn: async () => {
      let ids: string[] = [];
      if (user) {
        const { data: bookmarks, error } = await supabase
          .from('shop_bookmarks' as any)
          .select('shop_id, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        if (error) throw error;
        ids = (bookmarks ?? []).map((b: any) => b.shop_id);
      } else {
        ids = getGuestBookmarks();
      }

      if (ids.length === 0) return [];
      const { data: shopRows, error: e2 } = await supabase
        .from('shops')
        .select('*, shop_categories(categories(name, icon, is_active)), mess_profiles(shop_id), pg_profiles(shop_id)')
        .in('id', ids)
        .eq('is_active', true);
      if (e2) throw e2;
      const order = new Map(ids.map((id, i) => [id, i]));
      return (shopRows ?? []).slice().sort((a: any, b: any) => (order.get(a.id)! - order.get(b.id)!));
    },
  });

  const filtered = useMemo(() => {
    if (!shops) return [];
    const q = query.trim().toLowerCase();
    let out = shops as any[];
    if (q) {
      out = out.filter((s) =>
        [s.name, s.area, s.sub_area, s.address]
          .filter(Boolean)
          .some((v: string) => v.toLowerCase().includes(q))
      );
    }
    if (sort === 'name') {
      out = [...out].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    } else if (sort === 'open') {
      out = [...out].sort((a, b) => Number(isShopOpen(b)) - Number(isShopOpen(a)));
    }
    return out;
  }, [shops, query, sort]);

  const exitSelect = () => { setSelectMode(false); setSelected(new Set()); };
  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const allShownSelected = filtered.length > 0 && filtered.every((s) => selected.has(s.id));
  const toggleAll = () => {
    if (allShownSelected) setSelected(new Set());
    else setSelected(new Set(filtered.map((s) => s.id)));
  };

  async function removeSelected() {
    if (selected.size === 0) return;
    setRemoving(true);
    const ids = Array.from(selected);

    if (user) {
      // Snapshot the rows we are about to delete so the Undo action can
      // re-insert them with their original created_at preserved (so the
      // "recently saved" order doesn't get reshuffled by an undo).
      const { data: snapshot } = await supabase
        .from('shop_bookmarks' as any)
        .select('shop_id, created_at')
        .eq('user_id', user.id)
        .in('shop_id', ids);
      const { error } = await supabase
        .from('shop_bookmarks' as any)
        .delete()
        .eq('user_id', user.id)
        .in('shop_id', ids);
      setRemoving(false);
      if (error) { toast.error(error.message); return; }
      toast.success(t('saved.removed', { count: ids.length }), {
        action: {
          label: t('common.undo'),
          onClick: async () => {
            const rows = (snapshot ?? []).length > 0
              ? snapshot!.map((r: any) => ({ user_id: user.id, shop_id: r.shop_id, created_at: r.created_at }))
              : ids.map((shop_id) => ({ user_id: user.id, shop_id }));
            const { error: undoErr } = await supabase
              .from('shop_bookmarks' as any)
              .insert(rows as any);
            if (undoErr) { toast.error(undoErr.message); return; }
            toast.success(t('saved.undoRestored', { count: ids.length }));
            qc.invalidateQueries({ queryKey: ['saved-shops', user.id] });
          },
        },
        duration: 7000,
      });
      qc.invalidateQueries({ queryKey: ['saved-shops', user.id] });
    } else {
      ids.forEach((id) => removeGuestBookmark(id));
      setRemoving(false);
      toast.success(t('saved.removed', { count: ids.length }));
      qc.invalidateQueries({ queryKey: ['saved-shops', 'guest'] });
    }
    exitSelect();
  }

  return (
    <div className="min-h-screen bg-background">
      <PageSeo title={`${t('saved.title')} — ${townBrand}`} path="/saved-shops" noindex />

      <header className="bg-primary text-primary-foreground px-3 sm:px-4 md:px-6 py-3 sticky top-0 z-40 shadow-md">
        <div className="max-w-2xl md:max-w-4xl lg:max-w-6xl xl:max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 lg:flex-initial">
            <button
              onClick={() => (selectMode ? exitSelect() : navigate(`/${currentCity.slug}`))}
              className="inline-flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 hover:bg-primary-foreground/10 rounded-lg transition-colors shrink-0"
              aria-label={selectMode ? t('saved.cancelSelection') : t('common.back')}
            >
              {selectMode ? <X className="w-5 h-5 sm:w-6 sm:h-6" /> : <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6" />}
            </button>
            <h1 className="font-bold text-base sm:text-lg leading-tight truncate flex items-center gap-2">
              <Bookmark className="w-5 h-5 shrink-0" />
              <span className="truncate">{selectMode ? t('saved.selected', { count: selected.size }) : t('saved.title')}</span>
            </h1>
          </div>

          <DesktopNav variant="primary" />

          <div className="flex items-center gap-2 shrink-0">
            {!selectMode && shops && shops.length > 0 && (
              <button
                onClick={() => setSelectMode(true)}
                className="text-xs font-bold px-2.5 py-1.5 rounded-lg bg-primary-foreground/10 hover:bg-primary-foreground/15 shrink-0"
              >
                {t('saved.select')}
              </button>
            )}
            {!selectMode && <UserMenuDrawer />}
          </div>
        </div>
      </header>

      {/* Search + sort toolbar */}
      {!isLoading && shops && shops.length > 0 && (
        <div className="sticky top-[56px] sm:top-[60px] z-[5] bg-background/95 backdrop-blur border-b border-border">
          <div className="max-w-2xl md:max-w-4xl lg:max-w-6xl xl:max-w-7xl mx-auto px-4 md:px-6 py-2.5 flex items-center gap-2.5">
            <div className="relative flex-1 min-w-0 md:max-w-md">
              <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('saved.search.placeholder')}
                className="w-full pl-8 pr-8 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted"
                  aria-label={t('shops.clearSearch')}
                >
                  <X className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              )}
            </div>
            <div className="relative shrink-0">
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="appearance-none max-w-[130px] sm:max-w-none pl-2.5 sm:pl-3 pr-6 sm:pr-7 py-2 rounded-lg border border-input bg-background text-xs sm:text-sm font-semibold truncate focus:outline-none focus:ring-2 focus:ring-ring"
                aria-label={t('saved.searchAria')}
              >
                <option value="recent">{t('saved.sort.recent')}</option>
                <option value="name">{t('saved.sort.name')}</option>
                <option value="open">{t('saved.sort.open')}</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
            </div>
            {!selectMode && (
              <span className="hidden md:inline-block ml-auto text-xs font-medium text-muted-foreground">
                {t('saved.shown', { count: filtered.length })}
              </span>
            )}
          </div>
          {selectMode && (
            <div className="max-w-2xl md:max-w-4xl lg:max-w-6xl xl:max-w-7xl mx-auto px-4 md:px-6 pb-2 flex items-center justify-between text-xs">
              <button
                onClick={toggleAll}
                className="inline-flex items-center gap-1.5 font-semibold text-foreground hover:text-primary"
              >
                {allShownSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                {allShownSelected ? t('saved.unselectAll') : t('saved.selectAllShown')}
              </button>
              <span className="text-muted-foreground">{t('saved.shown', { count: filtered.length })}</span>
            </div>
          )}
        </div>
      )}

      <main className="max-w-2xl md:max-w-4xl lg:max-w-6xl xl:max-w-7xl mx-auto px-4 md:px-6 py-4 md:py-6 pb-32 space-y-4">
        {!user && (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 sm:px-5 sm:py-4 flex items-center justify-between gap-3 shadow-2xs">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-primary font-bold text-xs sm:text-sm">
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span>{locale === 'mr' ? 'या डिव्हाइसवर सेव्ह केलेले व्यवसाय' : 'Saved on this device'}</span>
              </div>
              <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 leading-snug">
                {locale === 'mr'
                  ? 'सर्व डिव्हाइसवर सिंक करण्यासाठी व कधीही न गमावण्यासाठी साइन इन करा.'
                  : 'Sign in to sync your bookmarks across all your devices.'}
              </p>
            </div>
            <button
              onClick={() => navigate('/auth?next=/saved-shops')}
              className="shrink-0 text-xs sm:text-sm font-bold px-3.5 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-xs"
            >
              {locale === 'mr' ? 'साइन इन' : 'Sign in'}
            </button>
          </div>
        )}

        {isLoading || loading ? (
          <p className="text-sm text-muted-foreground text-center py-8">{t('common.loading')}</p>
        ) : !shops || shops.length === 0 ? (
          <div className="text-center py-12 md:py-16 max-w-md mx-auto">
            <Bookmark className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="font-semibold text-foreground">{t('saved.empty.title')}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {t('saved.empty.hint')}
            </p>
            <button
              onClick={() => navigate(`/${currentCity.slug}/shops`)}
              className="mt-5 inline-flex items-center justify-center px-5 py-2.5 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              {t('saved.browseShops')}
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">
            {t('saved.empty.search', { query })}
          </p>
        ) : (
          <>
            {filtered.length >= 3 && (
              <BannerSlot placement="saved_inline" fallback="homepage_inline" className="mb-1" />
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
              {filtered.map((s: any) => (
                <div key={s.id} className="relative h-full">
                  {selectMode && (
                    <button
                      onClick={() => toggleOne(s.id)}
                      className="absolute top-2 left-2 z-10 bg-card/95 backdrop-blur rounded-full p-1 shadow-md border border-border"
                      aria-label={selected.has(s.id) ? t('saved.unselect') : t('saved.select')}
                    >
                      {selected.has(s.id) ? (
                        <CheckSquare className="w-5 h-5 text-primary" />
                      ) : (
                        <Square className="w-5 h-5 text-muted-foreground" />
                      )}
                    </button>
                  )}
                  <div
                    className={selectMode ? 'pointer-events-none opacity-95 h-full' : 'h-full'}
                    onClickCapture={selectMode ? (e) => { e.preventDefault(); e.stopPropagation(); toggleOne(s.id); } : undefined}
                    style={selectMode ? { pointerEvents: 'auto' } : undefined}
                  >
                    <ShopCard shop={s} />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>

      {/* Bulk action bar */}
      {selectMode && selected.size > 0 && (
        <div
          className="fixed bottom-0 inset-x-0 z-20 border-t border-border bg-card/95 backdrop-blur shadow-[0_-4px_12px_-4px_hsl(var(--foreground)/0.15)]"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          <div className="max-w-2xl md:max-w-4xl lg:max-w-6xl xl:max-w-7xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between gap-3">
            <span className="hidden sm:inline text-sm font-semibold text-muted-foreground">
              {t('saved.selected', { count: selected.size })}
            </span>
            <div className="flex flex-1 sm:flex-initial items-center gap-2 sm:min-w-[300px]">
              <button
                onClick={exitSelect}
                className="flex-1 py-2.5 px-4 rounded-xl border border-border text-sm font-semibold hover:bg-muted"
              >
                {t('saved.cancel')}
              </button>
              <button
                onClick={removeSelected}
                disabled={removing}
                className="flex-1 py-2.5 px-4 rounded-xl bg-destructive text-destructive-foreground text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {removing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {t('saved.removeCount', { count: selected.size })}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
