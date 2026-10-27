import Link from "next/link";
import { requireAdminActive } from "@/lib/admin/require-admin-active";

export default async function ValiditePage(){
 const { sb } = await requireAdminActive("/admin/pilotage/validite");
 const{data,error}=await sb.rpc("validites_promoteurs_admin");
 const rows=(error ? [] : data ?? []) as any[];
 const enRetard=rows.filter(r=>r.statut==="impaye"||(r.jours_restants!=null&&Number(r.jours_restants)<0)).length;
 const echeancesConfigurees=rows.filter(r=>!!r.abonnement_id&&!!r.convention_id&&!!r.echeance&&!!r.montant_mensuel).length;
 const nonConfigurees=rows.filter(r=>!r.abonnement_id||!r.convention_id||!r.echeance||!r.montant_mensuel).length;
 const inactifs=rows.filter(r=>!r.promoteur_actif||r.statut==="resilie"||r.statut==="resiliee"||r.statut==="suspendu").length;
 const conventionsValides=rows.filter(r=>!!r.abonnement_id&&!!r.convention_id&&!!r.echeance&&!!r.montant_mensuel&&r.promoteur_actif===true&&r.statut==="actif"&&r.jours_restants!=null&&Number(r.jours_restants)>=0).length;
 return <main className="min-h-screen bg-[#ACDC76] p-3 sm:p-6"><div className="mx-auto max-w-7xl space-y-4">
  <header className="rounded-3xl bg-black p-5 text-white"><p className="text-xs uppercase tracking-[.2em] text-white/70">NAXA · Pilotage réseau</p><h1 className="mt-1 text-2xl font-black text-[#D95304] sm:text-3xl">Validité des Promoteurs</h1><p className="mt-2 text-sm text-white/80">Une convention, un tarif et un abonnement par Promoteur · rappel automatique à J-5. La réactivation exige un paiement confirmé après vérification de l’encaissement.</p><Link href="/admin/pilotage/reglements" className="mt-3 inline-block rounded-full bg-[#FAD405] px-4 py-2 text-sm font-bold text-black">Gérer les règlements manuels</Link></header>
  {error&&<div className="rounded-3xl bg-white p-4 text-red-700">{error.message}</div>}
  <div className="admin-team-layout"><div className="admin-team-main"><div className="grid gap-4">{error ? <p role="status" className="rounded-2xl bg-white p-4 text-amber-900">Les indicateurs de validité sont indisponibles. Les compteurs et les dossiers ne sont pas calculés comme s’il s’agissait de zéros. Réessayez lorsque le service sera rétabli.</p> : rows.map(r=>{
   const overdue=r.statut==="impaye"||(r.jours_restants!=null&&Number(r.jours_restants)<0);
   const unconfigured=!r.abonnement_id||!r.convention_id||!r.echeance||!r.montant_mensuel;
   const inactive=r.promoteur_actif!==true||r.statut==="resilie"||r.statut==="resiliee"||r.statut==="suspendu";
   const valid=!unconfigured&&!inactive&&r.statut==="actif"&&r.jours_restants!=null&&Number(r.jours_restants)>=0;
   const badge=inactive?{label:"SUSPENDU / INACTIF",style:"bg-slate-200 text-slate-800"}:unconfigured?{label:"NON CONFIGURÉ",style:"bg-orange-100 text-orange-900"}:overdue?{label:"À RÉGULARISER",style:"bg-red-100 text-red-800"}:valid?{label:"VALIDE",style:"bg-naxa-canari text-naxa-green-900"}:{label:"À VÉRIFIER",style:"bg-orange-100 text-orange-900"};
   return <article key={r.promoteur_id} className="min-w-0 rounded-3xl bg-white p-4 shadow-sm sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h2 className="break-words text-lg font-extrabold">{r.promoteur_nom||"Promoteur sans nom"}</h2><p className="break-words text-sm text-slate-600">{r.pharmacies_count} pharmacie(s) · {r.pharmacies_noms}</p></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${badge.style}`}>{badge.label}</span></div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div><p className="text-xs text-slate-500">Date enregistrée comme paiement</p><p className="break-words font-bold">{r.date_paiement||"Non renseignée"}</p></div><div><p className="text-xs text-slate-500">Échéance actuelle</p><p className="font-bold">{r.echeance||"Non configurée"}</p></div><div><p className="text-xs text-slate-500">Tarif conventionné</p><p className="font-bold">{r.montant_mensuel?Number(r.montant_mensuel).toLocaleString("fr-FR")+" FCFA / mois":"Non configuré"}</p></div><div><p className="text-xs text-slate-500">Jours restants</p><p className="font-bold">{r.echeance?Math.max(Number(r.jours_restants ?? 0),0):"—"}</p></div></div>
   </article>
  })}</div></div><aside className="admin-team-aside" aria-label="Synthèse des conventions">{error ? <section className="admin-team-summary"><p>Indicateurs indisponibles</p><strong>—</strong><small>Aucun total présenté comme fiable tant que la source est en erreur.</small></section> : <><section className="admin-team-summary"><p>Promoteurs suivis</p><strong>{rows.length}</strong><small>Selon les données retournées par le service administratif</small></section><section className="admin-team-summary is-attention"><p>À régulariser</p><strong>{enRetard}</strong><small>Échéance dépassée ou statut impayé</small></section><section className="admin-team-summary"><p>Échéances configurées</p><strong>{echeancesConfigurees}</strong><small>Sur {rows.length} promoteur(s)</small></section><section className="admin-team-summary"><p>Conventions valides et actives</p><strong>{conventionsValides}</strong><small>Échéance configurée, Promoteur actif et abonnement actif</small></section><section className="admin-team-summary"><p>Dossiers non configurés</p><strong>{nonConfigurees}</strong><small>Abonnement, convention, tarif ou échéance manquant</small></section><section className="admin-team-summary"><p>Profils inactifs / résiliés</p><strong>{inactifs}</strong><small>À examiner séparément d’un paiement</small></section></>}</aside></div>
 </div></main>;
}
