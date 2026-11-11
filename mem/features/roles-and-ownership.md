---
name: Roles and ownership
description: app_role enum (admin/shopkeeper/user), shop_owners join, shop_claims queue, RLS lockdown, profiles PII restriction
type: feature
---
Auth + roles system:
- Enum `public.app_role`: 'admin' | 'shopkeeper' | 'user'.
- `user_roles` (user_id, role) — checked via SECURITY DEFINER `has_role(uid, role)`.
- `profiles` (id=auth.uid, full_name, phone) auto-created on signup. **SELECT restricted: self / admin / shop-owner-context.** Use `profiles_public` view (id, full_name only) for any anon-safe read.
- `shop_owners` (shop_id, user_id) — many shops per user.
- `shop_claims` — public claim queue: pending|approved|rejected (CHECK constraint).
- Admin RPCs: `assign_shop_owner`, `revoke_shop_owner`, `approve_shop_claim`, `reject_shop_claim`, `refresh_engagement_stats`. All check admin internally; `EXECUTE` revoked from anon.
- RLS: shops/categories/shop_categories/shop_requests writes are admin-only; shops UPDATE also allows owners but a BEFORE trigger blocks non-admins from changing is_verified/is_active/slug/category_id. shop_engagement SELECT requires admin OR ownership.
- Frontend: `useAuth` exposes `roles[]`, `isAdmin`, `isShopkeeper`. `ProtectedRoute` takes `requireRole`. `/my-shop` page (shop switcher + edit + 30-day engagement). `ClaimShopModal` on shop detail. Owners admin tab with Pending Claims / Direct Assign / Current Owners. Deep link `/auth?next=/shop/<id>&claim=1` auto-opens claim modal post-signin.
- First admin: `harshking5305@gmail.com` (auto-promoted in migration).
- FKs: `user_roles`, `shop_owners`, `shop_claims` have FKs to BOTH `auth.users` (existing) AND `public.profiles` (CASCADE) — required for PostgREST embeds to resolve. Native embeds work; current fetch-and-merge code still functions and can be simplified later.
- shops_with_claim view uses `security_invoker = on` (caller's RLS).
- shops.category_id is DEPRECATED (kept for compat) — use shop_categories join.
- Rate limit (trigger `trg_shop_claims_rate_limit`, BEFORE INSERT, admins exempt): max 1 pending claim per (user,shop); max 3 claims per (user,shop)/24h; max 3 claims per user/1h. Index: idx_shop_claims_user_created.
- updated_at maintained by `set_updated_at` triggers on profiles/shops/categories/shop_requests/shop_claims.
