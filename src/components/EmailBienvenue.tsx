"use client";

import { useEffect, useRef, useState } from "react";

type Status = "sending" | "sent" | "failed";

export function EmailBienvenue({ onStatus }: { onStatus?: (status: Status) => void }) {
  const [status, setStatus] = useState<Status>("sending");
  const [message, setMessage] = useState("Vérification de l’envoi du courrier de bienvenue…");
  const attempted = useRef(false);

  async function send() {
    setStatus("sending");
    setMessage("Envoi du courrier de bienvenue en cours…");
    try {
      const response = await fetch("/api/auth/welcome-email", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const data = await response.json();
      if (!response.ok || data.sent !== true) throw new Error(data.error || "L’envoi n’a pas été confirmé.");
      setStatus("sent");
      setMessage("Courrier de bienvenue envoyé.");
      onStatus?.("sent");
    } catch {
      setStatus("failed");
      setMessage("L’envoi du courrier n’a pas été confirmé. Vous pouvez réessayer.");
      onStatus?.("failed");
    }
  }

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;
    void send();
  }, []);

  return (
    <div className="mt-4 rounded-2xl border border-teal-100 bg-white/90 p-3 text-sm text-slate-700" aria-live="polite">
      <p className="flex items-center gap-2">
        <span aria-hidden="true" className="text-lg">{status === "sent" ? "✉️" : status === "failed" ? "!" : "✉"}</span>
        <span>{message}</span>
      </p>
      {status === "failed" && <button type="button" className="mt-2 font-bold underline" onClick={() => void send()}>Réessayer l’envoi</button>}
    </div>
  );
}
