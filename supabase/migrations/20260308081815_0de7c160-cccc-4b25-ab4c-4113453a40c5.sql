
-- Create shop_engagement table for tracking WhatsApp and Call taps
CREATE TABLE IF NOT EXISTS public.shop_engagement (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('call', 'whatsapp')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for fast per-shop aggregation
CREATE INDEX IF NOT EXISTS idx_shop_engagement_shop_id ON public.shop_engagement(shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_engagement_event_type ON public.shop_engagement(event_type);
CREATE INDEX IF NOT EXISTS idx_shop_engagement_created_at ON public.shop_engagement(created_at);

-- Enable RLS
ALTER TABLE public.shop_engagement ENABLE ROW LEVEL SECURITY;

-- Anyone can insert (public taps) — no auth required
CREATE POLICY "Public can insert engagement events"
  ON public.shop_engagement
  FOR INSERT
  WITH CHECK (true);

-- Only authenticated users (admin) can read analytics
CREATE POLICY "Authenticated users can read engagement"
  ON public.shop_engagement
  FOR SELECT
  USING (auth.role() = 'authenticated');
