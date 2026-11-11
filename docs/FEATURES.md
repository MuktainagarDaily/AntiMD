# Features

> Status legend: **Active** | **Legacy** | **Experimental** | **Deprecated** | **Removed**.
> Each entry: *Purpose · Workflow · Dependencies · Status*.

## User Features (visitor + signed-in user)

### Home discovery (`src/pages/Home.tsx`)
- **Purpose:** Single-page entry to the directory; surfaces categories, search, recent shops, and the "List a Shop" CTA.
- **Workflow:** Load `shops_with_claim` + `categories` → render category grid (sorted by shop count) + stats ribbon + recent strip + search → filter drawer applies in one click → tap shop → `/shop/<slug>`.
- **Dependencies:** `fuzzySearch.ts`, `useTranslationsCache`, `BannerSlot`, `BannerPopup`, `RequestListingModal`, `CategoryIcon`.
- **Status:** Active.

### Shop listing (`src/pages/Shops.tsx`)
- **Purpose:** Full paginated shop browser with URL-persistent filters.
- **Workflow:** Load all active shops → client-side fuzzy filter (with **natural-language synonym expansion** — `cake→bakery`, `medicine→medical`, `phone repair→mobile+repair`, `दूध→dairy`, via `src/lib/searchSynonyms.ts`) + chip filters (Open Now / Verified / top-3 categories) + drawer filters → 10/page → auto-refresh open/closed every 60 s.
- **Dependencies:** `Fuse.js`, `searchSynonyms.ts`, `useInterval`, Radix `Drawer`.
- **Status:** Active.

### Shop detail (`src/pages/ShopDetail.tsx`)
- **Purpose:** Conversion surface — call, WhatsApp, maps, share, bookmark, claim, and customer reviews.
- **Workflow:** UUID→slug redirect → load shop + categories + claim status + ratings/reviews + ownership → engagement-logged actions → **Strict Geographic & Hyper-Local Related Shops** strip:
  - Resolves primary city from `rawShop.city_id || currentCity.id`.
  - Strictly queries Supabase `.eq('shops.city_id', currentShopCityId!)` to prevent cross-town leaks.
  - Prioritizes shops sharing the exact same `village_id` first (`hyperLocal`), followed by wider same-city shops (`townWide`), capped at 12 items.
  - Complete empty-state contract: hides the entire Related Shops `<section>` (and `#related-shops-title`) if no local competitors exist in that category within the town.
- **Dependencies:** `ImageLightbox`, `ShopImage`, `BookmarkButton`, `ClaimShopModal`, `BannerSlot`, `PageSeo` (JSON-LD `LocalBusiness`), `prioritizeRelatedShops()`.
- **Status:** Active.

### Essential Services & Civic Authorities (`src/pages/EssentialServices.tsx`) — 2026-11-08
- **Purpose:** Public portal for municipal authorities, water supply schedules, power maintenance, civic alerts, and 24x7 emergency helplines.
- **Workflow:** Load `authority_departments` and `authority_organizations` for current town → filter by department chips (Water, Power, Municipal Council, Police, Healthcare) → display active service announcements & outage advisories with severity badges (Critical, High, Medium, Low) → one-tap emergency call and visiting hours info.
- **Security & Privacy:** Unencrypted municipal officer PII is stored exclusively in-memory during active sessions (never persisted in `localStorage`).
- **Dependencies:** `authorityService.ts`, `authority_departments`, `authority_organizations`, `authority_announcements`.
- **Status:** Active.

