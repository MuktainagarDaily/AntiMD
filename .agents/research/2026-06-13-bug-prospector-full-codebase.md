# Bug Prospector Report: Full Codebase

**Date:** 2026-06-13
**Scope:** Full src/ codebase (excl. ui/, generated types, tests)
**Lenses Applied:** Assumption Audit, Error Path Exerciser, Boundary Conditions ("Quick 3")
**Files Analyzed:** ~80 source files across hooks, pages, admin, shared, lib, banners

## Summary

| Status | Count |
|--------|-------|
| Bugs Found (🔴 BUG) | 13 |
| Fragile Code (🟡 FRAGILE) | 8 |
| OK / Excluded | — |
| Needs Review | — |

## Issue Rating Table (full)

Sorted by Urgency → ROI.

| # | Finding | Lens | Urgency | Risk: Fix | Risk: No Fix | ROI | Blast Radius | Fix Effort |
|---|---------|------|---------|-----|-----|-----|-----|-----|
| 1 | `ResetPassword.tsx:29` — `getSession()` races recovery hash parse; valid links show "Invalid or expired" | Assumption | 🔴 Critical | ⚪ Low | 🔴 Critical | 🟠 Excellent | ⚪ 1 file | Small |
| 2 | `App.tsx:71` — `toast()` called during render in `ProtectedRoute` | Error Path | 🔴 Critical | ⚪ Low | 🟡 High | 🟠 Excellent | ⚪ 1 file | Trivial |
| 3 | `imageUtils.ts:9` — `compressImage` has no `img.onerror`; promise hangs forever on bad image | Error Path | 🔴 Critical | ⚪ Low | 🔴 Critical | 🟠 Excellent | ⚪ 1 file | Trivial |
| 4 | `RequestListingModal.tsx:252` — upload failure returns `''` → form still submits without photo | Error Path | 🔴 Critical | ⚪ Low | 🔴 Critical | 🟠 Excellent | ⚪ 1 file | Trivial |
| 5 | `ShopModal.tsx:364` — dupe-check network throw never resets `setSaving(false)`; form locked | Error Path | 🔴 Critical | ⚪ Low | 🟡 High | 🟠 Excellent | ⚪ 1 file | Trivial |
| 6 | `MasterImportModal.tsx:75` — `upsert onConflict:'id'` used for `shop_categories` (composite PK) | Assumption | 🟡 High | ⚪ Low | 🟡 High | 🟠 Excellent | ⚪ 1 file | Trivial |
| 7 | `ShopDetail.tsx:78` — UUID→slug redirect drops `?claim=1`; claim deep-link never fires | Error Path | 🟡 High | ⚪ Low | 🟡 High | 🟠 Excellent | ⚪ 1 file | Trivial |
| 8 | `UserMenuDrawer.tsx:242` — uses `?redirect=` while rest of app uses `?next=` | Assumption | 🟡 High | ⚪ Low | 🟡 High | 🟠 Excellent | ⚪ 1 file | Trivial |
| 9 | `RequestsTab.tsx:82` — empty normalized phone matches all phone-less shops → false dupe block | Boundary | 🟡 High | ⚪ Low | 🟡 High | 🟠 Excellent | ⚪ 1 file | Trivial |
| 10 | `OwnersTab.tsx:76` — `window.prompt()` opens before `setBusy()`; double-reject race | Error Path | 🟡 High | ⚪ Low | 🟢 Medium | 🟢 Good | ⚪ 1 file | Trivial |
| 11 | `banners/store.ts:193` — RPC fires outside try; `setItem` throw bypasses dedup, double-counts views | Error Path | 🟡 High | ⚪ Low | 🟡 High | 🟠 Excellent | ⚪ 1 file | Trivial |
| 12 | `banners/store.ts:95` & `types.ts:61` — UTC vs local-date mismatch for `start/end_date` filtering | Boundary | 🟡 High | ⚪ Low | 🟡 High | 🟢 Good | 🟢 2 files | Small |
| 13 | `AnalyticsCsvImportModal.tsx:76` — unchunked bulk insert of N synthetic events per row | Boundary | 🟢 Medium | ⚪ Low | 🟢 Medium | 🟢 Good | ⚪ 1 file | Trivial |
| F1 | `use-toast.ts:177` — `[state]` dep causes listener churn; dispatches can be missed | Boundary | 🟢 Medium | ⚪ Low | 🟢 Medium | 🟠 Excellent | ⚪ 1 file | Trivial |
| F2 | `i18n/index.tsx:102` — stale `locale` closure can override manual user selection mid-fetch | Assumption | 🟢 Medium | ⚪ Low | 🟢 Medium | 🟢 Good | ⚪ 1 file | Trivial |
| F3 | `useAuth.tsx:146` — `signOut` clears roles but not user/session; transient inconsistent state | Boundary | 🟢 Medium | ⚪ Low | 🟢 Medium | 🟢 Good | ⚪ 1 file | Trivial |
| F4 | `useSmartBack.ts:68` — 120 ms polling guard too short on slow devices; double-nav | Boundary | 🟢 Medium | 🟢 Medium | 🟢 Medium | 🟢 Good | ⚪ 1 file | Small |
| F5 | `supabase/client.ts:5` — no guard on missing env vars; cryptic runtime failure | Assumption | 🟢 Medium | ⚪ Low | 🟢 Medium | 🟠 Excellent | ⚪ 1 file | Trivial |
| F6 | `Shops.tsx:122` — local `t` (timer) shadows i18n `t` translator | Assumption | 🟢 Medium | ⚪ Low | ⚪ Low | 🟢 Good | ⚪ 1 file | Trivial |
| F7 | `csvUtils.ts:34,40` — unconditional `.trim()` strips intentional padding inside quoted fields | Assumption | 🟢 Medium | 🟢 Medium | 🟢 Medium | 🟡 Marginal | ⚪ 1 file | Small |
| F8 | `translateApi.ts:129` — local cache key not normalised → duplicate entries, inflated hit counts | Assumption | ⚪ Low | ⚪ Low | ⚪ Low | 🟢 Good | ⚪ 1 file | Trivial |
| F9 | `CsvImportModal.tsx:218` — relies on PG insert-order; should match by `name` | Assumption | 🟢 Medium | 🟢 Medium | 🟢 Medium | 🟢 Good | ⚪ 1 file | Small |

