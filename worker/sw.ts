import {
  CacheableResponsePlugin,
  ExpirationPlugin,
  NetworkFirst,
  Serwist,
  StaleWhileRevalidate,
} from "serwist";
import type { PrecacheEntry, RuntimeCaching, SerwistGlobalConfig } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const publicNavigationPaths = new Set([
  "/",
  "/catalogue",
  "/recherche",
  "/pharmacies",
  "/medicaments",
]);

const runtimeCaching = [
  {
    matcher: ({ request, url }) =>
      request.destination === "image" &&
      (url.hostname === "upload.wikimedia.org" ||
        url.hostname === "commons.wikimedia.org" ||
        (url.hostname.endsWith(".supabase.co") &&
          url.pathname.includes("/storage/v1/object/public/"))),
    handler: new StaleWhileRevalidate({
      cacheName: "naxa-medicine-images-v2",
      plugins: [
        new ExpirationPlugin({
          maxEntries: 250,
          maxAgeSeconds: 30 * 24 * 60 * 60,
        }),
        new CacheableResponsePlugin({ statuses: [0, 200] }),
      ],
    }),
  },
  {
    matcher: ({ request, url }) =>
      request.mode === "navigate" && url.pathname === "/connexion",
    handler: new NetworkFirst({
      cacheName: "naxa-pharmacy-login-v5",
      networkTimeoutSeconds: 5,
      plugins: [
        new ExpirationPlugin({
          maxEntries: 5,
          maxAgeSeconds: 90 * 24 * 60 * 60,
        }),
        new CacheableResponsePlugin({ statuses: [200] }),
      ],
    }),
  },
  {
    matcher: ({ request, url }) =>
      request.mode === "navigate" && publicNavigationPaths.has(url.pathname),
    handler: new NetworkFirst({
      cacheName: "naxa-navigation-public-v1",
      networkTimeoutSeconds: 8,
      plugins: [
        new ExpirationPlugin({
          maxEntries: 30,
          maxAgeSeconds: 7 * 24 * 60 * 60,
        }),
        new CacheableResponsePlugin({ statuses: [200] }),
      ],
    }),
  },
] satisfies RuntimeCaching[];

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  cacheId: "naxa-production-refresh-20261106",
  precacheOptions: {
    cleanupOutdatedCaches: true,
  },
  runtimeCaching,
  fallbacks: {
    entries: [
      {
        url: "/offline.html",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    const obsolete = names.filter((name) =>
      name.startsWith("naxa-pharmacy-login-v4") ||
      name.startsWith("naxa-navigation-v4") ||
      name.startsWith("naxa-production-refresh-20261018")
    );
    await Promise.all(obsolete.map((name) => caches.delete(name)));
  })());
});

serwist.addEventListeners();
