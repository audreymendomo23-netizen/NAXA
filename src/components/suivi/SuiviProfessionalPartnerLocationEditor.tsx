"use client";

import { useState } from "react";
import { enregistrerPositionProfessionnelle } from "@/app/suivi/professionnel/actions";
import { obtenirPositionGPS, type ErreurGPS } from "@/lib/geolocation";

export type ProfessionalPartnerLocation = {
  partner_id:string;partner_name:string;city:string|null;neighborhood:string|null;
  admin_latitude:number|null;admin_longitude:number|null;
  provider_latitude:number|null;provider_longitude:number|null;provider_location_updated_at:string|null;
};
const field="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900";
const geoErrors:Record<ErreurGPS,string>={
  indisponible:"La géolocalisation n’est pas disponible sur cet appareil.",
  refusee:"L’accès à votre position a été refusé.",
  introuvable:"Votre position n’a pas pu être déterminée.",
  timeout:"La localisation a pris trop de temps. Réessayez.",
  invalide:"Le navigateur a renvoyé une position invalide."
};

export function SuiviProfessionalPartnerLocationEditor({partners}:{partners:ProfessionalPartnerLocation[]}) {
  const [values,setValues]=useState<Record<string,{lat:string;lng:string}>>(()=>Object.fromEntries(partners.map(p=>[
    p.partner_id,{lat:p.provider_latitude==null?"":String(p.provider_latitude),lng:p.provider_longitude==null?"":String(p.provider_longitude)}
  ])));
  const [busy,setBusy]=useState<string|null>(null);
  const [notice,setNotice]=useState<Record<string,string>>({});
  function update(id:string,patch:Partial<{lat:string;lng:string}>){
    setValues(current=>({...current,[id]:{...current[id],...patch}}));
  }
  async function useGps(id:string){
    setBusy(id);setNotice(current=>({...current,[id]:""}));
    try{
      const gps=await obtenirPositionGPS();
      update(id,{lat:String(gps.lat),lng:String(gps.lng)});
      setNotice(current=>({...current,[id]:"Position capturée. Enregistrez pour qu’elle devienne prioritaire."}));
    }catch(error){
      const code=error as ErreurGPS;
      setNotice(current=>({...current,[id]:code in geoErrors?geoErrors[code]:"Impossible de lire la position GPS."}));
    }finally{setBusy(null);}
  }
  if(!partners.length) return <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
    <h2 className="text-lg font-extrabold text-amber-950">Position du partenaire</h2>
    <p className="mt-2 text-sm leading-6 text-amber-900">Votre compte professionnel n’est pas encore rattaché à un partenaire actif de Prestations à domicile. Vous pouvez définir votre planning personnel ; la localisation partenaire sera disponible après votre affectation.</p>
  </section>;

  return <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
    <p className="text-xs font-extrabold uppercase tracking-wider text-blue-700">Géolocalisation · Africa/Douala</p>
    <h2 className="mt-1 text-xl font-black text-slate-900">Ma position professionnelle</h2>
    <p className="mt-2 text-sm leading-6 text-slate-600">Votre position est prioritaire sur celle saisie par l’Admin. Vous pouvez la modifier à tout moment. Pour revenir à la position Admin, effacez les deux coordonnées puis enregistrez.</p>
    <div className="mt-4 space-y-3">
      {partners.map(partner=>{
        const value=values[partner.partner_id]??{lat:"",lng:""};
        const own=partner.provider_latitude!=null&&partner.provider_longitude!=null;
        const admin=partner.admin_latitude!=null&&partner.admin_longitude!=null;
        return <article key={partner.partner_id} className="rounded-xl border border-slate-200 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div><h3 className="font-extrabold">{partner.partner_name}</h3><p className="mt-1 text-xs text-slate-500">{[partner.neighborhood,partner.city].filter(Boolean).join(" · ")}</p></div>
            <span className={"rounded-full px-2 py-1 text-xs font-bold "+(own?"bg-emerald-50 text-emerald-900":admin?"bg-blue-50 text-blue-900":"bg-amber-50 text-amber-900")}>{own?"Position professionnelle active":admin?"Repli Admin utilisé":"Aucune position définie"}</span>
          </div>
          <p className="mt-2 text-sm text-slate-700">Position actuellement utilisée : <strong>{own?"Votre position":admin?"Position Admin":"Non définie"}</strong></p>
          {partner.provider_location_updated_at&&<p className="mt-1 text-xs text-slate-500">Dernière modification : {new Date(partner.provider_location_updated_at).toLocaleString("fr-FR",{timeZone:"Africa/Douala"})}</p>}
          <form action={enregistrerPositionProfessionnelle} className="mt-3 space-y-3">
            <input type="hidden" name="partner_id" value={partner.partner_id}/>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-semibold">Latitude<input className={field} name="latitude" type="number" step="any" min="-90" max="90" value={value.lat} onChange={event=>update(partner.partner_id,{lat:event.target.value})}/></label>
              <label className="text-sm font-semibold">Longitude<input className={field} name="longitude" type="number" step="any" min="-180" max="180" value={value.lng} onChange={event=>update(partner.partner_id,{lng:event.target.value})}/></label>
            </div>
            {notice[partner.partner_id]&&<p role="status" className="text-xs text-slate-600">{notice[partner.partner_id]}</p>}
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={()=>void useGps(partner.partner_id)} disabled={busy===partner.partner_id} className="min-h-10 rounded-lg border border-blue-300 px-3 text-sm font-bold text-blue-900 disabled:opacity-50">{busy===partner.partner_id?"Localisation…":"Définir avec ma position actuelle"}</button>
              <button className="min-h-10 rounded-lg bg-[#123D68] px-4 text-sm font-bold text-white">Enregistrer ma position</button>
              <button type="button" onClick={()=>update(partner.partner_id,{lat:"",lng:""})} className="min-h-10 rounded-lg border border-slate-300 px-3 text-sm font-bold text-slate-700">Revenir à la position Admin</button>
            </div>
            <p className="text-xs leading-5 text-slate-500">{admin?"La position Admin reste conservée en secours.":"L’Admin pourra définir une position de référence en secours."} Aucune géolocalisation continue n’est activée.</p>
          </form>
        </article>;
      })}
    </div>
  </section>;
}
