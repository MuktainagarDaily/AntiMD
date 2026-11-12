# Architecture

> Detail document. For business "why", see `PROJECT_BIBLE.md` and `FEATURES.md`.

## Frontend Architecture

### Stack (Confirmed)
| Concern | Library |
|---|---|
| Framework | React 18.3 + TypeScript 5.8 |
| Build | Vite 5.4 + `@vitejs/plugin-react-swc`, dev on port 8080, includes `localNewsProxyPlugin` (`/api/news-proxy`) and `mcpPlugin()` |
| Router | React Router DOM v6 — `BrowserRouter` + `Routes` |
| Server state | TanStack React Query v5 (`staleTime: 120s`, `gcTime: 5min`, `retry: 1`, `refetchOnWindowFocus: false`, localStorage persistent `categories` cache via `createSyncStoragePersister`) |
| Client state | React Context (`AuthContext`, `CityContext`, `I18nContext`) |
| UI primitives | shadcn/ui (Radix Primitives) + lucide-react |
| Styling | Tailwind v3 + `tailwindcss-animate`, `next-themes` |
| Forms | react-hook-form + Zod |
| Charts | Recharts |
| Carousel | Embla Carousel |
| Image crop | react-easy-crop (single + multi-crop `MultiImageCropPicker`) |
| Fuzzy search | Fuse.js v7 (client-side with EN/Hinglish/Marathi synonym expansion) |
| CSV / ZIP | jszip + RFC 4180 `csvUtils.ts` + 20-dataset `masterDatasets.ts` |
| SEO | react-helmet-async (`PageSeo` component) + build-time sitemap/prerender scripts |
| Maps | Leaflet / OpenStreetMap (zero-config default) + optional Google Maps JS API (`VITE_GOOGLE_MAPS_API_KEY` with `gm_authFailure` OSM fallback) |
| Testing | Vitest 3.2 + `@testing-library/react` (**32 test files**, **275 tests**) |

### Route Table (`src/App.tsx`)

#### 1. Non-Town Global Routes
| Path | Component | Protection | Lazy |
|---|---|---|---|
| `/auth` | `Auth` | public | yes |
| `/reset-password` | `ResetPassword` | public | yes |
| `/.lovable/oauth/consent` (aliases: `/oauth/consent`, `/~oauth/consent`) | `OAuthConsent` | public | yes |
| `/admin/login` | `AdminLogin` (→ `/auth`) | public | yes |
| `/admin/*` | `AdminLayout` (nested) | `requireRole="admin"` | yes |
| `/my-shop` | `MyShop` (Shops, Mess, PG & Schools Hub) | authenticated | yes |
| `/my-institute` | `MyShop` (defaults to owned School/Institute Hub) | authenticated | yes |
| `/saved-shops` | `SavedShops` | public wrapper (prompts auth if signed out) | yes |
| `/error/:code` | `ErrorRoute` | public | yes |

#### 2. Root & Legacy Redirects
| Path | Target / Handling | Description |
|---|---|---|
| `/` | `RootCityRedirect` | Dynamically redirects to active town root (`/:citySlug`) |
| `/shops` | `LegacyCityRedirect to="/shops"` | Upgrades un-prefixed URL to active town |
| `/category/:id` | `LegacyCategoryRedirect` | Redirects to `/:citySlug/category/:id` |
| `/shop/:id` | `LegacyShopDetailRedirect` | Redirects to `/:citySlug/shop/:id` |
| `/bus-timetable` | `LegacyCityRedirect to="/bus-timetable"` | Redirects to `/:citySlug/bus-timetable` |
| `/schools` | `LegacyCityRedirect to="/schools"` | Redirects to `/:citySlug/schools` |
| `/schools/:id` | `LegacySchoolDetailRedirect` | Redirects to `/:citySlug/schools/:id` |
| `/mess` | `LegacyCityRedirect to="/mess"` | Redirects to `/:citySlug/mess` |
| `/mess/:id` | `LegacyLivingDetailRedirect module="mess"` | Redirects to `/:citySlug/mess/:id` |
| `/pg` | `LegacyCityRedirect to="/pg"` | Redirects to `/:citySlug/pg` |
| `/pg/:id` | `LegacyLivingDetailRedirect module="pg"` | Redirects to `/:citySlug/pg/:id` |
| `/services` | `LegacyCityRedirect to="/services"` | Redirects to `/:citySlug/services` |
| `/news` | `LegacyCityRedirect to="/news"` | Redirects to `/:citySlug/news` |
| `/sections/:key` | `LegacySectionRedirect` | Redirects to `/:citySlug/sections/:key` |

