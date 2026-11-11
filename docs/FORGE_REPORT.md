# Muktainagar Daily — Architecture Evolution Report

> Produced by the **muktainagar-forge** skill · Run date: 2026-06-30 · Scope: **Entire Project** (all ten agent passes at survey depth, Scalability + Platform Architects synthesizing).
>
> Grounded in Archivist's docs (`PROJECT_BIBLE.md`, `ARCHITECTURE.md`, `FEATURES.md`, `WORKFLOWS.md`, `COMPONENT_CATALOG.md`, `DATABASE_REFERENCE.md`, `TECHNICAL_DEBT.md`) and Sentinel's protections in `SENTINEL_CONTEXT.md`. Anything touching a Sentinel-protected system is called out explicitly per finding.

---

## Executive Summary

**Scope analyzed:** the entire `src/` tree (~18.5k lines), Supabase wiring, banners, admin tabs, owner/claim flows, and the Bus Timetable section recently added in June 2026.

**Overall read on platform-readiness:** Muktainagar Daily is a **well-built single-vertical product** (a shops directory) that is being *gradually pushed toward becoming a multi-vertical local-info platform* — the homepage's "Browse by Section" hub (Shops, Bus, Schools, Banks, Government, Hospitals, Lost & Found, News) and the recently-shipped `bus_timetable` + `bus_stand_info` tables are the early evidence. The codebase still expresses every concept in **Shop-shaped code** — Shop CRUD, Shop search, Shop card, Shop concurrency, Shop bookmark — even though Bus has already arrived and is going to need many of the same primitives. **The single highest-leverage thing the project can do in the next quarter is recognise this and extract a small Entity Framework before the next two sections (Schools, Hospitals) ship.**

**Most worth acting on (top 3):**

1. **Entity Framework + Entity CRUD tab** — unify Shops / Categories / Bus / Banners / future Schools / Hospitals into one configurable list-and-edit framework. Today there are five almost-identical admin tabs (`ShopsTab`, `CategoriesTab`, `BusTimetableTab`, `AdvertisementsTab`, `RequestsTab`) that re-implement search + filter chips + table + bulk actions + two-tap delete + CSV per entity. Without this, every new section will cost a 500-700 line tab.
2. **Image pipeline service** (`useImageUpload` + `storage` service) — the `compressImage → upload → public URL → cleanup-old` sequence is open-coded in **six** places (`MyShop`, `ClaimShopModal`, `RequestListingModal`, `ShopModal`, `SpeedShopModal`, `banners/store`). Each one does the cleanup race slightly differently.
3. **CSV import framework** — three near-identical 3-step modals (`CsvImportModal`, `CategoryCsvImportModal`, `AnalyticsCsvImportModal`) at ~200-400 lines each. Plus `MasterImportModal` and `MasterExportModal`. A schema-driven `<CsvImporter schema={…}/>` collapses all four and makes the next entity's CSV import a 30-line config.

**Honest counter-note:** the codebase is *not* broken. Most files belong in **Leave Alone** — `useAuth`, `shopConcurrency`, `i18n/index`, `banners/flags`, `pwa/register`, `imageVerify`, `useTranslationsCache` are all well-shaped for what they do and Sentinel protects most of them for good reason. Forge's recommendations are about *what's coming*, not *what's wrong*.

---

## Architecture Evolution Score: **58 / 100**

Solid in places (banners, i18n, concurrency, role/RLS layer are well-factored shared modules) but mid-band on **CRUD, forms, search, and entity modelling** — three out of five admin tabs, three out of three CSV importers, three out of three search surfaces, and three out of six image-upload flows are open-coded copies of each other. The score reflects: **strong foundations, weak entity abstraction, and an imminent multi-vertical pivot that the current code shape isn't ready to absorb cheaply.** A 70+ becomes achievable after the Entity Framework + CRUD Framework + Image Service land.

---

## Top 10 Highest-Value Opportunities

