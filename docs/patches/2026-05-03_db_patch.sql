-- ============================================================================
-- DATABASE PATCH SCRIPT — 2026-05-03 (Muktainagar Daily)
-- ============================================================================
-- Consolidates today's schema and security changes for manual application
-- against an environment that has not run the corresponding migrations.
-- Safe to re-run (uses IF NOT EXISTS / DROP-and-recreate where applicable).
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1) SHOP BOOKMARKS — users can save shops to their profile
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.shop_bookmarks (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shop_id    uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, shop_id)
);

CREATE INDEX IF NOT EXISTS idx_shop_bookmarks_user_created
  ON public.shop_bookmarks (user_id, created_at DESC);

ALTER TABLE public.shop_bookmarks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own bookmarks"   ON public.shop_bookmarks;
DROP POLICY IF EXISTS "Users insert own bookmarks" ON public.shop_bookmarks;
DROP POLICY IF EXISTS "Users delete own bookmarks" ON public.shop_bookmarks;

CREATE POLICY "Users read own bookmarks"
  ON public.shop_bookmarks FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users insert own bookmarks"
  ON public.shop_bookmarks FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users delete own bookmarks"
  ON public.shop_bookmarks FOR DELETE TO authenticated
  USING (user_id = auth.uid());


-- ---------------------------------------------------------------------------
-- 2) SECURITY HARDENING — revoke EXECUTE on internal/admin SECURITY DEFINER fns
-- ---------------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.set_updated_at()                FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_shop_slug()                 FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_shop_claim_status()    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.shops_owner_column_guard()      FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()               FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.shop_claims_rate_limit_check()  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.assign_shop_owner(uuid, uuid)   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.revoke_shop_owner(uuid, uuid)   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.approve_shop_claim(uuid)        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reject_shop_claim(uuid, text)   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refresh_engagement_stats()      FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_shop_slug(text, uuid)  FROM PUBLIC, anon, authenticated;

-- Re-grant admin-only RPCs to authenticated; bodies enforce has_role('admin').
GRANT EXECUTE ON FUNCTION public.assign_shop_owner(uuid, uuid)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_shop_owner(uuid, uuid)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_shop_claim(uuid)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_shop_claim(uuid, text)    TO authenticated;

-- Read-only helpers used from the client.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role)         TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_shop_owner(uuid, uuid)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.shop_is_claimed(uuid)            TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_trending_shops(integer)      TO authenticated, anon;


-- ---------------------------------------------------------------------------
-- 3) SECURITY HARDENING — replace overly permissive RLS WITH CHECK (true)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Public can insert engagement events" ON public.shop_engagement;
CREATE POLICY "Public can insert engagement events"
  ON public.shop_engagement FOR INSERT
  WITH CHECK (
    shop_id IS NOT NULL
    AND event_type IN ('call', 'whatsapp', 'maps')
  );

DROP POLICY IF EXISTS "Public can submit shop requests" ON public.shop_requests;
CREATE POLICY "Public can submit shop requests"
  ON public.shop_requests FOR INSERT
  WITH CHECK (
    name        IS NOT NULL AND length(btrim(name))  > 0
    AND phone   IS NOT NULL AND length(btrim(phone)) >= 10
    AND status  = 'pending'
  );


-- ============================================================================
-- KNOWN REMAINING LINTER WARNINGS (intentional, cannot be fixed in SQL):
--   • Extension in Public (pg_trgm) — required for fuzzy search.
--   • Public Bucket Allows Listing (shop-images) — public shop photos.
--   • SECURITY DEFINER functions exposed to anon/authenticated:
--       has_role, shop_is_claimed, get_trending_shops, is_shop_owner,
--       assign_shop_owner, revoke_shop_owner, approve_shop_claim,
--       reject_shop_claim — required by client/admin flows; admin RPCs
--       enforce has_role('admin') inside the function body.
--   • Leaked Password Protection — toggle in Auth dashboard, not SQL.
-- ============================================================================
