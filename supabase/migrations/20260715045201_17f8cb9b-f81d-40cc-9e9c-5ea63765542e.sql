
-- Views should honor caller RLS (security_invoker)
ALTER VIEW public.shops_list_public   SET (security_invoker = true);
ALTER VIEW public.shops_search_public SET (security_invoker = true);

-- Don't expose materialised view directly via PostgREST
REVOKE SELECT ON public.category_shop_counts FROM anon, authenticated;

-- Read-only accessor for the counts
CREATE OR REPLACE FUNCTION public.get_category_shop_counts()
RETURNS TABLE (category_id uuid, shop_count int)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT category_id, shop_count FROM public.category_shop_counts;
$$;

REVOKE EXECUTE ON FUNCTION public.get_category_shop_counts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_category_shop_counts() TO anon, authenticated;
