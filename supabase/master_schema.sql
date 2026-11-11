-- ============================================================================
-- APNALOCAL / MUKTAINAGAR DAILY — MASTER DATABASE SCHEMA
-- ============================================================================
-- Single source of truth for all tables, columns, relations, views, materialized
-- views, functions, triggers, row-level security (RLS), and table permissions.
--
-- TARGET: PostgreSQL 15+ / Supabase
-- LAST UPDATED: 2026-11-09 (Post-Security Hardening v3 & Essential Services)
-- SAFE TO RE-RUN: Uses "IF NOT EXISTS", "OR REPLACE", and idempotent DDL.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- SECTION 0: EXTENSIONS
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- ----------------------------------------------------------------------------
-- SECTION 1: GEOGRAPHIC HIERARCHY (MULTI-TOWN SUBSYSTEM)
-- ----------------------------------------------------------------------------
-- Administrative tree: Countries -> States -> Districts -> Cities/Talukas -> Villages/Wards

CREATE TABLE IF NOT EXISTS public.geo_countries (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code       TEXT NOT NULL UNIQUE,          -- 'IN'
  name       TEXT NOT NULL,                 -- 'India'
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.geo_states (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_id UUID NOT NULL REFERENCES public.geo_countries(id) ON DELETE CASCADE,
  code       TEXT NOT NULL,                 -- 'MH'
  name       TEXT NOT NULL,                 -- 'Maharashtra'
  name_mr    TEXT NOT NULL,                 -- 'महाराष्ट्र'
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(country_id, code)
);

CREATE TABLE IF NOT EXISTS public.geo_districts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state_id   UUID NOT NULL REFERENCES public.geo_states(id) ON DELETE CASCADE,
  slug       TEXT NOT NULL UNIQUE,          -- 'jalgaon', 'pune'
  name       TEXT NOT NULL,                 -- 'Jalgaon'
  name_mr    TEXT NOT NULL,                 -- 'जळगाव'
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.geo_cities (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id UUID NOT NULL REFERENCES public.geo_districts(id) ON DELETE CASCADE,
  slug        TEXT NOT NULL UNIQUE,         -- 'muktainagar', 'bhusawal', 'varangaon', 'maval'
  name        TEXT NOT NULL,                -- 'Muktainagar'
  name_mr     TEXT NOT NULL,                -- 'मुक्ताईनगर'
  type        TEXT NOT NULL DEFAULT 'taluka' CHECK (type IN ('taluka', 'city', 'town', 'panchayat')),
  latitude    DOUBLE PRECISION,
  longitude   DOUBLE PRECISION,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.geo_villages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id    UUID NOT NULL REFERENCES public.geo_cities(id) ON DELETE CASCADE,
  slug       TEXT NOT NULL,                 -- 'kurha', 'changdev', 'parandwadi'
  name       TEXT NOT NULL,                 -- 'Kurha'
  name_mr    TEXT NOT NULL,                 -- 'कुर्‍हा'
  latitude   DOUBLE PRECISION,
  longitude  DOUBLE PRECISION,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(city_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_geo_cities_slug ON public.geo_cities(slug);
CREATE INDEX IF NOT EXISTS idx_geo_villages_city_slug ON public.geo_villages(city_id, slug);

-- ----------------------------------------------------------------------------
-- SECTION 2: CATEGORIES & BUSINESS TAXONOMY
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,                 -- 'Grocery & Kirana', 'Medical & Pharmacy'
  icon       TEXT NOT NULL DEFAULT '🏪',    -- Lucide icon name or emoji
  sort_order INT NOT NULL DEFAULT 0,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- SECTION 3: COMMERCIAL SHOPS & ESTABLISHMENTS
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.shops (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  category_id      UUID REFERENCES public.categories(id) ON DELETE SET NULL, -- Deprecated single-cat link
  city_id          UUID REFERENCES public.geo_cities(id) ON DELETE SET NULL,
  village_id       UUID REFERENCES public.geo_villages(id) ON DELETE SET NULL,
  phone            TEXT,
  whatsapp         TEXT,
  address          TEXT,
  area             TEXT,
  sub_area         TEXT,
  description      TEXT,
  keywords         TEXT,
  opening_time     TEXT,                        -- '09:00' (24h)
  closing_time     TEXT,                        -- '21:00' (24h)
  is_open          BOOLEAN NOT NULL DEFAULT true,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  is_verified      BOOLEAN NOT NULL DEFAULT false,
  image_url        TEXT,                        -- Primary cover photo
  photos           TEXT[] NOT NULL DEFAULT '{}'::TEXT[], -- Multi-photo gallery
  image_checked_at TIMESTAMPTZ,
  image_broken_at  TIMESTAMPTZ,
  latitude         DOUBLE PRECISION,
  longitude        DOUBLE PRECISION,
  slug             TEXT UNIQUE,
  amenities        TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shops_city_id ON public.shops(city_id);
CREATE INDEX IF NOT EXISTS idx_shops_village_id ON public.shops(village_id);
CREATE INDEX IF NOT EXISTS idx_shops_is_active ON public.shops(is_active);
CREATE INDEX IF NOT EXISTS idx_shops_slug ON public.shops(slug);

CREATE TABLE IF NOT EXISTS public.shop_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  UNIQUE(shop_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_shop_categories_shop ON public.shop_categories(shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_categories_cat ON public.shop_categories(category_id);

CREATE TABLE IF NOT EXISTS public.shop_engagement (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id    UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('call', 'whatsapp', 'maps', 'directions', 'share', 'view')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shop_engagement_shop_date ON public.shop_engagement(shop_id, created_at);

CREATE TABLE IF NOT EXISTS public.reviews (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name   TEXT NOT NULL,
  rating      INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reviews_shop ON public.reviews(shop_id);

-- ----------------------------------------------------------------------------
-- SECTION 4: LIVING VERTICALS (MESS & DINING, PG & HOSTELS)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.mess_profiles (
  shop_id          UUID PRIMARY KEY REFERENCES public.shops(id) ON DELETE CASCADE,
  mess_type        TEXT NOT NULL DEFAULT 'pure_veg' CHECK (mess_type IN ('pure_veg', 'veg_nonveg', 'jain_available')),
  monthly_rate     NUMERIC(10, 2),
  single_thali_rate NUMERIC(10, 2),
  tiffin_delivery  BOOLEAN NOT NULL DEFAULT false,
  lunch_timing     TEXT,
  dinner_timing    TEXT,
  sunday_feast     BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.mess_daily_menus (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  menu_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  lunch_text  TEXT,
  dinner_text TEXT,
  photo_url   TEXT,
  special_tag TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(shop_id, menu_date)
);

CREATE TABLE IF NOT EXISTS public.pg_profiles (
  shop_id              UUID PRIMARY KEY REFERENCES public.shops(id) ON DELETE CASCADE,
  gender               TEXT NOT NULL DEFAULT 'boys' CHECK (gender IN ('boys', 'girls', 'both')),
  occupancy_target     TEXT NOT NULL DEFAULT 'students' CHECK (occupancy_target IN ('students', 'professionals', 'any')),
  total_beds           INT NOT NULL DEFAULT 0,
  available_beds       INT NOT NULL DEFAULT 0,
  deposit_amount       NUMERIC(10, 2),
  notice_period_days   INT DEFAULT 30,
  gate_closing_time    TEXT,
  food_included        BOOLEAN NOT NULL DEFAULT false,
  amenities            TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  sharing_rates        JSONB NOT NULL DEFAULT '{}'::JSONB,
  vacancies_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- SECTION 5: CIVIC & EDUCATION (SCHOOLS & MSRTC BUS TIMETABLE)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.schools (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id     UUID REFERENCES public.geo_cities(id) ON DELETE SET NULL,
  village_id  UUID REFERENCES public.geo_villages(id) ON DELETE SET NULL,
  name        TEXT NOT NULL,
  name_mr     TEXT,
  school_type TEXT NOT NULL DEFAULT 'secondary' CHECK (
    school_type IN ('primary', 'secondary', 'higher-secondary', 'college', 'engineering-polytechnic', 'university', 'coaching', 'other')
  ),
  medium      TEXT NOT NULL DEFAULT 'marathi' CHECK (medium IN ('marathi', 'english', 'semi-english', 'other')),
  area        TEXT,
  sub_area    TEXT,
  address     TEXT,
  address_mr  TEXT,
  phone       TEXT,
  email       TEXT,
  website     TEXT,
  description TEXT,
  image_url   TEXT,
  photos      TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  latitude    DOUBLE PRECISION,
  longitude   DOUBLE PRECISION,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bus_timetable (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id           UUID REFERENCES public.geo_cities(id) ON DELETE SET NULL,
  destination       TEXT NOT NULL,
  destination_mr    TEXT,
  depot             TEXT,
  departure_times   TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  via_stops         TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  bus_type          TEXT DEFAULT 'ordinary' CHECK (bus_type IN ('ordinary', 'express', 'semi_luxury', 'shivshahi', 'other')),
  platform_number   INT,
  notes             TEXT,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  sort_order        INT NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bus_stand_info (
  id         INT PRIMARY KEY DEFAULT 1,
  city_id    UUID REFERENCES public.geo_cities(id) ON DELETE CASCADE,
  phone      TEXT,
  address    TEXT,
  maps_url   TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- SECTION 6: ESSENTIAL SERVICES & LOCAL AUTHORITIES MODULE
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.authority_departments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT NOT NULL UNIQUE,          -- 'water', 'electricity', 'municipal'
  name        TEXT NOT NULL,                 -- 'Water Supply Department'
  name_mr     TEXT NOT NULL,                 -- 'पाणी पुरवठा विभाग'
  icon        TEXT NOT NULL,                 -- 'Droplets', 'Zap', 'Building2'
  color_theme TEXT NOT NULL DEFAULT 'blue',  -- 'blue', 'amber', 'emerald'
  sort_order  INT NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.authority_organizations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_ids  UUID[] NOT NULL DEFAULT '{}'::UUID[],
  city_id         UUID NOT NULL REFERENCES public.geo_cities(id) ON DELETE CASCADE,
  district_id     UUID REFERENCES public.geo_districts(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  name_mr         TEXT NOT NULL,
  office_address  TEXT,
  maps_url        TEXT,
  visiting_hours  TEXT DEFAULT '10:30 AM - 05:30 PM (Mon-Sat)',
  helpline_phone  TEXT NOT NULL,
  emergency_phone TEXT,
  whatsapp_number TEXT,
  email           TEXT,
  key_contacts    JSONB DEFAULT '[]'::JSONB,
  is_demo         BOOLEAN NOT NULL DEFAULT true,
  is_verified     BOOLEAN NOT NULL DEFAULT false,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.authority_announcements (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         UUID NOT NULL REFERENCES public.authority_organizations(id) ON DELETE CASCADE,
  department_id  UUID NOT NULL REFERENCES public.authority_departments(id) ON DELETE CASCADE,
  city_id        UUID NOT NULL REFERENCES public.geo_cities(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  title_mr       TEXT NOT NULL,
  description    TEXT NOT NULL,
  description_mr TEXT,
  category       TEXT NOT NULL CHECK (category IN ('interruption', 'maintenance', 'emergency', 'notice', 'advisory')),
  priority       TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status         TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'active', 'completed', 'cancelled')),
  start_time     TIMESTAMPTZ,
  end_time       TIMESTAMPTZ,
  published_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  media_urls     TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  is_demo        BOOLEAN NOT NULL DEFAULT true,
  created_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.announcement_locations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL REFERENCES public.authority_announcements(id) ON DELETE CASCADE,
  city_id         UUID NOT NULL REFERENCES public.geo_cities(id) ON DELETE CASCADE,
  village_id      UUID REFERENCES public.geo_villages(id) ON DELETE CASCADE,
  area_text       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.authority_admin_grants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  department_id UUID REFERENCES public.authority_departments(id) ON DELETE CASCADE,
  city_id       UUID REFERENCES public.geo_cities(id) ON DELETE CASCADE,
  granted_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, department_id, city_id)
);

-- ----------------------------------------------------------------------------
-- SECTION 7: PROFILES, AUTH, ROLES & COMMUNITY
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.profiles (
  id                   UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name            TEXT UNIQUE,                  -- @username
  email                TEXT,
  locale               TEXT DEFAULT 'en' CHECK (locale IN ('en', 'mr')),
  phone                TEXT,
  birth_date           DATE,
  gender               TEXT CHECK (gender IN ('male', 'female', 'other')),
  city_id              UUID REFERENCES public.geo_cities(id) ON DELETE SET NULL,
  village_id           UUID REFERENCES public.geo_villages(id) ON DELETE SET NULL,
  full_name_changed_at TIMESTAMPTZ,                  -- Locked after first set
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role    TEXT NOT NULL CHECK (role IN ('admin', 'shopkeeper', 'user')),
  UNIQUE(user_id, role)
);

CREATE TABLE IF NOT EXISTS public.shop_owners (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  UNIQUE(shop_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.shop_claims (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id          UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  proof_type       TEXT NOT NULL CHECK (proof_type IN ('aadhar_card', 'gst', 'utility_bill', 'shop_board', 'other')),
  proof_image_path TEXT NOT NULL,
  admin_notes      TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.shop_bookmarks (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shop_id    UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, shop_id)
);

CREATE TABLE IF NOT EXISTS public.shop_requests (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name               TEXT NOT NULL,
  entity_type        TEXT NOT NULL DEFAULT 'shop' CHECK (entity_type IN ('shop', 'mess', 'pg', 'school')),
  city_id            UUID REFERENCES public.geo_cities(id) ON DELETE SET NULL,
  village_id         UUID REFERENCES public.geo_villages(id) ON DELETE SET NULL,
  phone              TEXT,
  whatsapp           TEXT,
  address            TEXT,
  area               TEXT,
  sub_area           TEXT,
  category_text      TEXT,
  description        TEXT,
  keywords           TEXT,
  opening_time       TEXT,
  closing_time       TEXT,
  latitude           DOUBLE PRECISION,
  longitude          DOUBLE PRECISION,
  maps_link          TEXT,
  image_url          TEXT,
  photos             TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  meta               JSONB NOT NULL DEFAULT '{}'::JSONB,
  submitter_name     TEXT,
  submitter_user_id  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  admin_notes        TEXT,
  status             TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  amenities          TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- SECTION 8: I18N & MARATHI TRANSLATIONS
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.translation_cache (
  direction    TEXT NOT NULL DEFAULT 'en-mr',
  source_text  TEXT NOT NULL,
  translated   TEXT NOT NULL,
  hit_count    INT NOT NULL DEFAULT 1,
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (direction, source_text)
);

CREATE TABLE IF NOT EXISTS public.shop_translations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  locale      TEXT NOT NULL CHECK (locale IN ('mr')),
  name        TEXT,
  address     TEXT,
  area        TEXT,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(shop_id, locale)
);

CREATE TABLE IF NOT EXISTS public.category_translations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  locale      TEXT NOT NULL CHECK (locale IN ('mr')),
  name        TEXT NOT NULL,
  UNIQUE(category_id, locale)
);

CREATE TABLE IF NOT EXISTS public.amenity_translations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key        TEXT NOT NULL,
  locale     TEXT NOT NULL CHECK (locale IN ('mr')),
  label      TEXT NOT NULL,
  UNIQUE(key, locale)
);

-- ----------------------------------------------------------------------------
-- SECTION 9: BANNERS & MONETIZATION
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.banners (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_level         TEXT NOT NULL DEFAULT 'all' CHECK (target_level IN ('all', 'district', 'city')),
  target_district_id   UUID REFERENCES public.geo_districts(id) ON DELETE SET NULL,
  target_city_id       UUID REFERENCES public.geo_cities(id) ON DELETE SET NULL,
  city_id              UUID REFERENCES public.geo_cities(id) ON DELETE SET NULL, -- Backward compatibility
  title                TEXT NOT NULL,
  image_url            TEXT NOT NULL,
  target_url           TEXT,
  placement            TEXT NOT NULL CHECK (
    placement IN ('popup', 'homepage_inline', 'shops_inline', 'category_inline', 'shops_infeed', 'shop_detail_inline', 'home_bottom', 'saved_inline')
  ),
  is_active            BOOLEAN NOT NULL DEFAULT true,
  popup_delay_seconds  INT NOT NULL DEFAULT 2,
  close_enable_seconds INT NOT NULL DEFAULT 5,
  start_date           DATE,
  end_date             DATE,
  view_count           INT NOT NULL DEFAULT 0,
  click_count          INT NOT NULL DEFAULT 0,
  sort_order           INT NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- SECTION 10: MCP & AGENT INTEGRATIONS
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.mcp_endpoints (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  url        TEXT NOT NULL,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- SECTION 11: VIEWS & MATERIALIZED VIEWS
-- ----------------------------------------------------------------------------

-- 1. shops_with_claim
CREATE OR REPLACE VIEW public.shops_with_claim WITH (security_invoker = on) AS
SELECT
  s.*,
  EXISTS (
    SELECT 1 FROM public.shop_owners so WHERE so.shop_id = s.id
  ) AS is_claimed
FROM public.shops s;

-- 2. profiles_public
CREATE OR REPLACE VIEW public.profiles_public WITH (security_invoker = on) AS
SELECT id, full_name
FROM public.profiles;

-- 3. shops_list_public (m-Pulse #2 slim projection)
CREATE OR REPLACE VIEW public.shops_list_public WITH (security_invoker = on) AS
SELECT
  s.id, s.name, s.slug, s.area, s.sub_area, s.address, s.phone, s.whatsapp,
  s.image_url, s.opening_time, s.closing_time, s.is_open, s.is_verified,
  s.is_active, s.city_id, s.village_id, s.amenities, s.created_at, s.updated_at,
  EXISTS (SELECT 1 FROM public.shop_owners so WHERE so.shop_id = s.id) AS is_claimed
FROM public.shops s
WHERE s.is_active = true;

-- 4. shops_search_public (m-Pulse #2 sidecar for lazy fuzzy search)
CREATE OR REPLACE VIEW public.shops_search_public WITH (security_invoker = on) AS
SELECT
  s.id, s.name, s.slug, s.description, s.keywords, s.area, s.sub_area, s.address, s.city_id
FROM public.shops s
WHERE s.is_active = true;

-- 5. category_shop_counts (Materialized view)
CREATE MATERIALIZED VIEW IF NOT EXISTS public.category_shop_counts AS
SELECT
  sc.category_id,
  COUNT(DISTINCT sc.shop_id)::BIGINT AS shop_count
FROM public.shop_categories sc
JOIN public.shops s ON s.id = sc.shop_id
WHERE s.is_active = true
GROUP BY sc.category_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_category_shop_counts_cat ON public.category_shop_counts(category_id);

-- 6. shop_engagement_stats (Materialized view)
CREATE MATERIALIZED VIEW IF NOT EXISTS public.shop_engagement_stats AS
SELECT
  se.shop_id,
  COUNT(*) FILTER (WHERE se.event_type = 'call') AS calls,
  COUNT(*) FILTER (WHERE se.event_type = 'whatsapp') AS whatsapp,
  COUNT(*) AS total_engagements
FROM public.shop_engagement se
WHERE se.created_at >= now() - INTERVAL '30 days'
GROUP BY se.shop_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_shop_engagement_stats_shop ON public.shop_engagement_stats(shop_id);

-- ----------------------------------------------------------------------------
-- SECTION 12: CORE HELPER FUNCTIONS & TRIGGERS
-- ----------------------------------------------------------------------------

-- Universal updated_at stamper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Slug generator with collision avoidance
CREATE OR REPLACE FUNCTION public.generate_shop_slug(p_name text, p_exclude_id uuid DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  base_slug text;
  candidate text;
  counter int := 1;
BEGIN
  base_slug := lower(regexp_replace(unaccent(trim(p_name)), '[^a-z0-9]+', '-', 'g'));
  base_slug := trim(both '-' from base_slug);
  IF base_slug = '' THEN base_slug := 'shop'; END IF;
  candidate := base_slug;

  WHILE EXISTS (
    SELECT 1 FROM public.shops
    WHERE slug = candidate AND (p_exclude_id IS NULL OR id <> p_exclude_id)
  ) LOOP
    counter := counter + 1;
    candidate := base_slug || '-' || counter;
  END LOOP;

  RETURN candidate;
END;
$$;

-- Automatic shop slug trigger
CREATE OR REPLACE FUNCTION public.set_shop_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.slug IS NULL OR trim(NEW.slug) = '' THEN
    NEW.slug := public.generate_shop_slug(NEW.name, NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_shop_slug ON public.shops;
CREATE TRIGGER trg_shop_slug
  BEFORE INSERT OR UPDATE OF name ON public.shops
  FOR EACH ROW
  EXECUTE FUNCTION public.set_shop_slug();

-- RBAC helper
CREATE OR REPLACE FUNCTION public.has_role(uid uuid, required_role text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  IF uid IS NULL THEN RETURN false; END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = uid AND role = required_role
  );
END;
$$;

-- Admin check helper
CREATE OR REPLACE FUNCTION public.is_admin(uid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  RETURN public.has_role(uid, 'admin');
END;
$$;

-- Shop owner column modification guard
CREATE OR REPLACE FUNCTION public.shops_owner_column_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    NEW.is_verified := OLD.is_verified;
    NEW.is_active   := OLD.is_active;
    NEW.slug        := OLD.slug;
    NEW.category_id := OLD.category_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_shops_owner_column_guard ON public.shops;
CREATE TRIGGER trg_shops_owner_column_guard
  BEFORE UPDATE ON public.shops
  FOR EACH ROW
  EXECUTE FUNCTION public.shops_owner_column_guard();

-- One-time username lock trigger
CREATE OR REPLACE FUNCTION public.profiles_lock_username()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.full_name IS NOT NULL AND NEW.full_name IS DISTINCT FROM OLD.full_name AND OLD.full_name_changed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Username can only be changed once.' USING ERRCODE = 'check_violation';
  END IF;

  IF OLD.full_name IS DISTINCT FROM NEW.full_name AND NEW.full_name IS NOT NULL THEN
    NEW.full_name_changed_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_lock_username ON public.profiles;
CREATE TRIGGER trg_profiles_lock_username
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_lock_username();

-- Rate-limit claim submissions
CREATE OR REPLACE FUNCTION public.trg_shop_claims_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_pending_count INT;
  v_recent_shop_claims INT;
  v_recent_user_claims INT;
BEGIN
  IF public.has_role(NEW.user_id, 'admin') THEN RETURN NEW; END IF;

  SELECT COUNT(*) INTO v_pending_count
  FROM public.shop_claims
  WHERE shop_id = NEW.shop_id AND user_id = NEW.user_id AND status = 'pending';
  IF v_pending_count > 0 THEN
    RAISE EXCEPTION 'You already have a pending claim for this shop.';
  END IF;

  SELECT COUNT(*) INTO v_recent_shop_claims
  FROM public.shop_claims
  WHERE shop_id = NEW.shop_id AND user_id = NEW.user_id AND created_at >= now() - INTERVAL '24 hours';
  IF v_recent_shop_claims >= 3 THEN
    RAISE EXCEPTION 'Maximum 3 claim submissions per shop in 24 hours.';
  END IF;

  SELECT COUNT(*) INTO v_recent_user_claims
  FROM public.shop_claims
  WHERE user_id = NEW.user_id AND created_at >= now() - INTERVAL '1 hour';
  IF v_recent_user_claims >= 3 THEN
    RAISE EXCEPTION 'Maximum 3 claim submissions per hour.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_shop_claims_limit ON public.shop_claims;
CREATE TRIGGER trg_shop_claims_limit
  BEFORE INSERT ON public.shop_claims
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_shop_claims_rate_limit();

-- Paginated shops query RPC (Hardened against resource exhaustion)
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
  v_limit int;
  v_offset int;
BEGIN
  -- Strict sanitization: bounded parameters
  IF p_search IS NOT NULL THEN
    clean_search := trim(p_search);
    IF length(clean_search) > 100 THEN
      clean_search := substring(clean_search from 1 for 100);
    END IF;
  END IF;

  v_limit := LEAST(GREATEST(COALESCE(p_limit, 24), 1), 50);
  v_offset := GREATEST(COALESCE(p_offset, 0), 0);

  RETURN QUERY
  WITH filtered AS (
    SELECT
      s.id AS shop_id,
      s.slug,
      s.name,
      s.area,
      s.sub_area,
      s.address,
      s.image_url,
      s.opening_time,
      s.closing_time,
      s.is_open,
      s.is_verified,
      s.category_id,
      EXISTS (SELECT 1 FROM public.shop_owners so WHERE so.shop_id = s.id) AS is_claimed
    FROM public.shops s
    WHERE s.is_active = true
      AND (p_area IS NULL OR s.area = p_area OR s.sub_area = p_area)
      AND (
        p_category IS NULL
        OR s.category_id = p_category
        OR EXISTS (
          SELECT 1 FROM public.shop_categories sc
          WHERE sc.shop_id = s.id AND sc.category_id = p_category
        )
      )
      AND (
        clean_search IS NULL
        OR s.name ILIKE ('%' || clean_search || '%')
        OR s.description ILIKE ('%' || clean_search || '%')
        OR s.keywords ILIKE ('%' || clean_search || '%')
        OR s.area ILIKE ('%' || clean_search || '%')
      )
  ),
  counted AS (
    SELECT COUNT(*)::bigint AS cnt FROM filtered
  )
  SELECT
    f.shop_id AS id,
    f.slug,
    f.name,
    f.area,
    f.sub_area,
    f.address,
    f.image_url,
    f.opening_time,
    f.closing_time,
    f.is_open,
    f.is_verified,
    f.category_id,
    f.is_claimed,
    c.cnt AS total_count
  FROM filtered f
  CROSS JOIN counted c
  ORDER BY f.is_verified DESC, f.name ASC
  LIMIT v_limit
  OFFSET v_offset;
END;
$$;

-- Increment banner analytics safely via RPC
CREATE OR REPLACE FUNCTION public.increment_banner_view(p_banner_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.banners
  SET view_count = view_count + 1
  WHERE id = p_banner_id;
$$;

CREATE OR REPLACE FUNCTION public.increment_banner_click(p_banner_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.banners
  SET click_count = click_count + 1
  WHERE id = p_banner_id;
$$;

-- Authority multi-tenant security checker
CREATE OR REPLACE FUNCTION public.check_authority_admin_access(p_dept_id UUID, p_city_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN RETURN true; END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.authority_admin_grants
    WHERE user_id = auth.uid()
      AND (department_id IS NULL OR department_id = p_dept_id)
      AND (city_id IS NULL OR city_id = p_city_id)
  );
END;
$$;

-- Claim approval RPC
CREATE OR REPLACE FUNCTION public.approve_shop_claim(p_claim_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop_id uuid;
  v_user_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can approve claims.';
  END IF;

  SELECT shop_id, user_id INTO v_shop_id, v_user_id
  FROM public.shop_claims
  WHERE id = p_claim_id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Claim not found or not pending.';
  END IF;

  UPDATE public.shop_claims
  SET status = 'approved', updated_at = now()
  WHERE id = p_claim_id;

  INSERT INTO public.shop_owners (shop_id, user_id)
  VALUES (v_shop_id, v_user_id)
  ON CONFLICT (shop_id, user_id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'shopkeeper')
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_shop_claim(p_claim_id uuid, p_notes text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can reject claims.';
  END IF;

  UPDATE public.shop_claims
  SET status = 'rejected', admin_notes = COALESCE(p_notes, admin_notes), updated_at = now()
  WHERE id = p_claim_id AND status = 'pending';
END;
$$;

-- ----------------------------------------------------------------------------
-- SECTION 13: ROW-LEVEL SECURITY & POSTGREST TABLE GRANTS
-- ----------------------------------------------------------------------------

-- Enable RLS across all tables
ALTER TABLE public.geo_countries          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geo_states             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geo_districts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geo_cities             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geo_villages           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shops                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_categories        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_engagement        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mess_profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mess_daily_menus       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pg_profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schools                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bus_timetable          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bus_stand_info         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.authority_departments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.authority_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.authority_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.authority_admin_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_owners            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_claims            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_bookmarks         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_requests          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.translation_cache      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_translations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_translations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.amenity_translations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banners                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_endpoints          ENABLE ROW LEVEL SECURITY;

-- PostgREST Table Grants
GRANT SELECT ON public.geo_countries, public.geo_states, public.geo_districts, public.geo_cities, public.geo_villages TO anon, authenticated;
GRANT SELECT ON public.categories, public.shops, public.shop_categories TO anon, authenticated;
GRANT SELECT ON public.mess_profiles, public.mess_daily_menus, public.pg_profiles TO anon, authenticated;
GRANT SELECT ON public.schools, public.bus_timetable, public.bus_stand_info TO anon, authenticated;
GRANT SELECT ON public.authority_departments, public.authority_organizations, public.authority_announcements, public.announcement_locations TO anon, authenticated;
GRANT SELECT ON public.reviews, public.banners, public.translation_cache, public.shop_translations, public.category_translations, public.amenity_translations TO anon, authenticated;
GRANT SELECT ON public.shops_list_public, public.shops_search_public, public.shops_with_claim, public.profiles_public TO anon, authenticated;

GRANT INSERT ON public.shop_engagement TO anon, authenticated;
GRANT INSERT ON public.shop_requests   TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.reviews, public.shop_bookmarks TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.shop_claims TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.authority_announcements, public.announcement_locations TO authenticated;
GRANT UPDATE                 ON public.authority_organizations TO authenticated;

-- Master Admin / Service Role Grants
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.mcp_endpoints FROM authenticated;
GRANT ALL ON public.mcp_endpoints TO service_role;

-- Core RLS Policies
CREATE POLICY "Public read geo hierarchy" ON public.geo_cities FOR SELECT USING (true);
CREATE POLICY "Public read active categories" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Public read active shops" ON public.shops FOR SELECT USING (is_active = true OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Public read shop categories" ON public.shop_categories FOR SELECT USING (true);

-- Living Services RLS (SELECT + Explicit DELETE)
CREATE POLICY "Public read mess profiles" ON public.mess_profiles FOR SELECT USING (true);
CREATE POLICY "Owners or admins modify mess profiles" ON public.mess_profiles FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    EXISTS (SELECT 1 FROM public.shop_owners so WHERE so.shop_id = mess_profiles.shop_id AND so.user_id = auth.uid())
  );
CREATE POLICY "Owners or admins delete mess profiles" ON public.mess_profiles FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    EXISTS (SELECT 1 FROM public.shop_owners so WHERE so.shop_id = mess_profiles.shop_id AND so.user_id = auth.uid())
  );

CREATE POLICY "Public read pg profiles" ON public.pg_profiles FOR SELECT USING (true);
CREATE POLICY "Owners or admins modify pg profiles" ON public.pg_profiles FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    EXISTS (SELECT 1 FROM public.shop_owners so WHERE so.shop_id = pg_profiles.shop_id AND so.user_id = auth.uid())
  );
CREATE POLICY "Owners or admins delete pg profiles" ON public.pg_profiles FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    EXISTS (SELECT 1 FROM public.shop_owners so WHERE so.shop_id = pg_profiles.shop_id AND so.user_id = auth.uid())
  );

CREATE POLICY "Public read mess daily menus" ON public.mess_daily_menus FOR SELECT USING (true);
CREATE POLICY "Owners or admins modify mess menus" ON public.mess_daily_menus FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    EXISTS (SELECT 1 FROM public.shop_owners so WHERE so.shop_id = mess_daily_menus.shop_id AND so.user_id = auth.uid())
  );
CREATE POLICY "Owners or admins delete mess menus" ON public.mess_daily_menus FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    EXISTS (SELECT 1 FROM public.shop_owners so WHERE so.shop_id = mess_daily_menus.shop_id AND so.user_id = auth.uid())
  );

-- Essential Services RLS
CREATE POLICY "Public read authority departments" ON public.authority_departments FOR SELECT USING (is_active = true);
CREATE POLICY "Public read authority organizations" ON public.authority_organizations FOR SELECT USING (is_active = true);
CREATE POLICY "Public read active authority announcements" ON public.authority_announcements FOR SELECT
  USING (status IN ('active', 'scheduled') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Authority admins modify announcements" ON public.authority_announcements FOR ALL TO authenticated
  USING (public.check_authority_admin_access(department_id, city_id));

-- End of Master Database Schema
