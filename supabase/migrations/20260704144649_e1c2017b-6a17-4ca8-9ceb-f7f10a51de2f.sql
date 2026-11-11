
-- 1. URL scheme CHECK constraints
ALTER TABLE public.shop_requests
  ADD CONSTRAINT shop_requests_maps_link_http
  CHECK (maps_link IS NULL OR maps_link ~* '^https?://');

ALTER TABLE public.banners
  ADD CONSTRAINT banners_target_url_http
  CHECK (target_url IS NULL OR target_url ~* '^https?://');

-- 2. Column-level lock on translation_cache: public UPDATE limited to counters.
-- Revoke wide UPDATE, then re-grant only the counter columns. The existing
-- "public bump translation cache" policy still gates row-eligibility.
REVOKE UPDATE ON public.translation_cache FROM anon, authenticated;
GRANT UPDATE (hit_count, last_used_at) ON public.translation_cache TO anon, authenticated;

-- 3. Best-effort rate limits on public insert surfaces
CREATE OR REPLACE FUNCTION public.shop_engagement_rate_limit_check()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE recent int;
BEGIN
  IF auth.uid() IS NOT NULL THEN RETURN NEW; END IF;
  SELECT count(*) INTO recent
  FROM public.shop_engagement
  WHERE shop_id    = NEW.shop_id
    AND event_type = NEW.event_type
    AND created_at > now() - interval '1 minute';
  IF recent >= 20 THEN
    RAISE EXCEPTION 'Rate limit: too many engagement events for this shop.'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS shop_engagement_rate_limit ON public.shop_engagement;
CREATE TRIGGER shop_engagement_rate_limit
BEFORE INSERT ON public.shop_engagement
FOR EACH ROW EXECUTE FUNCTION public.shop_engagement_rate_limit_check();


CREATE OR REPLACE FUNCTION public.shop_requests_rate_limit_check()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE recent int;
BEGIN
  IF auth.uid() IS NOT NULL THEN RETURN NEW; END IF;
  SELECT count(*) INTO recent
  FROM public.shop_requests
  WHERE submitter_user_id IS NULL
    AND created_at > now() - interval '1 hour';
  IF recent >= 10 THEN
    RAISE EXCEPTION 'Rate limit: too many listing requests right now. Please try again shortly.'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS shop_requests_rate_limit ON public.shop_requests;
CREATE TRIGGER shop_requests_rate_limit
BEFORE INSERT ON public.shop_requests
FOR EACH ROW EXECUTE FUNCTION public.shop_requests_rate_limit_check();

-- 4. Revoke public EXECUTE on admin-only SECURITY DEFINER RPCs
REVOKE EXECUTE ON FUNCTION public.approve_shop_claim(uuid)             FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reject_shop_claim(uuid, text)        FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.assign_shop_owner(uuid, uuid)        FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.revoke_shop_owner(uuid, uuid)        FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reorder_banners(uuid[])              FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.refresh_engagement_stats()           FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.approve_shop_claim(uuid)              TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_shop_claim(uuid, text)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_shop_owner(uuid, uuid)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_shop_owner(uuid, uuid)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.reorder_banners(uuid[])               TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_engagement_stats()            TO authenticated;
