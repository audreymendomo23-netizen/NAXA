"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

export function AlerteDisponibilite({ produitId, langue = "fr" }: { produitId: string; langue?: "fr" | "en" }) {
  const [state, setState] = useState<"idle" | "loading" | "active" | "error">("idle");
  const [message, setMessage] = useState("");

  async function activer() {
    setState("loading");
    setMessage("");
    try {
      const supabase = supabaseBrowser();
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session?.access_token) throw new Error(langue === "fr" ? "Connectez-vous pour recevoir cette alerte." : "Sign in to receive this alert.");
      const response = await fetch("/api/medicaments/alerte-disponibilite", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` },
        body: JSON.stringify({ produitId }),
      });
      const payload = await response.json().catch(() => ({})) as { message?: string; error?: string };
      if (!response.ok) throw new Error(payload.error || (langue === "fr" ? "Activation impossible." : "Could not activate alert."));
      setState("active");
      setMessage(payload.message || (langue === "fr" ? "Alerte activée." : "Alert enabled."));
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : (langue === "fr" ? "Activation impossible." : "Could not activate alert."));
    }
  }

  return (
    <div className="mt-2">
      <button type="button" onClick={() => void activer()} disabled={state === "loading" || state === "active"}
        className="btn btn-clair w-full" aria-live="polite">
        {state === "loading"
          ? (langue === "fr" ? "Activation…" : "Enabling…")
          : state === "active"
            ? (langue === "fr" ? "Alerte de disponibilité activée" : "Availability alert enabled")
            : (langue === "fr" ? "M’alerter dès que disponible" : "Notify me when available")}
      </button>
      {message && <p role={state === "error" ? "alert" : "status"} className="mt-1 text-xs text-slate-600">{message}</p>}
    </div>
  );
}
