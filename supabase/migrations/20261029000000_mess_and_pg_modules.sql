-- ============================================================================
-- Migration: 20261029000000_mess_and_pg_modules.sql
-- Description: Adds tables, categories, RLS policies, and triggers for
--              Mess & Tiffin Services (with daily food menus) and
--              Paying Guest (PG / Hostels) with live vacancy tracking.
-- ============================================================================

-- 1. Default Categories for Mess & PG
INSERT INTO public.categories (name, icon, is_active)
SELECT 'Mess & Dining', '🍲', true
WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE name ILIKE 'Mess%');

INSERT INTO public.categories (name, icon, is_active)
SELECT 'PG & Hostels', '🛏️', true
WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE name ILIKE 'PG%');

-- 2. MESS_PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.mess_profiles (
  shop_id            UUID PRIMARY KEY REFERENCES public.shops(id) ON DELETE CASCADE,
  mess_type          TEXT NOT NULL DEFAULT 'veg_nonveg' CHECK (mess_type IN ('pure_veg', 'veg_nonveg', 'jain_available')),
  monthly_rate       NUMERIC NULL,
  single_thali_rate  NUMERIC NULL,
  tiffin_delivery    BOOLEAN NOT NULL DEFAULT false,
  lunch_timing       TEXT NULL DEFAULT '11:30 AM - 02:30 PM',
  dinner_timing      TEXT NULL DEFAULT '07:30 PM - 10:30 PM',
  sunday_feast       BOOLEAN NOT NULL DEFAULT false,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. MESS_DAILY_MENUS TABLE
CREATE TABLE IF NOT EXISTS public.mess_daily_menus (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id      UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  menu_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  lunch_text   TEXT NULL,
  dinner_text  TEXT NULL,
  photo_url    TEXT NULL,
  special_tag  TEXT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT mess_menu_has_content CHECK (
    (lunch_text IS NOT NULL AND trim(lunch_text) <> '') OR
    (dinner_text IS NOT NULL AND trim(dinner_text) <> '') OR
    (photo_url IS NOT NULL AND trim(photo_url) <> '')
  ),
  CONSTRAINT mess_menu_shop_date_unique UNIQUE (shop_id, menu_date)
);

-- 4. PG_PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.pg_profiles (
  shop_id               UUID PRIMARY KEY REFERENCES public.shops(id) ON DELETE CASCADE,
  gender                TEXT NOT NULL DEFAULT 'boys' CHECK (gender IN ('boys', 'girls', 'both')),
  occupancy_target      TEXT NOT NULL DEFAULT 'students' CHECK (occupancy_target IN ('students', 'professionals', 'any')),
  total_beds            INTEGER NOT NULL DEFAULT 0 CHECK (total_beds >= 0),
  available_beds        INTEGER NOT NULL DEFAULT 0 CHECK (available_beds >= 0),
  deposit_amount        NUMERIC NOT NULL DEFAULT 0,
  notice_period_days    INTEGER NOT NULL DEFAULT 30,
  gate_closing_time     TEXT NULL DEFAULT '10:00 PM',
  food_included         BOOLEAN NOT NULL DEFAULT false,
  amenities             TEXT[] NOT NULL DEFAULT '{}',
  sharing_rates         JSONB NOT NULL DEFAULT '{"1_sharing": null, "2_sharing": null, "3_sharing": null, "4_sharing": null}'::jsonb,
  vacancies_updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. INDEXES FOR FAST QUERYING
CREATE INDEX IF NOT EXISTS idx_mess_daily_menus_shop_date ON public.mess_daily_menus(shop_id, menu_date DESC);
CREATE INDEX IF NOT EXISTS idx_mess_daily_menus_date      ON public.mess_daily_menus(menu_date DESC);
CREATE INDEX IF NOT EXISTS idx_pg_profiles_gender         ON public.pg_profiles(gender);
CREATE INDEX IF NOT EXISTS idx_pg_profiles_available_beds ON public.pg_profiles(available_beds);

-- 6. ATTACH UPDATED_AT TRIGGERS
DROP TRIGGER IF EXISTS trg_mess_profiles_updated_at ON public.mess_profiles;
CREATE TRIGGER trg_mess_profiles_updated_at
  BEFORE UPDATE ON public.mess_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_mess_daily_menus_updated_at ON public.mess_daily_menus;
CREATE TRIGGER trg_mess_daily_menus_updated_at
  BEFORE UPDATE ON public.mess_daily_menus
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_pg_profiles_updated_at ON public.pg_profiles;
CREATE TRIGGER trg_pg_profiles_updated_at
  BEFORE UPDATE ON public.pg_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 7. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.mess_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mess_daily_menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pg_profiles ENABLE ROW LEVEL SECURITY;

-- Read policies: Anyone can view active shops' mess and PG data
DROP POLICY IF EXISTS "Mess profiles are publicly readable" ON public.mess_profiles;
CREATE POLICY "Mess profiles are publicly readable"
  ON public.mess_profiles FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = mess_profiles.shop_id AND s.is_active = true));

