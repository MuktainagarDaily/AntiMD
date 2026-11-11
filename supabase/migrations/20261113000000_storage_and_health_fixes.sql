-- ============================================================================
-- Migration: 20261113000000_storage_and_health_fixes.sql
-- Description:
--   1. Fixes root-object enumeration RLS bug on `storage.objects` (`shop-images`)
--      where `(storage.foldername(name))[1] <> 'claims'` evaluated to NULL
--      for root files, hiding shop photos from `.list('')` and causing 409
--      filename collisions. Uses `IS DISTINCT FROM 'claims'` instead.
--   2. Ensures admin full management policy on `shop-images` across all prefixes
--      (root, banners/, menus/, claims/).
--   3. Idempotently applies `image_checked_at` & `image_broken_at` columns +
--      partial index on `public.shops` (fixing 42703 errors in ShopsTab) and
--      extends the same columns to `public.schools` & `public.banners`.
--   4. Adds admin-only `public.get_system_health_snapshot()` RPC to inspect
--      schema readiness, storage RLS fix state, MV drift, and table counts.
-- Safe & idempotent: safe to re-run in SQL Editor or migrations.
-- ============================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Fix Storage SELECT RLS for root-level files in `shop-images`
-- ────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Shop images are publicly viewable" ON storage.objects;
CREATE POLICY "Shop images are publicly viewable"
  ON storage.objects FOR SELECT TO public
  USING (
    bucket_id = 'shop-images'
    AND ((storage.foldername(name))[1] IS DISTINCT FROM 'claims')
  );

-- Ensure admins can read/manage every object in `shop-images` (including claims/)
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


-- ────────────────────────────────────────────────────────────────────────────
-- 2. Image verification timestamp columns (`image_checked_at`, `image_broken_at`)
-- ────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.shops') IS NOT NULL THEN
    ALTER TABLE public.shops
      ADD COLUMN IF NOT EXISTS image_checked_at timestamptz NULL,
      ADD COLUMN IF NOT EXISTS image_broken_at  timestamptz NULL;

    CREATE INDEX IF NOT EXISTS idx_shops_image_broken_at
      ON public.shops (image_broken_at)
      WHERE image_broken_at IS NOT NULL;
  END IF;

  IF to_regclass('public.schools') IS NOT NULL THEN
    ALTER TABLE public.schools
      ADD COLUMN IF NOT EXISTS image_checked_at timestamptz NULL,
      ADD COLUMN IF NOT EXISTS image_broken_at  timestamptz NULL;

    CREATE INDEX IF NOT EXISTS idx_schools_image_broken_at
      ON public.schools (image_broken_at)
      WHERE image_broken_at IS NOT NULL;
  END IF;

  IF to_regclass('public.banners') IS NOT NULL THEN
    ALTER TABLE public.banners
      ADD COLUMN IF NOT EXISTS image_checked_at timestamptz NULL,
      ADD COLUMN IF NOT EXISTS image_broken_at  timestamptz NULL;
  END IF;
END $$;


-- ────────────────────────────────────────────────────────────────────────────
-- 3. Admin-only System Health Snapshot RPC
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_system_health_snapshot()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_has_shop_broken_col boolean := false;
  v_has_school_broken_col boolean := false;
  v_has_banner_broken_col boolean := false;
  v_storage_root_fixed boolean := false;
  v_mv_exists boolean := false;
  v_mv_total bigint := 0;
  v_live_cat_links bigint := 0;
  v_counts jsonb := '{}'::jsonb;
  v_tmp bigint := 0;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden: admin role required' USING ERRCODE = '42501';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'shops' AND column_name = 'image_broken_at'
  ) INTO v_has_shop_broken_col;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'schools' AND column_name = 'image_broken_at'
  ) INTO v_has_school_broken_col;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'banners' AND column_name = 'image_broken_at'
  ) INTO v_has_banner_broken_col;

  -- Check whether the public shop-images SELECT policy uses IS DISTINCT FROM
  SELECT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Shop images are publicly viewable'
      AND coalesce(qual, '') ILIKE '%distinct from%'
  ) INTO v_storage_root_fixed;

  -- Check materialized view drift if present
  SELECT (to_regclass('public.category_shop_counts') IS NOT NULL) INTO v_mv_exists;
  IF v_mv_exists THEN
    SELECT coalesce(sum(shop_count), 0) INTO v_mv_total FROM public.category_shop_counts;
    SELECT count(*) INTO v_live_cat_links
    FROM public.shop_categories sc
    JOIN public.shops s ON s.id = sc.shop_id AND s.is_active = true
    JOIN public.categories c ON c.id = sc.category_id AND c.is_active = true;
  END IF;

  -- Safe counts across core tables
  IF to_regclass('public.shops') IS NOT NULL THEN
    SELECT count(*) INTO v_tmp FROM public.shops;
    v_counts := v_counts || jsonb_build_object('shops', v_tmp);
  END IF;
  IF to_regclass('public.schools') IS NOT NULL THEN
    SELECT count(*) INTO v_tmp FROM public.schools;
    v_counts := v_counts || jsonb_build_object('schools', v_tmp);
  END IF;
  IF to_regclass('public.banners') IS NOT NULL THEN
    SELECT count(*) INTO v_tmp FROM public.banners;
    v_counts := v_counts || jsonb_build_object('banners', v_tmp);
  END IF;
  IF to_regclass('public.mess_daily_menus') IS NOT NULL THEN
    SELECT count(*) INTO v_tmp FROM public.mess_daily_menus;
    v_counts := v_counts || jsonb_build_object('mess_daily_menus', v_tmp);
  END IF;
  IF to_regclass('public.local_news') IS NOT NULL THEN
    SELECT count(*) INTO v_tmp FROM public.local_news;
    v_counts := v_counts || jsonb_build_object('local_news', v_tmp);
  END IF;
  IF to_regclass('public.shop_requests') IS NOT NULL THEN
    SELECT count(*) INTO v_tmp FROM public.shop_requests WHERE status = 'pending';
    v_counts := v_counts || jsonb_build_object('pending_requests', v_tmp);
  END IF;
  IF to_regclass('public.shop_claims') IS NOT NULL THEN
    SELECT count(*) INTO v_tmp FROM public.shop_claims WHERE status = 'pending';
    v_counts := v_counts || jsonb_build_object('pending_shop_claims', v_tmp);
  END IF;
  IF to_regclass('public.school_claims') IS NOT NULL THEN
    SELECT count(*) INTO v_tmp FROM public.school_claims WHERE status = 'pending';
    v_counts := v_counts || jsonb_build_object('pending_school_claims', v_tmp);
  END IF;

  RETURN jsonb_build_object(
    'checked_at', now(),
    'schema', jsonb_build_object(
      'shops_image_verification', v_has_shop_broken_col,
      'schools_image_verification', v_has_school_broken_col,
      'banners_image_verification', v_has_banner_broken_col,
      'storage_root_listing_fixed', v_storage_root_fixed
    ),
    'materialized_view', jsonb_build_object(
      'exists', v_mv_exists,
      'mv_count_sum', v_mv_total,
      'live_count_sum', v_live_cat_links,
      'drift', abs(v_mv_total - v_live_cat_links)
    ),
    'counts', v_counts
  );
END $$;

REVOKE ALL ON FUNCTION public.get_system_health_snapshot() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_system_health_snapshot() TO authenticated;

COMMIT;
