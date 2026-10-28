import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
type Row={id:string;pharmacie_id:string;montant:number;statut:string;created_at:string;date_remboursement:string|null;reservation_id:string|null;decided_at:string|null};
type Repayment={id:string;credit_id:string;pharmacie_id:string;montant:number;reference:string|null;motif:string|null;created_at:string};
const labels:Record<string,string>={en_attente:"En attente de décision",approuvee:"Crédit approuvé",rejetee:"Demande refusée"};
export default async function SuiviCreditMarketplacePage(){
 const sb=supabaseServer();const {data:auth}=await sb.auth.getUser();
 if(!auth.user)redirect("/connexion?retour=/achats/credit/suivi");
 const [{data,error},{data:repaymentData,error:repaymentError}]=await Promise.all([
  sb.from("client_credit_requests").select("id,pharmacie_id,montant,statut,created_at,date_remboursement,reservation_id,decided_at").eq("client_id",auth.user.id).eq("origine","marketplace").order("created_at",{ascending:false}).limit(50),
  sb.from("client_credit_operations").select("id,credit_id,pharmacie_id,montant,reference,motif,created_at").eq("client_id",auth.user.id).eq("nature","remboursement").order("created_at",{ascending:false}).limit(100)
 ]);
 const rows=(data??[]) as Row[];const repayments=(repaymentData??[]) as Repayment[];const ids=[...new Set([...rows.map(r=>r.pharmacie_id),...repayments.map(r=>r.pharmacie_id)])];
 const {data:pharmacies}=ids.length?await sb.from("pharmacies").select("id,nom").in("id",ids):{data:[] as {id:string;nom:string}[]};
 const names=new Map((pharmacies??[]).map(p=>[p.id,p.nom]));
 return <main className="mx-auto min-h-dvh max-w-lg space-y-4 px-4 py-6"><Link href="/achats/credit" className="text-sm font-semibold underline">Nouvelle demande</Link><header className="rounded-2xl bg-[#0B3D26] p-5 text-white"><h1 className="text-2xl font-black">Mes demandes de crédit</h1><p className="mt-2 text-sm text-white/85">Suivez la décision et la préparation de chaque demande.</p></header>
 {error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-900">Impossible de charger les demandes.</p>}
 {repaymentError&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-900">Les reçus de remboursement ne sont pas accessibles pour le moment.</p>}
 {!error&&!rows.length&&<p className="rounded-xl border bg-white p-4">Vous n’avez aucune demande de crédit Marketplace.</p>}
 {rows.map(r=><article key={r.id} className="space-y-2 rounded-2xl border bg-white p-4"><div className="flex items-start justify-between gap-3"><h2 className="font-black">Demande #{r.id.replace(/-/g,"").slice(0,8).toUpperCase()}</h2><span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-bold">{labels[r.statut]??r.statut}</span></div><p className="text-sm">Pharmacie : <strong>{names.get(r.pharmacie_id)??"Pharmacie"}</strong></p><p className="text-sm">Montant demandé : <strong>{Number(r.montant).toLocaleString("fr-FR")} FCFA</strong></p><p className="text-sm">Soumise le {new Date(r.created_at).toLocaleString("fr-FR")}</p><p className="text-sm">Remboursement prévu : <strong>{r.date_remboursement??"—"}</strong></p>{r.statut==="approuvee"&&<p className="text-sm text-emerald-900">Le stock a été réservé. La pharmacie prépare votre commande avant le retrait à la caisse.</p>}{r.statut==="rejetee"&&<p className="text-sm text-slate-700">Aucun stock n’a été réservé pour cette demande.</p>}{r.reservation_id&&<p className="break-all text-xs text-slate-600">Référence de préparation : {r.reservation_id}</p>}</article>)}
 <section className="space-y-3 pt-2">
  <header><h2 className="text-xl font-black">Mes reçus de remboursement</h2><p className="mt-1 text-sm text-slate-600">Chaque reçu correspond à une opération de remboursement enregistrée dans le journal de crédit.</p></header>
  {!repaymentError&&!repayments.length&&<p className="rounded-xl border bg-white p-4 text-sm">Aucun remboursement enregistré.</p>}
  {repayments.map(r=><article key={r.id} className="credit-repayment-receipt space-y-3 rounded-2xl border-2 border-dashed border-[#0B3D26] bg-white p-4 text-[#0B3D26]">
   <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-extrabold uppercase tracking-widest">NAXA · Reçu de remboursement</p><h3 className="text-lg font-black">{Number(r.montant).toLocaleString("fr-FR")} FCFA reçus</h3><p className="text-sm">{names.get(r.pharmacie_id)??"Pharmacie"}</p></div><button type="button" className="rounded-xl border px-3 py-2 text-sm font-bold print:hidden" onClick={()=>window.print()}>Imprimer</button></div>
   <dl className="grid gap-2 text-sm sm:grid-cols-2"><div><dt className="text-slate-500">Référence du reçu</dt><dd className="break-all font-mono font-bold">{r.id}</dd></div><div><dt className="text-slate-500">Date</dt><dd className="font-semibold">{new Date(r.created_at).toLocaleString("fr-FR")}</dd></div><div><dt className="text-slate-500">Référence de paiement</dt><dd className="break-all">{r.reference||"Non fournie"}</dd></div><div><dt className="text-slate-500">Mode / motif</dt><dd>{r.motif||"Non précisé"}</dd></div><div><dt className="text-slate-500">Crédit concerné</dt><dd className="break-all font-mono">{r.credit_id}</dd></div></dl>
   <p className="border-t border-dashed pt-2 text-xs text-slate-500">Reçu fondé sur l’opération enregistrée. Conservez cette référence pour toute réclamation.</p>
  </article>)}
 </section>
 <style jsx global>{`@media print { body * { visibility: hidden !important; } .credit-repayment-receipt, .credit-repayment-receipt * { visibility: visible !important; } .credit-repayment-receipt { position: relative; break-inside: avoid; margin-bottom: 12px; } }`}</style>
 </main>;
}
