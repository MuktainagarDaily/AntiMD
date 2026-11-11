# Database Reference

> Authoritative source: `supabase/master_schema.sql` + `supabase/migrations/*.sql` + `docs/patches/*.sql`.
> Runtime Supabase client (`src/integrations/supabase/client.ts`) uses `src/integrations/supabase/external-types.ts` (permissive table map + exact `AppRole` enum). An earlier static schema snapshot (`src/integrations/supabase/types.ts`, 21 core tables) also remains in `src/integrations/supabase/`.

## Tables — 42 live + 2 materialized views + 4 views

### Core Directory & Reviews (1–7)

| # | Table | Purpose | Key columns |
|---|---|---|---|
| 1 | `categories` | Business taxonomy | `id`, `name`, `icon` (emoji/Lucide mapping), `sort_order`, `is_active`, `updated_at` |
| 2 | `shops` | Central business listing | `id`, `name`, `category_id` (deprecated), `state_id`, `district_id`, `city_id` (→ `geo_cities`), `village_id` (→ `geo_villages`), `phone`, `whatsapp`, `address`, `area`, `sub_area`, `description`, `keywords`, `opening_time`/`closing_time` (`HH:MM`), `is_open`, `is_active`, `is_verified`, `image_url`, `photos text[]`, `image_checked_at`, `image_broken_at`, `latitude`, `longitude`, `slug` (unique), `amenities text[]`, `created_at`, `updated_at` |
| 3 | `shop_categories` | M2M shops↔categories | `id`, `shop_id`, `category_id`; UNIQUE(`shop_id`, `category_id`); CASCADE on both FKs |
| 4 | `shop_engagement` | Shop tap events | `id`, `shop_id`, `event_type` (`call`/`whatsapp`/`maps`/`directions`/`share`/`view`), `created_at` |
| 5 | `shop_requests` | Multi-entity public submissions inbox | `id`, `name`, `entity_type` CHECK(`shop`/`mess`/`pg`/`school`), `state_id`, `district_id`, `city_id`, `village_id`, `phone`, `whatsapp`, address fields, `category_text`, `description`, `keywords`, opening/closing times, lat/lng, `maps_link` (HTTP(S) CHECK), `image_url`, `photos text[]`, `meta jsonb`, `submitter_name`, `submitter_user_id`, `admin_notes`, `status` (`pending`/`approved`/`rejected`), `amenities text[]`, timestamps |
| 6 | `shop_reviews` | Customer ratings & reviews for shops | `id`, `shop_id`, `user_id`, `rating` (SMALLINT 1..5), `body`, `helpful_count`, `created_at`, `updated_at`; UNIQUE(`shop_id`, `user_id`) |
| 7 | `shop_review_helpful` | Helpful upvotes on shop reviews | `review_id`, `user_id`, `created_at`; PK(`review_id`, `user_id`) |

### Education Portal & School Owner Hub (8–14)

