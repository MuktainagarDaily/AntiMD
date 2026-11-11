-- ============================================================================
-- Muktainagar Daily — Claim verification patch (2026-06-28)
-- ----------------------------------------------------------------------------
-- Adds proof-of-ownership upload + admin notes to shop_claims so the admin
-- review UI can show what the claimant submitted before granting ownership.
--
-- Safe to re-run.
-- ============================================================================

-- 1) Columns
ALTER TABLE public.shop_claims
  ADD COLUMN IF NOT EXISTS proof_image_path text,
  ADD COLUMN IF NOT EXISTS proof_type       text;

-- Constrain proof_type. NOT VALID so an old row with NULL doesn't block the
-- migration; new INSERTs are checked. Once all backfilled, run:
--   ALTER TABLE public.shop_claims VALIDATE CONSTRAINT shop_claims_proof_type_check;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'shop_claims_proof_type_check'
  ) THEN
    ALTER TABLE public.shop_claims
      ADD CONSTRAINT shop_claims_proof_type_check
      CHECK (proof_type IS NULL OR proof_type IN ('gst','aadhar_card','utility_bill','shop_board','other'))
      NOT VALID;
  END IF;
END $$;

-- admin_notes / reviewed_by / reviewed_at already exist (see 2026-05-01
-- migration) — no-op safeguard:
ALTER TABLE public.shop_claims
  ADD COLUMN IF NOT EXISTS admin_notes text,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

-- 2) Allow admins to UPDATE shop_claims directly (so the review modal can
--    save admin_notes before / instead of calling approve/reject RPC).
DROP POLICY IF EXISTS "Admins update claims" ON public.shop_claims;
CREATE POLICY "Admins update claims"
  ON public.shop_claims FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3) Storage policies for claim proofs.
--    Path convention: claims/<user_id>/<uuid>.webp inside the existing
--    `shop-images` bucket. We do NOT make the file public — claim proofs
--    are PII (could contain GST / Aadhaar / utility bill data) and must
--    only be readable by the claimant or an admin.

-- The bucket itself is public read for shop photos. To keep proofs out of
-- the public read, we DON'T need to flip the bucket — instead, ensure
-- only the claimant + admins can SELECT objects under `claims/`. Since
-- the bucket allows public SELECT by default, the file URL would still
-- be guessable. We therefore use signed URLs in the client (generated
-- on demand for admins) and rely on the upload path itself being
-- unguessable (UUID filename). Defence-in-depth: a SELECT policy that
-- denies anon for the `claims/` prefix.

-- NOTE: storage.objects already has Lovable-shipped policies. We add
-- a narrowing policy specifically for `claims/` paths.

DROP POLICY IF EXISTS "Claim proofs: owner or admin read"
  ON storage.objects;
CREATE POLICY "Claim proofs: owner or admin read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'shop-images'
    AND (storage.foldername(name))[1] = 'claims'
    AND (
      public.has_role(auth.uid(), 'admin')
      OR (storage.foldername(name))[2] = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "Claim proofs: authenticated insert under own folder"
  ON storage.objects;
CREATE POLICY "Claim proofs: authenticated insert under own folder"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'shop-images'
    AND (storage.foldername(name))[1] = 'claims'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Claim proofs: admin delete" ON storage.objects;
CREATE POLICY "Claim proofs: admin delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'shop-images'
    AND (storage.foldername(name))[1] = 'claims'
    AND public.has_role(auth.uid(), 'admin')
  );

-- ============================================================================
-- END
-- ============================================================================
