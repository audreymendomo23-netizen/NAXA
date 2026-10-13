self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const obsolete = new Set(["naxa-pharmacy-login", "naxa-navigation"]);
    const names = await caches.keys();
    await Promise.all(names.filter((name) => obsolete.has(name)).map((name) => caches.delete(name)));
  })());
});
