"use client";

import { useCallback, useEffect, useState } from "react";
import { buildTelephoneUri } from "@/lib/merchant-payment";

type Props = {
  reservationId: string;
  reservationStatus: string;
  totalFcfa: number;
  partnerName: string;
};

type PaymentDetails = {
  paymentIntentId: string;
  canal: "orange_money" | "mtn_momo";
  merchant_name: string;
  merchant_phone: string;
  merchant_code: string;
  total: number;
  ussd: string;
  status?: string;
  expires_at?: string;
};

type ConfirmationState = {
  status: string;
  paymentMode?: string | null;
  transactionReference?: string | null;
  confirmation?: {
    receiptNumber: string;
    channel: "orange_money" | "mtn_momo";
    transactionReference: string;
    amount: number;
    merchantName: string | null;
    merchantPhone: string | null;
    confirmedAt: string;
    merchantSmsReceivedAt: string;
  };
};

function localDateTimeValue() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Douala",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date());
  const part=(type:string)=>parts.find(item=>item.type===type)?.value??"";
  return part("year")+"-"+part("month")+"-"+part("day")+"T"+part("hour")+":"+part("minute");
}
function cameroonDateTimeToIso(value:string) {
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    throw new Error("Date de paiement invalide.");
  }
  return new Date(value+":00+01:00").toISOString();
}
const money=(value:number)=>Number(value??0).toLocaleString("fr-FR")+" FCFA";

