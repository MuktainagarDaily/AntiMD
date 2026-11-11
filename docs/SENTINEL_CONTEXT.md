# Sentinel Context

> Written for **Sentinel**'s consumption. Use the Protected Systems Framework labels verbatim so a designation here maps 1:1 onto a deletion-safety decision Sentinel makes later.

## Critical Workflows (must not break)

1. **Visitor → ShopDetail → Call/WhatsApp** — the directory's reason to exist. Any regression in shop loading, slug routing, or tap actions is a P0.
2. **Multi-Town Resolution & Routing** (`RootCityRedirect` → `/:citySlug` → `useCity` → scoped data queries). Breaking city routing breaks all localized listings.
3. **Listing request submission** (`RequestListingModal` → `shop_requests` INSERT). The public-facing pipeline that grows the directory. Breaking the rate-limit, validation, multi-photo picker, or image upload silently kills growth.
4. **Admin request approval** (`InboxTab > Requests > Approve`) — the moderated path from staging to live. Must preserve: phone normalization, duplicate detection, category/entity resolution, and multi-image migration.
5. **Owner shop edit with concurrency guard** (`MyShop` → `updateShopWithConcurrency`). Removing the `WHERE updated_at=$2` clause silently re-introduces last-writer-wins data loss between admin and owner.
6. **Claim submission + approval** (`ClaimShopModal` → `shop_claims` → `approve_shop_claim` RPC). Bypasses $\implies$ unverified users gain `shopkeeper` role + shop write access.
7. **Living verticals: Mess & PG Directories** (`/mess`, `/pg`). Dedicated discovery modules for student and worker housing/food.
8. **Banner serve flow** with the 3-layer kill switch (`VITE_ADS_ENABLED` → `md_ads_runtime` → per-banner `is_active`). Removing any layer breaks the "ad-free demo build" use case.
9. **Marathi content overlay** (`useLocalizedShop`/`useLocalizeCategoryName`). Breaking this falls back to English silently — bilingual UX is a core promise.
10. **Customer Reviews & Ratings** (`reviewsApi.ts` + `WriteReviewModal` + `ShopReviewsSection`). User-driven trust and reputation score.

## Protected Systems

### Business Critical
- `src/pages/Home.tsx`, `Shops.tsx`, `ShopDetail.tsx` — primary discovery surfaces.
- `src/pages/Mess.tsx`, `src/pages/PG.tsx` — living vertical discovery pages.
- `src/components/ShopCard.tsx` — used by every listing surface.
- `src/components/shared/Footer.tsx` — standardized shared footer component across all views, hosting branding, links, and Vibe Forge attribution link (`https://vibe-forge.in/`).
- `src/components/shared/MultiImageCropPicker.tsx` — multi-image selection, interactive canvas cropping, and WebP compression pipeline.
- `src/components/RequestListingModal.tsx` + `src/components/ListShopModalHost.tsx` — only public ingestion path. Mounted **once** at the app root and opened via the `open-list-shop-modal` custom event; do NOT re-introduce per-page modal state, do NOT add an auth gate (the `shop_requests` public INSERT policy permits guest submissions). Renaming the event name silently breaks every trigger in the app.
- `src/pages/MyShop.tsx` + `src/lib/shopConcurrency.ts` — owner write path with optimistic-lock safety.
- `src/components/admin/layout/AdminLayout.tsx` + `src/components/admin/InboxTab.tsx` + `RequestsTab.tsx` — only moderation path. `adminNav.ts` is the sole route registry.
- `src/components/admin/CategoryMergeModal.tsx` — conflict-safe merge logic; naive rewrite would orphan or duplicate shops.
- `src/components/admin/DataQualityTab.tsx` — the only tool that recovers from data drift; deletion would leave admins blind.
- `src/lib/banners/` + `src/components/banners/` — revenue-bearing.
- `src/lib/repos/*` + `src/lib/entities/*` + `src/components/admin/_shared/EntityTab.tsx` — Entity Framework foundation.
- `src/lib/storageNaming.ts` + `src/lib/images/imageService.ts` — the only sanctioned paths for storage naming and crop $\to$ WebP $\to$ upload $\to$ cleanup.

