# My Shop — more owner-editable fields

Owners can currently edit only photo, name, description, phone/WhatsApp, area, sub-area, address and hours. This adds four more: amenities, categories, map location and keywords.

## What owners get

1. **Amenities** — the same preset chips + custom input used in the admin and listing forms, in a new "Amenities & Features" section.
2. **Categories** — multi-select of active categories (same picker style as the admin shop modal), min 1 category enforced before save.
3. **Location on map** — the existing Google Maps pin picker in the Location section, with a "Use my current location" option and a small map preview when coordinates already exist. Picking a pin also offers to fill address/area (reverse geocode), same behaviour as the listing form.
4. **Keywords** — comma-separated tags input with chip preview, to help local search.

All of these flow through the existing dirty-tracking, sticky save bar, optimistic sync badge and conflict handling — no separate save buttons.

## Technical notes

- `src/lib/shopConcurrency.ts`: extend `OWNER_EDITABLE_FIELDS` with `amenities`, `latitude`, `longitude`, `keywords`. Categories are written separately (join table), not through this whitelist.
- `src/pages/MyShop.tsx`:
  - Extend the `initial` form object with the new fields; array/object fields need a value-aware dirty check (current check is `!==`, which is always true for arrays) — compare arrays by joined-value.
  - Reuse `AmenitiesPicker` (`parseAmenities` for the stored `text[]`), `LocationMapPicker`, and a new lightweight `KeywordsInput` (or a plain comma input mirroring `ShopModal`'s pattern).
  - Categories: load active categories via `categoriesRepo`, seed selection from `shop.shop_categories`, and on save diff added/removed rows against `shop_categories`.
  - The owner shop query (`.select('shop_id, shops(*)')`) already returns all columns; add `shop_categories(category_id, categories(id,name,icon,is_active))` to the embed so the picker seeds correctly.
  - Keep the "some fields are admin-managed" note but update it to list only what remains admin-only (verified/active/slug).
- Reuse the shared category-diff logic from the admin shop modal instead of duplicating it.

## Database patch (required for categories)

`shop_categories` is admin-only under RLS today, so owner category edits need a patch. New file `docs/patches/2026-08-10_owner_category_edit.sql`:

- `INSERT` and `DELETE` policies on `public.shop_categories` for `authenticated`, allowed when `has_role(auth.uid(),'admin')` OR the row's `shop_id` belongs to the caller via `shop_owners` (wrapped in a SECURITY DEFINER `owns_shop(uid, shop_id)` helper to avoid recursive RLS).
- Confirm grants (`GRANT INSERT, DELETE ON public.shop_categories TO authenticated`).
- The existing shops BEFORE-UPDATE trigger keeps blocking non-admin writes to `is_verified` / `is_active` / `slug` / `category_id` — unchanged.

The SQL patch will be provided for you to run; nothing is applied automatically. Until it's run, the category picker will save-fail with a permission error, so it will be rendered read-only with a note when the policy is absent is **not** included — it is enabled directly, per your choice.
