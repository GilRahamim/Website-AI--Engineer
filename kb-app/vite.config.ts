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
        // (confirmed: 160 files, ~1.4MB) — precaching topic content/images is
        // a later, separate sub-project's job (it needs its own deliberate
        // runtime-caching strategy, not an accidental blanket precache), so
        // both directories are excluded here.
        globIgnores: ['**/topic-content/**', '**/topic-assets/**'],
      },
    }),
  ],
});
