-- ============================================================================
-- 2026-11-11 · ApnaTown Batch 1 Security & Data-Integrity Remediation Patch
-- Status: REQUIRES MANUAL EXECUTION IN SUPABASE SQL EDITOR
--
-- PREREQUISITE EXECUTION ORDER (verify which docs/patches/ are already applied
-- on your live Supabase project before running this patch):
--   1. docs/patches/2026-06-28_claim_verification.sql      (if not applied)
--   2. docs/patches/2026-07-05_bucket_split.sql            (if not applied)
--   3. docs/patches/2026-08-10_owner_category_edit.sql     (if not applied)
--   4. docs/patches/2026-10-24_multi_town_hierarchy.sql    (if not applied)
--   5. docs/patches/2026-10-25_security_hardening_v2.sql   (if not applied)
--   6. docs/patches/2026-11-08_essential_services_schema.sql (if not applied)
--   7. docs/patches/2026-11-09_security_hardening_v3.sql   (if not applied)
--   8. THIS FILE (2026-11-11_batch1_remediation.sql)
--
-- NOTE ON PRIVATE CLAIM PROOFS BUCKET:
--   Migrating existing files in `shop-images/claims/*` to a separate private
--   bucket (`claim-proofs`) requires Supabase Storage API calls + re-signing
--   historical URLs and CANNOT be safely completed via SQL alone.
--   Status: REQUIRES LIVE DATABASE / STORAGE VERIFICATION. Until migrated,
--   existing `storage.objects` policies from `20261113000000` keep `claims/`
--   excluded from public listing and restricted to admins + claim owners.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Drop stray `claim_first_admin()` privilege-escalation function
--    (Preserves `touch_updated_at()` and unrelated tables/triggers safely.)
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.claim_first_admin();


-- ----------------------------------------------------------------------------
-- 2. Restrict `public.shops` SELECT & INSERT RLS policies
--    (Overrides overly permissive 20261025000000 policy.)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Shops are publicly readable" ON public.shops;
CREATE POLICY "Shops are publicly readable"
  ON public.shops FOR SELECT TO public
  USING (
    is_active = true
    OR public.has_role(auth.uid(), 'admin')
    OR public.is_shop_owner(auth.uid(), id)
  );

-- Shopkeepers create new listings via `public.shop_requests` moderation queue,
-- never directly into `public.shops`.
DROP POLICY IF EXISTS "Admins insert shops" ON public.shops;
CREATE POLICY "Admins insert shops"
  ON public.shops FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));


-- ----------------------------------------------------------------------------
-- 3. Strengthen `shops_owner_column_guard()` to protect geo hierarchy fields
--    Uses to_jsonb(NEW/OLD) so it executes safely whether or not multi-town
--    columns exist yet, and avoids referencing non-existent `is_claimed`.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.shops_owner_column_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  new_j jsonb;
  old_j jsonb;
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  IF NEW.is_verified IS DISTINCT FROM OLD.is_verified
     OR NEW.is_active   IS DISTINCT FROM OLD.is_active
     OR NEW.slug        IS DISTINCT FROM OLD.slug
     OR NEW.category_id IS DISTINCT FROM OLD.category_id
     OR NEW.id          IS DISTINCT FROM OLD.id
  THEN
    RAISE EXCEPTION 'Only admins can change verified/active/slug/category fields'
      USING ERRCODE = '42501';
  END IF;

  new_j := to_jsonb(NEW);
  old_j := to_jsonb(OLD);

  IF (new_j->>'city_id')     IS DISTINCT FROM (old_j->>'city_id')
     OR (new_j->>'village_id')  IS DISTINCT FROM (old_j->>'village_id')
     OR (new_j->>'district_id') IS DISTINCT FROM (old_j->>'district_id')
     OR (new_j->>'state_id')    IS DISTINCT FROM (old_j->>'state_id')
  THEN
    RAISE EXCEPTION 'Only admins can reassign shop geographic hierarchy fields'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION public.shops_owner_column_guard() TO authenticated;


-- ----------------------------------------------------------------------------
-- 4. Fix `shop_requests_rate_limit_check()` authenticated-user bypass
--    Only `admin` role bypasses; signed-in regular users/shopkeepers are capped
--    to max 5 listing submissions per 2 hours by user_id or phone.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.shop_requests_rate_limit_check()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  user_recent   int := 0;
  phone_recent  int := 0;
  global_recent int := 0;
BEGIN
  -- Only verified admins bypass submission rate limits
  IF auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  -- Per authenticated account rate limit (max 5 requests / 2 hours)
  IF auth.uid() IS NOT NULL THEN
    SELECT count(*) INTO user_recent
    FROM public.shop_requests
    WHERE submitter_user_id = auth.uid()
      AND created_at > now() - interval '2 hours';

    IF user_recent >= 5 THEN
      RAISE EXCEPTION 'You have submitted too many listing requests recently. Please wait before submitting another.'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- Per phone rate limit (max 3 requests / 2 hours)
  IF NEW.phone IS NOT NULL AND trim(NEW.phone) <> '' THEN
    SELECT count(*) INTO phone_recent
    FROM public.shop_requests
    WHERE phone = NEW.phone
      AND created_at > now() - interval '2 hours';

    IF phone_recent >= 3 THEN
      RAISE EXCEPTION 'Too many listing requests submitted for this phone number. Please wait before submitting another.'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- Global safety cap for anonymous submissions: 150/hour
  IF NEW.submitter_user_id IS NULL THEN
    SELECT count(*) INTO global_recent
    FROM public.shop_requests
    WHERE submitter_user_id IS NULL
      AND created_at > now() - interval '1 hour';

    IF global_recent >= 150 THEN
      RAISE EXCEPTION 'Server busy with new requests right now. Please try again shortly.'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


