"use client";
import { useCallback,useEffect,useMemo,useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type Snapshot={id:string;assureur_id:string;montant_brut_fcfa:number;montant_assureur_fcfa:number;montant_client_fcfa:number;valide_client:boolean;controle_documents_statut:string;calcule_le:string;};
type Coverage={id:string;assureur_id:string;nom:string;numero_adherent:string;date_debut:string;date_fin:string|null;verification_statut:"non_verifiee"|"verifiee"|"suspendue"|"expiree";verification_pharmacie_id:string|null;};
type Insurer={id:string;nom:string};
type Proposal={id:string;version:number;statut:"proposee"|"acceptee"|"refusee"|"remplacee";montant_total_fcfa:number;montant_assureur_fcfa:number;montant_client_fcfa:number;motif:string;proposee_le:string;decidee_le:string|null;};
const money=(v:number)=>new Intl.NumberFormat("fr-FR").format(Number(v||0))+" FCFA";

export function AssuranceReceiptDetails({reservationId}:{reservationId:string}){
 const sb=useMemo(()=>supabaseBrowser(),[]);
 const [data,setData]=useState<Snapshot|null>(null),[name,setName]=useState("Assureur");
 const [coverages,setCoverages]=useState<Coverage[]>([]),[insurers,setInsurers]=useState<Insurer[]>([]);
 const [reservationPharmacyId,setReservationPharmacyId]=useState("");
 const [selected,setSelected]=useState(""),[newInsurer,setNewInsurer]=useState(""),[member,setMember]=useState(""),[policy,setPolicy]=useState("");
 const [start,setStart]=useState(new Date().toISOString().slice(0,10)),[end,setEnd]=useState("");
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const [proposals,setProposals]=useState<Proposal[]>([]);

 const load=useCallback(async()=>{
  setLoading(true);setError("");
  const {data:s,error:se}=await sb.from("assurance_reservation_snapshots")
   .select("id,assureur_id,montant_brut_fcfa,montant_assureur_fcfa,montant_client_fcfa,valide_client,controle_documents_statut,calcule_le")
   .eq("reservation_id",reservationId).maybeSingle();
  if(se){setError("Le détail Assurance est momentanément indisponible.");setLoading(false);return;}
  if(s){
   setData(s as Snapshot);
   const [{data:a},{data:proposalRows,error:proposalError}]=await Promise.all([
    sb.from("assureurs").select("nom").eq("id",s.assureur_id).maybeSingle(),
    sb.from("assurance_montant_propositions")
     .select("id,version,statut,montant_total_fcfa,montant_assureur_fcfa,montant_client_fcfa,motif,proposee_le,decidee_le")
     .eq("snapshot_id",s.id).order("version",{ascending:false})
   ]);
   if(proposalError){setError("L'historique des propositions Assurance est indisponible.");setProposals([]);}
   else setProposals((proposalRows??[]) as Proposal[]);
   setName(a?.nom??"Assureur");setLoading(false);return;
  }
  setData(null);setProposals([]);
  const {data:u}=await sb.auth.getUser();
  if(!u.user){setLoading(false);return;}
  const [{data:reservation,error:reservationError},{data:rows,error:ce}]=await Promise.all([
   sb.from("reservations").select("pharmacie_id").eq("id",reservationId).eq("client_id",u.user.id).maybeSingle(),
   sb.from("couvertures_assurance").select("id,assureur_id,numero_adherent,date_debut,date_fin,verification_statut,verification_pharmacie_id").eq("client_id",u.user.id).eq("actif",true)
  ]);
  if(reservationError||!reservation){setError("Cette réservation n’est pas accessible à votre compte.");setLoading(false);return;}
  if(ce){setError("Impossible de charger vos couvertures Assurance.");setLoading(false);return;}
  const today=new Date().toISOString().slice(0,10);
  setReservationPharmacyId(reservation.pharmacie_id);
  const active=(rows??[]).filter(x=>x.date_debut&&x.date_debut<=today&&(!x.date_fin||x.date_fin>=today));
  const ids=[...new Set(active.map(x=>x.assureur_id))];
  const {data:ins}=await sb.from("assureurs").select("id,nom").eq("actif",true).order("nom");
  const names=new Map((ins??[]).map(x=>[x.id,x.nom]));
  setInsurers((ins??[]) as Insurer[]);
  const mapped=active.map(x=>({...x,nom:names.get(x.assureur_id)??"Assureur"})) as Coverage[];
  const eligible=mapped.filter(x=>x.verification_statut==="verifiee"&&x.verification_pharmacie_id===reservation.pharmacie_id);
  setCoverages(mapped);setSelected(eligible[0]?.id??"");setNewInsurer(ins?.[0]?.id??"");setLoading(false);
 },[reservationId,sb]);

 useEffect(()=>{void load()},[load]);

 const saveCoverage=async()=>{
  if(busy||!newInsurer||member.trim().length<2)return;
  setBusy(true);setError("");
  const {error:e}=await sb.rpc("assurance_enregistrer_couverture",{
   p_assureur:newInsurer,p_numero_adherent:member.trim(),p_numero_police:policy.trim()||null,
   p_date_debut:start,p_date_fin:end||null,p_plafond:null,p_taux:100
  });
  if(e)setError("Enregistrement de la couverture impossible : vérifiez les informations.");
  else {setMember("");setPolicy("");await load();}
  setBusy(false);
 };
 const quote=async()=>{
  if(!selected||busy)return;setBusy(true);setError("");
  const {error:e}=await sb.rpc("assurance_calculer_devis",{p_reservation:reservationId,p_couverture:selected});
  if(e)setError(e.message.includes("convention")?"Cette pharmacie n’a pas de convention active ou de règle applicable pour cette couverture.":e.message);
  else await load();setBusy(false);
 };
 const accept=async()=>{
  if(!data||busy)return;setBusy(true);setError("");
  const {error:e}=await sb.rpc("assurance_valider_devis",{p_snapshot:data.id});
  if(e)setError("L’acceptation du devis a échoué. Actualisez puis réessayez.");
  else await load();setBusy(false);
 };

 const respondToProposal=async(proposal:Proposal,acceptProposal:boolean)=>{
  if(busy||proposal.statut!=="proposee")return;
  setBusy(true);setError("");
  const {error:e}=await sb.rpc("assurance_repondre_proposition_montant",{
   p_proposition:proposal.id,p_accepter:acceptProposal
  });
  if(e)setError(acceptProposal
   ?"Votre accord sur la proposition n'a pas été enregistré. Actualisez puis réessayez."
   :"Votre refus de la proposition n'a pas été enregistré. Actualisez puis réessayez.");
  else await load();
  setBusy(false);
 };
 const eligibleCoverages=coverages.filter(x=>x.verification_statut==="verifiee"&&x.verification_pharmacie_id===reservationPharmacyId);
 const acceptedProposal=proposals.filter(x=>x.statut==="acceptee").sort((a,b)=>b.version-a.version)[0]??null;
 const pendingProposal=proposals.find(x=>x.statut==="proposee")??null;
 const proposalStatus:Record<string,string>={proposee:"En attente de votre réponse",acceptee:"Acceptée",refusee:"Refusée",remplacee:"Remplacée par une nouvelle proposition"};

 if(loading)return <section className="carte text-sm text-slate-500">Vérification de la couverture Assurance…</section>;
 if(!data)return <section className="carte space-y-3">
  <h2 className="font-extrabold">Prise en charge par assurance</h2>
  <p className="text-sm text-slate-600">Associez une couverture active à cette réservation. Le devis sera calculé côté serveur selon la convention de la pharmacie. La pharmacie vérifiera les justificatifs avant toute prise en charge.</p>
  {eligibleCoverages.length>0&&<><label className="block text-sm font-semibold" htmlFor="assurance-couverture">Couverture vérifiée pour cette pharmacie</label>
   <select id="assurance-couverture" className="w-full rounded-xl border p-3" value={selected} onChange={e=>setSelected(e.target.value)}>
    {eligibleCoverages.map(x=><option key={x.id} value={x.id}>{x.nom} · Adhérent {x.numero_adherent}</option>)}
   </select>
   <button disabled={!selected||busy} onClick={()=>void quote()} className="btn btn-vert w-full">{busy?"Calcul…":"Calculer mon devis assurance"}</button>
  </>}
  {coverages.length>0&&eligibleCoverages.length===0&&<p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">Votre couverture est enregistrée, mais elle n’a pas encore été rapprochée avec une liste de cet assureur importée par cette pharmacie. Le devis Assurance reste indisponible tant que cette vérification n’est pas faite.</p>}
  {coverages.some(x=>x.verification_statut==="suspendue"&&x.verification_pharmacie_id===reservationPharmacyId)&&<p className="text-xs text-amber-800">Une couverture a été suspendue pour cette pharmacie selon la dernière liste importée.</p>}
  <details className="rounded-xl border p-3">
   <summary className="cursor-pointer text-sm font-bold">{coverages.length?"Ajouter ou corriger ma couverture":"Enregistrer ma couverture"}</summary>
   <div className="mt-3 grid gap-3 sm:grid-cols-2">
    <label className="text-sm font-semibold">Assureur<select className="mt-1 w-full rounded-xl border p-3 font-normal" value={newInsurer} onChange={e=>setNewInsurer(e.target.value)}>{insurers.map(x=><option key={x.id} value={x.id}>{x.nom}</option>)}</select></label>
    <label className="text-sm font-semibold">N° adhérent<input className="mt-1 w-full rounded-xl border p-3 font-normal" value={member} onChange={e=>setMember(e.target.value)} /></label>
    <label className="text-sm font-semibold">N° police (facultatif)<input className="mt-1 w-full rounded-xl border p-3 font-normal" value={policy} onChange={e=>setPolicy(e.target.value)} /></label>
    <label className="text-sm font-semibold">Début de validité<input type="date" className="mt-1 w-full rounded-xl border p-3 font-normal" value={start} onChange={e=>setStart(e.target.value)} /></label>
    <label className="text-sm font-semibold">Fin de validité<input type="date" className="mt-1 w-full rounded-xl border p-3 font-normal" value={end} onChange={e=>setEnd(e.target.value)} /></label>
   </div>
   <button disabled={!newInsurer||member.trim().length<2||busy} onClick={()=>void saveCoverage()} className="btn btn-vert mt-3 w-full">{busy?"Enregistrement…":"Enregistrer ma couverture"}</button>
   <p className="mt-2 text-xs text-slate-500">La saisie ou la correction retire toute vérification antérieure. Seule une correspondance unique avec une liste assureur importée par la pharmacie autorisera le calcul du devis. Les taux, plafonds, franchises et exclusions proviennent toujours de la convention de la pharmacie.</p>
  </details>
  {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
 </section>;

 return <section className="carte space-y-2">
  <h2 className="font-extrabold">Détail de la prise en charge assurance</h2>
  <p className="text-sm text-slate-600">{name} · Devis du {new Date(data.calcule_le).toLocaleString("fr-FR")}</p>
  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Devis initial accepté / à accepter</p>
  <div className="flex justify-between gap-3 text-sm"><span>Montant brut initial</span><strong>{money(data.montant_brut_fcfa)}</strong></div>
  <div className="flex justify-between gap-3 text-sm"><span>Part assureur initiale (créance, non encaissée)</span><strong>{money(data.montant_assureur_fcfa)}</strong></div>
  <div className="flex justify-between gap-3 border-t pt-2"><span className="font-bold">Part client initiale</span><strong>{money(data.montant_client_fcfa)}</strong></div>
  {!data.valide_client&&<button disabled={busy} onClick={()=>void accept()} className="btn btn-vert w-full">{busy?"Enregistrement…":"Accepter ce devis initial"}</button>}
  {acceptedProposal&&<div className="space-y-1 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
   <p className="text-sm font-extrabold text-emerald-900">Dernier partage accepté par vous · v{acceptedProposal.version}</p>
   <p className="flex justify-between gap-2 text-sm"><span>Part assureur retenue</span><strong>{money(acceptedProposal.montant_assureur_fcfa)}</strong></p>
   <p className="flex justify-between gap-2 text-sm"><span>Part client retenue</span><strong>{money(acceptedProposal.montant_client_fcfa)}</strong></p>
   <p className="text-xs text-emerald-900">Le devis initial et ses règles restent conservés ; ces montants constituent l'accord complémentaire le plus récent.</p>
  </div>}
  {pendingProposal&&<div className="space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-3">
   <p className="text-sm font-extrabold text-amber-950">Nouvelle proposition de la pharmacie · v{pendingProposal.version}</p>
   <p className="text-xs text-slate-700">Motif communiqué : {pendingProposal.motif}</p>
   <p className="flex justify-between gap-2 text-sm"><span>Part assureur proposée</span><strong>{money(pendingProposal.montant_assureur_fcfa)}</strong></p>
   <p className="flex justify-between gap-2 text-sm"><span>Reste à votre charge proposé</span><strong>{money(pendingProposal.montant_client_fcfa)}</strong></p>
   <p className="text-xs text-slate-600">Aucun montant ne change avant votre décision. La part assureur proposée ne dépasse pas celle du devis initial.</p>
   <div className="grid gap-2 sm:grid-cols-2">
    <button type="button" disabled={busy} onClick={()=>void respondToProposal(pendingProposal,true)} className="btn btn-vert">{busy?"Enregistrement…":"Accepter cette modification"}</button>
    <button type="button" disabled={busy} onClick={()=>void respondToProposal(pendingProposal,false)} className="btn btn-clair">Refuser cette modification</button>
   </div>
  </div>}
  {proposals.length>0&&<details className="rounded-xl border p-3">
   <summary className="cursor-pointer text-sm font-bold">Historique des propositions ({proposals.length})</summary>
   <ol className="mt-3 space-y-2">{proposals.map(p=><li key={p.id} className="border-t pt-2 text-xs">
    <p className="font-bold">Version {p.version} · {proposalStatus[p.statut]||p.statut}</p>
    <p>Assureur {money(p.montant_assureur_fcfa)} · Client {money(p.montant_client_fcfa)}</p>
    <p className="text-slate-500">{new Date(p.proposee_le).toLocaleString("fr-FR")} · {p.motif}</p>
   </li>)}</ol>
  </details>}
  <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">{data.valide_client?"Devis initial accepté par le client.":"Devis en attente de votre accord."} Justificatifs : {data.controle_documents_statut==="conforme"?"contrôlés et conformes":data.controle_documents_statut==="non_conforme"?"non conformes":"à présenter et contrôler au retrait"}. La part assureur ne constitue pas un paiement reçu.</p>
  {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
 </section>;
}
