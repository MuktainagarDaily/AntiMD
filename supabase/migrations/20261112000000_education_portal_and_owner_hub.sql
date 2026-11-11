-- ============================================================================
-- Migration: 20261112000000_education_portal_and_owner_hub.sql
-- Description: Full Education & Institutes expansion:
--   1. Structured columns & SEO slugs on `public.schools` (admissions, fees,
--      management type, multi-mediums, scholarships, docs, bus routes, coaching
--      seats, verification & claimed flags) with non-destructive tag backfill.
--   2. `public.school_notices` (pinned admission/exam/holiday circulars).
--   3. `public.school_owners` & `public.school_claims` + admin RPCs + column
--      guard trigger preventing privilege escalation by non-admin owners.
--   4. `public.school_reviews`, `public.school_review_helpful`, &
--      `public.get_school_rating(uuid)` with anti-spam rate-limit triggers.
--   5. `public.school_engagement` (privacy-safe Call/WhatsApp/Maps tracking).
--
-- Safe & idempotent: re-runnable without losing existing data.
-- ============================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Expand `public.schools` schema
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS slug               text,
  ADD COLUMN IF NOT EXISTS address_mr         text,
  ADD COLUMN IF NOT EXISTS whatsapp           text,
  ADD COLUMN IF NOT EXISTS is_verified        boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_claimed         boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS management_type    text,
  ADD COLUMN IF NOT EXISTS gender_type        text NOT NULL DEFAULT 'coed',
  ADD COLUMN IF NOT EXISTS udise_aishe_code   text,
  ADD COLUMN IF NOT EXISTS established_year   integer,
  ADD COLUMN IF NOT EXISTS accreditation      text,
  ADD COLUMN IF NOT EXISTS board              text,
  ADD COLUMN IF NOT EXISTS classes_offered    text,
  ADD COLUMN IF NOT EXISTS mediums            text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS streams            text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS facilities         text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS principal_name     text,
  ADD COLUMN IF NOT EXISTS office_timing      text,
  ADD COLUMN IF NOT EXISTS admission_status   text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS admission_deadline date,
  ADD COLUMN IF NOT EXISTS admission_url      text,
  ADD COLUMN IF NOT EXISTS prospectus_url     text,
  ADD COLUMN IF NOT EXISTS fee_tier           text NOT NULL DEFAULT 'unspecified',
  ADD COLUMN IF NOT EXISTS annual_fee_min     numeric,
  ADD COLUMN IF NOT EXISTS annual_fee_max     numeric,
  ADD COLUMN IF NOT EXISTS scholarships       text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS required_documents text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS transport_villages text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS coaching_focus     text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS total_seats        integer,
  ADD COLUMN IF NOT EXISTS available_seats    integer,
  ADD COLUMN IF NOT EXISTS meta               jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Clean blank website strings before enforcing HTTP(S) check
UPDATE public.schools
SET website = NULL
WHERE website IS NOT NULL AND trim(website) = '';

-- Expand / enforce CHECK constraints safely
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'schools_school_type_check') THEN
    ALTER TABLE public.schools DROP CONSTRAINT schools_school_type_check;
  END IF;
  ALTER TABLE public.schools
    ADD CONSTRAINT schools_school_type_check
    CHECK (school_type IN (
      'primary','secondary','higher-secondary','college',
      'engineering-polytechnic','university','coaching','other'
    ));

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'schools_medium_check') THEN
    ALTER TABLE public.schools DROP CONSTRAINT schools_medium_check;
  END IF;
  ALTER TABLE public.schools
    ADD CONSTRAINT schools_medium_check
    CHECK (medium IS NULL OR medium IN (
      'marathi','english','semi-english','hindi','urdu','bilingual','other'
    ));

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'schools_management_type_check') THEN
    ALTER TABLE public.schools DROP CONSTRAINT schools_management_type_check;
  END IF;
  ALTER TABLE public.schools
    ADD CONSTRAINT schools_management_type_check
    CHECK (management_type IS NULL OR management_type IN ('government','govt','aided','private','trust'));

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'schools_gender_type_check') THEN
    ALTER TABLE public.schools
      ADD CONSTRAINT schools_gender_type_check
      CHECK (gender_type IN ('coed','boys','girls'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'schools_admission_status_check') THEN
    ALTER TABLE public.schools
      ADD CONSTRAINT schools_admission_status_check
      CHECK (admission_status IN ('open','ongoing','upcoming','closed','unknown'));
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'schools_fee_tier_check') THEN
    ALTER TABLE public.schools DROP CONSTRAINT schools_fee_tier_check;
  END IF;
  ALTER TABLE public.schools
    ADD CONSTRAINT schools_fee_tier_check
    CHECK (fee_tier IN ('free','low','budget','moderate','premium','unspecified'));

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'schools_website_http') THEN
    ALTER TABLE public.schools
      ADD CONSTRAINT schools_website_http
      CHECK (website IS NULL OR website ~* '^https?://');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'schools_admission_url_http') THEN
    ALTER TABLE public.schools
      ADD CONSTRAINT schools_admission_url_http
      CHECK (admission_url IS NULL OR admission_url ~* '^https?://');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'schools_prospectus_url_http') THEN
    ALTER TABLE public.schools
      ADD CONSTRAINT schools_prospectus_url_http
      CHECK (prospectus_url IS NULL OR prospectus_url ~* '^https?://');
  END IF;