#### 3. Town-Prefixed Routes (`CityRouteGuard`)
| Path | Component | Protection | Lazy | Description |
|---|---|---|---|---|
| `/:citySlug` | `Home` | public | no | Active town discovery home |
| `/:citySlug/shops` | `Shops` | public | no | Paginated retail shop directory |
| `/:citySlug/category/:id` | `CategoryRedirect` | public | no | Redirects to `/:citySlug/shops?category=...` |
| `/:citySlug/shop/:id` | `ShopDetail` | public | no | Business details, reviews & actions |
| `/:citySlug/bus-timetable` | `BusTimetable` | public | yes | Bus departures & depot info (offline-cached) |
| `/:citySlug/schools` | `Schools` | public | yes | Education & Institutes directory with admission/fee filters |
| `/:citySlug/schools/:id` | `SchoolDetail` | public | yes | Institute profile, fee breakdown, circulars, claims, reviews & WhatsApp enquiry |
| `/:citySlug/mess` | `Mess` | public | yes | Mess & dining directory with daily menus |
| `/:citySlug/mess/:id` | `MessDetail` | public | yes | Mess profile, daily thali/menu card, pricing & reviews |
| `/:citySlug/pg` | `PG` | public | yes | PG & hostels with live bed vacancies |
| `/:citySlug/pg/:id` | `PGDetail` | public | yes | Hostel profile, room/sharing rates, amenities & reviews |
| `/:citySlug/services` | `EssentialServices` | public | yes | Civic authorities, emergency helplines & outage advisories |
| `/:citySlug/news` | `LocalNews` | public | yes | Dated hyperlocal town news feed with RSS/web auto-refresh |
| `/:citySlug/sections/:key` | `SectionComingSoon` | public | yes | Placeholder for future verticals (`hospitals`, `banks`, `lostfound`) |
| `*` | `NotFound` | public | no | 404 fallback |

#### 4. Admin Nested Routes (`/admin/*`)
Driven by `src/components/admin/layout/adminNav.ts`:
- `/admin/overview` (`AdminOverview`)
- `/admin/directory/shops` (`DirectoryShops`)
- `/admin/directory/mess` (`DirectoryMess`)
- `/admin/directory/pg` (`DirectoryPG`)
- `/admin/directory/categories` (`DirectoryCategories`)
- `/admin/directory/inbox` (`DirectoryInbox`)
- `/admin/directory/quality` → redirects to `/admin/system/quality`
- `/admin/sections` (`SectionsHub`) & `/admin/sections/:key` (`SectionDetail` — live: `bus`, `schools`, `gov`, `news`; soon: `hospitals`, `banks`, `lostfound`)
- `/admin/marketing/ads` (`MarketingAds`)
- `/admin/insights/analytics` (`InsightsAnalytics`)
- `/admin/system/data` (`SystemData`)
- `/admin/system/quality` (`DirectoryQuality` — Storage & System Health)
- `/admin/system/marathi` (`SystemMarathi`)
- `/admin/system/mcp` (`SystemMcp`)

`AdminLayout` renders `AdminSidebar` + `BranchTabs` + `<Outlet/>`.
`App.tsx` also mounts global root hosts `<OfflineOverlay />`, `<ListShopModalHost />`, `<CallNumberDialog />`, and `<TownAssistantDrawer />` (Sahayak AI).

