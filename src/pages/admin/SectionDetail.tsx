import { useParams, Link } from 'react-router-dom';
import { ADMIN_NAV } from '@/components/admin/layout/adminNav';
import { BusTimetableTab } from '@/components/admin/BusTimetableTab';
import { SchoolsTab } from '@/components/admin/SchoolsTab';
import { GovernmentServicesTab } from '@/components/admin/GovernmentServicesTab';
import { Construction, ArrowLeft } from 'lucide-react';

/** Pluggable: register a section here to wire its admin UI. */
const SECTION_COMPONENTS: Record<string, React.ComponentType> = {
  bus: BusTimetableTab,
  schools: SchoolsTab,
  gov: GovernmentServicesTab,
};

export default function SectionDetail() {
  const { key = '' } = useParams<{ key: string }>();
  const hub = ADMIN_NAV.find((h) => h.key === 'sections')!;
  const leaf = hub.leaves.find((l) => l.key === key);
  const Component = SECTION_COMPONENTS[key];

  if (!leaf) {
    return (
      <div className="rounded-xl border bg-card p-6 text-center">
        <p className="text-sm">Unknown section.</p>
        <Link to="/admin/sections" className="text-sm text-primary hover:underline mt-2 inline-block">
          ← Back to Sections
        </Link>
      </div>
    );
  }

  const Icon = leaf.icon;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Icon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight truncate">{leaf.label}</h1>
            <div className={`text-[10px] uppercase tracking-wider ${leaf.status === 'live' ? 'text-emerald-600' : 'text-muted-foreground'}`}>
              {leaf.status === 'live' ? '● Live on public site' : 'Coming soon'}
            </div>
          </div>
        </div>
        <Link to="/admin/sections" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 shrink-0">
          <ArrowLeft className="w-3.5 h-3.5" /> All sections
        </Link>
      </div>

      {Component ? (
        <Component />
      ) : (
        <div className="rounded-xl border-2 border-dashed bg-card p-10 text-center">
          <Construction className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <h2 className="font-semibold mb-1">{leaf.label} — Coming soon</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            This slot is reserved. Once the {leaf.label.toLowerCase()} feature ships, its management tools will appear here automatically.
          </p>
        </div>
      )}
    </div>
  );
}