### Listing request — 4-step multi-entity wizard (`src/components/RequestListingModal.tsx`, `src/components/ListShopModalHost.tsx`) — Updated 2026-11-05
- **Purpose:** Let any visitor (no sign-in required) submit a shop, mess, PG hostel, or school for inclusion with specialized fields, multi-photo crop, and resumable state.
- **Workflow:** Mounted once at the app root by `ListShopModalHost`; any surface opens it by dispatching `open-list-shop-modal`. Wizard: **Entity Type & Basics → Location & Address → Entity Details & Photos → Review & Submit**. Supports dynamic entity types (`shop`, `mess`, `pg`, `school`) with specialized sub-fields stored into `meta` JSONB. Segmented progress bar + weighted completion %. Per-step Zod validation gates **Next**. Debounced auto-save to `localStorage['mn-shop-request-draft-v2']`; prompts **Resume** or **Start fresh** on re-open. Multi-photo crop picker (`MultiImageCropPicker.tsx`) crops primary cover and gallery photos to WebP. On submit: uploads to `request-images/` bucket → INSERT `shop_requests` (`status='pending'`, `entity_type`, `photos`, `meta`, `submitter_user_id` if signed in).
- **Dependencies:** `MultiImageCropPicker`, `ImageCropPicker`, `LocationMapPicker`, `AmenitiesPicker`, `MarathiMirrorField`, `TranslateAllButton`, `TimePickerField`; global `open-list-shop-modal` event contract.
- **Status:** Active.

### Bookmarks (`src/components/BookmarkButton.tsx` + `src/pages/SavedShops.tsx`)
- **Purpose:** Authenticated users save shops for later.
- **Workflow:** Button toggles `shop_bookmarks` row (INSERT/DELETE). `/saved-shops` page lists, searches, sorts, and bulk-removes.
- **Dependencies:** TanStack Query cache invalidation on `['saved-shops', userId]`.
- **Status:** Active.

### Shop claim (`src/components/ClaimShopModal.tsx`)
- **Purpose:** Authenticated user requests ownership of a listed shop with verifiable proof.
- **Workflow (2026-06-28):** User fills shop's registered phone → picks proof type (`aadhar_card` / `gst` / `utility_bill` / `shop_board` / `other`) → captures or picks a proof photo (`capture="environment"`) → photo compressed to WebP via `compressImage()` (1600 px, q=0.82) and uploaded to `shop-images/claims/<user_id>/<uuid>.webp` (path enforced by storage RLS) → INSERT `shop_claims` with `proof_image_path` + `proof_type` (orphaned upload cleaned up on insert failure) → DB rate-limit trigger → admin review modal (see below) → on approve, `approve_shop_claim` RPC grants `shopkeeper` role + `shop_owners` row.
- **Dependencies:** `useAuth`, `compressImage`, `supabase.storage`, deep-link `?claim=1`.
- **Status:** Active.

### Admin claim review (`src/components/admin/ClaimReviewModal.tsx`)
- **Purpose:** Side-by-side review surface for admins before granting shop ownership.
- **Workflow:** Opened from Inbox › Claims **Review** button. Left panel shows shop on record (name, area, phone, verified flag, current owners pulled live from `shop_owners` + `profiles`). Right panel shows claimant identity, contact phone with "matches shop" badge when `contact_phone === shops.phone`, submission timestamp, proof type label, and proof image via `createSignedUrl(15m)` (falls back to public URL for pre-patch uploads). Three actions: **Approve & assign** (saves `admin_notes` then `approve_shop_claim` RPC), **Reject** (note required, `reject_shop_claim` RPC), **Request more info** (saves `admin_notes`, status stays `pending`).
- **Dependencies:** `approve_shop_claim` / `reject_shop_claim` RPCs; admin UPDATE policy on `shop_claims` (2026-06-28 patch).
- **Status:** Active.


### Auth (`src/pages/Auth.tsx`, `ResetPassword.tsx`)
- **Purpose:** Sign-in / sign-up / forgot-password.
- **Workflow:** Three-mode tabbed form, Zod schemas, sanitisation, 1.5 s cooldown, `?next=` deep-link with open-redirect guard.
- **Dependencies:** `supabase.auth.*`, `safeRelativePath()`.
- **Status:** Active. **No OAuth.**

### Language switcher (`src/components/LanguageSwitcher.tsx`)
- **Purpose:** EN ↔ MR toggle.
- **Workflow:** Pick → `setLocale` → `localStorage['md.locale']` + (if signed in) `profiles.locale` upsert. 600 ms cooldown.
- **Dependencies:** `i18n/index.tsx`, `useTranslationsCache`.
- **Status:** Active.

### Error pages (`src/pages/*Error*.tsx`, `ErrorRoute.tsx`)
- **Purpose:** Friendly HTTP error surfaces (400/401/403/404/500/502/503).
- **Workflow:** Single dynamic `/error/:code` route + dedicated standalone routes for crawler-friendly URLs. All reuse `src/components/shared/ErrorPage.tsx`.
- **Status:** Active.

