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
    let lastAccessToken = "";
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
          lastAccessToken = bearer;
          window.dispatchEvent(new CustomEvent("naxa-fcm-registered"));
        }
      } catch {
        // Une indisponibilité réseau sera retentée au prochain retour au premier plan.
      }
    };

    const unregister = async (value: string, accessToken: string) => {
      if (disposed || value.length < 100 || !accessToken) return;
      try {
        await fetch("/api/notifications/fcm/register", {
          method: "DELETE",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ token: value }),
        });
      } catch {
        // Le serveur purge également les jetons invalides lors d'un envoi FCM.
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
      const saved = String(native.getFcmToken?.() ?? "");
      if (native.hasNotificationPermission?.() !== true) {
        if (saved.length >= 100) {
          token = saved;
          void supabase.auth.getSession().then(({ data }) => {
            if (data.session?.access_token) void unregister(saved, data.session.access_token);
          });
        }
        return;
      }
      if (saved.length >= 100) {
        token = saved;
        void register(saved);
      }
      native.refreshFcmToken?.();
    };

    window.addEventListener("naxa-fcm-token", receiveToken);
    window.addEventListener("naxa-android-ble", receiveNative);
    document.addEventListener("visibilitychange", refresh);
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.access_token) {
        lastAccessToken = session.access_token;
        if (token.length >= 100) void register(token, session.access_token);
      } else if (event === "SIGNED_OUT" && token.length >= 100 && lastAccessToken) {
        void unregister(token, lastAccessToken);
        lastAccessToken = "";
      }
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
