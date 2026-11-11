import { useMemo, useState } from 'react';
import { PenSquare, MessageSquareText, LogIn } from 'lucide-react';
import { RatingBreakdown } from '@/components/shared/rating/RatingBreakdown';
import { ReviewCard } from './ReviewCard';
import { WriteReviewSheet } from './WriteReviewSheet';
import {
  useShopRating,
  useShopReviews,
  useMyHelpfulVotes,
  type ShopReview,
  type ReviewEntityType,
} from '@/lib/reviewsApi';
import { useAuth } from '@/hooks/useAuth';
import { useT } from '@/i18n';
import { Link } from 'react-router-dom';

type FilterKey = 'all' | 'positive' | 'critical' | 'neutral';
type SortKey = 'recent' | 'highest' | 'lowest' | 'helpful';

interface Props {
  shopId: string;
  shopName: string;
  entityType?: ReviewEntityType;
}

export function ReviewsSection({ shopId, shopName, entityType = 'shop' }: Props) {
  const { t } = useT();
  const { user } = useAuth();
  const { data: rating } = useShopRating(shopId, entityType);
  const { data: reviews = [], isLoading } = useShopReviews(shopId, entityType);
  const { data: helpfulSet } = useMyHelpfulVotes(shopId, entityType);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [sort, setSort] = useState<SortKey>('recent');
  const [visible, setVisible] = useState(5);
  const [writeOpen, setWriteOpen] = useState(false);

  const myReview = useMemo<ShopReview | undefined>(
    () => (user ? reviews.find((r) => r.user_id === user.id) : undefined),
    [reviews, user],
  );

  const filtered = useMemo(() => {
    let list: ShopReview[] = reviews;
    if (filter === 'positive') list = list.filter((r) => r.rating >= 4);
    else if (filter === 'critical') list = list.filter((r) => r.rating <= 2);
    else if (filter === 'neutral') list = list.filter((r) => r.rating === 3);

    const sorted = [...list];
    if (sort === 'recent') sorted.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    else if (sort === 'highest') sorted.sort((a, b) => b.rating - a.rating);
    else if (sort === 'lowest') sorted.sort((a, b) => a.rating - b.rating);
    else if (sort === 'helpful') sorted.sort((a, b) => b.helpful_count - a.helpful_count);

    // Always float the user's own review to the top of the visible list
    if (myReview) {
      const idx = sorted.findIndex((r) => r.id === myReview.id);
      if (idx > 0) {
        const [mine] = sorted.splice(idx, 1);
        sorted.unshift(mine);
      }
    }
    return sorted;
  }, [reviews, filter, sort, myReview]);

  const filterOptions: { value: FilterKey; label: string }[] = [
    { value: 'all', label: t('reviews.filter.all') },
    { value: 'positive', label: t('reviews.filter.positive') },
    { value: 'neutral', label: t('reviews.filter.neutral') },
    { value: 'critical', label: t('reviews.filter.critical') },
  ];

  const ctaLabel = myReview ? t('reviews.editYours') : t('reviews.writeCta');
  const openWrite = () => setWriteOpen(true);

  const CtaButton = () => {
    if (!user) {
      return (
        <Link
          to={`/auth?redirect=${encodeURIComponent(window.location.pathname + '#reviews')}`}
          className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-primary text-primary-foreground text-xs font-bold shadow-sm hover:shadow-md active:scale-95 transition-all min-h-[40px]"
        >
          <LogIn className="w-3.5 h-3.5" />
          {t('reviews.signInToReview')}
        </Link>
      );
    }
    return (
      <button
        type="button"
        onClick={openWrite}
        className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-primary text-primary-foreground text-xs font-bold shadow-sm hover:shadow-md active:scale-95 transition-all min-h-[40px]"
      >
        <PenSquare className="w-3.5 h-3.5" />
        {ctaLabel}
      </button>
    );
  };

  return (
    <section id="reviews" aria-labelledby="reviews-title" className="scroll-mt-20">
      <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-3 mb-4">
        <div className="min-w-0 flex-1">
          <h2 id="reviews-title" className="text-lg font-bold text-foreground leading-tight">
            {t('reviews.section.title')}
          </h2>
          {rating && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {rating.count.toLocaleString()} {rating.count === 1 ? 'review' : 'reviews'}
            </p>
          )}
        </div>
        <CtaButton />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 bg-card rounded-xl border border-border animate-pulse" />
          ))}
        </div>
      ) : !rating || reviews.length === 0 ? (
        <EmptyReviews entityType={entityType} onWrite={user ? openWrite : undefined} />
      ) : (
        <>
          <div className="bg-card rounded-xl border border-border p-4 mb-4">
            <RatingBreakdown
              average={rating.average}
              count={rating.count}
              distribution={rating.distribution}
            />
          </div>

          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <div className="flex gap-1.5 overflow-x-auto scrollbar-none flex-1 min-w-0">
              {filterOptions.map((o) => {
                const active = o.value === filter;
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => { setFilter(o.value); setVisible(5); }}
                    className={`shrink-0 inline-flex items-center px-3 h-8 rounded-full text-xs font-semibold border transition-colors ${
                      active
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-card text-muted-foreground border-border hover:text-foreground'
                    }`}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              aria-label={t('reviews.sortAria')}
              className="shrink-0 h-8 rounded-full text-xs font-semibold px-3 pr-7 border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="recent">{t('reviews.sort.recent')}</option>
              <option value="highest">{t('reviews.sort.highest')}</option>
              <option value="lowest">{t('reviews.sort.lowest')}</option>
              <option value="helpful">{t('reviews.sort.helpful')}</option>
            </select>
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-8 px-4 bg-card rounded-xl border border-dashed border-border">
              <p className="text-sm text-muted-foreground">{t('reviews.noMatch')}</p>
              <button
                type="button"
                onClick={() => { setFilter('all'); setVisible(5); }}
                className="mt-3 inline-flex items-center px-4 h-9 rounded-full text-xs font-semibold border border-border bg-background text-foreground hover:bg-muted"
              >
                {t('reviews.clearFilter')}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.slice(0, visible).map((r) => (
                <ReviewCard
                  key={r.id}
                  review={r}
                  helpfulOn={helpfulSet?.has(r.id)}
                  onEdit={r.user_id === user?.id ? openWrite : undefined}
                  entityType={entityType}
                />
              ))}
            </div>
          )}

          {visible < filtered.length && (
            <div className="text-center mt-4">
              <button
                type="button"
                onClick={() => setVisible((n) => n + 5)}
                className="inline-flex items-center px-5 h-10 rounded-full text-sm font-semibold border border-border bg-card text-foreground hover:bg-muted"
              >
                {t('reviews.showMore')}
              </button>
            </div>
          )}
        </>
      )}

      <WriteReviewSheet
        open={writeOpen}
        onClose={() => setWriteOpen(false)}
        shopId={shopId}
        shopName={shopName}
        existing={myReview}
        entityType={entityType}
      />
    </section>
  );
}

function EmptyReviews({
  onWrite,
  entityType = 'shop',
}: {
  onWrite?: () => void;
  entityType?: ReviewEntityType;
}) {
  const { t } = useT();
  return (
    <div className="bg-card rounded-xl border border-dashed border-border p-8 flex flex-col items-center text-center">
      <div className="w-14 h-14 rounded-full flex items-center justify-center mb-3"
           style={{ background: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))' }}>
        <MessageSquareText className="w-7 h-7" />
      </div>
      <p className="font-bold text-foreground">{t('reviews.empty.title')}</p>
      <p className="text-sm text-muted-foreground mt-1 mb-4">
        {entityType === 'school' ? t('reviews.empty.schoolBody') : t('reviews.empty.body')}
      </p>
      {onWrite && (
        <button
          type="button"
          onClick={onWrite}
          className="inline-flex items-center gap-1.5 px-5 h-11 rounded-full bg-primary text-primary-foreground text-sm font-bold shadow-sm active:scale-95"
        >
          <PenSquare className="w-4 h-4" />
          {t('reviews.writeCta')}
        </button>
      )}
    </div>
  );
}
