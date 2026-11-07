"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

export type DeliveryTariffZone = {
  id:string;
  nom:string;
  zone_type:"periurbaine"|"eloignee"|"difficile";
  centre_latitude:number;
  centre_longitude:number;
  rayon_km:number;
  supplement_fcfa:number;
  actif:boolean;
};

type Candidate={
  id:string;label:string;type:string;region:string|null;departement:string|null;
  arrondissement:string|null;commune:string|null;lat:number;lng:number;precision:string;source:string;
};

type Draft={
  nom:string;zone_type:DeliveryTariffZone["zone_type"];
  centre_latitude:string;centre_longitude:string;rayon_km:string;supplement_fcfa:string;
};

const defaultSupplement:Record<Draft["zone_type"],number>={
  periurbaine:300,eloignee:700,difficile:1200,
};
const zoneLabel:Record<Draft["zone_type"],string>={
  periurbaine:"Périurbaine",eloignee:"Éloignée",difficile:"Accès difficile",
};
const initialDraft:Draft={
  nom:"",zone_type:"eloignee",centre_latitude:"",centre_longitude:"",
  rayon_km:"3",supplement_fcfa:String(defaultSupplement.eloignee),
};

export function DeliveryTariffZoneConfig({zones}:{zones:DeliveryTariffZone[]}) {
  const [rows,setRows]=useState(zones);
  const [draft,setDraft]=useState<Draft>(initialDraft);
  const [search,setSearch]=useState("");
  const [candidates,setCandidates]=useState<Candidate[]>([]);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");

  async function locate() {
    if(busy||search.trim().length<2)return;
    setBusy(true);setError("");setMessage("");setCandidates([]);
    try {
      const response=await fetch("/api/geolocalisation/recherche?q="+encodeURIComponent(search.trim()),{cache:"no-store"});
      const payload=await response.json() as {
        lat?:number;lng?:number;label?:string;error?:string;candidates?:Candidate[];
      };
      if(response.status===409&&Array.isArray(payload.candidates)){
        setCandidates(payload.candidates);
        setMessage("Plusieurs lieux correspondent. Sélectionnez le bon lieu avant de définir le rayon.");
      }else if(!response.ok||typeof payload.lat!=="number"||typeof payload.lng!=="number"){
        throw new Error(payload.error||"Localité introuvable. Saisissez une autre localité ou corrigez les coordonnées.");
      }else{
        setDraft(current=>({...current,nom:current.nom||payload.label||search.trim(),
          centre_latitude:String(payload.lat),centre_longitude:String(payload.lng)}));
        setMessage("Centre géographique renseigné. Vérifiez le point et le rayon avant d’enregistrer.");
      }
    }catch(reason){
      setError(reason instanceof Error?reason.message:"Recherche géographique indisponible.");
    }finally{setBusy(false);}
  }

  function choose(candidate:Candidate) {
    setDraft(current=>({...current,nom:current.nom||candidate.label,
      centre_latitude:String(candidate.lat),centre_longitude:String(candidate.lng)}));
    setCandidates([]);
    setMessage("Lieu sélectionné. Les coordonnées de la source sont indicatives : vérifiez le centre exact.");
  }

  async function save() {
    if(busy)return;
    const latitude=Number(draft.centre_latitude),longitude=Number(draft.centre_longitude);
    const radius=Number(draft.rayon_km),supplement=Number(draft.supplement_fcfa);
    if(draft.nom.trim().length<2||!Number.isFinite(latitude)||latitude<1.5||latitude>13.2
      ||!Number.isFinite(longitude)||longitude<8.2||longitude>16.5
      ||!Number.isFinite(radius)||radius<=0||radius>50
      ||!Number.isSafeInteger(supplement)||supplement<0||supplement>5000){
      setError("Vérifiez le nom, les coordonnées camerounaises, le rayon (0–50 km) et la majoration (0–5 000 FCFA).");
      return;
    }
    setBusy(true);setError("");setMessage("");
    try{
      const sb=supabaseBrowser();
      const {data:auth}=await sb.auth.getUser();
      if(!auth.user)throw new Error("Session Admin requise.");
      const db=sb as any;
      const {data,error:saveError}=await db.from("naxa_delivery_tariff_zones")
        .insert({
          nom:draft.nom.trim(),zone_type:draft.zone_type,
          centre_latitude:latitude,centre_longitude:longitude,
          rayon_km:radius,supplement_fcfa:supplement,actif:true,
          created_by:auth.user.id,updated_by:auth.user.id,
        })
        .select("id,nom,zone_type,centre_latitude,centre_longitude,rayon_km,supplement_fcfa,actif")
        .single();
      if(saveError||!data)throw saveError||new Error("Zone non enregistrée.");
      setRows(current=>[...current,data as DeliveryTariffZone]);
      setDraft(initialDraft);setSearch("");setCandidates([]);
      setMessage("Zone tarifaire enregistrée. Elle est maintenant prise en compte par les prochains devis.");
    }catch(reason){
      setError(reason instanceof Error?reason.message:"Enregistrement de la zone impossible.");
    }finally{setBusy(false);}
  }

  async function toggle(row:DeliveryTariffZone) {
    if(busy)return;
    setBusy(true);setError("");setMessage("");
    try{
      const sb=supabaseBrowser();
      const {data:auth}=await sb.auth.getUser();
      if(!auth.user)throw new Error("Session Admin requise.");
      const db=sb as any;
      const next=!row.actif;
      const {error:updateError}=await db.from("naxa_delivery_tariff_zones")
        .update({actif:next,updated_at:new Date().toISOString(),updated_by:auth.user.id})
        .eq("id",row.id);
      if(updateError)throw updateError;
      setRows(current=>current.map(item=>item.id===row.id?{...item,actif:next}:item));
      setMessage(next?"Zone activée pour les prochains devis.":"Zone désactivée. Les devis déjà créés conservent leur tarif.");
    }catch(reason){
      setError(reason instanceof Error?reason.message:"Mise à jour de la zone impossible.");
    }finally{setBusy(false);}
  }

  return <section className="rounded-2xl border bg-white p-5 space-y-4">
    <div>
      <h2 className="text-lg font-extrabold">Zones tarifaires géographiques</h2>
      <p className="mt-1 text-sm text-slate-600">Définissez des cercles autour des quartiers ou localités éloignés. Le serveur compare la position GPS du Client à ces zones ; le Client ne peut pas choisir lui-même sa catégorie tarifaire.</p>
    </div>
    <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
      **Majoration initiale proposée et modifiable :** périurbaine +300 F ; éloignée +700 F ; accès difficile +1 200 F. En cas de chevauchement, « accès difficile » puis « éloignée » est prioritaire.
    </div>
    {error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {message&&<p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{message}</p>}

    <div className="rounded-xl border p-4 space-y-3">
      <h3 className="font-bold">Ajouter une zone</h3>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input value={search} onChange={event=>setSearch(event.target.value)} className="champ min-w-0 flex-1" placeholder="Rechercher une ville, un quartier ou une localité"/>
        <button type="button" disabled={busy||search.trim().length<2} onClick={()=>void locate()} className="min-h-11 rounded-lg border px-4 py-2 text-sm font-bold disabled:opacity-50">{busy?"Recherche…":"Localiser"}</button>
      </div>
      {candidates.length>0&&<div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
        <p className="text-sm font-bold text-amber-950">Choisissez la bonne localité :</p>
        {candidates.map(candidate=><button key={candidate.id} type="button" onClick={()=>choose(candidate)} className="flex min-h-11 w-full flex-col items-start rounded-lg bg-white px-3 py-2 text-left text-sm">
          <span className="font-bold">{candidate.label}</span>
          <span className="text-xs text-slate-600">{[candidate.type,candidate.commune,candidate.arrondissement,candidate.departement,candidate.region].filter(Boolean).join(" · ")}</span>
        </button>)}
      </div>}
      <label className="block text-sm font-semibold">Nom de la zone
        <input value={draft.nom} onChange={event=>setDraft(current=>({...current,nom:event.target.value}))} maxLength={120} className="champ mt-1 w-full" placeholder="Ex. périphérie nord de Bafoussam"/>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-semibold">Catégorie
          <select value={draft.zone_type} onChange={event=>{
            const zone_type=event.target.value as Draft["zone_type"];
            setDraft(current=>({...current,zone_type,supplement_fcfa:String(defaultSupplement[zone_type])}));
          }} className="champ mt-1 w-full">
            <option value="periurbaine">Périurbaine · plafond 3 500 F</option>
            <option value="eloignee">Éloignée · dépassement autorisé</option>
            <option value="difficile">Accès difficile · dépassement autorisé</option>
          </select>
        </label>
        <label className="block text-sm font-semibold">Majoration de zone (FCFA)
          <input type="number" min={0} max={5000} step={50} value={draft.supplement_fcfa} onChange={event=>setDraft(current=>({...current,supplement_fcfa:event.target.value}))} className="champ mt-1 w-full"/>
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-sm font-semibold">Latitude du centre
          <input type="number" step="0.000001" value={draft.centre_latitude} onChange={event=>setDraft(current=>({...current,centre_latitude:event.target.value}))} className="champ mt-1 w-full"/>
        </label>
        <label className="block text-sm font-semibold">Longitude du centre
          <input type="number" step="0.000001" value={draft.centre_longitude} onChange={event=>setDraft(current=>({...current,centre_longitude:event.target.value}))} className="champ mt-1 w-full"/>
        </label>
        <label className="block text-sm font-semibold">Rayon couvert (km)
          <input type="number" min={0.1} max={50} step={0.1} value={draft.rayon_km} onChange={event=>setDraft(current=>({...current,rayon_km:event.target.value}))} className="champ mt-1 w-full"/>
        </label>
      </div>
      <p className="text-xs text-slate-500">Le géocodeur fournit un point de départ parfois approximatif. Contrôlez le centre et le rayon avant activation. Une zone non configurée conserve le tarif standard plafonné à 3 500 FCFA.</p>
      <button type="button" disabled={busy} onClick={()=>void save()} className="min-h-11 rounded-xl bg-[#0B3D26] px-4 py-3 text-sm font-bold text-white disabled:opacity-50">Enregistrer la zone</button>
    </div>

    <div>
      <h3 className="font-bold">Zones configurées · {rows.length}</h3>
      {rows.length===0?<p className="mt-2 text-sm text-slate-600">Aucune zone spéciale configurée. Les destinations restent au tarif standard.</p>:<div className="mt-3 space-y-2">
        {rows.map(row=><article key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold">{row.nom}</span>
              <span className={"rounded-full px-2 py-1 text-xs font-bold "+(row.actif?"bg-emerald-50 text-emerald-900":"bg-slate-100 text-slate-600")}>{row.actif?"Active":"Désactivée"}</span>
            </div>
            <p className="mt-1 text-xs text-slate-600">{zoneLabel[row.zone_type]} · rayon {Number(row.rayon_km)} km · +{Number(row.supplement_fcfa).toLocaleString("fr-FR")} FCFA</p>
            <p className="text-xs text-slate-500">Centre : {Number(row.centre_latitude).toFixed(5)}, {Number(row.centre_longitude).toFixed(5)}</p>
          </div>
          <button type="button" disabled={busy} onClick={()=>void toggle(row)} className="min-h-10 rounded-lg border px-3 py-2 text-sm font-bold disabled:opacity-50">{row.actif?"Désactiver":"Activer"}</button>
        </article>)}
      </div>}
    </div>
  </section>;
}
