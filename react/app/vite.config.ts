import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const pwaEnabled = env.VITE_ENABLE_PWA === 'true'

  return {
    plugins: [
      react(),
      ...(pwaEnabled ? [
        VitePWA({
          registerType: 'autoUpdate',
          includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'rahi-icon-192.png', 'rahi-icon-512.png'],
          manifest: {
            name: 'RAHI - Professional Service Network',
            short_name: 'RAHI',
            description: "India's Enterprise Blue-Collar Marketplace",
            theme_color: '#1e40af',
            background_color: '#0f172a',
            display: 'standalone',
            scope: '/',
            start_url: '/',
            orientation: 'portrait',
            categories: ['business', 'productivity'],
            icons: [
              {
                src: 'rahi-icon-192.png',
                sizes: '192x192',
                type: 'image/png',
              },
              {
                src: 'rahi-icon-512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'any maskable',
              }
            ]
          },
          workbox: {
            cleanupOutdatedCaches: true,
            clientsClaim: true,
            skipWaiting: true,
            maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
            globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
            runtimeCaching: [
              {
                urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'google-fonts-cache',
                  expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
                  cacheableResponse: { statuses: [0, 200] },
                },
              },
              {
                urlPattern: /^\/api\/.*/i,
                handler: 'NetworkFirst',
                options: {
                  cacheName: 'api-cache',
                  expiration: { maxEntries: 50, maxAgeSeconds: 60 * 5 },
                  cacheableResponse: { statuses: [0, 200] },
                },
              },
            ],
          },
          devOptions: {
            enabled: false,
          }
        })
      ] : [])
    ],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src')
      }
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined
            const normalizedId = id.replace(/\\/g, '/')
            const packagePath = normalizedId.split('/node_modules/').pop() || ''
            const packageName = packagePath.startsWith('@')
              ? packagePath.split('/').slice(0, 2).join('/')
              : packagePath.split('/')[0]

            if (['react', 'react-dom', 'scheduler'].includes(packageName)) return 'vendor-react'
            if (packageName.startsWith('@radix-ui') || packageName === 'lucide-react') return 'vendor-ui'
            if (packageName === 'react-router' || packageName === 'react-router-dom') return 'vendor-router'
            if (packageName === '@tanstack/react-query') return 'vendor-query'
            if (packageName === 'react-hook-form' || packageName.startsWith('@hookform')) return 'vendor-forms'
            if (packageName.includes('leaflet') || packageName.includes('mapbox')) return 'vendor-maps'
            if (packageName.includes('pdf') || packageName === 'mammoth') return 'vendor-docs'
            return 'vendor'
          }
        }
      }
    },
    define: {
      'process.env': {}
    }
  }
})
