"use client";

import { useCallback,useEffect,useMemo,useState } from "react";
import { obtenirPositionGPS,type CoordonneesGPS,type ErreurGPS } from "@/lib/geolocation";

type Professional={
  user_id:string;professional_role:string;display_name:string;specialty:string|null;
  partner_name:string|null;city:string|null;neighborhood:string|null;distance_km:number|null;
  available_today:boolean;available_now:boolean;today_opens_at:string|null;today_closes_at:string|null;
};
type Intent={specialties:string[];keywords:string[];source:"ai"|"local"};
const field="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900";
const roleLabels:Record<string,string>={medecin:"Médecin",pharmacien:"Pharmacien",infirmier:"Infirmier",sage_femme:"Sage-femme",chirurgien_dentiste:"Chirurgien-dentiste",kinesitherapeute:"Kinésithérapeute",technicien_laboratoire:"Technicien de laboratoire",autre_sante:"Professionnel de santé"};
const roleSpecialtyLabels:Record<string,string>={medecin:"Médecin généraliste",pharmacien:"Pharmacien",infirmier:"Infirmier",sage_femme:"Sage-femme",chirurgien_dentiste:"Chirurgien-dentiste",kinesitherapeute:"Kinésithérapeute",technicien_laboratoire:"Technicien de laboratoire",autre_sante:"Autre spécialité"};
const gpsErrors:Record<ErreurGPS,string>={indisponible:"La géolocalisation n’est pas disponible.",refusee:"Accès à la position refusé.",introuvable:"Position impossible à déterminer.",timeout:"Délai de localisation dépassé.",invalide:"Position GPS invalide."};
function normalize(value:string){return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("fr").replace(/[^a-z0-9]+/g," ").trim();}
function distance(a:string,b:string){
  const aa=a.slice(0,70),bb=b.slice(0,70),row=Array.from({length:bb.length+1},(_,i)=>i);
  for(let i=1;i<=aa.length;i++){let prev=row[0];row[0]=i;for(let j=1;j<=bb.length;j++){const current=row[j];row[j]=Math.min(row[j]+1,row[j-1]+1,prev+(aa[i-1]===bb[j-1]?0:1));prev=current;}}
  return row[bb.length];
}
function fuzzy(q:string,value:string){
  const query=normalize(q),text=normalize(value);
  if(!query)return true;
  if(text.includes(query)||text.split(" ").some(word=>word.startsWith(query)))return true;
  if(query.length<3)return false;
  return text.split(" ").some(word=>word.length>=query.length-1&&distance(query,word.slice(0,query.length+1))<=Math.max(1,Math.floor(query.length/4)));
}
function localSpecialties(q:string):string[]{
  const text=normalize(q);
  const hints:Array<[string[],string[]]>=[
    [["cou","nuque","cervical","torticolis"],["Médecin généraliste","Kinésithérapeute","Rhumatologue"]],
    [["dos","lombaire","lumbago","sciatique"],["Médecin généraliste","Kinésithérapeute","Rhumatologue"]],
    [["tete","migraine","cephalee"],["Médecin généraliste","Neurologue"]],
    [["oreille","nez","gorge","sinus"],["Médecin généraliste","ORL"]],
    [["dent","molaire","gencive"],["Chirurgien-dentiste"]],
    [["yeux","oeil","vision"],["Ophtalmologue"]],
    [["coeur","palpitation","poitrine"],["Médecin généraliste","Cardiologue"]],
    [["toux","respire","souffle","asthme"],["Médecin généraliste","Pneumologue"]],
    [["peau","eczema","bouton"],["Médecin généraliste","Dermatologue"]],
    [["ventre","estomac","digestion"],["Médecin généraliste","Gastro-entérologue"]],
    [["grossesse","enceinte","regles"],["Sage-femme","Gynécologue"]],
    [["enfant","bebe","nourrisson"],["Pédiatre","Médecin généraliste"]]
  ];
  return [...new Set(hints.filter(([terms])=>terms.some(t=>text.includes(t))).flatMap(([,specialties])=>specialties))].slice(0,6);
}
function time(value:string|null){return value?value.slice(0,5):"—";}

