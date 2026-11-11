
-- =========================================================
-- shop_reviews
-- =========================================================
CREATE TABLE IF NOT EXISTS public.shop_reviews (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id    UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating     SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body       TEXT NOT NULL DEFAULT '' CHECK (char_length(body) <= 2000),
  helpful_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT shop_reviews_unique_per_user UNIQUE (shop_id, user_id)
);

CREATE INDEX IF NOT EXISTS shop_reviews_shop_created_idx
  ON public.shop_reviews (shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS shop_reviews_user_idx
  ON public.shop_reviews (user_id);

GRANT SELECT ON public.shop_reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_reviews TO authenticated;
GRANT ALL ON public.shop_reviews TO service_role;

ALTER TABLE public.shop_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Reviews are public"          ON public.shop_reviews;
DROP POLICY IF EXISTS "Users insert own review"     ON public.shop_reviews;
DROP POLICY IF EXISTS "Users update own review"     ON public.shop_reviews;
DROP POLICY IF EXISTS "Users delete own review"     ON public.shop_reviews;

CREATE POLICY "Reviews are public"
  ON public.shop_reviews FOR SELECT
  USING (true);

CREATE POLICY "Users insert own review"
  ON public.shop_reviews FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own review"
  ON public.shop_reviews FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own review"
  ON public.shop_reviews FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trg_shop_reviews_touch ON public.shop_reviews;
CREATE TRIGGER trg_shop_reviews_touch
  BEFORE UPDATE ON public.shop_reviews
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================
-- shop_review_helpful (one vote per user per review)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.shop_review_helpful (
  review_id  UUID NOT NULL REFERENCES public.shop_reviews(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (review_id, user_id)
);

CREATE INDEX IF NOT EXISTS shop_review_helpful_user_idx
  ON public.shop_review_helpful (user_id);

GRANT SELECT, INSERT, DELETE ON public.shop_review_helpful TO authenticated;
GRANT ALL ON public.shop_review_helpful TO service_role;

ALTER TABLE public.shop_review_helpful ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Helpful votes readable by owner" ON public.shop_review_helpful;
DROP POLICY IF EXISTS "Users can add helpful vote"      ON public.shop_review_helpful;
DROP POLICY IF EXISTS "Users can remove helpful vote"   ON public.shop_review_helpful;

CREATE POLICY "Helpful votes readable by owner"
  ON public.shop_review_helpful FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can add helpful vote"
  ON public.shop_review_helpful FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove helpful vote"
  ON public.shop_review_helpful FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Trigger to keep helpful_count in sync
CREATE OR REPLACE FUNCTION public.shop_review_helpful_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.shop_reviews
      SET helpful_count = helpful_count + 1
      WHERE id = NEW.review_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.shop_reviews
      SET helpful_count = GREATEST(helpful_count - 1, 0)
      WHERE id = OLD.review_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_shop_review_helpful_ins ON public.shop_review_helpful;
DROP TRIGGER IF EXISTS trg_shop_review_helpful_del ON public.shop_review_helpful;
CREATE TRIGGER trg_shop_review_helpful_ins
  AFTER INSERT ON public.shop_review_helpful
  FOR EACH ROW EXECUTE FUNCTION public.shop_review_helpful_sync();
CREATE TRIGGER trg_shop_review_helpful_del
  AFTER DELETE ON public.shop_review_helpful
  FOR EACH ROW EXECUTE FUNCTION public.shop_review_helpful_sync();

-- =========================================================
-- Aggregate helper
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_shop_rating(_shop_id uuid)
RETURNS TABLE (
  average NUMERIC,
  count   BIGINT,
  d5      BIGINT,
  d4      BIGINT,
  d3      BIGINT,
  d2      BIGINT,
  d1      BIGINT
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    COALESCE(ROUND(AVG(rating)::numeric, 1), 0) AS average,
    COUNT(*)::bigint                            AS count,
    COUNT(*) FILTER (WHERE rating = 5)::bigint  AS d5,
    COUNT(*) FILTER (WHERE rating = 4)::bigint  AS d4,
    COUNT(*) FILTER (WHERE rating = 3)::bigint  AS d3,
    COUNT(*) FILTER (WHERE rating = 2)::bigint  AS d2,
    COUNT(*) FILTER (WHERE rating = 1)::bigint  AS d1
  FROM public.shop_reviews
  WHERE shop_id = _shop_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_shop_rating(uuid) TO anon, authenticated;
