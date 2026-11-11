-- ============================================================================
-- Patch: Sanitize Corrupt Translations & Add Schools address_mr
-- Date: 2026-11-08
-- Purpose:
--   1. Purge any historical MyMemory warning or quota exceeded strings from
--      translation_cache and shop_translations to prevent corrupted display.
--   2. Add address_mr column to public.schools to support bilingual Marathi
--      address backfill across educational institutes.
-- ============================================================================

-- 1. Remove corrupt warning entries from translation cache
DELETE FROM public.translation_cache 
WHERE translated ILIKE '%mymemory%' OR translated ILIKE '%warning%' OR translated ILIKE '%limit exceeded%';

-- 2. Nullify corrupt shop translations so they can be cleanly backfilled
UPDATE public.shop_translations
SET name = NULL
WHERE name ILIKE '%mymemory%' OR name ILIKE '%warning%' OR name ILIKE '%limit exceeded%';

UPDATE public.shop_translations
SET description = NULL
WHERE description ILIKE '%mymemory%' OR description ILIKE '%warning%' OR description ILIKE '%limit exceeded%';

UPDATE public.shop_translations
SET address = NULL
WHERE address ILIKE '%mymemory%' OR address ILIKE '%warning%' OR address ILIKE '%limit exceeded%';

UPDATE public.shop_translations
SET area = NULL
WHERE area ILIKE '%mymemory%' OR area ILIKE '%warning%' OR area ILIKE '%limit exceeded%';

UPDATE public.shop_translations
SET sub_area = NULL
WHERE sub_area ILIKE '%mymemory%' OR sub_area ILIKE '%warning%' OR sub_area ILIKE '%limit exceeded%';

UPDATE public.shop_translations
SET keywords = NULL
WHERE keywords ILIKE '%mymemory%' OR keywords ILIKE '%warning%' OR keywords ILIKE '%limit exceeded%';

-- 3. Ensure schools table has address_mr column for bilingual address backfill
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS address_mr text;
