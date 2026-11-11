-- ============================================================================
-- Muktainagar Daily — Bus stand contact patch (2026-06-27)
-- ----------------------------------------------------------------------------
-- Adds an admin-editable phone number for the Muktainagar bus stand so the
-- public Bus Timetable page can offer a click-to-call button (no hardcoding).
-- Safe to re-run.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.bus_stand_info (
  id          int         NOT NULL DEFAULT 1 PRIMARY KEY,
  phone       text            NULL,
  notes       text            NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bus_stand_info_single_row CHECK (id = 1)
);

-- Data API grants.
GRANT SELECT ON public.bus_stand_info TO anon, authenticated;
GRANT INSERT, UPDATE ON public.bus_stand_info TO authenticated;
GRANT ALL ON public.bus_stand_info TO service_role;

ALTER TABLE public.bus_stand_info ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Bus stand info public read" ON public.bus_stand_info;
CREATE POLICY "Bus stand info public read"
  ON public.bus_stand_info FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Bus stand info admin upsert" ON public.bus_stand_info;
CREATE POLICY "Bus stand info admin upsert"
  ON public.bus_stand_info FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Bus stand info admin update" ON public.bus_stand_info;
CREATE POLICY "Bus stand info admin update"
  ON public.bus_stand_info FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- updated_at trigger (reuse existing helper).
DROP TRIGGER IF EXISTS bus_stand_info_updated_at ON public.bus_stand_info;
CREATE TRIGGER bus_stand_info_updated_at
  BEFORE UPDATE ON public.bus_stand_info
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed the single row with the current bus-stand number.
INSERT INTO public.bus_stand_info (id, phone)
VALUES (1, '02583234225')
ON CONFLICT (id) DO UPDATE
  SET phone = COALESCE(public.bus_stand_info.phone, EXCLUDED.phone);

-- ============================================================================
-- END
-- ============================================================================
