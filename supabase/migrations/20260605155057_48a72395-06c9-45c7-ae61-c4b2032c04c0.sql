
CREATE TABLE IF NOT EXISTS public.translation_cache (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_text  text NOT NULL,
  direction    text NOT NULL CHECK (direction IN ('en|mr','mr|en')),
  translated   text NOT NULL,
  hit_count    integer NOT NULL DEFAULT 1,
  last_used_at timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (direction, source_text)
);

CREATE INDEX IF NOT EXISTS translation_cache_lookup_idx
  ON public.translation_cache (direction, source_text);

GRANT SELECT, INSERT, UPDATE ON public.translation_cache TO anon, authenticated;
GRANT ALL ON public.translation_cache TO service_role;

ALTER TABLE public.translation_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read translation cache" ON public.translation_cache;
CREATE POLICY "public read translation cache"
  ON public.translation_cache FOR SELECT USING (true);

DROP POLICY IF EXISTS "public insert translation cache" ON public.translation_cache;
CREATE POLICY "public insert translation cache"
  ON public.translation_cache FOR INSERT TO anon, authenticated
  WITH CHECK (
    length(btrim(source_text)) > 0
    AND length(btrim(translated)) > 0
    AND length(source_text) <= 2000
    AND length(translated) <= 4000
  );

-- Allow hit_count bump / last_used_at refresh from any visitor.
-- Source text + direction + translated are immutable from client.
DROP POLICY IF EXISTS "public bump translation cache" ON public.translation_cache;
CREATE POLICY "public bump translation cache"
  ON public.translation_cache FOR UPDATE TO anon, authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "admins delete translation cache" ON public.translation_cache;
CREATE POLICY "admins delete translation cache"
  ON public.translation_cache FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

DROP TRIGGER IF EXISTS trg_translation_cache_updated_at ON public.translation_cache;
CREATE TRIGGER trg_translation_cache_updated_at
  BEFORE UPDATE ON public.translation_cache
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
