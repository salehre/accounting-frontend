import tailwindcss from '@tailwindcss/vite'

const backend = process.env.BACKEND_URL ?? 'http://localhost:8000'

export default defineNuxtConfig({
  compatibilityDate: '2026-11-01',
  ssr: false, // a pure single-page app: Laravel is the only server
  devtools: { enabled: true },

  // components are grouped in folders (ui/, layout/, ...) but keep short names: <AppButton>, not <UiAppButton>
  components: [{ path: '~/components', pathPrefix: false }],

  modules: ['@nuxtjs/i18n', '@pinia/nuxt'],
  css: ['~/assets/css/main.css', 'vue-sonner/style.css'],

  vite: {
    plugins: [tailwindcss()],
  },

  runtimeConfig: {
    public: {
      apiBase: '/api',
      tenancy: 'multi', // overridden by NUXT_PUBLIC_TENANCY
    },
  },

  // In development the browser talks to Nuxt only (same origin), and Nuxt forwards /api and /sanctum
  // to Laravel. Same origin is what makes the cookie session and the CSRF cookie work without CORS.
  nitro: {
    devProxy: {
      '/api': { target: `${backend}/api` },
      '/sanctum': { target: `${backend}/sanctum` },
    },
  },

  i18n: {
    defaultLocale: 'fa',
    strategy: 'no_prefix', // the language is a setting, not part of the address
    locales: [
      { code: 'fa', language: 'fa-IR', name: 'فارسی', dir: 'rtl', file: 'fa.json' },
      { code: 'en', language: 'en-US', name: 'English', dir: 'ltr', file: 'en.json' },
      { code: 'ar', language: 'ar', name: 'العربية', dir: 'rtl', file: 'ar.json' },
    ],
    // always start in Persian; the person's own choice is remembered in a cookie (see app.vue)
    detectBrowserLanguage: false,
  },
})