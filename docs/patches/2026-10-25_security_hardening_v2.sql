-- ============================================================================
-- 2026-10-25 · Security Hardening Patch v2
-- Muktainagar Daily — Protection against Sabotage, Data Theft & DoS
-- ============================================================================
--
-- Solves 5 core vulnerabilities diagnosed in the 2026-10-25 Security Audit:
--
-- 1. [DoS Fix] Replaces broken global 10/hour lockout on shop_requests with
--    per-phone rate limits and a realistic global buffer.
-- 2. [Data Protection] Locks down storage.objects SELECT policy on shop-images
--    so anonymous users cannot list or discover sensitive verification files in claims/.
-- 3. [Spam / Defamation Defense] Adds a per-user review rate limit trigger on
--    public.shop_reviews (max 5 reviews/24h per account).
-- 4. [Analytics Scraping] Revokes anonymous SELECT on public.shop_engagement.
-- 5. [Admin Audit] Provides safe verification queries to audit user_roles.
--
-- Safe to run in Supabase SQL Editor.
-- ============================================================================


-- ── 1. Fix shop_requests rate limit (eliminates global business DoS) ─────────
-- Previous implementation counted all unauthenticated requests globally (cap 10/hr).
-- One spam bot sending 10 requests was locking out the entire town from listing shops.
-- Fixed: Rate limit by phone number (3 per 2 hours) + high global circuit-breaker (150/hr).

CREATE OR REPLACE FUNCTION public.shop_requests_rate_limit_check()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  phone_recent int;
  global_recent int;
BEGIN
  -- Signed-in submissions (admins + shopkeepers) bypass rate limits
  IF auth.uid() IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- 1a. Per-phone rate limit: max 3 requests per phone within 2 hours
  IF NEW.phone IS NOT NULL AND trim(NEW.phone) <> '' THEN
    SELECT count(*) INTO phone_recent
    FROM public.shop_requests
    WHERE phone = NEW.phone
      AND created_at > now() - interval '2 hours';

    IF phone_recent >= 3 THEN
      RAISE EXCEPTION 'Too many listing requests submitted for this phone number. Please wait before submitting another.'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- 1b. Global safety cap: 150/hour (prevents DB saturation without locking legitimate users)
  SELECT count(*) INTO global_recent
  FROM public.shop_requests
  WHERE submitter_user_id IS NULL
    AND created_at > now() - interval '1 hour';

  IF global_recent >= 150 THEN
    RAISE EXCEPTION 'Server busy with new requests right now. Please try again shortly.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS shop_requests_rate_limit ON public.shop_requests;
CREATE TRIGGER shop_requests_rate_limit
BEFORE INSERT ON public.shop_requests
FOR EACH ROW EXECUTE FUNCTION public.shop_requests_rate_limit_check();


-- ── 2. Storage Objects: Prevent Anonymous Enumeration of claims/ ─────────────
-- The shop-images bucket is public for shop photos, but claim proofs (Aadhaar,
-- GST, utility bills) reside in claims/<user_id>/...
-- Ensure the public SELECT policy explicitly excludes the claims folder.

DROP POLICY IF EXISTS "Shop images are publicly viewable" ON storage.objects;
CREATE POLICY "Shop images are publicly viewable"
ON storage.objects FOR SELECT TO public
USING (
  bucket_id = 'shop-images'
  AND ((storage.foldername(name))[1] IS DISTINCT FROM 'claims')
);

-- Ensure claims proofs are strictly viewable ONLY by the owner or admins
DROP POLICY IF EXISTS "Claim proofs: owner or admin read" ON storage.objects;
CREATE POLICY "Claim proofs: owner or admin read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'shop-images'
  AND (storage.foldername(name))[1] = 'claims'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR (storage.foldername(name))[2] = auth.uid()::text
  )
);


-- ── 3. Review Bot / Competitor Defamation Throttling ─────────────────────────
-- Prevent scripted bot swarms from mass-reviewing competitor shops.
-- Caps each user account to at most 5 reviews across all shops in a 24h rolling window.

CREATE OR REPLACE FUNCTION public.shop_reviews_rate_limit_check()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  user_recent_reviews int;
BEGIN
  SELECT count(*) INTO user_recent_reviews
  FROM public.shop_reviews
  WHERE user_id = auth.uid()
    AND created_at > now() - interval '24 hours';

  IF user_recent_reviews >= 5 THEN
    RAISE EXCEPTION 'Daily review limit reached. You can submit up to 5 reviews per 24 hours.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_shop_reviews_rate_limit ON public.shop_reviews;
CREATE TRIGGER trg_shop_reviews_rate_limit
BEFORE INSERT ON public.shop_reviews
FOR EACH ROW EXECUTE FUNCTION public.shop_reviews_rate_limit_check();


-- ── 4. Revoke Anonymous SELECT on Engagement Analytics ───────────────────────
-- Engagement events (call, whatsapp, directions) contain competitive business
-- intelligence. Anonymous users only need INSERT; SELECT should be restricted.

REVOKE SELECT ON public.shop_engagement FROM anon;


-- ── 5. User Roles Audit Helper ───────────────────────────────────────────────
-- View active administrators to ensure unauthorized accounts do not hold the 'admin' role.
-- (Review output in Supabase Dashboard SQL Editor).

SELECT
  u.id,
  u.email,
  r.role,
  r.created_at
FROM public.user_roles r
JOIN auth.users u ON u.id = r.user_id
WHERE r.role = 'admin'
ORDER BY r.created_at ASC;

-- ============================================================================
-- End of patch.
-- ============================================================================
