# Technical Debt

> For each entry: *what it is · where · why it's debt · status / recommendations*.

---

## Duplicate / Conflicting Logic

### Dual Supabase Type Files (`external-types.ts` vs partial `types.ts`)
- **What:** `src/integrations/supabase/client.ts` imports `./external-types` (a lightweight permissive wrapper defining `AppRole` + `AnyTable` helper for dynamic tables), while a static auto-generated snapshot `src/integrations/supabase/types.ts` (21 older tables, lacking `schools`, `school_notices`, `local_news`, etc.) remains in the repository and is still imported via `type Database` in [`MessCsvImportModal.tsx`](file:///c:/Users/Asus/Downloads/muktainagar-daily-main/src/components/admin/MessCsvImportModal.tsx) and [`PGCsvImportModal.tsx`](file:///c:/Users/Asus/Downloads/muktainagar-daily-main/src/components/admin/PGCsvImportModal.tsx).
- **Why it's debt:** Table definitions in `types.ts` are stale relative to the 42 live PostgreSQL tables/views in production, forcing dynamic `(supabase as any)` casts across newer modules (`schoolsRepo`, `newsService`, `storageHealthService`, `MasterExportModal`).
- **Recommendation:** Regenerate `types.ts` from the linked live Supabase schema (`fhlaqgzensagjangkpop`) with `supabase gen types typescript` and reconcile `external-types.ts` onto a single generated `Database` type.

### Parallel Reviews Pipelines (`shop_reviews` & `school_reviews`) + Legacy `mockReviews.ts`
- **What:** Businesses use `shop_reviews` + `shop_review_helpful` + `get_shop_rating`, while Education uses `school_reviews` + `school_review_helpful` + `get_school_rating` / `get_schools_rating_summary`, unified in React via `src/lib/reviewsApi.ts` (`entityType: 'shop' | 'school'`). A static `src/lib/mockReviews.ts` module also still sits in `src/lib/`.
- **Why it's debt:** Schema triggers, helpful-vote counters, and RLS rules are duplicated per entity table whenever a new reviewable vertical is added (e.g., civic services or living entities outside `shops`).
- **Status:** Cleanly separated with proper FKs (`REFERENCES shops(id)` / `REFERENCES schools(id)`); audit whether `mockReviews.ts` is still referenced anywhere before deleting.

### `shops.is_open` boolean vs computed open/closed
- **What:** Boolean kept for instant quick-toggle in `MyShop` / admin UI; true open/closed status is computed from `opening_time` / `closing_time` via `shopUtils.ts > isShopOpen()`.
- **Why it's debt:** Two signals for "is this shop open".
- **Status:** Marked legacy in schema comments.

### Minor Comment Drift in Master Dataset Registry
- **What:** Header JSDoc comments in `src/lib/admin/masterDatasets.ts`, `MasterExportModal.tsx`, and `MasterImportModal.tsx` say `"19 directory/platform tables"`, whereas `MASTER_DATASETS` exports **20 table datasets** (`categories`, `shops`, `shop_categories`, `mess_profiles`, `mess_daily_menus`, `pg_profiles`, `schools`, `school_notices`, `school_claims`, `bus_timetable`, `bus_stand_info`, `news_sources`, `local_news`, `banners`, `authority_departments`, `authority_organizations`, `authority_announcements`, `announcement_locations`, `requests`, `claims`) plus `'images'`.
- **Recommendation:** Update JSDoc comments to match `MASTER_DATASETS.length` (`20`) on next touch.

---

## Legacy Code

### `shops.category_id` column
- **What:** Single-category FK on `shops` (`idx_shops_category_id`), retained for backward compat alongside `shop_categories`.
- **Why it's debt:** Modern app flows exclusively write/read `shop_categories`.
- **Recommendation:** Drop column after confirming all historical CSV templates omit it cleanly.

### Legacy `schools` Bracket Tag Encoding in `description`
- **What:** Older school records stored `[Type: ...]`, `[Board: ...]`, `[Streams: ...]`, `[Facilities: ...]` tags inside `schools.description`. Migration `20261112000000_education_portal_and_owner_hub.sql` non-destructively backfilled them into typed columns, while `schoolHelpers.ts` still preserves read fallback (`getSchoolResolvedMeta`) and serialization (`serializeSchoolDescription`).
- **Why it's debt:** Dual read path while mixed legacy/structured CSVs or older clients exist.
- **Recommendation:** Keep read fallback until all legacy data sources are retired, then simplify `serializeSchoolDescription`.

### `AdminLogin.tsx` & `claim_first_admin` RPC
- **`src/pages/AdminLogin.tsx`:** 7-line wrapper redirecting to `/auth?next=%2Fadmin%2Foverview` (lazy route chunk for a one-line `<Navigate>`).
- **`claim_first_admin` RPC:** Historical one-shot bootstrap function no longer needed once initial admins are seeded.

---

## Refactor Opportunities

### Dev/Preview Middleware vs Production Edge Scraper (`/api/news-proxy` vs `scrape-local-news`)
- **What:** `vite.config.ts` bundles `localNewsProxyPlugin` at `/api/news-proxy` for local `vite dev` / `vite preview`, while production deployments rely on the deployed `scrape-local-news` Supabase Edge Function (`newsService.ts`).
- **Why it's debt:** Two HTTP fetch/parse entry points must stay aligned on RSS/Atom/HTML extraction rules and SSRF checks (`isBlockedHost()` in `vite.config.ts` vs Edge Function domain handling).
- **Recommendation:** Route local scraping through `supabase functions serve` or ensure shared parser test parity between both paths.

### Unadopted Server Read Optimizations
- **What:** Database ships slim `shops_list_public`, `shops_search_public`, `category_shop_counts` MV, `get_shops_page(...)`, `search_shops` (`pg_trgm`), and `get_trending_shops` (`shop_engagement_stats`), while `Home.tsx` / `Shops.tsx` primarily read `shops_with_claim` + client Fuse.js.
- **Recommendation:** Adopt `shops_list_public` / `get_shops_page` file-by-file as shop volume scales past a few thousand listings per town, and expose a Home "Trending" carousel backed by `get_trending_shops`.

### Legacy Flat Route Redirects & Hardcoded `Footer.tsx` State
- **Legacy routes:** `LegacyCityRedirect` preserves flat paths (`/shops`, `/schools`, `/mess`, `/pg`, `/services`, `/news`, `/saved`); audit any remaining internal `<Link>` or docs targeting flat routes instead of `/:citySlug/...`.
- **Commented-out Vibe Forge footer attribution:** In [`Footer.tsx`](file:///c:/Users/Asus/Downloads/muktainagar-daily-main/src/components/shared/Footer.tsx#L21-L54) and [`UserMenuDrawer.tsx`](file:///c:/Users/Asus/Downloads/muktainagar-daily-main/src/components/UserMenuDrawer.tsx#L805-L835), the `"Built for Vibe Forge Hackathon"` block (`vibe-forge.in`) is wrapped in JSX comments while hidden. Clean up or re-enable deliberately via feature config rather than commented blocks when finalizing production branding.

### Banner "Fallback Chain" Duplication
- **What:** Multiple `BannerSlot` consumers pass `fallback="homepage_inline"` manually.
- **Recommendation:** Centralize default placement fallbacks inside `useBannersForPlacement`.

---

## Resolved Risk Areas

- **~~Storage root listing bug hiding shop photos & causing 409 collisions~~ — RESOLVED 2026-11-13 (`20261113000000_storage_and_health_fixes.sql`):** Replaced `(storage.foldername(name))[1] <> 'claims'` with `IS DISTINCT FROM 'claims'` so root-level objects in `shop-images` enumerate cleanly via `.list('')`, and added `Admins manage all shop-images`.
- **~~Missing `image_checked_at` / `image_broken_at` columns causing 42703 errors~~ — RESOLVED 2026-11-13 (`20261113000000`):** Idempotently added both timestamp columns + partial indexes across `public.shops`, `public.schools`, and `public.banners`, paired with `get_system_health_snapshot()` diagnostics.
- **~~Dual-owner `shopkeeper` role strip bug~~ — RESOLVED 2026-11-12 (`20261112000000_education_portal_and_owner_hub.sql`):** Updated `revoke_shop_owner` and `revoke_school_owner` to verify both `shop_owners` and `school_owners` before deleting `'shopkeeper'` from `user_roles`.
- **~~CSV multiline corruption & formula injection~~ — RESOLVED 2026-11-11 (`csvUtils.ts` + `masterDatasets.ts`):** Replaced naive line splitting with RFC 4180 state-machine parsing (`parseCsv`), escaped leading `= + - @ \t \r` cells, and properly serialized `text[]` / JSONB columns.
- **~~Single storage bucket for all uploads~~ — RESOLVED 2026-07-05 (`2026-07-05_bucket_split.sql`):** Split cleanly across `shop-images`, `school-images`, `request-images`, and `banner-images` via `src/lib/storageNaming.ts`.

---

## Remaining Risks & Knowledge Gaps

- **`shop_engagement.event_type` naming drift:** `engagement.ts` logs `'directions'` while UI analytics displays `"Maps"`; `school_engagement` uses `'maps'`. Unifying `'directions'` → `'maps'` via migration + constraint would remove dual checks.
- **Hardcoded Supabase configuration (`client.ts` & `src/lib/mcp/supabaseClient.ts`):** URL & anon key remain hardcoded intentionally to guard against preview/sandbox env resets; key rotation requires a coordinated code commit.
- **MyMemory translation quota:** Free-tier / registered `&de=` limit relies on the 3-tier cache (`memory → localStorage → translation_cache`); consider migrating batch translation to Gemini if quota saturation occurs across multi-town onboarding.
- **DR Restore Verification:** `MasterExportModal` / `MasterImportModal` round-trip logic is tested via Vitest unit specs (`ExportImportRegression.test.ts`), but periodic end-to-end staging DB restores of full 20-dataset ZIP bundles (including binary images) should still be rehearsed before major releases.
- **Documentation Maintenance:** Ensure historical audit snapshots (`docs/FORGE_REPORT.md`, `docs/FORGE_RECOMMENDATIONS.md`, `docs/MPULSE_REPORT.md`) stay clearly marked as point-in-time historical archives rather than current-state specs.
