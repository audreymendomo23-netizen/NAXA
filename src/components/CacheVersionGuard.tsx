"use client";
import { useEffect } from "react";
export function CacheVersionGuard() {
  useEffect(() => {
    let active = true;
    const clean = async () => {
      if (!("caches" in window)) return;
      try {
        const names = await window.caches.keys();
        await Promise.all(names.filter(name =>
          name.startsWith("naxa-pharmacy-login") || name.startsWith("naxa-navigation")
        ).map(name => window.caches.delete(name)));
        if (active && "serviceWorker" in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map(registration => registration.update().catch(() => undefined)));
        }
      } catch {
        // Le site reste utilisable si le navigateur refuse la gestion du cache.
      }
    };
    void clean();
    return () => { active = false; };
  }, []);
  return null;
}
