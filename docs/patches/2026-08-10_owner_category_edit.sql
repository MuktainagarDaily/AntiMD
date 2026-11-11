-- 2026-08-10 — Allow shop owners to edit their own shop's categories
--
-- Context: /my-shop now lets owners edit amenities, keywords, map location
-- and CATEGORIES. Amenities/keywords/lat/lng live on `shops` (already
-- owner-updatable via the owner UPDATE policy + BEFORE trigger guard).
-- Categories live in `public.shop_categories`, which was admin-only.
--
-- This patch adds owner INSERT/DELETE on shop_categories for shops they own.
-- Moderation flags (is_verified / is_active / slug / category_id) remain
-- blocked for non-admins by the existing shops BEFORE UPDATE trigger.
--
-- Safe to re-run.

-- 1) SECURITY DEFINER ownership helper (avoids recursive RLS on shop_owners)
CREATE OR REPLACE FUNCTION public.owns_shop(_user_id uuid, _shop_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shop_owners
    WHERE user_id = _user_id AND shop_id = _shop_id
  )
$$;

REVOKE ALL ON FUNCTION public.owns_shop(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owns_shop(uuid, uuid) TO authenticated, service_role;

-- 2) Grants (PostgREST needs explicit privileges; RLS still applies)
GRANT SELECT, INSERT, DELETE ON public.shop_categories TO authenticated;
GRANT ALL ON public.shop_categories TO service_role;

-- 3) Policies
ALTER TABLE public.shop_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can add their shop categories" ON public.shop_categories;
CREATE POLICY "Owners can add their shop categories"
ON public.shop_categories
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.owns_shop(auth.uid(), shop_id)
);

DROP POLICY IF EXISTS "Owners can remove their shop categories" ON public.shop_categories;
CREATE POLICY "Owners can remove their shop categories"
ON public.shop_categories
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.owns_shop(auth.uid(), shop_id)
);
