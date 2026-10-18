"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/client";
import { fcfa } from "@/lib/ranking";
import { EnTeteClient } from "@/components/EnTeteClient";

type Resa = {
  id: string;
  statut: string;
  total: number;
  expires_at: string;
  paiement_ref: string | null;
  pharmacies: { nom: string; quartier: string | null } | null;
};

const LIBELLE: Record<string, string> = {
  en_attente: "En attente de la pharmacie",
  confirmee: "Confirmée par la pharmacie",
  payee: "Payée",
  retiree: "Retirée",
  expiree: "Expirée",
  annulee: "Annulée",
};

export default function Reservation() {
  const { id } = useParams<{ id: string }>();
  const [r, setR] = useState<Resa | null>(null);
  const [reste, setReste] = useState("");
  const [paiement, setPaiement] = useState<{ code_marchand: string; total: number } | null>(null);
  const [ref, setRef] = useState("");
  const [msg, setMsg] = useState("");
  const [erreurChargement, setErreurChargement] = useState(false);
  const [chargementPaiement, setChargementPaiement] = useState(false);
  const [actionEnCours, setActionEnCours] = useState<"paiement" | "annulation" | "reference" | null>(null);

  const charger = useCallback(async () => {
    try {
      const { data, error } = await supabaseBrowser()
        .from("reservations")
        .select("id,statut,total,expires_at,paiement_ref,pharmacies(nom,quartier)")
        .eq("id", id)
        .single();
      if (error || !data) {
        setErreurChargement(true);
        return;
      }
      setR(data as unknown as Resa);
      setErreurChargement(false);
    } catch {
      setErreurChargement(true);
    }
  }, [id]);

  useEffect(() => {
    void charger();
    const t = setInterval(() => void charger(), 15000);
    return () => clearInterval(t);
  }, [charger]);

  useEffect(() => {
    if (!r) return;
    const actualiser = () => {
      const ms = new Date(r.expires_at).getTime() - Date.now();
      setReste(ms <= 0 ? "délai écoulé" : `${Math.floor(ms / 3600000)} h ${Math.floor((ms % 3600000) / 60000)} min`);
    };
    actualiser();
    const t = setInterval(actualiser, 30000);
    return () => clearInterval(t);
  }, [r]);

  async function afficherPaiement() {
    if (chargementPaiement || actionEnCours) return;
    setChargementPaiement(true);
    setMsg("");
    try {
      const res = await fetch(`/api/pay/${id}`);
      if (!res.ok) {
        setMsg("Le paiement est momentanément indisponible. Réessayez dans un instant.");
        return;
      }
      const data = await res.json();
      if (!data?.code_marchand || typeof data.total !== "number") {
        setMsg("Les informations de paiement sont incomplètes. Contactez la pharmacie.");
        return;
      }
      setPaiement(data);
    } catch {
      setMsg("Connexion impossible pour le moment. Vérifiez votre réseau puis réessayez.");
    } finally {
      setChargementPaiement(false);
    }
  }

  async function declarer(e: React.FormEvent) {
    e.preventDefault();
    if (actionEnCours || !ref.trim()) return;
    setActionEnCours("reference");
    setMsg("");
    try {
      const { error } = await supabaseBrowser().rpc("declare_payment", { p_id: id, p_ref: ref.trim() });
      setMsg(error ? "Référence non enregistrée. Vérifiez la référence et réessayez." : "Référence envoyée à la pharmacie.");
      if (!error) await charger();
    } catch {
      setMsg("Envoi impossible pour le moment. Réessayez lorsque la connexion sera rétablie.");
    } finally {
      setActionEnCours(null);
    }
  }

  async function annuler() {
    if (actionEnCours) return;
    setActionEnCours("annulation");
    setMsg("");
    try {
      const { error } = await supabaseBrowser().rpc("set_reservation_status", { p_id: id, p_statut: "annulee" });
      setMsg(error ? "Annulation impossible. Actualisez la réservation puis réessayez." : "Réservation annulée.");
      if (!error) await charger();
    } catch {
      setMsg("Annulation impossible pour le moment. Vérifiez votre connexion puis réessayez.");
    } finally {
      setActionEnCours(null);
    }
  }

  if (!r) {
    return (
      <main className="mx-auto max-w-lg px-4 pb-16">
        <EnTeteClient />
        <div className="carte space-y-3" role={erreurChargement ? "alert" : "status"}>
          <h1 className="text-xl font-extrabold">{erreurChargement ? "Réservation indisponible" : "Chargement de votre réservation…"}</h1>
          <p className="text-sm leading-relaxed text-slate-600">
            {erreurChargement
              ? "Nous n’avons pas pu récupérer cette réservation. Elle peut être inaccessible ou la connexion peut être interrompue."
              : "Nous récupérons les informations de votre réservation."}
          </p>
          {erreurChargement && <button type="button" className="btn btn-canari w-full" onClick={() => void charger()}>Réessayer</button>}
          <Link href="/" className="btn btn-clair w-full">Retour à l’accueil</Link>
        </div>
      </main>
    );
  }

  const delaiDepasse = !r.expires_at || new Date(r.expires_at).getTime() <= Date.now();
  const active = ["en_attente", "confirmee"].includes(r.statut) && !delaiDepasse;
  const statutAffiche = delaiDepasse && ["en_attente", "confirmee"].includes(r.statut) ? "Délai de réservation dépassé" : (LIBELLE[r.statut] ?? r.statut);
  const actionBloquee = actionEnCours !== null || chargementPaiement;

  return (
    <main className="mx-auto max-w-lg space-y-4 px-4 pb-16">
      <EnTeteClient />
      <h1 className="text-2xl font-extrabold">Réservation chez {r.pharmacies?.nom ?? "votre pharmacie"}</h1>
      {r.pharmacies?.quartier && <p className="-mt-2 text-sm text-slate-600">{r.pharmacies.quartier}</p>}
      <section className="carte space-y-2" aria-label="Détails de la réservation">
        <p><strong>Statut :</strong> {statutAffiche}</p>
        <p><strong>Total :</strong> {fcfa(r.total)}</p>
        {active && <p><strong>Temps restant :</strong> {reste}</p>}
        {r.paiement_ref && <p className="break-words text-sm"><strong>Référence communiquée :</strong> {r.paiement_ref}</p>}
      </section>
      {active && (
        <>
          <a className="btn btn-canari w-full" href={`/go/${id}`} target="_blank" rel="noreferrer">Envoyer sur WhatsApp</a>
          {!paiement ? (
            <button type="button" className="btn btn-clair w-full" onClick={() => void afficherPaiement()} disabled={actionBloquee}>
              {chargementPaiement ? "Chargement du paiement…" : "Payer en ligne"}
            </button>
          ) : (
            <form onSubmit={declarer} className="carte space-y-3">
              <h2 className="font-extrabold">Paiement</h2>
              <p className="text-sm leading-relaxed">Payez {fcfa(paiement.total)} avec le code marchand <strong>{paiement.code_marchand}</strong>, puis indiquez la référence de transaction.</p>
              <label className="block text-sm font-semibold" htmlFor="reference-paiement">Référence de transaction</label>
              <input id="reference-paiement" className="champ" required maxLength={120} value={ref} onChange={e => setRef(e.target.value)} placeholder="Référence de transaction" disabled={actionBloquee} />
              <button type="submit" className="btn btn-canari w-full" disabled={actionBloquee || !ref.trim()}>
                {actionEnCours === "reference" ? "Envoi en cours…" : "J’ai payé"}
              </button>
            </form>
          )}
          <button type="button" className="btn btn-clair w-full" onClick={() => void annuler()} disabled={actionBloquee}>
            {actionEnCours === "annulation" ? "Annulation en cours…" : "Annuler la réservation"}
          </button>
        </>
      )}
      {["payee", "retiree"].includes(r.statut) && <Link className="btn btn-canari w-full" href={`/reservation/${id}/recu`}>Voir mon reçu</Link>}
      {msg && <p role="status" className="rounded-xl2 border border-naxa-green-100 bg-white px-4 py-3 text-sm font-semibold text-naxa-green-900 shadow-sm">{msg}</p>}
      {erreurChargement && <p role="status" className="text-sm text-slate-600">La mise à jour automatique a échoué. Les informations affichées peuvent ne pas être à jour.</p>}
    </main>
  );
}
