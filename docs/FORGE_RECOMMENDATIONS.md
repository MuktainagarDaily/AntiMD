# Forge Recommendations

> Handoff document for Archivist + Sentinel. Compact, action-oriented. Full rationale in `FORGE_REPORT.md`.

## 2026-06-30 — Run 1

### Scope Analyzed
Entire project (all ten Forge agent passes at survey depth). Read against Archivist's docs (`PROJECT_BIBLE.md`, `ARCHITECTURE.md`, `FEATURES.md`, `WORKFLOWS.md`, `COMPONENT_CATALOG.md`, `TECHNICAL_DEBT.md`) and Sentinel's `SENTINEL_CONTEXT.md`. Every conflict with a Sentinel-Protected system is flagged below.

### Recommendations Table

| # | Opportunity | Category | Tier | Status | Priority | Conflicts w/ Sentinel? |
|---|---|---|---|---|---|---|
| 1 | Entity Framework (`EntityDef<T>`) — unify Shop/Bus/Schools/Hospitals | Platform | Platform | **Implemented for new entities — 2026-07-08** (`src/lib/entities/types.ts` + `categoryEntity.ts`, `shopEntity.ts`, `requestEntity.ts`, `claimEntity.ts`, `schoolEntity.ts`; Schools ships end-to-end on the framework — see Phase 4 note). Shop/Bus migration intentionally deferred behind Sentinel Business Critical carve-out. | ★★★★★ | Yes — touches ShopCard, ShopsTab, ClaimShopModal, BookmarkButton, MyShop. Wrapper-first migration required. |
| 2 | Admin CRUD Framework `<EntityTab>` | CRUD | Platform | **Implemented — 2026-07-02** (framework v2 in `src/components/admin/_shared/EntityTab.tsx`; entity defs in `src/lib/entities/{category,shop,request}Entity.ts`). Migrated tabs: `CategoriesTab`, `ShopsTab`, `RequestsTab`. **Decision preserved: `BusTimetableTab` and `AdvertisementsTab` will NOT migrate** — their shapes (embedded sub-editor; KPI strip + grouped multi-tier sections with reorder) are not "table of rows" and forcing them in would bloat the framework or leave 90% as bespoke slots (net loss). | ★★★★★ | Sentinel bypass honoured — Business Critical mutations (toggle-active, toggle-verified, approve/reject/delete with duplicate-phone check + image rename + category auto-map) stay in the tab, framework only owns chrome. |
| 3 | Image pipeline service + `useImageUpload` hook | Service | Extract | **Implemented — 2026-07-01** (`src/lib/images/imageService.ts` exposes `compressAndUploadShopImage` + `uploadClaimProofImage` composing existing `compressImage`/`uploadShopImage`; `src/hooks/useImageUpload.ts` wraps uploading/error state around any async uploader). Additive — path conventions (`request-<slug>`, `claims/<user_id>/…`) preserved byte-for-byte. Existing call sites migrate opportunistically. | ★★★★★ | Honoured — storage RLS paths unchanged. |
| 4 | CSV importer framework `<CsvImporter>` | CRUD | Extract | **Implemented — 2026-07-01** (`src/components/admin/_shared/csv-importer/` — config-driven three-step shell: upload → preview → result; owns FileReader, dedupe ledger, status badges, batch import lifecycle). Pilot migration: `CategoryCsvImportModal.tsx` (209→~75 LOC, behaviour identical). `AnalyticsCsvImportModal` and the shops `CsvImportModal` migrate next session. **`MasterImportModal` explicitly excluded** — composite-PK `onConflict` logic (fixed in 2026-06 bug pass) does not fit the single-table row-classified shape. | ★★★★☆ | No — admin-only; also closes `TECHNICAL_DEBT > MasterImport boolean/array coercion`. |
| 5 | `useFuzzySearch` + `useUrlFilters` hooks | Hook | Extract | **Implemented — 2026-07-01** (`src/hooks/useFuzzySearch.ts`, `src/hooks/useUrlFilters.ts`). Additive; Home/Shops keep using `buildShopFuse` directly until migrated. | ★★★★☆ | No. |
| 6 | Form framework `<EntityForm>` | Logic | Platform | **In Progress — framework + first adopter shipped 2026-07-08** (`src/lib/forms/{types,EntityForm}.ts(x)` — schema-driven grid with zod validation and a `custom` escape hatch. First real modal migration: `SchoolModal.tsx` — image picker rides on the `custom` field, image lifecycle + repo write happen inside `formDef.onSubmit`, dialog chrome stays bespoke). Queued next: `BannerModal` (image crop + live preview + conditional popup fields), `CategoryModal` (bilingual tab strip). **`RequestListingModal` + `ShopModal` migration deferred** — Sentinel Business Critical; must preserve the `open-list-shop-modal` event contract, `listShopDraft` localStorage key, and `updateShopWithConcurrency` guard. | ★★★★☆ | Framework itself is safe (additive); Business Critical modals honour "migrate last" rule. |
| 7 | Full Storage Service (promote `storageNaming.ts`) | Service | Extract | **Implemented — 2026-07-05** (bucket helpers `removeShopImages`, `removeShopImageQuiet`, `getShopImagePublicUrl`, `moveShopImage`, `listShopImages`, `createShopImageSignedUrl`, `uploadShopImageAtPath` all live in `storageNaming.ts`; `SHOP_IMAGE_BUCKET` exported and consumed by `adminHelpers.extractStoragePath`. All five remaining call sites — `ClaimShopModal`, `ClaimReviewModal`, `ShopModal`, `DataQualityTab`, `RequestsTab` — now route through the service. Zero direct `supabase.storage.from('shop-images')` calls remain outside `storageNaming.ts`). | ★★★★☆ | Honoured — same storage-policy caution as #3; pure consolidation. |
| 8 | `useRealtimeRow` / `useRealtimeChannel` hook | Hook | Extract | **Implemented — 2026-07-01** (`src/hooks/useRealtime.ts`; MyShop.tsx migrated — all three subscriptions now go through the hook. Ownership-revoke toast + `shop_owners` REPLICA IDENTITY FULL contract preserved one-for-one). | ★★★☆☆ | Soft — `MyShop` ownership-revoke toast relies on `shop_owners` REPLICA IDENTITY FULL; hook preserves message routing one-for-one. |
| 9 | Generic `updateWithConcurrency<T>` | Logic | Extract | **Implemented — 2026-07-01** (`src/lib/concurrency.ts`; `updateShopWithConcurrency` now delegates to the generic. Byte-for-byte compatible — same baseline column, same SELECT, same three-branch result). | ★★★☆☆ | No — additive; preserves existing `shopConcurrency` behaviour. |

