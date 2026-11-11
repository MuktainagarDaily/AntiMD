/**
 * /schools — Public Schools & Educational Institutes Directory.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, GraduationCap, MapPin, Phone, Globe, Search as SearchIcon, Plus, Sparkles } from 'lucide-react';
import { PageSeo } from '@/components/seo/PageSeo';
import { EntityCard, type EntityAction } from '@/components/shared/EntityCard';
import { schoolsRepo, type SchoolRow, type SchoolType } from '@/lib/repos/schoolsRepo';
import {
  SCHOOL_TYPE_LABEL,
  SCHOOL_TYPE_CONFIG,
  SCHOOL_MEDIUM_CONFIG,
  parseSchoolDescription,
  resolveSchoolType,
} from '@/lib/schools/schoolHelpers';
import { Footer } from '@/components/shared/Footer';
import { CityPickerModal } from '@/components/shared/CityPickerModal';
import { useEdgeSwipeBack } from '@/hooks/useEdgeSwipeBack';
import { UserMenuDrawer } from '@/components/UserMenuDrawer';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useCity } from '@/hooks/useCity';
import { useT } from '@/i18n';

interface TypeFilterOption {
  value: 'all' | SchoolType;
  labelEn: string;
  labelMr: string;
}

const TYPE_FILTERS: TypeFilterOption[] = [
  { value: 'all', labelEn: 'All', labelMr: 'सर्व' },
  { value: 'primary', labelEn: 'Primary', labelMr: 'प्राथमिक' },
  { value: 'secondary', labelEn: 'High School', labelMr: 'माध्यमिक' },
  { value: 'higher-secondary', labelEn: 'Jr. College', labelMr: 'कनिष्ठ महा.' },
  { value: 'college', labelEn: 'Degree College', labelMr: 'वरिष्ठ महा.' },
  { value: 'engineering-polytechnic', labelEn: 'Engg / ITI', labelMr: 'इंजिनिअरिंग / ITI' },
  { value: 'university', labelEn: 'University', labelMr: 'विद्यापीठ' },
  { value: 'coaching', labelEn: 'Coaching', labelMr: 'क्लासेस' },
];

export default function Schools() {
  const navigate = useNavigate();
  const { t, locale } = useT();
  const { currentCity, currentVillage, townName, getPageTitle } = useCity();
  const [q, setQ] = useState('');
  const debouncedQ = useDebouncedValue(q, 200);
  const [typeFilter, setTypeFilter] = useState<'all' | SchoolType>('all');
  const [cityPickerOpen, setCityPickerOpen] = useState(false);
  const { indicatorNode } = useEdgeSwipeBack({
    fallbackPath: `/${currentCity.slug}`,
  });

  const cityName = locale === 'mr' && currentCity.name_mr ? currentCity.name_mr : currentCity.name;
  const villageName = currentVillage ? (locale === 'mr' && currentVillage.name_mr ? currentVillage.name_mr : currentVillage.name) : null;
  const locationLabel = villageName ? `${villageName}, ${cityName}` : cityName;

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['public-schools', currentCity.id, currentVillage?.id],
    queryFn: () => schoolsRepo.list({ activeOnly: true, cityId: currentCity.id, citySlug: currentCity.slug }),
    staleTime: 60_000,
  });

  const filtered = useMemo(() => {
    const needle = debouncedQ.trim().toLowerCase();
    return rows.filter((s) => {
      const resolvedType = resolveSchoolType(s);
      if (typeFilter !== 'all' && resolvedType !== typeFilter) return false;
      if (!needle) return true;
      const hay = [s.name, s.name_mr, s.area, s.sub_area, s.address, s.description, s.medium]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [rows, debouncedQ, typeFilter]);

  const pageTitle = locale === 'mr'
    ? `${locationLabel} मधील शाळा व महाविद्यालये`
    : `Schools & Colleges in ${locationLabel}`;

  return (
    <div className="min-h-screen bg-background">
      {indicatorNode}
      <PageSeo
        title={getPageTitle(locale === 'mr' ? 'शाळा व महाविद्यालये' : 'Schools & Colleges')}
        description={
          locale === 'mr'
            ? `${locationLabel} मधील प्राथमिक, माध्यमिक शाळा, कनिष्ठ व वरिष्ठ महाविद्यालयांची यादी.`
            : `Directory of primary, secondary, and higher secondary schools and colleges in ${locationLabel}.`
        }
        path={`/${currentCity.slug}/schools`}
      />

      <header className="sticky top-0 z-40 bg-primary text-primary-foreground shadow-md">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <button
              onClick={() => navigate(`/${currentCity.slug}`)}
              aria-label={t('common.back')}
              className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-primary-foreground/10 hover:bg-primary-foreground/20 shrink-0"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 min-w-0">
              <GraduationCap className="w-5 h-5 shrink-0" />
              <div className="min-w-0">
                <h1 className="font-bold text-base sm:text-lg leading-tight truncate">
                  {locale === 'mr' ? 'शाळा व महाविद्यालये' : 'Schools & Colleges'}
                </h1>
                <p className="text-[11px] sm:text-xs text-primary-foreground/80 leading-tight truncate">
                  {locationLabel}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Location Switcher Pill */}
            <button
              onClick={() => setCityPickerOpen(true)}
              className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-primary-foreground/15 text-primary-foreground border border-primary-foreground/25 hover:bg-primary-foreground/25 transition-colors"
              title={locale === 'mr' ? 'स्थान बदला' : 'Change Location'}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span className="truncate max-w-[100px] sm:max-w-[130px]">{locationLabel}</span>
            </button>
            <UserMenuDrawer />
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-4 space-y-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">{pageTitle}</h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            {locale === 'mr'
              ? `${locationLabel} मधील शिक्षण संस्था, संपर्क व माध्यम माहिती.`
              : `Browse primary, secondary and higher-secondary institutions in ${locationLabel}.`}
          </p>
        </div>

        {/* Search */}
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={locale === 'mr' ? 'शाळा किंवा कॉलेजचे नाव, परिसर शोधा...' : 'Search by name, area, address…'}
            className="w-full pl-9 pr-3 h-11 rounded-xl border border-input bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary shadow-2xs"
          />
        </div>

        {/* Type filter chips */}
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          {TYPE_FILTERS.map((f) => {
            const active = typeFilter === f.value;
            const label = locale === 'mr' ? f.labelMr : f.labelEn;
            return (
              <button
                key={f.value}
                onClick={() => setTypeFilter(f.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  active
                    ? 'bg-primary text-primary-foreground border-primary shadow-2xs'
                    : 'bg-card text-foreground border-border hover:bg-muted'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* List */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-card rounded-xl border border-border h-32 skeleton-shimmer" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 rounded-2xl border border-dashed border-border bg-card text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
              <GraduationCap className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-foreground">
              {locale === 'mr'
                ? `${locationLabel} मध्ये शाळांची माहिती उपलब्ध नाही`
                : `No Schools Listed in ${locationLabel} Yet`}
            </h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              {locale === 'mr'
                ? 'येथील नवीन शाळा, कॉलेज किंवा शिक्षण संस्थेची नोंदणी करा.'
                : 'Help the community by listing local schools, junior colleges, or coaching academies.'}
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('open-list-shop-modal'))}
                className="inline-flex items-center justify-center gap-1.5 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-xs sm:text-sm font-bold shadow-xs hover:bg-primary/90 active:scale-95 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>{locale === 'mr' ? '+ शाळा किंवा कॉलेज जोडा' : '+ List a School / College'}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filtered.map((s) => (
              <SchoolCardWrap key={s.id} school={s} locale={locale} />
            ))}
          </div>
        )}
      </main>

      <Footer />

      {/* City Picker Modal */}
      <CityPickerModal open={cityPickerOpen} onOpenChange={setCityPickerOpen} />
    </div>
  );
}

