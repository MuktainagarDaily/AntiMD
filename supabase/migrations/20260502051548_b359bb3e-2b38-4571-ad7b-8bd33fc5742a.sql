
-- ============================================================================
-- Sync Cloud DB with documented master_schema.sql + AUTH_WIREUP.md
-- (Phase A search/trending + profiles_public + categories.created_at + indexes)
-- ============================================================================

-- 1. categories.created_at (documented in master schema change log)
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- 2. Helpful indexes
CREATE INDEX IF NOT EXISTS idx_shop_claims_user_created
  ON public.shop_claims (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shop_engagement_shop_created
  ON public.shop_engagement (shop_id, created_at DESC);

-- 3. profiles_public view (safe anon read of id + full_name only)
CREATE OR REPLACE VIEW public.profiles_public
WITH (security_invoker = on) AS
SELECT id, full_name FROM public.profiles;

GRANT SELECT ON public.profiles_public TO anon, authenticated;

-- 4. Phase A — fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_shops_name_trgm
  ON public.shops USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_shops_keywords_trgm
  ON public.shops USING gin (keywords gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_shops_address_trgm
  ON public.shops USING gin (address gin_trgm_ops);

-- Other phase-A indexes (idempotent)
CREATE INDEX IF NOT EXISTS idx_shops_is_active       ON public.shops(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_shops_area            ON public.shops(area);
CREATE INDEX IF NOT EXISTS idx_shops_category_id     ON public.shops(category_id);
CREATE INDEX IF NOT EXISTS idx_shops_created_at_desc ON public.shops(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shop_categories_shop_id     ON public.shop_categories(shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_categories_category_id ON public.shop_categories(category_id);
CREATE INDEX IF NOT EXISTS idx_shop_requests_status        ON public.shop_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_engagement_created          ON public.shop_engagement (created_at);
CREATE INDEX IF NOT EXISTS idx_engagement_shop             ON public.shop_engagement (shop_id);

-- 5. search_shops RPC (typo-tolerant, RLS-safe via SECURITY INVOKER)
CREATE OR REPLACE FUNCTION public.search_shops(q text, lim int DEFAULT 20)
RETURNS TABLE (
  id uuid, name text, slug text, area text, sub_area text,
  address text, image_url text, is_open boolean, is_verified boolean,
  rank real
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT s.id, s.name, s.slug, s.area, s.sub_area, s.address, s.image_url,
         s.is_open, s.is_verified,
         GREATEST(
           similarity(s.name, q),
           similarity(coalesce(s.keywords,''), q) * 0.7,
           similarity(coalesce(s.address,''), q) * 0.5,
           similarity(coalesce(s.area,''), q) * 0.5
         ) AS rank
  FROM public.shops s
  WHERE s.is_active = true
    AND (
      s.name     ILIKE '%' || q || '%'
      OR s.keywords ILIKE '%' || q || '%'
      OR s.address  ILIKE '%' || q || '%'
      OR s.area     ILIKE '%' || q || '%'
      OR similarity(s.name, q) > 0.25
      OR similarity(coalesce(s.keywords,''), q) > 0.3
    )
  ORDER BY rank DESC, s.is_verified DESC, s.name ASC
  LIMIT lim;
$$;

GRANT EXECUTE ON FUNCTION public.search_shops(text, int) TO anon, authenticated;

-- 6. Trending — materialized view + RPCs
CREATE MATERIALIZED VIEW IF NOT EXISTS public.shop_engagement_stats AS
SELECT
  e.shop_id,
  COUNT(*) FILTER (WHERE e.event_type = 'call'     AND e.created_at > now() - interval '30 days') AS calls_30d,
  COUNT(*) FILTER (WHERE e.event_type = 'whatsapp' AND e.created_at > now() - interval '30 days') AS waps_30d,
  COUNT(*)                FILTER (WHERE e.created_at > now() - interval '30 days')                AS total_30d
FROM public.shop_engagement e
GROUP BY e.shop_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_shop_engagement_stats_shop
  ON public.shop_engagement_stats(shop_id);

-- Lock matview from public PostgREST exposure
REVOKE ALL ON public.shop_engagement_stats FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_trending_shops(lim int DEFAULT 10)
RETURNS TABLE (
  id uuid, name text, slug text, area text, image_url text,
  is_verified boolean, total_30d bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.name, s.slug, s.area, s.image_url, s.is_verified,
         coalesce(st.total_30d, 0) AS total_30d
  FROM public.shops s
  LEFT JOIN public.shop_engagement_stats st ON st.shop_id = s.id
  WHERE s.is_active = true
  ORDER BY coalesce(st.total_30d, 0) DESC, s.is_verified DESC, s.name ASC
  LIMIT lim;
$$;

GRANT EXECUTE ON FUNCTION public.get_trending_shops(int) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.refresh_engagement_stats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin only';
  END IF;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.shop_engagement_stats;
END $$;

REVOKE EXECUTE ON FUNCTION public.refresh_engagement_stats() FROM anon;
GRANT EXECUTE ON FUNCTION public.refresh_engagement_stats() TO authenticated;

-- Initial population
REFRESH MATERIALIZED VIEW public.shop_engagement_stats;
