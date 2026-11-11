import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { ShopsTab } from '@/components/admin/ShopsTab';
import { ShopModal } from '@/components/admin/ShopModal';
import { CsvImportModal } from '@/components/admin/CsvImportModal';
import { SpeedShopModal } from '@/components/admin/SpeedShopModal';
import { BranchTabs } from '@/components/admin/layout/BranchTabs';
import { ADMIN_NAV } from '@/components/admin/layout/adminNav';
import { useAdminOutletInbox } from './_useAdminOutlet';

export default function DirectoryShops() {
  const qc = useQueryClient();
  const [shopForm, setShopForm] = useState<any>(null);
  const [showImport, setShowImport] = useState(false);
  const [showSpeed, setShowSpeed] = useState(false);
  const [params, setParams] = useSearchParams();
  const inbox = useAdminOutletInbox();

  useEffect(() => {
    if (params.get('new') === '1') {
      setShopForm({});
      const next = new URLSearchParams(params);
      next.delete('new');
      setParams(next, { replace: true });
    }
  }, [params, setParams]);

  const directory = ADMIN_NAV.find((h) => h.key === 'directory')!;

  return (
    <div>
      <BranchTabs leaves={directory.leaves} badges={{ inbox: inbox.total }} />
      <ShopsTab
        onEdit={(s) => setShopForm(s)}
        onImport={() => setShowImport(true)}
        onSpeedAdd={() => setShowSpeed(true)}
      />
      {shopForm !== null && (
        <ShopModal
          shop={shopForm}
          onClose={() => setShopForm(null)}
          onSaved={() => {
            setShopForm(null);
            qc.invalidateQueries({ queryKey: ['admin-shops'] });
            qc.invalidateQueries({ queryKey: ['admin-stats'] });
          }}
        />
      )}
      {showImport && (
        <CsvImportModal onClose={() => setShowImport(false)} onDone={() => { setShowImport(false); qc.invalidateQueries({ queryKey: ['admin-shops'] }); }} />
      )}
      {showSpeed && (
        <SpeedShopModal onClose={() => setShowSpeed(false)} onDone={() => { setShowSpeed(false); qc.invalidateQueries({ queryKey: ['admin-shops'] }); }} />
      )}
    </div>
  );
}
