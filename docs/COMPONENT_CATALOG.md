# Component Catalog

> Excludes `src/components/ui/` (shadcn primitives — see shadcn docs). Each entry: *Purpose · Key props · Usage locations*.

## `src/components/` (top level)

| File | Purpose | Key props | Used by |
|---|---|---|---|
| `BookmarkButton.tsx` | Bookmark/unbookmark a shop; redirects unauthenticated users to `/auth` | `shopId`, `className?` | `ShopDetail.tsx` |
| `ClaimShopModal.tsx` | Ownership-claim submission modal — requires proof-type select + proof photo (camera capture, WebP-compressed, uploaded to `shop-images/claims/<user>/<uuid>.webp`) | `shopId`, `shopName`, `onClose` | `ShopDetail.tsx` |
| `admin/ClaimReviewModal.tsx` | Side-by-side admin review: shop on record (with current owners) vs. claim submission (claimant, contact phone with "matches shop" hint, proof image via signed URL). Actions: Approve & assign / Reject (note required) / Request more info | `claim`, `onClose`, `onChanged` | `admin/InboxTab.tsx` (PendingClaims) |
| `LanguageSwitcher.tsx` | EN/MR pill switcher with two tone variants (onPrimary/onSurface). On `Home`, the `compact` variant is pinned top-right of the hero (`z-20`) so it never collides with the user-menu avatar pinned mid-right. | `variant?`, `tone?`, `className?` | `Home`, `Shops`, `UserMenuDrawer` |
| `NavLink.tsx` | Nav link with active-state styling | minimal | App shell |
| `RequestListingModal.tsx` | 4-step listing wizard (Basics → Location → Optional → Review) with segmented progress bar, weighted completion %, per-step Zod validation, debounced `localStorage` draft (resume/discard), quick-edit jumps. Image crop+WebP, map picker, Marathi mirrors. | `onClose` | `ListShopModalHost` (mounted globally) |
| `ListShopModalHost.tsx` | App-root host that owns the single `RequestListingModal` instance. Opens on the `open-list-shop-modal` custom event so any surface can trigger it without prop drilling. Replaces the per-page modal state that used to live in `Home.tsx`. | – | `App.tsx` |
| `SafeImage.tsx` | `<img>` wrapper that swaps to a neutral `ImageOff` placeholder when `src` is empty or the browser fails to load/decode. Used by admin surfaces that may render shops with broken/missing image URLs. | `src?`, `alt`, standard `<img>` props | `admin/ShopsTab.tsx` (mobile card) |
| `ShopCard.tsx` | Standard shop card with image, badges, Call/WA/Maps actions | `shop` | `Shops`, `SavedShops`, `ShopDetail` (related strip) |
| `UserMenuDrawer.tsx` | Slide-up profile drawer with nested Settings/About. On `Home`, the avatar trigger is pinned mid-right of the hero (`z-10`), vertically separated from the top-right `LanguageSwitcher` so the two never overlap at any width. **List a Shop** entry dispatches `open-list-shop-modal` (no auth wall, no navigation) and is handled by the global `ListShopModalHost`. Opens `EditProfileDrawer` from the profile section. | (uses `useAuth` internally) | All page headers (incl. `/bus-timetable` since 2026-06-29) |
| `EditProfileDrawer.tsx` | Edits `profiles` (username/mobile/birth date/gender). One-time-editable `@username` with live `username_available` RPC check; first edit stamps `full_name_changed_at` via DB trigger and locks the field thereafter. Email is read-only. | `open`, `onOpenChange` | `UserMenuDrawer` |

| `theme-provider.tsx` | Wraps `next-themes` ThemeProvider | `children`, theme props | App root |

## `src/components/admin/`

