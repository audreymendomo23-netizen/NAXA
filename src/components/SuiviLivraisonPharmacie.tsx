"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type EventRow = {
  id:string;event_type:string;label:string;detail:string|null;
  latitude:number|null;longitude:number|null;created_at:string;
};
type Tracking = {
  mission_id:string;statut:string;
  latitude_destination:number|null;longitude_destination:number|null;
  latitude_pharmacie:number|null;longitude_pharmacie:number|null;
  livreur:{first_name:string|null;last_name:string|null;username:string|null}|null;
  events:EventRow[];
};

const labels:Record<string,string>={
  available:"Mission proposée aux livreurs",
  accepted:"Livreur attribué · en attente de retrait",
  picked_up:"Commande récupérée · trajet en cours",
  arrived:"Livreur arrivé · remise à confirmer",
  delivered:"Livraison terminée",
  failed:"Incident signalé",
  cancelled:"Livraison annulée",
};

export function SuiviLivraisonPharmacie({reservationId}:{reservationId:string}) {
  const [tracking,setTracking]=useState<Tracking|null>(null);
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(true);
  const load=useCallback(async()=>{
    const {data,error:rpcError}=await supabaseBrowser().rpc("naxa_delivery_pharmacy_tracking",{p_reservation:reservationId});
    if(rpcError)setError("Suivi indisponible dans le périmètre actuel.");
    else {setTracking(data as Tracking|null);setError("");}
    setLoading(false);
  },[reservationId]);
  useEffect(()=>{
    void load();
    const timer=window.setInterval(()=>void load(),15000);
    return()=>window.clearInterval(timer);
  },[load]);

  const latest=useMemo(()=>[...(tracking?.events??[])].reverse().find(e=>e.event_type==="location"&&e.latitude!==null&&e.longitude!==null),[tracking]);
  if(loading)return <p className="mt-3 text-xs text-slate-500">Chargement du suivi GPS…</p>;
  if(error)return <p role="alert" className="mt-3 text-xs text-amber-800">{error}</p>;
  if(!tracking)return <p className="mt-3 text-xs text-slate-500">La mission n’a pas encore été créée.</p>;

  const driver=[tracking.livreur?.first_name,tracking.livreur?.last_name].filter(Boolean).join(" ")||tracking.livreur?.username||"Livreur affecté";
  const focus=latest
    ? {lat:latest.latitude as number,lng:latest.longitude as number}
    : tracking.latitude_pharmacie!==null&&tracking.longitude_pharmacie!==null
      ? {lat:tracking.latitude_pharmacie,lng:tracking.longitude_pharmacie}
      : tracking.latitude_destination!==null&&tracking.longitude_destination!==null
        ? {lat:tracking.latitude_destination,lng:tracking.longitude_destination}
        : null;

  return <section className="mt-3 rounded-xl border border-emerald-100 p-3">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-emerald-800">Suivi opérationnel</p>
        <p className="mt-1 text-sm font-extrabold">{labels[tracking.statut]??tracking.statut}</p>
        <p className="text-xs text-slate-600">{driver}</p>
      </div>
      <button type="button" onClick={()=>void load()} className="rounded-lg border px-3 py-2 text-xs font-bold">Actualiser</button>
    </div>
    {latest&&<p className="mt-2 text-xs text-slate-500">Position reçue : {new Date(latest.created_at).toLocaleTimeString("fr-FR")}</p>}
    {focus
      ? <iframe title="Carte de suivi du livreur" className="mt-3 h-52 w-full rounded-lg border-0" loading="lazy"
          src={"https://www.openstreetmap.org/export/embed.html?bbox="+(focus.lng-0.01)+"%2C"+(focus.lat-0.01)+"%2C"+(focus.lng+0.01)+"%2C"+(focus.lat+0.01)+"&layer=mapnik&marker="+focus.lat+"%2C"+focus.lng}/>
      : <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">La position GPS n’est pas encore partagée. Elle sera affichée après le retrait du colis.</p>}
    {latest&&typeof tracking.latitude_destination==="number"&&typeof tracking.longitude_destination==="number"&&
      <a className="mt-2 inline-flex text-xs font-bold underline" target="_blank" rel="noreferrer"
        href={"https://www.google.com/maps/dir/?api=1&origin="+latest.latitude+","+latest.longitude+"&destination="+tracking.latitude_destination+","+tracking.longitude_destination+"&travelmode=driving"}>
        Ouvrir l’itinéraire dans Google Maps
      </a>}
  </section>;
}
