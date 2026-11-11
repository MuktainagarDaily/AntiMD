import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { WifiOff, RefreshCw, X } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';

/**
 * Non-intrusive floating banner that warns the user when offline
 * without blocking their view of cached data or navigation.
 */
export function OfflineOverlay() {
  const online = useOnlineStatus();
  const qc = useQueryClient();
  const { t, locale } = useT();
  const wasOfflineRef = useRef(false);
  const [retrying, setRetrying] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Track offline -> online transitions so we can auto-refresh cached
  // queries the moment connectivity returns.
  useEffect(() => {
    if (!online) {
      wasOfflineRef.current = true;
      setDismissed(false);
      return;
    }
    if (wasOfflineRef.current) {
      wasOfflineRef.current = false;
      qc.invalidateQueries();
      toast.success(t('offline.backOnline', { defaultValue: 'Back online — refreshing.' }));
    }
  }, [online, qc, t]);

  const handleManualRetry = async () => {
    setRetrying(true);
    try {
      await qc.invalidateQueries();
    } finally {
      window.setTimeout(() => setRetrying(false), 800);
    }
  };

  if (online || dismissed) return null;

  return (
    <aside
      aria-label="Offline status banner"
      className="fixed top-2 left-3 right-3 sm:left-auto sm:right-4 sm:max-w-md z-[100] animate-in slide-in-from-top-2 duration-300 pointer-events-auto"
    >
      <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border border-amber-500/35 bg-card/95 text-foreground backdrop-blur-md shadow-lg shadow-black/10">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <WifiOff className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-foreground leading-tight truncate">
              {locale === 'mr' ? 'तुम्ही ऑफलाइन आहात' : 'You are offline'}
            </p>
            <p className="text-[11px] text-muted-foreground leading-tight truncate mt-0.5">
              {locale === 'mr'
                ? 'सेव्ह केलेली माहिती दाखवत आहोत'
                : 'Showing cached local data'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleManualRetry}
            disabled={retrying}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300 hover:bg-amber-500/25 active:scale-95 transition-all disabled:opacity-60"
            title={locale === 'mr' ? 'पुन्हा प्रयत्न करा' : 'Retry'}
          >
            <RefreshCw className={cn('w-3 h-3', retrying && 'animate-spin')} />
            <span className="hidden xs:inline">{locale === 'mr' ? 'पुन्हा पहा' : 'Retry'}</span>
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label={locale === 'mr' ? 'बंद करा' : 'Dismiss'}
            className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
