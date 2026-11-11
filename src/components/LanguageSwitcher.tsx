import { useT, type Locale } from '@/i18n';
import { toast } from 'sonner';
import { checkCooldown } from '@/lib/rateLimit';

interface Props {
  variant?: 'pill' | 'compact';
  tone?: 'onPrimary' | 'onSurface';
  className?: string;
}

/**
 * Compact pill switcher between English and Marathi.
 *
 * - `tone="onPrimary"` (default) — designed to sit on the dark header
 *   (uses primary-foreground tints).
 * - `tone="onSurface"` — designed to sit on a light card / drawer
 *   (uses foreground tints).
 */
export function LanguageSwitcher({ variant = 'pill', tone = 'onPrimary', className = '' }: Props) {
  const { locale, setLocale, t } = useT();

  const pick = (next: Locale) => {
    if (next === locale) return;
    // Throttle: prevent rapid back-and-forth flipping (keyboard repeat,
    // double-taps). The DB write + profile sync is fire-and-forget, so
    // hammering the pill used to queue many updates.
    if (!checkCooldown('lang-switch', 600)) {
      toast.error(t('rate.tooFast'));
      return;
    }
    setLocale(next);
    toast.success(t('lang.saved'), {
      description: next === 'mr' ? t('lang.saved.fallbackHint') : undefined,
    });
  };

  const isMr = locale === 'mr';

  const palette = tone === 'onPrimary'
    ? {
        track: 'hsl(var(--primary-foreground) / 0.15)',
        border: 'hsl(var(--primary-foreground) / 0.25)',
        indicator: 'hsl(var(--primary-foreground))',
        activeText: 'hsl(var(--primary))',
        inactiveText: 'hsl(var(--primary-foreground))',
      }
    : {
        track: 'hsl(var(--muted))',
        border: 'hsl(var(--border))',
        indicator: 'hsl(var(--primary))',
        activeText: 'hsl(var(--primary-foreground))',
        inactiveText: 'hsl(var(--muted-foreground))',
      };

  if (variant === 'compact') {
    return (
      <button
        onClick={() => pick(isMr ? 'en' : 'mr')}
        aria-label={t('lang.switch')}
        className={`text-xs font-bold px-2.5 py-1 rounded-full border transition-colors ${className}`}
        style={{
          background: palette.track,
          borderColor: palette.border,
          color: tone === 'onPrimary' ? 'hsl(var(--primary-foreground))' : 'hsl(var(--foreground))',
        }}
      >
        {isMr ? 'EN' : 'मराठी'}
      </button>
    );
  }

  return (
    <div
      role="group"
      aria-label={t('lang.switch')}
      className={`relative inline-flex items-center rounded-full p-0.5 select-none ${className}`}
      style={{ background: palette.track, border: `1px solid ${palette.border}` }}
    >
      <span
        className="absolute top-0.5 bottom-0.5 w-[calc(50%-2px)] rounded-full transition-transform duration-200 ease-out"
        style={{
          background: palette.indicator,
          transform: isMr ? 'translateX(calc(100% + 4px))' : 'translateX(0)',
        }}
        aria-hidden="true"
      />
      {(['en', 'mr'] as Locale[]).map((code) => {
        const active = locale === code;
        return (
          <button
            key={code}
            type="button"
            onClick={() => pick(code)}
            aria-pressed={active}
            className="relative z-10 min-w-[42px] text-[11px] font-bold px-2.5 py-1 rounded-full transition-colors"
            style={{ color: active ? palette.activeText : palette.inactiveText }}
          >
            {code === 'en' ? 'EN' : 'मराठी'}
          </button>
        );
      })}
    </div>
  );
}
