# Database Reference

> Authoritative source: `supabase/master_schema.sql` + `supabase/migrations/*.sql` + `docs/patches/*.sql`.
> The Lovable-generated `src/integrations/supabase/types.ts` describes a legacy scaffold schema; all current active types flow through `src/integrations/supabase/external-types.ts` and feature-specific types.

## Tables — 32 live + 2 materialized views + 4 views

### Core Directory & Reviews

| # | Table | Purpose | Key columns |
|---|---|---|---|
| 1 | `categories` | Business taxonomy | `id`, `name`, `icon` (emoji/Lucide mapping), `sort_order`, `is_active`, `updated_at` |
| 2 | `shops` | Central business listing | `id`, `name`, `category_id` (deprecated), `city_id` (UUID → `geo_cities`), `village_id` (UUID → `geo_villages`), `phone`, `whatsapp`, `address`, `area`, `sub_area`, `description`, `keywords`, `opening_time`/`closing_time` (TEXT `HH:MM`), `is_open`, `is_active`, `is_verified`, `image_url` (primary cover), `photos text[]` (multi-image gallery), `image_checked_at`, `image_broken_at`, `latitude`, `longitude`, `slug` (unique), `amenities text[]`, `created_at`, `updated_at` |
| 3 | `shop_categories` | M2M shops↔categories | `id`, `shop_id`, `category_id`; UNIQUE(`shop_id`, `category_id`); CASCADE on both FKs |
| 4 | `shop_engagement` | Tap events | `id`, `shop_id`, `event_type` (`call`/`whatsapp`/`maps`/`directions`/`share`/`view`), `created_at` |
| 5 | `shop_requests` | Public submissions inbox (multi-entity) | `id`, `name`, `entity_type` CHECK(`shop`/`mess`/`pg`/`school`), `city_id`, `village_id`, `phone`, `whatsapp`, address fields, `category_text`, `description`, `keywords`, opening/closing times, lat/lng, `maps_link`, `image_url`, `photos text[]`, `meta jsonb` (flexible entity fields), `submitter_name`, `submitter_user_id`, `admin_notes`, `status` (`pending`/`approved`/`rejected`), `amenities text[]`, timestamps |
| 6 | `reviews` | Customer ratings & reviews | `id`, `shop_id`, `user_id`, `user_name`, `rating` (INT 1..5), `review_text`, `created_at`, `updated_at` |

### Sections & Living Verticals

| # | Table | Purpose | Key columns |
|---|---|---|---|
| 7 | `schools` | Schools & educational institutes directory | `id`, `name`, `name_mr`, `city_id`, `village_id`, `school_type` CHECK(`primary`/`secondary`/`higher-secondary`/`college`/`engineering-polytechnic`/`university`/`coaching`/`other`), `medium` CHECK(`marathi`/`english`/`semi-english`/`other`), `area`, `sub_area`, `address`, `address_mr`, `phone`, `email`, `website`, `description`, `image_url`, `photos text[]`, `latitude`, `longitude`, `is_active`, timestamps |
| 8 | `mess_profiles` | Mess & tiffin service profiles | `shop_id` (PK → `shops.id`), `mess_type` CHECK(`pure_veg`/`veg_nonveg`/`jain_available`), `monthly_rate`, `single_thali_rate`, `tiffin_delivery` (BOOL), `lunch_timing`, `dinner_timing`, `sunday_feast` (BOOL), timestamps |
| 9 | `mess_daily_menus` | Daily food menus for mess listings | `id`, `shop_id`, `menu_date` (DATE), `lunch_text`, `dinner_text`, `photo_url`, `special_tag`, timestamps; UNIQUE(`shop_id`, `menu_date`) |
| 10 | `pg_profiles` | Paying guest & hostel details | `shop_id` (PK → `shops.id`), `gender` CHECK(`boys`/`girls`/`both`), `occupancy_target` CHECK(`students`/`professionals`/`any`), `total_beds`, `available_beds`, `deposit_amount`, `notice_period_days`, `gate_closing_time`, `food_included` (BOOL), `amenities text[]`, `sharing_rates jsonb` (`1_sharing`, `2_sharing`, `3_sharing`, `4_sharing`), `vacancies_updated_at`, timestamps |
| 11 | `bus_timetable` | Daily MSRTC bus departures | `id`, `city_id`, `destination`, `destination_mr`, `depot`, `departure_times text[]` (HH:MM format), `via_stops text[]`, `bus_type` (`ordinary`/`express`/`semi_luxury`/`shivshahi`/`other`), `platform_number`, `notes`, `is_active`, `sort_order`, timestamps |
| 12 | `bus_stand_info` | Bus stand contact & location | `id` (CHECK `id=1`), `city_id`, `phone`, `address`, `maps_url`, timestamps |