END $$;

-- Unique partial index on slug & query indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_schools_slug_unique
  ON public.schools (slug) WHERE slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_schools_city_active
  ON public.schools (city_id, is_active);
CREATE INDEX IF NOT EXISTS idx_schools_admission_status
  ON public.schools (admission_status) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_schools_management_type
  ON public.schools (management_type) WHERE is_active = true;

-- Auto-slug helper & backfill for existing schools
CREATE OR REPLACE FUNCTION public.schools_auto_slug()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  base_slug text;
  candidate text;
  suffix    int := 1;
BEGIN
  IF NEW.slug IS NOT NULL AND trim(NEW.slug) <> '' THEN
    NEW.slug := lower(trim(regexp_replace(NEW.slug, '[^a-zA-Z0-9]+', '-', 'g'), '-'));
    RETURN NEW;
  END IF;

  base_slug := lower(trim(regexp_replace(coalesce(NEW.name, 'institute'), '[^a-zA-Z0-9]+', '-', 'g'), '-'));
  IF base_slug = '' THEN base_slug := 'institute'; END IF;
  base_slug := left(base_slug, 64);

  candidate := base_slug;
  WHILE EXISTS (
    SELECT 1 FROM public.schools s WHERE s.slug = candidate AND s.id <> NEW.id
  ) LOOP
    suffix := suffix + 1;
    candidate := base_slug || '-' || suffix::text;
  END LOOP;

  NEW.slug := candidate;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_schools_auto_slug ON public.schools;
CREATE TRIGGER trg_schools_auto_slug
  BEFORE INSERT ON public.schools
  FOR EACH ROW EXECUTE FUNCTION public.schools_auto_slug();

-- Backfill slugs on existing rows without slugs
DO $$
DECLARE
  rec record;
  base_slug text;
  candidate text;
  suffix int;
BEGIN
  FOR rec IN SELECT id, name FROM public.schools WHERE slug IS NULL OR trim(slug) = '' LOOP
    base_slug := lower(trim(regexp_replace(coalesce(rec.name, 'institute'), '[^a-zA-Z0-9]+', '-', 'g'), '-'));
    IF base_slug = '' THEN base_slug := 'institute'; END IF;
    base_slug := left(base_slug, 64);
    candidate := base_slug;
    suffix := 1;
    WHILE EXISTS (SELECT 1 FROM public.schools s WHERE s.slug = candidate AND s.id <> rec.id) LOOP
      suffix := suffix + 1;
      candidate := base_slug || '-' || suffix::text;
    END LOOP;
    UPDATE public.schools SET slug = candidate WHERE id = rec.id;
  END LOOP;
END $$;

-- Non-destructive backfill of legacy bracket tags into structured columns
DO $$
DECLARE
  rec record;
  m_type text[];
  m_board text[];
  m_streams text[];
  m_fac text[];
  m_princ text[];
  m_timing text[];
  resolved_type text;
