import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  cacheOnFrontEndNav: true,
  workboxOptions: {
    navigateFallback: "/offline.html",
    navigateFallbackDenylist: [/^\/api\//],
    runtimeCaching: [
      { urlPattern: ({ request, url }) => request.mode === "navigate" && !url.pathname.startsWith("/api/"), handler: "StaleWhileRevalidate", options: { cacheName: "naxa-navigation", networkTimeoutSeconds: 3, expiration: { maxEntries: 20, maxAgeSeconds: 7 * 24 * 60 * 60 }, cacheableResponse: { statuses: [0, 200] } } }
    ]
  },
});

export default withPWA({ reactStrictMode: true });
