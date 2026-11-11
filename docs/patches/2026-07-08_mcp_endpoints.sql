-- 2026-07-08 — Admin-managed registry of MCP server endpoints.
--
-- Powers the /admin/system/mcp settings page. Stores external MCP servers the
-- team wants tracked (URL, auth type, optional reference to a runtime secret
-- name where the credential lives). Raw credential values are NEVER stored
-- here — only the *name* of the secret (e.g. "STRIPE_MCP_TOKEN") that the
-- edge function reads at runtime. This keeps secrets in the Supabase Vault /
-- Function Secrets and out of Postgres.
--
-- RLS: admin-only for every operation. No anon, no authenticated read.

BEGIN;

CREATE TABLE IF NOT EXISTS public.mcp_endpoints (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL,
  url            text NOT NULL,
  auth_type      text NOT NULL DEFAULT 'none'
                   CHECK (auth_type IN ('none', 'bearer', 'oauth', 'api_key')),
  credential_ref text,                      -- name of the secret, never the value
  environment    text NOT NULL DEFAULT 'production'
                   CHECK (environment IN ('development', 'staging', 'production')),
  notes          text,
  is_enabled     boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mcp_endpoints_url_scheme_check
    CHECK (url ~* '^https?://'),
  CONSTRAINT mcp_endpoints_name_unique UNIQUE (name)
);

-- Data API grants (PostgREST). Admin-only — no anon/authenticated grants.
GRANT ALL ON public.mcp_endpoints TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mcp_endpoints TO authenticated;

ALTER TABLE public.mcp_endpoints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage mcp_endpoints" ON public.mcp_endpoints;
CREATE POLICY "Admins manage mcp_endpoints"
  ON public.mcp_endpoints
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- updated_at bump trigger (reuse existing helper if present, else define).
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS mcp_endpoints_touch ON public.mcp_endpoints;
CREATE TRIGGER mcp_endpoints_touch
  BEFORE UPDATE ON public.mcp_endpoints
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

COMMIT;
