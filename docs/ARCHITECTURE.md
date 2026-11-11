# Architecture

> Detail document. For business "why", see `PROJECT_BIBLE.md` and `FEATURES.md`.

## Frontend Architecture

### Stack (Confirmed)
| Concern | Library |
|---|---|
| Framework | React 18.3 + TypeScript 5.8 |
| Build | Vite 5.4 + `@vitejs/plugin-react-swc`, dev on port 8080 |
| Router | React Router DOM v6 — `BrowserRouter` + `Routes` |
| Server state | TanStack React Query v5 (`staleTime: 120s`, `gcTime: 5min`, `retry: 1`, `refetchOnWindowFocus: false`, localStorage persistent categories cache via `createSyncStoragePersister`) |
| Client state | React Context only (`AuthContext`, `CityContext`, `I18nContext`) |
| UI primitives | shadcn/ui (full Radix stack) + lucide-react |
| Styling | Tailwind v3 + `tailwindcss-animate`, `next-themes` |
| Forms | react-hook-form + Zod |
| Charts | Recharts |
| Carousel | Embla Carousel |
| Image crop | react-easy-crop (single + multi-crop) |
| Fuzzy search | Fuse.js v7 (client-side with natural-language synonym expansion) |
| CSV / ZIP | jszip + custom `csvUtils.ts` |
| SEO | react-helmet-async (`PageSeo` component) + build-time prerender scripts |
| Maps | Google Maps JS API + Leaflet |
| Testing | Vitest + @testing-library/react |

### Route Table (`src/App.tsx`)

#### 1. Non-Town Global Routes
| Path | Component | Protection | Lazy |
|---|---|---|---|
| `/auth` | `Auth` | public | yes |
| `/reset-password` | `ResetPassword` | public | yes |
| `/.lovable/oauth/consent` (aliases: `/oauth/consent`, `/~oauth/consent`) | `OAuthConsent` | public | yes |
| `/admin/login` | `AdminLogin` (→`/auth`) | public | yes |
| `/admin` | `AdminLayout` (nested) | `requireRole="admin"` | yes |
| `/my-shop` | `MyShop` | authenticated | yes |
| `/saved-shops` | `SavedShops` | authenticated | yes |
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
| `/mess` | `LegacyCityRedirect to="/mess"` | Redirects to `/:citySlug/mess` |
| `/pg` | `LegacyCityRedirect to="/pg"` | Redirects to `/:citySlug/pg` |
| `/services` | `LegacyCityRedirect to="/services"` | Redirects to `/:citySlug/services` |
| `/sections/:key` | `LegacySectionRedirect` | Redirects to `/:citySlug/sections/:key` |

#### 3. Town-Prefixed Routes (`CityRouteGuard`)
| Path | Component | Protection | Lazy | Description |
|---|---|---|---|---|
| `/:citySlug` | `Home` | public | no | Active town discovery home |
| `/:citySlug/shops` | `Shops` | public | no | Paginated shop directory |
| `/:citySlug/category/:id` | `CategoryRedirect` | public | no | Redirects to `/:citySlug/shops?category=...` |
| `/:citySlug/shop/:id` | `ShopDetail` | public | no | Business details & actions |
| `/:citySlug/bus-timetable` | `BusTimetable` | public | yes | Bus departures & depot info |
| `/:citySlug/schools` | `Schools` | public | yes | Schools & educational directory |
| `/:citySlug/mess` | `Mess` | public | yes | Mess & dining with daily menus |
| `/:citySlug/pg` | `PG` | public | yes | PG & hostels with live vacancies |
| `/:citySlug/services` | `EssentialServices` | public | yes | Civic authorities, emergency helplines & outage advisories |
| `/:citySlug/sections/:key` | `SectionComingSoon` | public | yes | Placeholder for future verticals |
| `*` | `NotFound` | public | no | 404 fallback |

#### 4. Admin Nested Routes (`/admin/*`)
Driven by `src/components/admin/layout/adminNav.ts`:
- `/admin/overview` (`Overview`)
- `/admin/directory/shops` (`DirectoryShops`)
- `/admin/directory/mess` (`DirectoryMess`)
- `/admin/directory/pg` (`DirectoryPG`)
- `/admin/directory/categories` (`DirectoryCategories`)
- `/admin/directory/inbox` (`DirectoryInbox`)
- `/admin/directory/quality` (`DirectoryQuality`)
- `/admin/sections` (`SectionsHub`) & `/admin/sections/:key` (`SectionDetail`)
- `/admin/marketing/ads` (`MarketingAds`)
- `/admin/insights/analytics` (`InsightsAnalytics`)
- `/admin/system/data` (`SystemData`)
- `/admin/system/marathi` (`SystemMarathi`)
- `/admin/system/mcp` (`SystemMcp`)