DROP POLICY IF EXISTS "Mess daily menus are publicly readable" ON public.mess_daily_menus;
CREATE POLICY "Mess daily menus are publicly readable"
  ON public.mess_daily_menus FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = mess_daily_menus.shop_id AND s.is_active = true));

DROP POLICY IF EXISTS "PG profiles are publicly readable" ON public.pg_profiles;
CREATE POLICY "PG profiles are publicly readable"
  ON public.pg_profiles FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = pg_profiles.shop_id AND s.is_active = true));

-- Write policies: Authenticated owners or admins
DROP POLICY IF EXISTS "Owners or admins insert mess profiles" ON public.mess_profiles;
CREATE POLICY "Owners or admins insert mess profiles"
  ON public.mess_profiles FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    EXISTS (SELECT 1 FROM public.shop_owners so WHERE so.shop_id = mess_profiles.shop_id AND so.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Owners or admins update mess profiles" ON public.mess_profiles;
CREATE POLICY "Owners or admins update mess profiles"
  ON public.mess_profiles FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    EXISTS (SELECT 1 FROM public.shop_owners so WHERE so.shop_id = mess_profiles.shop_id AND so.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Owners or admins insert mess menus" ON public.mess_daily_menus;
CREATE POLICY "Owners or admins insert mess menus"
  ON public.mess_daily_menus FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    EXISTS (SELECT 1 FROM public.shop_owners so WHERE so.shop_id = mess_daily_menus.shop_id AND so.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Owners or admins update mess menus" ON public.mess_daily_menus;
CREATE POLICY "Owners or admins update mess menus"
  ON public.mess_daily_menus FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    EXISTS (SELECT 1 FROM public.shop_owners so WHERE so.shop_id = mess_daily_menus.shop_id AND so.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Owners or admins insert pg profiles" ON public.pg_profiles;
CREATE POLICY "Owners or admins insert pg profiles"
  ON public.pg_profiles FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    EXISTS (SELECT 1 FROM public.shop_owners so WHERE so.shop_id = pg_profiles.shop_id AND so.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Owners or admins update pg profiles" ON public.pg_profiles;
CREATE POLICY "Owners or admins update pg profiles"
  ON public.pg_profiles FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    EXISTS (SELECT 1 FROM public.shop_owners so WHERE so.shop_id = pg_profiles.shop_id AND so.user_id = auth.uid())
  );

-- Grants
GRANT SELECT ON public.mess_profiles TO anon, authenticated;
GRANT SELECT ON public.mess_daily_menus TO anon, authenticated;
GRANT SELECT ON public.pg_profiles TO anon, authenticated;

GRANT INSERT, UPDATE, DELETE ON public.mess_profiles TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.mess_daily_menus TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.pg_profiles TO authenticated;