| # | Table | Purpose | Key columns |
|---|---|---|---|
| 8 | `schools` | Schools, colleges & coaching directory | `id`, `slug` (partial unique), `name`, `name_mr`, `state_id`, `district_id`, `city_id`, `village_id`, `school_type` CHECK(`primary`/`secondary`/`higher-secondary`/`college`/`engineering-polytechnic`/`university`/`coaching`/`other`), `medium`, `mediums text[]`, `management_type` CHECK(`government`/`govt`/`aided`/`private`/`trust`), `gender_type` CHECK(`coed`/`boys`/`girls`), `udise_aishe_code`, `established_year`, `accreditation`, `board`, `classes_offered`, `streams text[]`, `facilities text[]`, `principal_name`, `office_timing`, `admission_status` CHECK(`open`/`ongoing`/`upcoming`/`closed`/`unknown`), `admission_deadline`, `admission_url` (HTTP(S) CHECK), `prospectus_url` (HTTP(S) CHECK), `fee_tier` CHECK(`free`/`low`/`budget`/`moderate`/`premium`/`unspecified`), `annual_fee_min`, `annual_fee_max`, `scholarships text[]`, `required_documents text[]`, `transport_villages text[]`, `coaching_focus text[]`, `total_seats`, `available_seats`, `meta jsonb`, `area`, `sub_area`, `address`, `address_mr`, `phone`, `whatsapp`, `email`, `website` (HTTP(S) CHECK), `description`, `image_url`, `photos text[]`, `image_checked_at`, `image_broken_at`, `latitude`, `longitude`, `is_active`, `is_verified`, `is_claimed`, timestamps |
| 9 | `school_owners` | Verified institute owners | `id`, `school_id`, `user_id`, `role_title`, `assigned_by`, `assigned_at`; UNIQUE(`school_id`, `user_id`); `REPLICA IDENTITY FULL` |
| 10 | `school_claims` | Principal / owner claim verification queue | `id`, `school_id`, `user_id`, `contact_phone`, `role_claimed`, `udise_or_id`, `proof_type` CHECK(`udise_letter`/`govt_recognition`/`trust_registration`/`appointment_letter`/`school_board`/`aadhar_card`/`id_card`/`other`), `proof_image_path`, `note`, `status` CHECK(`pending`/`approved`/`rejected`), `admin_notes`, `reviewed_by`, `reviewed_at`, timestamps |
| 11 | `school_notices` | Live institute circulars & admission notices | `id`, `school_id`, `title`, `title_mr`, `body`, `body_mr`, `category` CHECK(`admission`/`exam`/`scholarship`/`holiday`/`event`/`achievement`/`general`), `is_pinned`, `is_active`, `expires_at`, `attachment_url` (HTTP(S) CHECK), `created_by`, timestamps |
| 12 | `school_reviews` | Parent/student reviews for institutes | `id`, `school_id`, `user_id`, `rating` (1..5), `body`, `helpful_count`, timestamps; UNIQUE(`school_id`, `user_id`) |
| 13 | `school_review_helpful` | Helpful upvotes on school reviews | `review_id`, `user_id`, `created_at`; PK(`review_id`, `user_id`) |
| 14 | `school_engagement` | Privacy-safe institute tap analytics | `id`, `school_id`, `event_type` CHECK(`call`/`whatsapp`/`website`/`maps`/`prospectus`), `created_at` |

### Living Verticals & Transit (15–19)

| # | Table | Purpose | Key columns |
|---|---|---|---|
| 15 | `mess_profiles` | Mess & dining hall profiles | `shop_id` (PK → `shops.id`), `mess_type` CHECK(`pure_veg`/`veg_nonveg`/`jain_available`), `monthly_rate`, `single_thali_rate`, `tiffin_delivery`, `lunch_timing`, `dinner_timing`, `sunday_feast`, timestamps |
| 16 | `mess_daily_menus` | Daily lunch/dinner & fixed-price menu cards | `id`, `shop_id`, `menu_date`, `lunch_text`, `dinner_text`, `photo_url`, `special_tag`, timestamps; UNIQUE(`shop_id`, `menu_date`) |
| 17 | `pg_profiles` | Paying guest & student hostel profiles | `shop_id` (PK → `shops.id`), `gender` CHECK(`boys`/`girls`/`both`), `occupancy_target` CHECK(`students`/`professionals`/`any`), `total_beds`, `available_beds`, `deposit_amount`, `notice_period_days`, `gate_closing_time`, `food_included`, `amenities text[]`, `sharing_rates jsonb` (`1..4_sharing` & `rooms`), `vacancies_updated_at`, timestamps |
| 18 | `bus_timetable` | Daily MSRTC & PMPML departures | `id`, `city_id`, `destination`, `destination_mr`, `depot`, `departure_times text[]`, `via_stops text[]`, `bus_type`, `platform_number`, `notes`, `is_active`, `sort_order`, timestamps |
| 19 | `bus_stand_info` | Bus stand contact & GPS location | `id` (CHECK `id=1`), `city_id`, `phone`, `address`, `maps_url`, timestamps |

