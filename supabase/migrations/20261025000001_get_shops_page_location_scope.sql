-- 2026-10-25: Add city_id and village_id parameters to get_shops_page RPC
CREATE OR REPLACE FUNCTION public.get_shops_page(
  p_area text DEFAULT NULL,
  p_category uuid DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_limit int DEFAULT 24,
  p_offset int DEFAULT 0,
  p_city_id uuid DEFAULT NULL,
  p_village_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid, slug text, name text, area text, sub_area text, address text,
  image_url text, opening_time text, closing_time text,
  is_open boolean, is_verified boolean, category_id uuid,
  is_claimed boolean, total_count bigint
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH base AS (
    SELECT s.*,
           EXISTS (SELECT 1 FROM public.shop_owners o WHERE o.shop_id = s.id) AS is_claimed
    FROM public.shops s
    WHERE s.is_active = true
      AND (p_village_id IS NULL OR s.village_id = p_village_id)
      AND (p_city_id IS NULL OR s.city_id = p_city_id)
      AND (p_area IS NULL OR s.area = p_area)
      AND (
        p_category IS NULL
        OR s.category_id = p_category
        OR EXISTS (
          SELECT 1 FROM public.shop_categories sc
          WHERE sc.shop_id = s.id AND sc.category_id = p_category
        )
      )
      AND (
        p_search IS NULL OR length(btrim(p_search)) = 0
        OR s.name        ILIKE '%' || p_search || '%'
        OR s.keywords    ILIKE '%' || p_search || '%'
        OR s.area        ILIKE '%' || p_search || '%'
        OR s.address     ILIKE '%' || p_search || '%'
        OR s.description ILIKE '%' || p_search || '%'
      )
  ), counted AS (
    SELECT COUNT(*)::bigint AS total_count FROM base
  )
  SELECT b.id, b.slug, b.name, b.area, b.sub_area, b.address,
         b.image_url, b.opening_time, b.closing_time,
         b.is_open, b.is_verified, b.category_id,
         b.is_claimed, (SELECT total_count FROM counted)
  FROM base b
  ORDER BY b.is_verified DESC, b.created_at DESC
  LIMIT GREATEST(p_limit, 1)
  OFFSET GREATEST(p_offset, 0);
$$;

GRANT EXECUTE ON FUNCTION public.get_shops_page(text, uuid, text, int, int, uuid, uuid) TO anon, authenticated;
