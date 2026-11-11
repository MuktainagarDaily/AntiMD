/**
 * mockReviews — TEMPORARY UI-only mock data source.
 *
 * When the backend arrives, replace this file with a real hook. Callers should
 * only depend on the exported functions below, never on the seed logic.
 *
 * Deterministic per shopId (small hash → seed) so the same shop always shows
 * the same fake rating during design review.
 */

export interface MockReview {
  id: string;
  authorName: string;
  rating: number;          // 0.5..5 (step 0.5 in mock)
  createdAt: string;       // ISO
  body: string;
  helpful: number;
  verified?: boolean;
}

export interface MockShopRating {
  average: number;             // one decimal
  count: number;
  distribution: [number, number, number, number, number]; // [5★,4★,3★,2★,1★]
}

const AUTHORS_EN = [
  'Aarav Patil', 'Priya Sharma', 'Rohan Deshmukh', 'Sneha Kulkarni',
  'Vikram Joshi', 'Anjali Rane', 'Kunal Bhosale', 'Meera Shinde',
  'Nikhil Wagh', 'Isha Chavan',
];

const BODIES_POSITIVE = [
  'Absolutely loved the service — friendly staff and everything was ready quickly.',
  'Great quality and fair prices. Highly recommend to anyone in town.',
  'Been coming here for months. Consistent, clean, and reliable.',
  'Owner is very helpful and patient. Made time to explain everything.',
  'Best in the area. Family-friendly and welcoming.',
];
const BODIES_NEUTRAL = [
  'Good experience overall. A few small things could be improved but nothing serious.',
  'Decent place. Prices are okay, service was fine.',
  'Not bad, not amazing. Would visit again if convenient.',
];
const BODIES_NEGATIVE = [
  'Waited a long time and staff seemed busy. Hope they can improve on speed.',
  'The place was crowded and a bit disorganised when I visited.',
];

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

/**
 * Returns aggregate rating for a shop, or `null` for ~15% of shops so the UI
 * can render its no-rating-yet fallback.
 */
export function getMockShopRating(shopId: string): MockShopRating | null {
  if (!shopId) return null;
  const seed = hash(shopId);
  const rng = mulberry32(seed);
  // 15% of shops have no reviews yet
  if (rng() < 0.15) return null;

  const count = 3 + Math.floor(rng() * 220); // 3..222
  // Bias toward positive but include some spread
  const dist: [number, number, number, number, number] = [0, 0, 0, 0, 0];
  const weights = [0.55, 0.22, 0.12, 0.06, 0.05]; // 5★..1★ probabilities
  for (let i = 0; i < count; i++) {
    const r = rng();
    let acc = 0;
    for (let j = 0; j < 5; j++) {
      acc += weights[j];
      if (r < acc) { dist[j]++; break; }
    }
  }
  const total = dist.reduce((a, b) => a + b, 0) || 1;
  const sum = dist[0] * 5 + dist[1] * 4 + dist[2] * 3 + dist[3] * 2 + dist[4] * 1;
  const average = Math.max(0.1, Math.min(5, +(sum / total).toFixed(1)));
  return { average, count: total, distribution: dist };
}

export function getMockReviews(shopId: string): MockReview[] {
  if (!shopId) return [];
  const agg = getMockShopRating(shopId);
  if (!agg) return [];
  const seed = hash(shopId + ':reviews');
  const rng = mulberry32(seed);
  const target = Math.min(agg.count, 8);
  const reviews: MockReview[] = [];
  const now = Date.now();

  const buckets: number[] = [];
  agg.distribution.forEach((c, i) => {
    // 5★ index 0 → star 5
    for (let k = 0; k < c; k++) buckets.push(5 - i);
  });

  // Sample without replacement (approx)
  for (let i = 0; i < target && buckets.length > 0; i++) {
    const idx = Math.floor(rng() * buckets.length);
    const star = buckets.splice(idx, 1)[0];
    const rating = Math.max(1, Math.min(5, star));
    const body =
      rating >= 4 ? pick(rng, BODIES_POSITIVE)
      : rating >= 3 ? pick(rng, BODIES_NEUTRAL)
      : pick(rng, BODIES_NEGATIVE);
    const daysAgo = Math.floor(rng() * 210);
    reviews.push({
      id: `mock-${shopId}-${i}`,
      authorName: pick(rng, AUTHORS_EN),
      rating,
      createdAt: new Date(now - daysAgo * 24 * 3600 * 1000).toISOString(),
      body,
      helpful: Math.floor(rng() * 42),
      verified: rng() < 0.35,
    });
  }
  // Newest first by default
  reviews.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  return reviews;
}

export function formatRelative(iso: string): string {
  const diff = Date.now() - +new Date(iso);
  const day = 24 * 3600 * 1000;
  if (diff < day) return 'today';
  if (diff < 2 * day) return 'yesterday';
  const days = Math.floor(diff / day);
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return new Date(iso).toLocaleDateString();
}
