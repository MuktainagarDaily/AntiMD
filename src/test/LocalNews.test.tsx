import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  formatNewsDateIST,
  fromDatetimeLocalValue,
  getNewsDateGroupLabel,
  inferNewsCategory,
  parseHtmlArticleMeta,
  parseHtmlNewsDocument,
  parseNewsDate,
  parseRssOrAtomXml,
  toDatetimeLocalValue,
} from '@/lib/news/newsParser';
import { ADMIN_NAV, findActive } from '@/components/admin/layout/adminNav';
import LocalNews from '@/pages/LocalNews';
import { LocalNewsTab } from '@/components/admin/LocalNewsTab';
import type { LocalNewsItem, NewsSource } from '@/lib/news/newsTypes';

const {
  mockFetchLocalNewsForCity,
  mockFetchNewsSources,
  mockScrapeInternetNews,
  mockSaveNewsItem,
  mockUseCity,
} = vi.hoisted(() => ({
  mockFetchLocalNewsForCity: vi.fn(),
  mockFetchNewsSources: vi.fn(),
  mockScrapeInternetNews: vi.fn(),
  mockSaveNewsItem: vi.fn(),
  mockUseCity: vi.fn(),
}));

vi.mock('@/lib/news/newsService', () => ({
  fetchLocalNewsForCity: mockFetchLocalNewsForCity,
  fetchNewsSources: mockFetchNewsSources,
  scrapeInternetNews: mockScrapeInternetNews,
  saveNewsItem: mockSaveNewsItem,
  deleteNewsItem: vi.fn(),
  patchNewsFlags: vi.fn(),
  saveNewsSource: vi.fn(),
  deleteNewsSource: vi.fn(),
  seedDefaultNewsSources: vi.fn(),
}));

vi.mock('@/hooks/useCity', () => {
  const fn = () => mockUseCity();
  return {
    useCity: fn,
    useOptionalCity: fn,
  };
});

vi.mock('@/hooks/useBanners', () => ({
  useBannersForPlacement: () => [],
  useAllBanners: () => [],
}));