### Local News & Aggregation (20–21)

| # | Table | Purpose | Key columns |
|---|---|---|---|
| 20 | `news_sources` | Town-scoped RSS/Atom & webpage news sources | `id`, `city_id`, `name`, `source_type` CHECK(`rss`/`webpage`), `url`, `language` CHECK(`mr`/`en`/`hi`), `category_default`, `is_active`, `last_scraped_at`, `last_status`, timestamps; UNIQUE(`city_id`, `url`) |
| 21 | `local_news` | Dated town news feed & pinned headlines | `id`, `city_id`, `village_id`, `source_id`, `title`, `title_mr`, `summary`, `summary_mr`, `category` CHECK(`local`/`civic`/`education`/`agriculture`/`markets`/`sports`/`alerts`), `language` CHECK(`mr`/`en`/`hi`), `source_name`, `source_url`, `image_url`, `published_at`, `scraped_at`, `is_pinned`, `is_active`, timestamps; UNIQUE(`city_id`, `source_url`) |

### Essential Services & Civic Authorities (22–26)

| # | Table | Purpose | Key columns |
|---|---|---|---|
| 22 | `authority_departments` | Municipal & civic department taxonomy | `id`, `slug` (`water`, `electricity`, `municipal`, …), `name`, `name_mr`, `icon`, `color_theme`, `sort_order`, `is_active`, `created_at` |
| 23 | `authority_organizations` | Administrative offices & helplines | `id`, `department_ids uuid[]`, `city_id`, `district_id`, `name`, `name_mr`, `office_address`, `maps_url`, `visiting_hours`, `helpline_phone`, `emergency_phone`, `whatsapp_number`, `email`, `key_contacts jsonb`, `is_demo`, `is_verified`, `is_active`, timestamps |
| 24 | `authority_announcements` | Service notices & outage broadcasts | `id`, `org_id`, `department_id`, `city_id`, `title`, `title_mr`, `description`, `description_mr`, `category`, `priority`, `status`, `start_time`, `end_time`, `published_at`, `media_urls text[]`, `is_demo`, `created_by`, timestamps |
| 25 | `announcement_locations` | Affected localities per announcement | `id`, `announcement_id`, `city_id`, `village_id`, `area_text`, `created_at` |
| 26 | `authority_admin_grants` | Scoped department/town officer access | `id`, `user_id`, `department_id`, `city_id`, `granted_by`, `created_at`; UNIQUE(`user_id`, `department_id`, `city_id`) |

### Geographic Hierarchy (27–31)

| # | Table | Purpose | Key columns |
|---|---|---|---|
| 27 | `geo_countries` | Country boundary | `id`, `code` (`IN`), `name`, `is_active`, timestamps |
| 28 | `geo_states` | States / UTs | `id`, `country_id`, `code` (`MH`), `name`, `name_mr`, `is_active`, timestamps |
| 29 | `geo_districts` | Administrative districts | `id`, `state_id`, `slug` (`jalgaon`, `pune`), `name`, `name_mr`, `is_active`, timestamps |
| 30 | `geo_cities` | Towns, talukas & cities | `id`, `district_id`, `slug` (`muktainagar`, `bhusawal`, `varangaon`, `bodwad`, `parandwadi`), `name`, `name_mr`, `latitude`, `longitude`, `is_active`, timestamps |
| 31 | `geo_villages` | Satellite villages & localities | `id`, `city_id`, `slug` (`kurha`, `changdev`, `parandwadi`), `name`, `name_mr`, `latitude`, `longitude`, `is_active`, timestamps |

### Auth, Profiles & Shop Ownership (32–36)

