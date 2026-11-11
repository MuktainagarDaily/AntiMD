-- 2026-10-25: Fix shop insert trigger permissions & security definer definitions
CREATE OR REPLACE FUNCTION public.generate_shop_slug(p_name TEXT, p_exclude_id UUID DEFAULT NULL)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  base_slug TEXT;
  candidate TEXT;
  counter   INT := 0;
BEGIN
  base_slug := lower(trim(coalesce(p_name, 'shop')));
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
    ) THEN
      RETURN candidate;
    END IF;
    counter := counter + 1;
    candidate := base_slug || '-' || counter;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_shop_slug()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.slug IS NULL OR trim(NEW.slug) = '' OR
     (TG_OP = 'UPDATE' AND NEW.name IS DISTINCT FROM OLD.name AND NEW.slug = OLD.slug) THEN
    NEW.slug := public.generate_shop_slug(NEW.name, NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_shop_slug(text, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.set_shop_slug()                TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.set_updated_at()               TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.shops_owner_column_guard()     TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_shop_claim_status()   TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.shop_claims_rate_limit_check() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon;

DROP POLICY IF EXISTS "Admins insert shops" ON public.shops;
CREATE POLICY "Admins insert shops"
  ON public.shops FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'shopkeeper')
  );

DROP POLICY IF EXISTS "Shops are publicly readable" ON public.shops;
CREATE POLICY "Shops are publicly readable"
  ON public.shops FOR SELECT TO public
  USING (true);

-- Ensure only specific administrator has admin role (never blanket grant to all users)
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE email = 'harshking5305@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;
