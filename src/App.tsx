import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { BrowserRouter, Routes, Route, Navigate, useParams, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useRef, lazy, Suspense } from "react";
import { IN_APP_HISTORY_FLAG } from "@/hooks/useSmartBack";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { CityProvider, useCity } from "@/hooks/useCity";
import { supabase } from "@/integrations/supabase/client";
import Home from "./pages/Home";
import Shops from "./pages/Shops";
import ShopDetail from "./pages/ShopDetail";
import NotFound from "./pages/NotFound";
import { useToast } from "@/hooks/use-toast";
import { OfflineOverlay } from "@/components/shared/OfflineOverlay";
import { ListShopModalHost } from "@/components/ListShopModalHost";
import { TownAssistantDrawer } from "@/components/TownAssistantDrawer";

// Code-split routes that are not on the public hot path. The admin subtree,
// auth flows, account pages, and rarely-hit error pages all become their
// own chunks so anonymous visitors don't pay for ~30–60 KB of admin JS.
//
// lazyWithReload: after a new deploy, an open tab can hold an old index.html
// whose chunk hashes no longer exist ("Failed to fetch dynamically imported
// module"). Instead of blanking the screen, reload once to fetch the fresh
// manifest; the sessionStorage flag prevents a reload loop.
function lazyWithReload<T extends { default: React.ComponentType<unknown> }>(
  factory: () => Promise<T>,
) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (err) {
      const key = "md_chunk_reload";
      const alreadyTried = sessionStorage.getItem(key);
      if (!alreadyTried) {
        sessionStorage.setItem(key, "1");
        window.location.reload();
        // Keep the suspense boundary pending while the reload happens.
        return new Promise<T>(() => {});
      }
      sessionStorage.removeItem(key);
      throw err;
    }
  });
}

const AdminLogin        = lazyWithReload(() => import("./pages/AdminLogin"));
const Auth              = lazyWithReload(() => import("./pages/Auth"));
const ResetPassword     = lazyWithReload(() => import("./pages/ResetPassword"));
const MyShop            = lazyWithReload(() => import("./pages/MyShop"));
const SavedShops        = lazyWithReload(() => import("./pages/SavedShops"));
const ErrorRoute        = lazyWithReload(() => import("./pages/ErrorRoute"));
const BusTimetable      = lazyWithReload(() => import("./pages/BusTimetable"));
const Schools           = lazyWithReload(() => import("./pages/Schools"));
const SchoolDetail      = lazyWithReload(() => import("./pages/SchoolDetail"));
const Mess              = lazyWithReload(() => import("./pages/Mess"));
const MessDetail        = lazyWithReload(() => import("./pages/MessDetail"));
const PG                = lazyWithReload(() => import("./pages/PG"));
const PGDetail          = lazyWithReload(() => import("./pages/PGDetail"));
const EssentialServices = lazyWithReload(() => import("./pages/EssentialServices"));
const LocalNews         = lazyWithReload(() => import("./pages/LocalNews"));
const SectionComingSoon = lazyWithReload(() => import("./pages/SectionComingSoon"));
const OAuthConsent      = lazyWithReload(() => import("./pages/OAuthConsent"));

// Admin tree — layout + leaf pages.
const AdminLayout         = lazyWithReload(() => import("./components/admin/layout/AdminLayout").then(m => ({ default: m.AdminLayout })));
const AdminOverview       = lazyWithReload(() => import("./pages/admin/Overview"));
const DirectoryShops      = lazyWithReload(() => import("./pages/admin/DirectoryShops"));
const DirectoryMess       = lazyWithReload(() => import("./pages/admin/DirectoryMess"));
const DirectoryPG         = lazyWithReload(() => import("./pages/admin/DirectoryPG"));
const DirectoryCategories = lazyWithReload(() => import("./pages/admin/DirectoryCategories"));
const DirectoryInbox      = lazyWithReload(() => import("./pages/admin/DirectoryInbox"));
const DirectoryQuality    = lazyWithReload(() => import("./pages/admin/DirectoryQuality"));
const SectionsHub         = lazyWithReload(() => import("./pages/admin/SectionsHub"));
const SectionDetail       = lazyWithReload(() => import("./pages/admin/SectionDetail"));
const MarketingAds        = lazyWithReload(() => import("./pages/admin/MarketingAds"));
const InsightsAnalytics   = lazyWithReload(() => import("./pages/admin/InsightsAnalytics"));
const SystemData          = lazyWithReload(() => import("./pages/admin/SystemData"));
const SystemMarathi       = lazyWithReload(() => import("./pages/admin/SystemMarathi"));
const SystemMcp           = lazyWithReload(() => import("./pages/admin/SystemMcp"));