| # | Table | Purpose | Key columns |
|---|---|---|---|
| 32 | `profiles` | Extended user profile | `id` (→ `auth.users`), `full_name` (unique `@username`), `email`, `locale`, `phone`, `birth_date`, `gender`, `city_id`, `village_id`, `full_name_changed_at`, `created_at` |
| 33 | `user_roles` | RBAC roles | `id`, `user_id`, `role` (`app_role`: `'admin'`, `'shopkeeper'`, `'user'`) |
| 34 | `shop_owners` | Verified shop ownership | `id`, `shop_id`, `user_id`; `REPLICA IDENTITY FULL` |
| 35 | `shop_claims` | Shop ownership verification queue | `id`, `shop_id`, `user_id`, `status` CHECK(`pending`/`approved`/`rejected`), `proof_type`, `proof_image_path`, `admin_notes`, timestamps |
| 36 | `shop_bookmarks` | Saved user bookmarks | `id`, `user_id`, `shop_id`; UNIQUE; `created_at` |

### i18n & Translation Cache (37–40)

| # | Table | Purpose | Key columns |
|---|---|---|---|
| 37 | `shop_translations` | Per-shop Marathi content | UNIQUE(`shop_id`, `locale`); translated name, area, address, description |
| 38 | `category_translations` | Localized category names | `id`, `category_id`, `locale`, `name` |
| 39 | `amenity_translations` | Localized amenity labels | `id`, `amenity_key`, `locale`, `label` |
| 40 | `translation_cache` | Shared MyMemory translation cache | `direction`, `source_text`, `translated`, `hit_count`, `last_used_at` |

### Banners & Integrations (41–42)

| # | Table | Purpose | Key columns |
|---|---|---|---|
| 41 | `banners` | 8-placement multi-town ad system | `id`, `target_level` CHECK(`all`/`district`/`city`), `target_district_id`, `target_city_id`, `city_id` (legacy), `title`, `image_url`, `target_url` (HTTP(S) CHECK), `image_checked_at`, `image_broken_at`, `placement`, `is_active`, `popup_delay_seconds`, `close_enable_seconds`, `start_date`, `end_date`, `view_count`, `click_count`, `sort_order`, timestamps |
| 42 | `mcp_endpoints` | External MCP server registry | `id`, `name`, `url`, `auth_type`, `credential_ref`, `environment`, `notes`, `is_enabled`, timestamps (`service_role` / admin only) |

**Banner placements (8):** `popup`, `homepage_inline`, `shops_inline`, `category_inline`, `shops_infeed`, `shop_detail_inline`, `home_bottom`, `saved_inline`.

## Views & Materialized Views

| View / MV | Type | Purpose | Security |
|---|---|---|---|
| `shops_with_claim` | View | Shops + `is_claimed` flag | `security_invoker = on` (caller RLS) |
| `profiles_public` | View | Safe `(id, full_name)` projection for anon reads | `security_invoker = on` |
| `shops_list_public` | View | Slim projection of `is_active` shops for initial list render | `security_invoker = on`; SELECT granted to `anon`, `authenticated` |
| `shops_search_public` | View | Search sidecar view with searchable text fields | `security_invoker = on`; SELECT granted to `anon`, `authenticated` |
| `shop_engagement_stats` | **Materialized View** | Calls/WA/total engagement per shop over last 30 days | Locked from public Data API; refreshed via `refresh_engagement_stats()` |
| `category_shop_counts` | **Materialized View** | Active `(category_id, shop_count)` counts; refreshed by triggers on `shops` & `shop_categories` | Not directly exposed; served via `get_category_shop_counts()` |

## Triggers

