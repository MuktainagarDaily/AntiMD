# Repository Layer (Forge Recommendation #11)

Thin, per-entity wrappers around `supabase.from('<table>')`. **Additive** — existing
`.from('shops')` call sites keep working; new code should prefer the repo.

Each repo exposes only what the UI actually needs (`list`, `get`, `insert`,
`update`, `delete`, plus a small number of specialised queries), preserving raw
`.from()` style internally. This is **not** a generic query builder — Sentinel
explicitly cautions against that (see `docs/FORGE_REPORT.md` Dangerous Areas).

## Why

- One place to enforce editable-field whitelists (`pickOwnerEditable` for shops).
- Typed return surfaces that paper over the loose `external-types.ts` casts.
- File-by-file migration path: swap `.from('shops').select(…)` for
  `shopsRepo.list(…)` when touching a caller, with visual verification.

## Files

- `types.ts`       — shared `RepoResult<T>` / helpers.
- `shopsRepo.ts`   — shops table + `OWNER_EDITABLE_FIELDS` guard + concurrency update.
- `requestsRepo.ts`— shop_requests (public listing submissions).
- `claimsRepo.ts`  — shop_claims (ownership claims + proof cleanup helpers).
- `bannersRepo.ts` — banners (ad/promo carousels).
- `categoriesRepo.ts` — categories + shop_categories join links.
- `index.ts`       — barrel export.

## Migration policy (Sentinel guardrail)

Per `docs/FORGE_REPORT.md` #11: any query-shape change can break loose typing
in subtle ways. Migrate one call site at a time; do not batch-rewrite. Never
change the SELECT projection when swapping a caller — mirror the existing
`.select('…')` string via the `select` override arg on `list`/`get`.
