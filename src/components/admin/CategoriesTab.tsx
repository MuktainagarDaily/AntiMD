/**
 * CategoriesTab — first adopter of <EntityTab/> + EntityDef<T>.
 * (Forge recommendations #1 + #2, Phase 3 pilot.)
 *
 * The framework owns: header, count, table scaffold, columns, loading
 * skeleton, empty state. This file keeps the merge modal, the CSV
 * import/export, and the linked-shops delete dialog — those are
 * Category-specific behaviour, not framework concerns.
 */
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Pencil, Trash2, Loader2, AlertTriangle, Download, GitMerge, Upload } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CategoryMergeModal } from './CategoryMergeModal';
import { CategoryCsvImportModal } from './CategoryCsvImportModal';
import { downloadCsv } from '@/lib/csvUtils';
import { EntityTab } from './_shared/EntityTab';
import { CategoryEntity, type CategoryRow } from '@/lib/entities/categoryEntity';

interface CategoriesTabProps {
  onEdit: (cat: any) => void;
}

export function CategoriesTab({ onEdit }: CategoriesTabProps) {
  const qc = useQueryClient();
  const [deleteCatTarget, setDeleteCatTarget] = useState<CategoryRow | null>(null);
  const [deleteCatLinkedShops, setDeleteCatLinkedShops] = useState<string[]>([]);
  const [fetchingLinksFor, setFetchingLinksFor] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [mergeCatTarget, setMergeCatTarget] = useState<CategoryRow | null>(null);
  const [showCatImport, setShowCatImport] = useState(false);

  // Toggle Active is unchanged — still owned by the tab so the framework
  // doesn't have to learn about per-cell mutations in this first cut.
  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('categories').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-categories'] }),
  });

  const handleDeleteClick = async (cat: CategoryRow) => {
    setFetchingLinksFor(cat.id);
    const { data, error } = await supabase
      .from('shop_categories')
      .select('shops(name)')
      .eq('category_id', cat.id);
    if (error) {
      toast.error('Could not check linked shops. Please try again.');
      setFetchingLinksFor(null);
      return;
    }
    const shopNames = (data || []).map((row: any) => row.shops?.name).filter(Boolean) as string[];
    setDeleteCatLinkedShops(shopNames);
    setDeleteCatTarget(cat);
    setFetchingLinksFor(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteCatTarget) return;
    setDeleting(true);
    const { error } = await supabase.from('categories').delete().eq('id', deleteCatTarget.id);
    if (error) {
      toast.error('Failed to delete category');
    } else {
      toast.success('Category deleted');
      qc.invalidateQueries({ queryKey: ['admin-categories'] });
      qc.invalidateQueries({ queryKey: ['admin-stats'] });
      setDeleteCatTarget(null);
      setDeleteCatLinkedShops([]);
    }
    setDeleting(false);
  };

  // Inject a clickable Status cell that overrides the static one from
  // CategoryEntity.columns. Everything else uses entity defaults.
  const columns = CategoryEntity.columns.map((c) =>
    c.key === 'status'
      ? {
          ...c,
          render: (cat: CategoryRow) => (
            <button
              onClick={() => toggleActive.mutate({ id: cat.id, is_active: !cat.is_active })}
              className="inline-flex"
              aria-label={cat.is_active ? 'Disable category' : 'Enable category'}
            >
              {c.render(cat)}
            </button>
          ),
        }
      : c,
  );

  return (
    <>
      <EntityTab
        entity={CategoryEntity}
        columns={columns}
        onAdd={() => onEdit({})}
        addLabel="Add Category"
        toolbarExtras={
          <>
            <button
              onClick={() => {
                const headers = ['Name', 'Icon', 'Active'];
                const rows = (qc.getQueryData(['admin-categories']) as CategoryRow[] | undefined ?? [])
                  .map((c) => [c.name, c.icon, c.is_active ? 'Yes' : 'No']);
                downloadCsv('muktainagar-categories', headers, rows);
              }}
              className="flex items-center gap-2 bg-card border border-border text-foreground px-4 py-2 rounded-lg font-semibold text-sm hover:bg-muted transition-colors shrink-0"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>
            <button
              onClick={() => setShowCatImport(true)}
              className="flex items-center gap-2 bg-card border border-border text-foreground px-4 py-2 rounded-lg font-semibold text-sm hover:bg-muted transition-colors shrink-0"
            >
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">Import CSV</span>
            </button>
          </>
        }
        rowActions={(cat) => (
          <>
            {cat.shopCount > 0 && (
              <button
                onClick={() => setMergeCatTarget(cat)}
                title="Merge into another category"
                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
              >
                <GitMerge className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => onEdit(cat)}
              className="p-1.5 text-primary hover:bg-primary/10 rounded-lg transition-colors"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleDeleteClick(cat)}
              disabled={fetchingLinksFor === cat.id}
              className="p-1.5 text-destructive hover:bg-destructive/10 rounded-lg transition-colors disabled:opacity-50"
            >
              {fetchingLinksFor === cat.id ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
            </button>
          </>
        )}
      />

      <AlertDialog open={!!deleteCatTarget} onOpenChange={(open) => !open && setDeleteCatTarget(null)}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
              Delete "{deleteCatTarget?.icon} {deleteCatTarget?.name}"?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                {deleteCatLinkedShops.length > 0 ? (
                  <>
                    <p>
                      This category is linked to <strong className="text-foreground">{deleteCatLinkedShops.length} shop{deleteCatLinkedShops.length !== 1 ? 's' : ''}</strong>.
                      The category will be deleted and all links removed — the shops themselves will not be affected.
                    </p>
                    <div className="rounded-lg border border-border bg-muted/40 p-3">
                      <p className="text-xs font-semibold text-foreground mb-2 uppercase tracking-wide">Affected shops</p>
                      <ul className="space-y-1 max-h-36 overflow-y-auto pr-1">
                        {deleteCatLinkedShops.map((name, i) => (
                          <li key={i} className="text-sm text-foreground flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-destructive shrink-0" />
                            {name}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </>
                ) : (
                  <p>No shops are linked to this category. It is safe to delete.</p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <><Loader2 className="w-4 h-4 animate-spin" /> Deleting...</> : 'Delete Category'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {showCatImport && (
        <CategoryCsvImportModal
          onClose={() => setShowCatImport(false)}
          onDone={() => {
            setShowCatImport(false);
            qc.invalidateQueries({ queryKey: ['admin-categories'] });
            qc.invalidateQueries({ queryKey: ['admin-stats'] });
          }}
        />
      )}

      {mergeCatTarget && (
        <CategoryMergeModal
          source={mergeCatTarget}
          allCategories={(qc.getQueryData(['admin-categories']) as CategoryRow[] | undefined) ?? []}
          onClose={() => setMergeCatTarget(null)}
          onMerged={() => {
            setMergeCatTarget(null);
            qc.invalidateQueries({ queryKey: ['admin-categories'] });
            qc.invalidateQueries({ queryKey: ['admin-shops'] });
            qc.invalidateQueries({ queryKey: ['admin-stats'] });
            qc.invalidateQueries({ queryKey: ['shops'] });
          }}
        />
      )}
    </>
  );
}
