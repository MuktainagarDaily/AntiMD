import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Plug, Plus, ShieldCheck, Trash2, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { BranchTabs } from '@/components/admin/layout/BranchTabs';
import { ADMIN_NAV } from '@/components/admin/layout/adminNav';
import { useToast } from '@/hooks/use-toast';

type AuthType = 'none' | 'bearer' | 'oauth' | 'api_key';
type Environment = 'development' | 'staging' | 'production';

interface McpEndpoint {
  id: string;
  name: string;
  url: string;
  auth_type: AuthType;
  credential_ref: string | null;
  environment: Environment;
  notes: string | null;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

const BLANK: Omit<McpEndpoint, 'id' | 'created_at' | 'updated_at'> = {
  name: '',
  url: '',
  auth_type: 'none',
  credential_ref: null,
  environment: 'production',
  notes: null,
  is_enabled: true,
};

// Environment-based safety: the browser's runtime "env" here is `import.meta.env.PROD`
// (Vite build mode). Non-`https` URLs and `localhost` targets are blocked in prod builds
// so a staging URL can never accidentally ship live. `credential_ref` is required for any
// non-`none` auth type — we store the *secret name*, never the secret value itself.
function validate(row: typeof BLANK): string | null {
  if (!row.name.trim()) return 'Name is required.';
  if (!/^https?:\/\//i.test(row.url)) return 'URL must start with http:// or https://.';
  const isProdBuild = import.meta.env.PROD;
  const isProdEnv = row.environment === 'production';

  if (isProdEnv || isProdBuild) {
    if (!/^https:\/\//i.test(row.url)) return 'Production endpoints must use https://.';
    if (/^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)/i.test(row.url))
      return 'Localhost URLs are not allowed for production endpoints.';
  }
  if (row.auth_type !== 'none' && !row.credential_ref?.trim())
    return 'Credential reference (secret name) is required for this auth type.';
  if (row.credential_ref && !/^[A-Z_][A-Z0-9_]*$/.test(row.credential_ref))
    return 'Credential reference must be an env-var style name (UPPER_SNAKE_CASE).';
  return null;
}

export default function SystemMcp() {
  const hub = ADMIN_NAV.find((h) => h.key === 'system')!;
  const { toast } = useToast();
  const [rows, setRows] = useState<McpEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<typeof BLANK>(BLANK);
  const [saving, setSaving] = useState(false);

  const isProdBuild = import.meta.env.PROD;

  async function load() {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('mcp_endpoints')
      .select('*')
      .order('created_at', { ascending: false });
    setLoading(false);
    if (error) {
      toast({ title: 'Failed to load endpoints', description: error.message, variant: 'destructive' });
      return;
    }
    setRows((data ?? []) as McpEndpoint[]);
  }

  useEffect(() => {
    load();
  }, []);

  const draftError = useMemo(() => validate(draft), [draft]);

  async function handleCreate() {
    if (draftError) {
      toast({ title: 'Cannot save', description: draftError, variant: 'destructive' });
      return;
    }
    setSaving(true);
    const { error } = await (supabase as any).from('mcp_endpoints').insert(draft);
    setSaving(false);
    if (error) {
      toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
      return;
    }
    setDraft(BLANK);
    toast({ title: 'Endpoint added' });
    load();
  }

  async function handleToggle(row: McpEndpoint) {
    const { error } = await (supabase as any)
      .from('mcp_endpoints')
      .update({ is_enabled: !row.is_enabled })
      .eq('id', row.id);
    if (error) {
      toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
      return;
    }
    load();
  }

  async function handleDelete(row: McpEndpoint) {
    if (!confirm(`Delete "${row.name}"? This cannot be undone.`)) return;
    const { error } = await (supabase as any).from('mcp_endpoints').delete().eq('id', row.id);
    if (error) {
      toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Endpoint removed' });
    load();
  }

  return (
    <div>
      <BranchTabs leaves={hub.leaves} />

      <div className="rounded-xl border bg-card p-5 mb-4">
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-3.5 mb-4 flex items-start gap-2.5">
          <Sparkles className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
          <div className="text-xs">
            <div className="font-bold text-foreground">AI &amp; Tool Integrations (Technical / Developer Protocol)</div>
            <p className="text-muted-foreground mt-0.5 leading-relaxed">
              This page manages external Model Context Protocol (MCP) server endpoints for connecting AI assistants. 
              Town administrators managing shops, messes, and PGs do not need to configure anything here.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-1">
          <Plug className="w-4 h-4 text-primary" />
          <h2 className="font-semibold">MCP Server Endpoints</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Registry of Model Context Protocol servers the app connects to. Credential values are
          never stored here — save the credential in your runtime secret store and reference it by
          name (e.g. <code className="text-xs bg-muted px-1 rounded">STRIPE_MCP_TOKEN</code>).
        </p>

        <div className="rounded-lg border bg-muted/40 p-3 mb-4 flex items-start gap-2 text-xs">
          <ShieldCheck className="w-4 h-4 mt-0.5 text-primary shrink-0" />
          <div>
            <div className="font-medium">Safety checks active</div>
            <ul className="mt-1 list-disc pl-4 space-y-0.5 text-muted-foreground">
              <li>Production endpoints must use <code>https://</code>.</li>
              <li>Localhost/loopback URLs blocked when environment is <code>production</code>{isProdBuild ? ' or when this build is live' : ''}.</li>
              <li>Any auth type other than <code>none</code> requires a secret name.</li>
              <li>Credential references are validated as env-var identifiers.</li>
              <li>Table is admin-only via RLS; anon & authenticated users cannot read it.</li>
            </ul>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm">
            <span className="block font-medium mb-1">Name</span>
            <input
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="e.g. Stripe MCP"
            />
          </label>
          <label className="text-sm">
            <span className="block font-medium mb-1">URL</span>
            <input
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={draft.url}
              onChange={(e) => setDraft({ ...draft, url: e.target.value })}
              placeholder="https://mcp.example.com"
            />
          </label>
          <label className="text-sm">
            <span className="block font-medium mb-1">Environment</span>
            <select
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={draft.environment}
              onChange={(e) => setDraft({ ...draft, environment: e.target.value as Environment })}
            >
              <option value="development">development</option>
              <option value="staging">staging</option>
              <option value="production">production</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="block font-medium mb-1">Auth type</span>
            <select
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={draft.auth_type}
              onChange={(e) => setDraft({ ...draft, auth_type: e.target.value as AuthType })}
            >
              <option value="none">none</option>
              <option value="bearer">bearer token</option>
              <option value="oauth">oauth</option>
              <option value="api_key">api key</option>
            </select>
          </label>
          <label className="text-sm md:col-span-2">
            <span className="block font-medium mb-1">Credential reference (secret name)</span>
            <input
              className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono"
              value={draft.credential_ref ?? ''}
              onChange={(e) => setDraft({ ...draft, credential_ref: e.target.value || null })}
              placeholder="STRIPE_MCP_TOKEN"
              disabled={draft.auth_type === 'none'}
            />
          </label>
          <label className="text-sm md:col-span-2">
            <span className="block font-medium mb-1">Notes</span>
            <textarea
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              rows={2}
              value={draft.notes ?? ''}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value || null })}
            />
          </label>
        </div>

        {draftError && (
          <div className="mt-3 flex items-center gap-2 text-sm text-destructive">
            <AlertTriangle className="w-4 h-4" /> {draftError}
          </div>
        )}

        <div className="mt-4">
          <button
            onClick={handleCreate}
            disabled={saving || !!draftError}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition disabled:opacity-50 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> {saving ? 'Saving…' : 'Add endpoint'}
          </button>
        </div>
      </div>

      <div className="rounded-xl border bg-card">
        <div className="px-5 py-3 border-b font-semibold">Registered endpoints</div>
        {loading ? (
          <div className="p-5 text-sm text-muted-foreground">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-5 text-sm text-muted-foreground">No endpoints yet.</div>
        ) : (
          <ul className="divide-y">
            {rows.map((row) => (
              <li key={row.id} className="p-4 flex flex-wrap items-start gap-3">
                <div className="flex-1 min-w-[220px]">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{row.name}</span>
                    <span className="text-[10px] uppercase tracking-wide rounded px-1.5 py-0.5 bg-muted text-muted-foreground">
                      {row.environment}
                    </span>
                    {!row.is_enabled && (
                      <span className="text-[10px] uppercase tracking-wide rounded px-1.5 py-0.5 bg-destructive/10 text-destructive">
                        disabled
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground break-all mt-0.5">{row.url}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    auth: <span className="font-mono">{row.auth_type}</span>
                    {row.credential_ref && (
                      <>
                        {' · '}secret: <span className="font-mono">{row.credential_ref}</span>
                      </>
                    )}
                  </div>
                  {row.notes && <div className="text-xs mt-1">{row.notes}</div>}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggle(row)}
                    className="px-3 py-1.5 rounded-md border text-xs hover:bg-muted"
                  >
                    {row.is_enabled ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    onClick={() => handleDelete(row)}
                    className="px-3 py-1.5 rounded-md border text-xs text-destructive hover:bg-destructive/10 flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