| File | Purpose | Key props | Used by |
|---|---|---|---|
| `AdvertisementsTab.tsx` | Banner CRUD + reorder + bulk pause/resume + runtime toggle | – | `AdminDashboard` |
| `AnalyticsCsvImportModal.tsx` | Import engagement events CSV | `onClose`, `onDone` | `AnalyticsTab` |
| `AnalyticsTab.tsx` | Tap analytics (7d/30d/all) + top shops/categories + CSV | – | `AdminDashboard` |
| `BannerModal.tsx` | Banner create/edit with live preview | `banner`, `onClose`, `onSaved` | `AdvertisementsTab` |
| `CategoriesTab.tsx` | Category list with CRUD + merge + CSV | `onEdit` | `AdminDashboard` |
| `CategoryCsvImportModal.tsx` | Categories CSV import | `onClose`, `onDone` | `CategoriesTab` |
| `CategoryMergeModal.tsx` | Two-step merge with conflict-safe shop re-link | `source`, `allCategories`, `onClose`, `onMerged` | `CategoriesTab` |
| `CategoryModal.tsx` | Category create/edit form | `category`, `onClose`, `onSaved` | `AdminDashboard` |
| `CsvImportModal.tsx` | Shops CSV (3-step flow) | `onClose`, `onDone` | `AdminDashboard` (via ShopsTab) |
| `DataQualityTab.tsx` | 6-section hygiene toolset | `onEditShop` | `AdminDashboard` |
| `InboxTab.tsx` | Moderation hub (Requests/Claims/Owners/Assign) | `pendingRequests`, `pendingClaims`, `onShopCreated` | `AdminDashboard` |
| `MarathiBackfillModal.tsx` | Batch MR translation backfill (cancellable) | `open`, `onClose` | `AdminDashboard` |
| `MasterExportModal.tsx` | ZIP export of all data | `open`, `onClose` | `AdminDashboard` |
| `MasterImportModal.tsx` | ZIP/CSV import with skip-dupe or upsert | `onClose`, `onDone` | `AdminDashboard` |
| `RequestsTab.tsx` | Listing request review (approve/reject/delete) | `onShopCreated` | `InboxTab` |
| `ShopModal.tsx` | Full shop create/edit (admin fields included) | `shop`, `onClose`, `onSaved` | `AdminDashboard`, `DataQualityTab` |
| `ShopsTab.tsx` | Shop management table with filters and CSV | – | `AdminDashboard` |
| `SpeedShopModal.tsx` | Rapid field-capture multi-shop draft tool | `onClose`, `onDone` | `AdminDashboard` |
| `adminHelpers.ts` | Shared utils (`inputCls`, `normalizeWhatsApp`, `isValidPhone`, `extractStoragePath`) | – | Most admin modals |

### `src/components/admin/layout/`

| File | Purpose | Key props | Used by |
|---|---|---|---|
| `AdminLayout.tsx` | Main responsive admin layout shell with header, sidebar trigger, and outlet | – | `/admin/*` route tree |
| `AdminSidebar.tsx` | Collapsible sidebar navigation grouped by functional hubs | – | `AdminLayout` |
| `BranchTabs.tsx` | Secondary horizontal sub-tab bar for leaves within an active hub | – | `AdminLayout` |
| `adminNav.ts` | Single source of truth defining hubs, sections, routes, and badge counters | – | `AdminLayout`, `AdminSidebar`, `BranchTabs` |

### `src/components/admin/_shared/`

| File | Purpose | Used by |
|---|---|---|
| `AdminFab.tsx` | Floating action button (mobile admin) | `ShopsTab` |
| `ConfirmTapButton.tsx` | Two-tap safety wrapper | `ShopsTab`, `InboxTab`, `AdvertisementsTab`, `DataQualityTab` |
| `EmptyState.tsx` | Consistent empty-state UI | Multiple admin tabs |
| `QuickFilters.tsx` | Generic chip filter row | `ShopsTab` |

## `src/components/banners/`

| File | Purpose | Key props | Used by |
|---|---|---|---|
| `BannerPopup.tsx` | Full-screen delayed popup (dwell+scroll gated) | – | `Home.tsx` |
| `BannerPreview.tsx` | Admin preview of banner across placements | `title`, `imageUrl`, `placement`, `closeEnableSeconds` | `BannerModal` |
| `BannerSlot.tsx` | Inline banner slot with fallback + per-route dedupe | `placement`, `fallback?`, `className?` | `Home`, `Shops`, `ShopDetail`, `SavedShops` |
| `InlineBanner.tsx` | 16:9/3:1 ad card with IntersectionObserver view tracking | `banner` | `BannerSlot` |

## `src/components/myshop/`

| File | Purpose | Used by |
|---|---|---|
| `ShopPreviewSheet.tsx` | Slide-up preview combining ShopCard + ShopDetail simulation | `MyShop > ShopEditor` |

## `src/components/seo/`

| File | Purpose | Key props |
|---|---|---|
| `PageSeo.tsx` | Per-route title/meta/canonical/og/JSON-LD via react-helmet-async | `title`, `description?`, `path?`, `image?`, `noindex?`, `jsonLd?`, `ogType?` |

