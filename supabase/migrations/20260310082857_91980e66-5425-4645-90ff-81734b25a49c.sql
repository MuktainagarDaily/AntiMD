
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS sub_area text;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS keywords text;

ALTER TABLE public.shop_requests ADD COLUMN IF NOT EXISTS sub_area text;
ALTER TABLE public.shop_requests ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.shop_requests ADD COLUMN IF NOT EXISTS keywords text;
