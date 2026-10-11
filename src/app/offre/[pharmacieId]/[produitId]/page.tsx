"use client";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { fcfa } from "@/lib/ranking";
import { ContacterPharmacie } from "@/components/ContacterPharmacie";
import { BoutonNotifications } from "@/components/BoutonNotifications";
import { Logo } from "@/components/Logo";
type Produit={id:string;nom:string;dci:string|null;dosage:string|null;forme:string|null;description:string|null;photo_url:string|null;fabricant:string|null;sur_ordonnance:boolean;prix:number|null};
type Pharmacie={id:string;nom:string;quartier:string|null;adresse:string|null;garde_debut:string|null;garde_fin:string|null};
export default function OffrePage(){
 const {pharmacieId,produitId}=useParams<{pharmacieId:string;produitId:string}>();const router=useRouter();const search=useSearchParams();
 const [p,setP]=useState<Produit|null>(null),[ph,setPh]=useState<Pharmacie|null>(null),[loading,setLoading]=useState(true),[erreur,setErreur]=useState("");
 useEffect(()=>{void(async()=>{const sb=supabaseBrowser();const [pr,pharm]=await Promise.all([sb.from("produits").select("id,nom,dci,dosage,forme,description,photo_url,fabricant,sur_ordonnance,prix").eq("id",produitId).maybeSingle(),sb.from("pharmacies").select("id,nom,quartier,adresse,garde_debut,garde_fin").eq("id",pharmacieId).maybeSingle()]);if(pr.error||pharm.error||!pr.data||!pharm.data)setErreur("Cette fiche n'est pas disponible pour le moment.");else{setP(pr.data as Produit);setPh(pharm.data as Pharmacie);}setLoading(false);})();},[pharmacieId,produitId]);
 const [q,setQ]=useState(1);
 return <main className="mx-auto min-h-screen max-w-2xl px-4 pb-24"><header className="-mx-4 flex items-center justify-between bg-naxa-green-900 px-4 py-3"><button onClick={()=>router.back()} className="text-xl text-white" aria-label="Retour">←</button><Link href="/"><Logo taille={32}/></Link><BoutonNotifications/></header>
 {loading&&<p className="mt-5">Chargement de la fiche…</p>}{erreur&&<p role="alert" className="carte mt-5 text-red-700">{erreur}</p>}
 {p&&ph&&<><section className="carte mt-5"><h1 className="text-xl font-extrabold">{ph.nom}</h1><p className="mt-1 text-sm text-slate-600">{[ph.quartier,ph.adresse].filter(Boolean).join(" · ")}</p>{ph.garde_debut&&ph.garde_fin&&<p className="mt-2 text-sm">Horaires communiqués : {ph.garde_debut} – {ph.garde_fin}</p>}</section>
 <section className="carte mt-4">{p.photo_url?<img src={p.photo_url} alt="" className="mb-3 h-40 w-full rounded-xl object-contain"/>:<div className="mb-3 flex h-28 items-center justify-center rounded-xl bg-naxa-green-50 font-black text-naxa-green-700">NAXA</div>}<h2 className="text-xl font-extrabold">{p.nom}</h2><p className="mt-1 text-sm text-slate-600">{[p.dci,p.dosage,p.forme].filter(Boolean).join(" · ")}</p>{p.fabricant&&<p className="mt-2 text-sm">Fabricant : {p.fabricant}</p>}{p.sur_ordonnance&&<span className="mt-2 inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">Sur ordonnance</span>}{p.description&&<p className="mt-3 text-sm">{p.description}</p>}<div className="mt-4"><p className="font-bold">Disponibilité</p><p className="text-sm text-slate-600">Confirmez le stock auprès de la pharmacie ; les quantités en direct ne sont pas encore exposées par cette fiche.</p></div>{p.prix!==null&&<p className="mt-3 text-xl font-extrabold">{fcfa(p.prix)}</p>}<div className="mt-4 flex items-center gap-3"><label htmlFor="quantite" className="text-sm font-semibold">Quantité</label><select id="quantite" className="champ !w-24" value={q} onChange={e=>setQ(Number(e.target.value))}>{Array.from({length:10},(_,i)=>i+1).map(n=><option key={n} value={n}>{n}</option>)}</select></div><button className="btn btn-canari mt-4 w-full" onClick={()=>router.push("/connexion?retour="+encodeURIComponent("/offre/"+pharmacieId+"/"+produitId+"?km="+(search.get("km")||"")))}>Ajouter au panier · Connexion requise</button></section><ContacterPharmacie pharmacieId={pharmacieId} produitId={produitId} variante="flottant"/></>}
 </main>;
}
