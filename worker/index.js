self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    const obsolete = names.filter((name) =>
      name.startsWith("naxa-pharmacy-login") || name.startsWith("naxa-navigation")
    );
    await Promise.all(obsolete.map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});
