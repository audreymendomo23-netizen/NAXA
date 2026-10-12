/* Stratégie complémentaire au worker généré par next-pwa. Cache la coque uniquement, jamais les réponses API ou les données authentifiées. */
const NAXA_SHELL_CACHE = "naxa-shell-v1";
const NAXA_SHELL = ["/connexion?espace=pharmacie", "/manifest.webmanifest"];
self.addEventListener("install", event => {
  event.waitUntil(caches.open(NAXA_SHELL_CACHE).then(cache => cache.addAll(["/manifest.webmanifest"])).then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith("naxa-shell-") && k !== NAXA_SHELL_CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/") || url.pathname.startsWith("/_next/")) return;
  if (url.pathname === "/connexion" || url.pathname === "/pharmacie") {
    event.respondWith(fetch(request).then(response => {
      if (response.ok && response.type === "basic") caches.open(NAXA_SHELL_CACHE).then(cache => cache.put(request, response.clone()));
      return response;
    }).catch(async () => (await caches.match(request)) || (await caches.match("/connexion?espace=pharmacie")) || Response.error()));
  }
});
