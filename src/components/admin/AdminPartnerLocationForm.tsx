"use client";

import { useState } from "react";
import { enregistrerPositionAdminPartenaire } from "@/app/admin/promoteurs/partenaires/actions";
import { obtenirPositionGPS, type ErreurGPS } from "@/lib/geolocation";

const field="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900";
const geoErrors:Record<ErreurGPS,string>={
  indisponible:"La géolocalisation n’est pas disponible sur cet appareil.",
  refusee:"L’accès à votre position a été refusé.",
  introuvable:"Votre position n’a pas pu être déterminée.",
  timeout:"La localisation a pris trop de temps. Réessayez.",
  invalide:"Le navigateur a renvoyé une position invalide."
};

export function AdminPartnerLocationForm({partnerId,latitude,longitude}:{partnerId:string;latitude:string;longitude:string}) {
  const [lat,setLat]=useState(latitude);
  const [lng,setLng]=useState(longitude);
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState("");
  async function captureGpsPosition(){
    setBusy(true);setNotice("");
    try{
      const gps=await obtenirPositionGPS();
      setLat(String(gps.lat));setLng(String(gps.lng));
      setNotice("Position GPS capturée. Enregistrez pour définir la position Admin.");
    }catch(error){
      const code=error as ErreurGPS;
      setNotice(code in geoErrors?geoErrors[code]:"Impossible de lire la position GPS.");
    }finally{setBusy(false);}
  }
  return <form action={enregistrerPositionAdminPartenaire} className="space-y-3">
    <input type="hidden" name="partner_id" value={partnerId}/>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm font-semibold">Latitude<input className={field} name="latitude" type="number" step="any" min="-90" max="90" value={lat} onChange={event=>setLat(event.target.value)} required/></label>
      <label className="text-sm font-semibold">Longitude<input className={field} name="longitude" type="number" step="any" min="-180" max="180" value={lng} onChange={event=>setLng(event.target.value)} required/></label>
    </div>
    {notice&&<p role="status" className="text-xs text-slate-600">{notice}</p>}
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={()=>void captureGpsPosition()} disabled={busy} className="min-h-10 rounded-lg border border-blue-300 px-3 text-sm font-bold text-blue-900 disabled:opacity-50">{busy?"Localisation…":"Prendre la position de cet appareil"}</button>
      <button className="min-h-10 rounded-lg bg-blue-800 px-4 text-sm font-bold text-white">Enregistrer la position Admin</button>
    </div>
    <p className="text-xs leading-5 text-slate-500">Utilisez le GPS sur place ou saisissez les coordonnées exactes du partenaire. Les coordonnées servent au calcul de proximité ; le client ne voit pas le point GPS brut.</p>
  </form>;
}
