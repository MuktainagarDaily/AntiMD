import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { DataQualityTab } from '@/components/admin/DataQualityTab';
import { ShopModal } from '@/components/admin/ShopModal';
import { SchoolModal } from '@/components/admin/SchoolModal';
import { BranchTabs } from '@/components/admin/layout/BranchTabs';
import { ADMIN_NAV } from '@/components/admin/layout/adminNav';

export default function DirectoryQuality() {
  const qc = useQueryClient();
  const [shopForm, setShopForm] = useState<any>(null);
  const [schoolForm, setSchoolForm] = useState<any>(null);
  const system = ADMIN_NAV.find((h) => h.key === 'system')!;

  return (
    <div>
      <BranchTabs leaves={system.leaves} />
      <DataQualityTab
        onEditShop={(s) => setShopForm(s)}
        onEditSchool={(sc) => setSchoolForm(sc)}
      />
      {shopForm !== null && (
        <ShopModal
          shop={shopForm}
          onClose={() => setShopForm(null)}
          onSaved={() => {
            setShopForm(null);
            qc.invalidateQueries({ queryKey: ['admin-shops'] });
            qc.invalidateQueries({ queryKey: ['admin-shops-quality'] });
            qc.invalidateQueries({ queryKey: ['admin-stats'] });
          }}
        />
      )}
      {schoolForm !== null && (
        <SchoolModal
          school={schoolForm}
          onClose={() => setSchoolForm(null)}
          onSaved={() => {
            setSchoolForm(null);
            qc.invalidateQueries({ queryKey: ['admin-schools'] });
            qc.invalidateQueries({ queryKey: ['admin-schools-quality'] });
            qc.invalidateQueries({ queryKey: ['admin-stats'] });
          }}
        />
      )}
    </div>
  );
}
