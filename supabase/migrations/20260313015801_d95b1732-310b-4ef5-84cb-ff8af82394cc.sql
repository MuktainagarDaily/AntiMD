
-- Fix search_path security warnings on the two new functions
CREATE OR REPLACE FUNCTION public.generate_shop_slug(p_name TEXT, p_exclude_id UUID DEFAULT NULL)
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  base_slug TEXT;
  candidate TEXT;
  counter   INT := 0;
BEGIN
  base_slug := lower(trim(p_name));
  base_slug := regexp_replace(base_slug, '[^a-z0-9\s\-]', '', 'g');
  base_slug := regexp_replace(base_slug, '[\s\-]+', '-', 'g');
  base_slug := trim(base_slug, '-');
  IF base_slug = '' THEN base_slug := 'shop'; END IF;
  candidate := base_slug;
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.shops
      WHERE slug = candidate
        AND (p_exclude_id IS NULL OR id <> p_exclude_id)
    ) THEN RETURN candidate; END IF;
    counter   := counter + 1;
    candidate := base_slug || '-' || counter;
  END LOOP;
END;$$;

CREATE OR REPLACE FUNCTION public.set_shop_slug()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = ''
     OR (TG_OP = 'UPDATE' AND NEW.name IS DISTINCT FROM OLD.name AND NEW.slug = OLD.slug) THEN
    NEW.slug := public.generate_shop_slug(NEW.name, NEW.id);
  END IF;
  RETURN NEW;
END;$$;