## Detailed Findings — Critical & High

### 1. `src/pages/ResetPassword.tsx:29` — false "Invalid or expired link"
`getSession()` resolves before Supabase parses the `#access_token` hash and fires `PASSWORD_RECOVERY`. Users with valid recovery links are blocked.
**Fix:** rely solely on `onAuthStateChange`, with a 3s timeout fallback.

### 2. `src/App.tsx:71` — toast during render
`toast()` is invoked in the render path of `ProtectedRoute`. Move it into a `useEffect` keyed off `ok` to avoid React state-update-during-render warnings.

### 3. `src/lib/imageUtils.ts:9` — hung upload promise
`compressImage` lacks `img.onerror`. A corrupt file freezes the upload flow indefinitely. Add an `onerror` that rejects or resolves with an empty blob.

### 4. `src/components/RequestListingModal.tsx:252` — submits without photo
`uploadCroppedBlob` swallows errors and returns `''`; `handleSubmit` continues. Bail out when `croppedBlob && !finalImageUrl`.

### 5. `src/components/admin/ShopModal.tsx:364` — form locked on dupe-check error
Wrap the dupe-check block in `try/finally { setSaving(false) }`.

### 6. `src/components/admin/MasterImportModal.tsx:75` — wrong upsert conflict target
`shop_categories` has composite PK `(shop_id, category_id)`. Use `onConflict: 'shop_id,category_id'` for that table.

### 7. `src/pages/ShopDetail.tsx:78` — claim deep-link broken
UUID→slug `navigate` drops query string. Append `location.search` to the destination.

### 8. `src/components/UserMenuDrawer.tsx:242` — inconsistent redirect param
Replace `?redirect=` with `?next=` to match the rest of the codebase.

### 9. `src/components/admin/RequestsTab.tsx:82` — false duplicate phone match
Skip the dupe check when `normPhone === ''`.

### 10. `src/components/admin/OwnersTab.tsx:76` — double-reject race
Set `setBusy(c.id)` *before* opening `window.prompt`, or migrate to the dialog pattern used in `InboxTab`.

### 11. `src/lib/banners/store.ts:193` — view dedup bypassed
Move the RPC inside the `try`, only after a successful `setItem`.

### 12. `src/lib/banners/store.ts:95` & `types.ts:61` — UTC vs local date
DB query uses `toISOString().slice(0,10)` (UTC); `isBannerLive` parses as local. Pick one — recommend building the date string from local `getFullYear/Month/Date`.

### 13. `src/components/admin/AnalyticsCsvImportModal.tsx:76` — unchunked insert
Chunk the `events` array in batches of ~500 to avoid payload-size/timeout failures on shops with high counts.

## Fragile Code (works now, will break later)

See F1–F9 in the rating table; each is a 1-file, low-risk hardening change.
Highlights:
- **F1 `use-toast.ts`** — change effect deps from `[state]` to `[]`.
- **F2 `i18n/index.tsx`** — read latest `locale` via a ref inside the async profile sync.
- **F5 `supabase/client.ts`** — assert env vars at boot.
- **F6 `Shops.tsx`** — rename debounce timer to `timer` (avoid shadowing `t`).
- **F7 `csvUtils.ts`** — only trim unquoted values.

## Implementation Plan (suggested phases)

1. **Phase 1 — Critical UX blockers** (#1, #2, #3, #4) — auth recovery, image upload, listing photo.
2. **Phase 2 — Admin data integrity** (#5, #6, #9, #10, #13).
3. **Phase 3 — Navigation/claim deep-links** (#7, #8).
4. **Phase 4 — Banner correctness** (#11, #12).
5. **Phase 5 — Fragile hardening** (F1–F9).