`ProtectedRoute` waits on `loading && rolesLoading` before redirecting; unauthorized users land on `/` with a destructive toast.

### State & data-flow patterns

- **Queries & Mutations:** TanStack Query v5 wraps PostgREST `.from(...)` and `.rpc(...)` calls via Supabase JS client (`src/integrations/supabase/client.ts`).
- **Realtime:** Supabase Realtime channels subscribe to `shops`, `shop_requests`, `shop_owners`, `school_owners`, and `mess_daily_menus`.
- **Optimistic concurrency:** Generic `updateWithConcurrency<T>` (`src/lib/concurrency.ts`) backs both `shopConcurrency.ts` (`shops`) and `schoolConcurrency.ts` (`schools`) with `WHERE id=$1 AND updated_at=$2`.
- **Translation cache:** `src/hooks/useTranslationsCache.ts` & `src/lib/translateApi.ts` resolve memory → `localStorage` → `translation_cache` table → MyMemory API (50k/day) → **Gemini AI Marathi fallback** (`town-assistant` `{ mode: 'translate' }`).
- **Anonymous engagement & counters:** Public taps write via RLS-gated INSERTs (`shop_engagement`, `school_engagement`) with DB rate-limit triggers, and banner impressions/clicks increment via `SECURITY DEFINER` RPCs.

### i18n & Theming
- `src/i18n/index.tsx`: `I18nProvider` + `useT()`. EN + MR bundled (`en.json`, `mr.json`). Init order: `?lang=` → `localStorage['md.locale']` → `'en'`.
- `next-themes` provider; light/dark/system via `src/components/theme-provider.tsx` + pre-hydration inline script in `index.html`.

## Backend Architecture

