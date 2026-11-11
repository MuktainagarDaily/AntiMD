/**
 * ClaimEntity — `EntityDef<T>` instance for pending shop ownership claims.
 * Powers columns + identity for `PendingClaims` (`<ModerationQueue/>` migration,
 * Forge rec #12).
 *
 * Data loading stays in `InboxTab` so it can hydrate profile + shop joins
 * in a single trip, matching the existing behavior — this entity's `listFn`
 * is a minimal fallback and is bypassed via `dataOverride`.
 */
import { supabase } from '@/integrations/supabase/client';
import { createElement } from 'react';
import { ShieldCheck, FileText, GraduationCap, Store } from 'lucide-react';
import type { EntityDef, EntityColumn } from './types';

export interface ClaimRow {
  id: string;
  shop_id: string | null;
  school_id?: string | null;
  entity_kind?: 'shop' | 'school';
  user_id: string;
  contact_phone: string | null;
  note: string | null;
  status: string;
  created_at: string;
  proof_image_path: string | null;
  proof_type: string | null;
  admin_notes: string | null;
  role_claimed?: string | null;
  udise_or_id?: string | null;
  profiles: { full_name: string | null; phone?: string | null } | null;
  shops: { name: string | null; phone?: string | null; area?: string | null; is_verified?: boolean } | null;
  schools?: {
    name: string | null;
    phone?: string | null;
    area?: string | null;
    is_verified?: boolean;
    udise_aishe_code?: string | null;
  } | null;
}

export function isMissingRelationErr(error: any): boolean {
  if (!error) return false;
  const code = String(error.code ?? '');
  const msg = String(error.message ?? '').toLowerCase();
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    msg.includes('does not exist') ||
    msg.includes('could not find the table') ||
    msg.includes('schema cache')
  );
}

function proofBadge(row: ClaimRow) {
  if (row.proof_image_path) {
    return createElement(
      'span',
      {
        className:
          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-success/15 text-success border border-success/30',
      },
      createElement(ShieldCheck, { className: 'w-3 h-3' }),
      'Proof attached',
    );
  }
  return createElement(
    'span',
    {
      className:
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30',
    },
    createElement(FileText, { className: 'w-3 h-3' }),
    'No proof',
  );
}

const columns: EntityColumn<ClaimRow>[] = [
  {
    key: 'shop',
    header: 'Listing',
    render: (row) => {
      const isSchool = row.entity_kind === 'school' || !!row.school_id;
      const targetName = isSchool ? row.schools?.name : row.shops?.name;
      const targetArea = isSchool ? row.schools?.area : row.shops?.area;

      return createElement(
        'div',
        { className: 'space-y-0.5' },
        createElement(
          'span',
          {
            className: `inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold border ${
              isSchool
                ? 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30'
                : 'bg-primary/10 text-primary border-primary/20'
            }`,
          },
          createElement(isSchool ? GraduationCap : Store, { className: 'w-2.5 h-2.5' }),
          isSchool ? 'Institute' : 'Shop',
        ),
        createElement(
          'div',
          { className: 'font-semibold text-foreground' },
          targetName ?? '—',
        ),
        targetArea &&
          createElement('div', { className: 'text-xs text-muted-foreground' }, targetArea),
      );
    },
  },
  {
    key: 'claimant',
    header: 'Claimant',
    render: (row) => {
      const isSchool = row.entity_kind === 'school' || !!row.school_id;
      const targetPhone = isSchool ? row.schools?.phone : row.shops?.phone;

      return createElement(
        'div',
        null,
        createElement(
          'div',
          { className: 'text-sm text-foreground flex items-center gap-1.5 flex-wrap' },
          row.profiles?.full_name || `User ${row.user_id.slice(0, 8)}`,
          row.role_claimed
            ? createElement(
                'span',
                { className: 'text-[10px] px-1.5 py-0.2 rounded bg-muted text-muted-foreground font-medium' },
                row.role_claimed,
              )
            : null,
        ),
        createElement(
          'div',
          { className: 'text-xs text-muted-foreground tabular-nums' },
          row.contact_phone || '—',
          targetPhone && row.contact_phone === targetPhone
            ? createElement(
                'span',
                { className: 'ml-1 text-success font-semibold' },
                '· matches',
              )
            : null,
        ),
      );
    },
  },
  {
    key: 'proof',
    header: 'Proof',
    hideOnMobile: true,
    render: proofBadge,
  },
  {
    key: 'submitted',
    header: 'Submitted',
    hideOnMobile: true,
    render: (row) =>
      createElement(
        'span',
        { className: 'text-xs text-muted-foreground' },
        new Date(row.created_at).toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
        }),
      ),
  },
];

async function loadPendingClaims(): Promise<ClaimRow[]> {
  const { data, error } = await supabase
    .from('shop_claims')
    .select(
      'id, shop_id, user_id, contact_phone, note, status, created_at, proof_image_path, proof_type, admin_notes',
    )
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as any[]).map((r) => ({ ...r, profiles: null, shops: null })) as ClaimRow[];
}

export const ClaimEntity: EntityDef<ClaimRow> = {
  key: 'claim',
  labelSingular: 'Claim',
  labelPlural: 'Pending Claims',
  listQueryKey: ['admin-claims-pending'],
  listFn: loadPendingClaims,
  columns,
};
