-- =====================================================================
-- Patch: 2026-06-13 — Expand banner placements
-- =====================================================================
-- Adds four new placement slots (in-feed on Shops list, Shop Detail
-- inline, Home bottom, Saved Shops inline) to the banners.placement
-- CHECK constraint. No new tables, no new policies, no new RPCs —
-- existing RLS, reorder_banners(), increment_banner_view/click() all
-- continue to cover the new placements.
-- =====================================================================

ALTER TABLE public.banners DROP CONSTRAINT IF EXISTS banners_placement_check;
ALTER TABLE public.banners ADD CONSTRAINT banners_placement_check
  CHECK (placement IN (
    'popup',
    'homepage_inline',
    'shops_inline',
    'category_inline',
    'shops_infeed',
    'shop_detail_inline',
    'home_bottom',
    'saved_inline'
  ));
