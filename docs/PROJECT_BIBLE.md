# Muktainagar Daily (ApnaLocal) — Project Bible

> Master synthesis document. High-level only — detail lives in the sibling docs.
> Statement classifications: **Confirmed** (from code), **Inferred** (derived from evidence), **Historical** (carried from prior docs/code comments), **Recommendation** (improvement suggestion).

---

## Vision & Mission
A trustworthy, bilingual (English + Marathi) hyperlocal civic, education, news, and business directory platform originating in **Muktainagar, Maharashtra** and expanding into a regional multi-town network (Bhusawal, Varangaon, Bodwad, Jalgaon, Pune/Maval — Parandwadi) — moderated, free for residents to use, mobile-first, installable (PWA), and resilient to slow networks. *(Confirmed from product surfaces, geo subsystem, and multi-location architecture.)*

## Project Purpose
Make every legitimate local business, civic authority, news update, bus route, school/college, mess, and hostel findable, callable, and routable from one place. The directory exists because (a) map coverage of tier-2/tier-3 and rural India is patchy, (b) WhatsApp-forwarded info goes stale, and (c) residents, parents, and students want a single verified source of truth they can trust. **(Confirmed.)**

## User Types

| Role | DB enum | How granted | What they get |
|---|---|---|---|
| **Visitor (anon)** | — | default | Browse, search, ask Sahayak AI, call/WA/Maps, submit a listing request, view news/schools/mess/PG/services, see banners (with "Sponsored" labels) |
| **User** (signed in) | `user` | sign-up | Bookmark listings (`/saved-shops`), claim a shop or school/institute, write reviews (`shop_reviews` / `school_reviews`) & helpful votes, track own listing requests |
| **Shopkeeper / Institute Owner** | `shopkeeper` | granted via `approve_shop_claim`, `assign_shop_owner`, `approve_school_claim`, or `assign_school_owner` RPCs | `/my-shop` & `/my-institute` Owner Hubs (Shop Editor, `MessOwnerHub`, `PGOwnerHub`, `SchoolOwnerHub`) with concurrency-safe edits, daily menus/vacancies/notices, realtime ownership updates, and 30-day engagement metrics |
| **Admin** | `admin` | bootstrap (`claim_first_admin` RPC) or migration seed | `/admin` hub-and-leaf dashboard: full CRUD across all verticals, moderation Inbox, Storage & System Health diagnostics, 20-dataset Master Backup/Restore, per-module CSV export/import, banners, and Marathi pipeline |

*(Confirmed: `src/hooks/useAuth.tsx`, `supabase/migrations/`, `src/pages/MyShop.tsx`, `src/components/myshop/`.)*

## Business Model
**Free directory + paid banner ads.** Banners are clearly labeled "Sponsored" and can be suppressed via `VITE_ADS_ENABLED=false` or the admin local runtime toggle. No transaction fees, commissions, or listing fees. *(Inferred from `src/lib/banners/flags.ts` and the absence of any payment integration.)*

## Feature Inventory (high level — full detail in `FEATURES.md`)

- **Multi-location Discovery:** Hierarchical location system (`geo_countries` → `geo_states` → `geo_districts` → `geo_cities` → `geo_villages`). Header `<LocationPill />` + `<CityPickerModal />` with GPS locator. Path-scoped routes (`/:citySlug/...`) with legacy redirects.
- **Directory & Shop Profiles:** Home with dynamic categories (8 per row on desktop), Fuse.js search with EN/Hinglish/Marathi synonym expansion, filters, recently-added strip. Shops page with URL-persistent filters and pagination. Shop detail page with call/WhatsApp/maps/share actions, multi-photo gallery (`photos text[]`), customer reviews & ratings (`ReviewsSection` + `WriteReviewSheet`), **Strict Geographic & Hyper-Local Related Shops** (same-city hard boundary, village prioritization, 12-item cap, empty-state DOM hiding), claim/bookmark.
- **Education Portal & School Owner Hub (`/:citySlug/schools`, `/:citySlug/schools/:id`, `/my-institute`):** Primary schools through universities, polytechnics, ITI, and coaching institutes. Structured admissions status/deadlines, fee tiers, scholarships, required documents, bus/transport villages, live circular notices (`school_notices`), verified institute ratings (`school_reviews`), `ClaimSchoolModal`, WhatsApp admission enquiry builder, and `SchoolOwnerHub` self-service portal.
- **Local News & RSS Scraper (`/:citySlug/news`):** Town-scoped hyperlocal news feed with bilingual headline/summary support, category/date filters, pinned circulars, plus automated RSS/Atom/HTML scraping via `scrape-local-news` Edge Function (with `/api/news-proxy` dev middleware and direct fallback).
- **Sahayak AI Town Assistant (`TownAssistantDrawer`):** Floating conversational & voice-enabled (Web Speech API) assistant answering bilingual EN/MR/Hinglish questions across **7 verticals** (`mess`, `pg`, `shop`, `bus`, `school`, `news`, `service`) via the `town-assistant` Edge Function (Gemini Gateway) or deterministic client fallback.
- **Living & Civic Verticals:**
  - **Essential Services & Civic Authorities (`/:citySlug/services`):** Municipal bodies, water/power outage broadcasts with severity badges, and 24x7 emergency helplines with in-memory session caching for officer contacts.
  - **Mess & Dining (`/:citySlug/mess`, `/:citySlug/mess/:id`):** Daily lunch/dinner menu board, fixed-price menu cards, thali rates, monthly passes, dietary filters, Sunday feast indicator, tiffin delivery flags, and `MessOwnerHub`.
  - **PG & Hostels (`/:citySlug/pg`, `/:citySlug/pg/:id`):** Live vacant bed tracking (Simple & Room-by-Room), gender/occupancy tags, sharing rates matrix, curfew times, amenities, and `PGOwnerHub`.
  - **MSRTC & PMPML Bus Timetable (`/:citySlug/bus-timetable`):** Daily outgoing/incoming departures (with Parandwadi PMPML/MSRTC seed support), offline snapshot caching, and bus stand depot contact/GPS location.
