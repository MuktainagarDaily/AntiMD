# Admin System

> Admin-specific cross-section. For broader workflows see `WORKFLOWS.md`; for components see `COMPONENT_CATALOG.md`.

## Admin Roles & Permissions

| Role | Source | Grants |
|---|---|---|
| `admin` | `claim_first_admin` RPC (bootstrap) or `user_roles` seed (incl. Examiner Mode `admin-test@apnalocal.in` via `20261115000000`) | Full `/admin` console across all towns (including full `'admin'` write RLS parity on `category_translations`, `shop_translations`, `amenity_translations`, `shops`, and core admin tables); bypass owner column guards on `shops` & `schools`; execute all admin RPCs (`assign_shop_owner`, `revoke_shop_owner`, `approve_shop_claim`, `reject_shop_claim`, `assign_school_owner`, `revoke_school_owner`, `approve_school_claim`, `reject_school_claim`, `get_system_health_snapshot`, `refresh_category_shop_counts`, `refresh_engagement_stats`, `reorder_banners`) |
| `shopkeeper` | Granted via `approve_shop_claim`, `assign_shop_owner`, `approve_school_claim`, or `assign_school_owner` | `/my-shop` & `/my-institute` Owner Hubs (`Shop`, `MessOwnerHub`, `PGOwnerHub`, `SchoolOwnerHub`) with restricted field sets |
| `user` | Default on signup | Bookmark listings, claim shops or schools, write reviews (`shop_reviews` / `school_reviews`), track own requests |

Role hierarchy (`admin=3`, `shopkeeper=2`, `user=1`) is enforced in `useAuth.tsx` and server-side via `has_role` / `is_admin` `SECURITY DEFINER`. `ProtectedRoute` in `src/App.tsx` gates `/admin/*`, `/my-shop`, and `/my-institute`.

## Admin Architecture & Navigation Tree

Built around a **Hub & Leaf** shell (`AdminLayout`, `AdminSidebar`, `BranchTabs`, single source of truth `src/components/admin/layout/adminNav.ts`). Every page is code-split via `lazyWithReload`:

```
/admin
├── overview                  # AdminOverview (city vs all-town KPI stats & quick actions)
├── directory                 # Directory Hub
│   ├── shops                 # DirectoryShops (ShopsTab, infinite query, broken-img scan, CSV export+import)
│   ├── mess                  # DirectoryMess (MessProfile + DailyMenu editors, 21-col CSV export + MessCsvImportModal)
│   ├── pg                    # DirectoryPG (PG vacancy editor, sharing rates, 22-col CSV export + PGCsvImportModal)
│   ├── categories            # DirectoryCategories (CategoriesTab, merge modal, CSV export+import)
│   └── inbox                 # DirectoryInbox (Requests / Shop & School Claims / Owners CSV export / Direct Assign)
├── sections                  # SectionsHub & SectionDetail
│   ├── bus                   # BusTimetableTab (routes, Parandwadi seeds, stand info, CSV export + BusBulkImportModal) — LIVE
│   ├── schools               # SchoolsTab (45-col Education Portal CSV export + SchoolBulkImportModal + town seeds) — LIVE
│   ├── gov                   # GovernmentServicesTab (civic depts, org contacts, outage broadcasts + AuthorityCsvImportModal) — LIVE
│   ├── news                  # LocalNewsTab (RSS/web sources, Scrape Now, feed manager + NewsCsvImportModal) — LIVE
│   └── hospitals / banks / lostfound (Status: 'soon' — reserved in SectionDetail)
├── marketing                 # Marketing Hub
│   └── ads                   # MarketingAds (8-placement banner CRUD, multi-town targeting, 14-col CTR CSV export)
├── insights                  # Insights Hub
│   └── analytics             # InsightsAnalytics (Shop + School engagement analytics, town filter, CSV export + AnalyticsCsvImportModal)
└── system                    # System Operations Hub
    ├── data                  # SystemData (20-dataset Master ZIP/CSV Backup & Restore)
    ├── quality               # DirectoryQuality (4-tab Storage & System Health Suite; /admin/directory/quality redirects here)
    ├── marathi               # SystemMarathi (50k/day MyMemory batch translator across Categories, Shops & Schools)
    └── mcp                   # SystemMcp (MCP endpoint registry & secret-ref validator)
```

## Admin-Only Features

