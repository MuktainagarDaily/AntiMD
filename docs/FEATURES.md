# Features

> Status legend: **Active** | **Legacy** | **Experimental** | **Deprecated** | **Removed**.
> Each entry: *Purpose · Workflow · Dependencies · Status*.

## User Features (visitor + signed-in user)

### Home discovery (`src/pages/Home.tsx`)
- **Purpose:** Single-page town entry surfacing sections hub, dynamic shop categories, search, critical civic alert banner, recently-added strip, and "List a Shop / Business" CTA.
- **Workflow:** Load `shops` + `categories` + active `criticalAlerts` for `currentCity` → render category grid (8/row on desktop) + search + recent strip → tap category/shop → `/:citySlug/shops` or `/:citySlug/shop/<slug>`.
- **Dependencies:** `fuzzySearch.ts`, `useTranslationsCache`, `BannerSlot`, `BannerPopup`, `RequestListingModal`, `CategoryIcon`, `SectionIcon`.
- **Status:** Active.

### Shop listing (`src/pages/Shops.tsx`)
- **Purpose:** Full paginated retail directory with URL-persistent filters (excludes Mess & PG specialty shops via `filterRetailShops`).
- **Workflow:** Client-side Fuse.js fuzzy filter with **natural-language synonym expansion** (`src/lib/searchSynonyms.ts`: EN/Hinglish/Marathi) + village chips + Open Now / Verified / category chips + drawer filters → 10/page → auto-refresh open/closed every 60 s.
- **Dependencies:** `Fuse.js`, `searchSynonyms.ts`, `useUrlFilters`, `ShopCard`.
- **Status:** Active.

### Shop detail (`src/pages/ShopDetail.tsx`)
- **Purpose:** Conversion surface — Call, WhatsApp, Maps, Share, Bookmark, Claim, and Reviews.
- **Workflow:** Load shop + categories + multi-photo gallery + claim status + ratings/reviews → engagement-logged actions → **Strict Geographic & Hyper-Local Related Shops** strip (same `city_id` boundary, `village_id` prioritized, max 12 items, DOM-hidden if empty).
- **Dependencies:** `PhotoSlider`, `ImageLightbox`, `BookmarkButton`, `ClaimShopModal`, `ReviewsSection`, `BannerSlot`, `PageSeo` (JSON-LD `LocalBusiness`).
- **Status:** Active.

### Sahayak AI Town Assistant (`src/components/TownAssistantDrawer.tsx`)
- **Purpose:** Always-available floating bilingual AI assistant (English / Marathi / Hinglish) with voice search.
- **Workflow:** Mounted globally in `App.tsx`; opens drawer over any public route → accepts typed or **Web Speech API voice** queries (`en-IN` / `mr-IN`) → invokes `town-assistant` Edge Function (Gemini Gateway) or falls back to deterministic local search (`src/lib/assistant/assistantService.ts`) across all **7 verticals** (`mess`, `pg`, `shop`, `bus`, `school`, `news`, `service`) → renders tappable entity cards + one-tap Call/route actions.
- **Dependencies:** `town-assistant` Edge Function, `assistantService.ts`, `useCity`, Web Speech API.
- **Status:** Active.

### Education & Institutes Portal (`/:citySlug/schools`, `/:citySlug/schools/:id`)
- **Purpose:** Complete town education directory covering primary schools, high schools, colleges, polytechnics, ITI, universities, and coaching centers.
- **Workflow:**
  - **List (`src/pages/Schools.tsx`):** Filter by `school_type`, `medium`, `admission_status`, `management_type`, search text, and quick category pills (`Schools`, `Colleges`, `Higher Ed`), displaying rating badges (`get_schools_rating_summary`) and admission chips.
  - **Detail (`src/pages/SchoolDetail.tsx`):** Dedicated profile with photo gallery, structured academics/board/UDISE info, fee tier & annual min/max, scholarships, required documents checklist, transport villages, pinned **Live Notices & Circulars** (`school_notices`), verified community reviews (`school_reviews`), `ClaimSchoolModal`, nearby PG/Mess discovery links, engagement telemetry (`school_engagement`), and interactive **WhatsApp Admission Enquiry Builder**.
