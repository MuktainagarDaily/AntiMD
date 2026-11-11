-- ============================================================================
-- Muktainagar Daily — Bus Timetable patch (2026-06-27)
-- ----------------------------------------------------------------------------
-- Safe to re-run. Creates the admin-editable bus_timetable table for the
-- Muktainagar bus stand, with public read of active rows and admin-only writes.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.bus_timetable (
  id              uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  destination     text        NOT NULL,
  destination_mr  text            NULL,
  departure_times text[]      NOT NULL DEFAULT '{}'::text[],
  notes           text            NULL,
  sort_order      int         NOT NULL DEFAULT 0,
  is_active       boolean     NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Data API grants (required — Supabase does not grant public schema by default).
GRANT SELECT ON public.bus_timetable TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.bus_timetable TO authenticated;
GRANT ALL ON public.bus_timetable TO service_role;

ALTER TABLE public.bus_timetable ENABLE ROW LEVEL SECURITY;

-- Public can read active rows only.
DROP POLICY IF EXISTS "Bus timetable public read active" ON public.bus_timetable;
CREATE POLICY "Bus timetable public read active"
  ON public.bus_timetable FOR SELECT
  USING (is_active = true);

-- Admins can read everything (including inactive rows) for management.
DROP POLICY IF EXISTS "Bus timetable admin read all" ON public.bus_timetable;
CREATE POLICY "Bus timetable admin read all"
  ON public.bus_timetable FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Admin-only writes.
DROP POLICY IF EXISTS "Bus timetable admin insert" ON public.bus_timetable;
CREATE POLICY "Bus timetable admin insert"
  ON public.bus_timetable FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Bus timetable admin update" ON public.bus_timetable;
CREATE POLICY "Bus timetable admin update"
  ON public.bus_timetable FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Bus timetable admin delete" ON public.bus_timetable;
CREATE POLICY "Bus timetable admin delete"
  ON public.bus_timetable FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Auto-updated_at trigger (reuses existing function).
DROP TRIGGER IF EXISTS bus_timetable_updated_at ON public.bus_timetable;
CREATE TRIGGER bus_timetable_updated_at
  BEFORE UPDATE ON public.bus_timetable
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Helpful index for the public listing.
CREATE INDEX IF NOT EXISTS idx_bus_timetable_active_sort
  ON public.bus_timetable (is_active, sort_order, destination);

-- ----------------------------------------------------------------------------
-- Seed data — transcribed from the Muktainagar bus-stand timetable photo
-- (2026-06-27). Idempotent: only inserts if the destination doesn't exist.
-- ----------------------------------------------------------------------------
INSERT INTO public.bus_timetable (destination, departure_times, sort_order)
SELECT v.destination, v.times, v.sort_order
FROM (VALUES
  ('Akola',                        ARRAY['06:00','07:00','09:45','12:15','15:30','17:00'], 10),
  ('Amalner',                      ARRAY['17:45'], 20),
  ('Amravati',                     ARRAY['12:30','13:15'], 30),
  ('Bhusawal',                     ARRAY['05:00','07:15','09:30','15:30','15:45','16:00','17:15','18:45','19:00','21:00'], 40),
  ('Burhanpur',                    ARRAY['07:15','08:45','09:30','10:00','11:15','12:15','13:30','14:15','15:45','18:30','19:30'], 50),
  ('Chalisgaon',                   ARRAY['11:15'], 60),
  ('Chhatrapati Sambhaji Nagar',   ARRAY['05:30','07:15'], 70),
  ('Chikhli',                      ARRAY['12:30','14:30','14:45','15:30','17:15','19:30'], 80),
  ('Dhule',                        ARRAY['17:15'], 90),
  ('Gangakhed',                    ARRAY['06:45'], 100),
  ('Indore',                       ARRAY['09:15'], 110),
  ('Jalgaon',                      ARRAY['06:00','08:10','08:30','08:45','09:00','09:30','10:30','11:20','12:30','13:00','13:30','14:15','14:30','15:30','15:45','16:15','16:30','17:00','17:30','18:00','18:45'], 120),
  ('Kalamnuri',                    ARRAY['06:45'], 130),
  ('Karanja',                      ARRAY['12:15'], 140),
  ('Khamgaon',                     ARRAY['14:00','14:30'], 150),
  ('Mahurgad',                     ARRAY['09:00','10:15'], 160),
  ('Malegaon',                     ARRAY['07:00'], 170),
  ('Mangrulpir',                   ARRAY['13:00','18:00'], 180),
  ('Manmad',                       ARRAY['07:45'], 190),
  ('Mehkar',                       ARRAY['06:15','08:15','10:15','12:00','13:00','15:45','16:45','18:15'], 200),
  ('Nagpur',                       ARRAY['07:30','08:15','12:00'], 210),
  ('Nandurbar',                    ARRAY['13:45'], 220),
  ('Nandurgad',                    ARRAY['09:15','11:30'], 230),
  ('Nashik',                       ARRAY['10:15','10:30','10:45','12:00','12:30','12:40'], 240),
  ('Pandharpur',                   ARRAY['06:45'], 250),
  ('Paratwada',                    ARRAY['14:15'], 260),
  ('Pune',                         ARRAY['06:30','08:15'], 270),
  ('Pusad',                        ARRAY['08:15'], 280),
  ('Ralegaon',                     ARRAY['10:15'], 290),
  ('Sakri',                        ARRAY['05:30'], 300),
  ('Shegaon',                      ARRAY['07:30','15:45','16:15','16:30','17:00','17:15','18:30','18:45'], 310),
  ('Shirkhed',                     ARRAY['17:15'], 320),
  ('Shirdi',                       ARRAY['09:30','13:30'], 330),
  ('Thane',                        ARRAY['07:30','08:15'], 340),
  ('Yavatmal',                     ARRAY['07:45','12:15'], 350),
  ('Yawal',                        ARRAY['16:00','16:15'], 360)
) AS v(destination, times, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.bus_timetable t WHERE t.destination = v.destination
);

-- ============================================================================
-- END
-- ============================================================================