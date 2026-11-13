"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { requestHomeService } from "@/app/prestations/actions";
import { obtenirPositionGPS, type CoordonneesGPS, type ErreurGPS } from "@/lib/geolocation";

type HomeServiceOffer = {
  offer_id: string; partner_id: string; partner_name: string; city: string | null;
  neighborhood: string | null; name: string; category: string; description: string | null;
  service_area_label: string; price_fcfa: number | null;
};
type NearbyResult = { offer_id: string; distance_km: number };
const field = "mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900";
const money = (value:number) => new Intl.NumberFormat("fr-FR",{maximumFractionDigits:0}).format(value)+" FCFA";
const gpsErrors:Record<ErreurGPS,string> = {
  indisponible:"La géolocalisation n’est pas disponible sur cet appareil.",
  refusee:"L’accès à votre position a été refusé. La recherche par quartier reste disponible.",
  introuvable:"Votre position n’a pas pu être déterminée. Réessayez ou recherchez par localité.",
  timeout:"La localisation a pris trop de temps. Réessayez.",
  invalide:"Le navigateur a renvoyé une position invalide. Elle n’a pas été partagée.",
};

export function PrestationsCatalogue({offers,categories,initialQuery,initialCategory,initialSort,assistanceMode}:{
  offers:HomeServiceOffer[]; categories:string[]; initialQuery:string; initialCategory:string; initialSort:string; assistanceMode:boolean;
}) {
  const [query,setQuery]=useState(initialQuery);
  const [category,setCategory]=useState(initialCategory);
  const [sort,setSort]=useState(initialSort);
  const [radius,setRadius]=useState("25");
  const [position,setPosition]=useState<CoordonneesGPS|null>(null);
  const [nearby,setNearby]=useState<NearbyResult[]|null>(null);
  const [nearbyEnabled,setNearbyEnabled]=useState(initialSort==="proximite");
  const [busy,setBusy]=useState(false);
  const [geoError,setGeoError]=useState("");
  const [shareByOffer,setShareByOffer]=useState<Record<string,boolean>>({});

  async function searchWithPosition(gps:CoordonneesGPS,km:string) {
    setBusy(true); setGeoError("");
    try {
      const params=new URLSearchParams({lat:String(gps.lat),lng:String(gps.lng),rayon_km:km});
      const response=await fetch("/api/prestations/proches?"+params.toString(),{headers:{Accept:"application/json"},cache:"no-store"});
      const payload=await response.json() as {results?:NearbyResult[];error?:string};
      if(!response.ok) throw new Error(payload.error||"La recherche à proximité est indisponible.");
      setNearby(Array.isArray(payload.results)?payload.results:[]);
      setNearbyEnabled(true); setSort("proximite");
    } catch(error) {
      setNearby(null); setNearbyEnabled(false);
      setGeoError(error instanceof Error?error.message:"La recherche à proximité a échoué.");
    } finally { setBusy(false); }
  }

  async function enableNearby() {
    setBusy(true); setGeoError("");
    try {
      const gps=await obtenirPositionGPS();
      setPosition(gps);
      await searchWithPosition(gps,radius);
    } catch(error) {
      const code=error as ErreurGPS;
      setGeoError(code in gpsErrors?gpsErrors[code]:"Impossible d’obtenir votre position.");
      setNearbyEnabled(false);
    } finally { setBusy(false); }
  }

  const distances=useMemo(()=>new Map((nearby??[]).map(item=>[item.offer_id,item.distance_km])),[nearby]);
  const filtered=useMemo(()=>{
    const q=query.trim().toLocaleLowerCase("fr");
    const rows=offers.filter(o=>{
      const haystack=[o.name,o.category,o.description??"",o.partner_name,o.city??"",o.neighborhood??"",o.service_area_label].join(" ").toLocaleLowerCase("fr");
      return (!q||haystack.includes(q))&&(!category||o.category===category)&&(!nearbyEnabled||distances.has(o.offer_id));
    });
    rows.sort((a,b)=>{
      if(nearbyEnabled||sort==="proximite") return (distances.get(a.offer_id)??Number.MAX_SAFE_INTEGER)-(distances.get(b.offer_id)??Number.MAX_SAFE_INTEGER);
      if(sort==="prix-croissant") return (a.price_fcfa??Number.MAX_SAFE_INTEGER)-(b.price_fcfa??Number.MAX_SAFE_INTEGER);
      if(sort==="prix-decroissant") return (b.price_fcfa??-1)-(a.price_fcfa??-1);
      if(sort==="nom") return a.name.localeCompare(b.name,"fr");
      return 0;
    });
    return rows;
  },[offers,query,category,nearbyEnabled,distances,sort]);

  function reset() {setQuery("");setCategory("");setSort("pertinence");setNearbyEnabled(false);setNearby(null);setPosition(null);setGeoError("");setShareByOffer({});}

  return <section className="mt-5">
    {assistanceMode&&<div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-blue-950"><p className="text-xs font-extrabold uppercase tracking-wider">Depuis vos dispositifs connectés</p><h2 className="mt-1 text-lg font-black">Demande d’assistance à domicile</h2><p className="mt-1 text-sm leading-6">Recherchez un professionnel près de vous, puis choisissez une prestation. Aucun relevé, historique de mesure ou donnée de vos appareils n’est transmis.</p></div>}
    <form onSubmit={e=>e.preventDefault()} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4" role="search" aria-label="Filtrer les prestations à domicile">
      <label className="text-sm font-semibold lg:col-span-2">Rechercher<input className={field} value={query} onChange={e=>setQuery(e.target.value)} placeholder="Service, professionnel, quartier…"/></label>
      <label className="text-sm font-semibold">Catégorie<select className={field} value={category} onChange={e=>setCategory(e.target.value)}><option value="">Toutes les catégories</option>{categories.map(c=><option key={c} value={c}>{c}</option>)}</select></label>
      <label className="text-sm font-semibold">Trier par<select className={field} value={sort} onChange={e=>{const v=e.target.value;setSort(v);if(v==="proximite"){setNearbyEnabled(true);if(position)void searchWithPosition(position,radius);}else{setNearbyEnabled(false);setNearby(null);}}}><option value="pertinence">Pertinence</option><option value="proximite">À proximité (GPS)</option><option value="nom">Nom</option><option value="prix-croissant">Prix croissant</option><option value="prix-decroissant">Prix décroissant</option></select></label>
      <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-4">
        <button type="button" onClick={()=>void enableNearby()} disabled={busy} className="min-h-11 rounded-xl bg-[#064B2A] px-4 font-bold text-white disabled:opacity-50">{busy?"Localisation en cours…":"Rechercher autour de moi"}</button>
        {nearbyEnabled&&<label className="text-sm font-semibold">Rayon<select className={field} value={radius} onChange={e=>{setRadius(e.target.value);if(position)void searchWithPosition(position,e.target.value);}}><option value="5">5 km</option><option value="10">10 km</option><option value="25">25 km</option><option value="50">50 km</option></select></label>}
        <button type="button" onClick={reset} className="min-h-11 rounded-xl border border-slate-300 px-4 font-bold text-slate-700">Réinitialiser</button>
      </div>
      {geoError&&<p role="alert" className="text-sm text-red-800 sm:col-span-2 lg:col-span-4">{geoError}</p>}
      {nearbyEnabled&&position&&<p role="status" className="text-xs leading-5 text-slate-600 sm:col-span-2 lg:col-span-4">Position utilisée ponctuellement pour le tri (précision navigateur : environ {Math.round(position.precisionMetres)} m). Distances à vol d’oiseau, indicatives. Cette position n’est pas transmise au professionnel sans votre accord distinct.</p>}
      <p className="text-xs text-slate-500 sm:col-span-2 lg:col-span-4">{filtered.length} prestation(s) affichée(s) sur {offers.length} publiée(s).</p>
    </form>
    <div className="mt-6 grid gap-5 lg:grid-cols-2">
      {filtered.map(offer=>{
        const share=shareByOffer[offer.offer_id]===true;
        return <article key={offer.offer_id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="bg-[#FFF8F5] p-5"><p className="text-xs font-extrabold uppercase tracking-wide text-[#D4402B]">{offer.category}</p><h2 className="mt-1 text-xl font-black">{offer.name}</h2>
            {offer.description&&<p className="mt-2 text-sm leading-6 text-slate-600">{offer.description}</p>}<p className="mt-3 text-sm font-semibold">{offer.partner_name}</p>
            <p className="text-sm text-slate-600">{[offer.neighborhood,offer.city].filter(Boolean).join(" · ")||"Zone communiquée par le professionnel"}</p>
            <p className="mt-2 text-sm text-slate-700">Zone d’intervention : <strong>{offer.service_area_label}</strong></p>
            {nearbyEnabled&&distances.has(offer.offer_id)&&<p className="mt-2 text-sm font-bold text-[#064B2A]">À environ {distances.get(offer.offer_id)?.toFixed(1)} km (à vol d’oiseau)</p>}
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
            <label className="flex items-start gap-2 rounded-xl border border-slate-200 p-3 text-sm leading-5"><input type="checkbox" name="share_location" value="true" checked={share} onChange={e=>setShareByOffer(current=>({...current,[offer.offer_id]:e.target.checked}))} disabled={!position}/><span><strong>Partager ma position GPS avec ce professionnel</strong><span className="block text-xs text-slate-600">{position?"Facultatif. Un seul point GPS est communiqué après confirmation; aucun suivi continu n’est activé.":"Obtenez d’abord votre position avec « Rechercher autour de moi ». La recherche classique reste disponible sans GPS."}</span></span></label>
            <p className="rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600">L’adresse exacte, le téléphone et la position GPS partagée ne sont accessibles au professionnel qu’après confirmation de la demande. Aucun paiement n’est collecté par NAXA.</p>
            <button className="min-h-11 w-full rounded-xl bg-[#D4402B] px-4 py-3 font-bold text-white">Envoyer la demande</button>
          </form>
        </article>;
      })}
      {filtered.length===0&&<div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600 lg:col-span-2">{nearbyEnabled?"Aucune prestation géolocalisée ne correspond à ce rayon. Les professionnels sans coordonnées GPS restent visibles en désactivant le filtre À proximité.":"Aucune prestation ne correspond à ces filtres. Modifiez la recherche ou réinitialisez les filtres."}</div>}
    </div>
    {nearbyEnabled&&<p className="mt-4 text-xs leading-5 text-slate-500">Les professionnels sans coordonnées d’établissement exploitables ne sont pas classés par proximité ; ils restent accessibles dans le catalogue général.</p>}
    <div className="mt-5"><Link href="/suivi" className="text-sm font-bold text-[#064B2A] underline">Retour à mes dispositifs connectés</Link></div>
  </section>;
}
