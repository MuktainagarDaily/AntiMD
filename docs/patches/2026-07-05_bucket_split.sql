-- 2026-07-05 · Bucket split (Forge rec #15) — SQL patch script
-- =============================================================
-- CONTEXT
--   Storage Service (rec #7) is now complete: every runtime call site
--   flows through `src/lib/storageNaming.ts`, so introducing a new bucket
--   is a one-file change on the client side.
--
--   This patch prepares the DB / storage layer for splitting off two
--   new content types from `shop-images`:
--     • `school-images`  — Schools directory (Forge Phase 4).
--     • `request-images` — Public "list your shop" pre-approval uploads.
--
--   `banner-images` already exists (private). `shop-images` stays as-is
--   for shops + claim proofs.
--
-- WHY DEFERRED EXECUTION
--   Bucket rows are managed by the Storage API, not by SQL. In this
--   workspace public buckets are also gated by the `cloud_block_public_buckets`
--   policy — see the accompanying assistant message for the enablement
--   step. Once the buckets exist, apply the RLS block below verbatim.
--
-- HOW TO APPLY
--   1. Enable public buckets in Workspace Settings → Privacy & Security
--      (workspace admin/owner only).
--   2. Create the two buckets via the Storage API (do NOT insert into
--      storage.buckets directly):
--        • name = 'school-images',  public = true
--        • name = 'request-images', public = true
--   3. Run the RLS block below.
--   4. (Optional, safe no-op today) Move any existing prefixed files
--      out of `shop-images` and rewrite image_url values. As of
--      2026-07-05 the shop-images bucket contains only shop + banner
--      objects, so no file moves are required.
--
-- ROLLBACK
--   `DROP POLICY ... ON storage.objects;` for the policies below, then
--   delete the two buckets via `DELETE FROM storage.buckets WHERE id IN
--   ('school-images','request-images');`.
-- =============================================================

-- ---------- school-images ----------
CREATE POLICY "School images are publicly viewable"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'school-images');

CREATE POLICY "Admins can upload school images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'school-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update school images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'school-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete school images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'school-images' AND public.has_role(auth.uid(), 'admin'));

-- ---------- request-images ----------
-- Public listing requests currently allow authenticated uploads to
-- `shop-images` — mirror that behaviour here so the migration is a
-- pure prefix/bucket rename on the client.
CREATE POLICY "Request images are publicly viewable"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'request-images');

CREATE POLICY "Authenticated users can upload request images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'request-images');

CREATE POLICY "Admins can update request images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'request-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete request images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'request-images' AND public.has_role(auth.uid(), 'admin'));

-- End of patch.
