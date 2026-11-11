import { redirect } from "next/navigation";
import { getExamUserContext, EXAM_ROLE_LABELS, examRoleHas } from "@/lib/examens/access";
import type { ExamCapability } from "@/lib/examens/access";
import ExamCenterWorkspace from "@/components/ExamCenterWorkspace";
import { setExamActiveRole } from "./actions";

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
  if(!context.activeAssignments.length) redirect("/centre-examens?erreur=role");

  const centerIds=[...new Set(context.assignments.map((assignment)=>assignment.center_id))];
  const {data:centers,error}=await context.sb
    .from("exam_centers")
    .select("id,display_name,address_label,city")
    .in("id",centerIds);

  if(error||!centers?.length) redirect("/partenaire/examens?erreur=centre");

  const assignments=context.assignments.map((assignment)=>({
    id:assignment.id,
    center_id:assignment.center_id,
    role_key:assignment.role_key,
    role_label:EXAM_ROLE_LABELS[assignment.role_key],
    active_role:assignment.active_role,
    links:navItems
      .filter((item)=>examRoleHas(assignment.role_key,item.capability))
      .map(({href,label})=>({href,label}))
  }));

  return (
    <ExamCenterWorkspace
      assignments={assignments}
      centers={centers}
      setActiveRoleAction={setExamActiveRole}
    >
      {children}
    </ExamCenterWorkspace>
  );
}
