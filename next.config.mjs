import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  cacheOnFrontEndNav: true,
  cacheId: "naxa-design-20261013",
  skipWaiting: true,
  clientsClaim: true,
  cleanupOutdatedCaches: true,
  customWorkerDir: "worker",
  workboxOptions: {
    navigateFallback: "/offline.html",
    // La connexion pharmacie doit être servie par le réseau quand il est disponible.
    // Hors ligne, la stratégie NetworkFirst peut réutiliser la dernière réponse en cache.
    navigateFallbackDenylist: [/^\/api\//, /^\/connexion(?:\/|$)/],
    runtimeCaching: [
      {
        urlPattern: ({ request, url }) =>
          request.mode === "navigate" && url.pathname === "/connexion",
        handler: "NetworkFirst",
        options: {
          cacheName: "naxa-pharmacy-login-v2",
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
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "naxa-navigation-v2",
          expiration: {
            maxEntries: 20,
            maxAgeSeconds: 7 * 24 * 60 * 60,
          },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
    ],
  },
});

export default withPWA({ reactStrictMode: true });