- **Provider:** External Supabase project `fhlaqgzensagjangkpop` (`src/integrations/supabase/client.ts`).
- **Edge Functions (`supabase/functions/` — 3 Deno functions):**
  1. **`mcp` (`supabase/functions/mcp/index.ts`):** Auto-bundled on `vite build` by `mcpPlugin()` from `src/lib/mcp/index.ts`. Serves OAuth 2.1-protected Streamable HTTP MCP endpoint with **7 read-only tools**.
  2. **`town-assistant` (`supabase/functions/town-assistant/index.ts`):** Sahayak AI backend powered by Gemini via `@lovable.dev/ai-gateway` + deterministic server-side fallback querying all 7 entity verticals (with explicit parallel `mess_profiles` & `pg_profiles` retrieval, Today's Menu / cook dish awareness, IST clock, and Parandwadi bus seeds), plus **`{ mode: 'translate' }`** batch EN⇄MR AI translation fallback.
  3. **`scrape-local-news` (`supabase/functions/scrape-local-news/index.ts`):** Fetches active `news_sources` RSS/Atom feeds and HTML webpages server-side, strips markup, parses IST/RFC dates, infers categories, and upserts deduplicated `local_news` rows.
- **Dev News Proxy (`vite.config.ts`):** `localNewsProxyPlugin` exposes `/api/news-proxy` during `vite dev` / `vite preview` with SSRF blocking on localhost/link-local/private CIDR ranges.
- **Auth:** Supabase Auth (email/password for citizens/owners/admins; OAuth 2.1 flow via `/oauth/consent` for external MCP clients). Roles live in `user_roles`, evaluated via `has_role` / `is_admin` `SECURITY DEFINER`.
- **DB:** PostgreSQL with RLS on every public table (`42` tables, `2` materialized views, `4` views). See `DATABASE_REFERENCE.md`.
- **Storage (4 buckets):** `shop-images` (shops + banners + `menus/` + `claims/<user_id>/`), `school-images` (admin/owner write), `request-images` (public pre-approval submissions), `banner-images`. Migration `20261113000000_storage_and_health_fixes.sql` fixed root-object SELECT visibility (`(storage.foldername(name))[1] IS DISTINCT FROM 'claims'`) so `.list('')` no longer hides root shop images or triggers 409 collisions, and extended `image_checked_at`/`image_broken_at` columns across `shops`, `schools`, and `banners`.
- **Type safety nuance:** Runtime `src/integrations/supabase/client.ts` imports `src/integrations/supabase/external-types.ts` (permissive `Record<string, AnyTable>` with strictly typed `AppRole`). A regenerated `src/integrations/supabase/types.ts` snapshot (21 tables from an earlier generation pass) also exists alongside it for reference imports (`MessCsvImportModal`, `PGCsvImportModal`).

## Responsive & Desktop UX Architecture

- **Category Grid Symmetry:** `grid-cols-4 lg:grid-cols-8` paired with `CATS_PER_PAGE = 8` renders 2 balanced rows of 4 on mobile and 1 full-width row of 8 on desktop.
- **Desktop Expanded Discovery:** Wide viewports (`lg:`) expand recently-added shop grids and expose `DesktopNav` horizontal navigation links.
- **Strict Geographic & Hyper-Local Related Shops:** `ShopDetail.tsx` strictly bounds recommendations to `.eq('shops.city_id', currentShopCityId)` and sorts same-village matches first (max 12), hiding the section when empty.
- **Mobile Touch Gestures:** `useEdgeSwipeBack` (`SchoolDetail`, `MessDetail`, `PGDetail`, `ShopDetail`) and `useSwipeDownToClose` (drawers/bottom sheets).

## Security Model (Hardened v3 + Education & Storage Guardrails)

| Layer | Mechanism | Implementation |
|---|---|---|
| PostgREST Grants | SEC-01 | Explicit `SELECT` grants for `authority_*` tables, `local_news`, `school_notices`, `school_reviews`. |
| Living Services RLS | SEC-02 | Explicit `DELETE` policies for `mess_profiles`, `pg_profiles`, `mess_daily_menus` scoped to admin/owner. |
| Dev & Examiner Isolation | SEC-03 & Examiner Auth | `devRoleSwitcher` strips Services PII privileges outside `import.meta.env.DEV`; production **Examiner Mode** (`EXAMINER_MODE_ENABLED` in `src/lib/devHelpers.ts`) authenticates via Supabase Auth (`admin-test@apnalocal.in`) backed by server `'admin'` role & RLS policies. |
| MCP Grants | SEC-05 | `mcp_endpoints` restricted exclusively to `service_role` in grants + admin RLS. |
| Resource Exhaustion | SEC-07 | `get_shops_page()` clamps `clean_search` (100 chars) and `p_limit` (1..50). |
| Open-Redirect / XSS | SEC-08 / SEC-13 | `safeRelativePath()` recursive decoding; declarative JSX rendering; HTTP(S) CHECK constraints on URLs; formula-injection escaping in CSV exports. |
| Owner Column Guards | DB Triggers | `shops_owner_column_guard` (`shops`) & `protect_school_admin_columns` (`schools`) block privilege/moderation/verified-UDISE tampering. |
| Spam Rate Limits | DB Triggers | Anon/user rate limits on `shop_claims`, `school_claims`, `school_reviews`, `shop_requests`, `shop_engagement`, `school_engagement`. |
| Storage Root & PII | RLS + Audit Tooling | `IS DISTINCT FROM 'claims'` protects `claims/` proofs while restoring root enumeration; `StorageAuditPanel` purges expired resolved claim proofs. |
| SSRF Guard | `vite.config.ts` / Edge | `/api/news-proxy` & `scrape-local-news` reject loopback, RFC1918, and link-local addresses. |

## Deployment & PWA Model

- **Vercel + Lovable Cloud:** `vercel.json` handles SPA rewrites, `cleanUrls: true`, cache headers (`max-age=0` on `/sw.js`), and security headers.
- **Pre/post-build scripts:** `prebuild` (`scripts/generate-sitemap.ts`) → `vite build` (`mcpPlugin` emits `supabase/functions/mcp/index.ts`) → `postbuild` (`scripts/prerender.ts` writes SEO `<head>` static shells for `/shop/<slug>`).
- **PWA (`vite.config.ts` + `src/lib/pwa/register.ts`):** Workbox `NetworkFirst` for navigations & bus timetable, `CacheFirst` for `shop-images`, `StaleWhileRevalidate` for Google Fonts. `index.html` includes both `mobile-web-app-capable` and `apple-mobile-web-app-capable`.

## Key `src/lib/` Modules

| File / Folder | Purpose |
|---|---|
| `admin/masterDatasets.ts` | FK-safe 20-dataset Master Export/Import schema registry & `coerceDatasetRow()` |
| `admin/storageHealthService.ts` | Recursive bucket audit, 8-table media reference extraction, expired claim proof purge, unified broken-media probe, slug rename planner, and Supabase/Edge diagnostics |
| `admin/dataQualityHelpers.ts` | Devanagari-safe area comparison, city-scoped duplicate/hygiene analysis |
| `assistant/assistantService.ts` | Sahayak AI client gateway + deterministic offline/local fallback across all 7 verticals |
| `news/{newsTypes,newsParser,newsService}.ts` | Local News types, RSS/Atom/HTML parser, IST date handling, category inference, Edge Function + proxy orchestration |
| `schools/{schoolHelpers,schoolNoticesRepo}.ts` | Education Portal constants, metadata serializer, 45-col CSV parser/exporter, and `school_notices` repository |
| `bus/busHelpers.ts` | Bus direction/type tag parser/serializer, CSV parser, Parandwadi PMPML/MSRTC seeds, and forgiving Damerau-Levenshtein/subsequence matcher (`matchesForgivingBusQuery`, `scoreForgivingMatch`) |
| `geo/{geoService,townConfig,types}.ts` | Multi-town hierarchy access & dynamic `<Town> Daily` branding engine |
| `living/{livingService,livingTypes,sampleMenuGenerator}.ts` | Mess daily menus, fixed-price cards, dietary genuine menu autofill (`generateSampleMessMenu`), and PG Simple/Room-by-Room vacancy management |
| `services/{authorityService,authorityTypes,devRoleSwitcher}.ts` | Essential Services & Civic Authorities service with session-cached contacts |
| `devHelpers.ts` | Production-enabled Examiner Mode flags (`EXAMINER_MODE_ENABLED`) and entity-specific autofill banks (`getEntityAutofillSample`, `getMessModalAutofillSample`) |
| `images/imageService.ts` & `storageNaming.ts` & `imageVerify.ts` & `imageUtils.ts` | Canvas WebP compression, multi-bucket path conventions, recursive listing, and 3-tier broken-image probing |
| `banners/{flags,store,types}.ts` | 3-layer ad kill switch, geo-targeted banner CRUD, and RPC impression/click tracking |
| `concurrency.ts`, `shopConcurrency.ts`, `schoolConcurrency.ts` | Generic optimistic concurrency (`updated_at`) and owner-editable field whitelists |
| `engagement.ts` & `schoolEngagement.ts` | Fire-and-forget deduplicated interaction logging + desktop `tel:` interception (`handleTelLinkClick` → `OPEN_CALL_DIALOG_EVENT`) |
| `reviewsApi.ts` | Unified rating & review hooks/mutations for `shop_reviews` and `school_reviews` |
| `fuzzySearch.ts` & `searchSynonyms.ts` | Fuse.js search with ~150 EN/Hinglish/MR synonym expansions |
| `csvUtils.ts` | RFC 4180 multi-line CSV parser, UTF-8 BOM + Devanagari export, formula-injection sanitizer, >1,000-row pagination |
| `repos/*` & `entities/*` | Thin per-entity repository wrappers and `<EntityTab/>` descriptors |
| `mcp/*` | `defineMcp` entry (`muktainagar-daily-mcp`) + **7 OAuth-protected read-only tools** compiled to `supabase/functions/mcp/index.ts` |
