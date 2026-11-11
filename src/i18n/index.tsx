/**
 * i18n provider for Muktainagar Daily.
 *
 * Static UI strings are bundled (no runtime translation API). English is
 * shipped in the main bundle; Marathi is lazy-loaded the first time the
 * user picks it. The selected locale is persisted to localStorage and (when
 * signed in) mirrored to profiles.locale.
 *
 * Usage:
 *   const { t, locale, setLocale } = useT();
 *   t('shop.openUntil', { time: '9:00 PM' })
 */
import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import en from './en.json';
import mr from './mr.json';
import { supabase } from '@/integrations/supabase/client';

export type Locale = 'en' | 'mr';

const STORAGE_KEY = 'md.locale';

type Dict = Record<string, string>;
// Both dictionaries are bundled eagerly so the first paint in Marathi is
// already in Marathi — no English flash on slow networks. Combined size is
// ~18KB raw / much less gzipped, well within budget.
const dictionaries: Record<Locale, Dict> = {
  en: en as Dict,
  mr: mr as Dict,
};


function readInitialLocale(): Locale {
  if (typeof window === 'undefined') return 'en';
  try {
    const url = new URL(window.location.href);
    const fromUrl = url.searchParams.get('lang');
    if (fromUrl === 'en' || fromUrl === 'mr') return fromUrl;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'mr') return stored;
  } catch { /* noop */ }
  return 'en';
}

function interpolate(
  str: string,
  vars?: Record<string, string | number>,
  defaultVars?: Record<string, string | number>,
) {
  const merged = { ...defaultVars, ...vars };
  return str.replace(/\{(\w+)\}/g, (_, k) => (k in merged ? String(merged[k]) : `{${k}}`));
}

function getActiveTownDefaults(locale: Locale): { town: string; brand: string } {
  try {
    if (typeof window !== 'undefined') {
      const pathSeg = window.location.pathname.split('/')[1]?.toLowerCase();
      const stored = window.localStorage.getItem('md.selected_city_slug')?.toLowerCase();
      const slug = pathSeg || stored || 'muktainagar';

      const KNOWN: Record<string, { en: string; mr: string }> = {
        muktainagar: { en: 'Muktainagar', mr: 'मुक्ताईनगर' },
        bhusawal: { en: 'Bhusawal', mr: 'भुसावळ' },
        varangaon: { en: 'Varangaon', mr: 'वरणगाव' },
        bodwad: { en: 'Bodwad', mr: 'बोदवड' },
        maval: { en: 'Maval', mr: 'मावळ' },
        pune: { en: 'Pune', mr: 'पुणे' },
      };

      const found = KNOWN[slug];
      const town = found
        ? (locale === 'mr' ? found.mr : found.en)
        : (slug.charAt(0).toUpperCase() + slug.slice(1));
      const brand = `ApnaTown · ${town}`;
      return { town, brand };
    }
  } catch { /* noop */ }
  return {
    town: locale === 'mr' ? 'मुक्ताईनगर' : 'Muktainagar',
    brand: locale === 'mr' ? 'ApnaTown · मुक्ताईनगर' : 'ApnaTown · Muktainagar',
  };
}

interface I18nContextValue {
  locale: Locale;
  ready: boolean;
  setLocale: (l: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  formatNumber: (n: number) => string;
}

const I18nContext = createContext<I18nContextValue>({
  locale: 'en',
  ready: true,
  setLocale: () => {},
  t: (k) => k,
  formatNumber: (n) => String(n),
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(readInitialLocale);
  // Both dictionaries are bundled, so we're always ready immediately.
  const ready = true;


  // Reflect to <html lang>, body class, and persist.
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
      document.body.classList.toggle('lang-mr', locale === 'mr');
    }
    try { window.localStorage.setItem(STORAGE_KEY, locale); } catch {}
  }, [locale]);

  // On auth state change, hydrate from profiles.locale if it differs.
  // Dedupe: both `getSession()` and `onAuthStateChange(INITIAL_SESSION)`
  // resolve on mount with the same user, and `TOKEN_REFRESHED` fires again
  // for the same user shortly after. Without this guard we were re-fetching
  // profiles.locale on every event, which looked like the page loaded twice.
  // Keep latest `locale` in a ref so the async profile sync (which only
  // mounts once) reads the current value rather than the stale closure —
  // otherwise a manual user pick can be overwritten mid-fetch.
  const localeRef = useRef(locale);
  useEffect(() => { localeRef.current = locale; }, [locale]);

  useEffect(() => {
    let cancelled = false;
    let lastSyncedUserId: string | null | undefined = undefined;
    const sync = async (userId: string | null) => {
      if (userId === lastSyncedUserId) return;
      lastSyncedUserId = userId;
      if (!userId) return;
      try {
        const { data } = await supabase
          .from('profiles')
          .select('locale')
          .eq('id', userId)
          .maybeSingle();
        if (cancelled) return;
        const dbLocale = (data as any)?.locale as Locale | undefined;
        if (dbLocale && dbLocale !== localeRef.current) setLocaleState(dbLocale);
      } catch { /* table/column may not exist yet — silently ignore */ }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      sync(session?.user?.id ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      sync(session?.user?.id ?? null);
    });
    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    // Persist to profile if signed in (fire-and-forget).
    supabase.auth.getSession().then(({ data: { session } }) => {
      const uid = session?.user?.id;
      if (!uid) return;
      supabase.from('profiles').update({ locale: next } as any).eq('id', uid).then(() => {});
    });
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      const dict = dictionaries[locale];
      const fallback = dictionaries.en;
      const raw = (dict && dict[key]) || fallback[key] || key;
      const defaults = getActiveTownDefaults(locale);
      return interpolate(raw, vars, defaults);
    },
    [locale],
  );

  const formatNumber = useCallback(
    (n: number) => new Intl.NumberFormat(locale === 'mr' ? 'mr-IN' : 'en-IN').format(n),
    [locale],
  );

  const value = useMemo<I18nContextValue>(
    () => ({ locale, ready, setLocale, t, formatNumber }),
    [locale, ready, setLocale, t, formatNumber],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useT = () => useContext(I18nContext);
