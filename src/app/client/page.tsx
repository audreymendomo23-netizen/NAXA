"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { fcfa } from "@/lib/ranking";
import { Logo } from "@/components/Logo";

type Achat={reservation_id:string;produit_id:string;medicament:string;dci:string;dosage:string;forme:string;photo_url:string|null;quantite:number;prix_unitaire:number;total_ligne:number;total_transaction:number;reference_paiement:string|null;reservation_creee_le:string;pharmacie_id:string;pharmacie:string;ville:string;quartier:string|null;adresse:string|null;confirmee_le:string|null; paiement_declare_le:string|null;payee_le:string|null;retiree_le:string|null;achat_le:string|null;horodatage_achat_exact:boolean;statut:string};
type Reservation={id:string;statut:string;total:number;expires_at:string;created_at:string;paiement_ref:string|null;pharmacie_id:string;pharmacies:{nom:string;ville:string;quartier:string|null;adresse:string|null}|null;reservation_items:{quantite:number;prix_unitaire:number;produits:{id:string;nom:string;dci:string;dosage:string;forme:string;photo_url:string|null}|null}[]};
const STATUS:Record<string,string>={en_attente:"En attente",confirmee:"Confirmée",payee:"Payée",retiree:"Retirée",expiree:"Expirée",annulee:"Annulée"};
const PERIODS=[["7","7 j"],["30","30 j"],["90","3 mois"],["365","1 an"],["all","Tout"]] as const;
const fmt=(v:string|null)=>v?new Intl.DateTimeFormat("fr-FR",{dateStyle:"medium",timeStyle:"short"}).format(new Date(v)):"—";

