# Sentinel Context

> Written for **Sentinel**'s consumption. Use the Protected Systems Framework labels verbatim so a designation here maps 1:1 onto a deletion-safety decision Sentinel makes later.

## Critical Workflows (must not break)

1. **Visitor → ShopDetail → Call/WhatsApp** — the directory's reason to exist. Any regression in shop loading, slug routing, guest RLS visibility (`has_role` / `is_shop_owner` anon EXECUTE grants), or desktop/mobile call actions (`handleTelLinkClick` / `CallNumberDialog`) is a P0.
2. **Multi-Town Resolution & Routing** (`RootCityRedirect` → `CityRouteGuard` → `useCity` → scoped queries, with `LegacyCityRedirect` preserving flat URLs). Breaking city routing breaks all localized listings.
3. **Sahayak AI Town Assistant, Voice Search & AI Marathi Fallback** (`TownAssistantDrawer` → `assistantService` → `town-assistant` Edge Function + local deterministic fallback across 7 entity types + `{ mode: 'translate' }` for `translateApi.ts`). Breaking the fallback leaves citizens stranded when Edge/Gemini keys are unavailable.
4. **Listing request submission with Guest Intent Preservation** (`ListShopModalHost` / `open-list-shop-modal` → auth-gate redirect `/auth?next=...&list-shop=<entity>` → `RequestListingModal` (`initialEntityType`) → `shop_requests` INSERT). Multi-entity public growth pipeline for Shops, Mess, PG, and Schools. Do not break `'open-list-shop-modal'` event naming or strip `?list-shop=` redirect resume.
5. **Admin request approval** (`InboxTab` > `RequestsTab` > Approve) — validates phones/duplicates, converts into live `shops`/`mess_profiles`/`pg_profiles`/`schools`, and migrates photos to `shop-images` or `school-images`.
6. **Owner shop edit with concurrency guard** (`MyShop` → `updateShopWithConcurrency`). Removing `WHERE updated_at=$2` re-introduces silent last-writer-wins data loss between admin and owner.
7. **Shop & Institute Claim Approval + Owner Hubs** (`ClaimShopModal` / `ClaimSchoolModal` → `approve_shop_claim` / `approve_school_claim` → `MyShop` / `SchoolOwnerHub` / `MessOwnerHub` / `PGOwnerHub`). Bypasses grant unverified users `'shopkeeper'` role + owner write access.
8. **Education Portal & Notice Board** (`Schools` → `SchoolDetail` → `school_notices` → `updateSchoolAsOwner`). Structured columns, UDISE/AISHE fields, and `trg_protect_school_admin_columns` must stay aligned.
9. **Living Verticals & Detail Pages** (`/mess`, `/mess/:id`, `/pg`, `/pg/:id`) — dedicated student food & housing discovery plus owner menu/vacancy portals.
10. **Local News Feed & Live Scraper** (`/news`, `LocalNewsTab` → `scrape-local-news` / Vite `/api/news-proxy`) — IST date grouping, deduplication, and SSRF protection.
11. **Essential Services & Civic Authorities** (`/services`, `GovernmentServicesTab`) — outage broadcasts & emergency helplines (strictly in-memory officer PII).
12. **Master Backup & Restore + Per-Module CSV** (`MasterExportModal` / `MasterImportModal` / `masterDatasets.ts` + `csvUtils.ts`) — FK-safe 20-dataset export/restore with array/JSONB round-trip & formula-injection escaping.
13. **Storage Audit & System Health Suite** (`/admin/system/quality` → `DataQualityTab` + 4 health panels + `storageHealthService.ts`). Dropping 8-table reference tracking risks deleting live images as false orphans.
14. **Banner serve flow** with 3-layer kill switch (`VITE_ADS_ENABLED` → `md_ads_runtime` → per-banner `is_active`).
15. **Marathi content overlay** (`useLocalizedShop` / `useLocalizeCategoryName` / native `*_mr` columns). Bilingual UX is a core promise.
16. **Customer Reviews & Ratings** (`reviewsApi.ts` + `ReviewsSection` + `WriteReviewSheet` on `shop_reviews` & `school_reviews`).

## Protected Systems

