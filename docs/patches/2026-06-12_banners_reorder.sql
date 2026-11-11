-- Banners ordering support
-- Adds sort_order, replaces the placement+is_active index, seeds existing rows,
-- and exposes an admin-only reorder_banners(_ids uuid[]) RPC.

ALTER TABLE public.banners
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

DROP INDEX IF EXISTS public.idx_banners_placement_active;
CREATE INDEX IF NOT EXISTS idx_banners_placement_sort
  ON public.banners (placement, is_active, sort_order, created_at DESC);

WITH ranked AS (
  SELECT id,
         row_number() OVER (PARTITION BY placement ORDER BY created_at) AS rn
  FROM public.banners
)
UPDATE public.banners b
SET sort_order = ranked.rn
FROM ranked
WHERE ranked.id = b.id AND b.sort_order = 0;

CREATE OR REPLACE FUNCTION public.reorder_banners(_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin only';
  END IF;
  IF _ids IS NULL OR array_length(_ids, 1) IS NULL THEN
    RETURN;
  END IF;
  UPDATE public.banners b
  SET sort_order = pos.ord,
      updated_at = now()
  FROM (
    SELECT unnest(_ids) AS id,
           generate_subscripts(_ids, 1) AS ord
  ) pos
  WHERE b.id = pos.id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reorder_banners(uuid[]) TO authenticated;
