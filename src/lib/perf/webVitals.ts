/**
 * Lightweight Core Web Vitals collector (MPULSE Phase 3).
 *
 * Standalone PerformanceObserver setup — no dependency on the `web-vitals`
 * package to keep the bundle lean. Captures:
 *   • LCP  — Largest Contentful Paint (image / hero text becoming visible)
 *   • FCP  — First Contentful Paint (first pixel painted)
 *   • INP  — Interaction to Next Paint (event → next frame latency)
 *   • CLS  — Cumulative Layout Shift (visual stability)
 *
 * Values are logged via `console.info` with a `[web-vitals]` prefix so they
 * show up cleanly in the browser console AND in Lovable's session replay.
 * Callers can pass a `report` sink (analytics, edge function, etc.) to
 * ship measurements upstream.
 *
 * Regression detection is up to the analytics layer — this module only
 * captures. When wired on Home + ShopList (Recently Added is a component of
 * Home so the same LCP applies), a hero image regression will show up as
 * LCP > 2.5s on mobile 4G.
 *
 * Safe to call multiple times — the internal `initialized` flag prevents
 * duplicate observers.
 */

export type WebVitalName = 'LCP' | 'FCP' | 'INP' | 'CLS';
export interface WebVitalReport {
  name: WebVitalName;
  value: number;
  /** Optional target element for LCP; useful for spotting the wrong hero image. */
  element?: string;
  navigationType?: string;
}

let initialized = false;

function safeObserve(entryType: string, cb: (list: PerformanceObserverEntryList) => void) {
  try {
    const observer = new PerformanceObserver(cb);
    // buffered:true lets us see entries that landed before observer setup —
    // essential for LCP which fires very early in the page lifecycle.
    observer.observe({ type: entryType, buffered: true } as PerformanceObserverInit);
    return observer;
  } catch {
    // Older browsers / test environments lacking `PerformanceObserver` for
    // this entry type — silently skip; not a hard error.
    return null;
  }
}

export function initWebVitals(report: (r: WebVitalReport) => void = defaultReport) {
  if (initialized || typeof window === 'undefined' || typeof PerformanceObserver === 'undefined') return;
  initialized = true;

  // ── LCP ────────────────────────────────────────────────────────────────
  // Latest largest-contentful-paint entry is authoritative until the page
  // is backgrounded or an interaction occurs.
  safeObserve('largest-contentful-paint', (list) => {
    const entries = list.getEntries() as any[];
    const last = entries[entries.length - 1];
    if (!last) return;
    report({
      name: 'LCP',
      value: Math.round(last.startTime),
      element: last.element ? `${last.element.tagName}${last.element.id ? '#' + last.element.id : ''}` : undefined,
    });
  });

  // ── FCP ────────────────────────────────────────────────────────────────
  safeObserve('paint', (list) => {
    for (const entry of list.getEntries()) {
      if (entry.name === 'first-contentful-paint') {
        report({ name: 'FCP', value: Math.round(entry.startTime) });
      }
    }
  });

  // ── INP ────────────────────────────────────────────────────────────────
  // Poor-man's INP: takes the max event-timing duration observed. Not as
  // accurate as web-vitals' 75th-percentile buffer, but a good regression
  // signal when only one number matters.
  let worstInp = 0;
  safeObserve('event', (list) => {
    for (const entry of list.getEntries() as any[]) {
      const d = entry.duration ?? 0;
      if (d > worstInp) {
        worstInp = d;
        report({ name: 'INP', value: Math.round(d) });
      }
    }
  });

  // ── CLS ────────────────────────────────────────────────────────────────
  let cls = 0;
  safeObserve('layout-shift', (list) => {
    for (const entry of list.getEntries() as any[]) {
      if (!entry.hadRecentInput) cls += entry.value;
    }
    report({ name: 'CLS', value: Math.round(cls * 1000) / 1000 });
  });
}

function defaultReport(r: WebVitalReport) {
  // eslint-disable-next-line no-console
  console.info(`[web-vitals] ${r.name}=${r.value}${r.element ? ` element=${r.element}` : ''}`);
}
