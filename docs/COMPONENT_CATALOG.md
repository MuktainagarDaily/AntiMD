# Component Catalog

> Excludes `src/components/ui/` (shadcn primitives — see shadcn docs). Each entry lists *Purpose · Key props · Usage locations*.

---

## `src/components/` (Top Level)

| File | Purpose | Key props | Used by |
|---|---|---|---|
| `BookmarkButton.tsx` | Bookmark/unbookmark a listing (supports signed-in DB bookmarks + `guestBookmarks.ts` local bookmarks) | `shopId`, `className?` | `ShopDetail`, `MessDetail`, `PGDetail` |
| `ClaimShopModal.tsx` | Ownership-claim submission modal for businesses — proof type selector + camera/WebP proof upload to `shop-images/claims/<user>/<uuid>.webp` | `shopId`, `shopName`, `onClose` | `ShopDetail` |
| `ClaimSchoolModal.tsx` | Ownership-claim submission modal for schools/colleges/coaching — role selector (`Principal / Owner`, etc.), optional UDISE/AISHE code, proof type (`udise_letter`, `govt_recognition`, etc.), WebP proof upload | `schoolId`, `schoolName`, `defaultUdise?`, `onClose` | `SchoolDetail` |
| `DesktopNav.tsx` | Desktop horizontal navigation bar highlighting active town route across Home, Shops, Food & Mess, PG & Rooms, Bus Timetable, and Civic Services | `variant?`, `className?` | `Shops`, `ShopDetail`, `Mess`, `MessDetail`, `PG`, `PGDetail`, `SchoolDetail` |
| `EditProfileDrawer.tsx` | Profile editor (`profiles` mobile, birth date, gender, and one-time `@username` validated via `username_available` RPC + DB lock trigger) | `open`, `onOpenChange` | `UserMenuDrawer` |
| `LanguageSwitcher.tsx` | EN/MR pill toggle (`variant`, `tone`); on `Home` pinned top-right (`z-20`) cleanly above `UserMenuDrawer` avatar | `variant?`, `tone?`, `className?` | `Home`, `Shops`, `UserMenuDrawer` |
| `ListShopModalHost.tsx` | App-root singleton host listening for `'open-list-shop-modal'` (`detail?: { entityType }`); gates unauthenticated guests via toast + `/auth?next=...&list-shop=...` and resumes `RequestListingModal` with preselected entity on return | – | `App.tsx` |
| `NavLink.tsx` | React Router nav link with active styling | React Router `NavLinkProps` | App navigation |
| `RequestListingModal.tsx` | 4-step public listing wizard (`Basics → Location → Optional → Review`) for Shops, Mess, PG, and Schools with `initialEntityType`, entity-specific `getEntityAutofillSample` autofill, debounced draft persistence, `MultiImageCropPicker`, `LocationMapPicker`, `MarathiMirrorField`, and 3 s submit cooldown | `onClose`, `initialEntityType?` | `ListShopModalHost` |
| `SafeImage.tsx` | `<img>` wrapper falling back to a neutral `ImageOff` placeholder on empty or failed `src` | `src?`, `alt`, `<img>` props | `admin/ShopsTab`, admin cards |
| `ShopCard.tsx` | Standard business directory card delegating layout slots to `EntityCard`, displaying rating inline, Parandwadi `<DemoBadge />`, open/closed status, claim badge, and desktop-safe Call (`handleTelLinkClick`) / WhatsApp / Maps actions | `shop` | `Shops`, `SavedShops`, `ShopDetail` (related strip) |
| `TownAssistantDrawer.tsx` | **Sahayak AI** slide-up conversational assistant drawer with 20s idle FAB nudge pill, `'open-town-assistant'` event support, EN/MR/Hinglish text + Web Speech voice search, multi-turn history, offline deterministic fallback, clickable recommendations (`shop`, `mess`, `pg`, `bus`, `school`, `news`, `service`), and swipe-down close | `open`, `onOpenChange`, `initialQuery?` | `App.tsx` (`Home`, search fallbacks) |
| `UserMenuDrawer.tsx` | Slide-up user drawer with tier badge (`guest`/`member`/`admin`), city/village picker trigger, renamed actions (`List New Business`, `My Businesses`, `Saved`; `My Institutes` removed), owned `/my-shop` shortcut, settings (theme/language/animated 5-step Clear Cache progress bar), and refreshed About sheet | (reads `useAuth`, `useCity`) | App page headers (`Home`, `BusTimetable`, etc.) |
| `theme-provider.tsx` | Wraps `next-themes` `ThemeProvider` | `children`, theme props | `App.tsx` |

