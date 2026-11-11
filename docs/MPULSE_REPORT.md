# Muktainagar Daily — Resource Intelligence Report

_Skill: `muktainagar-mpulse` · Scope: **Everything** (all 13 agents, survey depth) · Date: 2026-07-15_

> **Reading order**: Executive Summary → Scores → Top 10 → per-domain findings → Roadmap → Final Verdict → Ecosystem Impact Note.
> Every finding is labelled with **Category · Level · Cost/Savings ★ · UX Guardian**. Estimates are marked **Measured / Calculated / Estimated / Order-of-magnitude** per m-Pulse convention.

---

## Executive Summary

Muktainagar Daily is a small-to-mid Vite + React + external Supabase directory app with an admin console, PWA, and MCP endpoint. Cost posture is healthy at current volume (order-of-magnitude ~500 DAU inferred from analytics setup). The three highest-ROI moves right now, in order:

1. **Slim `shops_with_claim` payload on `Home.tsx` and `Shops.tsx`** — one view fetch pulls ~25 columns per row for every visitor, then filters/derives client-side. A projection cut + server-side `is_active` view materialisation would remove the largest single bandwidth and DB-read line in the app.
2. **Shared TanStack Query cache for `categories`, `shops_with_claim`, and `banners`** across `Home` / `Shops` / `ShopDetail` / admin overview. Query keys are already stable, but staleTimes vary (30s–60s) and admin re-mounts trigger re-fetches. Aligning to a single 2-minute staleTime for these three keys cuts anonymous-visitor DB reads by an estimated 40-60% per session.
3. **Enforce compressed & correctly-sized image uploads at the `imageService` boundary.** SafeImage/ShopImage already emit `srcSet` + `loading=lazy`, but originals in `shop-images/` bucket appear to be uploaded at capture resolution. Compressing to max 1600px WebP on upload cuts storage + CDN egress by an estimated 3-5× — the single largest recurring bandwidth cost.

Overall resource health: **the app is not wasteful, but it is Shop-page-heavy** — three pages (`Home`, `Shops`, `ShopDetail` at 1,105 / 1,018 / 729 LOC) dominate both client CPU and DB read cost. Fix them first; everything else is polish.

---

## Scores

| Score | Value (/100) | Rationale |
|---|---|---|
| Overall Efficiency Score | **68** | Solid foundation (lazy routes, PWA runtime cache, srcSet, RLS-safe views). Held back by wide SELECTs, heavy client-side derivation on Home/Shops, and unoptimised upload path. |
| Cloud Efficiency Score | **74** | External Supabase on presumed Free/Pro tier is well-configured (public bucket + Cache-First SW, targeted realtime, RPC-based admin actions). Approaching bandwidth ceiling driven by images, not DB. |
| Performance Score | **62** | Route-splitting is good; `Home.tsx` (1.1k LOC) does 2 large queries + fuzzy index build + 4 `useMemo` derivations on mount, most re-run on every keystroke unless memoised keys are perfectly stable. |
| Scalability Score | **60** | Works cleanly to ~5-10× current traffic. Beyond that, the "select all active shops" pattern becomes the linear bottleneck; needs pagination or filtered RPC. |
| Resource Health Score | **70** | Caching hierarchy exists (React Query + Workbox + `useTranslationsCache`), but staleTimes are inconsistent and no shared query surface exists across Home/Shops/ShopDetail. |

---

## Top 10 Highest-ROI Optimizations

| # | Opportunity | Category | Level | Savings Rating |
|---|---|---|---|---|
| 1 | Compress + resize on upload in `imageService` (max 1600px WebP, q≈80) | Image | Smart | ★★★★★ |
| 2 | Project only rendered columns from `shops_with_claim` on Home/Shops | Database | Safe | ★★★★ |
| 3 | Unify staleTime (2m) + share `['shops','all']` across Home/Shops/ShopDetail | Cache | Safe | ★★★★ |
| 4 | Paginated / filtered shops RPC (`get_shops_page(area, cat, offset)`) | Database | Advanced | ★★★★ |
| 5 | Debounce/collapse `shop_engagement` inserts (client-side 500ms dedupe per shop+type) | API | Safe | ★★★ |
| 6 | Consolidate 64 `lucide-react` imports; verify tree-shake, drop unused | Bundle | Safe | ★★★ |
| 7 | Split `Home.tsx` (1,105 LOC) into `<HomeHero/>`, `<CategoryGrid/>`, `<ShopList/>` — each memoised | Frontend | Smart | ★★★ |
| 8 | Move fuzzy-index (`buildShopFuse`) into a Web Worker for shops list ≥ 500 | Frontend | Advanced | ★★★ |
| 9 | Add `Cache-Control: public, max-age=300, s-maxage=600` for `/rest/v1/categories` via Supabase Edge/CDN header proxy | Cache | Advanced | ★★★ |
| 10 | Consolidate 3 `useRealtimeRow` calls on `MyShop` into single `useRealtimeChannel` (already exists, one caller unmigrated) | API | Smart | ★★ |

