import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Search, Bus, Clock, AlertTriangle, ArrowRight, Phone, MapPin, RefreshCw, X, Inbox, WifiOff, Navigation } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { PageSeo } from '@/components/seo/PageSeo';
import { UserMenuDrawer } from '@/components/UserMenuDrawer';
import { DesktopNav } from '@/components/DesktopNav';
import { Footer } from '@/components/shared/Footer';
import { CityPickerModal } from '@/components/shared/CityPickerModal';
import { useEdgeSwipeBack } from '@/hooks/useEdgeSwipeBack';
import { useT } from '@/i18n';
import { useCity } from '@/hooks/useCity';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { canDialTel } from '@/lib/engagement';
import { cn } from '@/lib/utils';
import { readBusCache, writeBusCache, formatCacheAge } from '@/lib/pwa/busCache';
import { parseBusNotes, BUS_TYPE_CONFIG } from '@/lib/bus/busHelpers';

interface Row {
  id: string;
  destination: string;
  destination_mr: string | null;
  departure_times: string[];
  notes: string | null;
  sort_order: number;
  is_active: boolean;
}

const PARANDWADI_SEED_ROWS: Row[] = [
  {
    id: 'parandwadi-nigdi-342',
    destination: 'Nigdi (Bhakti Shakti / Pawale Chowk)',
    destination_mr: 'निगडी (भक्ती शक्ती / पावले चौक)',
    departure_times: ['07:30', '09:30', '12:05', '16:35', '18:35'],
    notes: 'PMPML Route 342: Urse -> Parandwadi (ZP School / Shantai Niwas / Bhote Wasti) -> Somatane Phata -> Dehu Road -> Nigdi',
    sort_order: 1,
    is_active: true,
  },
  {
    id: 'parandwadi-urse-342',
    destination: 'Urse Gaon (Vasudev Ashram)',
    destination_mr: 'उर्से गाव (वासुदेव आश्रम)',
    departure_times: ['07:15', '09:10', '11:45', '16:20', '18:25'],
    notes: 'PMPML Route 342: Nigdi -> Dehu Road -> Somatane Phata -> Parandwadi -> Urse Gaon',
    sort_order: 2,
    is_active: true,
  },
  {
    id: 'parandwadi-dehuroad',
    destination: 'Dehu Road Bazar & Station',
    destination_mr: 'देहूरोड बाजार व रेल्वे स्टेशन',
    departure_times: ['07:30', '09:30', '12:05', '16:35', '18:35'],
    notes: 'Direct via Route 342 from Parandwadi ZP School',
    sort_order: 3,
    is_active: true,
  },
  {
    id: 'parandwadi-somatane',
    destination: 'Somatane Phata (Highway Junction)',
    destination_mr: 'सोमाटणे फाटा (हायवे जंक्शन)',
    departure_times: ['06:30', '07:30', '08:30', '09:30', '10:30', '11:30', '12:05', '13:30', '14:30', '15:30', '16:35', '17:30', '18:35', '19:30', '20:30'],
    notes: 'Major junction 3km from Parandwadi - Frequent feeder auto & PMPML Route 305/342 connecting to Pune & Talegaon',
    sort_order: 4,
    is_active: true,
  },
  {
    id: 'parandwadi-talegaon',
    destination: 'Talegaon Dabhade ST Stand',
    destination_mr: 'तळेगाव दाभाडे एसटी बसस्थानक',
    departure_times: ['06:45', '07:45', '08:45', '09:45', '11:15', '12:45', '14:15', '15:45', '17:15', '18:45', '20:00'],
    notes: 'Via Somatane Phata / Talegaon Station Road - MSRTC & local connecting buses',
    sort_order: 5,
    is_active: true,
  },
  {
    id: 'parandwadi-hinjawadi',
    destination: 'Hinjawadi IT Park (Phase 1, 2, 3)',
    destination_mr: 'हिंजवडी आयटी पार्क (फेज १, २, ३)',
    departure_times: ['07:15', '08:00', '08:45', '09:30', '17:30', '18:15', '19:00'],
    notes: 'Via Somatane Phata / Wakad connecting routes (PMPML 372 / Metro Feeder)',
    sort_order: 6,
    is_active: true,
  },
  {
    id: 'parandwadi-pune-station',
    destination: 'Pune Station / Shivajinagar',
    destination_mr: 'पुणे स्टेशन / शिवाजीनगर',
    departure_times: ['06:30', '07:30', '08:30', '10:00', '12:00', '14:00', '16:00', '17:30', '19:00'],
    notes: 'Via Somatane Phata / Dehu Road connecting PMPML 305 & MSRTC Express',
    sort_order: 7,
    is_active: true,
  },
  {
    id: 'parandwadi-lonavala',
    destination: 'Lonavala / Khandala',
    destination_mr: 'लोणावळा / खंडाळा',
    departure_times: ['07:00', '08:30', '10:30', '12:30', '14:30', '16:30', '18:30', '20:00'],
    notes: 'Via Old Mumbai-Pune Highway / Somatane Toll Naka',
    sort_order: 8,
    is_active: true,
  },
];

