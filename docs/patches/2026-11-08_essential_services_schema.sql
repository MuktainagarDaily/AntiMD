-- ============================================================================
-- 2026-11-08 — Essential Services & Local Authorities Schema
--
-- Purely additive DDL creating:
--   1. authority_departments (Water, Power, Municipal, etc.)
--   2. authority_organizations (Entities with is_demo safety flags)
--   3. authority_announcements (Broadcasts, Outages, Maintenance, Advisories)
--   4. announcement_locations (Targeted City, Village, or Ward junctions)
--   5. authority_admin_grants (Multi-tenant scoped RBAC by department + geography)
--   6. check_authority_admin_access() security function
--   7. Demo seed fixtures for Muktainagar
-- ============================================================================

-- ---- 1. Departments Taxonomy -----------------------------------------------

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

-- ---- 2. Authority Organizations --------------------------------------------

CREATE TABLE IF NOT EXISTS public.authority_organizations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_ids  UUID[] NOT NULL DEFAULT '{}',
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
  key_contacts    JSONB DEFAULT '[]'::jsonb,
  is_demo         BOOLEAN NOT NULL DEFAULT true,  -- Mandatory DEMO flag
  is_verified     BOOLEAN NOT NULL DEFAULT false,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure additive columns exist if table was already created
ALTER TABLE public.authority_organizations
  ADD COLUMN IF NOT EXISTS maps_url TEXT,
  ADD COLUMN IF NOT EXISTS visiting_hours TEXT DEFAULT '10:30 AM - 05:30 PM (Mon-Sat)',
  ADD COLUMN IF NOT EXISTS key_contacts JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- ---- 3. Authority Announcements --------------------------------------------

CREATE TABLE IF NOT EXISTS public.authority_announcements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES public.authority_organizations(id) ON DELETE CASCADE,
  department_id   UUID NOT NULL REFERENCES public.authority_departments(id) ON DELETE CASCADE,
  city_id         UUID NOT NULL REFERENCES public.geo_cities(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  title_mr        TEXT NOT NULL,
  description     TEXT NOT NULL,
  description_mr  TEXT,
  category        TEXT NOT NULL CHECK (category IN ('interruption', 'maintenance', 'emergency', 'notice', 'advisory')),
  priority        TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'active', 'completed', 'cancelled')),
  start_time      TIMESTAMPTZ,
  end_time        TIMESTAMPTZ,
  published_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  media_urls      TEXT[] NOT NULL DEFAULT '{}',
  is_demo         BOOLEAN NOT NULL DEFAULT true,
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---- 4. Targeted Announcement Locations -----------------------------------

CREATE TABLE IF NOT EXISTS public.announcement_locations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL REFERENCES public.authority_announcements(id) ON DELETE CASCADE,
  city_id         UUID NOT NULL REFERENCES public.geo_cities(id) ON DELETE CASCADE,
  village_id      UUID REFERENCES public.geo_villages(id) ON DELETE CASCADE,
  area_text       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---- 5. Multi-Tenant Scoped RBAC Grants ------------------------------------

CREATE TABLE IF NOT EXISTS public.authority_admin_grants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  department_id UUID REFERENCES public.authority_departments(id) ON DELETE CASCADE,
  city_id       UUID REFERENCES public.geo_cities(id) ON DELETE CASCADE,
  district_id   UUID REFERENCES public.geo_districts(id) ON DELETE CASCADE,
  can_publish   BOOLEAN NOT NULL DEFAULT true,
  can_edit      BOOLEAN NOT NULL DEFAULT true,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---- 6. Indexes for High Performance ---------------------------------------

