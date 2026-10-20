"use client";

import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

export type NotificationNaxa = { id: string; type: string; titre: string; corps: string; fil_id: string | null; pharmacie_id?: string | null; reservation_id?: string | null; lu_le: string | null; created_at: string };

export function useNotifications() {
  const [items, setItems] = useState<NotificationNaxa[]>([]);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState("");
  const charger = useCallback(async () => {
    const sb = supabaseBrowser();
    const { data: auth } = await sb.auth.getUser();
    if (!auth.user) { setItems([]); setLoading(false); return; }
    const { data, error } = await sb.from("notifications").select("id,type,titre,corps,fil_id,pharmacie_id,reservation_id,lu_le,created_at").order("created_at", { ascending: false }).limit(50);
    if (error) setErreur("Notifications indisponibles pour le moment.");
    else setItems((data ?? []) as NotificationNaxa[]);
    setLoading(false);
  }, []);
  useEffect(() => {
    void charger();
    const sb = supabaseBrowser();
    const channel = sb.channel("naxa-notifications").on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, payload => {
      const n = payload.new as NotificationNaxa;
      setItems(old => [n, ...old.filter(x => x.id !== n.id)].slice(0, 50));
      if (typeof document !== "undefined" && document.visibilityState !== "visible" && typeof Notification !== "undefined" && Notification.permission === "granted") new Notification(n.titre, { body: n.corps });
    }).subscribe();
    return () => { void sb.removeChannel(channel); };
  }, [charger]);
  const marquerLue = useCallback(async (id: string) => {
    const sb = supabaseBrowser();
    const { data, error } = await sb.rpc("mark_user_notification_read", { p_notification_id: id });
    if (error || data !== true) {
      setErreur("Impossible de marquer cette notification comme lue pour le moment.");
      return false;
    }
    setItems(old => old.map(item => item.id === id ? { ...item, lu_le: item.lu_le ?? new Date().toISOString() } : item));
    return true;
  }, []);

  return { items, nonLus: items.filter(n => !n.lu_le).length, loading, erreur, actualiser: charger, marquerLue };
}