### Business Critical
- `src/pages/Home.tsx`, `Shops.tsx`, `ShopDetail.tsx`, `SavedShops.tsx` — primary business discovery & bookmarks.
- `src/pages/Mess.tsx`, `MessDetail.tsx`, `PG.tsx`, `PGDetail.tsx` — living vertical discovery and detail surfaces.
- `src/pages/Schools.tsx`, `SchoolDetail.tsx` — Education Portal directory, live notices, admissions, and institute engagement/reviews.
- `src/pages/LocalNews.tsx`, `EssentialServices.tsx`, `BusTimetable.tsx` — daily civic utility verticals.
- `src/components/TownAssistantDrawer.tsx` + `src/lib/assistant/assistantService.ts` + `supabase/functions/town-assistant/index.ts` — Sahayak AI voice/text assistant & fallback engine.
- `src/components/ShopCard.tsx` + `src/components/home/*` — primary discovery cards & Home search/category surfaces.
- `src/components/shared/Footer.tsx` — standardized shared footer (`home.footer` copyright/branding; Vibe Forge hackathon credit to `vibe-forge.in` is currently intentionally commented out here and in `UserMenuDrawer.tsx` About section).
- `src/components/shared/CallNumberDialog.tsx` + `src/components/shared/DemoBadge.tsx` + `src/lib/engagement.ts` — desktop `tel:` interception modal (`handleTelLinkClick`) and Parandwadi demo indicators.
- `src/components/shared/MultiImageCropPicker.tsx` + `PhotoSlider.tsx` — multi-image upload, WebP compression, and gallery slider/lightbox.
- `src/components/RequestListingModal.tsx` + `src/components/ListShopModalHost.tsx` — singleton listing wizard (`'open-list-shop-modal'`, auth-gated with preserved `?next=...&list-shop=` resume and entity autofill).
- `src/pages/MyShop.tsx` + `src/lib/shopConcurrency.ts` + `src/lib/schoolConcurrency.ts` + `src/components/myshop/{MessOwnerHub,PGOwnerHub,SchoolOwnerHub}.tsx` — concurrency/privilege-guarded owner editors across shops, messes, PGs, and educational institutes.
- `src/components/admin/layout/{AdminLayout,AdminSidebar,BranchTabs,adminNav}.ts` + `InboxTab.tsx` + `RequestsTab.tsx` — modular admin shell and single moderation path (`adminNav.ts` is the sole route registry).
- `src/components/admin/{MasterExportModal,MasterImportModal}.tsx` + `src/lib/admin/masterDatasets.ts` + `src/lib/csvUtils.ts` — 20-table disaster recovery, RFC 4180 CSV parser, and formula-injection sanitizer.
- `src/components/admin/DataQualityTab.tsx` + `src/components/admin/health/*` + `src/lib/admin/{storageHealthService,dataQualityHelpers}.ts` — system diagnostics, 8-table storage orphan audit, claim proof PII purge, and broken-URL scanner.
- `src/components/admin/CategoryMergeModal.tsx` — conflict-safe merge logic (`toReassign` / `toDelete`).
- `src/lib/banners/*` + `src/components/banners/*` — revenue-bearing ad stack.
- `src/lib/repos/*` + `src/lib/entities/*` + `src/components/admin/_shared/EntityTab.tsx` — Entity Framework foundation.
- `src/lib/storageNaming.ts` + `src/lib/images/imageService.ts` — canonical bucket routing (`shop-images`, `school-images`, `request-images`, `banner-images`) and root `.list('')` helper (`listAllShopImageObjects`).

### Architecture Critical
- `src/App.tsx` — full route tree (`/my-institute`, `/:citySlug/*`, `/admin/*`), `ProtectedRoute`, `RootCityRedirect`, `CityRouteGuard`, `LegacyCityRedirect`.
- `src/hooks/useCity.tsx` + `src/lib/geo/geoService.ts` + `src/components/shared/{LocationPill,CityPickerModal}.tsx` — multi-town & village context.
- `src/integrations/supabase/client.ts` — **hardcoded** project URL + anon key (do not replace with bare `import.meta.env` without verifying build environments).
- `src/hooks/useAuth.tsx` — role-derivation with `setTimeout(0)` deferral avoiding Supabase auth-state deadlock.
- `src/i18n/index.tsx` — locale initialization order (`URL → localStorage → default`).
- `vite.config.ts` — `@` alias, `localNewsProxyPlugin` (`/api/news-proxy` dev/preview middleware with `isBlockedHost` SSRF filter), `mcpPlugin()` (generates `supabase/functions/mcp/index.ts`), and `VitePWA` manifest/caching. Never hand-edit `supabase/functions/mcp/index.ts`.
- `scripts/prerender.ts` + `scripts/generate-sitemap.ts` — SEO prerender & sitemap hooks.