- **Dependencies:** `schoolsRepo.ts`, `schoolNoticesRepo.ts`, `schoolHelpers.ts`, `schoolEngagement.ts`, `reviewsApi.ts`, `ClaimSchoolModal.tsx`.
- **Status:** Active.

### Local News (`/:citySlug/news`, `src/pages/LocalNews.tsx`)
- **Purpose:** Hyperlocal, dated town news feed with bilingual headline/summary support and automatic web/RSS refresh.
- **Workflow:** Loads active `local_news` for `currentCity` ordered by `is_pinned DESC, published_at DESC` → auto-triggers initial scrape when a town feed is empty → filter by category (`local`, `civic`, `education`, `agriculture`, `markets`, `sports`, `alerts`), date range (`today`/`7d`/`30d`/`all`), or search → share articles or open source links.
- **Dependencies:** `newsService.ts`, `newsParser.ts`, `scrape-local-news` Edge Function, `/api/news-proxy` (dev/preview), `news_sources`, `local_news`.
- **Status:** Active.

### Essential Services & Civic Authorities (`/:citySlug/services`, `src/pages/EssentialServices.tsx`)
- **Purpose:** Public civic portal for municipal authorities, water supply schedules, electricity maintenance (MSEDCL), civic alerts, and 24x7 emergency helplines.
- **Workflow:** Loads `authority_departments`, `authority_organizations`, and active/scheduled `authority_announcements` for `currentCity` → filters by department → highlights critical/high severity advisories and one-tap emergency dials. Officer contact lists are kept strictly in-memory per session (zero `localStorage` PII persistence).
- **Dependencies:** `authorityService.ts`, `authority_*` tables.
- **Status:** Active.

### Mess & Dining Directory (`/:citySlug/mess`, `/:citySlug/mess/:id`)
- **Purpose:** Local mess halls, tiffin centers, and budget dining discovery with live daily menus.
- **Workflow:** Browse list (`Mess.tsx`) with dietary filters (`pure_veg`, `veg_nonveg`, `jain_available`), Sunday Feast badges, and live serving status → tap into `MessDetail.tsx` (`/:citySlug/mess/:id`) for multi-photo slider, today's lunch/dinner menu board, fixed-price menu card items, thali rates, and `ReviewsSection`.
- **Dependencies:** `mess_profiles`, `mess_daily_menus`, `livingService.ts`, Realtime `mess_daily_menus`.
- **Status:** Active.

### PG & Hostels Directory (`/:citySlug/pg`, `/:citySlug/pg/:id`)
- **Purpose:** Student and working-professional hostel finder with live bed vacancies.
- **Workflow:** Filter list (`PG.tsx`) by gender (`boys`/`girls`/`both`), occupancy target, and available beds → tap into `PGDetail.tsx` (`/:citySlug/pg/:id`) for 1/2/3/4-sharing or per-room rates, deposit/notice period, gate curfew, amenities checklist, photos, and `ReviewsSection`.
- **Dependencies:** `pg_profiles`, `livingService.ts`.
- **Status:** Active.

### Offline MSRTC / PMPML Bus Timetable (`/:citySlug/bus-timetable`, `src/pages/BusTimetable.tsx`)
- **Purpose:** Town bus departures and stand helpline accessible even offline.
- **Workflow:** Filter by outgoing/incoming direction, operator type (`MSRTC Ordinary`, `MSRTC Express`, `PMPML`, `Local Shuttle`), or destination search → highlights next IST departure. Hydrates from `localStorage` snapshot (`md.bus.v1.*`) + Workbox `NetworkFirst` runtime cache when offline. Includes Parandwadi/Maval PMPML Route 342 & Talegaon seeds.
- **Dependencies:** `busCache.ts`, `busHelpers.ts`, `bus_timetable`, `bus_stand_info`.
- **Status:** Active.

### Listing request — 4-step multi-entity wizard (`src/components/RequestListingModal.tsx`, `ListShopModalHost.tsx`)
- **Purpose:** Guest-friendly 4-step wizard for submitting a Shop, Mess, PG, or School with gallery photos and `localStorage` draft recovery.
- **Workflow:** Opened via global `open-list-shop-modal` event → uploads WebP images to `request-images/` → inserts `shop_requests` (`entity_type`, `photos[]`, `meta jsonb`).
- **Status:** Active.

