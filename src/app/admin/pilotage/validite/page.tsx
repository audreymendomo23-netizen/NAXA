import { supabaseServer } from "@/lib/supabase/server";
import { reactiverPromoteur } from "./actions";

type Props = { searchParams?: { ok?: string; erreur?: string } };
export default async function ValiditePage({searchParams}:Props){
 const sb=supabaseServer();
 const{data:u}=await sb.auth.getUser();
 if(!u.user)return null;
 const{data:p}=await sb.from("profiles").select("role,actif").eq("id",u.user.id).single();
 if(p?.role!=="admin" || p.actif!==true)return null;
 const{data,error}=await sb.rpc("validites_promoteurs_admin");
 const rows=(data||[]) as any[];
 const enRetard=rows.filter(r=>r.statut==="impaye"||r.jours_restants<0).length;
 const echeancesConfigurees=rows.filter(r=>!!r.echeance).length;
 const conventionsValides=rows.length-enRetard;
 return <main className="min-h-screen bg-[#ACDC76] p-3 sm:p-6"><div className="mx-auto max-w-7xl space-y-4">
  <header className="rounded-3xl bg-black p-5 text-white"><p className="text-xs uppercase tracking-[.2em] text-white/70">NAXA · Pilotage réseau</p><h1 className="mt-1 text-2xl font-black text-[#D95304] sm:text-3xl">Validité des Promoteurs</h1><p className="mt-2 text-sm text-white/80">Une convention, un tarif et un abonnement par Promoteur · rappel automatique à J-5. Le renouvellement administratif ne certifie pas un paiement.</p></header>
  {searchParams?.ok==="renouvellement"&&<p role="status" className="rounded-2xl bg-white p-4 text-green-800">Échéance mise à jour et opération journalisée.</p>}
  {searchParams?.erreur&&<p role="alert" className="break-words rounded-2xl bg-white p-4 text-red-700">{searchParams.erreur==="champs"?"Renseignez une échéance future et un motif d’au moins 5 caractères.":searchParams.erreur}</p>}
  {error&&<div className="rounded-3xl bg-white p-4 text-red-700">{error.message}</div>}
  <div className="admin-team-layout"><div className="admin-team-main"><div className="grid gap-4">{rows.map(r=>{
   const overdue=r.statut==="impaye"||r.jours_restants<0;
   return <article key={r.promoteur_id} className="min-w-0 rounded-3xl bg-white p-4 shadow-sm sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h2 className="break-words text-lg font-extrabold">{r.promoteur_nom||"Promoteur sans nom"}</h2><p className="break-words text-sm text-slate-600">{r.pharmacies_count} pharmacie(s) · {r.pharmacies_noms}</p></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${overdue?"bg-red-100 text-red-800":"bg-naxa-canari text-naxa-green-900"}`}>{overdue?"À RÉGULARISER":"VALIDE"}</span></div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div><p className="text-xs text-slate-500">Date enregistrée comme paiement</p><p className="break-words font-bold">{r.date_paiement||"Non renseignée"}</p></div><div><p className="text-xs text-slate-500">Échéance actuelle</p><p className="font-bold">{r.echeance||"Non configurée"}</p></div><div><p className="text-xs text-slate-500">Tarif conventionné</p><p className="font-bold">{r.montant_mensuel?Number(r.montant_mensuel).toLocaleString("fr-FR")+" FCFA / mois":"Non configuré"}</p></div><div><p className="text-xs text-slate-500">Jours restants</p><p className="font-bold">{r.echeance?Math.max(r.jours_restants,0):"—"}</p></div></div>
    {overdue&&<form action={reactiverPromoteur} className="mt-4 grid min-w-0 gap-3 rounded-2xl border border-slate-200 p-3 sm:p-4"><input type="hidden" name="promoteur_id" value={r.promoteur_id}/><label className="grid gap-1 text-sm font-semibold">Nouvelle date d’échéance<input required type="date" name="echeance" min={new Date().toISOString().slice(0,10)} className="min-h-11 min-w-0 rounded-xl border border-slate-300 px-3 font-normal"/></label><label className="grid gap-1 text-sm font-semibold">Motif administratif<textarea required minLength={5} maxLength={500} name="motif" placeholder="Motif de la décision (ne vaut pas preuve de paiement)" className="min-h-20 min-w-0 rounded-xl border border-slate-300 px-3 py-2 font-normal"/></label><button className="min-h-11 w-full rounded-full bg-[#0147BB] px-5 font-bold text-white sm:w-fit">Enregistrer l’échéance et journaliser</button></form>}
   </article>
  })}</div></div><aside className="admin-team-aside" aria-label="Synthèse des conventions"><section className="admin-team-summary"><p>Promoteurs suivis</p><strong>{rows.length}</strong><small>Selon les données retournées par le service administratif</small></section><section className="admin-team-summary is-attention"><p>À régulariser</p><strong>{enRetard}</strong><small>Échéance dépassée ou statut impayé</small></section><section className="admin-team-summary"><p>Échéances configurées</p><strong>{echeancesConfigurees}</strong><small>Sur {rows.length} promoteur(s)</small></section><section className="admin-team-summary"><p>Conventions non signalées en retard</p><strong>{conventionsValides}</strong><small>Ne remplace pas la vérification du règlement</small></section></aside></div>
 </div></main>;
}
