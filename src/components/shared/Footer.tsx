import { useT } from '@/i18n';
// import { ExternalLink } from 'lucide-react';

interface FooterProps {
  className?: string;
  hideBorder?: boolean;
}

export function Footer({ className = '', hideBorder = false }: FooterProps) {
  const { t /*, locale */ } = useT();

  return (
    <footer
      role="contentinfo"
      className={`w-full text-center text-[11px] sm:text-xs text-muted-foreground py-6 px-4 ${
        hideBorder ? '' : 'border-t border-border'
      } ${className}`}
    >
      <div className="max-w-lg mx-auto flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 leading-relaxed">
        <span>{t('home.footer')}</span>
        {/* Temporarily hidden: "Built for Vibe Forge Hackathon" attribution
        <span className="hidden sm:inline text-muted-foreground/40" aria-hidden="true">
          •
        </span>
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          {locale === 'mr' ? (
            <>
              <a
                href="https://vibe-forge.in/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-foreground hover:text-primary transition-colors underline decoration-border/70 hover:decoration-primary underline-offset-4 inline-flex items-center gap-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded-xs"
              >
                <span>{t('footer.hackathon')}</span>
                <ExternalLink className="w-2.5 h-2.5 opacity-50 shrink-0" aria-hidden="true" />
              </a>
              <span>{t('footer.builtFor')}</span>
            </>
          ) : (
            <>
              <span>{t('footer.builtFor')}</span>
              <a
                href="https://vibe-forge.in/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-foreground hover:text-primary transition-colors underline decoration-border/70 hover:decoration-primary underline-offset-4 inline-flex items-center gap-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded-xs"
              >
                <span>{t('footer.hackathon')}</span>
                <ExternalLink className="w-2.5 h-2.5 opacity-50 shrink-0" aria-hidden="true" />
              </a>
            </>
          )}
        </span>
        */}
      </div>
    </footer>
  );
}

export default Footer;
