/**
 * <ModerationQueue/> — approve / reject / delete framework. v1.
 *
 * Forge recommendation #12 (Phase 3 Platform). Wraps `<EntityTab/>` and
 * standardises the row-action + confirm-dialog + action-loading dance
 * that every moderation surface (listing requests, ownership claims,
 * future report queues) hand-rolls today.
 *
 * The framework owns only presentation:
 *  - action buttons in each pending row
 *  - shared confirm AlertDialog with per-action title/description/CTA
 *  - `actionLoading` disabling state
 *
 * Per-record side effects (creating the shop on approve, deleting the
 * request image on delete, invalidating pending-count queries, toast
 * copy) live entirely in the caller's async handlers. This is a
 * Sentinel Business Critical surface — the framework MUST NOT swallow
 * any of those side effects.
 */
import { useState, type ReactNode } from 'react';
import { Loader2, ThumbsUp, ThumbsDown, Trash2, AlertTriangle, CheckCircle2, Eye } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { EntityTab } from './EntityTab';
import type { EntityDef, EntityColumn } from '@/lib/entities/types';

export type ModerationAction = 'approve' | 'reject' | 'delete';

interface ActionCopy {
  title: string;
  description: ReactNode;
  cta: string;
}

interface ModerationQueueProps<T> {
  entity: EntityDef<T>;
  /** Optional column override — same semantics as EntityTab. */
  columns?: EntityColumn<T>[];

  // ── Data & filtering (passed straight through) ─────────────────
  title?: ReactNode;
  subtitle?: ReactNode;
  filters?: ReactNode;
  toolbarExtras?: ReactNode;
  emptyState?: ReactNode;
  skeletonRows?: number;
  dataOverride: { rows: T[]; isLoading: boolean };

  // ── Moderation contract ────────────────────────────────────────
  /** Discriminator — only 'pending' rows show approve/reject buttons. */
  isPending: (row: T) => boolean;
  /** Approve handler. May do arbitrary work (create shop, rename image…). */
  onApprove: (row: T) => Promise<void>;
  /** Reject handler. Typically flips status to 'rejected'. */
  onReject: (row: T) => Promise<void>;
  /** Delete handler. Typically hard-deletes the row + storage assets. */
  onDelete: (row: T) => Promise<void>;
  /** Optional "view details" click — opens the caller's detail modal. */
  onView?: (row: T) => void;

  /** Per-action copy factory. Framework provides safe defaults;
   *  caller overrides to include row-specific detail (phone numbers,
   *  image renames, category auto-map). */
  copyFor?: (action: ModerationAction, row: T) => ActionCopy;
}

const defaultCopy = <T,>(_: ModerationAction, __: T): ActionCopy => ({
  title: '',
  description: '',
  cta: '',
});

export function ModerationQueue<T extends { id: string }>({
  entity,
  columns,
  title,
  subtitle,
  filters,
  toolbarExtras,
  emptyState,
  skeletonRows,
  dataOverride,
  isPending,
  onApprove,
  onReject,
  onDelete,
  onView,
  copyFor,
}: ModerationQueueProps<T>) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ action: ModerationAction; row: T } | null>(null);

  const resolveCopy = (action: ModerationAction, row: T): ActionCopy => {
    const custom = copyFor?.(action, row);
    if (custom && custom.title) return custom;

    const name = (row as any).name ?? 'record';
    if (action === 'approve') return {
      title: `Approve "${name}"?`,
      description: 'This will publish the record.',
      cta: 'Approve',
    };
    if (action === 'reject') return {
      title: `Reject "${name}"?`,
      description: 'The record will be marked as rejected.',
      cta: 'Reject',
    };
    return {
      title: `Delete "${name}"?`,
      description: 'This action cannot be undone.',
      cta: 'Delete',
    };
  };

  const runAction = async () => {
    if (!confirm) return;
    const { action, row } = confirm;
    setConfirm(null);
    setActionLoading(row.id);
    try {
      if (action === 'approve') await onApprove(row);
      else if (action === 'reject') await onReject(row);
      else await onDelete(row);
    } finally {
      setActionLoading(null);
    }
  };

  const copy = confirm ? resolveCopy(confirm.action, confirm.row) : null;

  return (
    <>
      <EntityTab<T>
        entity={entity}
        columns={columns}
        title={title}
        subtitle={subtitle}
        filters={filters}
        toolbarExtras={toolbarExtras}
        emptyState={emptyState}
        skeletonRows={skeletonRows}
        dataOverride={dataOverride}
        rowActions={(row) => {
          const pending = isPending(row);
          const busy = actionLoading === row.id;
          return (
            <>
              {onView && (
                <button
                  onClick={() => onView(row)}
                  className="p-1.5 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                  title="View details"
                  aria-label="View details"
                >
                  <Eye className="w-4 h-4" />
                </button>
              )}
              {pending && (
                <>
                  <button
                    onClick={() => setConfirm({ action: 'approve', row })}
                    disabled={busy}
                    className="p-1.5 hover:bg-success/10 rounded-lg transition-colors disabled:opacity-50"
                    style={{ color: 'hsl(var(--success))' }}
                    title="Approve"
                    aria-label="Approve"
                  >
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ThumbsUp className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => setConfirm({ action: 'reject', row })}
                    disabled={busy}
                    className="p-1.5 text-destructive hover:bg-destructive/10 rounded-lg transition-colors disabled:opacity-50"
                    title="Reject"
                    aria-label="Reject"
                  >
                    <ThumbsDown className="w-4 h-4" />
                  </button>
                </>
              )}
              <button
                onClick={() => setConfirm({ action: 'delete', row })}
                disabled={busy}
                className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors disabled:opacity-50"
                title="Delete"
                aria-label="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          );
        }}
      />

      <AlertDialog open={!!confirm} onOpenChange={(open) => !open && !actionLoading && setConfirm(null)}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {confirm?.action === 'approve'
                ? <CheckCircle2 className="w-5 h-5 shrink-0" style={{ color: 'hsl(var(--success))' }} />
                : <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />}
              {copy?.title}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-sm text-muted-foreground space-y-2">{copy?.description}</div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!actionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={!!actionLoading}
              onClick={runAction}
              className={
                confirm?.action === 'approve'
                  ? ''
                  : 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
              }
            >
              {actionLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Working…</> : copy?.cta}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
