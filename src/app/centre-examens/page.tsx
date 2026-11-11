import Link from "next/link";
import { getExamUserContext, EXAM_ROLE_LABELS, examRoleHas } from "@/lib/examens/access";

export default async function CentreExamensHome({searchParams}:{searchParams:{centre?:string}}){
  const {sb,assignments,activeAssignments}=await getExamUserContext();
  const centerIds=[...new Set(assignments.map(a=>a.center_id))];
  const {data:centers}=await sb.from("exam_centers").select("id,display_name,address_label,city,status").in("id",centerIds);
  const selectedId=searchParams.centre||activeAssignments[0]?.center_id||centerIds[0];
  const selected=assignments.find(a=>a.center_id===selectedId&&a.active_role);
  const center=(centers??[]).find(c=>c.id===selectedId);
  const modules=[
    ["agenda","Agenda","appointments_read","/centre-examens/agenda"],
    ["personnel","Personnel","staff_manage","/centre-examens/personnel"],
    ["resultats","Résultats","results_draft","/centre-examens/resultats"],
    ["equipements","Équipements","equipment_read","/centre-examens/equipements"],
    ["comptabilite","Comptabilité","finance_read","/centre-examens/comptabilite"],
    ["securite","Sécurité","incident_report","/centre-examens/securite"],
    ["messages","Messagerie","communications_read","/centre-examens/messages"],
    ["ia","Actions IA","ai_use","/centre-examens/ia"]
  ] as const;
  let metrics:{total:number;booked:number;confirmed:number;completed:number}|null=null;
  if(selected&&examRoleHas(selected.role_key,"appointments_read")){
    const {data:rows}=await sb.from("exam_appointments").select("id,status").eq("center_id",selectedId).limit(1000);
    const all=rows??[];
    metrics={total:all.length,booked:all.filter(x=>x.status==="booked").length,confirmed:all.filter(x=>x.status==="confirmed").length,completed:all.filter(x=>x.status==="completed").length};
  }
  return <div className="space-y-5">
    <section className="rounded-3xl bg-gradient-to-br from-[#172554] to-[#334A86] p-6 text-white shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[.18em] text-blue-200">Pilotage du centre</p>
      <h2 className="mt-2 text-2xl font-black">Bonjour, votre activité est centralisée ici.</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100">Rendez-vous, comptes rendus, équipements, sécurité, caisse et communication partagent le même périmètre de centre et des habilitations indépendantes de l’ERP Pharmacie.</p>
      <div className="mt-4 flex flex-wrap gap-2"><span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold">{selected?EXAM_ROLE_LABELS[selected.role_key]:"Aucun poste actif"}</span><span className="rounded-full bg-white/15 px-3 py-1 text-xs">Données du centre uniquement</span></div>
    </section>
    {centerIds.length>1&&<section className="rounded-2xl border bg-white p-4"><h3 className="font-bold">Mes centres</h3><div className="mt-3 flex flex-wrap gap-2">{(centers??[]).map(c=><Link key={c.id} href={"/centre-examens?centre="+c.id} className={"rounded-full border px-3 py-2 text-sm font-semibold "+(c.id===selectedId?"border-blue-900 bg-blue-50 text-blue-900":"border-slate-200")}>{c.display_name}</Link>)}</div></section>}
    {metrics&&<section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {[["Rendez-vous",metrics.total],["À confirmer",metrics.booked],["Confirmés",metrics.confirmed],["Réalisés",metrics.completed]].map(([label,value])=><article key={label} className="rounded-2xl border bg-white p-4"><p className="text-sm text-slate-500">{label}</p><p className="mt-1 text-3xl font-black tabular-nums">{value}</p></article>)}
    </section>}
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {modules.filter(x=>selected&&examRoleHas(selected.role_key,x[2])).map(([key,label,,href])=><Link key={key} href={href+"?centre="+selectedId} className="group rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-sm"><span className="text-xs font-bold uppercase tracking-widest text-blue-700">Module</span><h3 className="mt-2 text-lg font-black">{label}</h3><p className="mt-2 text-sm text-slate-500">Ouvrir le module et traiter les éléments relevant de votre poste.</p><p className="mt-4 text-sm font-bold text-blue-900">Accéder →</p></Link>)}
    </section>
    <p className="text-xs leading-5 text-slate-500">Un résultat médical ne peut être préparé, validé puis publié que par les postes expressément autorisés. L’assistance IA ne pose aucun diagnostic et ne publie aucun compte rendu.</p>
  </div>;
}
