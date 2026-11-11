-- ============================================================================
-- Migration: 20261111000000_local_news_module.sql
-- Description: Creates tables, indexes, triggers, and RLS policies for the
--              hyper-local news module (news_sources + local_news) with
--              published_at dating and source URL deduplication.
-- ============================================================================

-- 1. NEWS_SOURCES TABLE (Per-town RSS feeds & web portals for scraping)
CREATE TABLE IF NOT EXISTS public.news_sources (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id           UUID NOT NULL REFERENCES public.geo_cities(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  source_type       TEXT NOT NULL DEFAULT 'rss' CHECK (source_type IN ('rss', 'webpage')),
  url               TEXT NOT NULL,
  language          TEXT NOT NULL DEFAULT 'mr' CHECK (language IN ('mr', 'en', 'hi')),
  category_default  TEXT NOT NULL DEFAULT 'local' CHECK (
    category_default IN ('local', 'civic', 'education', 'agriculture', 'markets', 'sports', 'alerts')
  ),
  is_active         BOOLEAN NOT NULL DEFAULT true,
  last_scraped_at   TIMESTAMPTZ NULL,
  last_status       TEXT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_news_sources_city_url UNIQUE (city_id, url)
);

-- 2. LOCAL_NEWS TABLE (Dated, town-scoped news feed items)
CREATE TABLE IF NOT EXISTS public.local_news (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id      UUID NOT NULL REFERENCES public.geo_cities(id) ON DELETE CASCADE,
  village_id   UUID NULL REFERENCES public.geo_villages(id) ON DELETE SET NULL,
  source_id    UUID NULL REFERENCES public.news_sources(id) ON DELETE SET NULL,
  title        TEXT NOT NULL,
  title_mr     TEXT NULL,
  summary      TEXT NULL,
  summary_mr   TEXT NULL,
  category     TEXT NOT NULL DEFAULT 'local' CHECK (
    category IN ('local', 'civic', 'education', 'agriculture', 'markets', 'sports', 'alerts')
  ),
  language     TEXT NOT NULL DEFAULT 'mr' CHECK (language IN ('mr', 'en', 'hi')),
  source_name  TEXT NOT NULL DEFAULT 'Town Desk',
  source_url   TEXT NULL,
  image_url    TEXT NULL,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  scraped_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_pinned    BOOLEAN NOT NULL DEFAULT false,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. INDEXES & DEDUPLICATION
DROP INDEX IF EXISTS public.uq_local_news_city_source_url;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_local_news_city_source_url'
  ) THEN
    ALTER TABLE public.local_news
      ADD CONSTRAINT uq_local_news_city_source_url UNIQUE (city_id, source_url);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_local_news_city_feed
  ON public.local_news (city_id, is_active, is_pinned DESC, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_local_news_published_at
  ON public.local_news (published_at DESC);

CREATE INDEX IF NOT EXISTS idx_news_sources_city
  ON public.news_sources (city_id, is_active);

-- 4. UPDATED_AT TRIGGERS
DROP TRIGGER IF EXISTS trg_news_sources_updated_at ON public.news_sources;
CREATE TRIGGER trg_news_sources_updated_at
  BEFORE UPDATE ON public.news_sources
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_local_news_updated_at ON public.local_news;
CREATE TRIGGER trg_local_news_updated_at
  BEFORE UPDATE ON public.local_news
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.news_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.local_news ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Published local news is publicly readable" ON public.local_news;
CREATE POLICY "Published local news is publicly readable"
  ON public.local_news FOR SELECT
  USING (is_active = true OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins manage local news" ON public.local_news;
CREATE POLICY "Admins manage local news"
  ON public.local_news FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins manage news sources" ON public.news_sources;
CREATE POLICY "Admins manage news sources"
  ON public.news_sources FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 6. GRANTS
GRANT SELECT ON public.local_news TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.local_news TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.news_sources TO authenticated;
