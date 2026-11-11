// Points at the external Muktainagar Daily Supabase project.
// Reads environment variables when provided (e.g. on Vercel), with fallbacks
// to the external Supabase credentials so it works in zero-config environments.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './external-types';

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  "https://fhlaqgzensagjangkpop.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZobGFxZ3plbnNhZ2phbmdrcG9wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMzU3NzcsImV4cCI6MjA4NzcxMTc3N30.JoeKwYWsW9LoTya_V8eNpJhqnz0wDHa03bXE1KdlvuQ";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