### Essential Services & Local Authorities

| # | Table | Purpose | Key columns |
|---|---|---|---|
| 13 | `authority_departments` | Municipal & civic department taxonomy | `id`, `slug` (`water`, `electricity`, `municipal`), `name`, `name_mr`, `icon`, `color_theme`, `sort_order`, `is_active`, `created_at` |
| 14 | `authority_organizations` | Administrative bodies & offices | `id`, `department_ids UUID[]`, `city_id`, `district_id`, `name`, `name_mr`, `office_address`, `maps_url`, `visiting_hours`, `helpline_phone`, `emergency_phone`, `whatsapp_number`, `email`, `key_contacts jsonb`, `is_demo`, `is_verified`, `is_active`, timestamps |
| 15 | `authority_announcements` | Public service notices & outage broadcasts | `id`, `org_id`, `department_id`, `city_id`, `title`, `title_mr`, `description`, `description_mr`, `category` (`interruption`/`maintenance`/`emergency`/`notice`/`advisory`), `priority` (`low`/`medium`/`high`/`critical`), `status` (`draft`/`scheduled`/`active`/`completed`/`cancelled`), `start_time`, `end_time`, `published_at`, `media_urls text[]`, `is_demo`, `created_by`, timestamps |
| 16 | `announcement_locations` | Targeted announcement localities | `id`, `announcement_id`, `city_id`, `village_id`, `area_text`, `created_at` |
| 17 | `authority_admin_grants` | Scoped multi-tenant officer access | `id`, `user_id`, `department_id`, `city_id`, `granted_by`, `created_at`; UNIQUE(`user_id`, `department_id`, `city_id`) |

### Geographic Hierarchy (Multi-Town Subsystem)

| # | Table | Purpose | Key columns |
|---|---|---|---|
| 18 | `geo_countries` | Country boundary | `id`, `code` (`IN`), `name`, `is_active`, timestamps |
| 19 | `geo_states` | States and union territories | `id`, `country_id`, `code` (`MH`), `name`, `name_mr`, `is_active`, timestamps |
| 20 | `geo_districts` | Administrative districts | `id`, `state_id`, `slug` (`jalgaon`, `pune`), `name`, `name_mr`, `is_active`, timestamps |
| 21 | `geo_cities` | Towns, talukas, and cities | `id`, `district_id`, `slug` (`muktainagar`, `bhusawal`, `varangaon`, `bodwad`, `maval`), `name`, `name_mr`, `latitude`, `longitude`, `is_active`, timestamps |
| 22 | `geo_villages` | Satellite villages & gram panchayats | `id`, `city_id`, `slug` (`kurha`, `changdev`, `parandwadi`), `name`, `name_mr`, `latitude`, `longitude`, `is_active`, timestamps |

### Auth, Profiles & Ownership

| # | Table | Purpose | Key columns |
|---|---|---|---|
| 23 | `profiles` | Extended user profile | `id` (→`auth.users`), `full_name` (unique `@username`, one-time editable), `email`, `locale`, `phone`, `birth_date`, `gender`, `city_id`, `village_id`, `full_name_changed_at`, `created_at` |
| 24 | `user_roles` | RBAC roles | `id`, `user_id`, `role` (`app_role` enum: `'admin'`, `'shopkeeper'`, `'user'`) |
| 25 | `shop_owners` | Direct shop ownership assignments | `id`, `shop_id`, `user_id` |
| 26 | `shop_claims` | Ownership claim verification queue | `id`, `shop_id`, `user_id`, `status` CHECK(`pending`/`approved`/`rejected`), `proof_type`, `proof_image_path`, `admin_notes`, timestamps |
| 27 | `shop_bookmarks` | User bookmarked shops | `id`, `user_id`, `shop_id`; UNIQUE; `created_at` |

### i18n & Translation Cache

