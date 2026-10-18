import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { supabaseServer } from "@/lib/supabase/server";
import { transitionReservationPartenaire } from "./actions";
const labels:Record<string,string>={requested:"Demandée",confirmed:"Confirmée",ready:"Prête au retrait",picked_up:"Retirée",cancelled:"Annulée",expired:"Expirée"};
const buttons:Record<string,string>={confirmed:"Confirmer",ready:"Marquer prête au retrait",picked_up:"Confirmer le retrait"};
const next:Record<string,string[]>={requested:["confirmed","ready"],confirmed:["ready"],ready:["picked_up"]};
const effectiveStatus=(r:any)=>["requested","confirmed","ready"].includes(r.status)&&new Date(r.expires_at).getTime()<=Date.now()?"expired":r.status;
export default async function ReservationsPartenaire({searchParams}:{searchParams:{ok?:string;erreur?:string;q?:string;statut?:string;univers?:string}}){
 const sb=supabaseServer();const {data:auth}=await sb.auth.getUser();if(!auth.user)redirect("/connexion?retour=/partenaire/reservations");
 const {data:members,error:me}=await sb.from("partner_members").select("partner_id,member_role,partners!inner(id,name,status,partner_type)").eq("user_id",auth.user.id).in("member_role",["owner","manager","operator"]);
 if(me||!members?.length)redirect("/");
 const active=(members as any[]).filter(m=>m.partners?.status==="active");const ids=active.map(m=>m.partner_id);if(!ids.length)redirect("/");
 const {data,error}=await sb.from("universe_reservations").select("id,partner_id,universe_slug,status,total_fcfa,pickup_code,expires_at,created_at,client_note,universe_reservation_items(id,product_name,quantity,line_total_fcfa)").in("partner_id",ids).order("created_at",{ascending:false}).limit(100);
 const allReservations=data??[];
 const query=(searchParams.q??"").trim().toLocaleLowerCase("fr");
 const statusFilter=searchParams.statut??"";
 const universeFilter=searchParams.univers??"";
 const reservations=allReservations.filter((r:any)=>{
   const partnerName=active.find((m:any)=>m.partner_id===r.partner_id)?.partners?.name??"";
   const status=effectiveStatus(r);
   const universe=r.universe_slug==="bebe-maman"?"bebe-maman":"parapharmacie";
   const haystack=[partnerName,r.client_note??"",...(r.universe_reservation_items??[]).map((i:any)=>i.product_name??"")].join(" ").toLocaleLowerCase("fr");
   return (!query||haystack.includes(query))&&(!statusFilter||status===statusFilter)&&(!universeFilter||universe===universeFilter);
 });
 return <main className="min-h-screen bg-[#F8FAF9] px-4 pb-12 text-slate-900"><div className="mx-auto max-w-5xl space-y-5 pt-4">
 <header className="flex items-center justify-between gap-3 rounded-2xl bg-[#064B2A] px-4 py-3 text-white"><Logo taille={32}/><nav className="flex flex-wrap gap-3 text-sm font-bold"><Link href="/partenaire/catalogue" className="underline">Catalogue et stocks</Link>{active.some((m:any)=>m.partners?.partner_type==="professionnel_domicile")&&<Link href="/partenaire/prestations" className="underline">Prestations</Link>}</nav></header>
 <div><p className="text-xs font-extrabold uppercase tracking-widest text-teal-800">NAXA · Espace partenaire</p><h1 className="mt-1 text-3xl font-black">Réservations à traiter</h1><p className="mt-2 text-sm text-slate-600">Le stock physique est décrémenté uniquement au retrait confirmé. Vérifie le code en présence du client.</p></div>
 {searchParams.ok&&<p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">Mise à jour effectuée : {labels[searchParams.ok]??searchParams.ok}.</p>}
 {searchParams.erreur&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-900">Action refusée. Vérifie les droits et l’état actuel de la réservation.</p>}
 <form method="get" className="rounded-2xl border bg-white p-4 shadow-sm"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><label className="text-sm font-bold">Rechercher<input name="q" type="search" defaultValue={searchParams.q??""} placeholder="Produit, partenaire, note…" className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal"/></label><label className="text-sm font-bold">Statut<select name="statut" defaultValue={statusFilter} className="mt-1 min-h-11 w-full rounded-xl border bg-white px-3 font-normal"><option value="">Tous les statuts</option><option value="requested">Demandée</option><option value="confirmed">Confirmée</option><option value="ready">Prête au retrait</option><option value="picked_up">Retirée</option><option value="cancelled">Annulée</option><option value="expired">Expirée</option></select></label><label className="text-sm font-bold">Univers<select name="univers" defaultValue={universeFilter} className="mt-1 min-h-11 w-full rounded-xl border bg-white px-3 font-normal"><option value="">Tous les univers</option><option value="parapharmacie">Parapharmacie</option><option value="bebe-maman">Bébé &amp; Maman</option></select></label></div><div className="mt-3 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-600">{reservations.length} réservation(s) affichée(s) sur {allReservations.length} chargée(s).</p><div className="flex gap-2"><Link href="/partenaire/reservations" className="inline-flex min-h-11 items-center rounded-xl border px-4 text-sm font-bold">Effacer</Link><button className="min-h-11 rounded-xl bg-[#064B2A] px-4 font-bold text-white">Filtrer</button></div></div></form>
 {error&&<p role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950">Réservations indisponibles : vérifie les migrations 098 à 105 dans l’environnement de test.</p>}
 {!reservations.length&&!error&&<p className="rounded-xl border bg-white p-5 text-sm text-slate-600">{allReservations.length?"Aucune réservation ne correspond aux filtres. Efface les filtres pour tout afficher.":"Aucune réservation pour tes établissements actifs."}</p>}
 <div className="space-y-4">{reservations.map((r:any)=><article key={r.id} className="rounded-2xl border bg-white p-5 shadow-sm">
 <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{active.find((m:any)=>m.partner_id===r.partner_id)?.partners?.name} · {r.universe_slug==="bebe-maman"?"Bébé & Maman":"Parapharmacie"}</p><h2 className="mt-1 text-lg font-extrabold">{labels[effectiveStatus(r)]??effectiveStatus(r)}</h2><p className="mt-1 text-sm text-slate-600">Créée le {new Date(r.created_at).toLocaleString("fr-FR")} · expiration {new Date(r.expires_at).toLocaleString("fr-FR")}</p></div><div className="rounded-xl bg-teal-50 px-4 py-3 text-right"><p className="text-xs font-bold text-teal-900">Code de retrait</p><p className="font-mono text-2xl font-black tracking-widest text-teal-950">{r.pickup_code}</p></div></div>
 <ul className="mt-4 space-y-2">{(r.universe_reservation_items??[]).map((i:any)=><li key={i.id} className="flex justify-between gap-3 border-b pb-2 text-sm"><span>{i.product_name} × {i.quantity}</span><strong>{Number(i.line_total_fcfa).toLocaleString("fr-FR")} FCFA</strong></li>)}</ul>
 <p className="mt-3 text-right text-base font-black">{Number(r.total_fcfa).toLocaleString("fr-FR")} FCFA</p>{r.client_note&&<p className="mt-2 rounded-lg bg-slate-50 p-3 text-sm">Note client : {r.client_note}</p>}
 {(next[effectiveStatus(r)]??[]).map(s=><form key={s} action={transitionReservationPartenaire} className="mt-3 inline-block mr-2"><input type="hidden" name="reservation_id" value={r.id}/><input type="hidden" name="status" value={s}/><button className="min-h-11 rounded-xl bg-[#064B2A] px-4 py-2 text-sm font-bold text-white">{buttons[s]}</button></form>)}
 </article>)}</div></div></main>;
}
