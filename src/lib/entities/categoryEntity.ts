/**
 * CategoryEntity — first `EntityDef<T>` instance (Forge rec #1, pilot).
 *
 * Why Category and not Shop: Sentinel marks `ShopsTab` and `ShopCard` as
 * Business Critical. Per `docs/FORGE_REPORT.md` Phase 3, the framework
 * migrates *non-protected* tabs first; Shops/Requests follow only after
 * the framework has proven out here.
 */
import { supabase } from '@/integrations/supabase/client';
import type { EntityDef, EntityColumn } from './types';
import { CategoryIcon } from '@/components/shared/CategoryIcon';
import { Check, EyeOff } from 'lucide-react';
import { createElement } from 'react';

export interface CategoryRow {
  id: string;
  name: string;
  icon: string;
  is_active: boolean;
  shopCount: number;
}

async function loadCategories(): Promise<CategoryRow[]> {
  const [{ data: cats, error: catErr }, { data: links, error: linkErr }] = await Promise.all([
    supabase.from('categories').select('*').order('name'),
    supabase.from('shop_categories').select('category_id'),
  ]);
  if (catErr) throw catErr;
  if (linkErr) throw linkErr;
  const countMap = new Map<string, number>();
  (links || []).forEach((row: any) => {
    countMap.set(row.category_id, (countMap.get(row.category_id) || 0) + 1);
  });
  return (cats || []).map((c: any) => ({
    id: c.id,
    name: c.name,
    icon: c.icon,
    is_active: c.is_active,
    shopCount: countMap.get(c.id) || 0,
  }));
}

const columns: EntityColumn<CategoryRow>[] = [
  {
    key: 'icon',
    header: 'Icon',
    render: (cat) =>
      createElement(
        'span',
        { className: 'inline-flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 text-primary' },
        createElement(CategoryIcon, { name: cat.name, className: 'w-5 h-5' }),
      ),
  },
  {
    key: 'name',
    header: 'Name',
    render: (cat) => createElement('span', { className: 'font-semibold text-foreground' }, cat.name),
  },
  {
    key: 'shops',
    header: 'Shops',
    hideOnMobile: true,
    render: (cat) =>
      createElement(
        'span',
        {
          className: `inline-flex items-center justify-center min-w-[1.75rem] px-2 py-0.5 rounded-full text-xs font-bold ${
            cat.shopCount > 0 ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
          }`,
        },
        cat.shopCount,
      ),
  },
  {
    key: 'status',
    header: 'Status',
    render: (cat) =>
      createElement(
        'span',
        {
          className: `inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
            cat.is_active
              ? 'bg-success/10 text-success border border-success/30'
              : 'bg-muted text-muted-foreground border border-border'
          }`,
        },
        cat.is_active
          ? createElement(Check, { className: 'w-3 h-3' })
          : createElement(EyeOff, { className: 'w-3 h-3' }),
        cat.is_active ? ' Active' : ' Disabled',
      ),
  },
];

export const CategoryEntity: EntityDef<CategoryRow> = {
  key: 'category',
  labelSingular: 'Category',
  labelPlural: 'Categories',
  listQueryKey: ['admin-categories'],
  listFn: loadCategories,
  columns,
};