| 10 | EntityCard (wraps ShopCard, future SchoolCard, etc.) | UI | Extract | **Implemented — 2026-07-03** (`src/components/shared/EntityCard.tsx`; `ShopCard` is now a thin wrapper mapping shop-specific props onto the shared primitive. `Schools.tsx` public page also consumes `EntityCard` directly — first non-shop adopter.) | ★★★★☆ | Sentinel-safe — wrapper preserves the ShopCard public API. |
| 11 | Per-entity repository layer | Service | Extract | **Implemented — 2026-07-08** (framework + all six repos: `shopsRepo`, `categoriesRepo`, `requestsRepo`, `claimsRepo`, `bannersRepo`, `schoolsRepo`; see `src/lib/repos/README.md` for the file-by-file migration policy. Full adoption inside `SchoolsTab`/`SchoolModal`; other call sites migrate opportunistically per Sentinel guardrail — never batch-rewrite.) | ★★★☆☆ | Soft — per-entity repos, NOT a generic query builder. Migrate file-by-file. |
| 12 | Moderation Framework `<ModerationQueue>` | Feature | Platform | **Implemented — 2026-07-02** (`src/components/admin/_shared/ModerationQueue.tsx` wraps `<EntityTab/>` with standardised approve/reject/delete row actions, a shared confirm `AlertDialog` with per-action copy override, and unified `actionLoading` state. First adopter: `RequestsTab.tsx` — removed ~90 lines of duplicated dialog + row-action boilerplate. Per-record side-effects — duplicate-phone check, category auto-map, `renameShopImage`, storage cleanup, `admin-requests-pending-count` invalidation, `onShopCreated()` — stay in the caller. Framework never touches business logic.). Next adopter: `PendingClaims` inside `InboxTab.tsx`. | ★★★★☆ | Sentinel-safe — the approve/reject/delete handlers, their Supabase writes, and the toast copy are all owned by the tab; the framework only owns presentation and the confirmation UX. |
| 13 | Universal Search Framework | Feature | Future | Proposed | ★★★☆☆ | No. Trigger: 2nd non-Shop section ships. |
| 14 | `search_shops` RPC switch-over | Service | Future | Proposed | ★★☆☆☆ | No. Trigger: shop count > ~500 or `/shops` first paint > 1.5s on 3G. |
| 15 | Storage bucket split | Service | Future | **Patch ready — 2026-07-05** (`docs/patches/2026-07-05_bucket_split.sql` — RLS policies for new `school-images` + `request-images` buckets; existing `shop-images` untouched). Bucket creation itself is blocked on the workspace-level `cloud_block_public_buckets` policy — enable public buckets in Workspace Settings → Privacy & Security, then create `school-images` and `request-images` via the Storage API and apply the patch. No file moves required (shop-images currently holds only shop + banner objects). | ★★☆☆☆ | No. Closes `TECHNICAL_DEBT > Single bucket` risk. |

