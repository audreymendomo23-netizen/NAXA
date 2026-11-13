"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { buildTelephoneUri } from "@/lib/merchant-payment";

type Props = {
  reservationId: string;
  stockConfirmedAt: string | null;
  paymentMode: string | null;
  paymentStatus: string;
  paymentReference: string | null;
  totalArticles: number;
  fraisLivraison: number;
};

type PaymentDetails = { canal: "mtn_momo" | "orange_money"; merchant_name: string; merchant_phone: string; merchant_code: string; code_marchand: string; total: number; ussd: string; devise?: string };
type FinancialConfirmationState = {
  status: string;
  transactionReference?: string | null;
  confirmation?: {
    receiptNumber: string;
    channel: "mtn_momo" | "orange_money";
    transactionReference: string;
    amount: number;
    merchantName: string | null;
    merchantPhone: string | null;
    providerOccurredAt: string | null;
    merchantSmsReceivedAt: string;
    confirmedAt: string;
  };
};

function localDateTimeValue() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Douala",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date());
  const part = (type: string) => parts.find(item => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

function cameroonDateTimeToIso(value: string) {
  if (!/^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}$/.test(value)) {
    throw new Error("Date de paiement invalide.");
  }
  // datetime-local n'a pas de fuseau ; Africa/Douala est UTC+01:00.
  return new Date(`${value}:00+01:00`).toISOString();
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
  const [defaultPaidAt] = useState(localDateTimeValue);
  const [paidAt, setPaidAt] = useState(defaultPaidAt);
  const [details, setDetails] = useState<PaymentDetails | null>(null);
  const [financialConfirmation, setFinancialConfirmation] = useState<FinancialConfirmationState | null>(null);
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
    if (paymentStatus !== "a_verifier") {
      setFinancialConfirmation(null);
      return;
    }
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch(
          "/api/client/paiements/livraison/confirmation/" + encodeURIComponent(reservationId),
          { cache: "no-store" }
        );
        if (!response.ok) return;
        const value = await response.json() as FinancialConfirmationState;
        if (active) setFinancialConfirmation(value);
      } catch {
        // La déclaration reste en attente ; une indisponibilité réseau ne change pas son état financier.
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 10000);
    return () => { active = false; window.clearInterval(timer); };
  }, [reservationId, paymentStatus]);

  useEffect(() => {
    if (!stockConfirmedAt || !mode || mode === "especes_livraison" ||
        paymentStatus === "effectue" || paymentStatus === "a_verifier") return;
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
          paidAt: cameroonDateTimeToIso(paidAt),
          reference: reference.trim(),
          fieldSources: {
            amount: numericAmount === totalArticles + fraisLivraison ? "generated_default" : "manual_entry",
            paidAt: paidAt === defaultPaidAt ? "generated_default" : "manual_entry",
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
    const confirmation = financialConfirmation?.confirmation;
    const isFinanciallyConfirmed = financialConfirmation?.status === "financially_confirmed_waiting_pos" && Boolean(confirmation);
    const isAwaitingMerchant = financialConfirmation?.status === "awaiting_merchant_sms";
    const isManualReview = financialConfirmation?.status === "manual_review";
    return <section className="carte space-y-3">
      {isFinanciallyConfirmed && confirmation
        ? <>
            <div>
              <h2 className="font-extrabold text-emerald-800">Paiement confirmé par NAXA</h2>
              <p className="mt-1 text-sm text-emerald-900">Les SMS de débit du payeur et de crédit de la pharmacie ont été rapprochés par leur ID de transaction et leurs informations concordantes.</p>
            </div>
            <dl className="grid gap-2 rounded-xl border border-emerald-200 p-3 text-sm sm:grid-cols-2">
              <div><dt className="text-slate-500">Reçu de rapprochement NAXA</dt><dd className="font-extrabold">{confirmation.receiptNumber}</dd></div>
              <div><dt className="text-slate-500">Montant confirmé</dt><dd className="font-extrabold">{confirmation.amount.toLocaleString("fr-FR")} FCFA</dd></div>
              <div><dt className="text-slate-500">ID de transaction</dt><dd className="break-all font-semibold">{confirmation.transactionReference}</dd></div>
              <div><dt className="text-slate-500">Opérateur</dt><dd className="font-semibold">{confirmation.channel === "orange_money" ? "Orange Money" : "MTN Mobile Money"}</dd></div>
              <div><dt className="text-slate-500">Bénéficiaire</dt><dd className="font-semibold">{confirmation.merchantName ?? "Pharmacie"}</dd></div>
              <div><dt className="text-slate-500">Date de confirmation</dt><dd className="font-semibold">{new Date(confirmation.confirmedAt).toLocaleString("fr-FR", { timeZone: "Africa/Douala" })}</dd></div>
            </dl>
            <p className="text-sm text-slate-700">La transaction est financièrement confirmée. La pharmacie doit encore enregistrer le ticket POS dans sa session Caisse ; cette étape comptable ne remet pas en cause le rapprochement des deux SMS.</p>
          </>
        : <>
            <h2 className="font-extrabold">Déclaration transmise</h2>
            <p className="text-sm text-amber-900">
              {isManualReview
                ? "Les informations reçues présentent un écart ou une ambiguïté. Le dossier reste en revue manuelle ; NAXA ne présume pas d'un échec opérateur."
                : isAwaitingMerchant
                  ? "Votre SMS de débit est enregistré. NAXA attend le SMS de crédit sur le téléphone de la pharmacie. L'absence de ce SMS dans NAXA ne signifie pas que l'opérateur a échoué."
                  : "NAXA attend les deux éléments nécessaires au rapprochement. Le paiement n'est pas encore confirmé dans NAXA."}
            </p>
            {(paymentReference || financialConfirmation?.transactionReference) &&
              <p className="text-sm">ID / Référence : <strong>{paymentReference ?? financialConfirmation?.transactionReference}</strong></p>}
          </>}
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
        <p className="text-xs font-semibold text-emerald-900">Bénéficiaire du paiement</p>
        {details
          ? <>
              <p className="mt-1 text-lg font-black">{details.merchant_name}</p>
              <p className="text-sm text-emerald-950">Téléphone : <strong>{details.merchant_phone}</strong></p>
              <p className="mt-2 text-xs font-semibold text-emerald-900">Code marchand · 6 chiffres</p>
              <p className="text-xl font-black tracking-widest">{details.merchant_code}</p>
            </>
          : <p className="mt-1 text-sm text-slate-600">Chargement des coordonnées marchandes…</p>}
        <p className="mt-2 text-sm text-emerald-950">Montant exact à payer : <strong>{(totalArticles + fraisLivraison).toLocaleString("fr-FR")} FCFA</strong></p>
      </div>
      {details?.ussd && <a
        href={buildTelephoneUri(details.ussd)}
        className="flex min-h-12 w-full items-center justify-center rounded-xl bg-naxa-green-900 px-4 py-3 text-center font-bold text-white"
      >
        Ouvrir le composeur et préparer le paiement {mode === "mtn_marchand" ? "MTN" : "Orange"}
      </a>}
      <p className="text-xs text-slate-600">Après ouverture du composeur, vérifiez le bénéficiaire et confirmez vous-même la commande chez l'opérateur. Votre code secret est saisi uniquement dans l'interface MTN ou Orange, jamais dans NAXA.</p>
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