`AdminLayout` renders `AdminSidebar` + `BranchTabs` + `<Outlet/>`.

`ProtectedRoute` waits on `loading && rolesLoading` before redirecting; unauthorised users land on `/` with a destructive toast.

`HistoryTracker` writes `prevInAppRoute` and `IN_APP_HISTORY_FLAG` to `sessionStorage` so `useSmartBack` can fall back to a sensible parent when no in-app history exists.

### State & data-flow patterns

```
Component
 └─ TanStack Query (useQuery / useMutation)
     └─ supabase.from('table').select/insert/update/delete
         └─ PostgREST + RLS server-side
```

- **Realtime** (Supabase Realtime) on `shops` and `shop_requests` (publication `supabase_realtime`, `REPLICA IDENTITY FULL`). Consumed by `/my-shop`.
- **Optimistic concurrency** (`src/lib/shopConcurrency.ts`): `UPDATE shops … WHERE id=$1 AND updated_at=$2 RETURNING *` — zero rows ⇒ conflict.
- **Translation cache** (`src/hooks/useTranslationsCache.ts`): memory → `localStorage` → `translation_cache` table → MyMemory API.
- **Banner counters** via SECURITY DEFINER RPCs (`increment_banner_view/click`) so anon can write without table access.

### i18n
- `src/i18n/index.tsx`: custom `I18nProvider` + `useT()` hook. EN + MR bundled eagerly.
- Init order: URL `?lang=` → `localStorage['md.locale']` → default `en`.
- Locale applied to `<html lang>`, `body.lang-mr`, `Intl.NumberFormat`.
- DB-stored content translations in `shop_translations`, `category_translations`, `amenity_translations`.

### Theming
- `next-themes` provider; light/dark/system via `src/components/theme-provider.tsx`.

## Backend Architecture

