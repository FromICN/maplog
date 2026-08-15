import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * GitHub Pages project sites are served from /<repo>/, so the base path comes
 * from the environment. Everything downstream — asset URLs, the manifest, the
 * service worker scope — is derived from it, and `BASE_URL` carries it into the
 * runtime fetches for the map grid and city chunks.
 */
const base = process.env.VITE_BASE ?? '/'

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'],
      manifest: {
        name: 'MapLog · 발자국 지도',
        short_name: 'MapLog',
        description: '다녀온 나라와 도시를 도트 지도로 기록합니다.',
        lang: 'ko',
        // Relative so the manifest works at the root or under a repo path.
        start_url: '.',
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0B0F14',
        theme_color: '#0B0F14',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // The shell, the world grid and the country registry ship up front.
        globPatterns: [
          // `bin` is the world grid — without it the map is blank offline.
          '**/*.{js,css,html,svg,png,woff2,bin}',
          'data/countries.json',
          'data/cities/index.json',
        ],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        runtimeCaching: [
          {
            // 244 city chunks are 1.7 MB in total; only the ones you open are worth
            // storing, and once stored they work offline like everything else.
            urlPattern: ({ url }) => /\/data\/cities\/[A-Z]{2}\.json$/.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'maplog-cities',
              expiration: { maxEntries: 80 },
            },
          },
        ],
      },
    }),
  ],
})