---

## API Optimizations

### Debounce `shop_engagement` inserts client-side
**Category:** API · **Level:** Safe · **Cost/Savings:** ★★★ · **UX Guardian:** Invisible

**Current Architecture.** `src/lib/engagement.ts` fires a raw `INSERT` on every call/whatsapp/maps click. A user tapping "call" twice or bouncing between shops rapidly creates duplicate rows within seconds; the DB CHECK constraint accepts them all. `Home.tsx:86` even has an inline insert bypassing the helper.

**Proposed Architecture.** Add a 500ms in-memory dedupe map keyed by `${shopId}:${eventType}` inside `logShopEngagement`. Route the inline `Home.tsx:86` call through the helper. No API surface change.

**Migration.** (1) Add `Map<string,number>` + timestamp guard in `engagement.ts`. (2) Replace the raw `supabase.from('shop_engagement').insert(...)` in `Home.tsx:86` with `logShopEngagement`. (3) Leave server-side triggers untouched.

**Estimated Savings.** _Calculated:_ Assume 500 DAU × 4 engagement clicks/session × 15% duplicate rate = ~300 duplicate inserts/day removed. Small in isolation; matters more once `refresh_engagement_stats` runs against a larger table.

---

### Collapse `MyShop` realtime subscriptions onto one channel
**Category:** API · **Level:** Smart · **Cost/Savings:** ★★ · **UX Guardian:** Invisible

**Current.** `src/pages/MyShop.tsx` opens two `useRealtimeRow` channels (lines 68, 87) plus one `useRealtimeChannel` (line 104) — three websocket channels per shopkeeper session. The multiplexer already exists.

**Proposed.** Migrate the two `useRealtimeRow` calls into the existing multiplexed `useRealtimeChannel`. Single WS channel per session.

**Estimated Savings.** _Order-of-magnitude:_ 3 → 1 channels per shopkeeper cuts Supabase Realtime concurrent connection count by ~66% for that role. Matters as shopkeeper count scales past ~200.

---

## Database Optimizations

### Project only rendered columns from `shops_with_claim`
**Category:** Database · **Level:** Safe · **Cost/Savings:** ★★★★ · **UX Guardian:** Invisible

**Current.** `Home.tsx:258` already narrowed to ~25 columns (good), but of those, `keywords`, `latitude`, `longitude`, `description`, `sub_area`, `whatsapp` are only used for search/filter derivation, not the initial render. Same 25-column pattern is re-fetched by `Shops.tsx`. Every anonymous visitor pays the full row cost even when they never search.

**Proposed.** Two-tier fetch:
- **Initial `useQuery(['shops','list-lite'])`** — projection: `id, slug, name, area, image_url, opening_time, closing_time, is_open, is_verified, is_claimed, shop_categories(...)`.
- **Deferred `useQuery(['shops','search-index'], { enabled: userInteractedWithSearch })`** — adds `keywords, description, whatsapp, latitude, longitude`. Fetched only when the search input focuses.

**Migration.** (1) Add second query, gated on `searchFocused || debouncedSearch.length > 0`. (2) `buildShopFuse` becomes a `useMemo` that depends on the second query. (3) `Shops.tsx` mirrors the pattern.

**UX.** Invisible — search feels the same because we already debounce 250ms and the index fetch fires on focus, before the user finishes typing.

**Estimated Savings.** _Order-of-magnitude:_ payload drops ~40% for the visitors (≈70% of sessions per typical directory analytics) who never open search. Bandwidth per Home load estimated to drop from ~35KB to ~20KB gzipped.

---

### Paginated shops RPC (Level 4 today, Level 3 at 3× scale)
**Category:** Database · **Level:** Advanced · **Cost/Savings:** ★★★★ · **UX Guardian:** Acceptable

