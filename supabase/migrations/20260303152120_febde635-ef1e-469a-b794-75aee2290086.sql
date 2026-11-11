
-- Create shop_categories junction table for many-to-many relationship
CREATE TABLE public.shop_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  UNIQUE(shop_id, category_id)
);

-- Enable RLS
ALTER TABLE public.shop_categories ENABLE ROW LEVEL SECURITY;

-- Public can read
CREATE POLICY "Shop categories are publicly readable"
  ON public.shop_categories FOR SELECT USING (true);

-- Authenticated users can manage
CREATE POLICY "Authenticated users can insert shop_categories"
  ON public.shop_categories FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete shop_categories"
  ON public.shop_categories FOR DELETE
  USING (auth.role() = 'authenticated');

-- Migrate existing category_id data into the new junction table
INSERT INTO public.shop_categories (shop_id, category_id)
SELECT id, category_id FROM public.shops
WHERE category_id IS NOT NULL;
