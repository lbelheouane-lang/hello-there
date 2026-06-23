// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    plugins: [
      VitePWA({
        registerType: "autoUpdate",
        injectRegister: null,
        filename: "sw.js",
        devOptions: { enabled: false },
        manifest: {
          name: "Orus",
          short_name: "Orus",
          description: "Professional Jewelry Store Management System",
          theme_color: "#1a1a1a",
          background_color: "#1a1a1a",
          display: "standalone",
          orientation: "portrait-primary",
          start_url: "/",
          scope: "/",
          icons: [
            { src: "/icons/app-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
            { src: "/icons/app-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
            { src: "/icons/app-icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
            { src: "/icons/app-icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          ],
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],
          navigateFallback: null,
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          navigationPreload: true,
          runtimeCaching: [
            {
              urlPattern: ({ request }) => request.mode === "navigate",
              handler: "NetworkFirst",
              options: {
                cacheName: "orus-pages",
                networkTimeoutSeconds: 5,
                expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 },
              },
            },
            {
              urlPattern: ({ url, sameOrigin }) =>
                sameOrigin && /\.(?:js|css|woff2?|png|svg|ico)$/.test(url.pathname),
              handler: "CacheFirst",
              options: {
                cacheName: "orus-assets",
                expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
          ],
        },
      }),
    ],
  },
});
