import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { DataQualityTab } from '@/components/admin/DataQualityTab';
import { ShopModal } from '@/components/admin/ShopModal';
import { BranchTabs } from '@/components/admin/layout/BranchTabs';
import { ADMIN_NAV } from '@/components/admin/layout/adminNav';
import { useAdminOutletInbox } from './_useAdminOutlet';

export default function DirectoryQuality() {
  const qc = useQueryClient();
  const [shopForm, setShopForm] = useState<any>(null);
  const system = ADMIN_NAV.find((h) => h.key === 'system')!;

  return (
    <div>
      <BranchTabs leaves={system.leaves} />
      <DataQualityTab onEditShop={(s) => setShopForm(s)} />
      {shopForm !== null && (
        <ShopModal
          shop={shopForm}
          onClose={() => setShopForm(null)}
          onSaved={() => { setShopForm(null); qc.invalidateQueries({ queryKey: ['admin-shops'] }); }}
        />
      )}
    </div>
  );
}