Status legend: **Proposed** (Forge default) → Approved | Rejected | Implemented. Status changes recorded here on the next run after a decision is communicated.

---

### Sentinel cross-references

When a recommendation lands as **Implemented**, the following Sentinel-protected entries should be updated to reflect the new shape (Archivist will record the convention; Sentinel will recognise the change as intentional, not drift):

- **#1, #10** → `SENTINEL_CONTEXT.md > Business Critical > ShopCard.tsx` becomes "the Shop wrapper around `EntityCard`".
- **#2** → `Business Critical > AdminDashboard + InboxTab + RequestsTab` annotated to say the tab shells are `<EntityTab>` / `<ModerationQueue>` instances.
- **#3, #7** → `Dangerous Areas > Renaming storage bucket paths` and `Risk Areas > Single bucket` become managed by the Storage Service; the storage prefix convention moves from "magic string" to "first-class path strategy".
- **#6** → `Business Critical > RequestListingModal + ListShopModalHost` annotated that the wizard now runs on `<EntityForm>` with the `open-list-shop-modal` event contract preserved.
- **#8** → `Known Dependencies > Supabase Realtime` annotated that `MyShop` uses `useRealtimeRow`/`useRealtimeChannel` and the hook is itself protected.
- **#9** → Concurrency guard widens from shops to categories/banners/bus — closes a silent-overwrite risk on those tables.

---

### Phase plan (one-line per phase)

- **Phase 1 — Quick Wins:** #5, #8, #9, partial #7 (consolidate call sites only). **✅ Complete — 2026-07-01.**
- **Phase 2 — Shared Foundations:** #3 (Image Service), #4 (CSV framework), #11 (repos), #10 (EntityCard wrapper). Closes `TECHNICAL_DEBT > MasterImport coercion` and the storage cleanup race.
- **Phase 3 — Platform Evolution:** #2 (CRUD framework), #6 (Form framework), #12 (Moderation framework). Touches Sentinel Business Critical surfaces — Shops, RequestListingModal, and the moderation pipeline migrate last. **✅ Platform landed — 2026-07-02.** (#2 fully migrated for Categories/Shops/Requests; #12 migrated for RequestsTab; #6 framework ready with modal migrations queued behind the Business Critical carve-out.)
- **Phase 4 — Long-Term Architecture:** #1 (Entity Framework). Schools ships as the first entity that never had bespoke files. Then #13 (Universal Search), #14 (server-side search), #15 (bucket split) trigger by their named conditions.

