import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { RequestListingModal, type RequestEntityType } from '@/components/RequestListingModal';
import { useAuth } from '@/hooks/useAuth';
import { useT } from '@/i18n';
import { toast } from 'sonner';

function normalizeEntityType(value: unknown): RequestEntityType | null {
  if (value === 'mess' || value === 'pg' || value === 'school' || value === 'shop') {
    return value;
  }
  if (value === '1') return 'shop';
  return null;
}

/**
 * App-wide host for the "List New Business" modal so it can open from any route.
 * Requires authentication: unauthenticated guests are notified, redirected to
 * /auth with `next` + `list-shop` preserved, and returned directly to the
 * requested entity listing form once signed in.
 */
export function ListShopModalHost() {
  const [open, setOpen] = useState(false);
  const [initialEntityType, setInitialEntityType] = useState<RequestEntityType>('shop');
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { locale } = useT();

  const redirectToAuthWithIntent = (entityType: RequestEntityType) => {
    try {
      sessionStorage.setItem('pendingOpenListShopEntity', entityType);
    } catch { /* ignore */ }

    const cleanedParams = new URLSearchParams(location.search);
    cleanedParams.delete('list-shop');
    const cleanSearch = cleanedParams.toString() ? `?${cleanedParams.toString()}` : '';
    const returnPath = `${location.pathname}${cleanSearch}${location.hash}`;

    toast.info(
      locale === 'mr'
        ? 'तुमचा व्यवसाय येथे नोंदवण्यासाठी साइन इन किंवा साइन अप करा.'
        : 'You need to sign in / sign up to list your business here.',
      {
        description:
          locale === 'mr'
            ? 'लॉगिन पूर्ण झाल्यावर नोंदणी फॉर्म आपोआप उघडेल.'
            : 'Once signed in, your listing form will open automatically.',
        duration: 5000,
      },
    );

    navigate(`/auth?next=${encodeURIComponent(returnPath)}&list-shop=${encodeURIComponent(entityType)}`);
  };

  // Open on custom event (fired from the profile drawer or module CTAs).
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ entityType?: RequestEntityType }>)?.detail;
      const requestedEntity = normalizeEntityType(detail?.entityType) || 'shop';

      if (!authLoading && !user) {
        redirectToAuthWithIntent(requestedEntity);
        return;
      }

      setInitialEntityType(requestedEntity);
      setOpen(true);
    };

    window.addEventListener('open-list-shop-modal', handler);
    return () => window.removeEventListener('open-list-shop-modal', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, location.pathname, location.search, location.hash, locale]);

  // Open from preserved auth return (?list-shop=mess|pg|school|shop|1) or sessionStorage handoff.
  useEffect(() => {
    if (authLoading) return;

    const queryEntity = normalizeEntityType(searchParams.get('list-shop'));
    const pendingFlag = sessionStorage.getItem('pendingOpenListShop') === '1';
    const pendingEntity = pendingFlag
      ? (normalizeEntityType(sessionStorage.getItem('pendingOpenListShopEntity')) || 'shop')
      : null;

    const targetEntity = queryEntity || pendingEntity;
    if (!targetEntity) return;

    if (!user) {
      sessionStorage.removeItem('pendingOpenListShop');
      redirectToAuthWithIntent(targetEntity);
      return;
    }

    sessionStorage.removeItem('pendingOpenListShop');
    sessionStorage.removeItem('pendingOpenListShopEntity');
    setInitialEntityType(targetEntity);
    setOpen(true);

    if (searchParams.has('list-shop')) {
      const next = new URLSearchParams(searchParams);
      next.delete('list-shop');
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, searchParams, setSearchParams]);

  if (!open) return null;
  return <RequestListingModal initialEntityType={initialEntityType} onClose={() => setOpen(false)} />;
}
