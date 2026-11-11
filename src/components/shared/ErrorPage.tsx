import { useNavigate, useLocation } from 'react-router-dom';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle, Lock, ShieldAlert, SearchX, ServerCrash,
  Unplug, TimerOff, Home, ArrowLeft, RefreshCw, WifiOff,
} from 'lucide-react';

export type ErrorCode = 400 | 401 | 403 | 404 | 500 | 502 | 503 | 'offline';

interface ErrorConfig {
  icon: React.ReactNode;
  colorClass: string;
  bgClass: string;
  showRetry: boolean;
}

function getConfig(code: ErrorCode): ErrorConfig {
  switch (code) {
    case 'offline':
      return {
        icon: <WifiOff className="w-16 h-16" />,
        colorClass: 'text-muted-foreground',
        bgClass: 'bg-muted',
        showRetry: true,
      };
    case 400:
      return {
        icon: <AlertTriangle className="w-16 h-16" />,
        colorClass: 'text-secondary',
        bgClass: 'bg-secondary/10',
        showRetry: false,
      };
    case 401:
      return {
        icon: <Lock className="w-16 h-16" />,
        colorClass: 'text-secondary',
        bgClass: 'bg-secondary/10',
        showRetry: false,
      };
    case 403:
      return {
        icon: <ShieldAlert className="w-16 h-16" />,
        colorClass: 'text-destructive',
        bgClass: 'bg-destructive/10',
        showRetry: false,
      };

    case 404:
      return {
        icon: <SearchX className="w-16 h-16" />,
        colorClass: 'text-primary',
        bgClass: 'bg-primary/5',
        showRetry: false,
      };
    case 500:
      return {
        icon: <ServerCrash className="w-16 h-16" />,
        colorClass: 'text-destructive',
        bgClass: 'bg-destructive/5',
        showRetry: true,
      };
    case 502:
      return {
        icon: <Unplug className="w-16 h-16" />,
        colorClass: 'text-muted-foreground',
        bgClass: 'bg-muted',
        showRetry: true,
      };
    case 503:
      return {
        icon: <TimerOff className="w-16 h-16" />,
        colorClass: 'text-muted-foreground',
        bgClass: 'bg-muted',
        showRetry: true,
      };
    default:
      return {
        icon: <AlertTriangle className="w-16 h-16" />,
        colorClass: 'text-primary',
        bgClass: 'bg-primary/5',
        showRetry: false,
      };
  }
}

interface ErrorPageProps {
  code: ErrorCode;
}

export default function ErrorPage({ code }: ErrorPageProps) {
  const { t } = useT();
  const navigate = useNavigate();
  const location = useLocation();

  const config = getConfig(code);
  const titleKey = `error.${code}.title`;
  const descKey = `error.${code}.desc`;
  const isOffline = code === 'offline';

  const handleRetry = () => {
    window.location.reload();
  };

  const handleBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  };

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background px-6 py-12">
      <div className="relative w-full max-w-md text-center">
        {/* Large faded code background — only for numeric HTTP codes */}
        {!isOffline && (
          <span
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[10rem] sm:text-[12rem] font-bold leading-none select-none pointer-events-none opacity-[0.04] text-foreground"
            aria-hidden="true"
          >
            {code}
          </span>
        )}

        {/* Icon */}
        <div className={cn('mx-auto mb-6 inline-flex items-center justify-center rounded-3xl p-5', config.bgClass, config.colorClass)}>
          {config.icon}
        </div>

        {/* Code label */}
        {!isOffline && (
          <p className={cn('text-sm font-semibold tracking-widest uppercase mb-2', config.colorClass)}>
            {t('error.codeLabel')} {code}
          </p>
        )}

        {/* Title */}
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">
          {t(titleKey)}
        </h1>

        {/* Description */}
        <p className="text-muted-foreground text-base sm:text-lg leading-relaxed mb-8 max-w-xs mx-auto">
          {t(descKey)}
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button onClick={() => navigate('/')} className="w-full sm:w-auto gap-2">
            <Home className="w-4 h-4" />
            {t('error.goHome')}
          </Button>

          <Button variant="outline" onClick={handleBack} className="w-full sm:w-auto gap-2">
            <ArrowLeft className="w-4 h-4" />
            {t('error.goBack')}
          </Button>

          {config.showRetry && (
            <Button variant="secondary" onClick={handleRetry} className="w-full sm:w-auto gap-2">
              <RefreshCw className="w-4 h-4" />
              {t('common.retry')}
            </Button>
          )}
        </div>

        {/* Current path hint for 404 */}
        {code === 404 && (
          <p className="mt-8 text-xs text-muted-foreground/60 break-all max-w-xs mx-auto">
            {location.pathname}
          </p>
        )}
      </div>
    </div>
  );
}

