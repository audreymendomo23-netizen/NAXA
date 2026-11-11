import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

export type ExamRole = "directeur" | "accueil" | "caissier" | "comptable" | "technicien_laboratoire" | "biologiste" | "manipulateur_imagerie" | "radiologue" | "responsable_qualite" | "responsable_securite";
export type ExamCapability = "center_manage" | "appointments_read" | "appointments_manage" | "staff_manage" | "staff_read" | "security_read" | "security_manage" | "incident_report" | "equipment_read" | "equipment_manage" | "finance_read" | "finance_write" | "finance_approve" | "communications_read" | "communications_write" | "ai_use" | "result_metadata_read" | "results_draft" | "results_read" | "results_validate" | "results_publish" | "result_files_read" | "quality_manage";

export const EXAM_ROLE_LABELS: Record<ExamRole,string> = {
  directeur:"Direction du centre", accueil:"Accueil et admissions", caissier:"Caisse", comptable:"Comptabilité",
  technicien_laboratoire:"Technicien de laboratoire", biologiste:"Biologiste valideur",
  manipulateur_imagerie:"Manipulateur d’imagerie", radiologue:"Radiologue",
  responsable_qualite:"Responsable qualité", responsable_securite:"Responsable sécurité"
};

export const EXAM_ROLE_CAPABILITIES: Record<ExamRole,ExamCapability[]> = {
  directeur:["center_manage","appointments_read","appointments_manage","staff_manage","security_read","security_manage","incident_report","equipment_read","equipment_manage","finance_read","finance_write","finance_approve","communications_read","communications_write","ai_use","result_metadata_read","quality_manage"],
  accueil:["appointments_read","appointments_manage","incident_report","communications_read","communications_write","ai_use","result_metadata_read"],
  caissier:["appointments_read","incident_report","equipment_read","finance_read","finance_write","communications_read","communications_write","ai_use","result_metadata_read"],
  comptable:["appointments_read","incident_report","finance_read","finance_write","finance_approve","communications_read","ai_use","result_metadata_read"],
  technicien_laboratoire:["appointments_read","incident_report","equipment_read","equipment_manage","results_draft","result_metadata_read","communications_read"],
  biologiste:["appointments_read","incident_report","equipment_read","equipment_manage","results_draft","results_read","results_validate","results_publish","result_files_read","result_metadata_read","communications_read"],
  manipulateur_imagerie:["appointments_read","incident_report","equipment_read","equipment_manage","results_draft","result_metadata_read","communications_read"],
  radiologue:["appointments_read","incident_report","equipment_read","equipment_manage","results_draft","results_read","results_validate","results_publish","result_files_read","result_metadata_read","communications_read"],
  responsable_qualite:["appointments_read","incident_report","security_read","security_manage","equipment_read","equipment_manage","quality_manage","result_metadata_read","communications_read","ai_use"],
  responsable_securite:["incident_report","security_read","security_manage","staff_read","communications_read","ai_use"]
};

export type ExamAssignment = { id:string; center_id:string; role_key:ExamRole; active_role:boolean; is_active:boolean };

export async function getExamUserContext() {
  const sb=supabaseServer();
  const {data:auth}=await sb.auth.getUser();
  if(!auth.user) redirect("/connexion?retour=%2Fcentre-examens");
  const {data:profile}=await sb.from("profiles").select("actif").eq("id",auth.user.id).maybeSingle();
  if(!profile?.actif) redirect("/");
  const {data:assignments,error}=await sb.from("exam_staff_assignments")
    .select("id,center_id,role_key,active_role,is_active").eq("user_id",auth.user.id)
    .eq("is_active",true).is("revoked_at",null).order("created_at",{ascending:true});
  if(error || !assignments?.length) redirect("/partenaire/examens?erreur=affectation");
  const typed=assignments as ExamAssignment[];
  return {sb,user:auth.user,assignments:typed,activeAssignments:typed.filter(a=>a.active_role)};
}

export function examRoleHas(role:string,capability:ExamCapability) {
  return (EXAM_ROLE_CAPABILITIES[role as ExamRole]??[]).includes(capability);
}

export async function requireExamCapability(centerId:string,capability:ExamCapability) {
  const context=await getExamUserContext();
  const assignment=context.activeAssignments.find(a=>a.center_id===centerId);
  if(!assignment || !examRoleHas(assignment.role_key,capability)) redirect("/centre-examens?erreur=habilitation");
  return {...context,assignment};
}
