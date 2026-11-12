"use client";
import { useCallback,useEffect,useMemo,useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type Snapshot={id:string;assureur_id:string;montant_brut_fcfa:number;montant_assureur_fcfa:number;montant_client_fcfa:number;valide_client:boolean;controle_documents_statut:string;calcule_le:string;};
type Coverage={id:string;assureur_id:string;nom:string;numero_adherent:string;date_debut:string;date_fin:string|null;};
type Insurer={id:string;nom:string};
const money=(v:number)=>new Intl.NumberFormat("fr-FR").format(Number(v||0))+" FCFA";

export function AssuranceReceiptDetails({reservationId}:{reservationId:string}){
 const sb=useMemo(()=>supabaseBrowser(),[]);
 const [data,setData]=useState<Snapshot|null>(null),[name,setName]=useState("Assureur");
 const [coverages,setCoverages]=useState<Coverage[]>([]),[insurers,setInsurers]=useState<Insurer[]>([]);
 const [selected,setSelected]=useState(""),[newInsurer,setNewInsurer]=useState(""),[member,setMember]=useState(""),[policy,setPolicy]=useState("");
 const [start,setStart]=useState(new Date().toISOString().slice(0,10)),[end,setEnd]=useState(""),[limit,setLimit]=useState(""),[rate,setRate]=useState("");
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState("");

 const load=useCallback(async()=>{
  setLoading(true);setError("");
  const {data:s,error:se}=await sb.from("assurance_reservation_snapshots")
   .select("id,assureur_id,montant_brut_fcfa,montant_assureur_fcfa,montant_client_fcfa,valide_client,controle_documents_statut,calcule_le")
   .eq("reservation_id",reservationId).maybeSingle();
  if(se){setError("Le détail Assurance est momentanément indisponible.");setLoading(false);return;}
  if(s){
   setData(s as Snapshot);
   const {data:a}=await sb.from("assureurs").select("nom").eq("id",s.assureur_id).maybeSingle();
   setName(a?.nom??"Assureur");setLoading(false);return;
  }
  setData(null);
  const {data:u}=await sb.auth.getUser();
  if(!u.user){setLoading(false);return;}
  const today=new Date().toISOString().slice(0,10);
  const {data:rows,error:ce}=await sb.from("couvertures_assurance")
   .select("id,assureur_id,numero_adherent,date_debut,date_fin")
   .eq("client_id",u.user.id).eq("actif",true).lte("date_debut",today);
  if(ce){setError("Impossible de charger vos couvertures Assurance.");setLoading(false);return;}
  const active=(rows??[]).filter(x=>!x.date_fin||x.date_fin>=today);
  const ids=[...new Set(active.map(x=>x.assureur_id))];
  const {data:ins}=await sb.from("assureurs").select("id,nom").eq("actif",true).order("nom");
  const names=new Map((ins??[]).map(x=>[x.id,x.nom]));
  setInsurers((ins??[]) as Insurer[]);
  const mapped=active.map(x=>({...x,nom:names.get(x.assureur_id)??"Assureur"})) as Coverage[];
  setCoverages(mapped);setSelected(mapped[0]?.id??"");setNewInsurer(ins?.[0]?.id??"");setLoading(false);
 },[reservationId,sb]);

 useEffect(()=>{void load()},[load]);

 const saveCoverage=async()=>{
  if(busy||!newInsurer||member.trim().length<2)return;
  const parsedRate=rate.trim()?Number(rate):NaN,parsedLimit=limit.trim()?Number(limit):null;
  if(!Number.isFinite(parsedRate)||parsedRate<0||parsedRate>100||(parsedLimit!==null&&(!Number.isSafeInteger(parsedLimit)||parsedLimit<0))){setError("Taux ou plafond invalide.");return;}
  setBusy(true);setError("");
  const {error:e}=await sb.rpc("assurance_enregistrer_couverture",{
   p_assureur:newInsurer,p_numero_adherent:member.trim(),p_numero_police:policy.trim()||null,
   p_date_debut:start,p_date_fin:end||null,p_plafond:parsedLimit,p_taux:parsedRate
  });
  if(e)setError("Enregistrement de la couverture impossible : vérifiez les informations.");
  else {setMember("");setPolicy("");setLimit("");await load();}
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

 if(loading)return <section className="carte text-sm text-slate-500">Vérification de la couverture Assurance…</section>;
 if(!data)return <section className="carte space-y-3">
  <h2 className="font-extrabold">Prise en charge par assurance</h2>
  <p className="text-sm text-slate-600">Associez une couverture active à cette réservation. Le devis sera calculé côté serveur selon la convention de la pharmacie. La pharmacie vérifiera les justificatifs avant toute prise en charge.</p>
  {coverages.length>0&&<><label className="block text-sm font-semibold" htmlFor="assurance-couverture">Votre couverture</label>
   <select id="assurance-couverture" className="w-full rounded-xl border p-3" value={selected} onChange={e=>setSelected(e.target.value)}>
    {coverages.map(x=><option key={x.id} value={x.id}>{x.nom} · Adhérent {x.numero_adherent}</option>)}
   </select>
   <button disabled={!selected||busy} onClick={()=>void quote()} className="btn btn-vert w-full">{busy?"Calcul…":"Calculer mon devis assurance"}</button>
  </>}
  <details className="rounded-xl border p-3">
   <summary className="cursor-pointer text-sm font-bold">{coverages.length?"Ajouter une autre couverture":"Enregistrer ma couverture"}</summary>
   <div className="mt-3 grid gap-3 sm:grid-cols-2">
    <label className="text-sm font-semibold">Assureur<select className="mt-1 w-full rounded-xl border p-3 font-normal" value={newInsurer} onChange={e=>setNewInsurer(e.target.value)}>{insurers.map(x=><option key={x.id} value={x.id}>{x.nom}</option>)}</select></label>
    <label className="text-sm font-semibold">N° adhérent<input className="mt-1 w-full rounded-xl border p-3 font-normal" value={member} onChange={e=>setMember(e.target.value)} /></label>
    <label className="text-sm font-semibold">N° police (facultatif)<input className="mt-1 w-full rounded-xl border p-3 font-normal" value={policy} onChange={e=>setPolicy(e.target.value)} /></label>
    <label className="text-sm font-semibold">Taux de couverture (%)<input type="number" min="0" max="100" step="0.01" className="mt-1 w-full rounded-xl border p-3 font-normal" value={rate} onChange={e=>setRate(e.target.value)} /></label>
    <label className="text-sm font-semibold">Début de validité<input type="date" className="mt-1 w-full rounded-xl border p-3 font-normal" value={start} onChange={e=>setStart(e.target.value)} /></label>
    <label className="text-sm font-semibold">Fin de validité<input type="date" className="mt-1 w-full rounded-xl border p-3 font-normal" value={end} onChange={e=>setEnd(e.target.value)} /></label>
    <label className="text-sm font-semibold sm:col-span-2">Plafond FCFA (facultatif)<input type="number" min="0" step="1" className="mt-1 w-full rounded-xl border p-3 font-normal" value={limit} onChange={e=>setLimit(e.target.value)} /></label>
   </div>
   <button disabled={!newInsurer||member.trim().length<2||busy} onClick={()=>void saveCoverage()} className="btn btn-vert mt-3 w-full">{busy?"Enregistrement…":"Enregistrer ma couverture"}</button>
   <p className="mt-2 text-xs text-slate-500">La saisie ne vaut pas validation des droits. La pharmacie vérifiera la carte et les justificatifs.</p>
  </details>
  {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
 </section>;

 return <section className="carte space-y-2">
  <h2 className="font-extrabold">Détail de la prise en charge assurance</h2>
  <p className="text-sm text-slate-600">{name} · Devis du {new Date(data.calcule_le).toLocaleString("fr-FR")}</p>
  <div className="flex justify-between gap-3 text-sm"><span>Montant brut</span><strong>{money(data.montant_brut_fcfa)}</strong></div>
  <div className="flex justify-between gap-3 text-sm"><span>Part assureur (créance, non encaissée)</span><strong>{money(data.montant_assureur_fcfa)}</strong></div>
  <div className="flex justify-between gap-3 border-t pt-2"><span className="font-bold">Reste à payer client</span><strong>{money(data.montant_client_fcfa)}</strong></div>
  {!data.valide_client&&<button disabled={busy} onClick={()=>void accept()} className="btn btn-vert w-full">{busy?"Enregistrement…":"Accepter ce devis"}</button>}
  <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">{data.valide_client?"Devis accepté par le client.":"Devis en attente de votre accord."} Justificatifs : {data.controle_documents_statut==="conforme"?"contrôlés et conformes":data.controle_documents_statut==="non_conforme"?"non conformes":"à présenter et contrôler au retrait"}. La part assureur ne constitue pas un paiement reçu.</p>
  {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
 </section>;
}
