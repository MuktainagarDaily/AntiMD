-- ============================================================================
-- Muktainagar Daily — Bus stand location patch (2026-06-27)
-- ----------------------------------------------------------------------------
-- Extends `public.bus_stand_info` with an admin-editable address and
-- Google Maps URL so the Bus Timetable can render an "Open on Google Maps"
-- button alongside the click-to-call action. Safe to re-run.
-- ============================================================================

ALTER TABLE public.bus_stand_info
  ADD COLUMN IF NOT EXISTS address  text NULL,
  ADD COLUMN IF NOT EXISTS maps_url text NULL;

-- Seed sensible defaults for the single row (id = 1) without clobbering any
-- value an admin may already have set.
INSERT INTO public.bus_stand_info (id, address, maps_url)
VALUES (
  1,
  'Muktainagar Bus Stand, Muktainagar, Jalgaon, Maharashtra 425306',
  'https://www.google.com/maps/search/?api=1&query=Muktainagar+Bus+Stand'
)
ON CONFLICT (id) DO UPDATE
  SET address  = COALESCE(public.bus_stand_info.address,  EXCLUDED.address),
      maps_url = COALESCE(public.bus_stand_info.maps_url, EXCLUDED.maps_url);

-- ============================================================================
-- END
-- ============================================================================
