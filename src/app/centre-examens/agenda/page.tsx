import { getExamUserContext, requireExamCapability, examRoleHas } from "@/lib/examens/access";
import { transitionExamAppointment } from "../actions";

const fmt=(v:string|null)=>v?new Intl.DateTimeFormat("fr-FR",{dateStyle:"medium",timeStyle:"short"}).format(new Date(v)):"Horaire indisponible";
const statusLabel:Record<string,string>={booked:"Réservé",confirmed:"Confirmé",completed:"Réalisé",cancelled:"Annulé",expired:"Expiré"};

export default async function AgendaExamensPage({searchParams}:{searchParams:{centre?:string}}){
  const context=await getExamUserContext();
  const centerId=searchParams.centre||context.activeAssignments[0]?.center_id||"";
  const {sb,assignment}=await requireExamCapability(centerId,"appointments_read");
  const {data:appointments,error}=await sb.from("exam_appointments")
    .select("id,item_name,price_fcfa,status,ticket_code,client_note,created_at,exam_slots(starts_at,ends_at)")
    .eq("center_id",centerId).order("created_at",{ascending:false}).limit(300);
  const canManage=examRoleHas(assignment.role_key,"appointments_manage");
  return <div className="space-y-4">
    <header><p className="text-xs font-bold uppercase tracking-widest text-blue-700">Opérations quotidiennes</p><h2 className="mt-1 text-2xl font-black">Agenda et admissions</h2><p className="mt-1 text-sm text-slate-600">Le ticket conserve son code et sa capacité est libérée uniquement lors d’une annulation validée côté serveur.</p></header>
    {error&&<p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">La liste des rendez-vous est indisponible pour cette session.</p>}
    {!appointments?.length?<section className="rounded-2xl border bg-white p-6 text-sm text-slate-600">Aucun rendez-vous enregistré dans ce centre.</section>:<div className="space-y-3">{appointments.map((a:any)=>{
      const slot=Array.isArray(a.exam_slots)?a.exam_slots[0]:a.exam_slots;
      return <article key={a.id} className="rounded-2xl border bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-extrabold">{a.item_name}</h3><p className="mt-1 text-sm text-slate-600">{fmt(slot?.starts_at??a.created_at)}{slot?.ends_at?" – "+fmt(slot.ends_at):""}</p><p className="mt-1 text-xs text-slate-500">Ticket {a.ticket_code} · {Number(a.price_fcfa).toLocaleString("fr-FR")} FCFA</p></div><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-900">{statusLabel[a.status]??a.status}</span></div>
        {a.client_note&&<p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">Note du client : {a.client_note}</p>}
        {canManage&&a.status==="booked"&&<div className="mt-3 flex flex-wrap gap-2">{["confirmed","cancelled"].map(next=><form key={next} action={transitionExamAppointment}><input type="hidden" name="center_id" value={centerId}/><input type="hidden" name="appointment_id" value={a.id}/><input type="hidden" name="next_status" value={next}/><button className={next==="confirmed"?"min-h-10 rounded-lg bg-emerald-700 px-3 text-sm font-bold text-white":"min-h-10 rounded-lg border border-red-200 px-3 text-sm font-bold text-red-700"}>{next==="confirmed"?"Confirmer":"Annuler"}</button></form>)}</div>}
        {canManage&&a.status==="confirmed"&&<div className="mt-3 flex flex-wrap gap-2"><form action={transitionExamAppointment}><input type="hidden" name="center_id" value={centerId}/><input type="hidden" name="appointment_id" value={a.id}/><input type="hidden" name="next_status" value="completed"/><button className="min-h-10 rounded-lg bg-blue-800 px-3 text-sm font-bold text-white">Marquer réalisé</button></form><form action={transitionExamAppointment}><input type="hidden" name="center_id" value={centerId}/><input type="hidden" name="appointment_id" value={a.id}/><input type="hidden" name="next_status" value="cancelled"/><button className="min-h-10 rounded-lg border border-red-200 px-3 text-sm font-bold text-red-700">Annuler</button></form></div>}
      </article>;
    })}</div>}
  </div>;
}
