import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Download, Upload, Plus, Zap, Inbox, Languages, MapPin, UtensilsCrossed, BedDouble, Globe, GraduationCap } from 'lucide-react';
import { isMissingRelationErr } from '@/lib/entities/claimEntity';
import { useState } from 'react';
import { ADMIN_NAV } from '@/components/admin/layout/adminNav';
import { MasterExportModal } from '@/components/admin/MasterExportModal';
import { MasterImportModal } from '@/components/admin/MasterImportModal';
import { MarathiBackfillModal } from '@/components/admin/MarathiBackfillModal';
import { SpeedShopModal } from '@/components/admin/SpeedShopModal';
import { CsvImportModal } from '@/components/admin/CsvImportModal';
import { useCity } from '@/hooks/useCity';
import { cn } from '@/lib/utils';

export default function AdminOverview() {
  const navigate = useNavigate();
  const { currentCity, townName } = useCity();
  const [statsScope, setStatsScope] = useState<'city' | 'all'>('city');
  const [showExport, setShowExport] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showMr, setShowMr] = useState(false);
  const [showSpeed, setShowSpeed] = useState(false);
  const [showCsv, setShowCsv] = useState(false);

  const { data: stats } = useQuery({
    queryKey: ['admin-stats', currentCity.id, statsScope],
    queryFn: async () => {
      const isCityScoped = statsScope === 'city';

      // Base shop queries
      let totalShopQ = supabase.from('shops').select('id', { count: 'exact', head: true });
      let activeShopQ = supabase.from('shops').select('id', { count: 'exact', head: true }).eq('is_active', true);
      let verifiedShopQ = supabase.from('shops').select('id', { count: 'exact', head: true }).eq('is_verified', true);

      if (isCityScoped) {
        totalShopQ = totalShopQ.eq('city_id', currentCity.id);
        activeShopQ = activeShopQ.eq('city_id', currentCity.id);
        verifiedShopQ = verifiedShopQ.eq('city_id', currentCity.id);
      }

      // Mess and PG count queries
      let messQ = supabase.from('mess_profiles').select('shop_id', { count: 'exact', head: true });
      let pgQ = supabase.from('pg_profiles').select('shop_id', { count: 'exact', head: true });

      const [
        { count: total },
        { count: active },
        { count: cats },
        { count: verified },
        { count: pending },
        { count: shopClaims },
        schoolClaimsRes,
        { count: messCount },
        { count: pgCount },
      ] = await Promise.all([
        totalShopQ,
        activeShopQ,
        supabase.from('categories').select('id', { count: 'exact', head: true }).eq('is_active', true),
        verifiedShopQ,
        supabase.from('shop_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('shop_claims').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        (supabase.from('school_claims' as any) as any).select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        messQ,
        pgQ,
      ]);

      const schoolClaims = schoolClaimsRes?.error && isMissingRelationErr(schoolClaimsRes.error)
        ? 0
        : (schoolClaimsRes?.count ?? 0);

      return {
        total: total ?? 0,
        active: active ?? 0,
        cats: cats ?? 0,
        verified: verified ?? 0,
        pending: pending ?? 0,
        claims: (shopClaims ?? 0) + schoolClaims,
        mess: messCount ?? 0,
        pg: pgCount ?? 0,
      };
    },
    staleTime: 30_000,
  });

  const sectionsHub = ADMIN_NAV.find((h) => h.key === 'sections')!;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
          <p className="text-sm text-muted-foreground">Everything that needs your attention at a glance.</p>
        </div>

        {/* Scope selector */}
        <div className="flex items-center gap-1.5 p-1 bg-card border border-border rounded-xl">
          <button
            onClick={() => setStatsScope('city')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
              statsScope === 'city'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>{currentCity.name}</span>
          </button>
          <button
            onClick={() => setStatsScope('all')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
              statsScope === 'all'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>All Towns</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
        <Stat label="Total Shops" value={stats?.total} icon="🏪" onClick={() => navigate('/admin/directory/shops')} />
        <Stat label="Active" value={stats?.active} icon="✅" onClick={() => navigate('/admin/directory/shops')} />
        <Stat label="Verified" value={stats?.verified} icon="🛡️" onClick={() => navigate('/admin/directory/shops')} />
        <Stat label="Mess & Dining" value={stats?.mess} icon="🍲" onClick={() => navigate('/admin/directory/mess')} />
        <Stat label="PG & Hostels" value={stats?.pg} icon="🛏️" onClick={() => navigate('/admin/directory/pg')} />
        <Stat label="Categories" value={stats?.cats} icon="🏷️" onClick={() => navigate('/admin/directory/categories')} />
        <Stat label="Requests" value={stats?.pending} icon="📬" highlight={!!stats?.pending} onClick={() => navigate('/admin/directory/inbox')} />
        <Stat label="Claims" value={stats?.claims} icon="🔑" highlight={!!stats?.claims} onClick={() => navigate('/admin/directory/inbox')} />
      </div>

      {/* Needs attention */}
      {(stats?.pending || stats?.claims) ? (
        <div className="rounded-xl border border-secondary/40 bg-secondary/5 p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-secondary/15 text-secondary flex items-center justify-center shrink-0" style={{ color: 'hsl(var(--secondary))' }}>
              <Inbox className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-sm">Needs your attention</div>
              <div className="text-xs text-muted-foreground">
                {stats.pending ? `${stats.pending} listing request${stats.pending > 1 ? 's' : ''}` : ''}
                {stats.pending && stats.claims ? ' · ' : ''}
                {stats.claims ? `${stats.claims} ownership claim${stats.claims > 1 ? 's' : ''}` : ''}
              </div>
            </div>
          </div>
          <button
            onClick={() => navigate('/admin/directory/inbox')}
            className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition shrink-0"
          >
            Review
          </button>
        </div>
      ) : null}

      {/* Quick actions */}
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Quick actions</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          <ActionCard icon={Plus} label="Add Shop" onClick={() => navigate('/admin/directory/shops?new=1')} />
          <ActionCard icon={UtensilsCrossed} label="Manage Mess" onClick={() => navigate('/admin/directory/mess')} />
          <ActionCard icon={BedDouble} label="Manage PG" onClick={() => navigate('/admin/directory/pg')} />
          <ActionCard icon={GraduationCap} label="Manage Institutes" onClick={() => navigate('/admin/sections/schools')} />
          <ActionCard icon={Zap} label="Speed Add" onClick={() => setShowSpeed(true)} />
          <ActionCard icon={Upload} label="Import CSV" onClick={() => setShowCsv(true)} />
        </div>
      </div>

      {/* Sections health */}
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Sections</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-2">
          {sectionsHub.leaves.map((leaf) => {
            const Icon = leaf.icon;
            return (
              <button
                key={leaf.key}
                onClick={() => navigate(leaf.path)}
                className="rounded-xl border bg-card p-3 text-left hover:border-primary/40 hover:shadow-sm active:scale-[0.98] transition"
              >
                <Icon className="w-5 h-5 text-primary mb-2" />
                <div className="text-sm font-semibold leading-tight">{leaf.label}</div>
                <div className={`text-[10px] mt-1 uppercase tracking-wider ${leaf.status === 'live' ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                  {leaf.status === 'live' ? '● Live' : 'Coming soon'}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* System shortcuts */}
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">System</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <ActionCard icon={Download} label="Master Export" onClick={() => setShowExport(true)} />
          <ActionCard icon={Upload} label="Master Import" onClick={() => setShowImport(true)} />
          <ActionCard icon={Languages} label="Marathi Backfill" onClick={() => setShowMr(true)} />
        </div>
      </div>

      <MasterExportModal open={showExport} onClose={() => setShowExport(false)} />
      {showImport && <MasterImportModal onClose={() => setShowImport(false)} onDone={() => setShowImport(false)} />}
      <MarathiBackfillModal open={showMr} onClose={() => setShowMr(false)} />
      {showSpeed && <SpeedShopModal onClose={() => setShowSpeed(false)} onDone={() => setShowSpeed(false)} />}
      {showCsv && <CsvImportModal onClose={() => setShowCsv(false)} onDone={() => setShowCsv(false)} />}
    </div>
  );
}

function Stat({ label, value, icon, highlight, onClick }: { label: string; value?: number; icon: string; highlight?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`bg-card rounded-xl border px-2 py-3 text-center transition-all hover:border-primary/40 hover:shadow-sm active:scale-[0.98] ${highlight ? 'border-secondary/60 ring-1 ring-secondary/20' : ''}`}
    >
      <div className="text-lg mb-0.5">{icon}</div>
      <div className="text-lg sm:text-xl font-bold leading-tight" style={highlight ? { color: 'hsl(var(--secondary))' } : undefined}>
        {value ?? '—'}
      </div>
      <div className="text-[10px] sm:text-xs text-muted-foreground leading-tight mt-0.5 truncate">{label}</div>
    </button>
  );
}

function ActionCard({ icon: Icon, label, onClick }: { icon: any; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-xl border bg-card p-3 flex items-center gap-2 hover:border-primary/40 hover:shadow-sm active:scale-[0.98] transition"
    >
      <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4" />
      </div>
      <span className="text-sm font-semibold truncate">{label}</span>
    </button>
  );
}
