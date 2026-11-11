-- ============================================================================
-- 2026-10-24 — Multi-Town & Geographic Hierarchy Schema & Backfill
--
-- Enables Muktainagar Daily to scale to ANY Town, City, Village, and District.
-- Hierarchy: Country (IN) -> State (MH) -> District (Jalgaon) -> City/Taluka -> Village/Ward.
--
-- Includes:
--   1. Geographic tables: geo_countries, geo_states, geo_districts, geo_cities, geo_villages
--   2. Pre-seeded Maharashtra / Jalgaon / Muktainagar + surrounding villages baseline
--   3. Foreign keys on shops, schools, bus_timetable, bus_stand_info, banners, profiles, shop_requests
--   4. Zero-downtime backfill of all existing records to Muktainagar
--   5. Public read RLS + admin write policies
-- ============================================================================

-- ---- 1. Geographic Tables ---------------------------------------------------

CREATE TABLE IF NOT EXISTS public.geo_countries (
  code       TEXT PRIMARY KEY,               -- 'IN'
  name       TEXT NOT NULL,                  -- 'India'
  name_mr    TEXT,                           -- 'भारत'
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.geo_states (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code TEXT NOT NULL REFERENCES public.geo_countries(code) ON DELETE CASCADE,
  code         TEXT NOT NULL UNIQUE,          -- 'MH'
  name         TEXT NOT NULL,                 -- 'Maharashtra'
  name_mr      TEXT,                          -- 'महाराष्ट्र'
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.geo_districts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state_id    UUID NOT NULL REFERENCES public.geo_states(id) ON DELETE CASCADE,
  slug        TEXT NOT NULL,                  -- 'jalgaon'
  name        TEXT NOT NULL,                  -- 'Jalgaon'
  name_mr     TEXT,                           -- 'जळगाव'
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_geo_districts_state_slug UNIQUE (state_id, slug)
);

CREATE TABLE IF NOT EXISTS public.geo_cities (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id UUID NOT NULL REFERENCES public.geo_districts(id) ON DELETE CASCADE,
  slug        TEXT NOT NULL,                  -- 'muktainagar', 'bhusawal', 'varangaon'
  name        TEXT NOT NULL,                  -- 'Muktainagar'
  name_mr     TEXT,                           -- 'मुक्ताईनगर'
  type        TEXT NOT NULL DEFAULT 'taluka' CHECK (type IN ('city', 'taluka', 'town')),
  latitude    DOUBLE PRECISION,
  longitude   DOUBLE PRECISION,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_geo_cities_district_slug UNIQUE (district_id, slug)
);

CREATE TABLE IF NOT EXISTS public.geo_villages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id     UUID NOT NULL REFERENCES public.geo_cities(id) ON DELETE CASCADE,
  slug        TEXT NOT NULL,                  -- 'kurha', 'anturli'
  name        TEXT NOT NULL,                  -- 'Kurha'
  name_mr     TEXT,                           -- 'कुऱ्हा'
  pincode     TEXT,                           -- '425306'
  latitude    DOUBLE PRECISION,
  longitude   DOUBLE PRECISION,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_geo_villages_city_slug UNIQUE (city_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_geo_districts_state ON public.geo_districts(state_id);
CREATE INDEX IF NOT EXISTS idx_geo_cities_district ON public.geo_cities(district_id);
CREATE INDEX IF NOT EXISTS idx_geo_cities_slug     ON public.geo_cities(slug);
CREATE INDEX IF NOT EXISTS idx_geo_villages_city   ON public.geo_villages(city_id);
CREATE INDEX IF NOT EXISTS idx_geo_villages_slug   ON public.geo_villages(slug);

-- ---- 2. Seed Baseline Data (India -> Maharashtra -> Jalgaon -> Muktainagar + Villages)

INSERT INTO public.geo_countries (code, name, name_mr)
VALUES ('IN', 'India', 'भारत')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.geo_states (country_code, code, name, name_mr)
VALUES ('IN', 'MH', 'Maharashtra', 'महाराष्ट्र')
ON CONFLICT (code) DO NOTHING;

DO $$
DECLARE
  v_state_id    UUID;
  v_district_id UUID;
  v_muktai_id   UUID;
  v_bhusawal_id UUID;
  v_varangaon_id UUID;
  v_bodwad_id   UUID;
  v_pune_dist_id UUID;
  v_maval_id    UUID;
  v_pune_city_id UUID;
BEGIN
  SELECT id INTO v_state_id FROM public.geo_states WHERE code = 'MH';

  -- District: Jalgaon
  INSERT INTO public.geo_districts (state_id, slug, name, name_mr)
  VALUES (v_state_id, 'jalgaon', 'Jalgaon', 'जळगाव')
  ON CONFLICT (state_id, slug) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_district_id;

  -- Cities / Talukas (Jalgaon)
  INSERT INTO public.geo_cities (district_id, slug, name, name_mr, type, latitude, longitude, sort_order)
  VALUES (v_district_id, 'muktainagar', 'Muktainagar', 'मुक्ताईनगर', 'taluka', 21.0758, 75.9817, 1)
  ON CONFLICT (district_id, slug) DO UPDATE SET name = EXCLUDED.name, latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude
  RETURNING id INTO v_muktai_id;

  INSERT INTO public.geo_cities (district_id, slug, name, name_mr, type, latitude, longitude, sort_order)
  VALUES (v_district_id, 'bhusawal', 'Bhusawal', 'भुसावळ', 'city', 21.0455, 75.8011, 2)
  ON CONFLICT (district_id, slug) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_bhusawal_id;

  INSERT INTO public.geo_cities (district_id, slug, name, name_mr, type, latitude, longitude, sort_order)
  VALUES (v_district_id, 'varangaon', 'Varangaon', 'वरणगाव', 'town', 21.0182, 75.9038, 3)
  ON CONFLICT (district_id, slug) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_varangaon_id;

  INSERT INTO public.geo_cities (district_id, slug, name, name_mr, type, latitude, longitude, sort_order)
  VALUES (v_district_id, 'bodwad', 'Bodwad', 'बोदवड', 'taluka', 20.8837, 76.0028, 4)
  ON CONFLICT (district_id, slug) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_bodwad_id;

  -- District: Pune
  INSERT INTO public.geo_districts (state_id, slug, name, name_mr)
  VALUES (v_state_id, 'pune', 'Pune', 'पुणे')
  ON CONFLICT (state_id, slug) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_pune_dist_id;

  IF v_pune_dist_id IS NULL THEN
    SELECT id INTO v_pune_dist_id FROM public.geo_districts WHERE state_id = v_state_id AND slug = 'pune';
  END IF;

  -- Cities / Talukas (Pune)
  INSERT INTO public.geo_cities (district_id, slug, name, name_mr, type, latitude, longitude, sort_order)
  VALUES (v_pune_dist_id, 'maval', 'Maval', 'मावळ', 'taluka', 18.7546, 73.5414, 5)
  ON CONFLICT (district_id, slug) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_maval_id;

  IF v_maval_id IS NULL THEN
    SELECT id INTO v_maval_id FROM public.geo_cities WHERE district_id = v_pune_dist_id AND slug = 'maval';
  END IF;

  INSERT INTO public.geo_cities (district_id, slug, name, name_mr, type, latitude, longitude, sort_order)
  VALUES (v_pune_dist_id, 'pune', 'Pune', 'पुणे', 'city', 18.5204, 73.8567, 6)
  ON CONFLICT (district_id, slug) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_pune_city_id;

  -- Muktainagar Villages & Localities
  INSERT INTO public.geo_villages (city_id, slug, name, name_mr, pincode, latitude, longitude, sort_order)
  VALUES
    (v_muktai_id, 'kurha', 'Kurha Kakoda', 'कुऱ्हा काकोडा', '425306', 21.0024, 76.0451, 1),
    (v_muktai_id, 'anturli', 'Anturli', 'अंतुर्ली', '425306', 21.1215, 76.0123, 2),
    (v_muktai_id, 'changdev', 'Changdev', 'चांगदेव', '425306', 21.0924, 76.0354, 3),
    (v_muktai_id, 'pothara', 'Pothara', 'पोथरा', '425306', 21.0412, 75.9521, 4),
    (v_muktai_id, 'taroda', 'Taroda', 'तरोडा', '425306', 21.0612, 75.9234, 5),
    (v_muktai_id, 'kothali', 'Kothali', 'कोथळी', '425306', 21.0850, 75.9910, 6),
    (v_muktai_id, 'nadgaon', 'Nadgaon', 'नांदगाव', '425306', 21.0345, 76.0210, 7),
    (v_muktai_id, 'uchande', 'Uchande', 'उचंदे', '425306', 21.0543, 76.0421, 8)
  ON CONFLICT (city_id, slug) DO NOTHING;

  -- Maval Villages (Parandwadi etc.)
  INSERT INTO public.geo_villages (city_id, slug, name, name_mr, pincode, latitude, longitude, sort_order)
  VALUES
    (v_maval_id, 'parandwadi', 'Parandwadi', 'परंदवडी', '410506', 18.7247, 73.6872, 1),
    (v_maval_id, 'talegaon-dabhade', 'Talegaon Dabhade', 'तळेगाव दाभाडे', '410506', 18.7344, 73.6761, 2),
    (v_maval_id, 'vadgaon', 'Vadgaon Maval', 'वडगाव मावळ', '412106', 18.7494, 73.6457, 3),
    (v_maval_id, 'somatane', 'Somatane', 'सोमाटणे', '410506', 18.7090, 73.6790, 4),
    (v_maval_id, 'kamshet', 'Kamshet', 'कामशेत', '410405', 18.7610, 73.5594, 5),
    (v_maval_id, 'lonavala', 'Lonavala', 'लोणावळा', '410401', 18.7557, 73.4091, 6)
  ON CONFLICT (city_id, slug) DO NOTHING;
END $$;

-- ---- 3. Foreign Key Integration on Content Tables --------------------------

-- Add geographic columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS state_id UUID REFERENCES public.geo_states(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS district_id UUID REFERENCES public.geo_districts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS city_id UUID REFERENCES public.geo_cities(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS village_id UUID REFERENCES public.geo_villages(id) ON DELETE SET NULL;

-- Add geographic columns to shops
ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS state_id UUID REFERENCES public.geo_states(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS district_id UUID REFERENCES public.geo_districts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS city_id UUID REFERENCES public.geo_cities(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS village_id UUID REFERENCES public.geo_villages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_shops_city_id ON public.shops(city_id);
CREATE INDEX IF NOT EXISTS idx_shops_village_id ON public.shops(village_id);
CREATE INDEX IF NOT EXISTS idx_shops_district_id ON public.shops(district_id);

-- Add geographic columns to schools
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS state_id UUID REFERENCES public.geo_states(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS district_id UUID REFERENCES public.geo_districts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS city_id UUID REFERENCES public.geo_cities(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS village_id UUID REFERENCES public.geo_villages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_schools_city_id ON public.schools(city_id);

-- Add geographic columns to shop_requests
ALTER TABLE public.shop_requests
  ADD COLUMN IF NOT EXISTS state_id UUID REFERENCES public.geo_states(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS district_id UUID REFERENCES public.geo_districts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS city_id UUID REFERENCES public.geo_cities(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS village_id UUID REFERENCES public.geo_villages(id) ON DELETE SET NULL;

-- Add city_id to bus_timetable
ALTER TABLE public.bus_timetable
  ADD COLUMN IF NOT EXISTS city_id UUID REFERENCES public.geo_cities(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bus_timetable_city_id ON public.bus_timetable(city_id);

-- Upgrade bus_stand_info to support multi-city stands
ALTER TABLE public.bus_stand_info
  DROP CONSTRAINT IF EXISTS bus_stand_info_id_check;

ALTER TABLE public.bus_stand_info
  ADD COLUMN IF NOT EXISTS city_id UUID REFERENCES public.geo_cities(id) ON DELETE CASCADE;

-- Add unique constraint per city stand if column exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_bus_stand_info_city'
  ) THEN
    ALTER TABLE public.bus_stand_info ADD CONSTRAINT uq_bus_stand_info_city UNIQUE (city_id);
  END IF;
END $$;

-- Upgrade banners for geo-targeting
ALTER TABLE public.banners
  ADD COLUMN IF NOT EXISTS target_level TEXT NOT NULL DEFAULT 'city' CHECK (target_level IN ('global', 'state', 'district', 'city')),
  ADD COLUMN IF NOT EXISTS target_district_id UUID REFERENCES public.geo_districts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS target_city_id UUID REFERENCES public.geo_cities(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_banners_target_city ON public.banners(target_city_id);

-- ---- 4. Zero-Downtime Backfill of Existing Records -------------------------

DO $$
DECLARE
  v_state_id    UUID;
  v_district_id UUID;
  v_muktai_id   UUID;
BEGIN
  SELECT id INTO v_muktai_id FROM public.geo_cities WHERE slug = 'muktainagar' LIMIT 1;
  SELECT district_id INTO v_district_id FROM public.geo_cities WHERE id = v_muktai_id;
  SELECT state_id INTO v_state_id FROM public.geo_districts WHERE id = v_district_id;

  -- Backfill shops
  UPDATE public.shops
  SET
    city_id = v_muktai_id,
    district_id = v_district_id,
    state_id = v_state_id
  WHERE city_id IS NULL;

  -- Backfill schools
  UPDATE public.schools
  SET
    city_id = v_muktai_id,
    district_id = v_district_id,
    state_id = v_state_id
  WHERE city_id IS NULL;

  -- Backfill bus_timetable
  UPDATE public.bus_timetable
  SET city_id = v_muktai_id
  WHERE city_id IS NULL;

  -- Backfill bus_stand_info
  UPDATE public.bus_stand_info
  SET city_id = v_muktai_id
  WHERE city_id IS NULL;

  -- Backfill banners
  UPDATE public.banners
  SET
    target_level = 'city',
    target_city_id = v_muktai_id,
    target_district_id = v_district_id
  WHERE target_city_id IS NULL AND target_level = 'city';

  -- Backfill shop_requests
  UPDATE public.shop_requests
  SET
    city_id = v_muktai_id,
    district_id = v_district_id,
    state_id = v_state_id
  WHERE city_id IS NULL;
END $$;

-- ---- 5. Security & Grants (RLS) --------------------------------------------

GRANT SELECT ON public.geo_countries TO anon, authenticated;
GRANT SELECT ON public.geo_states    TO anon, authenticated;
GRANT SELECT ON public.geo_districts TO anon, authenticated;
GRANT SELECT ON public.geo_cities    TO anon, authenticated;
GRANT SELECT ON public.geo_villages  TO anon, authenticated;

GRANT ALL ON public.geo_countries TO service_role;
GRANT ALL ON public.geo_states    TO service_role;
GRANT ALL ON public.geo_districts TO service_role;
GRANT ALL ON public.geo_cities    TO service_role;
GRANT ALL ON public.geo_villages  TO service_role;

ALTER TABLE public.geo_countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geo_states    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geo_districts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geo_cities    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geo_villages  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view active countries" ON public.geo_countries;
CREATE POLICY "Public can view active countries"
  ON public.geo_countries FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Public can view active states" ON public.geo_states;
CREATE POLICY "Public can view active states"
  ON public.geo_states FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Public can view active districts" ON public.geo_districts;
CREATE POLICY "Public can view active districts"
  ON public.geo_districts FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Public can view active cities" ON public.geo_cities;
CREATE POLICY "Public can view active cities"
  ON public.geo_cities FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Public can view active villages" ON public.geo_villages;
CREATE POLICY "Public can view active villages"
  ON public.geo_villages FOR SELECT USING (is_active = true);

-- Admin CRUD policies for geo tables
DROP POLICY IF EXISTS "Admins can manage countries" ON public.geo_countries;
CREATE POLICY "Admins can manage countries"
  ON public.geo_countries FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can manage states" ON public.geo_states;
CREATE POLICY "Admins can manage states"
  ON public.geo_states FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can manage districts" ON public.geo_districts;
CREATE POLICY "Admins can manage districts"
  ON public.geo_districts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can manage cities" ON public.geo_cities;
CREATE POLICY "Admins can manage cities"
  ON public.geo_cities FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can manage villages" ON public.geo_villages;
CREATE POLICY "Admins can manage villages"
  ON public.geo_villages FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ---- 6. Refresh Views To Inherit New Columns -------------------------------
-- Views defined with SELECT s.* do not auto-inherit columns added via ALTER TABLE.
-- Dropping and recreating shops_with_claim exposes state_id, district_id, city_id, village_id.
DROP VIEW IF EXISTS public.shops_with_claim CASCADE;

CREATE VIEW public.shops_with_claim
WITH (security_invoker = on) AS
SELECT
  s.*,
  EXISTS (
    SELECT 1 FROM public.shop_owners o WHERE o.shop_id = s.id
  ) AS is_claimed
FROM public.shops s;

GRANT SELECT ON public.shops_with_claim TO anon, authenticated;

