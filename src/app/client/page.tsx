"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { fcfa } from "@/lib/ranking";
import { EnTeteClient } from "@/components/EnTeteClient";
import { usePanier } from "@/lib/panier";

type Achat={reservation_id:string;produit_id:string;medicament:string;dci:string;dosage:string;forme:string;photo_url:string|null;quantite:number;prix_unitaire:number;total_ligne:number;total_transaction:number;reference_paiement:string|null;reservation_creee_le:string;pharmacie_id:string;pharmacie:string;ville:string;quartier:string|null;adresse:string|null;confirmee_le:string|null; paiement_declare_le:string|null;payee_le:string|null;retiree_le:string|null;achat_le:string|null;horodatage_achat_exact:boolean;statut:string};
type Reservation={id:string;statut:string;total:number;expires_at:string;created_at:string;paiement_ref:string|null;pharmacie_id:string;pharmacies:{nom:string;ville:string;quartier:string|null;adresse:string|null}|null;reservation_items:{quantite:number;prix_unitaire:number;produits:{id:string;nom:string;dci:string;dosage:string;forme:string;photo_url:string|null}|null}[]};
const STATUS:Record<string,string>={en_attente:"En attente",confirmee:"Confirmée",payee:"Payée",retiree:"Retirée",expiree:"Expirée",annulee:"Annulée"};
const PERIODS=[["7","7 j"],["30","30 j"],["90","3 mois"],["365","1 an"],["all","Tout"]] as const;
const fmt=(v:string|null)=>v?new Intl.DateTimeFormat("fr-FR",{dateStyle:"medium",timeStyle:"short"}).format(new Date(v)):"—";

