# Technical Debt

> For each entry: *what it is · where · why it's debt · prior cleanup attempts (if known)*.

## Duplicate / Conflicting Logic

### ~~Two Supabase type files~~ — RESOLVED 2026-06-26
- **Resolution:** `src/integrations/supabase/types.ts` vs `external-types.ts` reconciled.
- **Rationale:** The app connects to the EXTERNAL Supabase project `fhlaqgzensagjangkpop` (configured in `client.ts`). Role-checking code is type-checked end-to-end with `'admin' | 'shopkeeper' | 'user'`.

### ~~Two role models~~ — RESOLVED 2026-06-26
- **Resolution:** Confirmed via `supabase/master_schema.sql` that the live `public.app_role` enum is `('admin','shopkeeper','user')`. `useAuth.tsx` `AppRole` union matches this enum.

### `shops.is_open` boolean vs computed open/closed
- **What:** Column kept as quick-toggle in MyShop UI; actual open/closed status computed from `opening_time`/`closing_time` text via `isShopUtils.ts > isShopOpen()`.
- **Why it's debt:** Two sources of truth for "is this shop currently open". When they disagree the UI can be ambiguous.
- **Status:** Marked legacy in master_schema comment.

### Reviews: `reviews` vs `shop_reviews` schema coexistence
- **What:** The modern customer ratings & reviews feature utilizes the generic `reviews` table (supporting `entity_type` like `'shop'`, rating, comment, and `get_shop_rating` RPC), while the database also has `shop_reviews` and `shop_review_helpful`.
- **Why it's debt:** Two review table representations exist in the schema definitions.
- **Recommendation:** Consolidate any remaining legacy queries to the unified `reviews` table and deprecate `shop_reviews`.

## Legacy Code

### `shops.category_id` column
- **What:** Single-category FK on `shops`, kept "for backward compat".
- **Where:** master_schema.sql.
- **Why it's debt:** All modern app code uses the `shop_categories` junction table. Column is largely legacy but still indexed (`idx_shops_category_id`).
- **Prior attempts:** Migration backfilled `shop_categories` from `shops.category_id` and marked the column DEPRECATED in the schema comment.
- **Recommendation:** Drop the column after auditing legacy admin imports.

### `/admin/login` route
- **What:** Thin redirect route that immediately invokes `<Navigate to="/auth" replace />`.
- **Why it's debt:** Extra lazy chunk for a 1-line redirect.
- **Recommendation:** Keep as `<Navigate>` directly in `App.tsx` routes to eliminate the chunk.

### `claim_first_admin` RPC
- **What:** One-shot bootstrap RPC.
- **Why it's debt:** Historical bootstrap function. Admins are primarily managed via `user_roles` seed and admin delegation.

## Refactor Opportunities

### Multi-Location Rollout & Legacy Route Redirects
- **What:** Active path-scoped routing (`/:citySlug/...`) is fully implemented with `LegacyCityRedirect` preserving old un-scoped URLs (`/shops`, `/categories`, etc.).
- **Status:** Option B is live in production.
- **Opportunity:** Update all internal hardcoded markdown or legacy links to omit redirect hops.

### Unused server RPCs
- **`search_shops`**: full pg_trgm + indexed implementation; client currently uses Fuse.js in-memory search.
- **`get_trending_shops`**: backed by `shop_engagement_stats` materialized view; ready to power a "Trending" carousel on Home.
- **`refresh_engagement_stats`**: callable via SQL editor or trigger; could be exposed on an admin maintenance widget.

### Banner "fallback chain" duplication
- **What:** Multiple `BannerSlot` consumers hardcode the same fallback (`fallback="homepage_inline"`).
- **Recommendation:** Centralize the fallback map into `useBannersForPlacement` so each placement has a single canonical fallback.

## Risk Areas

### ~~Single bucket for shops + banners + requests~~ — RESOLVED 2026-07-05
- **Resolution:** Storage bucket split shipped (patch `2026-07-05_bucket_split.sql`). Four dedicated buckets: `shop-images`, `school-images`, `request-images`, and `banner-images`. All runtime paths flow through `src/lib/storageNaming.ts`.

### `shop_engagement.event_type` naming drift
- **What:** `src/lib/engagement.ts > logShopEngagement()` writes `event_type: 'directions'` for map-open events; some analytics views assume `'maps'`.
- **Recommendation:** Backfill via `UPDATE shop_engagement SET event_type='maps' WHERE event_type='directions'` and add a CHECK constraint.

### Hardcoded Supabase configuration in `client.ts`
- **What:** `src/integrations/supabase/client.ts` hardcodes URL + anon key.
- **Why:** Preserved to prevent external automated environments from clobbering production keys.
- **Risk:** Key rotation requires a code commit.

### MyMemory free tier translation
- **What:** `translateApi.ts` uses MyMemory's free tier.
- **Mitigation:** 3-tier cache (memory $\to$ localStorage $\to$ `translation_cache` table) absorbs repeat lookups.

## Documentation / Knowledge Gaps

- DR workflow: `MasterExport` produces full ZIP archives, but periodic restoration verification on a test DB should be executed.
- Deployment targets: Vercel is the primary documented deployment target (`vercel.json` + `docs/VERCEL_MIGRATION_PLAN.md`).

## m-Pulse DB optimizations landed, client not migrated

- **What:** DB optimizations shipped slim `shops_list_public` + `shops_search_public` views, materialized `category_shop_counts` (refreshed by triggers), and `get_shops_page(...)` RPC — while pages like `Home.tsx` and `Shops.tsx` can still read `shops_with_claim` for backward-compatible full column projection.
- **Recommendation:** File-by-file adoption — Home first, then Shops list. Keep `shops_with_claim` as the write/detail path; the new views are read-only projections.