| # | Table | Purpose | Key columns |
|---|---|---|---|
| 28 | `shop_translations` | Per-shop Marathi content | UNIQUE(`shop_id`, `locale`); mirrors title, address, description |
| 29 | `category_translations` | Category Marathi names | `id`, `category_id`, `locale`, `name` |
| 30 | `amenity_translations` | Amenity dictionary | `id`, `key`, `locale`, `label` |
| 31 | `translation_cache` | Shared MyMemory translation cache | `direction`, `source_text`, `translated`, `hit_count`, `last_used_at` |

### Banners & Integrations

| # | Table | Purpose | Key columns |
|---|---|---|---|
| 32 | `banners` | 8-placement multi-town ad system | `id`, `target_level` CHECK(`all`/`district`/`city`), `target_district_id`, `target_city_id`, `city_id` (legacy alias), `title`, `image_url`, `target_url`, `placement`, `is_active`, `popup_delay_seconds`, `close_enable_seconds`, `start_date`, `end_date`, `view_count`, `click_count`, `sort_order`, timestamps |
| 33 | `mcp_endpoints` | AI Agent & tool integrations | `id`, `name`, `url`, `is_active`, timestamps (restricted to `service_role`) |

**Banner placements (8):** `popup`, `homepage_inline`, `shops_inline`, `category_inline`, `shops_infeed`, `shop_detail_inline`, `home_bottom`, `saved_inline`.

## Views