CREATE INDEX IF NOT EXISTS idx_authority_orgs_city ON public.authority_organizations(city_id);
CREATE INDEX IF NOT EXISTS idx_authority_announcements_city_status ON public.authority_announcements(city_id, status);
CREATE INDEX IF NOT EXISTS idx_authority_announcements_dept ON public.authority_announcements(department_id);
CREATE INDEX IF NOT EXISTS idx_authority_announcements_priority ON public.authority_announcements(priority);
CREATE INDEX IF NOT EXISTS idx_announcement_locations_announcement ON public.announcement_locations(announcement_id);
CREATE INDEX IF NOT EXISTS idx_announcement_locations_village ON public.announcement_locations(village_id);
CREATE INDEX IF NOT EXISTS idx_authority_admin_grants_lookup ON public.authority_admin_grants(user_id, department_id, city_id);

-- ---- 7. Access Check Function ----------------------------------------------

CREATE OR REPLACE FUNCTION public.check_authority_admin_access(
  _user_id UUID,
  _department_id UUID,
  _city_id UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
BEGIN
  IF _user_id IS NULL THEN
    RETURN false;
  END IF;

  -- 1. Super admins always bypass
  IF public.has_role(_user_id, 'admin') THEN
    RETURN true;
  END IF;

  -- 2. Explicit department + geographic grant check
  RETURN EXISTS (
    SELECT 1 FROM public.authority_admin_grants
    WHERE user_id = _user_id
      AND is_active = true
      AND (department_id IS NULL OR department_id = _department_id)
      AND (city_id IS NULL OR city_id = _city_id)
  );
END;
$$;

-- ---- 8. Row Level Security Policies ---------------------------------------

ALTER TABLE public.authority_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.authority_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.authority_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.authority_admin_grants ENABLE ROW LEVEL SECURITY;

-- Departments: Public Read, Super Admin Write
DROP POLICY IF EXISTS "Public can view active departments" ON public.authority_departments;
CREATE POLICY "Public can view active departments"
  ON public.authority_departments FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "Admins can manage departments" ON public.authority_departments;
CREATE POLICY "Admins can manage departments"
  ON public.authority_departments FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Organizations: Public Read, Authorized Admin Write
DROP POLICY IF EXISTS "Public can view organizations" ON public.authority_organizations;
CREATE POLICY "Public can view organizations"
  ON public.authority_organizations FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins can manage organizations" ON public.authority_organizations;
CREATE POLICY "Admins can manage organizations"
  ON public.authority_organizations FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Announcements: Public Read (Active / Scheduled / Completed), Scoped Admin Write
DROP POLICY IF EXISTS "Public can view published announcements" ON public.authority_announcements;
CREATE POLICY "Public can view published announcements"
  ON public.authority_announcements FOR SELECT
  USING (
    status IN ('active', 'completed')
    OR (status = 'scheduled' AND published_at <= now())
    OR (auth.uid() IS NOT NULL AND public.check_authority_admin_access(auth.uid(), department_id, city_id))
  );

DROP POLICY IF EXISTS "Scoped admins can insert announcements" ON public.authority_announcements;
CREATE POLICY "Scoped admins can insert announcements"
  ON public.authority_announcements FOR INSERT
  TO authenticated
  WITH CHECK (public.check_authority_admin_access(auth.uid(), department_id, city_id));

DROP POLICY IF EXISTS "Scoped admins can update announcements" ON public.authority_announcements;
CREATE POLICY "Scoped admins can update announcements"
  ON public.authority_announcements FOR UPDATE
  TO authenticated
  USING (public.check_authority_admin_access(auth.uid(), department_id, city_id))
  WITH CHECK (public.check_authority_admin_access(auth.uid(), department_id, city_id));

DROP POLICY IF EXISTS "Scoped admins can delete announcements" ON public.authority_announcements;
CREATE POLICY "Scoped admins can delete announcements"
  ON public.authority_announcements FOR DELETE
  TO authenticated
  USING (public.check_authority_admin_access(auth.uid(), department_id, city_id));

-- Locations: Public Read, Admin Write
DROP POLICY IF EXISTS "Public can view announcement locations" ON public.announcement_locations;
CREATE POLICY "Public can view announcement locations"
  ON public.announcement_locations FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Scoped admins can manage locations" ON public.announcement_locations;
CREATE POLICY "Scoped admins can manage locations"
  ON public.announcement_locations FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.authority_announcements a
      WHERE a.id = announcement_id
        AND public.check_authority_admin_access(auth.uid(), a.department_id, a.city_id)
    )
  );

