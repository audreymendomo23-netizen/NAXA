"use client";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function SuppressionCompteClient() {
  const [confirmation, setConfirmation] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function supprimer() {
    if (confirmation !== "SUPPRIMER" || !password || busy) return;
    setBusy(true); setError("");
    try {
      const { data: { session } } = await supabaseBrowser().auth.getSession();
      if (!session?.access_token) { setError("Votre session a expiré. Reconnectez-vous puis réessayez."); setBusy(false); return; }
      const response = await fetch("/api/account/delete", { method:"POST", headers:{ "Content-Type":"application/json", Authorization:"Bearer " + session.access_token }, body:JSON.stringify({ confirmation, password }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) { setError(result.error || "La suppression n’a pas pu être effectuée. Réessayez plus tard."); setBusy(false); return; }
      await supabaseBrowser().auth.signOut();
      window.location.replace("/");
    } catch { setError("La suppression n’a pas pu être effectuée. Réessayez plus tard."); setBusy(false); }
  }
  return <div className="space-y-4">
    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
      <h2 className="font-bold">Suppression définitive du compte client</h2>
      <p className="mt-2">Cette action est irréversible. Les informations nécessaires aux obligations légales ou à la traçabilité des réservations peuvent être conservées sous une forme dissociée de votre compte. Elle ne supprime pas le compte d’une pharmacie.</p>
    </div>
    <label className="block text-sm font-semibold">Mot de passe actuel du compte
      <input className="champ mt-1" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required />
    </label>
    <label className="block text-sm font-semibold">Saisissez SUPPRIMER pour confirmer
      <input className="champ mt-1" autoComplete="off" value={confirmation} onChange={e => setConfirmation(e.target.value)} required />
    </label>
    <button type="button" disabled={busy || confirmation !== "SUPPRIMER" || !password} onClick={() => void supprimer()} className="w-full rounded-xl bg-red-700 px-4 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Vérification et suppression…" : "Vérifier le mot de passe et supprimer mon compte"}</button>
    {error && <p role="alert" className="naxa-delete-error text-sm text-red-700">{error}</p>}
  </div>;
}
