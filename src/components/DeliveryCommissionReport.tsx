"use client";

import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type PharmacyRow={
  pharmacie_id:string;nom:string;ville:string;region_label:string;livraisons:number;
  frais_clients:number;commission_acquise:number;solde_livraison:number;
  commission_reglee:number;commission_a_regler:number;
};
type RegionRow={region_label:string;livraisons:number;commission_acquise:number};
type Report={
  periode_du:string;periode_au:string;
  totaux:{livraisons:number;frais_clients:number;commission_acquise:number;commission_reglee:number;commission_a_regler:number;solde_livraison:number};
  par_pharmacie:PharmacyRow[];par_region:RegionRow[];
};
const money=(n:number)=>Number(n??0).toLocaleString("fr-FR")+" FCFA";
const localDate=(d:Date)=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");

export function DeliveryCommissionReport() {
  const today=new Date();
  const [from,setFrom]=useState(localDate(new Date(today.getFullYear(),today.getMonth(),1)));
  const [to,setTo]=useState(localDate(today));
  const [report,setReport]=useState<Report|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  const load=useCallback(async()=>{
    setLoading(true);setError("");
    const {data,error:rpcError}=await supabaseBrowser().rpc("naxa_delivery_commission_report",{
      p_from:from,p_to:to,p_pharmacie:null,
    });
    if(rpcError){setError("Rapport indisponible : vérifiez votre session et le périmètre Promoteur/Admin.");setReport(null);}
    else setReport(data as Report|null);
    setLoading(false);
  },[from,to]);
  useEffect(()=>{void load();},[load]);

  return <section className="space-y-4">
    <div className="rounded-2xl border bg-white p-5">
      <div><h2 className="text-lg font-extrabold">Suivi des commissions de livraison</h2><p className="mt-1 text-sm text-slate-600">500 FCFA par livraison terminée. Le montant est déjà inclus dans les frais de livraison client et ne doit pas être refacturé une seconde fois.</p></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <label className="text-sm font-semibold">Du<input type="date" value={from} max={to} onChange={event=>setFrom(event.target.value)} className="champ mt-1"/></label>
        <label className="text-sm font-semibold">Au<input type="date" value={to} min={from} max={localDate(today)} onChange={event=>setTo(event.target.value)} className="champ mt-1"/></label>
        <button type="button" disabled={loading} onClick={()=>void load()} className="min-h-11 self-end rounded-xl bg-[#0B3D26] px-4 py-2 text-sm font-bold text-white">Actualiser</button>
      </div>
    </div>
    {error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {loading?<p className="rounded-xl border bg-white p-5 text-sm text-slate-600">Chargement du rapport…</p>:report&&<>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <article className="rounded-2xl border bg-white p-4"><p className="text-sm text-slate-500">Livraisons terminées</p><p className="mt-1 text-3xl font-black">{report.totaux.livraisons}</p></article>
        <article className="rounded-2xl border bg-white p-4"><p className="text-sm text-slate-500">Commission acquise</p><p className="mt-1 text-2xl font-black text-emerald-800">{money(report.totaux.commission_acquise)}</p></article>
        <article className="rounded-2xl border bg-white p-4"><p className="text-sm text-slate-500">À régler sur décompte mensuel</p><p className="mt-1 text-2xl font-black">{money(report.totaux.commission_a_regler)}</p></article>
        <article className="rounded-2xl border bg-white p-4"><p className="text-sm text-slate-500">Déjà régularisée</p><p className="mt-1 text-xl font-black">{money(report.totaux.commission_reglee)}</p></article>
        <article className="rounded-2xl border bg-white p-4"><p className="text-sm text-slate-500">Frais payés par les clients</p><p className="mt-1 text-xl font-black">{money(report.totaux.frais_clients)}</p></article>
        <article className="rounded-2xl border bg-white p-4"><p className="text-sm text-slate-500">Solde affecté à la livraison</p><p className="mt-1 text-xl font-black">{money(report.totaux.solde_livraison)}</p></article>
      </div>
      <section className="rounded-2xl border bg-white p-5">
        <h3 className="font-extrabold">Détail par pharmacie</h3>
        {report.par_pharmacie.length===0?<p className="mt-3 text-sm text-slate-600">Aucune livraison terminée sur cette période.</p>:<div className="mt-3 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b text-xs text-slate-500"><th className="p-2">Pharmacie</th><th className="p-2">Région</th><th className="p-2">Livraisons</th><th className="p-2">Commission</th><th className="p-2">Réglée</th><th className="p-2">À régler</th></tr></thead><tbody>{report.par_pharmacie.map(row=><tr key={row.pharmacie_id} className="border-b last:border-0"><td className="p-2 font-semibold">{row.nom}</td><td className="p-2">{row.region_label}</td><td className="p-2 tabular-nums">{row.livraisons}</td><td className="p-2 tabular-nums">{money(row.commission_acquise)}</td><td className="p-2 tabular-nums">{money(row.commission_reglee)}</td><td className="p-2 tabular-nums font-bold">{money(row.commission_a_regler)}</td></tr>)}</tbody></table></div>}
      </section>
      <section className="rounded-2xl border bg-white p-5">
        <h3 className="font-extrabold">Répartition par région</h3>
        {report.par_region.length===0?<p className="mt-3 text-sm text-slate-600">Aucune donnée régionale disponible.</p>:<div className="mt-3 overflow-x-auto"><table className="w-full min-w-[420px] text-left text-sm"><thead><tr className="border-b text-xs text-slate-500"><th className="p-2">Région</th><th className="p-2">Livraisons</th><th className="p-2">Commission NAXA</th></tr></thead><tbody>{report.par_region.map(row=><tr key={row.region_label} className="border-b last:border-0"><td className="p-2 font-semibold">{row.region_label}</td><td className="p-2">{row.livraisons}</td><td className="p-2 font-bold">{money(row.commission_acquise)}</td></tr>)}</tbody></table></div>}
      </section>
    </>}
  </section>;
}
