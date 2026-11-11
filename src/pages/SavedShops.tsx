import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Bookmark, Search, X, ChevronDown, CheckSquare, Square, Trash2, Loader2, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ShopCard } from '@/components/ShopCard';
import { BannerSlot } from '@/components/banners/BannerSlot';
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
        .select('*, shop_categories(categories(name, icon, is_active))')
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
      <PageSeo title={`Saved Shops — ${townBrand}`} path="/saved-shops" noindex />

      <header className="bg-primary text-primary-foreground px-4 py-3 sticky top-0 z-40 shadow-md">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <button
            onClick={() => (selectMode ? exitSelect() : navigate(`/${currentCity.slug}`))}
            className="p-1 hover:bg-primary-foreground/10 rounded-lg transition-colors shrink-0"
            aria-label={selectMode ? t('saved.cancelSelection') : t('common.back')}
          >
            {selectMode ? <X className="w-6 h-6" /> : <ArrowLeft className="w-6 h-6" />}
          </button>
          <h1 className="font-bold text-lg leading-tight truncate flex-1 flex items-center gap-2">
            <Bookmark className="w-5 h-5" />
            {selectMode ? t('saved.selected', { count: selected.size }) : t('saved.title')}
          </h1>
          {!selectMode && shops && shops.length > 0 && (
            <button
              onClick={() => setSelectMode(true)}
              className="text-xs font-bold px-2.5 py-1.5 rounded-lg bg-primary-foreground/10 hover:bg-primary-foreground/15"
            >
              {t('saved.select')}
            </button>
          )}
          {!selectMode && <UserMenuDrawer />}
        </div>
      </header>

      {/* Search + sort toolbar */}
      {!isLoading && shops && shops.length > 0 && (
        <div className="sticky top-[56px] z-[5] bg-background/95 backdrop-blur border-b border-border">
          <div className="max-w-lg mx-auto px-4 py-2.5 flex items-center gap-2">
            <div className="relative flex-1">
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
            <div className="relative">
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="appearance-none pl-3 pr-7 py-2 rounded-lg border border-input bg-background text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-ring"
                aria-label={t('saved.searchAria')}
              >
                <option value="recent">{t('saved.sort.recent')}</option>
                <option value="name">{t('saved.sort.name')}</option>
                <option value="open">{t('saved.sort.open')}</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
            </div>
          </div>
          {selectMode && (
            <div className="max-w-lg mx-auto px-4 pb-2 flex items-center justify-between text-xs">
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

      <main className="max-w-lg mx-auto px-4 py-4 pb-32 space-y-3">
        {!user && (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 flex items-center justify-between gap-3 shadow-2xs">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-primary font-bold text-xs">
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span>{locale === 'mr' ? 'या डिव्हाइसवर सेव्ह केलेली दुकाने' : 'Saved on this device'}</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                {locale === 'mr'
                  ? 'सर्व डिव्हाइसवर सिंक करण्यासाठी व कधीही न गमावण्यासाठी साइन इन करा.'
                  : 'Sign in to sync your bookmarks across all your devices.'}
              </p>
            </div>
            <button
              onClick={() => navigate('/auth?next=/saved-shops')}
              className="shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-xs"
            >
              {locale === 'mr' ? 'साइन इन' : 'Sign in'}
            </button>
          </div>
        )}

        {isLoading || loading ? (
          <p className="text-sm text-muted-foreground text-center py-8">{t('common.loading')}</p>
        ) : !shops || shops.length === 0 ? (
          <div className="text-center py-12">
            <Bookmark className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="font-semibold text-foreground">{t('saved.empty.title')}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {t('saved.empty.hint')}
            </p>
            <button
              onClick={() => navigate('/shops')}
              className="mt-5 inline-flex items-center justify-center px-5 py-2.5 rounded-xl text-sm font-semibold bg-primary text-primary-foreground"
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
            {filtered.map((s: any) => (
            <div key={s.id} className="relative">
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
                className={selectMode ? 'pointer-events-none opacity-95' : ''}
                onClickCapture={selectMode ? (e) => { e.preventDefault(); e.stopPropagation(); toggleOne(s.id); } : undefined}
                style={selectMode ? { pointerEvents: 'auto' } : undefined}
              >
                <ShopCard shop={s} />
              </div>
            </div>
            ))}
          </>
        )}
      </main>

      {/* Bulk action bar */}
      {selectMode && selected.size > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-20 border-t border-border bg-card/95 backdrop-blur shadow-[0_-4px_12px_-4px_hsl(var(--foreground)/0.15)]">
          <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-2">
            <button
              onClick={exitSelect}
              className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold hover:bg-muted"
            >
              {t('saved.cancel')}
            </button>
            <button
              onClick={removeSelected}
              disabled={removing}
              className="flex-1 py-2.5 rounded-xl bg-destructive text-destructive-foreground text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {removing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              {t('saved.removeCount', { count: selected.size })}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