| Trigger | Table | When | Purpose |
|---|---|---|---|
| `set_updated_at()` triggers | `shops`, `categories`, `shop_requests`, `profiles`, `shop_claims`, `authority_*`, `bus_stand_info`, `news_sources`, `local_news`, `school_claims`, `school_notices`, `school_reviews` | BEFORE UPDATE | Maintain `updated_at = now()` |
| `trg_shop_slug` | `shops` | BEFORE INSERT/UPDATE | `set_shop_slug()` auto-slug with collision suffix |
| `trg_schools_auto_slug` | `schools` | BEFORE INSERT | `schools_auto_slug()` unique slug generation |
| `trg_school_owners_sync_claimed` | `school_owners` | AFTER INSERT/DELETE | `sync_school_is_claimed()` keeps `schools.is_claimed` synchronized |
| `shops_owner_column_guard` | `shops` | BEFORE UPDATE | Blocks non-admins from changing `is_verified`, `is_active`, `slug`, `category_id` |
| `trg_protect_school_admin_columns` | `schools` | BEFORE UPDATE | Blocks non-admins from changing `is_active`, `is_verified`, `is_claimed`, `city_id`, `district_id`, `state_id`, `slug`, or verified `udise_aishe_code` |
| `trg_shop_claims_rate_limit` | `shop_claims` | BEFORE INSERT | Max 1 pending/(user,shop), 3/24h/(user,shop), 3/1h/user |
| `trg_school_claims_rate_limit` | `school_claims` | BEFORE INSERT | Max 1 pending/(user,school), 5 pending total per user |
| `trg_school_reviews_rate_limit` | `school_reviews` | BEFORE INSERT | Max 5 school reviews per 24h per user (admins exempt) |
| `trg_school_review_helpful_ins` / `del` | `school_review_helpful` | AFTER INSERT/DELETE | Sync `school_reviews.helpful_count` |
| `trg_school_engagement_rate_limit` | `school_engagement` | BEFORE INSERT | Max 20 anon inserts per `(school_id, event_type)` per minute |
| `shop_engagement_rate_limit_check` | `shop_engagement` | BEFORE INSERT | Max 20 anon inserts per `(shop_id, event_type)` per minute |
| `shop_requests_rate_limit_check` | `shop_requests` | BEFORE INSERT | Max 10 unauthenticated requests per hour |
| `trg_profiles_lock_username` | `profiles` | BEFORE UPDATE | One-time editable `@username` lock |

## Key Functions & RPCs

| Function | Type | Purpose |
|---|---|---|
| `has_role(uid, role)` / `is_admin(uid)` | `SECURITY DEFINER` | Role checks inside RLS policies & guards |
| `is_shop_owner(shop_id, user_id)` / `is_school_owner(user_id, school_id)` | `SECURITY DEFINER` | Ownership checks for RLS & portals |
| `approve_shop_claim(_claim_id)` / `reject_shop_claim(_claim_id, _notes)` | Admin RPC | Moderates shop claims; anon EXECUTE revoked |
| `assign_shop_owner` / `revoke_shop_owner` | Admin RPC | Grants/revokes shop ownership (`revoke_shop_owner` preserves `shopkeeper` if user still owns a school) |
| `approve_school_claim(_claim_id)` / `reject_school_claim(_claim_id, _notes)` | Admin RPC | Moderates school claims and promotes `school_owners` + `shopkeeper` role |
| `assign_school_owner(_school_id, _user_id, _role_title)` / `revoke_school_owner` | Admin RPC | Grants/revokes institute ownership cleanly alongside `shop_owners` |
| `get_shop_rating(_shop_id)` / `get_school_rating(_school_id)` / `get_schools_rating_summary(_school_ids)` | Public SQL/RPC | Rating average, review count, and 5-to-1 histogram distribution |
| `get_shops_page(...)` | `SECURITY INVOKER` RPC | Paginated shops (`clean_search <= 100`, `p_limit 1..50`, `p_offset >= 0`) |
| `increment_banner_view(id)` / `increment_banner_click(id)` / `reorder_banners(ids[])` | RPCs | Anon-safe ad tracking & admin reordering |
| `get_system_health_snapshot()` | Admin `SECURITY DEFINER` RPC | Inspects `image_broken_at` columns, `storage.objects` root listing fix state, `category_shop_counts` MV drift, and live row/pending counts |
| `refresh_category_shop_counts()` / `refresh_engagement_stats()` | Maintenance RPCs | Refreshes materialized views |

