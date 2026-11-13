"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { requestHomeService } from "@/app/prestations/actions";
import { obtenirPositionGPS, type CoordonneesGPS, type ErreurGPS } from "@/lib/geolocation";

type HomeServiceOffer = {
  offer_id:string; partner_id:string; partner_name:string; city:string|null; neighborhood:string|null;
  name:string; category:string; description:string|null; service_area_label:string; price_fcfa:number|null;
  specialty:string|null; available_today:boolean; available_now:boolean;
  today_opens_at:string|null; today_closes_at:string|null;
};
type NearbyResult={offer_id:string;distance_km:number};
type Intent={specialties:string[];keywords:string[];source:"ai"|"local"};

const field="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900";
const money=(value:number)=>new Intl.NumberFormat("fr-FR",{maximumFractionDigits:0}).format(value)+" FCFA";
const days=["Dimanche","Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi"];
const gpsErrors:Record<ErreurGPS,string>={
  indisponible:"La géolocalisation n’est pas disponible sur cet appareil.",
  refusee:"L’accès à votre position a été refusé. Vous pouvez toujours utiliser les autres filtres.",
  introuvable:"Votre position n’a pas pu être déterminée. Réessayez.",
  timeout:"La localisation a pris trop de temps. Réessayez.",
  invalide:"Le navigateur a renvoyé une position invalide. Elle n’a pas été partagée.",
};
const localHints:Array<{terms:string[];specialties:string[]}>= [
  {terms:["cou","nuque","cervical","torticolis"],specialties:["Médecin généraliste","Kinésithérapeute","Rhumatologue"]},
  {terms:["dos","lombaire","lumbago","sciatique"],specialties:["Médecin généraliste","Kinésithérapeute","Rhumatologue"]},
  {terms:["tête","tete","migraine","mal de tête"],specialties:["Médecin généraliste","Neurologue"]},
  {terms:["oreille","nez","gorge","sinus"],specialties:["Médecin généraliste","ORL"]},
  {terms:["dent","molaire","gencive"],specialties:["Chirurgien-dentiste"]},
  {terms:["yeux","oeil","vision"],specialties:["Ophtalmologue"]},
  {terms:["coeur","cœur","palpitation","poitrine"],specialties:["Médecin généraliste","Cardiologue"]},
  {terms:["toux","respire","souffle","asthme"],specialties:["Médecin généraliste","Pneumologue"]},
  {terms:["peau","eczéma","eczema","bouton"],specialties:["Médecin généraliste","Dermatologue"]},
  {terms:["ventre","estomac","digestion"],specialties:["Médecin généraliste","Gastro-entérologue"]},
  {terms:["grossesse","enceinte","règles","regles"],specialties:["Sage-femme","Gynécologue"]},
  {terms:["enfant","bébé","bebe"],specialties:["Pédiatre","Médecin généraliste"]},
];
function normalize(value:string){return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("fr").replace(/[^a-z0-9]+/g," ").trim();}
function editDistance(a:string,b:string){
  const aa=a.slice(0,80),bb=b.slice(0,80);
  const row=Array.from({length:bb.length+1},(_,i)=>i);
  for(let i=1;i<=aa.length;i++){
    let previous=row[0];row[0]=i;
    for(let j=1;j<=bb.length;j++){
      const current=row[j];
      row[j]=Math.min(row[j]+1,row[j-1]+1,previous+(aa[i-1]===bb[j-1]?0:1));
      previous=current;
    }
  }
  return row[bb.length];
}
function closeMatch(query:string,candidate:string){
  const q=normalize(query),c=normalize(candidate);
  if(!q||!c)return false;
  if(c.includes(q)||c.split(" ").some(word=>word.startsWith(q)))return true;
  if(q.length<3)return false;
  return c.split(" ").some(word=>word.length>=q.length-1&&editDistance(q,word.slice(0,q.length+1))<=Math.max(1,Math.floor(q.length/4)));
}
function localIntent(query:string):Intent{
  const q=normalize(query);
  const matches=localHints.filter(group=>group.terms.some(term=>q.includes(normalize(term))));
  return {specialties:[...new Set(matches.flatMap(group=>group.specialties))].slice(0,6),keywords:q.split(" ").filter(x=>x.length>=3).slice(0,8),source:"local"};
}
function formatTime(value:string|null){return value?value.slice(0,5):"—";}

