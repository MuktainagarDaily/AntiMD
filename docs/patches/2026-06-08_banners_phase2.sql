-- =====================================================================
-- Patch: 2026-06-08 — Banner ads phase 2 (DB wireup)
-- =====================================================================
-- Creates the persistent `banners` table that replaces the phase-1
-- localStorage prototype. Public reads are limited to live banners by
-- RLS; admin writes are gated through `has_role(auth.uid(),'admin')`.
-- Public view/click counters use SECURITY DEFINER RPCs so anon users
-- can record engagement without write access to the table.
--
-- Storage: banner image files are uploaded to the existing public
-- `shop-images` bucket with a `banner-` filename prefix, so no new
-- storage bucket or RLS is required.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  image_url text NOT NULL,
  target_url text NOT NULL,
  placement text NOT NULL CHECK (placement IN ('popup','homepage_inline','shops_inline','category_inline')),
  is_active boolean NOT NULL DEFAULT true,
  popup_delay_seconds int NOT NULL DEFAULT 0 CHECK (popup_delay_seconds BETWEEN 0 AND 60),
  close_enable_seconds int NOT NULL DEFAULT 0 CHECK (close_enable_seconds BETWEEN 0 AND 60),
  start_date date,
  end_date date,
  view_count int NOT NULL DEFAULT 0,
  click_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.banners TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.banners TO authenticated;
GRANT ALL ON public.banners TO service_role;

ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read live banners" ON public.banners;
CREATE POLICY "Public can read live banners"
  ON public.banners FOR SELECT
  TO anon, authenticated
  USING (
    is_active
    AND (start_date IS NULL OR start_date <= CURRENT_DATE)
    AND (end_date   IS NULL OR end_date   >= CURRENT_DATE)
  );

DROP POLICY IF EXISTS "Admins can read all banners" ON public.banners;
CREATE POLICY "Admins can read all banners"
  ON public.banners FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can insert banners" ON public.banners;
CREATE POLICY "Admins can insert banners"
  ON public.banners FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update banners" ON public.banners;
CREATE POLICY "Admins can update banners"
  ON public.banners FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete banners" ON public.banners;
CREATE POLICY "Admins can delete banners"
  ON public.banners FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS banners_set_updated_at ON public.banners;
CREATE TRIGGER banners_set_updated_at
  BEFORE UPDATE ON public.banners
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_banners_placement_active ON public.banners (placement, is_active);
CREATE INDEX IF NOT EXISTS idx_banners_updated_at       ON public.banners (updated_at DESC);

-- Public counters
CREATE OR REPLACE FUNCTION public.increment_banner_view(_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.banners SET view_count = view_count + 1 WHERE id = _id;
$$;

CREATE OR REPLACE FUNCTION public.increment_banner_click(_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.banners SET click_count = click_count + 1 WHERE id = _id;
$$;

GRANT EXECUTE ON FUNCTION public.increment_banner_view(uuid)  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_banner_click(uuid) TO anon, authenticated;