**Current.** Both `Home.tsx` and `Shops.tsx` fetch ALL active shops in one call, then filter/paginate client-side. Fine at 100-300 shops. At 1,000+ this becomes the dominant DB read cost and slowest render.

**Proposed.** Postgres RPC `get_shops_page(p_area text, p_category uuid, p_search text, p_limit int, p_offset int)` returning slim rows. Home shows top ~24 by verified/recency; Shops uses infinite scroll via `useInfiniteQuery`. Fuse.js index stays for the currently-loaded window; typed search hits RPC full-text.

**Migration.** (1) Create RPC + GIN index on `shops(name, description)`. (2) Add `useInfiniteQuery` in `Shops.tsx`. (3) Home stays on the current query but bounded to 24 rows via new RPC. (4) Keep fuse.js only for the loaded slice.

**UX.** Acceptable — user sees a "Loading more…" sentinel when scrolling past 24 shops. Search results resolve server-side (~150ms) instead of instantly client-side.

**Trigger condition:** move from Level 4 → 3 when active shop count exceeds ~500 OR when Home TTI on 3G exceeds 3s.

---

### Category count derivations should be a materialised view
**Category:** Database · **Level:** Smart · **Cost/Savings:** ★★ · **UX Guardian:** Invisible

`Home.tsx` recomputes `catShopCounts`, `catNameCounts`, `areaShopCounts` on every shops update. Cheap for 300 shops, but the same numbers are computed on every visitor's browser. A `category_shop_counts` view (or materialised view refreshed on shop insert/update via trigger) means the client just fetches the pre-computed map. Fold into recommendation #2's slim payload.

---

## Storage Optimizations

### Enforce compress-on-upload in `imageService`
**Category:** Storage / Image · **Level:** Smart · **Cost/Savings:** ★★★★★ · **UX Guardian:** Invisible

**Current.** `src/lib/images/imageService.ts` (92 LOC) centralises upload but does not guarantee that all callers pass a compressed blob. `SafeImage` / `ShopImage` do the right thing on _display_ (srcSet, WebP transforms via Supabase image endpoint), but if originals in `shop-images/` are 3-5MB phone captures, every SW `CacheFirst` fetch and every transform request bills against Supabase egress.

**Proposed.** `imageService.upload(blob, { targetWidthPx: 1600, format: 'webp', quality: 0.8 })` — perform `browser-image-compression` (or a canvas resize) inside the service unconditionally, ignoring caller flags. Reject uploads above the compressed ceiling with a clear toast.

**Migration.** (1) Add compression step + size assertion in `imageService.ts`. (2) Add a one-off admin RPC `reprocess_shop_image(shop_id)` for backfill. (3) Run backfill against `shops`, `banners`, `shop_requests` buckets.

**Estimated Savings.** _Order-of-magnitude:_ average phone photo 3.5MB → 250KB WebP ≈ 14× reduction. Applied across shop-images cache (200 entries) and future uploads, this is the single largest recurring bandwidth line the project has.

---

### Storage bucket split hygiene (already in place — verify policies)
**Category:** Storage · **Level:** Safe · **Cost/Savings:** ★

`docs/patches/2026-07-05_bucket_split.sql` split buckets — good. Verify each bucket has `objectOwnership: bucket-owner` semantics and that `shop-images` is the only public bucket. Anything private going through public URL is a slow bleed.

---

## Image Optimizations

### Preload only the LCP hero image on Home
**Category:** Image · **Level:** Safe · **Cost/Savings:** ★★ · **UX Guardian:** Invisible

`ShopCard` uses `loading="lazy"` correctly. The first visible above-the-fold shop card image should get `fetchpriority="high"` + `loading="eager"` while the rest stay lazy. Add a `priority` prop to `ShopImage` and pass it from `Home.tsx` for index 0.

### Icon set audit
**Category:** Bundle · **Level:** Safe · **Cost/Savings:** ★★★

64 files import from `lucide-react`. Bundler tree-shakes named imports, but any `import * as Icons` or namespace import defeats it. `rg "from 'lucide-react'"` returns only named imports (confirmed via survey), so tree-shake is intact — **no action required** unless a route grows a namespace import. Track this in a lint rule (`no-restricted-syntax` for `ImportNamespaceSpecifier` on `lucide-react`).

---

## Network Optimizations

### PWA runtime caching (already good)
`vite.config.ts` correctly runtime-caches shop-images (CacheFirst, 30d), bus-data (NetworkFirst, 7d), fonts (SWR, 1y), and HTML navigations (NetworkFirst). This is best-practice; nothing to change.

