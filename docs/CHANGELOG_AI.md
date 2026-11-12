# AI-Maintained Changelog

> Append new entries — never edit or delete prior entries.

---

## 2026-11-12 — Guest Visibility, Examiner Mode, Forgiving Omni-Search, Desktop Dialing, OSM Maps, Genuine Menu Autofill & AI Marathi Fallback

### Discovery, Search & Sahayak AI
- **Guest Visibility & Reviewer Attribution (`supabase/migrations/20261115000000_guest_rls_reviews_and_examiner_admin.sql`, `src/lib/reviewsApi.ts`, `src/pages/ShopDetail.tsx`, `src/pages/MessDetail.tsx`, `src/pages/PGDetail.tsx`):**
  - Restored `anon, authenticated` `EXECUTE` grants on RLS helper predicates (`has_role`, `is_shop_owner`, `is_school_owner` with NULL short-circuiting), updated `"Shops are publicly readable"` SELECT policy, and ensured explicit `SELECT` grants so unauthenticated visitors can browse all Shops, Messes, PGs, and Schools as intended.
  - Fixed HTTP `400 Bad Request` on `shop_reviews` by replacing the broken embedded `profiles!shop_reviews_user_id_fkey` PostgREST join with the new `SECURITY DEFINER` RPC `get_public_reviewer_names(_user_ids uuid[])`, alongside `get_claimed_shop_ids(_shop_ids uuid[])` for safe public claim badges.
- **Guest Auth-Gate & Preserved Listing Intent (`src/components/ListShopModalHost.tsx`, `src/pages/Auth.tsx`, `src/components/RequestListingModal.tsx`):**
  - Clicking "List New Business / Mess / PG / School" as an unauthenticated guest now shows a friendly notification and routes to `/auth?next=<currentPath>&list-shop=<entityType>`. Upon completing Sign In or Sign Up, users are redirected back and `RequestListingModal` automatically opens with `initialEntityType` pre-selected.
