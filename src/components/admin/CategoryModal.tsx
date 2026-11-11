import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { inputCls } from './adminHelpers';
import { useT } from '@/i18n';
import { useInvalidateTranslations } from '@/hooks/useTranslationsCache';

interface CategoryModalProps {
  category: any;
  onClose: () => void;
  onSaved: () => void;
}

export function CategoryModal({ category, onClose, onSaved }: CategoryModalProps) {
  const isEdit = !!category.id;
  const { t } = useT();
  const invalidateTx = useInvalidateTranslations();
  const [form, setForm] = useState({
    name: category.name || '',
    icon: category.icon || '🏪',
    is_active: category.is_active ?? true,
  });
  // Marathi translation — kept in a sibling translation table.
  const [nameMr, setNameMr] = useState('');
  const [tab, setTab] = useState<'en' | 'mr'>('en');
  const [saving, setSaving] = useState(false);

  // Load existing MR translation when editing.
  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      const { data } = await (supabase as any)
        .from('category_translations')
        .select('name')
        .eq('category_id', category.id)
        .eq('locale', 'mr')
        .maybeSingle();
      if (data?.name) setNameMr(data.name);
    })();
  }, [isEdit, category.id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = form.name.trim();
    if (!trimmedName) { toast.error('Category name is required'); return; }
    if (trimmedName.length > 60) { toast.error('Category name must be 60 characters or fewer'); return; }
    setSaving(true);
    let error: any;
    let savedId = category.id as string | undefined;
    if (isEdit) {
      ({ error } = await supabase
        .from('categories')
        .update({ ...form, name: form.name.trim() })
        .eq('id', category.id));
    } else {
      const ins = await supabase
        .from('categories')
        .insert({ ...form, name: form.name.trim() })
        .select('id')
        .single();
      error = ins.error;
      savedId = (ins.data as any)?.id;
    }
    if (error) { toast.error('Failed to save category'); setSaving(false); return; }

    // Persist Marathi translation (upsert/delete).
    if (savedId) {
      const trimmed = nameMr.trim();
      if (trimmed) {
        await (supabase as any)
          .from('category_translations')
          .upsert(
            { category_id: savedId, locale: 'mr', name: trimmed },
            { onConflict: 'category_id,locale' },
          );
      } else if (isEdit) {
        await (supabase as any)
          .from('category_translations')
          .delete()
          .eq('category_id', savedId)
          .eq('locale', 'mr');
      }
      invalidateTx();
    }

    toast.success(isEdit ? 'Category updated!' : 'Category added!');
    onSaved();
    setSaving(false);
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-3 sm:px-4 py-4"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-2xl border border-border w-full max-w-sm shadow-2xl max-h-[90dvh] overflow-y-auto overscroll-contain"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 px-4 sm:px-6 py-4 border-b border-border">
          <h2 className="font-bold text-lg text-foreground min-w-0 truncate">{isEdit ? 'Edit Category' : 'Add Category'}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 hover:bg-muted rounded-lg shrink-0"><X className="w-5 h-5" /></button>
        </div>

        {/* Language tab strip */}
        <div className="flex border-b border-border px-4 sm:px-6 overflow-x-auto no-scrollbar">
          {(['en', 'mr'] as const).map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => setTab(code)}
              className={`px-3 py-2 text-xs font-bold border-b-2 -mb-px transition-colors shrink-0 ${
                tab === code
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {code === 'en' ? t('admin.translations.tabEn') : t('admin.translations.tabMr')}
            </button>
          ))}
        </div>

        <form onSubmit={handleSave} className="p-4 sm:p-6 space-y-4">
          {tab === 'en' ? (
            <>
              <div className="grid grid-cols-[76px_minmax(0,1fr)] gap-3">
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1.5">Icon</label>
                  <input value={form.icon} onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))} className={inputCls + ' text-2xl text-center'} maxLength={4} />
                </div>
                <div className="min-w-0">
                  <label className="block text-sm font-semibold text-foreground mb-1.5">Category Name *</label>
                  <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputCls} placeholder="e.g. Grocery" maxLength={60} />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} className="w-4 h-4 accent-primary" />
                <span className="text-sm font-medium text-foreground">Active</span>
              </label>
            </>
          ) : (
            <>
              <p className="text-[11px] text-muted-foreground leading-snug">{t('admin.translations.help')}</p>
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1.5">Category Name (मराठी)</label>
                <input
                  value={nameMr}
                  onChange={(e) => setNameMr(e.target.value)}
                  className={inputCls}
                  placeholder="उदा. किराणा"
                  maxLength={60}
                  lang="mr"
                />
              </div>
            </>
          )}

          <div className="flex flex-wrap gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 min-w-[100px] py-3 border border-border rounded-xl font-semibold text-foreground hover:bg-muted transition-colors">
              {t('common.cancel')}
            </button>
            <button type="submit" disabled={saving} className="flex-1 min-w-[100px] py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 disabled:opacity-60 flex items-center justify-center gap-2">
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : isEdit ? t('common.update') : t('common.add')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
