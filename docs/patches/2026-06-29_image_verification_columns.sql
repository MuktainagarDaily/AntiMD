-- 2026-06-29 — Persist shop image verification results
--
-- WHY:
--   The admin "No image" filter previously had to re-scan every shop's
--   image_url on demand. Scans were also brittle: a CORS-blocked HEAD
--   could be reported as "valid" even when the file no longer exists.
--
--   This patch adds two timestamp columns so each verification result
--   is remembered between sessions:
--     • image_checked_at — when we last successfully probed the URL
--     • image_broken_at  — set when the URL failed to load; NULL when OK
--
--   With these columns the No-image filter can include rows that still
--   have a non-null image_url but were proven broken by the last scan,
--   without having to re-check them every time the admin opens the tab.
--
-- SAFETY:
--   Fully idempotent — uses IF NOT EXISTS for every column / index.
--   No-op when the shops table does not yet exist.

DO $$
BEGIN
  IF to_regclass('public.shops') IS NULL THEN
    RAISE NOTICE 'public.shops not found — skipping image-verification columns';
    RETURN;
  END IF;

  ALTER TABLE public.shops
    ADD COLUMN IF NOT EXISTS image_checked_at timestamptz NULL,
    ADD COLUMN IF NOT EXISTS image_broken_at  timestamptz NULL;

  COMMENT ON COLUMN public.shops.image_checked_at IS
    'Timestamp of the most recent admin image-URL verification (HEAD/GET/<img> probe).';
  COMMENT ON COLUMN public.shops.image_broken_at IS
    'Set when the last probe could not load image_url; NULL when the link verified OK.';

  -- Speeds up the No-image filter which unions null/empty/broken rows.
  CREATE INDEX IF NOT EXISTS idx_shops_image_broken_at
    ON public.shops (image_broken_at)
    WHERE image_broken_at IS NOT NULL;
END
$$;