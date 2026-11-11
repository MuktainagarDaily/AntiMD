import { Outlet, useLocation, useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Home, LogOut, MoreVertical, ChevronRight, MapPin, Check, ChevronDown } from 'lucide-react';
import { PageSeo } from '@/components/seo/PageSeo';
import { useAuth } from '@/hooks/useAuth';
import { useCity } from '@/hooks/useCity';
import { supabase } from '@/integrations/supabase/client';
import { AdminSidebar } from './AdminSidebar';
import { findActive } from './adminNav';
import { isMissingRelationErr } from '@/lib/entities/claimEntity';

export function AdminLayout() {
  const { townBrand, currentCity, allCities, setCity } = useCity();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, signOut } = useAuth();
  const active = findActive(pathname);

  const handleCityChange = (slug: string) => {
    setCity(slug);
    qc.invalidateQueries({ queryKey: ['admin-shops'] });
    qc.invalidateQueries({ queryKey: ['admin-stats'] });
    qc.invalidateQueries({ queryKey: ['admin-bus-timetable'] });
    qc.invalidateQueries({ queryKey: ['schools'] });
  };

  // Inbox badge — shared across sidebar and breadcrumb pill.
  const { data: inboxStats } = useQuery({
    queryKey: ['admin-inbox-counts'],
    queryFn: async () => {
      const [{ count: pending }, { count: shopClaims }, schoolClaimsRes] = await Promise.all([
        supabase.from('shop_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('shop_claims').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        (supabase.from('school_claims' as any) as any).select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      ]);
      const schoolClaims = schoolClaimsRes?.error && isMissingRelationErr(schoolClaimsRes.error)
        ? 0
        : (schoolClaimsRes?.count ?? 0);
      const claims = (shopClaims ?? 0) + schoolClaims;
      return { pending: pending ?? 0, claims, total: (pending ?? 0) + claims };
    },
    staleTime: 30_000,
  });

  const handleSignOut = async () => {
    await signOut();
    navigate('/admin/login');
  };

  return (
    <SidebarProvider>
      <PageSeo title={`Admin — ${townBrand}`} path="/admin" noindex />
      <div className="min-h-screen flex w-full bg-muted">
        <AdminSidebar inboxBadge={inboxStats?.total ?? 0} />

        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <header className="sticky top-0 z-30 h-14 bg-primary text-primary-foreground px-2 sm:px-4 flex items-center justify-between gap-2 shadow-md">
            <div className="flex items-center gap-2 min-w-0">
              <SidebarTrigger className="text-primary-foreground hover:bg-primary-foreground/10" />
              <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm min-w-0">
                <Link to="/admin/overview" className="font-semibold hover:underline shrink-0">Admin</Link>
                {active?.hub && active.hub.key !== 'overview' && (
                  <>
                    <ChevronRight className={`w-3.5 h-3.5 opacity-60 shrink-0 ${active?.leaf ? 'hidden sm:block' : ''}`} />
                    <Link to={active.hub.path} className={`hover:underline truncate ${active?.leaf ? 'hidden sm:inline' : ''}`}>{active.hub.label}</Link>
                  </>
                )}
                {active?.leaf && (
                  <>
                    <ChevronRight className="w-3.5 h-3.5 opacity-60 shrink-0" />
                    <span className="font-semibold truncate">{active.leaf.label}</span>
                  </>
                )}
              </nav>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {/* Location Switcher for Admin Data Management */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="flex items-center gap-1 sm:gap-1.5 bg-primary-foreground/15 hover:bg-primary-foreground/25 text-primary-foreground px-2 sm:px-2.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all border border-primary-foreground/20 shadow-sm"
                    title="Switch active location for uploads and management"
                  >
                    <MapPin className="w-3.5 h-3.5 text-accent shrink-0" />
                    <span className="truncate max-w-[75px] sm:max-w-[140px]">{currentCity.name}</span>
                    <ChevronDown className="w-3.5 h-3.5 opacity-70 shrink-0" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64 max-h-80 overflow-y-auto">
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Location for uploads &amp; data
                  </div>
                  {allCities.map((city) => {
                    const isSelected = city.id === currentCity.id;
                    return (
                      <DropdownMenuItem
                        key={city.id}
                        onClick={() => handleCityChange(city.slug)}
                        className={`flex items-center justify-between cursor-pointer ${
                          isSelected ? 'font-bold bg-primary/10 text-primary' : ''
                        }`}
                      >
                        <div className="flex flex-col min-w-0">
                          <span className="truncate">{city.name}</span>
                          <span className="text-[10px] text-muted-foreground truncate">
                            {city.name_mr ? `${city.name_mr} · ` : ''}{city.type}
                          </span>
                        </div>
                        {isSelected && <Check className="w-4 h-4 ml-2 text-primary shrink-0" />}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>

              <button
                onClick={() => navigate('/')}
                className="hidden sm:flex items-center gap-1.5 bg-primary-foreground/10 hover:bg-primary-foreground/20 px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors"
              >
                <Home className="w-4 h-4" />
                <span>Client Site</span>
              </button>
              <span className="text-xs text-primary-foreground/70 hidden xl:block truncate max-w-[200px]">{user?.email}</span>
              <button
                onClick={handleSignOut}
                className="hidden sm:flex items-center gap-1.5 bg-primary-foreground/10 hover:bg-primary-foreground/20 px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    aria-label="Admin menu"
                    className="sm:hidden inline-flex items-center justify-center w-9 h-9 rounded-lg bg-primary-foreground/10 hover:bg-primary-foreground/20"
                  >
                    <MoreVertical className="w-5 h-5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {user?.email && (
                    <>
                      <div className="px-2 py-1.5 text-xs text-muted-foreground truncate">{user.email}</div>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <DropdownMenuItem onClick={() => navigate('/')}>
                    <Home className="w-4 h-4 mr-2" /> Client Site
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
                    <LogOut className="w-4 h-4 mr-2" /> Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          <main className="flex-1 min-w-0 overflow-x-clip px-3 sm:px-4 py-4 max-w-6xl w-full mx-auto">
            <Outlet context={{ inboxStats }} />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
