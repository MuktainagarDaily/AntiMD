import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PageSeo } from "@/components/seo/PageSeo";
import { useCity } from "@/hooks/useCity";
import { ShieldCheck, Loader2 } from "lucide-react";

// Typed shim for the beta supabase.auth.oauth namespace. We only need three
// methods; a local wrapper keeps TS happy without grepping node_modules or
// hitting /oauth/authorizations directly.
type OAuthAuthorization = {
  client?: { name?: string; client_uri?: string; logo_uri?: string };
  scopes?: string[];
  redirect_url?: string;
  redirect_to?: string;
};
type OAuthNS = {
  getAuthorizationDetails: (id: string) => Promise<{ data: OAuthAuthorization | null; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<{ data: { redirect_url?: string; redirect_to?: string } | null; error: { message: string } | null }>;
  denyAuthorization: (id: string) => Promise<{ data: { redirect_url?: string; redirect_to?: string } | null; error: { message: string } | null }>;
};
const oauth = (supabase.auth as unknown as { oauth: OAuthNS }).oauth;

export default function OAuthConsent() {
  const { townBrand } = useCity();
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<OAuthAuthorization | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError("Missing authorization_id");
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        // Preserve the FULL consent URL so auth returns the user here, not
        // to `/` — the connector otherwise bounces back to the app instead
        // of the connectors dialog.
        const next = window.location.pathname + window.location.search;
        window.location.href = "/auth?next=" + encodeURIComponent(next);
        return;
      }
      const { data, error: err } = await oauth.getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (err) {
        setError(err.message);
        return;
      }
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    const { data, error: err } = approve
      ? await oauth.approveAuthorization(authorizationId)
      : await oauth.denyAuthorization(authorizationId);
    if (err) {
      setBusy(false);
      setError(err.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("No redirect returned by the authorization server.");
      return;
    }
    window.location.href = target;
  }

  return (
    <>
      <PageSeo title={`Authorize app · ${townBrand}`} description={`Approve or deny an app connecting to your ${townBrand} account.`} noindex />
      <main className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="w-full max-w-md rounded-2xl border bg-card shadow-sm p-6 space-y-5">
          {error ? (
            <>
              <h1 className="text-lg font-semibold">Authorization request failed</h1>
              <p className="text-sm text-muted-foreground">{error}</p>
            </>
          ) : !details ? (
            <div className="flex items-center gap-3 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Loading authorization request…</span>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h1 className="text-lg font-semibold leading-tight">
                    Connect {details.client?.name ?? "an app"} to your account
                  </h1>
                  <p className="text-xs text-muted-foreground">{townBrand} · MCP access</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                {details.client?.name ?? "This app"} is requesting access to use {townBrand} on your behalf.
                It will be able to call directory tools as you.
              </p>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" disabled={busy} onClick={() => decide(false)}>
                  Deny
                </Button>
                <Button className="flex-1" disabled={busy} onClick={() => decide(true)}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Approve"}
                </Button>
              </div>
            </>
          )}
        </div>
      </main>
    </>
  );
}
