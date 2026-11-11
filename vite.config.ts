import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";

function isBlockedHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (
    lower === "localhost" ||
    lower === "::1" ||
    lower.endsWith(".local") ||
    lower.endsWith(".internal")
  ) {
    return true;
  }
  const parts = lower.split(".").map(Number);
  if (parts.length === 4 && parts.every((n) => !Number.isNaN(n))) {
    if (
      parts[0] === 127 ||
      parts[0] === 10 ||
      parts[0] === 0 ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168) ||
      (parts[0] === 169 && parts[1] === 254)
    ) {
      return true;
    }
  }
  return false;
}

function localNewsProxyPlugin(): Plugin {
  const handler = async (req: any, res: any, next: () => void) => {
    const reqUrl = req.url || "";
    if (!reqUrl.startsWith("/api/news-proxy")) {
      next();
      return;
    }

    res.setHeader("Content-Type", "application/json; charset=utf-8");
    try {
      const parsedReq = new URL(reqUrl, "http://localhost");
      const target = parsedReq.searchParams.get("url")?.trim() || "";
      if (!target || !/^https?:\/\//i.test(target)) {
        res.statusCode = 400;
        res.end(JSON.stringify({ ok: false, error: "Valid http/https url parameter is required." }));
        return;
      }

      const targetParsed = new URL(target);
      if (isBlockedHost(targetParsed.hostname)) {
        res.statusCode = 403;
        res.end(JSON.stringify({ ok: false, error: "Target host is not allowed." }));
        return;
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 14000);
      try {
        const upstream = await fetch(target, {
          signal: controller.signal,
          redirect: "follow",
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
            Accept:
              "text/html,application/xhtml+xml,application/rss+xml,application/atom+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "mr-IN,mr;q=0.9,en-IN;q=0.8,en;q=0.7",
          },
        });
        const body = await upstream.text();
        res.statusCode = 200;
        res.end(
          JSON.stringify({
            ok: upstream.ok,
            status: upstream.status,
            finalUrl: upstream.url || target,
            contentType: upstream.headers.get("content-type") || "",
            body,
          }),
        );
      } finally {
        clearTimeout(timer);
      }
    } catch (err: any) {
      res.statusCode = 502;
      res.end(JSON.stringify({ ok: false, error: err?.message || "Failed to fetch target URL." }));
    }
  };

  return {
    name: "local-news-proxy",
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    localNewsProxyPlugin(),
    react(),
    mcpPlugin(),
    mode === "development" && componentTagger(),
    // Service worker for offline support.
    // - injectRegister: null — the only registrar is src/lib/pwa/register.ts,
    //   which refuses to register in dev, iframes, and Lovable preview hosts.
    // - devOptions.enabled: false — never emit a SW in dev to avoid
    //   poisoning the editor preview.
    // - registerType: autoUpdate — new SW activates on next navigation.
    VitePWA({
      strategies: "generateSW",
      registerType: "autoUpdate",
      injectRegister: null,
      devOptions: { enabled: false },
      filename: "sw.js",
      manifest: false, // we ship public/manifest.json by hand
      workbox: {
        // Precache the built app shell.
        globPatterns: ["**/*.{js,css,html,svg,png,ico,webp,woff2}"],
        // Don't precache giant prerendered shop HTMLs (we runtime-cache them),
        // or social share previews (og-image.png is 1.65 MB and only for external crawlers).
        globIgnores: ["**/shop/**/index.html", "og-image.png"],
        navigateFallback: "/index.html",
        // Auth/OAuth and admin must always hit the network — never serve stale.
        navigateFallbackDenylist: [
          /^\/\.lovable\/oauth/,
          /^\/oauth\/consent/,
          /^\/~oauth/,
          /^\/admin/,
          /^\/auth/,
          /^\/reset-password/,
        ],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        runtimeCaching: [
          {
            // HTML navigations — network-first so deploys roll out fast.
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: {
              cacheName: "html-nav",
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
          {
            // Bus timetable + bus stand info — keep last good copy for 7 days
            // so the page opens with last-seen times when offline.
            urlPattern: ({ url }) =>
              url.hostname.endsWith(".supabase.co") &&
              url.pathname.startsWith("/rest/v1/") &&
              (url.search.includes("bus_timetable") ||
                url.search.includes("bus_stand_info") ||
                url.pathname.includes("bus_timetable") ||
                url.pathname.includes("bus_stand_info")),
            handler: "NetworkFirst",
            options: {
              cacheName: "bus-data",
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Shop & banner images from Supabase storage (both raw and transformed).
            urlPattern: ({ url }) =>
              url.hostname.endsWith(".supabase.co") &&
              (url.pathname.includes("/storage/v1/object/public/shop-images/") ||
                url.pathname.includes("/storage/v1/render/image/public/shop-images/")),
            handler: "CacheFirst",
            options: {
              cacheName: "shop-images",
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Google Fonts (Devanagari).
            urlPattern: ({ url }) =>
              url.hostname === "fonts.googleapis.com" ||
              url.hostname === "fonts.gstatic.com",
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "google-fonts",
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
