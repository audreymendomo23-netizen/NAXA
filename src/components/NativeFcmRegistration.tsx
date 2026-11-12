"use client";

import { useEffect } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

/** Synchronise le jeton FCM natif avec le compte Supabase actif, quelle que soit la page ouverte. */
export function NativeFcmRegistration() {
  useEffect(() => {
    const native = (window as any).NaxaAndroid;
    if (!native?.isAvailable?.() || native.isFcmAvailable?.() !== true) return;

    const supabase = supabaseBrowser();
    let token = "";
    let disposed = false;

    const register = async (value: string, accessToken?: string) => {
      if (disposed || value.length < 100) return;
      const bearer = accessToken || (await supabase.auth.getSession()).data.session?.access_token;
      if (!bearer) return;
      try {
        const response = await fetch("/api/notifications/fcm/register", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${bearer}` },
          body: JSON.stringify({ token: value }),
        });
        if (response.ok && !disposed) {
          window.dispatchEvent(new CustomEvent("naxa-fcm-registered"));
        }
      } catch {
        // Une indisponibilité réseau sera retentée au prochain retour au premier plan.
      }
    };

    const receiveToken = (event: Event) => {
      token = String((event as CustomEvent).detail?.token ?? "");
      void register(token);
    };
    const receiveNative = (event: Event) => {
      const detail = (event as CustomEvent).detail ?? {};
      if (detail.type === "notificationPermissionGranted") native.refreshFcmToken?.();
    };
    const refresh = () => {
      if (native.hasNotificationPermission?.() !== true) return;
      const saved = String(native.getFcmToken?.() ?? "");
      if (saved.length >= 100) {
        token = saved;
        void register(saved);
      }
      native.refreshFcmToken?.();
    };

    window.addEventListener("naxa-fcm-token", receiveToken);
    window.addEventListener("naxa-android-ble", receiveNative);
    document.addEventListener("visibilitychange", refresh);
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token && token.length >= 100) void register(token, session.access_token);
    });
    refresh();

    return () => {
      disposed = true;
      authListener.subscription.unsubscribe();
      window.removeEventListener("naxa-fcm-token", receiveToken);
      window.removeEventListener("naxa-android-ble", receiveNative);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  return null;
}