BEGIN
  FOR rec IN
    SELECT id, school_type, medium, mediums, board, streams, facilities, principal_name, office_timing, description
    FROM public.schools
  LOOP
    resolved_type := rec.school_type;
    IF rec.description IS NOT NULL THEN
      m_type := regexp_match(rec.description, '\[Type:\s*([^\]]+)\]', 'i');
      IF m_type IS NOT NULL AND m_type[1] IN ('primary','secondary','higher-secondary','college','engineering-polytechnic','university','coaching','other') THEN
        resolved_type := m_type[1];
      END IF;

      m_board   := regexp_match(rec.description, '\[Board:\s*([^\]]+)\]', 'i');
      m_streams := regexp_match(rec.description, '\[Streams:\s*([^\]]+)\]', 'i');
      m_fac     := regexp_match(rec.description, '\[Facilities:\s*([^\]]+)\]', 'i');
      m_princ   := regexp_match(rec.description, '\[Principal:\s*([^\]]+)\]', 'i');
      m_timing  := regexp_match(rec.description, '\[Timing:\s*([^\]]+)\]', 'i');

      UPDATE public.schools
      SET
        school_type    = COALESCE(resolved_type, school_type),
        board          = COALESCE(board, CASE WHEN m_board IS NOT NULL THEN trim(m_board[1]) ELSE NULL END),
        streams        = CASE
                           WHEN coalesce(array_length(streams, 1), 0) = 0 AND m_streams IS NOT NULL
                           THEN (SELECT array_agg(trim(x)) FROM unnest(string_to_array(m_streams[1], ',')) AS x WHERE trim(x) <> '')
                           ELSE streams
                         END,
        facilities     = CASE
                           WHEN coalesce(array_length(facilities, 1), 0) = 0 AND m_fac IS NOT NULL
                           THEN (SELECT array_agg(trim(x)) FROM unnest(string_to_array(m_fac[1], ',')) AS x WHERE trim(x) <> '')
                           ELSE facilities
                         END,
        principal_name = COALESCE(principal_name, CASE WHEN m_princ IS NOT NULL THEN trim(m_princ[1]) ELSE NULL END),
        office_timing  = COALESCE(office_timing, CASE WHEN m_timing IS NOT NULL THEN trim(m_timing[1]) ELSE NULL END),
        mediums        = CASE
                           WHEN coalesce(array_length(mediums, 1), 0) = 0 AND medium IS NOT NULL
                           THEN ARRAY[medium]
                           ELSE mediums
                         END
      WHERE id = rec.id;
    ELSIF coalesce(array_length(rec.mediums, 1), 0) = 0 AND rec.medium IS NOT NULL THEN
      UPDATE public.schools SET mediums = ARRAY[rec.medium] WHERE id = rec.id;
    END IF;
  END LOOP;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. School Owners & Claims (`public.school_owners`, `public.school_claims`)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.school_owners (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id)   ON DELETE CASCADE,
  role_title  text NOT NULL DEFAULT 'Principal / Owner',
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_school_owners_user   ON public.school_owners(user_id);
CREATE INDEX IF NOT EXISTS idx_school_owners_school ON public.school_owners(school_id);

ALTER TABLE public.school_owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_owners REPLICA IDENTITY FULL;

DROP POLICY IF EXISTS "School owners read own ownership" ON public.school_owners;
CREATE POLICY "School owners read own ownership"
  ON public.school_owners FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins manage school_owners" ON public.school_owners;
CREATE POLICY "Admins manage school_owners"
  ON public.school_owners FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_owners TO authenticated;
GRANT ALL ON public.school_owners TO service_role;

-- Sync schools.is_claimed automatically without exposing school_owners UUIDs publicly
CREATE OR REPLACE FUNCTION public.sync_school_is_claimed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_id uuid;
BEGIN
  target_id := COALESCE(NEW.school_id, OLD.school_id);
  UPDATE public.schools
  SET is_claimed = EXISTS (
    SELECT 1 FROM public.school_owners so WHERE so.school_id = target_id
  )
  WHERE id = target_id;
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_school_owners_sync_claimed ON public.school_owners;
CREATE TRIGGER trg_school_owners_sync_claimed
  AFTER INSERT OR DELETE ON public.school_owners
  FOR EACH ROW EXECUTE FUNCTION public.sync_school_is_claimed();

-- Helper: is user an owner of a given school
CREATE OR REPLACE FUNCTION public.is_school_owner(_user_id uuid, _school_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.school_owners
    WHERE user_id = _user_id AND school_id = _school_id
  );
$$;