| View | Purpose | Security |
|---|---|---|
| `shops_with_claim` | Shops + `is_claimed` flag | `security_invoker = on` (caller's RLS) |
| `profiles_public` | Safe `(id, full_name)` projection for anon reads | `security_invoker = on` |
| `shop_engagement_stats` | **Materialized view** — calls/WA/total per shop over last 30 days | Locked from public API; refreshed by `refresh_engagement_stats()` |
| `shops_list_public` (2026-07-15, m-Pulse #2) | Slim projection of `is_active` shops for initial Home/Shops render (drops description/keywords/lat/lng/etc.). Adds derived `is_claimed`. | `security_invoker = on`; SELECT granted to `anon`, `authenticated` |
| `shops_search_public` (2026-07-15, m-Pulse #2) | Search-only sidecar view (fetched lazily on search focus). Wide text columns used by Fuse.js. | `security_invoker = on`; SELECT granted to `anon`, `authenticated` |
| `category_shop_counts` (2026-07-15, m-Pulse #3) | **Materialized view** — `(category_id, shop_count)` for `is_active` shops. Refreshed by triggers on `shops` + `shop_categories`. | Not reachable via Data API; exposed only through `get_category_shop_counts()` RPC |

## Triggers

| Trigger | Table | When | Function |
|---|---|---|---|
| `shops_updated_at` | shops | BEFORE UPDATE | `set_updated_at()` |
| `categories_updated_at` | categories | BEFORE UPDATE | `set_updated_at()` |
| `set_shop_requests_updated_at` | shop_requests | BEFORE UPDATE | `set_updated_at()` |
| (set_updated_at) | profiles, shop_claims, authority_* | BEFORE UPDATE | `set_updated_at()` |
| `trg_shop_slug` | shops | BEFORE INSERT/UPDATE | `set_shop_slug()` (auto-slug + collision suffix) |
| `shops_owner_column_guard` | shops | BEFORE UPDATE | Blocks non-admins from writing `is_verified`/`is_active`/`slug`/`category_id` |
| `trg_shop_claims_rate_limit` | shop_claims | BEFORE INSERT | Admins exempt; max 1 pending per (user,shop); 3 claims per (user,shop)/24h; 3 claims per user/1h |
| `trg_profiles_lock_username` | profiles | BEFORE UPDATE | `profiles_lock_username()` — stamps `full_name_changed_at` on first username change; raises `check_violation` on any subsequent change |
| `bus_stand_info_updated_at` | bus_stand_info | BEFORE UPDATE | `set_updated_at()` |

## Functions & RPCs

| Function | Type | Purpose |
|---|---|---|
| `set_updated_at()` | trigger fn | `NEW.updated_at = now()` |
| `generate_shop_slug(name, exclude_id)` | PLPGSQL | URL-safe slug with collision counter |
| `set_shop_slug()` | trigger fn | Auto-fill `shops.slug` |
| `has_role(uid, role)` | SECURITY DEFINER | RLS helper |
| `is_admin(uid)` | SECURITY DEFINER | Admin check helper |
| `get_shops_page(...)` | SECURITY INVOKER RPC | Paginated shops with bounded length (`clean_search` capped to 100 chars, limit 1..50, offset >= 0) |
| `increment_banner_view(id)` / `increment_banner_click(id)` | SECURITY DEFINER RPC | Anon-safe counter increments |
| `check_authority_admin_access(dept_id, city_id)` | SECURITY DEFINER | Checks multi-tenant municipal admin authorization |
| `approve_shop_claim(claim_id)` / `reject_shop_claim(claim_id)` | RPC | Moderation actions |
| `reorder_banners(ids[])` | RPC | Bulk banner priority update |

## RLS & Permissions Summary

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `categories` | Public | authenticated | authenticated | authenticated |
| `shops` | Public | authenticated | authenticated + owner-guard | authenticated |
| `shop_categories` | Public | authenticated | — | authenticated |
| `shop_engagement` | authenticated | Public (anon) | — | — |
| `shop_requests` | authenticated + submitter | Public | authenticated | authenticated |
| `schools` | Public (is_active=true) | admin | admin | admin |
| `mess_profiles` | Public | admin + owner | admin + owner | **admin + owner (SEC-02 explicit)** |
| `mess_daily_menus` | Public | admin + owner | admin + owner | **admin + owner (SEC-02 explicit)** |
| `pg_profiles` | Public | admin + owner | admin + owner | **admin + owner (SEC-02 explicit)** |
| `bus_timetable` | Public (is_active=true) | admin | admin | admin |
| `bus_stand_info` | Public | admin | admin | admin |
| `authority_departments` | Public | service_role | service_role | service_role |
| `authority_organizations` | Public | service_role | authenticated | service_role |
| `authority_announcements` | Public (active/sched) | authenticated | authenticated | authenticated |
| `announcement_locations` | Public | authenticated | authenticated | authenticated |
| `authority_admin_grants` | authenticated | service_role | service_role | service_role |
| `mcp_endpoints` | **service_role only** | **service_role only** | **service_role only** | **service_role only** |
| `banners` | Public (is_active=true) | admin | admin | admin |
| `reviews` | Public | authenticated | self (author) | self / admin |
| `geo_*` | Public | admin | admin | admin |
| `profiles` | self / admin | (signup trigger) | self | — |
| `shop_claims` | admin + own claimer | authenticated | admin | admin |

## Storage Buckets

| Bucket | Layout | Access |
|---|---|---|
| `shop-images` | `<slug>.webp` (shop), `banners/<uuid>.webp` (banners), `claims/<user_id>/<uuid>.webp` (claim proofs) | Public read; auth write; claim-proof INSERT locked to `(storage.foldername(name))[2] = auth.uid()` |
| `school-images` | `<slug>.webp` | Public read; admin-only write (via `has_role`) |
| `request-images` | `<uuid>.webp` | Public read; public INSERT |
| `banner-images` | `<uuid>.webp` | Private; admin-only |

## Schema Evolution Highlights

| Date | Patch | Summary |
|---|---|---|
| 2026-10-24 | `2026-10-24_multi_town_hierarchy.sql` | Added `geo_countries`, `geo_states`, `geo_districts`, `geo_cities`, `geo_villages` and town foreign keys |
| 2026-10-25 | `2026-10-25_add_pune_maval_parandwadi.sql` | Seeded Pune, Maval, and Parandwadi coordinates |
| 2026-10-25 | `2026-10-25_security_hardening_v2.sql` | PostgREST grants and view invoker hardenings |
| 2026-10-29 | `20261029000000_mess_and_pg_modules.sql` | Created `mess_profiles`, `mess_daily_menus`, `pg_profiles` |
| 2026-11-05 | `20261105000000_multi_image_and_entity_req.sql` | Multi-image support (`photos text[]`) across shops, requests, and schools |
| 2026-11-06 | `20261106000000_expand_school_type_check.sql` | Expanded `school_type` check constraints |
| 2026-11-08 | `2026-11-08_essential_services_schema.sql` | Added `authority_departments`, `authority_organizations`, `authority_announcements`, `announcement_locations`, `authority_admin_grants` |
| 2026-11-08 | `2026-11-08_sanitize_corrupt_translations.sql` | Cleaned corrupt translation cache entries |
| 2026-11-09 | `2026-11-09_security_hardening_v3.sql` | SEC-01 PostgREST grants for `authority_*`, SEC-02 DELETE policies on mess/pg, SEC-05 restricted `mcp_endpoints`, SEC-07 bounded `get_shops_page()` |
