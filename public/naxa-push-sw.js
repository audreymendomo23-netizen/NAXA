self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }
  const pattern = Array.isArray(payload.vibrate)
    ? payload.vibrate.filter((value) => Number.isInteger(value) && value >= 0 && value <= 2000).slice(0, 8)
    : [180, 80, 180];
  event.waitUntil(self.registration.showNotification(payload.title || "Notification NAXA", {
    body: payload.body || "Une nouvelle notification vous attend. Ouvrez NAXA pour la consulter.",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: payload.tag || "naxa-notification",
    renotify: true,
    vibrate: pattern,
    data: {
      url: typeof payload.url === "string" ? payload.url : "/notifications",
      type: typeof payload.type === "string" ? payload.type : "naxa",
    },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  let target;
  try {
    target = new URL(event.notification.data?.url || "/notifications", self.location.origin);
    if (target.origin !== self.location.origin) target = new URL("/notifications", self.location.origin);
  } catch {
    target = new URL("/notifications", self.location.origin);
  }
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if (client.url.startsWith(self.location.origin)) {
        await client.focus();
        if ("navigate" in client) await client.navigate(target.href);
        return;
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(target.href);
  })());
});
