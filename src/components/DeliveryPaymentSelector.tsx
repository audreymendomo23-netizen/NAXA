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

function localDateTimeValue() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function DeliveryPaymentSelector({
  reservationId, stockConfirmedAt, paymentMode, paymentStatus, paymentReference,
  totalArticles, fraisLivraison,
}: Props) {
  const [installedPwa, setInstalledPwa] = useState(false);
  const [mode, setMode] = useState(paymentMode && paymentMode !== "a_convenir" ? paymentMode : "");
  const [reference, setReference] = useState(paymentReference ?? "");
  const [payerNumber, setPayerNumber] = useState("");
  const [amount, setAmount] = useState(String(totalArticles + fraisLivraison));
  const [paidAt, setPaidAt] = useState(localDateTimeValue);
  const [details, setDetails] = useState<PaymentDetails | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setMode(paymentMode && paymentMode !== "a_convenir" ? paymentMode : "");
    if (paymentReference) setReference(paymentReference);
  }, [paymentMode, paymentReference]);

  useEffect(() => {
    setAmount(String(totalArticles + fraisLivraison));
  }, [totalArticles, fraisLivraison]);

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
        : "Mode de paiement enregistré. Effectuez le transfert au code marchand de la pharmacie.");
      setDetails(null);
    }
    setBusy(false);
  }

  async function submitManualDeclaration() {
    const numericAmount = Number(amount);
    if (busy || reference.trim().length < 5 || !Number.isSafeInteger(numericAmount) || numericAmount <= 0 || !paidAt) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const { data: sessionData, error: sessionError } = await supabaseBrowser().auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (sessionError || !accessToken) throw new Error("Reconnectez-vous pour transmettre la déclaration.");
      const response = await fetch("/api/client/paiements/livraison/share", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + accessToken },
        cache: "no-store",
        body: JSON.stringify({
          reservationId,
          canal: mode === "mtn_marchand" ? "mtn_momo" : "orange_money",
          smsText: "",
          payerNumber,
          amount: numericAmount,
          paidAt: new Date(paidAt).toISOString(),
          reference: reference.trim(),
          fieldSources: {
            amount: numericAmount === totalArticles + fraisLivraison ? "generated_default" : "manual_entry",
            paidAt: "manual_entry",
            payerNumber: payerNumber.trim() ? "manual_entry" : "not_provided",
            reference: "manual_entry",
          },
        }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string; message?: string };
      if (!response.ok) throw new Error(result.error || "Déclaration non enregistrée.");
      setMessage(result.message || "Déclaration transmise. La pharmacie doit vérifier le crédit réel.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Déclaration non enregistrée.");
    } finally {
      setBusy(false);
    }
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
      <p className="text-sm text-emerald-800">La pharmacie a vérifié le crédit et enregistré le ticket de Caisse. La préparation et la livraison peuvent se poursuivre.</p>
    </section>;
  }

  if (paymentStatus === "a_verifier") {
    return <section className="carte space-y-2">
      <h2 className="font-extrabold">Déclaration transmise</h2>
      <p className="text-sm text-amber-900">La pharmacie doit encore rapprocher votre déclaration avec le crédit réellement reçu. Votre commande n'est pas encore considérée comme payée.</p>
      {paymentReference && <p className="text-sm">Référence : <strong>{paymentReference}</strong></p>}
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

    {mode === "especes_livraison" && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950">Le règlement se fera à la remise. La Caisse de la pharmacie rapprochera les espèces déclarées avant clôture de la livraison.</p>}

    {mode && mode !== "especes_livraison" && <>
      <div className="rounded-xl bg-emerald-50 p-3">
        <p className="text-xs font-semibold text-emerald-900">Code marchand de la pharmacie</p>
        {details?.code_marchand
          ? <p className="mt-1 text-xl font-black tracking-widest">{details.code_marchand}</p>
          : <p className="mt-1 text-sm text-slate-600">Chargement du code marchand…</p>}
        <p className="mt-2 text-sm text-emerald-950">Montant à payer : <strong>{(totalArticles + fraisLivraison).toLocaleString("fr-FR")} FCFA</strong></p>
      </div>
      <div className="rounded-xl border border-emerald-100 p-3">
        <p className="font-bold">Après le paiement</p>
        <p className="mt-1 text-sm text-slate-600">Sur Android, ouvrez le SMS de confirmation, choisissez Partager puis « NAXA Paiement ». Les informations extraites rempliront automatiquement la déclaration. Vous pourrez corriger les champs manquants avant l'envoi.</p>
      </div>
      <label className="block text-sm font-semibold">Numéro utilisé pour payer (facultatif si absent du SMS)
        <input value={payerNumber} onChange={event => setPayerNumber(event.target.value)} maxLength={40} className="champ mt-1" placeholder="6XX XX XX XX"/>
      </label>
      <label className="block text-sm font-semibold">Montant déclaré (FCFA)
        <input type="number" min="1" value={amount} onChange={event => setAmount(event.target.value)} className="champ mt-1"/>
      </label>
      <label className="block text-sm font-semibold">Date et heure du paiement
        <input type="datetime-local" value={paidAt} onChange={event => setPaidAt(event.target.value)} className="champ mt-1"/>
      </label>
      <label className="block text-sm font-semibold">ID / Référence de transaction
        <input value={reference} onChange={event => setReference(event.target.value)} maxLength={120} minLength={5} className="champ mt-1" placeholder="Référence de la transaction"/>
      </label>
      <button type="button" disabled={busy || reference.trim().length < 5 || Number(amount) <= 0 || !paidAt} onClick={() => void submitManualDeclaration()} className="btn btn-vert w-full">{busy ? "Transmission…" : "Transmettre ma déclaration manuellement"}</button>
      <p className="text-xs text-slate-500">Le montant et la date sont préremplis à partir de la commande et de l'heure locale de votre téléphone. Une déclaration manuelle n'est pas une preuve d'encaissement : la pharmacie doit confirmer dans sa Caisse.</p>
    </>}
    {mode && <button type="button" disabled={busy} onClick={() => { setMode(""); setDetails(null); setError(""); }} className="min-h-10 rounded-lg border px-3 py-2 text-sm font-semibold">Changer de mode de paiement</button>}
    {message && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{message}</p>}
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
  </section>;
}
