"use client";

import {useCallback,useEffect,useMemo,useState} from "react";
import {supabaseBrowser} from "@/lib/supabase/client";
import {DeliveryMissionChat} from "@/components/DeliveryMissionChat";

type DeliveryEvent={
  id:string;event_type:string;label:string;detail:string|null;
  latitude:number|null;longitude:number|null;created_at:string;
};
type Tracking={
  mission_id:string;statut:string;ready_at:string;accepted_at:string|null;
  picked_up_at:string|null;arrived_at:string|null;delivered_at:string|null;
  failure_code:string|null;
  client_confirme_at:string|null;livreur_confirme_at:string|null;signature_client:boolean;
  livreur:{first_name:string|null;last_name:string|null;username:string|null}|null;
  events:DeliveryEvent[];
};

const labels:Record<string,string>={
  available:"Commande prête · recherche d’un livreur",
  accepted:"Livreur attribué",
  picked_up:"Commande récupérée · en route",
  arrived:"Livreur arrivé · réception à confirmer",
  delivered:"Livraison confirmée",
  failed:"Difficulté de livraison signalée",
  cancelled:"Livraison annulée",
};
const time=(value:string)=>new Date(value).toLocaleString("fr-FR",{dateStyle:"medium",timeStyle:"short"});

export function SuiviLivraison({reservationId,echeanceAt,destinationLat,destinationLng}:{reservationId:string;echeanceAt?:string|null;destinationLat?:number|null;destinationLng?:number|null}){
  const [tracking,setTracking]=useState<Tracking|null>(null);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [note,setNote]=useState("");
  const [remaining,setRemaining]=useState("");

  const load=useCallback(async()=>{
    const {data,error:rpcError}=await supabaseBrowser().rpc("naxa_delivery_tracking",{p_reservation:reservationId});
    if(rpcError){
      setError("Le suivi de livraison est momentanément indisponible.");
    }else{
      setTracking(data as Tracking|null);
      setError("");
    }
    setLoading(false);
  },[reservationId]);

  useEffect(()=>{
    void load();
    const timer=window.setInterval(()=>void load(),15000);
    return()=>window.clearInterval(timer);
  },[load]);

  useEffect(()=>{
    if(!echeanceAt||!tracking?.picked_up_at)return;
    const tick=()=>{const ms=new Date(echeanceAt).getTime()-Date.now();setRemaining(ms<=0?"délai estimé dépassé":Math.ceil(ms/60000)+" min restantes");};
    tick();const timer=window.setInterval(tick,15000);return()=>window.clearInterval(timer);
  },[echeanceAt,tracking?.picked_up_at]);

  const events=useMemo(()=>[...(tracking?.events??[])].sort((a,b)=>new Date(a.created_at).getTime()-new Date(b.created_at).getTime()),[tracking]);
  const latestPosition=[...events].reverse().find(event=>event.event_type==="location"&&event.latitude!==null&&event.longitude!==null);
  const driverName=[tracking?.livreur?.first_name,tracking?.livreur?.last_name].filter(Boolean).join(" ")||tracking?.livreur?.username||"Livreur NAXA";

  async function confirmReceived(){
    if(!tracking?.mission_id||busy)return;
    setBusy(true);setError("");
    const {error:rpcError}=await supabaseBrowser().rpc("naxa_delivery_confirm_received",{
      p_mission:tracking.mission_id,p_note:note.trim()||null,
    });
    if(rpcError)setError(rpcError.message||"La confirmation de réception a échoué.");
    else {setNote("");await load();}
    setBusy(false);
  }

  if(loading)return <section className="carte"><p className="text-sm text-slate-600">Chargement du suivi de livraison…</p></section>;
  if(!tracking)return error?<section className="carte"><p className="text-sm text-slate-600">{error}</p></section>:<></>;

  const timeline=[
    {key:"ready_at",label:"Commande préparée",at:tracking.ready_at},
    {key:"accepted_at",label:"Livreur attribué",at:tracking.accepted_at},
    {key:"picked_up_at",label:"Commande récupérée à la pharmacie",at:tracking.picked_up_at},
    {key:"arrived_at",label:"Livreur arrivé à destination",at:tracking.arrived_at},
    {key:"delivered_at",label:"Réception confirmée",at:tracking.delivered_at},
  ].filter(item=>Boolean(item.at));

  return <section className="carte space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="text-lg font-extrabold">Suivi de votre livraison</h2><p className="mt-1 text-sm text-slate-600">{labels[tracking.statut]??tracking.statut}</p></div>
      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-950">Mise à jour automatique</span>
    </div>
    {tracking.livreur&&<div className="rounded-xl bg-slate-50 p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Votre livreur</p>
      <p className="mt-1 font-extrabold">{driverName}</p>
    </div>}
    <DeliveryMissionChat reservationId={reservationId} viewer="client"/>
    <ol className="space-y-3">
      {timeline.map(item=><li key={item.key} className="flex gap-3">
        <span className="mt-1 h-3 w-3 shrink-0 rounded-full bg-emerald-700"/>
        <div><p className="text-sm font-bold">{item.label}</p><time className="text-xs text-slate-500">{time(item.at as string)}</time></div>
      </li>)}
    </ol>
    {echeanceAt&&tracking.picked_up_at&&<p className="rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-950">Délai de livraison : {remaining||"calcul en cours"}</p>}
    {latestPosition&&typeof latestPosition.latitude==="number"&&typeof latestPosition.longitude==="number"&&<div className="rounded-xl border border-emerald-100 p-3">
      <p className="text-sm font-bold">Position du Livreur · actualisée {time(latestPosition.created_at)}</p>
      <iframe title="Position actuelle du livreur" className="mt-2 h-52 w-full rounded-lg border-0" loading="lazy" src={"https://www.openstreetmap.org/export/embed.html?bbox="+(latestPosition.longitude-0.008)+"%2C"+(latestPosition.latitude-0.008)+"%2C"+(latestPosition.longitude+0.008)+"%2C"+(latestPosition.latitude+0.008)+"&layer=mapnik&marker="+latestPosition.latitude+"%2C"+latestPosition.longitude}/>
      {typeof destinationLat==="number"&&typeof destinationLng==="number"&&<a className="mt-2 inline-flex text-sm font-bold text-emerald-900 underline" href={"https://www.google.com/maps/dir/?api=1&origin="+latestPosition.latitude+","+latestPosition.longitude+"&destination="+destinationLat+","+destinationLng+"&travelmode=driving"} target="_blank" rel="noreferrer">Ouvrir l’itinéraire dans Google Maps</a>}
    </div>}
    {tracking.statut==="arrived"&&<div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <div><h3 className="font-extrabold text-amber-950">Votre livreur est arrivé</h3><p className="mt-1 text-sm text-amber-900">La livraison sera clôturée après confirmation du Client et du Livreur.</p></div>
      <p className="text-sm font-semibold text-amber-950">Votre confirmation : {tracking.client_confirme_at?"enregistrée":"en attente"} · Confirmation Livreur : {tracking.livreur_confirme_at?"enregistrée":"en attente"}</p>
      {!tracking.client_confirme_at&&<><label className="block text-sm font-semibold text-amber-950">Commentaire facultatif
        <textarea value={note} onChange={event=>setNote(event.target.value)} maxLength={300} rows={2} className="mt-1 w-full rounded-lg border border-amber-300 bg-white p-3"/>
      </label><button type="button" disabled={busy} onClick={()=>void confirmReceived()} className="min-h-11 w-full rounded-xl bg-[#0B3D26] px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{busy?"Confirmation…":"Confirmer que j’ai reçu la commande"}</button></>}
      {tracking.client_confirme_at&&!tracking.livreur_confirme_at&&<p className="rounded-lg bg-white p-3 text-sm text-amber-950">Votre confirmation est enregistrée. La remise sera clôturée dès que le Livreur aura également confirmé.</p>}
    </div>}
    {tracking.statut==="delivered"&&<p className="rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-950">Livraison terminée · réception confirmée le {time(tracking.delivered_at as string)}.</p>}
    {tracking.statut==="failed"&&<p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950">Le livreur a signalé une difficulté. La pharmacie doit organiser la suite de la livraison.</p>}
    {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
  </section>;
}
