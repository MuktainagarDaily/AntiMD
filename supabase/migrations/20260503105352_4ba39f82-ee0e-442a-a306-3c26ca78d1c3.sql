
-- ============================================================================
-- SECURITY HARDENING — Linter fixes (2026-05-03)
-- ============================================================================

-- 1) Revoke EXECUTE on SECURITY DEFINER functions from anon/authenticated.
--    Trigger functions and admin-only RPCs do not need to be callable from PostgREST.
--    Functions still execute when invoked by triggers or by other SECURITY DEFINER
--    code paths regardless of these grants.

REVOKE EXECUTE ON FUNCTION public.set_updated_at()                        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_shop_slug()                         FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_shop_claim_status()            FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.shops_owner_column_guard()              FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.shop_claims_rate_limit_check()          FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.assign_shop_owner(uuid, uuid)           FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.revoke_shop_owner(uuid, uuid)           FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.approve_shop_claim(uuid)                FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reject_shop_claim(uuid, text)           FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refresh_engagement_stats()              FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_shop_slug(text, uuid)          FROM PUBLIC, anon, authenticated;

-- Re-grant admin RPCs to authenticated; the function body itself enforces admin role.
GRANT EXECUTE ON FUNCTION public.assign_shop_owner(uuid, uuid)            TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_shop_owner(uuid, uuid)            TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_shop_claim(uuid)                 TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_shop_claim(uuid, text)            TO authenticated;

-- Read-only helpers used from the client must remain callable.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role)                 TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_shop_owner(uuid, uuid)                TO authenticated;
GRANT EXECUTE ON FUNCTION public.shop_is_claimed(uuid)                    TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_trending_shops(integer)              TO authenticated, anon;

-- 2) Tighten "Always True" RLS policies on public-insert tables.
--    Keep public submissions possible but require minimum payload sanity.

DROP POLICY IF EXISTS "Public can insert engagement events" ON public.shop_engagement;
CREATE POLICY "Public can insert engagement events"
  ON public.shop_engagement
  FOR INSERT
  WITH CHECK (
    shop_id IS NOT NULL
    AND event_type IN ('call', 'whatsapp', 'maps')
  );

DROP POLICY IF EXISTS "Public can submit shop requests" ON public.shop_requests;
CREATE POLICY "Public can submit shop requests"
  ON public.shop_requests
  FOR INSERT
  WITH CHECK (
    name        IS NOT NULL AND length(btrim(name))  > 0
    AND phone   IS NOT NULL AND length(btrim(phone)) >= 10
    AND status  = 'pending'
  );