---

### Architecture Evolution Score: 78 / 100

Phase 1 hooks (search/realtime/concurrency), Phase 2 shared foundations (image service, CSV framework, repos, EntityCard wrapper — partial), and Phase 3 platform (EntityTab full migration, ModerationQueue live in RequestsTab, EntityForm framework landed) are now in place. Remaining lift: migrating the four bespoke modals onto `<EntityForm/>`, migrating `PendingClaims` onto `<ModerationQueue/>`, and Phase 4 (Entity Framework for Schools / Bus / Hospitals). Score becomes ~85+ once the modal + PendingClaims migrations land, ~90+ once Phase 4 ships a non-Shop entity end-to-end.

---

## Phase 4 — Entity Framework proven end-to-end (2026-07-03)

**Shipped:** Schools is the first section built entirely on the framework —
no bespoke tab, no bespoke card, no bespoke concurrency helper. See
`docs/patches/2026-07-03_schools.sql` for the DB migration (RLS + grants
+ `set_updated_at` trigger) and:

- `src/lib/repos/schoolsRepo.ts` — repository (rec #11) using
  `updateWithConcurrency` (rec #9, first non-shop adopter).
- `src/lib/entities/schoolEntity.ts` — `EntityDef<SchoolRow>` (rec #1).
- `src/components/admin/SchoolsTab.tsx` — thin `<EntityTab/>` adopter
  (rec #2 covers all CRUD chrome).
- `src/components/admin/SchoolModal.tsx` — hand-rolled today, will
  migrate to `<EntityForm/>` (rec #6) once it lands.
- `src/pages/Schools.tsx` — public page rendering `<EntityCard/>`
  (rec #10, first non-shop consumer).
- Admin nav: `schools` flipped from `soon` → `live`;
  `SectionDetail.tsx` gains `schools: SchoolsTab` in its registry.
- Home "Browse by section" now links `/schools` (was `/sections/schools`).
- Storage: school photos land in the existing `shop-images` bucket with a
  `school-<slug>.webp` filename prefix so a future bucket split (rec #15)
  is rename-only.

**Trigger review:**

- **#13 Universal Search** — trigger was "2nd non-Shop section ships".
  Bus + Schools now qualify → *Approved · next quarter*. Not built this
  phase.
- **#14 `search_shops` RPC** — trigger (`>500 shops` or `>1.5s first paint
  on 3G`) not observed → remains *Proposed*.
- **#15 Storage bucket split** — 4th content type (shops / banners /
  requests / schools) now present → *Approved · next session*. Migration
  becomes a bucket rename once the storage service (rec #7) is complete.

**Architecture Evolution Score: 92 / 100.** Phase 4 promotes non-shop
entity plumbing from "framework exists" to "framework ships product",
and the 2026-07-05 pass closes out Storage Service (rec #7) end-to-end
and delivers the bucket-split patch (rec #15) ready to execute the
moment public buckets are enabled. Remaining lift for 95+: `<EntityForm/>`
migration of the four bespoke modals and the search RPC once the shop
volume trigger fires.

---

## 2026-07-05 — Storage consolidation + bucket-split patch

**Shipped:**

- Recommendation #7 promoted from *Partial* → *Implemented*. Added two
  new helpers to `src/lib/storageNaming.ts` — `createShopImageSignedUrl`
  (claim-proof preview) and `uploadShopImageAtPath` (deterministic
  claim path). Refactored the five remaining call sites so no file
  outside `storageNaming.ts` calls `supabase.storage.from('shop-images')`
  directly. `adminHelpers.extractStoragePath` now derives its marker
  from the exported `SHOP_IMAGE_BUCKET` constant.
- Recommendation #15 patch drafted at
  `docs/patches/2026-07-05_bucket_split.sql`. RLS mirrors the current
  `shop-images` policy shape (public read; authenticated write for
  `request-images` to preserve the public listing-request flow;
  admin-only write/update/delete for `school-images`). Zero data
  migration required — `shop-images` currently holds only shop + banner
  objects (verified via `storage.objects` count).

**Blocked on workspace policy:** creating the `school-images` and
`request-images` buckets fails with `public_buckets_blocked`. Enable
public buckets in Workspace Settings → Privacy & Security, then create
the two buckets via the Storage API and apply the SQL patch above.

## 2026-07-08 — Natural-language search synonyms (no LLM)

Added `src/lib/searchSynonyms.ts` — a curated dictionary of category / brand /
action phrases (EN + Hinglish + Marathi) that expand a raw query into
category-oriented tokens before it reaches `fuzzySearchShops`. Examples:
`cake → bakery`, `medicine → medical/pharmacy`, `दूध → dairy`,
`phone repair → mobile/repair`, `crocin → medical`.

Wired inside `src/lib/fuzzySearch.ts`:

- Synonym tokens are checked against the pre-indexed `_categoriesAll` and
  `_keywordsAll` strings. A synonym-driven category hit is ranked at tier 3
  (same as a direct category match), so exact name / prefix matches still win.
- The synonym-expanded query is also passed to Fuse for typo tolerance.
- Zero backend change, zero LLM cost, works offline. Extend by editing the
  three maps in `searchSynonyms.ts`.

## 2026-07-08 — In-progress audit + completions

**Audit result.** Reviewed every row still marked *In Progress* / *Proposed*
against the codebase:

| # | Prior status | Reality | Action |
|---|---|---|---|
| 1 Entity Framework | In Progress (Category pilot) | 5 EntityDefs live; Schools ships end-to-end on the framework (Phase 4). | Bumped to **Implemented for new entities**. Shop/Bus migration remains a Sentinel Business Critical carve-out. |
| 6 EntityForm | In Progress (framework only) | Framework present, no adopters. | **Migrated `SchoolModal`** as first real adopter — image picker via `custom` field, image lifecycle + repo write inside `formDef.onSubmit`. BannerModal / CategoryModal queued next. |
| 10 EntityCard | Proposed | `ShopCard` already wraps `EntityCard`; `Schools.tsx` also uses it. | Bumped to **Implemented** (doc drift). |
| 11 Repos | Proposed | All six repos exist; Schools fully on repos. | Bumped to **Implemented** with per-Sentinel opportunistic-migration policy for the older call sites. |

**Deliberately not migrated this pass:**

- `ShopModal` / `RequestListingModal` — Sentinel Business Critical (concurrency
  guard, `open-list-shop-modal` event contract, `listShopDraft` key).
- `BannerModal` — image crop + live `<BannerPreview/>` + placement-conditional
  popup fields; migration doable but needs a dedicated pass to preserve UX.
- `CategoryModal` — bilingual EN/MR tab strip is a modal-mode concern the
  framework doesn't model yet; sibling `category_translations` upsert must
  live inside `formDef.onSubmit`.
- Phase 4 remaining triggers (#13 universal search, #14 search RPC, #15
  bucket split) unchanged — waiting on their named conditions / workspace
  policy toggle respectively.

**Architecture Evolution Score: 93 / 100.** First real `<EntityForm/>`
adopter lands; doc statuses now match code truth. Remaining lift for 95+:
migrating `BannerModal` and `CategoryModal` onto `<EntityForm/>` and moving
`PendingClaims` onto `<ModerationQueue/>`.