| Feature | Where | Description |
|---|---|---|
| Toggle `is_active` / `is_verified` | `DirectoryShops` (`ShopsTab`) | Two-tap `ConfirmTapButton` + infinite paging + village filter + CSV export/import |
| Manage Mess & Hotels | `DirectoryMess` | Edit thali rates, mess types (`pure_veg` / `veg_nonveg` / `jain_available`), sample autofill (`getMessModalAutofillSample`), dual-tab `MessMenuQuickModal` (`Today's Menu` + `General Menu Card`) with dietary **`Auto-fill Genuine Menu`** (`generateSampleMessMenu`), 21-col CSV export & `MessCsvImportModal` |
| Manage PG & Hostels | `DirectoryPG` | Edit bed vacancies, gender rules, sharing rates; 22-col CSV export & `PGCsvImportModal` |
| Education & Institutes | `SectionDetail` (`schools`) | Full 45-column `SCHOOL_CSV_EXPORT_HEADERS` export, `SchoolBulkImportModal`, official town seeds (Muktainagar / Maval), UDISE/AISHE, admissions, fees & scholarships |
| Essential Services & Authorities | `SectionDetail` (`gov`) | Manage civic departments, helplines, emergency numbers, scheduled outages + `AuthorityCsvImportModal` |
| Local News & RSS Scraper | `SectionDetail` (`news`) | Manage RSS/web sources (`news_sources`), trigger server/proxy scraping, pin/toggle news articles, CSV export & `NewsCsvImportModal` |
| Bus Timetable & Stand Info | `SectionDetail` (`bus`) | Outgoing/incoming routes, depot info, Parandwadi PMPML/MSRTC seeds, CSV export & `BusBulkImportModal` |
| **Storage & System Health Suite** | `/admin/system/quality` (`DataQualityTab`) | Four modular panels: (1) `SystemDiagnosticsPanel` (DB, `get_system_health_snapshot()` RPC, Edge Functions, MV drift, PWA cache), (2) `StorageAuditPanel` (recursive bucket audit, 8-table reference check, expired claim proof purge, unified broken-media probe, collision-safe slug image renamer), (3) `ListingHygienePanel` (Shop & School missing fields, placeholder/non-verified stats + Audit CSV export), (4) `AreaDuplicatesPanel` (city-scoped Devanagari-safe area normalization & phone/WA/name-city duplicate detection) |
| **Master Backup & Restore** | `/admin/system/data` (`MasterExportModal` / `MasterImportModal`) | Exports & restores **20 datasets across 20 tables** in FK-safe order (`MASTER_DATASETS` + `coerceDatasetRow()`) plus organized `/images/{shops,schools,menus,banners}` ZIP archive |
| Banner CRUD & Ads Metrics CSV | `MarketingAds` (`AdvertisementsTab` + `BannerModal`) | 8 placements, All-Towns/District/City targeting, bulk pause/resume, 14-column Banner CTR CSV export, runtime hide toggle |
| Unified Moderation Inbox | `DirectoryInbox` (`InboxTab`) | Multi-entity Requests approval (`shop`/`mess`/`pg`/`school`), dual **Shop & School Claims** review (signed proof URLs, `approve_shop_claim` / `approve_school_claim`), Owners CSV export, Direct Assign (`assign_shop_owner` / `assign_school_owner`) |
| Shop + School Engagement Analytics | `InsightsAnalytics` (`AnalyticsTab`) | Paginated past 1,000 rows (`fetchAllPaged`), town scope filter, Shop + School lead counters (`call`, `whatsapp`, `website`, `maps`, `prospectus`), CSV export & `AnalyticsCsvImportModal` |
| Marathi Translation Backfill | `SystemMarathi` (`MarathiBackfillModal`) | Zero-overwrite batch backfill across Categories, Shops, and Schools via 5-layer pipeline (memory/local/DB cache + 50k/day MyMemory + Gemini AI `town-assistant` `{ mode: 'translate' }` fallback, 2 concurrent workers) |

## Moderation & Guardrails

### Multi-Entity Approval & Dual Ownership
- **Requests (`RequestsTab`):** Supports `entity_type`: `'shop' | 'mess' | 'pg' | 'school'`. Approving normalizes phones, checks duplicates, migrates `photos[]` from `request-images` to `shop-images`/`school-images`, and populates target tables + metadata.
- **Shop & School Claims (`InboxTab > PendingClaims` + `ClaimReviewModal`):** Supports both `shop_claims` and `school_claims` (UDISE+/Govt recognition/trust proof types, signed proof URLs, audit notes). Granting or revoking ownership cross-checks both `shop_owners` and `school_owners` so dual owners keep their `shopkeeper` access until all owned entities are revoked.

### Hard & Soft Guardrails
- **DB Column Guards:** `shops_owner_column_guard` (`shops`) & `protect_school_admin_columns` (`schools`) enforce server-side immutability for moderation/geo/slug/verified-UDISE fields.
- **Rate-Limit Triggers:** `trg_shop_claims_rate_limit`, `trg_school_claims_rate_limit`, `trg_school_reviews_rate_limit`, `shop_requests_rate_limit_check`, `shop_engagement_rate_limit_check`, `trg_school_engagement_rate_limit`.
- **RPC Privilege Tightening:** Anon `EXECUTE` revoked on all claim/ownership/health/refresh RPCs.
- **CSV & Storage Safety:** RFC 4180 multi-line CSV parsing (`src/lib/csvUtils.ts`), formula-injection escaping (`=`, `+`, `-`, `@`, `\t`, `\r` — never mangling negative coordinates), `>1,000`-row pagination (`fetchAllPaged`), 8-table reference verification before orphan deletion, and two-tap `ConfirmTapButton` actions.
