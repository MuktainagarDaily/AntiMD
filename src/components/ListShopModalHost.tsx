import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RequestListingModal } from '@/components/RequestListingModal';

/**
 * App-wide host for the "List a Shop" modal so it can open from any route
 * (profile drawer, deep-link, sessionStorage hand-off after auth) without
 * forcing a navigation to "/". Anonymous users are allowed — the modal
 * itself supports anon submissions.
 */
export function ListShopModalHost() {
  const [open, setOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  // Open on custom event (fired from the profile drawer on any route).
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener('open-list-shop-modal', handler);
    return () => window.removeEventListener('open-list-shop-modal', handler);
  }, []);

  // Open from a pending flag (set before redirecting / signing in) or the
  // legacy ?list-shop=1 deep-link.
  useEffect(() => {
    const fromFlag = sessionStorage.getItem('pendingOpenListShop') === '1';
    const fromQuery = searchParams.get('list-shop') === '1';
    if (fromFlag || fromQuery) {
      sessionStorage.removeItem('pendingOpenListShop');
      setOpen(true);
      if (fromQuery) {
        const next = new URLSearchParams(searchParams);
        next.delete('list-shop');
        setSearchParams(next, { replace: true });
      }
    }
  }, [searchParams, setSearchParams]);

  if (!open) return null;
  return <RequestListingModal onClose={() => setOpen(false)} />;
}