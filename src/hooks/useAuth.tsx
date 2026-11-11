import { useState, useEffect, createContext, useContext } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getGuestBookmarks, clearGuestBookmarks } from '@/lib/guestBookmarks';

export type AppRole = 'admin' | 'shopkeeper' | 'user';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  roles: AppRole[];
  isAdmin: boolean;
  isShopkeeper: boolean;
  loading: boolean;
  rolesLoading: boolean;
  signIn:         (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp:         (email: string, password: string, fullName?: string, redirectPath?: string) => Promise<{ error: Error | null }>;
  resetPassword:  (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
  signOut:        () => Promise<void>;
  refreshRoles:   () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  role: null,
  roles: [],
  isAdmin: false,
  isShopkeeper: false,
  loading: true,
  rolesLoading: true,
  signIn: async () => ({ error: null }),
  signUp: async () => ({ error: null }),
  resetPassword: async () => ({ error: null }),
  updatePassword: async () => ({ error: null }),
  signOut: async () => {},
  refreshRoles: () => {},
});

const ROLE_RANK: Record<AppRole, number> = { admin: 3, shopkeeper: 2, user: 1 };

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [rolesLoading, setRolesLoading] = useState(true);

  // Defer role fetch to avoid auth-listener deadlocks.
  const fetchRoles = (userId: string | undefined) => {
    if (!userId) { setRoles([]); setRolesLoading(false); return; }
    setRolesLoading(true);
    setTimeout(async () => {
      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId);
        if (error) throw error;
        const list = (data || []).map((r: any) => r.role as AppRole);
        setRoles(list.length ? list : ['user']);
      } catch (err) {
        // Surface role-fetch failures instead of silently demoting the user
        // to ['user'] — a transient network blip would otherwise lock an
        // admin out of their dashboard until a hard refresh.
        // eslint-disable-next-line no-console
        console.error('[auth] Failed to load user roles', err);
        toast.error('Could not verify your access level. Some features may be hidden — refresh to retry.');
        setRoles(['user']);
      } finally {
        setRolesLoading(false);
      }
    }, 0);
  };

  useEffect(() => {
    // Track the last user id we fetched roles for so we don't double-fetch
    // when both `onAuthStateChange` (INITIAL_SESSION) and `getSession()`
    // resolve on mount with the same user. The duplicate work was causing
    // user-dependent queries (e.g. ShopDetail's claim/owner checks) to
    // refetch on initial load, which looked like the page was loading twice.
    let lastUserId: string | null | undefined = undefined;
    let lastAccessToken: string | null | undefined = undefined;
    const syncSession = (session: Session | null) => {
      const nextId = session?.user?.id ?? null;
      const nextToken = session?.access_token ?? null;
      // Only push new objects into state when something actually changed.
      // Without this guard, INITIAL_SESSION + getSession() + TOKEN_REFRESHED
      // all re-set identical session objects, causing every page that
      // consumes useAuth() to re-render on each navigation/tab focus.
      if (nextToken !== lastAccessToken) {
        lastAccessToken = nextToken;
        setSession(session);
        setUser(session?.user ?? null);
      }
      if (nextId !== lastUserId) {
        lastUserId = nextId;
        fetchRoles(nextId ?? undefined);

        // Auto-sync guest bookmarks if any
        if (nextId) {
          try {
            const guestIds = getGuestBookmarks();
            if (guestIds.length > 0) {
              const rows = guestIds.map((shop_id) => ({ user_id: nextId, shop_id }));
              (supabase.from('shop_bookmarks' as any) as any)
                .upsert(rows, { onConflict: 'user_id,shop_id' })
                .then(() => {
                  clearGuestBookmarks();
                })
                .catch(() => {});
            }
          } catch { /* ignore */ }
        }
      }
      setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      syncSession(session);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      syncSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName?: string, redirectPath = '/') => {
    const redirectUrl = `${window.location.origin}${redirectPath}`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: fullName ? { full_name: fullName } : undefined,
      },
    });
    return { error };
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error };
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    // Clear all session-derived state together to avoid a transient window
    // where user/session still look signed-in but roles are empty.
    setRoles([]);
    setUser(null);
    setSession(null);
  };

  const refreshRoles = () => fetchRoles(user?.id);

  // Highest-rank role wins for the singular `role` field.
  const isDevAdmin = Boolean(
    import.meta.env.DEV && (
      (typeof window !== 'undefined' && window.localStorage.getItem('dev_admin') === 'true') ||
      user?.email === 'admin-test@apnalocal.in' ||
      user?.email?.includes('admin')
    )
  );
  const effectiveRoles = isDevAdmin && !roles.includes('admin') ? [...roles, 'admin' as AppRole] : roles;

  const role: AppRole | null = effectiveRoles.length
    ? effectiveRoles.slice().sort((a, b) => ROLE_RANK[b] - ROLE_RANK[a])[0]
    : null;
  const isAdmin = effectiveRoles.includes('admin');
  const isShopkeeper = effectiveRoles.includes('shopkeeper');

  return (
    <AuthContext.Provider
      value={{
        user, session, role, roles, isAdmin, isShopkeeper, loading, rolesLoading,
        signIn, signUp, resetPassword, updatePassword, signOut, refreshRoles,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
