# Admin System

> Admin-specific cross-section. For broader workflows see `WORKFLOWS.md`; for components see `COMPONENT_CATALOG.md`.

## Admin Roles & Permissions

| Role | Source | Grants |
|---|---|---|
| `admin` | `claim_first_admin` RPC (bootstrap) or `user_roles` INSERT (migration seed for the seeded admin account) | Full `/admin` access across all towns; bypass shop/mess/pg owner column guard; execute all admin RPCs (`assign_shop_owner`, `revoke_shop_owner`, `approve_shop_claim`, `reject_shop_claim`, `refresh_engagement_stats`, `reorder_banners`) |
| `shopkeeper` | granted automatically by `approve_shop_claim`; also implicitly by `assign_shop_owner` | `/my-shop` access; edit owned listings (restricted fields) |
| `user` | implicit default | bookmark, claim, submit listing requests, submit reviews and ratings |

Role hierarchy is enforced in code (`useAuth.tsx`: admin=3, shopkeeper=2, user=1) and in DB via `has_role` SECURITY DEFINER. `ProtectedRoute` in `App.tsx` blocks unauthorized route access.

## Admin Architecture & Navigation Tree

The administrative console is built around a unified **Hub & Leaf** layout hierarchy managed by `AdminLayout`, `AdminSidebar`, `BranchTabs`, and defined in `src/components/admin/layout/adminNav.ts`.

All admin routes are code-split via `lazyWithReload` under `/admin/*`:

```
/admin
├── overview                # AdminOverview dashboard with quick metrics & activity
├── directory               # Directory Hub
│   ├── shops               # DirectoryShops (ShopsTab, shop status toggles, categories)
│   ├── mess                # DirectoryMess (Mess & Dining management, daily menu, veg/non-veg)
│   ├── pg                  # DirectoryPG (PG & Hostels management, occupancy, amenities)
│   ├── categories          # DirectoryCategories (category tree, icons, translations)
│   └── inbox               # DirectoryInbox (moderation: listing requests & ownership claims)
├── sections                # SectionsHub & SectionDetail
│   ├── bus                 # Bus Timetable management (live)
│   ├── schools             # Education & Institutes / Schools directory (live)
│   ├── services            # Essential Services & Local Authorities (live)
│   └── hospitals / banks / lostfound / news (planned / soon)
├── marketing               # Marketing Hub
│   └── ads                 # MarketingAds (banner CRUD across 8 placements, town geo-targeting, active toggles)
├── insights                # Insights Hub
│   └── analytics           # InsightsAnalytics (page views, search telemetry, popular queries)
└── system                  # System Operations Hub
    ├── data                # SystemData (Master ZIP export/import, CSV import/export)
    ├── quality             # DirectoryQuality (Data health checks, storage audit, image renamer)
    ├── marathi             # SystemMarathi (Marathi translation backfill pipeline with 50k quota & schools backfill)
    └── mcp                 # SystemMcp (AI & tool integrations)
```

## Admin Workflows

See `WORKFLOWS.md` for full step-by-step:
- **Admin Login + Dashboard** (`/admin/login` $\to$ `/admin/overview`)
- **Admin Moderation (Requests + Claims)** (`/admin/directory/inbox`)
- **Mess & PG Directory Management** (`/admin/directory/mess` & `/admin/directory/pg`)
- **Education & Institutes Management** (`/admin/sections/schools`)
- **Banner Management** (`/admin/marketing/ads`)
- **Analytics & Insights** (`/admin/insights/analytics`)
- **CSV Import (Shops & Categories)** (`/admin/system/data`)
- **Category Merge & Hierarchy** (`/admin/directory/categories`)
- **Marathi Translation Pipeline** (`/admin/system/marathi`)
- **Data Quality & Storage Audit** (`/admin/system/quality`)

## Admin-Only Features

