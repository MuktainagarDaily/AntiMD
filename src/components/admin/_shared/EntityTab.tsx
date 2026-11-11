/**
 * <EntityTab/> — schema-driven admin CRUD shell. v2.
 *
 * Forge recommendation #2 (Phase 3 Platform). Extended in 2026-06-30
 * to cover the union of features used by ShopsTab + RequestsTab:
 *  - header with title/subtitle/count/add button/toolbar extras
 *  - debounced search input slot
 *  - arbitrary filters render slot (chips, selects, pipeline pills)
 *  - banner slot (e.g. "Scan broken images" callout)
 *  - desktop table from EntityDef.columns
 *  - optional mobile-card render prop
 *  - custom rowActions + per-row className
 *  - data override (when caller uses useInfiniteQuery or custom hook)
 *  - footer slot (infinite-scroll sentinel, load-more)
 *  - emptyState full override + skeleton row count
 *
 * BusTimetableTab and AdvertisementsTab intentionally do NOT use this
 * shell — their layouts (embedded sub-editor / KPI strip + grouped
 * multi-tier sections) are not "list of rows in a table". Forcing
 * them in would bloat the framework. See FORGE_RECOMMENDATIONS.md.
 */
import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search as SearchIcon } from 'lucide-react';
import type { EntityDef } from '@/lib/entities/types';

interface SearchProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

interface DataOverride<T> {
  rows: T[];
  isLoading: boolean;
  /** Force the empty branch even when rows.length > 0 (rare; for filtered views). */
  isEmpty?: boolean;
}

interface EntityTabProps<T> {
  entity: EntityDef<T>;
  /** Override columns per render. Defaults to `entity.columns`. */
  columns?: EntityDef<T>['columns'];

  // ── Header ───────────────────────────────────────────────────
  /** Override the default `${labelPlural} (n)` heading. */
  title?: ReactNode;
  subtitle?: ReactNode;
  onAdd?: () => void;
  addLabel?: string;
  /** Right-aligned toolbar buttons (CSV, Speed Add, overflow). */
  toolbarExtras?: ReactNode;

  // ── Filtering chrome ─────────────────────────────────────────
  search?: SearchProps;
  /** Anything rendered between search and the list — quick filters, pipeline pills, etc. */
  filters?: ReactNode;
  /** Callout between filters and the list (scan banner, info pill, …). */
  banner?: ReactNode;

  // ── Data ─────────────────────────────────────────────────────
  /** Skip the built-in useQuery and feed rows from the caller (infinite query etc.). */
  dataOverride?: DataOverride<T>;

  // ── Rendering ────────────────────────────────────────────────
  mobileCard?: (row: T) => ReactNode;
  rowActions?: (row: T) => ReactNode;
  rowClassName?: (row: T) => string;

  // ── Footer ───────────────────────────────────────────────────
  footer?: ReactNode;

  // ── Empty / loading ──────────────────────────────────────────
  /** Full override for the empty branch. */
  emptyState?: ReactNode;
  emptyMessage?: string;
  skeletonRows?: number;
}

export function EntityTab<T>({
  entity,
  columns: columnsOverride,
  title,
  subtitle,
  onAdd,
  addLabel,
  toolbarExtras,
  search,
  filters,
  banner,
  dataOverride,
  mobileCard,
  rowActions,
  rowClassName,
  footer,
  emptyState,
  emptyMessage,
  skeletonRows = 4,
}: EntityTabProps<T>) {
  const columns = columnsOverride ?? entity.columns;
  const getRowKey = entity.getRowKey ?? ((row: T) => (row as any).id as string);

  // Built-in query; bypassed entirely when dataOverride is supplied.
  const builtIn = useQuery({
    queryKey: entity.listQueryKey,
    queryFn: entity.listFn,
    enabled: !dataOverride,
  });

  const rows = dataOverride?.rows ?? (builtIn.data ?? []);
  const isLoading = dataOverride ? dataOverride.isLoading : builtIn.isLoading;
  const isEmpty = (dataOverride?.isEmpty ?? rows.length === 0) && !isLoading;

  const colSpan = columns.length + (rowActions ? 1 : 0);
  const headerTitle = title ?? (
    <>
      {entity.labelPlural}{' '}
      <span className="text-muted-foreground font-medium text-sm">({rows.length})</span>
    </>
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h2 className="text-lg sm:text-xl font-bold text-foreground">{headerTitle}</h2>
          {subtitle && <div className="text-xs text-muted-foreground mt-0.5">{subtitle}</div>}
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          {toolbarExtras}
          {onAdd && (
            <button
              onClick={onAdd}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-3 py-2 rounded-lg font-semibold text-sm hover:bg-primary/90"
            >
              <Plus className="w-4 h-4" /> {addLabel ?? `Add ${entity.labelSingular}`}
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      {search && (
        <div className="relative mb-3">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={search.value}
            onChange={(e) => search.onChange(e.target.value)}
            placeholder={search.placeholder ?? `Search ${entity.labelPlural.toLowerCase()}…`}
            className="w-full pl-9 pr-3 h-10 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      )}

      {/* Filters slot */}
      {filters && <div className="mb-3">{filters}</div>}

      {/* Banner slot */}
      {banner && <div className="mb-3">{banner}</div>}

      {/* Body */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: skeletonRows }, (_, i) => (
            <div key={i} className="bg-card rounded-xl p-4 border border-border skeleton-shimmer h-16" />
          ))}
        </div>
      ) : isEmpty ? (
        emptyState ?? (
          <div className="bg-card rounded-xl border border-border p-10 text-center text-muted-foreground">
            {emptyMessage ?? `No ${entity.labelPlural.toLowerCase()} yet.`}
          </div>
        )
      ) : (
        <>
          {/* Mobile: card list (when mobileCard provided), desktop: table */}
          {mobileCard && (
            <div className="md:hidden space-y-2">
              {rows.map((row) => (
                <div key={getRowKey(row)}>{mobileCard(row)}</div>
              ))}
            </div>
          )}

          <div
            className={`${mobileCard ? 'hidden md:block' : ''} bg-card rounded-xl border border-border overflow-hidden`}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-muted/60 border-b border-border">
                    {columns.map((c) => (
                      <th
                        key={c.key}
                        className={`px-4 py-3 font-semibold text-foreground ${
                          c.align === 'right' ? 'text-right' : 'text-left'
                        } ${c.hideOnMobile ? 'hidden sm:table-cell' : ''}`}
                      >
                        {c.header}
                      </th>
                    ))}
                    {rowActions && (
                      <th className="text-right px-4 py-3 font-semibold text-foreground">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={getRowKey(row)}
                      className={`border-b border-border last:border-0 hover:bg-muted/30 transition-colors ${
                        rowClassName?.(row) ?? ''
                      }`}
                    >
                      {columns.map((c) => (
                        <td
                          key={c.key}
                          className={`px-4 py-3 ${c.align === 'right' ? 'text-right' : ''} ${
                            c.hideOnMobile ? 'hidden sm:table-cell' : ''
                          } ${c.className ?? ''}`}
                        >
                          {c.render(row)}
                        </td>
                      ))}
                      {rowActions && (
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">{rowActions(row)}</div>
                        </td>
                      )}
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={colSpan} className="text-center py-10 text-muted-foreground">
                        {emptyMessage ?? `No ${entity.labelPlural.toLowerCase()} yet.`}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {footer}
    </div>
  );
}
