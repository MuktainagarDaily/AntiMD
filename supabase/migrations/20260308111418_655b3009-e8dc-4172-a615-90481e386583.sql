
-- Create shop_requests table for public listing submission workflow
CREATE TABLE public.shop_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  whatsapp TEXT,
  address TEXT,
  area TEXT,
  category_text TEXT,
  opening_time TEXT,
  closing_time TEXT,
  image_url TEXT,
  submitter_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT shop_requests_status_check CHECK (status IN ('pending', 'approved', 'rejected'))
);

-- Enable Row Level Security
ALTER TABLE public.shop_requests ENABLE ROW LEVEL SECURITY;

-- Public can insert new requests (no auth required — submission is anonymous)
CREATE POLICY "Public can submit shop requests"
  ON public.shop_requests
  FOR INSERT
  WITH CHECK (true);

-- Only authenticated admins can read requests
CREATE POLICY "Authenticated users can read shop requests"
  ON public.shop_requests
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Only authenticated admins can update requests (approve / reject)
CREATE POLICY "Authenticated users can update shop requests"
  ON public.shop_requests
  FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Only authenticated admins can delete requests
CREATE POLICY "Authenticated users can delete shop requests"
  ON public.shop_requests
  FOR DELETE
  USING (auth.role() = 'authenticated');

-- Auto-update updated_at timestamp
CREATE TRIGGER set_shop_requests_updated_at
  BEFORE UPDATE ON public.shop_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