### Security Critical
- **Storage root & claim proof RLS (`20261113000000`):** `storage.objects` SELECT policy on `shop-images` MUST use `((storage.foldername(name))[1] IS DISTINCT FROM 'claims')` so root shop images remain listable while `claims/` proofs stay private to admins/owners.
- **Shop & School owner column guards:** DB triggers `shops_owner_column_guard` (`shops`) and `trg_protect_school_admin_columns` (`schools`) block non-admin privilege/geo/moderation/verified-UDISE tampering. Frontend strips payloads via `pickOwnerEditable` / `pickOwnerEditableSchool`.
- **Rate-limit triggers:** `trg_shop_claims_rate_limit`, `trg_school_claims_rate_limit`, `trg_school_reviews_rate_limit` (max 5/24h), `trg_school_engagement_rate_limit` (max 20/min anon).
- **Dual-owner role integrity:** `revoke_shop_owner` & `revoke_school_owner` must BOTH check remaining rows across `shop_owners` AND `school_owners` before deleting `'shopkeeper'` from `user_roles`.
- **SECURITY DEFINER & anon EXECUTE revocations:** `has_role`, `is_admin`, `is_school_owner`; anon EXECUTE revoked on `assign_shop_owner`, `revoke_shop_owner`, `approve_shop_claim`, `reject_shop_claim`, `assign_school_owner`, `revoke_school_owner`, `approve_school_claim`, `reject_school_claim`, `refresh_engagement_stats`, and `get_system_health_snapshot`.
- **CSV formula neutralization & URL validation:** `csvUtils.ts` escapes leading `= + - @ \t \r`; `isSafeHttpUrl()` / `schools_*_http` / `news_*_http` DB constraints prevent `javascript:` URLs.
- **SSRF protection:** `/api/news-proxy` (`isBlockedHost` in `vite.config.ts`) and `scrape-local-news` block loopback/private/metadata hosts.
- **MCP security:** `mcp_endpoints` admin-only RLS (`credential_ref` stores secret name only, never token); `mcp` Edge Function requires OAuth `authenticated` audience; `OAuthConsent.tsx` validates consent flows.
- **Reviews & Profile boundaries:** `profiles` private vs `profiles_public` view, `trg_profiles_lock_username`, `shop_reviews_unique_per_user`, `school_reviews_unique_per_user`, `safeRelativePath()` open-redirect guard, and `"Sponsored"` labels in `InlineBanner`/`BannerPopup`.

### Historical Compatibility Layer
- `shops.category_id` column — deprecated single-category FK kept for compat alongside `shop_categories`.
- `shops.is_open` boolean — legacy quick toggle; `isShopOpen()` computes truth from `opening_time`/`closing_time`.
- `schools` bracket tags (`[Type: ...]`, `[Board: ...]`, `[Streams: ...]`) — backfilled into structured columns; fallback parser retained in `schoolHelpers.ts`.
- `/admin/login` route (`AdminLogin.tsx`) — redirect shim preserved for bookmarks.
- `external-types.ts` — runtime Supabase client types; `types.ts` kept as partial 21-table snapshot referenced by `MessCsvImportModal` and `PGCsvImportModal`.

### Planned Future Systems
- Sections marked `'soon'` in `adminNav.ts`: `hospitals`, `banks`, `lostfound` (Phase 4b).
- Server RPCs ready for deeper client adoption: `search_shops` (`pg_trgm`), `get_trending_shops` + `shop_engagement_stats` MV, `get_shops_page`, `shops_list_public`, `shops_search_public`.
- `claim_first_admin` one-shot bootstrap RPC.

## Business Critical Features

| Feature | Why critical |
|---|---|
| Phone-call & WhatsApp actions | Primary citizen conversion metric across Shops, Mess, PG, Schools, Civic Services |
| Bilingual (EN/MR) content & voice AI | Core accessibility & trust promise across rural & urban users |
| Multi-town & village scoping | Regional scaling engine (`muktainagar`, `parandwadi`, etc.) |
| Sahayak AI Assistant + offline fallback | Cross-vertical discovery in natural language + Marathi |
| Education Portal + School Owner Hub | Structured school/college directory, admissions, fees & verified notices |
| Mess & PG Owner Hubs | Real-time daily menus & live bed vacancy updates |
| Local News + RSS/HTML Scraper | Daily hyperlocal engagement surface with IST grouping |
| Moderation queue (requests + claims) | Editorial verification across both businesses and institutes |
| Master Backup/Restore (20 datasets) + Storage Audit | Operational safety, PII cleanup, and disaster recovery |
| Banner system with `"Sponsored"` labels | Monetization with editorial separation |
| Customer reviews & ratings | Community trust across both shops and schools |

## Known Dependencies

| Dependency | Used by | Impact if removed |
|---|---|---|
| `@supabase/supabase-js` | Everything | Total breakage |
| `@tanstack/react-query` | All data-fetching & cache invalidation | Data & mutation flows fail |
| `react-router-dom` v6 | `App.tsx` + all pages | Routing breaks |
| `@lovable.dev/mcp-js` | `vite.config.ts` `mcpPlugin`, `src/lib/mcp/*` | MCP Edge bundle generation breaks |
| `lucide-react` | All icons | UI fails visually |
| `react-hook-form` + `zod` | Forms & request validation | Validation breaks |
| `react-easy-crop` | `ImageCropPicker`, `MultiImageCropPicker` | Photo crop/upload breaks |
| `fuse.js` | Home & Shops search | Client fuzzy search breaks |
| `jszip` | `MasterExportModal`, `MasterImportModal` | ZIP backup/restore breaks |
| `@types/google.maps` | `LocationMapPicker`, `mapsUtils` | Pin-drop map picker fails |
| `react-helmet-async` | `PageSeo` across routes | Meta & JSON-LD SEO breaks |
| MyMemory API | `translateApi.ts` | EN→MR auto-translation degrades |
| Gemini Gateway + Web Speech API | `town-assistant`, `TownAssistantDrawer` | Sahayak AI drops to local deterministic fallback / text-only |
| Supabase Realtime | `MyShop` | Live admin/owner sync stops |
