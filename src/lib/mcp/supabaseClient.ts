// Supabase client for MCP tool handlers. Runs in Deno edge runtime.
// Import-safe: hardcoded URL/anon key, no env reads, no throws.
// NOTE: initialized eagerly (not `let cached = null`) because the bundler
// strips type annotations and Deno typechecks the emitted JS — `var cached
// = null` fails with TS7034/TS7005 under noImplicitAny.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://fhlaqgzensagjangkpop.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZobGFxZ3plbnNhZ2phbmdrcG9wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMzU3NzcsImV4cCI6MjA4NzcxMTc3N30.JoeKwYWsW9LoTya_V8eNpJhqnz0wDHa03bXE1KdlvuQ";

const client: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export function getSupabase(): SupabaseClient {
  return client;
}