interface UpcomingDeparture {
  rowId: string;
  destination: string;
  time: string;
  minutes: number;
  minutesUntil: number;
}

function toMinutes(hhmm: string): number | null {
  const m = hhmm.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

function formatTime(hhmm: string): string {
  const mins = toMinutes(hhmm);
  if (mins == null) return hhmm;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hh = ((h + 11) % 12) + 1;
  return `${hh}:${m.toString().padStart(2, '0')} ${ampm}`;
}

/**
 * Marathi label with safe English fallback.
 * Treats null, empty, and whitespace-only `destination_mr` as missing so
 * the row never renders a blank label when a translation hasn't been
 * backfilled yet.
 */
function localizedDestination(
  row: { destination: string; destination_mr: string | null },
  locale: string,
): string {
  if (locale === 'mr' && row.destination_mr && row.destination_mr.trim() !== '') {
    return row.destination_mr;
  }
  return row.destination;
}

function formatNowLabel(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hh = ((h + 11) % 12) + 1;
  return `${hh}:${m.toString().padStart(2, '0')} ${ampm}`;
}

const ALPHABET = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z'];

export default function BusTimetable() {
  const navigate = useNavigate();
  const { t, locale } = useT();
  const { currentCity, currentVillage, townBrand, townName, getPageTitle } = useCity();
  const [cityPickerOpen, setCityPickerOpen] = useState(false);
  const { indicatorNode } = useEdgeSwipeBack({
    fallbackPath: `/${currentCity.slug}`,
  });
  const online = useOnlineStatus();
  const [search, setSearch] = useState('');
  const debounced = useDebouncedValue(search, 200);
  const listRef = useRef<HTMLUListElement | null>(null);
  // aria-live announcement string; replaced on every jump so AT users
  // hear "Jumped to Akola — next bus at 7:30 AM" even though the
  // scroll itself is silent.
  const [liveMsg, setLiveMsg] = useState('');

  const cityName = locale === 'mr' && currentCity.name_mr ? currentCity.name_mr : currentCity.name;
  const villageName = currentVillage ? (locale === 'mr' && currentVillage.name_mr ? currentVillage.name_mr : currentVillage.name) : null;
  const locationLabel = villageName ? `${villageName}, ${cityName}` : cityName;
  const isMaval = currentCity.slug === 'maval';
  const isParandwadi = isMaval || currentVillage?.slug === 'parandwadi';

  const [nowMin, setNowMin] = useState<number>(() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  });
  useEffect(() => {
    const id = window.setInterval(() => {
      const d = new Date();
      setNowMin(d.getHours() * 60 + d.getMinutes());
    }, 60_000);
    return () => window.clearInterval(id);
  }, []);

  // Seed both queries from localStorage so the page paints instantly with
  // last-seen data when offline / on a flaky connection. React Query
  // revalidates in the background and writeBusCache refreshes the cache
  // on every successful fetch.
  const busRowsCacheKey = `rows-${currentCity.id}`;
  const busStandCacheKey = `stand-${currentCity.id}`;

  const cachedRowsPayload = useMemo(
    () => readBusCache<Row[]>(busRowsCacheKey),
    [busRowsCacheKey],
  );
  const cachedStandPayload = useMemo(
    () =>
      readBusCache<{
        phone: string | null;
        address: string | null;
        maps_url: string | null;
        notes: string | null;
      } | null>(busStandCacheKey),
    [busStandCacheKey],
  );
  const [cachedAt, setCachedAt] = useState<number | null>(cachedRowsPayload?.at ?? null);

  useEffect(() => {
    setCachedAt(cachedRowsPayload?.at ?? null);
  }, [cachedRowsPayload?.at]);

  const {
    data: dbRows = [],
    isLoading,
    isError: rowsError,
    refetch: refetchRows,
    isFetching: rowsFetching,
    dataUpdatedAt: rowsUpdatedAt,
  } = useQuery({
    queryKey: ['bus_timetable_public', currentCity.id],
    queryFn: async () => {
      let q = supabase
        .from('bus_timetable')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('destination', { ascending: true });

      if (currentCity.slug === 'muktainagar') {
        q = q.or(`city_id.eq.${currentCity.id},city_id.is.null`);
      } else {
        q = q.eq('city_id', currentCity.id);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as Row[];
    },
    initialData: cachedRowsPayload?.data,
    initialDataUpdatedAt: cachedRowsPayload?.at,
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const isSeedFallback = (!dbRows || dbRows.length === 0) && isMaval;
  const rows = useMemo(() => {
    if (dbRows && dbRows.length > 0) return dbRows;
    if (isMaval) return PARANDWADI_SEED_ROWS;
    return [];
  }, [dbRows, isMaval]);

  // Persist whenever a fresh network result lands (dataUpdatedAt increments).
  useEffect(() => {
    if (!rowsFetching && rows.length > 0 && !isSeedFallback && rowsUpdatedAt > (cachedRowsPayload?.at ?? 0)) {
      writeBusCache(busRowsCacheKey, rows);
      setCachedAt(rowsUpdatedAt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowsUpdatedAt, rowsFetching, busRowsCacheKey, isSeedFallback]);


  // Admin-editable bus stand info (table: bus_stand_info).
  const {
    data: standInfo,
    isLoading: standLoading,
    isError: standError,
    refetch: refetchStand,
    isFetching: standFetching,
    dataUpdatedAt: standUpdatedAt,
  } = useQuery({
    queryKey: ['bus_stand_info', currentCity.id],
    queryFn: async () => {
      let q = supabase
        .from('bus_stand_info')
        .select('phone, address, maps_url, notes');

      if (currentCity.slug === 'muktainagar') {
        q = q.or(`city_id.eq.${currentCity.id},city_id.is.null`);
      } else {
        q = q.eq('city_id', currentCity.id);
      }

      const { data, error } = await q.maybeSingle();
      if (error) throw error;
      return (data || null) as { phone: string | null; address: string | null; maps_url: string | null; notes: string | null } | null;
    },
    initialData: cachedStandPayload?.data,
    initialDataUpdatedAt: cachedStandPayload?.at,
    staleTime: 10 * 60_000,
    retry: 1,
  });

  useEffect(() => {
    if (!standFetching && standUpdatedAt > (cachedStandPayload?.at ?? 0)) {
      writeBusCache(busStandCacheKey, standInfo ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [standUpdatedAt, standFetching, busStandCacheKey]);

  const standReady = !standLoading && !standError;
  const standExtra = useMemo<{ verified_date?: string; enquiry_phone?: string } | null>(() => {
    if (!standInfo?.notes) return null;
    try {
      return JSON.parse(standInfo.notes) as { verified_date?: string; enquiry_phone?: string };
    } catch {
      return { verified_date: standInfo.notes };
    }
  }, [standInfo?.notes]);

  const standPhoneRaw = (standReady && standInfo?.phone?.trim())
    ? standInfo.phone.trim()
    : isMaval
      ? '020-24503300'
      : '';
  const standPhoneTel = standPhoneRaw.replace(/[^\d+]/g, '');
  const standAddress = (standReady && standInfo?.address?.trim())
    ? standInfo.address.trim()
    : isMaval
      ? (locale === 'mr'
          ? 'परंदवडी पीएमपीएमएल बस थांबा / सोमाटणे फाटा, मावळ, पुणे ४१०५०६'
          : 'Parandwadi PMPML Bus Stop / Somatane Phata, Maval, Pune 410506')
      : '';
  const standMapsUrl = (() => {
    if (standReady && standInfo?.maps_url?.trim()) {
      const direct = standInfo.maps_url.trim();
      try {
        const u = new URL(direct);
        const host = u.hostname.toLowerCase();
        const ok =
          (u.protocol === 'https:' || u.protocol === 'http:') &&
          (host === 'maps.google.com' ||
            host === 'www.google.com' ||
            host === 'google.com' ||
            host === 'maps.app.goo.gl' ||
            host === 'goo.gl' ||
            host.endsWith('.google.com'));
        if (ok) return direct;
      } catch {
        // fall through to address-based fallback
      }
    }
    if (standAddress) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(standAddress)}`;
    }
    if (isMaval) {
      return 'https://www.google.com/maps/search/?api=1&query=Parandwadi+Bus+Stop';
    }
    return '';
  })();

  // Citywide "leaving soon" — flatten + sort by time, keep next 8.
  const upcoming = useMemo<UpcomingDeparture[]>(() => {
    const out: UpcomingDeparture[] = [];
    for (const r of rows) {
      const dest = localizedDestination(r, locale);
      for (const tt of r.departure_times || []) {
        const m = toMinutes(tt);
        if (m == null) continue;
        if (m < nowMin) continue;
        out.push({
          rowId: r.id,
          destination: dest,
          time: tt,
          minutes: m,
          minutesUntil: m - nowMin,
        });
      }
    }
    out.sort((a, b) => a.minutes - b.minutes);
    return out.slice(0, 8);
  }, [rows, nowMin, locale]);

  const filtered = useMemo(() => {
    const q = debounced.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      r.destination.toLowerCase().includes(q) ||
      (r.destination_mr || '').toLowerCase().includes(q),
    );
  }, [rows, debounced]);

  // Which letters actually have destinations (for alphabet jump bar).
  const availableLetters = useMemo(() => {
    const s = new Set<string>();
    for (const r of filtered) {
      const first = r.destination.trim()[0]?.toUpperCase();
      if (first && first >= 'A' && first <= 'Z') s.add(first);
    }
    return s;
  }, [filtered]);

  const jumpToLetter = useCallback((letter: string) => {
    const el = document.getElementById(`bus-row-${letter}`);
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 110;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  }, []);

  const jumpToRow = useCallback((rowId: string) => {
    const el = document.getElementById(`bus-row-id-${rowId}`);
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 110;
      window.scrollTo({ top, behavior: 'smooth' });
      el.classList.add('ring-2', 'ring-primary');
      window.setTimeout(() => el.classList.remove('ring-2', 'ring-primary'), 1600);
      // Announce to SR users — find the destination + matching upcoming chip.
      const row = rows.find((r) => r.id === rowId);
      const u = upcoming.find((x) => x.rowId === rowId);
      if (row) {
        const dest = locale === 'mr' && row.destination_mr ? row.destination_mr : row.destination;
        const time = u ? formatTime(u.time) : '';
        setLiveMsg(time ? t('bus.jumpedTo', { dest, time }) : dest);
      }
    }
  }, [rows, upcoming, locale, t]);

  const jsonLd = useMemo(() => ({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    'name': `${locationLabel} Bus Stand — Daily Departures`,
    'itemListElement': rows.slice(0, 50).map((r, i) => ({
      '@type': 'ListItem',
      'position': i + 1,
      'name': r.destination,
      'description': r.departure_times.join(', '),
    })),
  }), [rows, locationLabel]);

  const formatUntil = (n: number) => {
    if (n <= 0) return t('bus.departed');
    if (n < 60) return t('bus.minLeft', { n });
    return t('bus.hrLeft', { h: Math.floor(n / 60), m: n % 60 });
  };

  // Surface feedback for the stand-call action so desktop users — where
  // tel: opens nothing visible — at least see the number to dial manually.
  const handleStandCall = useCallback(() => {
    if (!standPhoneRaw) return;
    if (canDialTel()) {
      toast.success(t('bus.callingStand', { phone: standPhoneRaw }));
    } else {
      toast.info(t('bus.callDesktop', { phone: standPhoneRaw }), { duration: 6000 });
    }
  }, [standPhoneRaw, t]);

  // Track which letters we've already labelled while rendering.
  const seenLetters = new Set<string>();

  return (
    <div className="min-h-screen bg-background">
      {indicatorNode}
      <PageSeo
        title={getPageTitle(
          locale === 'mr'
            ? `${villageName ? `${villageName} ` : ''}बस वेळापत्रक`
            : `${villageName ? `${villageName} ` : ''}Bus Timetable`
        )}
        description={
          locale === 'mr'
            ? `${locationLabel} बस वेळापत्रक, थेट पीएमपीएमएल बसेस, प्रस्थान वेळा व थांबे.`
            : `Daily bus departure times, direct PMPML routes, and transit stops in ${locationLabel}.`
        }
        path={`/${currentCity.slug}/bus-timetable`}
        jsonLd={jsonLd}
      />

      <CityPickerModal open={cityPickerOpen} onOpenChange={setCityPickerOpen} />

      {/* Screen-reader announcement region for jump-to-row actions */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{liveMsg}</div>

      <header className="sticky top-0 z-40 bg-primary text-primary-foreground shadow-md">
        <div className="max-w-3xl md:max-w-4xl lg:max-w-6xl xl:max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-3 flex items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
            <button
              onClick={() => navigate(`/${currentCity.slug}`)}
              className="inline-flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-primary-foreground/10 hover:bg-primary-foreground/20 shrink-0"
              aria-label={t('common.back')}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <Bus className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
              <div className="min-w-0">
                <h1 className="font-bold text-sm sm:text-lg leading-tight truncate">{t('bus.heading')}</h1>
                <p className="text-[11px] sm:text-xs text-primary-foreground/80 leading-tight truncate">
                  {villageName ? `${villageName}, ${cityName}` : t('bus.subheading', { town: townName })}
                </p>
              </div>
            </div>
          </div>

          <DesktopNav variant="primary" />

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Location Switcher Pill */}
            <button
              onClick={() => setCityPickerOpen(true)}
              className="inline-flex items-center gap-1 text-xs font-semibold px-2 sm:px-2.5 py-1 rounded-full bg-primary-foreground/15 text-primary-foreground border border-primary-foreground/25 hover:bg-primary-foreground/25 transition-colors"
              title={locale === 'mr' ? 'स्थान बदला' : 'Change Location'}
            >
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate max-w-[78px] sm:max-w-[140px]">{locationLabel}</span>
            </button>
            <span className="hidden xl:inline text-[10px] uppercase tracking-wider text-primary-foreground/80 tabular-nums whitespace-nowrap">
              {t('bus.asOf')} {formatNowLabel(nowMin)}
            </span>
            <UserMenuDrawer />
          </div>
        </div>
        {standLoading ? (
          <div className="max-w-3xl md:max-w-4xl lg:max-w-6xl xl:max-w-7xl mx-auto px-4 md:px-6 pb-2 flex items-center gap-2" aria-hidden="true">
            <div className="flex-1 h-9 rounded-lg bg-primary-foreground/20 animate-pulse" />
            <div className="flex-1 h-9 rounded-lg bg-primary-foreground/10 animate-pulse" />
          </div>
        ) : standError ? (
          <div className="max-w-3xl md:max-w-4xl lg:max-w-6xl xl:max-w-7xl mx-auto px-4 md:px-6 pb-2 flex items-center justify-between gap-2 text-[11px] text-primary-foreground/90">
            <span className="inline-flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              {t('bus.standInfoError')}
            </span>
            <button
              onClick={() => refetchStand()}
              className="px-2 py-1 rounded-md bg-primary-foreground/15 hover:bg-primary-foreground/25 font-semibold shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/60"
            >
              {t('bus.retry')}
            </button>
          </div>
        ) : (standPhoneTel || standMapsUrl) ? (
          <div className="max-w-3xl md:max-w-4xl lg:max-w-6xl xl:max-w-7xl mx-auto px-3 sm:px-4 md:px-6 pb-2 flex items-center gap-2">
            {standPhoneTel && (
              <a
                href={`tel:${standPhoneTel}`}
                onClick={handleStandCall}
                className="flex-1 min-w-0 inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary-foreground text-primary px-2.5 sm:px-3 py-2 font-semibold text-xs sm:text-sm shadow-sm hover:bg-primary-foreground/90 active:scale-[0.99] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/60"
                aria-label={`${t('bus.callStand')} ${standPhoneRaw}`}
              >
                <Phone className="w-4 h-4 shrink-0" />
                <span className="sm:hidden truncate">{t('bus.callStandShort')}</span>
                <span className="hidden sm:inline truncate">{t('bus.callStand')}</span>
                <span className="tabular-nums opacity-80 hidden sm:inline shrink-0">· {standPhoneRaw}</span>
              </a>
            )}
            {standMapsUrl && (
              <a
                href={standMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 min-w-0 inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary-foreground/10 text-primary-foreground border border-primary-foreground/30 px-2.5 sm:px-3 py-2 font-semibold text-xs sm:text-sm hover:bg-primary-foreground/20 active:scale-[0.99] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/60"
                aria-label={t('bus.openMaps')}
              >
                <MapPin className="w-4 h-4 shrink-0" />
                <span className="sm:hidden truncate">{t('bus.openMapsShort')}</span>
                <span className="hidden sm:inline truncate">{t('bus.openMaps')}</span>
              </a>
            )}
          </div>
        ) : null}

        {standExtra?.verified_date && (
          <div className="max-w-3xl md:max-w-4xl lg:max-w-6xl xl:max-w-7xl mx-auto px-4 md:px-6 pb-2 text-[11px] text-primary-foreground/85 flex items-center justify-between flex-wrap gap-1">
            <span className="flex items-center gap-1 font-medium">
              <span>✓</span>
              <span>{locale === 'mr' ? `आगार पडताळणी: ${standExtra.verified_date}` : `Verified with Depot: ${standExtra.verified_date}`}</span>
            </span>
            {standExtra.enquiry_phone && (
              <span className="opacity-95">
                {locale === 'mr' ? 'चौकशी कक्ष' : 'Depot Enquiry'}: {standExtra.enquiry_phone}
              </span>
            )}
          </div>
        )}
      </header>

      <main className="max-w-3xl md:max-w-4xl lg:max-w-6xl xl:max-w-7xl mx-auto px-4 md:px-6 py-4">
        {isSeedFallback && (
          <div
            role="status"
            className="mb-3 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300"
          >
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              {locale === 'mr'
                ? 'संदर्भ / नमुना वेळापत्रक दाखवत आहे — लाइव्ह आगार नोंदी अजून जोडलेल्या नाहीत.'
                : 'Showing reference / fallback schedule — live depot rows are not yet published for this town.'}
            </span>
          </div>
        )}
        {/* Parandwadi & Maval Village Transit Hub Guide Card */}
        {isParandwadi && (
          <section
            aria-label={locale === 'mr' ? 'परंदवडी बस वाहतूक मार्गदर्शक' : 'Parandwadi Bus Transit Guide'}
            className="mb-4 overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/10 via-card to-background p-4 shadow-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary text-primary-foreground shadow-xs">
                  <Bus className="w-3.5 h-3.5" />
                  PMPML 342
                </span>
                <h2 className="font-bold text-sm sm:text-base text-foreground">
                  {locale === 'mr' ? 'परंदवडी थेट बस सेवा व थांबे' : 'Parandwadi Direct Bus Transit & Stops'}
                </h2>
              </div>
              <span className="text-[11px] font-medium text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md">
                {locale === 'mr' ? 'दैनिक वेळापत्रक' : 'Daily Schedule'}
              </span>
            </div>

            {/* Direct Corridor View */}
            <div className="mt-3 p-2.5 rounded-xl bg-card border border-border/70 text-xs">
              <div className="font-semibold text-primary flex items-center gap-1.5 mb-1">
                <Navigation className="w-3.5 h-3.5" />
                <span>{locale === 'mr' ? 'मार्ग ३४२ मार्गक्रमण:' : 'Route 342 Corridor:'}</span>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                {locale === 'mr'
                  ? 'निगडी (भक्ती शक्ती) ⇄ देहूरोड बाजार व स्टेशन ⇄ बेगडेवाडी ⇄ सोमाटणे फाटा ⇄ परंदवडी ⇄ उर्से गाव (वासुदेव आश्रम)'
                  : 'Nigdi (Bhakti Shakti) ⇄ Dehu Road Bazar & Stn ⇄ Begdewadi ⇄ Somatane Phata ⇄ Parandwadi ⇄ Urse Gaon (Vasudev Ashram)'}
              </p>
            </div>

            {/* Parandwadi Village Stops */}
            <div className="mt-3">
              <p className="text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-primary" />
                <span>{locale === 'mr' ? 'परंदवडी गावातील मुख्य बस थांबे:' : 'Stops in Parandwadi Village:'}</span>
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="p-2 rounded-lg bg-card border border-border/60 text-center">
                  <div className="text-xs font-bold text-foreground">
                    {locale === 'mr' ? 'जि. प. शाळा' : 'ZP School'}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {locale === 'mr' ? 'मध्यवर्ती थांबा' : 'Central Stop'}
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-card border border-border/60 text-center">
                  <div className="text-xs font-bold text-foreground">
                    {locale === 'mr' ? 'शांताई निवास' : 'Shantai Niwas'}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {locale === 'mr' ? 'रहिवासी भाग' : 'Residential'}
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-card border border-border/60 text-center">
                  <div className="text-xs font-bold text-foreground">
                    {locale === 'mr' ? 'भोते वस्ती' : 'Bhote Wasti'}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {locale === 'mr' ? 'वस्ती थांबा' : 'Wasti Stop'}
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-card border border-border/60 text-center">
                  <div className="text-xs font-bold text-foreground">
                    {locale === 'mr' ? 'उर्से फाटा' : 'Urse Phata'}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {locale === 'mr' ? 'गाव वेस' : 'Village Entry'}
                  </div>
                </div>
              </div>
            </div>

            {/* Key Transit Hubs / Commuting Guide */}
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-card/80 border border-border/60">
                <div className="font-bold text-foreground flex items-center gap-1 mb-0.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                  <span>{locale === 'mr' ? 'सोमाटणे फाटा (३ किमी)' : 'Somatane Phata (3 km)'}</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {locale === 'mr'
                    ? 'पुणे-मुंबई महामार्ग. निगडी/पुण्यासाठी दर १५-२० मिनिटांनी बस (मार्ग ३०५) व शेअर रिक्षा.'
                    : 'Highway junction. Every 15-20 mins Route 305 & shared autos to Nigdi, Pune & Talegaon.'}
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-card/80 border border-border/60">
                <div className="font-bold text-foreground flex items-center gap-1 mb-0.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                  <span>{locale === 'mr' ? 'तळेगाव दाभाडे (४ किमी)' : 'Talegaon Dabhade (4 km)'}</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {locale === 'mr'
                    ? 'पुणे-लोणावळा लोकल ट्रेन व एसटी डेपोसाठी सर्वात जवळचे मुख्य केंद्र.'
                    : 'Nearest railway station for Pune-Lonavala local EMU trains & MSRTC Bus Depot.'}
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-card/80 border border-border/60">
                <div className="font-bold text-foreground flex items-center gap-1 mb-0.5">
                  <span className="w-2 h-2 rounded-full bg-violet-500 shrink-0" />
                  <span>{locale === 'mr' ? 'हिंजवडी आयटी पार्क' : 'Hinjawadi IT Park'}</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {locale === 'mr'
                    ? 'सोमाटणे किंवा वाकड फाटा येथून थेट आयटी पार्क (फेज १, २, ३) कनेक्ट.'
                    : 'Convenient daily commute via Somatane Phata or Wakad transfer routes.'}
                </p>
              </div>
            </div>

            {/* Help / Contact Banner */}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/60 text-xs">
              <span className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
                <Phone className="w-3.5 h-3.5 text-primary shrink-0" />
                <span>
                  {locale === 'mr' ? 'पीएमपीएमएल हेल्पलाईन: ' : 'PMPML Helpline: '}
                  <strong className="text-foreground tabular-nums">020-24503300</strong>
                </span>
                <span className="hidden sm:inline">·</span>
                <span className="hidden sm:inline">
                  {locale === 'mr' ? 'तळेगाव एसटी आगार: ' : 'Talegaon Depot: '}
                  <strong className="text-foreground tabular-nums">02114-222435</strong>
                </span>
              </span>
              <a
                href="https://www.google.com/maps/search/?api=1&query=Parandwadi+Bus+Stop"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-primary hover:underline text-[11px]"
              >
                <MapPin className="w-3 h-3" />
                <span>{locale === 'mr' ? 'परंदवडी बस स्टॉप नकाशावर पहा' : 'View Parandwadi Stop on Maps'}</span>
              </a>
            </div>
          </section>
        )}
        {/* Offline / cached-data notice — shown when the user is offline
            (and we're serving cached rows) or when the most recent network
            fetch failed but we still have a previous cached snapshot. */}
        {cachedAt != null && rows.length > 0 && (!online || rowsError) && (
          <div
            role="status"
            className="mb-3 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-700 dark:text-amber-300"
          >
            <WifiOff className="w-4 h-4 shrink-0" />
            <span className="flex-1">
              {online ? t('bus.cachedNoNetwork') : t('bus.cachedOffline')} · {formatCacheAge(cachedAt, locale)}
            </span>
            {online && (
              <button
                onClick={() => refetchRows()}
                disabled={rowsFetching}
                className="px-2 py-0.5 rounded-md bg-amber-500/20 hover:bg-amber-500/30 font-semibold disabled:opacity-60"
              >
                {t('bus.retry')}
              </button>
            )}
          </div>
        )}

        {/* Leaving soon strip */}
        {!isLoading && rows.length > 0 && (
          <section
            aria-label={t('bus.leavingSoon')}
            className="mb-4 rounded-xl border border-primary/30 bg-primary/5 p-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-primary" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-primary">
                  {t('bus.leavingSoon')}
                </h2>
              </div>
              {upcoming.length === 0 && (
                <span className="text-[11px] text-muted-foreground">{t('bus.noUpcoming')}</span>
              )}
            </div>
            {upcoming.length > 0 && (
              <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1 snap-x">
                {upcoming.map((u, i) => (
                  <button
                    key={`${u.rowId}-${u.time}-${i}`}
                    onClick={() => jumpToRow(u.rowId)}
                    className="snap-start shrink-0 text-left rounded-lg bg-card border border-border hover:border-primary px-3 py-2 min-w-[140px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span className="text-[11px] font-semibold text-primary tabular-nums">{formatTime(u.time)}</span>
                      <ArrowRight className="w-3 h-3 text-muted-foreground" />
                    </div>
                    <div className={cn("font-semibold text-foreground truncate leading-tight", locale === 'mr' ? "text-base" : "text-sm")}>{u.destination}</div>
                    <div className="text-[10px] text-muted-foreground tabular-nums">{formatUntil(u.minutesUntil)}</div>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('bus.searchPlaceholder')}
            className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label={t('bus.searchPlaceholder')}
          />
        </div>

        {/* Legend + count */}
        {!isLoading && rows.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3 text-[11px]">
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-primary" />
              {t('bus.legendNext')}
            </span>
            <span className="text-muted-foreground tabular-nums">
              {t('bus.destinationsCount', { count: filtered.length })}
            </span>
          </div>
        )}

        {isLoading ? (
          <div
            className="space-y-2"
            role="status"
            aria-live="polite"
            aria-busy="true"
            aria-label={t('bus.loading')}
          >
            <span className="sr-only">{t('bus.loading')}</span>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="rounded-xl border border-border h-16 skeleton-shimmer" aria-hidden="true" />
            ))}
          </div>
        ) : rowsError ? (
          <div
            role="alert"
            className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center"
          >
            <div className="mx-auto w-12 h-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <p className="font-semibold text-foreground">{t('bus.loadErrorTitle')}</p>
            <p className="text-sm text-muted-foreground mt-1">{t('bus.loadErrorHint')}</p>
            <button
              onClick={() => refetchRows()}
              disabled={rowsFetching}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 disabled:opacity-60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <RefreshCw className={cn('w-4 h-4', rowsFetching && 'animate-spin')} />
              {t('bus.retry')}
            </button>
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-6 text-center">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-muted text-muted-foreground flex items-center justify-center mb-3">
              <Bus className="w-6 h-6" />
            </div>
            <p className="font-semibold text-foreground">{t('bus.noDataTitle')}</p>
            <p className="text-sm text-muted-foreground mt-1">{t('bus.noDataHint')}</p>
            {standPhoneTel && (
              <a
                href={`tel:${standPhoneTel}`}
                onClick={handleStandCall}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors"
              >
                <Phone className="w-4 h-4" />
                {t('bus.callStand')}
              </a>
            )}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-6 text-center">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-muted text-muted-foreground flex items-center justify-center mb-3">
              <Inbox className="w-6 h-6" />
            </div>
            <p className="font-semibold text-foreground">{t('bus.searchEmptyTitle')}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {t('bus.searchEmptyHint', { q: debounced.trim() })}
            </p>
            <button
              onClick={() => setSearch('')}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="w-4 h-4" />
              {t('bus.clearSearch')}
            </button>
          </div>
        ) : (
          <div className="flex gap-3">
            {/* Alphabet jump rail — desktop/tablet only */}
            <nav
              aria-label={t('bus.jumpTo')}
              className="hidden sm:flex sticky top-20 self-start flex-col items-center gap-0.5 text-[10px] font-semibold text-muted-foreground"
            >
              {ALPHABET.map((l) => {
                const active = availableLetters.has(l);
                return (
                  <button
                    key={l}
                    disabled={!active}
                    onClick={() => jumpToLetter(l)}
                    className={`w-5 h-5 rounded transition-colors ${
                      active
                        ? 'text-primary hover:bg-primary/10'
                        : 'text-muted-foreground/30 cursor-default'
                    }`}
                    aria-label={`${t('bus.jumpTo')} ${l}`}
                  >
                    {l}
                  </button>
                );
              })}
            </nav>

            <ul ref={listRef} className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-3 space-y-0">
              {filtered.map((r) => {
                const dest = localizedDestination(r, locale);
                const times = r.departure_times || [];
                const nextIdx = (() => {
                  for (let i = 0; i < times.length; i++) {
                    const m = toMinutes(times[i]);
                    if (m != null && m >= nowMin) return i;
                  }
                  return -1;
                })();
                const firstLetter = r.destination.trim()[0]?.toUpperCase() || '';
                const showLetterAnchor = firstLetter && !seenLetters.has(firstLetter);
                if (showLetterAnchor) seenLetters.add(firstLetter);
                const nextMinutesUntil = nextIdx >= 0
                  ? (toMinutes(times[nextIdx])! - nowMin)
                  : null;

                const meta = parseBusNotes(r.notes);
                const typeCfg = BUS_TYPE_CONFIG[meta.bus_type] || BUS_TYPE_CONFIG.other;

                return (
                  <li
                    key={r.id}
                    id={`bus-row-id-${r.id}`}
                    className="rounded-xl border border-border bg-card p-3 transition-shadow"
                  >
                    {showLetterAnchor && (
                      <span id={`bus-row-${firstLetter}`} className="sr-only">
                        {firstLetter}
                      </span>
                    )}
                    <div className="flex items-baseline justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                        <h3 className={cn("font-bold text-foreground truncate", locale === 'mr' ? "text-base sm:text-lg" : "text-sm sm:text-base")}>{dest}</h3>
                        {meta.direction === 'incoming' && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20">
                            {locale === 'mr' ? '↙️ येणारी' : '↙️ Incoming'}
                          </span>
                        )}
                        {meta.bus_type !== 'msrtc_ordinary' && (
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${typeCfg.badgeCls}`}>
                            {locale === 'mr' ? typeCfg.label_mr : typeCfg.label}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0 tabular-nums">
                        {times.length} {times.length === 1 ? t('bus.tripOne') : t('bus.tripMany')}
                      </span>
                    </div>
                    {nextMinutesUntil != null && (
                      <p className="text-[11px] text-primary font-medium mb-1.5 tabular-nums">
                        {t('bus.nextDeparture')}: {formatTime(times[nextIdx])} · {formatUntil(nextMinutesUntil)}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1.5">
                      {times.map((tt, i) => {
                        const isNext = i === nextIdx;
                        const m = toMinutes(tt);
                        const past = m != null && m < nowMin;
                        return (
                          <span
                            key={`${tt}-${i}`}
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold tabular-nums ${
                              isNext
                                ? 'bg-primary text-primary-foreground ring-2 ring-primary/30'
                                : past
                                  ? 'bg-muted/50 text-muted-foreground line-through'
                                  : 'bg-muted text-foreground'
                            }`}
                            title={isNext ? t('bus.nextDeparture') : undefined}
                          >
                            {isNext && <Clock className="w-3 h-3" />}
                            {formatTime(tt)}
                          </span>
                        );
                      })}
                    </div>
                    {(meta.via.length > 0 || meta.raw_notes) && (
                      <div className="flex items-center gap-1.5 flex-wrap mt-2 text-[11px] text-muted-foreground">
                        {meta.via.map((v, i) => (
                          <span key={i} className="px-1.5 py-0.5 rounded-md bg-muted/80 text-[10px] font-medium border border-border/50">
                            {locale === 'mr' ? `मार्गे ${v}` : `via ${v}`}
                          </span>
                        ))}
                        {meta.raw_notes && <span className="italic">{meta.raw_notes}</span>}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
          <AlertTriangle className="w-3 h-3" />
          <span>{t('bus.disclaimer')}</span>
        </div>
      </main>

      <Footer />
    </div>
  );
}
