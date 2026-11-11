
-- ============================================================================
-- 2026-07-15 · m-Pulse database optimizations
-- ============================================================================

-- 1) Trigram GIN index on shops.description (name/keywords/address already exist)
CREATE INDEX IF NOT EXISTS idx_shops_description_trgm
  ON public.shops USING gin (description gin_trgm_ops);

-- 2) Slim public list view — projection used by Home/Shops initial render
CREATE OR REPLACE VIEW public.shops_list_public AS
SELECT
  s.id, s.slug, s.name, s.area, s.sub_area, s.address,
  s.image_url, s.opening_time, s.closing_time,
  s.is_open, s.is_verified, s.is_active, s.category_id,
  s.created_at, s.updated_at,
  (EXISTS (SELECT 1 FROM public.shop_owners o WHERE o.shop_id = s.id)) AS is_claimed
FROM public.shops s
WHERE s.is_active = true;

GRANT SELECT ON public.shops_list_public TO anon, authenticated;

-- 3) Search-only sidecar view (fetched lazily when user focuses search)
CREATE OR REPLACE VIEW public.shops_search_public AS
SELECT s.id, s.name, s.keywords, s.description, s.area, s.sub_area,
       s.phone, s.whatsapp, s.latitude, s.longitude
FROM public.shops s
WHERE s.is_active = true;

GRANT SELECT ON public.shops_search_public TO anon, authenticated;

-- 4) Materialised category-shop counts (avoids per-visitor client aggregation)
DROP MATERIALIZED VIEW IF EXISTS public.category_shop_counts;
CREATE MATERIALIZED VIEW public.category_shop_counts AS
SELECT c.id AS category_id, COUNT(DISTINCT sc.shop_id)::int AS shop_count
FROM public.categories c
LEFT JOIN public.shop_categories sc ON sc.category_id = c.id
LEFT JOIN public.shops s
  ON s.id = sc.shop_id AND s.is_active = true
WHERE c.is_active = true
GROUP BY c.id;

CREATE UNIQUE INDEX category_shop_counts_pk
  ON public.category_shop_counts (category_id);

GRANT SELECT ON public.category_shop_counts TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.refresh_category_shop_counts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.category_shop_counts;
EXCEPTION WHEN OTHERS THEN
  REFRESH MATERIALIZED VIEW public.category_shop_counts;
END $$;

REVOKE EXECUTE ON FUNCTION public.refresh_category_shop_counts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refresh_category_shop_counts() TO authenticated;

-- Trigger refresh when shops or shop_categories change
CREATE OR REPLACE FUNCTION public.trg_refresh_category_shop_counts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.refresh_category_shop_counts();
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS refresh_cat_counts_on_shops ON public.shops;
CREATE TRIGGER refresh_cat_counts_on_shops
AFTER INSERT OR UPDATE OF is_active OR DELETE ON public.shops
FOR EACH STATEMENT EXECUTE FUNCTION public.trg_refresh_category_shop_counts();

DROP TRIGGER IF EXISTS refresh_cat_counts_on_shop_categories ON public.shop_categories;
CREATE TRIGGER refresh_cat_counts_on_shop_categories
AFTER INSERT OR UPDATE OR DELETE ON public.shop_categories
FOR EACH STATEMENT EXECUTE FUNCTION public.trg_refresh_category_shop_counts();

-- 5) Paginated / filtered shops RPC — server-side filter + full-text-ish search
CREATE OR REPLACE FUNCTION public.get_shops_page(
  p_area text DEFAULT NULL,
  p_category uuid DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_limit int DEFAULT 24,
  p_offset int DEFAULT 0
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

GRANT EXECUTE ON FUNCTION public.get_shops_page(text, uuid, text, int, int) TO anon, authenticated;

-- 6) Admin-only RPC hook for image reprocessing backfill (marker + touch)
CREATE OR REPLACE FUNCTION public.reprocess_shop_image(_shop_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_url text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin only';
  END IF;
  SELECT image_url INTO v_url FROM public.shops WHERE id = _shop_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shop not found';
  END IF;
  UPDATE public.shops SET updated_at = now() WHERE id = _shop_id;
  RETURN v_url;
END $$;

REVOKE EXECUTE ON FUNCTION public.reprocess_shop_image(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reprocess_shop_image(uuid) TO authenticated;

-- Seed the materialised view with initial data
SELECT public.refresh_category_shop_counts();
