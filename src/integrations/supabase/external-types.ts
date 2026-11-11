// Single source of truth for Supabase types in this project.
//
// Why this file (and not the Lovable-generated `types.ts`):
// Muktainagar Daily uses an EXTERNAL Supabase project
// (fhlaqgzensagjangkpop) — see `src/integrations/supabase/client.ts`. The
// Lovable Cloud type generator can only introspect the Lovable-managed
// project referenced in `.env`, which has a completely different schema
// (products/brands/festival_themes scaffold). Its output was therefore
// wrong for our runtime and has been removed to eliminate the dual-types
// confusion flagged in docs/TECHNICAL_DEBT.md.
//
// Table/View/Function shapes are kept permissive (`Record<string, any>`)
// because we cannot auto-generate accurate ones for the external project.
// Enums that the app actually branches on are encoded precisely so the
// TypeScript layer still catches typos in role checks etc.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type AnyRow = Record<string, any>;
type AnyTable = {
  Row: AnyRow;
  Insert: AnyRow;
  Update: AnyRow;
  Relationships: [];
};

// Mirrors the `public.app_role` enum in the live DB.
// Source of truth: supabase/master_schema.sql + mem/features/roles-and-ownership.md
export type AppRole = 'admin' | 'shopkeeper' | 'user';

export type Database = {
  __InternalSupabase: { PostgrestVersion: "14.5" };
  public: {
    Tables: Record<string, AnyTable>;
    Views: Record<string, AnyTable>;
    Functions: Record<string, { Args: AnyRow; Returns: any }>;
    Enums: {
      app_role: AppRole;
      [k: string]: string;
    };
    CompositeTypes: Record<string, AnyRow>;
  };
};
