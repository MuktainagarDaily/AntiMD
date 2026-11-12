-- ============================================================================
-- 2026-11-15  Guest View Visibility, Public Reviewer Names RPC, Shop/Living
--             Public RLS Fixes & Full Admin Role Parity for Examiner Mode
-- ============================================================================
-- Canonical copy of supabase/migrations/20261115000000_guest_rls_reviews_and_examiner_admin.sql
-- Safe & idempotent to run in Supabase SQL Editor.
-- ============================================================================

BEGIN;

-- 1. Restore EXECUTE grants on RLS helper functions for anon & authenticated
DO $$
BEGIN
  IF to_regprocedure('public.has_role(uuid, public.app_role)') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon, authenticated;
  END IF;
  IF to_regprocedure('public.has_role(uuid, text)') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.has_role(uuid, text) TO anon, authenticated;
  END IF;
  IF to_regprocedure('public.is_admin(uuid)') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO anon, authenticated;
  END IF;
  IF to_regprocedure('public.is_shop_owner(uuid, uuid)') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.is_shop_owner(uuid, uuid) TO anon, authenticated;
  END IF;
  IF to_regprocedure('public.is_school_owner(uuid, uuid)') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.is_school_owner(uuid, uuid) TO anon, authenticated;
  END IF;
  IF to_regprocedure('public.shop_is_claimed(uuid)') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.shop_is_claimed(uuid) TO anon, authenticated;
  END IF;
  IF to_regprocedure('public.check_authority_admin_access(uuid, uuid, uuid)') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.check_authority_admin_access(uuid, uuid, uuid) TO anon, authenticated;
  END IF;
  IF to_regprocedure('public.check_authority_admin_access(uuid, uuid)') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.check_authority_admin_access(uuid, uuid) TO anon, authenticated;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.is_shop_owner(_user_id uuid, _shop_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN _user_id IS NULL OR _shop_id IS NULL THEN false
    ELSE EXISTS (
      SELECT 1 FROM public.shop_owners
      WHERE user_id = _user_id AND shop_id = _shop_id
    )
  END;
$$;

GRANT EXECUTE ON FUNCTION public.is_shop_owner(uuid, uuid) TO anon, authenticated;

DO $$
BEGIN
  IF to_regclass('public.school_owners') IS NOT NULL THEN
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION public.is_school_owner(_user_id uuid, _school_id uuid)
      RETURNS boolean
      LANGUAGE sql
      STABLE
      SECURITY DEFINER
      SET search_path = public, pg_temp
      AS $inner$
        SELECT CASE
          WHEN _user_id IS NULL OR _school_id IS NULL THEN false
          ELSE EXISTS (
            SELECT 1 FROM public.school_owners
            WHERE user_id = _user_id AND school_id = _school_id
          )
        END;
      $inner$;
    $fn$;
    GRANT EXECUTE ON FUNCTION public.is_school_owner(uuid, uuid) TO anon, authenticated;
  END IF;
END $$;

-- 2. Fix Guest Visibility on `shops` and `school_notices` + Public Grants
DROP POLICY IF EXISTS "Shops are publicly readable" ON public.shops;
CREATE POLICY "Shops are publicly readable"
  ON public.shops FOR SELECT TO public
  USING (
    is_active = true
    OR (
      auth.uid() IS NOT NULL AND (
        public.has_role(auth.uid(), 'admin')
        OR public.is_shop_owner(auth.uid(), id)
      )
    )
  );

DO $$
BEGIN
  IF to_regclass('public.school_notices') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "School notices readable for active schools" ON public.school_notices';
    EXECUTE '
      CREATE POLICY "School notices readable for active schools"
        ON public.school_notices FOR SELECT
        USING (
          (
            is_active = true
            AND EXISTS (
              SELECT 1 FROM public.schools s
              WHERE s.id = school_notices.school_id
                AND s.is_active = true
            )
          )
          OR (
            auth.uid() IS NOT NULL AND (
              public.has_role(auth.uid(), ''admin'')
              OR public.is_school_owner(auth.uid(), school_id)
            )
          )
        )
    ';
  END IF;
END $$;

DO $$
DECLARE
  tbl text;
  public_tables text[] := ARRAY[
    'geo_countries', 'geo_states', 'geo_districts', 'geo_cities', 'geo_villages',
    'categories', 'shops', 'shop_categories', 'mess_profiles', 'mess_daily_menus',
    'pg_profiles', 'schools', 'school_notices', 'bus_timetable', 'bus_stand_info',
    'shop_translations', 'category_translations', 'amenity_translations',
    'translation_cache', 'banners', 'local_news', 'shop_reviews', 'school_reviews',
    'authority_departments', 'authority_organizations',
    'authority_announcements', 'announcement_locations'
  ];
  vw text;
  public_views text[] := ARRAY[
    'profiles_public', 'shops_list_public', 'shops_search_public', 'shops_with_claim'
  ];
BEGIN
  FOREACH tbl IN ARRAY public_tables LOOP
    IF to_regclass('public.' || tbl) IS NOT NULL THEN
      EXECUTE format('GRANT SELECT ON TABLE public.%I TO anon, authenticated', tbl);
    END IF;
  END LOOP;

  FOREACH vw IN ARRAY public_views LOOP
    IF to_regclass('public.' || vw) IS NOT NULL THEN
      EXECUTE format('GRANT SELECT ON public.%I TO anon, authenticated', vw);
    END IF;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.get_claimed_shop_ids(_shop_ids uuid[])
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT DISTINCT shop_id
  FROM public.shop_owners
  WHERE shop_id = ANY(_shop_ids);
$$;

REVOKE ALL ON FUNCTION public.get_claimed_shop_ids(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_claimed_shop_ids(uuid[]) TO anon, authenticated, service_role;

-- 3. Public Reviewer Attribution RPC
CREATE OR REPLACE FUNCTION public.get_public_reviewer_names(_user_ids uuid[])
RETURNS TABLE (
  id uuid,
  full_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p.id, p.full_name
  FROM public.profiles p
  WHERE p.id = ANY(_user_ids);
$$;

REVOKE ALL ON FUNCTION public.get_public_reviewer_names(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_reviewer_names(uuid[]) TO anon, authenticated, service_role;

-- 4. Full Admin Privileges Parity (All Tables, Policies, Storage & RPCs)
DO $$
DECLARE
  tbl text;
  admin_write_tables text[] := ARRAY[
    'geo_countries', 'geo_states', 'geo_districts', 'geo_cities', 'geo_villages',
    'categories', 'category_translations', 'shop_translations', 'amenity_translations',
    'banners', 'bus_timetable', 'bus_stand_info',
    'shops', 'shop_categories', 'shop_owners', 'shop_claims', 'shop_requests',
    'shop_reviews', 'shop_review_helpful', 'shop_bookmarks',
    'mess_profiles', 'mess_daily_menus', 'pg_profiles',
    'schools', 'school_owners', 'school_claims', 'school_notices',
    'school_reviews', 'school_review_helpful',
    'news_sources', 'local_news',
    'authority_departments', 'authority_organizations',
    'authority_announcements', 'announcement_locations', 'authority_admin_grants',
    'mcp_endpoints', 'user_roles'
  ];
BEGIN
  FOREACH tbl IN ARRAY admin_write_tables LOOP
    IF to_regclass('public.' || tbl) IS NOT NULL THEN
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated', tbl);
    END IF;
  END LOOP;
END $$;

DO $$
BEGIN
  IF to_regclass('public.profiles') IS NOT NULL THEN
    GRANT SELECT, INSERT, UPDATE ON TABLE public.profiles TO authenticated;
  END IF;

  IF to_regclass('public.shop_engagement') IS NOT NULL THEN
    REVOKE SELECT ON TABLE public.shop_engagement FROM anon;
    GRANT INSERT ON TABLE public.shop_engagement TO anon;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.shop_engagement TO authenticated;
  END IF;

  IF to_regclass('public.school_engagement') IS NOT NULL THEN
    REVOKE SELECT ON TABLE public.school_engagement FROM anon;
    GRANT INSERT ON TABLE public.school_engagement TO anon;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.school_engagement TO authenticated;
  END IF;

  IF to_regclass('public.translation_cache') IS NOT NULL THEN
    GRANT SELECT, INSERT, DELETE ON TABLE public.translation_cache TO authenticated;
    REVOKE UPDATE ON TABLE public.translation_cache FROM anon, authenticated;
    GRANT UPDATE (hit_count, last_used_at) ON TABLE public.translation_cache TO anon, authenticated;
  END IF;

  IF to_regclass('public.mcp_endpoints') IS NOT NULL THEN
    REVOKE ALL ON TABLE public.mcp_endpoints FROM anon;
    ALTER TABLE public.mcp_endpoints ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Admins manage mcp_endpoints" ON public.mcp_endpoints;
    CREATE POLICY "Admins manage mcp_endpoints"
      ON public.mcp_endpoints FOR ALL TO authenticated
      USING (public.has_role(auth.uid(), 'admin'))
      WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.category_translations') IS NOT NULL THEN
    DROP POLICY IF EXISTS "admins manage category translations" ON public.category_translations;
    CREATE POLICY "admins manage category translations"
      ON public.category_translations FOR ALL TO authenticated
      USING (public.has_role(auth.uid(), 'admin'))
      WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;

  IF to_regclass('public.shop_translations') IS NOT NULL THEN
    DROP POLICY IF EXISTS "admins manage shop translations" ON public.shop_translations;
    CREATE POLICY "admins manage shop translations"
      ON public.shop_translations FOR ALL TO authenticated
      USING (public.has_role(auth.uid(), 'admin'))
      WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;

  IF to_regclass('public.amenity_translations') IS NOT NULL THEN
    DROP POLICY IF EXISTS "admins manage amenity translations" ON public.amenity_translations;
    CREATE POLICY "admins manage amenity translations"
      ON public.amenity_translations FOR ALL TO authenticated
      USING (public.has_role(auth.uid(), 'admin'))
      WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.shop_reviews') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Users delete own review" ON public.shop_reviews;
    CREATE POLICY "Users delete own review"
      ON public.shop_reviews FOR DELETE TO authenticated
      USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
  END IF;

  IF to_regclass('public.school_reviews') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Users delete own school review" ON public.school_reviews;
    CREATE POLICY "Users delete own school review"
      ON public.school_reviews FOR DELETE TO authenticated
      USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
  END IF;

  IF to_regclass('public.bus_stand_info') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Bus stand info admin delete" ON public.bus_stand_info;
    CREATE POLICY "Bus stand info admin delete"
      ON public.bus_stand_info FOR DELETE TO authenticated
      USING (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('storage.objects') IS NOT NULL THEN
    BEGIN
      DROP POLICY IF EXISTS "Shop images are publicly viewable" ON storage.objects;
      CREATE POLICY "Shop images are publicly viewable"
        ON storage.objects FOR SELECT TO public
        USING (
          bucket_id = 'shop-images'
          AND ((storage.foldername(name))[1] IS DISTINCT FROM 'claims')
        );

      DROP POLICY IF EXISTS "Admins manage all shop-images" ON storage.objects;
      CREATE POLICY "Admins manage all shop-images"
        ON storage.objects FOR ALL TO authenticated
        USING (
          bucket_id = 'shop-images'
          AND public.has_role(auth.uid(), 'admin')
        )
        WITH CHECK (
          bucket_id = 'shop-images'
          AND public.has_role(auth.uid(), 'admin')
        );

      DROP POLICY IF EXISTS "Admins manage school request and banner images" ON storage.objects;
      CREATE POLICY "Admins manage school request and banner images"
        ON storage.objects FOR ALL TO authenticated
        USING (
          bucket_id IN ('school-images', 'request-images', 'banner-images')
          AND public.has_role(auth.uid(), 'admin')
        )
        WITH CHECK (
          bucket_id IN ('school-images', 'request-images', 'banner-images')
          AND public.has_role(auth.uid(), 'admin')
        );
    EXCEPTION WHEN insufficient_privilege THEN
      RAISE NOTICE 'Skipped storage.objects policy updates due to insufficient_privilege';
    END;
  END IF;
END $$;

DO $$
DECLARE
  fn text;
  admin_rpcs text[] := ARRAY[
    'public.approve_shop_claim(uuid)',
    'public.reject_shop_claim(uuid, text)',
    'public.assign_shop_owner(uuid, uuid)',
    'public.revoke_shop_owner(uuid, uuid)',
    'public.assign_school_owner(uuid, uuid, text)',
    'public.revoke_school_owner(uuid, uuid)',
    'public.approve_school_claim(uuid)',
    'public.reject_school_claim(uuid, text)',
    'public.reorder_banners(uuid[])',
    'public.refresh_category_shop_counts()',
    'public.refresh_engagement_stats()',
    'public.reprocess_shop_image(uuid)',
    'public.get_system_health_snapshot()',
    'public.username_available(text)'
  ];
BEGIN
  FOREACH fn IN ARRAY admin_rpcs LOOP
    IF to_regprocedure(fn) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', fn);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn);
    END IF;
  END LOOP;
END $$;

-- 5. Constraint-Safe Examiner / Admin Profile Backfill, Role Parity & Trigger
DO $$
DECLARE
  rec        record;
  v_raw_name text;
  v_handle   text;
  v_fallback text;
BEGIN
  FOR rec IN
    SELECT u.id, u.email, u.raw_user_meta_data
    FROM auth.users u
    WHERE lower(u.email) IN ('admin-test@apnalocal.in', 'harshking5305@gmail.com')
  LOOP
    IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = rec.id) THEN
      v_raw_name := NULLIF(trim(coalesce(rec.raw_user_meta_data->>'full_name', '')), '');
      v_handle := NULL;

      IF v_raw_name IS NOT NULL AND v_raw_name ~ '^[a-z][a-z0-9_.]{2,23}$' THEN
        IF NOT EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE lower(p.full_name) = lower(v_raw_name)
        ) THEN
          v_handle := v_raw_name;
        END IF;
      END IF;

      IF v_handle IS NULL AND lower(rec.email) = 'admin-test@apnalocal.in' THEN
        v_fallback := 'examiner_' || left(replace(rec.id::text, '-', ''), 8);
        IF NOT EXISTS (
          SELECT 1 FROM public.profiles p WHERE lower(p.full_name) = 'examiner_admin'
        ) THEN
          v_handle := 'examiner_admin';
        ELSIF NOT EXISTS (
          SELECT 1 FROM public.profiles p WHERE lower(p.full_name) = lower(v_fallback)
        ) THEN
          v_handle := v_fallback;
        ELSE
          v_handle := NULL;
        END IF;
      END IF;

      INSERT INTO public.profiles (id, full_name)
      VALUES (rec.id, v_handle)
      ON CONFLICT (id) DO NOTHING;
    END IF;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (rec.id, 'user'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (rec.id, 'admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_raw_name text;
  v_handle   text := NULL;
  v_fallback text;
BEGIN
  v_raw_name := NULLIF(trim(coalesce(NEW.raw_user_meta_data->>'full_name', '')), '');

  IF v_raw_name IS NOT NULL AND v_raw_name ~ '^[a-z][a-z0-9_.]{2,23}$' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE lower(p.full_name) = lower(v_raw_name)
    ) THEN
      v_handle := v_raw_name;
    END IF;
  END IF;

  IF v_handle IS NULL AND lower(coalesce(NEW.email, '')) = 'admin-test@apnalocal.in' THEN
    v_fallback := 'examiner_' || left(replace(NEW.id::text, '-', ''), 8);
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles p WHERE lower(p.full_name) = 'examiner_admin'
    ) THEN
      v_handle := 'examiner_admin';
    ELSIF NOT EXISTS (
      SELECT 1 FROM public.profiles p WHERE lower(p.full_name) = lower(v_fallback)
    ) THEN
      v_handle := v_fallback;
    END IF;
  END IF;

  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, v_handle)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  IF lower(coalesce(NEW.email, '')) IN ('admin-test@apnalocal.in', 'harshking5305@gmail.com') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'on_auth_user_created'
      AND tgrelid = 'auth.users'::regclass
  ) THEN
    BEGIN
      CREATE TRIGGER on_auth_user_created
        AFTER INSERT ON auth.users
        FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
    EXCEPTION WHEN insufficient_privilege THEN
      RAISE NOTICE 'Skipped on_auth_user_created trigger creation due to insufficient_privilege';
    END;
  END IF;
END $$;

COMMIT;
