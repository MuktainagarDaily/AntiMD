
-- =====================================================================
-- MASTER SQL SCRIPT — Muktainagar Daily Shop Directory
-- Covers: schema fixes + all RLS policies from CSV audit
-- =====================================================================

-- ── 1. Fix shops time columns (time without time zone → text) ────────
ALTER TABLE public.shops
  ALTER COLUMN opening_time TYPE text USING opening_time::text,
  ALTER COLUMN closing_time TYPE text USING closing_time::text;

-- ── 2. Drop all existing RLS policies and recreate from CSV audit ─────

-- ---- categories ----
DROP POLICY IF EXISTS "Anyone can read categories" ON public.categories;
DROP POLICY IF EXISTS "Authenticated users can manage categories" ON public.categories;
DROP POLICY IF EXISTS "Categories are publicly readable" ON public.categories;
DROP POLICY IF EXISTS "Authenticated users can insert categories" ON public.categories;
DROP POLICY IF EXISTS "Authenticated users can update categories" ON public.categories;
DROP POLICY IF EXISTS "Authenticated users can delete categories" ON public.categories;

CREATE POLICY "Categories are publicly readable"
  ON public.categories FOR SELECT TO public USING (true);

CREATE POLICY "Authenticated users can insert categories"
  ON public.categories FOR INSERT TO public
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update categories"
  ON public.categories FOR UPDATE TO public
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete categories"
  ON public.categories FOR DELETE TO public
  USING (auth.role() = 'authenticated');

-- ---- shop_categories ----
DROP POLICY IF EXISTS "Anyone can read shop_categories" ON public.shop_categories;
DROP POLICY IF EXISTS "Authenticated users can manage shop_categories" ON public.shop_categories;
DROP POLICY IF EXISTS "Shop categories are publicly readable" ON public.shop_categories;
DROP POLICY IF EXISTS "Authenticated users can insert shop_categories" ON public.shop_categories;
DROP POLICY IF EXISTS "Authenticated users can delete shop_categories" ON public.shop_categories;

CREATE POLICY "Shop categories are publicly readable"
  ON public.shop_categories FOR SELECT TO public USING (true);

CREATE POLICY "Authenticated users can insert shop_categories"
  ON public.shop_categories FOR INSERT TO public
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete shop_categories"
  ON public.shop_categories FOR DELETE TO public
  USING (auth.role() = 'authenticated');

-- ---- shop_engagement ----
DROP POLICY IF EXISTS "Anyone can insert engagement" ON public.shop_engagement;
DROP POLICY IF EXISTS "Authenticated users can read engagement" ON public.shop_engagement;
DROP POLICY IF EXISTS "Public can insert engagement events" ON public.shop_engagement;

CREATE POLICY "Authenticated users can read engagement"
  ON public.shop_engagement FOR SELECT TO public
  USING (auth.role() = 'authenticated');

CREATE POLICY "Public can insert engagement events"
  ON public.shop_engagement FOR INSERT TO public
  WITH CHECK (true);

-- ---- shop_requests ----
DROP POLICY IF EXISTS "Anyone can submit shop requests" ON public.shop_requests;
DROP POLICY IF EXISTS "Authenticated users can manage shop_requests" ON public.shop_requests;
DROP POLICY IF EXISTS "Public can submit shop requests" ON public.shop_requests;
DROP POLICY IF EXISTS "Authenticated users can read shop requests" ON public.shop_requests;
DROP POLICY IF EXISTS "Authenticated users can update shop requests" ON public.shop_requests;
DROP POLICY IF EXISTS "Authenticated users can delete shop requests" ON public.shop_requests;

CREATE POLICY "Public can submit shop requests"
  ON public.shop_requests FOR INSERT TO public
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read shop requests"
  ON public.shop_requests FOR SELECT TO public
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update shop requests"
  ON public.shop_requests FOR UPDATE TO public
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete shop requests"
  ON public.shop_requests FOR DELETE TO public
  USING (auth.role() = 'authenticated');

-- ---- shops ----
DROP POLICY IF EXISTS "Anyone can read active shops" ON public.shops;
DROP POLICY IF EXISTS "Authenticated users can manage shops" ON public.shops;
DROP POLICY IF EXISTS "Shops are publicly readable" ON public.shops;
DROP POLICY IF EXISTS "Authenticated users can insert shops" ON public.shops;
DROP POLICY IF EXISTS "Authenticated users can update shops" ON public.shops;
DROP POLICY IF EXISTS "Authenticated users can delete shops" ON public.shops;

CREATE POLICY "Shops are publicly readable"
  ON public.shops FOR SELECT TO public USING (true);

CREATE POLICY "Authenticated users can insert shops"
  ON public.shops FOR INSERT TO public
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update shops"
  ON public.shops FOR UPDATE TO public
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete shops"
  ON public.shops FOR DELETE TO public
  USING (auth.role() = 'authenticated');

-- ---- storage.objects (shop-images bucket) ----
DROP POLICY IF EXISTS "Shop images are publicly viewable" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload shop images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update shop images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete shop images" ON storage.objects;

CREATE POLICY "Shop images are publicly viewable"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'shop-images');

CREATE POLICY "Authenticated users can upload shop images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'shop-images');

CREATE POLICY "Authenticated users can update shop images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'shop-images');

CREATE POLICY "Authenticated users can delete shop images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'shop-images');