### Claims & Ownership Verification (`ClaimShopModal.tsx`, `ClaimSchoolModal.tsx`, `ClaimReviewModal.tsx`)
- **Purpose:** Verifiable owner claims for both businesses (`shop_claims`) and schools/colleges (`school_claims` with UDISE+/trust/govt recognition proofs).
- **Workflow:** Camera/file proof compressed to WebP → uploaded to `shop-images/claims/<user_id>/<uuid>.webp` → admin side-by-side verification via signed URL → `approve_shop_claim` / `approve_school_claim` RPC.
- **Status:** Active.

### Customer reviews & ratings (`src/components/reviews/ReviewsSection.tsx`, `WriteReviewSheet.tsx`)
- **Purpose:** Verified ratings & reviews for both businesses (`shop_reviews`) and educational institutes (`school_reviews`).
- **Workflow:** Star average + 5-bar `RatingBreakdown`, filter/sort chips (`recent`, `highest`, `lowest`, `helpful`), helpful vote toggle (`shop_review_helpful` / `school_review_helpful`), one-review-per-user upsert (`WriteReviewSheet`).
- **Dependencies:** `reviewsApi.ts`, `RatingBreakdown`, `RatingStars`, `RatingInput`.
- **Status:** Active.

### Bookmarks (`BookmarkButton.tsx`, `SavedShops.tsx`), Auth (`Auth.tsx`, `ResetPassword.tsx`), Edit Profile (`EditProfileDrawer.tsx`), Language Switcher (`LanguageSwitcher.tsx`), Offline Overlay & Error Pages
- **Status:** Active.

### Shared Footer (`src/components/shared/Footer.tsx`)
- **Purpose:** Consistent localized copyright footer rendered across public pages and `UserMenuDrawer`.
- **Implementation Note:** Currently renders `t('home.footer')` only; the external "Built for Vibe Forge Hackathon" attribution link (`vibe-forge.in`) is intentionally **commented out** (`{/* Temporarily hidden */}`) for now.
- **Status:** Active (attribution link commented out).

### Installable PWA & Meta Tags (`vite.config.ts`, `index.html`, `src/lib/pwa/register.ts`)
- **Purpose:** Production home-screen installability and offline support. Includes standard `<meta name="mobile-web-app-capable" content="yes" />` alongside Apple tags in `index.html`; `register.ts` blocks registration on dev/preview/iframe hosts.
- **Status:** Active.

## Owner Features (`/my-shop` & `/my-institute`, `src/pages/MyShop.tsx`)

- **Unified Multi-Entity Switcher:** Signed-in owners switch cleanly between all owned Shops, Messes, PGs, and Schools/Institutes. Realtime subscriptions track changes across `shops`, `shop_requests`, `shop_owners`, and `school_owners`.
- **Shop Editor (`MyShop.tsx`):** Dirty tracking, Open/Closed toggle, WebP image upload/cleanup, `updateShopWithConcurrency` optimistic locking.
- **`MessOwnerHub` (`src/components/myshop/MessOwnerHub.tsx`):** Today's lunch/dinner daily menu publisher (`MessMenuManager`), fixed-price thali/menu card builder (`MessMenuCardManager`), profile/rates editor (`MessProfileManager`), WhatsApp broadcast generator, and live preview.
- **`PGOwnerHub` (`src/components/myshop/PGOwnerHub.tsx`):** Bed vacancy toggles in **Simple** or **Advance Room-by-Room** mode (`PGVacancyManager`), rules/curfew/sharing-rates editor, amenities/multi-photo gallery, and WhatsApp vacancy broadcast.
- **`SchoolOwnerHub` (`src/components/myshop/SchoolOwnerHub.tsx`):** 4-tab Institute Portal covering **Notices & Circulars** (`school_notices` create/pin/archive + WhatsApp circular broadcast), **Admissions, Fees & Scholarships** (status, deadline, URLs, board, fee min/max, seats, transport villages), **Campus, Contact & Gallery** (`updateSchoolAsOwner` concurrency lock, `protect_school_admin_columns`), and **Live Analytics** (`school_engagement` 30-day metrics).

