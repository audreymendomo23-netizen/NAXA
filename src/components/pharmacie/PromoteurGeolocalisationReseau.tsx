"use client";
import { useState } from "react";
import { modifierGeolocalisationPharmacie } from "@/app/pharmacie/promoteur/actions";
export type PromoteurGeoPharmacie = {
  id:string;nom:string;ville:string|null;quartier:string|null;lat:number|null;lng:number|null;
  geo_statut:string;geo_source_type:string|null;geo_mise_a_jour:string|null;geo_verifiee_le:string|null;archivee_le:string|null;
};
function FormulairePosition({pharmacie}:{pharmacie:PromoteurGeoPharmacie}) {
 const [lat,setLat]=useState(pharmacie.lat==null?"":String(pharmacie.lat));
 const [lng,setLng]=useState(pharmacie.lng==null?"":String(pharmacie.lng));
 const [source,setSource]=useState<"gps"|"saisie_manuelle">(pharmacie.geo_source_type==="gps"?"gps":"saisie_manuelle");
 const [status,setStatus]=useState(""); const [loading,setLoading]=useState(false);
 function utiliserPosition(){
  if(!window.isSecureContext){setStatus("Le GPS nécessite HTTPS. Saisissez les coordonnées manuellement.");return;}
  if(!navigator.geolocation){setStatus("GPS indisponible. Utilisez les champs manuels.");return;}
  setLoading(true);setStatus("Recherche de la position… Placez-vous physiquement à cette pharmacie.");
  navigator.geolocation.getCurrentPosition(({coords})=>{setLat(coords.latitude.toFixed(7));setLng(coords.longitude.toFixed(7));setSource("gps");setLoading(false);setStatus("Position GPS reçue. Vérifiez que le point correspond à l'entrée de cette pharmacie.");},
   error=>{setLoading(false);setStatus(error.code===error.PERMISSION_DENIED?"Autorisation GPS refusée. Activez la localisation et l'autorisation du navigateur.":"Position GPS indisponible. Réessayez à l'extérieur ou saisissez les coordonnées manuellement.");},
   {enableHighAccuracy:true,timeout:25000,maximumAge:0});
 }
 const hasCoords=lat.trim()!==""&&lng.trim()!==""&&Number.isFinite(Number(lat))&&Number.isFinite(Number(lng));
 const mapUrl=hasCoords?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lat+","+lng)}`:null;
 return <form action={modifierGeolocalisationPharmacie} className="mt-3 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
  <input type="hidden" name="pharmacie_id" value={pharmacie.id}/><input type="hidden" name="geo_source_type" value={source}/>
  <div className="grid grid-cols-2 gap-3">
   <label className="text-sm font-semibold">Latitude<input name="lat" type="number" step="any" required value={lat} onChange={e=>{setLat(e.target.value);setSource("saisie_manuelle");}} className="mt-1 min-h-11 w-full rounded-lg border bg-white px-3"/></label>
   <label className="text-sm font-semibold">Longitude<input name="lng" type="number" step="any" required value={lng} onChange={e=>{setLng(e.target.value);setSource("saisie_manuelle");}} className="mt-1 min-h-11 w-full rounded-lg border bg-white px-3"/></label>
  </div>
  <button type="button" disabled={loading} onClick={utiliserPosition} className="min-h-10 w-full rounded-lg border border-naxa-green-900 bg-white px-3 py-2 text-sm font-bold text-naxa-green-900 disabled:opacity-60">{loading?"Localisation en cours…":"◎ Capturer le GPS ici (être à cette pharmacie)"}</button>
  {mapUrl&&<a href={mapUrl} target="_blank" rel="noreferrer" className="inline-flex text-sm font-semibold underline">Contrôler les coordonnées sur la carte ↗</a>}
  {status&&<p role="status" aria-live="polite" className="text-sm text-slate-600">{status}</p>}
  <p className="text-xs text-slate-500">La nouvelle position passe en « à vérifier ». L’administrateur NAXA reste seul habilité à la certifier.</p>
  <button className="min-h-11 w-full rounded-lg bg-naxa-green-900 px-4 py-2 font-bold text-white">Enregistrer la géolocalisation de cette pharmacie</button>
 </form>;
}
export default function PromoteurGeolocalisationReseau({pharmacies}:{pharmacies:PromoteurGeoPharmacie[]}) {
 const [filter,setFilter]=useState("");
 const visible=pharmacies.filter(ph=>[ph.nom,ph.ville??"",ph.quartier??""].join(" ").toLocaleLowerCase("fr").includes(filter.trim().toLocaleLowerCase("fr")));
 const verified=pharmacies.filter(ph=>ph.geo_statut==="verifiee_terrain").length;
 return <section id="geolocalisation-reseau" className="rounded-3xl border border-naxa-green-100 bg-white p-4 sm:p-6">
  <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-extrabold">Géolocalisation de chaque pharmacie</h2><p className="mt-1 text-sm text-naxa-green-700">Chaque établissement possède ses propres coordonnées GPS, indépendamment de votre position personnelle.</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{verified}/{pharmacies.length} vérifiée(s)</span></div>
  <label className="mt-4 block text-sm font-semibold">Rechercher une pharmacie de votre réseau<input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Nom, ville ou quartier" className="mt-1 min-h-11 w-full rounded-xl border px-3"/></label>
  {!visible.length?<p className="mt-3 text-sm text-slate-600">Aucune pharmacie correspondant à la recherche.</p>:<div className="mt-4 grid gap-3 xl:grid-cols-2">{visible.map(ph=>{
   const isVerified=ph.geo_statut==="verifiee_terrain",pending=ph.geo_statut==="a_verifier"||ph.geo_statut==="source_publique_a_confirmer";
   const badge=isVerified?"Vérifiée terrain":pending?"À vérifier":ph.lat!=null&&ph.lng!=null?"Position non certifiée":"GPS non renseigné";
   return <article key={ph.id} className="min-w-0 rounded-2xl border p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-extrabold">{ph.nom}</h3><p className="text-sm text-slate-600">{[ph.quartier,ph.ville].filter(Boolean).join(" · ")}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{badge}</span></div>
    <p className="mt-2 text-xs text-slate-500">Coordonnées : {ph.lat==null||ph.lng==null?"non renseignées":`${ph.lat}, ${ph.lng}`} · Source : {ph.geo_source_type??"non renseignée"}</p>
    <FormulairePosition pharmacie={ph}/>
   </article>;
  })}</div>}
 </section>;
}
