"use client";

import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type PaymentRow = {
  reservation_id:string;mission_id:string|null;reference_code:string;
  client_id:string;client_phone:string|null;mode:string;reference:string|null;
  expected_amount:number;declared_amount:number|null;payer_number:string|null;
  payment_occurred_at:string|null;proof_source:string|null;field_sources:Record<string,string>|null;
  sms_match_status:string;financial_confirmation_status:string|null;naxa_receipt_number:string|null;
  financially_confirmed_at:string|null;merchant_sms_received_at:string|null;merchant_sms_occurred_at:string|null;
  cash_received:number|null;cash_change:number|null;
  payment_status:string;created_at:string|null;livreur_id:string|null;
};

const money=(value:number)=>Number(value??0).toLocaleString("fr-FR")+" FCFA";

export function DeliveryPaymentValidationPanel({
  pharmacieId,sessionId,
}:{pharmacieId:string|null;sessionId:string|null}) {
  const [rows,setRows]=useState<PaymentRow[]>([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState<string|null>(null);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");

  const load=useCallback(async()=>{
    if(!pharmacieId){setRows([]);setLoading(false);return;}
    const {data,error:rpcError}=await supabaseBrowser().rpc("naxa_delivery_pending_payment_list_v2",{p_pharmacie:pharmacieId});
    if(rpcError){setError("Impossible de charger les paiements de livraison. Vérifiez votre session Caisse.");setRows([]);}
    else {setError("");setRows(Array.isArray(data)?data as PaymentRow[]:[]);}
    setLoading(false);
  },[pharmacieId]);

  useEffect(()=>{
    void load();
    const timer=window.setInterval(()=>void load(),15000);
    return()=>window.clearInterval(timer);
  },[load]);

  async function validate(row:PaymentRow){
    if(!sessionId||busy)return;
    const cash=row.mode==="especes_livraison";
    const channel=cash?"especes":row.mode==="mtn_marchand"?"mtn_momo":"orange_money";
    const received=cash?Number(row.cash_received??0):Number(row.expected_amount);
    if(!Number.isSafeInteger(received)||received<row.expected_amount){
      setError("Le montant rapproché est inférieur au total de la commande.");
      return;
    }
    setBusy(row.reservation_id);setError("");setNotice("");
    const {data,error:rpcError}=await supabaseBrowser().rpc("naxa_delivery_pos_encaisser",{
      p_reservation:row.reservation_id,
      p_session:sessionId,
      p_montant_percu:received,
      p_canal:channel,
      p_code_paiement:row.reference_code,
      p_reference:cash?null:row.reference,
    });
    if(rpcError)setError(rpcError.message||"Le paiement n'a pas été validé.");
    else {
      const ticket=Array.isArray(data)?data[0]:data;
      setNotice("Paiement confirmé · ticket "+(ticket?.numero_vente??"POS")+" · "+money(row.expected_amount)+". La préparation et le workflow de livraison peuvent se poursuivre.");
      await load();
    }
    setBusy(null);
  }

  return <section id="caisse-livraisons" className="carte mb-4 space-y-3">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="text-lg font-extrabold">Paiements de livraison · confirmation et Caisse</h2><p className="mt-1 text-sm text-slate-600">Quand les deux SMS concordent, NAXA confirme financièrement la transaction et délivre un reçu de rapprochement. L'inscription du ticket POS reste liée à une session Caisse ouverte. Les dossiers sans paire SMS concordante gardent la voie de vérification manuelle.</p></div>
      <button type="button" onClick={()=>void load()} disabled={loading||busy!==null} className="btn btn-clair">Actualiser</button>
    </div>
    {!sessionId&&<p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950">Les reçus de confirmation financière restent consultables. Ouvrez une session Caisse pour inscrire le ticket POS et comptabiliser la vente.</p>}
    {error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {notice&&<p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}
    {loading?<p className="text-sm text-slate-600">Chargement des paiements en attente…</p>
      :rows.length===0?<p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">Aucun paiement de livraison à rapprocher pour le moment.</p>
      :<div className="space-y-3">
        {rows.map(row=><article key={row.reservation_id} className="rounded-xl border p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div><p className="text-xs font-bold uppercase tracking-wide text-emerald-800">Commande #{row.reservation_id.slice(0,8).toUpperCase()}</p><p className="mt-1 text-sm font-bold">{row.mode==="especes_livraison"?"Espèces déclarées par le Livreur":row.mode==="mtn_marchand"?"MTN Mobile Money":"Orange Money"}</p></div>
            <span className={"rounded-full px-3 py-1 text-xs font-bold "+(row.financial_confirmation_status==="confirmed"?"bg-emerald-100 text-emerald-900":"bg-amber-100 text-amber-950")}>
              {row.financial_confirmation_status==="confirmed"?"Paiement confirmé par les deux SMS":row.payment_status==="cash_declared"?"Espèces à rapprocher":"Rapprochement à terminer"}
            </span>
          </div>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div><dt className="text-slate-500">Total dû</dt><dd className="font-extrabold">{money(row.expected_amount)}</dd></div>
            <div><dt className="text-slate-500">Référence paiement</dt><dd className="break-all font-semibold">{row.reference??"Espèces à la remise"}</dd></div>
            {row.payer_number&&<div><dt className="text-slate-500">Numéro payeur déclaré</dt><dd className="font-semibold">{row.payer_number}</dd></div>}
            {row.declared_amount!==null&&row.declared_amount!==undefined&&<div><dt className="text-slate-500">Montant déclaré par le Client</dt><dd className={"font-semibold "+(row.declared_amount===row.expected_amount?"text-emerald-800":"text-amber-800")}>{money(row.declared_amount)}{row.declared_amount!==row.expected_amount?" · écart à vérifier":""}</dd></div>}
            {row.payment_occurred_at&&<div><dt className="text-slate-500">Date déclarée</dt><dd className="font-semibold">{new Date(row.payment_occurred_at).toLocaleString("fr-FR",{timeZone:"Africa/Douala"})}</dd></div>}
            {row.financial_confirmation_status==="confirmed"&&row.naxa_receipt_number&&<div><dt className="text-slate-500">Reçu NAXA</dt><dd className="font-extrabold text-emerald-800">{row.naxa_receipt_number}</dd></div>}
            {row.financially_confirmed_at&&<div><dt className="text-slate-500">Confirmation des deux SMS</dt><dd className="font-semibold">{new Date(row.financially_confirmed_at).toLocaleString("fr-FR",{timeZone:"Africa/Douala"})}</dd></div>}
            {row.proof_source&&<div><dt className="text-slate-500">Origine des informations</dt><dd className="font-semibold">{row.proof_source==="shared_sms"?"SMS partagé par le Client":"Saisie manuelle"}</dd></div>}
            {row.mode==="especes_livraison"&&<div><dt className="text-slate-500">Espèces déclarées par le Livreur</dt><dd className="font-bold">{money(row.cash_received??0)} · monnaie {money(row.cash_change??0)}</dd></div>}
            <div><dt className="text-slate-500">Code commande</dt><dd className="font-mono font-bold">{row.reference_code}</dd></div>
          </dl>
          {row.financial_confirmation_status==="confirmed"&&<p className="mt-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">NAXA a rapproché le SMS de débit et le SMS de crédit avec le même ID de transaction. Aucune nouvelle vérification du crédit n'est demandée : il reste à inscrire la vente dans le POS.</p>}
          {row.mode!=="especes_livraison"&&row.financial_confirmation_status!=="confirmed"&&<p className="mt-2 text-xs text-amber-900">Sans reçu de rapprochement NAXA, vérifiez le crédit réellement reçu dans le compte marchand avant toute validation manuelle.</p>}
          <button type="button" disabled={!sessionId||busy!==null} onClick={()=>void validate(row)} className="btn btn-vert mt-3 w-full">
            {busy===row.reservation_id?"Enregistrement…":row.mode==="especes_livraison"?"Rapprocher les espèces et valider":row.financial_confirmation_status==="confirmed"?"Enregistrer le ticket POS":"Confirmer manuellement après vérification"}
          </button>
        </article>)}
      </div>}
  </section>;
}