| Feature | Where | Description |
|---|---|---|
| Toggle `is_active` / `is_verified` on a shop | `DirectoryShops` (`ShopsTab`) | Two-tap `ConfirmTapButton` prevents accidental status changes |
| Edit any shop field (incl. slug, categories, coords, photos) | `ShopModal` | Full multi-field editing, location mapping, and multi-photo ordering |
| Manage Mess & Dining profiles | `DirectoryMess` | Edit monthly rates, meal types, veg/non-veg flags, daily menus |
| Manage PG & Hostels | `DirectoryPG` | Edit rent ranges, room types (single/double/triple), gender rules, amenities |
| Education / School listings | `SectionDetail` (`schools`) | Manage schools, colleges, coaching centres with multi-photo support |
| Resolve duplicate phones / missing coords / inconsistent areas | `DirectoryQuality` (`DataQualityTab`) | Automated heuristic scan detecting data defects |
| Bulk image rename to slug-based filenames | `DirectoryQuality > Rename Shop Images` | Safe plan $\to$ apply pipeline with collision detection |
| Bulk delete orphaned storage files | `DirectoryQuality > Storage Audit` | Scans all 4 storage buckets for unreferenced assets |
| ZIP export/import all data | `SystemData` (`MasterExportModal` / `MasterImportModal`) | Engagement + ownership excluded from imports to prevent privilege escalation |
| Category merge | `DirectoryCategories` (`CategoryMergeModal`) | Reassigns shops and cascades updates before removing redundant categories |
| Banner CRUD across 8 placements | `MarketingAds` (`AdvertisementsTab` + `BannerModal`) | Multi-placement banner scheduling, click target URLs, multi-town targeting ("All Towns" or specific city), town badges, active toggles |
| Bulk pause/resume ads | `MarketingAds` | Instant freeze or activation of marketing campaigns |
| "Hide ads for me" preview toggle | `MarketingAds` | Per-admin preview toggle stored in `localStorage` |
| Manual ownership assignment | `DirectoryInbox > Assign` | Uses `assign_shop_owner` RPC with role promotion |
| Revoke ownership | `DirectoryInbox > Owners` | Uses `revoke_shop_owner` RPC and revokes `shopkeeper` privilege |
| Approve/reject claims with admin notes | `DirectoryInbox > Claims` | Uses `approve_shop_claim` / `reject_shop_claim` RPCs |
| Approve/reject listing requests (multi-entity) | `DirectoryInbox > Requests` | Supports `shop`, `mess`, `pg`, `school` entity types with photo arrays and metadata |
| Refresh engagement materialized view | `refresh_engagement_stats` RPC | Admin-callable SQL RPC to recalculate engagement metrics |
| Backfill Marathi translations | `SystemMarathi` (`MarathiBackfillModal`) | AI / dictionary backfill with 50k char/day quota, 2-stream worker throttle, warning rejection, and schools backfill |

## Admin Components

See `COMPONENT_CATALOG.md` § `src/components/admin/` for the complete component catalog. Headline primitives:

- **Navigation & Layout:** `AdminLayout`, `AdminSidebar`, `BranchTabs`, `adminNav.ts`.
- **Pages (14):** `Overview`, `DirectoryShops`, `DirectoryMess`, `DirectoryPG`, `DirectoryCategories`, `DirectoryInbox`, `DirectoryQuality`, `SectionsHub`, `SectionDetail`, `MarketingAds`, `InsightsAnalytics`, `SystemData`, `SystemMarathi`, `SystemMcp`.
- **Modals (11):** `ShopModal`, `CategoryModal`, `CategoryMergeModal`, `BannerModal`, `SpeedShopModal`, `CsvImportModal`, `CategoryCsvImportModal`, `AnalyticsCsvImportModal`, `MasterExportModal`, `MasterImportModal`, `MarathiBackfillModal`.
- **Shared admin primitives:** `ConfirmTapButton` (two-tap safety), `AdminFab` (mobile FAB), `EmptyState`, `QuickFilters`.

## Moderation & Content Control

### Multi-Entity Approval Gates
- **Listing requests** must be admin-approved before becoming live rows in `shops`, `mess_profiles`, `pg_profiles`, or `schools`.
- Supports `entity_type`: `'shop' | 'mess' | 'pg' | 'school'`.
- Entity-specific metadata is previewed in `RequestsTab`:
  - Mess: `meal_types`, `monthly_rate`, `pure_veg`
  - PG: `occupancy_types`, `gender_preference`, `rent_monthly`
  - School: `school_type`, `standards_offered`, `medium_of_instruction`
- Multi-photo arrays (`photos: text[]`) uploaded to `request-images` bucket are migrated to `shop-images` / `school-images` upon approval.
- Phone normalization + duplicate detection executes at approval time.
- **Claims** must be admin-approved before user gains `shopkeeper` role. DB rate-limit trigger prevents spam.

### Hard guardrails (cannot be bypassed via UI)
- **`shops_owner_column_guard` trigger**: blocks any non-admin from changing `is_verified`, `is_active`, `slug`, `category_id` at the DB level.
- **`trg_shop_claims_rate_limit` trigger**: admins exempt; non-admins capped at 1 pending claim per shop, 3 claims per shop per 24 h, 3 claims per user per 1 h.
- **Anon EXECUTE revoked** on `assign_shop_owner`, `revoke_shop_owner`, `approve_shop_claim`, `reject_shop_claim`, `refresh_engagement_stats`.
- **`profiles` SELECT** restricted to self / admin / shop-owner-context; anon reads go through `profiles_public` view (id + full_name only).

### Soft guards (UI conventions)
- **`ConfirmTapButton`**: two-tap pattern for any destructive or visibility-changing action (toggle active, delete, revoke ownership). First tap shows confirm state; second tap commits.
- **Pre-flight checks**: deleting a category fetches linked shop names and shows them in the confirm dialog.
- **Plan-then-apply for storage operations**: image rename builds a full plan with collision detection (`<slug>-1.webp`, `-2`, …) before any storage call.
- **"Sponsored" labels** mandatory in banner components — removing them requires a code change.

### Data import safeties
- **Master Import** skips duplicates by default (opt-in upsert).
- **Engagement + ownership tables NOT importable** via Master Import.
- **CSV import preview** classifies each row as ready / warning / error / duplicate before any DB write.
- **Marathi Backfill never overwrites** existing admin-entered translations.

### Concurrency
- All shop UPDATEs from `/my-shop` go through `updateShopWithConcurrency`: zero rows returned ⇒ conflict ⇒ optimistic state rolled back ⇒ server values shown to user.
