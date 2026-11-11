import { useState } from 'react';
import { Languages } from 'lucide-react';
import { MarathiBackfillModal } from '@/components/admin/MarathiBackfillModal';
import { BranchTabs } from '@/components/admin/layout/BranchTabs';
import { ADMIN_NAV } from '@/components/admin/layout/adminNav';

export default function SystemMarathi() {
  const [show, setShow] = useState(false);
  const hub = ADMIN_NAV.find((h) => h.key === 'system')!;

  return (
    <div>
      <BranchTabs leaves={hub.leaves} />
      <div className="rounded-xl border bg-card p-5">
        <h2 className="font-semibold mb-1">Marathi translations</h2>
        <p className="text-sm text-muted-foreground mb-4">Auto-fill missing Marathi names for shops, categories, and supporting content. Existing admin-entered translations are never overwritten.</p>
        <button
          onClick={() => setShow(true)}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition flex items-center gap-2"
        >
          <Languages className="w-4 h-4" /> Open backfill tool
        </button>
      </div>
      <MarathiBackfillModal open={show} onClose={() => setShow(false)} />
    </div>
  );
}
