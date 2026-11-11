# API Reference

> Backend calls combine direct **PostgREST + RPC** calls via `src/integrations/supabase/client.ts` (Auth, DB, Realtime, 4 Storage buckets) with **3 Deno Supabase Edge Functions** under `supabase/functions/` (`mcp`, `town-assistant`, `scrape-local-news`).

## Convention

| Notation | Meaning |
|---|---|
| `from(t).select/insert/update/delete` | Auto-generated PostgREST endpoint gated by Row-Level Security (RLS) |
| `rpc(fn, args)` | PostgreSQL remote procedure call (`POST /rest/v1/rpc/<fn>`) |
| `functions.invoke(fn)` | Supabase Deno Edge Function (`POST /functions/v1/<fn>`) |
| `storage.from('bucket')` | Storage REST API across 4 dedicated buckets |
| `auth.*` | Supabase Auth REST + JWT session management |

## Supabase Edge Functions (`supabase/functions/`)

| Function | Endpoint | Auth / Access | Purpose |
|---|---|---|---|
| **`mcp`** | `/functions/v1/mcp` | OAuth 2.1 (Supabase Auth JWT, audience `authenticated`) | Auto-generated MCP Streamable HTTP server exposing **7 read-only town tools** (`src/lib/mcp/index.ts`) |
| **`town-assistant`** | `/functions/v1/town-assistant` | Public / Anon key + CORS | **Sahayak AI** backend querying Gemini via `@lovable.dev/ai-gateway` plus deterministic town-aware local fallback across all 7 verticals |
| **`scrape-local-news`** | `/functions/v1/scrape-local-news` | Admin / Service role or client fallback | Server-side RSS/Atom & HTML scraper parsing headlines, stripping markup, normalizing IST dates, inferring categories, and deduplicating `local_news` |

## RPC Endpoints

| RPC | Args | Returns | Auth requirement | Called from |
|---|---|---|---|---|
| `approve_shop_claim` | `_claim_id uuid` | void | admin (anon EXECUTE revoked) | `admin/InboxTab.tsx` |
| `reject_shop_claim` | `_claim_id uuid, _notes text?` | void | admin | `admin/InboxTab.tsx` |
| `assign_shop_owner` | `_shop_id uuid, _user_id uuid` | void | admin | `admin/InboxTab.tsx` |
| `revoke_shop_owner` | `_shop_id uuid, _user_id uuid` | void | admin (retains `shopkeeper` if school owned) | `admin/InboxTab.tsx` |
| `approve_school_claim` | `_claim_id uuid` | void | admin (anon EXECUTE revoked) | `admin/InboxTab.tsx`, `ClaimReviewModal.tsx` |
| `reject_school_claim` | `_claim_id uuid, _notes text?` | void | admin | `admin/InboxTab.tsx`, `ClaimReviewModal.tsx` |
| `assign_school_owner` | `_school_id uuid, _user_id uuid, _role_title text?` | void | admin | `admin/InboxTab.tsx` |
| `revoke_school_owner` | `_school_id uuid, _user_id uuid` | void | admin (checks `shop_owners` too) | `admin/InboxTab.tsx` |
| `get_system_health_snapshot` | none | `jsonb` diagnostics | admin (`SECURITY DEFINER`) | `lib/admin/storageHealthService.ts` |
| `reorder_banners` | `_ids uuid[]` | void | admin | `lib/banners/store.ts` |
| `increment_banner_view` | `_id uuid` | void | public (`SECURITY DEFINER`) | `lib/banners/store.ts` |
| `increment_banner_click` | `_id uuid` | void | public (`SECURITY DEFINER`) | `lib/banners/store.ts` |
| `shop_is_claimed` | `_shop_id uuid` | boolean | public | `pages/ShopDetail.tsx` |
| `get_shop_rating` | `_shop_id uuid` | `(average, count, d5..d1)` | public (`SECURITY DEFINER`) | `lib/reviewsApi.ts` |
| `get_school_rating` | `_school_id uuid` | `(average, count, d5..d1)` | public | `lib/reviewsApi.ts` |
| `get_schools_rating_summary` | `_school_ids uuid[]` | `(school_id, average, count)` | public | `pages/Schools.tsx` / `schoolsRepo.ts` |
| `username_available` | `_username text` | boolean | public (`SECURITY DEFINER`) | `components/EditProfileDrawer.tsx` |
| `get_shops_page` | `p_area, p_category, p_search, p_limit, p_offset, p_city_id, p_village_id` | slim shop rows | public (`SECURITY INVOKER`; bounded) | `hooks/useShops.ts` / server query |
| `get_category_shop_counts` | none | `(category_id, shop_count)` rows | public (`SECURITY INVOKER`) | category badge queries |
| `refresh_category_shop_counts` | none | void | admin | `storageHealthService.ts` / triggers |
| `refresh_engagement_stats` | none | void | admin | maintenance / triggers |
| `search_shops` | `q text, lim int` | rows | public (`SECURITY INVOKER`) | Fuse.js fallback |
| `get_trending_shops` | `lim int` | rows | public (`SECURITY DEFINER`) | trending widgets |
| `generate_shop_slug` | `p_name text, p_exclude_id uuid?` | text | authenticated | shop creation/import |
| `has_role` / `is_admin` | `_role` / `_user_id` | boolean | authenticated / `SECURITY DEFINER` | `useAuth.tsx` & RLS |
| `is_shop_owner` / `is_school_owner` | entity + user UUID | boolean | authenticated | `useAuth.tsx`, `MyShop.tsx`, RLS |