/** Adapter: SchoolRow → EntityCard props with bilingual support */
function SchoolCardWrap({ school, locale }: { school: SchoolRow; locale: string }) {
  const displayName = locale === 'mr' && school.name_mr ? school.name_mr : school.name;

  const actions: EntityAction[] = [];
  if (school.phone) {
    actions.push({
      key: 'call',
      label: locale === 'mr' ? 'कॉल करा' : 'Call',
      icon: <Phone className="w-3.5 h-3.5" />,
      href: `tel:${school.phone}`,
      ariaLabel: `Call ${displayName}`,
      style: { background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' },
    });
  }
  if (school.website) {
    actions.push({
      key: 'web',
      label: locale === 'mr' ? 'वेबसाइट' : 'Website',
      icon: <Globe className="w-3.5 h-3.5" />,
      href: school.website,
      external: true,
      ariaLabel: `${displayName} website`,
      className: 'text-white',
      style: { background: 'hsl(211 100% 45%)' },
    });
  }
  if (school.latitude && school.longitude) {
    actions.push({
      key: 'maps',
      label: locale === 'mr' ? 'नकाशा' : 'Maps',
      icon: <MapPin className="w-3.5 h-3.5" />,
      href: `https://www.google.com/maps?q=${school.latitude},${school.longitude}`,
      external: true,
      ariaLabel: `Directions to ${displayName}`,
      className: 'text-white',
      style: { background: 'hsl(140 55% 40%)' },
    });
  }

  const meta: React.ReactNode[] = [];
  if (school.area) {
    meta.push(
      <p key="area" className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
        <MapPin className="w-3 h-3 shrink-0" /> {school.area}{school.sub_area ? `, ${school.sub_area}` : ''}
      </p>,
    );
  }

  const parsed = parseSchoolDescription(school.description);
  const resolvedType = resolveSchoolType(school);
  const typeCfg = SCHOOL_TYPE_CONFIG[resolvedType] || SCHOOL_TYPE_CONFIG.other;
  const typeLabel = locale === 'mr' ? typeCfg.labelMr : typeCfg.labelEn;

  const mediumLabel = (() => {
    if (!school.medium) return null;
    const medCfg = SCHOOL_MEDIUM_CONFIG[school.medium];
    if (medCfg) return locale === 'mr' ? medCfg.labelMr : medCfg.labelEn;
    return school.medium;
  })();

  const chips = (
    <>
      <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-primary/10 text-primary">
        {typeLabel}
      </span>
      {mediumLabel && (
        <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-muted text-foreground">
          {mediumLabel}
        </span>
      )}
      {parsed.board && (
        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium border border-border bg-card text-foreground">
          {parsed.board}
        </span>
      )}
    </>
  );

  return (
    <EntityCard
      photos={Array.isArray((school as any).photos) && (school as any).photos.length > 1 ? (school as any).photos : undefined}
      image={
        school.image_url
          ? { src: school.image_url, alt: displayName, targetWidth: 400 }
          : undefined
      }
      title={displayName}
      titleIcon={<GraduationCap className="w-4 h-4 shrink-0 text-primary" />}
      meta={meta}
      chips={chips}
      actions={actions}
    />
  );
}
