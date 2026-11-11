import { AnalyticsTab } from '@/components/admin/AnalyticsTab';
import { BranchTabs } from '@/components/admin/layout/BranchTabs';
import { ADMIN_NAV } from '@/components/admin/layout/adminNav';

export default function InsightsAnalytics() {
  const hub = ADMIN_NAV.find((h) => h.key === 'insights')!;
  return (
    <div>
      <BranchTabs leaves={hub.leaves} />
      <AnalyticsTab />
    </div>
  );
}
