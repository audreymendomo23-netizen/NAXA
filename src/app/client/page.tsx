"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { fcfa } from "@/lib/ranking";
import { AccueilClient } from "@/components/AccueilClient";
import { EspaceNaxaSwitcher } from "@/components/EspaceNaxaSwitcher";
import { usePanier } from "@/lib/panier";
import { cancelHomeServiceRequest } from "@/app/prestations/actions";

type Achat={reservation_id:string;produit_id:string;medicament:string;dci:string;dosage:string;forme:string;photo_url:string|null;quantite:number;prix_unitaire:number;total_ligne:number;total_transaction:number;reference_paiement:string|null;reservation_creee_le:string;pharmacie_id:string;pharmacie:string;ville:string;quartier:string|null;adresse:string|null;confirmee_le:string|null; paiement_declare_le:string|null;payee_le:string|null;retiree_le:string|null;achat_le:string|null;horodatage_achat_exact:boolean;statut:string};
type Reservation={id:string;statut:string;mode:string;paiement_statut:string;paiement_mode:string|null;commande_statut:string|null;total:number;expires_at:string;created_at:string;paiement_ref:string|null;pharmacie_id:string;pharmacies:{nom:string;ville:string;quartier:string|null;adresse:string|null}|null;reservation_items:{quantite:number;prix_unitaire:number;produits:{id:string;nom:string;dci:string;dosage:string;forme:string;photo_url:string|null}|null}[]};
type HomeServiceRequest={id:string;status:string;offer_name:string;category:string;price_fcfa:number|null;service_area_label:string;preferred_at:string|null;created_at:string};
type ExamAppointment={id:string;item_name:string;price_fcfa:number;status:string;ticket_code:string;created_at:string;exam_centers:{display_name:string;address_label:string;phone_public:string|null}|null;exam_slots:{starts_at:string;ends_at:string}|null};
const HOME_SERVICE_STATUS:Record<string,string>={requested:"En attente du professionnel",confirmed:"Confirmée",completed:"Terminée",cancelled:"Annulée",expired:"Expirée"};
const STATUS:Record<string,string>={en_attente:"En attente",confirmee:"Confirmée",payee:"Payée",retiree:"Terminée",expiree:"Expirée",annulee:"Annulée"}; const DELIVERY_STATUS:Record<string,string>={en_attente_pharmacie:"En attente de la pharmacie",acceptee:"Acceptée",preparation:"En préparation",livreur_assigne:"Livreur assigné",en_livraison:"En livraison",livree:"Livrée",annulee:"Annulée"};
const PERIODS=[["7","7 j"],["30","30 j"],["90","3 mois"],["365","1 an"],["all","Tout"]] as const;
const fmt=(v:string|null)=>v?new Intl.DateTimeFormat("fr-FR",{dateStyle:"medium",timeStyle:"short"}).format(new Date(v)):"—";

async function terminerSessionClient(){
 // Fermer immédiatement la session locale : la redirection ne doit pas dépendre du réseau.
 try {
  await Promise.race([
   supabaseBrowser().auth.signOut({scope:"local"}),
   new Promise<void>(resolve=>window.setTimeout(resolve,1500)),
  ]);
 } catch {
  // La navigation publique reste prioritaire même si Supabase renvoie une erreur.
 } finally {
  // Navigation complète (pas seulement un changement d’état React) vers l’accueil public.
  window.location.replace("/");
 }
}

