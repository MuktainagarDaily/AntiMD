-- Muktainagar Daily — Schools section (Forge Phase 4 · Entity Framework)
--
-- Adds a new public entity `schools` following the same conventions as
-- `shops`: RLS with public read of active rows, admin-only writes, a
-- `set_updated_at` trigger for optimistic-concurrency compatibility.
--
-- Safe to re-run: uses IF NOT EXISTS / CREATE OR REPLACE / DO blocks.
--
-- Rollback (if ever needed):
--   DROP TABLE IF EXISTS public.schools CASCADE;

-- ─────────────────────────────────────────────────────────────
-- 1) Table
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.schools (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL,
  name_mr        text,
  school_type    text NOT NULL DEFAULT 'other'
                   CHECK (school_type IN ('primary','secondary','higher-secondary','college','other')),
  medium         text
                   CHECK (medium IS NULL OR medium IN ('marathi','english','semi-english','other')),
  area           text,
  sub_area       text,
  address        text,
  phone          text,
  email          text,
  website        text,
  description    text,
  image_url      text,
  latitude       numeric,
  longitude      numeric,
  is_active      boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS schools_active_idx     ON public.schools (is_active);
CREATE INDEX IF NOT EXISTS schools_created_at_idx ON public.schools (created_at DESC);
CREATE INDEX IF NOT EXISTS schools_type_idx       ON public.schools (school_type);
CREATE INDEX IF NOT EXISTS schools_area_idx       ON public.schools (area);

-- ─────────────────────────────────────────────────────────────
-- 2) Grants — REQUIRED (PostgREST does not grant public defaults)
-- ─────────────────────────────────────────────────────────────
GRANT SELECT                         ON public.schools TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schools TO authenticated;
GRANT ALL                            ON public.schools TO service_role;

-- ─────────────────────────────────────────────────────────────
-- 3) Row-Level Security
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;

-- Public read of active rows only (matches shops policy).
DROP POLICY IF EXISTS "Schools are viewable when active" ON public.schools;
CREATE POLICY "Schools are viewable when active"
  ON public.schools
  FOR SELECT
  USING (is_active = true);

-- Admins may read every row (including inactive) via the has_role SECURITY DEFINER.
DROP POLICY IF EXISTS "Admins can read all schools" ON public.schools;
CREATE POLICY "Admins can read all schools"
  ON public.schools
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Admin-only writes.
DROP POLICY IF EXISTS "Admins can insert schools" ON public.schools;
CREATE POLICY "Admins can insert schools"
  ON public.schools
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update schools" ON public.schools;
CREATE POLICY "Admins can update schools"
  ON public.schools
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete schools" ON public.schools;
CREATE POLICY "Admins can delete schools"
  ON public.schools
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ─────────────────────────────────────────────────────────────
-- 4) updated_at trigger (re-uses the shared set_updated_at() function
--    already installed by earlier patches).
-- ─────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS schools_set_updated_at ON public.schools;
CREATE TRIGGER schools_set_updated_at
  BEFORE UPDATE ON public.schools
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Full REPLICA IDENTITY so future realtime UPDATE payloads carry the whole row.
ALTER TABLE public.schools REPLICA IDENTITY FULL;