// Render nothing while the lazy chunk downloads. Each page already shows
// its own skeleton as soon as it mounts, so an extra centered "Loading…"
// here just stacks a second loading state on top of the page skeleton and
// makes navigation feel like it loads twice.
const RouteFallback = () => null;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // MPULSE Rec #3 — align long-lived read staleTime to 2 min across
      // categories / shops / banners. Individual queries can still override.
      staleTime: 120_000,      // 2 min — don't re-fetch if data is fresh
      gcTime: 300_000,         // 5min — keep in cache after unmount
      retry: 1,                // only one retry on failure (helps on slow networks)
      refetchOnWindowFocus: false, // prevent jarring re-fetches when switching tabs
    },
  },
});

// MPULSE Rec #3 / Cache #B — persist the small, long-lived `categories`
// query to localStorage so anonymous visitors on repeat visits skip the
// round-trip. Other query keys are excluded to keep the cache bounded and
// avoid persisting anything user-scoped.
if (typeof window !== 'undefined') {
  try {
    const persister = createSyncStoragePersister({
      storage: window.localStorage,
      key: 'md-rq-cache',
      throttleTime: 1_000,
    });
    persistQueryClient({
      queryClient: queryClient as any,
      persister,
      maxAge: 24 * 60 * 60 * 1000, // 24h
      dehydrateOptions: {
        shouldDehydrateQuery: (q) => {
          const k = q.queryKey?.[0];
          return k === 'categories';
        },
      },
    });
  } catch { /* localStorage blocked (private mode) — silently continue */ }
}

function ProtectedRoute({
  children,
  requireRole,
}: {
  children: React.ReactNode;
  requireRole?: 'admin' | 'shopkeeper';
}) {
  const { user, isAdmin, isShopkeeper, loading, rolesLoading } = useAuth();
  const { toast } = useToast();
  const location = useLocation();
  const notifiedRef = useRef(false);

  const stillLoading = loading || (user && requireRole && rolesLoading);
  const ok =
    !requireRole ||
    (requireRole === 'admin' && isAdmin) ||
    (requireRole === 'shopkeeper' && (isShopkeeper || isAdmin));

  // Fire the toast in an effect — calling toast() during render triggers
  // a React state-update-during-render warning and can loop.
  useEffect(() => {
    if (stillLoading || !user || ok || notifiedRef.current) return;
    notifiedRef.current = true;
    toast({
      title: requireRole === 'admin' ? 'Admin access required' : 'Shop owner access required',
      description: 'You do not have permission to view that page.',
      variant: 'destructive',
    });
  }, [stillLoading, user, ok, requireRole, toast]);

  // Render nothing while auth/role resolves. The protected page mounts
  // immediately after and shows its own skeleton. Showing a centered
  // "Loading..." here makes navigation feel like it loads twice (chunk
  // fallback → this → page skeleton).
  if (stillLoading) return null;
  if (!user) {
    if (import.meta.env.DEV && typeof window !== 'undefined' && window.localStorage.getItem('dev_admin') === 'true') {
      return <>{children}</>;
    }
    const currentPath = location.pathname + location.search + location.hash;
    const nextParam = currentPath && currentPath !== '/' ? `?next=${encodeURIComponent(currentPath)}` : '';
    return <Navigate to={`/auth${nextParam}`} replace />;
  }
  if (!ok) return <Navigate to="/" replace />;
  return <>{children}</>;
}

/** Marks that the user has navigated within the app at least once.
 *  Used by useSmartBack to fall back when there's no in-app history. */
