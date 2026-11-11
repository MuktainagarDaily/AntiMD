-- ─── A1. Drop duplicate FK on shop_engagement ──────────────────────
ALTER TABLE public.shop_engagement DROP CONSTRAINT IF EXISTS fk_eng_shop;

-- ─── A4. Backfill profiles for any missing auth.users ──────────────
INSERT INTO public.profiles (id)
SELECT u.id FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id WHERE p.id IS NULL;

-- ─── A2. FKs to profiles (so PostgREST embeds resolve) ─────────────
ALTER TABLE public.user_roles
  DROP CONSTRAINT IF EXISTS user_roles_user_profile_fkey;
ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_user_profile_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id)
    ON DELETE CASCADE NOT VALID;
ALTER TABLE public.user_roles VALIDATE CONSTRAINT user_roles_user_profile_fkey;

ALTER TABLE public.shop_owners
  DROP CONSTRAINT IF EXISTS shop_owners_user_profile_fkey;
ALTER TABLE public.shop_owners
  ADD CONSTRAINT shop_owners_user_profile_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id)
    ON DELETE CASCADE NOT VALID;
ALTER TABLE public.shop_owners VALIDATE CONSTRAINT shop_owners_user_profile_fkey;

ALTER TABLE public.shop_claims
  DROP CONSTRAINT IF EXISTS shop_claims_user_profile_fkey;
ALTER TABLE public.shop_claims
  ADD CONSTRAINT shop_claims_user_profile_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id)
    ON DELETE CASCADE NOT VALID;
ALTER TABLE public.shop_claims VALIDATE CONSTRAINT shop_claims_user_profile_fkey;

ALTER TABLE public.shop_claims
  DROP CONSTRAINT IF EXISTS shop_claims_reviewed_profile_fkey;
ALTER TABLE public.shop_claims
  ADD CONSTRAINT shop_claims_reviewed_profile_fkey
    FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id)
    ON DELETE SET NULL NOT VALID;
ALTER TABLE public.shop_claims VALIDATE CONSTRAINT shop_claims_reviewed_profile_fkey;

-- ─── A3. Replace status validation trigger with CHECK on shop_claims ─
DROP TRIGGER IF EXISTS shop_claims_status_check ON public.shop_claims;
DROP TRIGGER IF EXISTS validate_shop_claim_status_trg ON public.shop_claims;
DROP TRIGGER IF EXISTS validate_shop_claim_status ON public.shop_claims;
ALTER TABLE public.shop_claims DROP CONSTRAINT IF EXISTS shop_claims_status_check;
ALTER TABLE public.shop_claims
  ADD CONSTRAINT shop_claims_status_check
    CHECK (status IN ('pending','approved','rejected'));

-- ─── B5. Lock down profiles SELECT (PII: phone) ─────────────────────
DROP POLICY IF EXISTS "Profiles are publicly readable" ON public.profiles;
DROP POLICY IF EXISTS "Profiles read: self/admin/owner-context" ON public.profiles;
CREATE POLICY "Profiles read: self/admin/owner-context"
  ON public.profiles FOR SELECT
  USING (
    id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.shop_owners o WHERE o.user_id = profiles.id)
  );

-- Public-safe view (no phone) for any future anon read needs
CREATE OR REPLACE VIEW public.profiles_public
  WITH (security_invoker = on) AS
  SELECT id, full_name, created_at FROM public.profiles;
GRANT SELECT ON public.profiles_public TO anon, authenticated;

-- ─── B6. Make shops_with_claim respect caller RLS ───────────────────
ALTER VIEW public.shops_with_claim SET (security_invoker = on);

-- ─── B7. Lock admin-only RPCs from anon (RPC bodies still re-check admin) ─
REVOKE EXECUTE ON FUNCTION public.assign_shop_owner(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.revoke_shop_owner(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.approve_shop_claim(uuid)      FROM anon;
REVOKE EXECUTE ON FUNCTION public.reject_shop_claim(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.refresh_engagement_stats()    FROM anon, authenticated;

-- ─── B8. Fix mutable search_path on set_shop_slug ───────────────────
CREATE OR REPLACE FUNCTION public.set_shop_slug()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public AS $func$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' OR
     (TG_OP = 'UPDATE' AND NEW.name <> OLD.name AND NEW.slug = OLD.slug) THEN
    NEW.slug := public.generate_shop_slug(NEW.name, NEW.id);
  END IF;
  RETURN NEW;
END $func$;

-- ─── C9. Backfill shop_categories from legacy shops.category_id ─────
INSERT INTO public.shop_categories (shop_id, category_id)
SELECT s.id, s.category_id FROM public.shops s
WHERE s.category_id IS NOT NULL
ON CONFLICT (shop_id, category_id) DO NOTHING;

COMMENT ON COLUMN public.shops.category_id IS
  'DEPRECATED — primary category. Use shop_categories join. Kept for backward compatibility.';

-- ─── C10. categories.created_at ─────────────────────────────────────
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- ─── C11. Attach set_updated_at triggers ────────────────────────────
DO $do$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['profiles','shops','categories','shop_requests','shop_claims']
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%1$s_updated_at ON public.%1$s;
       CREATE TRIGGER trg_%1$s_updated_at BEFORE UPDATE ON public.%1$s
       FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();', t);
  END LOOP;
END $do$;

-- ─── D12-13. Performance indexes ────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_shop_claims_user_created
  ON public.shop_claims(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shop_engagement_shop_created
  ON public.shop_engagement(shop_id, created_at DESC);