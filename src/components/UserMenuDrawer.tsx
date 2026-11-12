import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import {
  User, Bookmark, MapPin, Bell, Settings, HelpCircle, LogOut, LogIn, UserPlus,
  ChevronRight, Sparkles, ShieldCheck, Store, PlusCircle, Languages, ChevronLeft,
  Moon, Info, Trash2, Heart, Briefcase, Wrench, Phone, School,
  Building2, Landmark, Stethoscope, Truck, Search, Users, Award, Coins,
  ClipboardCheck, Zap, MapPinned, Megaphone, Pencil, UserCog,
  UtensilsCrossed, BedDouble, Bus, Globe, Bot, CheckCircle2, RefreshCw, Loader2,
} from 'lucide-react';
import { EditProfileDrawer } from '@/components/EditProfileDrawer';
import { CityPickerModal } from '@/components/shared/CityPickerModal';
import { useAuth } from '@/hooks/useAuth';
import { useCity } from '@/hooks/useCity';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useSwipeDownToClose } from '@/hooks/useSwipeDownToClose';
import { toast } from 'sonner';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import { Switch } from '@/components/ui/switch';
import { useTheme } from 'next-themes';
import { useT } from '@/i18n';
import { useQueryClient } from '@tanstack/react-query';


/* ─── Access tier badge ──────────────────────────────────────────────── */
function TierBadge({ tier }: { tier: 'guest' | 'member' | 'admin' }) {
  const { t } = useT();
  const map = {
    guest:  { label: t('user.tier.guest'),  bg: 'hsl(38 95% 52% / 0.15)',  color: 'hsl(30 80% 38%)',  border: 'hsl(38 95% 52% / 0.35)' },
    member: { label: t('user.tier.member'), bg: 'hsl(var(--primary) / 0.15)', color: 'hsl(var(--primary))', border: 'hsl(var(--primary) / 0.30)' },
    admin:  { label: t('user.tier.admin'),  bg: 'hsl(var(--whatsapp-soft))', color: 'hsl(var(--whatsapp))', border: 'hsl(var(--whatsapp) / 0.30)' },

  };
  const { label, bg, color, border } = map[tier];
  return (
    <span
      className="text-[10px] font-bold px-2 py-0.5 rounded-full border tracking-wider uppercase"
      style={{ background: bg, color, borderColor: border }}
    >
      {label}
    </span>
  );
}

/* ─── Single menu row ────────────────────────────────────────────────── */
interface MenuRowProps {
  icon: React.ReactNode;
  label: string;
  desc?: string;
  soon?: boolean;
  danger?: boolean;
  onClick?: () => void;
  right?: React.ReactNode;
}
function MenuRow({ icon, label, desc, soon, danger, onClick, right }: MenuRowProps) {
  const { t } = useT();
  const isInteractive = Boolean(onClick) && !soon;
  const rowClassName = `w-full flex items-center gap-3 px-4 py-3 transition-colors rounded-xl group
    ${danger
      ? 'hover:bg-destructive/8 active:bg-destructive/12'
      : isInteractive
        ? 'hover:bg-muted active:bg-muted/80'
        : ''}
    ${soon ? 'opacity-60 cursor-default' : isInteractive ? 'cursor-pointer' : ''}
  `;
  const rowContent = (
    <>
      <span
        className={`flex items-center justify-center w-9 h-9 rounded-xl shrink-0 transition-colors
          ${danger
            ? 'bg-destructive/10 text-destructive group-hover:bg-destructive/15'
            : 'bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary'}
        `}
      >
        {icon}
      </span>
      <div className="flex-1 text-left min-w-0">
        <p className={`text-sm font-semibold leading-tight ${danger ? 'text-destructive' : 'text-foreground'}`}>
          {label}
        </p>
        {desc && <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{desc}</p>}
      </div>
      {right ? (
        <div
          className="shrink-0"
          onClick={isInteractive ? (e) => e.stopPropagation() : undefined}
        >
          {right}
        </div>
      ) : soon ? (
        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border tracking-wider uppercase"
          style={{ background: 'hsl(38 95% 52% / 0.12)', color: 'hsl(30 80% 38%)', borderColor: 'hsl(38 95% 52% / 0.3)' }}>
          {t('user.menu.soon')}
        </span>
      ) : (
        !danger && <ChevronRight className="w-4 h-4 text-muted-foreground/50 shrink-0 group-hover:text-primary/50 transition-colors" />
      )}
    </>
  );

  if (!isInteractive) {
    return <div className={rowClassName}>{rowContent}</div>;
  }

  return (
    <button type="button" onClick={onClick} className={rowClassName}>
      {rowContent}
    </button>
  );
}

