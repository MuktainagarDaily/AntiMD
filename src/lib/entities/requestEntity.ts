/**
 * RequestEntity — `EntityDef<T>` instance for shop & living listing requests.
 * Powers columns + identity for `RequestsTab` (`<EntityTab/>` migration).
 * Data loading stays in RequestsTab (status-filtered query).
 */
import { supabase } from '@/integrations/supabase/client';
import type { EntityDef, EntityColumn } from './types';
import { createElement } from 'react';

export type RequestStatus = 'pending' | 'approved' | 'rejected';
export type RequestEntityType = 'shop' | 'mess' | 'pg' | 'school';

export interface RequestRow {
  id: string;
  name: string;
  phone: string;
  whatsapp: string | null;
  address: string | null;
  area: string | null;
  sub_area?: string | null;
  description?: string | null;
  city_id?: string | null;
  village_id?: string | null;
  category_text: string | null;
  opening_time: string | null;
  closing_time: string | null;
  image_url: string | null;
  photos?: string[] | null;
  entity_type?: RequestEntityType | null;
  meta?: Record<string, any> | null;
  submitter_name: string | null;
  status: RequestStatus;
  admin_notes: string | null;
  created_at: string;
  latitude: number | null;
  longitude: number | null;
  maps_link: string | null;
  amenities: string[] | null;
}

function statusBadge(status: RequestStatus) {
  if (status === 'pending')
    return createElement(
      'span',
      {
        className:
          'px-2 py-0.5 rounded-full text-xs font-semibold bg-secondary/15 text-secondary border border-secondary/30',
      },
      '⏳ Pending',
    );
  if (status === 'approved')
    return createElement(
      'span',
      {
        className:
          'px-2 py-0.5 rounded-full text-xs font-semibold bg-success/10 text-success border border-success/30',
      },
      '✅ Approved',
    );
  return createElement(
    'span',
    {
      className:
        'px-2 py-0.5 rounded-full text-xs font-semibold bg-destructive/10 text-destructive border border-destructive/30',
    },
    '❌ Rejected',
  );
}

function entityBadge(type?: RequestEntityType | null) {
  if (type === 'mess') {
    return createElement(
      'span',
      { className: 'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/30 mr-1.5' },
      '🍲 Mess'
    );
  }
  if (type === 'pg') {
    return createElement(
      'span',
      { className: 'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/10 text-blue-600 border border-blue-500/30 mr-1.5' },
      '🛏️ PG'
    );
  }
  if (type === 'school') {
    return createElement(
      'span',
      { className: 'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-purple-500/10 text-purple-600 border border-purple-500/30 mr-1.5' },
      '🎓 School'
    );
  }
  return createElement(
    'span',
    { className: 'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-primary/10 text-primary border border-primary/30 mr-1.5' },
    '🏪 Shop'
  );
}

const columns: EntityColumn<RequestRow>[] = [
  {
    key: 'shop',
    header: 'Listing & Entity',
    render: (req) =>
      createElement(
        'div',
        null,
        createElement(
          'div',
          { className: 'font-semibold text-foreground flex items-center flex-wrap gap-1' },
          entityBadge(req.entity_type),
          req.name,
          req.photos && req.photos.length > 1 && createElement(
            'span',
            { className: 'text-[10px] text-muted-foreground px-1 py-0.2 rounded bg-muted font-normal' },
            `📸 ${req.photos.length}`
          ),
        ),
        req.phone &&
          createElement('div', { className: 'text-xs text-muted-foreground' }, req.phone),
        req.submitter_name &&
          createElement(
            'div',
            { className: 'text-xs text-muted-foreground italic' },
            `by ${req.submitter_name}`,
          ),
      ),
  },
  {
    key: 'area',
    header: 'Area',
    hideOnMobile: true,
    render: (req) =>
      createElement('span', { className: 'text-muted-foreground text-sm' }, req.area || '—'),
  },
  {
    key: 'category',
    header: 'Category / Details',
    hideOnMobile: true,
    render: (req) =>
      createElement(
        'span',
        { className: 'text-muted-foreground text-sm' },
        req.category_text || '—',
      ),
  },
  { key: 'status', header: 'Status', render: (req) => statusBadge(req.status) },
];

async function loadRequests(): Promise<RequestRow[]> {
  const { data, error } = await supabase
    .from('shop_requests')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as RequestRow[];
}

export const RequestEntity: EntityDef<RequestRow> = {
  key: 'request',
  labelSingular: 'Request',
  labelPlural: 'Listing Requests',
  listQueryKey: ['admin-requests'],
  listFn: loadRequests,
  columns,
};

export { statusBadge, entityBadge };
