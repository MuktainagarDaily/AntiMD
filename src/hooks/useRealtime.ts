/**
 * useRealtimeRow / useRealtimeChannel — Phase 1 (Forge #8) + Phase 3 hardening.
 *
 * MyShop.tsx wires three near-identical `supabase.channel(...).on('postgres_changes', ...)`
 * subscriptions. These hooks factor that pattern out so future consumers
 * (banners, requests, claims, etc.) can subscribe without repeating the
 * channel-lifecycle boilerplate.
 *
 * Sentinel notes:
 *   • MyShop's ownership-revoke toast relies on `shop_owners` REPLICA
 *     IDENTITY FULL. This hook only manages channel lifecycle — payload
 *     shape is unchanged, so the toast + invalidateQueries logic stays
 *     one-for-one with the previous inline implementation.
 *   • Channel name includes `Date.now()` to prevent duplicate handlers
 *     when React 18 StrictMode double-mounts an effect.
 *
 * Phase 3 safeguards (MPULSE):
 *   • A `mounted` flag guards every payload callback so late-arriving events
 *     after unmount (or after a dep change while a message is in-flight) are
 *     ignored — no more `setState on unmounted component` risk.
 *   • The current subscriptions array is stored in a ref so callbacks always
 *     see the latest closure even if the parent re-renders with new state.
 *   • Cleanup explicitly `channel.unsubscribe()`s before `removeChannel(...)`,
 *     which is what the Supabase docs recommend to release the socket slot
 *     synchronously (removeChannel alone is async and can race on rapid
 *     user/shop switches).
 */
import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

type PgEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

export interface RealtimeRowConfig<T extends Record<string, any> = Record<string, any>> {
  /** Human-readable channel name prefix. `Date.now()` gets appended. */
  channelName: string;
  /** Table in the public schema (e.g. `shops`). */
  table: string;
  /** Optional PostgREST-style filter (e.g. `id=eq.${id}`). */
  filter?: string;
  /** Which change events to listen for. Default: `'*'`. */
  event?: PgEvent;
  /** Change handler. Receives the raw Supabase payload. */
  onChange: (payload: RealtimePostgresChangesPayload<T>) => void;
  /** When false, the hook does not subscribe (e.g. waiting for auth). */
  enabled?: boolean;
  /** Optional schema override. Default: `'public'`. */
  schema?: string;
}

/**
 * Subscribe to postgres_changes on a single (event, table, filter) combo.
 * Torn down cleanly on dep change / unmount.
 */
export function useRealtimeRow<T extends Record<string, any> = Record<string, any>>(
  config: RealtimeRowConfig<T>,
  deps: React.DependencyList = [],
) {
  const { channelName, table, filter, event = '*', onChange, enabled = true, schema = 'public' } = config;

  // Keep the latest onChange in a ref so payloads always see fresh closures.
  const cbRef = useRef(onChange);
  cbRef.current = onChange;

  useEffect(() => {
    if (!enabled) return;
    let mounted = true;
    const channel: RealtimeChannel = supabase
      .channel(`${channelName}-${Date.now()}`)
      .on(
        'postgres_changes' as any,
        { event, schema, table, ...(filter ? { filter } : {}) },
        (payload: any) => {
          if (!mounted) return;
          cbRef.current(payload as RealtimePostgresChangesPayload<T>);
        },
      )
      .subscribe();
    return () => {
      mounted = false;
      try { channel.unsubscribe(); } catch { /* no-op */ }
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, channelName, table, filter, event, schema, ...deps]);
}

export interface RealtimeSubscription<T extends Record<string, any> = Record<string, any>> {
  table: string;
  filter?: string;
  event?: PgEvent;
  schema?: string;
  onChange: (payload: RealtimePostgresChangesPayload<T>) => void;
}

/**
 * Multiplex several postgres_changes subscriptions onto ONE channel.
 * Useful when a page needs to react to changes across multiple tables
 * with a shared identity (e.g. `my-ownership-${user.id}` listening on
 * both INSERT and DELETE of `shop_owners`).
 *
 * Safeguards (Phase 3):
 *   • Any callback that fires after unmount OR after a dep change is a no-op.
 *   • Callbacks always execute against the LATEST subscription array (fresh
 *     closures) — the caller can pass a freshly-built list each render without
 *     losing correctness.
 *   • Cleanup unsubscribes explicitly then removes the channel, so the socket
 *     slot is released synchronously when the user/shop identity changes.
 */
export function useRealtimeChannel(
  channelName: string,
  subscriptions: RealtimeSubscription[],
  opts: { enabled?: boolean } = {},
  deps: React.DependencyList = [],
) {
  const { enabled = true } = opts;

  // Keep the newest subscription list accessible from inside the effect's
  // stable callback closures. Rebuilt every render but the ref identity stays.
  const subsRef = useRef(subscriptions);
  subsRef.current = subscriptions;

  useEffect(() => {
    if (!enabled || subsRef.current.length === 0) return;
    let mounted = true;
    let channel: RealtimeChannel = supabase.channel(`${channelName}-${Date.now()}`);
    // Snapshot the subscription list at effect-run time — event bindings
    // themselves cannot change after `.subscribe()`, only the callback bodies
    // (which we route through subsRef so they always see the latest closure).
    const snapshot = subsRef.current;
    snapshot.forEach((sub, idx) => {
      const { table, filter, event = '*', schema = 'public' } = sub;
      channel = channel.on(
        'postgres_changes' as any,
        { event, schema, table, ...(filter ? { filter } : {}) },
        (payload: any) => {
          if (!mounted) return;
          // Route through the ref so late renders don't observe a stale
          // closure. The bound (table, filter, event) is fixed at effect-run
          // time so the index lookup is safe.
          const latest = subsRef.current[idx];
          (latest ?? sub).onChange(payload);
        },
      );
    });
    channel.subscribe();
    return () => {
      mounted = false;
      try { channel.unsubscribe(); } catch { /* no-op */ }
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, channelName, ...deps]);
}
