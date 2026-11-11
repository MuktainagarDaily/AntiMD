-- Fix generate_shop_slug: use explicit space instead of \s which strips letters
CREATE OR REPLACE FUNCTION public.generate_shop_slug(p_name TEXT, p_exclude_id UUID DEFAULT NULL)
RETURNS TEXT LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  base_slug TEXT;
  candidate TEXT;
  counter   INT := 0;
BEGIN
  base_slug := lower(trim(p_name));
  base_slug := regexp_replace(base_slug, '[^a-z0-9 -]', '', 'g');
  base_slug := regexp_replace(base_slug, '[ -]+', '-', 'g');
  base_slug := trim(base_slug, '-');
  IF base_slug = '' THEN base_slug := 'shop'; END IF;
  candidate := base_slug;
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.shops
      WHERE slug = candidate
        AND (p_exclude_id IS NULL OR id <> p_exclude_id)
    ) THEN RETURN candidate; END IF;
    counter := counter + 1;
    candidate := base_slug || '-' || counter;
  END LOOP;
END;$$;

-- Re-backfill all slugs with the fixed function
UPDATE public.shops SET slug = public.generate_shop_slug(name, id);