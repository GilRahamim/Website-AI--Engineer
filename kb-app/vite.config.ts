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
      // workbox.globPatterns defaults to the built JS/CSS/HTML app shell —
      // that IS this sub-project's whole precache scope. Runtime caching
      // for topic-content/topic-assets and precaching the static data
      // JSON files are sub-project #2's job, not this one — do not add
      // workbox.runtimeCaching or extend globPatterns here.
    }),
  ],
});
