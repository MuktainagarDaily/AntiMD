# Workflows

> For each flow: **entry → steps → data touched → exit**.

## Multi-Town Location Selection & Routing

**Entry:** Top header `LocationPill` or root URL `/`.

**Steps:**
1. First visit to `/` triggers `RootCityRedirect` (or reads `localStorage['active_city_slug']`), falling back to default town (`muktainagar`) $\to$ `/muktainagar`.
2. Any legacy flat route (`/shops`, `/categories`, etc.) is intercepted by `LegacyCityRedirect` and rerouted to `/:activeCitySlug/...`.
3. User taps `LocationPill` in the header $\to$ opens `CityPickerModal`.
4. Modal queries `geoService.getCities()` (filtered to `is_active = true`) with search bar and district groupings.
5. On city selection: `CityContext.selectCity(citySlug)` writes to `localStorage['active_city_slug']` and triggers client-side redirect updating URL prefix to `/:citySlug/...`.
6. All scoped queries (`useShops`, `useCategories`, `useMess`, `usePG`, `useSchools`) automatically invalidate and re-fetch for the new `city_id`.

**Data touched:** `geo_cities`, `localStorage['active_city_slug']`, React Router navigation state.

**Exit:** Directory re-renders with listings localized to the newly selected town.

---

## Visitor Browse

**Entry:** `/:citySlug/` (Home) or category/search link.

**Steps:**
1. Home loads `shops_with_claim` (scoped by `city_id` and `is_active=true`) + `categories`.
2. User searches (debounce 250 ms, Fuse.js EN+MR) $\to$ autocomplete suggestions.
3. Pick category / search hit $\to$ `/:citySlug/shops?category=...` or `/:citySlug/shop/<slug>`.
4. Shops page applies URL-persistent filters in-memory; paginates 10/page; auto-refreshes open/closed every 60 s.
5. Shop detail page loads shop + categories + photos + claim status + ratings/reviews + ownership; **Related Shops** strip queries other active shops in the **same city** (`shops.city_id`), sorting same-village shops first (`village_id` match) followed by town-wide competitors, capped at 12 items. If no local competitors exist, the section is completely omitted from the DOM.
6. Action: Call / WhatsApp / Maps / Share / Bookmark / Claim / Write Review.

**Data touched:** `shops_with_claim`, `categories`, `shop_categories`, `reviews`, `shop_engagement` (INSERT on tap), `shop_bookmarks` (if bookmark), `shop_is_claimed` RPC, `shop_owners` (if signed in).

**Exit:** tel/wa.me/maps link, back-nav, or modal opens.

---

## Visitor → Listing Request → Published Entity (Multi-Entity)

**Entry:** UserMenuDrawer $\to$ "List a Shop / Business" $\to$ `RequestListingModal`.

**Steps:**
1. If not signed in: `sessionStorage` flag + `/auth` $\to$ after sign-in, modal auto-reopens via custom event `open-list-shop-modal`.
2. User selects **Entity Type**: Shop/Business, Mess & Dining, PG & Hostel, or School/Institute.
3. Form fields adapt:
   - Core: name, phone, WhatsApp, full address, city/area selection, latitude/longitude pin.
   - Photos: `MultiImageCropPicker` allows selecting up to 5 photos, cropping with interactive canvas, and compressing to modern WebP.
   - Mess-specific: meal types (lunch/dinner), monthly rate, pure-veg toggle.
   - PG-specific: occupancy types (single/double/triple), monthly rent, gender rules, amenities.
   - School-specific: school type, standards/grades offered, medium of instruction.
4. Zod validation + 3 s submit cooldown.
5. Images upload to `request-images` bucket.
6. Row inserted into `shop_requests` (`status='pending'`, `entity_type`, `meta` JSONB, `photos: text[]`, `submitter_user_id`).
7. Admin opens `/admin/directory/inbox` $\to$ `RequestsTab`.
8. Admin inspects entity type badge, preview photos, and metadata:
   - Normalizes phone $\to$ duplicate check against existing directory.
   - Approves request $\to$ converts to live row in `shops`, `mess_profiles`, `pg_profiles`, or `schools`.
   - Storage images copied/renamed to permanent bucket (`shop-images` or `school-images`).
   - `shop_requests.status` updated to `'approved'`.