---

## `src/components/home/`

| File | Purpose | Key props | Used by |
|---|---|---|---|
| `CategoryGrid.tsx` | Home "Browse by Category" responsive grid with expand/collapse toggle and loading skeletons | `categories`, `visibleCategories`, `catShopCounts`, `showAllCats`, `onToggleShowAll`, `canExpand`, `loading`, `localizeCat` | `Home` |
| `CompactShopCard.tsx` | Compact horizontal card for Home "Recently Added" row with LCP `priority` image hint, rating inline, and deduped Call/WA logging | `shop`, `priority?` | `ShopList` |
| `HomeSearch.tsx` | Hero omni-search bar with EN/MR rotating hints, suggestions across Shops, Messes (+ Today's Menus/specials), PGs, Schools, and Bus Routes, Sahayak AI fallback CTA, and keyboard/outside-click handling | `search`, `focused`, handlers & `suggestions` (`OmniSearchSuggestion[]`) | `Home` |
| `ShopList.tsx` | Horizontal scrollable "Recently Added" shop strip with smooth arrow controls | `shops` | `Home` |

---

## `src/components/reviews/` & `src/components/shared/rating/`

| File | Purpose | Key props | Used by |
|---|---|---|---|
| `reviews/ReviewsSection.tsx` | Ratings summary (`RatingBreakdown`), filter tabs (`all`/`positive`/`critical`/`neutral`), sort (`recent`/`highest`/`lowest`/`helpful`), pagination, and write CTA for shops and schools | `shopId`, `shopName`, `entityType?` (`'shop' \| 'school'`) | `ShopDetail`, `MessDetail`, `PGDetail`, `SchoolDetail` |
| `reviews/WriteReviewSheet.tsx` | Interactive 1–5 star review composer/editor/delete sheet supporting both shops (`shop_reviews`) and institutes (`school_reviews`) | `open`, `onClose`, `shopId`, `shopName`, `existing?`, `entityType?` | `ReviewsSection` |
| `reviews/ReviewCard.tsx` | Individual review card with deterministic color avatar, expandable text, Helpful vote toggle, and owner edit/delete actions | `review`, `helpfulOn?`, `onEdit?`, `entityType?` | `ReviewsSection` |
| `shared/rating/RatingBadge.tsx` | Compact numeric score pill with star icon | `rating`, `size?` | Cards, detail headers |
| `shared/rating/RatingBreakdown.tsx` | 5-star bar histogram widget | `breakdown`, `totalReviews` | `ReviewsSection` |
| `shared/rating/RatingInline.tsx` | Inline compact star + count readout | `rating`, `reviewCount`, `size?` | `ShopCard`, `CompactShopCard`, `Schools`, `SchoolDetail` |
| `shared/rating/RatingInput.tsx` | Accessible interactive 1–5 star selector | `value`, `onChange` | `WriteReviewSheet` |
| `shared/rating/RatingStars.tsx` | Read-only fractional SVG star bar | `rating`, `size?`, `className?` | `ReviewCard`, `RatingInline` |

---

## `src/components/myshop/` (Owner Hubs & Previews)

| File | Purpose | Key props / Role | Used by |
|---|---|---|---|
| `MessMenuManager.tsx` | Daily lunch, dinner, special dish, and live serving toggle editor (`mess_daily_menus`) | `shopId`, `messProfile` | `MyShop`, `MessOwnerHub` |
| `MessMenuCardManager.tsx` | Multi-image upload/crop manager for printed daily menu boards | `shopId` | `MessOwnerHub` |
| `MessProfileManager.tsx` | Mess profile pricing, tiffin delivery, timings, and Sunday feast settings | `shop`, `messProfile`, `onSaved` | `MessOwnerHub` |
| `MessOwnerHub.tsx` | 4-tab unified Mess owner workspace (`Today's Menu`, `Menu Card`, `Profile`, `Preview`) + concurrency-safe open/closed toggle | `shop`, `onSaved?` | `MyShop` |
| `PGVacancyManager.tsx` | Bed/room inventory, sharing rates, gate rules, and vacancy count manager (`pg_profiles`) | `shop`, `onSaved` | `MyShop`, `PGOwnerHub` |
| `PGOwnerHub.tsx` | Unified PG & Hostel owner portal with room-level inventory math (`calculatePGBedsFromRooms`), vacancy updates, and 1-tap WhatsApp Vacancy Broadcast | `shop`, `onSaved?` | `MyShop` |
| `SchoolOwnerHub.tsx` | Full Institute Owner workspace: edits admission status/deadline, fees, seat availability, facilities, scholarships, docs, transport villages, EN/MR pinned circulars (`school_notices`), and photo gallery via `updateSchoolAsOwner` | `school`, `roleTitle?`, `onSaved?` | `MyShop` (`/my-shop` & `/my-institute`) |
| `ShopPreviewSheet.tsx` | Slide-up live simulation previewing how `ShopCard` and `ShopDetail` look to citizens | `shop`, `open`, `onClose` | `MyShop` |

---

## `src/components/admin/` (Tabs, Modals & Tools)

### Core Directory, Moderation & Marketing
| File | Purpose | Key props | Used by |
|---|---|---|---|
| `adminHelpers.ts` | Shared admin utilities (`inputCls`, `normalizeWhatsApp`, `isValidPhone`, `extractStoragePath`) — null-safe across missing phone inputs | – | Admin modals & public cards (`Schools.tsx`, `SchoolDetail.tsx`) |
| `AdvertisementsTab.tsx` | Geo-targeted banner CRUD, placement reorder, bulk pause/resume, and admin-local `"Hide ads for me"` toggle | – | `MarketingAds` |
| `BannerModal.tsx` | Banner create/edit modal with town targeting (`all`/`city`), placement selector, popup timing, and live preview | `banner`, `onClose`, `onSaved` | `AdvertisementsTab` |
| `CategoriesTab.tsx` | Categories CRUD built on `EntityTab` + merge + CSV import/export | `onEdit` | `DirectoryCategories` |
| `CategoryMergeModal.tsx` | Two-step category merge deduplicating overlapping `shop_categories` rows before reassignment | `source`, `allCategories`, `onClose`, `onMerged` | `CategoriesTab` |
| `CategoryModal.tsx` | Category create/edit modal | `category`, `onClose`, `onSaved` | `DirectoryCategories` |
| `ClaimReviewModal.tsx` | Side-by-side moderation dialog supporting **both** `shop_claims` and `school_claims` with proof image signed URL viewer + Approve / Reject / Request More Info actions | `claim`, `onClose`, `onChanged` | `InboxTab` |
| `InboxTab.tsx` | Moderation hub with 4 persisted sub-tabs: Requests, Claims (Shops + Schools), Owners (Shops + Schools), and Assign | `pendingRequests`, `pendingClaims`, `onShopCreated` | `DirectoryInbox` |
| `MessModal.tsx` | Admin Mess & Hotel create/edit modal syncing both `shops` + `mess_profiles` with EN/MR mirrors, `getMessModalAutofillSample` Examiner autofill, multi-photo upload, and geo scoping | `mess`, `onClose`, `onSaved` | `DirectoryMess` |
| `PGModal.tsx` | Admin PG & Hostel create/edit modal syncing `shops` + `pg_profiles`, sharing rates, amenities, and multi-photo upload | `pg`, `onClose`, `onSaved` | `DirectoryPG` |
| `RequestsTab.tsx` | Listing request queue converting pending multi-entity submissions (`shop`, `mess`, `pg`, `school`) into live tables + moving storage images | `onShopCreated` | `InboxTab` |
| `ShopModal.tsx` | Full admin shop create/edit dialog with categories, hours, amenities, geo pickers, and multi-photo gallery | `shop`, `onClose`, `onSaved` | `DirectoryShops`, `DirectoryQuality` |
| `ShopsTab.tsx` | Infinite-scrolling shop management table with town/status/broken-image filters and quick toggles | – | `DirectoryShops` |
| `SpeedShopModal.tsx` | Rapid field-capture multi-shop drafting modal | `onClose`, `onDone` | `Overview`, `ShopsTab` |

### Section Tabs & Owner/System Tools
| File | Purpose | Key props | Used by |
|---|---|---|---|
| `BusTimetableTab.tsx` | City-scoped MSRTC/PMPML timetable CRUD, `bus_stand_info` editor, CSV export, and `BusBulkImportModal` trigger | – | `SectionDetail` (`bus`) |
| `GovernmentServicesTab.tsx` | Authority departments, offices/helplines, officer roster, outage announcements (`authority_announcements`), CSV export, and `AuthorityCsvImportModal` trigger | – | `SectionDetail` (`gov`) |
| `LocalNewsTab.tsx` | City-scoped `news_sources` RSS/HTML feed manager, 1-click live scrape (`scrape-local-news` / dev proxy), manual headline editor, pin/publish controls, CSV export, and `NewsCsvImportModal` trigger | – | `SectionDetail` (`news`) |
| `SchoolsTab.tsx` | Education & Institutes directory CRUD built on `EntityTab`, full CSV export (`SCHOOL_CSV_EXPORT_HEADERS`), and `SchoolBulkImportModal` trigger | – | `SectionDetail` (`schools`) |
| `SchoolModal.tsx` | Comprehensive institute editor covering type, medium/mediums, board, accreditation, UDISE/AISHE, admissions, fee tiers, scholarships, required documents, bus villages, streams, and gallery | `school`, `onClose`, `onSaved` | `SchoolsTab`, `DirectoryQuality` |
| `AnalyticsTab.tsx` | Tap analytics (`7d`/`30d`/`all`), Call/WA/Maps breakdowns, top shops/categories, and CSV export/import | – | `InsightsAnalytics` |
| `MarathiBackfillModal.tsx` | Cancellable batch EN→MR translation backfill across Categories, Shops, and Schools (never overwrites manual Marathi edits) | `open`, `onClose` | `Overview`, `SystemMarathi` |
| `MasterExportModal.tsx` | Full ZIP/CSV exporter across all 20 datasets (`MASTER_DATASETS`) + storage image bundles | `open`, `onClose` | `Overview`, `SystemData` |
| `MasterImportModal.tsx` | FK-ordered ZIP/single-CSV restorer across all 20 `MASTER_DATASETS` tables with array/JSONB coercion & upsert/skip-dupe toggle | `onClose`, `onDone` | `Overview`, `SystemData` |
| `DataQualityTab.tsx` | Wrapper hosting town scope selector and the 4 Storage & Health diagnostic sub-tabs | `onEditShop`, `onEditSchool?`, `initialTab?` | `DirectoryQuality` |

### CSV & Bulk Import Modals (`src/components/admin/`)
| File | Purpose | Target table(s) | Used by |
|---|---|---|---|
| `AnalyticsCsvImportModal.tsx` | Historical engagement CSV importer (adapter over `CsvImporter`) | `shop_engagement` | `AnalyticsTab` |
| `AuthorityCsvImportModal.tsx` | Civic outages & announcements CSV importer with EN/MR support and department resolution | `authority_announcements` | `GovernmentServicesTab` |
| `BusBulkImportModal.tsx` | Bulk bus routes & space/comma-separated departure times CSV importer with template download & duplicate skip | `bus_timetable` | `BusTimetableTab` |
| `CategoryCsvImportModal.tsx` | Categories CSV importer (adapter over `CsvImporter`) | `categories` | `CategoriesTab` |
| `CsvImportModal.tsx` | 3-step Shops CSV importer with phone normalization, pipe amenities, lat/lng, and duplicate detection | `shops`, `categories`, `shop_categories` | `Overview`, `ShopsTab` |
| `MessCsvImportModal.tsx` | Mess & today's menu CSV importer syncing `shops`, `mess_profiles`, and optional `mess_daily_menus` | `shops`, `mess_profiles`, `mess_daily_menus` | `DirectoryMess` |
| `NewsCsvImportModal.tsx` | Local news headlines CSV importer with IST timestamp parsing, category validation, and dedupe | `local_news` | `LocalNewsTab` |
| `PGCsvImportModal.tsx` | PG & Hostel CSV importer syncing `shops` and `pg_profiles` (gender, beds, sharing rates, amenities) | `shops`, `pg_profiles` | `DirectoryPG` |
| `SchoolBulkImportModal.tsx` | Full Education CSV importer supporting rich structured fields (board, UDISE, admissions, fees, facilities) + duplicate phone/name check | `schools` | `SchoolsTab` |

### `src/components/admin/health/` (4-Panel Diagnostics Suite)
| File | Purpose | Used by |
|---|---|---|
| `SystemDiagnosticsPanel.tsx` | Verifies Supabase/RPC health (`get_system_health_snapshot`), Edge Functions (`town-assistant`, `scrape-local-news`, `mcp`), storage RLS readiness (`IS DISTINCT FROM 'claims'`), MV drift, and browser caches | `DataQualityTab` |
| `StorageAuditPanel.tsx` | Recursive `shop-images` audit across 8 tables, orphan deletion, expired resolved claim-proof PII purge, unified broken-URL probe (`image_broken_at`), and slug-based image rename planner | `DataQualityTab` |
| `ListingHygienePanel.tsx` | Town-scoped shop & school hygiene scanner (`missing_phone`, `invalid_phone`, `unverified`, `no_photo`, `broken_photo`, `no_gps`, `missing_marathi`) + hygiene CSV export | `DataQualityTab` |
| `AreaDuplicatesPanel.tsx` | Fuzzy similar-area cluster normalizer + duplicate shop name/phone detector | `DataQualityTab` |

### `src/components/admin/layout/` & `src/components/admin/_shared/`
| File | Purpose | Notes |
|---|---|---|
| `layout/AdminLayout.tsx` | Responsive admin shell with collapsible sidebar, top header, and `<Outlet />` | Wraps `/admin/*` |
| `layout/AdminSidebar.tsx` | Hub & leaf navigation driven by `ADMIN_NAV` | Inside `AdminLayout` |
| `layout/BranchTabs.tsx` | Horizontal sub-tab strip for leaves within the active hub | Hub pages |
| `layout/adminNav.ts` | Single source of truth for Hubs (`overview`, `directory`, `sections`, `marketing`, `insights`, `system`) | `AdminLayout`, `AdminSidebar`, `BranchTabs` |
| `_shared/AdminFab.tsx` | Mobile floating action button | `ShopsTab` |
| `_shared/ConfirmTapButton.tsx` | Two-tap safety delete/action button | Admin tabs |
| `_shared/EmptyState.tsx` | Consistent empty-state card | Admin tabs |
| `_shared/EntityTab.tsx` | Schema-driven CRUD table shell driven by `EntityDef<T>` | `CategoriesTab`, `SchoolsTab` |
| `_shared/ModerationQueue.tsx` | Reusable moderation queue UI supporting shop and school requests/claims | `InboxTab`, `RequestsTab` |
| `_shared/QuickFilters.tsx` | Generic chip filter bar | `ShopsTab` |
| `_shared/csv-importer/{CsvImporter.tsx, types.ts, index.ts}` | Generalised CSV column-mapper & validator UI | `CsvImportModal`, `CategoryCsvImportModal`, `AnalyticsCsvImportModal` |

---

## `src/components/banners/` & `src/components/seo/`

| File | Purpose | Key props | Used by |
|---|---|---|---|
| `banners/BannerPopup.tsx` | Delayed full-screen popup gated on `20s+` dwell, scroll depth ≥ 30%/600 px, 1/session, 1/day (`7-day` TTL), and close-button countdown | – | `Home` |
| `banners/BannerPreview.tsx` | Live admin preview of banner across placement ratios | `title`, `imageUrl`, `placement`, `closeEnableSeconds` | `BannerModal` |
| `banners/BannerSlot.tsx` | Placement banner renderer with fallback chain, per-route dedupe, and kill-switch respect | `placement`, `fallback?`, `className?` | `Home`, `Shops`, `ShopDetail`, `SavedShops`, `LocalNews` |
| `banners/InlineBanner.tsx` | 16:9 / 3:1 responsive card with 40% IntersectionObserver view tracking (`increment_banner_view`) and click tracking | `banner` | `BannerSlot` |
| `seo/PageSeo.tsx` | Per-route title, meta, canonical, OG tags, and JSON-LD via `react-helmet-async` | `title`, `description?`, `path?`, `image?`, `noindex?`, `jsonLd?`, `ogType?` | All public & detail pages |

---

## `src/components/shared/`

| File | Purpose | Key props | Used by |
|---|---|---|---|
| `AmenitiesPicker.tsx` | Preset amenity toggles + custom free-text tags | `value`, `onChange` | `RequestListingModal`, `ShopModal`, `SpeedShopModal` |
| `CallNumberDialog.tsx` | Global desktop calling modal listening to `'open-call-dialog'` with phone number display, 1-tap clipboard Copy, and conditional WhatsApp quick link (`wa.me` on 10-digit mobiles); avoids desktop `tel:` console errors | – | `App.tsx` (triggered by `handleTelLinkClick`) |
| `CategoryIcon.tsx` | Maps category names/icons to Lucide icons | `name?`, `className?` | `Home`, `Shops`, `ShopCard`, `ShopDetail` |
| `CityPickerModal.tsx` | Multi-town & satellite village selector dialog with search, district chips, and geolocation matching | `open`, `onClose` | `Home`, `LocationPill`, `UserMenuDrawer`, `Mess`, `PG`, `MessDetail`, `PGDetail`, `SchoolDetail` |
| `ClaimedBadge.tsx` | "Verified / Claimed" pill badge for claimed shops and schools | `size?` | `ShopCard`, `CompactShopCard`, `MyShop`, `SchoolDetail` |
| `DemoBadge.tsx` | Bilingual `Demo / डेमो` amber indicator pill + `isParandwadiDemoListing()` helper flagging Parandwadi sample listings | `size?`, `className?` | `ShopCard`, `CompactShopCard`, `Shops`, `Mess`, `MessDetail`, `PG`, `PGDetail`, `Schools`, `SchoolDetail`, `ShopDetail` |
| `EntityCard.tsx` | Slot-based shared card primitive used by `ShopCard` and directory vertical cards | `image?`, `title`, `titleIcon?`, `meta?`, `chips?`, `actions?` | `ShopCard`, `Schools` |
| `ErrorPage.tsx` | Shared layout for HTTP error pages (`400`/`401`/`403`/`404`/`500`/`502`/`503`) | `code`, `title`, `message`, `actions?` | Error route pages |
| `Footer.tsx` | Responsive localized footer displaying copyright/brand (`t('home.footer')`). *(Note: "Built for Vibe Forge Hackathon" attribution link to `vibe-forge.in` is currently commented out.)* | `className?`, `hideBorder?` | `Home`, `Shops`, `BusTimetable`, `Schools`, `SchoolDetail`, `Mess`, `MessDetail`, `PG`, `PGDetail`, `LocalNews`, `EssentialServices` |
| `HighlightedText.tsx` | Highlights matching search substrings | `text`, `query` | `HomeSearch`, `Shops` |
| `ImageCropPicker.tsx` | Single-image interactive cropper (`react-easy-crop`), WebP encoder, zoom/rotate, and `"Edit current photo"` reload | `onCropComplete`, `onClear`, `previewUrl?`, `uploading?`, `maxMB?`, `defaultAspect?` | `BannerModal`, `CategoryModal`, `DirectoryMess`, `MyShop` |
| `ImageLightbox.tsx` | Fullscreen zoomable photo gallery viewer | `images`, `alt`, `onClose` | `ShopDetail`, `PhotoSlider` |
| `LocationMapPicker.tsx` | Zero-config Leaflet/OpenStreetMap pin-drop + Nominatim reverse geocoding (supports optional Google Maps when `VITE_GOOGLE_MAPS_API_KEY` configured, auto-falling back to OSM on `gm_authFailure`) | `value`, `onChange`, `initialCenter?`, `height?`, `onGeocode?` | `RequestListingModal`, `ShopModal`, `SchoolModal`, `MyShop` |
| `LocationPill.tsx` | Header town/village chip opening `CityPickerModal` | `className?` | `Home`, public headers |
| `MarathiMirrorField.tsx` | Labeled Devanagari input/textarea (`lang="mr"`) | `label`, `source?`, `value`, `onChange`, `textarea?`, `rows?` | Admin & request forms |
| `MultiImageCropPicker.tsx` | Multi-photo reorderable WebP cropper/uploader with cover-photo priority | `photos`, `onChange`, `entityType?` | `RequestListingModal`, `ShopModal`, `MessModal`, `PGModal`, `SchoolModal`, `MyShop` |
| `OfflineOverlay.tsx` | Full-screen offline banner/overlay | – | `App.tsx` |
| `PhotoSlider.tsx` | Swipeable multi-image slider with arrows, dots, thumbnail strip, and integrated `ImageLightbox` | `photos?`, `imageUrl?`, `alt`, `aspectRatio?`, `enableLightbox?`, overlays | `ShopDetail`, `MessDetail`, `PGDetail`, `SchoolDetail` |
| `SectionIcon.tsx` | Custom icon mapper for town hub verticals (`shops`, `bus`, `schools`, `banks`, `gov`, `hospitals`, `lostfound`, `news`, etc.) | `name`, `className?` | `Home`, `SectionsHub` |
| `ShopImage.tsx` | Progressive image loader with Supabase URL width/quality transform and error fallback | `src`, `alt`, `targetWidth?`, `quality?`, `loading?`, `fetchPriority?` | `ShopCard`, `ShopDetail`, `PhotoSlider`, `Home` |
| `StatusChip.tsx` | Real-time Open/Closed badge with countdown (`"Closes in N min"`) | `shop`, `variant?`, `size?` | `ShopCard` |
| `TimePickerField.tsx` | HH:MM time input + 15-min preset chips | `label`, `value`, `onChange`, `id?` | `ShopModal`, `MyShop`, `MessModal`, `PGModal` |
| `TranslateAllButton.tsx` | Batch EN→MR translation button using `translateEnToMr` + broadcast loading indicator | `pairs`, `className?` | `RequestListingModal`, `ShopModal`, `MessModal`, `PGModal`, `SchoolModal` |

---

## Pages (`src/pages/` & `src/pages/admin/`)

### Public & Owner Pages (`src/pages/`)
- **Core Directory:** `Home.tsx`, `Shops.tsx`, `ShopDetail.tsx`, `SavedShops.tsx`
- **Living & Housing:** `Mess.tsx`, `MessDetail.tsx`, `PG.tsx`, `PGDetail.tsx`
- **Education & Civic:** `Schools.tsx`, `SchoolDetail.tsx`, `BusTimetable.tsx`, `EssentialServices.tsx`, `LocalNews.tsx`, `SectionComingSoon.tsx`
- **Owner & Account:** `MyShop.tsx` (hosts `/my-shop` & `/my-institute`), `Auth.tsx`, `ResetPassword.tsx`, `OAuthConsent.tsx` (MCP OAuth consent at `/.lovable/oauth/consent`, `/oauth/consent`, `/~oauth/consent`), `AdminLogin.tsx` (redirect shim to `/auth?next=%2Fadmin%2Foverview`)
- **HTTP Error Pages:** `ErrorRoute.tsx`, `BadRequest.tsx`, `Unauthorized.tsx`, `Forbidden.tsx`, `NotFound.tsx`, `InternalError.tsx`, `BadGateway.tsx`, `ServiceUnavailable.tsx`

### Admin Pages (`src/pages/admin/`)
- `Overview.tsx` — town vs global dashboard + fast modal shortcuts
- `DirectoryShops`, `DirectoryMess` (includes dual-tab `MessMenuQuickModal` + `generateSampleMessMenu` dietary autofill), `DirectoryPG`, `DirectoryCategories`, `DirectoryInbox`
- `SectionsHub.tsx`, `SectionDetail.tsx` (mounts `BusTimetableTab`, `SchoolsTab`, `GovernmentServicesTab`, `LocalNewsTab` or Coming Soon)
- `MarketingAds.tsx`, `InsightsAnalytics.tsx`
- `SystemData.tsx`, `DirectoryQuality.tsx` (mounted at `/admin/system/quality` for 4-panel Storage & Health), `SystemMarathi.tsx`, `SystemMcp.tsx`
- `_useAdminOutlet.ts` — typed outlet context helper for inbox badge counts

---

## Hooks (`src/hooks/`)

| Hook | Purpose |
|---|---|
| `useAuth.tsx` | `AuthProvider` context exposing `user`, `roles`, `isAdmin`, `isShopkeeper`, `loading`, `rolesLoading`, and auth actions (with `setTimeout(0)` role-fetch deferral) |
| `useCity.tsx` | `CityProvider` & `useCity` / `useOptionalCity` contexts managing active `currentCity`, `currentVillage`, dynamic `townBrand`, and title helpers |
| `useBanners.ts` | Live geo-filtered banner query per placement respecting the 3-layer ads kill switch |
| `useDebouncedValue.ts` | Generic value debouncer |
| `useEdgeSwipeBack.tsx` | Native-style mobile left-edge swipe-right back navigation gesture with floating chevron indicator |
| `useFuzzySearch.ts` | Wraps `buildShopFuse` + `fuzzySearchShops` + debounce |
| `useImageUpload.ts` | Clean `{ uploading, error, upload, clearError }` async wrapper |
| `useInterval.ts` | Safe `setInterval` hook with cleanup |
| `useOnlineStatus.ts` | Reactive `navigator.onLine` detector |
| `useRealtime.ts` | `useRealtimeRow` & `useRealtimeChannel` helpers for Supabase `postgres_changes` |
| `useSmartBack.ts` | Back navigation falling back cleanly when in-app history is empty |
| `useSwipeDownToClose.ts` | Real-time mobile swipe-down gesture to dismiss bottom drawers with optional `beforeClose` unsaved-changes guard |
| `useTranslationsCache.ts` | Queries `shop_translations`/`category_translations` + `useLocalizedShop` / `useLocalizeCategoryName` helpers |
| `useUrlFilters.ts` | Typed helpers on `useSearchParams` (`get`, `getAll`, `patch`, `toggle`, `clear`) |
| `use-mobile.tsx` | Tailwind responsive breakpoint hook |
| `use-toast.ts` | shadcn toast state hook |

---

## Key Service & Framework Modules (`src/lib/`)

### Entity Framework (`src/lib/entities/`) & Repos (`src/lib/repos/`)
- **Entity defs (`src/lib/entities/`):** `types.ts` (`EntityDef<T>`), `categoryEntity.ts`, `schoolEntity.ts`, `shopEntity.ts`, `requestEntity.ts`, `claimEntity.ts`
- **Repositories (`src/lib/repos/`):** `shopsRepo.ts`, `requestsRepo.ts`, `claimsRepo.ts`, `bannersRepo.ts`, `categoriesRepo.ts`, `schoolsRepo.ts`, `types.ts` (note `schoolNoticesRepo.ts` sits under `src/lib/schools/`)

### Admin & Health Services (`src/lib/admin/`)
- `masterDatasets.ts` — typed registry across all **20 directory/platform tables** (`MASTER_DATASETS`) defining FK-safe import order, Postgres arrays, JSONB cols, NOT NULL defaults, and row coercion (`coerceDatasetRow`)
- `storageHealthService.ts` — recursive `shop-images` storage audit, 8-table reference extractor, claim proof PII retention purge, unified image health prober (`image_broken_at`), slug rename planner, and `get_system_health_snapshot` diagnostics
- `dataQualityHelpers.ts` — shop & school listing hygiene audits, city-scoped fuzzy area grouping, and duplicate shop detection

### Domain Modules (`src/lib/`)
- `assistant/assistantService.ts` — Sahayak AI client orchestrating `town-assistant` Edge Function calls + multi-entity local deterministic fallback
- `news/{newsService.ts, newsParser.ts, newsTypes.ts}` — local news queries, RSS/Atom/HTML parsing via `scrape-local-news` or `/api/news-proxy`, and IST calendar grouping
- `schools/{schoolHelpers.ts, schoolNoticesRepo.ts}` + `schoolConcurrency.ts` + `schoolEngagement.ts` — structured institute helpers, CSV headers/importers, optimistic/role-guarded owner updates, pinned notices, and engagement logging
- `living/{livingService.ts, livingTypes.ts, sampleMenuGenerator.ts}` — Mess & PG queries, serving status, Sunday specials, room bed math, WhatsApp vacancy broadcasts, and dietary-aligned (`pure_veg`/`veg_nonveg`/`jain_available`) genuine menu generator (`generateSampleMessMenu`, `inferDietaryTagFromMess`)
- `services/{authorityService.ts, authorityTypes.ts}` — civic departments, offices, helplines, and outage announcements
- `bus/busHelpers.ts` — timetable seeds, next-departure computation, forgiving search (`matchesForgivingBusQuery`, `scoreForgivingMatch`, Damerau-Levenshtein), and CSV bulk parser
- `devHelpers.ts` — production-enabled Examiner Mode flags (`EXAMINER_MODE_ENABLED`) and entity-specific autofill (`getEntityAutofillSample`, `getMessModalAutofillSample`)
- `engagement.ts` & `schoolEngagement.ts` — rate-limited/deduped interaction telemetry + desktop `tel:` click interception (`handleTelLinkClick`, `canDialTel`)
- `images/imageService.ts` + `storageNaming.ts` — unified crop → WebP → bucket upload/cleanup across 4 storage buckets (`shop-images`, `school-images`, `request-images`, `banner-images`)
- `csvUtils.ts` — RFC 4180 multiline CSV parser, formula-injection escaping, pagination helper (`fetchAllPaged`), and town-scoped filename formatter
- `reviewsApi.ts` — TanStack Query hooks unifying `shop_reviews` + `school_reviews` (`get_shop_rating`, `get_school_rating`, `get_schools_rating_summary`, helpful vote sync)

### MCP Server (`src/lib/mcp/` — Read-Only, OAuth-Gated)
| File | Role |
|---|---|
| `src/lib/mcp/index.ts` | `muktainagar-daily-mcp` v0.1.0 entry bundling 7 read-only tools behind `@lovable.dev/mcp-js` OAuth audience (`authenticated`) |
| `tools/search-shops.ts` | `search_shops` — searches active shops by keyword/city |
| `tools/get-shop.ts` | `get_shop` — returns shop details & categories by slug |
| `tools/list-categories.ts` | `list_categories` — lists active categories |
| `tools/get-bus-timetable.ts` | `get_bus_timetable` — queries town bus departures & stand info |
| `tools/get-local-news.ts` | `get_local_news` — fetches town local news headlines & category filters |
| `tools/search-schools.ts` | `search_schools` — searches colleges/schools, admission status, fees, and notices |
| `tools/get-civic-services.ts` | `get_civic_services` — queries municipal outages/alerts & office helplines |
| `supabaseClient.ts` | Lazy Deno anon client for MCP tool handlers |
| `supabase/functions/mcp/index.ts` | **Auto-generated by `mcpPlugin()` in `vite.config.ts` — never hand-edit.** |