function HistoryTracker() {
  const location = useLocation();
  const isFirst = useRef(true);
  const previous = useRef<string | null>(null);
  useEffect(() => {
    const current = location.pathname + location.search;
    if (isFirst.current) {
      isFirst.current = false;
      previous.current = current;
      return;
    }
    // Stash the route we're leaving so useSmartBack can use it as a smarter fallback.
    if (previous.current && previous.current !== current) {
      sessionStorage.setItem('prevInAppRoute', previous.current);
    }
    previous.current = current;
    sessionStorage.setItem(IN_APP_HISTORY_FLAG, '1');
  }, [location.key]);
  return null;
}

function CategoryRedirect() {
  const { id } = useParams<{ id: string }>();
  const { currentCity } = useCity();
  const navigate = useNavigate();
  useEffect(() => {
    if (!id) { navigate(`/${currentCity.slug}/shops`, { replace: true }); return; }
    supabase.from('categories').select('name').eq('id', id).single().then(
      ({ data }) => {
        if (data?.name) navigate(`/${currentCity.slug}/shops?category=${encodeURIComponent(data.name)}`, { replace: true });
        else navigate(`/${currentCity.slug}/shops`, { replace: true });
      },
      () => navigate(`/${currentCity.slug}/shops`, { replace: true }),
    );
  }, [id, currentCity.slug, navigate]);
  // Render nothing during the brief redirect; Shops mounts immediately
  // after and shows its own skeleton.
  return null;
}

function RootCityRedirect() {
  const { currentCity } = useCity();
  const location = useLocation();
  return <Navigate to={`/${currentCity.slug}${location.search}${location.hash}`} replace />;
}

function LegacyCityRedirect({ to }: { to: string }) {
  const { currentCity } = useCity();
  const location = useLocation();
  return <Navigate to={`/${currentCity.slug}${to}${location.search}${location.hash}`} replace />;
}

function LegacyShopDetailRedirect() {
  const { currentCity } = useCity();
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  return <Navigate to={`/${currentCity.slug}/shop/${id}${location.search}${location.hash}`} replace />;
}

function LegacyLivingDetailRedirect({ module }: { module: 'mess' | 'pg' }) {
  const { currentCity } = useCity();
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  return <Navigate to={`/${currentCity.slug}/${module}/${id}${location.search}${location.hash}`} replace />;
}

function LegacySchoolDetailRedirect() {
  const { currentCity } = useCity();
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  return <Navigate to={`/${currentCity.slug}/schools/${id}${location.search}${location.hash}`} replace />;
}

function LegacyCategoryRedirect() {
  const { currentCity } = useCity();
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  return <Navigate to={`/${currentCity.slug}/category/${id}${location.search}${location.hash}`} replace />;
}

function LegacySectionRedirect() {
  const { currentCity } = useCity();
  const { key } = useParams<{ key: string }>();
  const location = useLocation();
  return <Navigate to={`/${currentCity.slug}/sections/${key}${location.search}${location.hash}`} replace />;
}

