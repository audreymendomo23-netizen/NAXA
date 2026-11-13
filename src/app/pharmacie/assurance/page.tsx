"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type Dossier = { id:string; pharmacie_id:string; reservation_id:string|null; couverture_id:string; statut:string; montant_total:number; montant_prise_en_charge:number; montant_client:number; montant_rembourse:number; statut_remboursement:string; created_at:string };
type Evenement = { id:string; pharmacie_id:string; reservation_id:string|null; dossier_id:string|null; assureur_id:string|null; type:string; montant_fcfa:number|null; reference:string|null; created_at:string };
type Assureur = { id:string; nom:string };
type Convention = {id:string;pharmacie_id:string;assureur_id:string;statut:string;reference_convention:string|null;date_debut:string;date_fin:string|null};
type ConventionRule = {id:string;convention_id:string;portee:string;categorie:string|null;produit_id:string|null;taux:number;plafond_fcfa:number|null;franchise_fcfa:number;exclusions:string[];justificatifs_requis:string[];valide_du:string;valide_jusquau:string|null;version:number;actif:boolean};
type ProductOption = {id:string;nom:string;categorie:string|null};
type PharmacyOption={id:string;nom:string};
const money=(v:number)=>new Intl.NumberFormat("fr-FR").format(Math.round(v||0))+" FCFA";
const labels:Record<string,string>={devis_calcule:"Devis calculé",reservation_assurance_validee:"Devis accepté par le client",documents_controles:"Justificatifs contrôlés",prise_en_charge_confirmee:"Prise en charge confirmée",prise_en_charge_refusee:"Prise en charge refusée",montant_modifie:"Montant modifié",accord_client_obtenu:"Accord client obtenu",vente_assurance_enregistree:"Vente enregistrée",remboursement_recu:"Remboursement reçu",remboursement_partiel:"Remboursement partiel",dossier_solde:"Dossier soldé"};