export function PrestationsCatalogue({offers,initialQuery,assistanceMode}:{offers:HomeServiceOffer[];initialQuery:string;assistanceMode:boolean}){
  const [query,setQuery]=useState(initialQuery);
  const [availability,setAvailability]=useState("all");
  const [radius,setRadius]=useState("25");
  const [nearby,setNearby]=useState<NearbyResult[]|null>(null);
  const [nearbyEnabled,setNearbyEnabled]=useState(false);
  const [position,setPosition]=useState<CoordonneesGPS|null>(null);
  const [specialty,setSpecialty]=useState("");
  const [intent,setIntent]=useState<Intent>({specialties:[],keywords:[],source:"local"});
  const [allowExternalAi,setAllowExternalAi]=useState(false);
  const [aiBusy,setAiBusy]=useState(false);
  const [aiNotice,setAiNotice]=useState("");
  const [busy,setBusy]=useState(false);
  const [geoError,setGeoError]=useState("");
  const [shareByOffer,setShareByOffer]=useState<Record<string,boolean>>({});
  const [suggestionOpen,setSuggestionOpen]=useState(false);

  useEffect(()=>{
    if(query.trim().length<2){setIntent({specialties:[],keywords:[],source:"local"});setAiNotice("");return;}
    const local=localIntent(query);
    setIntent(local);
    if(!allowExternalAi)return;
    const controller=new AbortController();
    const timer=setTimeout(async()=>{
      setAiBusy(true);setAiNotice("");
      try{
        const response=await fetch("/api/medical/specialty-intent",{
          method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json"},
          body:JSON.stringify({description:query.trim().slice(0,500),allow_external_ai:true}),
          signal:controller.signal,cache:"no-store"
        });
        const data=await response.json() as Intent & {error?:string};
        if(!response.ok)throw new Error(data.error||"Analyse IA momentanément indisponible.");
        if(!controller.signal.aborted)setIntent({specialties:Array.isArray(data.specialties)?data.specialties:[],keywords:Array.isArray(data.keywords)?data.keywords:[],source:data.source==="ai"?"ai":"local"});
        if(!controller.signal.aborted)setAiNotice(data.source==="ai"?"Spécialités suggérées par IA.":"IA indisponible : suggestions locales utilisées.");
      }catch(error){
        if(!controller.signal.aborted){setIntent(local);setAiNotice(error instanceof Error?error.message:"Suggestions locales utilisées.");}
      }finally{if(!controller.signal.aborted)setAiBusy(false);}
    },500);
    return()=>{clearTimeout(timer);controller.abort();};
  },[query,allowExternalAi]);

  async function searchWithPosition(gps:CoordonneesGPS,km:string){
    setBusy(true);setGeoError("");
    try{
      const response=await fetch("/api/prestations/proches",{method:"POST",headers:{Accept:"application/json","Content-Type":"application/json"},body:JSON.stringify({lat:gps.lat,lng:gps.lng,rayon_km:Number(km)}),cache:"no-store"});
      const payload=await response.json() as {results?:NearbyResult[];error?:string};
      if(!response.ok)throw new Error(payload.error||"La recherche à proximité est indisponible.");
      setNearby(Array.isArray(payload.results)?payload.results:[]);setNearbyEnabled(true);
    }catch(error){setNearby(null);setNearbyEnabled(false);setGeoError(error instanceof Error?error.message:"La recherche à proximité a échoué.");}
    finally{setBusy(false);}
  }
  async function enableNearby(){
    setBusy(true);setGeoError("");
    try{const gps=await obtenirPositionGPS();setPosition(gps);await searchWithPosition(gps,radius);}
    catch(error){const code=error as ErreurGPS;setGeoError(code in gpsErrors?gpsErrors[code]:"Impossible d’obtenir votre position.");setNearbyEnabled(false);}
    finally{setBusy(false);}
  }

  const distances=useMemo(()=>new Map((nearby??[]).map(row=>[row.offer_id,row.distance_km])),[nearby]);
  const specialties=useMemo(()=>[...new Set(offers.map(o=>(o.specialty??o.category)?.trim()).filter((x):x is string=>!!x))].sort((a,b)=>a.localeCompare(b,"fr")),[offers]);
  const suggestions=useMemo(()=>{
    const q=query.trim();if(q.length<2)return [];
    const values=[...new Set(offers.flatMap(o=>[o.name,o.partner_name,o.specialty??""]).filter(Boolean))];
    return values.map(value=>({value,match:closeMatch(q,value)})).filter(x=>x.match).slice(0,7).map(x=>x.value);
  },[offers,query]);

  const filtered=useMemo(()=>{
    const hasQuery=query.trim().length>=2;
    const aiSpecialties=intent.specialties.map(normalize);
    const aiKeywords=intent.keywords.map(normalize);
    const result=offers.filter(offer=>{
      const nameHit=!hasQuery||closeMatch(query,offer.name)||closeMatch(query,offer.partner_name)
        ||closeMatch(query,offer.specialty??"")||closeMatch(query,offer.category);
      const intentHit=aiSpecialties.some(s=>normalize(offer.specialty??offer.category).includes(s)||s.includes(normalize(offer.specialty??offer.category)))
        ||aiKeywords.some(word=>normalize([offer.name,offer.specialty??"",offer.category,offer.description??""].join(" ")).includes(word));
      const queryHit=!hasQuery||nameHit||intentHit;
      const availabilityHit=availability==="all"||(availability==="today"&&offer.available_today)||(availability==="now"&&offer.available_now);
      const distanceHit=!nearbyEnabled||distances.has(offer.offer_id);
      const specialtyHit=!specialty||normalize(offer.specialty??offer.category)===normalize(specialty);
      return queryHit&&availabilityHit&&distanceHit&&specialtyHit;
    });
    if(nearbyEnabled)result.sort((a,b)=>(distances.get(a.offer_id)??Number.MAX_SAFE_INTEGER)-(distances.get(b.offer_id)??Number.MAX_SAFE_INTEGER));
    return result;
  },[offers,query,intent,availability,nearbyEnabled,distances,specialty]);

  function reset(){
    setQuery("");setAvailability("all");setNearby(null);setNearbyEnabled(false);setPosition(null);setGeoError("");setSpecialty("");setShareByOffer({});setSuggestionOpen(false);setAllowExternalAi(false);setIntent({specialties:[],keywords:[],source:"local"});
  }

  return <section className="mt-5">
    {assistanceMode&&<div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-blue-950"><p className="text-xs font-extrabold uppercase tracking-wider">Depuis vos dispositifs connectés</p><h2 className="mt-1 text-lg font-black">Demande d’assistance à domicile</h2><p className="mt-1 text-sm leading-6">Décrivez votre besoin pour orienter la recherche vers une spécialité appropriée. Vos mesures et l’historique de vos appareils ne sont jamais transmis.</p></div>}

    <form onSubmit={event=>event.preventDefault()} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-3" role="search" aria-label="Rechercher un professionnel de santé">
      <label className="relative text-sm font-semibold sm:col-span-2 lg:col-span-3">Décrivez votre besoin ou recherchez un nom<input className={field} value={query} onFocus={()=>setSuggestionOpen(true)} onBlur={()=>setTimeout(()=>setSuggestionOpen(false),120)} onChange={event=>setQuery(event.target.value)} placeholder="Ex. j’ai mal au cou, nom du professionnel…"/>
        {suggestionOpen&&query.trim().length>=2&&suggestions.length>0&&<ul className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg">{suggestions.map(value=><li key={value}><button type="button" onMouseDown={event=>event.preventDefault()} onClick={()=>{setQuery(value);setSuggestionOpen(false);}} className="min-h-10 w-full rounded-lg px-3 text-left text-sm hover:bg-slate-50">{value}</button></li>)}</ul>}
      </label>
      <label className="text-sm font-semibold">Disponibilité<select className={field} value={availability} onChange={event=>setAvailability(event.target.value)}><option value="all">Toutes</option><option value="today">Disponible aujourd’hui</option><option value="now">Disponible maintenant</option></select></label>
      <label className="text-sm font-semibold">Proximité<select className={field} value={nearbyEnabled?"gps":"all"} onChange={event=>{if(event.target.value==="gps")void enableNearby();else{setNearbyEnabled(false);setNearby(null);setPosition(null);}}}><option value="all">Toutes les distances</option><option value="gps">Autour de moi (GPS)</option></select></label>
      <label className="text-sm font-semibold">Spécialité<select className={field} value={specialty} onChange={event=>setSpecialty(event.target.value)}><option value="">Toutes les spécialités</option>{[...new Set([...specialties,...intent.specialties])].sort((a,b)=>a.localeCompare(b,"fr")).map(value=><option key={value} value={value}>{value}</option>)}</select></label>

      <div className="sm:col-span-2 lg:col-span-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <label className="flex items-start gap-2 text-sm font-semibold"><input type="checkbox" checked={allowExternalAi} onChange={event=>setAllowExternalAi(event.target.checked)} className="mt-1 h-4 w-4"/><span>Autoriser l’analyse IA de ma description<span className="mt-1 block text-xs font-normal leading-5 text-slate-600">Après votre accord, la description de recherche est transmise à un fournisseur IA pour proposer des spécialités et mots-clés. Sans cet accord, seules des suggestions locales sont utilisées. L’analyse ne pose aucun diagnostic.</span></span></label>
        {aiBusy&&<p className="mt-2 text-xs text-slate-600">Analyse des spécialités en cours…</p>}
        {aiNotice&&<p role="status" className="mt-2 text-xs text-slate-600">{aiNotice}</p>}
        {intent.specialties.length>0&&<p className="mt-2 text-xs font-semibold text-blue-900">Spécialités suggérées : {intent.specialties.join(" · ")}</p>}
      </div>
      {nearbyEnabled&&<div className="sm:col-span-2 lg:col-span-3 flex flex-wrap items-center gap-2"><label className="text-sm font-semibold">Rayon<select className={field} value={radius} onChange={event=>{setRadius(event.target.value);if(position)void searchWithPosition(position,event.target.value);}}><option value="5">5 km</option><option value="10">10 km</option><option value="25">25 km</option><option value="50">50 km</option></select></label>{position&&<span className="text-xs text-slate-500">Position ponctuelle · précision {Math.round(position.precisionMetres)} m</span>}</div>}
      {geoError&&<p role="alert" className="text-sm text-red-800 sm:col-span-2 lg:col-span-3">{geoError}</p>}
      <div className="flex flex-wrap items-center justify-between gap-2 sm:col-span-2 lg:col-span-3"><p className="text-xs text-slate-500">{filtered.length} résultat(s) · Suggestions dès 2 caractères</p><button type="button" onClick={reset} className="min-h-10 rounded-lg border border-slate-300 px-3 text-sm font-bold">Réinitialiser les filtres</button></div>
    </form>

    <div className="mt-6 grid gap-5 lg:grid-cols-2">
      {filtered.map(offer=>{
        const share=shareByOffer[offer.offer_id]===true;
        return <article key={offer.offer_id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="bg-[#FFF8F5] p-5">
            <p className="text-xs font-extrabold uppercase tracking-wide text-[#D4402B]">{offer.specialty||offer.category}</p>
            <h2 className="mt-1 text-xl font-black">{offer.name}</h2>
            {offer.description&&<p className="mt-2 text-sm leading-6 text-slate-600">{offer.description}</p>}
            <p className="mt-3 text-sm font-semibold">{offer.partner_name}</p>
            <p className="text-sm text-slate-600">{[offer.neighborhood,offer.city].filter(Boolean).join(" · ")||"Zone communiquée par le professionnel"}</p>
            <p className="mt-2 text-sm text-slate-700">Zone d’intervention : <strong>{offer.service_area_label}</strong></p>
            {nearbyEnabled&&distances.has(offer.offer_id)&&<p className="mt-2 text-sm font-bold text-[#064B2A]">À environ {distances.get(offer.offer_id)?.toFixed(1)} km (à vol d’oiseau)</p>}
            <div className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
              <p className="text-xs font-extrabold uppercase tracking-wider text-slate-500">{days[new Date().getDay()]}</p>
              {offer.available_today&&offer.today_opens_at&&offer.today_closes_at
                ? <p className="mt-1 text-sm font-bold text-emerald-800">{offer.available_now?"Ouvert maintenant":"Ouverture prévue aujourd’hui"} · {formatTime(offer.today_opens_at)} – {formatTime(offer.today_closes_at)}</p>
                : <p className="mt-1 text-sm font-semibold text-slate-600">Fermé aujourd’hui</p>}
            </div>
            <p className="mt-3 text-lg font-black">{offer.price_fcfa==null?"Tarif à confirmer":money(Number(offer.price_fcfa))}</p>
          </div>
          <form action={requestHomeService} className="space-y-3 p-5">
            <input type="hidden" name="offer_id" value={offer.offer_id}/>
            <input type="hidden" name="shared_latitude" value={share&&position?String(position.lat):""}/>
            <input type="hidden" name="shared_longitude" value={share&&position?String(position.lng):""}/>
            <input type="hidden" name="shared_accuracy_m" value={share&&position?String(position.precisionMetres):""}/>
            <input type="hidden" name="source_demande" value={assistanceMode?"dispositifs-connectes":"prestations"}/>
            <h3 className="font-extrabold">Demander cette prestation</h3>
            <label className="block text-sm font-semibold">Quartier ou zone souhaitée<input className={field} name="area_label" required minLength={2} maxLength={180} placeholder="Ex. Bastos, Yaoundé"/></label>
            <label className="block text-sm font-semibold">Adresse exacte<input className={field} name="exact_address" required minLength={5} maxLength={500} autoComplete="street-address" placeholder="Adresse complète pour l’intervention"/></label>
            <label className="block text-sm font-semibold">Téléphone de contact<input className={field} name="contact_phone" type="tel" required minLength={7} maxLength={40} autoComplete="tel" placeholder="+237…"/></label>
            <label className="block text-sm font-semibold">Date et heure souhaitées (facultatif)<input className={field} name="preferred_at" type="datetime-local"/></label>
            <label className="block text-sm font-semibold">Précisions utiles (facultatif)<textarea className={field} name="client_note" maxLength={500} rows={3} placeholder="Informations pratiques nécessaires à la demande"/></label>
            <label className="flex items-start gap-2 rounded-xl border border-slate-200 p-3 text-sm leading-5"><input type="checkbox" name="share_location" value="true" checked={share} onChange={event=>setShareByOffer(current=>({...current,[offer.offer_id]:event.target.checked}))} disabled={!position}/><span><strong>Partager ma position GPS avec ce professionnel</strong><span className="block text-xs text-slate-600">{position?"Facultatif. Un seul point GPS est communiqué après confirmation; aucun suivi continu n’est activé.":"Obtenez d’abord votre position avec le filtre Proximité. La recherche sans GPS reste disponible."}</span></span></label>
            <p className="rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600">L’adresse exacte, le téléphone et la position GPS partagée ne sont accessibles au professionnel qu’après confirmation de la demande. Aucun paiement n’est collecté par NAXA.</p>
            <button className="min-h-11 w-full rounded-xl bg-[#D4402B] px-4 py-3 font-bold text-white">Envoyer la demande</button>
          </form>
        </article>;
      })}
      {filtered.length===0&&<div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600 lg:col-span-2">Aucun résultat ne correspond aux filtres sélectionnés. Modifiez la disponibilité, la proximité ou la spécialité.</div>}
    </div>
    <div className="mt-5"><Link href="/suivi" className="text-sm font-bold text-[#064B2A] underline">Retour à mes dispositifs connectés</Link></div>
  </section>;
}
