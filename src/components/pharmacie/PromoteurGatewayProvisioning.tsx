 "use client";

import { useState } from "react";

export function PromoteurGatewayProvisioning({ gatewayId, gatewayLabel, tunnelStatus }: {
  gatewayId: string;
  gatewayLabel: string;
  tunnelStatus: string;
}) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [token, setToken] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [copied, setCopied] = useState(false);

  async function createCode() {
    setLoading(true);
    setMessage("");
    setToken("");
    setExpiresAt("");
    setCopied(false);
    try {
      const response = await fetch("/api/security/gateway/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gatewayId }),
        cache: "no-store",
      });
      const result = await response.json().catch(() => ({})) as { token?: string; expiresAt?: string; error?: string };
      if (!response.ok || !result.token || !result.expiresAt) {
        setMessage(result.error || "Création du code impossible.");
        return;
      }
      setToken(result.token);
      setExpiresAt(result.expiresAt);
      setMessage("Code créé. Il ne sera plus affiché après fermeture de cette page.");
    } catch {
      setMessage("Le serveur NAXA n'a pas pu être joint.");
    } finally {
      setLoading(false);
    }
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
    } catch {
      setMessage("Copie automatique refusée. Sélectionnez le code affiché et copiez-le manuellement.");
    }
  }

  return (
    <div className="mt-2 rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-bold">{gatewayLabel}</p>
          <p className="text-xs text-slate-500">Passerelle · {tunnelStatus}</p>
        </div>
        <button type="button" disabled={loading}
          onClick={createCode}
          className="min-h-10 rounded-full border border-naxa-green-800 px-3 text-xs font-bold text-naxa-green-900 disabled:opacity-50">
          {loading ? "Création…" : "Créer un code de jumelage"}
        </button>
      </div>
      {message && <p role="status" className="mt-2 text-xs leading-5 text-slate-700">{message}</p>}
      {token && (
        <div className="mt-3 rounded-lg bg-slate-50 p-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-amber-900">Code à usage unique</p>
          <code className="mt-1 block break-all select-all text-sm font-bold text-slate-950">{token}</code>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate-600">Expire : {new Date(expiresAt).toLocaleString("fr-FR")}</p>
            <button type="button" onClick={copyCode} className="min-h-9 rounded-full bg-naxa-green-900 px-3 text-xs font-bold text-white">
              {copied ? "Copié" : "Copier le code"}
            </button>
          </div>
          <p className="mt-2 text-xs leading-5 text-amber-900">Transmettez ce code uniquement à la personne qui installe physiquement la passerelle. Ne le publiez pas dans un ticket ou une messagerie de groupe.</p>
        </div>
      )}
    </div>
  );
}