export function SuiviProfessionalDirectorySearch({selectedId,onSelect}:{selectedId:string;onSelect:(id:string)=>void}){
  const [professionals,setProfessionals]=useState<Professional[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [query,setQuery]=useState("");
  const [availability,setAvailability]=useState("all");
  const [specialty,setSpecialty]=useState("");
  const [proximity,setProximity]=useState(false);
  const [radius,setRadius]=useState("25");
  const [position,setPosition]=useState<CoordonneesGPS|null>(null);
  const [busyGps,setBusyGps]=useState(false);
  const [allowExternalAi,setAllowExternalAi]=useState(false);
  const [intent,setIntent]=useState<Intent>({specialties:[],keywords:[],source:"local"});
  const [aiNotice,setAiNotice]=useState("");
  const [suggestionOpen,setSuggestionOpen]=useState(false);

  const loadDirectory=useCallback(async(gps?:CoordonneesGPS,km=radius)=>{
    setLoading(true);setError("");
    try{
      const response=await fetch("/api/suivi/professionnels/recherche",{method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify(gps?{lat:gps.lat,lng:gps.lng,radius_km:Number(km)}:{}),cache:"no-store"});
      const data=await response.json() as {results?:Professional[];error?:string};
      if(!response.ok)throw new Error(data.error||"Annuaire indisponible.");
      setProfessionals(Array.isArray(data.results)?data.results:[]);
    }catch(e){setError(e instanceof Error?e.message:"Impossible de charger l’annuaire.");}
    finally{setLoading(false);}
  },[radius]);

  useEffect(()=>{void loadDirectory();},[loadDirectory]);

  useEffect(()=>{
    if(query.trim().length<2){setIntent({specialties:[],keywords:[],source:"local"});setAiNotice("");return;}
    const local=localSpecialties(query);
    setIntent({specialties:local,keywords:normalize(query).split(" ").filter(x=>x.length>=3),source:"local"});
    if(!allowExternalAi)return;
    const controller=new AbortController();
    const timer=setTimeout(async()=>{
      try{
        const response=await fetch("/api/medical/specialty-intent",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({description:query.trim().slice(0,500),allow_external_ai:true}),signal:controller.signal,cache:"no-store"});
        const data=await response.json() as Intent & {error?:string};
        if(!response.ok)throw new Error(data.error||"Analyse indisponible.");
        if(!controller.signal.aborted){setIntent({specialties:data.specialties??[],keywords:data.keywords??[],source:data.source==="ai"?"ai":"local"});setAiNotice(data.source==="ai"?"Spécialités suggérées par IA.":"Suggestions locales utilisées.");}
      }catch(e){if(!controller.signal.aborted)setAiNotice(e instanceof Error?e.message:"Suggestions locales utilisées.");}
    },500);
    return()=>{clearTimeout(timer);controller.abort();};
  },[query,allowExternalAi]);

  async function enableProximity(){
    setBusyGps(true);setError("");
    try{const gps=await obtenirPositionGPS();setPosition(gps);setProximity(true);await loadDirectory(gps,radius);}
    catch(e){const code=e as ErreurGPS;setError(code in gpsErrors?gpsErrors[code]:"Position indisponible.");}
    finally{setBusyGps(false);}
  }

  const specialtyOptions=useMemo(()=>[...new Set([...professionals.map(p=>p.specialty||roleSpecialtyLabels[p.professional_role]||roleLabels[p.professional_role]).filter((value):value is string=>!!value),...intent.specialties])].sort((a,b)=>a.localeCompare(b,"fr")),[professionals,intent]);
  const suggestions=useMemo(()=>{
    if(query.trim().length<2)return [];
    return [...new Set(professionals.filter(p=>fuzzy(query,p.display_name)).map(p=>p.display_name))].slice(0,7);
  },[query,professionals]);
  const filtered=useMemo(()=>{
    const q=query.trim();
    return professionals.filter(p=>{
      const hasQuery=q.length>=2;
      const nameMatch=!hasQuery||fuzzy(q,p.display_name)||fuzzy(q,p.specialty??"")||fuzzy(q,p.partner_name??"")||fuzzy(q,p.city??"");
      const professionalSpecialty=p.specialty||roleSpecialtyLabels[p.professional_role]||roleLabels[p.professional_role]||"";
      const intentMatch=intent.specialties.some(item=>normalize(professionalSpecialty).includes(normalize(item))||normalize(item).includes(normalize(professionalSpecialty)));
      const queryMatch=!hasQuery||nameMatch||intentMatch;
      const availabilityMatch=availability==="all"||(availability==="today"&&p.available_today)||(availability==="now"&&p.available_now);
      const specialtyMatch=!specialty||normalize(professionalSpecialty)===normalize(specialty);
      return queryMatch&&availabilityMatch&&specialtyMatch;
    }).sort((a,b)=>{
      if(availability==="now")return Number(b.available_now)-Number(a.available_now);
      if(proximity)return (a.distance_km??Number.MAX_SAFE_INTEGER)-(b.distance_km??Number.MAX_SAFE_INTEGER);
      return a.display_name.localeCompare(b.display_name,"fr");
    });
  },[professionals,query,availability,specialty,intent,proximity]);

  return <section className="mt-3 space-y-3">
    <label className="relative block text-sm font-semibold">Rechercher un nom ou décrire un problème<input className={field} value={query} onFocus={()=>setSuggestionOpen(true)} onBlur={()=>setTimeout(()=>setSuggestionOpen(false),120)} onChange={e=>setQuery(e.target.value)} placeholder="Deux lettres minimum, ou « j’ai mal au cou »…"/>
      {suggestionOpen&&query.trim().length>=2&&suggestions.length>0&&<ul className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border bg-white p-1 shadow-lg">{suggestions.map(name=><li key={name}><button type="button" onMouseDown={e=>e.preventDefault()} onClick={()=>{setQuery(name);setSuggestionOpen(false);}} className="min-h-10 w-full rounded-lg px-3 text-left text-sm hover:bg-slate-50">{name}</button></li>)}</ul>}
    </label>
    <div className="grid gap-2 sm:grid-cols-3">
      <label className="text-sm font-semibold">Disponibilité<select className={field} value={availability} onChange={e=>setAvailability(e.target.value)}><option value="all">Toutes</option><option value="today">Disponible aujourd’hui</option><option value="now">Disponible maintenant</option></select></label>
      <label className="text-sm font-semibold">Proximité<select className={field} value={proximity?"gps":"all"} onChange={e=>{if(e.target.value==="gps")void enableProximity();else{setProximity(false);setPosition(null);void loadDirectory();}}}><option value="all">Toutes les distances</option><option value="gps">Autour de moi (GPS)</option></select></label>
      <label className="text-sm font-semibold">Spécialité<select className={field} value={specialty} onChange={e=>setSpecialty(e.target.value)}><option value="">Toutes les spécialités</option>{specialtyOptions.map(item=><option key={item} value={item}>{item}</option>)}</select></label>
    </div>
    <div className="rounded-xl border bg-slate-50 p-3">
      <label className="flex items-start gap-2 text-sm font-semibold"><input type="checkbox" className="mt-1 h-4 w-4" checked={allowExternalAi} onChange={e=>setAllowExternalAi(e.target.checked)}/><span>Autoriser l’analyse IA de ma description<span className="mt-1 block text-xs font-normal text-slate-600">Votre description est transmise à un fournisseur IA uniquement après votre accord. Sans accord, des mots-clés locaux sont utilisés. Cette orientation ne constitue pas un diagnostic.</span></span></label>
      {aiNotice&&<p role="status" className="mt-2 text-xs text-slate-600">{aiNotice}</p>}
      {intent.specialties.length>0&&<p className="mt-2 text-xs font-semibold text-blue-900">Spécialités suggérées : {intent.specialties.join(" · ")}</p>}
    </div>
    {proximity&&<div className="flex flex-wrap items-center gap-2"><label className="text-sm font-semibold">Rayon<select className={field} value={radius} onChange={e=>{setRadius(e.target.value);if(position)void loadDirectory(position,e.target.value);}}><option value="5">5 km</option><option value="10">10 km</option><option value="25">25 km</option><option value="50">50 km</option></select></label><span className="text-xs text-slate-500">Distance à vol d’oiseau · {position?Math.round(position.precisionMetres)+" m de précision GPS":""}</span></div>}
    {error&&<p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">{error}</p>}
    {loading?<p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">Recherche des professionnels agréés…</p>:<p className="text-xs text-slate-500">{filtered.length} professionnel(s) correspondant(s). Suggestions disponibles dès 2 caractères.</p>}
    <div className="space-y-2">
      {filtered.map(professional=><article key={professional.user_id} className={"rounded-xl border p-3 "+(selectedId===professional.user_id?"border-emerald-700 bg-emerald-50":"border-slate-200 bg-white")}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div><p className="font-extrabold text-slate-900">{professional.display_name}</p><p className="mt-1 text-sm text-slate-600">{roleLabels[professional.professional_role]??"Professionnel de santé"}{professional.specialty?" · "+professional.specialty:""}</p>{professional.partner_name&&<p className="mt-1 text-xs text-slate-500">{professional.partner_name} · {[professional.neighborhood,professional.city].filter(Boolean).join(" · ")}</p>}</div>
          <button type="button" onClick={()=>onSelect(professional.user_id)} className={"min-h-10 rounded-lg px-3 text-sm font-bold "+(selectedId===professional.user_id?"bg-emerald-800 text-white":"border border-slate-300 text-slate-800")}>{selectedId===professional.user_id?"Sélectionné":"Choisir"}</button>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
          <span className={professional.available_now?"font-bold text-emerald-800":professional.available_today?"font-semibold text-blue-800":"text-slate-500"}>{professional.available_now?"Disponible maintenant":professional.available_today?"Disponible aujourd’hui":"Indisponible aujourd’hui"}</span>
          {professional.today_opens_at&&professional.today_closes_at&&<span className="text-slate-600">Horaires du jour : {time(professional.today_opens_at)} – {time(professional.today_closes_at)}</span>}
          {professional.distance_km!==null&&<span className="font-semibold text-slate-600">{professional.distance_km.toFixed(1)} km</span>}
        </div>
      </article>)}
      {!loading&&!filtered.length&&<p className="rounded-xl border border-dashed p-4 text-sm text-slate-600">Aucun professionnel ne correspond aux filtres actuels.</p>}
    </div>
  </section>;
}
