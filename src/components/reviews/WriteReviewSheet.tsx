import { useState, useEffect } from 'react';
import { X, Sparkles, Trash2 } from 'lucide-react';
import { RatingInput } from '@/components/shared/rating/RatingInput';
import {
  useUpsertReview,
  useDeleteReview,
  type ShopReview,
  type ReviewEntityType,
} from '@/lib/reviewsApi';
import { useT } from '@/i18n';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onClose: () => void;
  shopId: string;
  shopName: string;
  existing?: ShopReview;
  entityType?: ReviewEntityType;
}

export function WriteReviewSheet({
  open,
  onClose,
  shopId,
  shopName,
  existing,
  entityType = 'shop',
}: Props) {
  const { t } = useT();
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState('');
  const upsert = useUpsertReview(shopId, entityType);
  const del = useDeleteReview(shopId, entityType);

  useEffect(() => {
    if (open) {
      setRating(existing?.rating ?? 0);
      setBody(existing?.body ?? '');
    }
  }, [open, existing]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  const label =
    rating >= 5 ? t('reviews.label.excellent')
    : rating === 4 ? t('reviews.label.great')
    : rating === 3 ? t('reviews.label.okay')
    : rating === 2 ? t('reviews.label.poor')
    : rating === 1 ? t('reviews.label.terrible')
    : t('reviews.tapAStar');

  const isEdit = !!existing;
  const submitDisabled = rating < 1 || upsert.isPending;

  const submit = async () => {
    try {
      await upsert.mutateAsync({ rating, body });
      toast.success(isEdit ? t('reviews.updated') : t('reviews.submitted'));
      onClose();
    } catch (e: any) {
      toast.error(e?.message || 'Could not save review');
    }
  };

  const remove = async () => {
    if (!existing) return;
    if (!confirm(t('reviews.confirmDelete'))) return;
    try {
      await del.mutateAsync(existing.id);
      toast.success(t('reviews.deleted'));
      onClose();
    } catch (e: any) {
      toast.error(e?.message || 'Could not delete');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="write-review-title"
        className="relative w-full sm:max-w-md bg-card border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[92vh] overflow-y-auto animate-in slide-in-from-bottom-4 sm:zoom-in-95"
      >
        <div className="flex items-center justify-between gap-2 px-5 pt-5">
          <div className="min-w-0 flex-1">
            <h2 id="write-review-title" className="font-bold text-foreground text-lg leading-tight">
              {isEdit ? t('reviews.editYours') : t('reviews.writeCta')}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{shopName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="shrink-0 p-2 -mr-2 rounded-full hover:bg-muted text-muted-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 pt-6 pb-3 flex flex-col items-center">
          <RatingInput value={rating} onChange={setRating} size={40} />
          <p
            className="mt-3 text-sm font-semibold"
            style={{ color: rating > 0 ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))' }}
          >
            {rating > 0 ? `${rating} / 5 · ${label}` : label}
          </p>
        </div>

        <div className="px-5 pb-2">
          <label htmlFor="review-body" className="block text-xs font-semibold text-muted-foreground mb-1.5">
            {t('reviews.shareExperience')} <span className="font-normal">({t('common.optional')})</span>
          </label>
          <textarea
            id="review-body"
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, 2000))}
            rows={4}
            placeholder={
              entityType === 'school' ? t('reviews.schoolPlaceholder') : t('reviews.placeholder')
            }
            className="w-full rounded-xl border border-border bg-background text-sm p-3 focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          />
          <div className="text-[11px] text-muted-foreground text-right mt-1 tabular-nums">
            {body.length}/2000
          </div>
        </div>

        <div className="mx-5 mb-4 flex items-start gap-2 text-[11px] text-muted-foreground bg-muted/60 rounded-lg p-2.5">
          <Sparkles className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary" />
          <p>{t('reviews.tip')}</p>
        </div>

        <div
          className="sticky bottom-0 bg-card border-t border-border px-5 py-3 flex items-center gap-2"
          style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))' }}
        >
          {isEdit && (
            <button
              type="button"
              onClick={remove}
              disabled={del.isPending}
              aria-label={t('reviews.confirmDelete')}
              className="min-h-[44px] px-3 rounded-xl border border-border text-sm font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex-1 min-h-[44px] rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-muted"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitDisabled}
            className="flex-1 min-h-[44px] rounded-xl bg-primary text-primary-foreground text-sm font-bold disabled:opacity-50"
          >
            {upsert.isPending
              ? t('common.saving')
              : isEdit ? t('reviews.saveChanges') : t('reviews.submit')}
          </button>
        </div>
      </div>
    </div>
  );
}
