# API Reference

> The app has **no edge functions**; all backend calls are direct PostgREST + RPC calls via the Supabase JS client (`src/integrations/supabase/client.ts`), plus Supabase Auth and Supabase Storage.

## Convention

| Notation | Meaning |
|---|---|
| `from(t).select/insert/update/delete` | Auto-generated PostgREST endpoint, gated by Row-Level Security (RLS) |
| `rpc(fn, args)` | Remote procedure call (`POST /rest/v1/rpc/<fn>`) |
| `storage.from('bucket')` | Storage REST API across 4 dedicated buckets |
| `auth.*` | Supabase Auth REST + JWT session management |

## RPC Endpoints

| RPC | Args | Returns | Auth requirement | Called from |
|---|---|---|---|---|
| `approve_shop_claim` | `_claim_id uuid` | void | admin (RLS internal; anon EXECUTE revoked) | `admin/DirectoryInbox.tsx` / `InboxTab.tsx` |
| `reject_shop_claim` | `_claim_id uuid, _notes text?` | void | admin | `admin/DirectoryInbox.tsx` / `InboxTab.tsx` |
| `assign_shop_owner` | `_shop_id uuid, _user_id uuid` | void | admin | `admin/InboxTab.tsx` |
| `revoke_shop_owner` | `_shop_id uuid, _user_id uuid` | void | admin | `admin/InboxTab.tsx` |
| `reorder_banners` | `_ids uuid[]` | void | admin | `lib/banners/store.ts` |
| `increment_banner_view` | `_id uuid` | void | public (SECURITY DEFINER) | `lib/banners/store.ts` (fire-and-forget) |
| `increment_banner_click` | `_id uuid` | void | public (SECURITY DEFINER) | `lib/banners/store.ts` (fire-and-forget) |
| `shop_is_claimed` | `_shop_id uuid` | boolean | public | `pages/ShopDetail.tsx` |
| `get_shop_rating` | `_shop_id uuid` | `(average, count, d5, d4, d3, d2, d1)` | public (SECURITY DEFINER) | `lib/reviewsApi.ts` |
| `username_available` | `_username text` | boolean | public (SECURITY DEFINER) | `components/EditProfileDrawer.tsx` |
| `get_shops_page` | `p_area text?, p_category uuid?, p_search text?, p_limit int, p_offset int, p_city_id uuid?, p_village_id uuid?` | slim shop rows | public (SECURITY INVOKER; RLS enforced) | `hooks/useShops.ts` / server query |
| `get_category_shop_counts` | none | `(category_id, shop_count)` rows | public (SECURITY INVOKER; reads materialized `category_shop_counts`) | category badge queries |
| `refresh_category_shop_counts` | none | void | admin | database trigger / admin maintenance |
| `refresh_engagement_stats` | none | void | admin | database trigger / admin maintenance |
| `reprocess_shop_image` | `_shop_id uuid` | text | admin | `DirectoryQuality.tsx` |
| `search_shops` | `q text, lim int` | rows | public (SECURITY INVOKER) | Fuse.js client fallback |
| `get_trending_shops` | `lim int` | rows | public (SECURITY DEFINER) | trending widgets |
| `generate_shop_slug` | `p_name text, p_exclude_id uuid?` | text | authenticated | shop creation/import |
| `has_role` | `_role app_role` | boolean | authenticated / SECURITY DEFINER | `useAuth.tsx` & RLS checks |
| `is_shop_owner` | `_shop_id uuid, _user_id uuid` | boolean | authenticated | `useAuth.tsx` / guards |

## Tables Accessed via `.from()`

