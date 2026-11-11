-- Enable Supabase Realtime for the My Shop page so owners see live updates
-- (open/closed toggle, admin edits, claim approvals) without refreshing.
--
-- Safe to run multiple times.

DO $$
BEGIN
  -- shops: live updates for the editor + open/closed toggle
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'shops'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.shops';
  END IF;

  -- shop_requests: live status updates for the "My Listing Requests" card
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'shop_requests'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.shop_requests';
  END IF;
END $$;

-- Ensure UPDATE payloads include the full row so client filters work reliably.
ALTER TABLE public.shops REPLICA IDENTITY FULL;
ALTER TABLE public.shop_requests REPLICA IDENTITY FULL;
