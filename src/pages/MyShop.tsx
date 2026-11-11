import { useEffect, useState, useMemo, useRef } from 'react';
import { PageSeo } from '@/components/seo/PageSeo';

import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Store, ArrowLeft, Loader2, Phone, MessageCircle, Save, ChevronDown, ShieldCheck, Power, Inbox, PlusCircle, Clock, CheckCircle2, XCircle, CloudOff, RefreshCw, CheckCircle, CloudUpload, Eye, ImageIcon, Trash2, Link2, ExternalLink, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { TimePickerField } from '@/components/shared/TimePickerField';
import { ClaimedBadge } from '@/components/shared/ClaimedBadge';
import { ImageCropPicker } from '@/components/shared/ImageCropPicker';
import { ShopImage } from '@/components/shared/ShopImage';
import { ShopPreviewSheet } from '@/components/myshop/ShopPreviewSheet';
import { compressImage } from '@/lib/imageUtils';
import { uploadShopImage, removeShopImageQuiet } from '@/lib/storageNaming';
import { extractStoragePath } from '@/components/admin/adminHelpers';
import { isValidIndianPhone } from '@/lib/utils';
import { updateShopWithConcurrency, pickOwnerEditable } from '@/lib/shopConcurrency';
import { useRealtimeChannel } from '@/hooks/useRealtime';
import { AmenitiesPicker, parseAmenities } from '@/components/shared/AmenitiesPicker';
import { LocationMapPicker, MUKTAINAGAR_CENTER } from '@/components/shared/LocationMapPicker';
import { useCity } from '@/hooks/useCity';
import { useT } from '@/i18n';
import { MessMenuManager } from '@/components/myshop/MessMenuManager';
import { PGVacancyManager } from '@/components/myshop/PGVacancyManager';
import { MessOwnerHub } from '@/components/myshop/MessOwnerHub';
import { PGOwnerHub } from '@/components/myshop/PGOwnerHub';

const inputCls =
  'w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm transition-shadow';