| # | Opportunity | Category | Tier | Priority |
|---|---|---|---|---|
| 1 | Entity Framework (Shops/Bus/Schools/Hospitals as instances of one model) | Platform | Platform | ★★★★★ |
| 2 | Admin CRUD Framework (`<EntityTab schema={…}/>`) | CRUD | Platform | ★★★★★ |
| 3 | Image upload service / `useImageUpload` hook | Service | Extract | ★★★★★ |
| 4 | CSV importer framework (`<CsvImporter schema={…}/>`) | CRUD | Extract | ★★★★☆ |
| 5 | `useFuzzySearch` + `useUrlFilters` hooks | Hook | Extract | ★★★★☆ |
| 6 | Form framework (`<EntityForm schema={…}/>` + MR-mirror integration) | Logic | Platform | ★★★★☆ |
| 7 | `storageNaming` → full Storage Service (per-bucket policies, signed URLs, cleanup queue) | Service | Extract | ★★★★☆ |
| 8 | `useRealtimeRow` / `useRealtimeChannel` hook | Hook | Extract | ★★★☆☆ |
| 9 | Generic `updateWithConcurrency` (lift `shopConcurrency` to any `updated_at` table) | Logic | Extract | ★★★☆☆ |
| 10 | Universal Search Framework (Home + Shops + future sections share one) | Feature | Future | ★★★☆☆ |

---

## Reusable Components

### EntityCard (one card, many entities)

**Category:** UI Opportunity
**Tier:** Extract Reusable Building Block

**Current Situation**
`ShopCard.tsx` (222 lines), the inline "CompactShopCard" embedded in `Home.tsx`, the `ShopPreviewSheet`, and the row renderers inside `BusTimetable.tsx` and `SavedShops.tsx` all render *structurally the same thing*: image (or icon fallback) + title + subtitle + status chip + claimed badge + 2-3 action buttons. The Bus Timetable departures list reinvents the same row shape without an image. Coming sections (Schools, Hospitals) will duplicate this a third and fourth time.

**Proposed Architecture**
```
<EntityCard
  image={…}           // optional, falls back to <CategoryIcon/SectionIcon>
  title, subtitle,
  badges={[<ClaimedBadge/>, <StatusChip/>]}
  actions={[{label:'Call', icon, href:'tel:…'}, …]}
  variant="grid" | "list" | "compact"
  footer?                // engagement counts, distance, etc.
/>
```
Keep `ShopCard` as a thin wrapper that maps a `Shop` row to `EntityCard` props. Same for `BusRow`, future `SchoolCard`, `HospitalCard`.

**Migration Strategy**
1. Build `EntityCard` next to existing components.
2. Re-implement `ShopCard` as `(shop) => <EntityCard {...shopToProps(shop)} />`. Verify visually on `/`, `/shops`, `/saved-shops`, `/shop/:id` related strip.
3. Re-implement `CompactShopCard` (currently inline in `Home.tsx`) the same way.
4. Migrate `BusTimetable` row renderer.
5. Land Schools/Hospitals using `EntityCard` from day one.

**Estimated Benefits**
~250 lines of duplicated layout removed at step 2-3; every future section is a 30-line `entityToProps` mapper instead of a 200-line bespoke card. Visual consistency across sections becomes structural rather than disciplinary.

