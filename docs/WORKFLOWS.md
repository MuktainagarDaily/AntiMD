# Workflows

> For each flow: **entry → steps → data touched → exit**.

---

## Multi-Town Location Selection & Routing

**Entry:** Top header `LocationPill` or root URL `/`.

**Steps:**
1. First visit to `/` triggers `RootCityRedirect` (reads `localStorage['active_city_slug']`), falling back to default town (`muktainagar`) → `/:citySlug`.
2. Any legacy flat route (`/shops`, `/categories`, `/bus-timetable`, `/schools`, `/mess`, `/pg`, `/services`, `/news`, `/saved`) is intercepted by `LegacyCityRedirect` and rerouted to `/:activeCitySlug/...` while preserving query params.
3. `CityRouteGuard` validates `:citySlug` against active cities in `CityContext`.
4. User taps `LocationPill` in the header (or "Change Town / Village" in `UserMenuDrawer`) → opens `CityPickerModal`.
5. Modal queries `geoService.getCities()` (filtered to `is_active = true`) with search bar, district chips, and satellite village selector (`geo_villages`).
6. On city/village selection: `CityContext.selectCity(citySlug)` / `selectVillage(...)` writes to `localStorage` and redirects URL prefix to `/:citySlug/...`.
7. All city-scoped queries (`Home`, `Shops`, `Mess`, `PG`, `Schools`, `BusTimetable`, `EssentialServices`, `LocalNews`) automatically re-fetch for the active `city_id`.

**Data touched:** `geo_states`, `geo_districts`, `geo_cities`, `geo_villages`, `localStorage`, React Router state.

**Exit:** Directory re-renders with listings and town branding localized to the selected city/village.

---

## Visitor Browse & Shop Discovery

**Entry:** `/:citySlug` (`Home`) or category/search link.