-- Grants: Self Read + Super Admin Full Access
DROP POLICY IF EXISTS "Users can view own grants" ON public.authority_admin_grants;
CREATE POLICY "Users can view own grants"
  ON public.authority_admin_grants FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Super admins can manage grants" ON public.authority_admin_grants;
CREATE POLICY "Super admins can manage grants"
  ON public.authority_admin_grants FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- PostgREST Table-Level Permissions (SEC-01)
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

-- ---- 9. Seed Baseline Departments -------------------------------------------

INSERT INTO public.authority_departments (slug, name, name_mr, icon, color_theme, sort_order)
VALUES
  ('water',       'Water Supply Department',         'पाणी पुरवठा विभाग',                'Droplets',  'blue',    1),
  ('electricity', 'Electricity Department (MSEDCL)', 'वीज वितरण विभाग (महावितरण)',       'Zap',       'amber',   2),
  ('municipal',   'Municipal Council & Local Body',   'नगरपंचायत व स्थानिक प्रशासन',       'Building2', 'emerald', 3)
ON CONFLICT (slug) DO UPDATE
SET
  name = EXCLUDED.name,
  name_mr = EXCLUDED.name_mr,
  icon = EXCLUDED.icon,
  color_theme = EXCLUDED.color_theme,
  sort_order = EXCLUDED.sort_order;

-- ---- 10. Seed Muktainagar Fictional Demo Organizations -----------------------

DO $$
DECLARE
  v_city_id UUID;
  v_dist_id UUID;
  v_dept_water UUID;
  v_dept_power UUID;
  v_dept_muni  UUID;
  v_org_water UUID;
  v_org_power UUID;
  v_org_muni  UUID;
