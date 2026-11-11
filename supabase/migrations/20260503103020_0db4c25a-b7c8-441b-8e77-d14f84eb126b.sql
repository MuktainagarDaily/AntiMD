CREATE TABLE public.shop_bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, shop_id)
);

CREATE INDEX idx_shop_bookmarks_user_created
  ON public.shop_bookmarks (user_id, created_at DESC);

CREATE INDEX idx_shop_bookmarks_shop ON public.shop_bookmarks (shop_id);

ALTER TABLE public.shop_bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own bookmarks"
  ON public.shop_bookmarks FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users insert own bookmarks"
  ON public.shop_bookmarks FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users delete own bookmarks"
  ON public.shop_bookmarks FOR DELETE TO authenticated
  USING (user_id = auth.uid());