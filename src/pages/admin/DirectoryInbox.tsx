import { useQueryClient } from '@tanstack/react-query';
import { InboxTab } from '@/components/admin/InboxTab';
import { BranchTabs } from '@/components/admin/layout/BranchTabs';
import { ADMIN_NAV } from '@/components/admin/layout/adminNav';
import { useAdminOutletInbox } from './_useAdminOutlet';

export default function DirectoryInbox() {
  const qc = useQueryClient();
  const inbox = useAdminOutletInbox();
  const directory = ADMIN_NAV.find((h) => h.key === 'directory')!;

  return (
    <div>
      <BranchTabs leaves={directory.leaves} badges={{ inbox: inbox.total }} />
      <InboxTab
        pendingRequests={inbox.pending}
        pendingClaims={inbox.claims}
        onShopCreated={() => {
          qc.invalidateQueries({ queryKey: ['admin-shops'] });
          qc.invalidateQueries({ queryKey: ['admin-stats'] });
          qc.invalidateQueries({ queryKey: ['admin-inbox-counts'] });
        }}
      />
    </div>
  );
}
