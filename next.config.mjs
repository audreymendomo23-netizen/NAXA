import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  cacheOnFrontEndNav: true,
  workboxOptions: {
    // Précharger les deux pages d’entrée pour qu’elles existent dès l’installation du SW.
    additionalManifestEntries: [
      { url: "/", revision: process.env.VERCEL_GIT_COMMIT_SHA || process.env.COMMIT_REF || "naxa-local" },
      { url: "/pharmacie", revision: process.env.VERCEL_GIT_COMMIT_SHA || process.env.COMMIT_REF || "naxa-local" },
    ],
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
          cacheName: "naxa-pharmacy-login",
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
          cacheName: "naxa-navigation",
          expiration: {
            maxEntries: 20,
            maxAgeSeconds: 90 * 24 * 60 * 60,
          },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
    ],
  },
});

export default withPWA({ reactStrictMode: true });