## `src/components/shared/`

| File | Purpose | Key props | Used by |
|---|---|---|---|
| `AmenitiesPicker.tsx` | Preset amenity checkboxes + custom free-text | `value`, `onChange` | `RequestListingModal`, `ShopModal`, `SpeedShopModal` |
| `CategoryIcon.tsx` | Regex-maps category name to a Lucide icon | `name?`, `className?` | `Home`, `Shops`, `ShopCard`, `ShopDetail` |
| `ClaimedBadge.tsx` | "Claimed" pill for owned shops | `size?` | `ShopCard`, `Home` (CompactShopCard), `MyShop` |
| `ErrorPage.tsx` | Layout for all HTTP error pages | `code`, `title`, `message`, `actions?` | `ErrorRoute`, `BadGateway`, etc. |
| `HighlightedText.tsx` | Bold-highlights query matches in text | `text`, `query` | `Home` + `Shops` suggestion rows |
| `ImageCropPicker.tsx` | Full crop tool (react-easy-crop, WebP, zoom/rotate, aspect presets) | `onCropComplete`, `onClear`, `previewUrl?`, `uploading?`, `maxMB?`, `defaultAspect?` | All shop forms, `BannerModal` |
| `ImageLightbox.tsx` | Fullscreen gallery lightbox | `images`, `alt`, `onClose` | `ShopDetail` |
| `LocationMapPicker.tsx` | Google Maps pin-drop + reverse geocode | `value`, `onChange`, `initialCenter?`, `height?`, `onGeocode?` | `RequestListingModal`, `ShopModal`, `SpeedShopModal` |
| `MarathiMirrorField.tsx` | Labeled MR input/textarea (lang="mr") | `label`, `source?`, `value`, `onChange`, `textarea?`, `rows?`, `maxLength?`, `placeholder?` | `RequestListingModal`, `ShopModal`, `SpeedShopModal` |
| `OfflineOverlay.tsx` | Full-screen offline message | – | `App.tsx` |
| `ShopImage.tsx` | Progressive image w/ Supabase URL transform | `src`, `alt`, `targetWidth?`, `quality?`, `loading?`, `fetchPriority?`, `className?`, `onError?` | `ShopCard`, `ShopDetail`, `Home` |
| `StatusChip.tsx` | Open/closed chip with "Closes in N min" | `shop`, `variant?`, `size?` | `ShopCard` |
| `TimePickerField.tsx` | HH:MM input + 15-min preset buttons | `label`, `value`, `onChange`, `id?` | All shop forms, `MyShop` |
| `TranslateAllButton.tsx` | Batch EN→MR translate with progress (module-level state broadcast) | `pairs`, `className?` | `RequestListingModal`, `ShopModal`, `SpeedShopModal` |
| `Footer.tsx` | Responsive, theme-tailored footer with localized copyright and Vibe Forge credit ([https://vibe-forge.in/](https://vibe-forge.in/)) | `className?`, `hideBorder?` | `Home`, `Shops`, `BusTimetable`, `Schools`, `Mess`, `PG` |
| `MultiImageCropPicker.tsx` | Multi-photo crop and upload component with primary cover tag and deletion | `photos`, `onChange`, `entityType?` | `RequestListingModal`, `ShopModal`, `SchoolModal` |
| `LocationPill.tsx` | Interactive town/village header chip displaying active location context | `className?` | `Home`, header bars |
| `CityPickerModal.tsx` | Modal dialog for town and village selection with search, district chips, and GPS locator | `open`, `onClose` | `Home`, `LocationPill`, `UserMenuDrawer`, `Mess`, `PG` |
| `EntityCard.tsx` | Slot-based shared card primitive for shops, schools, and future verticals | `image?`, `title`, `titleIcon?`, `meta?`, `chips?`, `actions?` | `ShopCard`, `Schools` |
| `SectionIcon.tsx` | Inline SVG icon mapping for sections | `name`, `className?` | `Home`, `SectionsHub` |

## `src/components/reviews/`

| File | Purpose | Key props | Used by |
|---|---|---|---|
| `ShopReviewsSection.tsx` | Comprehensive reviews widget on shop detail with rating breakdown and list | `shopId`, `shopName` | `ShopDetail.tsx` |
| `WriteReviewModal.tsx` | Review and rating submission dialog with 5-star picker and validation | `shopId`, `shopName`, `open`, `onOpenChange`, `onSuccess` | `ShopReviewsSection.tsx` |

## `src/components/shared/rating/`

| File | Purpose | Key props |
|---|---|---|
| `RatingBadge.tsx` | Compact numeric score badge with star icon | `rating`, `size?` |
| `RatingBreakdown.tsx` | 5-star bar distribution widget | `breakdown`, `totalReviews` |
| `RatingInline.tsx` | Inline star display with review count | `rating`, `reviewCount`, `size?` |
| `RatingInput.tsx` | Interactive clickable 1-5 star input | `value`, `onChange` |
| `RatingStars.tsx` | Read-only SVG stars with fractional fill support | `rating`, `size?`, `className?` |

## Hooks (`src/hooks/`)

| Hook | Purpose |
|---|---|
| `useAuth` (`useAuth.tsx`) | AuthProvider context; exposes `user`, `roles`, `isAdmin`, `isShopkeeper`, `loading`, `rolesLoading`, plus `signIn`/`signUp`/`signOut`/`resetPassword`/`updatePassword`/`refreshRoles` |
| `useCity` (`useCity.tsx`) | CityProvider context; manages active town (`currentCity`), satellite village (`currentVillage`), dynamic branding (`townBrand`), title generator, and location switcher |
| `useBanners` (`useBanners.ts`) | Live banner query per placement; respects ads-enabled flag chain and city targeting |
| `useDebouncedValue` | Generic debounce |
| `useFuzzySearch` (Phase 1, Forge #5) | Wraps `buildShopFuse` + `fuzzySearchShops` + debounce |
| `useUrlFilters` (Phase 1, Forge #5) | Typed helpers on `useSearchParams` — `get`, `getAll`, `patch`, `toggle`, `clear` |
| `useRealtime` (Phase 1, Forge #8) | `useRealtimeRow` + `useRealtimeChannel`; MyShop's three subscriptions all delegate here |
| `useImageUpload` (Phase 2, Forge #3) | Minimal `{ uploading, error, upload, clearError }` wrapper around any async uploader |
| `useInterval` | Setinterval with cleanup |
| `useOnlineStatus` | Reactive `navigator.onLine` |
| `useSmartBack` | Back-button that falls back to a sensible parent route when in-app history is empty |
| `useTranslationsCache` | TanStack queries for `shop_translations`/`category_translations` + `useLocalizedShop`/`useLocalizeCategoryName` helpers |
| `use-mobile` | Tailwind breakpoint hook |
| `use-toast` | shadcn toast helper |

### UI primitives (themed overrides)

| Component | Notes |
| --- | --- |
| `ui/sonner` (`Toaster`) | App-themed sonner: `bg-card` surface, themed border, `rounded-xl`, intent-colored left border (success/error/warning/info via design tokens), persistent close (X) button, top-center position, 4s default duration, cap of 4 visible toasts. Used app-wide via `App.tsx`. |

---

## Added 2026-06-27

| Component / Page | Location | Notes |
| --- | --- | --- |
| `BusTimetable` (page) | `src/pages/BusTimetable.tsx` | Public route `/bus-timetable`. Debounced search, EN/MR aware, "next departure" highlight, `ItemList` JSON-LD. |
| `BusTimetableTab` | `src/components/admin/BusTimetableTab.tsx` | Admin CRUD for `bus_timetable`. HH:MM chip validation, `MarathiMirrorField`, two-tap delete. |
| `SectionIcon` | `src/components/shared/SectionIcon.tsx` | Inline SVG icons for the Browse-by-Section hub (shops, bus, schools, banks, gov, hospitals, lostfound, news). |
| `SectionComingSoon` (page) | `src/pages/SectionComingSoon.tsx` | Shared "coming soon" placeholder for `/sections/:key` so hub links never dead-end. |
| `ImageCropPicker` | `src/components/shared/ImageCropPicker.tsx` | **Updated:** persisted-preview view now exposes "Edit current photo" alongside "Change photo". Fetches the existing image into the crop surface and reuses the same `onCropComplete` pipeline. |
| `EditProfileDrawer` | `src/components/EditProfileDrawer.tsx` | New profile editor opened from `UserMenuDrawer`. One-time `@username` (DB-trigger enforced), mobile, birth date (age derived), gender. Validates via patterns matching the `profiles` CHECK constraints; checks availability via the `username_available` RPC. |
| `BusTimetableTab` (extended) | `src/components/admin/BusTimetableTab.tsx` | Now also hosts the `bus_stand_info` (phone/address/maps_url) single-row editor consumed by `/bus-timetable`. |

## Added 2026-06-30 → 2026-07-05

### Entity Framework (`src/lib/entities/`)

| File | Purpose |
| --- | --- |
| `types.ts` | `EntityDef<T>` descriptor — `key`, `labelSingular/Plural`, `listQueryKey`, `listFn`, `columns`, `getRowKey?`. One-file contract every future section plugs into. |
| `categoryEntity.ts` | Pilot definition; mirrors the `admin-categories` query (shape + shop-count join). |
| `schoolEntity.ts` | First full non-shop entity built on `EntityTab` end-to-end. |
| `shopEntity.ts` | Shop columns (name + verified badge, phone, categories, area). `listFn` is a fallback — `ShopsTab` supplies `dataOverride` because it uses `useInfiniteQuery`. |
| `requestEntity.ts` | Request columns + exported `statusBadge` helper reused by the review modal. |
| `claimEntity.ts` | Claim columns for the shared moderation queue. |

### Repository layer (`src/lib/repos/`, barreled via `index.ts`)

| File | Purpose |
| --- | --- |
| `shopsRepo.ts` | Shop selects incl. `SHOP_CARD_SELECT` fragment. |
| `requestsRepo.ts` | Listing-request selects incl. `REQUEST_LIST_SELECT`. |
| `claimsRepo.ts` | Claim queue selects. |
| `bannersRepo.ts` | Banner selects incl. `BANNER_LIST_SELECT`. |
| `categoriesRepo.ts` | Category list + shop-count join. |
| `schoolsRepo.ts` | Schools list + admin CRUD. |
| `types.ts` + `pickFields` | Shared `RepoResult<T>` + narrow-select helper. |

### Admin layout + sections

| Component / Page | Location | Notes |
| --- | --- | --- |
| `AdminLayout` | `src/components/admin/layout/AdminLayout.tsx` | New shell: sidebar + branch tabs + `<Outlet/>`. Replaces the single-file `AdminDashboard`. |
| `AdminSidebar` | `src/components/admin/layout/AdminSidebar.tsx` | Hub list driven by `ADMIN_NAV`. |
| `BranchTabs` | `src/components/admin/layout/BranchTabs.tsx` | Leaves for the current hub. |
| `adminNav.ts` | `src/components/admin/layout/adminNav.ts` | Single source of truth for the admin tree. Add a section = one entry. |
| `Overview` (page) | `src/pages/admin/Overview.tsx` | New landing at `/admin/overview`. |
| `DirectoryShops` / `DirectoryCategories` / `DirectoryInbox` / `DirectoryQuality` | `src/pages/admin/Directory*.tsx` | Thin wrappers that mount the pre-existing tab components under URL routes. |
| `SectionsHub` + `SectionDetail` | `src/pages/admin/SectionsHub.tsx`, `SectionDetail.tsx` | Sections landing + per-key detail (Bus, Schools live; others "soon"). |
| `MarketingAds` / `InsightsAnalytics` / `SystemData` / `SystemMarathi` | `src/pages/admin/*.tsx` | Hub-route wrappers for Ads / Analytics / Master data tools / Marathi backfill. |

### Entity Framework shell

| Component | Location | Notes |
| --- | --- | --- |
| `EntityTab` (v2) | `src/components/admin/_shared/EntityTab.tsx` | Schema-driven list shell. Slots: search / filters / banner / `mobileCard` / `dataOverride` / footer / `rowClassName` / `emptyState` / `skeletonRows`. Consumed by `CategoriesTab` (pilot) + `SchoolsTab`. |
| `EntityForm` | `src/lib/forms/EntityForm.tsx` (+ `types.ts`) | Declarative form runner used by `SchoolModal`. |
| `ModerationQueue` | `src/components/admin/_shared/ModerationQueue.tsx` | Shared queue UI extracted from `InboxTab` (Requests + Claims). |
| `CsvImporter` | `src/components/admin/_shared/csv-importer/{CsvImporter.tsx, types.ts, index.ts}` | Generalised column-map + validation flow. `CsvImportModal` / `CategoryCsvImportModal` / `AnalyticsCsvImportModal` are thin adapters. |

### Schools + images

| Component / Page | Location | Notes |
| --- | --- | --- |
| `Schools` (page) | `src/pages/Schools.tsx` | Public route `/schools`. Debounced search, `school_type` + `medium` chips, per-row Call / Map / Website. |
| `SchoolsTab` | `src/components/admin/SchoolsTab.tsx` | Admin CRUD, built on `EntityTab` end-to-end. |
| `SchoolModal` | `src/components/admin/SchoolModal.tsx` | Create/edit form powered by `EntityForm`. |
| `imageService` | `src/lib/images/imageService.ts` | Centralised crop → WebP → upload → cleanup for shops / schools / claims / requests. Bucket + naming strategy passed in; storage-path knowledge stays in `storageNaming.ts`. |
| `storageNaming.ts` | `src/lib/storageNaming.ts` | Path builder + public-URL helper. Only file that changes when a bucket is added or moved. |


## Shared layout primitives (2026-07-04)

| Component | Location | Notes |
| --- | --- | --- |
| `EntityCard` | `src/components/shared/EntityCard.tsx` | **Forge Recommendation #10.** Slot-based card layout (image + overlay chip, title + leading icon, badge row, meta rows, chip row, action row). `ShopCard` is now a thin adapter that maps a `Shop` → `EntityCard` props with visual parity preserved. Intended future consumers: `BusRow`, `SchoolCard`, `CompactShopCard`. Any change here shows up everywhere — treat as UI-load-bearing. |

## Repository layer (2026-07-04)

Thin per-entity wrappers over `supabase.from(...)`. Additive; not a query builder. See `src/lib/repos/README.md`.

| Repo | Table | Highlights |
| --- | --- | --- |
| `shopsRepo` | `shops` | Exports `SHOP_CARD_SELECT`; `updateOwner()` delegates to `updateShopWithConcurrency` and enforces `OWNER_EDITABLE_FIELDS`. |
| `requestsRepo` | `shop_requests` | Exports `REQUEST_LIST_SELECT` for MyRequests + admin Inbox. |
| `claimsRepo` | `shop_claims` | Ownership claims + proof-image cleanup helpers. |
| `bannersRepo` | `banners` | Exports `BANNER_LIST_SELECT`; complements `banners/store.ts` for CRUD paths. |
| `categoriesRepo` | `categories` + `shop_categories` | Category CRUD + join-link helpers. |
| `schoolsRepo` | `schools` | Public list + admin CRUD. |

**Migration policy:** file-by-file, with visual verification. Do NOT introduce a generic query-builder wrapper (Sentinel guardrail — see `SENTINEL_CONTEXT.md > Dangerous Areas`).

## MCP server (2026-07-04)

| Component | Location | Notes |
| --- | --- | --- |
| `defineMcp` entry | `src/lib/mcp/index.ts` | `muktainagar-daily-mcp` v0.1.0. Imports the four tools below and passes them to `defineMcp`. Must stay import-safe (no top-level env reads or throws). |
| `search_shops` tool | `src/lib/mcp/tools/search-shops.ts` | Full-text ILIKE over `name`/`description` on active shops. |
| `get_shop` tool | `src/lib/mcp/tools/get-shop.ts` | Shop detail by slug, includes categories. |
| `list_categories` tool | `src/lib/mcp/tools/list-categories.ts` | Active categories. |
| `get_bus_timetable` tool | `src/lib/mcp/tools/get-bus-timetable.ts` | Bus timetable with optional destination filter. |
| `getSupabase()` | `src/lib/mcp/supabaseClient.ts` | Lazy anon Deno client (hardcoded URL + anon key to survive the Cloud env reset that already affects `src/integrations/supabase/client.ts`). |
| Emitted function | `supabase/functions/mcp/index.ts` | **Auto-generated by `mcpPlugin()` in `vite.config.ts`.** Do NOT hand-edit — plugin aborts the build if you do. |

## OAuth consent (2026-07-08)

| Component / Page | Location | Notes |
| --- | --- | --- |
| `OAuthConsent` (page) | `src/pages/OAuthConsent.tsx` | Closes the OAuth loop for MCP clients requesting the user's Muktainagar Daily session. Mounted at `/.lovable/oauth/consent`, `/oauth/consent`, and `/~oauth/consent`. Static fallback at `public/.lovable/oauth/consent/index.html`. |