-- ----------------------------------------------------------------------------
-- 5. Reconcile `public.mcp_endpoints` permissions (keeps admin-only RLS active
--    while allowing authenticated admins in the Admin UI to read/manage rows)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.mcp_endpoints') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON public.mcp_endpoints FROM anon';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.mcp_endpoints TO authenticated';
    EXECUTE 'GRANT ALL ON public.mcp_endpoints TO service_role';

    EXECUTE 'ALTER TABLE public.mcp_endpoints ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Admins manage mcp_endpoints" ON public.mcp_endpoints';
    EXECUTE 'CREATE POLICY "Admins manage mcp_endpoints" ON public.mcp_endpoints FOR ALL TO authenticated USING (public.has_role(auth.uid(), ''admin'')) WITH CHECK (public.has_role(auth.uid(), ''admin''))';
  END IF;
END $$;


-- ----------------------------------------------------------------------------
-- 6. Postgres-backed Edge Function Rate Limiter for Sahayak (`town-assistant`)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.edge_rate_limits (
  key          text PRIMARY KEY,
  calls        integer NOT NULL DEFAULT 1,
  window_start timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.edge_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.edge_rate_limits FROM anon, authenticated;
GRANT ALL ON public.edge_rate_limits TO service_role;

CREATE OR REPLACE FUNCTION public.apnatown_check_rate_limit(
  _key         text,
  _window_secs integer DEFAULT 60,
  _max_calls   integer DEFAULT 15
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now         timestamptz := now();
  v_window      interval := make_interval(secs => GREATEST(_window_secs, 1));
  v_new_calls   integer;
BEGIN
  IF _key IS NULL OR length(trim(_key)) = 0 THEN
    RETURN false;
  END IF;

  INSERT INTO public.edge_rate_limits (key, calls, window_start)
  VALUES (_key, 1, v_now)
  ON CONFLICT (key) DO UPDATE
    SET calls = CASE
                  WHEN public.edge_rate_limits.window_start + v_window <= v_now THEN 1
                  ELSE public.edge_rate_limits.calls + 1
                END,
        window_start = CASE
                         WHEN public.edge_rate_limits.window_start + v_window <= v_now THEN v_now
                         ELSE public.edge_rate_limits.window_start
                       END
  RETURNING calls INTO v_new_calls;

  RETURN v_new_calls <= GREATEST(_max_calls, 1);
END;
$$;

REVOKE ALL ON FUNCTION public.apnatown_check_rate_limit(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apnatown_check_rate_limit(text, integer, integer) TO anon, authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 7. Safe idempotent Muktainagar legacy NULL `city_id` backfill
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_muktai_id   uuid;
  v_district_id uuid;
  v_state_id    uuid;
BEGIN
  IF to_regclass('public.geo_cities') IS NULL THEN
    RETURN;
  END IF;

  SELECT id, district_id INTO v_muktai_id, v_district_id
  FROM public.geo_cities
  WHERE slug = 'muktainagar'
  LIMIT 1;

  IF v_muktai_id IS NULL THEN
    RETURN;
  END IF;

  SELECT state_id INTO v_state_id
  FROM public.geo_districts
  WHERE id = v_district_id;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'shops' AND column_name = 'city_id'
  ) THEN
    UPDATE public.shops
    SET city_id = v_muktai_id,
        district_id = COALESCE(district_id, v_district_id),
        state_id = COALESCE(state_id, v_state_id)
    WHERE city_id IS NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'schools' AND column_name = 'city_id'
  ) THEN
    UPDATE public.schools
    SET city_id = v_muktai_id,
        district_id = COALESCE(district_id, v_district_id),
        state_id = COALESCE(state_id, v_state_id)
    WHERE city_id IS NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bus_timetable' AND column_name = 'city_id'
  ) THEN
    UPDATE public.bus_timetable
    SET city_id = v_muktai_id
    WHERE city_id IS NULL;
  END IF;
END $$;

COMMIT;


-- ============================================================================
-- ROLLBACK SQL (run manually only if you need to revert Batch 1 DB changes)
-- ============================================================================
-- BEGIN;
-- DROP FUNCTION IF EXISTS public.apnatown_check_rate_limit(text, integer, integer);
-- DROP TABLE IF EXISTS public.edge_rate_limits;
--
-- DROP POLICY IF EXISTS "Shops are publicly readable" ON public.shops;
-- CREATE POLICY "Shops are publicly readable" ON public.shops FOR SELECT TO public USING (true);
--
-- DROP POLICY IF EXISTS "Admins insert shops" ON public.shops;
-- CREATE POLICY "Admins insert shops" ON public.shops FOR INSERT TO authenticated
--   WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'shopkeeper'));
--
-- REVOKE SELECT, INSERT, UPDATE, DELETE ON public.mcp_endpoints FROM authenticated;
-- COMMIT;
