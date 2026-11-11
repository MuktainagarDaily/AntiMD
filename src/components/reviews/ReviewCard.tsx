import { useState } from 'react';
import { ThumbsUp, Pencil, Trash2, ShieldCheck } from 'lucide-react';
import { RatingStars } from '@/components/shared/rating/RatingStars';
import {
  formatRelative,
  useToggleHelpful,
  useDeleteReview,
  type ShopReview,
} from '@/lib/reviewsApi';
import { useAuth } from '@/hooks/useAuth';
import { useT } from '@/i18n';
import { toast } from 'sonner';

function avatarFor(name: string) {
  const initial = (name || '?').trim().charAt(0).toUpperCase() || '?';
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return { initial, hue: h % 360 };
}

interface Props {
  review: ShopReview;
  helpfulOn?: boolean;
  onEdit?: () => void;
}

export function ReviewCard({ review, helpfulOn = false, onEdit }: Props) {
  const { t } = useT();
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const toggleHelpful = useToggleHelpful(review.shop_id);
  const deleteReview = useDeleteReview(review.shop_id);
  const displayName = review.author_name?.trim() || t('reviews.anonymous');
  const { initial, hue } = avatarFor(displayName);
  const longBody = review.body && review.body.length > 140;
  const isMine = user?.id === review.user_id;
  const edited = review.updated_at && review.updated_at !== review.created_at;

  const onHelpful = () => {
    if (!user) { toast.info(t('reviews.signInToHelp')); return; }
    if (isMine) return;
    toggleHelpful.mutate({ reviewId: review.id, on: !helpfulOn });
  };

  const onDelete = async () => {
    if (!confirm(t('reviews.confirmDelete'))) return;
    try {
      await deleteReview.mutateAsync(review.id);
      toast.success(t('reviews.deleted'));
    } catch (e: any) {
      toast.error(e?.message || 'Failed to delete review');
    }
  };

  return (
    <article className="bg-card rounded-xl border border-border p-4">
      <header className="flex items-start gap-3">
        <div
          aria-hidden="true"
          className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shrink-0"
          style={{ background: `hsl(${hue} 65% 45%)` }}
        >
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="font-semibold text-foreground text-sm truncate">{displayName}</p>
            {isMine && (
              <span
                className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none"
                style={{ background: 'hsl(var(--primary) / 0.12)', color: 'hsl(var(--primary))' }}
              >
                <ShieldCheck className="w-3 h-3" />
                {t('reviews.yours')}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <RatingStars value={review.rating} size="xs" showValue />
            <span className="text-[11px] text-muted-foreground">· {formatRelative(review.created_at)}</span>
            {edited && (
              <span className="text-[11px] text-muted-foreground italic">· {t('reviews.edited')}</span>
            )}
          </div>
        </div>
        {isMine && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={onEdit}
              aria-label={t('reviews.editYours')}
              className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              disabled={deleteReview.isPending}
              aria-label={t('reviews.confirmDelete')}
              className="p-2 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </header>

      {review.body && review.body.trim() ? (
        <>
          <p
            className={`mt-3 text-sm text-foreground leading-relaxed break-words whitespace-pre-line ${
              longBody && !expanded ? 'line-clamp-2' : ''
            }`}
          >
            {review.body}
          </p>
          {longBody && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-1 text-xs font-semibold text-primary hover:underline"
            >
              {expanded ? t('reviews.readLess') : t('reviews.readMore')}
            </button>
          )}
        </>
      ) : (
        <p className="mt-3 text-xs italic text-muted-foreground">
          {t('reviews.ratingOnly')}
        </p>
      )}

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={onHelpful}
          disabled={isMine || toggleHelpful.isPending}
          aria-pressed={helpfulOn}
          title={isMine ? t('reviews.cantHelpOwn') : undefined}
          className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-full border transition-colors min-h-[36px] disabled:opacity-50 ${
            helpfulOn
              ? 'bg-primary/10 text-primary border-primary/30'
              : 'text-muted-foreground border-border hover:text-foreground'
          }`}
        >
          <ThumbsUp className="w-3.5 h-3.5" />
          <span>{t('reviews.helpful')}</span>
          <span className="tabular-nums">({review.helpful_count})</span>
        </button>
      </div>
    </article>
  );
}
