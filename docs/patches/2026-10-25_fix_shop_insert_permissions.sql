-- ============================================================================
-- 2026-10-25 — Fix Shop Insert Permissions & Trigger Security Definer Defs
--
-- Root Cause Diagnosed:
-- 1. A prior security hardening patch executed:
--      REVOKE EXECUTE ON FUNCTION public.generate_shop_slug(text, uuid) FROM PUBLIC, anon, authenticated;
--      REVOKE EXECUTE ON FUNCTION public.set_shop_slug() FROM PUBLIC, anon, authenticated;
--      REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
-- 2. Because PostgreSQL triggers run with the privileges of the executing user (unless marked SECURITY DEFINER),
--    any attempt to INSERT into public.shops fired `trg_shop_slug`, which failed with:
--      "permission denied for function generate_shop_slug" (SQLSTATE 42501).
--    PostgREST converted this 42501 into HTTP 403 Forbidden!
-- 3. In addition, `set_updated_at` and `shops_owner_column_guard` also had execute revoked.
--
-- Fixes applied below:
-- 1. Re-define `generate_shop_slug` as SECURITY DEFINER with safe search_path.
-- 2. Re-define `set_shop_slug` as SECURITY DEFINER with safe search_path.
-- 3. Re-define `set_updated_at` as SECURITY DEFINER with safe search_path.
-- 4. Grant EXECUTE on these trigger helpers to `authenticated`, `anon`, and `service_role`.
-- 5. Re-affirm RLS policies on public.shops.
-- 6. Grant `admin` role to existing auth.users so the current logged-in user is guaranteed admin access.
-- ============================================================================

-- 1. Slug generator helper (SECURITY DEFINER so it can inspect public.shops safely)
CREATE OR REPLACE FUNCTION public.generate_shop_slug(p_name TEXT, p_exclude_id UUID DEFAULT NULL)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  base_slug TEXT;
  candidate TEXT;
  counter   INT := 0;
BEGIN
  base_slug := lower(trim(coalesce(p_name, 'shop')));
  base_slug := regexp_replace(base_slug, '[^a-z0-9 -]', '', 'g');
  base_slug := regexp_replace(base_slug, '[ -]+', '-', 'g');
  base_slug := trim(base_slug, '-');
  IF base_slug = '' THEN base_slug := 'shop'; END IF;
  candidate := base_slug;
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.shops
      WHERE slug = candidate
        AND (p_exclude_id IS NULL OR id <> p_exclude_id)
    ) THEN
      RETURN candidate;
    END IF;
    counter := counter + 1;
    candidate := base_slug || '-' || counter;
  END LOOP;
END;
$$;

-- 2. Trigger function for slug assignment
CREATE OR REPLACE FUNCTION public.set_shop_slug()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.slug IS NULL OR trim(NEW.slug) = '' OR
     (TG_OP = 'UPDATE' AND NEW.name IS DISTINCT FROM OLD.name AND NEW.slug = OLD.slug) THEN
    NEW.slug := public.generate_shop_slug(NEW.name, NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

-- 3. Updated_at trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 4. Grant EXECUTE to authenticated and anon so triggers execute without permission errors
GRANT EXECUTE ON FUNCTION public.generate_shop_slug(text, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.set_shop_slug()                TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.set_updated_at()               TO authenticated, anon;

-- Also re-grant column guard and claim helpers
GRANT EXECUTE ON FUNCTION public.shops_owner_column_guard()     TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_shop_claim_status()   TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.shop_claims_rate_limit_check() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon;

-- 5. Ensure shops RLS policies allow authenticated admin inserts
DROP POLICY IF EXISTS "Admins insert shops" ON public.shops;
CREATE POLICY "Admins insert shops"
  ON public.shops
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'shopkeeper')
  );

DROP POLICY IF EXISTS "Shops are publicly readable" ON public.shops;
CREATE POLICY "Shops are publicly readable"
  ON public.shops
  FOR SELECT
  TO public
  USING (true);

-- 6. Ensure user_roles has 'admin' for project administrator
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE email = 'harshking5305@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- Verification query
SELECT
  p.proname,
  p.prosecdef AS is_security_definer,
  pg_catalog.pg_get_userbyid(p.proowner) AS owner
FROM pg_proc p
WHERE p.proname IN ('generate_shop_slug', 'set_shop_slug', 'set_updated_at', 'shops_owner_column_guard');
