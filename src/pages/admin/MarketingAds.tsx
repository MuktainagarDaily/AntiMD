import { AdvertisementsTab } from '@/components/admin/AdvertisementsTab';
import { BranchTabs } from '@/components/admin/layout/BranchTabs';
import { ADMIN_NAV } from '@/components/admin/layout/adminNav';

export default function MarketingAds() {
  const hub = ADMIN_NAV.find((h) => h.key === 'marketing')!;
  return (
    <div>
      <BranchTabs leaves={hub.leaves} />
      <AdvertisementsTab />
    </div>
  );
}
