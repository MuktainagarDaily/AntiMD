import { useNavigate, useLocation } from 'react-router-dom';
import { useCallback } from 'react';

const FLAG = 'hasInAppHistory';
const PREV_ROUTE_KEY = 'prevInAppRoute';

/**
 * Patterns of routes the app actually serves. Keep in sync with the <Routes>
 * defined in src/App.tsx. Used to validate stored "previous route" values
 * before navigating to them, so we never send users to a 404.
 */
const VALID_ROUTE_PATTERNS: RegExp[] = [
  /^\/$/,
  /^\/shops(?:\?.*)?$/,
  /^\/category\/[^/?#]+(?:\?.*)?$/,
  /^\/shop\/[^/?#]+(?:\?.*)?$/,
  /^\/bus-timetable(?:\?.*)?$/,
  /^\/schools(?:\?.*)?$/,
  /^\/mess(?:\?.*)?$/,
  /^\/pg(?:\?.*)?$/,
  /^\/sections\/[^/?#]+(?:\?.*)?$/,
  /^\/[a-z0-9_-]+(?:\?.*)?$/,
  /^\/[a-z0-9_-]+\/shops(?:\?.*)?$/,
  /^\/[a-z0-9_-]+\/category\/[^/?#]+(?:\?.*)?$/,
  /^\/[a-z0-9_-]+\/shop\/[^/?#]+(?:\?.*)?$/,
  /^\/[a-z0-9_-]+\/bus-timetable(?:\?.*)?$/,
  /^\/[a-z0-9_-]+\/schools(?:\?.*)?$/,
  /^\/[a-z0-9_-]+\/mess(?:\?.*)?$/,
  /^\/[a-z0-9_-]+\/pg(?:\?.*)?$/,
  /^\/[a-z0-9_-]+\/sections\/[^/?#]+(?:\?.*)?$/,
  /^\/admin(?:\/.*)?$/,
  /^\/my-shop(?:\?.*)?$/,
  /^\/saved-shops(?:\?.*)?$/,
  /^\/reset-password(?:\?.*)?$/,
  /^\/auth(?:\?.*)?$/,
  /^\/error\/[a-z0-9_-]+(?:\?.*)?$/,
];

function isValidAppRoute(path: string | null): path is string {
  if (!path || !path.startsWith('/')) return false;
  return VALID_ROUTE_PATTERNS.some((re) => re.test(path));
}

/**
 * Returns a goBack function that uses browser history when in-app history
 * exists. Otherwise it prefers the previously visited in-app route (tracked
 * by HistoryTracker, and validated against known app routes) and finally
 * falls back to the provided default route.
 *
 * Useful when users land on a deep page via a shared link / new tab, where
 * `navigate(-1)` would either do nothing or send them outside the app.
 */
export function useSmartBack() {
  const navigate = useNavigate();
  const location = useLocation();

  return useCallback(
    (fallback: string) => {
      const here = location.pathname + location.search;
      const hasFlag = sessionStorage.getItem(FLAG) === '1';
      const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;

      // Detect page reload — after a refresh, browser back may not move
      // (especially inside preview iframes / deep-link entries). Prefer the
      // stored previous in-app route or fallback in that case.
      const navEntry = (typeof performance !== 'undefined'
        ? (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined)
        : undefined);
      const wasReloaded = navEntry?.type === 'reload';

      const prev = sessionStorage.getItem(PREV_ROUTE_KEY);
      const prevIsUsable = prev && prev !== here && isValidAppRoute(prev);

      if (wasReloaded) {
        navigate(prevIsUsable ? prev! : fallback, { replace: true });
        return;
      }

      if (hasFlag || idx > 0) {
        // Guard against navigate(-1) being a no-op (e.g. deep-link single
        // history entry inside an iframe): if URL hasn't changed shortly
        // after, fall back to a known route.
        const before = window.location.pathname + window.location.search;
        navigate(-1);
        window.setTimeout(() => {
          const after = window.location.pathname + window.location.search;
          if (after === before) {
            navigate(prevIsUsable ? prev! : fallback, { replace: true });
          }
        }, 400);
        return;
      }

      navigate(prevIsUsable ? prev! : fallback, { replace: true });
    },
    [navigate, location.pathname, location.search],
  );
}

export const IN_APP_HISTORY_FLAG = FLAG;
export const PREV_IN_APP_ROUTE_KEY = PREV_ROUTE_KEY;
