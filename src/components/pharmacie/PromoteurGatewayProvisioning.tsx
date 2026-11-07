 "use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
  const [showRevokeForm, setShowRevokeForm] = useState(false);
  const [revokeReason, setRevokeReason] = useState("");
  const [revoking, setRevoking] = useState(false);
  const router = useRouter();

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

  async function revokeGateway() {
    const reason = revokeReason.trim();
    if (reason.length < 10 || reason.length > 500) {
      setMessage("Indiquez une justification de 10 à 500 caractères.");
      return;
    }
    if (!window.confirm("Révoquer cette passerelle ? NAXA refusera ses prochains heartbeats. Cette action n'arrête pas physiquement l'équipement.")) {
      return;
    }
    setRevoking(true);
    setMessage("");
    try {
      const response = await fetch("/api/security/gateway/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gatewayId, reason }),
        cache: "no-store",
      });
      const result = await response.json().catch(() => ({})) as {
        ok?: boolean; tunnelStatus?: string; enrollmentKeysRevoked?: boolean; auditLogged?: boolean; note?: string; error?: string;
      };
      if (result.tunnelStatus === "revoked") {
        setToken("");
        setExpiresAt("");
        setShowRevokeForm(false);
        setRevokeReason("");
        setMessage(response.ok && result.ok
          ? result.note || "Passerelle révoquée et clés invalidées."
          : result.error || "Passerelle révoquée côté serveur ; nettoyage ou audit incomplet.");
        router.refresh();
      } else {
        setMessage(result.error || "Révocation impossible.");
      }
    } catch {
      setMessage("Le serveur NAXA n'a pas pu confirmer la révocation.");
    } finally {
      setRevoking(false);
    }
  }

  return (
    <div className="mt-2 rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-bold">{gatewayLabel}</p>
          <p className="text-xs text-slate-500">Passerelle · {tunnelStatus}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" disabled={loading || revoking || tunnelStatus === "revoked"}
            onClick={createCode}
            className="min-h-10 rounded-full border border-naxa-green-800 px-3 text-xs font-bold text-naxa-green-900 disabled:opacity-50">
            {tunnelStatus === "revoked" ? "Passerelle révoquée" : loading ? "Création…" : "Créer un code de jumelage"}
          </button>
          {tunnelStatus !== "revoked" && (
            <button type="button" disabled={loading || revoking}
              onClick={() => { setShowRevokeForm((value) => !value); setToken(""); setExpiresAt(""); }}
              className="min-h-10 rounded-full border border-red-300 px-3 text-xs font-bold text-red-800 disabled:opacity-50">
              Révoquer
            </button>
          )}
        </div>
      </div>
      {message && <p role="status" className="mt-2 text-xs leading-5 text-slate-700">{message}</p>}
      {showRevokeForm && tunnelStatus !== "revoked" && (
        <div className="mt-3 space-y-2 rounded-lg border border-red-200 bg-red-50 p-3">
          <label className="block text-xs font-bold text-red-950">
            Justification de la révocation
            <textarea value={revokeReason} onChange={(event) => setRevokeReason(event.target.value)}
              maxLength={500} rows={3} placeholder="Ex. Passerelle remplacée, équipement perdu ou suspicion de compromission."
              className="mt-1 w-full rounded-lg border border-red-200 bg-white p-2 text-sm font-normal text-slate-900" />
          </label>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] text-red-800">{revokeReason.trim().length}/500 caractères · minimum 10</span>
            <button type="button" disabled={revoking || revokeReason.trim().length < 10}
              onClick={revokeGateway}
              className="min-h-10 rounded-full bg-red-700 px-4 text-xs font-bold text-white disabled:opacity-50">
              {revoking ? "Révocation…" : "Confirmer la révocation"}
            </button>
          </div>
          <p className="text-[11px] leading-5 text-red-900">NAXA refusera les heartbeats signés de cette passerelle et invalidera ses codes et clés enregistrés. Cette action ne coupe pas l’alimentation électrique et ne commande pas encore les caméras physiquement.</p>
        </div>
      )}
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