## RLS & Storage Summary

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `shops` / `categories` / `shop_categories` | Public (active) | authenticated | authenticated + owner guard | admin/authenticated |
| `schools` | Public (`is_active=true`) + own school owners + admin | admin | admin + owned school owners (`protect_school_admin_columns`) | admin |
| `school_owners` / `school_claims` | Own + admin | authenticated (`status='pending'` for claims) | admin | admin |
| `school_notices` | Active notices on active schools + owners + admin | admin + school owner | admin + school owner | admin + school owner |
| `school_reviews` / `shop_reviews` | Public | authenticated | own row | own row (/ admin) |
| `school_review_helpful` / `shop_review_helpful` | own row (school) / public (shop) | authenticated (`auth.uid()=user_id`) | — | own row |
| `shop_engagement` / `school_engagement` | admin (+ school owner for `school_engagement`) | Public (`anon` rate-limited + `authenticated`) | — | — |
| `mess_profiles` / `mess_daily_menus` / `pg_profiles` | Public | admin + owner | admin + owner | admin + owner |
| `news_sources` | admin | admin | admin | admin |
| `local_news` | Public (`is_active=true`) + admin | admin | admin | admin |
| `authority_*` / `announcement_locations` | Public (active) | admin / scoped grants | authenticated / scoped | admin / scoped |
| `mcp_endpoints` | `service_role` / admin | `service_role` / admin | `service_role` / admin | `service_role` / admin |

### Storage Buckets (`storage.objects`)
- **`shop-images`:** Public read across all non-claim objects via `((storage.foldername(name))[1] IS DISTINCT FROM 'claims')` (critical SQL fix enabling root `.list('')` enumeration without 409 collisions); authenticated upload; admin full policy (`Admins manage all shop-images`); `claims/<user_id>/...` protected via user folder rules & signed URLs.
- **`school-images`:** Public read; admin & verified institute owner write.
- **`request-images`:** Public read; public INSERT for 4-step listing submissions.
- **`banner-images`:** Dedicated promotional creative bucket (admin-managed).

## Schema Evolution Highlights

| Date | Migration / Patch | Summary |
|---|---|---|
| 2026-10-24 | `2026-10-24_multi_town_hierarchy.sql` | Added `geo_*` 5-tier tables & city/village FKs |
| 2026-10-25 | `2026-10-25_add_pune_maval_parandwadi.sql` | Seeded Pune, Maval, and Parandwadi |
| 2026-10-29 | `20261029000000_mess_and_pg_modules.sql` | Created `mess_profiles`, `mess_daily_menus`, `pg_profiles` |
| 2026-11-05 | `20261105000000_multi_image_and_entity_meta.sql` | Added `photos text[]` and multi-entity `shop_requests.meta` |
| 2026-11-06 | `20261106000000_expand_school_type_check.sql` | Expanded `schools.school_type` to higher education & coaching |
| 2026-11-08 | `2026-11-08_essential_services_schema.sql` | Added `authority_*` & `announcement_locations` tables |
| 2026-11-09 | `2026-11-09_security_hardening_v3.sql` | PostgREST grants, Mess/PG DELETE policies, `mcp_endpoints` restriction, bounded `get_shops_page()` |
| 2026-11-09 | `2026-11-09_seed_maval_parandwadi_reviews.sql` | Demo seed for Maval/Parandwadi listings & reviews |
| 2026-11-11 | `20261111000000_local_news_module.sql` | Added `news_sources` & `local_news` with URL deduplication & RLS |
| 2026-11-12 | `20261112000000_education_portal_and_owner_hub.sql` | Expanded `schools` (~30 cols), added `school_owners`, `school_claims`, `school_notices`, `school_reviews`, `school_review_helpful`, `school_engagement`, triggers & RPCs |
| 2026-11-12 | `2026-11-12_seed_education_notices_reviews.sql` *(docs patch)* | Optional idempotent seed for demo school notices & bilingual institute reviews |
| 2026-11-13 | `20261113000000_storage_and_health_fixes.sql` | Fixed `storage.objects` root listing (`IS DISTINCT FROM 'claims'`), added `image_checked_at`/`image_broken_at` on `shops`/`schools`/`banners`, added `get_system_health_snapshot()` RPC |
