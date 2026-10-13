"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

type Props = { pharmacieId: string; produitId?: string | null; variante?: "flottant" | "bouton"; anonymeDefaut?: boolean };
export function ContacterPharmacie({ pharmacieId, produitId = null, variante = "bouton", anonymeDefaut = true }: Props) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [corps, setCorps] = useState("");
  const [anonyme, setAnonyme] = useState(anonymeDefaut);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");
  const [envoye, setEnvoye] = useState(false);
  async function envoyer() {
    if (!corps.trim() || envoi) return;
    setEnvoi(true); setErreur("");
    const sb = supabaseBrowser();
    const { data } = await sb.auth.getUser();
    if (!data.user) { router.push(`/connexion?retour=${encodeURIComponent(typeof window !== "undefined" ? window.location.pathname : "/")}`); return; }
    const { error } = await sb.rpc("envoyer_message_client", { p_pharmacie: pharmacieId, p_produit: produitId, p_corps: corps.trim(), p_anonyme: anonyme });
    setEnvoi(false);
    if (error) { setErreur("Envoi impossible. Vérifiez votre connexion et réessayez."); return; }
    setEnvoye(true); setCorps("");
  }
  return <>
    <button type="button" onClick={() => { setOuvert(true); setEnvoye(false); }} className={variante === "flottant" ? "fixed bottom-[5.5rem] right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-naxa-canari text-naxa-green-900 shadow-lg" : "btn btn-canari"} aria-label="Contacter la pharmacie">
      {variante === "flottant" ? <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 11.5a8.5 8.5 0 0 1-12.7 7.4L3 20l1.1-4.7A8.5 8.5 0 1 1 21 11.5Z"/><path d="M8 11h8M8 14h5"/></svg> : "Contacter"}
    </button>
    {ouvert && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center" role="presentation" onClick={e => { if (e.target === e.currentTarget) setOuvert(false); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="contact-pharmacie-title" className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between"><h2 id="contact-pharmacie-title" className="text-lg font-extrabold">Contacter la pharmacie</h2><button onClick={() => setOuvert(false)} aria-label="Fermer">✕</button></div>
        {envoye ? <div className="py-6"><p className="font-bold text-naxa-green-800">Message envoyé</p><a className="mt-3 inline-block underline" href="/notifications">Voir mes notifications</a></div> : <>
          <label className="mt-4 block text-sm font-semibold" htmlFor="message-pharmacie">Votre message…</label><textarea id="message-pharmacie" maxLength={1000} rows={4} value={corps} onChange={e => setCorps(e.target.value)} className="champ mt-2 !h-auto rounded-xl py-3" placeholder="Votre message…"/>
          <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={anonyme} onChange={e => setAnonyme(e.target.checked)}/> Rester anonyme</label>
          <p className="mt-2 text-xs text-slate-600">Ne partagez pas d'informations médicales sensibles.</p>
          {erreur && <p role="alert" className="mt-2 text-sm text-red-700">{erreur}</p>}
          <button disabled={!corps.trim() || envoi} onClick={() => void envoyer()} className="btn btn-canari mt-4 w-full">{envoi ? "Envoi…" : "Envoyer"}</button>
        </>}
      </section>
    </div>}
  </>;
}