### Add Cache-Control to categories endpoint via edge proxy
**Category:** Cache · **Level:** Advanced · **Cost/Savings:** ★★★ · **UX Guardian:** Invisible

Anonymous Home visitors fetch `/rest/v1/categories` on every cold load. Supabase does not send cacheable Cache-Control by default. Options:
- **A (Advanced):** Cloudflare Worker in front of REST that stamps `Cache-Control: public, s-maxage=600, stale-while-revalidate=1200` for GETs on `categories` and `banners`.
- **B (Smart, cheaper):** Persist React Query cache to `localStorage` with `persistQueryClient` for the two long-lived keys.

Recommend **B first** — it's a 20-line change and captures 80% of the wins with zero infra.

---

## Frontend Optimizations

### Break up `Home.tsx` (1,105 LOC)
**Category:** Frontend · **Level:** Smart · **Cost/Savings:** ★★★ · **UX Guardian:** Invisible

**Current.** Home renders search, categories, hero, shops list, banners, area filters — all as one function component. Any state change (search focus, filter chip toggle) re-renders the whole tree. `homeFuse` rebuilds whenever any dependency's identity changes.

**Proposed.** Extract:
- `<HomeSearch/>` (owns `search`, `searchFocused`, suggestions).
- `<CategoryGrid/>` (memoised, takes `categories` + `catShopCounts` map).
- `<ShopList/>` (memoised, takes filtered shops).
- `<BannerRow/>` unchanged.

Move `catShopCounts` / `areaShopCounts` derivations into custom hooks with stable references.

