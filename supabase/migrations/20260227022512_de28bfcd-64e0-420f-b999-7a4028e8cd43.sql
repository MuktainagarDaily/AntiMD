
-- Create categories table
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '🏪',
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Create shops table
CREATE TABLE public.shops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  phone TEXT,
  whatsapp TEXT,
  address TEXT,
  area TEXT,
  opening_time TIME,
  closing_time TIME,
  is_open BOOLEAN NOT NULL DEFAULT true,
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;

-- Public read access for categories
CREATE POLICY "Categories are publicly readable"
  ON public.categories FOR SELECT USING (true);

-- Authenticated (admin) write access for categories
CREATE POLICY "Authenticated users can insert categories"
  ON public.categories FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update categories"
  ON public.categories FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete categories"
  ON public.categories FOR DELETE TO authenticated USING (true);

-- Public read access for shops
CREATE POLICY "Shops are publicly readable"
  ON public.shops FOR SELECT USING (true);

-- Authenticated (admin) write access for shops
CREATE POLICY "Authenticated users can insert shops"
  ON public.shops FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update shops"
  ON public.shops FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete shops"
  ON public.shops FOR DELETE TO authenticated USING (true);

-- Create storage bucket for shop images
INSERT INTO storage.buckets (id, name, public) VALUES ('shop-images', 'shop-images', true);

CREATE POLICY "Shop images are publicly viewable"
  ON storage.objects FOR SELECT USING (bucket_id = 'shop-images');

CREATE POLICY "Authenticated users can upload shop images"
  ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'shop-images');

CREATE POLICY "Authenticated users can update shop images"
  ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'shop-images');

CREATE POLICY "Authenticated users can delete shop images"
  ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'shop-images');

-- Seed default categories
INSERT INTO public.categories (name, icon) VALUES
  ('Grocery', '🛒'),
  ('Medical', '💊'),
  ('Restaurant', '🍽️'),
  ('Clothing', '👗'),
  ('Electronics', '📱'),
  ('Hardware', '🔧'),
  ('Bakery', '🍞'),
  ('Vegetable', '🥦'),
  ('Dairy', '🥛'),
  ('Stationery', '📚'),
  ('Salon', '✂️'),
  ('Auto Parts', '🚗');