| Table / View | Description | Primary operations | Auth gate |
|---|---|---|---|
| `shops` | Core business listings | Read (public), CRUD (admin), owner UPDATE w/ concurrency lock | public SELECT; authenticated write; trigger column guard |
| `categories` | Business classifications | Read (public), CRUD (admin) | public SELECT; authenticated write |
| `shop_categories` | Many-to-many junction | Read (public), junction CRUD (admin) | public SELECT; authenticated write |
| `mess_profiles` | Mess & Dining vertical directory | Read (public), CRUD (admin / mess owner) | public SELECT; authenticated write |
| `mess_daily_menus` | Daily lunch/dinner menu items | Read (public), daily menu post (owner/admin) | public SELECT; authenticated write |
| `pg_profiles` | PG & Student Hostels vertical | Read (public), CRUD (admin / pg owner) | public SELECT; authenticated write |
| `schools` | Education & Institutes directory | Read (public), CRUD (admin) | public SELECT; admin write |
| `shop_requests` | Multi-entity listing submissions | Public INSERT, admin approval / reject | public INSERT; admin / submitter SELECT & UPDATE |
| `shop_claims` | Ownership verification claims | INSERT (auth), admin review | authenticated INSERT; admin read/write |
| `shop_owners` | Active verified listing owners | SELECT, admin assign / revoke | admin SELECT; modified via RPC |
| `reviews` / `shop_reviews` | Customer ratings & reviews | Public SELECT, authenticated UPSERT / DELETE | public SELECT; authenticated own-row write |
| `shop_review_helpful` | Helpful upvotes on reviews | Public SELECT, authenticated INSERT/DELETE | authenticated own-row write |
| `geo_cities` | Multi-town geographic registry | Public SELECT, admin CRUD | public SELECT; admin write |
| `geo_districts` | District-level hierarchy | Public SELECT, admin CRUD | public SELECT; admin write |
| `geo_villages` | Rural / village locations | Public SELECT, admin CRUD | public SELECT; admin write |
| `bus_timetable` | Local bus transit departures | Public SELECT, admin CRUD | public SELECT; admin write |
| `bus_stand_info` | Transit stand contact & facilities | Public SELECT, admin CRUD | public SELECT; admin write |
| `banners` | Platform advertising banners | Public SELECT (active only), admin CRUD | public SELECT; admin write |
| `profiles` | User accounts & settings | SELECT locale/phone/name, UPDATE own | self / admin / shop-owner context |
| `user_roles` | Security RBAC assignments | SELECT on login (`has_role`) | via `has_role` DEFINER |
| `shop_bookmarks` | Personal saved listings | User CRUD | own rows only (`user_id = auth.uid()`) |
| `shop_translations` | Marathi Devanagari overrides | Public SELECT, admin UPSERT | public SELECT; admin write |
| `category_translations`| Localized category names | Public SELECT, admin UPSERT | public SELECT; admin write |
| `translation_cache` | Three-tier translation cache | Cached lookup & insert | public read/write |
| `shop_engagement` | Anonymous interaction telemetry | Public INSERT (click/call), admin query | anon INSERT; auth SELECT |
| `shops_with_claim` (view) | Materialized / view shop projection | Public SELECT | public via underlying RLS |

## Storage Buckets (4 Dedicated Buckets)

| Bucket | Access | Typical Path | Purpose & Policies |
|---|---|---|---|
| `shop-images` | Public read | `<slug>.webp`, `banners/<uuid>.webp` | Permanent listing images and promotional banners. Admin & owners can upload. |
| `school-images` | Public read | `schools/<id>-<timestamp>.webp` | Permanent photography and logos for schools and educational institutions. |
| `request-images` | Public read / Public write | `request-<uuid>-<idx>.webp` | Staging bucket for public multi-entity listing requests. Public INSERT allowed with size limits. |
| `banner-images` | Public read / Admin write | `banners/<id>.webp` | Dedicated storage for marketing campaign creatives and popup promotional banners. |

## Auth Endpoints (via `supabase.auth`)

| Method | Called from | Purpose |
|---|---|---|
| `signInWithPassword({email, password})` | `useAuth.tsx`, `Auth.tsx` | Password-based authentication |
| `signUp({email, password, options.data})` | `useAuth.tsx`, `Auth.tsx` | Sign-up; `options.data.full_name` flows to `profiles` via trigger |
| `signOut()` | `useAuth.tsx` | Clears Supabase JWT and resets local state |
| `resetPasswordForEmail(email, {redirectTo})` | `useAuth.tsx`, `Auth.tsx` | Initiates password recovery email |
| `updateUser({password})` | `useAuth.tsx`, `ResetPassword.tsx` | Commits new password after reset flow |
| `onAuthStateChange(cb)` | `useAuth.tsx`, `i18n/index.tsx` | Reactive event listener for auth changes |
| `getSession()` | `useAuth.tsx`, `i18n/index.tsx`, `banners/store.ts` | Hydrates active session on bootstrap |

## Realtime Channels

| Channel | Tables | Consumer |
|---|---|---|
| `postgres_changes` on `public.shops` | `shops` | `MyShop.tsx` (live shop updates) |
| `postgres_changes` on `public.shop_requests` | `shop_requests` | `MyShop.tsx > MyRequestsCard` |
| `postgres_changes` on `public.mess_daily_menus` | `mess_daily_menus` | `Mess.tsx` (real-time daily menu feed) |

## External APIs

| Service | Used for | Where |
|---|---|---|
| **Google Maps JS API** | Map picker, reverse geocoding, interactive pins | `LocationMapPicker`, `mapsUtils.ts` (`VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY`) |
| **MyMemory Translation API** | English $\leftrightarrow$ Marathi machine translation | `translateApi.ts` (cached 3-tier; free tier fallback) |

## MCP Tools

Exposed at `POST https://fhlaqgzensagjangkpop.supabase.co/functions/v1/mcp` (MCP Streamable HTTP; requires `Accept: application/json, text/event-stream`). OAuth 2.1 protected — callers authenticate via Supabase Auth. All tools are read-only and restricted to active rows.

| Tool | Input | Returns |
|---|---|---|
| `search_shops` | `{ query: string, limit?: 1..50 }` | Active shops matching name/description ILIKE. |
| `get_shop` | `{ slug: string }` | Full shop row + categories. |
| `list_categories` | `{}` | Active categories. |
| `get_bus_timetable` | `{ destination?: string }` | Bus departures, optional destination filter. |

Source of truth: `src/lib/mcp/tools/*.ts`.