- **Provider:** Supabase project `fhlaqgzensagjangkpop` (external — connected per user instruction; hardcoded in `src/integrations/supabase/client.ts` so Lovable Cloud `.env` resets don't break it). *(Confirmed.)*
- **Edge functions:** **None.** No `supabase/functions/` directory. *(Confirmed.)*
- **Auth:** Supabase Auth — email/password only. No OAuth. JWT in `localStorage`, `autoRefreshToken: true`.
- **DB:** PostgreSQL with RLS on every public table. See `DATABASE_REFERENCE.md`.
- **Storage (2026-07-05, post bucket-split):** four buckets — `shop-images` (shops + banners + `claims/…` proofs), `school-images` (admin-only write), `request-images` (public "list a shop" uploads), `banner-images` (private). All runtime code paths flow through `src/lib/storageNaming.ts`.
- **Type safety nuance:** A single Supabase type file is used: `src/integrations/supabase/external-types.ts` (intentionally permissive `Record<string, AnyTable>` because the external project's schema can't be auto-generated from Lovable). The `app_role` enum is precisely typed inside it and re-exported as `AppRole`. The previously-coexisting Lovable-generated `types.ts` (which described an unrelated scaffold schema) was deleted on 2026-06-26 — see `TECHNICAL_DEBT.md`.

## Data Flow Example — Tap "Call" on a shop

```
User taps Call button (ShopDetail.tsx)
 ├─ window.location.href = `tel:+91...`
 └─ supabase.from('shop_engagement').insert({ shop_id, event_type: 'call' })
     └─ RLS: anon INSERT allowed (write-only)
         └─ Admin later reads via AnalyticsTab (RLS: authenticated SELECT)
             └─ Aggregated client-side; CSV export possible
```

## Responsive & Desktop UX Architecture

The platform follows a mobile-first yet desktop-optimized architecture:
- **Category Grid Symmetry:** Breakpoints configured as `grid-cols-4 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-8 gap-2.5 sm:gap-3.5`. Paired with `CATS_PER_PAGE = 8` in `Home.tsx`, this renders exactly 2 balanced rows of 4 on mobile/tablet, and 1 complete full-width row of 8 on desktop with zero vacant columns.
- **Desktop Expanded Discovery:** On wide viewports (`lg:`), the "Recently Added" and "Featured Shops" sections expand from 4 to 8+ shop cards, eliminating whitespace and taking advantage of wide displays.
- **Z-Index & Sticky Layering:** Explicit hierarchy prevents overlay bleed-through:
  - Header: `z-40` (`sticky top-0`)
  - Sub-navigation & search pill: `z-30`
  - Sticky bottom action bar: `z-20` (`fixed bottom-0`)
  - Image lightboxes & full-screen modals: `z-50`

## Geo-Scoping & Hyper-Local Recommendation Architecture

- **Hard City Boundary:** In `ShopDetail.tsx`, related shops recommendations resolve primary city from `rawShop.city_id || currentCity.id`. Supabase queries strictly enforce `.eq('shops.city_id', currentShopCityId!)`. Shops from different cities or talukas are strictly excluded.
- **Village-Level Priority:** Candidate shops matching the current shop's `village_id` are sorted first (`hyperLocal`), followed by wider same-city shops (`townWide`). The result is capped at 12 items.
- **Empty-State Omission:** If no candidate shops exist within the target city, the entire related shops `<section>` (including `#related-shops-title`) is omitted from the DOM.
- **Cache Invalidation:** TanStack React Query keys incorporate city and village identifiers: `['related-shops', currentShopId, currentShopCityId, currentShopVillageId, sortedCatIds]`.
- **Banner Geo-Targeting:** Banners support `target_level` (`all`, `district`, `city`) with `target_district_id` and `target_city_id`. `useBanners.ts` validates both `target_city_id` and legacy `city_id` against the active town.

## Security Model (Hardened v3)

| Layer | Finding / Mechanism | Implementation |
|---|---|---|
| PostgREST Grants | SEC-01 | Explicit table-level `SELECT` grants to `anon` and `authenticated` for `authority_*` tables. |
| Living Services RLS | SEC-02 | Explicit `DELETE` RLS policies for `mess_profiles`, `pg_profiles`, `mess_daily_menus` scoped to admins and verified shop owners. |
| Dev Isolation | SEC-03 | `devRoleSwitcher` strictly tree-shaken: `!import.meta.env.DEV` forces role to `'citizen'`. |
| MCP Grants | SEC-05 | `mcp_endpoints` write grants revoked from `authenticated`, restricted exclusively to `service_role`. |
| Resource Exhaustion | SEC-07 | `get_shops_page()` parameter constraints (`clean_search` capped to 100 chars, `p_limit` clamped 1..50, `p_offset >= 0`). |
| Open-Redirect Prevention | SEC-08 | `safeRelativePath()` recursive URI decoding (`decodeURIComponent`), single forward-slash verification, protocol-relative rejection (`//`, `/\`, `\\`, `%2F%2F`), and protocol-in-path rejection (`/http:`, `/javascript:`). |
| PII In-Memory Session | SEC-09 | Unencrypted officer PII removed from persistent `localStorage`; cached in-memory during active sessions. |
| XSS Hardening | SEC-13 | Eliminated `dangerouslySetInnerHTML` in favor of declarative, strongly-typed React JSX nodes. |

## Deployment Model

- **Primary Targets:** **Vercel** (production edge CDN + SPA routing + prerendered heads) and Lovable Cloud.
- **Configuration:** `vercel.json` defines SPA routing, `cleanUrls: true` for prerendered `/shop/<slug>` static files, and edge caching policies (`max-age=0` for `/sw.js`, 1yr immutable for `/assets/*`, security headers).
- **Pre/post-build scripts:**
  - `predev` / `prebuild` → `scripts/generate-sitemap.ts` (via `tsx`) → fetches active shops + categories from Supabase REST → `public/sitemap.xml` with per-shop `<lastmod>`.
  - `postbuild` → `scripts/prerender.ts` (via `tsx`) → fetches active shops, writes `dist/shop/<slug>/index.html` with injected `<title>`, OG/Twitter meta, canonical, JSON-LD `LocalBusiness`. **SEO head only**, not full SSR. Falls back gracefully on Supabase outage.
- **Alt:** `wrangler.jsonc` (historical Cloudflare Workers scaffold; preserved for reference, not active).
- **PWA (2026-06-28):** `vite-plugin-pwa` (`generateSW`, `registerType: autoUpdate`, `manifest: false` — we keep `public/manifest.json` by hand) emits `/sw.js` with workbox runtime caching: `NetworkFirst` for HTML navigations and Supabase `bus_timetable`/`bus_stand_info` REST GETs (7d), `CacheFirst` for `shop-images` storage URLs (30d), `StaleWhileRevalidate` for Google Fonts. Registration is gated by `src/lib/pwa/register.ts` — never registers in dev, iframes, Lovable preview hosts, or transient Vercel preview branch deployments, and unregisters any stale `/sw.js` in those contexts. Full PWA active on production domains.

## Key `src/lib/` Modules

| File | Purpose |
|---|---|
| `geo/geoService.ts` | Multi-town geographic data access layer; fetches active cities and villages with offline fallbacks |
| `geo/townConfig.ts` | Dynamic town branding engine (`<Town> Daily`), typography, taglines, and metadata |
| `geo/types.ts` | Geographic types (`GeoCountry`, `GeoState`, `GeoDistrict`, `GeoCity`, `GeoVillage`, `TownBranding`) |
| `living/livingService.ts` | Mess daily menus, meal times, and PG vacancy management service |
| `living/livingTypes.ts` | Mess profile, daily menu, and PG hostel type definitions |
| `services/authorityService.ts` | Essential Services & Local Authorities data service; session-cached officer rosters, emergency helplines & announcements |
| `images/imageService.ts` | Centralized image compression, cropping, upload, and deletion across entities |
| `banners/flags.ts` | 3-layer ad kill switch (build env, runtime localStorage, per-banner active) |
| `banners/store.ts` | Banner CRUD, upload, dedup, RPC view/click tracking |
| `shopConcurrency.ts` | Optimistic lock; `OWNER_EDITABLE_FIELDS` whitelist |
| `shopUtils.ts` | Open/closed computation from `opening_time`/`closing_time` text |
| `fuzzySearch.ts` | Fuse.js wrapper for shops (EN + MR); consumes `searchSynonyms.ts` for natural-language expansion |
| `searchSynonyms.ts` (2026-07-08) | Curated EN/Hinglish/MR phrase → category-token dictionary; used by `fuzzySearch.ts` |
| `concurrency.ts` (2026-07-01) | Generic `updateWithConcurrency<T>` — `shopConcurrency.updateShopWithConcurrency` delegates here |
| `engagement.ts` | Fire-and-forget `logShopEngagement()` + `canDialTel()`. Writes `event_type: 'directions'` |
| `forms/EntityForm.tsx` + `forms/types.ts` (Forge #6) | Declarative form runner used by `SchoolModal` |
| `translateApi.ts` | MyMemory client + 3-tier cache |
| `imageUtils.ts` | Canvas WebP compression |
| `storageNaming.ts` | Storage path conventions, public URL helpers |
| `rateLimit.ts` | `checkCooldown`/`throttle`/`debounce` |
| `mapsUtils.ts` | Google Maps URL builders, coord helpers |
| `uxUtils.ts` | Scroll, focus utilities |
| `error-capture.ts` + `lovable-error-reporting.ts` | Error boundary capture |
| `csvUtils.ts` | CSV parse/stringify |
| `perf/webVitals.ts` | Core Web Vitals (LCP, FID, CLS) performance measurement instrumentation |
| `repos/*` | **Per-entity data-access wrappers** (`shopsRepo`, `requestsRepo`, `claimsRepo`, `bannersRepo`, `categoriesRepo`, `schoolsRepo`, `reviewsRepo`). Additive over raw `supabase.from(...)`. |
| `mcp/*` | **App-exposed MCP server**. `defineMcp` entry + `tools/{search-shops,get-shop,list-categories,get-bus-timetable}.ts`. Bundled at build time by `mcpPlugin()` into `supabase/functions/mcp/index.ts`. OAuth 2.0 protected. |

## Deployment Surface Expansion (MCP Server)

Alongside the SPA bundle, `vite build` emits an auto-generated **Deno edge function** at `supabase/functions/mcp/index.ts`. Deploying it exposes a public MCP Streamable HTTP endpoint at `https://fhlaqgzensagjangkpop.supabase.co/functions/v1/mcp`. The endpoint is **OAuth 2.0 protected**, read-only, and queries active directory records. Consent page is served at `/.lovable/oauth/consent`. Deploy command: `supabase functions deploy mcp --no-verify-jwt --project-ref fhlaqgzensagjangkpop`.
