-- ============================================================================
-- 2026-06-01  i18n: English + Marathi support
-- ============================================================================
-- Adds:
--   • profiles.locale  (per-user language preference)
--   • shop_translations      (mr translations for shops; en stays on base row)
--   • category_translations  (mr translations for categories)
--   • amenity_translations   (en + mr labels for amenity keys)
-- All translation tables have public-read RLS (gated by shop visibility for shops)
-- and admin-only write RLS.
-- ============================================================================

-- 1. User locale preference -------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT 'en'
    CHECK (locale IN ('en','mr'));

-- 2. Shop translations ------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shop_translations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  locale      text NOT NULL CHECK (locale IN ('mr')), -- en lives on shops
  name        text,
  description text,
  address     text,
  area        text,
  sub_area    text,
  keywords    text,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, locale)
);
CREATE INDEX IF NOT EXISTS shop_translations_locale_idx
  ON public.shop_translations (locale);
CREATE INDEX IF NOT EXISTS shop_translations_shop_idx
  ON public.shop_translations (shop_id);

GRANT SELECT ON public.shop_translations TO anon, authenticated;
GRANT ALL    ON public.shop_translations TO service_role;
ALTER TABLE public.shop_translations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read shop translations" ON public.shop_translations;
CREATE POLICY "public read shop translations"
  ON public.shop_translations FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.shops s
                 WHERE s.id = shop_id AND s.is_active = true));

DROP POLICY IF EXISTS "admins manage shop translations" ON public.shop_translations;
CREATE POLICY "admins manage shop translations"
  ON public.shop_translations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 3. Category translations --------------------------------------------------
CREATE TABLE IF NOT EXISTS public.category_translations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id  uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  locale       text NOT NULL CHECK (locale IN ('mr')),
  name         text NOT NULL,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category_id, locale)
);
CREATE INDEX IF NOT EXISTS category_translations_locale_idx
  ON public.category_translations (locale);

GRANT SELECT ON public.category_translations TO anon, authenticated;
GRANT ALL    ON public.category_translations TO service_role;
ALTER TABLE public.category_translations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read category translations" ON public.category_translations;
CREATE POLICY "public read category translations"
  ON public.category_translations FOR SELECT USING (true);

DROP POLICY IF EXISTS "admins manage category translations" ON public.category_translations;
CREATE POLICY "admins manage category translations"
  ON public.category_translations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 4. Amenity translations ---------------------------------------------------
CREATE TABLE IF NOT EXISTS public.amenity_translations (
  amenity_key text NOT NULL,
  locale      text NOT NULL CHECK (locale IN ('en','mr')),
  label       text NOT NULL,
  PRIMARY KEY (amenity_key, locale)
);

GRANT SELECT ON public.amenity_translations TO anon, authenticated;
GRANT ALL    ON public.amenity_translations TO service_role;
ALTER TABLE public.amenity_translations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read amenity translations" ON public.amenity_translations;
CREATE POLICY "public read amenity translations"
  ON public.amenity_translations FOR SELECT USING (true);

DROP POLICY IF EXISTS "admins manage amenity translations" ON public.amenity_translations;
CREATE POLICY "admins manage amenity translations"
  ON public.amenity_translations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 5. Seed common amenities --------------------------------------------------
INSERT INTO public.amenity_translations (amenity_key, locale, label) VALUES
  ('parking','en','Parking'),            ('parking','mr','पार्किंग'),
  ('ac','en','AC'),                      ('ac','mr','एसी'),
  ('wifi','en','Wi-Fi'),                 ('wifi','mr','वाय-फाय'),
  ('card','en','Card Payment'),          ('card','mr','कार्ड पेमेंट'),
  ('upi','en','UPI'),                    ('upi','mr','यूपीआय'),
  ('home_delivery','en','Home Delivery'),('home_delivery','mr','होम डिलिव्हरी')
ON CONFLICT (amenity_key, locale) DO NOTHING;

-- 6. Auto-update updated_at -------------------------------------------------
DROP TRIGGER IF EXISTS trg_shop_translations_updated_at ON public.shop_translations;
CREATE TRIGGER trg_shop_translations_updated_at
  BEFORE UPDATE ON public.shop_translations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_category_translations_updated_at ON public.category_translations;
CREATE TRIGGER trg_category_translations_updated_at
  BEFORE UPDATE ON public.category_translations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
