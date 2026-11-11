import Link from "next/link";
import { redirect } from "next/navigation";
import { getExamUserContext, EXAM_ROLE_LABELS, examRoleHas } from "@/lib/examens/access";
import type { ExamCapability } from "@/lib/examens/access";

const navItems:{href:string;label:string;capability:ExamCapability}[]=[
  {href:"/centre-examens/agenda",label:"Agenda",capability:"appointments_read"},
  {href:"/centre-examens/personnel",label:"Personnel",capability:"staff_manage"},
  {href:"/centre-examens/resultats",label:"Résultats",capability:"results_draft"},
  {href:"/centre-examens/equipements",label:"Équipements",capability:"equipment_read"},
  {href:"/centre-examens/comptabilite",label:"Comptabilité",capability:"finance_read"},
  {href:"/centre-examens/securite",label:"Sécurité",capability:"incident_report"},
  {href:"/centre-examens/messages",label:"Messages",capability:"communications_read"},
  {href:"/centre-examens/ia",label:"Actions IA",capability:"ai_use"}
];

export default async function CentreExamensLayout({children}:{children:React.ReactNode}){
  const context=await getExamUserContext();
  const active=context.activeAssignments[0];
  if(!active) redirect("/centre-examens?erreur=role");
  const {data:center}=await context.sb.from("exam_centers").select("display_name,address_label,city").eq("id",active.center_id).maybeSingle();
  if(!center) redirect("/partenaire/examens?erreur=centre");
  const items=navItems.filter(item=>examRoleHas(active.role_key,item.capability));
  const withCenter=(href:string)=>href+"?centre="+encodeURIComponent(active.center_id);

  return <div className="min-h-screen bg-[#F5F7FB] text-slate-900">
    <header className="bg-[#172554] text-white"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4">
      <div><p className="text-xs font-bold uppercase tracking-[.18em] text-blue-200">NAXA · ERP Examens</p><h1 className="mt-1 text-lg font-black">{center.display_name}</h1><p className="text-xs text-blue-100">{center.address_label}{center.city?" · "+center.city:""}</p></div>
      <div className="text-right"><p className="text-xs text-blue-100">Poste actif</p><p className="font-bold">{EXAM_ROLE_LABELS[active.role_key]}</p><Link href="/centre-examens" className="mt-1 inline-flex text-xs font-semibold text-blue-100 underline">Tous mes centres</Link></div>
    </div></header>
    <nav aria-label="Navigation ERP centre d’examens" className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 py-2">
      <Link href={withCenter("/centre-examens")} className="whitespace-nowrap rounded-full bg-slate-100 px-3 py-2 text-sm font-bold">Vue générale</Link>
      {items.map(item=><Link key={item.href} href={withCenter(item.href)} className="whitespace-nowrap rounded-full px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-blue-50 hover:text-blue-900">{item.label}</Link>)}
    </div></nav>
    <main className="mx-auto max-w-7xl px-4 py-5">{children}</main>
  </div>;
}
