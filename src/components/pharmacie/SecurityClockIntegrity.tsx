"use client";
import {useEffect,useState} from "react";
type Gateway={id:string;label:string;pharmacyName:string;sample:null|{ntpServer:string;stratum:number;offsetMs:number;roundTripMs:number;clockStatus:"synchronized"|"warning";measuredAt:string}};
function age(value:string){const t=Date.parse(value);if(!Number.isFinite(t))return{label:"date inconnue",fresh:false};const d=Date.now()-t;if(d< -30000||d>600000)return{label:"mesure périmée",fresh:false};return{label:Math.max(0,Math.round(d/60000))+" min",fresh:true};}
export function SecurityClockIntegrity(){
 const [items,setItems]=useState<Gateway[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState("");
 useEffect(()=>{let cancelled=false;(async()=>{try{const res=await fetch("/api/security/time-integrity",{cache:"no-store",credentials:"same-origin"});const data=await res.json().catch(()=>({}));if(!res.ok||data.ok!==true||!Array.isArray(data.gateways))throw new Error(data.error||"État NTP indisponible.");if(!cancelled)setItems(data.gateways as Gateway[]);}catch(e){if(!cancelled)setError(e instanceof Error?e.message:"État NTP indisponible.");}finally{if(!cancelled)setLoading(false);}})();return()=>{cancelled=true;};},[]);
 return <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5" aria-label="Intégrité temporelle des passerelles">
  <h3 className="font-extrabold">Horloge & intégrité temporelle</h3>
  <p className="mt-1 text-sm text-slate-600">Mesures SNTP des passerelles ; elles ne certifient pas l'horloge des caméras ou NVR.</p>
  {error&&<p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
  {loading?<p className="mt-3 text-sm text-slate-600">Chargement…</p>:!items.length?<p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">Aucune passerelle sur une pharmacie active.</p>:
  <ul className="mt-3 space-y-3">{items.map(g=>{const s=g.sample,a=s?age(s.measuredAt):null;const good=!!s&&!!a?.fresh&&s.clockStatus==="synchronized"&&Math.abs(s.offsetMs)<=1000&&s.roundTripMs<=1500;return <li key={g.id} className="rounded-xl border border-slate-200 p-3">
   <div className="flex flex-wrap justify-between gap-2"><div><p className="font-semibold">{g.label}</p><p className="text-xs text-slate-500">{g.pharmacyName}</p></div>
   <span className={"rounded-full px-2.5 py-1 text-xs font-bold "+(good?"bg-emerald-100 text-emerald-900":"bg-amber-100 text-amber-900")}>{good?"Mesure dans le seuil":s?(a?.fresh?"Dérive / latence à revoir":"Mesure périmée"):"Non mesurée"}</span></div>
   {s?<div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600 sm:grid-cols-4">
    <p><span className="block text-slate-400">Décalage</span><strong>{(s.offsetMs>0?"+":"")+s.offsetMs.toLocaleString("fr-FR")} ms</strong></p>
    <p><span className="block text-slate-400">RTT</span><strong>{s.roundTripMs} ms</strong></p>
    <p><span className="block text-slate-400">Stratum</span><strong>{s.stratum}</strong></p>
    <p><span className="block text-slate-400">Âge</span><strong>{a?.label}</strong></p>
    <p className="col-span-2 sm:col-span-4"><span className="text-slate-400">NTP :</span> {s.ntpServer} · {new Date(s.measuredAt).toLocaleString("fr-FR",{timeZone:"Africa/Douala"})}</p>
   </div>:<p className="mt-2 text-xs text-slate-600">Configurer NAXA_NTP_SERVER sur la passerelle pour publier une mesure.</p>}
  </li>;})}</ul>}
  <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950">Seuil indicatif ±1 000 ms, RTT ≤1 500 ms, mesure de moins de 10 min. NAXA n'ajuste pas l'horloge de l'OS ; l'administrateur doit aussi vérifier les horloges caméra/NVR.</p>
 </section>;
}