## Tables Accessed via `.from()`

| Table / View | Description | Primary operations | Auth gate |
|---|---|---|---|
| `shops` | Core business listings | Read (public), CRUD (admin), owner UPDATE w/ concurrency lock | public SELECT; authenticated write; `shops_owner_column_guard` |
| `categories` & `shop_categories` | Taxonomy & M2M links | Read (public), CRUD (admin/auth) | public SELECT; authenticated write |
| `mess_profiles` & `mess_daily_menus` | Mess & dining profiles + daily/fixed menu cards | Read (public), CRUD (admin / owner) | public SELECT; owner/admin write + DELETE |
| `pg_profiles` | PG & hostel capacity, vacancies & sharing rates | Read (public), CRUD (admin / owner) | public SELECT; owner/admin write + DELETE |
| `schools` | Education Portal v2 directory (45-col structured schema) | Read (public active + own owners), CRUD (admin), owner UPDATE | public SELECT; admin / `is_school_owner` write + `protect_school_admin_columns` |
| `school_owners` & `school_claims` | Institute ownership & proof queue | Claim INSERT (auth), SELECT own/admin, approve via RPC | authenticated INSERT/own SELECT; admin RPCs |
| `school_notices` | Live circulars, exam/admission/holiday notices | Public read (active), CRUD (admin / institute owner) | public SELECT; owner/admin write |
| `shop_reviews` & `shop_review_helpful` | Shop star ratings & helpful votes | Public SELECT, auth own-row UPSERT/DELETE | public SELECT; authenticated own-row write |
| `school_reviews` & `school_review_helpful` | Institute ratings & helpful votes | Public SELECT, auth own-row write (5/24h limit) | public SELECT; authenticated own-row write |
| `shop_engagement` & `school_engagement` | Call / WhatsApp / Website / Maps / Prospectus telemetry | Anon/auth INSERT (rate-limited), admin / school owner SELECT | write-only anon; privileged SELECT |
| `shop_requests` | Multi-entity listing submissions (`shop`/`mess`/`pg`/`school`) | Public INSERT (rate-limited), admin review | public INSERT; admin / submitter SELECT |
| `shop_claims` & `shop_owners` | Business claim queue & active owners | INSERT (auth), admin review | authenticated INSERT; admin read/RPC |
| `news_sources` & `local_news` | Hyperlocal RSS/web sources & town news feed | `local_news` public SELECT; admin CRUD on both | `local_news` public SELECT; admin write |
| `authority_*` & `announcement_locations` | Civic departments, offices & outage broadcasts | Public SELECT (active), admin/granted write | explicit `SELECT` grants (SEC-01) |
| `bus_timetable` & `bus_stand_info` | Transit schedules & stand contact | Public SELECT (active), admin CRUD | public SELECT; admin write |
| `geo_countries`, `geo_states`, `geo_districts`, `geo_cities`, `geo_villages` | 5-tier geographic hierarchy | Public SELECT (active), admin CRUD | public SELECT; admin write |
| `banners` | 8-placement geo-targeted ad banners | Public SELECT (active), admin CRUD | public SELECT; admin write |
| `profiles` & `profiles_public` | Account info & safe public name view | Own/admin SELECT; public view `(id, full_name)` | RLS isolated; username locked after 1 edit |
| `shop_bookmarks` | Saved listings | Own-user CRUD | `user_id = auth.uid()` |
| `shop_translations`, `category_translations`, `amenity_translations`, `translation_cache` | EN↔MR translation store & 3-tier cache | Public read; admin/counter updates | column-level `translation_cache` grant |
| `mcp_endpoints` | External MCP client endpoint registry | Admin / `service_role` only | restricted from `authenticated` direct writes via SEC-05 & RLS |
| `shops_with_claim`, `shops_list_public`, `shops_search_public` | Public read views | Public SELECT | `security_invoker = on` |