**Steps:**
1. `Home` loads `shops` (scoped by `city_id` and `is_active = true`), `mess_profiles`/`mess_daily_menus`, `pg_profiles`, `schools`, `bus_timetable`, `categories`, and banners (`BannerSlot` / `BannerPopup`).
2. User searches in `HomeSearch` (unified omni-search across Shops, Messes & Today's Menus/specials, PGs, Schools, and Bus Routes via Fuse.js + `scoreForgivingMatch`) → highlighted suggestions or **"Ask Sahayak AI"** fallback.
3. User picks a category from `CategoryGrid` / suggestion / shop → navigates to `/:citySlug/shops?category=...` or entity detail route.
4. `Shops` applies URL-persistent filters (`useUrlFilters`), paginates results, surfaces `<DemoBadge />` for Parandwadi samples, and auto-refreshes open/closed status (`isShopOpen`) every 60 s.
5. `ShopDetail` loads shop + categories + multi-photo slider (`PhotoSlider` + `ImageLightbox`) + claim status (`get_claimed_shop_ids` / `shop_is_claimed` RPC) + ratings/reviews (`ReviewsSection` using `get_public_reviewer_names` RPC) + ownership; **Related Shops** strip queries active same-city shops sorted by same-village priority first (up to 12 items; hidden if empty).
6. Citizen action: Call (`handleTelLinkClick` → native `tel:` on mobile touch devices or `<CallNumberDialog />` with copy/WhatsApp on desktop), WhatsApp (`wa.me`), Google Maps directions, Share, Bookmark (`BookmarkButton`), Claim (`ClaimShopModal`), or Write Review (`WriteReviewSheet`).

**Data touched:** `shops`, `categories`, `shop_categories`, `shop_reviews`, `shop_engagement` (INSERT on tap), `shop_bookmarks`, `get_claimed_shop_ids` / `get_public_reviewer_names` RPCs, `shop_owners` (if signed in).

**Exit:** Desktop Call dialog / mobile dialer / WhatsApp / Maps deep-link, detail review drawer, or claim modal.

---

## Sahayak AI Town Assistant & Voice Search

**Entry:** Header / Home floating CTA (with 20 s idle nudge pill) or search fallback `'open-town-assistant'` event → opens `TownAssistantDrawer`.

**Steps:**
1. Citizen types a natural-language query (English, Marathi, or Hinglish) or taps the microphone icon (Web Speech API `SpeechRecognition` with `mr-IN` / `en-IN`).
2. `TownAssistantDrawer` appends the user turn and passes conversation history + active `cityId` + `cityName` + `locale` to `assistantService.askTownAssistant()`.
3. Service invokes Supabase Edge Function `town-assistant`:
   - Server fetches live city-scoped context across **shops, messes, PGs, schools, buses, civic services, and local news** (with RSS/live headline awareness).
   - Sends prompt + structured context to the configured Gemini gateway (`GEMINI_API_KEY`).
   - Returns structured JSON: `replyText`, `detectedLanguage`, `recommendations[]` (`entityType`, `id`/`slug`, `highlightBadge`, `reason`, `phone`/`externalUrl`/`priority`), and `followUpSuggestions[]`.
4. If the Edge Function is unreachable, times out, or lacks an API key, `assistantService` seamlessly drops to a **local deterministic fallback** that scores Supabase client queries + local seeds and tags `mode: 'local-fallback'`.
5. Drawer renders clickable recommendation cards routing directly to `ShopDetail`, `MessDetail`, `PGDetail`, `SchoolDetail`, `BusTimetable`, `EssentialServices`, or `LocalNews`, plus one-tap Call buttons.

**Data touched:** Edge Function `town-assistant`, client/server read queries on `shops_with_claim`, `mess_profiles`, `pg_profiles`, `schools`, `school_notices`, `bus_timetable`, `local_news`, `authority_announcements`, `authority_organizations`.

**Exit:** Direct entity navigation, phone call, or follow-up prompt tap.

---

## Visitor → Sign-In Intent → Listing Request → Published Entity (Multi-Entity)

**Entry:** `UserMenuDrawer` ("List New Business"), Home, Mess, PG, or Schools CTAs dispatch `'open-list-shop-modal'` (`detail?: { entityType }`) → `ListShopModalHost`.

**Steps:**
1. **Guest Auth-Gate & Intent Preservation:** If no user is signed in, `ListShopModalHost` displays a notification toast (`"Please sign in or sign up to list your business"`) and navigates to `/auth?next=<currentPath>&list-shop=<entityType>`. Once Sign In / Sign Up finishes, `Auth.tsx` redirects back to `nextPath` with `?list-shop=<entityType>`, and `ListShopModalHost` automatically opens `RequestListingModal` with `initialEntityType` pre-selected.
2. Submitter confirms **Entity Type**: `shop` (Shop/Business), `mess` (Mess & Bhojanalay), `pg` (PG & Hostel), or `school` (School/College/Coaching).
3. 4-step wizard (`Basics → Location → Optional → Review`) with optional Examiner Autofill (`getEntityAutofillSample`), debounced `localStorage` draft recovery, and per-step Zod validation:
   - Core fields + town/village + OpenStreetMap/Google `LocationMapPicker` pin + `MarathiMirrorField` / `TranslateAllButton`.
   - Photos: `MultiImageCropPicker` crops & compresses up to 5 WebP images.
   - Conditional fields in `meta` JSONB: Mess meal timings/rates/type, PG gender/rent/beds/rules, School type/medium/board/fees/UDISE/admissions.
3. Images upload to `request-images` bucket (`storageNaming.ts`) with a 3-second submit cooldown.
4. Row inserted into `shop_requests` (`status = 'pending'`, `entity_type`, `meta` JSONB, `photos: text[]`, optional `submitter_user_id`).
5. Admin opens `/admin/directory/inbox` → `RequestsTab`:
   - Inspects entity type badge, gallery preview, normalized phone duplicate check, and structured `meta`.
   - Clicking **Approve & Publish** creates the live record in `shops`, `shops`+`mess_profiles`, `shops`+`pg_profiles`, or `schools` (and optional `school_notices` / `shop_categories`).
   - Copies request images permanently into `shop-images` or `school-images` and marks `shop_requests.status = 'approved'`.

**Data touched:** `shop_requests`, `shops`, `shop_categories`, `mess_profiles`, `pg_profiles`, `schools`, `storage.objects` (`request-images`, `shop-images`, `school-images`).

**Exit:** Published listing appears in the active town's directory.

---

## Mess & Dining Discovery, Detail & Owner Hub

**Entry:** `/:citySlug/mess` or recommendation link → `/:citySlug/mess/:id`.

**Steps:**
1. Visitors browse active messes, hotels, and tiffin centers filtered by `city_id`, Veg/Non-Veg/Jain, category (`mess`/`hotel`/`tiffin`), monthly/thali price, and live serving status (`getMessServingStatus`).
2. `Mess` & `MessDetail` display today's menu (`mess_daily_menus WHERE menu_date = CURRENT_DATE`), menu card photos, Sunday Special highlight (`isSundaySpecialActive`), `PhotoSlider` + lightbox, Call / WhatsApp / Maps buttons, and `ReviewsSection`.
3. Signed-in mess owners open `/my-shop` → if the shop has a `mess_profiles` row (or food/mess category), `MessOwnerHub` mounts with 4 tabs (`Today's Menu`, `Menu Card`, `Mess Profile`, `Preview`):
   - `MessMenuManager` updates today's lunch, dinner, special dish, and serving toggle.
   - `MessMenuCardManager` uploads/crops digital menu card images.
   - `MessProfileManager` updates rates, tiffin delivery, timings, and Sunday specials.
   - Quick open/closed toggle saves via `updateShopWithConcurrency`.

**Data touched:** `shops`, `mess_profiles`, `mess_daily_menus`, `shop_reviews`, `shop_engagement`.

**Exit:** Direct phone/WhatsApp inquiry, review submission, or instant live menu update.

---

## PG & Hostels Discovery, Detail & Owner Hub

**Entry:** `/:citySlug/pg` or recommendation link → `/:citySlug/pg/:id`.

**Steps:**
1. Visitors filter housing listings in `city_id` by Gender (`boys`/`girls`/`coed`), occupancy target (`students`/`professionals`/`any`), room sharing rates (Single/Double/Triple/Four), food included, amenities (Wi-Fi, RO water, CCTV, inverter), and available beds.
2. `PGDetail` displays room sharing rate cards, room inventory, deposit, notice period, gate closing time, amenities, multi-photo `PhotoSlider`, direct owner Call / WhatsApp / Maps buttons, and `ReviewsSection`.
3. Signed-in PG owners open `/my-shop` → `PGOwnerHub` (`PGVacancyManager`):
   - One-tap bed vacancy increment/decrement, room-by-room inventory breakdown (`rooms` JSONB), auto-calculated total/available beds (`calculatePGBedsFromRooms`), sharing rates, gate rules, and one-tap **WhatsApp Vacancy Broadcast** text generator (`formatPGWhatsAppBroadcast`).

**Data touched:** `shops`, `pg_profiles`, `shop_reviews`, `shop_engagement`.

**Exit:** Owner vacancy update synced immediately to public `PG` / `PGDetail` pages, or tenant Call/WhatsApp inquiry.

---

## Education Discovery, Institute Claims & School Owner Hub

**Entry:** `/:citySlug/schools` → `/:citySlug/schools/:id` (`SchoolDetail`) or `/my-institute`.

**Steps:**
1. **Discovery (`Schools.tsx`):** Filters institutes by type (`primary`, `secondary`, `higher-secondary`, `college`, `engineering-polytechnic`, `university`, `coaching`, `other`), medium, admission status (`open`, `ongoing`, `upcoming`, `closed`), management type (`government`, `aided`, `private`, `trust`), and board. Cards display batch ratings via `get_schools_rating_summary` RPC and null-safe contact buttons.
2. **Institute Detail (`SchoolDetail.tsx`):**
   - Renders `PhotoSlider` gallery, structured profile (principal, UDISE/AISHE code, board, accreditation, mediums, streams, coaching focus, classes offered, annual fees & fee tier, scholarships, required documents, bus transport villages, seat availability).
   - Displays **Live Notices & Circulars** (`school_notices`, pinned & active), nearby **Messes & PGs** cross-links in the same town, and `ReviewsSection` (`entityType="school"` → `school_reviews` + `get_school_rating`).
   - Logs privacy-safe Call/WhatsApp/Website/Maps/Prospectus actions to `school_engagement` (`logSchoolEngagement`).
3. **Institute Claim (`ClaimSchoolModal.tsx`):**
   - Authenticated user taps **Claim this institute** → chooses role (`Principal / Owner`, etc.), enters phone + optional UDISE/ID + uploads verification proof photo (`udise_letter`, `govt_recognition`, `trust_registration`, `appointment_letter`, `school_board`, etc.) to `shop-images/claims/<user>/<uuid>.webp`.
   - INSERT into `school_claims` guarded by `trg_school_claims_rate_limit` (1 pending per school/user, max 5 pending/user).
   - Admin reviews side-by-side in `/admin/directory/inbox` (`ClaimReviewModal`) → calls `approve_school_claim` RPC (inserts `school_owners`, grants `'shopkeeper'` role, `trg_school_owners_sync_claimed` sets `schools.is_claimed = true`) or `reject_school_claim`.
4. **School Owner Hub (`/my-institute` or `/my-shop` Institute tab → `SchoolOwnerHub.tsx`):**
   - Loads owned schools via `school_owners` and checks ownership cleanly without blocking shop owners.
   - Owner edits admission status/deadline, fees, seat availability, mediums, streams, facilities, scholarships, required docs, transport villages, principal/office timings, photos, and pins live EN/MR notices (`school_notices`).
   - Saves via `updateSchoolAsOwner()` (`schoolConcurrency.ts`) stripped to `OWNER_EDITABLE_SCHOOL_FIELDS`. DB trigger `trg_protect_school_admin_columns` rejects any client attempt to alter `is_active`, `is_verified`, `is_claimed`, `city_id`, `district_id`, `state_id`, `slug`, or `udise_aishe_code` (once verified).

**Data touched:** `schools`, `school_notices`, `school_claims`, `school_owners`, `school_reviews`, `school_review_helpful`, `school_engagement`, `user_roles`, `storage.objects` (`school-images`, `shop-images/claims`).

**Exit:** Updated institute profile & pinned circulars live immediately on `/schools/:id`.

---

## Customer Reviews & Ratings Submission

**Entry:** `ShopDetail`, `MessDetail`, `PGDetail`, or `SchoolDetail` → `ReviewsSection` → **Write a Review**.

**Steps:**
1. Unauthenticated visitors see a Sign In prompt (`Link` to `/auth`).
2. Authenticated users open `WriteReviewSheet` (`entityType` `'shop'` or `'school'`), pick 1–5 stars via `RatingInput`, and write optional commentary (prefilled if updating an existing review).
3. `reviewsApi.useUpsertReview`:
   - For `'shop'`: upserts into `shop_reviews` (unique per `(shop_id, user_id)`).
   - For `'school'`: upserts into `school_reviews` (unique per `(school_id, user_id)`, rate-limited to 5 inserts/24h via `trg_school_reviews_rate_limit`).
4. Other signed-in citizens toggle **Helpful** votes (`shop_review_helpful` / `school_review_helpful`), syncing `helpful_count` via DB triggers.
5. Aggregate ratings & 5-star histograms refresh via `get_shop_rating` / `get_school_rating` RPCs and render with `RatingStars` + `RatingBreakdown`.

**Data touched:** `shop_reviews`, `shop_review_helpful`, `school_reviews`, `school_review_helpful`, `profiles_public` (reviewer display names).

**Exit:** Review appears in `ReviewsSection` with filter (`all`/`positive`/`critical`/`neutral`) and sort (`recent`/`highest`/`lowest`/`helpful`).

---

## Local News Aggregation, Scraping & Discovery

**Entry:** Citizen opens `/:citySlug/news` (`LocalNews`) or Admin opens `/admin/sections/news` (`LocalNewsTab`).

**Steps:**
1. **Public Feed (`LocalNews.tsx`):**
   - Queries active items from `local_news` for `currentCity.id` filtered by category (`general`, `civic`, `education`, `agriculture`, `business`, `events`, `sports`, `weather`) and date range.
   - Groups headlines by **IST calendar day** (`Today`, `Yesterday`, formatted IST date via `newsParser.ts`) and renders `BannerSlot` (`local_news` / `homepage_inline`) ads + source link + Web Share.
   - Clicking **Refresh Live News** triggers `scrapeInternetNews` for the town's enabled `news_sources` when permitted or refreshes persisted feeds.
2. **Admin & Scraping Pipeline (`LocalNewsTab.tsx`):**
   - Admin manages RSS/Atom/Google News/HTML `news_sources` per city, adds manual bilingual notices (`local_news`), pins breaking stories, or bulk-imports via `NewsCsvImportModal` / exports CSV.
   - Clicking **Fetch / Sync Sources** invokes Supabase Edge Function `scrape-local-news` (or Vite middleware `/api/news-proxy` during local dev/preview) to parse XML/RSS/Atom items, deduplicate via `external_url` / normalized title, resolve `published_at` in IST, and upsert into `local_news`.
   - `/api/news-proxy` enforces `isBlockedHost()` SSRF protections (blocking `localhost`, `::1`, `.local`, `.internal`, RFC1918 private ranges, and `169.254.0.0/16` metadata IP).

**Data touched:** `news_sources`, `local_news`, `banners`, `scrape-local-news` Edge Function / dev `/api/news-proxy`.

**Exit:** Categorized, town-scoped bilingual news stream visible to citizens and Sahayak AI.

---

## Essential Services & Civic Authorities

**Entry:** Top header pill / `DesktopNav` / Home section link → `/:citySlug/services` (`EssentialServices`).

**Steps:**
1. Loads `authority_departments`, `authority_organizations`, and active `authority_announcements` (with `announcement_locations` ward scopes) for `currentCity.id`.
2. Citizen filters by department (Water, Electricity, Municipal Council, Police, Health, Revenue, etc.).
3. Active outage notices & broadcasts render with priority badges (`critical`, `high`, `medium`, `low`) and scheduled restoration timestamps.
4. Citizen taps **Emergency Helpline** (`tel:`) or **Maps** directions (`maps_url` / GPS).
5. Admin manages departments, offices, officer contacts, outages, and CSV bulk uploads via `/admin/sections/gov` (`GovernmentServicesTab` + `AuthorityCsvImportModal`).
6. **Privacy boundary:** Officer contact structures stay strictly in React Query / in-memory state — no unencrypted officer PII persisted to `localStorage`.

**Data touched:** `authority_departments`, `authority_organizations`, `authority_announcements`, `announcement_locations`.

**Exit:** Helpline dialer, map navigation, or outage resolution verification.

---

## User → Shop Claim → Owner Access

**Entry:** `ShopDetail` "Claim this shop" button (or `?claim=1` deep-link).

**Steps:**
1. `ClaimShopModal` checks existing user claims for the shop; blocks duplicate pending/approved claims.
2. User enters contact phone, selects `proof_type`, captures/crops proof photo (WebP uploaded to `shop-images/claims/<user>/<uuid>.webp`), and optionally adds a note.
3. INSERT into `shop_claims` → `trg_shop_claims_rate_limit` trigger enforces rate limits (1 pending/shop/user, max 3/shop/24h, max 3/user/1h).
4. Admin opens `/admin/directory/inbox` → **Claims** → clicks **Review** (`ClaimReviewModal`) to inspect shop record vs. claimant profile, proof photo (signed URL via `createShopImageSignedUrl`), and owners on record.
5. Admin clicks **Approve** (`approve_shop_claim` RPC → inserts `shop_owners`, grants `user_roles.role='shopkeeper'`, marks claim approved) or **Reject** (`reject_shop_claim` RPC with required notes).
6. Note: `revoke_shop_owner` checks both `shop_owners` and `school_owners` before stripping `'shopkeeper'` so dual owners keep access.

**Data touched:** `shop_claims`, `shop_owners`, `user_roles`, `profiles`, `storage.objects` (`shop-images/claims/*`).

**Exit:** Owner accesses `/my-shop`.

---

## Owner Shop Edit

**Entry:** `/my-shop` (includes switcher across multiple owned shops and switch tab/route to owned schools).

**Steps:**
1. Load shop via `shop_owners` → `shops`; subscribe to realtime channel `postgres_changes` via `useRealtimeChannel`.
2. Form tracks dirty state; sticky save bar appears on edits.
3. Open/Closed quick toggle saves via `updateShopWithConcurrency`.
4. Photo edits via `MultiImageCropPicker` stage deletions in `pendingImageDeletionsRef`.
5. Save validates phone/WhatsApp, strips payload via `pickOwnerEditable` (`OWNER_EDITABLE_FIELDS`), runs optimistic lock `UPDATE shops ... WHERE id=$1 AND updated_at=$2 RETURNING *`:
   - Zero rows returned → concurrency conflict → rolls back local edits and displays fresh server values.
   - Success → deletes staged `pendingImageDeletions` from storage (`removeShopImageQuiet`).

**Data touched:** `shops`, `mess_profiles`/`pg_profiles` (if applicable), `storage.objects` (`shop-images`).

**Exit:** Save bar clears; `ShopPreviewSheet` lets owner preview live card + detail view.

---

## Admin Login + Modular Hub Dashboard

**Entry:** `/admin/login` (redirects to `/auth?next=%2Fadmin%2Foverview`) or direct `/admin/*`.

**Steps:**
1. User signs in → `useAuth.fetchRoles` populates `roles`, `isAdmin`, `isShopkeeper`.
2. `ProtectedRoute requireRole="admin"` verifies `isAdmin` after `rolesLoading` resolves.
3. `AdminLayout` renders responsive `AdminSidebar` + `BranchTabs` driven by `ADMIN_NAV` (`adminNav.ts`):
   - **Overview:** `/admin/overview` (city vs all-town stats + quick backup/import/Marathi shortcuts).
   - **Directory:** `Shops`, `Mess & Hotels`, `PG & Hostels`, `Categories`, `Claims & Requests` (`inbox`).
   - **Sections:** `Bus Timetable`, `Education & Institutes`, `Essential Services & Authorities`, `Local News` live (`hospitals`, `banks`, `lostfound` coming soon).
   - **Marketing:** `Advertisements`.
   - **Insights:** `Analytics`.
   - **System:** `Data Backup`, `Storage & Health`, `Marathi Translations`, `AI & Tool Integrations` (MCP endpoints).

**Exit:** Sidebar navigation, branch switching, or sign-out.

---

## Banner Management & Multi-Town Geo-Targeting

**Entry:** `/admin/marketing/ads` (`AdvertisementsTab`).

**Steps:**
1. Admin creates/edits banner via `BannerModal` (title, image crop+upload to `banner-images`, target URL, town targeting `"All Towns"` vs district/city, placement across 8 slots, popup delay/close timer, date range, active toggle, `BannerPreview`).
2. `AdvertisementsTab` shows town badge per banner, drag/reorder within placement (`reorder_banners` RPC), pause/resume individual or all banners (`setAllBannersActive`), and local `"Hide ads for me"` toggle (`localStorage['md_ads_runtime'] = '0'`).
3. Public `BannerSlot` checks 3-layer kill switch (`VITE_ADS_ENABLED` → `md_ads_runtime` → `is_active` + schedule window), filters by city (`target_level='all'` or `target_city_id`), deduplicates per route, tracks views at 40% IntersectionObserver (`increment_banner_view`), and logs clicks (`increment_banner_click`).
4. `BannerPopup` gates full-screen popup on `!wasPopupSeenToday && !wasPopupShownThisSession`, dwell timer `max(20s, popup_delay_seconds)` + scroll depth ≥ 30% or 600 px, and enforces `close_enable_seconds` button lock.

**Data touched:** `banners`, `storage.objects` (`banner-images`).

**Exit:** Geo-targeted sponsored creative live across directory & news placements.

---

## Analytics & Insights

**Entry:** `/admin/insights/analytics` (`AnalyticsTab`).

**Steps:**
1. Queries up to 5,000 rows from `shop_engagement` for selected window (`7d` / `30d` / `all`).
2. Aggregates total taps, calls vs WhatsApp vs Maps breakdown, top shops, and top categories.
3. Exports period CSV (`downloadCsv`) or imports historical engagement rows via `AnalyticsCsvImportModal`.

**Data touched:** `shop_engagement`, `shops`, `shop_categories`, `categories`.

**Exit:** Exported analytics CSV or refreshed charts.

---

## Master Backup / Restore (20 Datasets) & Per-Module CSV Workflows

**Entry:** `/admin/system/data` (`MasterExportModal` / `MasterImportModal`) or module-level Export/Import buttons on Admin directory/section pages.

**Steps:**
1. **Master Export (`MasterExportModal.tsx`):**
   - Queries all **20 directory & platform tables** registered in `MASTER_DATASETS` (`masterDatasets.ts`) via paginated `fetchAllPaged` (>1,000-row safe): `categories`, `shops`, `shop_categories`, `mess_profiles`, `mess_daily_menus`, `pg_profiles`, `schools`, `school_notices`, `school_claims`, `bus_timetable`, `bus_stand_info`, `news_sources`, `local_news`, `banners`, `authority_departments`, `authority_organizations`, `authority_announcements`, `announcement_locations`, `requests`, `claims`.
   - Serializes PostgreSQL arrays (`text[]`/`uuid[]`), JSONB columns (`sharing_rates`, `rooms`, `meta`, `key_contacts`, etc.), numbers, and booleans via `csvFromObjects` (`csvUtils.ts`), neutralizing spreadsheet formula prefixes (`=`, `+`, `-`, `@`, tab, CR).
   - Optionally packages `shop-images`, `school-images`, and `banner-images` assets into ZIP subfolders (`images/`).
2. **Master Import (`MasterImportModal.tsx`):**
   - Accepts either a single `.csv` (admin chooses dataset target) or a Master `.zip` bundle imported in **FK-safe dependency order** (`categories` → `shops` → `shop_categories` → living → education → civic → moderation).
   - Runs `coerceDatasetRow()` to reconstruct `text[]`, JSONB objects, booleans, numerics, and `NOT NULL DEFAULT '{}'` values safely with Skip-Duplicates or Upsert mode in 200-row batches.
3. **Per-Module CSV Imports & Exports:**
   - Dedicated validated importers & templates across admin modules: `CsvImportModal` (Shops), `CategoryCsvImportModal` (Categories), `MessCsvImportModal` (Mess profiles + daily menu), `PGCsvImportModal` (PG profiles + sharing rates), `SchoolBulkImportModal` (Schools + Marathi/metadata), `BusBulkImportModal` (Bus routes + departure times), `NewsCsvImportModal` (Local news headlines), `AuthorityCsvImportModal` (Civic announcements), and `AnalyticsCsvImportModal` (Shop engagement). All share RFC 4180 multiline-safe `parseCsv` + `csvUtils.ts`.

**Data touched:** All 20 `MASTER_DATASETS` tables + `shop_engagement` + storage buckets.

**Exit:** Complete downloadable `.zip` backup, single `.csv` export, or validated DB restore/upsert.

---

## System Health, Storage Audit & Data Hygiene

**Entry:** `/admin/system/quality` (`DataQualityTab` powered by `storageHealthService.ts` + `dataQualityHelpers.ts`).

**Steps:**
1. **System Diagnostics (`SystemDiagnosticsPanel`):**
   - Calls admin-only `get_system_health_snapshot` RPC + checks Supabase latency, Edge Function availability (`town-assistant`, `scrape-local-news`, `mcp`), `storage.objects` root listing RLS readiness (`IS DISTINCT FROM 'claims'`), `image_checked_at`/`image_broken_at` schema readiness, and `category_shop_counts` MV drift with one-tap `refresh_category_counts_mv` / local cache clear.
2. **Storage Audit (`StorageAuditPanel`):**
   - Recursively lists `shop-images` bucket (`listAllShopImageObjects`), cross-checks active paths across **8 entity/media tables** (`extractEntityStoragePaths`), identifies orphan files for cleanup, purges expired resolved claim proof photos (PII retention hygiene), probes image URLs via `verifyImageUrl()` to stamp `image_broken_at` across `shops`/`schools`/`banners`, and runs safe slug-based rename planning (`moveShopImage` syncing `image_url` + `photos[0]`).
3. **Listing Hygiene (`ListingHygienePanel`):**
   - Audits active shops and schools scoped by town for `missing_phone`, `invalid_phone`, `unverified`, `no_photo`, `broken_photo`, `no_gps`, and `missing_marathi`; opens `ShopModal` / `SchoolModal` inline or exports hygiene CSV.
4. **Areas & Duplicates (`AreaDuplicatesPanel`):**
   - Clusters fuzzy-similar area strings per city (`findSimilarAreaGroups`) with one-tap batch area normalization, plus duplicate-phone/name shop detection (`findDuplicateShops`).

**Data touched:** `shops`, `schools`, `banners`, `shop_claims`, `school_claims`, `shop_requests`, `mess_daily_menus`, `category_shop_counts`, `storage.objects`, `get_system_health_snapshot` RPC.

**Exit:** Clean storage bucket, accurate MV counts, normalized areas, and repaired/flagged media links.

---

## Category Merge

**Entry:** `/admin/directory/categories` (`CategoryMergeModal`, available when `shopCount > 0`).

**Steps:**
1. Admin picks target category (excluding self) and optional "disable source after merge".
2. Fetches source `shop_categories.shop_id[]` and target `shop_id[]`.
3. Computes `toReassign = source \ target` and `toDelete = source ∩ target`.
4. Deletes source links → inserts `toReassign` into target → optionally sets source `is_active = false` → invalidates caches.

**Data touched:** `shop_categories`, `categories`.

**Exit:** Zero orphaned shops; zero duplicate category mappings.

---

## Auth Lifecycle & Profile Handle Lock

**Sign-up:** `supabase.auth.signUp` → email confirm → DB trigger inserts `profiles` row → optional first-admin bootstrap (`claim_first_admin` RPC).

**Sign-in:** `signInWithPassword` → `AuthProvider.onAuthStateChange` → `fetchRoles(userId)` (deferred via `setTimeout(0)` to prevent deadlock).

**Password reset:** `/auth?mode=forgot` → `resetPasswordForEmail` → email link → `/reset-password` → `updateUser({ password })`.

**Profile & Handle Update (`EditProfileDrawer`):**
- Edits `profiles` (`full_name` `@username`, phone, birth date, gender).
- Live availability check via `username_available` RPC; first username edit sets `full_name_changed_at` via `trg_profiles_lock_username` DB trigger and locks `@username` permanently.

**Role grants:**
- `shopkeeper`: `approve_shop_claim`, `assign_shop_owner`, `approve_school_claim`, or `assign_school_owner` RPCs.
- `admin`: migration seed or `claim_first_admin` RPC.

---

## Bookmark / SavedShops

**Bookmark toggle:** `BookmarkButton` → if guest, stores up to `guestBookmarks.ts` limit in `localStorage` or prompts `/auth?next=...`; if signed in, INSERT/DELETE `shop_bookmarks` and invalidate `['saved-shops', userId]`.

**SavedShops page (`/:citySlug/saved`):** Loads `shop_bookmarks ORDER BY created_at DESC` (or guest localStorage IDs) → queries `shops IN (ids)` → preserves bookmark order, supports search/sort/bulk-remove.

---

## Marathi Translation Pipeline & Quota Management

**Inline (Admin modals):** `MarathiMirrorField` for manual Devanagari input; `TranslateAllButton` batch-translates EN fields via `translateEnToMr` → 5-layer cascade (in-memory → `localStorage` → `translation_cache` table → MyMemory API → **Gemini AI `town-assistant` `{ mode: 'translate' }` fallback**).

**Bulk backfill (`MarathiBackfillModal` via `/admin/system/marathi` or `/admin/overview`):**
1. Scans for Categories, Shops, and Schools missing Marathi fields (`category_translations`, `shop_translations`, `schools.name_mr`, `schools.address_mr`).
2. Displays 3 progress counters and runs 2 concurrent worker streams with 100 ms throttle pacing.
3. Rejects MyMemory warning strings or untranslated echo responses cleanly and never overwrites existing admin-entered Marathi text.
4. Supports safe cancellation (`cancelRef.current = true`).

**Citizen Read:** `useLocalizedShop(rawShop)` overlays `mr` values when `locale === 'mr'`; `useLocalizeCategoryName(id, fallback)` localizes categories; native `*_mr` columns serve Schools, Bus Timetable, News, and Essential Services.
