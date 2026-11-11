-- Set search_path on the only new function missing it
CREATE OR REPLACE FUNCTION public.validate_shop_claim_status()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status NOT IN ('pending','approved','rejected') THEN
    RAISE EXCEPTION 'Invalid shop_claims.status: %', NEW.status;
  END IF;
  RETURN NEW;
END $$;

-- Revoke EXECUTE from anon/public on admin RPCs and ownership helper
REVOKE EXECUTE ON FUNCTION public.assign_shop_owner(uuid, uuid)   FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.revoke_shop_owner(uuid, uuid)   FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.approve_shop_claim(uuid)        FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reject_shop_claim(uuid, text)   FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_shop_owner(uuid, uuid)       FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.assign_shop_owner(uuid, uuid)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_shop_owner(uuid, uuid)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_shop_claim(uuid)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_shop_claim(uuid, text)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_shop_owner(uuid, uuid)       TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;