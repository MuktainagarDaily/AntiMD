-- Tighten search_shops: SECURITY INVOKER is enough since the SELECT already filters is_active=true
-- and the shops table allows public reads via RLS.
CREATE OR REPLACE FUNCTION public.search_shops(q text, lim int DEFAULT 12)
RETURNS TABLE (
  id uuid, name text, area text, address text, image_url text, slug text,
  is_verified boolean, is_open boolean, opening_time text, closing_time text,
  phone text, whatsapp text, score real
)
LANGUAGE sql
STABLE
SECURITY INVOKER
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

-- Lock the refresh helper to authenticated admins only
REVOKE ALL ON FUNCTION public.refresh_engagement_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refresh_engagement_stats() TO authenticated;

-- Hide the materialized view from PostgREST; expose top-N through an RPC instead
REVOKE ALL ON public.shop_engagement_stats FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_trending_shops(lim int DEFAULT 5)
RETURNS TABLE (
  id uuid, name text, area text, image_url text, slug text,
  is_verified boolean, is_open boolean, opening_time text, closing_time text,
  phone text, whatsapp text,
  calls_30d bigint, waps_30d bigint, total_30d bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.name, s.area, s.image_url, s.slug,
         s.is_verified, s.is_open, s.opening_time, s.closing_time,
         s.phone, s.whatsapp,
         st.calls_30d, st.waps_30d, st.total_30d
  FROM public.shop_engagement_stats st
  JOIN public.shops s ON s.id = st.shop_id
  WHERE s.is_active = true
  ORDER BY st.total_30d DESC, s.is_verified DESC, s.name ASC
  LIMIT lim;
$$;

GRANT EXECUTE ON FUNCTION public.get_trending_shops(int) TO anon, authenticated;