/* ─── Divider ────────────────────────────────────────────────────────── */
function MenuDivider() {
  return <div className="mx-4 my-1 h-px bg-border" />;
}

/* ─── Main component ─────────────────────────────────────────────────── */
interface UserMenuDrawerProps {
  tone?: 'onPrimary' | 'onSurface';
}

export function UserMenuDrawer({ tone = 'onPrimary' }: UserMenuDrawerProps = {}) {
  const { t, locale } = useT();
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [cityPickerOpen, setCityPickerOpen] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(false);
  const { currentCity, currentVillage, townBrand, townName, districtName, stateName } = useCity();
  const { user, isAdmin, isShopkeeper, signOut } = useAuth();
  const navigate = useNavigate();
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const queryClient = useQueryClient();


  const [profileName, setProfileName] = useState<string | null>(null);
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [clearingProgress, setClearingProgress] = useState(0);
  const [clearingStep, setClearingStep] = useState<string | null>(null);
  const [cacheClearDone, setCacheClearDone] = useState(false);

  // Swipe-down to close handlers for mobile touch users
  const { ref: menuSwipeRef } = useSwipeDownToClose({
    isOpen: open,
    onClose: () => setOpen(false),
  });

  const { ref: settingsSwipeRef } = useSwipeDownToClose({
    isOpen: settingsOpen,
    onClose: () => setSettingsOpen(false),
  });

  const { ref: aboutSwipeRef } = useSwipeDownToClose({
    isOpen: aboutOpen,
    onClose: () => setAboutOpen(false),
  });

  useEffect(() => {
    if (!user) { setProfileName(null); return; }
    let cancelled = false;
    const load = () => {
      supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (cancelled) return;
          setProfileName((data as { full_name: string | null } | null)?.full_name ?? null);
        });
    };
    load();
    // Refresh when the edit drawer closes so the new username appears.
    if (!editOpen) load();
    return () => { cancelled = true; };
  }, [user, editOpen]);

  const displayName  = profileName || user?.user_metadata?.full_name || user?.email?.split('@')[0] || t('user.guestUser');
  const displayEmail = user?.email || null;
  const initials     = displayName.slice(0, 2).toUpperCase();
  const tier: 'guest' | 'member' | 'admin' = !user ? 'guest' : isAdmin ? 'admin' : 'member';

  const handleSignOut = async () => {
    setSettingsOpen(false);
    setOpen(false);
    await signOut();
    navigate('/');
  };

  const handleAdminDashboard = () => {
    setOpen(false);
    navigate('/admin');
  };

  const handleClearCache = async () => {
    if (isClearingCache) return;
    setIsClearingCache(true);
    setCacheClearDone(false);
    setClearingProgress(5);
    setClearingStep(locale === 'mr' ? 'स्थानिक कॅश तपासत आहे…' : 'Scanning cached data…');

    const pause = (ms: number) => new Promise((r) => window.setTimeout(r, ms));
    const failures: string[] = [];
    const runStep = async (label: string, stepLabel: string, progress: number, fn: () => void | Promise<void>) => {
      setClearingStep(stepLabel);
      setClearingProgress(progress);
      try {
        await fn();
      } catch (err) {
        console.error(`[clear-cache] ${label} failed`, err);
        failures.push(label);
      }
      await pause(130);
    };

    // 1. Wipe non-auth localStorage (keep Supabase sign-in tokens intact).
    await runStep(
      'localStorage',
      locale === 'mr' ? 'जुना स्थानीय डेटा साफ करत आहे…' : 'Clearing browser cache & drafts…',
      22,
      () => {
        Object.keys(localStorage).forEach((k) => {
          if (k.startsWith('sb-') || k === 'supabase.auth.token') return;
          localStorage.removeItem(k);
        });
      },
    );

    // 2. Wipe sessionStorage (translation snapshots, draft form state, etc.).
    await runStep(
      'sessionStorage',
      locale === 'mr' ? 'सेशन स्नॅपशॉट साफ करत आहे…' : 'Clearing session cache…',
      45,
      () => {
        sessionStorage.clear();
      },
    );

    // 3. Drop the in-memory React Query cache so next render refetches.
    await runStep(
      'query cache',
      locale === 'mr' ? 'मेमरी क्वेरी कॅश रीसेट करत आहे…' : 'Resetting in-memory query cache…',
      68,
      () => {
        queryClient.cancelQueries();
        queryClient.clear();
      },
    );

    // 4. Purge Cache Storage (PWA runtime + workbox caches).
    if ('caches' in window) {
      await runStep(
        'offline cache',
        locale === 'mr' ? 'ऑफलाइन PWA कॅश साफ करत आहे…' : 'Purging offline PWA storage…',
        85,
        async () => {
          const names = await caches.keys();
          const results = await Promise.allSettled(names.map((n) => caches.delete(n)));
          const rejected = results.find((r) => r.status === 'rejected');
          if (rejected) throw (rejected as PromiseRejectedResult).reason;
        },
      );
    }

    // 5. Best-effort: drop IndexedDB databases (Supabase auth lives in
    //    localStorage, so this only wipes app-side stores). Race with 1.5s timeout.
    await runStep(
      'IndexedDB',
      locale === 'mr' ? 'ऑफलाइन डेटाबेस साफ करत आहे…' : 'Cleaning local IndexedDB stores…',
      95,
      async () => {
        if (typeof indexedDB === 'undefined') return;
        const anyIDB = indexedDB as unknown as {
          databases?: () => Promise<{ name?: string }[]>;
        };
        if (typeof anyIDB.databases !== 'function') return;
        const dbs = await Promise.race([
          anyIDB.databases(),
          new Promise<{ name?: string }[]>((resolve) => window.setTimeout(() => resolve([]), 1200)),
        ]);
        const names = dbs.map((d) => d.name).filter((n): n is string => !!n && !n.startsWith('supabase'));
        await Promise.all(
          names.map(
            (name) =>
              new Promise<'ok'>((resolve) => {
                const timer = window.setTimeout(() => resolve('ok'), 1200);
                try {
                  const req = indexedDB.deleteDatabase(name);
                  req.onsuccess = () => { window.clearTimeout(timer); resolve('ok'); };
                  req.onblocked = () => { window.clearTimeout(timer); resolve('ok'); };
                  req.onerror = () => { window.clearTimeout(timer); resolve('ok'); };
                } catch {
                  window.clearTimeout(timer);
                  resolve('ok');
                }
              }),
          ),
        );
      },
    );

    setClearingProgress(100);
    setIsClearingCache(false);

    if (failures.length === 0) {
      setCacheClearDone(true);
      setClearingStep(locale === 'mr' ? 'कॅश पूर्णपणे साफ झाली!' : 'All app caches cleared!');
      toast.success(t('user.settings.cacheCleared'), {
        description: t('user.settings.cacheClearedDesc'),
        action: { label: t('user.settings.reload'), onClick: () => window.location.reload() },
        duration: 8000,
      });
    } else {
      setClearingStep(locale === 'mr' ? 'काही भाग साफ करता आला नाही.' : 'Partially cleared — retry recommended.');
      toast.error(t('user.settings.cacheClearFailed'), {
        description: `${failures.join(', ')}`,
        duration: 10000,
      });
    }
  };

  return (
    <>
      {/* ── Trigger button ── */}
      <button
        onClick={() => setOpen(true)}
        aria-label={t('user.menu.openMenu')}
        className={`relative flex items-center justify-center w-9 h-9 rounded-full shrink-0 transition-all active:scale-90 ${
          tone === 'onSurface'
            ? 'bg-muted hover:bg-muted/80 text-foreground border border-border hover:ring-2 hover:ring-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
            : 'hover:ring-2 hover:ring-primary-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/50'
        }`}
        style={
          tone === 'onSurface'
            ? undefined
            : { background: 'hsl(var(--primary-foreground) / 0.15)', border: '2px solid hsl(var(--primary-foreground) / 0.25)' }
        }
      >
        {user ? (
          <span className={`text-xs font-bold leading-none ${tone === 'onSurface' ? 'text-foreground' : 'text-primary-foreground'}`}>{initials}</span>
        ) : (
          <User className={`w-4 h-4 ${tone === 'onSurface' ? 'text-foreground' : 'text-primary-foreground'}`} />
        )}
        {user && (
          <span
            className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2"
            style={{
              background: 'hsl(var(--success))',
              borderColor: tone === 'onSurface' ? 'hsl(var(--background))' : 'hsl(var(--primary))',
            }}
          />
        )}
      </button>

      {/* ── Profile Drawer ── */}
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent ref={menuSwipeRef} className="max-w-lg mx-auto rounded-t-2xl overflow-hidden pb-safe">

          <div
            className="h-2 w-full"
            style={{
              background: 'linear-gradient(90deg, hsl(var(--primary)), hsl(var(--secondary)), hsl(var(--primary)))',
              backgroundSize: '200% 100%',
              animation: 'gradient-shift 3s ease infinite',
            }}
          />

          <DrawerHeader className="sr-only"><DrawerTitle>{t('user.menu.title')}</DrawerTitle><DrawerDescription>{t('user.menu.subtitle')}</DrawerDescription></DrawerHeader>

          {/* User identity section */}
          <div className="px-4 pt-4 pb-3">
            <div className="flex items-center gap-3.5">
              <div
                className="relative w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-md"
                style={{
                  background: user
                    ? 'linear-gradient(135deg, hsl(var(--primary)), hsl(214 85% 55%))'
                    : 'linear-gradient(135deg, hsl(var(--muted)), hsl(220 15% 80%))',
                }}
              >
                {user ? (
                  <span className="text-xl font-bold text-primary-foreground">{initials}</span>
                ) : (
                  <User className="w-7 h-7 text-muted-foreground" />
                )}
                {user && (
                  <span
                    className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 flex items-center justify-center"
                    style={{ background: 'hsl(var(--success))', borderColor: 'hsl(var(--card))' }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-white" />
                  </span>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-base text-foreground leading-tight truncate">{displayName}</p>
                  <TierBadge tier={tier} />
                </div>
                {displayEmail ? (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{displayEmail}</p>
                ) : (
                  <p className="text-xs text-muted-foreground mt-0.5">{t('user.guestMode')}</p>
                )}
              </div>

              {user && (
                <button
                  onClick={() => { setOpen(false); setEditOpen(true); }}
                  aria-label="Edit profile"
                  className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-semibold text-primary border-primary/30 bg-primary/5 hover:bg-primary/10 active:scale-95 transition-all"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit
                </button>
              )}
            </div>

            {!user && (
              <div
                className="mt-3 rounded-xl p-3 flex items-start gap-2.5"
                style={{ background: 'hsl(var(--primary) / 0.07)', border: '1px solid hsl(var(--primary) / 0.15)' }}
              >
                <Sparkles className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'hsl(var(--primary))' }} />
                <div>
                  <p className="text-xs font-semibold text-foreground leading-tight">{t('user.signInPrompt')}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                    {t('user.signInDesc')}
                  </p>
                </div>
              </div>
            )}
          </div>

          <MenuDivider />

          {/* Main menu items */}
          <div className="py-1">
            <MenuRow
              icon={<PlusCircle className="w-4 h-4" />}
              label={t('user.menu.listShop')}
              desc={t('user.menu.listShopDesc')}
              onClick={() => {
                setOpen(false);
                window.setTimeout(() => {
                  window.dispatchEvent(new CustomEvent('open-list-shop-modal', { detail: { entityType: 'shop' } }));
                }, 320);
              }}
            />
            <MenuRow
              icon={<Bookmark className="w-4 h-4" />}
              label={t('user.menu.savedShops')}
              desc={t('user.menu.savedDesc')}
              onClick={() => { setOpen(false); navigate(user ? '/saved-shops' : '/auth?next=/saved-shops'); }}
            />
            <MenuRow
              icon={<Building2 className="w-4 h-4 text-emerald-600" />}
              label={locale === 'mr' ? 'अत्यावश्यक सेवा व सूचना' : 'Essential Services & Alerts'}
              desc={locale === 'mr' ? 'पाणी, वीज, नगरपरिषद सूचना व हेल्पलाईन' : 'Water, Power, Municipal notices & helplines'}
              onClick={() => { setOpen(false); navigate(`/${currentCity.slug}/services`); }}
            />
            <MenuRow
              icon={<MapPin className="w-4 h-4 text-primary" />}
              label="Select Town / City"
              desc={currentVillage ? `${currentVillage.name}, ${townName}` : `${townName}, ${districtName}`}
              onClick={() => {
                setOpen(false);
                setCityPickerOpen(true);
              }}
              right={
                <span className="text-[11px] font-semibold text-primary px-2.5 py-0.5 rounded-full bg-primary/10">
                  {townName}
                </span>
              }
            />
          </div>

          <MenuDivider />

          <div className="py-1">
            {user && (
              <MenuRow
                icon={<UserCog className="w-4 h-4" />}
                label="Edit profile"
                desc="Username, mobile, birthday & gender"
                onClick={() => { setOpen(false); setEditOpen(true); }}
              />
            )}
            <MenuRow
              icon={<Settings className="w-4 h-4" />}
              label={t('user.menu.settings')}
              desc={t('user.menu.settingsDesc')}
              onClick={() => setSettingsOpen(true)}
            />
            <MenuRow
              icon={<HelpCircle className="w-4 h-4" />}
              label={t('user.menu.help')}
              desc={t('user.menu.helpDesc')}
              soon
            />
            {user && (
              <MenuRow
                icon={<Store className="w-4 h-4" />}
                label={t('user.menu.myShop')}
                desc={isShopkeeper || isAdmin ? t('user.menu.myShopDesc.manage') : t('user.menu.myShopDesc.track')}
                onClick={() => { setOpen(false); navigate('/my-shop'); }}
              />
            )}
            {user && isAdmin && (
              <MenuRow
                icon={<ShieldCheck className="w-4 h-4" />}
                label={t('user.menu.adminDashboard')}
                desc={t('user.menu.adminDesc')}
                onClick={handleAdminDashboard}
              />
            )}
          </div>

          {/* Auth actions — guests only (Sign Out moved into Settings) */}
          {!user && (
            <>
              <MenuDivider />
              <div className="py-1 pb-2">
                <div className="flex gap-2 px-4 py-2">
                  <button
                    onClick={() => { setOpen(false); navigate('/auth'); }}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95"
                    style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}
                  >
                    <LogIn className="w-4 h-4" />
                    {t('common.signIn')}
                  </button>
                  <button
                    onClick={() => { setOpen(false); navigate('/auth?mode=signup'); }}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-semibold transition-all active:scale-95"
                    style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--foreground))', background: 'hsl(var(--muted))' }}
                  >
                    <UserPlus className="w-4 h-4" />
                    {t('common.signUp')}
                  </button>
                </div>
              </div>
            </>
          )}
          {user && <div className="pb-2" />}
        </DrawerContent>
      </Drawer>

      {/* ── Settings Drawer ── */}
      <Drawer open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DrawerContent ref={settingsSwipeRef} className="max-w-lg mx-auto rounded-t-2xl overflow-hidden pb-safe">
          <div
            className="h-2 w-full"
            style={{
              background: 'linear-gradient(90deg, hsl(var(--primary)), hsl(var(--secondary)), hsl(var(--primary)))',
              backgroundSize: '200% 100%',
              animation: 'gradient-shift 3s ease infinite',
            }}
          />

          <DrawerHeader className="sr-only"><DrawerTitle>{t('user.settings.title')}</DrawerTitle><DrawerDescription>{t('user.settings.subtitle')}</DrawerDescription></DrawerHeader>

          {/* Settings header */}
          <div className="px-4 pt-4 pb-2 flex items-center gap-2">
            <button
              onClick={() => setSettingsOpen(false)}
              className="flex items-center justify-center w-9 h-9 rounded-xl bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors active:scale-95"
              aria-label={t('user.menu.back')}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-base text-foreground leading-tight">{t('user.settings.title')}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{t('user.settings.subtitle')}</p>
            </div>
            <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary/10 text-primary">
              <Settings className="w-4 h-4" />
            </span>
          </div>

          <MenuDivider />

          {/* Preferences */}
          <div className="px-4 pt-2 pb-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{t('user.settings.preferences')}</p>
          </div>
          <div className="py-1">
            {/* Language */}
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl">
              <span className="flex items-center justify-center w-9 h-9 rounded-xl shrink-0 bg-muted text-muted-foreground">
                <Languages className="w-4 h-4" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold leading-tight text-foreground">{t('user.settings.language')}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{t('user.settings.languageDesc')}</p>
              </div>
              <div className="shrink-0">
                <LanguageSwitcher tone="onSurface" />
              </div>
            </div>

            {/* Notifications */}
            <MenuRow
              icon={<Bell className="w-4 h-4" />}
              label={t('user.settings.notifications')}
              desc={t('user.settings.notificationsDesc')}
              right={
                <Switch
                  checked={notifEnabled}
                  onCheckedChange={async (v) => {
                    if (v && typeof window !== 'undefined' && 'Notification' in window) {
                      // If user enables but OS/browser denied, surface it
                      // explicitly — otherwise the toggle silently lies.
                      let perm = Notification.permission;
                      if (perm === 'default') {
                        try { perm = await Notification.requestPermission(); } catch { /* ignore */ }
                      }
                      if (perm === 'denied') {
                        toast.error(t('user.settings.notifBlocked'), {
                          description: t('user.settings.notifBlockedDesc'),
                          duration: 7000,
                        });
                        return; // do not flip switch
                      }
                    }
                    setNotifEnabled(v);
                    toast.message(v ? t('user.settings.notifEnabled') : t('user.settings.notifDisabled'), {
                      description: t('user.settings.notifSoon'),
                    });
                  }}
                />
              }
            />

            {/* Theme */}
            <MenuRow
              icon={<Moon className="w-4 h-4" />}
              label={t('user.settings.darkMode')}
              desc={t('user.settings.darkModeDesc')}
              right={
                <Switch
                  checked={isDark}
                  onCheckedChange={(v) => setTheme(v ? 'dark' : 'light')}
                />
              }
            />

          </div>

          <MenuDivider />

          {/* Data */}
          <div className="px-4 pt-2 pb-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{t('user.settings.data')}</p>
          </div>
          <div className="py-1">
            <MenuRow
              icon={isClearingCache ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : cacheClearDone ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Trash2 className="w-4 h-4" />}
              label={t('user.settings.clearCache')}
              desc={t('user.settings.clearCacheDesc')}
              onClick={handleClearCache}
              right={
                (isClearingCache || cacheClearDone) ? (
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${cacheClearDone ? 'bg-emerald-500/15 text-emerald-600' : 'bg-primary/10 text-primary'}`}>
                    {clearingProgress}%
                  </span>
                ) : undefined
              }
            />
            {(isClearingCache || cacheClearDone) && (
              <div className="mx-4 mb-2 px-3 py-2.5 rounded-xl bg-muted/60 border border-border space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="font-medium text-foreground truncate">{clearingStep}</span>
                  <span className="font-bold text-primary shrink-0">{clearingProgress}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-200 ${cacheClearDone ? 'bg-emerald-500' : 'bg-primary'}`}
                    style={{ width: `${clearingProgress}%` }}
                  />
                </div>
                {cacheClearDone && (
                  <div className="flex items-center justify-between pt-0.5">
                    <span className="text-[10.5px] text-emerald-700 dark:text-emerald-400 font-medium">
                      {locale === 'mr' ? 'नवीन माहितीसाठी अ‍ॅप रिफ्रेश करा.' : 'Ready — reload for a clean fetch.'}
                    </span>
                    <button
                      type="button"
                      onClick={() => window.location.reload()}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
                    >
                      <RefreshCw className="w-3 h-3" />
                      {t('user.settings.reload')}
                    </button>
                  </div>
                )}
              </div>
            )}
            <MenuRow
              icon={<Info className="w-4 h-4" />}
              label={t('user.menu.about')}
              desc={t('user.menu.aboutDesc')}
              onClick={() => setAboutOpen(true)}
            />
          </div>

          {/* Sign out */}
          {user && (
            <>
              <MenuDivider />
              <div className="py-1 pb-2">
                <MenuRow
                  icon={<LogOut className="w-4 h-4" />}
                  label={t('user.menu.signOut')}
                  danger
                  onClick={handleSignOut}
                />
              </div>
            </>
          )}
        </DrawerContent>
      </Drawer>

      {/* ── About Drawer ── */}
      <Drawer open={aboutOpen} onOpenChange={setAboutOpen}>
        <DrawerContent ref={aboutSwipeRef} className="max-w-lg mx-auto rounded-t-2xl overflow-hidden pb-safe">
          <div
            className="h-2 w-full"
            style={{
              background: 'linear-gradient(90deg, hsl(var(--primary)), hsl(var(--secondary)), hsl(var(--primary)))',
              backgroundSize: '200% 100%',
              animation: 'gradient-shift 3s ease infinite',
            }}
          />

          <DrawerHeader className="sr-only"><DrawerTitle>{t('user.about.title')}</DrawerTitle><DrawerDescription>{t('user.about.subtitle')}</DrawerDescription></DrawerHeader>

          {/* About header */}
          <div className="px-4 pt-4 pb-2 flex items-center gap-2">
            <button
              onClick={() => setAboutOpen(false)}
              className="flex items-center justify-center w-9 h-9 rounded-xl bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors active:scale-95"
              aria-label={t('user.menu.back')}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-base text-foreground leading-tight">{t('user.about.title')}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{t('user.menu.aboutDesc')}</p>
            </div>
            <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary/10 text-primary">
              <Info className="w-4 h-4" />
            </span>
          </div>

          <div className="px-4 pb-4 overflow-y-auto max-h-[70vh]">
            {/* Hero */}
            <div
              className="rounded-xl p-4 mb-4"
              style={{ background: 'hsl(var(--primary) / 0.07)', border: '1px solid hsl(var(--primary) / 0.15)' }}
            >
              <div className="flex items-center gap-2 mb-2">
                <MapPinned className="w-5 h-5 text-primary" />
                <h2 className="text-sm font-bold text-foreground">{t('app.name')}</h2>
              </div>
              <p className="text-[12px] text-muted-foreground leading-relaxed">
                {t('user.about.heroDesc')}
              </p>
            </div>

            {/* Current Features */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-primary" />
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{t('user.about.whatWeOffer')}</p>
              </div>
              <ul className="space-y-1.5">
                {[
                  { icon: <Search className="w-3.5 h-3.5" />, text: t('about.feature.search') },
                  { icon: <UtensilsCrossed className="w-3.5 h-3.5" />, text: t('about.feature.living') },
                  { icon: <BedDouble className="w-3.5 h-3.5" />, text: t('about.feature.pg') },
                  { icon: <Bus className="w-3.5 h-3.5" />, text: t('about.feature.bus') },
                  { icon: <School className="w-3.5 h-3.5" />, text: t('about.feature.schools') },
                  { icon: <Building2 className="w-3.5 h-3.5" />, text: t('about.feature.servicesNews') },
                  { icon: <Bot className="w-3.5 h-3.5" />, text: t('about.feature.aiBilingual') },
                  { icon: <Phone className="w-3.5 h-3.5" />, text: t('about.feature.call') },
                  { icon: <MapPin className="w-3.5 h-3.5" />, text: t('about.feature.maps') },
                  { icon: <Bookmark className="w-3.5 h-3.5" />, text: t('about.feature.bookmarks') },
                  { icon: <Users className="w-3.5 h-3.5" />, text: t('about.feature.listing') },
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-[12px] text-muted-foreground">
                    <span className="mt-0.5 text-primary shrink-0">{item.icon}</span>
                    <span>{item.text}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Future Roadmap */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Megaphone className="w-4 h-4 text-primary" />
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{t('user.about.comingSoon')}</p>
              </div>
              <ul className="space-y-1.5">
                {[
                  { icon: <Briefcase className="w-3.5 h-3.5" />, text: t('about.coming.jobs') },
                  { icon: <Wrench className="w-3.5 h-3.5" />, text: t('about.coming.quickNumbers') },
                  { icon: <Truck className="w-3.5 h-3.5" />, text: t('about.coming.erickshaw') },
                  { icon: <Globe className="w-3.5 h-3.5" />, text: t('about.coming.garbage') },
                  { icon: <Search className="w-3.5 h-3.5" />, text: t('about.coming.lostFound') },
                  { icon: <Landmark className="w-3.5 h-3.5" />, text: t('about.coming.banks') },
                  { icon: <Stethoscope className="w-3.5 h-3.5" />, text: t('about.coming.hospitals') },
                  { icon: <Heart className="w-3.5 h-3.5" />, text: t('about.coming.promote') },
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-[12px] text-muted-foreground">
                    <span className="mt-0.5 text-primary shrink-0">{item.icon}</span>
                    <span>{item.text}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Student Earning */}
            <div
              className="rounded-xl p-4 mb-4"
              style={{ background: 'hsl(38 95% 52% / 0.08)', border: '1px solid hsl(38 95% 52% / 0.2)' }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Coins className="w-5 h-5" style={{ color: 'hsl(30 80% 38%)' }} />
                <h3 className="text-sm font-bold text-foreground">{t('user.about.earn.title')}</h3>
              </div>
              <p className="text-[12px] text-muted-foreground leading-relaxed mb-2">
                {locale === 'mr' ? (
                  <>
                    आम्ही <strong className="text-foreground font-semibold">विद्यार्थी एजंट नेटवर्क</strong> तयार करत आहोत जेणेकरून स्थानिक व्यवसाय नोंदणी व पडताळणी करून विद्यार्थी उत्पन्न मिळवू शकतील.
                  </>
                ) : (
                  <>
                    We are building a <strong className="text-foreground font-semibold">Student Agent Network</strong> so anyone can earn small side-income by helping grow and verify our local directory.
                  </>
                )}
              </p>
              <ul className="space-y-1.5">
                {[
                  { icon: <ClipboardCheck className="w-3.5 h-3.5" />, text: t('about.earn.verify') },
                  { icon: <Award className="w-3.5 h-3.5" />, text: t('about.earn.points') },
                  { icon: <Coins className="w-3.5 h-3.5" />, text: t('about.earn.payout') },
                  { icon: <Zap className="w-3.5 h-3.5" />, text: t('about.earn.tasks') },
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-[12px] text-muted-foreground">
                    <span className="mt-0.5 shrink-0" style={{ color: 'hsl(30 80% 38%)' }}>{item.icon}</span>
                    <span>{item.text}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* SEO / Keywords blurb */}
            <div className="rounded-xl p-3 bg-muted/40 border border-border mb-2">
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                <strong>Keywords:</strong> {townName} shop directory, local business guide {districtName || 'Jalgaon'},
                {townBrand} services, hyperlocal directory {stateName || 'Maharashtra'}, shops near me {townName},
                local plumber electrician {townName}, {townName} jobs, bus timetable {townName},
                {townName} news, lost and found {townName}, student earning {townName},
                {townName} hospitals, schools in {townName}, government offices {townName}.
              </p>
            </div>

            {/* Footer */}
            <div className="text-center pt-2 pb-1 space-y-0.5">
              <p className="text-[10px] text-muted-foreground">{t('user.about.footer').replace('❤', '')}<Heart className="w-3 h-3 inline text-destructive mx-1" /></p>
              <p className="text-[9px] text-muted-foreground/60">{t('user.about.copyright', { year: new Date().getFullYear() })}</p>
              {/* Temporarily hidden: "Built for Vibe Forge Hackathon" attribution
              <p className="text-[9px] text-muted-foreground/75 inline-flex items-center justify-center gap-1">
                {locale === 'mr' ? (
                  <>
                    <a
                      href="https://vibe-forge.in/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-foreground hover:text-primary transition-colors underline decoration-border/60 hover:decoration-primary underline-offset-2 inline-flex items-center gap-0.5"
                    >
                      <span>{t('footer.hackathon')}</span>
                      <ExternalLink className="w-2.5 h-2.5 opacity-50 shrink-0" aria-hidden="true" />
                    </a>
                    <span>{t('footer.builtFor')}</span>
                  </>
                ) : (
                  <>
                    <span>{t('footer.builtFor')}</span>
                    <a
                      href="https://vibe-forge.in/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-foreground hover:text-primary transition-colors underline decoration-border/60 hover:decoration-primary underline-offset-2 inline-flex items-center gap-0.5"
                    >
                      <span>{t('footer.hackathon')}</span>
                      <ExternalLink className="w-2.5 h-2.5 opacity-50 shrink-0" aria-hidden="true" />
                    </a>
                  </>
                )}
              </p>
              */}
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* ── Edit Profile Drawer ── */}
      <EditProfileDrawer
        open={editOpen}
        onOpenChange={setEditOpen}
        onBack={() => setOpen(true)}
      />

      {/* ── City / Location Picker Modal ── */}
      <CityPickerModal open={cityPickerOpen} onClose={() => setCityPickerOpen(false)} />
    </>
  );
}
