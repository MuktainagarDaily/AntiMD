/**
 * Repository barrel — Forge Recommendation #11.
 *
 * Prefer `import { shopsRepo } from '@/lib/repos'` in new call sites.
 * See ./README.md for the migration policy.
 */
export { shopsRepo, SHOP_CARD_SELECT } from './shopsRepo';
export { requestsRepo, REQUEST_LIST_SELECT } from './requestsRepo';
export { claimsRepo } from './claimsRepo';
export { bannersRepo, BANNER_LIST_SELECT } from './bannersRepo';
export { categoriesRepo } from './categoriesRepo';
export { pickFields } from './types';
export type { RepoResult } from './types';