- **Listing Requests (4-step multi-entity wizard):** Public submission for shops, messes, PGs, and schools (`photos text[]`, `meta jsonb`) with canvas cropping, map picker, and `localStorage` draft resume → admin moderation inbox.
- **Customer Reviews & Ratings:** Separate verified tables for businesses (`shop_reviews`, `shop_review_helpful`) and institutes (`school_reviews`, `school_review_helpful`), unique-per-user constraints, star breakdowns, and rate-limit anti-spam guards.
- **Admin System & Data Operations:** Route-driven Hub & Leaf console (`/admin/*`) covering Directory (`Shops`, `Mess & Hotels`, `PG & Hostels`, `Categories`, `Claims & Requests`), Sections (`Bus`, `Schools`, `Essential Services`, `Local News` live; `Hospitals`, `Banks`, `Lost & Found` soon), Marketing (`Ads`), Insights (`Analytics`), and System (`Data Backup`, `Storage & Health`, `Marathi Translations`, `AI & MCP`). Includes **20-dataset Master Export/Import**, per-module RFC 4180 CSV export/import modals, and 4-panel **Storage & System Health** suite.
- **Shared Footer (`Footer.tsx`):** Localized copyright notice rendered across public pages and `UserMenuDrawer` (external Vibe Forge attribution link is currently commented out / temporarily hidden in code).
- **Banners:** 8 placement slots, multi-town geo-targeting (`all`/`district`/`city`), popup with dwell+scroll gating, view/click tracking.
- **i18n & PWA/UX:** EN + MR throughout (`useT()`, 3-tier MyMemory translation cache); `mobile-web-app-capable` + `apple-mobile-web-app-capable` meta tags, Service Worker runtime caching, offline overlay, and prerendered `<head>` SEO.

## Critical Workflows (high level — full detail in `WORKFLOWS.md`)

1. **Visitor browse & location selection** → Header `LocationPill` / `CityPickerModal` → `/:citySlug` Home/Directory → Detail page → Call/WA/Maps/Review (logged to `shop_engagement` or `school_engagement`).
2. **Listing request (multi-entity)** → `RequestListingModal` (`entity_type`: shop/mess/pg/school) → `shop_requests` (`pending`) → admin approve → target entity rows + image migration + duplicate-phone check.
3. **Owner Hub daily updates & concurrency** → `/my-shop` or `/my-institute` → `MessOwnerHub`, `PGOwnerHub`, `SchoolOwnerHub`, or Shop Editor (`updateShopWithConcurrency` / `updateSchoolAsOwner` optimistic lock on `updated_at`).
4. **Shop & School claims** → `ClaimShopModal` / `ClaimSchoolModal` (proof upload) → `shop_claims` / `school_claims` (rate-limited) → Admin Inbox review → `approve_shop_claim` / `approve_school_claim` RPC → `shop_owners` / `school_owners` + `shopkeeper` role.
5. **Local News aggregation** → Admin `LocalNewsTab` or auto-seed on `LocalNews` → `scrape-local-news` Edge Function (`/api/news-proxy` in dev) → `local_news` deduplicated by `(city_id, source_url)`.
6. **Sahayak AI query** → `TownAssistantDrawer` (text or voice) → `town-assistant` Edge Function (or local fallback) → entity-linked action cards across 7 verticals.
7. **Master Backup & Storage Health** → `/admin/system/data` (20-dataset FK-safe ZIP/CSV export & restore) + `/admin/system/quality` (Edge/RPC diagnostics, recursive storage orphan audit, expired claim proof purge, unified broken-media probe, slug rename planner).
8. **Banner serve** → `BannerSlot` / `BannerPopup` → 3-layer flag check → active + town/date filter → IntersectionObserver RPC tracking.

## Business Rules (the "why")

