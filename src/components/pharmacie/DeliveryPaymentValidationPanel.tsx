"use client";

import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type PaymentRow = {
  reservation_id:string;mission_id:string|null;reference_code:string;
  client_id:string;client_phone:string|null;mode:string;reference:string|null;
  expected_amount:number;cash_received:number|null;cash_change:number|null;
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
    if(!pharmacieId||!sessionId){setRows([]);setLoading(false);return;}
    const {data,error:rpcError}=await supabaseBrowser().rpc("naxa_delivery_pending_payment_list",{p_pharmacie:pharmacieId});
    if(rpcError){setError("Impossible de charger les paiements de livraison. Vérifiez votre session Caisse.");setRows([]);}
    else {setError("");setRows(Array.isArray(data)?data as PaymentRow[]:[]);}
    setLoading(false);
  },[pharmacieId,sessionId]);

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
      <div><h2 className="text-lg font-extrabold">Paiements de livraison à rapprocher</h2><p className="mt-1 text-sm text-slate-600">Vérifiez l’encaissement marchand ou les espèces déclarées par le Livreur. La validation crée le ticket POS complet, frais de livraison inclus.</p></div>
      <button type="button" onClick={()=>void load()} disabled={loading||busy!==null} className="btn btn-clair">Actualiser</button>
    </div>
    {!sessionId&&<p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950">Ouvrez votre session Caisse pour rapprocher les paiements de livraison.</p>}
    {error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {notice&&<p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}
    {loading?<p className="text-sm text-slate-600">Chargement des paiements en attente…</p>
      :rows.length===0?<p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">Aucun paiement de livraison à rapprocher pour le moment.</p>
      :<div className="space-y-3">
        {rows.map(row=><article key={row.reservation_id} className="rounded-xl border p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div><p className="text-xs font-bold uppercase tracking-wide text-emerald-800">Commande #{row.reservation_id.slice(0,8).toUpperCase()}</p><p className="mt-1 text-sm font-bold">{row.mode==="especes_livraison"?"Espèces déclarées par le Livreur":row.mode==="mtn_marchand"?"MTN Mobile Money":"Orange Money"}</p></div>
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-950">{row.payment_status==="cash_declared"?"Espèces à rapprocher":"Référence à vérifier"}</span>
          </div>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div><dt className="text-slate-500">Total dû</dt><dd className="font-extrabold">{money(row.expected_amount)}</dd></div>
            <div><dt className="text-slate-500">Référence paiement</dt><dd className="break-all font-semibold">{row.reference??"Espèces à la remise"}</dd></div>
            {row.mode==="especes_livraison"&&<div><dt className="text-slate-500">Espèces déclarées par le Livreur</dt><dd className="font-bold">{money(row.cash_received??0)} · monnaie {money(row.cash_change??0)}</dd></div>}
            <div><dt className="text-slate-500">Code commande</dt><dd className="font-mono font-bold">{row.reference_code}</dd></div>
          </dl>
          <button type="button" disabled={!sessionId||busy!==null} onClick={()=>void validate(row)} className="btn btn-vert mt-3 w-full">
            {busy===row.reservation_id?"Validation…":row.mode==="especes_livraison"?"Rapprocher les espèces et valider":"Confirmer l'encaissement marchand"}
          </button>
        </article>)}
      </div>}
  </section>;
}
