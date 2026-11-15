"use client";

import Link from "next/link";
import * as XLSX from "xlsx";
import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type Dossier = { id:string; pharmacie_id:string; reservation_id:string|null; couverture_id:string; statut:string; montant_total:number; montant_prise_en_charge:number; montant_client:number; montant_rembourse:number; statut_remboursement:string; created_at:string };
type Snapshot = { id:string; reservation_id:string; valide_client:boolean; controle_documents_statut:string };
type Evenement = { id:string; pharmacie_id:string; reservation_id:string|null; dossier_id:string|null; assureur_id:string|null; type:string; montant_fcfa:number|null; reference:string|null; created_at:string };
type Assureur = { id:string; nom:string };
type Convention = {id:string;pharmacie_id:string;assureur_id:string;statut:string;reference_convention:string|null;date_debut:string;date_fin:string|null};
type ConventionRule = {id:string;convention_id:string;portee:string;categorie:string|null;produit_id:string|null;taux:number;plafond_fcfa:number|null;franchise_fcfa:number;exclusions:string[];justificatifs_requis:string[];valide_du:string;valide_jusquau:string|null;version:number;actif:boolean};
type ProductOption = {id:string;nom:string;categorie:string|null};
type Proposition={id:string;dossier_id:string;reservation_id:string;snapshot_id:string;version:number;statut:"proposee"|"acceptee"|"refusee"|"remplacee";montant_total_fcfa:number;montant_assureur_fcfa:number;montant_client_fcfa:number;motif:string;proposee_le:string;decidee_le:string|null;};
type PharmacyOption={id:string;nom:string};
type ImportPreview={import_id:string;statut:"simulee"|"appliquee";total_lignes:number;correspondances:number;sans_correspondance:number;ambiguite:number;invalides:number;doublons:number;};
const normalizeImportHeader=(value:string)=>value.normalize("NFD").replace(/[\\u0300-\\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
const importDateToIso=(value:unknown):string=>{
 if(value instanceof Date&&!Number.isNaN(value.getTime())) return [value.getFullYear(),String(value.getMonth()+1).padStart(2,"0"),String(value.getDate()).padStart(2,"0")].join("-");
 if(typeof value==="number"&&Number.isFinite(value)){
  const parsed=XLSX.SSF.parse_date_code(value);
  if(parsed) return [parsed.y,String(parsed.m).padStart(2,"0"),String(parsed.d).padStart(2,"0")].join("-");
 }
 const raw=String(value??"").trim();
 if(/^\\d{4}-\\d{2}-\\d{2}$/.test(raw)) return raw;
 const match=raw.match(/^(\\d{1,2})[/.\\-](\\d{1,2})[/.\\-](\\d{4})$/);
 if(match) return [match[3],match[2].padStart(2,"0"),match[1].padStart(2,"0")].join("-");
 return "";
};
const importStatus=(value:unknown):string=>{
 const valueKey=normalizeImportHeader(String(value??""));
 if(["actif","active","valide","valid","enregle","enordre"].includes(valueKey))return "actif";
 if(["suspendu","suspendue","suspended"].includes(valueKey))return "suspendu";
 if(["expire","expiree","expired","resilie","resiliee","inactif"].includes(valueKey))return "expire";
 return valueKey;
};
const money=(v:number)=>new Intl.NumberFormat("fr-FR").format(Math.round(v||0))+" FCFA";
const labels:Record<string,string>={devis_calcule:"Devis calculé",reservation_assurance_validee:"Devis accepté par le client",documents_controles:"Justificatifs contrôlés",prise_en_charge_confirmee:"Prise en charge confirmée",prise_en_charge_refusee:"Prise en charge refusée",montant_modifie:"Proposition de montant",accord_client_obtenu:"Modification acceptée par le client",accord_client_refuse:"Modification refusée par le client",vente_assurance_enregistree:"Vente enregistrée",remboursement_recu:"Remboursement reçu",remboursement_partiel:"Remboursement partiel",dossier_solde:"Dossier soldé"};

export default function AssuranceDashboardPage(){
 const [loading,setLoading]=useState(true),[error,setError]=useState(""),[role,setRole]=useState(""),[pharmacies,setPharmacies]=useState<string[]>([]),[dossiers,setDossiers]=useState<Dossier[]>([]),[events,setEvents]=useState<Evenement[]>([]),[assureurs,setAssureurs]=useState<Record<string,string>>({}),[newInsurer,setNewInsurer]=useState(""),[newCode,setNewCode]=useState(""),[savingInsurer,setSavingInsurer]=useState(false),[notice,setNotice]=useState(""),[pharmacyOptions,setPharmacyOptions]=useState<PharmacyOption[]>([]),[assureurOptions,setAssureurOptions]=useState<Assureur[]>([]),[selectedPharmacy,setSelectedPharmacy]=useState(""),[selectedInsurer,setSelectedInsurer]=useState(""),[ruleRate,setRuleRate]=useState(""),[ruleCap,setRuleCap]=useState(""),[ruleFranchise,setRuleFranchise]=useState("0"),[savingConvention,setSavingConvention]=useState(false);
 const [conventions,setConventions]=useState<Convention[]>([]),[conventionRules,setConventionRules]=useState<ConventionRule[]>([]),[products,setProducts]=useState<ProductOption[]>([]),[selectedConventionId,setSelectedConventionId]=useState("");
 const [snapshots,setSnapshots]=useState<Snapshot[]>([]),[busyDossier,setBusyDossier]=useState("");
 const [importFile,setImportFile]=useState<File|null>(null),[importSourceRef,setImportSourceRef]=useState(""),[importPreview,setImportPreview]=useState<ImportPreview|null>(null),[importBusy,setImportBusy]=useState(false),[importMode,setImportMode]=useState<"complet"|"delta">("delta");
 const [proposals,setProposals]=useState<Proposition[]>([]),[proposalAmounts,setProposalAmounts]=useState<Record<string,string>>({}),[proposalReasons,setProposalReasons]=useState<Record<string,string>>({}),[savingProposal,setSavingProposal]=useState("");
 const [insurerRefs,setInsurerRefs]=useState<Record<string,string>>({}),[repaymentAmounts,setRepaymentAmounts]=useState<Record<string,string>>({}),[repaymentDates,setRepaymentDates]=useState<Record<string,string>>({}),[repaymentRefs,setRepaymentRefs]=useState<Record<string,string>>({});
 const todayLocal=()=>{const now=new Date();return new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,10)};
 const [conventionReference,setConventionReference]=useState(""),[conventionStart,setConventionStart]=useState(new Date().toISOString().slice(0,10)),[conventionEnd,setConventionEnd]=useState("");
 const [ruleScope,setRuleScope]=useState("categorie"),[ruleCategory,setRuleCategory]=useState(""),[ruleProduct,setRuleProduct]=useState(""),[ruleExclusions,setRuleExclusions]=useState(""),[ruleDocuments,setRuleDocuments]=useState(""),[ruleStart,setRuleStart]=useState(new Date().toISOString().slice(0,10)),[ruleEnd,setRuleEnd]=useState(""),[savingRule,setSavingRule]=useState(false);
 const load=useCallback(async()=>{
  setLoading(true);setError("");const sb=supabaseBrowser();
  const {data:user}=await sb.auth.getUser();if(!user.user){window.location.replace("/connexion?retour=/pharmacie/assurance");return;}
  const {data:fn,error:fnError}=await sb.rpc("naxa_business_function");if(fnError||typeof fn!=="string"){setError("Impossible de vérifier le poste actif.");setLoading(false);return;}
  if(!["promoteur","pharmacien","responsable","caisse","comptable"].includes(fn)){setError("Accès réservé aux Promoteurs et aux postes Pharmacie, Caisse ou Comptable autorisés.");setLoading(false);return;}
  setRole(fn);let ids:string[]=[];
  if(fn==="promoteur"){
   const {data:links,error:e}=await sb.from("promoteur_pharmacies").select("pharmacie_id").eq("promoteur_id",user.user.id).eq("actif",true);
   if(e){setError("Impossible de charger le réseau du Promoteur.");setLoading(false);return;}ids=[...new Set((links??[]).map(x=>x.pharmacie_id))];
  }else{
   const {data:id,error:e}=await sb.rpc("naxa_active_role_pharmacy");if(e||typeof id!=="string"){setError("Aucune pharmacie active n’est associée à ce poste.");setLoading(false);return;}ids=[id];
  }
  if(!ids.length){setPharmacies([]);setDossiers([]);setEvents([]);setProposals([]);setLoading(false);return;}
  setPharmacies(ids);
  const {data:pharmacyRows}=await sb.from("pharmacies").select("id,nom").in("id",ids);
  setPharmacyOptions((pharmacyRows??[]) as PharmacyOption[]);
  setSelectedPharmacy(old=>ids.includes(old)?old:(ids[0]??""));
  const [{data:ds,error:de},{data:ev,error:ee},{data:ins,error:ie},{data:conv,error:ce},{data:ruleRows,error:re},{data:productRows,error:pe},{data:sn,error:sne},{data:proposalRows,error:proposalError}]=await Promise.all([
   sb.from("dossiers_assurance").select("id,pharmacie_id,reservation_id,couverture_id,statut,montant_total,montant_prise_en_charge,montant_client,montant_rembourse,statut_remboursement,created_at").in("pharmacie_id",ids).order("created_at",{ascending:false}).limit(1000),
   sb.from("assurance_evenements").select("id,pharmacie_id,reservation_id,dossier_id,assureur_id,type,montant_fcfa,reference,created_at").in("pharmacie_id",ids).order("created_at",{ascending:false}).limit(1000),
   sb.from("assureurs").select("id,nom").eq("actif",true),
   sb.from("assurance_conventions").select("id,pharmacie_id,assureur_id,statut,reference_convention,date_debut,date_fin").in("pharmacie_id",ids).order("date_debut",{ascending:false}),
   sb.from("assurance_regles_convention").select("id,convention_id,portee,categorie,produit_id,taux,plafond_fcfa,franchise_fcfa,exclusions,justificatifs_requis,valide_du,valide_jusquau,version,actif").order("version",{ascending:false}),
   sb.from("produits").select("id,nom,categorie").eq("fiche_validee",true).order("nom").limit(500),
   sb.from("assurance_reservation_snapshots").select("id,reservation_id,valide_client,controle_documents_statut").in("pharmacie_id",ids).limit(1000),
   sb.from("assurance_montant_propositions").select("id,dossier_id,reservation_id,snapshot_id,version,statut,montant_total_fcfa,montant_assureur_fcfa,montant_client_fcfa,motif,proposee_le,decidee_le").in("pharmacie_id",ids).order("version",{ascending:false}).limit(2000)
  ]);
  if(de||ee||ie||ce||re||pe||sne||proposalError){setError("Certaines données Assurance n’ont pas pu être chargées. Aucun total partiel n’est présenté comme complet.");setDossiers([]);setSnapshots([]);setEvents([]);setConventions([]);setConventionRules([]);setProducts([]);setProposals([]);setLoading(false);return;}
  setDossiers((ds??[]) as Dossier[]);setSnapshots((sn??[]) as Snapshot[]);setEvents((ev??[]) as Evenement[]);setProposals((proposalRows??[]) as Proposition[]);
  setAssureurs(Object.fromEntries(((ins??[]) as Assureur[]).map(x=>[x.id,x.nom])));setAssureurOptions((ins??[]) as Assureur[]);
  const conventionRows=(conv??[]) as Convention[];const ruleData=(ruleRows??[]) as ConventionRule[];
  setConventions(conventionRows);setConventionRules(ruleData.filter(x=>conventionRows.some(c=>c.id===x.convention_id)));
  setProducts((productRows??[]) as ProductOption[]);
  setSelectedConventionId(old=>conventionRows.some(x=>x.id===old&&x.statut==="active")?old:(conventionRows.find(x=>x.pharmacie_id===ids[0]&&x.statut==="active")?.id??conventionRows.find(x=>x.statut==="active")?.id??""));
  setSelectedInsurer(old=>(ins??[]).some(x=>x.id===old)?old:((ins??[])[0]?.id??""));setLoading(false);
 },[]);
 useEffect(()=>{void load()},[load]);
 const addInsurer=async()=>{
  if(role!=="promoteur"||newInsurer.trim().length<2||savingInsurer)return;
  setSavingInsurer(true);setNotice("");setError("");
  const {error:e}=await supabaseBrowser().rpc("assurance_ajouter_assureur",{p_nom:newInsurer.trim(),p_code:newCode.trim()||null});
  if(e)setError("Impossible d’ajouter cet assureur. Le nom est peut-être déjà utilisé ou le compte Promoteur n’est pas actif.");
  else {setNotice("Assureur ajouté au référentiel partagé. La pharmacie doit encore déclarer sa propre convention.");setNewInsurer("");setNewCode("");void load();}
  setSavingInsurer(false);
 };
 const saveConvention=async()=>{
  const rate=Number(ruleRate),cap=ruleCap.trim()?Number(ruleCap):null,franchise=Number(ruleFranchise);
  if(savingConvention||!selectedPharmacy||!selectedInsurer||!Number.isFinite(rate)||rate<0||rate>100||!Number.isSafeInteger(franchise)||franchise<0||(cap!==null&&(!Number.isSafeInteger(cap)||cap<0)))return;
  setSavingConvention(true);setNotice("");setError("");
  const {data:conventionId,error:ce}=await supabaseBrowser().rpc("assurance_configurer_convention",{
   p_pharmacie:selectedPharmacy,p_assureur:selectedInsurer,p_reference:conventionReference.trim()||null,
   p_debut:conventionStart,p_fin:conventionEnd||null,
   p_taux:rate,p_plafond:cap,p_franchise:franchise
  });
  if(ce||typeof conventionId!=="string")setError("Convention et règle non enregistrées. Aucune activation partielle n’a été conservée.");
  else {setNotice("Convention et règle générale enregistrées ensemble. Vous pouvez maintenant ajouter des règles prioritaires par catégorie ou produit.");setSelectedConventionId(conventionId);setRuleRate("");setRuleCap("");setRuleFranchise("0");setConventionReference("");setConventionEnd("");}
  setSavingConvention(false);void load();
 };
 const saveRule=async()=>{
  const rate=Number(ruleRate),cap=ruleCap.trim()?Number(ruleCap):null,franchise=Number(ruleFranchise);
  if(savingRule||!selectedConventionId||!Number.isFinite(rate)||rate<0||rate>100||!Number.isSafeInteger(franchise)||franchise<0||(cap!==null&&(!Number.isSafeInteger(cap)||cap<0))||!ruleStart||(ruleEnd !== "" && ruleEnd < ruleStart)||(ruleScope==="categorie"&&!ruleCategory.trim())||(ruleScope==="produit"&&!ruleProduct))return;
  const splitValues=(value:string)=>value.split(/[\n,;]/).map(x=>x.trim()).filter(Boolean);
  setSavingRule(true);setNotice("");setError("");
  const {error:e}=await supabaseBrowser().rpc("assurance_enregistrer_regle",{
   p_convention:selectedConventionId,p_portee:ruleScope,p_categorie:ruleScope==="categorie"?ruleCategory.trim():null,
   p_produit:ruleScope==="produit"?ruleProduct:null,p_taux:rate,p_plafond:cap,p_franchise:franchise,
   p_exclusions:splitValues(ruleExclusions),p_justificatifs:splitValues(ruleDocuments),p_debut:ruleStart,p_fin:ruleEnd||null
  });
  if(e)setError("Règle non enregistrée : vérifiez la convention, les dates et le périmètre autorisé.");
  else {setNotice("Nouvelle version de règle enregistrée. La version précédente de même portée est désactivée, sans modifier les devis déjà figés.");setRuleRate("");setRuleCap("");setRuleFranchise("0");setRuleExclusions("");setRuleDocuments("");setRuleEnd("");}
  setSavingRule(false);void load();
 };
  const controlDocuments=async(d:Dossier,conforme:boolean)=>{
   const snapshot=snapshots.find(x=>x.reservation_id===d.reservation_id);
   if(!snapshot||!d.reservation_id||!snapshot.valide_client||busyDossier)return;
   setBusyDossier(d.id);setError("");setNotice("");
   const {error:e}=await supabaseBrowser().rpc("assurance_controler_documents",{p_snapshot:snapshot.id,p_conforme:conforme,p_details:{source:"tableau_assurance",decision:conforme?"conforme":"non_conforme"}});
   if(e){setError("Le contrôle des justificatifs n’a pas été enregistré. Vérifiez les droits du poste et réessayez.");}
   else {setNotice(conforme?"Justificatifs marqués conformes. La prise en charge doit encore être confirmée séparément.":"Justificatifs marqués non conformes. Le dossier reste bloqué pour la caisse.");}
   setBusyDossier("");await load();
  };
  const confirmCoverage=async(d:Dossier)=>{
   if(busyDossier||d.statut!=="soumis")return;
   setBusyDossier(d.id);setError("");setNotice("");
   const {error:e}=await supabaseBrowser().rpc("assurance_confirmer_prise_en_charge",{p_dossier:d.id,p_reference:insurerRefs[d.id]?.trim()||null});
   if(e)setError("La prise en charge n’a pas été confirmée. Vérifiez l’accord client, les justificatifs et le périmètre pharmacie.");
   else {setNotice("Prise en charge confirmée : la part assureur est enregistrée comme créance, pas comme encaissement.");setInsurerRefs(current=>({...current,[d.id]:""}));}
   setBusyDossier("");await load();
  };
  const submitAmountProposal=async(d:Dossier)=>{
   const amount=Number(proposalAmounts[d.id]);
   const motif=(proposalReasons[d.id]||"").trim();
   const snapshot=snapshots.find(x=>x.reservation_id===d.reservation_id);
   if(savingProposal||!(proposalAmounts[d.id]||"").trim()||!snapshot||!snapshot.valide_client||!Number.isSafeInteger(amount)
      ||amount<0||amount>=Number(d.montant_prise_en_charge)||motif.length<3||motif.length>500)return;
   setSavingProposal(d.id);setError("");setNotice("");
   const {error:e}=await supabaseBrowser().rpc("assurance_proposer_montant",{
    p_dossier:d.id,p_montant_assureur_fcfa:amount,p_motif:motif
   });
   if(e)setError("La proposition n'a pas été enregistrée. Vérifiez votre rôle actif, le motif et le montant.");
   else {setNotice("Proposition enregistrée. La confirmation finale reste bloquée jusqu'à la réponse du Client.");setProposalAmounts(v=>({...v,[d.id]:""}));setProposalReasons(v=>({...v,[d.id]:""}));}
   setSavingProposal("");await load();
  };
  const recordRepayment=async(d:Dossier)=>{
   const amount=Number(repaymentAmounts[d.id]),date=repaymentDates[d.id]||todayLocal(),reference=(repaymentRefs[d.id]||"").trim();
   if(busyDossier||!Number.isSafeInteger(amount)||amount<=0||!date||reference.length<3)return;
   setBusyDossier(d.id);setError("");setNotice("");
   const {error:e}=await supabaseBrowser().rpc("assurance_enregistrer_remboursement",{p_dossier:d.id,p_montant_fcfa:amount,p_date:date,p_reference:reference,p_preuve_path:null});
   if(e)setError("Le remboursement n’a pas été enregistré. Vérifiez le montant restant, la date et la référence reçue.");
   else {setNotice("Règlement assureur enregistré. La créance restante est recalculée par le serveur.");setRepaymentAmounts(current=>({...current,[d.id]:""}));setRepaymentRefs(current=>({...current,[d.id]:""}));}
   setBusyDossier("");await load();
  };
 const simulateInsurerImport=async()=>{
  if(!importFile||!selectedPharmacy||!selectedInsurer||importSourceRef.trim().length<3||importBusy)return;
  if(importFile.size>10*1024*1024){setError("Fichier trop volumineux : limite de 10 Mo.");return;}
  const extension=importFile.name.toLowerCase().split(".").pop();
  if(!["csv","xls","xlsx"].includes(extension||"")){setError("Format non accepté. Utilisez CSV, XLS ou XLSX.");return;}
  setImportBusy(true);setError("");setNotice("");setImportPreview(null);
  try{
   const buffer=await importFile.arrayBuffer();
   const workbook=XLSX.read(buffer,{type:"array",cellDates:true});
   const firstSheet=workbook.SheetNames[0];
   if(!firstSheet)throw new Error("Aucune feuille trouvée dans ce fichier.");
   const sheet=workbook.Sheets[firstSheet];
   const rawRows=XLSX.utils.sheet_to_json<Record<string,unknown>>(sheet,{defval:"",raw:true});
   if(!rawRows.length)throw new Error("Le fichier ne contient aucune ligne de données.");
   if(rawRows.length>5000)throw new Error("Limite de 5 000 lignes dépassée.");
   const aliases={
    numero_adherent:["numeroadherent","numadherent","adherent","matricule","identifiantadherent","numeroassure","numassure"],
    numero_police:["numeropolice","police","contrat","numerocontrat","policy"],
    beneficiaire_nom:["beneficiaire","nombeneficiaire","nomassure","nomcomplet","beneficiary","beneficiaryname"],
    date_debut:["datedebut","datedebutvalidite","debutvalidite","startdate","datedeffet"],
    date_fin:["datefin","datefinvalidite","finvalidite","enddate","expiration","dateexpiration"],
    statut:["statut","status","etat","state"]
   } as const;
   const headerKeys=Object.keys(rawRows[0]).map(normalizeImportHeader);
   for(const required of ["numero_adherent","date_debut","statut"] as const){
    if(!aliases[required].some(alias=>headerKeys.includes(alias)))throw new Error("Colonne obligatoire absente : "+required.replaceAll("_"," "));
   }
   const getValue=(row:Record<string,unknown>,names:readonly string[])=>{
    const entry=Object.entries(row).find(([key])=>names.includes(normalizeImportHeader(key)));
    return entry?.[1]??"";
   };
   const rows=rawRows.map(row=>({
    numero_adherent:String(getValue(row,aliases.numero_adherent)).trim(),
    numero_police:String(getValue(row,aliases.numero_police)).trim(),
    beneficiaire_nom:String(getValue(row,aliases.beneficiaire_nom)).trim(),
    date_debut:importDateToIso(getValue(row,aliases.date_debut)),
    date_fin:importDateToIso(getValue(row,aliases.date_fin)),
    statut:importStatus(getValue(row,aliases.statut))
   }));
   const hashBytes=await crypto.subtle.digest("SHA-256",buffer);
   const sha256=Array.from(new Uint8Array(hashBytes)).map(byte=>byte.toString(16).padStart(2,"0")).join("");
   const {data,error:e}=await supabaseBrowser().rpc("assurance_import_simuler_mode",{
    p_pharmacie:selectedPharmacy,p_assureur:selectedInsurer,p_reference_source:importSourceRef.trim(),
    p_nom_fichier:importFile.name,p_sha256:sha256,p_lignes:rows,p_mode_import:importMode
   });
   if(e)throw new Error(e.message||"La simulation de rapprochement a échoué.");
   setImportPreview(data as ImportPreview);
   setNotice("Simulation terminée. Seules les correspondances uniques sont proposées ; aucune couverture n'a encore été vérifiée.");
  }catch(err){
   setError(err instanceof Error?err.message:"Impossible de lire ou simuler ce fichier.");
  }finally{
   setImportBusy(false);
  }
 };
 const applyInsurerImport=async()=>{
  if(!importPreview||importPreview.statut!=="simulee"||importPreview.correspondances<1||importBusy)return;
  setImportBusy(true);setError("");setNotice("");
  const {data,error:e}=await supabaseBrowser().rpc("assurance_import_appliquer",{p_import:importPreview.import_id});
  if(e)setError(e.message||"L'application de l'import a échoué.");
  else {
   const result=data as {statut?:string;mode_import?:string;couvertures_appliquees?:number;suspendues?:number;expirees?:number};
   setImportPreview(current=>current?{...current,statut:"appliquee"}:current);
   setNotice((result.couvertures_appliquees??0)+" couverture(s) rapprochée(s) ; "+(result.suspendues??0)+" suspendue(s), "+(result.expirees??0)+" expirée(s). Mode "+(result.mode_import==="complet"?"liste complète":"mise à jour partielle")+".");
   setImportFile(null);
   await load();
  }
  setImportBusy(false);
 };
 const selectedConvention=conventions.find(x=>x.id===selectedConventionId);
 const activeRules=conventionRules.filter(x=>x.convention_id===selectedConventionId).sort((a,b)=>Number(b.actif)-Number(a.actif)||b.version-a.version);

 const accepted=dossiers.filter(x=>x.statut==="accepte");
 const due=accepted.reduce((s,x)=>s+Math.max(0,Number(x.montant_prise_en_charge)-Number(x.montant_rembourse||0)),0);
 const paid=accepted.reduce((s,x)=>s+Number(x.montant_rembourse||0),0);
 const pending=dossiers.filter(x=>x.statut==="brouillon"||x.statut==="soumis").length;
 return <main className="mx-auto min-h-screen max-w-6xl space-y-5 bg-naxa-green-50 px-4 py-5 pb-20">
  <header className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-naxa-green-900 p-5 text-white">
   <div><p className="text-xs font-bold uppercase tracking-widest text-white/70">NAXA · Assurance</p><h1 className="mt-1 text-2xl font-black">Suivi des prises en charge</h1><p className="mt-1 text-sm text-white/75">{role==="promoteur"?"Vue consolidée des pharmacies de votre réseau":"Vue de la pharmacie active"}</p></div>
   <nav className="flex gap-2"><Link className="btn btn-clair" href="/pharmacie">Espace pharmacie</Link><button className="btn btn-canari" onClick={()=>void load()}>Actualiser</button></nav>
  </header>
  {error&&<p role="alert" className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">{error}</p>}{notice&&<p role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">{notice}</p>}
  {loading?<section className="rounded-2xl bg-white p-5">Chargement des événements Assurance…</section>:<>
   {(role==="promoteur"||role==="pharmacien"||role==="responsable")&&<> <section className="rounded-2xl bg-white p-4"><h2 className="font-extrabold">Conventions et taux de prise en charge</h2><p className="mb-3 text-xs text-slate-500">Déclarez la convention de la pharmacie et son taux général. Une convention n’est jamais créée par le simple ajout d’un assureur au référentiel.</p><div className="grid gap-2 sm:grid-cols-2">
   <label className="text-sm font-semibold">Pharmacie<select className="mt-1 w-full rounded-xl border p-3 font-normal" value={selectedPharmacy} onChange={e=>setSelectedPharmacy(e.target.value)}>{pharmacyOptions.map(x=><option key={x.id} value={x.id}>{x.nom}</option>)}</select></label>
   <label className="text-sm font-semibold">Assureur<select className="mt-1 w-full rounded-xl border p-3 font-normal" value={selectedInsurer} onChange={e=>setSelectedInsurer(e.target.value)}>{assureurOptions.map(x=><option key={x.id} value={x.id}>{x.nom}</option>)}</select></label>
   <label className="text-sm font-semibold">Référence de convention (facultatif)<input className="mt-1 w-full rounded-xl border p-3 font-normal" value={conventionReference} onChange={e=>setConventionReference(e.target.value)} placeholder="Référence signée"/></label>
   <label className="text-sm font-semibold">Début de convention<input type="date" className="mt-1 w-full rounded-xl border p-3 font-normal" value={conventionStart} onChange={e=>setConventionStart(e.target.value)}/></label>
   <label className="text-sm font-semibold">Fin de convention (facultatif)<input type="date" min={conventionStart} className="mt-1 w-full rounded-xl border p-3 font-normal" value={conventionEnd} onChange={e=>setConventionEnd(e.target.value)}/></label>
   <label className="text-sm font-semibold">Taux général (%)<input type="number" min="0" max="100" step="0.01" className="mt-1 w-full rounded-xl border p-3 font-normal" value={ruleRate} onChange={e=>setRuleRate(e.target.value)}/></label>
   <label className="text-sm font-semibold">Plafond par article FCFA (facultatif)<input type="number" min="0" step="1" className="mt-1 w-full rounded-xl border p-3 font-normal" value={ruleCap} onChange={e=>setRuleCap(e.target.value)}/></label>
   <label className="text-sm font-semibold">Franchise FCFA<input type="number" min="0" step="1" className="mt-1 w-full rounded-xl border p-3 font-normal" value={ruleFranchise} onChange={e=>setRuleFranchise(e.target.value)}/></label>
  </div><button disabled={savingConvention||!selectedPharmacy||!selectedInsurer||!ruleRate.trim()||!conventionStart||(conventionEnd !== "" && conventionEnd < conventionStart)} onClick={()=>void saveConvention()} className="btn btn-vert mt-3 w-full">{savingConvention?"Enregistrement…":"Enregistrer la convention et le taux général"}</button></section>
   <section className="space-y-3 rounded-2xl bg-white p-4">
    <div><h2 className="font-extrabold">Règles détaillées de prise en charge</h2><p className="text-xs text-slate-500">Une règle produit prévaut sur une règle catégorie, qui prévaut sur la règle générale. Les versions antérieures restent traçables et les devis déjà acceptés ne sont pas recalculés.</p></div>
    <label className="block text-sm font-semibold">Convention à paramétrer<select className="mt-1 w-full rounded-xl border p-3 font-normal" value={selectedConventionId} onChange={e=>setSelectedConventionId(e.target.value)}><option value="">Sélectionner une convention</option>{conventions.filter(c=>c.statut==="active").map(c=><option key={c.id} value={c.id}>{pharmacyOptions.find(p=>p.id===c.pharmacie_id)?.nom||"Pharmacie"} · {assureurs[c.assureur_id]||"Assureur"} · {c.date_debut}{c.date_fin?" → "+c.date_fin:""}</option>)}</select></label>
    {selectedConvention&&<p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">Référence : {selectedConvention.reference_convention||"Non renseignée"} · Validité : {selectedConvention.date_debut} → {selectedConvention.date_fin||"sans date de fin"}</p>}
    <div className="grid gap-2 sm:grid-cols-2">
     <label className="text-sm font-semibold">Portée de la règle<select className="mt-1 w-full rounded-xl border p-3 font-normal" value={ruleScope} onChange={e=>setRuleScope(e.target.value)}><option value="tout">Tous les produits</option><option value="categorie">Catégorie</option><option value="produit">Produit précis</option></select></label>
     {ruleScope==="categorie"&&<label className="text-sm font-semibold">Catégorie exacte du catalogue<input className="mt-1 w-full rounded-xl border p-3 font-normal" value={ruleCategory} onChange={e=>setRuleCategory(e.target.value)} placeholder="Ex. Médicaments"/></label>}
     {ruleScope==="produit"&&<label className="text-sm font-semibold">Produit validé<select className="mt-1 w-full rounded-xl border p-3 font-normal" value={ruleProduct} onChange={e=>setRuleProduct(e.target.value)}><option value="">Sélectionner un produit</option>{products.map(p=><option key={p.id} value={p.id}>{p.nom}{p.categorie?" · "+p.categorie:""}</option>)}</select>{products.length===0&&<span className="mt-1 block text-xs font-normal text-amber-700">Aucun produit validé n'est disponible dans le référentiel de ce projet Replay.</span>}</label>}
     <label className="text-sm font-semibold">Taux de prise en charge (%)<input type="number" min="0" max="100" step="0.01" className="mt-1 w-full rounded-xl border p-3 font-normal" value={ruleRate} onChange={e=>setRuleRate(e.target.value)}/></label>
     <label className="text-sm font-semibold">Plafond par ligne FCFA (facultatif)<input type="number" min="0" step="1" className="mt-1 w-full rounded-xl border p-3 font-normal" value={ruleCap} onChange={e=>setRuleCap(e.target.value)}/></label>
     <label className="text-sm font-semibold">Franchise FCFA<input type="number" min="0" step="1" className="mt-1 w-full rounded-xl border p-3 font-normal" value={ruleFranchise} onChange={e=>setRuleFranchise(e.target.value)}/></label>
     <label className="text-sm font-semibold">Début de validité<input type="date" className="mt-1 w-full rounded-xl border p-3 font-normal" value={ruleStart} onChange={e=>setRuleStart(e.target.value)}/></label>
     <label className="text-sm font-semibold">Fin de validité (facultatif)<input type="date" min={ruleStart} className="mt-1 w-full rounded-xl border p-3 font-normal" value={ruleEnd} onChange={e=>setRuleEnd(e.target.value)}/></label>
     <label className="text-sm font-semibold sm:col-span-2">Exclusions (catégories exactes ou identifiants produits, une valeur par ligne)<textarea className="mt-1 w-full rounded-xl border p-3 font-normal" rows={2} value={ruleExclusions} onChange={e=>setRuleExclusions(e.target.value)} placeholder="Catégorie exclue ou UUID produit"/></label>
     <label className="text-sm font-semibold sm:col-span-2">Justificatifs requis (un par ligne)<textarea className="mt-1 w-full rounded-xl border p-3 font-normal" rows={2} value={ruleDocuments} onChange={e=>setRuleDocuments(e.target.value)} placeholder="Carte d'assurance&#10;Ordonnance"/></label>
    </div>
    <button disabled={savingRule||!selectedConventionId||!ruleRate.trim()||(ruleScope==="categorie"&&!ruleCategory.trim())||(ruleScope==="produit"&&!ruleProduct)||!ruleStart||(ruleEnd !== "" && ruleEnd < ruleStart)} onClick={()=>void saveRule()} className="btn btn-vert w-full">{savingRule?"Enregistrement…":"Enregistrer une nouvelle règle"}</button>
    <div className="space-y-2"><h3 className="font-bold">Historique des règles de cette convention</h3>{activeRules.length?activeRules.map(r=><article key={r.id} className="rounded-xl border p-3 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><strong>{r.portee==="tout"?"Tous les produits":r.portee==="categorie"?"Catégorie : "+(r.categorie||"—"):"Produit : "+(products.find(p=>p.id===r.produit_id)?.nom||r.produit_id||"—")}</strong><span className={r.actif?"text-emerald-700":"text-slate-500"}>{r.actif?"Active":"Historique"} · v{r.version}</span></div><p className="mt-1">Taux {Number(r.taux)} % · Plafond {r.plafond_fcfa==null?"sans plafond":money(Number(r.plafond_fcfa))} · Franchise {money(Number(r.franchise_fcfa))}</p><p className="text-xs text-slate-500">Validité : {r.valide_du} → {r.valide_jusquau||"sans fin"}{r.exclusions?.length?" · Exclusions : "+r.exclusions.join(", "):""}</p><p className="text-xs text-slate-500">Justificatifs : {r.justificatifs_requis?.length?r.justificatifs_requis.join(", "):"aucun précisé"}</p></article>):<p className="text-sm text-slate-500">Aucune règle enregistrée pour cette convention.</p>}</div>
   </section></>}
  {(role==="promoteur"||role==="pharmacien"||role==="responsable")&&<section className="space-y-3 rounded-2xl bg-white p-4">
   <div><h2 className="font-extrabold">Importer la liste des assurés reçue de l’assureur</h2><p className="text-xs text-slate-600">Import CSV, XLS ou XLSX (10 Mo, 5 000 lignes maximum). L’import est rattaché à la pharmacie et à l’assureur sélectionnés. Référence de transmission et empreinte SHA-256 sont conservées.</p></div>
   <div className="grid gap-2 sm:grid-cols-2">
    <label className="text-sm font-semibold">Pharmacie<select className="mt-1 w-full rounded-xl border p-3 font-normal" value={selectedPharmacy} onChange={e=>{setSelectedPharmacy(e.target.value);setImportPreview(null);}}>{pharmacyOptions.map(x=><option key={x.id} value={x.id}>{x.nom}</option>)}</select></label>
    <label className="text-sm font-semibold">Assureur<select className="mt-1 w-full rounded-xl border p-3 font-normal" value={selectedInsurer} onChange={e=>{setSelectedInsurer(e.target.value);setImportPreview(null);}}>{assureurOptions.map(x=><option key={x.id} value={x.id}>{x.nom}</option>)}</select></label>
    <label className="text-sm font-semibold sm:col-span-2">Référence de transmission / courrier assureur<input className="mt-1 w-full rounded-xl border p-3 font-normal" value={importSourceRef} onChange={e=>setImportSourceRef(e.target.value)} placeholder="Référence du courrier ou du fichier transmis"/></label>
    <label className="text-sm font-semibold sm:col-span-2">Type de fichier reçu<select className="mt-1 w-full rounded-xl border p-3 font-normal" value={importMode} onChange={e=>{setImportMode(e.target.value as "complet"|"delta");setImportPreview(null);}}><option value="complet">Liste complète des assurés à jour</option><option value="delta">Mise à jour partielle / changements uniquement</option></select><span className="mt-1 block text-xs font-normal text-slate-500">Une liste complète remplace les vérifications précédentes de cette pharmacie pour cet assureur. Une mise à jour partielle ne modifie que les personnes présentes dans le fichier.</span></label>
    <label className="text-sm font-semibold sm:col-span-2">Fichier assureur<input type="file" accept=".csv,.xls,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="mt-1 w-full rounded-xl border p-3 font-normal" onChange={e=>{setImportFile(e.target.files?.[0]??null);setImportPreview(null);}}/><span className="mt-1 block text-xs font-normal text-slate-500">{importFile?importFile.name:"Choisir un fichier de liste des adhérents"}</span></label>
   </div>
   <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">Colonnes attendues : numéro adhérent, date début et statut. Numéro de police, nom du bénéficiaire et date de fin sont facultatifs. Les dates doivent être lisibles en AAAA-MM-JJ ou JJ/MM/AAAA. Les colonnes peuvent porter des intitulés usuels équivalents.</p>
   <button type="button" disabled={importBusy||!importFile||!selectedPharmacy||!selectedInsurer||importSourceRef.trim().length<3} onClick={()=>void simulateInsurerImport()} className="btn btn-vert w-full">{importBusy?"Analyse du fichier…":"Simuler le rapprochement sans valider de couverture"}</button>
   {importPreview&&<div className="space-y-2 rounded-xl border p-3">
    <p className="text-sm font-bold">Résultat de la simulation · {importPreview.statut==="appliquee"?"Import appliqué":"Import non appliqué"}</p>
    <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
     <p>Lignes <strong className="block">{importPreview.total_lignes}</strong></p>
     <p>Correspondances uniques <strong className="block">{importPreview.correspondances}</strong></p>
     <p>Sans correspondance <strong className="block">{importPreview.sans_correspondance}</strong></p>
     <p>Ambiguës <strong className="block">{importPreview.ambiguite}</strong></p>
     <p>Invalides <strong className="block">{importPreview.invalides}</strong></p>
     <p>Doublons <strong className="block">{importPreview.doublons}</strong></p>
    </div>
    {importPreview.statut==="simulee"&&<button type="button" disabled={importBusy||importPreview.correspondances<1} onClick={()=>void applyInsurerImport()} className="btn btn-vert w-full">{importBusy?"Application…":importMode==="complet"?"Appliquer la liste complète (remplace l’ancienne vérification)":"Appliquer uniquement les correspondances uniques"}</button>}
    <p className="text-xs text-slate-600">Les lignes sans correspondance, ambiguës, invalides ou répétées ne valident aucun assuré. Aucun profil client n’est créé à partir du fichier. La référence et l’empreinte enregistrent la provenance déclarée par l’opérateur, pas une authentification cryptographique de l’assureur.</p>
   </div>}
  </section>}
  {role==="promoteur"&&<section className="rounded-2xl bg-white p-4"><h2 className="font-extrabold">Référentiel partagé des assureurs</h2><p className="mb-3 text-xs text-slate-500">L’ajout rend l’assureur disponible dans la recherche. Il ne conventionne aucune pharmacie automatiquement.</p><div className="grid gap-2 sm:grid-cols-[1fr_180px_auto]"><input aria-label="Nom de l’assureur" className="rounded-xl border p-3" placeholder="Nom de l’assureur" value={newInsurer} onChange={e=>setNewInsurer(e.target.value)}/><input aria-label="Code assureur facultatif" className="rounded-xl border p-3" placeholder="Code (facultatif)" value={newCode} onChange={e=>setNewCode(e.target.value)}/><button disabled={savingInsurer||newInsurer.trim().length<2} onClick={()=>void addInsurer()} className="btn btn-vert">{savingInsurer?"Ajout…":"Ajouter l’assureur"}</button></div></section>}
  <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
    <article className="rounded-2xl bg-white p-4"><p className="text-sm text-slate-500">Dossiers suivis</p><p className="mt-1 text-2xl font-black">{dossiers.length}</p></article>
    <article className="rounded-2xl bg-white p-4"><p className="text-sm text-slate-500">À traiter</p><p className="mt-1 text-2xl font-black">{pending}</p></article>
    <article className="rounded-2xl bg-white p-4"><p className="text-sm text-slate-500">Remboursements encaissés</p><p className="mt-1 text-xl font-black">{money(paid)}</p></article>
    <article className="rounded-2xl bg-white p-4"><p className="text-sm text-slate-500">Créances assureurs restantes</p><p className="mt-1 text-xl font-black">{money(due)}</p></article>
   </section>
   <section className="overflow-hidden rounded-2xl bg-white">
    <div className="border-b p-4"><h2 className="font-extrabold">Achats adossés aux assurances</h2><p className="text-xs text-slate-500">La prise en charge confirmée est une créance, pas un encaissement.</p></div>
    {dossiers.length?<div className="space-y-3 p-3">{dossiers.map(d=>{
      const snapshot=snapshots.find(x=>x.reservation_id===d.reservation_id);
      const remaining=Math.max(0,Number(d.montant_prise_en_charge)-Number(d.montant_rembourse||0));
      const canReview=["promoteur","pharmacien","responsable","caisse"].includes(role);
      const canRecordPayment=["promoteur","comptable","responsable","caisse"].includes(role);
      const canProposeAmount=["promoteur","pharmacien","responsable"].includes(role);
      const dossierProposals=proposals.filter(p=>p.dossier_id===d.id).sort((a,b)=>b.version-a.version);
      const pendingProposal=dossierProposals.find(p=>p.statut==="proposee");
      return <article className="rounded-xl border p-3" key={d.id}>
       <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-bold">{(d.reservation_id||d.id).slice(0,8).toUpperCase()} · {d.statut==="accepte"?"Prise en charge confirmée":d.statut==="soumis"?"En attente de décision":d.statut==="refuse"?"Refusée":d.statut}</p><p className="text-xs text-slate-500">{new Date(d.created_at).toLocaleString("fr-FR")}</p></div><p className="text-sm font-bold">Solde assureur : {money(remaining)}</p></div>
       <div className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4"><p>Brut<br/><strong>{money(Number(d.montant_total))}</strong></p><p>Part assureur<br/><strong>{money(Number(d.montant_prise_en_charge))}</strong></p><p>Part client<br/><strong>{money(Number(d.montant_client))}</strong></p><p>Reçu<br/><strong>{money(Number(d.montant_rembourse||0))}</strong></p></div>
       {d.statut==="soumis"&&snapshot&&snapshot.valide_client&&canReview&&<div className="mt-3 space-y-2 rounded-lg bg-slate-50 p-3">
        <p className="text-sm font-bold">Contrôle des justificatifs · accord client acquis</p>
        <div className="flex flex-wrap gap-2"><button type="button" disabled={!!busyDossier} onClick={()=>void controlDocuments(d,true)} className="btn btn-vert">{busyDossier===d.id?"Enregistrement…":"Justificatifs conformes"}</button><button type="button" disabled={!!busyDossier} onClick={()=>void controlDocuments(d,false)} className="btn btn-clair">Non conformes — bloquer la prise en charge</button></div>
        {snapshot.controle_documents_statut==="conforme"&&pendingProposal&&<p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950">Une proposition attend la réponse du Client. La confirmation définitive de la prise en charge est bloquée.</p>}
        {snapshot.controle_documents_statut==="conforme"&&!pendingProposal&&<><label className="block text-xs font-semibold">Référence de prise en charge (facultatif)<input className="mt-1 w-full rounded-xl border p-2 font-normal" value={insurerRefs[d.id]||""} onChange={e=>setInsurerRefs(v=>({...v,[d.id]:e.target.value}))}/></label><button type="button" disabled={!!busyDossier} onClick={()=>void confirmCoverage(d)} className="btn btn-vert w-full">Confirmer la prise en charge</button></>}
        {snapshot.controle_documents_statut==="non_conforme"&&<p className="text-xs text-amber-800">Les paiements sont bloqués tant que les justificatifs ne sont pas contrôlés conformes.</p>}
       </div>}
       {d.statut==="soumis"&&snapshot?.valide_client&&canProposeAmount&&snapshot.controle_documents_statut!=="non_conforme"&&<div className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-white p-3">
        <div><p className="text-sm font-extrabold">Proposer un autre partage du montant</p><p className="text-xs text-slate-600">La part assureur proposée ne peut pas dépasser celle du devis initial ni le montant actuellement accepté. Le devis initial reste inchangé ; seul le Client peut accepter la modification.</p></div>
        {pendingProposal&&<p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-950">Proposition v{pendingProposal.version} en attente : assureur {money(pendingProposal.montant_assureur_fcfa)} · client {money(pendingProposal.montant_client_fcfa)}. Une nouvelle proposition la remplacera.</p>}
        <label className="block text-xs font-semibold">Nouvelle part assureur (FCFA)<input type="number" min="0" max={Math.max(0,Number(d.montant_prise_en_charge)-1)} step="1" className="mt-1 w-full rounded-xl border p-2" value={proposalAmounts[d.id]||""} onChange={e=>setProposalAmounts(v=>({...v,[d.id]:e.target.value}))} placeholder={String(d.montant_prise_en_charge)}/></label>
        <label className="block text-xs font-semibold">Motif obligatoire (3 à 500 caractères)<textarea minLength={3} maxLength={500} className="mt-1 w-full rounded-xl border p-2" value={proposalReasons[d.id]||""} onChange={e=>setProposalReasons(v=>({...v,[d.id]:e.target.value}))} placeholder="Expliquer le motif de la modification"/></label>
        <button type="button" disabled={savingProposal===d.id||!(proposalAmounts[d.id]||"").trim()||!Number.isSafeInteger(Number(proposalAmounts[d.id]))||Number(proposalAmounts[d.id])<0||Number(proposalAmounts[d.id])>=Number(d.montant_prise_en_charge)||(proposalReasons[d.id]||"").trim().length<3} onClick={()=>void submitAmountProposal(d)} className="btn btn-vert w-full">{savingProposal===d.id?"Enregistrement…":pendingProposal?"Remplacer la proposition en attente":"Envoyer la proposition au Client"}</button>
        {dossierProposals.length>0&&<details className="rounded-lg border p-2"><summary className="cursor-pointer text-xs font-bold">Historique des propositions ({dossierProposals.length})</summary><ol className="mt-2 space-y-2">{dossierProposals.map(p=><li key={p.id} className="border-t pt-2 text-xs"><p className="font-bold">Version {p.version} · {({proposee:"En attente du Client",acceptee:"Acceptée",refusee:"Refusée",remplacee:"Remplacée"} as Record<string,string>)[p.statut]}</p><p>Assureur {money(p.montant_assureur_fcfa)} · Client {money(p.montant_client_fcfa)}</p><p className="text-slate-500">{new Date(p.proposee_le).toLocaleString("fr-FR")} · {p.motif}</p></li>)}</ol></details>}
       </div>}
       {d.statut==="accepte"&&remaining>0&&canRecordPayment&&<div className="mt-3 grid gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-3">
        <label className="text-xs font-semibold">Montant réellement reçu (FCFA)<input className="mt-1 w-full rounded-xl border p-2" type="number" min="1" max={remaining} step="1" value={repaymentAmounts[d.id]||""} onChange={e=>setRepaymentAmounts(v=>({...v,[d.id]:e.target.value}))}/></label>
        <label className="text-xs font-semibold">Date de réception<input className="mt-1 w-full rounded-xl border p-2" type="date" max={todayLocal()} value={repaymentDates[d.id]||todayLocal()} onChange={e=>setRepaymentDates(v=>({...v,[d.id]:e.target.value}))}/></label>
        <label className="text-xs font-semibold">Référence de reçu / transaction<input className="mt-1 w-full rounded-xl border p-2" value={repaymentRefs[d.id]||""} onChange={e=>setRepaymentRefs(v=>({...v,[d.id]:e.target.value}))}/></label>
        <button type="button" disabled={!!busyDossier||!Number.isSafeInteger(Number(repaymentAmounts[d.id]))||Number(repaymentAmounts[d.id])<=0||Number(repaymentAmounts[d.id])>remaining||(repaymentRefs[d.id]||"").trim().length<3} onClick={()=>void recordRepayment(d)} className="btn btn-vert sm:col-span-3">{busyDossier===d.id?"Enregistrement…":"Enregistrer un remboursement réellement reçu"}</button>
       </div>}
      </article>;
    })}</div>:<p className="p-4 text-sm text-slate-500">Aucun dossier d’assurance enregistré.</p>}
   </section>
   <section className="overflow-hidden rounded-2xl bg-white">
    <div className="border-b p-4"><h2 className="font-extrabold">Journal des événements</h2><p className="text-xs text-slate-500">Historique horodaté des devis, contrôles, décisions et remboursements.</p></div>
    {events.length?<ol className="divide-y">{events.slice(0,100).map(e=><li key={e.id} className="flex flex-wrap items-center justify-between gap-2 p-3"><div><p className="font-semibold">{labels[e.type]||e.type}</p><p className="text-xs text-slate-500">{assureurs[e.assureur_id||""]||"Assureur"} · {new Date(e.created_at).toLocaleString("fr-FR")}</p></div><div className="text-right"><p className="font-bold">{e.montant_fcfa==null?"—":money(Number(e.montant_fcfa))}</p><p className="text-xs text-slate-500">{e.reference||e.reservation_id?.slice(0,8)||""}</p></div></li>)}</ol>:<p className="p-4 text-sm text-slate-500">Aucun événement enregistré.</p>}
   </section>
  </>}
 </main>;
}