## Admin Features (`/admin/*`)

| Hub & Leaf | Route | Capabilities |
|---|---|---|
| **Overview** | `/admin/overview` | City vs All-Town KPI cards (incl. Shop + School claims), quick ZIP export/import, Marathi backfill, Speed Add, section shortcuts |
| **Directory › Shops** | `/admin/directory/shops` | Paginated table, broken-image scan, two-tap active/verified toggles, Speed Add, CSV Export + `CsvImportModal` |
| **Directory › Mess** | `/admin/directory/mess` | Mess/Hotel/Tiffin profiles, daily menus, 21-col CSV Export + `MessCsvImportModal` |
| **Directory › PG** | `/admin/directory/pg` | Hostel vacancy controls, sharing rates, 22-col CSV Export + `PGCsvImportModal` |
| **Directory › Categories** | `/admin/directory/categories` | `EntityTab` shell, pre-flight delete check, `CategoryMergeModal`, CSV Export + `CategoryCsvImportModal` |
| **Directory › Inbox** | `/admin/directory/inbox` | Multi-entity Requests queue, Shop & School Claims (`ClaimReviewModal`), Owners CSV export, Direct Assign (`assign_shop_owner` / `assign_school_owner`) |
| **Sections › Bus** | `/admin/sections/bus` | Route direction/type editor, Stand Info, Parandwadi seeds, CSV Export + `BusBulkImportModal` |
| **Sections › Schools** | `/admin/sections/schools` | Education Portal CRUD, Muktainagar/Maval seeds, 45-col CSV Export + `SchoolBulkImportModal` |
| **Sections › Essential Services** | `/admin/sections/gov` | Civic departments, organization contacts, scheduled/active announcements, CSV Export + `AuthorityCsvImportModal` |
| **Sections › Local News** | `/admin/sections/news` | `news_sources` manager, one-click RSS/Web Scrape, pinned article CRUD, CSV Export + `NewsCsvImportModal` |
| **Marketing › Ads** | `/admin/marketing/ads` | 8 placements, geo-targeting (`all`/`district`/`city`), drag-reorder, bulk pause/resume, 14-col CTR CSV Export, admin hide toggle |
| **Insights › Analytics** | `/admin/insights/analytics` | Shop + School 30d/all engagement dashboards, town filter, CSV Export + `AnalyticsCsvImportModal` |
| **System › Data Backup** | `/admin/system/data` | `MasterExportModal` (20 CSV datasets + organized `/images` ZIP) & `MasterImportModal` (FK-safe `coerceDatasetRow()` import) |
| **System › Storage & Health** | `/admin/system/quality` | 4-panel Health Suite (`SystemDiagnosticsPanel`, `StorageAuditPanel`, `ListingHygienePanel` + Audit CSV export, `AreaDuplicatesPanel` with Devanagari-safe matching) |
| **System › Marathi** | `/admin/system/marathi` | Batch EN→MR translation pipeline (Categories, Shops, Schools, 50k/day quota, zero-overwrite guard) |
| **System › MCP** | `/admin/system/mcp` | External MCP server registry (`mcp_endpoints`) with prod HTTPS/localhost & secret-ref validation |

### App-exposed MCP server (`/functions/v1/mcp`)
- **Status:** **Active.** Auto-emitted on `vite build` from `src/lib/mcp/index.ts`.
- **Auth:** OAuth 2.1 (`https://<projectRef>.supabase.co/auth/v1`, audience `authenticated`, consent UI at `/.lovable/oauth/consent`).
- **Tools (7 read-only):** `search_shops`, `get_shop`, `list_categories`, `get_bus_timetable`, `get_local_news`, `search_schools`, `get_civic_services`.

## Legacy / Deprecated / Removed

- **`shops.category_id` column:** Deprecated in favor of `shop_categories` junction table.
- **`shops.is_open` boolean:** Legacy quick-toggle; actual open/closed computed via `isShopOpen()`.
- **`/admin/login` & `/admin/directory/quality`:** Redirect shims to `/auth` and `/admin/system/quality`.
- **`src/integrations/supabase/types.ts` legacy scaffold references:** Runtime client uses `external-types.ts`; old Harsh Mobile & TanStack Start files remain removed.
