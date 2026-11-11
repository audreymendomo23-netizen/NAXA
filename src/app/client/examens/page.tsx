import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { createClientExamConversation, sendClientExamMessage } from "./actions";

const status:Record<string,string>={booked:"Réservé",confirmed:"Confirmé",completed:"Réalisé",cancelled:"Annulé",expired:"Expiré",draft:"Brouillon",validated:"Validé",published:"Publié",withdrawn:"Retiré"};
const money=(n:number)=>Number(n||0).toLocaleString("fr-FR")+" FCFA";

export default async function ClientExamensPage({searchParams}:{searchParams:{conversation?:string;ok?:string;erreur?:string}}){
  const sb=supabaseServer();
  const {data:auth}=await sb.auth.getUser();
  if(!auth.user) redirect("/connexion?retour=%2Fclient%2Fexamens");
  const userId=auth.user.id;
  const [{data:appointments,error:appointmentError},{data:results,error:resultError},{data:notifications}]=await Promise.all([
    sb.from("exam_appointments").select("id,center_id,item_name,price_fcfa,status,ticket_code,created_at,exam_centers(display_name,address_label,phone_public),exam_slots(starts_at,ends_at)").eq("client_id",userId).order("created_at",{ascending:false}).limit(100),
    sb.from("exam_results").select("id,appointment_id,center_id,title,status,published_at,created_at").eq("client_id",userId).eq("status","published").order("published_at",{ascending:false}).limit(100),
    sb.from("exam_notifications").select("id,title,body,read_at,created_at").eq("user_id",userId).order("created_at",{ascending:false}).limit(100)
  ]);
  const resultIds=(results??[]).map((r:any)=>r.id);
  const [{data:contents},{data:files}]=resultIds.length?await Promise.all([
    sb.from("exam_result_contents").select("result_id,report_text,conclusion,methodology").in("result_id",resultIds),
    sb.from("exam_result_files").select("id,result_id,file_name,content_type,size_bytes").in("result_id",resultIds)
  ]):[{data:[] as any[]},{data:[] as any[]}];
  const {data:threads,error:threadError}=await sb.from("exam_conversations")
    .select("id,center_id,appointment_id,subject,status,created_at,exam_centers(display_name),exam_appointments(item_name,ticket_code)")
    .eq("client_id",userId).order("updated_at",{ascending:false}).limit(100);
  const conversationId=searchParams.conversation;
  const selected=(threads??[]).find((t:any)=>t.id===conversationId)??(threads??[])[0];
  const {data:messages}=selected?await sb.from("exam_messages").select("id,sender_id,body,read_at,created_at")
    .eq("conversation_id",selected.id).order("created_at",{ascending:true}).limit(300):{data:[] as any[]};
  const contentById=new Map((contents??[]).map((c:any)=>[c.result_id,c]));
  const filesById=new Map<string,any[]>();
  for(const file of files??[]){const arr=filesById.get(file.result_id)??[];arr.push(file);filesById.set(file.result_id,arr);}
  return <main className="min-h-screen bg-[#F7F8FC] px-4 pb-20 text-slate-900"><div className="mx-auto max-w-5xl space-y-5 pt-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-violet-800">NAXA · Espace client</p><h1 className="mt-1 text-2xl font-black">Mes examens</h1><p className="mt-1 text-sm text-slate-600">Tickets, résultats publiés et échanges avec les centres.</p></div><Link href="/examens" className="rounded-xl bg-violet-800 px-4 py-3 text-sm font-bold text-white">Réserver un examen</Link></div>
    {searchParams.erreur&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">Action impossible. Vérifiez votre rendez-vous et réessayez.</p>}
    <section className="rounded-2xl border bg-white p-5"><div className="flex flex-wrap justify-between gap-2"><h2 className="text-lg font-extrabold">Mes tickets et rendez-vous</h2><span className="text-xs text-slate-500">{appointments?.length??0} réservation(s)</span></div>
      {appointmentError&&<p role="alert" className="mt-3 text-sm text-amber-800">Le service de réservation est momentanément indisponible.</p>}
      {!appointments?.length?<p className="mt-3 text-sm text-slate-500">Aucun ticket enregistré. <Link href="/examens" className="font-bold text-violet-800 underline">Découvrir les centres</Link>.</p>:<div className="mt-3 space-y-3">{appointments.map((a:any)=>{const slot=Array.isArray(a.exam_slots)?a.exam_slots[0]:a.exam_slots;const center=Array.isArray(a.exam_centers)?a.exam_centers[0]:a.exam_centers;const thread=(threads??[]).find((t:any)=>t.appointment_id===a.id&&t.status==="open");return <article key={a.id} className="rounded-xl border border-violet-100 p-4"><div className="flex flex-wrap justify-between gap-2"><div><h3 className="font-bold">{a.item_name}</h3><p className="mt-1 text-sm text-slate-600">{center?.display_name??"Centre d’examens"}</p><p className="mt-1 text-xs text-slate-500">{slot?.starts_at?new Date(slot.starts_at).toLocaleString("fr-FR"):"Horaire indisponible"} · {center?.address_label??""}</p></div><span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-900">{status[a.status]??a.status}</span></div><div className="mt-3 flex flex-wrap items-end justify-between gap-3 border-t pt-3"><div><p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Code du ticket</p><p className="font-mono text-xl font-black tracking-widest text-violet-900">{a.ticket_code}</p></div><strong>{money(a.price_fcfa)}</strong></div><div className="mt-3 flex flex-wrap gap-2">{center?.phone_public&&<a href={"tel:"+center.phone_public} className="rounded-lg border px-3 py-2 text-sm font-bold text-violet-800">Appeler le centre</a>}{thread?<Link href={"/client/examens?conversation="+thread.id} className="rounded-lg border px-3 py-2 text-sm font-bold">Ouvrir la conversation</Link>:a.status!=="cancelled"&&a.status!=="expired"&&<form action={createClientExamConversation} className="flex flex-wrap gap-2"><input type="hidden" name="appointment_id" value={a.id}/><input name="subject" required maxLength={180} defaultValue={"Question · "+a.item_name} className="min-h-9 max-w-48 rounded-lg border px-2 text-xs"/><button className="min-h-9 rounded-lg border px-3 text-xs font-bold">Contacter le centre</button></form>}</div></article>})}</div>}
      <p className="mt-3 text-xs text-slate-500">Le règlement s’effectue directement auprès du centre. NAXA ne collecte pas ce paiement.</p>
    </section>
    <section className="rounded-2xl border bg-white p-5"><div className="flex flex-wrap justify-between gap-2"><h2 className="text-lg font-extrabold">Mes résultats médicaux</h2><span className="text-xs text-slate-500">{results?.length??0} résultat(s) publié(s)</span></div>
      {resultError&&<p role="alert" className="mt-3 text-sm text-amber-800">Le registre des résultats est temporairement indisponible.</p>}
      {!results?.length?<p className="mt-3 text-sm text-slate-500">Aucun résultat n’a été publié pour le moment. Un compte rendu validé par le professionnel du centre apparaîtra ici.</p>:<div className="mt-3 space-y-3">{results.map((r:any)=>{const body=contentById.get(r.id);return <article key={r.id} className="rounded-xl border p-4"><div className="flex flex-wrap justify-between gap-2"><h3 className="font-bold">{r.title}</h3><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">Publié</span></div><p className="mt-1 text-xs text-slate-500">{r.published_at?new Date(r.published_at).toLocaleString("fr-FR"):"Date indisponible"}</p>{body&&<div className="mt-3 rounded-lg bg-slate-50 p-3"><h4 className="text-xs font-bold uppercase text-slate-500">Compte rendu</h4><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{body.report_text}</p>{body.conclusion&&<p className="mt-3 border-t pt-3 text-sm font-semibold">Conclusion : {body.conclusion}</p>}</div>}{(filesById.get(r.id)??[]).map((f:any)=><p key={f.id} className="mt-3 text-sm"><Link className="font-bold text-violet-800 underline" href={"/api/examens/result-file/"+f.id}>{f.file_name}</Link> · {Math.ceil(f.size_bytes/1024)} Ko</p>)}</article>})}</div>}
    </section>
    <section className="rounded-2xl border bg-white p-5"><div className="flex flex-wrap justify-between gap-2"><h2 className="text-lg font-extrabold">Messages avec les centres</h2><span className="text-xs text-slate-500">{threads?.length??0} conversation(s)</span></div>
      {threadError&&<p className="mt-2 text-sm text-amber-800">Messagerie indisponible.</p>}
      {!threads?.length?<p className="mt-3 text-sm text-slate-500">Aucune conversation pour le moment.</p>:<><div className="mt-3 flex flex-wrap gap-2">{threads.map((t:any)=><Link key={t.id} href={"/client/examens?conversation="+t.id} className={"rounded-full border px-3 py-2 text-xs font-bold "+(selected?.id===t.id?"border-violet-800 bg-violet-50 text-violet-900":"border-slate-200")}>{t.subject}</Link>)}</div>{selected&&<div className="mt-3 rounded-xl border p-3"><div className="max-h-72 space-y-2 overflow-y-auto">{(messages??[]).map((m:any)=><article key={m.id} className={"rounded-lg p-3 "+(m.sender_id===userId?"ml-6 bg-violet-50":"mr-6 bg-slate-50")}><p className="whitespace-pre-wrap text-sm">{m.body}</p><p className="mt-1 text-[11px] text-slate-400">{new Date(m.created_at).toLocaleString("fr-FR")}{m.sender_id===userId?" · Vous":" · Centre"}</p></article>)}</div>{selected.status==="open"&&<form action={sendClientExamMessage} className="mt-3 flex flex-col gap-2 sm:flex-row"><input type="hidden" name="conversation_id" value={selected.id}/><input name="body" required maxLength={5000} placeholder="Votre message…" className="min-h-11 min-w-0 flex-1 rounded-lg border px-3"/><button className="min-h-11 rounded-lg bg-violet-800 px-4 font-bold text-white">Envoyer</button></form>}</div>}</>}
    </section>
    <section className="rounded-2xl border bg-white p-5"><h2 className="text-lg font-extrabold">Notifications examens</h2>{!notifications?.length?<p className="mt-2 text-sm text-slate-500">Aucune notification.</p>:<ul className="mt-3 space-y-2">{notifications.map((n:any)=><li key={n.id} className="rounded-lg bg-slate-50 p-3"><p className="font-bold">{n.title}</p><p className="mt-1 text-sm">{n.body}</p><p className="mt-1 text-xs text-slate-400">{new Date(n.created_at).toLocaleString("fr-FR")}</p></li>)}</ul>}</section>
    <p className="text-xs text-slate-500">Les résultats affichés ont été validés puis publiés par le centre. Seules les pièces et données publiées sont accessibles dans cet espace.</p>
  </div></main>;
}
