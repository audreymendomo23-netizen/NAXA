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
  const [controleAge, setControleAge] = useState(false);
  const [mineur, setMineur] = useState(false);
  const cleAge = "naxa-age-declaration-v1";
  const ageEtat = (): "adulte" | "mineur" | "absent" => {
    try {
      const value = localStorage.getItem(cleAge);
      if (!value) return "absent";
      const declaration = JSON.parse(value) as { confirmed?: boolean; at?: number };
      if (typeof declaration.at !== "number" || Date.now() - declaration.at < 0 || Date.now() - declaration.at >= 30 * 24 * 60 * 60 * 1000) return "absent";
      return declaration.confirmed === true ? "adulte" : "mineur";
    } catch { return "absent"; }
  };
  async function ouvrirContact() {
    setEnvoye(false);
    const age = ageEtat();
    if (age === "mineur") { setControleAge(true); setMineur(true); return; }
    if (age !== "adulte") { setControleAge(true); setMineur(false); return; }
    const sb = supabaseBrowser();
    const { data } = await sb.auth.getUser();
    if (!data.user) {
      const retour = typeof window !== "undefined" ? window.location.pathname + window.location.search : "/";
      router.push(`/connexion?espace=client&retour=${encodeURIComponent(retour)}`);
      return;
    }
    setOuvert(true);
  }
  async function confirmerMajeur() {
    try { localStorage.setItem(cleAge, JSON.stringify({ confirmed: true, at: Date.now() })); } catch { /* contrôle valable pour l'action en cours */ }
    setControleAge(false);
    const sb = supabaseBrowser();
    const { data } = await sb.auth.getUser();
    if (!data.user) {
      const retour = typeof window !== "undefined" ? window.location.pathname + window.location.search : "/";
      router.push(`/connexion?espace=client&retour=${encodeURIComponent(retour)}`);
      return;
    }
    setOuvert(true);
  }
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
    <button type="button" onClick={() => void ouvrirContact()} className={variante === "flottant" ? "fixed bottom-[5.5rem] right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-naxa-canari text-naxa-green-900 shadow-lg" : "btn btn-canari"} aria-label="Contacter la pharmacie">
      {variante === "flottant" ? <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 11.5a8.5 8.5 0 0 1-12.7 7.4L3 20l1.1-4.7A8.5 8.5 0 1 1 21 11.5Z"/><path d="M8 11h8M8 14h5"/></svg> : "Contacter"}
    </button>
    {controleAge && <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-3 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="contact-age-title"><section className="carte w-full max-w-sm space-y-4"><h2 id="contact-age-title" className="text-xl font-extrabold">{mineur ? "Accès réservé aux adultes" : "Avant de continuer"}</h2><p className="text-sm leading-relaxed text-slate-600">{mineur ? "Vous avez indiqué avoir moins de 18 ans. Vous ne pouvez pas effectuer cette action." : "NAXA est destiné aux personnes âgées de 18 ans ou plus. Confirmez votre âge avant de contacter une pharmacie. Cette déclaration ne remplace pas la vérification du compte."}</p>{!mineur && <><button type="button" className="btn btn-canari w-full" onClick={confirmerMajeur}>Je confirme avoir 18 ans ou plus</button><button type="button" className="btn btn-clair w-full" onClick={() => { try { localStorage.setItem(cleAge, JSON.stringify({ confirmed: false, at: Date.now() })); } catch { /* Refus appliqué à cette fenêtre. */ } setMineur(true); }}>J’ai moins de 18 ans</button></>}<button type="button" className="btn btn-clair w-full" onClick={() => setControleAge(false)}>Fermer</button></section></div>}
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
