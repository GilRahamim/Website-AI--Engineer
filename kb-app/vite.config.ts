import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // A static public/manifest.webmanifest is already shipped (see
      // Task 2) — this plugin only needs to generate the service worker,
      // not a manifest of its own.
      manifest: false,
      includeAssets: ['favicon.png', 'icons/*.png'],
      // Lets the service worker be exercised under `npm run dev`, not
      // only `npm run build && npm run preview`.
      devOptions: { enabled: true },
      workbox: {
        // workbox-build's own default globPatterns ("**/*.{js,wasm,css,html}"
        // against the whole dist/ tree) would otherwise sweep every
        // topic-content/*.html file into the install-time precache manifest
        // (confirmed: 160 files, ~1.4MB) — precaching topic content/images
        // outright isn't what we want (below is the deliberate, on-demand
        // alternative), so both directories stay excluded from the precache.
        globIgnores: ['**/topic-content/**', '**/topic-assets/**'],
        // Runtime caching: once a topic's HTML or an image has been
        // fetched once (the user opened that topic while online), every
        // future request for that exact URL is served from the cache —
        // works fully offline. No expiration cap: the full dataset (160
        // HTML files + 240 images) is ~5.9MB total, small enough that an
        // eviction policy isn't worth the complexity.
        runtimeCaching: [
          {
            urlPattern: /\/topic-content\/.+\.html$/,
            handler: 'CacheFirst',
            options: { cacheName: 'topic-content' },
          },
          {
            urlPattern: /\/topic-assets\/.+\.png$/,
            handler: 'CacheFirst',
            options: { cacheName: 'topic-assets' },
          },
        ],
      },
    }),
  ],
  build: {
    // Vite's default 500 kB warning doesn't fit this app well: the main
    // chunk (518.93 kB minified as of this commit) is dominated by
    // ~270KB raw of static Hebrew-text JSON (topics.clean.json +
    // search-index.json, eagerly loaded by Home/Reader by design) rather
    // than unsplit route code — Flashcards/Quiz/Map are already isolated
    // into their own lazy-loaded chunks. That JSON content compresses
    // very well: the whole remaining chunk is only 141.39 kB gzip, a
    // perfectly reasonable transfer size. Raised to 600 so a genuine
    // future bloat regression (a real jump past this documented baseline)
    // still surfaces, without warning on content that was always going
    // to be this size.
    chunkSizeWarningLimit: 600,
  },
});