9. Submitter sees status update in `/my-shop` or notifications.

**Data touched:** `shop_requests`, `shops`, `mess_profiles`, `pg_profiles`, `schools`, `storage.objects` (`request-images`, `shop-images`).

**Exit:** Real listing appears in town directory; submitter notified.

---

## Mess & Dining Discovery & Daily Menus

**Entry:** `/:citySlug/mess`

**Steps:**
1. Visitors browse active mess listings filtered by the active `city_id`.
2. Quick filters: Pure Veg, Monthly Price range, Lunch/Dinner timings.
3. Daily Menu card highlights today's lunch and dinner items (fetched from `mess_daily_menus WHERE menu_date = CURRENT_DATE`).
4. Detail view shows full photo gallery, meal pricing, weekly menu schedule, and direct phone/WhatsApp calling.
5. Mess owners (authenticated via `/my-shop` or dedicated mess owner portal) can update today's menu in seconds without changing core profile details.

**Data touched:** `mess_profiles`, `mess_daily_menus`, `geo_cities`.

**Exit:** Direct call / WhatsApp order / physical navigation.

---

## PG & Hostels Discovery & Accommodation Inquiries

**Entry:** `/:citySlug/pg`

**Steps:**
1. Visitors browse student and professional housing listings in the active town.
2. Filters: Gender preference (Boys, Girls, Co-ed), Room sharing type (Single, Double, Triple), Budget range, Amenities (Wi-Fi, Food included, AC, CCTV, Power backup).
3. PG cards display vacancy badges, monthly rent, deposit requirements, and thumbnail photos.
4. Detail view displays multi-image photo gallery, house rules, gate closing time, and direct owner contact buttons.

**Data touched:** `pg_profiles`, `geo_cities`.

**Exit:** Phone call or WhatsApp inquiry with room vacancy confirmation.

---

## Customer Reviews & Ratings Submission

**Entry:** Shop detail page (`ShopReviewsSection` $\to$ "Write a Review" button).

**Steps:**
1. Check authentication: If anonymous, toast alert prompts user to sign in via Auth modal.
2. `WriteReviewModal` displays interactive star rating picker (1 to 5 stars via `RatingInput`).
3. User enters review title and detailed review text.
4. On submit: Upserts into `reviews` table (`user_id`, `entity_type='shop'`, `entity_id=shop.id`, `rating`, `comment`).
5. DB unique constraint `reviews_entity_user_unique` ensures one review per user per listing (edits overwrite previous review).
6. Local cache is invalidated; aggregate score (`RatingBadge`, `RatingBreakdown`) updates in real-time.

**Data touched:** `reviews`, `profiles_public`.

**Exit:** Review displays publicly in `ShopReviewsSection` with user name and relative timestamp.

---

## User → Claim → Owner Access

**Entry:** ShopDetail "Claim this shop" button (or `?claim=1` deep-link).

**Steps:**
1. `ClaimShopModal` checks existing claim; if pending/approved, blocks resubmit.
2. User enters phone (pre-filled from `profiles.phone`) + optional note.
3. INSERT `shop_claims` $\to$ `trg_shop_claims_rate_limit` trigger enforces (1 pending/shop/user, 3/shop/user/24h, 3/user/1h).
4. Admin reviews in `/admin/directory/inbox` $\to$ `Claims`; sees claimant name, contact phone, shop's on-record phone.
5. Admin clicks **Approve** $\to$ `approve_shop_claim` RPC $\to$ inserts `shop_owners` + grants `user_roles.role='shopkeeper'` + marks claim approved.
6. Owner refreshes `/my-shop` $\to$ listing now editable.

**Data touched:** `shop_claims`, `shop_owners`, `user_roles`, `profiles`.

**Exit:** Shopkeeper accesses MyShop editor.

---

## Owner Shop Edit

**Entry:** `/my-shop` (shop switcher if >1 owned).

**Steps:**
1. Load shop via `shop_owners` $\to$ `shops`; subscribe to realtime channel `postgres_changes` on the shop row.
2. Editor renders form; dirty tracking triggers sticky save bar.
3. Open/Closed quick-toggle saves immediately via `updateShopWithConcurrency`.
4. Multi-image management: Add, reorder, or delete photos via `MultiImageCropPicker`. Image deletions queued in `pendingImageDeletionsRef`.
5. Save: validate phone/WA $\to$ upload new images $\to$ `UPDATE shops … WHERE id=$1 AND updated_at=$2 RETURNING *` (concurrency guard) $\to$ if zero rows returned $\implies$ conflict $\implies$ rollback optimistic state, show server values.
6. On success: cleanup `pendingImageDeletions` from storage.