**Estimated Savings.** _Order-of-magnitude:_ re-renders on every keystroke drop from ~1 full-tree render to ~1 suggestion-list render. Meaningful battery/CPU on low-end Android (the majority audience per the app's context).

### Same treatment for `Shops.tsx` (1,018 LOC) and `ShopDetail.tsx` (729 LOC)
Same reasoning. `Shops.tsx` in particular re-runs area/category filter reduce on every render — memoise per filter input tuple.

### Fuzzy index in a Worker at ≥ 500 shops (Level 4 → 3 at scale)
Build `Fuse` off the main thread; `postMessage` results back. Not needed today.

---

## Cloud Optimizations

- **Vercel/Cloudflare hosting:** Route splitting is in place; `AdminLayout` and every admin page are lazy. No cold-start concern (static build).
- **Supabase plan headroom:** Egress dominates cost profile. Recommendations #1 (image compression) and #2 (slim projection) directly relieve the tier-limit pressure.
- **`mcp` edge function:** Currently public read tools with auth issuer. Cold starts on Supabase Edge are ~100-200ms; acceptable. No change.
- **`wrangler.jsonc` present:** Verify Cloudflare Worker (if deployed) has `cache-everything` rule for `/assets/*` immutables, and the SW handles `/index.html` navigation. Both look OK from `vite.config.ts` runtime caching.

---

## Future Optimizations (Level 4 / Strategic)

| Opportunity | Trigger condition |
|---|---|
| Paginated shops RPC + infinite scroll (item #4 above) | Active shops > 500 OR Home TTI on 3G > 3s |
| Fuse.js in Web Worker | Shops list > 500 OR keyboard input jank measured on any mid-tier Android |
| Cloudflare Worker in front of Supabase REST for `categories`/`banners` | Monthly egress > 80% of tier limit |
| Move engagement writes to a debounced Edge Function (batch inserts every 30s) | `shop_engagement` inserts > 100k/day |
| Split `shops_with_claim` view: `shops_list_public` (slim) + `shops_search_public` (search cols) | After #2 lands and payload analysis shows further wins |
| Materialised `category_shop_counts` refreshed on trigger | Categories tab render time > 200ms |

---

## Estimated Savings Summary

| Metric | Current (estimated) | After Roadmap | Estimated Reduction | Derivation |
|---|---|---|---|---|
| API calls per user session (Home + browse) | ~14 | ~9 | ~35% | Calculated |
| Database reads / anonymous visitor | ~4 wide reads | ~3 slim reads | ~40% row-bytes | Order-of-magnitude |
| Storage operations / new shop | 1 large upload | 1 small upload | ~90% bytes | Order-of-magnitude |
| Image downloads / session | ~12 × 200KB avg | ~12 × 40KB avg | ~80% bytes | Order-of-magnitude |
| Total bandwidth (monthly, ~500 DAU) | Dominated by images | ~3-5× lower on images | ~60-70% | Estimated |
| Client CPU (avg per session) | ~1 large re-render/keystroke on Home | Localised re-render | ~50% render count | Order-of-magnitude |
| JS bundle size (initial route) | Adequate (lazy admin) | Same | 0% | Not the bottleneck |
| Monthly infra cost | On Supabase Free/Pro | Extend runway ~2-3× | ~50-70% egress cut | Estimated |

---

## Optimization Roadmap

### Phase 1 — Safe Wins (1-2 dev days)
1. Slim `shops_with_claim` projection + gate search-only fields on focus. _(Rec #2)_
2. Align staleTime to 2m for `categories`, `shops`, `banners`; add `persistQueryClient` for `categories`. _(Rec #3, Cache #B)_
3. Debounce `shop_engagement` inserts + route Home's inline insert through helper. _(Rec #5)_
4. `fetchpriority="high"` on Home's first shop image. _(Image #1)_
5. Add lint rule blocking `lucide-react` namespace imports. _(Bundle #6)_

### Phase 2 — High ROI (3-5 dev days)
6. Compress-on-upload in `imageService` + one-off backfill RPC. _(Rec #1)_
7. Consolidate `MyShop` realtime channels. _(Rec #10)_
8. Extract `<HomeSearch/> <CategoryGrid/> <ShopList/>` from `Home.tsx`. _(Frontend #7)_

### Phase 3 — Architectural Evolution (1-2 sprints)
9. `get_shops_page` RPC + infinite scroll on `Shops.tsx`. _(Rec #4)_
10. Materialised `category_shop_counts` refreshed on shop insert/update.
11. Same component-split treatment for `Shops.tsx` and `ShopDetail.tsx`.

### Phase 4 — Scale Readiness
12. Fuse.js in Web Worker (trigger: 500+ shops).
13. Cloudflare Worker cache in front of Supabase REST (trigger: 80% egress).
14. Batched engagement Edge Function (trigger: 100k inserts/day).

---

## Final Verdict

1. **Biggest resource bottleneck today:** unoptimised shop-image originals in the `shop-images` bucket, downloaded via CacheFirst SW after every fresh visitor.
2. **Highest-impact optimization (best effort:savings):** compress-on-upload in `imageService` (a few hours' work, permanent 3-5× egress cut).
3. **Most expensive recurring operation:** cold-visitor `shops_with_claim` fetch + subsequent image downloads on Home.
4. **Most over-engineered area:** `Home.tsx` (1,105 LOC) mixing search, categories, filters, banners, and shops list in one component — complexity without a proportionate feature payoff.
5. **Most under-optimized area:** image upload pipeline — everything from `SafeImage` outward is careful; the ingest side is not.
6. **What to optimize next:** Phase 1 items #1-3 in one PR — they are additive, low-risk, and collectively worth ~40% payload reduction for anonymous visitors.
7. **Expected efficiency improvement if the full roadmap ships:** Overall Efficiency Score projected to move from **68 → 84**, driven mostly by the image pipeline and slim-projection wins. Scalability Score moves to **78** once the paginated RPC lands.

---

## Ecosystem Impact Note

- **Sentinel-protected surfaces touched:** `ShopCard.tsx`, `RequestListingModal.tsx`, and `shops_with_claim` view are all flagged in `docs/FORGE_RECOMMENDATIONS.md` / `docs/SENTINEL_CONTEXT.md`. Recommendations #2 (slim projection) and #7 (Home split) touch the shops query shape — coordinate with the Sentinel-approved wrapper-first migration policy: change the query behind `shopsRepo.list(...)` first (which is Forge-endorsed) rather than in the callers directly.
- **Overlaps with Forge:** Forge Recommendation #11 (repositories) already exists at `src/lib/repos/shopsRepo.ts`. All DB-projection changes here should land _inside_ that repo, not in `Home.tsx`/`Shops.tsx`. Similarly, Forge #6 (image pipeline service) and m-Pulse Rec #1 (compress-on-upload) are the same physical change — do them together, not sequentially.
- **New patterns Archivist should document:**
  - Two-tier query pattern (`list-lite` vs `search-index`) once landed.
  - Client-side engagement debounce contract in `engagement.ts`.
  - `imageService.upload` compression contract (max 1600px WebP, q≈80) as a project invariant.

---

_End of report._
