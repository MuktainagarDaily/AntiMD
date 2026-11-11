-- ============================================================
-- 1. Foreign keys for shop_owners and shop_claims
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shop_owners_shop_id_fkey') THEN
    ALTER TABLE public.shop_owners
      ADD CONSTRAINT shop_owners_shop_id_fkey
      FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shop_owners_user_id_fkey') THEN
    ALTER TABLE public.shop_owners
      ADD CONSTRAINT shop_owners_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shop_claims_shop_id_fkey') THEN
    ALTER TABLE public.shop_claims
      ADD CONSTRAINT shop_claims_shop_id_fkey
      FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shop_claims_user_id_fkey') THEN
    ALTER TABLE public.shop_claims
      ADD CONSTRAINT shop_claims_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================
-- 2. Rate-limit trigger on shop_claims
-- ============================================================
CREATE OR REPLACE FUNCTION public.shop_claims_rate_limit_check()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pending_for_shop  int;
  v_recent_for_shop   int;
  v_recent_for_user   int;
BEGIN
  -- Admins bypass all rate limits
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  -- Per (user, shop): block if a pending claim already exists
  SELECT count(*) INTO v_pending_for_shop
  FROM public.shop_claims
  WHERE user_id = NEW.user_id
    AND shop_id = NEW.shop_id
    AND status  = 'pending';

  IF v_pending_for_shop > 0 THEN
    RAISE EXCEPTION 'You already have a pending claim for this shop.'
      USING ERRCODE = 'P0001';
  END IF;

  -- Per (user, shop): max 3 claims in last 24 hours
  SELECT count(*) INTO v_recent_for_shop
  FROM public.shop_claims
  WHERE user_id = NEW.user_id
    AND shop_id = NEW.shop_id
    AND created_at > now() - interval '24 hours';

  IF v_recent_for_shop >= 3 THEN
    RAISE EXCEPTION 'Too many claim attempts for this shop. Please try again tomorrow.'
      USING ERRCODE = 'P0001';
  END IF;

  -- Per user: max 3 claims in last 1 hour (across all shops)
  SELECT count(*) INTO v_recent_for_user
  FROM public.shop_claims
  WHERE user_id = NEW.user_id
    AND created_at > now() - interval '1 hour';

  IF v_recent_for_user >= 3 THEN
    RAISE EXCEPTION 'Rate limit: please wait a while before submitting more claims.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_shop_claims_rate_limit ON public.shop_claims;
CREATE TRIGGER trg_shop_claims_rate_limit
  BEFORE INSERT ON public.shop_claims
  FOR EACH ROW
  EXECUTE FUNCTION public.shop_claims_rate_limit_check();