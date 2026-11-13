"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type Props = {
  reservationId: string;
  stockConfirmedAt: string | null;
  paymentMode: string | null;
  paymentStatus: string;
  paymentReference: string | null;
  totalArticles: number;
  fraisLivraison: number;
};

type PaymentDetails = { code_marchand: string; total: number; devise?: string };

export function DeliveryPaymentSelector({
  reservationId, stockConfirmedAt, paymentMode, paymentStatus, paymentReference,
  totalArticles, fraisLivraison,
}: Props) {
  const [installedPwa, setInstalledPwa] = useState(false);
  const [mode, setMode] = useState(paymentMode && paymentMode !== "a_convenir" ? paymentMode : "");
  useEffect(() => {
    setMode(paymentMode && paymentMode !== "a_convenir" ? paymentMode : "");
  }, [paymentMode]);
  const [reference, setReference] = useState(paymentReference ?? "");
  const [details, setDetails] = useState<PaymentDetails | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches
      || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    setInstalledPwa(standalone);
  }, []);

  useEffect(() => {
    if (!stockConfirmedAt || !mode || mode === "especes_livraison" || paymentStatus === "effectue") return;
    let active = true;
    void fetch("/api/pay/" + encodeURIComponent(reservationId), { cache: "no-store" })
      .then(async response => {
        if (!response.ok) throw new Error("Les coordonnées de paiement sont momentanément indisponibles.");
        return await response.json() as PaymentDetails;
      })
      .then(value => { if (active) setDetails(value); })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : "Paiement indisponible."); });
    return () => { active = false; };
  }, [reservationId, stockConfirmedAt, mode, paymentStatus]);

  async function choosePayment(nextMode: "mtn_marchand" | "orange_money" | "especes_livraison") {
    if (busy) return;
    if (nextMode === "especes_livraison" && !installedPwa) {
      setError("Le paiement en espèces à la livraison est réservé à la PWA installée.");
      return;
    }
    setBusy(true); setError(""); setMessage("");
    const { error: rpcError } = await supabaseBrowser().rpc("naxa_client_set_delivery_payment_mode", {
      p_reservation: reservationId, p_mode: nextMode,
    });
    if (rpcError) setError(rpcError.message || "Le mode de paiement n'a pas été enregistré.");
    else {
      setMode(nextMode);
      setMessage(nextMode === "especes_livraison"
        ? "Paiement en espèces à la remise enregistré. Préparez le montant exact."
        : "Mode de paiement enregistré. Effectuez le transfert au code marchand de la pharmacie, puis saisissez sa référence.");
      setDetails(null);
    }
    setBusy(false);
  }

  async function submitReference() {
    if (busy || reference.trim().length < 5) return;
    setBusy(true); setError(""); setMessage("");
    const { error: rpcError } = await supabaseBrowser().rpc("naxa_client_declarer_paiement_livraison", {
      p_reservation: reservationId, p_reference: reference.trim(),
    });
    if (rpcError) setError(rpcError.message || "Référence non enregistrée.");
    else setMessage("Référence transmise à la pharmacie. Le paiement reste en attente de vérification et ne sera pas considéré comme encaissé avant contrôle.");
    setBusy(false);
  }

  if (!stockConfirmedAt) {
    return <section className="carte space-y-2">
      <h2 className="font-extrabold">Paiement après confirmation pharmacie</h2>
      <p className="text-sm text-slate-600">La demande doit d'abord être confirmée par le Gestionnaire de stock. Vous serez ensuite invité à choisir votre mode de paiement.</p>
    </section>;
  }

  if (paymentStatus === "effectue") {
    return <section className="carte space-y-2">
      <h2 className="font-extrabold">Paiement confirmé</h2>
      <p className="text-sm text-emerald-800">La pharmacie a enregistré le règlement. La préparation et la livraison peuvent se poursuivre.</p>
    </section>;
  }

  return <section className="carte space-y-3">
    <div>
      <h2 className="font-extrabold">Choisir le paiement de la livraison</h2>
      <p className="text-sm text-slate-600">Articles : {totalArticles.toLocaleString("fr-FR")} FCFA · Livraison : {fraisLivraison.toLocaleString("fr-FR")} FCFA</p>
      <p className="mt-1 text-lg font-black">{(totalArticles + fraisLivraison).toLocaleString("fr-FR")} FCFA à régler à la pharmacie</p>
    </div>

    {!mode && <div className="grid gap-2">
      <button type="button" disabled={busy} onClick={() => void choosePayment("mtn_marchand")} className="min-h-11 rounded-xl border px-4 py-3 text-left text-sm font-bold">MTN Mobile Money · paiement électronique</button>
      <button type="button" disabled={busy} onClick={() => void choosePayment("orange_money")} className="min-h-11 rounded-xl border px-4 py-3 text-left text-sm font-bold">Orange Money · paiement électronique</button>
      {installedPwa && <button type="button" disabled={busy} onClick={() => void choosePayment("especes_livraison")} className="min-h-11 rounded-xl border px-4 py-3 text-left text-sm font-bold">Espèces à la livraison · PWA installée</button>}
    </div>}

    {mode === "especes_livraison" && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950">Le livreur est informé que le règlement se fera à la remise. La commande ne sera clôturée qu'après confirmation de la réception et enregistrement du paiement selon le contrôle de la pharmacie.</p>}

    {mode && mode !== "especes_livraison" && paymentStatus !== "effectue" && <>
      <div className="rounded-xl bg-emerald-50 p-3">
        <p className="text-xs font-semibold text-emerald-900">Code marchand de la pharmacie</p>
        {details?.code_marchand
          ? <p className="mt-1 text-xl font-black tracking-widest">{details.code_marchand}</p>
          : <p className="mt-1 text-sm text-slate-600">Chargement du code marchand…</p>}
        <p className="mt-2 text-sm text-emerald-950">Montant à payer : <strong>{(totalArticles + fraisLivraison).toLocaleString("fr-FR")} FCFA</strong></p>
      </div>
      <label className="block text-sm font-semibold">Référence reçue après le transfert
        <input value={reference} onChange={event => setReference(event.target.value)} maxLength={120} minLength={5} className="champ mt-1" placeholder="Référence de la transaction"/>
      </label>
      <button type="button" disabled={busy || reference.trim().length < 5} onClick={() => void submitReference()} className="btn btn-vert w-full">{busy ? "Transmission…" : "J’ai effectué le paiement"}</button>
      <p className="text-xs text-slate-500">La déclaration ne vaut pas validation : la pharmacie doit vérifier le transfert avant de poursuivre la préparation. Sur Android, la capture SMS native automatisera ce rapprochement lorsqu'elle sera intégrée.</p>
    </>}
    {mode && <button type="button" disabled={busy} onClick={() => { setMode(""); setDetails(null); setError(""); }} className="min-h-10 rounded-lg border px-3 py-2 text-sm font-semibold">Changer de mode de paiement</button>}
    {message && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{message}</p>}
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
  </section>;
}
