-- ============================================================================
-- Migration: 20261105000000_multi_image_and_entity_meta.sql
-- Description: Adds multiple photos support (text[]) across shops, schools,
--              and shop_requests, and adds entity_type + metadata JSONB to
--              shop_requests for dynamic listing forms (Shop, Mess, PG, School).
-- ============================================================================

-- 1. Add photos array to shops (preserving image_url as primary cover for backward compatibility)
ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS photos text[] NOT NULL DEFAULT '{}';

-- 2. Add photos array to schools (preserving image_url as primary cover)
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS photos text[] NOT NULL DEFAULT '{}';

-- 3. Upgrade shop_requests with entity_type, photos array, and metadata JSONB
ALTER TABLE public.shop_requests
  ADD COLUMN IF NOT EXISTS entity_type text NOT NULL DEFAULT 'shop';

-- Add check constraint if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_shop_requests_entity_type'
  ) THEN
    ALTER TABLE public.shop_requests
      ADD CONSTRAINT chk_shop_requests_entity_type
      CHECK (entity_type IN ('shop', 'mess', 'pg', 'school'));
  END IF;
END $$;

ALTER TABLE public.shop_requests
  ADD COLUMN IF NOT EXISTS photos text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.shop_requests
  ADD COLUMN IF NOT EXISTS meta jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 4. Fast indexing for admin inbox filtering by entity type and status
CREATE INDEX IF NOT EXISTS idx_shop_requests_entity_type 
  ON public.shop_requests(entity_type, status);

CREATE INDEX IF NOT EXISTS idx_shops_photos
  ON public.shops USING gin (photos);