export default function AssuranceDashboardPage(){
 const [loading,setLoading]=useState(true),[error,setError]=useState(""),[role,setRole]=useState(""),[pharmacies,setPharmacies]=useState<string[]>([]),[dossiers,setDossiers]=useState<Dossier[]>([]),[events,setEvents]=useState<Evenement[]>([]),[assureurs,setAssureurs]=useState<Record<string,string>>({}),[newInsurer,setNewInsurer]=useState(""),[newCode,setNewCode]=useState(""),[savingInsurer,setSavingInsurer]=useState(false),[notice,setNotice]=useState(""),[pharmacyOptions,setPharmacyOptions]=useState<PharmacyOption[]>([]),[assureurOptions,setAssureurOptions]=useState<Assureur[]>([]),[selectedPharmacy,setSelectedPharmacy]=useState(""),[selectedInsurer,setSelectedInsurer]=useState(""),[ruleRate,setRuleRate]=useState(""),[ruleCap,setRuleCap]=useState(""),[ruleFranchise,setRuleFranchise]=useState("0"),[savingConvention,setSavingConvention]=useState(false);
 const [conventions,setConventions]=useState<Convention[]>([]),[conventionRules,setConventionRules]=useState<ConventionRule[]>([]),[products,setProducts]=useState<ProductOption[]>([]),[selectedConventionId,setSelectedConventionId]=useState("");
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
  if(!ids.length){setPharmacies([]);setDossiers([]);setEvents([]);setLoading(false);return;}
  setPharmacies(ids);
  const {data:pharmacyRows}=await sb.from("pharmacies").select("id,nom").in("id",ids);
  setPharmacyOptions((pharmacyRows??[]) as PharmacyOption[]);
  setSelectedPharmacy(old=>ids.includes(old)?old:(ids[0]??""));
  const [{data:ds,error:de},{data:ev,error:ee},{data:ins,error:ie},{data:conv,error:ce},{data:ruleRows,error:re},{data:productRows,error:pe}]=await Promise.all([
   sb.from("dossiers_assurance").select("id,pharmacie_id,reservation_id,couverture_id,statut,montant_total,montant_prise_en_charge,montant_client,montant_rembourse,statut_remboursement,created_at").in("pharmacie_id",ids).order("created_at",{ascending:false}).limit(1000),
   sb.from("assurance_evenements").select("id,pharmacie_id,reservation_id,dossier_id,assureur_id,type,montant_fcfa,reference,created_at").in("pharmacie_id",ids).order("created_at",{ascending:false}).limit(1000),
   sb.from("assureurs").select("id,nom").eq("actif",true),
   sb.from("assurance_conventions").select("id,pharmacie_id,assureur_id,statut,reference_convention,date_debut,date_fin").in("pharmacie_id",ids).order("date_debut",{ascending:false}),
   sb.from("assurance_regles_convention").select("id,convention_id,portee,categorie,produit_id,taux,plafond_fcfa,franchise_fcfa,exclusions,justificatifs_requis,valide_du,valide_jusquau,version,actif").order("version",{ascending:false}),
   sb.from("produits").select("id,nom,categorie").eq("fiche_validee",true).order("nom").limit(500)
  ]);
  if(de||ee||ie||ce||re||pe){setError("Certaines données Assurance n’ont pas pu être chargées. Aucun total partiel n’est présenté comme complet.");setDossiers([]);setEvents([]);setConventions([]);setConventionRules([]);setProducts([]);setLoading(false);return;}
  setDossiers((ds??[]) as Dossier[]);setEvents((ev??[]) as Evenement[]);
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
  {role==="promoteur"&&<section className="rounded-2xl bg-white p-4"><h2 className="font-extrabold">Référentiel partagé des assureurs</h2><p className="mb-3 text-xs text-slate-500">L’ajout rend l’assureur disponible dans la recherche. Il ne conventionne aucune pharmacie automatiquement.</p><div className="grid gap-2 sm:grid-cols-[1fr_180px_auto]"><input aria-label="Nom de l’assureur" className="rounded-xl border p-3" placeholder="Nom de l’assureur" value={newInsurer} onChange={e=>setNewInsurer(e.target.value)}/><input aria-label="Code assureur facultatif" className="rounded-xl border p-3" placeholder="Code (facultatif)" value={newCode} onChange={e=>setNewCode(e.target.value)}/><button disabled={savingInsurer||newInsurer.trim().length<2} onClick={()=>void addInsurer()} className="btn btn-vert">{savingInsurer?"Ajout…":"Ajouter l’assureur"}</button></div></section>}
  <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
    <article className="rounded-2xl bg-white p-4"><p className="text-sm text-slate-500">Dossiers suivis</p><p className="mt-1 text-2xl font-black">{dossiers.length}</p></article>
    <article className="rounded-2xl bg-white p-4"><p className="text-sm text-slate-500">À traiter</p><p className="mt-1 text-2xl font-black">{pending}</p></article>
    <article className="rounded-2xl bg-white p-4"><p className="text-sm text-slate-500">Remboursements encaissés</p><p className="mt-1 text-xl font-black">{money(paid)}</p></article>
    <article className="rounded-2xl bg-white p-4"><p className="text-sm text-slate-500">Créances assureurs restantes</p><p className="mt-1 text-xl font-black">{money(due)}</p></article>
   </section>
   <section className="overflow-hidden rounded-2xl bg-white">
    <div className="border-b p-4"><h2 className="font-extrabold">Achats adossés aux assurances</h2><p className="text-xs text-slate-500">La prise en charge confirmée est une créance, pas un encaissement.</p></div>
    {dossiers.length?<div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50"><tr><th className="p-3">Référence</th><th className="p-3">État</th><th className="p-3">Montant brut</th><th className="p-3">Assureur dû</th><th className="p-3">Reçu</th><th className="p-3">Solde</th></tr></thead><tbody>{dossiers.map(d=><tr className="border-t" key={d.id}><td className="p-3 font-semibold">{(d.reservation_id||d.id).slice(0,8).toUpperCase()}</td><td className="p-3">{d.statut==="accepte"?"Prise en charge confirmée":d.statut==="soumis"?"En attente":d.statut==="refuse"?"Refusée":d.statut}</td><td className="p-3">{money(Number(d.montant_total))}</td><td className="p-3">{money(Number(d.montant_prise_en_charge))}</td><td className="p-3">{money(Number(d.montant_rembourse||0))}</td><td className="p-3 font-bold">{money(Math.max(0,Number(d.montant_prise_en_charge)-Number(d.montant_rembourse||0)))}</td></tr>)}</tbody></table></div>:<p className="p-4 text-sm text-slate-500">Aucun dossier d’assurance enregistré.</p>}
   </section>
   <section className="overflow-hidden rounded-2xl bg-white">
    <div className="border-b p-4"><h2 className="font-extrabold">Journal des événements</h2><p className="text-xs text-slate-500">Historique horodaté des devis, contrôles, décisions et remboursements.</p></div>
    {events.length?<ol className="divide-y">{events.slice(0,100).map(e=><li key={e.id} className="flex flex-wrap items-center justify-between gap-2 p-3"><div><p className="font-semibold">{labels[e.type]||e.type}</p><p className="text-xs text-slate-500">{assureurs[e.assureur_id||""]||"Assureur"} · {new Date(e.created_at).toLocaleString("fr-FR")}</p></div><div className="text-right"><p className="font-bold">{e.montant_fcfa==null?"—":money(Number(e.montant_fcfa))}</p><p className="text-xs text-slate-500">{e.reference||e.reservation_id?.slice(0,8)||""}</p></div></li>)}</ol>:<p className="p-4 text-sm text-slate-500">Aucun événement enregistré.</p>}
   </section>
  </>}
 </main>;
}