BEGIN
  SELECT id INTO v_city_id FROM public.geo_cities WHERE slug = 'muktainagar' LIMIT 1;
  IF v_city_id IS NULL THEN
    RETURN;
  END IF;

  SELECT district_id INTO v_dist_id FROM public.geo_cities WHERE id = v_city_id;
  SELECT id INTO v_dept_water FROM public.authority_departments WHERE slug = 'water';
  SELECT id INTO v_dept_power FROM public.authority_departments WHERE slug = 'electricity';
  SELECT id INTO v_dept_muni  FROM public.authority_departments WHERE slug = 'municipal';

  -- Water Supply Demo Org
  INSERT INTO public.authority_organizations (
    department_ids, city_id, district_id, name, name_mr, office_address,
    helpline_phone, emergency_phone, whatsapp_number, email, is_demo, is_verified
  ) VALUES (
    ARRAY[v_dept_water], v_city_id, v_dist_id,
    'Muktainagar Water Services [DEMO SIMULATION]',
    'मुक्ताईनगर पाणी पुरवठा विभाग [डेमो सिम्युलेशन]',
    'Near Old Water Tank, Main Road, Muktainagar',
    '02583-222101', '9822001100', '919822001100', 'water-demo@apnalocal.in',
    true, false
  )
  RETURNING id INTO v_org_water;

  -- Power Demo Org
  INSERT INTO public.authority_organizations (
    department_ids, city_id, district_id, name, name_mr, office_address,
    helpline_phone, emergency_phone, whatsapp_number, email, is_demo, is_verified
  ) VALUES (
    ARRAY[v_dept_power], v_city_id, v_dist_id,
    'Muktainagar Electricity Sub-Division [DEMO SIMULATION]',
    'मुक्ताईनगर वीज वितरण उपविभाग [डेमो सिम्युलेशन]',
    'MSEDCL Substation, Malkapur Road, Muktainagar',
    '1912', '02583-222102', '919822001101', 'msedcl-demo@apnalocal.in',
    true, false
  )
  RETURNING id INTO v_org_power;

  -- Municipal Demo Org
  INSERT INTO public.authority_organizations (
    department_ids, city_id, district_id, name, name_mr, office_address,
    helpline_phone, emergency_phone, whatsapp_number, email, is_demo, is_verified
  ) VALUES (
    ARRAY[v_dept_muni], v_city_id, v_dist_id,
    'Muktainagar Municipal Council [DEMO SIMULATION]',
    'मुक्ताईनगर नगरपंचायत [डेमो सिम्युलेशन]',
    'Nagar Panchayat Administrative Complex, Shivaji Chowk, Muktainagar',
    '02583-222103', '9822001102', '919822001102', 'admin-demo@apnalocal.in',
    true, false
  )
  RETURNING id INTO v_org_muni;

  -- Seed Sample Announcements
  -- 1. Active Outage: Pipeline Maintenance
  INSERT INTO public.authority_announcements (
    org_id, department_id, city_id, title, title_mr,
    description, description_mr, category, priority, status,
    start_time, end_time, published_at, is_demo
  ) VALUES (
    v_org_water, v_dept_water, v_city_id,
    'Emergency Pipeline Repair at Station Road [DEMO]',
    'स्टेशन रोड येथे मुख्य जलवाहिनी दुरुस्ती काम [डेमो]',
    'Water supply will remain suspended for 4 hours due to urgent main conduit weld repair.',
    'मुख्य जलवाहिनीच्या तातडीच्या वेल्डिंग दुरुस्तीमुळे आज सकाळी ९ ते दुपारी १ पाणीपुरवठा बंद राहील.',
    'interruption', 'high', 'active',
    now() - INTERVAL '1 hour', now() + INTERVAL '3 hours', now(), true
  );

  -- 2. Scheduled: Power Feeder Servicing
  INSERT INTO public.authority_announcements (
    org_id, department_id, city_id, title, title_mr,
    description, description_mr, category, priority, status,
    start_time, end_time, published_at, is_demo
  ) VALUES (
    v_org_power, v_dept_power, v_city_id,
    'Scheduled Transformer & Feeder Maintenance [DEMO]',
    'ट्रान्सफॉर्मर व फिडरचे नियोजित देखभाल काम [डेमो]',
    'Routine pre-summer feeder maintenance across Ward 3 and College Road.',
    'उन्हाळापूर्व नियोजित देखभालीसाठी प्रभाग क्र. ३ आणि कॉलेज रोड परिसराचा वीजपुरवठा उद्या सकाळी १० ते दुपारी २ बंद राहील.',
    'maintenance', 'medium', 'scheduled',
    now() + INTERVAL '1 day', now() + INTERVAL '1 day 4 hours', now(), true
  );

  -- 3. Civic Advisory: Monsoon Pre-Cleaning
  INSERT INTO public.authority_announcements (
    org_id, department_id, city_id, title, title_mr,
    description, description_mr, category, priority, status,
    start_time, end_time, published_at, is_demo
  ) VALUES (
    v_org_muni, v_dept_muni, v_city_id,
    'Civic Drainage & Sanitation Drive Advisory [DEMO]',
    'नागरिक स्वच्छता व गटार उपसा मोहीम सूचना [डेमो]',
    'Municipal sanitation teams are carrying out deep drain desilting. Citizens are requested to park vehicles clearly.',
    'पावसाळापूर्व गटार उपसा व स्वच्छता मोहीम सुरू असून नागरिकांनी वाहने रस्त्यावर अडथळा निर्माण होणार नाही अशी लावावीत.',
    'advisory', 'low', 'active',
    now() - INTERVAL '2 days', now() + INTERVAL '5 days', now(), true
  );

END $$;
