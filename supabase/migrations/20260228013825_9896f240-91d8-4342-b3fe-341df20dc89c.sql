
-- Fix RLS policies: change from RESTRICTIVE to PERMISSIVE for shops and categories

-- Drop existing restrictive policies for shops
DROP POLICY IF EXISTS "Shops are publicly readable" ON public.shops;
DROP POLICY IF EXISTS "Authenticated users can insert shops" ON public.shops;
DROP POLICY IF EXISTS "Authenticated users can update shops" ON public.shops;
DROP POLICY IF EXISTS "Authenticated users can delete shops" ON public.shops;

-- Drop existing restrictive policies for categories
DROP POLICY IF EXISTS "Categories are publicly readable" ON public.categories;
DROP POLICY IF EXISTS "Authenticated users can insert categories" ON public.categories;
DROP POLICY IF EXISTS "Authenticated users can update categories" ON public.categories;
DROP POLICY IF EXISTS "Authenticated users can delete categories" ON public.categories;

-- Enable RLS on both tables (in case not enabled)
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Create PERMISSIVE policies for shops
CREATE POLICY "Shops are publicly readable" ON public.shops FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert shops" ON public.shops FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update shops" ON public.shops FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete shops" ON public.shops FOR DELETE USING (auth.role() = 'authenticated');

-- Create PERMISSIVE policies for categories
CREATE POLICY "Categories are publicly readable" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert categories" ON public.categories FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update categories" ON public.categories FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete categories" ON public.categories FOR DELETE USING (auth.role() = 'authenticated');