- **Moderation-first:** Public submissions stage in `shop_requests` before going live, with phone normalization & duplicate checks at approval.
- **Owner column guards (DB-enforced):** `shops_owner_column_guard` (on `shops`) and `protect_school_admin_columns` (on `schools`) prevent non-admin owners from altering `is_verified`, `is_active`, `is_claimed` (schools), `slug`, `category_id` (shops), geo FKs, or verified `udise_aishe_code`.
- **Concurrency-safe edits:** Both `shops` and `schools` owner writes check `WHERE id=$1 AND updated_at=$2` (`updateWithConcurrency`) to prevent silent overwrites.
- **Dual-ownership awareness:** `revoke_shop_owner` and `revoke_school_owner` cross-check both `shop_owners` and `school_owners` before stripping the `shopkeeper` role.
- **PII & Storage walling:** `profiles` SELECT is restricted; anon reads use `profiles_public`. Proof images under `shop-images/claims/<user_id>/` stay private via `(storage.foldername(name))[1] IS DISTINCT FROM 'claims'` (fixing root `.list('')` enumeration) + admin cleanup tooling for expired proofs.
- **Mandatory "Sponsored" labels & SSRF guards:** Banners always display "Sponsored"; `/api/news-proxy` blocks private/loopback IPs and non-HTTP schemes.

*(All Confirmed via direct source inspection.)*

## Current Architecture Summary (high level — full detail in `ARCHITECTURE.md`)

- **Frontend:** React 18 + Vite 5 + TypeScript SPA. React Router v6 (`/:citySlug/...`), TanStack Query v5 (`staleTime: 120s`, `categories` localStorage persister), shadcn/Radix + Tailwind, lucide-react, Vitest (31 test files).
- **Backend:** External Supabase project (`fhlaqgzensagjangkpop.supabase.co`) with PostgREST + Realtime + 4 Storage buckets + Auth + **3 Deno Edge Functions** (`mcp`, `town-assistant`, `scrape-local-news`).
- **Auth & MCP:** Supabase email/password for end users; OAuth 2.1 for MCP clients hitting `/functions/v1/mcp` (7 read-only tools) with consent UI at `/.lovable/oauth/consent`.
- **Build & Hosting:** `npm run build` (`generate-sitemap.ts` + `vite build` + `mcpPlugin` + `prerender.ts`). Vercel primary (`vercel.json`); Lovable Cloud compatible.

## Current Development Stage
**Full-featured multi-town civic, education, news, business, and AI-assisted platform (`ApnaLocal` / `<Town> Daily`) with unified Owner Hubs, 7-tool MCP, 3 Edge Functions, 20-dataset Backup/Restore, and automated Storage & System Health diagnostics.**

### 2026-10 to 2026-11 Major Platform Expansions:
- **Multi-Town Location Subsystem (2026-10):** `geo_*` hierarchy, dynamic branding (`townConfig.ts`), URL scoping (`/:citySlug/...`), Pune/Maval & Parandwadi seeds.
- **Mess & PG Living Modules (2026-10 → 2026-11):** `/mess`, `/mess/:id`, `/pg`, `/pg/:id`, `MessOwnerHub` (fixed-price menu cards + daily specials), `PGOwnerHub` (Simple & Room-by-Room vacancies).
- **Essential Services & Hardening v3 (2026-11-08/09):** `authority_*` civic tables, `/services` portal, `get_shops_page` resource bounds, PII memory-only caching, XSS/open-redirect hardening.
- **Local News & RSS Scraper (2026-11-11):** `news_sources`, `local_news`, `/news`, `LocalNewsTab`, `scrape-local-news` Edge Function, and `/api/news-proxy` Vite middleware.
- **Sahayak AI v2 & MCP Expansion (2026-11-11):** `TownAssistantDrawer` (voice search + multi-turn context) + `town-assistant` Edge Function covering all 7 entity types; MCP expanded from 4 to 7 tools (`get_local_news`, `search_schools`, `get_civic_services`).
- **Education Portal v2 & SchoolOwnerHub (2026-11-12):** ~30 new `schools` fields, `SchoolDetail`, `ClaimSchoolModal`, `school_notices`, `school_reviews`, `school_engagement`, `SchoolOwnerHub` (`/my-institute`), and 45-col bulk CSV support.
- **Storage & Health Diagnostics + Export/Import v2 (2026-11-11/13):** Fixed `storage.objects` root listing RLS (`IS DISTINCT FROM 'claims'`), `image_checked_at`/`image_broken_at` columns + `get_system_health_snapshot()`, 4-panel Health suite (`/admin/system/quality`), and 20-dataset `masterDatasets.ts` + RFC 4180 `csvUtils.ts`.
- **Footer & PWA Meta Update:** Commented out "Built for Vibe Forge Hackathon" attribution link in [`Footer.tsx`](src/components/shared/Footer.tsx); added standard `mobile-web-app-capable` meta tag in [`index.html`](index.html).