-- Owner update policy + column protection trigger on `public.schools`
CREATE OR REPLACE FUNCTION public.protect_school_admin_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Bypass for service_role / postgres migrations / true admins
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  IF NEW.is_active       IS DISTINCT FROM OLD.is_active
  OR NEW.is_verified     IS DISTINCT FROM OLD.is_verified
  OR NEW.is_claimed      IS DISTINCT FROM OLD.is_claimed
  OR NEW.city_id         IS DISTINCT FROM OLD.city_id
  OR NEW.district_id     IS DISTINCT FROM OLD.district_id
  OR NEW.state_id        IS DISTINCT FROM OLD.state_id
  OR NEW.slug            IS DISTINCT FROM OLD.slug
  OR (OLD.is_verified = true AND NEW.udise_aishe_code IS DISTINCT FROM OLD.udise_aishe_code) THEN
    RAISE EXCEPTION 'Only administrators may modify moderation, geographic, slug, or verified UDISE/AISHE fields.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_protect_school_admin_columns ON public.schools;
CREATE TRIGGER trg_protect_school_admin_columns
  BEFORE UPDATE ON public.schools
  FOR EACH ROW EXECUTE FUNCTION public.protect_school_admin_columns();

DROP POLICY IF EXISTS "School owners can read own schools" ON public.schools;
CREATE POLICY "School owners can read own schools"
  ON public.schools FOR SELECT TO authenticated
  USING (public.is_school_owner(auth.uid(), id));

DROP POLICY IF EXISTS "School owners can update own schools" ON public.schools;
CREATE POLICY "School owners can update own schools"
  ON public.schools FOR UPDATE TO authenticated
  USING (public.is_school_owner(auth.uid(), id))
  WITH CHECK (public.is_school_owner(auth.uid(), id));

-- School claims table
CREATE TABLE IF NOT EXISTS public.school_claims (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id        uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES auth.users(id)   ON DELETE CASCADE,
  contact_phone    text,
  role_claimed     text DEFAULT 'Principal / Owner',
  udise_or_id      text,
  proof_type       text,
  proof_image_path text,
  note             text,
  status           text NOT NULL DEFAULT 'pending',
  admin_notes      text,
  reviewed_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at      timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT school_claims_status_check
    CHECK (status IN ('pending','approved','rejected')),
  CONSTRAINT school_claims_proof_type_check
    CHECK (proof_type IS NULL OR proof_type IN (
      'udise_letter','govt_recognition','trust_registration','appointment_letter','school_board','aadhar_card','id_card','other'
    ))
);

CREATE INDEX IF NOT EXISTS idx_school_claims_status ON public.school_claims(status);
CREATE INDEX IF NOT EXISTS idx_school_claims_user   ON public.school_claims(user_id);
CREATE INDEX IF NOT EXISTS idx_school_claims_school ON public.school_claims(school_id);

