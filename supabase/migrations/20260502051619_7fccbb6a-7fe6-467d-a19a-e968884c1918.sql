
CREATE SCHEMA IF NOT EXISTS private;

-- Recreate the matview in the private schema
DROP MATERIALIZED VIEW IF EXISTS public.shop_engagement_stats;

CREATE MATERIALIZED VIEW IF NOT EXISTS private.shop_engagement_stats AS
SELECT
  e.shop_id,
  COUNT(*) FILTER (WHERE e.event_type = 'call'     AND e.created_at > now() - interval '30 days') AS calls_30d,
  COUNT(*) FILTER (WHERE e.event_type = 'whatsapp' AND e.created_at > now() - interval '30 days') AS waps_30d,
  COUNT(*)                FILTER (WHERE e.created_at > now() - interval '30 days')                AS total_30d
FROM public.shop_engagement e
GROUP BY e.shop_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_priv_shop_engagement_stats_shop
  ON private.shop_engagement_stats(shop_id);

REVOKE ALL ON SCHEMA private FROM anon, authenticated, public;
REVOKE ALL ON private.shop_engagement_stats FROM anon, authenticated, public;

-- Repoint trending RPC at the private matview
CREATE OR REPLACE FUNCTION public.get_trending_shops(lim int DEFAULT 10)
RETURNS TABLE (
  id uuid, name text, slug text, area text, image_url text,
  is_verified boolean, total_30d bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT s.id, s.name, s.slug, s.area, s.image_url, s.is_verified,
         coalesce(st.total_30d, 0) AS total_30d
  FROM public.shops s
  LEFT JOIN private.shop_engagement_stats st ON st.shop_id = s.id
  WHERE s.is_active = true
  ORDER BY coalesce(st.total_30d, 0) DESC, s.is_verified DESC, s.name ASC
  LIMIT lim;
$$;

REVOKE EXECUTE ON FUNCTION public.get_trending_shops(int) FROM anon;
GRANT  EXECUTE ON FUNCTION public.get_trending_shops(int) TO authenticated;
-- Public homepage uses anon; allow back explicitly (read-only, RLS-safe via WHERE is_active)
GRANT  EXECUTE ON FUNCTION public.get_trending_shops(int) TO anon;

-- Repoint refresh RPC at the private matview
CREATE OR REPLACE FUNCTION public.refresh_engagement_stats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin only';
  END IF;
  REFRESH MATERIALIZED VIEW CONCURRENTLY private.shop_engagement_stats;
END $$;

REVOKE EXECUTE ON FUNCTION public.refresh_engagement_stats() FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.refresh_engagement_stats() TO authenticated;

-- Initial population
REFRESH MATERIALIZED VIEW private.shop_engagement_stats;
