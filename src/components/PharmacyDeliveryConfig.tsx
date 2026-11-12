"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

export type DeliveryPharmacyConfigItem = {
  id:string;nom:string;livraison_active:boolean;rayon_livraison_km:number;
  lat:number|null;lng:number|null;
};

export function PharmacyDeliveryConfig({pharmacies}:{pharmacies:DeliveryPharmacyConfigItem[]}) {
  const [rows,setRows]=useState(pharmacies);
  const [busy,setBusy]=useState<string|null>(null);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");

  async function save(row:DeliveryPharmacyConfigItem) {
    if(busy)return;
    setBusy(row.id);setError("");setMessage("");
    const {error:rpcError}=await supabaseBrowser().rpc("naxa_set_pharmacy_delivery_config",{
      p_pharmacie:row.id,
      p_active:row.livraison_active,
      p_rayon_km:row.rayon_livraison_km,
    });
    if(rpcError)setError(rpcError.message||"Configuration non enregistrée.");
    else setMessage("Configuration enregistrée pour "+row.nom+".");
    setBusy(null);
  }

  return <section className="rounded-2xl border bg-white p-5">
    <div>
      <h2 className="text-lg font-extrabold">Service de livraison par pharmacie</h2>
      <p className="mt-1 text-sm text-slate-600">Activez la livraison uniquement pour une pharmacie active disposant de coordonnées GPS vérifiées ou confirmées sur la fiche. Définissez son rayon maximal.</p>
    </div>
    {error&&<p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {message&&<p role="status" className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{message}</p>}
    {rows.length===0?<p className="mt-4 text-sm text-slate-600">Aucune pharmacie dans ce périmètre.</p>:<div className="mt-4 space-y-3">
      {rows.map(row=><article key={row.id} className="rounded-xl border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h3 className="font-bold">{row.nom}</h3><p className="mt-1 text-xs text-slate-500">GPS : {typeof row.lat==="number"&&typeof row.lng==="number"?"coordonnées disponibles":"coordonnées manquantes"}</p></div>
          <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={row.livraison_active} onChange={event=>setRows(current=>current.map(item=>item.id===row.id?{...item,livraison_active:event.target.checked}:item))}/> Livraison active</label>
        </div>
        <label className="mt-3 block text-sm font-semibold">Rayon maximal · {row.rayon_livraison_km} km
          <input type="range" min={1} max={50} step={1} value={row.rayon_livraison_km}
            onChange={event=>setRows(current=>current.map(item=>item.id===row.id?{...item,rayon_livraison_km:Number(event.target.value)}:item))}
            className="mt-2 w-full"/>
        </label>
        {row.livraison_active&&(!(typeof row.lat==="number"&&typeof row.lng==="number")||row.lat<-90||row.lat>90||row.lng<-180||row.lng>180)&&
          <p className="mt-2 text-xs text-red-700">Activation impossible : renseignez des coordonnées GPS valides sur la fiche pharmacie.</p>}
        <button type="button" disabled={busy!==null||(row.livraison_active&&(!(typeof row.lat==="number"&&typeof row.lng==="number")||row.lat<-90||row.lat>90||row.lng<-180||row.lng>180))}
          onClick={()=>void save(row)} className="mt-3 min-h-10 rounded-lg bg-[#0B3D26] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
          {busy===row.id?"Enregistrement…":"Enregistrer"}
        </button>
      </article>)}
    </div>}
  </section>;
}
