
CREATE TABLE public.banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  image_url text NOT NULL,
  target_url text NOT NULL,
  placement text NOT NULL CHECK (placement IN ('popup','homepage_inline','shops_inline','category_inline')),
  is_active boolean NOT NULL DEFAULT true,
  popup_delay_seconds int NOT NULL DEFAULT 0 CHECK (popup_delay_seconds >= 0 AND popup_delay_seconds <= 60),
  close_enable_seconds int NOT NULL DEFAULT 0 CHECK (close_enable_seconds >= 0 AND close_enable_seconds <= 60),
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

-- Public can read only live banners
CREATE POLICY "Public can read live banners"
  ON public.banners FOR SELECT
  TO anon, authenticated
  USING (
    is_active
    AND (start_date IS NULL OR start_date <= CURRENT_DATE)
    AND (end_date   IS NULL OR end_date   >= CURRENT_DATE)
  );

-- Admins can read all (including inactive/expired)
CREATE POLICY "Admins can read all banners"
  ON public.banners FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert banners"
  ON public.banners FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update banners"
  ON public.banners FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete banners"
  ON public.banners FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER banners_set_updated_at
  BEFORE UPDATE ON public.banners
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_banners_placement_active ON public.banners (placement, is_active);
CREATE INDEX idx_banners_updated_at ON public.banners (updated_at DESC);

-- Safe public counters (bypass RLS via SECURITY DEFINER)
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
