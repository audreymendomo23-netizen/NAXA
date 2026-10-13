"use client";
import { useEffect } from "react";
export function CacheVersionGuard() {
  useEffect(() => {
    let active = true;
    const clean = async () => {
      if (!("caches" in window)) return;
      try {
        const names = await window.caches.keys();
        await Promise.all(names.filter(name => name === "naxa-pharmacy-login" || name === "naxa-navigation").map(name => window.caches.delete(name)));
        if (active) {
          const registration = await navigator.serviceWorker?.getRegistration();
          void registration?.update().catch(() => undefined);
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
