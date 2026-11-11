/**
 * ShopEntity — `EntityDef<T>` instance for shops.
 * Powers the columns + identity for `ShopsTab` (`<EntityTab/>` migration).
 *
 * Data loading stays in ShopsTab (uses useInfiniteQuery for paging),
 * so listFn here is a fallback only — the tab passes dataOverride.
 */
import { supabase } from '@/integrations/supabase/client';
import type { EntityDef, EntityColumn } from './types';
import { ShieldCheck, Phone as PhoneIcon } from 'lucide-react';
import { createElement } from 'react';

export interface ShopRow {
  id: string;
  name: string;
  phone: string | null;
  area: string | null;
  is_active: boolean;
  is_verified: boolean;
  is_open: boolean;
  image_url: string | null;
  shop_categories?: Array<{ categories: { id: string; name: string; icon: string } | null } | null>;
  [k: string]: any;
}

async function loadShops(): Promise<ShopRow[]> {
  const { data, error } = await supabase
    .from('shops')
    .select('*, shop_categories(categories(id, name, icon))')
    .order('created_at', { ascending: false })
    .limit(40);
  if (error) throw error;
  return (data ?? []) as unknown as ShopRow[];
}

const columns: EntityColumn<ShopRow>[] = [
  {
    key: 'shop',
    header: 'Shop',
    render: (shop) =>
      createElement(
        'div',
        null,
        createElement(
          'div',
          { className: 'font-semibold text-foreground flex items-center gap-1.5' },
          shop.name,
          shop.is_verified &&
            createElement(
              'span',
              { title: 'Verified' },
              createElement(ShieldCheck, { className: 'w-3.5 h-3.5 text-primary shrink-0' }),
            ),
        ),
        shop.phone &&
          createElement(
            'a',
            {
              href: `tel:${shop.phone}`,
              className:
                'text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1 mt-0.5',
            },
            createElement(PhoneIcon, { className: 'w-3 h-3' }),
            ` ${shop.phone}`,
          ),
      ),
  },
  {
    key: 'categories',
    header: 'Categories',
    hideOnMobile: true,
    render: (shop) => {
      const cats =
        shop.shop_categories
          ?.map((sc) => sc?.categories)
          .filter((c): c is { id: string; name: string; icon: string } => !!c) ?? [];
      if (cats.length === 0)
        return createElement('span', { className: 'text-muted-foreground text-xs' }, '—');
      return createElement(
        'div',
        { className: 'flex flex-wrap gap-1' },
        ...cats.map((c, i) =>
          createElement(
            'span',
            {
              key: i,
              className: 'text-xs px-2 py-0.5 rounded-full font-medium bg-primary/10 text-primary',
            },
            `${c.icon} ${c.name}`,
          ),
        ),
      );
    },
  },
  {
    key: 'area',
    header: 'Area',
    hideOnMobile: true,
    render: (shop) =>
      createElement(
        'span',
        { className: 'text-muted-foreground text-sm' },
        shop.area || '—',
      ),
  },
];

export const ShopEntity: EntityDef<ShopRow> = {
  key: 'shop',
  labelSingular: 'Shop',
  labelPlural: 'Shops',
  listQueryKey: ['admin-shops'],
  listFn: loadShops,
  columns,
};
