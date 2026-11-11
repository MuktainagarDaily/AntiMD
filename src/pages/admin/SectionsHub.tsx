import { useNavigate } from 'react-router-dom';
import { ADMIN_NAV } from '@/components/admin/layout/adminNav';

export default function SectionsHub() {
  const navigate = useNavigate();
  const hub = ADMIN_NAV.find((h) => h.key === 'sections')!;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Sections</h1>
        <p className="text-sm text-muted-foreground">Town information hub. Pick a section to manage its content.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {hub.leaves.map((leaf) => {
          const Icon = leaf.icon;
          return (
            <button
              key={leaf.key}
              onClick={() => navigate(leaf.path)}
              className="rounded-xl border bg-card p-4 text-left hover:border-primary/40 hover:shadow-sm active:scale-[0.99] transition"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-sm leading-tight">{leaf.label}</div>
                  <div className={`text-[10px] uppercase tracking-wider ${leaf.status === 'live' ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                    {leaf.status === 'live' ? '● Live' : 'Coming soon'}
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {leaf.status === 'live'
                  ? `Manage ${leaf.label.toLowerCase()} content visible on the public site.`
                  : `Slot reserved for ${leaf.label.toLowerCase()}. Content tools land here when built.`}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
