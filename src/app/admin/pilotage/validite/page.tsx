import { supabaseServer } from "@/lib/supabase/server";
import { reactiverPromoteur } from "./actions";

export default async function ValiditePage(){
 const sb=supabaseServer();
 const{data:u}=await sb.auth.getUser();
 if(!u.user)return null;
 const{data:p}=await sb.from("profiles").select("role").eq("id",u.user.id).single();
 if(p?.role!=="admin")return null;
 const{data,error}=await sb.rpc("validites_pharmacies_admin");
 const rows=(data||[]) as any[];
 return <main className="min-h-screen bg-[#ACDC76] p-3 sm:p-6"><div className="mx-auto max-w-7xl space-y-4">
  <header className="rounded-3xl bg-black p-5 text-white">
   <p className="text-xs uppercase tracking-[.2em] text-white/70">NAXA · Pilotage réseau</p>
   <h1 className="mt-1 text-2xl font-black text-[#D95304] sm:text-3xl">Validité des Promoteurs</h1>
   <p className="mt-2 text-sm text-white/80">Une convention, un tarif et un abonnement par Promoteur · rappel automatique à J-5 · blocage de toutes les pharmacies à échéance · réactivation administrative après règlement.</p>
  </header>
  {error&&<div className="rounded-3xl bg-white p-4 text-red-700">{error.message}</div>}
  <div className="grid gap-4">{rows.map(r=>{
   const overdue=r.statut==="impaye"||r.jours_restants<0;
   return <article key={r.promoteur_id} className="rounded-3xl bg-white p-5 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3">
     <div><h2 className="text-lg font-extrabold">{r.promoteur_nom||"Promoteur sans nom"}</h2><p className="text-sm text-slate-600">{r.pharmacies_count} pharmacie(s) · {r.pharmacies_noms}</p></div>
     <span className={`rounded-full px-3 py-1 text-xs font-bold ${overdue?"bg-red-100 text-red-800":"bg-naxa-canari text-naxa-green-900"}`}>{overdue?"IMPAYÉ":"VALIDE"}</span>
    </div>
    <div className="mt-4 grid gap-2 sm:grid-cols-4">
     <div><p className="text-xs text-slate-500">Paiement</p><p className="font-bold">{r.date_paiement||"Non configuré"}</p></div>
     <div><p className="text-xs text-slate-500">Échéance</p><p className="font-bold">{r.echeance||"Non configurée"}</p></div>
     <div><p className="text-xs text-slate-500">Tarif conventionné</p><p className="font-bold">{r.montant_mensuel?Number(r.montant_mensuel).toLocaleString("fr-FR")+" FCFA / mois":"Non configuré"}</p></div>
     <div><p className="text-xs text-slate-500">Jours restants</p><p className="font-bold">{r.echeance?Math.max(r.jours_restants,0):"—"}</p></div>
    </div>
    {overdue&&<form action={reactiverPromoteur} className="mt-4 flex flex-wrap gap-2">
      <input type="hidden" name="promoteur_id" value={r.promoteur_id}/>
      <input name="reference" placeholder="Référence du règlement (facultatif)" className="min-h-11 flex-1 rounded-full border px-4"/>
      <button className="min-h-11 rounded-full bg-[#0147BB] px-5 font-bold text-white">Règlement reçu · Réactiver</button>
    </form>}
   </article>
  })}</div>
 </div></main>;
}