export default function MyShop() {
  const { user, isShopkeeper, isAdmin, loading } = useAuth();
  const { currentCity, townBrand } = useCity();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const { t } = useT();

  // Load shops the user owns
  const { data: ownedShops, isLoading } = useQuery({
    queryKey: ['my-shops', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shop_owners')
        .select('shop_id, shops(*, shop_categories(category_id), mess_profiles(*), pg_profiles(*))')
        .eq('user_id', user!.id);
      if (error) throw error;
      return (data || []).map((r: any) => r.shops).filter(Boolean);
    },
  });

  // Load this user's submitted listing requests (any status)
  const { data: myRequests = [], isLoading: reqLoading } = useQuery({
    queryKey: ['my-requests', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shop_requests')
        .select('id, name, area, status, created_at, admin_notes')
        .eq('submitter_user_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const selectedId = params.get('id') || ownedShops?.[0]?.id || null;
  const shop = useMemo(() => ownedShops?.find((s: any) => s.id === selectedId), [ownedShops, selectedId]);

  const isMessShop = useMemo(() => {
    if (!shop) return false;
    if (shop.mess_profiles) {
      if (Array.isArray(shop.mess_profiles) && shop.mess_profiles.length > 0) return true;
      if (!Array.isArray(shop.mess_profiles)) return true;
    }
    const n = (shop.name || '').toLowerCase();
    const nm = (shop.name_mr || '').toLowerCase();
    return (
      n.includes('mess') ||
      n.includes('bhojanalay') ||
      n.includes('bhojnalay') ||
      nm.includes('मेस') ||
      nm.includes('भोजनालय')
    );
  }, [shop]);

  const isPGShop = useMemo(() => {
    if (!shop) return false;
    if (shop.pg_profiles) {
      if (Array.isArray(shop.pg_profiles) && shop.pg_profiles.length > 0) return true;
      if (!Array.isArray(shop.pg_profiles)) return true;
    }
    const n = (shop.name || '').toLowerCase();
    const nm = (shop.name_mr || '').toLowerCase();
    return (
      n.includes('pg') ||
      n.includes('hostel') ||
      nm.includes('हॉस्टेल') ||
      nm.includes('वसतिगृह') ||
      nm.includes('पीजी')
    );
  }, [shop]);

  // MPULSE Phase 2 #10 — collapse all three postgres_changes subscriptions
  // (shops UPDATE, shop_requests INSERT/UPDATE, shop_owners INSERT/DELETE)
  // onto ONE multiplexed channel per user. Cuts realtime socket cost 3× on
  // this page and removes the ordering ambiguity of three separate channel
  // lifecycles fighting during route changes.
  //
  // Sentinel note: shop_owners still requires REPLICA IDENTITY FULL for the
  // ownership-revoke toast filter to see `user_id`. Payload shape is unchanged.
  useRealtimeChannel(
    `my-shop-multiplex-${user?.id}-${selectedId ?? 'none'}`,
    user?.id
      ? [
          {
            table: 'shops',
            event: 'UPDATE',
            filter: selectedId ? `id=eq.${selectedId}` : undefined,
            onChange: (payload) => {
              const fresh = (payload as any).new;
              if (!fresh || !user?.id) return;
              qc.setQueryData(['my-shops', user.id], (old: any[] | undefined) =>
                old ? old.map((s) => (s.id === fresh.id ? { ...s, ...fresh } : s)) : old
              );
            },
          },
          {
            table: 'shop_requests',
            filter: `submitter_user_id=eq.${user.id}`,
            onChange: () => {
              qc.invalidateQueries({ queryKey: ['my-requests', user.id] });
            },
          },
          {
            table: 'shop_owners',
            event: 'DELETE',
            filter: `user_id=eq.${user.id}`,
            onChange: () => {
              toast.warning('Your ownership for a shop was revoked by an admin.', {
                description: 'Contact support if you believe this was a mistake.',
                duration: 8000,
              });
              qc.invalidateQueries({ queryKey: ['my-shops', user.id] });
            },
          },
          {
            table: 'shop_owners',
            event: 'INSERT',
            filter: `user_id=eq.${user.id}`,
            onChange: () => {
              toast.success('A shop was assigned to you.', { duration: 6000 });
              qc.invalidateQueries({ queryKey: ['my-shops', user.id] });
            },
          },
        ]
      : [],
    { enabled: !!user?.id },
    [user?.id, selectedId],
  );



  if (loading) return <Centered>{t('common.loading')}</Centered>;
  if (!user) return <RedirectToAuth />;
  const hasOwnership = isShopkeeper || isAdmin;
  const hasRequests  = myRequests.length > 0;
  if (!hasOwnership && !hasRequests && !reqLoading) {
    return (
      <Centered>
        <Store className="w-10 h-10 text-muted-foreground/50 mb-3" />
        <p className="font-semibold text-foreground">{t('myShop.noOwnership.title')}</p>
        <p className="text-sm text-muted-foreground mt-1 text-center max-w-xs">
          {t('myShop.noOwnership.desc')}
        </p>
        <div className="mt-4 flex gap-2">
          <button onClick={() => navigate('/shops')} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold">{t('myShop.browseShops')}</button>
          <button onClick={() => navigate('/?list-shop=1')} className="px-4 py-2 rounded-xl border border-border text-sm font-semibold hover:bg-muted">{t('myShop.listShop')}</button>
        </div>
      </Centered>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/40 via-background to-background pb-24">
      <PageSeo title={`My Shop — ${townBrand}`} path="/my-shop" noindex />

      <header className="bg-gradient-to-r from-primary via-primary to-primary/90 text-primary-foreground px-4 py-3 flex items-center gap-2 shadow-md sticky top-0 z-40">
        <button onClick={() => navigate(`/${currentCity.slug}`)} className="p-1 hover:bg-primary-foreground/10 rounded-lg transition-colors" aria-label={t('myShop.back')}>
          <ArrowLeft className="w-5 h-5" />
        </button>
        <Store className="w-5 h-5 shrink-0" />
        <span className="font-bold text-base sm:text-lg truncate">{t('myShop.title')}</span>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-4">
        {isLoading && hasOwnership ? (
          <div className="text-center py-12"><Loader2 className="w-5 h-5 animate-spin inline" /></div>
        ) : !ownedShops?.length && !hasRequests ? (
          <div className="bg-card rounded-2xl border border-border p-8 text-center">
            <Store className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
            <p className="font-semibold text-foreground">{t('myShop.noShops.title')}</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
              {t('myShop.noShops.desc')}
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <button onClick={() => navigate('/shops')} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold">{t('myShop.browseShops')}</button>
              <button onClick={() => navigate('/?list-shop=1')} className="px-4 py-2 rounded-xl border border-border text-sm font-semibold hover:bg-muted">{t('myShop.listShop')}</button>
            </div>
          </div>
        ) : (
          <>
            {(ownedShops?.length ?? 0) > 1 && (
              <div className="mb-4 bg-card rounded-xl border border-border p-3">
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{t('myShop.activeShop')}</label>
                <div className="relative mt-1">
                  <select
                    value={selectedId || ''}
                    onChange={(e) => setParams({ id: e.target.value })}
                    className="w-full appearance-none px-3 py-2.5 pr-9 rounded-lg border border-input bg-background text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {ownedShops!.map((s: any) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
                </div>
              </div>
            )}
            {shop && (
              <>
                {isMessShop ? (
                  <>
                    <MessOwnerHub
                      shop={shop}
                      onSaved={() => qc.invalidateQueries({ queryKey: ['my-shops', user?.id] })}
                    />
                    <div className="mt-4">
                      <EngagementCard shopId={shop.id} />
                    </div>
                  </>
                ) : isPGShop ? (
                  <>
                    <PGOwnerHub
                      shop={shop}
                      onSaved={() => qc.invalidateQueries({ queryKey: ['my-shops', user?.id] })}
                    />
                    <div className="mt-4">
                      <EngagementCard shopId={shop.id} />
                    </div>
                  </>
                ) : (
                  <>
                    <LivingSpecialManagers shop={shop} />
                    <ShopEditor key={shop.id} shop={shop} onSaved={() => qc.invalidateQueries({ queryKey: ['my-shops', user.id] })} />
                    <EngagementCard shopId={shop.id} />
                  </>
                )}
              </>
            )}
          </>
        )}

        {/* My Requests — always visible if user has submitted any */}
        <MyRequestsCard requests={myRequests} loading={reqLoading} onListNew={() => navigate('/?list-shop=1')} />
      </div>
    </div>
  );
}

/* ─── Living Special Managers (Mess Menu & PG Vacancy) ────────── */
function LivingSpecialManagers({ shop }: { shop: any }) {
  const [activeTab, setActiveTab] = useState<'none' | 'mess' | 'pg'>(() => {
    const n = (shop.name || '').toLowerCase();
    const nm = (shop.name_mr || '').toLowerCase();
    if (n.includes('mess') || nm.includes('मेस') || nm.includes('भोजनालय')) return 'mess';
    if (n.includes('pg') || n.includes('hostel') || nm.includes('वसतिगृह') || nm.includes('हॉस्टेल')) return 'pg';
    return 'none';
  });

  return (
    <div className="mb-4 space-y-3">
      <div className="flex items-center gap-2 p-2 rounded-xl bg-card border border-border">
        <span className="text-[11px] font-bold text-muted-foreground uppercase px-1">
          Special Features:
        </span>
        <button
          type="button"
          onClick={() => setActiveTab(activeTab === 'mess' ? 'none' : 'mess')}
          className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
            activeTab === 'mess'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-muted text-muted-foreground hover:text-foreground'
          }`}
        >
          <span>🍲</span>
          <span>Today's Menu</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab(activeTab === 'pg' ? 'none' : 'pg')}
          className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
            activeTab === 'pg'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-muted text-muted-foreground hover:text-foreground'
          }`}
        >
          <span>🛏️</span>
          <span>PG Vacancies</span>
        </button>
      </div>

      {activeTab === 'mess' && <MessMenuManager shopId={shop.id} shopName={shop.name} />}
      {activeTab === 'pg' && <PGVacancyManager shopId={shop.id} shopName={shop.name} />}
    </div>
  );
}

/* ─── My Requests card ─────────────────────────────────────────── */
function MyRequestsCard({ requests, loading, onListNew }: { requests: any[]; loading: boolean; onListNew: () => void }) {
  const { t } = useT();
  if (loading && requests.length === 0) return null;

  return (
    <div className="bg-card rounded-2xl border border-border p-4 mt-4">
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Inbox className="w-4 h-4 text-primary shrink-0" />
          <p className="text-sm font-bold text-foreground truncate">{t('myShop.requests.title')}</p>
        </div>
        <button onClick={onListNew}
          className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/15">
          <PlusCircle className="w-3.5 h-3.5" /> {t('common.new')}
        </button>
      </div>

      {requests.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-sm text-muted-foreground">{t('myShop.requests.empty')}</p>
          <button onClick={onListNew} className="mt-3 text-xs font-semibold text-primary hover:underline">
            {t('myShop.requests.cta')}
          </button>
        </div>
      ) : (
        <ul className="divide-y divide-border -mx-1">
          {requests.map((r) => <RequestRow key={r.id} req={r} />)}
        </ul>
      )}
    </div>
  );
}

function RequestRow({ req }: { req: any }) {
  const { t, locale } = useT();
  const status = req.status as 'pending' | 'approved' | 'rejected';
  const meta = {
    pending:  { icon: Clock,        cls: 'bg-secondary/15 text-secondary border-secondary/30', label: t('myShop.status.pending') },
    approved: { icon: CheckCircle2, cls: 'bg-success/10 text-success border-success/30',       label: t('myShop.status.approved') },
    rejected: { icon: XCircle,      cls: 'bg-destructive/10 text-destructive border-destructive/30', label: t('myShop.status.rejected') },
  }[status] || { icon: Clock, cls: 'bg-muted text-foreground border-border', label: status };
  const Icon = meta.icon;
  return (
    <li className="flex items-start gap-3 px-1 py-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{req.name}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {req.area || t('myShop.noArea')} • {new Date(req.created_at).toLocaleDateString(locale === 'mr' ? 'mr-IN' : 'en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
        {req.admin_notes && status !== 'pending' && (
          <p className="text-[11px] text-muted-foreground mt-1 italic line-clamp-2">{t('myShop.adminNote', { note: req.admin_notes })}</p>
        )}
      </div>
      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full border ${meta.cls}`}>
        <Icon className="w-3 h-3" /> {meta.label}
      </span>
    </li>
  );
}

/* ─── Editor ──────────────────────────────────────────────────────── */
function ShopEditor({ shop, onSaved }: { shop: any; onSaved: () => void }) {
  const { t } = useT();
  const { currentCity } = useCity();
  const initialCategoryIds = useMemo(
    () =>
      ((shop.shop_categories || []) as any[])
        .map((sc) => sc?.category_id)
        .filter(Boolean)
        .sort(),
    [shop],
  );
  const initial = useMemo(() => ({
    name: shop.name || '',
    description: shop.description || '',
    address: shop.address || '',
    area: shop.area || '',
    sub_area: shop.sub_area || '',
    phone: shop.phone || '',
    whatsapp: shop.whatsapp || '',
    opening_time: shop.opening_time || '',
    closing_time: shop.closing_time || '',
    is_open: shop.is_open ?? true,
    image_url: shop.image_url || '',
    keywords: shop.keywords || '',
    amenities: parseAmenities(shop.amenities) as string[],
    latitude: shop.latitude != null ? String(shop.latitude) : '',
    longitude: shop.longitude != null ? String(shop.longitude) : '',
    category_ids: initialCategoryIds as string[],
  }), [shop, initialCategoryIds]);
  const [form, setForm] = useState(initial);

  // Active categories for the owner picker
  const { data: allCategories = [] } = useQuery({
    queryKey: ['active-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name, icon')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  const [previewOpen, setPreviewOpen] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [localPreview, setLocalPreview] = useState<string>(''); // data URL flash after crop, until upload returns
  const oldImageUrlRef = useRef<string>(shop.image_url || '');
  // URLs whose storage files should be deleted *only after* a successful save.
  // This prevents leaving the row pointing at a deleted file if the user
  // crops/removes a photo but navigates away before saving.
  const pendingImageDeletionsRef = useRef<string[]>([]);

  type SyncStatus = 'idle' | 'pending' | 'error' | 'saved';
  const [toggleStatus, setToggleStatus] = useState<SyncStatus>('idle');
  const [saveStatus, setSaveStatus]     = useState<SyncStatus>('idle');
  const [toggleErr, setToggleErr]       = useState<string | null>(null);
  const [saveErr, setSaveErr]           = useState<string | null>(null);

  // Serial in-flight guard for toggle — repeated clicks while a mutation is in flight
  // are ignored so we never send out-of-order updates.
  const toggleInFlight = useRef(false);
  const saveInFlight   = useRef(false);
  const lastFailedSavePatch = useRef<any | null>(null);
  // Status auto-reset timers — kept in refs so we can cancel them on unmount
  // and avoid setState-after-unmount warnings if the user navigates away.
  const toggleStatusTimer = useRef<number | null>(null);
  const saveStatusTimer   = useRef<number | null>(null);
  useEffect(() => () => {
    if (toggleStatusTimer.current !== null) window.clearTimeout(toggleStatusTimer.current);
    if (saveStatusTimer.current   !== null) window.clearTimeout(saveStatusTimer.current);
  }, []);

  function set<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  // Track dirty so the sticky save bar only appears with pending edits.
  // Arrays (amenities, category_ids) are compared by value — reference
  // comparison would report "dirty" on every render.
  const dirty = useMemo(() => {
    return (Object.keys(initial) as (keyof typeof initial)[]).some((k) => {
      if (k === 'is_open') return false;
      const a = (form as any)[k];
      const b = (initial as any)[k];
      if (Array.isArray(a) || Array.isArray(b)) {
        return [...(a ?? [])].sort().join('|') !== [...(b ?? [])].sort().join('|');
      }
      return a !== b;
    });
  }, [form, initial]);

  function toggleCategory(id: string) {
    setForm((f) => ({
      ...f,
      category_ids: f.category_ids.includes(id)
        ? f.category_ids.filter((c) => c !== id)
        : [...f.category_ids, id],
    }));
  }


  // When realtime/refetch brings fresh shop data and the form has no pending edits,
  // sync the form to the latest values so toggles & external updates appear live.
  useEffect(() => {
    if (!dirty) setForm(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  const qc = useQueryClient();
  const { user } = useAuth();

  // Optimistically patch the shop in React Query cache so the UI flips instantly.
  function patchCache(patch: Partial<any>) {
    qc.setQueryData(['my-shops', user?.id], (old: any[] | undefined) =>
      old ? old.map((s) => (s.id === shop.id ? { ...s, ...patch } : s)) : old
    );
  }

  async function quickToggleOpen() {
    // Throttle: drop clicks while a previous toggle is still resolving.
    if (toggleInFlight.current) {
      toast.info(t('myShop.toast.busyToggle'), { description: t('myShop.toast.busyToggleDesc') });
      return;
    }
    toggleInFlight.current = true;

    const prev = form.is_open;
    const next = !prev;
    // Optimistic: flip immediately in local state + cache.
    setToggleStatus('pending');
    setToggleErr(null);
    set('is_open', next);
    patchCache({ is_open: next });

    // Concurrency-guarded write: if an admin closed/opened the shop between
    // our last cache sync and this click, we must NOT silently overwrite it.
    const result = await updateShopWithConcurrency(shop.id, shop.updated_at, { is_open: next });
    toggleInFlight.current = false;
    if (!result.ok) {
      // Rollback local optimistic state
      set('is_open', prev);
      const r = result as Extract<typeof result, { ok: false }>;
      if (r.conflict && (r as any).latest) {
        // Refresh cache with whatever the server says is current
        patchCache((r as any).latest);
        setToggleStatus('error');
        setToggleErr(t('myShop.conflict.title'));
        toast.error(t('myShop.conflict.title'), {
          description: t('myShop.conflict.desc'),
          action: { label: t('myShop.conflict.retry'), onClick: () => quickToggleOpen() },
          duration: 8000,
        });
        return;
      }
      patchCache({ is_open: prev });
      setToggleStatus('error');
      setToggleErr(r.conflict ? t('myShop.conflict.title') : (r as any).error);
      return;
    }
    // Merge fresh row (incl. new updated_at) into cache so the next write
    // uses the latest baseline.
    patchCache(result.row);
    setToggleStatus('saved');
    toast.success(next ? t('myShop.toast.markedOpen') : t('myShop.toast.markedClosed'));
    if (toggleStatusTimer.current !== null) window.clearTimeout(toggleStatusTimer.current);
    toggleStatusTimer.current = window.setTimeout(
      () => setToggleStatus((s) => (s === 'saved' ? 'idle' : s)),
      1500,
    );
  }

  async function save(retryPatch?: any) {
    if (saveInFlight.current) {
      toast.info(t('myShop.toast.busySave'));
      return;
    }
    if (!retryPatch && !form.name.trim()) { toast.error(t('myShop.toast.nameRequired')); return; }
    if (!retryPatch) {
      if (form.phone.trim() && !isValidIndianPhone(form.phone)) {
        toast.error(t('myShop.toast.phoneInvalid'));
        return;
      }
      if (form.whatsapp.trim() && !isValidIndianPhone(form.whatsapp)) {
        toast.error(t('myShop.toast.whatsappInvalid'));
        return;
      }
      if (form.category_ids.length === 0) {
        toast.error(t('myShop.toast.categoryRequired'));
        return;
      }
      if (form.latitude || form.longitude) {
        const la = parseFloat(form.latitude), ln = parseFloat(form.longitude);
        if (isNaN(la) || isNaN(ln) || la < -90 || la > 90 || ln < -180 || ln > 180) {
          toast.error(t('myShop.toast.locationInvalid'));
          return;
        }
      }
    }
    const rawPatch = retryPatch ?? {
      name: form.name.trim(),
      description: form.description.trim() || null,
      address: form.address.trim() || null,
      area: form.area.trim() || null,
      sub_area: form.sub_area.trim() || null,
      phone: form.phone.trim() || null,
      whatsapp: form.whatsapp.trim() || null,
      opening_time: form.opening_time || null,
      closing_time: form.closing_time || null,
      is_open: form.is_open,
      image_url: form.image_url || null,
      keywords: form.keywords.trim() || null,
      amenities: form.amenities,
      latitude: form.latitude ? parseFloat(form.latitude) : null,
      longitude: form.longitude ? parseFloat(form.longitude) : null,
    };

    // Defence in depth: even if a future bug adds an admin-only field to the
    // form, strip it before sending so owners can never overwrite moderation
    // state (is_active / is_verified / slug / categories).
    const patch = pickOwnerEditable(rawPatch);
    saveInFlight.current = true;
    const prevSnapshot = qc.getQueryData(['my-shops', user?.id]);
    setSaveStatus('pending');
    setSaveErr(null);
    // Optimistic: write to cache before network round-trip.
    patchCache(patch);

    const result = await updateShopWithConcurrency(shop.id, shop.updated_at, patch);
    saveInFlight.current = false;
    if (!result.ok) {
      // Rollback to pre-save snapshot
      qc.setQueryData(['my-shops', user?.id], prevSnapshot);
      const r = result as Extract<typeof result, { ok: false }>;
      if (r.conflict) {
        // Refresh cache with the latest server row so the form auto-syncs
        // (the ShopEditor's `useEffect` resets `form` to `initial` when not
        // dirty — and `initial` is derived from the cached shop, which we
        // just refreshed). The retry button is still available.
        if ((r as any).latest) patchCache((r as any).latest);
        lastFailedSavePatch.current = patch;
        setSaveStatus('error');
        setSaveErr(t('myShop.conflict.title'));
        toast.error(t('myShop.conflict.title'), {
          description: t('myShop.conflict.desc'),
          action: { label: t('myShop.conflict.retry'), onClick: () => save(patch) },
          duration: 10000,
        });
        return;
      }
      lastFailedSavePatch.current = patch;
      setSaveStatus('error');
      setSaveErr((r as any).error);
      return;
    }
    // Merge fresh row into cache so the next save uses the new updated_at.
    patchCache(result.row);

    // Categories live in the `shop_categories` join table — write the diff
    // separately (never through the owner-editable shop patch).
    let catFailed = false;
    if (!retryPatch) {
      const added = form.category_ids.filter((id) => !initialCategoryIds.includes(id));
      const removed = initialCategoryIds.filter((id) => !form.category_ids.includes(id));
      let catError: string | null = null;
      if (removed.length) {
        const { error } = await supabase
          .from('shop_categories')
          .delete()
          .eq('shop_id', shop.id)
          .in('category_id', removed);
        if (error) catError = error.message;
      }
      if (!catError && added.length) {
        const { error } = await supabase
          .from('shop_categories')
          .insert(added.map((category_id) => ({ shop_id: shop.id, category_id })));
        if (error) catError = error.message;
      }
      if (catError) {
        catFailed = true;
        setSaveStatus('error');
        setSaveErr(catError);
        toast.error(t('myShop.toast.categorySaveFailed'), { description: catError });
      } else if (added.length || removed.length) {
        patchCache({ shop_categories: form.category_ids.map((category_id) => ({ category_id })) });
      }
    }

    lastFailedSavePatch.current = null;
    if (!catFailed) {
      setSaveStatus('saved');
      toast.success(t('myShop.toast.updated'));
    }


    // Sync image baseline so future image swaps know what to delete.
    oldImageUrlRef.current = patch.image_url || '';
    // Now that the new image_url is persisted, it's safe to delete the
    // previous storage files queued during this edit session.
    const toDelete = pendingImageDeletionsRef.current
      .filter((u) => u && u !== patch.image_url);
    pendingImageDeletionsRef.current = [];
    for (const url of toDelete) {
      void removeShopImageQuiet(extractStoragePath(url));
    }

    onSaved();
    if (saveStatusTimer.current !== null) window.clearTimeout(saveStatusTimer.current);
    saveStatusTimer.current = window.setTimeout(
      () => setSaveStatus((s) => (s === 'saved' ? 'idle' : s)),
      1500,
    );
  }

  /* ── Image: crop → upload → delete old ─────────────────────── */
  async function handleImageCrop(blob: Blob, previewDataUrl: string) {
    setLocalPreview(previewDataUrl);
    setUploadingImg(true);
    try {
      const compressed = await compressImage(blob as unknown as File);
      const { publicUrl, isExisting } = await uploadShopImage(compressed, form.name || shop.name || 'shop');
      const prevUrl = oldImageUrlRef.current;
      // Defer deletion until save() persists the new image_url. This avoids
      // leaving the row pointing at a deleted storage file if the user
      // abandons the edit before saving.
      if (prevUrl && prevUrl !== publicUrl && !isExisting) {
        pendingImageDeletionsRef.current.push(prevUrl);
      }
      oldImageUrlRef.current = publicUrl;
      set('image_url', publicUrl);
      setLocalPreview('');
      if (isExisting) {
        toast.info(locale === 'mr' ? 'विद्यमान फोटो स्टोरेजमधून लिंक केला आहे.' : 'Existing image found in storage and linked.');
      } else {
        toast.success(t('myShop.toast.photoUpdated'));
      }
    } catch (e: any) {
      toast.error(e?.message || t('request.toast.imageUploadFailed'));
      setLocalPreview('');
    } finally {
      setUploadingImg(false);
    }
  }

  async function handleImageRemove() {
    if (!form.image_url) return;
    const prevUrl = oldImageUrlRef.current || form.image_url;
    const removedUrl = form.image_url;
    // Two-step confirm: ask via sonner toast (project rule: no window.confirm).
    toast(t('myShop.removePhoto.confirmTitle'), {
      description: t('myShop.confirm.removePhoto'),
      duration: 6000,
      action: {
        label: t('myShop.removePhoto.confirmAction'),
        onClick: () => {
          if (prevUrl) pendingImageDeletionsRef.current.push(prevUrl);
          oldImageUrlRef.current = '';
          set('image_url', '');
          toast.success(t('myShop.toast.photoRemoved'), {
            action: {
              label: t('myShop.removePhoto.undo'),
              onClick: () => {
                // Undo: restore the URL and pull it back out of the pending
                // deletion queue so save() won't drop the file.
                pendingImageDeletionsRef.current = pendingImageDeletionsRef.current.filter(
                  (u) => u !== prevUrl,
                );
                oldImageUrlRef.current = prevUrl;
                set('image_url', removedUrl);
                toast.success(t('myShop.toast.photoRestored'));
              },
            },
            duration: 6000,
          });
        },
      },
    });
  }

  function copyShopLink() {
    const slug = shop.slug || shop.id;
    const url = `${window.location.origin}/shop/${slug}`;
    navigator.clipboard.writeText(url).then(
      () => toast.success(t('myShop.toast.linkCopied')),
      () => toast.error(t('myShop.toast.copyFailed'))
    );
  }

  const togglingOpen = toggleStatus === 'pending';
  const saving       = saveStatus === 'pending';



  return (
    <>
      {/* ─── Hero summary card ───────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-card to-card mb-4 shadow-sm">
        <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-primary/10 blur-2xl pointer-events-none" />
        <div className="relative p-4 flex items-start gap-3">
          <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden bg-muted shrink-0 ring-2 ring-card shadow">
            {(localPreview || form.image_url) ? (
              localPreview ? (
                <img src={localPreview} alt={form.name} className="w-full h-full object-cover" />
              ) : (
                <ShopImage src={form.image_url} alt={form.name} targetWidth={160} />
              )
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                <Store className="w-7 h-7" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-foreground text-base sm:text-lg truncate leading-tight">
              {form.name || t('myShop.yourShop')}
            </h2>
            {(form.area || form.sub_area) && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
                <MapPin className="w-3 h-3 shrink-0" />
                {[form.area, form.sub_area].filter(Boolean).join(' · ')}
              </p>
            )}
            <div className="flex items-center flex-wrap gap-1.5 mt-1.5">
              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                form.is_open
                  ? 'bg-success/15 text-success'
                  : 'bg-destructive/15 text-destructive'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${form.is_open ? 'bg-success animate-pulse' : 'bg-destructive'}`} />
                {form.is_open ? t('shop.openBadge') : t('shop.closedBadge')}
              </span>
              {shop.is_verified && (
                <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-semibold bg-primary/10 text-primary">
                  <ShieldCheck className="w-2.5 h-2.5" /> {t('myShop.verified')}
                </span>
              )}
              {shop.is_claimed && <ClaimedBadge size="sm" />}
            </div>
          </div>
        </div>
        <div className="relative px-4 pb-4 flex gap-2">
          <button
            onClick={() => setPreviewOpen(true)}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98] transition-all"
          >
            <Eye className="w-3.5 h-3.5" /> {t('myShop.preview')}
          </button>
          <button
            onClick={copyShopLink}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-border bg-background hover:bg-muted active:scale-[0.98] transition-all"
            title={t('myShop.copyShopLink')}
          >
            <Link2 className="w-3.5 h-3.5" /> {t('myShop.copyLink')}
          </button>
          <Link
            to={`/shop/${shop.slug || shop.id}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-border bg-background hover:bg-muted active:scale-[0.98] transition-all"
            title={t('myShop.openPublic')}
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-border p-4 space-y-4 mb-4 shadow-sm">
        {/* Quick open toggle — owner override, takes priority over scheduled hours */}
        <button
          onClick={quickToggleOpen}
          disabled={togglingOpen}
          aria-pressed={form.is_open}
          className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 font-bold text-sm transition-all active:scale-[0.99] ${
            form.is_open
              ? 'bg-success/10 border-success/40 text-success'
              : 'bg-destructive/10 border-destructive/30 text-destructive'
          } disabled:opacity-50`}
        >
          <span className="flex items-center gap-2">
            {togglingOpen ? <Loader2 className="w-4 h-4 animate-spin" /> : <Power className="w-4 h-4" />}
            {form.is_open ? t('myShop.toggle.open') : t('myShop.toggle.closed')}
          </span>
          <span className="text-[11px] font-semibold opacity-80">{t('myShop.toggle.hint')}</span>
        </button>
        <SyncBadge
          status={toggleStatus}
          error={toggleErr}
          onRetry={quickToggleOpen}
          pendingLabel={t('myShop.sync.pending')}
          savedLabel={t('myShop.sync.saved')}
          errorLabel={t('myShop.sync.error')}
        />
        <p className="text-[11px] text-muted-foreground -mt-2">
          {t('myShop.toggle.desc')}
        </p>

        <Section title={t('myShop.section.photo')}>
          <div className="space-y-2">
            <ImageCropPicker
              onCropComplete={handleImageCrop}
              onClear={() => { /* keep existing image_url; user uses Remove button explicitly */ }}
              previewUrl={form.image_url || undefined}
              uploading={uploadingImg}
              maxMB={5}
            />
            {form.image_url && (
              <button
                type="button"
                onClick={handleImageRemove}
                disabled={uploadingImg}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-destructive hover:underline disabled:opacity-50"
              >
                <Trash2 className="w-3 h-3" /> {t('myShop.removePhoto')}
              </button>
            )}
            <p className="text-[11px] text-muted-foreground flex items-start gap-1">
              <ImageIcon className="w-3 h-3 mt-0.5 shrink-0" />
              {t('myShop.photo.deleteHint')}
            </p>
          </div>
        </Section>

        <Section title={t('myShop.section.basics')}>
          <Field label={t('myShop.section.shopName')}>
            <input value={form.name} onChange={(e) => set('name', e.target.value)} className={inputCls} />
          </Field>
          <Field label={t('myShop.section.description')}>
            <textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={3} className={inputCls + ' resize-none'} />
          </Field>
          <Field label={t('myShop.section.keywords')}>
            <input
              value={form.keywords}
              onChange={(e) => set('keywords', e.target.value)}
              className={inputCls}
              maxLength={200}
              placeholder={t('myShop.keywords.placeholder')}
            />
            <p className="text-[11px] text-muted-foreground mt-1">{t('myShop.keywords.help')}</p>
            {form.keywords.trim() && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {form.keywords.split(',').map((k) => k.trim()).filter(Boolean).map((k, i) => (
                  <span key={`${k}-${i}`} className="text-[11px] px-2 py-0.5 rounded-full bg-muted border border-border font-medium">
                    {k}
                  </span>
                ))}
              </div>
            )}
          </Field>
        </Section>

        <Section title={t('myShop.section.categories')}>
          <div className="flex flex-wrap gap-2">
            {allCategories.map((c: any) => {
              const selected = form.category_ids.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleCategory(c.id)}
                  aria-pressed={selected}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                    selected
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-foreground border-border hover:border-primary'
                  }`}
                >
                  <span>{c.icon}</span> {c.name}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            {form.category_ids.length === 0
              ? t('myShop.categories.none')
              : t('myShop.categories.help')}
          </p>
        </Section>

        <Section title={t('myShop.section.amenities')}>
          <AmenitiesPicker value={form.amenities} onChange={(next) => set('amenities', next)} />
        </Section>

        <Section title={t('myShop.section.contact')}>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('myShop.section.phone')}>
              <input value={form.phone} onChange={(e) => set('phone', e.target.value)} inputMode="tel" className={inputCls} />
            </Field>
            <Field label={t('myShop.section.whatsapp')}>
              <input value={form.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} inputMode="tel" className={inputCls} />
            </Field>
          </div>
        </Section>

        <Section title={t('myShop.section.location')}>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('myShop.section.area')}>
              <input value={form.area} onChange={(e) => set('area', e.target.value)} className={inputCls} />
            </Field>
            <Field label={t('myShop.section.subArea')}>
              <input value={form.sub_area} onChange={(e) => set('sub_area', e.target.value)} className={inputCls} />
            </Field>
          </div>
          <Field label={t('myShop.section.address')}>
            <input value={form.address} onChange={(e) => set('address', e.target.value)} className={inputCls} />
          </Field>

          <Field label={t('myShop.section.mapPin')}>
            <LocationMapPicker
              value={
                form.latitude && form.longitude
                  ? { lat: parseFloat(form.latitude), lng: parseFloat(form.longitude) }
                  : null
              }
              initialCenter={{
                lat: currentCity?.latitude || MUKTAINAGAR_CENTER.lat,
                lng: currentCity?.longitude || MUKTAINAGAR_CENTER.lng,
              }}
              height={220}
              onChange={(c) =>
                setForm((f) => ({
                  ...f,
                  latitude: c.lat.toFixed(6),
                  longitude: c.lng.toFixed(6),
                }))
              }
              onGeocode={(g) =>
                setForm((f) => ({
                  ...f,
                  address: f.address.trim() ? f.address : g.address,
                  area: f.area.trim() ? f.area : g.area,
                }))
              }
            />
            <div className="flex items-center justify-between gap-2 mt-2">
              <span className="text-[11px] font-mono text-muted-foreground truncate">
                {form.latitude && form.longitude
                  ? `📍 ${form.latitude}, ${form.longitude}`
                  : t('myShop.map.help')}
              </span>
              {form.latitude && form.longitude && (
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, latitude: '', longitude: '' }))}
                  className="shrink-0 text-xs text-destructive font-semibold hover:opacity-70"
                >
                  {t('myShop.map.clear')}
                </button>
              )}
            </div>
          </Field>
        </Section>

        <Section title={t('myShop.section.hours')}>
          <div className="grid grid-cols-2 gap-3">
            <TimePickerField label={t('myShop.section.openingTime')} optional value={form.opening_time} onChange={(v) => set('opening_time', v)} />
            <TimePickerField label={t('myShop.section.closingTime')} optional value={form.closing_time} onChange={(v) => set('closing_time', v)} />
          </div>
        </Section>


        <p className="text-[11px] text-muted-foreground">
          {t('myShop.adminManaged')}
        </p>

        <SyncBadge
          status={saveStatus}
          error={saveErr}
          onRetry={() => save(lastFailedSavePatch.current ?? undefined)}
          pendingLabel={t('myShop.saving')}
          savedLabel={t('myShop.allSaved')}
          errorLabel={t('myShop.saveFailed')}
        />

        <button
          onClick={() => save()} disabled={saving || !dirty}
          className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {dirty ? t('myShop.saveChanges') : t('myShop.allSaved')}
        </button>

      </div>

      {/* Sticky save bar — only appears when there are unsaved edits */}
      {dirty && (
        <div className="fixed bottom-0 inset-x-0 z-20 border-t border-border bg-card/95 backdrop-blur shadow-[0_-4px_12px_-4px_hsl(var(--foreground)/0.15)]">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-2">
            <button
              onClick={() => setForm(initial)}
              disabled={saving}
              className="px-4 py-2.5 rounded-xl border border-border text-sm font-semibold hover:bg-muted disabled:opacity-50"
            >
              {t('myShop.reset')}
            </button>
            <button
              onClick={() => save()} disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {t('myShop.saveChanges')}
            </button>
          </div>
        </div>
      )}

      <ShopPreviewSheet
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        shop={shop}
        form={{
          name: form.name,
          description: form.description,
          address: form.address,
          area: form.area,
          sub_area: form.sub_area,
          phone: form.phone,
          whatsapp: form.whatsapp,
          opening_time: form.opening_time,
          closing_time: form.closing_time,
          is_open: form.is_open,
        }}
        imageUrl={form.image_url || null}
        previewBlobUrl={localPreview || null}
      />
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 pt-2 border-t border-border first-of-type:border-0 first-of-type:pt-0">
      <p className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

/* ─── Sync status badge (pending / saved / error+retry) ─────────── */
function SyncBadge({
  status, error, onRetry, pendingLabel, savedLabel, errorLabel,
}: {
  status: 'idle' | 'pending' | 'error' | 'saved';
  error: string | null;
  onRetry: () => void;
  pendingLabel: string;
  savedLabel: string;
  errorLabel: string;
}) {
  if (status === 'idle') return null;

  if (status === 'pending') {
    return (
      <div className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground -mt-1" role="status" aria-live="polite">
        <CloudUpload className="w-3.5 h-3.5 animate-pulse" />
        <span>{pendingLabel}</span>
      </div>
    );
  }
  if (status === 'saved') {
    return (
      <div className="flex items-center gap-2 text-[11px] font-semibold text-success -mt-1" role="status" aria-live="polite">
        <CheckCircle className="w-3.5 h-3.5" />
        <span>{savedLabel}</span>
      </div>
    );
  }
  // error
  return (
    <div className="flex items-start gap-2 -mt-1 p-2 rounded-lg bg-destructive/10 border border-destructive/30" role="alert">
      <CloudOff className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-bold text-destructive">{errorLabel}</p>
        {error && <p className="text-[10px] text-destructive/80 line-clamp-2 mt-0.5">{error}</p>}
      </div>
      <button
        onClick={onRetry}
        className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-md bg-destructive text-destructive-foreground hover:opacity-90"
      >
        <RefreshCw className="w-3 h-3" /> Retry
      </button>
    </div>
  );
}




/* ─── Engagement card (30-day) ───────────────────────────────────── */
function EngagementCard({ shopId }: { shopId: string }) {
  const { t } = useT();
  const { data, isLoading } = useQuery({
    queryKey: ['my-shop-engagement', shopId],
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('shop_engagement')
        .select('event_type')
        .eq('shop_id', shopId)
        .gte('created_at', since);
      if (error) throw error;
      const calls = (data || []).filter((r: any) => r.event_type === 'call').length;
      const waps  = (data || []).filter((r: any) => r.event_type === 'whatsapp').length;
      return { calls, waps, total: calls + waps };
    },
  });

  return (
    <div className="bg-card rounded-2xl border border-border p-4">
      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">{t('myShop.engagement.title')}</p>
      {isLoading ? (
        <div className="text-center py-4"><Loader2 className="w-4 h-4 animate-spin inline text-muted-foreground" /></div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          <Stat icon={<Phone className="w-4 h-4" />} label={t('myShop.engagement.calls')} value={data?.calls ?? 0} tone="primary" />
          <Stat icon={<MessageCircle className="w-4 h-4" />} label={t('myShop.engagement.whatsapp')} value={data?.waps ?? 0} tone="success" />
          <Stat icon={<span className="text-base">📈</span>} label={t('myShop.engagement.total')} value={data?.total ?? 0} tone="muted" />
        </div>
      )}
    </div>
  );
}

function Stat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: 'primary'|'success'|'muted' }) {
  const styles = {
    primary: { background: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))' },
    success: { background: 'hsl(var(--whatsapp-soft))', color: 'hsl(var(--whatsapp))' },
    muted:   { background: 'hsl(var(--muted))', color: 'hsl(var(--foreground))' },
  }[tone];
  return (
    <div className="rounded-xl p-3 text-center" style={styles}>
      <div className="flex items-center justify-center gap-1 mb-1">{icon}<span className="text-[10px] font-semibold uppercase tracking-wider opacity-80">{label}</span></div>
      <div className="text-2xl font-bold leading-none">{value}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-foreground mb-1">{label}</span>
      {children}
    </label>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 text-muted-foreground">
      {children}
    </div>
  );
}

function RedirectToAuth() {
  const navigate = useNavigate();
  const { t } = useT();
  useEffect(() => { navigate('/auth?next=/my-shop', { replace: true }); }, [navigate]);
  return <Centered>{t('myShop.redirecting')}</Centered>;
}
