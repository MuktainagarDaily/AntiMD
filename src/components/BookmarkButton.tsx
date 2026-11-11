import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bookmark } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { haptic } from '@/lib/uxUtils';
import { toast } from 'sonner';
import { useT } from '@/i18n';
import { isGuestBookmarked, toggleGuestBookmark } from '@/lib/guestBookmarks';

interface Props {
  shopId: string;
  className?: string;
}

export function BookmarkButton({ shopId, className }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { t, locale } = useT();

  // Guest bookmark state
  const [guestSaved, setGuestSaved] = useState(() => (!user ? isGuestBookmarked(shopId) : false));

  useEffect(() => {
    if (user) return;
    setGuestSaved(isGuestBookmarked(shopId));

    const handler = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.cleared || customEvent.detail?.shopId === shopId) {
        setGuestSaved(isGuestBookmarked(shopId));
      }
    };
    window.addEventListener('guest-bookmarks-changed', handler);
    return () => window.removeEventListener('guest-bookmarks-changed', handler);
  }, [user, shopId]);

  // Logged-in user bookmark query
  const { data: dbSaved } = useQuery({
    queryKey: ['bookmark', shopId, user?.id],
    enabled: !!shopId && !!user?.id,
    queryFn: async () => {
      const { count } = await supabase
        .from('shop_bookmarks' as any)
        .select('id', { count: 'exact', head: true })
        .eq('shop_id', shopId)
        .eq('user_id', user!.id);
      return (count ?? 0) > 0;
    },
  });

  const isSaved = user ? !!dbSaved : guestSaved;

  const toggleMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('not-signed-in');
      if (isSaved) {
        const { error } = await supabase
          .from('shop_bookmarks' as any)
          .delete()
          .eq('shop_id', shopId)
          .eq('user_id', user.id);
        if (error) throw error;
        return false;
      } else {
        const { error } = await supabase
          .from('shop_bookmarks' as any)
          .insert({ shop_id: shopId, user_id: user.id } as any);
        if (error) throw error;
        return true;
      }
    },
    onMutate: async () => {
      const key = ['bookmark', shopId, user?.id];
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<boolean>(key);
      qc.setQueryData(key, !prev);
      return { prev };
    },
    onError: (e: any, _vars, ctx) => {
      if (ctx?.prev !== undefined) {
        qc.setQueryData(['bookmark', shopId, user?.id], ctx.prev);
      }
      toast.error(t('bookmark.error'));
    },
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ['saved-shops', user?.id] });
      toast.success(saved ? t('bookmark.saved') : t('bookmark.removed'));
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['bookmark', shopId, user?.id] });
    },
  });

  const onClick = () => {
    haptic('press');
    if (!user) {
      const saved = toggleGuestBookmark(shopId);
      setGuestSaved(saved);
      qc.invalidateQueries({ queryKey: ['saved-shops', 'guest'] });
      if (saved) {
        toast.success(
          locale === 'mr'
            ? 'या फोनमध्ये सेव्ह केले! कधीही पाहण्यासाठी सेव्ह दुकाने उघडा.'
            : 'Saved to this device! View anytime from Saved Shops.'
        );
      } else {
        toast.info(t('bookmark.removed'));
      }
      return;
    }
    toggleMutation.mutate();
  };

  return (
    <button
      onClick={onClick}
      aria-label={isSaved ? 'Remove from saved' : 'Save shop'}
      title={isSaved ? 'Remove from saved' : 'Save shop'}
      className={
        className ??
        'p-1.5 hover:bg-primary-foreground/10 rounded-lg transition-colors shrink-0 active:scale-95'
      }
    >
      <Bookmark
        className="w-5 h-5"
        fill={isSaved ? 'currentColor' : 'none'}
      />
    </button>
  );
}
