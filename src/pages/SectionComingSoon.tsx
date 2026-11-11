import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { PageSeo } from '@/components/seo/PageSeo';
import { useT } from '@/i18n';
import { useCity } from '@/hooks/useCity';
import { SectionIcon, type SectionKey } from '@/components/shared/SectionIcon';
import { ChevronLeft } from 'lucide-react';

const KNOWN: Record<string, SectionKey> = {
  schools: 'schools',
  banks: 'banks',
  government: 'gov',
  hospitals: 'hospitals',
  'lost-found': 'lostfound',
  news: 'news',
};

export default function SectionComingSoon() {
  const { key = '' } = useParams<{ key: string }>();
  const navigate = useNavigate();
  const { t } = useT();
  const { currentCity, townBrand, townName, getPageTitle } = useCity();

  if (key === 'news') {
    return <Navigate to={`/${currentCity.slug}/news`} replace />;
  }

  const sectionKey: SectionKey = KNOWN[key] || 'shops';
  const labelKey = `home.sections.${sectionKey}`;
  const sectionLabel = t(labelKey);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PageSeo
        title={getPageTitle(sectionLabel)}
        description={t('sections.comingSoon.metaDesc', { section: sectionLabel, town: townName, brand: townBrand })}
        path={`/${currentCity.slug}/sections/${key}`}
      />
      <header className="sticky top-0 z-40 bg-primary text-primary-foreground shadow-md">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 py-3 flex items-center gap-2.5">
          <button
            onClick={() => navigate(`/${currentCity.slug}`)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary-foreground/10 hover:bg-primary-foreground/20 active:scale-95 text-sm font-semibold transition-all shrink-0"
          >
            <ChevronLeft className="w-4 h-4 shrink-0" /> {t('common.back')}
          </button>
          <span className="text-sm sm:text-base font-bold truncate">{sectionLabel}</span>
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="text-center max-w-sm">
          <div className="mx-auto mb-5 w-20 h-20 rounded-2xl flex items-center justify-center text-primary"
               style={{ background: 'linear-gradient(135deg, hsl(var(--primary) / 0.14), hsl(var(--primary) / 0.04))' }}>
            <SectionIcon name={sectionKey} className="w-10 h-10" />
          </div>
          <h1 className="text-xl font-bold text-foreground mb-2">{sectionLabel}</h1>
          <p className="text-sm text-muted-foreground mb-6">
            {t('sections.comingSoon.body', { town: townName })}
          </p>
          <button
            onClick={() => navigate(`/${currentCity.slug}`)}
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            {t('sections.comingSoon.backHome')}
          </button>
        </div>
      </main>
    </div>
  );
}