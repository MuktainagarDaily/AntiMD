-- ============================================================
-- Phase A: Database & DSA foundations
-- ============================================================

-- A1. Performance indexes ------------------------------------
CREATE INDEX IF NOT EXISTS idx_shops_is_active       ON public.shops(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_shops_area            ON public.shops(area);
CREATE INDEX IF NOT EXISTS idx_shops_category_id     ON public.shops(category_id);
CREATE INDEX IF NOT EXISTS idx_shops_created_at_desc ON public.shops(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shop_categories_shop_id     ON public.shop_categories(shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_categories_category_id ON public.shop_categories(category_id);
CREATE INDEX IF NOT EXISTS idx_shop_requests_status        ON public.shop_requests(status, created_at DESC);

-- A2. Foreign keys (clean up any orphans first, then add constraints) -----
DELETE FROM public.shop_categories sc
  WHERE NOT EXISTS (SELECT 1 FROM public.shops s WHERE s.id = sc.shop_id)
     OR NOT EXISTS (SELECT 1 FROM public.categories c WHERE c.id = sc.category_id);

DELETE FROM public.shop_engagement e
  WHERE NOT EXISTS (SELECT 1 FROM public.shops s WHERE s.id = e.shop_id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_sc_shop') THEN
    ALTER TABLE public.shop_categories
      ADD CONSTRAINT fk_sc_shop FOREIGN KEY (shop_id)     REFERENCES public.shops(id)      ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_sc_cat') THEN
    ALTER TABLE public.shop_categories
      ADD CONSTRAINT fk_sc_cat  FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_eng_shop') THEN
    ALTER TABLE public.shop_engagement
      ADD CONSTRAINT fk_eng_shop FOREIGN KEY (shop_id)    REFERENCES public.shops(id)      ON DELETE CASCADE;
  END IF;
END $$;

-- A3. Trigram fuzzy search ---------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_shops_name_trgm     ON public.shops USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_shops_keywords_trgm ON public.shops USING gin (keywords gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_shops_address_trgm  ON public.shops USING gin (address gin_trgm_ops);

-- A4. Ranked fuzzy search RPC -------------------------------------
CREATE OR REPLACE FUNCTION public.search_shops(q text, lim int DEFAULT 12)
RETURNS TABLE (
  id uuid,
  name text,
  area text,
  address text,
  image_url text,
  slug text,
  is_verified boolean,
  is_open boolean,
  opening_time text,
  closing_time text,
  phone text,
  whatsapp text,
  score real
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.name, s.area, s.address, s.image_url, s.slug,
         s.is_verified, s.is_open, s.opening_time, s.closing_time,
         s.phone, s.whatsapp,
         GREATEST(
           similarity(coalesce(s.name,''),     q),
           similarity(coalesce(s.keywords,''), q) * 0.85,
           similarity(coalesce(s.area,''),     q) * 0.7,
           similarity(coalesce(s.address,''),  q) * 0.6
         ) AS score
  FROM public.shops s
  WHERE s.is_active = true
    AND (
      s.name     ILIKE '%' || q || '%'
      OR s.keywords ILIKE '%' || q || '%'
      OR s.area  ILIKE '%' || q || '%'
      OR s.address ILIKE '%' || q || '%'
      OR similarity(coalesce(s.name,''),     q) > 0.2
      OR similarity(coalesce(s.keywords,''), q) > 0.2
    )
  ORDER BY score DESC, s.is_verified DESC, s.name ASC
  LIMIT lim;
$$;

GRANT EXECUTE ON FUNCTION public.search_shops(text, int) TO anon, authenticated;

-- A5. Materialized engagement leaderboard ----------------------
DROP MATERIALIZED VIEW IF EXISTS public.shop_engagement_stats;
CREATE MATERIALIZED VIEW public.shop_engagement_stats AS
SELECT
  shop_id,
  COUNT(*) FILTER (WHERE event_type = 'call')     AS calls_30d,
  COUNT(*) FILTER (WHERE event_type = 'whatsapp') AS waps_30d,
  COUNT(*)                                        AS total_30d,
  MAX(created_at)                                 AS last_event_at
FROM public.shop_engagement
WHERE created_at > now() - interval '30 days'
GROUP BY shop_id;

CREATE UNIQUE INDEX IF NOT EXISTS shop_engagement_stats_pk ON public.shop_engagement_stats(shop_id);
CREATE INDEX IF NOT EXISTS shop_engagement_stats_total_idx ON public.shop_engagement_stats(total_30d DESC);

GRANT SELECT ON public.shop_engagement_stats TO anon, authenticated;

-- Refresh helper (called by a daily cron / edge function later)
CREATE OR REPLACE FUNCTION public.refresh_engagement_stats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.shop_engagement_stats;
EXCEPTION WHEN OTHERS THEN
  -- CONCURRENTLY needs the unique index; fall back to plain refresh on first run
  REFRESH MATERIALIZED VIEW public.shop_engagement_stats;
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_engagement_stats() TO authenticated;