### Offline overlay (`src/components/shared/OfflineOverlay.tsx`)
- **Purpose:** Full-screen message when `navigator.onLine === false`, *except* on offline-friendly routes.
- **Offline-friendly allowlist (2026-06-28):** `OFFLINE_FRIENDLY_PATHS = ['/bus-timetable']` — on those routes the overlay is suppressed so the page can serve its own cached UI.
- **Dependencies:** `useOnlineStatus`, `useLocation`.
- **Status:** Active.

### Offline bus timetable (`src/pages/BusTimetable.tsx`, `src/lib/pwa/busCache.ts`) — 2026-06-28
- **Purpose:** Bus stand timetable opens with last-seen data when offline / on low-signal.
- **Workflow:** Both `bus_timetable_public` and `bus_stand_info` queries seed `initialData` from a versioned `localStorage` snapshot (`md.bus.v1.rows`, `md.bus.v1.stand`) and rewrite the cache on every successful network fetch (gated by `dataUpdatedAt` increment). When offline OR the last fetch errored, an amber `WifiOff` pill shows above the list: *"Showing last saved timetable · X min ago"* with a Retry button while online. Service worker also caches Supabase REST GETs for these tables (`NetworkFirst`, 7-day expiry) so a hard reload while offline still hydrates.
- **Dependencies:** `useOnlineStatus`, React Query `initialData`/`dataUpdatedAt`, vite-plugin-pwa runtime caching.
- **Status:** Active.

### Multi-town location selector & routing (`src/hooks/useCity.tsx`, `LocationPill.tsx`, `CityPickerModal.tsx`) — 2026-10-24
- **Purpose:** Regional platform scaling allowing users to browse listings across multiple towns (Muktainagar, Bhusawal, Varangaon, Bodwad, Pune/Maval) and their satellite villages.
- **Workflow:** Header displays active town/village via `<LocationPill />`. Tapping opens `<CityPickerModal />` featuring instant search, quick district chips, child village chips, and HTML5 GPS nearest-town locator. Selection updates `CityContext`, URL path (`/:citySlug`), and syncs to signed-in `profiles.city_id`.
- **Dependencies:** `geoService.ts`, `townConfig.ts`, `geo_cities`, `geo_villages`.
- **Status:** Active.

### Mess & Dining directory (`/:citySlug/mess`, `src/pages/Mess.tsx`) — 2026-10-29
- **Purpose:** Dedicated vertical for local food messes, dining halls, and tiffin providers catering to students and daily workers.
- **Workflow:** Lists active mess providers in the selected town. Displays dietary badges (`pure_veg`, `veg_nonveg`, `jain_available`), monthly rates, single thali prices, sunday feast alerts, and daily meal timings. Tapping today's menu reveals daily lunch/dinner items or photo menu boards.
- **Dependencies:** `mess_profiles`, `mess_daily_menus`, `livingService.ts`, `CityPickerModal`.
- **Status:** Active.

### PG & Hostels directory (`/:citySlug/pg`, `src/pages/PG.tsx`) — 2026-10-29
- **Purpose:** Accommodation and rental hostel finder with live vacant bed tracking for students and working professionals.
- **Workflow:** Filter by gender (`boys`, `girls`, `both`), target occupancy (`students`, `professionals`, `any`), and immediate availability. Cards show live available beds count, deposit amount, gate closing curfew, sharing rate options (1/2/3/4 sharing matrix), and verified amenities tags. Direct Call and WhatsApp buttons connect users to hostel owners.
- **Dependencies:** `pg_profiles`, `livingService.ts`, `CityPickerModal`.
- **Status:** Active.

### Customer reviews & ratings (`src/components/reviews/ShopReviewsSection.tsx`, `WriteReviewModal.tsx`)
- **Purpose:** Verified crowd trust and community feedback for local businesses.
- **Workflow:** Shop detail displays average star rating (1.0–5.0) and total review count with visual star breakdowns. Signed-in users write reviews via `WriteReviewModal` with star selector and feedback text, instantly refreshing the shop's review feed.
- **Dependencies:** `reviews` table, `reviewsRepo.ts`, `RatingStars.tsx`, `RatingBadge.tsx`.
- **Status:** Active.

