export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',

  future: {
    compatibilityVersion: 4,
  },

  modules: [
    '@nuxt/ui',
    '@vite-pwa/nuxt',
  ],

  colorMode: {
    preference: 'dark',
  },

  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
    superadminEmail: process.env.SUPERADMIN_EMAIL || 'admin@eventiny.app',
    superadminPassword: process.env.SUPERADMIN_PASSWORD || 'changeme',
    public: {
      appName: 'Eventiny',
    },
  },

  pwa: {
    manifest: {
      name: 'Eventiny — Dance Event Manager',
      short_name: 'Eventiny',
      theme_color: '#1e293b',
      background_color: '#0f172a',
      display: 'standalone',
      icons: [
        {
          src: '/icon-192.png',
          sizes: '192x192',
          type: 'image/png',
        },
        {
          src: '/icon-512.png',
          sizes: '512x512',
          type: 'image/png',
        },
      ],
    },
    workbox: {
      navigateFallback: undefined,
    },
  },

  devtools: { enabled: true },
})
