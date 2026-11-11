-- Enable Supabase Realtime for public.shop_owners so /my-shop can
-- toast the affected user when an admin revokes ownership or
-- assigns a new shop to them. Safe to re-run.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'shop_owners'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.shop_owners';
  END IF;
END $$;

-- DELETE payloads only include PK columns by default; FULL replica identity
-- ensures the user_id filter on the client matches deleted rows reliably.
ALTER TABLE public.shop_owners REPLICA IDENTITY FULL;