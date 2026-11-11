import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";

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
