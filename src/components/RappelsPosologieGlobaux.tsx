"use client";

import { useEffect, useState } from "react";
import { notifierNAXA } from "@/components/NotificationGlobale";
import { supabaseBrowser } from "@/lib/supabase/client";

type RappelEnregistre = {
  id: string;
  medicament: string;
  dose: string;
  unite: string;
  heures: string[];
  rappels: boolean;
};

const CLE_PREFIXE = "naxa:posologies:";

function dateLocale(date: Date) {
  return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
}

export function RappelsPosologieGlobaux() {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let actif = true;
    const client = supabaseBrowser();
    void client.auth.getUser().then(({ data: { user } }) => {
      if (actif) setUserId(user?.id ?? null);
    });
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null);
    });
    return () => {
      actif = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!userId) return;
    const verifier = () => {
      try {
        const raw = localStorage.getItem(CLE_PREFIXE + userId);
        if (!raw) return;
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) return;
        const now = new Date();
        const heure = String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
        const date = dateLocale(now);
        for (const item of parsed as RappelEnregistre[]) {
          if (!item || item.rappels !== true || !Array.isArray(item.heures) || !item.heures.includes(heure)) continue;
          const key = "naxa:posologie-notifie:" + userId + ":" + date + ":" + item.id + ":" + heure;
          if (localStorage.getItem(key)) continue;
          localStorage.setItem(key, "1");
          const message = "Rappel de prise : " + item.medicament + " — " + item.dose + " " + item.unite + ".";
          notifierNAXA(message);
          // La fée ne reçoit qu’un signal de présence, jamais le texte ou les données du rappel.
          window.dispatchEvent(new CustomEvent("naxa:fairy", { detail: { type: "reminder", state: "active" } }));
          if ("Notification" in window && Notification.permission === "granted") {
            try {
              new Notification("Rappel de prise — NAXA", {
                body: item.medicament + " : " + item.dose + " " + item.unite + ".",
                icon: "/icon-192.png",
                tag: item.id + "-" + heure,
              });
            } catch {
              // Le rappel dans l’interface reste disponible si la notification système échoue.
            }
          }
        }
      } catch {
        // Une donnée locale illisible ne doit pas bloquer le reste de l’application.
      }
    };
    verifier();
    const timer = window.setInterval(verifier, 15000);
    return () => window.clearInterval(timer);
  }, [userId]);

  return null;
}
