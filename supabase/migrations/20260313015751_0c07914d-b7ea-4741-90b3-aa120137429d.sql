
-- 1. Add slug column (nullable first so trigger can backfill)
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS slug TEXT;

-- 2. Slug generation function — handles collision by appending -1, -2, ...
CREATE OR REPLACE FUNCTION public.generate_shop_slug(p_name TEXT, p_exclude_id UUID DEFAULT NULL)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  base_slug TEXT;
  candidate TEXT;
  counter   INT := 0;
BEGIN
  -- Lowercase, strip non-alphanum/space/hyphen, collapse whitespace → hyphens
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
    ) THEN
      RETURN candidate;
    END IF;
    counter   := counter + 1;
    candidate := base_slug || '-' || counter;
  END LOOP;
END;$$;

-- 3. Trigger function — sets slug on insert or when name changes
CREATE OR REPLACE FUNCTION public.set_shop_slug()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = ''
     OR (TG_OP = 'UPDATE' AND NEW.name IS DISTINCT FROM OLD.name AND NEW.slug = OLD.slug) THEN
    NEW.slug := public.generate_shop_slug(NEW.name, NEW.id);
  END IF;
  RETURN NEW;
END;$$;

-- 4. Attach trigger
DROP TRIGGER IF EXISTS trg_shop_slug ON public.shops;
CREATE TRIGGER trg_shop_slug
  BEFORE INSERT OR UPDATE ON public.shops
  FOR EACH ROW EXECUTE FUNCTION public.set_shop_slug();

-- 5. Backfill existing rows (set slug = NULL so trigger regenerates)
UPDATE public.shops SET slug = NULL WHERE slug IS NULL OR slug = '';

-- 6. Now enforce NOT NULL + uniqueness
ALTER TABLE public.shops ALTER COLUMN slug SET NOT NULL;
ALTER TABLE public.shops DROP CONSTRAINT IF EXISTS shops_slug_unique;
ALTER TABLE public.shops ADD CONSTRAINT shops_slug_unique UNIQUE (slug);