function CityRouteGuard({ children }: { children: React.ReactNode }) {
  const { citySlug } = useParams<{ citySlug: string }>();
  const { allCities, isLoading } = useCity();
  if (isLoading) return null;
  const match = allCities.some((c) => c.slug.toLowerCase() === citySlug?.toLowerCase());
  if (!match) return <NotFound />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <CityProvider>
            <HistoryTracker />
            <OfflineOverlay />
            <ListShopModalHost />
            <TownAssistantDrawer />
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                {/* Global, non-town scoped routes */}
                <Route path="/auth" element={<Auth />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
                <Route path="/oauth/consent" element={<OAuthConsent />} />
                <Route path="/~oauth/consent" element={<OAuthConsent />} />
                <Route path="/admin/login" element={<AdminLogin />} />
                <Route path="/admin" element={<ProtectedRoute requireRole="admin"><AdminLayout /></ProtectedRoute>}>
                  <Route index element={<Navigate to="/admin/overview" replace />} />
                  <Route path="overview" element={<AdminOverview />} />
                  <Route path="directory" element={<Navigate to="/admin/directory/shops" replace />} />
                  <Route path="directory/shops" element={<DirectoryShops />} />
                  <Route path="directory/mess" element={<DirectoryMess />} />
                  <Route path="directory/pg" element={<DirectoryPG />} />
                  <Route path="directory/categories" element={<DirectoryCategories />} />
                  <Route path="directory/inbox" element={<DirectoryInbox />} />
                  <Route path="directory/quality" element={<Navigate to="/admin/system/quality" replace />} />
                  <Route path="sections" element={<SectionsHub />} />
                  <Route path="sections/:key" element={<SectionDetail />} />
                  <Route path="marketing" element={<Navigate to="/admin/marketing/ads" replace />} />
                  <Route path="marketing/ads" element={<MarketingAds />} />
                  <Route path="insights" element={<Navigate to="/admin/insights/analytics" replace />} />
                  <Route path="insights/analytics" element={<InsightsAnalytics />} />
                  <Route path="system" element={<Navigate to="/admin/system/data" replace />} />
                  <Route path="system/data" element={<SystemData />} />
                  <Route path="system/quality" element={<DirectoryQuality />} />
                  <Route path="system/marathi" element={<SystemMarathi />} />
                  <Route path="system/mcp" element={<SystemMcp />} />
                </Route>
                <Route path="/my-shop" element={<ProtectedRoute><MyShop /></ProtectedRoute>} />
                <Route path="/my-institute" element={<ProtectedRoute><MyShop /></ProtectedRoute>} />
                <Route path="/saved-shops" element={<SavedShops />} />
                <Route path="/error/:code" element={<ErrorRoute />} />

                {/* Root redirect to active town */}
                <Route path="/" element={<RootCityRedirect />} />

                {/* Legacy un-prefixed URLs: cleanly redirect to active town */}
                <Route path="/shops" element={<LegacyCityRedirect to="/shops" />} />
                <Route path="/category/:id" element={<LegacyCategoryRedirect />} />
                <Route path="/shop/:id" element={<LegacyShopDetailRedirect />} />
                <Route path="/bus-timetable" element={<LegacyCityRedirect to="/bus-timetable" />} />
                <Route path="/schools" element={<LegacyCityRedirect to="/schools" />} />
                <Route path="/schools/:id" element={<LegacySchoolDetailRedirect />} />
                <Route path="/mess" element={<LegacyCityRedirect to="/mess" />} />
                <Route path="/mess/:id" element={<LegacyLivingDetailRedirect module="mess" />} />
                <Route path="/pg" element={<LegacyCityRedirect to="/pg" />} />
                <Route path="/pg/:id" element={<LegacyLivingDetailRedirect module="pg" />} />
                <Route path="/services" element={<LegacyCityRedirect to="/services" />} />
                <Route path="/news" element={<LegacyCityRedirect to="/news" />} />
                <Route path="/sections/:key" element={<LegacySectionRedirect />} />

                {/* Town-prefixed routes */}
                <Route path="/:citySlug" element={<CityRouteGuard><Home /></CityRouteGuard>} />
                <Route path="/:citySlug/shops" element={<CityRouteGuard><Shops /></CityRouteGuard>} />
                <Route path="/:citySlug/category/:id" element={<CityRouteGuard><CategoryRedirect /></CityRouteGuard>} />
                <Route path="/:citySlug/shop/:id" element={<CityRouteGuard><ShopDetail /></CityRouteGuard>} />
                <Route path="/:citySlug/bus-timetable" element={<CityRouteGuard><BusTimetable /></CityRouteGuard>} />
                <Route path="/:citySlug/schools" element={<CityRouteGuard><Schools /></CityRouteGuard>} />
                <Route path="/:citySlug/schools/:id" element={<CityRouteGuard><SchoolDetail /></CityRouteGuard>} />
                <Route path="/:citySlug/mess" element={<CityRouteGuard><Mess /></CityRouteGuard>} />
                <Route path="/:citySlug/mess/:id" element={<CityRouteGuard><MessDetail /></CityRouteGuard>} />
                <Route path="/:citySlug/pg" element={<CityRouteGuard><PG /></CityRouteGuard>} />
                <Route path="/:citySlug/pg/:id" element={<CityRouteGuard><PGDetail /></CityRouteGuard>} />
                <Route path="/:citySlug/services" element={<CityRouteGuard><EssentialServices /></CityRouteGuard>} />
                <Route path="/:citySlug/news" element={<CityRouteGuard><LocalNews /></CityRouteGuard>} />
                <Route path="/:citySlug/sections/:key" element={<CityRouteGuard><SectionComingSoon /></CityRouteGuard>} />

                {/* Fallback 404 */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </CityProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
