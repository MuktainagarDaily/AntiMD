-- ============================================================================
-- 2026-11-09 · Security Hardening Patch v3
-- ApnaLocal / Muktainagar Daily
-- Fixes:
--   SEC-01: Missing PostgREST GRANTs on authority_* essential services tables
--   SEC-02: Missing DELETE RLS policies on mess_profiles, pg_profiles, mess_daily_menus
--   SEC-05: Overly broad authenticated GRANT on mcp_endpoints table
--   SEC-07: Guard get_shops_page() against Search Resource Exhaustion
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. [SEC-01] Table-Level Grants for Essential Services & Local Authorities
-- ----------------------------------------------------------------------------
-- PostgREST requires explicit table-level grants in addition to RLS policies.
GRANT SELECT ON public.authority_departments    TO anon, authenticated;
GRANT SELECT ON public.authority_organizations  TO anon, authenticated;
GRANT SELECT ON public.authority_announcements  TO anon, authenticated;
GRANT SELECT ON public.announcement_locations   TO anon, authenticated;
GRANT SELECT ON public.authority_admin_grants   TO authenticated;

GRANT INSERT, UPDATE, DELETE ON public.authority_announcements TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.announcement_locations  TO authenticated;
GRANT UPDATE                 ON public.authority_organizations TO authenticated;

GRANT ALL ON public.authority_departments   TO service_role;
GRANT ALL ON public.authority_organizations TO service_role;
GRANT ALL ON public.authority_announcements TO service_role;
GRANT ALL ON public.announcement_locations  TO service_role;
GRANT ALL ON public.authority_admin_grants  TO service_role;


-- ----------------------------------------------------------------------------
-- 2. [SEC-02] Explicit DELETE RLS Policies for Living Services
-- ----------------------------------------------------------------------------
-- Prevents BOLA / unauthorized mass deletion of mess, pg, and daily menu profiles.
DROP POLICY IF EXISTS "Owners or admins delete mess profiles" ON public.mess_profiles;
CREATE POLICY "Owners or admins delete mess profiles"
  ON public.mess_profiles FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    EXISTS (SELECT 1 FROM public.shop_owners so WHERE so.shop_id = mess_profiles.shop_id AND so.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Owners or admins delete pg profiles" ON public.pg_profiles;
CREATE POLICY "Owners or admins delete pg profiles"
  ON public.pg_profiles FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    EXISTS (SELECT 1 FROM public.shop_owners so WHERE so.shop_id = pg_profiles.shop_id AND so.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Owners or admins delete mess menus" ON public.mess_daily_menus;
CREATE POLICY "Owners or admins delete mess menus"
  ON public.mess_daily_menus FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    EXISTS (SELECT 1 FROM public.shop_owners so WHERE so.shop_id = mess_daily_menus.shop_id AND so.user_id = auth.uid())
  );


-- ----------------------------------------------------------------------------
-- 3. [SEC-05] Restrict MCP Endpoints Grants to Principle of Least Privilege
-- ----------------------------------------------------------------------------
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.mcp_endpoints FROM authenticated;
GRANT ALL ON public.mcp_endpoints TO service_role;


-- ----------------------------------------------------------------------------
-- 4. [SEC-07] Guard get_shops_page() against Search Resource Exhaustion
-- ----------------------------------------------------------------------------
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
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  clean_search text;
BEGIN
  -- Search query defense-in-depth: trim & restrict length to 100 chars
  IF p_search IS NOT NULL THEN
    clean_search := trim(p_search);
    IF length(clean_search) > 100 THEN
      clean_search := substring(clean_search from 1 for 100);
    END IF;
  END IF;

  RETURN QUERY
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
        clean_search IS NULL OR length(clean_search) = 0
        OR s.name        ILIKE '%' || clean_search || '%'
        OR s.keywords    ILIKE '%' || clean_search || '%'
        OR s.area        ILIKE '%' || clean_search || '%'
        OR s.address     ILIKE '%' || clean_search || '%'
        OR s.description ILIKE '%' || clean_search || '%'
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
  LIMIT GREATEST(LEAST(p_limit, 50), 1)
  OFFSET GREATEST(p_offset, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_shops_page(text, uuid, text, int, int) TO anon, authenticated;

COMMIT;