### Shared footer with Vibe Forge credit (`src/components/shared/Footer.tsx`) — 2026-11-04
- **Purpose:** Clean, professional, theme-compliant footer credit and copyright display.
- **Workflow:** Renders site copyright and hyperlocal tagline along with an accessible external credit link to [https://vibe-forge.in/](https://vibe-forge.in/) ("Developed by Vibe Forge" / "Vibe Forge द्वारे विकसित"). Responsive on mobile and desktop, deployed consistently across Home, Shops, Bus, Schools, Mess, PG, and the User Drawer.
- **Dependencies:** `useT()` i18n, `en.json` & `mr.json` translations, `ExternalLink` icon.
- **Status:** Active.

### Installable PWA (`vite.config.ts`, `src/lib/pwa/register.ts`) — 2026-06-28
- **Purpose:** Add to Home Screen + offline app shell.
- **Workflow:** `vite-plugin-pwa` (`generateSW`, `registerType: autoUpdate`, `injectRegister: null`) emits `/sw.js`. The only registrar is `src/lib/pwa/register.ts` which refuses dev, iframes, `id-preview--*`, `preview--*`, `*.lovableproject.com`, `*.beta.lovable.dev`, and `?sw=off` — and unregisters any stale `/sw.js` in those contexts so Lovable previews never get poisoned by the published worker. Runtime caching: `NetworkFirst` for HTML navigations (4s, denylist `/auth` / `/admin` / `/reset-password` / `/~oauth`), `NetworkFirst` for bus REST GETs, `CacheFirst` for `shop-images` (30 d / 200 entries), `StaleWhileRevalidate` for Google Fonts.
- **Limitation:** SW never registers in the Lovable preview. Offline behavior is only observable on the published `*.lovable.app` (or custom-domain) site.

## Shop Owner Features

### MyShop editor (`src/pages/MyShop.tsx`)
- **Purpose:** Shopkeepers edit their own listing(s).
- **Workflow:** Shop switcher (if multiple owned) → editor with dirty tracking + sticky save bar → optimistic Open/Closed quick-toggle → image replace queued for cleanup → `updateShopWithConcurrency` against `WHERE updated_at=$old`.
- **Restricted fields (admin-only):** `is_active`, `is_verified`, `slug`, `category_id` (also enforced server-side by `shops_owner_column_guard`).
- **Ownership-change toasts (2026-06-28):** A second Realtime channel subscribes to `shop_owners` INSERT/DELETE filtered by `user_id=eq.<me>` so an admin revoke (warning toast) or new assignment (success toast) is surfaced immediately instead of silently changing the shop list. Relies on `REPLICA IDENTITY FULL` on `shop_owners` for the DELETE filter to match.
- **Dependencies:** Supabase Realtime channels (`shops`, `shop_requests`, `shop_owners`); `ImageCropPicker`, `TimePickerField`, `ShopPreviewSheet`, `EngagementCard`.
- **Status:** Active.

### MyRequests tracker (`MyShop.tsx` > `MyRequestsCard`)
- **Purpose:** Track personal listing-request status.
- **Workflow:** SELECT `shop_requests WHERE submitter_user_id = me` (realtime subscribed).
- **Status:** Active.

## Admin Features (`src/components/admin/layout/AdminLayout.tsx` + Hub/Leaf Pages)

| Hub & Section | Route & Component | Capabilities |
|---|---|---|
| **Overview** | `/admin/overview` (`Overview.tsx`) | Directory KPI totals, quick activity feeds, fast entity jumpers |
| **Directory › Shops** | `/admin/directory/shops` (`DirectoryShops.tsx`) | Search, quick filters, category filter, toggle active/verified (two-tap), edit/delete, CSV export+import, Speed Add |
| **Directory › Mess** | `/admin/directory/mess` (`DirectoryMess.tsx`) | Manage dining & mess providers, thali rates, daily menu updates, dietary filter |
| **Directory › PG & Hostels** | `/admin/directory/pg` (`DirectoryPG.tsx`) | Live bed vacancy manager, gender filters, sharing rates matrix, amenities |
| **Directory › Categories** | `/admin/directory/categories` (`DirectoryCategories.tsx`) | CRUD, toggle active, pre-flight linked-shops check on delete, **merge** via `CategoryMergeModal`, CSV |
| **Directory › Inbox** | `/admin/directory/inbox` (`DirectoryInbox.tsx`) | Moderation hub for Requests (Shops/Mess/PG/Schools), Claims, Owners, Direct-Assign |
| **Directory › Quality** | `/admin/directory/quality` (`DirectoryQuality.tsx`) | Duplicate phones, missing coords, inconsistent areas, orphaned owner links, rename shop images (plan→apply), storage audit |
| **Sections Hub** | `/admin/sections` (`SectionsHub.tsx`) & `/admin/sections/:key` | Dedicated editors for non-shop verticals (`bus`, `schools`, etc.) |
| **Marketing › Ads** | `/admin/marketing/ads` (`MarketingAds.tsx`) | 8-placement banner CRUD across all towns, geo-targeting dropdown ("All Towns" or specific city), town badges, drag-reorder, bulk pause/resume, view/click stats, local admin "Hide/Show ads for me" preview toggle |
| **Insights › Analytics** | `/admin/insights/analytics` (`InsightsAnalytics.tsx`) | 7d/30d/all, total taps, top shops, top categories; CSV export/import |
| **System › Data** | `/admin/system/data` (`SystemData.tsx`) | Master database backup ZIP export and CSV/ZIP import |
| **System › Marathi** | `/admin/system/marathi` (`SystemMarathi.tsx`) | Batch Marathi translation pipeline with zero-overwrite safeguard, 50k char/day MyMemory quota, 2-worker throttle with 100ms pacing, warning rejection, and schools backfill |
| **System › MCP** | `/admin/system/mcp` (`SystemMcp.tsx`) | Model Context Protocol AI server endpoint status and OAuth configuration |

### Admin image verification (`src/components/admin/ShopsTab.tsx`, `src/lib/imageVerify.ts`, `src/components/SafeImage.tsx`) — 2026-06-29
- **Purpose:** Detect shops whose `image_url` is set but the file is gone (deleted from storage, dead external link, fake URL).
- **Workflow:** Under the **No image** filter, **Scan broken images** runs a verification chain per shop: `HEAD` → ranged `GET (Range: bytes=0-0)` → in-browser `<img>` probe (6s timeout, CORS-bypassing tiebreaker). Skips rows verified in the last 7 days. Writes results to `shops.image_checked_at` (OK) / `shops.image_broken_at` + nulls `image_url` (broken). The No-image filter then queries `image_url IS NULL OR image_broken_at IS NOT NULL`, so proven-broken rows appear instantly on subsequent loads.
- **UI resilience:** `SafeImage` is a drop-in `<img>` wrapper that renders a neutral `ImageOff` placeholder when `src` is empty or the browser fails to load/decode it. Used in the admin mobile card so a broken-image glyph never reaches the UI.
- **Dependencies:** Patch `2026-06-29_image_verification_columns.sql` (new columns + partial index).
- **Status:** Active.

### Schools directory (`/schools`, `src/pages/Schools.tsx`) — 2026-07-03
- **Purpose:** First non-shop public section in the directory. Lets residents find schools + colleges by type, medium, and area.
- **Workflow:** Load active `schools` rows via `schoolsRepo` → debounced search (name / area / address) + `school_type` and `medium` filter chips → per-row Call, Open in Maps, Website. Marathi labels via `name_mr`.
- **Dependencies:** `src/lib/repos/schoolsRepo.ts`, `src/lib/entities/schoolEntity.ts`, storage bucket `school-images` (2026-07-05).
- **Status:** Active. Backed by patches `2026-07-03_schools.sql` + `2026-07-05_bucket_split.sql`.

### Storage bucket split (`src/lib/storageNaming.ts`) — 2026-07-05
- **Purpose:** Separate concern-per-bucket so schools, listing-request uploads, and shop/claim media each have their own RLS surface.
- **Buckets:** `shop-images` (shops + banners + `claims/<user>/…` proofs) · `school-images` (admin-only write) · `request-images` (public "list a shop" pre-approval uploads) · `banner-images` (private, admin-only).
- **Client contract:** All runtime call sites go through `storageNaming.ts` (path builder + public-URL helper). Adding or moving a bucket is a one-file change on the client.
- **Status:** Active. Patch `2026-07-05_bucket_split.sql` ships the RLS block (bucket rows are created via the Storage API, not SQL).

### Admin IA restructure (`src/components/admin/layout/*`) — 2026-07-05
- **Purpose:** Replace the single-file `AdminDashboard` (all tabs mounted at once) with a URL-addressable hub/leaf tree so links, deep-linking, and back-nav work per section.
- **Structure:** Six hubs — **Overview**, **Directory** (Shops / Categories / Claims & Requests / Data Quality), **Sections** (Bus / Schools live; Hospitals / Banks / Government / Lost & Found / Local News queued), **Marketing** (Ads), **Insights** (Analytics), **System** (Data / Marathi). Each leaf is a route under `/admin/<hub>/<leaf>`; `AdminLayout` renders sidebar + branch tabs + `<Outlet/>`.
- **Source of truth:** `src/components/admin/layout/adminNav.ts` (`ADMIN_NAV`). Registering a new section = one entry.
- **Status:** Active.

### Cross-cutting admin tools

- **Master Export** (`MasterExportModal`) — ZIP of all 6 tables as CSVs.
- **Master Import** (`MasterImportModal`) — ZIP or single CSV; skip-dupes (default) or upsert. **Engagement + ownership NOT importable** (safety).
- **Marathi Backfill** (`MarathiBackfillModal`) — Scans `shop_translations`, `category_translations`, and `schools` (`name_mr`, `address_mr`) for missing rows, batch-translates via MyMemory API with 50,000 char/day registered tier (`&de=admin@muktainagardaily.com`), paced with 2 concurrent workers and 100ms throttle delay, rejecting warning strings, and **never overwriting existing translations**.

## Hidden / Experimental Features

### Banner system (`src/components/banners/*`, `src/lib/banners/*`)
- **Purpose:** Sponsored placements that pay for the directory.
- **Workflow:** 3-layer flag (`VITE_ADS_ENABLED` build flag → `localStorage['md_ads_runtime']` admin override → per-banner `is_active`) → `BannerSlot` per-route de-dupe → Intersection Observer view tracking → SECURITY DEFINER RPC counter increments.
- **Popup gating:** seen-today (`localStorage`, 7-day TTL) + this-session (`sessionStorage`) + ≥20 s dwell + ≥30 % scroll (or 600 px).
- **"Sponsored" label** mandatory in `InlineBanner` and `BannerPopup` (code-level requirement).
- **Status:** Active (Phase 2 complete; 8 placements as of 2026-06-13).

### Trending shops RPC (`get_trending_shops`)
- **Purpose:** Surface top shops from `shop_engagement_stats` materialized view.
- **Status:** **Inferred unused** — not grepped in any `src/` file. (Recommendation: surface on Home or admin dashboard.)

### Trigram search RPC (`search_shops`)
- **Purpose:** Typo-tolerant server-side search.
- **Status:** **Inferred unused** — client uses Fuse.js. (Recommendation: switch when shop count exceeds client-paginate threshold; currently feasible at ~50-100 shops.)

## Legacy / Deprecated

### `shops.category_id` column
- **Status:** **Deprecated** (kept for compat). Active code uses `shop_categories` junction table. Per `mem/features/roles-and-ownership.md` and master_schema comment.

### `/admin/login` route
- **Status:** **Legacy** — thin shim that immediately `Navigate`s to `/auth`. Preserved for old bookmarks.

### `shops.is_open` boolean
- **Status:** **Legacy** — actual open/closed is computed from `opening_time` / `closing_time` text via `isShopOpen()` in `shopUtils.ts`. Column kept as quick-toggle in MyShop UI.

## Removed (historical)

### "Harsh Mobile" mobile-shop website
- **Status:** **Removed** during pivot to Muktainagar Daily. 34 files deleted across public routes (mobiles, accessories), admin routes, site components, and HM-specific business logic. *(Historical — per turn summary in chat history; no code remains.)*

### TanStack Start scaffolding
- **Status:** **Removed**. `router.tsx`, the `routes/` directory, and `start.ts` were deleted; the project runs on `App.tsx` + `pages/` (React Router v6 only). *(Historical.)*

### Lovable scaffold tables (products / brands / testimonials / festival_themes / offers / services / site_settings / social_links / promo_videos / gallery_images / enquiries)
- **Status:** **Removed from app code** — still present in `src/integrations/supabase/types.ts` because it reflects a different connected project. The runtime client uses `external-types.ts` and **never references these tables**. See `TECHNICAL_DEBT.md`.

---

### Bus Timetable (`/bus-timetable`)
- **Status:** **Live (2026-06-27).** Public mobile-first page listing daily departures from the Muktainagar bus stand. Debounced destination search, EN/MR labels, and a highlighted "next departure" chip based on the current clock. `ItemList` JSON-LD for SEO.
- **Data:** `public.bus_timetable` (admin-editable; public read of `is_active=true` rows). Seed of 36 destinations from the bus-stand photo.
- **Admin:** `BusTimetableTab` in Admin Dashboard provides full CRUD with HH:MM chip validation, Marathi mirror, sort_order, and a visibility toggle.

### Browse by Section (homepage hub)
- **Status:** **Live (2026-06-27).** Replaces the top "Browse by Category" block on the homepage with a section-type hub: Shops, Bus Timetable, Schools, Banks, Government, Hospitals, Lost & Found, Local News. Future sections render a shared `SectionComingSoon` page at `/sections/:key`. The previous shop-category grid is preserved directly below under the heading **Browse Shop Categories**.

### Edit existing shop photo (admin)
- **Status:** **Live (2026-06-27).** `ImageCropPicker` now exposes "Edit current photo" alongside "Change photo" when a saved image exists. Loads the current photo into the same crop surface and re-runs the existing crop→WebP pipeline; the existing replace-cleanup path in `ShopModal` continues to delete the old storage object.

### Edit Profile (`src/components/EditProfileDrawer.tsx`)
- **Purpose:** Let any signed-in user fill out their public identity (`@username`) and personal details (mobile, birth date, gender). Email stays read-only.
- **Workflow:** Open from `UserMenuDrawer` → load `profiles` row → live `username_available` RPC check (debounced, case-insensitive) → on save, UPDATE `profiles`. First username change stamps `full_name_changed_at`; further changes are blocked by the `trg_profiles_lock_username` trigger.
- **Validation:** username `^[a-z][a-z0-9_.]{2,23}$`; phone `^\+?[0-9]{10,15}$`; gender enum; birth date 1900-01-01 ≤ d ≤ today (age derived in UI, not stored).
- **Status:** **Live (2026-06-27).** Backed by patch `2026-06-27_profile_edit.sql`.

### Bus Stand Info (admin-editable)
- **Purpose:** Surface a real click-to-call number and Google Maps deep link for the Muktainagar bus stand on `/bus-timetable` without hardcoding.
- **Workflow:** Admin edits the single `bus_stand_info` row via the `BusTimetableTab` → public page reads it and renders Call + Open on Google Maps buttons.
- **Dependencies:** `public.bus_stand_info` (RLS: public read, admin write).
- **Status:** **Live (2026-06-27).**


---

### App-exposed MCP server (2026-07-04)
- **Status:** **Live in code; requires publish + edge-function deploy to be reachable.**
- **Purpose:** Let external AI assistants (ChatGPT, Claude, Cursor, Codex, etc.) query the Muktainagar Daily directory as a first-class tool source, without scraping the site.
- **Tools exposed (all read-only):** `search_shops`, `get_shop`, `list_categories`, `get_bus_timetable`.
- **Auth:** None. Every tool restricts to `is_active=true` rows and uses the anon key + RLS — no user data, no writes.
- **Endpoint (post-deploy):** `https://fhlaqgzensagjangkpop.supabase.co/functions/v1/mcp`.
- **Authoring surface:** `src/lib/mcp/` (see `COMPONENT_CATALOG.md > MCP server`). Emitted function at `supabase/functions/mcp/index.ts` is regenerated on every `vite build` — never hand-edit.
- **Deploy:** `supabase functions deploy mcp --no-verify-jwt --project-ref fhlaqgzensagjangkpop` on every MCP change.