**Data touched:** `shops`, `storage.objects` (`shop-images`).

**Exit:** Save bar disappears; preview sheet available.

---

## Admin Login + Modular Hub Dashboard

**Entry:** `/admin/login` (or `/admin` directly) $\to$ `/auth` if not signed in.

**Steps:**
1. Sign in $\to$ `useAuth.fetchRoles` $\to$ `user_roles.role` array populated.
2. `ProtectedRoute requireRole="admin"` verifies `isAdmin` after roles resolve.
3. `AdminLayout` mounts with responsive `AdminSidebar` and top status header.
4. Routes are organized into Hubs (`Overview`, `Directory`, `Sections`, `Marketing`, `Insights`, `System`) with `BranchTabs` for sub-navigation.
5. Navigation between directory leaves (`Shops`, `Mess`, `PG`, `Categories`, `Inbox`) preserves fast cached state via TanStack Query.

**Exit:** Explicit sidebar navigation, sub-branch switching, or sign-out.

---

## Banner Management & Multi-Town Geo-Targeting

**Entry:** `/admin/marketing/ads`.

**Steps:**
1. Admin clicks **New banner** $\to$ `BannerModal` (title, image crop+upload to `banners/<uuid>.webp`, target URL, town target selection ["All Towns (Global)" or specific city], placement across 8 slots, popup-specific timings, date range, active toggle, live preview).
2. INSERT `banners` with `target_level`, `target_district_id`, `target_city_id`.
3. In `AdvertisementsTab`, each banner row displays a location badge ("Muktainagar", "Maval", or "All Towns").
4. Drag-reorder within placement $\to$ `reorder_banners(_ids)` RPC.
5. Toggle individual `is_active` per banner.
6. Bulk pause/resume $\to$ `setAllBannersActive(false/true)` mass UPDATE.
7. Runtime override: "Hide ads for me" local toggle writes to `localStorage['md_ads_runtime']=0`, hiding ads for *this admin only* during audits without affecting public citizens.

**Public serve flow:**
1. `BannerSlot(placement, fallback?)` calls `useBannersForPlacement`.
2. Checks `adsEnabled() = buildFlag() && runtimeAdsEnabled()`.
3. SELECT `banners WHERE is_active=true AND today BETWEEN start_date AND end_date`.
4. Filters by town: matches global banners (`target_level='all'`) or town-targeted banners matching `currentCity.id` (`target_city_id` or legacy `city_id`).
5. Filters to placement (or fallback if empty); per-route dedupe.
6. `InlineBanner` mounts $\to$ Intersection Observer (40% threshold) $\to$ `increment_banner_view` RPC.
7. Click $\to$ `increment_banner_click` RPC + open `target_url`.

**Popup-specific:**
- Gate: `!wasPopupSeenToday && !wasPopupShownThisSession`.
- Timer: `max(20s, popup_delay_seconds)` + scroll depth $\ge$ 30% or 600 px.
- Close button disabled for `close_enable_seconds` countdown.
- On show: `markPopupSeen` (localStorage 7-day TTL) + `increment_banner_view`.

**Data touched:** `banners`, `storage.objects` (`banners/`).

---

## Analytics & Insights

**Entry:** `/admin/insights/analytics`.

**Steps:**
1. SELECT up to 5000 rows from `shop_engagement` for chosen window (7d/30d/all).
2. Aggregate client-side: totals, top shops (by total/calls/WA), top categories (joined via `shop_categories`).
3. CSV export for current period; CSV import via `AnalyticsCsvImportModal`.

**Data touched:** `shop_engagement`, `shops`, `shop_categories`, `categories`.

---

## CSV Import (Shops)

**Entry:** `/admin/system/data` $\to$ `CsvImportModal` (or `DirectoryShops > Import CSV`).