function ClientPageContent(){
 const router=useRouter(), searchParams=useSearchParams(), requestedTab=searchParams.get("onglet"), [tab,setTab]=useState<"reservations"|"achats"|"panier">("reservations"),[name,setName]=useState("Client");
 const {lignes:lignesPanier,nombre:nombrePanier,changerQuantite,retirer,vider}=usePanier();
 const swipeStartRef=useRef<{x:number;y:number}>({x:0,y:0});
 const [reservations,setReservations]=useState<Reservation[]>([]),[achats,setAchats]=useState<Achat[]>([]);
 useEffect(()=>{setTab(requestedTab==="achats"?"achats":requestedTab==="panier"?"panier":"reservations")},[requestedTab]);
 const [period,setPeriod]=useState("all"),[q,setQ]=useState(""),[loading,setLoading]=useState(true),[error,setError]=useState("");
 useEffect(()=>{const protectedUrl=window.location.href;const protectBack=()=>{window.history.pushState({naxaClientGuard:true},"",protectedUrl);const confirmLogout=window.confirm("Voulez-vous vous déconnecter de votre espace NAXA ?");if(confirmLogout){void (async()=>{await supabaseBrowser().auth.signOut();window.location.replace("/connexion")})()}else{window.history.pushState({naxaClientGuard:true},"",protectedUrl)}};window.history.pushState({naxaClientGuard:true},"",protectedUrl);window.addEventListener("popstate",protectBack);return()=>window.removeEventListener("popstate",protectBack)},[]);
 useEffect(()=>{let cancelled=false;(async()=>{try{
 const sb=supabaseBrowser();
 const {data:{user},error:userError}=await sb.auth.getUser();
 if(userError) throw userError;
 if(!user){router.replace("/connexion?retour=/client");return}
 const [{data:p,error:profileError},{data:r,error:reservationError},{data:historique,error:historiqueError}]=await Promise.all([
  sb.from("profiles").select("first_name,last_name,role").eq("id",user.id).single(),
  sb.from("reservations").select("id,statut,total,expires_at,created_at,paiement_ref,pharmacie_id,pharmacies(nom,ville,quartier,adresse),reservation_items(quantite,prix_unitaire,produits(id,nom,dci,dosage,forme,photo_url))").eq("client_id",user.id).order("created_at",{ascending:false}).limit(200),
  sb.from("client_achats").select("reservation_id,produit_id,medicament,dci,dosage,forme,photo_url,quantite,prix_unitaire,total_ligne,total_transaction,reference_paiement,reservation_creee_le,pharmacie_id,pharmacie,ville,quartier,adresse,confirmee_le,paiement_declare_le,payee_le,retiree_le,achat_le,horodatage_achat_exact,statut").eq("client_id",user.id).order("achat_le",{ascending:false,nullsFirst:false}).limit(500)
 ]);
 if(profileError) throw profileError;
 if(reservationError) throw reservationError;
 if(p?.role!=="client"){router.replace("/");return}
 const rows=(r??[]) as unknown as Reservation[];
 if(cancelled) return;
 setName([p?.first_name,p?.last_name].filter(Boolean).join(" ")||"Client");
 setReservations(rows);
 // Priorité à la vue canonique : elle fournit les horodatages issus des
 // événements de statut. Repli sur les réservations si la migration n'est
 // pas encore installée dans l'environnement Supabase courant.
 let purchases:Achat[];
 if(!historiqueError && historique){
  purchases=(historique as unknown as Achat[]).filter(a=>a.statut==="payee"||a.statut==="retiree");
 }else{
  purchases=rows.filter(x=>x.statut==="payee"||x.statut==="retiree").flatMap(x=>x.reservation_items.map(item=>({
   reservation_id:x.id,produit_id:item.produits?.id??"inconnu",medicament:item.produits?.nom??"Produit",
   dci:item.produits?.dci??"",dosage:item.produits?.dosage??"",forme:item.produits?.forme??"",
   photo_url:item.produits?.photo_url??null,quantite:item.quantite,prix_unitaire:item.prix_unitaire,
   total_ligne:item.quantite*item.prix_unitaire,total_transaction:x.total,reference_paiement:x.paiement_ref??null,
   reservation_creee_le:x.created_at,pharmacie_id:x.pharmacie_id,pharmacie:x.pharmacies?.nom??"Pharmacie",
   ville:x.pharmacies?.ville??"Yaoundé",quartier:x.pharmacies?.quartier??null,adresse:x.pharmacies?.adresse??null,
   confirmee_le:null,paiement_declare_le:null,payee_le:null,retiree_le:null,achat_le:null,
   horodatage_achat_exact:false,statut:x.statut
  })));
 }
 setAchats(purchases);setLoading(false);
 }catch(err){console.error("[NAXA client] chargement espace client",err);if(!cancelled){setError("Impossible de charger votre suivi pour le moment. Réessayez dans quelques instants.");setLoading(false)}}})();
 return()=>{cancelled=true};
 },[router]);
 const filtered=useMemo(()=>{const days=period==="all"?Infinity:Number(period)*86400000;const query=q.trim().toLowerCase();return achats.filter(a=>(Date.now()-new Date(a.achat_le??a.reservation_creee_le).getTime())<=days&&(!query||[a.medicament,a.dci,a.pharmacie,a.ville,a.quartier??""].join(" ").toLowerCase().includes(query)))},[achats,period,q]);
 const groups=useMemo(()=>{const m=new Map<string,Achat[]>();for(const a of filtered)m.set(a.reservation_id,[...(m.get(a.reservation_id)??[]),a]);return [...m.entries()].sort((x,y)=>new Date(y[1][0].achat_le??y[1][0].reservation_creee_le).getTime()-new Date(x[1][0].achat_le??x[1][0].reservation_creee_le).getTime())},[filtered]);
 const recent=reservations.slice(0,8);const purchaseCount=new Set(achats.map(a=>a.reservation_id)).size,medicineCount=new Set(achats.map(a=>a.produit_id)).size;
 const selectTab=(nextTab:"reservations"|"achats"|"panier")=>{setTab(nextTab);const url=new URL(window.location.href);if(nextTab==="reservations")url.searchParams.delete("onglet");else url.searchParams.set("onglet",nextTab);router.replace(url.pathname+url.search+url.hash,{scroll:false});};
 return <main className="min-h-screen bg-slate-50 px-4 pb-28"><EnTeteClient/><div className="relative z-10 mx-auto max-w-2xl pt-4" onTouchStart={event=>{swipeStartRef.current={x:event.touches[0]?.clientX??0,y:event.touches[0]?.clientY??0}}} onTouchEnd={event=>{const dx=(event.changedTouches[0]?.clientX??swipeStartRef.current.x)-swipeStartRef.current.x;const dy=(event.changedTouches[0]?.clientY??swipeStartRef.current.y)-swipeStartRef.current.y;if(Math.abs(dx)>70&&Math.abs(dx)>Math.abs(dy)*1.25){const tabs=["reservations","achats","panier"] as const;const index=tabs.indexOf(tab);selectTab(tabs[Math.max(0,Math.min(tabs.length-1,index+(dx<0?1:-1)))]);}}}>
 <p className="text-sm text-slate-500">Mon espace NAXA</p><h1 className="text-2xl font-black">{tab === "achats" ? "Achats et commandes" : tab === "panier" ? "Mon panier" : "Bonjour " + name + " 👋"}</h1><p className="mt-1 text-sm text-slate-600">{tab === "achats" ? "Retrouvez vos achats confirmés, reçus et références de paiement." : tab === "panier" ? "Préparez votre sélection avant de chercher une pharmacie partenaire." : "Suivez vos réservations et les réponses des pharmacies."}</p>
 {tab === "reservations" && <section className="carte mt-4"><h2 className="font-bold">Mon profil</h2><div className="mt-2 divide-y divide-slate-100">{[["adresse","Adresse par défaut"],["paiement","Paiement"],["langue","Langue"],["favoris","Mes favoris"],["achats","Mes commandes · Historique"],["factures","Factures"],["aide","Centre d’aide"],["contact","Contacter NAXA"],["noter","Noter l’application"],["notifications","Notifications"],["confidentialite","Confidentialité"],["suppression","Supprimer mon compte"]].map(([slug,label])=><Link key={slug} href={slug==="achats"?"/client?onglet=achats":slug==="favoris"?"/client/profil/favoris":"/client/profil/"+slug} className="flex min-h-11 items-center justify-between py-2 text-sm font-medium"><span>{label}</span><span aria-hidden="true">›</span></Link>)}<button className="flex min-h-11 w-full items-center justify-between py-2 text-sm font-semibold text-red-700" onClick={async()=>{await supabaseBrowser().auth.signOut();window.location.replace("/connexion");}}>Déconnexion <span aria-hidden="true">›</span></button></div></section>}
 <nav aria-label="Mes espaces" className="naxa-client-tabs my-5 flex snap-x gap-2 overflow-x-auto pb-2" style={{WebkitOverflowScrolling:"touch",scrollbarWidth:"thin"}}>
  <button
   type="button"
   className={`btn shrink-0 snap-start ${tab === "reservations" ? "btn-vert" : "btn-clair"}`}
   onClick={() => selectTab("reservations")}
   aria-pressed={tab === "reservations"}
  >
   Réservations
  </button>
  <button
   type="button"
   className={`btn shrink-0 snap-start ${tab === "achats" ? "btn-vert" : "btn-clair"}`}
   onClick={() => selectTab("achats")}
   aria-pressed={tab === "achats"}
  >
   Achats / commandes
  </button>
  <button type="button" className={`btn shrink-0 snap-start ${tab === "panier" ? "btn-vert" : "btn-clair"}`} onClick={() => selectTab("panier")} aria-pressed={tab === "panier"}>Panier {nombrePanier > 0 && <span className="rounded-full bg-white/20 px-2 text-xs">{nombrePanier}</span>}</button>
 </nav>
 {loading&&<p className="carte">Chargement…</p>}{error&&<p role="alert" className="carte border border-red-200 text-red-800">{error}</p>}
 {!loading&&!error&&tab==="reservations"&&<section className="space-y-4"><div className="grid grid-cols-2 gap-3"><article className="carte"><p className="text-xs text-slate-500">Achats</p><p className="text-2xl font-black">{purchaseCount}</p></article><article className="carte"><p className="text-xs text-slate-500">Médicaments distincts</p><p className="text-2xl font-black">{medicineCount}</p></article></div>
 <section className="carte"><div className="mb-3 flex justify-between gap-2"><h2 className="text-lg font-extrabold">Mes réservations</h2><span className="text-xs text-slate-500">{reservations.length} récentes</span></div>{recent.length===0?<p className="text-sm text-slate-500">Aucune réservation pour le moment.</p>:<div className="space-y-3">{recent.map(r=><article key={r.id} className="rounded-2xl border border-slate-100 p-3"><div className="flex justify-between gap-3"><div><p className="font-bold">{r.pharmacies?.nom??"Pharmacie"}</p><p className="text-xs text-slate-500">{fmt(r.created_at)} · N° {r.id.slice(0,8).toUpperCase()}</p></div><span className="rounded-full bg-naxa-canari px-2 py-1 text-xs font-bold">{STATUS[r.statut]??r.statut}</span></div><p className="mt-2 text-sm">{r.reservation_items.map((i,n)=><span key={n}>{i.quantite} × {i.produits?.nom??"Produit"}{i.produits?.dosage?" "+i.produits.dosage:""}{n<r.reservation_items.length-1?", ":""}</span>)}</p><div className="mt-2 flex justify-between"><strong>{fcfa(r.total)}</strong><Link className="text-sm font-bold underline" href={"/reservation/"+r.id}>Voir le suivi</Link></div></article>)}</div>}</section></section>}
 {tab==="panier"&&<section className="space-y-4"><div className="carte flex items-center justify-between gap-3"><div><p className="text-xs text-slate-500">Articles sélectionnés</p><p className="text-2xl font-black">{nombrePanier}</p></div><Link href="/panier" className="btn btn-vert">Ouvrir le panier</Link></div>{lignesPanier.length===0?<div className="carte"><p className="font-bold">Votre panier est vide.</p><p className="mt-1 text-sm text-slate-600">Ajoutez un médicament depuis l’accueil ou les résultats pour continuer.</p><Link href="/" className="btn btn-vert mt-4 w-full">Chercher un médicament</Link></div>:<><ul className="space-y-3">{lignesPanier.map(l=><li key={l.produit_id} className="carte flex items-center gap-3"><div className="min-w-0 flex-1"><Link href={`/produit/${l.produit_id}`} className="font-bold underline">{l.nom}</Link>{l.dosage&&<p className="text-xs text-slate-500">{l.dosage}</p>}<p className="mt-1 text-xs text-slate-500">Quantité : {l.quantite}</p></div><div className="flex items-center gap-1"><button type="button" className="btn btn-clair !min-h-10 !w-10 !px-0" aria-label={`Retirer une unité de ${l.nom}`} disabled={l.quantite<=1} onClick={()=>changerQuantite(l.produit_id,l.quantite-1)}>−</button><span className="min-w-5 text-center font-bold">{l.quantite}</span><button type="button" className="btn btn-clair !min-h-10 !w-10 !px-0" aria-label={`Ajouter une unité de ${l.nom}`} onClick={()=>changerQuantite(l.produit_id,l.quantite+1)}>+</button><button type="button" className="ml-2 text-sm font-semibold text-red-700 underline" onClick={()=>retirer(l.produit_id)}>Retirer</button></div></li>)}</ul><div className="grid grid-cols-1 gap-2 sm:grid-cols-2"><Link href="/panier" className="btn btn-vert w-full">Choisir les pharmacies</Link><button type="button" className="btn btn-clair w-full" onClick={vider}>Vider le panier</button></div><p className="text-xs leading-5 text-slate-500">Le montant définitif dépend des prix et du stock confirmés par la pharmacie. Aucun paiement n’est effectué depuis ce panier.</p></>}</section>}
 {!loading&&!error&&tab==="achats"&&<section className="space-y-4"><div className="grid grid-cols-2 gap-3"><article className="carte"><p className="text-xs text-slate-500">Transactions</p><p className="text-2xl font-black">{purchaseCount}</p></article><article className="carte"><p className="text-xs text-slate-500">Médicaments distincts</p><p className="text-2xl font-black">{medicineCount}</p></article></div><Link href="/client/profil/favoris" className="carte flex items-center justify-between gap-3"><span><strong className="block">Mes favoris</strong><span className="text-sm text-slate-600">Retrouver les médicaments enregistrés</span></span><span aria-hidden="true" className="text-xl">›</span></Link><div className="carte space-y-3"><div className="flex flex-wrap gap-2">{PERIODS.map(([id,label])=><button key={id} className={"btn !min-h-[40px] !px-3 text-sm "+(period===id?"btn-vert":"btn-clair")} onClick={()=>setPeriod(id)}>{label}</button>)}</div><input className="champ" value={q} onChange={e=>setQ(e.target.value)} placeholder="Rechercher un médicament ou une pharmacie" aria-label="Rechercher dans mes achats"/></div>
 {groups.length===0?<div className="carte"><p className="font-bold">Aucun achat dans cette période.</p><Link href="/" className="btn btn-vert mt-4 w-full">Chercher un médicament</Link></div>:groups.map(([id,lines])=><details key={id} className="carte" open><summary className="cursor-pointer list-none"><div className="flex justify-between gap-3"><div><p className="font-extrabold">Achat #{id.slice(0,8).toUpperCase()}</p><p className="text-sm text-slate-600">{fmt(lines[0].achat_le??lines[0].reservation_creee_le)} · {lines[0].pharmacie}</p><p className="text-xs text-slate-500">{[lines[0].quartier,lines[0].adresse].filter(Boolean).join(" · ")}</p></div><strong>{fcfa(lines[0].total_transaction)}</strong></div></summary><div className="mt-4 space-y-3 border-t pt-3">{lines.map(l=><div key={l.produit_id} className="flex gap-3 rounded-2xl bg-slate-50 p-3"><div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-white">{l.photo_url?<img src={l.photo_url} alt="" className="h-full w-full object-cover"/>:<div className="flex h-full items-center justify-center text-[10px] text-slate-400">NAXA</div>}</div><div><p className="font-bold">{l.medicament}</p><p className="text-xs text-slate-600">{[l.dci,l.dosage,l.forme].filter(Boolean).join(" · ")}</p><p className="mt-1 text-sm">{l.quantite} × {fcfa(l.prix_unitaire)} = <strong>{fcfa(l.total_ligne)}</strong></p></div></div>)}<dl className="grid grid-cols-2 gap-2 text-sm"><div><dt className="text-xs text-slate-500">Réservation créée</dt><dd className="font-semibold">{fmt(lines[0].reservation_creee_le)}</dd></div><div><dt className="text-xs text-slate-500">Confirmée</dt><dd className="font-semibold">{fmt(lines[0].confirmee_le)}</dd></div><div><dt className="text-xs text-slate-500">Paiement déclaré</dt><dd className="font-semibold">{fmt(lines[0].paiement_declare_le)}</dd></div><div><dt className="text-xs text-slate-500">Achat</dt><dd className="font-semibold">{fmt(lines[0].achat_le)}{lines[0].horodatage_achat_exact?"":" · historique exact indisponible"}</dd></div><div><dt className="text-xs text-slate-500">Retrait</dt><dd className="font-semibold">{fmt(lines[0].retiree_le)}</dd></div><div><dt className="text-xs text-slate-500">Référence</dt><dd className="font-semibold">{lines[0].reference_paiement??"—"}</dd></div></dl><p className="text-xs text-slate-500">Statut : {STATUS[lines[0].statut]??lines[0].statut} · Données limitées à votre compte.</p><div className="flex flex-wrap gap-3 pt-1"><Link className="text-sm font-bold text-[#1E7B3A] underline underline-offset-4" href={"/reservation/"+id}>Détails de la commande</Link>{(lines[0].statut==="payee"||lines[0].statut==="retiree")&&<Link className="text-sm font-bold text-[#1E7B3A] underline underline-offset-4" href={"/reservation/"+id+"/recu"}>Voir le reçu</Link>}</div></div></details>)}</section>}
 <p className="mt-8 text-center text-xs text-slate-500">Cet espace est un suivi commercial personnel NAXA, pas un dossier médical.</p></div></main>;
}

export default function ClientPage(){return <Suspense fallback={<main className="mx-auto min-h-screen max-w-2xl px-4 pb-28"><p className="carte mt-6">Chargement de votre espace…</p></main>}><ClientPageContent /></Suspense>}
