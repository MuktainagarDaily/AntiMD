-- 1. Repoint user_id FKs from auth.users -> profiles so PostgREST embeds work
ALTER TABLE public.shop_owners DROP CONSTRAINT IF EXISTS shop_owners_user_id_fkey;
ALTER TABLE public.shop_owners
  ADD CONSTRAINT shop_owners_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.shop_claims DROP CONSTRAINT IF EXISTS shop_claims_user_id_fkey;
ALTER TABLE public.shop_claims
  ADD CONSTRAINT shop_claims_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- (shop_id FKs already exist with CASCADE to shops -- skipping)

-- 2. Rate-limit trigger for shop_claims (admins exempt)
CREATE OR REPLACE FUNCTION public.shop_claims_rate_limit_check()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pending_same int;
  v_recent_same  int;
  v_recent_any   int;
BEGIN
  -- Admins exempt
  IF public.has_role(NEW.user_id, 'admin') THEN
    RETURN NEW;
  END IF;

  -- 1 pending claim per (user, shop)
  SELECT COUNT(*) INTO v_pending_same
  FROM public.shop_claims
  WHERE user_id = NEW.user_id AND shop_id = NEW.shop_id AND status = 'pending';
  IF v_pending_same >= 1 THEN
    RAISE EXCEPTION 'You already have a pending claim for this shop.';
  END IF;

  -- 3 claims per (user, shop) per 24h
  SELECT COUNT(*) INTO v_recent_same
  FROM public.shop_claims
  WHERE user_id = NEW.user_id AND shop_id = NEW.shop_id
    AND created_at > now() - interval '24 hours';
  IF v_recent_same >= 3 THEN
    RAISE EXCEPTION 'Too many claim attempts for this shop. Please try again tomorrow.';
  END IF;

  -- 3 claims per user across any shop per 1h
  SELECT COUNT(*) INTO v_recent_any
  FROM public.shop_claims
  WHERE user_id = NEW.user_id
    AND created_at > now() - interval '1 hour';
  IF v_recent_any >= 3 THEN
    RAISE EXCEPTION 'Rate limit: please wait a while before submitting more claims.';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_shop_claims_rate_limit ON public.shop_claims;
CREATE TRIGGER trg_shop_claims_rate_limit
  BEFORE INSERT ON public.shop_claims
  FOR EACH ROW EXECUTE FUNCTION public.shop_claims_rate_limit_check();