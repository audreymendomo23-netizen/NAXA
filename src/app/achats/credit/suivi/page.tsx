import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
type Row={id:string;pharmacie_id:string;montant:number;statut:string;created_at:string;date_remboursement:string|null;reservation_id:string|null;decided_at:string|null};
const labels:Record<string,string>={en_attente:"En attente de décision",approuvee:"Crédit approuvé",rejetee:"Demande refusée"};
export default async function SuiviCreditMarketplacePage(){
 const sb=supabaseServer();const {data:auth}=await sb.auth.getUser();
 if(!auth.user)redirect("/connexion?retour=/achats/credit/suivi");
 const {data,error}=await sb.from("client_credit_requests").select("id,pharmacie_id,montant,statut,created_at,date_remboursement,reservation_id,decided_at").eq("client_id",auth.user.id).eq("origine","marketplace").order("created_at",{ascending:false}).limit(50);
 const rows=(data??[]) as Row[];const ids=[...new Set(rows.map(r=>r.pharmacie_id))];
 const {data:pharmacies}=ids.length?await sb.from("pharmacies").select("id,nom").in("id",ids):{data:[] as {id:string;nom:string}[]};
 const names=new Map((pharmacies??[]).map(p=>[p.id,p.nom]));
 return <main className="mx-auto min-h-dvh max-w-lg space-y-4 px-4 py-6"><Link href="/achats/credit" className="text-sm font-semibold underline">Nouvelle demande</Link><header className="rounded-2xl bg-[#0B3D26] p-5 text-white"><h1 className="text-2xl font-black">Mes demandes de crédit</h1><p className="mt-2 text-sm text-white/85">Suivez la décision et la préparation de chaque demande.</p></header>
 {error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-900">Impossible de charger l’historique.</p>}
 {!error&&!rows.length&&<p className="rounded-xl border bg-white p-4">Vous n’avez aucune demande de crédit Marketplace.</p>}
 {rows.map(r=><article key={r.id} className="space-y-2 rounded-2xl border bg-white p-4"><div className="flex items-start justify-between gap-3"><h2 className="font-black">Demande #{r.id.replace(/-/g,"").slice(0,8).toUpperCase()}</h2><span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-bold">{labels[r.statut]??r.statut}</span></div><p className="text-sm">Pharmacie : <strong>{names.get(r.pharmacie_id)??"Pharmacie"}</strong></p><p className="text-sm">Montant demandé : <strong>{Number(r.montant).toLocaleString("fr-FR")} FCFA</strong></p><p className="text-sm">Soumise le {new Date(r.created_at).toLocaleString("fr-FR")}</p><p className="text-sm">Remboursement prévu : <strong>{r.date_remboursement??"—"}</strong></p>{r.statut==="approuvee"&&<p className="text-sm text-emerald-900">Le stock a été réservé. La pharmacie prépare votre commande avant le retrait à la caisse.</p>}{r.statut==="rejetee"&&<p className="text-sm text-slate-700">Aucun stock n’a été réservé pour cette demande.</p>}{r.reservation_id&&<p className="break-all text-xs text-slate-600">Référence de préparation : {r.reservation_id}</p>}</article>)}
 </main>;
}