function ClientPageContent(){
 const router=useRouter(), [name,setName]=useState("Client");
 const {lignes:lignesPanier,nombre:nombrePanier,changerQuantite,retirer,vider}=usePanier();
 const [reservations,setReservations]=useState<Reservation[]>([]),[achats,setAchats]=useState<Achat[]>([]);
 const [examAppointments,setExamAppointments]=useState<ExamAppointment[]>([]),[examAvailable,setExamAvailable]=useState(true);
 const [homeServiceRequests,setHomeServiceRequests]=useState<HomeServiceRequest[]>([]),[homeServicesAvailable,setHomeServicesAvailable]=useState(false),[homeServiceStatus,setHomeServiceStatus]=useState("all"),[homeServiceQuery,setHomeServiceQuery]=useState("");
 const [period,setPeriod]=useState("all"),[q,setQ]=useState(""),[reservationStatus,setReservationStatus]=useState("all"),[reservationQuery,setReservationQuery]=useState(""),[showAllReservations,setShowAllReservations]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState("");
 const [now,setNow]=useState(()=>Date.now());
 useEffect(()=>{const protectedUrl=window.location.href;const protectBack=()=>{window.history.pushState({naxaClientGuard:true},"",protectedUrl);const confirmLogout=window.confirm("Voulez-vous vous déconnecter de votre espace NAXA ?");if(confirmLogout){void terminerSessionClient()}else{window.history.pushState({naxaClientGuard:true},"",protectedUrl)}};window.history.pushState({naxaClientGuard:true},"",protectedUrl);window.addEventListener("popstate",protectBack);return()=>window.removeEventListener("popstate",protectBack)},[]);
 useEffect(()=>{let cancelled=false;(async()=>{try{
 const sb=supabaseBrowser();
 const {data:{user},error:userError}=await sb.auth.getUser();
 if(userError) throw userError;
 if(!user){router.replace("/connexion?retour=/client");return}
 const [{data:p,error:profileError},{data:r,error:reservationError},{data:historique,error:historiqueError},{data:homeServiceData,error:homeServiceError},{data:examData,error:examError}]=await Promise.all([
  sb.from("profiles").select("username,first_name,last_name,role").eq("id",user.id).single(),
  sb.from("reservations").select("id,statut,mode,paiement_statut,paiement_mode,commande_statut,total,expires_at,created_at,paiement_ref,pharmacie_id,pharmacies(nom,ville,quartier,adresse),reservation_items(quantite,prix_unitaire,produits(id,nom,dci,dosage,forme,photo_url))").eq("client_id",user.id).order("created_at",{ascending:false}).limit(200),
  sb.from("client_achats").select("reservation_id,produit_id,medicament,dci,dosage,forme,photo_url,quantite,prix_unitaire,total_ligne,total_transaction,reference_paiement,reservation_creee_le,pharmacie_id,pharmacie,ville,quartier,adresse,confirmee_le,paiement_declare_le,payee_le,retiree_le,achat_le,horodatage_achat_exact,statut").eq("client_id",user.id).order("achat_le",{ascending:false,nullsFirst:false}).limit(500),
  sb.from("home_service_requests").select("id,status,offer_name,category,price_fcfa,service_area_label,preferred_at,created_at").eq("client_id",user.id).order("created_at",{ascending:false}).limit(100),
  sb.from("exam_appointments").select("id,item_name,price_fcfa,status,ticket_code,created_at,exam_centers(display_name,address_label,phone_public),exam_slots(starts_at,ends_at)").eq("client_id",user.id).order("created_at",{ascending:false}).limit(100)
 ]);
 if(profileError) throw profileError;
 if(reservationError) throw reservationError;
 // L'accès client dépend de l'existence du profil, pas de son rôle professionnel.
 // Ne pas imposer ici des champs d'inscription qui peuvent manquer sur des comptes historiques.
 if(!p){router.replace("/");return}
 const rows=(r??[]) as unknown as Reservation[];
 if(cancelled) return;
 const isGoogle=user.app_metadata?.provider==="google"||Boolean(user.identities?.some(identity=>identity.provider==="google"));const googleName=String(user.user_metadata?.full_name??user.user_metadata?.name??"").trim();setName(isGoogle&&googleName?googleName:(typeof p?.username==="string"&&p.username.trim()?p.username.trim():[p?.first_name,p?.last_name].filter(Boolean).join(" ")||"Client"));
 setReservations(rows);
 setHomeServicesAvailable(!homeServiceError);setHomeServiceRequests((homeServiceData??[]) as HomeServiceRequest[]);
 setExamAvailable(!examError);setExamAppointments(!examError?(examData??[]) as unknown as ExamAppointment[]:[]);
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
 // Synchroniser les statuts avec les changements opérés par la pharmacie et la caisse.
 // Realtime est complété par un rafraîchissement périodique si l'abonnement n'est pas disponible.
 useEffect(()=>{
  let stopped=false;
  const sb=supabaseBrowser();
  let channel: ReturnType<typeof sb.channel>|null=null;
  const refreshReservations=async()=>{
   const {data:{user}}=await sb.auth.getUser();
   if(!user||stopped)return;
   const {data,error:refreshError}=await sb.from("reservations").select("id,statut,mode,paiement_statut,paiement_mode,commande_statut,total,expires_at,created_at,paiement_ref,pharmacie_id,pharmacies(nom,ville,quartier,adresse),reservation_items(quantite,prix_unitaire,produits(id,nom,dci,dosage,forme,photo_url))").eq("client_id",user.id).order("created_at",{ascending:false}).limit(200);
   if(!refreshError&&!stopped){
    const rows=(data??[]) as unknown as Reservation[];
    setReservations(rows);
    const {data:purchaseRows,error:purchaseError}=await sb.from("client_achats").select("reservation_id,produit_id,medicament,dci,dosage,forme,photo_url,quantite,prix_unitaire,total_ligne,total_transaction,reference_paiement,reservation_creee_le,pharmacie_id,pharmacie,ville,quartier,adresse,confirmee_le,paiement_declare_le,payee_le,retiree_le,achat_le,horodatage_achat_exact,statut").eq("client_id",user.id).order("achat_le",{ascending:false,nullsFirst:false}).limit(500);
    if(stopped)return;
    if(!purchaseError&&purchaseRows){
     setAchats((purchaseRows as unknown as Achat[]).filter(a=>a.statut==="payee"||a.statut==="retiree"));
    }else{
     setAchats(rows.filter(r=>r.statut==="payee"||r.statut==="retiree").flatMap(r=>r.reservation_items.map(item=>({
      reservation_id:r.id,produit_id:item.produits?.id??"inconnu",medicament:item.produits?.nom??"Produit",
      dci:item.produits?.dci??"",dosage:item.produits?.dosage??"",forme:item.produits?.forme??"",
      photo_url:item.produits?.photo_url??null,quantite:item.quantite,prix_unitaire:item.prix_unitaire,
      total_ligne:item.quantite*item.prix_unitaire,total_transaction:r.total,reference_paiement:r.paiement_ref??null,
      reservation_creee_le:r.created_at,pharmacie_id:r.pharmacie_id,pharmacie:r.pharmacies?.nom??"Pharmacie",
      ville:r.pharmacies?.ville??"Yaoundé",quartier:r.pharmacies?.quartier??null,adresse:r.pharmacies?.adresse??null,
      confirmee_le:null,paiement_declare_le:null,payee_le:null,retiree_le:null,achat_le:null,
      horodatage_achat_exact:false,statut:r.statut
     }))));
    }
   }
   if(!channel&&!stopped){
    channel=sb.channel("naxa-client-reservations-"+user.id)
     .on("postgres_changes",{event:"*",schema:"public",table:"reservations",filter:"client_id=eq."+user.id},()=>{void refreshReservations()})
     .subscribe();
   }
  };
  void refreshReservations();
  const poll=window.setInterval(()=>{if(document.visibilityState==="visible")void refreshReservations()},30000);
  const clock=window.setInterval(()=>setNow(Date.now()),15000);
  const onVisible=()=>{if(document.visibilityState==="visible")void refreshReservations()};
  document.addEventListener("visibilitychange",onVisible);
  return()=>{stopped=true;window.clearInterval(poll);window.clearInterval(clock);document.removeEventListener("visibilitychange",onVisible);if(channel)void sb.removeChannel(channel)};
 },[]);
 const filtered=useMemo(()=>{const days=period==="all"?Infinity:Number(period)*86400000;const query=q.trim().toLowerCase();return achats.filter(a=>(Date.now()-new Date(a.achat_le??a.reservation_creee_le).getTime())<=days&&(!query||[a.medicament,a.dci,a.pharmacie,a.ville,a.quartier??""].join(" ").toLowerCase().includes(query)))},[achats,period,q]);
 const groups=useMemo(()=>{const m=new Map<string,Achat[]>();for(const a of filtered)m.set(a.reservation_id,[...(m.get(a.reservation_id)??[]),a]);return [...m.entries()].sort((x,y)=>new Date(y[1][0].achat_le??y[1][0].reservation_creee_le).getTime()-new Date(x[1][0].achat_le??x[1][0].reservation_creee_le).getTime())},[filtered]);
 const filteredHomeServiceRequests=useMemo(()=>{const query=homeServiceQuery.trim().toLocaleLowerCase("fr");return homeServiceRequests.filter(r=>(homeServiceStatus==="all"||r.status===homeServiceStatus)&&(!query||[r.offer_name,r.category,r.service_area_label].join(" ").toLocaleLowerCase("fr").includes(query)))},[homeServiceRequests,homeServiceStatus,homeServiceQuery]);
 const filteredReservations=useMemo(()=>{const query=reservationQuery.trim().toLocaleLowerCase("fr");return reservations.filter(r=>(reservationStatus==="all"||r.statut===reservationStatus||r.commande_statut===reservationStatus)&&(!query||[r.id,r.mode,r.statut,r.commande_statut??"",r.pharmacies?.nom??"",...r.reservation_items.map(i=>i.produits?.nom??"")].join(" ").toLocaleLowerCase("fr").includes(query)))},[reservations,reservationStatus,reservationQuery]);
 const recent=showAllReservations?filteredReservations:filteredReservations.slice(0,8);const purchaseCount=new Set(achats.map(a=>a.reservation_id)).size,medicineCount=new Set(achats.map(a=>a.produit_id)).size;
 return <main className="min-h-screen bg-slate-50 px-4 pb-28">
    <div className="mx-auto flex w-full max-w-6xl justify-end px-4 pt-3"><EspaceNaxaSwitcher current="client" /></div><div className="relative z-10 mx-auto max-w-2xl pt-4">
 <p className="text-sm text-slate-500">Mon espace NAXA</p><h1 className="text-2xl font-black">Achats / Réservations / Commandes</h1><p className="mt-1 text-sm text-slate-600">Un seul espace pour gérer votre panier, suivre vos réservations et retrouver vos achats et commandes.</p><div className="mt-4 overflow-hidden rounded-2xl bg-[#0F6B3F] p-4 text-white shadow-sm"><div className="flex items-center gap-3"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#FFE23D] text-2xl text-[#0B3D26]" aria-hidden="true">🛍️</span><div><p className="font-extrabold">Tout votre parcours d’achat, au même endroit</p><p className="text-sm text-white/90">Du choix du produit au retrait en pharmacie.</p></div></div><p className="mt-3 rounded-xl bg-white/10 p-3 text-sm">Les prix, disponibilités et lieux de retrait dépendent des informations réelles confirmées par chaque pharmacie partenaire.</p></div>
 {loading&&<p className="carte">Chargement…</p>}{error&&<p role="alert" className="carte border border-red-200 text-red-800">{error}</p>}
 {!loading&&!error&&<section className="mt-4 space-y-4"><div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><a href="#panier" className="rounded-2xl border border-[#0F6B3F]/15 bg-white p-3 shadow-sm transition hover:border-[#0F6B3F]"><p className="text-xs font-semibold text-slate-500">Mon panier</p><p className="mt-1 text-2xl font-black text-[#0F6B3F]">{nombrePanier}</p><p className="text-xs text-slate-600">Articles sélectionnés</p></a><a href="#reservations" className="rounded-2xl border border-[#FFE23D] bg-[#FFF9C7] p-3 shadow-sm transition hover:brightness-95"><p className="text-xs font-semibold text-slate-600">Réservations</p><p className="mt-1 text-2xl font-black text-[#0B3D26]">{reservations.length}</p><p className="text-xs text-slate-700">Suivre les statuts</p></a><a href="#achats" className="rounded-2xl border border-[#0F6B3F]/15 bg-white p-3 shadow-sm transition hover:border-[#0F6B3F]"><p className="text-xs font-semibold text-slate-500">Achats terminés</p><p className="mt-1 text-2xl font-black text-[#0F6B3F]">{purchaseCount}</p><p className="text-xs text-slate-600">{medicineCount} médicament(s) distinct(s)</p></a></div><nav aria-label="Accès rapide aux rubriques achats" className="flex gap-2 overflow-x-auto pb-1 text-sm"><a href="#reservations" className="shrink-0 rounded-full bg-[#0F6B3F] px-4 py-2 font-bold text-white">Réservations</a><a href="#achats" className="shrink-0 rounded-full bg-[#FFE23D] px-4 py-2 font-bold text-[#0B3D26]">Historique des achats</a><a href="#panier" className="shrink-0 rounded-full border border-slate-200 bg-white px-4 py-2 font-bold text-slate-800">Panier</a></nav>
 <section id="reservations" className="carte scroll-mt-24"><div className="mb-3 flex justify-between gap-2"><h2 className="text-lg font-extrabold">Mes réservations et commandes en cours</h2><span className="text-xs text-slate-500">{filteredReservations.length} / {reservations.length}</span></div><div className="mb-4 grid gap-2 sm:grid-cols-2"><label className="text-sm font-semibold">Rechercher une transaction<input className="champ mt-1 w-full" value={reservationQuery} onChange={e=>setReservationQuery(e.target.value)} placeholder="Pharmacie, médicament ou référence"/></label><label className="text-sm font-semibold">Statut<select className="champ mt-1 w-full" value={reservationStatus} onChange={e=>setReservationStatus(e.target.value)}><option value="all">Tous les statuts</option><option value="en_attente">En attente</option><option value="confirmee">Confirmée</option><option value="payee">Payée</option><option value="retiree">Terminée / retirée</option><option value="expiree">Expirée</option><option value="annulee">Annulée</option><option value="en_attente_pharmacie">En attente de la pharmacie</option><option value="acceptee">Acceptée</option><option value="preparation">En préparation</option><option value="livreur_assigne">Livreur assigné</option><option value="en_livraison">En livraison</option><option value="livree">Livrée</option></select></label></div>{recent.length===0?<p className="text-sm text-slate-500">Aucune réservation pour le moment.</p>:<div className="space-y-3">{recent.map(r=><article key={r.id} className="rounded-2xl border border-slate-100 p-3"><div className="flex justify-between gap-3"><div><p className="font-bold">{r.mode==="commande"?"Commande":"Réservation"} · {r.pharmacies?.nom??"Pharmacie"}</p><p className="text-xs text-slate-500">{fmt(r.created_at)} · N° {r.id.slice(0,8).toUpperCase()}</p></div><span className="rounded-full bg-naxa-canari px-2 py-1 text-xs font-bold">{r.mode==="commande"?(DELIVERY_STATUS[r.commande_statut||""]||STATUS[r.statut]||r.statut):(STATUS[r.statut]??r.statut)}</span></div><p className="mt-1 text-xs text-slate-600">Paiement : {r.paiement_statut==="effectue"?"Effectué":"À vérifier"}</p>{r.mode!=="commande"&&["en_attente","confirmee"].includes(r.statut)&&(()=>{const remaining=new Date(r.expires_at).getTime()-now;if(!Number.isFinite(remaining))return null;const minutes=Math.ceil(remaining/60000);if(remaining<=0)return <p className="mt-2 rounded-lg bg-[#FFF0DE] p-2 text-xs font-semibold text-[#9A4D08]">Échéance dépassée — vérification du statut serveur en cours.</p>;if(remaining<=30*60000)return <p className="mt-2 rounded-lg bg-[#FFF0DE] p-2 text-xs font-bold text-[#9A4D08]">Attention : expiration dans {minutes} min. Ouvrez le suivi pour contacter la pharmacie.</p>;return <p className="mt-2 text-xs text-slate-500">Temps restant : {Math.floor(minutes/60)>0?Math.floor(minutes/60)+" h ":""}{minutes%60} min</p>})()}<p className="mt-2 text-sm">{r.reservation_items.map((i,n)=><span key={n}>{i.quantite} × {i.produits?.nom??"Produit"}{i.produits?.dosage?" "+i.produits.dosage:""}{n<r.reservation_items.length-1?", ":""}</span>)}</p><div className="mt-2 flex justify-between"><strong>{fcfa(r.total)}</strong><Link className="text-sm font-bold underline" href={"/reservation/"+r.id}>Voir le suivi</Link></div></article>)}</div>}{filteredReservations.length>8&&<button type="button" onClick={()=>setShowAllReservations(v=>!v)} className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-[#0F6B3F]">{showAllReservations?"Afficher seulement les 8 plus récentes":`Afficher les ${filteredReservations.length} transactions`}</button>}</section></section>}

 {!loading&&!error&&<section id="panier" className="space-y-4 scroll-mt-24"><div className="carte flex items-center justify-between gap-3"><div><p className="text-xs text-slate-500">Articles sélectionnés</p><p className="text-2xl font-black">{nombrePanier}</p></div><Link href="/panier" className="btn btn-vert">Ouvrir le panier</Link></div>{lignesPanier.length===0?<div className="carte"><p className="font-bold">Votre panier est vide.</p><p className="mt-1 text-sm text-slate-600">Ajoutez un médicament depuis l’accueil ou les résultats pour continuer.</p><Link href="/" className="btn btn-vert mt-4 w-full">Chercher un médicament</Link></div>:<><ul className="space-y-3">{lignesPanier.map(l=><li key={l.produit_id} className="carte flex items-center gap-3"><div className="min-w-0 flex-1"><Link href={`/produit/${l.produit_id}`} className="font-bold underline">{l.nom}</Link>{l.dosage&&<p className="text-xs text-slate-500">{l.dosage}</p>}<p className="mt-1 text-xs text-slate-500">Quantité : {l.quantite}</p></div><div className="flex items-center gap-1"><button type="button" className="btn btn-clair !min-h-10 !w-10 !px-0" aria-label={`Retirer une unité de ${l.nom}`} disabled={l.quantite<=1} onClick={()=>changerQuantite(l.produit_id,l.quantite-1)}>−</button><span className="min-w-5 text-center font-bold">{l.quantite}</span><button type="button" className="btn btn-clair !min-h-10 !w-10 !px-0" aria-label={`Ajouter une unité de ${l.nom}`} onClick={()=>changerQuantite(l.produit_id,l.quantite+1)}>+</button><button type="button" className="ml-2 text-sm font-semibold text-red-700 underline" onClick={()=>retirer(l.produit_id)}>Retirer</button></div></li>)}</ul><div className="grid grid-cols-1 gap-2 sm:grid-cols-2"><Link href="/panier" className="btn btn-vert w-full">Réserver · choisir la pharmacie</Link><Link href="/commande/nouvelle" className="btn btn-clair w-full">Commander · demander une livraison</Link><button type="button" className="btn btn-clair w-full sm:col-span-2" onClick={vider}>Vider le panier</button></div><p className="text-xs leading-5 text-slate-500">Réservation : paiement en espèces directement à la caisse, confirmé seulement après validation du ticket. Commande : la pharmacie organise la livraison et encaisse directement. NAXA ne collecte pas le paiement et ne gère pas la livraison.</p></>}</section>}
 {!loading&&!error&&<section id="achats" className="space-y-4 scroll-mt-24"><div className="grid grid-cols-2 gap-3"><article className="carte"><p className="text-xs text-slate-500">Transactions</p><p className="text-2xl font-black">{purchaseCount}</p></article><article className="carte"><p className="text-xs text-slate-500">Médicaments distincts</p><p className="text-2xl font-black">{medicineCount}</p></article></div><div className="carte space-y-3"><div className="flex flex-wrap gap-2">{PERIODS.map(([id,label])=><button key={id} className={"btn !min-h-[40px] !px-3 text-sm "+(period===id?"btn-vert":"btn-clair")} onClick={()=>setPeriod(id)}>{label}</button>)}</div><input className="champ" value={q} onChange={e=>setQ(e.target.value)} placeholder="Rechercher un médicament ou une pharmacie" aria-label="Rechercher dans mes achats"/></div>
 {groups.length===0?<div className="carte"><p className="font-bold">Aucun achat dans cette période.</p><Link href="/" className="btn btn-vert mt-4 w-full">Chercher un médicament</Link></div>:groups.map(([id,lines])=><details key={id} className="carte" open><summary className="cursor-pointer list-none"><div className="flex justify-between gap-3"><div><p className="font-extrabold">Achat #{id.slice(0,8).toUpperCase()}</p><p className="text-sm text-slate-600">{fmt(lines[0].achat_le??lines[0].reservation_creee_le)} · {lines[0].pharmacie}</p><p className="text-xs text-slate-500">{[lines[0].quartier,lines[0].adresse].filter(Boolean).join(" · ")}</p></div><strong>{fcfa(lines[0].total_transaction)}</strong></div></summary><div className="mt-4 space-y-3 border-t pt-3">{lines.map(l=><div key={l.produit_id} className="flex gap-3 rounded-2xl bg-slate-50 p-3"><div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-white">{l.photo_url?<img src={l.photo_url} alt="" className="h-full w-full object-cover"/>:<div className="flex h-full items-center justify-center text-[10px] text-slate-400">NAXA</div>}</div><div><p className="font-bold">{l.medicament}</p><p className="text-xs text-slate-600">{[l.dci,l.dosage,l.forme].filter(Boolean).join(" · ")}</p><p className="mt-1 text-sm">{l.quantite} × {fcfa(l.prix_unitaire)} = <strong>{fcfa(l.total_ligne)}</strong></p></div></div>)}<dl className="grid grid-cols-2 gap-2 text-sm"><div><dt className="text-xs text-slate-500">Réservation créée</dt><dd className="font-semibold">{fmt(lines[0].reservation_creee_le)}</dd></div><div><dt className="text-xs text-slate-500">Confirmée</dt><dd className="font-semibold">{fmt(lines[0].confirmee_le)}</dd></div><div><dt className="text-xs text-slate-500">Paiement déclaré</dt><dd className="font-semibold">{fmt(lines[0].paiement_declare_le)}</dd></div><div><dt className="text-xs text-slate-500">Achat</dt><dd className="font-semibold">{fmt(lines[0].achat_le)}{lines[0].horodatage_achat_exact?"":" · historique exact indisponible"}</dd></div><div><dt className="text-xs text-slate-500">Retrait</dt><dd className="font-semibold">{fmt(lines[0].retiree_le)}</dd></div><div><dt className="text-xs text-slate-500">Référence</dt><dd className="font-semibold">{lines[0].reference_paiement??"—"}</dd></div></dl><p className="text-xs text-slate-500">Statut : {STATUS[lines[0].statut]??lines[0].statut} · Données limitées à votre compte.</p><div className="flex flex-wrap gap-3 pt-1"><Link className="text-sm font-bold text-[#1E7B3A] underline underline-offset-4" href={"/reservation/"+id}>Détails de la commande</Link>{(lines[0].statut==="payee"||lines[0].statut==="retiree")&&<Link className="text-sm font-bold text-[#1E7B3A] underline underline-offset-4" href={"/reservation/"+id+"/recu"}>Voir le reçu</Link>}</div></div></details>)}</section>}
 <p className="mt-8 text-center text-xs text-slate-500">Cet espace est un suivi commercial personnel NAXA, pas un dossier médical.</p></div></main>;
}

function ClientRouteContent(){const searchParams=useSearchParams();return searchParams.get("onglet")==="achats"?<ClientPageContent/>:<AccueilClient />}

export default function ClientPage(){return <Suspense fallback={<main className="mx-auto min-h-screen max-w-2xl px-4 pb-28"><p className="carte mt-6">Chargement de votre espace…</p></main>}><ClientRouteContent /></Suspense>}
