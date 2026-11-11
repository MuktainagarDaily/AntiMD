import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CategoriesTab } from '@/components/admin/CategoriesTab';
import { CategoryModal } from '@/components/admin/CategoryModal';
import { BranchTabs } from '@/components/admin/layout/BranchTabs';
import { ADMIN_NAV } from '@/components/admin/layout/adminNav';
import { useAdminOutletInbox } from './_useAdminOutlet';

export default function DirectoryCategories() {
  const qc = useQueryClient();
  const [form, setForm] = useState<any>(null);
  const inbox = useAdminOutletInbox();
  const directory = ADMIN_NAV.find((h) => h.key === 'directory')!;

  return (
    <div>
      <BranchTabs leaves={directory.leaves} badges={{ inbox: inbox.total }} />
      <CategoriesTab onEdit={(c) => setForm(c)} />
      {form !== null && (
        <CategoryModal
          category={form}
          onClose={() => setForm(null)}
          onSaved={() => { setForm(null); qc.invalidateQueries({ queryKey: ['admin-categories'] }); }}
        />
      )}
    </div>
  );
}
