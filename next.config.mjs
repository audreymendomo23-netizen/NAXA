import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  cacheOnFrontEndNav: true,
  cacheId: "naxa-production-refresh-20261018",
  skipWaiting: true,
  clientsClaim: true,
  cleanupOutdatedCaches: true,
  customWorkerDir: "worker",
  workboxOptions: {
    // Ne pas déclarer offline.html comme navigateFallback : Workbox peut alors
    // le servir à chaque navigation non précachée, même quand le réseau est disponible.
    // Chaque page utilise plutôt NetworkFirst et sa copie en cache en secours.
    runtimeCaching: [
      {
        urlPattern: ({ request, url }) =>
          request.destination === "image" &&
          (url.hostname === "upload.wikimedia.org" ||
            url.hostname === "commons.wikimedia.org" ||
            url.hostname.endsWith(".supabase.co")),
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "naxa-medicine-images-v1",
          expiration: {
            maxEntries: 250,
            maxAgeSeconds: 30 * 24 * 60 * 60,
          },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
      {
        urlPattern: ({ request, url }) =>
          request.mode === "navigate" && url.pathname === "/connexion",
        handler: "NetworkFirst",
        options: {
          cacheName: "naxa-pharmacy-login-v4",
          networkTimeoutSeconds: 5,
          expiration: {
            maxEntries: 5,
            maxAgeSeconds: 90 * 24 * 60 * 60,
          },
          cacheableResponse: { statuses: [200] },
        },
      },
      {
        urlPattern: ({ request, url }) =>
          request.mode === "navigate" &&
          !url.pathname.startsWith("/api/") &&
          url.pathname !== "/connexion",
        handler: "NetworkFirst",
        options: {
          cacheName: "naxa-navigation-v4",
          networkTimeoutSeconds: 8,
          expiration: {
            maxEntries: 30,
            maxAgeSeconds: 7 * 24 * 60 * 60,
          },
          cacheableResponse: { statuses: [200] },
        },
      },
    ],
  },
});

export default withPWA({ reactStrictMode: true });
