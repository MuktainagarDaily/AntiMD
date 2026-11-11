-- 2026-07-05 · Security hardening fix — SQL patch script
-- ============================================================================
-- Addresses the following security findings raised in the 2026-07-05 review:
--
--   • maps_link_href_injection            (error) — shop_requests.maps_link had
--                                                    no scheme validation.
--   • banners_target_url_no_constraint    (warn)  — banners.target_url had no
--                                                    scheme validation.
--   • translation_cache_unscoped_update   (warn)  — UPDATE policy used
--                                                    USING(true)/WITH CHECK(true)
--                                                    and allowed any client to
--                                                    overwrite any row.
--   • engagement_spam                     (warn)  — shop_engagement and
--                                                    shop_requests accepted
--                                                    unlimited anonymous
--                                                    inserts.
--   • SUPA_anon_security_definer_...     (warn)  — admin-only SECURITY DEFINER
--                                                    RPCs were EXECUTE-able by
--                                                    anon/public.
--
-- Rate-limit note: the backend has no standard rate-limiting primitive, so the
-- triggers below are best-effort ad-hoc caps modelled on
-- `shop_claims_rate_limit_check`. They apply to unauthenticated inserts only
-- so signed-in flows (admin data-quality tools, shopkeepers, etc.) are not
-- affected. Tune the numeric caps if genuine traffic ever hits them.
--
-- Rollback notes are inline for each block.
-- ============================================================================


-- ── 1. URL scheme CHECK constraints ────────────────────────────────────────
-- These allow NULL (both columns are optional) but reject any value that
-- doesn't begin with http:// or https:// — blocking javascript:/data: XSS
-- payloads at the storage layer even if a client-side guard is bypassed.
--
-- Rollback:
--   ALTER TABLE public.shop_requests DROP CONSTRAINT shop_requests_maps_link_http;
--   ALTER TABLE public.banners       DROP CONSTRAINT banners_target_url_http;

ALTER TABLE public.shop_requests
  ADD CONSTRAINT shop_requests_maps_link_http
  CHECK (maps_link IS NULL OR maps_link ~* '^https?://');

ALTER TABLE public.banners
  ADD CONSTRAINT banners_target_url_http
  CHECK (target_url IS NULL OR target_url ~* '^https?://');


-- ── 2. Column-level lock on translation_cache UPDATE ───────────────────────
-- The old "public bump translation cache" policy used USING(true)/WITH CHECK(true)
-- and allowed any client to rewrite `translated`. Row-level policies in
-- Postgres can't restrict *which* columns change, so we use column-level
-- GRANTs instead: revoke wide UPDATE, then re-grant only `hit_count` and
-- `last_used_at`. The existing RLS policy still governs row eligibility.
--
-- Rollback:
--   REVOKE UPDATE (hit_count, last_used_at) ON public.translation_cache FROM anon, authenticated;
--   GRANT UPDATE ON public.translation_cache TO anon, authenticated;

REVOKE UPDATE ON public.translation_cache FROM anon, authenticated;
GRANT UPDATE (hit_count, last_used_at) ON public.translation_cache TO anon, authenticated;


-- ── 3. Best-effort rate limits on public insert surfaces ───────────────────
-- Cap unauthenticated inserts so a bot cannot flood engagement counters or
-- the admin inbox. Signed-in users bypass the caps entirely.
--
-- Rollback:
--   DROP TRIGGER shop_engagement_rate_limit ON public.shop_engagement;
--   DROP FUNCTION public.shop_engagement_rate_limit_check();
--   DROP TRIGGER shop_requests_rate_limit ON public.shop_requests;
--   DROP FUNCTION public.shop_requests_rate_limit_check();

CREATE OR REPLACE FUNCTION public.shop_engagement_rate_limit_check()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE recent int;
BEGIN
  -- Signed-in traffic is not rate-limited.
  IF auth.uid() IS NOT NULL THEN RETURN NEW; END IF;

  -- Anon: max 20 events per (shop_id, event_type) per minute.
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
  -- Signed-in submissions are not rate-limited (admins + shopkeepers).
  IF auth.uid() IS NOT NULL THEN RETURN NEW; END IF;

  -- Anon: max 10 pending public requests per hour globally.
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


-- ── 4. Revoke public EXECUTE on admin-only SECURITY DEFINER RPCs ───────────
-- Each function body already checks `has_role(auth.uid(),'admin')`, but there
-- is no reason to leave EXECUTE open to anon/public. Revoke from PUBLIC then
-- re-grant to `authenticated` (admin gate still runs inside the function).
--
-- Rollback:
--   GRANT EXECUTE ON FUNCTION ... TO PUBLIC;

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

-- End of patch.