function ClientPageContent(){
 const router=useRouter(), searchParams=useSearchParams(), requestedTab=searchParams.get("onglet"), [tab,setTab]=useState<"suivi"|"achats">("suivi"),[name,setName]=useState("Client");
 const [reservations,setReservations]=useState<Reservation[]>([]),[achats,setAchats]=useState<Achat[]>([]);
 useEffect(()=>{setTab(requestedTab==="achats"?"achats":"suivi")},[requestedTab]);
 const [period,setPeriod]=useState("all"),[q,setQ]=useState(""),[loading,setLoading]=useState(true),[error,setError]=useState("");
 useEffect(()=>{const protectedUrl=window.location.href;const protectBack=()=>{window.history.pushState({naxaClientGuard:true},"",protectedUrl);const confirmLogout=window.confirm("Voulez-vous vous déconnecter de votre espace NAXA ?");if(confirmLogout){void (async()=>{await supabaseBrowser().auth.signOut();window.location.replace("/connexion")})()}else{window.history.pushState({naxaClientGuard:true},"",protectedUrl)}};window.history.pushState({naxaClientGuard:true},"",protectedUrl);window.addEventListener("popstate",protectBack);return()=>window.removeEventListener("popstate",protectBack)},[]);
 useEffect(()=>{let cancelled=false;(async()=>{try{
 const sb=supabaseBrowser();
 const {data:{user},error:userError}=await sb.auth.getUser();
 if(userError) throw userError;
 if(!user){router.replace("/connexion?retour=/client");return}
 const [{data:p,error:profileError},{data:r,error:reservationError}]=await Promise.all([
  sb.from("profiles").select("first_name,last_name,role").eq("id",user.id).single(),
  sb.from("reservations").select("id,statut,total,expires_at,created_at,paiement_ref,pharmacie_id,pharmacies(nom,ville,quartier,adresse),reservation_items(quantite,prix_unitaire,produits(id,nom,dci,dosage,forme,photo_url))").eq("client_id",user.id).order("created_at",{ascending:false}).limit(50)
 ]);
 if(profileError) throw profileError;
 if(reservationError) throw reservationError;
 if(p?.role!=="client"){router.replace("/");return}
 const rows=(r??[]) as unknown as Reservation[];
 if(cancelled) return;
 setName([p?.first_name,p?.last_name].filter(Boolean).join(" ")||"Client");
 setReservations(rows);
 // L'historique est construit à partir des réservations réelles. Les tables
 // client_achats et reservation_events n'existent pas dans le schéma déployé.
 const purchases:Achat[]=rows.filter(x=>x.statut==="payee"||x.statut==="retiree").flatMap(x=>x.reservation_items.map(item=>({
  reservation_id:x.id,produit_id:item.produits?.id??"inconnu",medicament:item.produits?.nom??"Produit",
  dci:item.produits?.dci??"",dosage:item.produits?.dosage??"",forme:item.produits?.forme??"",
  photo_url:item.produits?.photo_url??null,quantite:item.quantite,prix_unitaire:item.prix_unitaire,
  total_ligne:item.quantite*item.prix_unitaire,total_transaction:x.total,reference_paiement:x.paiement_ref??null,
  reservation_creee_le:x.created_at,pharmacie_id:x.pharmacie_id,pharmacie:x.pharmacies?.nom??"Pharmacie",
  ville:x.pharmacies?.ville??"Yaoundé",quartier:x.pharmacies?.quartier??null,adresse:x.pharmacies?.adresse??null,
  confirmee_le:null,paiement_declare_le:null,payee_le:null,retiree_le:null,achat_le:null,
  horodatage_achat_exact:false,statut:x.statut
 })));
 setAchats(purchases);setLoading(false);
 }catch(err){console.error("[NAXA client] chargement espace client",err);if(!cancelled){setError("Impossible de charger votre suivi pour le moment. Réessayez dans quelques instants.");setLoading(false)}}})();
 return()=>{cancelled=true};
 },[router]);
 const filtered=useMemo(()=>{const days=period==="all"?Infinity:Number(period)*86400000;const query=q.trim().toLowerCase();return achats.filter(a=>(Date.now()-new Date(a.achat_le??a.reservation_creee_le).getTime())<=days&&(!query||[a.medicament,a.dci,a.pharmacie,a.ville,a.quartier??""].join(" ").toLowerCase().includes(query)))},[achats,period,q]);
 const groups=useMemo(()=>{const m=new Map<string,Achat[]>();for(const a of filtered)m.set(a.reservation_id,[...(m.get(a.reservation_id)??[]),a]);return [...m.entries()].sort((x,y)=>new Date(y[1][0].achat_le??y[1][0].reservation_creee_le).getTime()-new Date(x[1][0].achat_le??x[1][0].reservation_creee_le).getTime())},[filtered]);
 const recent=reservations.slice(0,8);const purchaseCount=new Set(achats.map(a=>a.reservation_id)).size,medicineCount=new Set(achats.map(a=>a.produit_id)).size;
 return <main className="mx-auto min-h-screen max-w-2xl bg-slate-50 px-4 pb-28"><header className="-mx-4 mb-5 flex items-center justify-between bg-naxa-green-900 px-4 py-3 text-white"><Link href="/"><Logo taille={32}/></Link><Link href="/" className="text-sm font-semibold underline">Nouvelle recherche</Link></header>
 <p className="text-sm text-slate-500">Mon espace NAXA</p><h1 className="text-2xl font-black">Bonjour {name} 👋</h1><p className="mt-1 text-sm text-slate-600">Vos réservations et votre historique d'achats, dans un espace personnel.</p>
 <section className="carte mt-4"><h2 className="font-bold">Mon profil</h2><div className="mt-2 divide-y divide-slate-100">{[["adresse","Adresse par défaut"],["paiement","Paiement"],["langue","Langue"],["favoris","Mes favoris"],["achats","Mes commandes · Historique"],["factures","Factures"],["aide","Centre d’aide"],["contact","Contacter NAXA"],["noter","Noter l’application"],["notifications","Notifications"],["confidentialite","Confidentialité"],["suppression","Supprimer mon compte"]].map(([slug,label])=><Link key={slug} href={slug==="achats"?"/client?onglet=achats":slug==="favoris"?"/client/profil/favoris":"/client/profil/"+slug} className="flex min-h-11 items-center justify-between py-2 text-sm font-medium"><span>{label}</span><span aria-hidden="true">›</span></Link>)}<button className="flex min-h-11 w-full items-center justify-between py-2 text-sm font-semibold text-red-700" onClick={async()=>{await supabaseBrowser().auth.signOut();window.location.replace("/connexion");}}>Déconnexion <span aria-hidden="true">›</span></button></div></section>
 <nav className="my-5 grid grid-cols-2 gap-2">
  <button
   type="button"
   className={tab === "suivi" ? "btn btn-vert" : "btn btn-clair"}
   onClick={() => setTab("suivi")}
   aria-pressed={tab === "suivi"}
  >
   Mon suivi
  </button>
  <button
   type="button"
   className={tab === "achats" ? "btn btn-vert" : "btn btn-clair"}
   onClick={() => setTab("achats")}
   aria-pressed={tab === "achats"}
  >
   Mes médicaments achetés
  </button>
 </nav>
 {loading&&<p className="carte">Chargement…</p>}{error&&<p role="alert" className="carte border border-red-200 text-red-800">{error}</p>}
 {!loading&&!error&&tab==="suivi"&&<section className="space-y-4"><div className="grid grid-cols-2 gap-3"><article className="carte"><p className="text-xs text-slate-500">Achats</p><p className="text-2xl font-black">{purchaseCount}</p></article><article className="carte"><p className="text-xs text-slate-500">Médicaments distincts</p><p className="text-2xl font-black">{medicineCount}</p></article></div>
 <section className="carte"><div className="mb-3 flex justify-between gap-2"><h2 className="text-lg font-extrabold">Mes réservations</h2><span className="text-xs text-slate-500">{reservations.length} récentes</span></div>{recent.length===0?<p className="text-sm text-slate-500">Aucune réservation pour le moment.</p>:<div className="space-y-3">{recent.map(r=><article key={r.id} className="rounded-2xl border border-slate-100 p-3"><div className="flex justify-between gap-3"><div><p className="font-bold">{r.pharmacies?.nom??"Pharmacie"}</p><p className="text-xs text-slate-500">{fmt(r.created_at)} · N° {r.id.slice(0,8).toUpperCase()}</p></div><span className="rounded-full bg-naxa-canari px-2 py-1 text-xs font-bold">{STATUS[r.statut]??r.statut}</span></div><p className="mt-2 text-sm">{r.reservation_items.map((i,n)=><span key={n}>{i.quantite} × {i.produits?.nom??"Produit"}{i.produits?.dosage?" "+i.produits.dosage:""}{n<r.reservation_items.length-1?", ":""}</span>)}</p><div className="mt-2 flex justify-between"><strong>{fcfa(r.total)}</strong><Link className="text-sm font-bold underline" href={"/reservation/"+r.id}>Voir le suivi</Link></div></article>)}</div>}</section></section>}
 {!loading&&!error&&tab==="achats"&&<section className="space-y-4"><div className="grid grid-cols-2 gap-3"><article className="carte"><p className="text-xs text-slate-500">Transactions</p><p className="text-2xl font-black">{purchaseCount}</p></article><article className="carte"><p className="text-xs text-slate-500">Médicaments distincts</p><p className="text-2xl font-black">{medicineCount}</p></article></div><Link href="/client/profil/favoris" className="carte flex items-center justify-between gap-3"><span><strong className="block">Mes favoris</strong><span className="text-sm text-slate-600">Retrouver les médicaments enregistrés</span></span><span aria-hidden="true" className="text-xl">›</span></Link><div className="carte space-y-3"><div className="flex flex-wrap gap-2">{PERIODS.map(([id,label])=><button key={id} className={"btn !min-h-[40px] !px-3 text-sm "+(period===id?"btn-vert":"btn-clair")} onClick={()=>setPeriod(id)}>{label}</button>)}</div><input className="champ" value={q} onChange={e=>setQ(e.target.value)} placeholder="Rechercher un médicament ou une pharmacie" aria-label="Rechercher dans mes achats"/></div>
 {groups.length===0?<div className="carte"><p className="font-bold">Aucun achat dans cette période.</p><Link href="/" className="btn btn-vert mt-4 w-full">Chercher un médicament</Link></div>:groups.map(([id,lines])=><details key={id} className="carte" open><summary className="cursor-pointer list-none"><div className="flex justify-between gap-3"><div><p className="font-extrabold">Achat #{id.slice(0,8).toUpperCase()}</p><p className="text-sm text-slate-600">{fmt(lines[0].achat_le??lines[0].reservation_creee_le)} · {lines[0].pharmacie}</p><p className="text-xs text-slate-500">{[lines[0].quartier,lines[0].adresse].filter(Boolean).join(" · ")}</p></div><strong>{fcfa(lines[0].total_transaction)}</strong></div></summary><div className="mt-4 space-y-3 border-t pt-3">{lines.map(l=><div key={l.produit_id} className="flex gap-3 rounded-2xl bg-slate-50 p-3"><div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-white">{l.photo_url?<img src={l.photo_url} alt="" className="h-full w-full object-cover"/>:<div className="flex h-full items-center justify-center text-[10px] text-slate-400">NAXA</div>}</div><div><p className="font-bold">{l.medicament}</p><p className="text-xs text-slate-600">{[l.dci,l.dosage,l.forme].filter(Boolean).join(" · ")}</p><p className="mt-1 text-sm">{l.quantite} × {fcfa(l.prix_unitaire)} = <strong>{fcfa(l.total_ligne)}</strong></p></div></div>)}<dl className="grid grid-cols-2 gap-2 text-sm"><div><dt className="text-xs text-slate-500">Réservation créée</dt><dd className="font-semibold">{fmt(lines[0].reservation_creee_le)}</dd></div><div><dt className="text-xs text-slate-500">Confirmée</dt><dd className="font-semibold">{fmt(lines[0].confirmee_le)}</dd></div><div><dt className="text-xs text-slate-500">Paiement déclaré</dt><dd className="font-semibold">{fmt(lines[0].paiement_declare_le)}</dd></div><div><dt className="text-xs text-slate-500">Achat</dt><dd className="font-semibold">{fmt(lines[0].achat_le)}{lines[0].horodatage_achat_exact?"":" · historique exact indisponible"}</dd></div><div><dt className="text-xs text-slate-500">Retrait</dt><dd className="font-semibold">{fmt(lines[0].retiree_le)}</dd></div><div><dt className="text-xs text-slate-500">Référence</dt><dd className="font-semibold">{lines[0].reference_paiement??"—"}</dd></div></dl><p className="text-xs text-slate-500">Statut : {STATUS[lines[0].statut]??lines[0].statut} · Données limitées à votre compte.</p></div></details>)}</section>}
 <p className="mt-8 text-center text-xs text-slate-500">Cet espace est un suivi commercial personnel NAXA, pas un dossier médical.</p></main>;
}

export default function ClientPage(){return <Suspense fallback={<main className="mx-auto min-h-screen max-w-2xl px-4 pb-28"><p className="carte mt-6">Chargement de votre espace…</p></main>}><ClientPageContent /></Suspense>}