**Steps:**
1. Parse `.csv` (`csvUtils.parseCsv`).
2. Validate per row: phone normalize+verify; category resolve by name; amenities pipe-split + dedup + cap 12; lat/lng parse; duplicate phone check vs existing shops.
3. Preview table (ready / warning / error / duplicate per row).
4. Import: errors + duplicates skipped by default; warnings imported with note.

**Data touched:** `shops`, `categories`, `shop_categories`.

---

## Category Merge

**Entry:** `/admin/directory/categories` (GitMerge icon shown only when `shopCount > 0`).

**Steps:**
1. Pick target category (excludes self) + optional "disable source after merge" (default on).
2. Fetch source `shop_categories.shop_id[]` and target `shop_id[]`.
3. Compute `toReassign = source \ target`, `toDelete = source ∩ target` (would-be-duplicate links).
4. DELETE all source `shop_categories` rows.
5. INSERT `toReassign` rows with `category_id = target`.
6. Optional `UPDATE categories SET is_active=false` for source.
7. Invalidate caches.

**Safety:** No shop orphaned; no duplicates created; admin sees shop-count preview before commit.

**Data touched:** `shop_categories`, `categories`.

---

## Auth Lifecycle

**Sign-up:** `supabase.auth.signUp` $\to$ email confirm $\to$ DB trigger inserts `profiles` row $\to$ first registered user can call `claim_first_admin` RPC.

**Sign-in:** `signInWithPassword` $\to$ `AuthProvider.onAuthStateChange` $\to$ `fetchRoles(userId)` (deferred via `setTimeout(0)` to avoid deadlock) $\to$ defaults to `['user']` on error.

**Password reset:** `/auth?mode=forgot` $\to$ `resetPasswordForEmail` $\to$ email link $\to$ `/reset-password` $\to$ `updateUser({password})`.

**Role grants:**
- `shopkeeper`: via `approve_shop_claim` or `assign_shop_owner` RPCs.
- `admin`: via `claim_first_admin` RPC (one-shot) or migration seed (`the seeded admin account`).

---

## Bookmark / SavedShops

**Bookmark toggle:** `BookmarkButton` $\to$ if anon, toast + `/auth?next=…`; else INSERT/DELETE `shop_bookmarks`; invalidate `['saved-shops', userId]`.

**SavedShops page:** SELECT `shop_bookmarks ORDER BY created_at DESC` $\to$ SELECT `shops IN (ids)` $\to$ preserve bookmark order (Map sort); search/sort/bulk-remove.

---

## Essential Services & Civic Authorities

**Entry:** Top header pill or direct path `/:citySlug/services`.

**Steps:**
1. Loads `authority_departments` and `authority_organizations` for active town.
2. Citizen filters by department (Water, Electricity, Municipal Council, Police, Health).
3. Active broadcasts & outage announcements render at top with severity banners (Critical, High, Medium, Low) and scheduled restoration times.
4. Tapping **Emergency Helpline** launches `tel:` dialer. Tapping **Location** launches GPS navigation to civic office.
5. Officer roster displays designated departmental heads and visiting hours.
6. **Security & Privacy:** Officer contact lists are cached strictly in-memory during the browser session, with zero unencrypted PII written to persistent `localStorage`.

---

## Marathi Translation Pipeline & Quota Management

**Inline (per shop, admin):** `MarathiMirrorField` for manual Devanagari entry; `TranslateAllButton` batch-translates EN fields via `translateEnToMr` $\to$ MyMemory API (cached 3-tier: memory $\to$ `localStorage` $\to$ `translation_cache` table).

**Bulk backfill (admin):** `/admin/system/marathi` (`MarathiBackfillModal`):
1. Scans for shops, categories, and schools with missing `mr` entries (`shop_translations`, `category_translations`, `schools.name_mr`, `schools.address_mr`).
2. Displays 3 distinct progress counters: Categories, Shops, and Schools to fill.
3. Unlocks the 50,000 char/day registered tier via `&de=admin@muktainagardaily.com`.
4. Throttle pacing: runs 2 concurrent worker streams with a 100ms pause between translations to prevent rate limits.
5. Defensive validation: rejects any MyMemory warning leakage strings or repeated identical source text.
6. Safe early stop via `cancelRef.current = true`. **Never overwrites existing translations.**

**User read:** `useLocalizedShop(rawShop)` overlays `mr` translation values when `locale === 'mr'`. `useLocalizeCategoryName(id, fallback)` returns localized name.