## Storage Buckets (4 Dedicated Buckets)

| Bucket | Access | Typical Path | Purpose & Policies |
|---|---|---|---|
| `shop-images` | Public read (non-claims) / Auth write / Admin full | `<slug>.webp`, `banners/<uuid>.webp`, `menus/<uuid>.webp`, `claims/<user_id>/<uuid>.webp` | Permanent shop/mess/PG photos, banners, and claim proofs. Root listing fixed via `((storage.foldername(name))[1] IS DISTINCT FROM 'claims')` + `Admins manage all shop-images`. |
| `school-images` | Public read / Admin & owner write | `schools/<id>-<timestamp>.webp` | Permanent institute logos and campus photography. |
| `request-images` | Public read / Public write | `request-<uuid>-<idx>.webp` | Pre-approval submission photos from the 4-step public wizard. |
| `banner-images` | Private / Admin write | `banners/<id>.webp` | Dedicated storage for marketing banner assets. |

## Auth & Realtime Channels

- **Auth (`supabase.auth`):** `signInWithPassword`, `signUp` (`options.data.full_name` seeds `profiles`), `signOut`, `resetPasswordForEmail`, `updateUser`, `onAuthStateChange`, `getSession`.
- **Realtime (`postgres_changes`):** `shops`, `shop_requests`, `shop_owners` (`MyShop.tsx`), `school_owners`, and `mess_daily_menus` (`Mess.tsx`).

## External & Middleware APIs

| Service | Used for | Where |
|---|---|---|
| **Google Maps JS API** | Interactive map picker, reverse geocoding | `LocationMapPicker.tsx`, `mapsUtils.ts` |
| **MyMemory Translation API** | English $\leftrightarrow$ Marathi translation (50k/day quota with registered email) | `translateApi.ts`, `MarathiBackfillModal.tsx` |
| **Lovable AI Gateway (Gemini)** | Sahayak AI natural-language intent & response generation | `supabase/functions/town-assistant/index.ts` |
| **Local News Dev Proxy (`/api/news-proxy`)** | CORS-free RSS/HTML fetching during `vite dev` / `vite preview` (SSRF-guarded) | `vite.config.ts`, `src/lib/news/newsService.ts` |

## MCP Tools (7 Read-Only Tools)

Exposed at `POST https://fhlaqgzensagjangkpop.supabase.co/functions/v1/mcp` (MCP Streamable HTTP, `Accept: application/json, text/event-stream`). **OAuth 2.1 protected** against Supabase Auth (`acceptedAudiences: "authenticated"`). Source of truth: `src/lib/mcp/index.ts` & `src/lib/mcp/tools/*.ts`.

| Tool | Input | Returns |
|---|---|---|
| `search_shops` | `{ query: string, limit?: 1..50 }` | Active shops matching name/description ILIKE. |
| `get_shop` | `{ slug: string }` | Full active shop row + categories. |
| `list_categories` | `{}` | Active directory categories. |
| `get_bus_timetable` | `{ destination?: string }` | Bus departures, optional destination filter. |
| `get_local_news` | `{ city?: string, category?: enum, limit?: 1..30 }` | Active town headlines (pinned & newest first). |
| `search_schools` | `{ query?: string, city?: string, admission_status?: enum, limit?: 1..30 }` | Schools, colleges, coaching centers, fees, admissions & verified flags. |
| `get_civic_services` | `{ city?: string, department?: 'water'\|'electricity'\|'municipal' }` | Active/scheduled civic outage alerts & official department helplines. |
