
-- BUG-A fix: backfill shop_categories for shops that have category_id set but no join row
INSERT INTO public.shop_categories (shop_id, category_id)
SELECT s.id, s.category_id
FROM public.shops s
WHERE s.category_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.shop_categories sc WHERE sc.shop_id = s.id
  );

-- BUG-B fix: delete orphaned shop_categories rows pointing to inactive categories
DELETE FROM public.shop_categories sc
USING public.categories c
WHERE sc.category_id = c.id
  AND c.is_active = false;
