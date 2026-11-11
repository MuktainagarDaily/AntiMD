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