### Architecture Critical
- `src/App.tsx` — route table, `ProtectedRoute`, `RootCityRedirect`, `CityRouteGuard`, `LegacyCityRedirect`. Changes here ripple to every page.
- `src/hooks/useCity.tsx` + `src/lib/geoService.ts` + `src/components/LocationPill.tsx` + `src/components/CityPickerModal.tsx` — multi-town regional directory state.
- `src/integrations/supabase/client.ts` — **hardcoded** URL + anon key; do not "fix" by reintroducing `import.meta.env` without coordinating with the Lovable Cloud env reset issue.
- `src/hooks/useAuth.tsx` — role-derivation logic with `setTimeout(0)` deferral to avoid auth-state deadlock; do not inline `fetchRoles` back into the listener.
- `src/i18n/index.tsx` — locale init order is load-bearing (URL $\to$ localStorage $\to$ default).
- `scripts/prerender.ts` + `scripts/generate-sitemap.ts` — bound to the `pre/postbuild` hooks; renaming or removing breaks SEO and build pipeline.
- `vite.config.ts` `@` alias — every import in the codebase depends on it.

### Security Critical
- DB trigger `shops_owner_column_guard` — second gate behind frontend whitelist; do not drop without replacing.
- DB trigger `trg_shop_claims_rate_limit` — only defence against claim spam.
- `has_role`, `is_admin` SECURITY DEFINER functions — used in RLS policies app-wide.
- Anon EXECUTE revocations on `assign_shop_owner`, `revoke_shop_owner`, `approve_shop_claim`, `reject_shop_claim`, `refresh_engagement_stats` — must persist across migrations.
- `profiles` SELECT policy (self/admin/owner-context) + `profiles_public` view — PII boundary.
- Storage policy on `request-images` and `shop-images` — enforces authenticated write or controlled anon request submission.
- "Sponsored" labels in `InlineBanner` + `BannerPopup` — editorial trust gate; removal in code review must be blocked.
- `src/lib/utils.ts > safeRelativePath()` — open-redirect guard on `?next=` parameter.
- DB trigger `trg_profiles_lock_username` + RPC `username_available` — enforce handle uniqueness and lock rules.
- `reviews_entity_user_unique` constraint — enforces single review per user per listing.

### Historical Compatibility Layer
- `shops.category_id` column — deprecated but kept for compat; do not drop without auditing all call sites.
- `shops.is_open` boolean — legacy quick-toggle; computation is the source of truth via `isShopOpen()`.
- `/admin/login` route — redirect-only shim preserved for old bookmarks.
- `external-types.ts` — single source of truth for Supabase types.

### Planned Future Systems
- `search_shops` RPC (`pg_trgm`) — implemented server-side for scaling search.
- `get_trending_shops` RPC + `shop_engagement_stats` MV + `refresh_engagement_stats` RPC — server-side trending pipeline.
- `claim_first_admin` RPC — one-shot bootstrap.

## Business Critical Features

| Feature | Why critical |
|---|---|
| Phone-call action | The directory's primary success metric |
| WhatsApp action | Equivalent to call in the local market |
| Bilingual (EN/MR) content | Trust + accessibility promise |
| Multi-town location scoping | Regional expansion engine |
| Moderation queue (requests + claims) | Editorial integrity |
| Concurrency-safe owner edit | Prevents silent data loss between admin and owner |
| Banner system with "Sponsored" labels | Revenue + editorial trust separation |
| Customer reviews and ratings | Trust building and community feedback |
| Vibe Forge attribution link | Developer partner recognition and platform verification |

## Known Dependencies

| Dependency | Used by | Impact if removed |
|---|---|---|
| `@supabase/supabase-js` | Everything | Total breakage |
| `@tanstack/react-query` | Every data-fetching surface | Cache invalidation logic dies |
| `react-router-dom` v6 | `App.tsx` + every page | Routing dies |
| `lucide-react` | All icons | UI dies visually |
| `react-hook-form` + `zod` | All admin modals + auth + request | Validation dies |
| `react-easy-crop` | `ImageCropPicker`, `MultiImageCropPicker` | Image upload UX dies |
| `fuse.js` | Search on Home + Shops | Search dies |
| `jszip` | Master Export/Import | DR pipeline dies |
| `@types/google.maps` + Google Maps key | `LocationMapPicker`, `mapsUtils` | Map picker + directions dies |
| MyMemory API | `translateApi.ts` | Bilingual content suffers |
| `react-helmet-async` | `PageSeo` everywhere | SEO meta dies |
| Supabase Realtime | `MyShop`, `Mess` | Realtime state syncing dies |