ALTER TABLE public.school_claims ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_school_claims_updated_at ON public.school_claims;
CREATE TRIGGER trg_school_claims_updated_at
  BEFORE UPDATE ON public.school_claims
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.school_claims_rate_limit_check()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pending_user int;
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN RETURN NEW; END IF;

  IF EXISTS (
    SELECT 1 FROM public.school_claims
    WHERE school_id = NEW.school_id AND user_id = auth.uid() AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'You already have a pending claim for this institute.'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT count(*) INTO pending_user
  FROM public.school_claims
  WHERE user_id = auth.uid() AND status = 'pending';

  IF pending_user >= 5 THEN
    RAISE EXCEPTION 'Too many pending institute claims. Wait for review first.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_school_claims_rate_limit ON public.school_claims;
CREATE TRIGGER trg_school_claims_rate_limit
  BEFORE INSERT ON public.school_claims
  FOR EACH ROW EXECUTE FUNCTION public.school_claims_rate_limit_check();

DROP POLICY IF EXISTS "Users create own school claims" ON public.school_claims;
CREATE POLICY "Users create own school claims"
  ON public.school_claims FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

DROP POLICY IF EXISTS "Users read own or admin reads all school claims" ON public.school_claims;
CREATE POLICY "Users read own or admin reads all school claims"
  ON public.school_claims FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins update school claims" ON public.school_claims;
CREATE POLICY "Admins update school claims"
  ON public.school_claims FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins delete school claims" ON public.school_claims;
CREATE POLICY "Admins delete school claims"
  ON public.school_claims FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_claims TO authenticated;
GRANT ALL ON public.school_claims TO service_role;

-- Admin RPCs for assigning / revoking school ownership & reviewing claims
CREATE OR REPLACE FUNCTION public.assign_school_owner(
  _school_id uuid,
  _user_id uuid,
  _role_title text DEFAULT 'Principal / Owner'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  INSERT INTO public.school_owners (school_id, user_id, role_title, assigned_by)
  VALUES (_school_id, _user_id, COALESCE(NULLIF(trim(_role_title), ''), 'Principal / Owner'), auth.uid())
  ON CONFLICT (school_id, user_id) DO UPDATE SET role_title = EXCLUDED.role_title;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'shopkeeper')
  ON CONFLICT (user_id, role) DO NOTHING;
END $$;

CREATE OR REPLACE FUNCTION public.revoke_school_owner(_school_id uuid, _user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  remaining_schools int;
  remaining_shops   int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  DELETE FROM public.school_owners WHERE school_id = _school_id AND user_id = _user_id;

  SELECT COUNT(*) INTO remaining_schools FROM public.school_owners WHERE user_id = _user_id;
  SELECT COUNT(*) INTO remaining_shops   FROM public.shop_owners   WHERE user_id = _user_id;

  IF remaining_schools = 0 AND remaining_shops = 0 THEN
    DELETE FROM public.user_roles WHERE user_id = _user_id AND role = 'shopkeeper';
  END IF;
END $$;

-- Keep revoke_shop_owner aware of school_owners too so a dual-owner doesn't lose 'shopkeeper' role
CREATE OR REPLACE FUNCTION public.revoke_shop_owner(_shop_id uuid, _user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  remaining_shops   int;
  remaining_schools int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  DELETE FROM public.shop_owners WHERE shop_id = _shop_id AND user_id = _user_id;

  SELECT COUNT(*) INTO remaining_shops   FROM public.shop_owners   WHERE user_id = _user_id;
  SELECT COUNT(*) INTO remaining_schools FROM public.school_owners WHERE user_id = _user_id;

  IF remaining_shops = 0 AND remaining_schools = 0 THEN
    DELETE FROM public.user_roles WHERE user_id = _user_id AND role = 'shopkeeper';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.approve_school_claim(_claim_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c public.school_claims%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  SELECT * INTO c FROM public.school_claims WHERE id = _claim_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Claim not found'; END IF;
  IF c.status <> 'pending' THEN RAISE EXCEPTION 'Claim already %', c.status; END IF;

  PERFORM public.assign_school_owner(c.school_id, c.user_id, c.role_claimed);

  UPDATE public.school_claims
  SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
  WHERE id = _claim_id;
END $$;

CREATE OR REPLACE FUNCTION public.reject_school_claim(_claim_id uuid, _notes text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  UPDATE public.school_claims
  SET status = 'rejected', admin_notes = _notes,
      reviewed_by = auth.uid(), reviewed_at = now()
  WHERE id = _claim_id AND status = 'pending';

  IF NOT FOUND THEN RAISE EXCEPTION 'Claim not found or not pending'; END IF;
END $$;

REVOKE ALL ON FUNCTION public.assign_school_owner(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revoke_school_owner(uuid, uuid)       FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revoke_shop_owner(uuid, uuid)         FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approve_school_claim(uuid)            FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reject_school_claim(uuid, text)       FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.assign_school_owner(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_school_owner(uuid, uuid)       TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_shop_owner(uuid, uuid)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_school_claim(uuid)            TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_school_claim(uuid, text)       TO authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Live School Notices & Circulars (`public.school_notices`)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.school_notices (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id      uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  title          text NOT NULL CHECK (char_length(trim(title)) BETWEEN 2 AND 160),
  title_mr       text,
  body           text NOT NULL DEFAULT '' CHECK (char_length(body) <= 1500),
  body_mr        text,
  category       text NOT NULL DEFAULT 'admission'
                   CHECK (category IN ('admission','exam','scholarship','holiday','event','achievement','general')),
  is_pinned      boolean NOT NULL DEFAULT false,
  is_active      boolean NOT NULL DEFAULT true,
  expires_at     timestamptz,
  attachment_url text CHECK (attachment_url IS NULL OR attachment_url ~* '^https?://'),
  created_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.school_notices
  ADD COLUMN IF NOT EXISTS body_mr   text,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_school_notices_school_pinned
  ON public.school_notices (school_id, is_pinned DESC, created_at DESC);

DROP TRIGGER IF EXISTS trg_school_notices_updated_at ON public.school_notices;
CREATE TRIGGER trg_school_notices_updated_at
  BEFORE UPDATE ON public.school_notices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.school_notices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "School notices readable for active schools" ON public.school_notices;
CREATE POLICY "School notices readable for active schools"
  ON public.school_notices FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.is_school_owner(auth.uid(), school_id)
    OR (
      is_active = true
      AND EXISTS (
        SELECT 1 FROM public.schools s
        WHERE s.id = school_notices.school_id AND s.is_active = true
      )
    )
  );

DROP POLICY IF EXISTS "Owners or admins insert school notices" ON public.school_notices;
CREATE POLICY "Owners or admins insert school notices"
  ON public.school_notices FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.is_school_owner(auth.uid(), school_id)
  );

DROP POLICY IF EXISTS "Owners or admins update school notices" ON public.school_notices;
CREATE POLICY "Owners or admins update school notices"
  ON public.school_notices FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.is_school_owner(auth.uid(), school_id)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.is_school_owner(auth.uid(), school_id)
  );

DROP POLICY IF EXISTS "Owners or admins delete school notices" ON public.school_notices;
CREATE POLICY "Owners or admins delete school notices"
  ON public.school_notices FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.is_school_owner(auth.uid(), school_id)
  );

GRANT SELECT ON public.school_notices TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.school_notices TO authenticated;
GRANT ALL ON public.school_notices TO service_role;

-- ────────────────────────────────────────────────────────────────────────────
-- 4. School Reviews & Helpful Votes (`school_reviews`, `school_review_helpful`)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.school_reviews (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES auth.users(id)   ON DELETE CASCADE,
  rating        smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body          text NOT NULL DEFAULT '' CHECK (char_length(body) <= 2000),
  helpful_count int  NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT school_reviews_unique_per_user UNIQUE (school_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_school_reviews_school_created
  ON public.school_reviews (school_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_school_reviews_user
  ON public.school_reviews (user_id);

ALTER TABLE public.school_reviews ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_school_reviews_updated_at ON public.school_reviews;
CREATE TRIGGER trg_school_reviews_updated_at
  BEFORE UPDATE ON public.school_reviews
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Anti-spam rate limit: max 5 school reviews per 24h (admins exempt)
CREATE OR REPLACE FUNCTION public.school_reviews_rate_limit_check()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent int;
BEGIN
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO recent
  FROM public.school_reviews
  WHERE user_id = NEW.user_id
    AND created_at > now() - interval '24 hours';

  IF recent >= 5 THEN
    RAISE EXCEPTION 'Daily review limit reached (max 5 institute reviews per 24 hours).'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_school_reviews_rate_limit ON public.school_reviews;
CREATE TRIGGER trg_school_reviews_rate_limit
  BEFORE INSERT ON public.school_reviews
  FOR EACH ROW EXECUTE FUNCTION public.school_reviews_rate_limit_check();

DROP POLICY IF EXISTS "School reviews are public" ON public.school_reviews;
CREATE POLICY "School reviews are public"
  ON public.school_reviews FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users insert own school review" ON public.school_reviews;
CREATE POLICY "Users insert own school review"
  ON public.school_reviews FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own school review" ON public.school_reviews;
CREATE POLICY "Users update own school review"
  ON public.school_reviews FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own school review" ON public.school_reviews;
CREATE POLICY "Users delete own school review"
  ON public.school_reviews FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT ON public.school_reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_reviews TO authenticated;
GRANT ALL ON public.school_reviews TO service_role;

-- Helpful votes
CREATE TABLE IF NOT EXISTS public.school_review_helpful (
  review_id  uuid NOT NULL REFERENCES public.school_reviews(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id)           ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (review_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_school_review_helpful_user
  ON public.school_review_helpful (user_id);

ALTER TABLE public.school_review_helpful ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "School helpful votes readable by owner" ON public.school_review_helpful;
CREATE POLICY "School helpful votes readable by owner"
  ON public.school_review_helpful FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users add school helpful vote" ON public.school_review_helpful;
CREATE POLICY "Users add school helpful vote"
  ON public.school_review_helpful FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users remove school helpful vote" ON public.school_review_helpful;
CREATE POLICY "Users remove school helpful vote"
  ON public.school_review_helpful FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, DELETE ON public.school_review_helpful TO authenticated;
GRANT ALL ON public.school_review_helpful TO service_role;

CREATE OR REPLACE FUNCTION public.school_review_helpful_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.school_reviews SET helpful_count = helpful_count + 1 WHERE id = NEW.review_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.school_reviews SET helpful_count = GREATEST(helpful_count - 1, 0) WHERE id = OLD.review_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_school_review_helpful_ins ON public.school_review_helpful;
DROP TRIGGER IF EXISTS trg_school_review_helpful_del ON public.school_review_helpful;
CREATE TRIGGER trg_school_review_helpful_ins
  AFTER INSERT ON public.school_review_helpful
  FOR EACH ROW EXECUTE FUNCTION public.school_review_helpful_sync();
CREATE TRIGGER trg_school_review_helpful_del
  AFTER DELETE ON public.school_review_helpful
  FOR EACH ROW EXECUTE FUNCTION public.school_review_helpful_sync();

-- Rating aggregate RPC
CREATE OR REPLACE FUNCTION public.get_school_rating(_school_id uuid)
RETURNS TABLE (
  average numeric,
  count   bigint,
  d5 bigint, d4 bigint, d3 bigint, d2 bigint, d1 bigint
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    COALESCE(ROUND(AVG(rating)::numeric, 1), 0),
    COUNT(*)::bigint,
    COUNT(*) FILTER (WHERE rating = 5)::bigint,
    COUNT(*) FILTER (WHERE rating = 4)::bigint,
    COUNT(*) FILTER (WHERE rating = 3)::bigint,
    COUNT(*) FILTER (WHERE rating = 2)::bigint,
    COUNT(*) FILTER (WHERE rating = 1)::bigint
  FROM public.school_reviews
  WHERE school_id = _school_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_school_rating(uuid) TO anon, authenticated;

-- Batch summary helper for Schools directory list cards
CREATE OR REPLACE FUNCTION public.get_schools_rating_summary(_school_ids uuid[])
RETURNS TABLE (
  school_id uuid,
  average   numeric,
  count     bigint
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    school_id,
    COALESCE(ROUND(AVG(rating)::numeric, 1), 0) AS average,
    COUNT(*)::bigint AS count
  FROM public.school_reviews
  WHERE school_id = ANY(_school_ids)
  GROUP BY school_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_schools_rating_summary(uuid[]) TO anon, authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 5. School Engagement Analytics (`public.school_engagement`)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.school_engagement (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id  uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('call','whatsapp','website','maps','prospectus')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_school_engagement_school_created
  ON public.school_engagement (school_id, created_at DESC);

ALTER TABLE public.school_engagement ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.school_engagement_rate_limit_check()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent int;
BEGIN
  IF auth.uid() IS NOT NULL THEN RETURN NEW; END IF;

  SELECT count(*) INTO recent
  FROM public.school_engagement
  WHERE school_id  = NEW.school_id
    AND event_type = NEW.event_type
    AND created_at > now() - interval '1 minute';

  IF recent >= 20 THEN
    RAISE EXCEPTION 'Rate limit: too many engagement events for this institute.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_school_engagement_rate_limit ON public.school_engagement;
CREATE TRIGGER trg_school_engagement_rate_limit
  BEFORE INSERT ON public.school_engagement
  FOR EACH ROW EXECUTE FUNCTION public.school_engagement_rate_limit_check();

DROP POLICY IF EXISTS "Anyone can log school engagement" ON public.school_engagement;
CREATE POLICY "Anyone can log school engagement"
  ON public.school_engagement FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Only school owners or admins read engagement" ON public.school_engagement;
CREATE POLICY "Only school owners or admins read engagement"
  ON public.school_engagement FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.is_school_owner(auth.uid(), school_id)
  );

-- Strictly no anonymous SELECT on analytics
GRANT INSERT ON public.school_engagement TO anon;
GRANT SELECT, INSERT ON public.school_engagement TO authenticated;
GRANT ALL ON public.school_engagement TO service_role;

COMMIT;
