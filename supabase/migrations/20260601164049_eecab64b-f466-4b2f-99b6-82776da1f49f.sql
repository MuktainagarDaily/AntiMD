GRANT INSERT ON public.shop_requests TO anon, authenticated;
GRANT SELECT ON public.shop_requests TO authenticated;
GRANT ALL ON public.shop_requests TO service_role;