import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { GitMerge, Loader2, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

interface CategoryMergeModalProps {
  source: { id: string; name: string; icon: string; shopCount: number };
  allCategories: { id: string; name: string; icon: string; shopCount: number }[];
  onClose: () => void;
  onMerged: () => void;
}

export function CategoryMergeModal({ source, allCategories, onClose, onMerged }: CategoryMergeModalProps) {
  const [targetId, setTargetId] = useState('');
  const [disableSource, setDisableSource] = useState(true);
  const [merging, setMerging] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const targets = allCategories.filter((c) => c.id !== source.id);
  const targetCat = targets.find((c) => c.id === targetId);

  const handleMerge = async () => {
    if (!targetId) return;
    setMerging(true);
    try {
      const { data: sourceLinks, error: fetchErr } = await supabase
        .from('shop_categories').select('id, shop_id').eq('category_id', source.id);
      if (fetchErr) throw fetchErr;

      const { data: targetLinks, error: fetchErr2 } = await supabase
        .from('shop_categories').select('shop_id').eq('category_id', targetId);
      if (fetchErr2) throw fetchErr2;

      const alreadyHasTarget = new Set((targetLinks || []).map((r: any) => r.shop_id));
      const toReassign = (sourceLinks || []).filter((r: any) => !alreadyHasTarget.has(r.shop_id));
      const toDelete = (sourceLinks || []).filter((r: any) => alreadyHasTarget.has(r.shop_id));

      const allSourceIds = [...toReassign, ...toDelete].map((r: any) => r.id);
      if (allSourceIds.length > 0) {
        const { error: delErr } = await supabase.from('shop_categories').delete().in('id', allSourceIds);
        if (delErr) throw delErr;
      }

      if (toReassign.length > 0) {
        const newLinks = toReassign.map((r: any) => ({ shop_id: r.shop_id, category_id: targetId }));
        const { error: insertErr } = await supabase.from('shop_categories').insert(newLinks);
        if (insertErr) throw insertErr;
      }

      if (disableSource) {
        await supabase.from('categories').update({ is_active: false }).eq('id', source.id);
      }

      toast.success(`Merged ${source.icon} ${source.name} → ${targetCat?.icon} ${targetCat?.name}. ${source.shopCount} shop${source.shopCount !== 1 ? 's' : ''} reassigned.`);
      onMerged();
    } catch (e: any) {
      toast.error('Merge failed: ' + (e.message || 'Unknown error'));
    }
    setMerging(false);
  };

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitMerge className="w-5 h-5 text-primary shrink-0" />
              Merge {source.icon} {source.name}
            </DialogTitle>
            <DialogDescription>
              Reassign shops from this category into another. The exact count will be confirmed from the live database during merge.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-semibold text-foreground block mb-1.5">Merge into</label>
              <select
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Select target category…</option>
                {targets.map((c) => (
                  <option key={c.id} value={c.id}>{c.icon} {c.name} ({c.shopCount} shops)</option>
                ))}
              </select>
            </div>

            {targetCat && (
              <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                <strong className="text-foreground">{source.shopCount} shop{source.shopCount !== 1 ? 's' : ''}</strong> will be moved from{' '}
                <span className="font-semibold text-foreground">{source.icon} {source.name}</span> to{' '}
                <span className="font-semibold text-foreground">{targetCat.icon} {targetCat.name}</span>.
              </div>
            )}

            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={disableSource}
                onChange={(e) => setDisableSource(e.target.checked)}
                className="w-4 h-4 rounded border-input accent-primary"
              />
              <span className="text-sm text-foreground">Disable source category after merge</span>
            </label>
          </div>

          <DialogFooter>
            <button onClick={onClose} className="px-4 py-2 rounded-lg border border-border text-sm font-semibold hover:bg-muted transition-colors">
              Cancel
            </button>
            <button
              onClick={() => setConfirmOpen(true)}
              disabled={!targetId || merging}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              Review & Confirm
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <TriangleAlert className="w-5 h-5 text-secondary shrink-0" />
              Confirm merge?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {source.shopCount} shop{source.shopCount !== 1 ? 's' : ''} will be reassigned from{' '}
              <strong>{source.icon} {source.name}</strong> to <strong>{targetCat?.icon} {targetCat?.name}</strong>.
              {disableSource && ' The source category will be disabled.'}
              {' '}This cannot be undone automatically.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={merging}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { setConfirmOpen(false); handleMerge(); }}
              disabled={merging}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {merging ? <><Loader2 className="w-4 h-4 animate-spin" /> Merging…</> : 'Merge Category'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