export function PartnerUniversePaymentPanel({
  reservationId,reservationStatus,totalFcfa,partnerName,
}:Props) {
  const [confirmation,setConfirmation]=useState<ConfirmationState|null>(null);
  const [details,setDetails]=useState<PaymentDetails|null>(null);
  const [canal,setCanal]=useState<"orange_money"|"mtn_momo"|null>(null);
  const [smsText,setSmsText]=useState("");
  const [payerNumber,setPayerNumber]=useState("");
  const [amount,setAmount]=useState(String(totalFcfa));
  const [paidAt,setPaidAt]=useState(localDateTimeValue);
  const [reference,setReference]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");

  const refresh=useCallback(async()=>{
    try {
      const response=await fetch(
        "/api/client/paiements/univers/confirmation/"+encodeURIComponent(reservationId),
        {cache:"no-store"}
      );
      if(!response.ok) return;
      const value=await response.json() as ConfirmationState;
      setConfirmation(value);
    } catch {
      // Une panne réseau n'altère pas l'état financier du dossier.
    }
  },[reservationId]);

  useEffect(()=>{
    if(totalFcfa<=0) return;
    void refresh();
    const timer=window.setInterval(()=>void refresh(),10000);
    return ()=>window.clearInterval(timer);
  },[refresh,totalFcfa]);

  useEffect(()=>{
    if(!canal||details) return;
    let active=true;
    void fetch("/api/pay/universe/"+encodeURIComponent(reservationId)+"?canal="+canal,{cache:"no-store"})
      .then(async response=>{
        const data=await response.json().catch(()=>({})) as PaymentDetails & {error?:string};
        if(!response.ok) throw new Error(data.error||"Coordonnées marchandes indisponibles.");
        return data;
      })
      .then(value=>{if(active) setDetails(value);})
      .catch(reason=>{if(active) setError(reason instanceof Error?reason.message:"Préparation du paiement impossible.");});
    return ()=>{active=false;};
  },[canal,details,reservationId]);

  async function chooseChannel(next:"orange_money"|"mtn_momo") {
    if(busy) return;
    setBusy(true);setError("");setMessage("");setDetails(null);setCanal(next);
    try {
      const response=await fetch("/api/pay/universe/"+encodeURIComponent(reservationId)+"?canal="+next,{cache:"no-store"});
      const result=await response.json().catch(()=>({})) as PaymentDetails & {error?:string};
      if(!response.ok) throw new Error(result.error||"Coordonnées marchandes indisponibles.");
      setDetails(result);
    } catch(reason) {
      setError(reason instanceof Error?reason.message:"Préparation du paiement impossible.");
      setCanal(null);
    } finally {setBusy(false);}
  }

  async function submit() {
    if(!canal||!details||busy) return;
    const numericAmount=Number(amount);
    if(reference.trim().length<5||!Number.isSafeInteger(numericAmount)||numericAmount<=0||!paidAt) {
      setError("Complétez l'ID de transaction, le montant et la date du paiement.");
      return;
    }
    setBusy(true);setError("");setMessage("");
    try {
      const response=await fetch("/api/client/paiements/univers/share",{
        method:"POST",headers:{"Content-Type":"application/json"},cache:"no-store",
        body:JSON.stringify({
          reservationId,canal,smsText,payerNumber,amount:numericAmount,
          paidAt:cameroonDateTimeToIso(paidAt),reference:reference.trim(),
          fieldSources:{
            amount:numericAmount===totalFcfa?"generated_default":"manual_entry",
            paidAt:"manual_entry",
            reference:"manual_entry",
            payerNumber:payerNumber.trim()?"manual_entry":"not_provided",
          },
        }),
      });
      const result=await response.json().catch(()=>({})) as {error?:string;message?:string;status?:string;receiptNumber?:string};
      if(!response.ok) throw new Error(result.error||"Déclaration non enregistrée.");
      setMessage(result.message||"Déclaration transmise à NAXA.");
      await refresh();
    } catch(reason) {
      setError(reason instanceof Error?reason.message:"Déclaration non enregistrée.");
    } finally {setBusy(false);}
  }

  if(!["confirmed","ready","picked_up"].includes(reservationStatus)||totalFcfa<=0) return null;

  const confirmed=confirmation?.status==="financially_confirmed"&&confirmation.confirmation;
  if(confirmed) {
    const c=confirmation.confirmation!;
    return <section className="carte mt-4 space-y-3">
      <div>
        <h2 className="font-extrabold text-emerald-800">Paiement confirmé par NAXA</h2>
        <p className="mt-1 text-sm text-emerald-900">Les SMS de débit et de crédit ont été rapprochés. Le reçu NAXA atteste de la correspondance des deux messages.</p>
      </div>
      <dl className="grid gap-2 rounded-xl border border-emerald-200 p-3 text-sm sm:grid-cols-2">
        <div><dt className="text-slate-500">Reçu de rapprochement</dt><dd className="font-extrabold">{c.receiptNumber}</dd></div>
        <div><dt className="text-slate-500">Montant confirmé</dt><dd className="font-extrabold">{money(c.amount)}</dd></div>
        <div><dt className="text-slate-500">ID de transaction</dt><dd className="break-all font-semibold">{c.transactionReference}</dd></div>
        <div><dt className="text-slate-500">Opérateur</dt><dd className="font-semibold">{c.channel==="orange_money"?"Orange Money":"MTN Mobile Money"}</dd></div>
        <div><dt className="text-slate-500">Bénéficiaire</dt><dd className="font-semibold">{c.merchantName??partnerName}</dd></div>
        <div><dt className="text-slate-500">Confirmé le</dt><dd className="font-semibold">{new Date(c.confirmedAt).toLocaleString("fr-FR",{timeZone:"Africa/Douala"})}</dd></div>
      </dl>
      <p className="text-sm text-slate-700">Le paiement est confirmé. Présentez le code de retrait au partenaire lorsque la réservation est prête.</p>
    </section>;
  }

  const locked=confirmation?.status==="awaiting_pair"||confirmation?.status==="manual_review";
  return <section className="carte mt-4 space-y-3">
    <div>
      <h2 className="font-extrabold">Paiement électronique (facultatif)</h2>
      <p className="mt-1 text-sm text-slate-600">Vous pouvez régler cette réservation par MTN ou Orange après sa confirmation. Le règlement sur place reste possible si vous ne choisissez pas le paiement électronique.</p>
      <p className="mt-1 text-sm font-bold">Total de la réservation : {money(totalFcfa)}</p>
    </div>

    {confirmation?.status==="manual_review"&&
      <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950">Les éléments transmis nécessitent une revue manuelle. NAXA ne présume pas d'un échec opérateur. Présentez le reçu ou les informations au partenaire avant tout retrait.</p>}
    {confirmation?.status==="awaiting_pair"&&
      <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950">Votre déclaration est enregistrée. NAXA attend le SMS de crédit du partenaire. L'absence de ce SMS dans NAXA ne signifie pas un échec chez l'opérateur.</p>}

    {!canal&&<div className="grid gap-2 sm:grid-cols-2">
      <button type="button" disabled={busy||locked} onClick={()=>void chooseChannel("mtn_momo")} className="min-h-11 rounded-xl border px-4 py-3 text-left font-bold disabled:opacity-40">MTN Mobile Money</button>
      <button type="button" disabled={busy||locked} onClick={()=>void chooseChannel("orange_money")} className="min-h-11 rounded-xl border px-4 py-3 text-left font-bold disabled:opacity-40">Orange Money</button>
    </div>}

    {details&&canal&&<div className="space-y-3">
      <div className="rounded-xl bg-emerald-50 p-3">
        <p className="text-xs font-semibold text-emerald-900">Bénéficiaire figé pour cette intention</p>
        <p className="mt-1 text-lg font-black">{details.merchant_name}</p>
        <p className="text-sm text-emerald-950">Téléphone : <strong>{details.merchant_phone}</strong></p>
        <p className="mt-2 text-xs font-semibold text-emerald-900">Code marchand</p>
        <p className="text-xl font-black tracking-widest">{details.merchant_code}</p>
        <p className="mt-2 text-sm">Montant exact : <strong>{money(details.total)}</strong></p>
      </div>
      {details.ussd&&<a href={buildTelephoneUri(details.ussd)} className="flex min-h-12 items-center justify-center rounded-xl bg-naxa-green-900 px-4 py-3 text-center font-bold text-white">Ouvrir le composeur {canal==="mtn_momo"?"MTN":"Orange"}</a>}
      <p className="text-xs text-slate-600">Vérifiez le bénéficiaire et validez vous-même chez l'opérateur. Votre code secret reste uniquement dans l'interface de l'opérateur.</p>
      <label className="block text-sm font-semibold">SMS de débit partagé (facultatif)
        <textarea value={smsText} onChange={e=>setSmsText(e.target.value)} className="champ mt-1 min-h-24" placeholder="Collez ici le SMS de confirmation de débit, ou utilisez Partager → NAXA Paiement sur Android."/>
      </label>
      <label className="block text-sm font-semibold">ID / Référence de transaction
        <input value={reference} onChange={e=>setReference(e.target.value)} className="champ mt-1" maxLength={120} placeholder="ID commun aux deux SMS"/>
      </label>
      <label className="block text-sm font-semibold">Montant déclaré (FCFA)
        <input type="number" min="1" value={amount} onChange={e=>setAmount(e.target.value)} className="champ mt-1"/>
      </label>
      <label className="block text-sm font-semibold">Date et heure du paiement
        <input type="datetime-local" value={paidAt} onChange={e=>setPaidAt(e.target.value)} className="champ mt-1"/>
      </label>
      <label className="block text-sm font-semibold">Numéro payeur (facultatif si absent des SMS)
        <input value={payerNumber} onChange={e=>setPayerNumber(e.target.value)} className="champ mt-1" maxLength={40} placeholder="6XX XX XX XX"/>
      </label>
      <button type="button" disabled={busy||reference.trim().length<5} onClick={()=>void submit()} className="btn btn-vert w-full">{busy?"Transmission…":"Transmettre le SMS et ma déclaration"}</button>
      <p className="text-xs text-slate-500">Un SMS partagé remplit les champs mais ne confirme pas seul le paiement. NAXA attend aussi le SMS de crédit reçu par le partenaire.</p>
      <button type="button" disabled={busy||locked} onClick={()=>{setCanal(null);setDetails(null);setError("");}} className="min-h-10 rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-40">Changer d'opérateur</button>
    </div>}

    {message&&<p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{message}</p>}
    {error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
  </section>;
}