**Complexity:** Medium · **Risk:** Medium (Sentinel marks `ShopCard.tsx` Business Critical — wrapper-first migration keeps the original file's contract intact) · **Priority:** ★★★★☆

---

### SectionHeader / EntityListShell

**Category:** UI Opportunity · **Tier:** Extract

Repeated layout in `Shops`, `SavedShops`, `BusTimetable`, and the admin tabs: page header with title + count + search input + filter chips + result list + pagination/empty-state. A `<EntityListShell header={…} filters={…} empty={…}>` shell would absorb this. Same Sentinel constraint as above — public pages are Business Critical, do the shell as opt-in inside new sections first, then port.

---

### Two-line items still worth mentioning (Minor)

- `_shared/EmptyState.tsx` exists but isn't used on every empty surface (`Home` empty search, `SavedShops`). One-liner adoption.
- `_shared/QuickFilters.tsx` likewise — only `ShopsTab` and `AdvertisementsTab` use it. `Shops` page reinvents the chip row.

---

## Reusable Hooks

### `useFuzzySearch<T>(items, keys, query)`

**Category:** Hook Opportunity · **Tier:** Extract

**Current Situation**
`Home.tsx`, `Shops.tsx`, and `SavedShops.tsx` each construct a `Fuse` instance with hand-tuned keys (`name`, `name_mr`, `category`, …), debounce the query, and produce a filtered list. `BusTimetable` has its own debounce-and-filter loop without Fuse. `fuzzySearch.ts` already centralises options but not the React glue.

**Proposed Architecture**
```ts
useFuzzySearch<T>(items: T[], keys: FuseKey<T>[], query: string, opts?): T[]
```
Internally: debounce (250 ms, configurable), memoised Fuse index, empty-query fast path. Pair with `useUrlFilters({searchKey:'q', filters:{category, area, openNow}})` that round-trips state to `?q=…&category=…` (which `Shops.tsx` already does longhand).

**Migration Strategy**
1. Build hook + tests.
2. Replace inline Fuse construction in `Shops.tsx` (longest copy) — verify URL filters still round-trip.
3. Replace in `Home.tsx` and `SavedShops.tsx`.
4. Adopt in `BusTimetable.tsx` (currently no Fuse — would gain typo tolerance for free).

**Estimated Benefits**
~120 lines removed across three pages; one place to tune relevance; new sections get search by config.

**Complexity:** Low · **Risk:** Low · **Priority:** ★★★★☆

---

### `useRealtimeRow(table, filter)` / `useRealtimeChannel`

**Category:** Hook Opportunity · **Tier:** Extract

`MyShop.tsx` opens **four** `postgres_changes` subscriptions (lines 70/89/104/114) with near-identical setup/teardown plus a manual `unsubscribe`. The pattern (`channel → on('postgres_changes', filter, cb) → subscribe → return () => channel.unsubscribe()`) is exactly the kind of thing a hook should own.

`useRealtimeRow('shops', {id}, onChange)` and `useRealtimeChannel({table, filter}, onChange)`. Sentinel protects the *behaviour* of these subscriptions (ownership-revoke toast, concurrency); the hook must preserve message routing one-for-one.

**Complexity:** Low · **Risk:** Medium (Sentinel: ownership-toast path) · **Priority:** ★★★☆☆

---

### Hooks that are fine as-is (Leave Alone)

`useAuth` (Sentinel-protected ordering), `useBanners` (ad-flag chain), `useTranslationsCache` (3-tier cache is correct), `useSmartBack`, `useDebouncedValue`, `useOnlineStatus`, `useInterval`. Don't fold these into anything.

---

## Reusable Services

### Image pipeline service + `useImageUpload`

**Category:** Service Opportunity · **Tier:** Extract Reusable Building Block

**Current Situation**
Six call sites repeat **compress → upload to `shop-images` → get public URL → queue/clean old path**:
- `MyShop.tsx:471/486` (save)
- `ClaimShopModal.tsx:109/129` (claim proof — cleans up on insert failure)
- `RequestListingModal.tsx:327` (public submission)
- `admin/ShopModal.tsx:218/231` (admin edit — `pendingImageDeletionsRef` cleanup)
- `admin/SpeedShopModal.tsx:198` (rapid capture)
- `lib/banners/store.ts:63/78` (banner upload)

Each one re-derives the storage path, choice of dimensions/quality, and the "delete the old object after the row save succeeds" race window. `DataQualityTab > Storage Audit` exists *because* this race leaks.

**Proposed Architecture**
A `lib/storage/imageService.ts` plus a `useImageUpload({bucket, pathStrategy, maxWidth, quality})` hook returning `{upload, cleanup, pendingCleanup, status}`. Inputs: a File or Blob. Outputs: `{path, publicUrl, signedUrl?}`. Cleanup is a queue flushed by the caller *after* the row commit (mirrors today's `pendingImageDeletionsRef` but as a first-class API). Path strategies: `shop`, `request`, `banner`, `claim` — each enforces the bucket's RLS prefix convention.

**Migration Strategy**
1. Build `imageService` covering all four path conventions; unit-test the path strategies.
2. Build `useImageUpload`; migrate `BannerModal` first (simplest, single upload, no cleanup race).
3. Migrate `ShopModal` (touches `pendingImageDeletionsRef` — keep behaviour identical, just route through the hook).
4. Migrate `MyShop`, `SpeedShopModal`, `RequestListingModal`, `ClaimShopModal`.
5. Once all callers migrated, fold orphan-cleanup heuristics back into `DataQualityTab > Storage Audit` — should find dramatically fewer orphans.

**Estimated Benefits**
~180 lines of upload boilerplate removed; one place to fix the cleanup race; future entity uploads (school photo, hospital photo) are a one-line strategy registration. Reduces the surface area Sentinel has to protect on `Replacing storage path conventions`.

**Complexity:** Medium · **Risk:** Medium (Sentinel: storage prefix is policy-load-bearing — path strategies must honour `request-` prefix and `claims/<user_id>/` prefix exactly) · **Priority:** ★★★★★

---

### Storage Service (full)

**Category:** Service Opportunity · **Tier:** Extract

Beyond images, `supabase.storage.from('shop-images')` is called directly in 9 files. `lib/storageNaming.ts` already owns naming — promote it to the *only* storage entry point: `storage.upload/move/remove/getPublicUrl/createSignedUrl`. Per-bucket policy assertions live here. Also resolves the **risk area** in `TECHNICAL_DEBT.md > Single bucket for shops + banners + requests` — a centralised service makes splitting buckets later a one-file change.

**Complexity:** Low · **Risk:** Low · **Priority:** ★★★★☆

---

## Reusable APIs

### Repository layer per entity (thin)

**Category:** Service Opportunity · **Tier:** Extract

Today, `supabase.from('shops').select(…)` is open-coded in ~15 files; `supabase.from('shop_requests')` in 4; `supabase.from('banners')` in 2. The loose typing of `external-types.ts` (Sentinel-confirmed unavoidable) makes mistakes silent. A skinny `shopsRepo`, `requestsRepo`, `claimsRepo`, `bannersRepo` (each exposing `list/get/insert/update/delete` and the few specialised queries the UI needs) gives one place to:
- enforce the `OWNER_EDITABLE_FIELDS` whitelist (currently only `shopConcurrency.ts` knows);
- centralise `pickOwnerEditable()`-style guards;
- provide typed return surfaces that paper over the loose external types.

Sentinel cautions explicitly against introducing a *generic* query builder wrapper (Dangerous Areas table) — that's not what this is. Per-entity repos preserve raw `.from()` style internally; they just stop spreading it across the UI.

**Complexity:** Medium · **Risk:** Medium (Sentinel: any query-shape change can break loose typing in subtle ways — migrate file-by-file with tests) · **Priority:** ★★★☆☆

---

## Reusable Business Logic

### Generic `updateWithConcurrency<T>(table, id, updatedAt, patch)`

**Category:** Logic Opportunity · **Tier:** Extract

`shopConcurrency.ts` implements the optimistic-lock pattern (`WHERE id=$1 AND updated_at=$2 RETURNING *`) only for `shops`. Categories, banners, bus_timetable, bus_stand_info, and the soon-to-arrive entity tables all carry `updated_at` (via the shared `set_updated_at` trigger documented in roles-and-ownership.md) and would all benefit from the same guard. Today, admin edits to categories / banners / bus rows are last-writer-wins.

A generic helper plus per-entity whitelist of editable fields (one entry per repository above) removes a real future-data-loss source.

**Complexity:** Low (the SQL pattern is one line) · **Risk:** Low (additive) · **Priority:** ★★★☆☆

---

### Form framework

**Category:** Logic Opportunity · **Tier:** Platform Opportunity

**Current Situation**
`RequestListingModal` (1017 lines), `ShopModal` (703 lines), `SpeedShopModal` (553 lines), `EditProfileDrawer` (379 lines), `CategoryModal`, `BannerModal`, `ClaimShopModal`, the embedded `MyShop` editor — every form re-implements: react-hook-form setup, Zod schema, MR-mirror field pairing, image picker integration, submit button with loading state, error toast, dirty tracking, draft persistence (in some), step navigation (in `RequestListingModal`). The shared building blocks exist (`MarathiMirrorField`, `TranslateAllButton`, `ImageCropPicker`, `LocationMapPicker`, `AmenitiesPicker`, `TimePickerField`) but the *form scaffolding around them* is copied each time.

**Proposed Architecture**
```
<EntityForm
  schema={shopSchema}        // Zod
  initial={shop}
  fields={[…declarative…]}   // text|textarea|tel|select|image|map|amenities|time|mr-mirror
  steps?={[…]}               // optional wizard
  draftKey?
  onSubmit={…}
/>
```
Plus `<FormSection>` / `<FormRow>` primitives and a `useDirtyGuard` hook (sticky save bar). Keep direct rhf access through render props for the 10% of fields that need bespoke logic.

**Migration Strategy**
1. Build framework + adopt in the simplest form (`CategoryModal`).
2. Adopt in `BannerModal`.
3. Adopt in `EditProfileDrawer`.
4. Adopt in `ShopModal` (largest payoff — admin editor and its 12 fields).
5. `SpeedShopModal` as multi-row variant.
6. `RequestListingModal` last (Sentinel Business Critical — wizard + draft + completion %; migrate only after the framework has steps + draftKey support). Keep the `open-list-shop-modal` event contract untouched.

**Estimated Benefits**
A realistic 1500-2000 lines collapses to ~800 across these eight forms; new entity forms (School, Hospital) become 60-line schema declarations.

**Complexity:** High · **Risk:** Medium (`RequestListingModal` is Sentinel-protected — migrate last and with care) · **Priority:** ★★★★☆

---

## Reusable Feature Modules

### Admin CRUD Framework

**Category:** CRUD Opportunity · **Tier:** Platform Opportunity

**Current Situation**
`ShopsTab` (670), `CategoriesTab` (267), `BusTimetableTab` (538), `AdvertisementsTab` (544), `RequestsTab` (508) — five tabs, ~2500 lines, all implementing the same shape: header with title + count → search input → `QuickFilters`/status filter → table (desktop) + card list (mobile) → row actions (edit / toggle active / two-tap delete) → bulk actions → CSV export → modal-based create/edit. Each tab reinvents the loading skeleton, the empty state, the count badges, the pagination, the optimistic toggle.

**Proposed Architecture**
```
<EntityTab
  schema={shopEntitySchema}    // columns, filters, search keys, actions
  query={shopsRepo.list}       // TanStack Query
  rowActions={[edit, toggle, deleteWithConfirm]}
  bulkActions={[…]}
  importer={<CsvImporter schema={shopCsvSchema}/>}
  exportCsv={…}
  EditModal={ShopModal}        // or framework-generated
/>
```
The `EntityTab` knows nothing about Shops — it knows about columns and actions. Each tab becomes a 40-line config file.

**Migration Strategy**
1. Build `EntityTab` with the union of features used today (filters, bulk, two-tap delete, CSV).
2. Migrate `CategoriesTab` first (smallest, no Sentinel constraints beyond merge — which stays as a separate modal trigger).
3. Migrate `BusTimetableTab` and `AdvertisementsTab`.
4. Migrate `ShopsTab` (largest payoff; preserves `SafeImage` + image-verification scan as `rowActions`/`headerActions`).
5. `RequestsTab` and the Inbox sub-tabs follow a slightly different "moderation queue" shape — keep separate but extract a shared `<ModerationQueue>` cousin.

**Estimated Benefits**
~1500 lines collapse to ~600 across five tabs; adding a future Schools tab is a 40-line config; consistency for admins (every tab behaves the same).

**Complexity:** High · **Risk:** Medium (Sentinel protects `ShopsTab`, `InboxTab`, `RequestsTab` as Business Critical — Shops and the moderation queue tabs migrate last) · **Priority:** ★★★★★

---

### CSV Importer Framework

**Category:** CRUD Opportunity · **Tier:** Extract

**Current Situation**
`CsvImportModal` (409), `CategoryCsvImportModal` (209), `AnalyticsCsvImportModal` (196). Three modals, three implementations of: parse → per-row validate → preview table with ready/warning/error/duplicate badges → import-with-skip. `MasterImportModal` (253) extends the pattern to ZIP/multi-table.

**Proposed Architecture**
```
<CsvImporter
  schema={{
    columns: [{name:'phone', validate:phoneSchema, normalize:normalizePhone}, …],
    duplicateKey: 'phone',
    onRow: (row) => repo.insert(row),
  }}
  templateUrl?  // download a template
/>
```
Plus the existing `csvUtils.ts` becomes the parse/stringify primitive underneath.

**Migration Strategy**
1. Extract from `CategoryCsvImportModal` (simplest).
2. Adopt in `AnalyticsCsvImportModal`.
3. Adopt in `CsvImportModal` (shops — most validators).
4. Refactor `MasterImportModal` to compose multiple `CsvImporter` instances (one per table).
5. **Address `TECHNICAL_DEBT.md > MasterImport boolean/array coercion`** by replacing the heuristic coercion with per-column Zod validators in the schema — this finding directly cleans up an existing documented risk area.

**Estimated Benefits**
~400 lines collapse; consistent error UX across all imports; new entity = one schema declaration; existing technical-debt risk closed.

**Complexity:** Medium · **Risk:** Low (importers are admin-only, errors fail loudly) · **Priority:** ★★★★☆

---

## Platform-Level Opportunities

### Entity Framework — the headline finding

**Category:** Platform Opportunity · **Tier:** Platform Opportunity

**Current Situation**
The product is plainly transitioning from *a shops directory* to *a hyperlocal info platform*. Evidence: the **Browse by Section** hub on Home already shows Shops, Bus, Schools, Banks, Government, Hospitals, Lost & Found, News (per `FEATURES.md`). The first non-Shop entity has already shipped (`bus_timetable` + `bus_stand_info`, June 2026) and it's a near-copy of the Shop shape with a different field set. Every concept the codebase has today is **modelled per-entity**: `ShopCard`, `ShopsTab`, `ShopModal`, `shopConcurrency`, `useLocalizedShop`, `shop_bookmarks`, `shop_engagement`, `BookmarkButton` (Shop-only), `ClaimShopModal` (Shop-only). Schools and Hospitals would each clone that whole stack.

**Proposed Architecture**
A small **Entity** abstraction that names the contract every section honours:
```
type EntityDef<T> = {
  key: 'shop' | 'school' | 'hospital' | 'bus' | …
  table: string
  schema: ZodSchema<T>            // for forms + CSV
  columns: ColumnDef<T>[]          // for admin tabs
  search: { keys: (keyof T)[]; mr?: (keyof T)[] }
  detailRoute: (e: T) => string
  cardProps: (e: T) => EntityCardProps
  i18n?: { table: 'shop_translations' | … }
  ownership?: { ownersTable; claimsTable; concurrency: true }
  engagement?: { table: 'shop_engagement' | … }
}
```
Then `EntityCard`, `EntityTab`, `EntityForm`, `EntityBookmarkButton`, `EntityClaimModal`, `useEntitySearch`, `useEntityRealtime`, `useLocalizedEntity` are all parameterised by an `EntityDef`. `shopDef`, `busDef` live alongside the existing tables; `schoolDef`, `hospitalDef` are 80-line files when those features land.

This isn't theoretical — it's exactly the shape **already implied** by the homepage hub the team has shipped.

**Migration Strategy**
1. Define `EntityDef<T>` interface; write `shopDef` and `busDef` describing what's already in the codebase.
2. Land one consumer first — `EntityCard` parameterised by `shopDef.cardProps` (per the EntityCard finding above).
3. Land `EntityTab` parameterised by `shopDef.columns`/`schema`.
4. Land `EntityForm` parameterised by `shopDef.schema`.
5. Bring `BookmarkButton` and `ClaimShopModal` under the entity contract (claim is Shop-specific today; designing it as `entityDef.ownership?` keeps Schools/Hospitals open).
6. Ship Schools as the **first** entity that *never* had its own bespoke files — proves the framework.

**Estimated Benefits**
The size delta is the whole game: every new section becomes ~150 lines of `entityDef` + a route, not ~2000 lines of pages/cards/tabs/forms/hooks. Translation, bookmarking, claiming, search, admin CRUD, and engagement all come for free per entity. The platform pivot the homepage hub announces becomes structurally true.

**Complexity:** High (this is multi-month, multi-PR work) · **Risk:** Medium-High (touches several Sentinel-Business-Critical surfaces — must land via wrappers first, never as drop-in rewrites) · **Priority:** ★★★★★

---

### Approval / Moderation Framework

**Category:** Platform Opportunity · **Tier:** Platform Opportunity (smaller scope)

`shop_requests` (approve listing) and `shop_claims` (approve ownership) are *the same shape*: queued submission → admin review modal → approve/reject/request-info → side-effect on real table. A future "Lost & Found post moderation", "News submission moderation", "Job posting moderation" will all be the same. Extract `ModerationQueue<TSubmission>` + `<ReviewModal>` parameterised by handlers, mirroring the Entity Framework pattern but at the moderation layer. Pair with the CRUD Framework finding (`<ModerationQueue>` is the third tab kind alongside `<EntityTab>` and `<DashboardTab>`).

**Complexity:** Medium · **Risk:** Medium (Sentinel protects the approve_shop_claim + RequestsTab approval pipeline — only the *shell* moves, the per-table side-effects stay) · **Priority:** ★★★☆☆

---

## Future-Proofing Recommendations

### Universal Search Framework
**Trigger:** the second non-Shop section ships (e.g. Schools). Today's per-page Fuse instances become a single `useUniversalSearch({sources:[shopDef, busDef, schoolDef]})` powering one cross-section search bar on Home. Don't build until trigger fires — premature today.

### Server-side search switch-over (`search_shops` RPC)
**Trigger:** shop count > ~500, or `/shops` first-paint time crosses 1.5s on 3G. The RPC already exists (`pg_trgm` indexed). Keep ignoring Sentinel says don't delete; surface a build-time flag in `useFuzzySearch` that routes to the RPC when set.

### Trending section (`get_trending_shops` RPC + `shop_engagement_stats` MV)
**Trigger:** engagement volume becomes enough that "Trending shops" is a useful ribbon on Home. RPC and MV exist and are unused (Sentinel: don't delete). One day's UI work when warranted.

### Edge Function migration for translation backfill
**Trigger:** Marathi backfill needs to run nightly or against >500 rows. Today's synchronous client-side loop is fine at current scale (`TECHNICAL_DEBT.md` already notes this). Worth a single edge function then; not today.

### Storage bucket split
**Trigger:** policy mistakes start happening, OR the team adds a 4th content type (e.g. school photos, lost-and-found photos). Then split `shop-images` into `shop-images` / `banner-images` / `request-images` / `claim-images` — per `TECHNICAL_DEBT.md`. The Storage Service finding makes this a one-file change.

### `claim_first_admin` → documented bootstrap path
**Trigger:** any new environment provisioning. Today it's undocumented (per `TECHNICAL_DEBT.md`). Either document in `ADMIN_SYSTEM.md` or delete after confirming first admin already exists.

---

## Estimated Productivity Gains

Grounded in counted lines, not generic claims:

- **Reduced duplicate code:** ~2500 lines across admin tabs + ~400 lines across CSV importers + ~180 lines across image upload sites + ~120 lines across search pages = **~3200 lines (~17% of `src/`) removable** once the four extract-tier items land. Form framework adds another ~1500 if pursued.
- **Faster feature development:** Adding the next section (Schools) goes from "clone Shops, ~2000 LOC, ~3 weeks" to "write `schoolDef` and `<SchoolDetail>`, ~200-300 LOC, ~3 days" once the Entity Framework lands.
- **Easier maintenance:** Image-cleanup race lives in one file instead of six (closes a known leak surface `DataQualityTab > Storage Audit` exists to mop up). Concurrency guard becomes free for categories/banners/bus, closing a silent-overwrite risk.
- **Improved consistency:** Admin tabs behave identically (today, search/filter/bulk-action UI differs subtly across tabs). All entity cards lay out the same. All forms remember drafts the same way.
- **Better scalability:** The Browse-by-Section pivot the team has *already announced on the homepage* becomes a structural property of the code rather than a stylistic one. Score goes from 58 → ~75 after the four ★★★★+ items land; 80+ once the Entity Framework is real.

---

## Forge Roadmap

### Phase 1 — Quick Wins (2-4 weeks, low risk)
- `useFuzzySearch` + `useUrlFilters` hooks → adopt across `Shops`, `Home`, `SavedShops`, `BusTimetable`.
- `_shared/EmptyState` and `_shared/QuickFilters` adoption in remaining surfaces.
- `useRealtimeRow` / `useRealtimeChannel` hook → adopt in `MyShop` (4 channels collapse).
- Generic `updateWithConcurrency` → adopt for categories, banners, bus tables.
- Promote `storageNaming.ts` to a full Storage Service (no functional change, just consolidate the 9 direct `supabase.storage.from()` call sites).

### Phase 2 — Shared Foundations (4-8 weeks)
- **Image upload service + `useImageUpload`** — migrate the six call sites in the order in the Migration Strategy above. Close the storage cleanup race.
- **CSV importer framework** — fold the three CSV modals; rebuild `MasterImportModal` on top; close the boolean/array coercion technical-debt.
- Per-entity repository layer (shops/requests/claims/banners/categories/bus).
- `EntityCard` + `SectionHeader`/`EntityListShell` shells (wrapper-first; existing components stay).

### Phase 3 — Platform Evolution (8-16 weeks)
- **Admin CRUD Framework (`<EntityTab>`)** — migrate `Categories` → `Bus` → `Advertisements` → `Shops` in that order (riskiest last).
- **Form Framework (`<EntityForm>`)** — `Category` → `Banner` → `Profile` → `Shop` → `Speed` → `RequestListing` (Sentinel-protected last).
- **Moderation Framework (`<ModerationQueue>`)** — `RequestsTab` and `PendingClaims` share the shell.

### Phase 4 — Long-Term Architecture
- **Entity Framework (`EntityDef<T>`)** — define the interface; describe `shopDef` and `busDef`; ship Schools entirely through the framework as the proof.
- Universal Search across entities (when section count ≥ 3 active).
- Server-side search RPC switch-over (when shop count justifies).
- Storage bucket split (when a 4th content type appears).

Each phase is independently shippable. Phases 1-2 are pure consolidation and should not change any user-visible behaviour. Phase 3 is where Sentinel's Business Critical list gets touched — every PR in Phase 3 should reference the Sentinel item it migrates and demonstrate behavioural parity.