- **Forgiving Bus Search & Homepage Omni-Search (`src/lib/bus/busHelpers.ts`, `src/pages/BusTimetable.tsx`, `src/components/home/HomeSearch.tsx`, `src/pages/Home.tsx`, `src/pages/Mess.tsx`):**
  - Added `matchesForgivingBusQuery()` and `scoreForgivingMatch()` combining prefix matching, ordered character subsequence matching (e.g. `"ng"` → `"Nigdi"`), phonetic normalization (`"talegav"` → `"Talegaon"`), and Damerau-Levenshtein transposition/typo tolerance (`"nidgi"` → `"Nigdi"`), plus an **Ask Sahayak AI** button when zero routes match.
  - Upgraded `HomeSearch` to unified omni-search across Shops, Messes (+ Today's Menus/specials), PGs, Schools/Institutes, and Bus Routes with entity-type badges and Sahayak AI fallback trigger.
  - Upgraded `/mess` search bar with a forgiving second-tier fallback across `today_menu` (`special_tag`, `lunch_text`, `dinner_text`), `latest_menu`, and Regular Menu items (`menu_items`).
- **Sahayak AI & AI Marathi Fallback (`supabase/functions/town-assistant/index.ts`, `src/components/TownAssistantDrawer.tsx`, `src/lib/translateApi.ts`):**
  - Added a session-dismissible **20-second idle nudge pill** next to the Sahayak floating button inviting visitors to try AI assistance, plus support for `open-town-assistant` custom events from fallback search prompts.
  - Fixed Sahayak PG & Today's Menu retrieval by querying `mess_profiles` and `pg_profiles` directly alongside `shops` (preventing shop-limit truncation) and separating Today's Menu (`menu_date = today` IST) + Regular Menu (`1970-01-01`) + cook/special intent detection (`isSpecialFood`).
  - Added **`mode: 'translate'`** batch translation mode in `town-assistant` (Gemini Gateway + REST fallback) wired as **Layer 5 fallback** in `src/lib/translateApi.ts` whenever MyMemory quota limits, fails, or returns untranslated English.

### UX, Maps, Examiner Mode & Admin Operations
- **Desktop `tel:` Handling (`src/lib/engagement.ts`, `src/components/shared/CallNumberDialog.tsx`, `src/App.tsx`):** Intercepted desktop `tel:` clicks via `handleTelLinkClick()` to prevent Chromium's `"Failed to launch 'tel:...' because the scheme does not have a registered handler"` console error and instead present `<CallNumberDialog />` with formatted display, clipboard copy, and conditional WhatsApp quick link.
- **Zero-Config OpenStreetMap Default (`src/components/shared/LocationMapPicker.tsx`):** Switched default interactive map rendering to Leaflet/OpenStreetMap with optional Google Maps enhancement (gated on `VITE_GOOGLE_MAPS_API_KEY` + `gm_authFailure` auto-fallback), eliminating `RefererNotAllowedMapError` on localhost/Vercel URLs.
- **Parandwadi Demo Badges (`src/components/shared/DemoBadge.tsx`):** Surfaced bilingual `Demo / डेमो` badges on Parandwadi sample shops, messes, PGs, and schools.
- **User Drawer, Cache Clear & About Refresh (`src/components/UserMenuDrawer.tsx`):** Renamed buttons (`List New Business`, `My Businesses`, `Saved`), removed redundant `My Institutes`, added an animated multi-step Clear Cache progress bar (with WebView/missing-`indexedDB` guards + Reload action), and updated the About drawer feature list across all live verticals.
- **Production Examiner Mode & Genuine Menu/Entity Autofill (`src/lib/devHelpers.ts`, `src/pages/Auth.tsx`, `src/lib/living/sampleMenuGenerator.ts`, `src/pages/admin/DirectoryMess.tsx`, `src/components/admin/MessModal.tsx`):**
  - Renamed Dev 1-Tap Admin Login to **`Examiner Mode (1-Tap Admin)`** (`EXAMINER_MODE_ENABLED = true`), active in production for external reviewers, and granted `admin-test@apnalocal.in` full `'admin'` role + write RLS parity on `category_translations`, `shop_translations`, `amenity_translations`, `shops`, and admin tables.
  - Upgraded listing form autofill to supply entity-appropriate dummy datasets (`shop`, `mess`, `pg`, `school`) via `getEntityAutofillSample()` and `getMessModalAutofillSample()`.
  - Added dual-tab `MessMenuQuickModal` (`Today's Menu` + `General Menu Card`) in `DirectoryMess` with dietary-aligned (`pure_veg`, `veg_nonveg`, `jain_available`) **`Auto-fill Genuine Menu`** powered by `generateSampleMessMenu()`.

### Verification
- Expanded test suite to **32 test files (275 tests)** including `src/test/ComprehensiveFixes.test.tsx`, Damerau-Levenshtein forgiving bus search tests (`BusTimetable.test.tsx`), dietary menu generator specs (`MessMenuFeatures.test.ts`), and Gemini AI Marathi fallback tests (`MarathiTranslation.test.ts`).

---

## 2026-11-08 → 2026-11-13 — Essential Services, Local News, Sahayak AI v2, Education Portal, Storage & Health Suite, Export/Import v2 & Documentation Sync

### Features & Verticals
- **Education Portal v2 & School Owner Hub (`supabase/migrations/20261112000000_education_portal_and_owner_hub.sql`, `src/pages/SchoolDetail.tsx`, `src/components/ClaimSchoolModal.tsx`, `src/components/myshop/SchoolOwnerHub.tsx`, `src/lib/schools/`):**
  - Expanded `schools` with ~30 structured columns (`slug`, `whatsapp`, `is_verified`, `is_claimed`, `management_type`, `gender_type`, `udise_aishe_code`, `established_year`, `accreditation`, `board`, `classes_offered`, `mediums[]`, `streams[]`, `facilities[]`, `principal_name`, `office_timing`, `admission_status`, `admission_deadline`, `admission_url`, `prospectus_url`, `fee_tier`, `annual_fee_min/max`, `scholarships[]`, `required_documents[]`, `transport_villages[]`, `coaching_focus[]`, `total_seats`, `available_seats`, `meta`).
  - Added dedicated public institute detail route (`/:citySlug/schools/:id`, legacy `/schools/:id`), live `school_notices` circulars, institute `school_reviews` + `school_review_helpful` (with `get_school_rating` & `get_schools_rating_summary` RPCs), `ClaimSchoolModal`, `school_engagement` analytics, WhatsApp admission enquiry builder, and `/my-institute` (`SchoolOwnerHub`) with optimistic concurrency (`src/lib/schoolConcurrency.ts`) and DB trigger column guard (`protect_school_admin_columns`).
  - Added optional SQL demo seed `docs/patches/2026-11-12_seed_education_notices_reviews.sql` and unit tests (`SchoolsPublic.test.tsx`, `EducationAdmin.test.ts`).
- **Local News Module & Automated RSS Scraper (`supabase/migrations/20261111000000_local_news_module.sql`, `supabase/functions/scrape-local-news/index.ts`, `src/pages/LocalNews.tsx`, `src/components/admin/LocalNewsTab.tsx`, `src/lib/news/`):**
  - Added `news_sources` and `local_news` tables with `(city_id, source_url)` deduplication and RLS.
  - Added public `/:citySlug/news` (`/news` redirect) feed with category/date filters, pinned notices, and auto-seed refresh, plus `LocalNewsTab` admin console and SSRF-safe `/api/news-proxy` dev middleware (`vite.config.ts`). Tested via `LocalNews.test.tsx`.
- **Sahayak AI v2 & 7-Tool MCP Server (`supabase/functions/town-assistant/index.ts`, `src/components/TownAssistantDrawer.tsx`, `src/lib/assistant/assistantService.ts`, `src/lib/mcp/index.ts`):**
  - Upgraded Sahayak AI to query all **7 entity verticals** (`mess`, `pg`, `shop`, `bus`, `school`, `news`, `service`), added Parandwadi PMPML/MSRTC bus seeds, IST clock awareness, multi-turn history, and browser Web Speech API voice input in `TownAssistantDrawer`.
  - Expanded `muktainagar-daily-mcp` from 4 to **7 OAuth-protected read-only tools** by adding `get_local_news`, `search_schools`, and `get_civic_services` (`src/lib/mcp/tools/`).
- **Essential Services & Security Hardening v3 (`docs/patches/2026-11-08_essential_services_schema.sql`, `2026-11-09_security_hardening_v3.sql`, `src/pages/EssentialServices.tsx`, `src/components/admin/GovernmentServicesTab.tsx`):**
  - Launched civic authorities & emergency helplines directory (`authority_departments`, `authority_organizations`, `authority_announcements`, `announcement_locations`, `authority_admin_grants`), in-memory officer PII protection, `get_shops_page` resource bounds, explicit Mess/PG DELETE policies, and `mcp_endpoints` lock-down.
- **Mess & PG Detail Pages + Owner Hubs (`src/pages/MessDetail.tsx`, `src/pages/PGDetail.tsx`, `src/components/myshop/MessOwnerHub.tsx`, `src/components/myshop/PGOwnerHub.tsx`):**
  - Launched public `/:citySlug/mess/:id` and `/:citySlug/pg/:id` detail views with PhotoSlider, ReviewsSection, fixed-price menu cards (`MessMenuCardManager`), and Simple / Room-by-Room bed vacancy controls.

### Admin, Data Quality & Export/Import v2
- **Storage & System Health Suite (`supabase/migrations/20261113000000_storage_and_health_fixes.sql`, `src/components/admin/health/`, `src/lib/admin/storageHealthService.ts`, `src/lib/admin/dataQualityHelpers.ts`):**
  - Moved Quality from Directory to **System › Storage & Health** (`/admin/system/quality`; `/admin/directory/quality` redirects cleanly).
  - Fixed `storage.objects` root listing RLS (`(storage.foldername(name))[1] IS DISTINCT FROM 'claims'`) eliminating 409 upload collisions, added admin policy across `shop-images`, extended `image_checked_at`/`image_broken_at` to `schools` & `banners`, and added `get_system_health_snapshot()` RPC.
  - Built 4 modular diagnostic panels (`SystemDiagnosticsPanel`, `StorageAuditPanel`, `ListingHygienePanel`, `AreaDuplicatesPanel`) supporting Devanagari-safe area normalization, 8-table media reference extraction, expired resolved claim proof purging, and unified media probing.
- **20-Dataset Master Backup & Hardened RFC 4180 CSV Export/Import (`src/lib/csvUtils.ts`, `src/lib/admin/masterDatasets.ts`, `src/components/admin/*CsvImportModal*` / `*BulkImportModal*`):**
  - Replaced single-line CSV splitting with an RFC 4180 state machine, formula-injection escaping, UTF-8 BOM Marathi compatibility, and `>1,000`-row pagination (`fetchAllPaged`).
  - Upgraded `MasterExportModal` & `MasterImportModal` to cover **20 datasets across 20 platform tables** in FK-safe order (`MASTER_DATASETS` + `coerceDatasetRow()`) plus organized `/images` ZIP folders.
  - Wired per-module CSV export & import across Shops, Mess (`MessCsvImportModal`), PG (`PGCsvImportModal`), Categories, Inbox (Claims & Owners), Schools (45-col `SCHOOL_CSV_EXPORT_HEADERS` + `SchoolBulkImportModal`), Bus (`BusBulkImportModal`), Local News (`NewsCsvImportModal`), Essential Services (`AuthorityCsvImportModal`), Ads (14-col CTR CSV), Analytics, and Quality audits.

### UI, PWA & Configuration
- **Footer & PWA Metadata (`src/components/shared/Footer.tsx`, `index.html`):** Temporarily commented out the "Built for Vibe Forge Hackathon" attribution link in `Footer.tsx` while keeping `home.footer` copyright live; added `<meta name="mobile-web-app-capable" content="yes" />` alongside existing Apple web-app tags in `index.html`.

### Documentation Sync
- Updated `README.md`, `PROJECT_BIBLE.md`, `ARCHITECTURE.md`, `MULTI_LOCATION_ARCHITECTURE.md`, `DATABASE_REFERENCE.md`, `API_REFERENCE.md`, `ADMIN_SYSTEM.md`, `FEATURES.md`, `WORKFLOWS.md`, `COMPONENT_CATALOG.md`, `SENTINEL_CONTEXT.md`, `TECHNICAL_DEBT.md`, and `VERCEL_MIGRATION_PLAN.md` to match the verified codebase and migrations (42 public tables, 3 Edge Functions, 7 MCP tools, 20-dataset backup, 31 test files / 252 tests).

---

## 2026-10-24 — Multi-Town / Village Regional Directory Platform Transformation

### Architecture & Routing (Option B Implementation)
- **Path-based multi-town routing (`src/App.tsx`).** Enabled path-scoped routing (`/:citySlug`, `/:citySlug/shops`, `/:citySlug/shop/:id`, `/:citySlug/bus-timetable`, `/:citySlug/schools`, `/:citySlug/sections/:key`).
- **Clean backward-compatible redirects.** Root `/` dynamically redirects to active town (`/${currentCity.slug}`). Legacy non-prefixed bookmarks (`/shops`, `/schools`, `/bus-timetable`, `/shop/:id`) automatically upgrade and redirect to `/${currentCity.slug}/...` with intact query parameters.
- **Route guard (`CityRouteGuard`).** Validates `:citySlug` against active cities in the database (with fallback seeds), returning a 404 for unknown slugs.

### Client Geo State & Dynamic Branding Engine
- **`src/lib/geo/types.ts`:** Strongly-typed definitions for `GeoCountry`, `GeoState`, `GeoDistrict`, `GeoCity`, `GeoVillage`, and `TownBranding`.
- **`src/lib/geo/geoService.ts`:** Data access layer fetching active cities and villages from Supabase with resilient built-in offline seeds (Maharashtra -> Jalgaon -> Muktainagar + 8 surrounding villages + Bhusawal, Varangaon, Bodwad, Jalgaon City).
- **`src/lib/geo/townConfig.ts`:** Dynamic town branding generator ensuring uniform typography, color palette, and logo icon while customizing brand name (`<Town> Daily` / `<Town_mr> डेली`), taglines, and metadata.
- **`src/hooks/useCity.tsx`:** Application-wide `CityProvider` and `useCity()` hook managing active city/village, route synchronization, localStorage persistence, and profile sync.
- **`src/components/shared/CityPickerModal.tsx`:** High-contrast, responsive location picker modal with fuzzy search, quick district town chips, child village chips, and GPS nearest-town locator.
- **`src/components/shared/LocationPill.tsx`:** Interactive top-bar location chip displaying active town/village with one-tap location switcher modal trigger.

### Scoped Data & Page Adaptations
- **Home (`src/pages/Home.tsx`):** Scoped shop directory queries to `city_id` and optional `village_id` (with Muktainagar legacy null compatibility). Replaced hardcoded text with dynamic `townBrand`, `townName`, and `<LocationPill />`. Town-prefixed all category, section, and navigation links.
- **Shops (`src/pages/Shops.tsx`):** Scoped queries by active town and village. Added dynamic village filter chip bar for instantaneous locality filtering. Dynamically adapted SEO titles and metadata.
- **Shop Detail (`src/pages/ShopDetail.tsx`):** Updated slug redirects, share dialogue titles, and LocalBusiness JSON-LD schema with town context.
- **Bus Timetable (`src/pages/BusTimetable.tsx`):** Filtered MSRTC bus departures and bus stand contact info by `city_id`.
- **Schools (`src/pages/Schools.tsx`):** Filtered schools list by `city_id` via enhanced `schoolsRepo.list({ cityId, citySlug })`.
- **User Drawer & Profile (`src/components/UserMenuDrawer.tsx`, `src/components/EditProfileDrawer.tsx`):** Replaced placeholder "My Area" with live location selector. Added Home Town / City dropdown to `EditProfileDrawer` persisting user preference to `profiles.city_id` and `profiles.village_id`.
- **Ad Targeting (`src/hooks/useBanners.ts`):** Added town targeting for advertisements — banners with `city_id` render strictly in target town; unassigned banners serve globally.
- **SEO & Sitemaps (`scripts/generate-sitemap.ts`, `scripts/prerender.ts`, `src/components/seo/PageSeo.tsx`):** Pre-generates town-scoped sitemap entries for all active cities and prerenders static town landing pages.

### Database Migration Patch
- **`docs/patches/2026-10-24_multi_town_hierarchy.sql`:** Full SQL migration defining `geo_countries`, `geo_states`, `geo_districts`, `geo_cities`, `geo_villages`, seeding baseline hierarchy, adding foreign keys to `profiles`, `shops`, `schools`, `bus_timetable`, `bus_stand_info`, `banners`, `shop_requests`, performing zero-downtime backfill to Muktainagar, and creating RLS policies.

---

## 2026-10-24 — Vercel compatibility, universal build scripts, and production migration runbook

### Platform / Deployment
- **Vercel native compatibility (`vercel.json`, `.vercelignore`).** Added production `vercel.json` configuring Vite framework preset, SPA routing fallback (`/(.*) -> /index.html`), `cleanUrls: true` for prerendered `/shop/<slug>` static files, and granular HTTP caching headers (`max-age=0` for `/sw.js`, 1-year immutable for `/assets/*`, security headers `nosniff`, `SAMEORIGIN`, `strict-origin-when-cross-origin`). Added `.vercelignore` to optimize build upload size.
- **Universal build runner (`package.json`).** Switched `predev`, `prebuild`, and `postbuild` from `bunx tsx` to `tsx` directly. Enables builds to execute out-of-the-box across Node.js, standard `npm run build`, Vercel CI, and Bun environments without `bunx: command not found` errors.
- **Environment variable flexibility with zero-config fallbacks (`src/integrations/supabase/client.ts`, `scripts/generate-sitemap.ts`, `scripts/prerender.ts`).** Supabase client and build-time sitemap/prerender scripts now read `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and `VITE_SITE_URL` from runtime/build environment variables if defined (e.g. Vercel dashboard), while preserving the fallback credentials for zero-config offline/local use.
- **PWA Service Worker registration guard updated (`src/lib/pwa/register.ts`).** Extended preview refusal logic to exclude transient Vercel preview branch deployments (`*-git-*.vercel.app` / `*-preview-*.vercel.app`) to avoid cache-poisoning preview environments, while keeping full PWA registration active on production domains.

### Documentation
- **Created `docs/VERCEL_MIGRATION_PLAN.md`.** Comprehensive migration plan covering target architecture, environment variables checklist, `vercel.json` breakdown, Git/CLI setup steps, Supabase Auth callback whitelisting, custom domain DNS records, and post-migration verification checklist.
- **Updated `README.md`, `ARCHITECTURE.md`, `PROJECT_BIBLE.md`, `TECHNICAL_DEBT.md`.** Documented Vercel as a primary first-class deployment target alongside Lovable.

---

## 2026-07-08 — Archivist run: security hardening, MCP OAuth, search synonyms, Phase 2 closeouts

### Features
- **Natural-language shop search — no LLM (`src/lib/searchSynonyms.ts`).** Curated EN + Hinglish + Marathi dictionary of category / brand / action phrases (`cake → bakery`, `medicine → medical/pharmacy`, `phone repair → mobile/repair`, `crocin → medical`, `दूध → dairy`, `भाजी → vegetable`, ~150 entries). Wired into `src/lib/fuzzySearch.ts`: synonym-driven category/keyword hits promote to tier 3 (same as a direct category match) so exact name/prefix ranks are preserved; the synonym-expanded query is also fed to Fuse for typo tolerance. Zero backend cost, works offline. Extend by editing `CATEGORY_SYNONYMS` / `BRAND_SYNONYMS` / `ACTION_SYNONYMS`.
- **MCP server switched to OAuth (`src/lib/mcp/index.ts`, `src/pages/OAuthConsent.tsx`, `public/.lovable/oauth/consent/index.html`).** The public MCP endpoint (`/functions/v1/mcp`) now requires a Supabase-issued access token — issuer `https://<projectRef>.supabase.co/auth/v1`, accepted audience `authenticated`, dynamic client registration enabled. New consent page at `/.lovable/oauth/consent` (aliased `/oauth/consent`, `/~oauth/consent`) closes the OAuth loop for MCP clients. Prior "read-only, no auth" doc lines are now superseded; the four tools (`search_shops`, `get_shop`, `list_categories`, `get_bus_timetable`) are unchanged and still read `is_active=true` rows only.

### Platform / Architecture
- **Phase 2 CSV importer migrations complete.** `CategoryCsvImportModal` (2026-07-01, 209→~85 LOC) and shops `CsvImportModal` (2026-07-04, 409→~330 LOC — chunked inserts, per-row fallback, failure-report CSV download via `renderResultExtras`) both now consume `src/components/admin/_shared/csv-importer/`. `MasterImportModal` remains excluded (composite-PK `onConflict` doesn't fit the single-table row-classified shape).
- **`src/hooks/useImageUpload.ts`** (Forge Phase 2 #3, 2026-07-01) — minimal `{ uploading, error, upload, clearError }` state hook wrapping any async uploader (compose with `src/lib/images/imageService.ts`).
- **Undocumented hooks now cataloged.** `useUrlFilters` (typed URL-persistent filter helpers on `useSearchParams`), `useRealtime` (`useRealtimeRow`/`useRealtimeChannel` — MyShop's three subscriptions delegate here), `useFuzzySearch` (Home/Shops search wrapper + debounce), `useImageUpload` — all Phase 1 / Phase 2 additive extractions per `docs/FORGE_RECOMMENDATIONS.md`.
- **Undocumented `src/lib/` files now cataloged.** `concurrency.ts` (generic optimistic-lock updater — `updateShopWithConcurrency` delegates to it), `engagement.ts` (fire-and-forget `logShopEngagement` + `canDialTel` heuristic), `searchSynonyms.ts` (new this turn), `forms/EntityForm.tsx` + `forms/types.ts` (Forge #6 declarative form runner used by `SchoolModal`).

### Database
- **Patch `docs/patches/2026-07-05_security_hardening_fix.sql`** — five hardening blocks:
  1. **URL scheme CHECKs** on `shop_requests.maps_link` and `banners.target_url` — reject anything not `https?://` at storage-layer, blocks `javascript:` / `data:` XSS payloads even if a client guard is bypassed.
  2. **Column-level UPDATE lock** on `translation_cache` — REVOKE wide UPDATE from anon+authenticated; re-GRANT only `hit_count` and `last_used_at` so anon can bump usage counters but cannot overwrite `translated`. Row-level `USING(true)`/`WITH CHECK(true)` retained; column-grant is the actual gate.
  3. **Anon rate-limit trigger `shop_engagement_rate_limit_check`** — max 20 events per `(shop_id, event_type)` per minute for unauthenticated inserts. Signed-in traffic exempt.
  4. **Anon rate-limit trigger `shop_requests_rate_limit_check`** — max 10 public (submitter_user_id IS NULL) requests per hour globally. Signed-in submissions exempt.
  5. **Admin RPC EXECUTE tightening** — revokes PUBLIC + anon EXECUTE on `approve_shop_claim`, `reject_shop_claim`, `assign_shop_owner`, `revoke_shop_owner`, `reorder_banners`, `refresh_engagement_stats`; re-grants only to `authenticated`. Function bodies still gate on `has_role(auth.uid(),'admin')` — this is defence-in-depth, not the primary check.

### Documentation Changes
- Refreshed `ARCHITECTURE.md` (route table + `src/lib/` map + auth model note for MCP OAuth), `DATABASE_REFERENCE.md` (schema-evolution row for the hardening patch + two new triggers + engagement event-type correction), `API_REFERENCE.md` (MCP tools already showed OAuth; storage table replaced with 4-bucket layout), `FEATURES.md` (added natural-language synonyms + noted `shop_engagement` writes `'directions'` today), `COMPONENT_CATALOG.md` (added missing hooks + `OAuthConsent`), `TECHNICAL_DEBT.md` (marked "Single bucket" resolved, added `shop_engagement.event_type` naming drift), `SENTINEL_CONTEXT.md` (added the four new security guards + MCP OAuth to Security Critical; MCP entry moved to explicitly OAuth-gated), `WORKFLOWS.md` (added MCP OAuth handshake), `ADMIN_SYSTEM.md` (CSV importer framework note), `PROJECT_BIBLE.md` (2026-07-08 additions block).

### Data-integrity drift note
- `src/lib/engagement.ts > logShopEngagement()` writes `event_type: 'directions'` for map-open events; every prior doc (and RLS commentary) says `'maps'`. Both values are permitted by the RLS INSERT policy (no CHECK on `event_type`), so this is a naming drift, not a runtime bug — but `AnalyticsTab` filters/aggregates need to accept both spellings until one is chosen. Recommendation captured in `TECHNICAL_DEBT.md`.

### Documentation Health Score (this run)

| Category | Coverage |
|---|---|
| Architecture | 96 % (OAuth flow + new hooks + concurrency generic all documented) |
| Database | 100 % (20 patches, 15 live tables + 1 new patch cataloged) |
| Features | 96 % (natural-language search added; engagement event-type drift flagged) |
| Workflows | 91 % (MCP OAuth flow added) |
| Admin | 100 % |
| API | 98 % (MCP OAuth surface documented; anon-EXECUTE revoke tightened) |
| Components | 97 % (four missing hooks + `OAuthConsent` cataloged) |

**Composite: 97 / 100.**

### Stale Documentation
- MCP edge function deploy still manual (`supabase functions deploy mcp --no-verify-jwt …`) — carried forward from 2026-07-04.
- Second-admin promotion procedure still undocumented — carried forward from baseline.
- No end-to-end walkthrough of connecting the OAuth-gated MCP surface from an external client (ChatGPT / Claude / Cursor) — carried forward.

### Recommended Next Documentation Tasks
1. Reconcile `shop_engagement.event_type` values — pick `'maps'` or `'directions'`, backfill the other, update RLS docs.
2. Screenshot walkthrough for connecting the OAuth-gated Muktainagar Daily MCP from ChatGPT.
3. Track repo-layer adoption per-file so migration progress is visible.

---



## 2026-07-05 — Schools section live + Storage bucket split + Admin IA restructure

### Features
- **Schools directory (`/schools`, `src/pages/Schools.tsx`) — LIVE.** First public section built entirely on the Entity Framework (Forge Phase 4). Public list with debounced search, `school_type` + `medium` filters, and per-row Call / Map / Website actions. Admin CRUD via `SchoolsTab` + `SchoolModal`, surfaced under `/admin/sections/schools` and the shared `SectionDetail` shell.
- **Storage bucket split (Forge rec #15) — LIVE.** Two new public buckets provisioned:
  - `school-images` — admin-only writes (via `has_role`), public read.
  - `request-images` — public "list your shop" pre-approval uploads (mirrors the old `shop-images` `request-*` allowance, now scoped to its own bucket).
  - `shop-images` keeps shop photos, banner images, and `claims/<user>/…` proofs. No file moves required (bucket was empty of split-out prefixes at cutover). All runtime paths now flow through `src/lib/storageNaming.ts` — call sites are one edit away from any future bucket move.
- **Admin Information Architecture restructure — LIVE.** `AdminDashboard` (single-tab file) replaced by `AdminLayout` + `AdminSidebar` + `BranchTabs`. Six top-level hubs (`Overview`, `Directory`, `Sections`, `Marketing`, `Insights`, `System`), each with URL-addressable leaves under `/admin/<hub>/<leaf>`. `adminNav.ts` is the single source of truth for the tree — adding a new section is a one-line registration.

### Platform / Architecture
- **Repository layer (`src/lib/repos/*`) — Forge rec #11.** Six repos (`shopsRepo`, `requestsRepo`, `claimsRepo`, `bannersRepo`, `categoriesRepo`, `schoolsRepo`) barreled via `src/lib/repos/index.ts`. Encapsulates `supabase.from(...)` selects behind typed helpers with shared `SELECT` fragments (`SHOP_CARD_SELECT`, `REQUEST_LIST_SELECT`, `BANNER_LIST_SELECT`). New call sites should import from `@/lib/repos`; existing raw queries migrate opportunistically.
- **Entity Framework buildout (Forge recs #1–#2, continued).** `EntityDef<T>` now has five concrete definitions: `categoryEntity`, `schoolEntity`, `shopEntity`, `requestEntity`, `claimEntity`. `EntityTab` (v2) is the shared list shell used by `CategoriesTab` (pilot) and `SchoolsTab` (first non-shop entity built on it end-to-end). `ShopsTab` / `RequestsTab` still bespoke pending Sentinel-safe migration.
- **Shared moderation queue (`src/components/admin/_shared/ModerationQueue.tsx`).** Extracted from `InboxTab` for reuse across Requests / Claims sub-tabs.
- **CSV importer generalised (`src/components/admin/_shared/csv-importer/*`).** Column-mapper + validation loop moved behind a typed API; `CsvImportModal` / `CategoryCsvImportModal` / `AnalyticsCsvImportModal` are thin adapters over it.
- **Image service (`src/lib/images/imageService.ts`).** Centralises crop → WebP → upload → cleanup for shops / schools / claims / requests. Consumers pass a bucket + naming strategy; storage-path knowledge stays in `storageNaming.ts`.

### Database
- Patch `docs/patches/2026-07-03_schools.sql`: `public.schools` table (13 content columns + `is_active`), 4 indexes (`active`, `created_at DESC`, `school_type`, `area`), grants (`SELECT` anon, full CRUD authenticated, `ALL` service_role), RLS (public read of active rows, admin-only writes via `has_role`), `set_updated_at` trigger.
- Patch `docs/patches/2026-07-05_bucket_split.sql`: RLS block for the two new buckets (public SELECT; admin INSERT/UPDATE/DELETE on `school-images`; public INSERT allowed on `request-images` to mirror old `request-*` policy). Bucket rows themselves are created via the Storage API, not SQL.

---

## 2026-06-30 (b) — EntityTab v2 + Shop/Request entity defs (Sentinel bypass approved)

### Platform / Architecture
- **`EntityTab` extended to v2 (`src/components/admin/_shared/EntityTab.tsx`):** Added search slot, filters slot, banner slot, `mobileCard` render prop, `dataOverride` (for infinite-query callers), footer slot, `rowClassName`, `emptyState` full override, and configurable `skeletonRows`. Covers the union of features needed by `ShopsTab` + `RequestsTab` without forcing them in this turn.
- **`ShopEntity` (`src/lib/entities/shopEntity.ts`):** EntityDef<ShopRow> with columns for Shop (name + verified badge + phone), Categories (chip list), Area. `listFn` is a fallback only — `ShopsTab` will pass `dataOverride` because it uses `useInfiniteQuery`.
- **`RequestEntity` (`src/lib/entities/requestEntity.ts`):** EntityDef<RequestRow> with columns for Shop, Area, Category, Status (exported `statusBadge` helper reusable by the view modal).

### Scope decision (recorded for next session)
- User explicitly authorised bypassing Sentinel on recommendation #2. The framework + entity-defs landed this turn; the actual `ShopsTab` and `RequestsTab` component rewrites (~500 lines each, behaviour-preserving) are queued — they are too high-risk to ship under a time signal.
- **`BusTimetableTab` and `AdvertisementsTab` will not migrate at all.** Their layouts (card list with embedded `StandInfoEditor`; KPI strip + grouped multi-tier sections with per-placement reorder controls) are not "table of rows." Forcing them through `EntityTab` would either bloat the framework into a god-component or leave 90% as bespoke render-prop slots — a net loss. Documented in `FORGE_RECOMMENDATIONS.md`.

---

## 2026-06-30 — Entity Framework foundation + CRUD shell pilot


### Platform / Architecture
- **`EntityDef<T>` foundation (`src/lib/entities/types.ts`, `src/lib/entities/categoryEntity.ts`):** Implements Forge recommendation #1. A single declarative descriptor (`key`, `labelSingular/Plural`, `listQueryKey`, `listFn`, `columns`, optional `getRowKey`) that future sections (Schools / Hospitals / Banks) plug into instead of cloning admin tabs. First instance: `CategoryEntity` (mirrors the existing `admin-categories` query exactly — same shape, same shop-count join).
- **`<EntityTab/>` schema-driven CRUD shell (`src/components/admin/_shared/EntityTab.tsx`):** Implements Forge recommendation #2. Owns header + count, loading skeleton, table scaffold, columns, row-action cell, and empty state for any `EntityDef<T>`. Per-tab specifics (custom toolbar buttons, row actions, delete-confirm dialogs) plug in via render-prop slots — the framework knows nothing about the entity.
- **Pilot migration: `CategoriesTab` (`src/components/admin/CategoriesTab.tsx`):** Re-implemented on top of `<EntityTab/>`. Behaviour is preserved 1:1 — CSV import/export, Merge action, two-tap delete with the bespoke linked-shops dialog, and the clickable Status toggle all still work; the table now goes through the framework. Net effect: shared scaffold extracted, no UX regression.

### Sentinel-aware scoping (deliberately NOT touched in this pass)
- `ShopsTab`, `RequestsTab`, `BusTimetableTab`, `AdvertisementsTab`, `ShopCard`, and `RequestListingModal` are all flagged Business Critical in `SENTINEL_CONTEXT.md` and explicitly phased "migrate last" in `docs/FORGE_REPORT.md`. They remain bespoke until the framework proves out on Categories (and a non-shop section like Bus) first.

### Documentation Changes
- `FORGE_RECOMMENDATIONS.md`: marked recommendations #1 and #2 as **In Progress — Pilot landed (CategoriesTab)** with the new files listed; remaining Phase 3 work (port BusTimetableTab next, then Shops/Requests last) called out.

---



## 2026-06-29 — Listing wizard, image verification, bus-page polish

### New Features
- **Global "List a Shop" host (`src/components/ListShopModalHost.tsx`, `src/App.tsx`, `src/components/UserMenuDrawer.tsx`):** The Request Listing modal is now mounted once at the app root and opens on any route via the `open-list-shop-modal` custom event. The drawer entry no longer redirects to `/` or gates behind sign-in — guests can submit directly (matches the existing public INSERT policy on `shop_requests`). The legacy modal state previously duplicated in `Home.tsx` was removed.
- **Request Listing wizard (`src/components/RequestListingModal.tsx`):** Rebuilt as a 4-step flow (Basics → Location → Optional details → Review) with a segmented progress bar, weighted live completion %, per-step Zod validation, encouragement copy, and a mobile bottom-sheet layout. Auto-saves a debounced draft to `localStorage['mn-shop-request-draft-v2']` and prompts to **Resume** or **Start fresh** on re-open. Review step exposes quick-edit jumps back to any earlier step.
- **Bus timetable header + Marathi fallback (`src/pages/BusTimetable.tsx`):** Sticky header now embeds the same `UserMenuDrawer` profile avatar used on `ShopDetail`. New `localizedDestination()` helper falls back to the English `destination` whenever `destination_mr` is null, empty, or whitespace-only, so partially translated rows never render blank. Destination text bumps up one type size in Marathi.
- **Marathi text size bumps on Home (`src/pages/Home.tsx`):** Recently-added shop names (`CompactShopCard`), section labels, and category labels render one notch larger when `locale === 'mr'` (Devanagari needs more vertical room than Latin).
- **Admin category icons (`src/components/admin/CategoriesTab.tsx`):** Row icons now render via `CategoryIcon` in a primary-tinted badge instead of the raw emoji glyph.
- **Image verification, persisted (`src/components/admin/ShopsTab.tsx`, `src/lib/imageVerify.ts`, `src/components/SafeImage.tsx`):** Admin "No image" filter gained a **Scan broken images** action with a verification chain that survives CORS/HEAD failures: `HEAD` → ranged `GET (0-0)` → in-browser `<img>` probe with a 6s timeout (CORS-bypassing tiebreaker). Results are written to two new columns (`shops.image_checked_at`, `shops.image_broken_at`); broken URLs are nulled out, and rows verified in the last 7 days are skipped on subsequent scans. The "No image" filter now queries `image_url IS NULL OR image_broken_at IS NOT NULL`, so previously-proven-broken rows show up instantly. New `SafeImage` component is the drop-in renderer that swaps an `ImageOff` placeholder whenever `src` is missing or the browser fails to load it — used in the admin mobile card so a broken-image glyph never reaches the UI.

### Database
- `docs/patches/2026-06-29_image_verification_columns.sql` (idempotent): adds `shops.image_checked_at`, `shops.image_broken_at`, plus a partial index `idx_shops_image_broken_at` for the No-image filter union. No-op when `public.shops` is absent.
- *(No new RLS policies — existing `shops` admin UPDATE policy covers the new columns.)*

### UI / i18n
- Listing wizard adds extensive `request.*` step / draft / encouragement keys to `src/i18n/en.json` and `src/i18n/mr.json`.
- All wizard surfaces use semantic theme tokens (no hardcoded color utilities) — verified in both light and dark themes.

### Documentation Changes
- `FEATURES.md`: rewrote the **Listing request** entry as the 4-step wizard with draft persistence; added **Admin image verification** under admin tools.
- `COMPONENT_CATALOG.md`: added `ListShopModalHost`, `SafeImage`; updated `RequestListingModal` and `UserMenuDrawer` rows.
- `DATABASE_REFERENCE.md`: appended `shops.image_checked_at` / `image_broken_at` columns, partial index, and new schema-evolution row; patch-file count 15 → 16.
- `SENTINEL_CONTEXT.md`: noted that `RequestListingModal` is no longer auth-gated and that the global host owns the open-event contract; flagged `image_verify.ts` chain ordering (the `<img>` step is the CORS-safe tiebreaker — do not drop).

---

## 2026-06-28 — Offline support (PWA) + claim verification flow

### New Features
- **Installable PWA with offline support (`vite.config.ts`, `src/lib/pwa/register.ts`, `src/main.tsx`):** App shell is now precached via `vite-plugin-pwa` (`generateSW`, `registerType: autoUpdate`). Runtime caching: `NetworkFirst` for HTML navigations (4s timeout, denylist `/auth`, `/admin`, `/reset-password`, `/~oauth`), `NetworkFirst` for Supabase REST GETs against `bus_timetable` + `bus_stand_info` (7-day fallback), `CacheFirst` for `shop-images` storage URLs (30-day, 200 entries), `StaleWhileRevalidate` for Google Fonts. Service worker registration is fully gated by `src/lib/pwa/register.ts` — refuses dev, iframes, `id-preview--*`, `preview--*`, `*.lovableproject.com`, `*.beta.lovable.dev`, and `?sw=off`; unregisters any matching `/sw.js` in those contexts so a returning preview visitor isn't stuck on the published worker.
- **Bus timetable opens offline (`src/pages/BusTimetable.tsx`, `src/lib/pwa/busCache.ts`):** Both `bus_timetable_public` and `bus_stand_info` queries now seed `initialData` from a versioned `localStorage` snapshot (`md.bus.v1.rows`, `md.bus.v1.stand`) and rewrite the cache on every successful network fetch. When the user is offline OR the last network fetch errored, an amber `WifiOff` pill shows above the list: "Showing last saved timetable · Xm ago" with a Retry button when online.
- **Offline-friendly route allowlist (`src/components/shared/OfflineOverlay.tsx`):** Added `OFFLINE_FRIENDLY_PATHS = ['/bus-timetable']`. On those routes the full-screen offline overlay is suppressed so the page can render its own cached UI; everywhere else the existing offline overlay still takes over.
- **Claim verification — proof upload (`src/components/ClaimShopModal.tsx`):** Claim form now requires a **proof type** (`aadhar_card` / `gst` / `utility_bill` / `shop_board` / `other`) and a **proof photo**. Photo is compressed to WebP (1600px, q=0.82) via `compressImage()` and uploaded to `shop-images/claims/<user_id>/<uuid>.webp` before the `shop_claims` insert; orphaned uploads are best-effort cleaned up on insert failure. Uses native `<input capture="environment">` so phones open the camera directly.
- **Admin claim review modal (`src/components/admin/ClaimReviewModal.tsx`):** New side-by-side dialog opened from `InboxTab > Claims`. Left panel: shop on record (name, area, phone, verified state, current owners list). Right panel: claimant identity, contact phone (with "matches shop" badge when `contact_phone === shops.phone`), submission timestamp, proof type label, signed proof image (`createSignedUrl`, 15-min TTL, falls back to public URL for pre-patch uploads). Three actions: **Approve & assign** (saves `admin_notes` if dirty, then `approve_shop_claim` RPC), **Reject** (requires note, calls `reject_shop_claim` RPC with note), **Request more info** (saves `admin_notes`, leaves status pending).
- **Inbox › Claims (`src/components/admin/InboxTab.tsx`):** Replaced inline Approve/Reject row buttons with a single **Review** button that opens `ClaimReviewModal`. Row now shows proof-attached / no-proof chip and a "matches shop" inline badge when the submitted phone equals the shop's recorded phone.

### Database
- `docs/patches/2026-06-28_claim_verification.sql` (idempotent):
  - Adds `shop_claims.proof_image_path text`, `shop_claims.proof_type text` (with `NOT VALID` CHECK constraint allowing the documented enum + NULL legacy rows). Re-declares `admin_notes`, `reviewed_by`, `reviewed_at` as `IF NOT EXISTS` safeguards.
  - New RLS policy `Admins update claims` on `shop_claims` so the review modal can persist `admin_notes` directly (the existing approve/reject RPCs already cover status transitions).
  - Three new policies on `storage.objects` for the `claims/<user_id>/...` path prefix inside the existing `shop-images` bucket: authenticated SELECT (claimant or admin only), authenticated INSERT (claimant only — `(storage.foldername(name))[2] = auth.uid()::text`), admin DELETE. Proof URLs are also UUID-named, so the public bucket URL stays effectively unguessable; the modal still uses signed URLs for defence in depth.

### UI / i18n
- New `claim.proof.*` keys (EN + MR): `typeLabel`, `uploadLabel`, `pick`, `hint`, `ready`, `missing`, `notImage`, `tooLarge`, `aadhar`, `gst`, `utility`, `shopBoard`, `other`.
- New `bus.cachedOffline` / `bus.cachedNoNetwork` keys (EN + MR) for the offline pill.

### Dev / build
- `vite-plugin-pwa@1.3.0` + `workbox-window@7.4.1` added as dev dependencies.
- `public/manifest.json` and `public/icons/icon-{192,512}.png` already existed from the prior install path — kept as the canonical manifest. `vite-plugin-pwa` is configured with `manifest: false` to avoid emitting a competing one.

### Documentation Changes
- `DATABASE_REFERENCE.md`: appended schema row for `shop_claims` proof columns + storage policies; patch-file count 14 → 15.
- `FEATURES.md`: rewrote the Claim Shop entry; added an Offline Bus Timetable entry.
- `ARCHITECTURE.md`: added PWA service worker line to the deployment model.
- `SENTINEL_CONTEXT.md`: added critical items — service-worker registration guard, storage policies on `claims/` prefix, narrowed proof access.
- `COMPONENT_CATALOG.md`: added `ClaimReviewModal`; updated `ClaimShopModal`.

---



## 2026-06-28 — Ownership-change toasts on `/my-shop`

### New Features
- **Realtime ownership notifications (`src/pages/MyShop.tsx`):** A second Supabase Realtime channel (`my-ownership-${user.id}`) subscribes to `postgres_changes` on `public.shop_owners` filtered by `user_id=eq.<me>`. On `DELETE` it raises a warning toast ("Your ownership for a shop was revoked by an admin.") and invalidates the `my-shops` query; on `INSERT` it raises a success toast ("A shop was assigned to you.") and re-fetches. Prevents the silent disappearance of a shop tile from `/my-shop` after an admin revoke / re-assign cycle.

### Database
- `docs/patches/2026-06-28_realtime_shop_owners.sql` (idempotent):
  - Adds `public.shop_owners` to the `supabase_realtime` publication via a guarded `pg_publication_tables` check.
  - Sets `REPLICA IDENTITY FULL` on `shop_owners` so DELETE payloads include the `user_id` column the client filter relies on (default replica identity only emits PK columns, which would make the `user_id=eq.<me>` filter miss every delete).

### Documentation Changes
- `DATABASE_REFERENCE.md`: appended patch entry; bumped patch-file count.
- `FEATURES.md`: extended the MyShop editor entry with the ownership-change toast behavior.
- `SENTINEL_CONTEXT.md`: noted the `shop_owners` realtime publication + `REPLICA IDENTITY FULL` as critical workflow infrastructure; updated the Realtime dependency row.

---

## 2026-06-27 — Profile editor, bus stand contact/location

### New Features
- **Edit Profile drawer (`src/components/EditProfileDrawer.tsx`):** Slide-up profile editor opened from `UserMenuDrawer`. Repurposes `profiles.full_name` as a unique `@username` that is **one-time editable** (locked after first change via DB trigger), with live availability check (debounced `username_available` RPC). Edits mobile (`profiles.phone`, format-validated), birth date (`profiles.birth_date`, age derived in UI), and gender (`profiles.gender`). Email is read-only.
- **Bus stand contact + location (`bus_stand_info`):** New admin-editable single-row table holding the bus stand's phone, address, and Google Maps URL. Surfaces on `/bus-timetable` as click-to-call + "Open on Google Maps" buttons. Admin edits live in the existing `BusTimetableTab`.

### Database
- `docs/patches/2026-06-27_profile_edit.sql` (idempotent):
  - Adds `profiles.full_name_changed_at timestamptz`, `profiles.birth_date date`, `profiles.gender text`.
  - CHECK constraints: gender enum (`male`/`female`/`other`/`prefer_not_to_say`), birth_date sanity (`1900-01-01` ≤ d ≤ today), phone format `^\+?[0-9]{10,15}$`, username format `^[a-z][a-z0-9_.]{2,23}$`.
  - Phone + username constraints added `NOT VALID` so legacy rows (formatted phones, mixed-case display names) don't block the migration; new INSERT/UPDATE writes are still enforced.
  - Case-insensitive unique partial index `profiles_full_name_lower_uidx` on `lower(full_name)`.
  - BEFORE UPDATE trigger `trg_profiles_lock_username` → `profiles_lock_username()` enforces single-edit username rule (raises on second change; stamps `full_name_changed_at` on first change).
  - SECURITY DEFINER RPC `username_available(text) returns boolean` — case-insensitive availability check; EXECUTE granted to `authenticated` only, revoked from `anon` and `PUBLIC`.
- `docs/patches/2026-06-27_bus_stand_contact.sql` (idempotent): creates `public.bus_stand_info` (single-row table, `id=1` CHECK). Public SELECT, admin INSERT/UPDATE via `has_role(...,'admin')`. `set_updated_at` trigger.
- `docs/patches/2026-06-27_bus_stand_location.sql`: adds `address` + `maps_url` columns and seeds defaults for the single row (COALESCE-preserving — never clobbers admin edits).
- `docs/patches/2026-06-27_bus_timetable_marathi_backfill.sql`: idempotent backfill of `destination_mr` for seeded destinations; no-op if `bus_timetable` not yet created.

### Documentation Changes
- `DATABASE_REFERENCE.md`: new `profiles` columns, `bus_stand_info` table, `profiles_lock_username` trigger, `username_available` RPC, new patch entries in schema-evolution table.
- `FEATURES.md`: added Edit Profile + Bus Stand Info entries.
- `COMPONENT_CATALOG.md`: added `EditProfileDrawer` row.
- `SENTINEL_CONTEXT.md`: added the one-time-edit username trigger and the `username_available` RPC to Security Critical; noted `bus_stand_info` single-row constraint.
- `TECHNICAL_DEBT.md`: noted the `NOT VALID` constraints on `profiles.phone` / `profiles.full_name` (legacy rows are not retroactively validated; revisit after backfill).

---

## 2026-06-27 — Bus timetable, Browse-by-Section hub, edit-existing-photo


### New Features
- **Bus Timetable (`src/pages/BusTimetable.tsx`, route `/bus-timetable`):** Public mobile-first page listing daily departures from Muktainagar bus stand. Debounced destination search, EN/MR aware labels, and a "next departure" chip highlighted on the row whose first upcoming time is after the current clock. Includes `PageSeo` with `ItemList` JSON-LD.
- **Admin Bus tab (`src/components/admin/BusTimetableTab.tsx`):** New tab in `AdminDashboard` for full CRUD on `bus_timetable` rows. Chip-validated HH:MM time entry (accepts comma/space/newline, auto-zero-pads, de-dupes + sorts), Marathi mirror field, sort_order, active toggle, and two-tap delete via `ConfirmTapButton`.
- **Browse by Section hub (`src/pages/Home.tsx`):** New 3-col grid above the existing shop-category grid. Entries: Shops, Bus Timetable, Schools, Banks, Government, Hospitals, Lost & Found, Local News. Live entries link to real pages; future sections (`/sections/:key`) render a shared `SectionComingSoon` page so the hub is never a dead-end. Inline SVG icons live in `src/components/shared/SectionIcon.tsx` so they inherit `currentColor` for both themes. Existing shop-category grid is preserved below under a new `home.browseShopCategory` heading — not deleted.
- **Edit existing photo (`src/components/shared/ImageCropPicker.tsx`):** When a saved `previewUrl` exists the persisted-preview view now exposes both "Edit current photo" and "Change photo". Edit fetches the current image as a Blob, opens it inside the same react-easy-crop surface, and re-runs the existing crop→WebP pipeline; the existing replace cleanup path in `ShopModal` continues to delete the previous storage object.

### Database
- New table `public.bus_timetable` (admin-editable) shipped as `docs/patches/2026-06-27_bus_timetable.sql`. Public SELECT on `is_active=true`; admin-only writes via `has_role(auth.uid(),'admin')`. Seed data transcribed from the bus-stand photo (36 destinations). Patch is idempotent (uses `IF NOT EXISTS` / `WHERE NOT EXISTS`).

### i18n
- Added `home.browseSection`, `home.browseShopCategory`, `home.soon`, `home.sections.*` (8 keys), `sections.comingSoon.*` (3 keys), `bus.*` (10 keys), `imageCrop.editPhoto`, `imageCrop.error.editLoadFailed` to both `en.json` and `mr.json`.

### Documentation Changes
- `FEATURES.md`: added Bus Timetable + Browse-by-Section + edit-existing-photo entries.
- `DATABASE_REFERENCE.md`: added `bus_timetable` table reference.
- `COMPONENT_CATALOG.md`: added `BusTimetableTab`, `SectionIcon`, `SectionComingSoon`, `BusTimetable` page; noted new ImageCropPicker action.
- `supabase/master_schema.sql`: noted bus_timetable patch in change log; full DDL lives in the patch file.

---

## 2026-06-26 — Hero corner layout + Auth input focus pill fix

### Modified Features
- **Home hero (`src/pages/Home.tsx`):** Reworked the hero corner controls so the user menu and language switcher cannot collide at any width. `LanguageSwitcher` (compact `EN`/`मराठी` pill) is pinned to the top-right of the hero with `z-20`; `UserMenuDrawer` avatar trigger is pinned mid-right with `z-10`. The brand-title block reserves right padding on mobile (`pr-[64px]`, cleared at `sm:`) so the centered "Muktainagar Daily" / taglines never sit under either control. Both controls use `flex-shrink-0` and the corner stacks are independent so flex wrapping cannot push them into each other.
- **Auth form (`src/pages/Auth.tsx`):** Added `focus-visible:outline-none focus-visible:shadow-none` to the inner `<input>` elements in email / password / confirm / full-name fields. The global `:focus-visible` rule in `src/index.css` was painting an outline + halo *inside* the wrapper `<span>` (which already shows a `focus-within:ring-2`), and `border-radius: inherit` turned that inner outline into a visible pill-shaped ring nested inside the field. The wrapper ring is now the only focus indicator.

### Documentation Changes
- `COMPONENT_CATALOG.md`: `LanguageSwitcher` and `UserMenuDrawer` rows updated to document the fixed hero-corner placement contract.

---

## 2026-06-26 — Hero header mobile fit + themed toasts with close button

### Modified Features
- **Home hero (`src/pages/Home.tsx`):** Increased right-side reserve on the centered brand title block from `mr-16` to `mr-[104px]` on mobile so the pinned `UserMenuDrawer` + `LanguageSwitcher` stack no longer overlaps the "Muktainagar Daily" / "Local Business Directory" text. Desktop layout (`sm:mr-0`) unchanged.
- **Toasts (`src/components/ui/sonner.tsx`):** Sonner toaster restyled to match the app theme — `bg-card` / `text-card-foreground`, themed border, `rounded-xl`, soft backdrop blur, and accent-colored 4px left border per intent (`success`, `error`, `warning`, `info`) using `--success` / `--destructive` / `--secondary` / `--primary` tokens. Added persistent `closeButton` (X) on every toast, positioned top-right with muted background and accent hover. Position set to `top-center`, default `duration` 4s, `visibleToasts` capped at 4. Action and cancel buttons restyled to use primary/muted tokens.

### Documentation Changes
- `COMPONENT_CATALOG.md`: `Toaster (sonner)` row updated to note themed variants and close button.

---

## 2026-06-26 — Supabase types consolidated to a single source of truth

### Modified Features
- **Type layer:** Deleted `src/integrations/supabase/types.ts` (Lovable-generated scaffold for the unrelated `.env` project `jfkrlnenrzwdmghsdswv` — products/brands/festival_themes; the only `app_role` value it listed was `"admin"`). `src/integrations/supabase/external-types.ts` is now the sole Supabase type module, used everywhere via `client.ts`. The file gains a precise `AppRole = 'admin' | 'shopkeeper' | 'user'` export that matches the live enum on the external project `fhlaqgzensagjangkpop`.
- **Rationale:** The app connects to an external Supabase project (hardcoded in `client.ts`), which Lovable's type generator cannot introspect. A regenerated `types.ts` will always describe the wrong schema and must not be re-added.

### Documentation Changes
- `TECHNICAL_DEBT.md`: "Two Supabase type files" and "Two role models" entries marked RESOLVED with full rationale.
- `ARCHITECTURE.md`: Type-safety nuance updated to reflect single-file model.
- `SENTINEL_CONTEXT.md`: Historical Compatibility Layer entry retired; Dangerous Areas now warns against re-adding a Lovable-generated `types.ts`.

---


## 2026-XX-XX — Baseline (first archivist run)

This is the **baseline** for AI-maintained documentation. Pre-existing `docs/DOCUMENT.md`, `docs/V2_DOC_CHANGES.md`, `docs/AUDIT_REPORT.md`, and `docs/AUTH_WIREUP.md` were removed in favour of the 11-file Archivist standard set. There is no prior version to diff against.

### Added Features
Cataloged from current code (full inventory in `FEATURES.md`):
- **Public:** Home, Shops, ShopDetail, RequestListingModal, BookmarkButton, SavedShops, Auth, ResetPassword, LanguageSwitcher, ErrorPages, OfflineOverlay.
- **User:** Shop bookmarks; listing-request tracking.
- **Owner:** MyShop editor with concurrency-safe edits and realtime; MyRequests tracker.
- **Admin:** ShopsTab, CategoriesTab, AnalyticsTab, InboxTab (Requests/Claims/Owners/Assign), DataQualityTab (6 sections), AdvertisementsTab, plus 11 modals (Shop, Category, CategoryMerge, Banner, SpeedShop, CsvImport, CategoryCsvImport, AnalyticsCsvImport, MasterExport, MasterImport, MarathiBackfill).
- **Banners:** 8-placement system with 3-layer kill switch, popup gating (dwell+scroll), per-route dedupe, IntersectionObserver view tracking, anon-safe RPC counters.
- **i18n:** EN+MR throughout; `shop_translations` + `category_translations` + `amenity_translations` tables; shared `translation_cache`; `TranslateAllButton`, `MarathiMirrorField`, `MarathiBackfillModal`.

### Modified Features
None recorded (baseline run).

### Removed Features
Historical removals captured from chat-history summary (cannot verify against deleted code, marked **Historical**):
- **"Harsh Mobile" mobile-shop website** — 34 files deleted during pivot to Muktainagar Daily.
- **TanStack Start scaffolding** — `router.tsx`, `routes/` directory, `start.ts` removed; app now runs purely on `App.tsx` + React Router v6 + `pages/`.
- **Admin panel scaffolding** under `admin._authed.*` TanStack file-routes — removed alongside TanStack Start; admin functionality consolidated into `src/pages/AdminDashboard.tsx` + `src/components/admin/`.

### Database Changes (baseline state)
- **15 live tables**, 2 views, 1 materialized view, 17 functions, 7 triggers, 1 enum (`app_role`), 1 storage bucket (`shop-images`).
- **38 migrations** applied (`2026-02-27` → `2026-06-13`), most recent: banner placement expansion to 8 slots.
- **9 documented patches** in `docs/patches/` covering DB hardening, request-submitter linkage, i18n, translation cache, banners phase 2, banner reorder, realtime publication, banner placements.
- See `DATABASE_REFERENCE.md > Schema Evolution` for the table-by-table timeline.

### Architecture Changes
- **External Supabase connection** (`fhlaqgzensagjangkpop`) replaces Lovable-managed DB. Supabase URL + anon key hardcoded in `src/integrations/supabase/client.ts` to survive Lovable Cloud `.env` resets.
- **Two type files** introduced: `types.ts` (Lovable-generated, mismatched scaffold schema) and `external-types.ts` (permissive). Client uses `external-types.ts`. See `TECHNICAL_DEBT.md`.
- **Iconography migrated** from emoji to Lucide SVGs via `CategoryIcon.tsx` regex mapper.
- **Mobile UX overhaul:** floating filter FAB, compact stats ribbon on 390 px screens, ARIA-complete filter drawer.
- **Banner popup gating** introduced: 20 s dwell + 30 % scroll + once-per-session + once-per-day (7-day TTL).

### Documentation Health Score (baseline)

| Category | Coverage |
|---|---|
| Architecture | 95 % (routes, state, deployment, security all documented) |
| Database | 100 % (15/15 live tables, all views/functions/triggers/policies documented) |
| Features | 95 % (every page + every admin tab + every shared component cataloged) |
| Workflows | 90 % (12 end-to-end flows mapped; missing: error-page traversal, sitemap regen schedule) |
| Admin | 100 % |
| API | 100 % (no edge functions; 10 RPCs + 15 tables + Auth + Storage + Realtime) |
| Components | 95 % (all non-ui components listed; `ui/` intentionally deferred to shadcn docs) |

**Composite Health Score: 96 / 100.**

### Stale Documentation
- None at baseline (every file regenerated from current code).

### Missing Documentation
- **Cloudflare Workers deployment story** — `wrangler.jsonc` and `src/server.ts` present, no docs explain when this path is used.
- **`refresh_engagement_stats` cadence** — no UI button, no cron schedule documented.
- **Disaster recovery** — `MasterExport`/`MasterImport` work, but the round-trip restore on a fresh database has not been documented as a tested procedure.

### Recommended Next Documentation Tasks
1. Reconcile the dual type-file situation (regenerate against real schema, delete one).
2. Document the second-admin promotion procedure (currently undocumented SQL `INSERT`).
3. Document the deployment matrix (Lovable Cloud vs Cloudflare Workers).
4. Capture screenshot evidence of the 8-placement banner system as user-facing reference.

---

## 2026-07-04 — Repos layer, EntityCard, MCP server

### Added Features
- **App-exposed MCP server** (`src/lib/mcp/`) — Muktainagar Daily now ships its own Model Context Protocol server via `@lovable.dev/mcp-js`. Four read-only tools: `search_shops`, `get_shop`, `list_categories`, `get_bus_timetable`. Bundled by `mcpPlugin()` in `vite.config.ts` into `supabase/functions/mcp/index.ts` (auto-generated — do not hand-edit). Manifest at `.lovable/mcp/manifest.json`. External assistants (ChatGPT, Claude, Cursor, etc.) can query the directory once the app is published and the `mcp` edge function is deployed. **Read-only, no auth** — safe by construction; every tool sets `is_active=true` and `readOnlyHint`.
- **Repository layer** (`src/lib/repos/`, Forge Recommendation #11) — additive per-entity wrappers around `supabase.from(...)`: `shopsRepo`, `requestsRepo`, `claimsRepo`, `bannersRepo`, `categoriesRepo` (+ `schoolsRepo`). Centralises SELECT projections (`SHOP_CARD_SELECT`, `REQUEST_LIST_SELECT`, `BANNER_LIST_SELECT`) and folds the `OWNER_EDITABLE_FIELDS` guard + `updateShopWithConcurrency` into a single `shopsRepo.updateOwner()`. Migration is **opt-in** file-by-file; raw `.from()` calls keep working (Sentinel guardrail).
- **`EntityCard`** (`src/components/shared/EntityCard.tsx`, Forge Recommendation #10) — slot-based layout primitive extracted from `ShopCard`. `ShopCard` is now a thin adapter that maps a `Shop` row → `EntityCard` props (visual parity preserved). Future `BusRow`, `SchoolCard`, `CompactShopCard` will follow the same wrapper-first migration.

### Modified Features
- **`ShopCard`** rewrites its render tree to delegate to `EntityCard`. Public props unchanged; visual output unchanged (wrapper-first per Sentinel guardrail on protected UI).
- **`src/components/ui/chart.tsx`** — Recharts v3 typing loosened on `ChartTooltipContent` and `Legend` (locally declared `payload?: any[]` props) to unblock `tsgo` typecheck. No behaviour change.

### Removed Features
None.

### Database Changes
None (MCP tools read the existing `shops`, `shop_categories`, `categories`, `bus_timetable` tables through the anon key + RLS).

### Architecture Changes
- **New build-time output**: `vite build` now emits an auto-generated Supabase edge function (`supabase/functions/mcp/index.ts`) alongside the SPA bundle. Function is bundled from `src/lib/mcp/index.ts` and its tool imports; it must be redeployed on every MCP change (`supabase functions deploy mcp --no-verify-jwt --project-ref fhlaqgzensagjangkpop`).
- **New public HTTPS surface** (post-publish + post-deploy): `https://fhlaqgzensagjangkpop.supabase.co/functions/v1/mcp` (MCP Streamable HTTP). No auth; read-only.
- **`src/lib/repos/`** becomes the intended future site of query-shape changes; direct `.from()` remains legal but is no longer the recommended pattern for new code.

### Documentation Health Score (this run)

| Category | Coverage |
|---|---|
| Architecture | 95 % |
| Database | 100 % |
| Features | 96 % (MCP server added) |
| Workflows | 90 % (unchanged) |
| Admin | 100 % |
| API | 98 % (4 new MCP tool endpoints documented) |
| Components | 96 % (`EntityCard` + repos added) |

**Composite: 96 / 100** (unchanged — new surface documented in step with implementation).

### Stale Documentation
- MCP function deployment still requires manual `supabase functions deploy` — no CI/CD wiring documented.

### Missing Documentation
- No end-to-end walkthrough of connecting the MCP server from ChatGPT / Claude / Cursor as an end user.

### Recommended Next Documentation Tasks
1. Screenshot walkthrough for connecting Muktainagar Daily MCP from ChatGPT.
2. Track repo-layer adoption per-file so migration progress is visible.
3. Once a second entity uses `EntityCard` (BusRow / SchoolCard), promote it from "Forge #10" to a documented primitive in `COMPONENT_CATALOG.md`.

---

## 2026-07-23 — Archivist run: m-Pulse DB landed, review CTA i18n fix

### Features
- **Reviews section jump-CTA label restored (`src/i18n/{en,mr}.json`).** `src/pages/ShopDetail.tsx:486` renders `t('reviews.jumpCta')` next to the inline rating on the shop header. The key was missing from both locale bundles, so the raw string `reviews.jumpCta` was leaking to the UI (visible on `/shop/samarth-digital-photo-studio` and every other shop page). Added `"See reviews"` (EN) and `"पुनरावलोकने पहा"` (MR). No component change — the fallback `|| 'See reviews'` in the JSX never triggered because `t()` returns the key itself, which is truthy.

### Platform / Architecture
- **m-Pulse database optimizations applied (`docs/patches/2026-07-15_mpulse_db_optimizations.sql`).** Idempotent DB-only patch, safe to re-run, rollback block documented at top of file. Adds:
  - Trigram GIN index on `shops.description` (name/keywords/address already had one) — completes the ILIKE search index set that the new paginated RPC needs.
  - `shops_list_public` — slim `security_invoker` view over `is_active` shops (drops description/keywords/lat/lng/etc., adds derived `is_claimed`). Intended for initial Home/Shops render.
  - `shops_search_public` — wider search-only sidecar view, intended to be fetched lazily on search focus.
  - `category_shop_counts` — materialized view of `(category_id, shop_count)` for active shops, refreshed by triggers on `shops` and `shop_categories`. Not reachable via the Data API; exposed through `get_category_shop_counts()`.
  - `get_shops_page(q, category_id, area, page_size, page)` — server-side paginated + filterable shops RPC (SECURITY INVOKER; RLS enforced).
  - `reprocess_shop_image(shop_id)` — admin-only marker RPC used by the future image-compression backfill tool (m-Pulse Rec #1). EXECUTE revoked from anon/public; body gated by `has_role('admin')`.
- **`src/integrations/supabase/types.ts` regenerated** to reflect the two new views (`shops_list_public`, `shops_search_public`) as relations. Materialized view + RPCs land in the generated `Functions`/`Views` maps.
- **Client not migrated yet.** `Home.tsx`, `Shops.tsx`, and `shopsRepo` still read the wider `shops_with_claim`. Rollout tracked in `TECHNICAL_DEBT.md > m-Pulse DB optimizations landed, client not migrated`.

### Modified Features
- None (visitor and admin behaviour unchanged in this run outside the i18n fix).

### Removed Features
- None.

### Database Changes
- 1 new patch file (`2026-07-15_mpulse_db_optimizations.sql`) → **21 patch files** total.
- 2 new views, 1 new materialized view, 4 new functions (see `DATABASE_REFERENCE.md > Views` and `API_REFERENCE.md > RPC Endpoints`).

### Architecture Changes
- New read paths exist in the DB but are not yet on the runtime hot path. Once Home/Shops migrate, `shops_with_claim` will become the write/detail-only path; the new views become the visitor-list projection.

### Documentation Health Score (this run)

| Category | Coverage |
|---|---|
| Architecture | 95 % |
| Database | 100 % (views + RPCs registered same-run as patch application) |
| Features | 96 % |
| Workflows | 90 % |
| Admin | 100 % |
| API | 100 % (13 RPCs — 10 client-called, 3 DB-only) |
| Components | 96 % |

**Composite: 96 / 100** — unchanged. DB drift closed; client-side drift ("new views exist, no caller uses them") tracked in `TECHNICAL_DEBT.md` instead of the health score so the number doesn't hide the migration work.

### Stale Documentation
- None re-introduced this run.

### Missing Documentation
- No end-to-end write-up of the projected m-Pulse rollout order (Home → Shops → CategoryGrid) beyond the tech-debt entry. Add once the first caller migrates so the doc can quote a real diff instead of a plan.

### Recommended Next Documentation Tasks
1. When `Home.tsx` migrates to `shops_list_public`, update `FEATURES.md > Shop directory` and `ARCHITECTURE.md > Data-flow` to show the split (list view for render, `shops_with_claim` for detail).
2. When the image-compression backfill tool lands, promote `reprocess_shop_image` from "marker RPC" to a documented admin action in `ADMIN_SYSTEM.md`.
3. Add a short `MPULSE_REPORT.md` cross-link from `TECHNICAL_DEBT.md` and `ARCHITECTURE.md` so the report is discoverable from the doc set (currently only linked from itself).


---

## 2026-11-07 — Living Verticals (Mess & PG), Multi-Image Support, Reviews, Modular Admin, and Vibe Forge Attribution

### Features
- **Shared Footer & Vibe Forge Attribution (`src/components/shared/Footer.tsx`).** Standardized a global footer across `Home`, `Shops`, `ShopDetail`, `Mess`, `PG`, and `Schools`. Features bilingual credits ("Developed by Vibe Forge" linking to `https://vibe-forge.in/` / "Vibe Forge द्वारे विकसित"), directory links, and platform badges.
- **Mess & Dining Vertical (`src/pages/Mess.tsx`, `src/pages/admin/DirectoryMess.tsx`).** Added discovery and dedicated management for student mess and dining services, including monthly subscription rates, meal schedules, pure-veg filtering, and daily menu feeds (`mess_daily_menus`).
- **PG & Student Hostels Vertical (`src/pages/PG.tsx`, `src/pages/admin/DirectoryPG.tsx`).** Added housing discovery for students and migrant workers with room type filtering (single, double, triple), gender preferences, budget range sliders, and amenities lists.
- **Multi-Image Selection & Cropping (`src/components/shared/MultiImageCropPicker.tsx`).** Interactive multi-photo uploader supporting drag-and-drop, interactive canvas cropping, and compression to modern WebP format for up to 5 photos per listing.
- **Customer Ratings & Reviews (`src/components/reviews/*`, `src/lib/reviewsApi.ts`).** Full review submission and display system backed by `reviews` table and `get_shop_rating` RPC. Supports 1-5 star ratings, title, comments, and star breakdown visualizations (`RatingBadge`, `RatingBreakdown`).
- **Expanded Education Types (`supabase/migrations/20261106000000_expand_school_type_check.sql`).** Expanded school type constraint to support `'junior_college'`, `'degree_college'`, and `'coaching_institute'` in addition to traditional schools.

### Modular Admin Navigation
- **Hub & Leaf Admin Layout (`src/components/admin/layout/AdminLayout.tsx`, `adminNav.ts`).** Transformed the admin experience into a clean modular tree:
  - Overview (`/admin/overview`)
  - Directory (`/admin/directory/*`: Shops, Mess & Dining, PG & Hostels, Categories, Inbox)
  - Sections (`/admin/sections/*`: Bus Timetable, Education & Institutes / Schools)
  - Marketing (`/admin/marketing/ads`)
  - Insights (`/admin/insights/analytics`)
  - System (`/admin/system/*`: Data, Quality, Marathi, MCP)
- **Multi-Entity Moderation (`src/components/admin/RequestsTab.tsx`).** Inbox moderation directly supports approving listing requests for `shop`, `mess`, `pg`, and `school` with entity-specific metadata inspection and multi-image galleries.

### Bug Fixes
- **UserMenuDrawer ReferenceError (`src/components/UserMenuDrawer.tsx`).** Fixed uncaught runtime error where `locale` was referenced in JSX without destructuring from `useT()`. Added regression unit test in `src/test/UserMenuDrawer.test.tsx`.

### Documentation Synchronization
- Synchronized all 12 primary project documents (`PROJECT_BIBLE.md`, `ARCHITECTURE.md`, `DATABASE_REFERENCE.md`, `FEATURES.md`, `COMPONENT_CATALOG.md`, `ADMIN_SYSTEM.md`, `WORKFLOWS.md`, `API_REFERENCE.md`, `TECHNICAL_DEBT.md`, `SENTINEL_CONTEXT.md`, `MULTI_LOCATION_ARCHITECTURE.md`, and `CHANGELOG_AI.md`) to reflect the true, live state of the codebase.
