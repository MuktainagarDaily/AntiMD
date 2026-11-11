/**
 * Guarded service worker registration.
 *
 * The PWA must NEVER register inside the Lovable editor preview — a stale
 * cached HTML there can break hot reload and leave users on dead chunks.
 * We also refuse to register in dev, inside iframes, and when the user
 * adds `?sw=off` to the URL (kill switch).
 *
 * In every refused context we also try to UNREGISTER any pre-existing
 * `/sw.js`, so a user who visited the published site once won't keep a
 * stale worker the next time they open the preview.
 */
const SW_PATH = "/sw.js";

function isRefusedContext(): boolean {
  // Dev: Vite serves no SW; never register.
  if (!import.meta.env.PROD) return true;

  // Iframed (Lovable preview always iframes the app).
  try {
    if (window.self !== window.top) return true;
  } catch {
    // Cross-origin frame access blocked → we're definitely in an iframe.
    return true;
  }

  const host = window.location.hostname;
  if (
    host.startsWith("id-preview--") ||
    host.startsWith("preview--") ||
    host === "lovableproject.com" ||
    host.endsWith(".lovableproject.com") ||
    host === "lovableproject-dev.com" ||
    host.endsWith(".lovableproject-dev.com") ||
    host === "beta.lovable.dev" ||
    host.endsWith(".beta.lovable.dev") ||
    (host.endsWith(".vercel.app") && (host.includes("-git-") || host.includes("-preview")))
  ) {
    return true;
  }

  // Kill switch: ?sw=off
  if (new URLSearchParams(window.location.search).get("sw") === "off") {
    return true;
  }

  // OAuth consent and auth redirects must always be fresh network pages. A
  // stale app-shell from the PWA cache can make the consent route look like a
  // client-side 404 even after publishing the route.
  const path = window.location.pathname;
  const authNext = new URLSearchParams(window.location.search).get("next") || "";
  if (
    path.startsWith("/.lovable/oauth") ||
    path.startsWith("/oauth/consent") ||
    path.startsWith("/~oauth") ||
    (path === "/auth" && authNext.includes("/oauth/consent"))
  ) {
    return true;
  }

  return false;
}

async function unregisterMatching(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      regs
        .filter((r) => {
          const url = r.active?.scriptURL || r.installing?.scriptURL || r.waiting?.scriptURL || "";
          return url.endsWith(SW_PATH);
        })
        .map((r) => r.unregister()),
    );
  } catch {
    /* ignore */
  }
}

export function registerPwa(): void {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  if (isRefusedContext()) {
    void unregisterMatching();
    return;
  }

  // Defer to idle so first paint isn't blocked.
  const run = () => {
    navigator.serviceWorker
      .register(SW_PATH, { scope: "/" })
      .catch(() => {
        /* SW registration is best-effort; site still works without it */
      });
  };

  const ric = (window as any).requestIdleCallback as
    | ((cb: () => void, opts?: { timeout: number }) => void)
    | undefined;
  if (typeof ric === "function") {
    ric(run, { timeout: 3000 });
  } else {
    setTimeout(run, 1500);
  }
}