vi.mock('@/i18n', () => ({
  useT: () => ({
    locale: 'en',
    t: (k: string) => k,
    setLocale: vi.fn(),
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    message: vi.fn(),
  },
}));

const CITY_MUKTAINAGAR = {
  id: '644b68eb-472c-40d3-9f83-c7d26e121498',
  slug: 'muktainagar',
  name: 'Muktainagar',
  name_mr: 'मुक्ताईनगर',
  district: 'Jalgaon',
  state: 'Maharashtra',
  tagline: 'Local Portal',
  tagline_mr: 'स्थानिक पोर्टल',
  is_active: true,
};

const REF_NOW = new Date('2026-11-11T10:00:00.000Z'); // 11 Nov 2026 15:30 IST

const SAMPLE_SOURCES: NewsSource[] = [
  {
    id: 'src-1',
    city_id: CITY_MUKTAINAGAR.id,
    name: 'Google News · Muktainagar (English)',
    source_type: 'rss',
    url: 'https://news.google.com/rss/search?q=Muktainagar&hl=en-IN',
    language: 'en',
    category_default: 'local',
    is_active: true,
  },
];

function makeSampleNews(): LocalNewsItem[] {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  return [
    {
      id: 'news-1',
      city_id: CITY_MUKTAINAGAR.id,
      source_id: 'src-1',
      title: 'Municipal water supply schedule updated for Ward 4',
      title_mr: null,
      summary: 'Morning supply timing shifted to 6:30 AM across central Muktainagar.',
      summary_mr: null,
      category: 'civic',
      language: 'en',
      source_name: 'Lokmat Jalgaon',
      source_url: 'https://example.com/water-ward-4',
      image_url: null,
      published_at: now.toISOString(),
      scraped_at: now.toISOString(),
      is_pinned: true,
      is_active: true,
    },
    {
      id: 'news-2',
      city_id: CITY_MUKTAINAGAR.id,
      source_id: 'src-1',
      title: 'Yellow weather warning issued for Jalgaon cotton belt',
      title_mr: null,
      summary: 'Farmers advised to protect harvested cotton from evening showers.',
      summary_mr: null,
      category: 'alerts',
      language: 'en',
      source_name: 'IMD Bulletin',
      source_url: 'https://example.com/weather-alert',
      image_url: null,
      published_at: yesterday.toISOString(),
      scraped_at: now.toISOString(),
      is_pinned: false,
      is_active: true,
    },
  ];
}

describe('Local News Parser & Proper Dating', () => {
  it('parses RFC-2822, ISO-8601, DD/MM/YYYY, and rejects undated or far-future dates', () => {
    const rfc = parseNewsDate('Wed, 11 Nov 2026 08:30:00 GMT', REF_NOW);
    expect(rfc).not.toBeNull();
    expect(rfc!.toISOString()).toBe('2026-11-11T08:30:00.000Z');

    const iso = parseNewsDate('2026-11-10T14:15:00+05:30', REF_NOW);
    expect(iso).not.toBeNull();
    expect(iso!.toISOString()).toBe('2026-11-10T08:45:00.000Z');

    const dmy = parseNewsDate('10/11/2026 07:30', REF_NOW);
    expect(dmy).not.toBeNull();
    expect(dmy!.toISOString()).toBe('2026-11-10T02:00:00.000Z');

    expect(parseNewsDate('', REF_NOW)).toBeNull();
    expect(parseNewsDate('not-a-date', REF_NOW)).toBeNull();
    expect(parseNewsDate('2035-01-01T00:00:00Z', REF_NOW)).toBeNull();
    expect(parseNewsDate('1999-01-01T00:00:00Z', REF_NOW)).toBeNull();
  });

  it('groups IST dates into Today / Yesterday labels and roundtrips datetime-local', () => {
    expect(getNewsDateGroupLabel('2026-11-11T04:00:00.000Z', 'en', REF_NOW)).toContain('Today');
    expect(getNewsDateGroupLabel('2026-11-10T04:00:00.000Z', 'en', REF_NOW)).toContain('Yesterday');
    expect(formatNewsDateIST('2026-11-11T08:30:00.000Z', 'en')).toContain('Nov');

    const local = toDatetimeLocalValue('2026-11-11T08:30:00.000Z');
    expect(local).toBe('2026-11-11T14:00');
    expect(fromDatetimeLocalValue(local)).toBe('2026-11-11T08:30:00.000Z');
  });

  it('parses RSS items with publisher splitting and skips undated items', () => {
    const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
    <rss version="2.0"><channel>
      <item>
        <title>Heavy rain alert in Muktainagar taluka - Sakal Times</title>
        <link>https://example.com/rain-alert</link>
        <pubDate>Wed, 11 Nov 2026 06:00:00 GMT</pubDate>
        <description><![CDATA[<p>Rainfall alert for farmers and markets.</p>]]></description>
      </item>
      <item>
        <title>Undated spam headline</title>
        <link>https://example.com/no-date</link>
      </item>
    </channel></rss>`;

    const result = parseRssOrAtomXml(rssXml, {
      cityId: CITY_MUKTAINAGAR.id,
      sourceName: 'Fallback Source',
      language: 'en',
      defaultCategory: 'local',
      now: REF_NOW,
    });

    expect(result.items).toHaveLength(1);
    expect(result.skippedInvalidDate).toBe(1);
    expect(result.items[0].title).toBe('Heavy rain alert in Muktainagar taluka');
    expect(result.items[0].source_name).toBe('Sakal Times');
    expect(result.items[0].category).toBe('alerts');
    expect(result.items[0].published_at).toBe('2026-11-11T06:00:00.000Z');
  });

  it('parses Atom entries and HTML article meta with strict publication date validation', () => {
    const atomXml = `<feed xmlns="http://www.w3.org/2005/Atom">
      <entry>
        <title>मुक्ताईनगर कृषी उत्पन्न बाजार समिती केळी दर जाहीर</title>
        <link href="https://example.com/banana-rates" />
        <published>2026-11-10T10:00:00+05:30</published>
        <summary>शेतकरी बांधवांसाठी आजचे ताजे बाजार भाव.</summary>
      </entry>
    </feed>`;

    const atomParsed = parseRssOrAtomXml(atomXml, {
      cityId: CITY_MUKTAINAGAR.id,
      sourceName: 'Agri Feed',
      language: 'mr',
      defaultCategory: 'local',
      now: REF_NOW,
    });

    expect(atomParsed.items).toHaveLength(1);
    expect(atomParsed.items[0].language).toBe('mr');
    expect(atomParsed.items[0].category).toBe('agriculture');

    const htmlWithDate = `<html><head>
      <meta property="og:title" content="College scholarship admission notice released" />
      <meta property="article:published_time" content="2026-11-11T07:00:00+05:30" />
      <meta property="og:site_name" content="EduPortal" />
      <meta name="description" content="Students can apply online before Friday." />
    </head></html>`;

    const htmlMeta = parseHtmlArticleMeta(htmlWithDate, 'https://eduportal.in/notice', {
      cityId: CITY_MUKTAINAGAR.id,
      sourceName: 'EduPortal',
      language: 'en',
      defaultCategory: 'local',
      now: REF_NOW,
    });

    expect(htmlMeta).not.toBeNull();
    expect(htmlMeta!.category).toBe('education');
    expect(htmlMeta!.source_name).toBe('EduPortal');
    expect(inferNewsCategory('Ward road repair starts tomorrow', '')).toBe('civic');

    const htmlNoDate = `<html><head><title>Undated Page</title></head></html>`;
    expect(
      parseHtmlArticleMeta(htmlNoDate, 'https://example.com/nodate', {
        cityId: CITY_MUKTAINAGAR.id,
        sourceName: 'NoDate',
        language: 'en',
        defaultCategory: 'local',
        now: REF_NOW,
      }),
    ).toBeNull();
  });

  it('extracts multiple dated articles from portal topic/listing HTML (e.g. loksatta.com/about/...)', () => {
    const listingHtml = `<html><head>
      <meta property="og:site_name" content="Loksatta" />
    </head><body>
      <article id="event-6001724">
        <figure class="post-thumbnail">
          <a href="/pune/maval-rain-update-6001724/" aria-label="मावळ तालुक्यात पावसाचा इशारा">
            <img src="https://www.loksatta.com/default-ie.jpg" data-src="https://images.loksattaimg.com/2026/09/maval.jpg?w=310&amp;h=174" />
          </a>
        </figure>
        <div class="entry-wrapper">
          <div class="entry-title">
            <a href="https://www.loksatta.com/pune/maval-rain-update-6001724/" rel="bookmark">मावळ तालुक्यात मुसळधार पावसाचा इशारा, प्रशासन सतर्क</a>
          </div>
          <div class="post-excerpt"><p>नागरिकांना सुरक्षित स्थळी राहण्याचे आवाहन करण्यात आले आहे.</p></div>
          <time class="entry-date published" datetime="2026-09-08T11:59:19+05:30">September 8, 2026 11:59 IST</time>
        </div>
      </article>
    </body></html>`;

    const parsed = parseHtmlNewsDocument(listingHtml, 'https://www.loksatta.com/about/maval/', {
      cityId: CITY_MUKTAINAGAR.id,
      sourceName: 'Web',
      language: 'mr',
      defaultCategory: 'local',
      now: REF_NOW,
    });

    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0].title).toBe('मावळ तालुक्यात मुसळधार पावसाचा इशारा, प्रशासन सतर्क');
    expect(parsed.items[0].source_name).toBe('Loksatta');
    expect(parsed.items[0].source_url).toBe('https://www.loksatta.com/pune/maval-rain-update-6001724/');
    expect(parsed.items[0].image_url).toBe('https://images.loksattaimg.com/2026/09/maval.jpg?w=310&h=174');
    expect(parsed.items[0].published_at).toBe('2026-09-08T06:29:19.000Z');
  });
});

describe('Admin Nav & Local News UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCity.mockReturnValue({
      currentCity: CITY_MUKTAINAGAR,
      allCities: [CITY_MUKTAINAGAR],
      townName: 'Muktainagar',
      townBrand: 'ApnaTown',
      getPageTitle: (p: string) => `${p} · ApnaTown`,
    });
  });

  it('marks Local News as live in ADMIN_NAV and resolves /admin/sections/news', () => {
    const sectionsHub = ADMIN_NAV.find((h) => h.key === 'sections');
    const newsLeaf = sectionsHub?.leaves.find((l) => l.key === 'news');
    expect(newsLeaf?.status).toBe('live');

    const resolved = findActive('/admin/sections/news');
    expect(resolved?.hub.key).toBe('sections');
    expect(resolved?.leaf?.key).toBe('news');
  });

  it('renders public LocalNews page grouped by date and filters by topic category', async () => {
    const sample = makeSampleNews();
    mockFetchLocalNewsForCity.mockResolvedValue({ items: sample, storageMode: 'local-cache' });
    mockFetchNewsSources.mockResolvedValue({ sources: SAMPLE_SOURCES, storageMode: 'local-cache' });
    mockScrapeInternetNews.mockResolvedValue({
      items: sample,
      sourcesUsed: 1,
      fetchedCount: 2,
      insertedCount: 0,
      reports: [],
      storageMode: 'local-cache',
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <HelmetProvider>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/muktainagar/news']}>
            <LocalNews />
          </MemoryRouter>
        </QueryClientProvider>
      </HelmetProvider>,
    );

    expect(
      await screen.findByText('Municipal water supply schedule updated for Ward 4'),
    ).toBeInTheDocument();
    expect(document.querySelector('header > div')?.className).toContain('bg-primary');
    expect(document.querySelector('header > div')?.className).toContain('text-primary-foreground');
    expect(screen.getByText('Yellow weather warning issued for Jalgaon cotton belt')).toBeInTheDocument();

    // Filter to Public Alerts topic
    fireEvent.click(screen.getByRole('button', { name: 'Public Alerts' }));

    await waitFor(() => {
      expect(
        screen.queryByText('Municipal water supply schedule updated for Ward 4'),
      ).not.toBeInTheDocument();
    });
    expect(screen.getByText('Yellow weather warning issued for Jalgaon cotton belt')).toBeInTheDocument();

    // Trigger internet refresh button
    fireEvent.click(screen.getByRole('button', { name: /refresh/i }));
    await waitFor(() => {
      expect(mockScrapeInternetNews).toHaveBeenCalledTimes(1);
    });
  });

  it('renders Admin LocalNewsTab, runs internet scraper, and opens manual dated article modal', async () => {
    const sample = makeSampleNews();
    mockFetchLocalNewsForCity.mockResolvedValue({ items: sample, storageMode: 'local-cache' });
    mockFetchNewsSources.mockResolvedValue({ sources: SAMPLE_SOURCES, storageMode: 'local-cache' });
    mockScrapeInternetNews.mockResolvedValue({
      items: sample,
      sourcesUsed: 1,
      fetchedCount: 2,
      insertedCount: 1,
      reports: [
        {
          sourceName: 'Google News · Muktainagar (English)',
          url: SAMPLE_SOURCES[0].url,
          fetched: 2,
          skippedInvalidDate: 0,
        },
      ],
      storageMode: 'local-cache',
    });
    mockSaveNewsItem.mockResolvedValue({ item: sample[0], storageMode: 'local-cache' });

    render(
      <MemoryRouter>
        <LocalNewsTab />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText('Municipal water supply schedule updated for Ward 4'),
    ).toBeInTheDocument();

    // Scrape configured internet sources
    fireEvent.click(screen.getByRole('button', { name: /Scrape Internet Sources/i }));
    await waitFor(() => {
      expect(mockScrapeInternetNews).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByText(/2 dated articles fetched/i)).toBeInTheDocument();

    // Open Publish Article modal
    fireEvent.click(screen.getByRole('button', { name: /Publish Article/i }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });
});
