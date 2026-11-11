-- 2026-07-08 — Reconcile shop_engagement.event_type drift.
--
-- Context: src/lib/engagement.ts historically wrote 'directions' for map-open
-- events while every doc + AnalyticsTab reader assumed 'maps'. RLS had no
-- CHECK, so both spellings accumulated silently. See TECHNICAL_DEBT.md.
--
-- This patch:
--   1. Backfills every existing 'directions' row to 'maps'.
--   2. Adds a CHECK constraint restricting event_type to the canonical set
--      ('call', 'whatsapp', 'maps') so future drift fails loudly at INSERT.
--
-- Client code (src/lib/engagement.ts) is being switched to 'maps' in the same
-- change; run this SQL before deploying so the new constraint doesn't reject
-- any lingering in-flight 'directions' inserts.
--
-- Safe to re-run: UPDATE is idempotent, constraint drop-then-add avoids the
-- "already exists" error on repeated applies.

BEGIN;

-- 1) Backfill: canonicalize 'directions' → 'maps'.
UPDATE public.shop_engagement
   SET event_type = 'maps'
 WHERE event_type = 'directions';

-- 2) Constraint: prevent future drift. Drop first so re-applies are idempotent.
ALTER TABLE public.shop_engagement
  DROP CONSTRAINT IF EXISTS shop_engagement_event_type_check;

ALTER TABLE public.shop_engagement
  ADD CONSTRAINT shop_engagement_event_type_check
  CHECK (event_type IN ('call', 'whatsapp', 'maps'));

COMMIT;

-- Verify:
--   SELECT event_type, count(*) FROM public.shop_engagement GROUP BY 1;
--   -- expect only 'call', 'whatsapp', 'maps'
