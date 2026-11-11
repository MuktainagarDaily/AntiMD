-- Tag listing requests with the signed-in submitter (optional; guests still allowed)
ALTER TABLE public.shop_requests
  ADD COLUMN IF NOT EXISTS submitter_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_shop_requests_submitter_user
  ON public.shop_requests(submitter_user_id)
  WHERE submitter_user_id IS NOT NULL;

-- Allow authenticated users to read their own submitted requests
DROP POLICY IF EXISTS "Users read own shop requests" ON public.shop_requests;
CREATE POLICY "Users read own shop requests"
  ON public.shop_requests
  FOR SELECT
  TO authenticated
  USING (submitter_user_id = auth.uid());

-- Public INSERT policy: when a row is inserted by an authenticated user it must
-- either omit submitter_user_id or set it to their own auth.uid (guests stay NULL).
DROP POLICY IF EXISTS "Public can submit shop requests" ON public.shop_requests;
CREATE POLICY "Public can submit shop requests"
  ON public.shop_requests
  FOR INSERT
  TO public
  WITH CHECK (
    name IS NOT NULL
    AND length(btrim(name)) > 0
    AND phone IS NOT NULL
    AND length(btrim(phone)) >= 10
    AND status = 'pending'
    AND (
      submitter_user_id IS NULL
      OR submitter_user_id = auth.uid()
    )
  );
