"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseServer, supabaseAdmin } from "@/lib/supabase/server";
import { EXAM_ROLE_CAPABILITIES, type ExamCapability, type ExamRole } from "@/lib/examens/access";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ROLE_KEYS=["accueil","caissier","comptable","technicien_laboratoire","biologiste","manipulateur_imagerie","radiologue","responsable_qualite","responsable_securite"] as const;
const BASE="/centre-examens";

function fail(path:string,centerId?:string):never{
  redirect(path+(centerId?"?centre="+encodeURIComponent(centerId)+"&erreur=action":"?erreur=action"));
}
function finish(path:string,centerId:string,flag:string):never{
  revalidatePath(path);
  revalidatePath(BASE);
  revalidatePath("/client/examens");
  revalidatePath("/admin/examens");
  redirect(path+"?centre="+encodeURIComponent(centerId)+"&ok="+encodeURIComponent(flag));
}
function textValue(form:FormData,key:string,max=1000){
  return String(form.get(key)??"").trim().slice(0,max);
}
function validUuid(value:string){return UUID.test(value);}

async function requireActor(centerId:string,capabilities:ExamCapability[],returnPath:string){
  if(!validUuid(centerId)) fail(returnPath);
  const sb=supabaseServer();
  const {data:auth}=await sb.auth.getUser();
  if(!auth.user) redirect("/connexion?retour=%2Fcentre-examens");
  const {data:profile}=await sb.from("profiles").select("actif").eq("id",auth.user.id).maybeSingle();
  if(!profile?.actif) redirect("/");
  const {data:assignments,error}=await sb.from("exam_staff_assignments")
    .select("id,center_id,role_key,active_role,is_active")
    .eq("center_id",centerId).eq("user_id",auth.user.id)
    .eq("is_active",true).eq("active_role",true).is("revoked_at",null);
  const assignment=(assignments??[]).find((row:any)=>{
    const role=String(row.role_key) as ExamRole;
    const allowed=EXAM_ROLE_CAPABILITIES[role]??[];
    return capabilities.every(cap=>allowed.includes(cap));
  });
  if(error||!assignment) fail(returnPath,centerId);
  return {sb,user:auth.user,assignment,centerId};
}

export async function setExamActiveRole(form:FormData){
  const centerId=textValue(form,"center_id",64);
  const assignmentId=textValue(form,"assignment_id",64);
  if(!validUuid(centerId)||!validUuid(assignmentId)) fail(BASE);
  const sb=supabaseServer();
  const {data:auth}=await sb.auth.getUser();
  if(!auth.user) redirect("/connexion?retour=%2Fcentre-examens");
  const {error}=await sb.rpc("exam_set_active_role",{p_center_id:centerId,p_assignment_id:assignmentId});
  if(error) fail(BASE,centerId);
  revalidatePath(BASE);
  redirect(BASE+"?centre="+encodeURIComponent(centerId)+"&ok=poste");
}


function escapeEmailHtml(value:string){
  return value.replace(/[&<>"']/g,(char)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]??char));
}

async function findAuthUserByEmail(admin:ReturnType<typeof supabaseAdmin>,email:string){
  for(let page=1;page<=100;page++){
    const {data,error}=await admin.auth.admin.listUsers({page,perPage:1000});
    if(error) throw error;
    const found=(data.users??[]).find(user=>user.email?.trim().toLowerCase()===email);
    if(found) return found;
    if((data.users??[]).length<1000) return null;
  }
  throw new Error("Recherche du compte incomplète");
}

async function sendExamStaffActivationEmail(email:string,token:string){
  const endpoint=process.env.GOOGLE_APPS_SCRIPT_URL;
  const secret=process.env.GOOGLE_APPS_SCRIPT_SECRET;
  const siteUrl=process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/,"");
  if(!endpoint||!secret) throw new Error("Passerelle e-mail non configurée");
  const base=new URL(siteUrl);
  if(base.protocol!=="https:") throw new Error("URL publique HTTPS requise");
  const destination="/creation-compte?retour="+encodeURIComponent("/invitation/personnel-examen?token="+encodeURIComponent(token));
  const link=base.origin+destination;
  const safeEmail=escapeEmailHtml(email);
  const safeLink=escapeEmailHtml(link);
  const html=`<!doctype html><html lang="fr"><body style="font-family:Arial,sans-serif;color:#102a43;line-height:1.65;max-width:640px;margin:auto;padding:24px"><h1>Votre accès au centre d’examens NAXA</h1><p>Le responsable d’un centre d’examens vous a ajouté à son équipe.</p><p>Pour activer votre compte, confirmez votre adresse e-mail, renseignez vous-même vos informations, vérifiez votre majorité et acceptez les conditions NAXA.</p><p><a href="${safeLink}" style="display:inline-block;padding:12px 18px;background:#123b70;color:#fff;text-decoration:none;border-radius:8px">Activer mon compte et accepter l’affectation</a></p><p>Ce lien est personnel, à usage unique et expire après 7 jours. Il est lié à l’adresse ${safeEmail}.</p><p>Si vous n’attendez pas cette invitation, ignorez ce message.</p><p>L’équipe NAXA</p></body></html>`;
  const response=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
    secret,to:email,subject:"Activation de votre accès au centre d’examens NAXA",html,
    text:"Un responsable de centre d’examens vous a ajouté à son équipe. Ouvrez ce lien pour activer votre compte NAXA : "+link,
    idempotencyKey:"naxa-exam-staff-"+token
  }),cache:"no-store"});
  let result:{sent?:boolean}|null=null;
  try{result=await response.json()}catch{}
  if(!response.ok||result?.sent!==true) throw new Error("Envoi e-mail non confirmé");
}

export async function createExamStaffAccount(form:FormData){
  const centerId=textValue(form,"center_id",64);
  const email=textValue(form,"email",254).toLowerCase();
  const roleKey=textValue(form,"role_key",80);
  const path=BASE+"/personnel";
  const {sb}=await requireActor(centerId,["staff_manage"],path);
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!ROLE_KEYS.includes(roleKey as typeof ROLE_KEYS[number])) fail(path,centerId);
  if(!process.env.GOOGLE_APPS_SCRIPT_URL||!process.env.GOOGLE_APPS_SCRIPT_SECRET||!process.env.NEXT_PUBLIC_SITE_URL){
    redirect(path+"?centre="+encodeURIComponent(centerId)+"&erreur=configuration-email");
  }

  const admin=supabaseAdmin();
  let existing:Awaited<ReturnType<typeof findAuthUserByEmail>>;
  try{existing=await findAuthUserByEmail(admin,email)}catch{fail(path,centerId)}

  if(existing){
    const {data:profile,error:profileError}=await admin.from("profiles")
      .select("id,username,role,actif,age_verified,consent_accepted_at,date_of_birth,first_name,last_name,phone")
      .eq("id",existing.id).maybeSingle();
    if(profileError) fail(path,centerId);
    if(profile&&(profile.role!=="client"||profile.actif!==true)) fail(path,centerId);
    const complete=Boolean(profile?.username&&profile.age_verified===true&&profile.consent_accepted_at
      &&profile.date_of_birth&&profile.first_name&&profile.last_name&&profile.phone);
    if(complete){
      const {data,error}=await sb.rpc("exam_assign_existing_staff",{
        p_center_id:centerId,p_identifier:profile!.username,p_role_key:roleKey
      });
      if(error||!data?.assigned||data.center_id!==centerId) fail(path,centerId);
      finish(path,centerId,"affectation");
    }
  }

  const {data:token,error:inviteError}=await sb.rpc("exam_create_staff_invite",{
    p_center_id:centerId,p_email:email,p_role_key:roleKey
  });
  if(inviteError||typeof token!=="string"||!UUID.test(token)) fail(path,centerId);

  if(!existing){
    const {error:createError}=await admin.auth.admin.createUser({
      email,email_confirm:false,user_metadata:{naxa_signup_pending:true,exam_staff_direct_pending:true}
    });
    if(createError){
      const {data:invite}=await admin.from("exam_staff_invites").select("id").eq("token",token).maybeSingle();
      if(invite?.id) await sb.rpc("exam_revoke_staff_invite",{p_center_id:centerId,p_invite_id:invite.id});
      redirect(path+"?centre="+encodeURIComponent(centerId)+"&erreur=creation-compte");
    }
  }

  try{
    await sendExamStaffActivationEmail(email,token);
  }catch{
    redirect(path+"?centre="+encodeURIComponent(centerId)+"&erreur=envoi-email");
  }
  finish(path,centerId,"compte-invite");
}

export async function assignExamStaff(form:FormData){
  const centerId=textValue(form,"center_id",64);
  const identifier=textValue(form,"identifier",120);
  const roleKey=textValue(form,"role_key",80);
  const path=BASE+"/personnel";
  const {sb}=await requireActor(centerId,["staff_manage"],path);
  if(identifier.length<3||!ROLE_KEYS.includes(roleKey as typeof ROLE_KEYS[number])) fail(path,centerId);

  const {data,error}=await sb.rpc("exam_assign_existing_staff",{
    p_center_id:centerId,
    p_identifier:identifier,
    p_role_key:roleKey
  });
  if(error||!data?.assigned||data.center_id!==centerId) fail(path,centerId);
  finish(path,centerId,"affectation");
}

export async function revokeExamStaff(form:FormData){
  const centerId=textValue(form,"center_id",64);
  const assignmentId=textValue(form,"assignment_id",64);
  const path=BASE+"/personnel";
  const {sb}=await requireActor(centerId,["staff_manage"],path);
  if(!validUuid(assignmentId)) fail(path,centerId);
  const {error}=await sb.from("exam_staff_assignments").update({
    is_active:false,active_role:false,revoked_at:new Date().toISOString()
  }).eq("id",assignmentId).eq("center_id",centerId).eq("is_active",true);
  if(error) fail(path,centerId);
  finish(path,centerId,"retrait");
}

export async function transitionExamAppointment(form:FormData){
  const centerId=textValue(form,"center_id",64);
  const appointmentId=textValue(form,"appointment_id",64);
  const nextStatus=textValue(form,"next_status",32);
  const path=BASE+"/agenda";
  const {sb}=await requireActor(centerId,["appointments_manage"],path);
  if(!validUuid(appointmentId)||!["confirmed","completed","cancelled"].includes(nextStatus)) fail(path,centerId);
  const {error}=await sb.rpc("transition_exam_appointment",{p_appointment_id:appointmentId,p_next_status:nextStatus});
  if(error) fail(path,centerId);
  finish(path,centerId,"rendez-vous");
}

export async function createExamResultDraft(form:FormData){
  const centerId=textValue(form,"center_id",64);
  const appointmentId=textValue(form,"appointment_id",64);
  const title=textValue(form,"title",180);
  const reportText=textValue(form,"report_text",50000);
  const conclusion=textValue(form,"conclusion",10000);
  const path=BASE+"/resultats";
  const {sb}=await requireActor(centerId,["results_draft"],path);
  if(!validUuid(appointmentId)||title.length<2||reportText.length<1) fail(path,centerId);
  const {error}=await sb.rpc("exam_create_result_draft",{
    p_center_id:centerId,p_appointment_id:appointmentId,p_title:title,p_report_text:reportText,p_conclusion:conclusion||null
  });
  if(error) fail(path,centerId);
  finish(path,centerId,"brouillon");
}

export async function transitionExamResult(form:FormData){
  const centerId=textValue(form,"center_id",64);
  const resultId=textValue(form,"result_id",64);
  const nextStatus=textValue(form,"next_status",32);
  const path=BASE+"/resultats";
  const cap=nextStatus==="validated"?"results_validate":nextStatus==="published"||nextStatus==="withdrawn"?"results_publish":null;
  if(!cap||!validUuid(resultId)) fail(path,centerId);
  const {sb}=await requireActor(centerId,[cap],path);
  const expected=nextStatus==="validated"?"draft":"validated";
  const {error}=await sb.from("exam_results").update({status:nextStatus})
    .eq("id",resultId).eq("center_id",centerId).eq("status",expected);
  if(error) fail(path,centerId);
  finish(path,centerId,"resultat");
}

export async function uploadExamResultFile(form:FormData){
  const centerId=textValue(form,"center_id",64);
  const resultId=textValue(form,"result_id",64);
  const file=form.get("file");
  const path=BASE+"/resultats";
  const {sb,user}=await requireActor(centerId,["results_draft"],path);
  if(!validUuid(resultId)||!(file instanceof File)||file.size<1||file.size>10*1024*1024
    ||!["application/pdf","image/jpeg","image/png"].includes(file.type)) fail(path,centerId);
  const {data:result}=await sb.from("exam_results").select("id,status").eq("id",resultId).eq("center_id",centerId).eq("status","draft").maybeSingle();
  if(!result) fail(path,centerId);
  const cleanName=file.name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]/g,"_").slice(-120)||"piece";
  const storagePath=centerId+"/"+resultId+"/"+randomUUID()+"_"+cleanName;
  const uploaded=await sb.storage.from("exam-results").upload(storagePath,new Uint8Array(await file.arrayBuffer()),{
    contentType:file.type,upsert:false
  });
  if(uploaded.error) fail(path,centerId);
  const {error}=await sb.from("exam_result_files").insert({
    result_id:resultId,center_id:centerId,storage_path:storagePath,
    file_name:file.name.slice(0,180),content_type:file.type,size_bytes:file.size,uploaded_by:user.id
  });
  if(error){
    try{await supabaseAdmin().storage.from("exam-results").remove([storagePath]);}catch{}
    fail(path,centerId);
  }
  finish(path,centerId,"piece-jointe");
}

export async function createExamEquipment(form:FormData){
  const centerId=textValue(form,"center_id",64);
  const name=textValue(form,"name",180);
  const category=textValue(form,"category",32);
  const manufacturer=textValue(form,"manufacturer",120);
  const model=textValue(form,"model",120);
  const serial=textValue(form,"serial_number",120);
  const imageUrl=textValue(form,"image_url",1000);
  const sourceUrl=textValue(form,"image_source_url",1000);
  const license=textValue(form,"image_license",160);
  const path=BASE+"/equipements";
  const {sb,user}=await requireActor(centerId,["equipment_manage"],path);
  if(name.length<2||!["laboratoire","imagerie","cardiologie","monitoring","autre"].includes(category)) fail(path,centerId);
  if(imageUrl&&(!imageUrl.startsWith("https://")||!sourceUrl.startsWith("https://")||license.length<3)) fail(path,centerId);
  const {error}=await sb.from("exam_equipment").insert({
    center_id:centerId,name,category,manufacturer:manufacturer||null,model:model||null,
    serial_number:serial||null,image_url:imageUrl||null,image_alt:imageUrl?name:null,
    image_source_url:sourceUrl||null,image_license:license||null,is_public:false,created_by:user.id
  });
  if(error) fail(path,centerId);
  finish(path,centerId,"equipement");
}

export async function createExamMaintenance(form:FormData){
  const centerId=textValue(form,"center_id",64);
  const equipmentId=textValue(form,"equipment_id",64);
  const kind=textValue(form,"maintenance_type",32);
  const scheduled=textValue(form,"scheduled_at",80);
  const provider=textValue(form,"provider_name",180);
  const notes=textValue(form,"notes",1500);
  const cost=Number(form.get("cost_fcfa")??0);
  const path=BASE+"/equipements";
  const {sb,user}=await requireActor(centerId,["equipment_manage"],path);
  if(!validUuid(equipmentId)||!["preventive","corrective","calibration","inspection"].includes(kind)
    ||!Number.isSafeInteger(cost)||cost<0||cost>1000000000) fail(path,centerId);
  const {error}=await sb.from("exam_equipment_maintenance").insert({
    center_id:centerId,equipment_id:equipmentId,maintenance_type:kind,
    scheduled_at:scheduled?new Date(scheduled).toISOString():null,
    provider_name:provider||null,notes:notes||null,cost_fcfa:cost,created_by:user.id
  });
  if(error) fail(path,centerId);
  finish(path,centerId,"maintenance");
}

export async function createExamIncident(form:FormData){
  const centerId=textValue(form,"center_id",64);
  const category=textValue(form,"category",32);
  const severity=textValue(form,"severity",16);
  const title=textValue(form,"title",180);
  const description=textValue(form,"description",5000);
  const path=BASE+"/securite";
  const {sb,user}=await requireActor(centerId,["incident_report"],path);
  if(!["cyber","confidentialite","biologique","materiel","locaux","qualite","autre"].includes(category)
    ||!["low","medium","high","critical"].includes(severity)||title.length<3||description.length<3) fail(path,centerId);
  const {error}=await sb.from("exam_security_incidents").insert({
    center_id:centerId,category,severity,title,description,opened_by:user.id
  });
  if(error) fail(path,centerId);
  finish(path,centerId,"incident");
}

export async function transitionExamIncident(form:FormData){
  const centerId=textValue(form,"center_id",64);
  const incidentId=textValue(form,"incident_id",64);
  const state=textValue(form,"state",32);
  const resolution=textValue(form,"resolution_summary",2000);
  const path=BASE+"/securite";
  const {sb}=await requireActor(centerId,["security_manage"],path);
  if(!validUuid(incidentId)||!["EN_ANALYSE","CONFINEMENT","CORRECTION","SURVEILLANCE","CLOTURE"].includes(state)) fail(path,centerId);
  const {error}=await sb.from("exam_security_incidents").update({state,resolution_summary:resolution||null})
    .eq("id",incidentId).eq("center_id",centerId);
  if(error) fail(path,centerId);
  finish(path,centerId,"incident");
}

export async function createExamAccountingEvent(form:FormData){
  const centerId=textValue(form,"center_id",64);
  const direction=textValue(form,"direction",16);
  const category=textValue(form,"category",100);
  const label=textValue(form,"label",220);
  const method=textValue(form,"payment_method",40);
  const reference=textValue(form,"reference",120);
  const amount=Number(form.get("amount_fcfa"));
  const eventDate=textValue(form,"event_date",20);
  const path=BASE+"/comptabilite";
  const {sb,user}=await requireActor(centerId,["finance_write"],path);
  if(!["income","expense"].includes(direction)||category.length<2||label.length<2
    ||!Number.isSafeInteger(amount)||amount<=0||amount>100000000000
    ||(eventDate&&!/^\d{4}-\d{2}-\d{2}$/.test(eventDate))) fail(path,centerId);
  const {error}=await sb.from("exam_accounting_events").insert({
    center_id:centerId,direction,category,label,amount_fcfa:amount,
    payment_method:method||null,reference:reference||null,event_date:eventDate||undefined,
    status:"draft",created_by:user.id
  });
  if(error) fail(path,centerId);
  finish(path,centerId,"ecriture");
}

export async function postExamAccountingEvent(form:FormData){
  const centerId=textValue(form,"center_id",64);
  const entryId=textValue(form,"entry_id",64);
  const path=BASE+"/comptabilite";
  const {sb}=await requireActor(centerId,["finance_approve"],path);
  if(!validUuid(entryId)) fail(path,centerId);
  const {error}=await sb.from("exam_accounting_events").update({status:"posted"})
    .eq("id",entryId).eq("center_id",centerId).eq("status","draft");
  if(error) fail(path,centerId);
  finish(path,centerId,"validation");
}

export async function sendExamStaffMessage(form:FormData){
  const centerId=textValue(form,"center_id",64);
  const conversationId=textValue(form,"conversation_id",64);
  const body=textValue(form,"body",5000);
  const path=BASE+"/messages";
  const {sb,user}=await requireActor(centerId,["communications_write"],path);
  if(!validUuid(conversationId)||body.length<1) fail(path,centerId);
  const {error}=await sb.from("exam_messages").insert({conversation_id:conversationId,sender_id:user.id,body});
  if(error) fail(path,centerId);
  finish(path,centerId,"message");
}

export async function closeExamConversation(form:FormData){
  const centerId=textValue(form,"center_id",64);
  const conversationId=textValue(form,"conversation_id",64);
  const path=BASE+"/messages";
  const {sb}=await requireActor(centerId,["communications_write"],path);
  if(!validUuid(conversationId)) fail(path,centerId);
  const {error}=await sb.from("exam_conversations").update({status:"closed"}).eq("id",conversationId).eq("center_id",centerId);
  if(error) fail(path,centerId);
  finish(path,centerId,"conversation");
}

export async function markExamMessageRead(form:FormData){
  const centerId=textValue(form,"center_id",64);
  const messageId=textValue(form,"message_id",64);
  const path=BASE+"/messages";
  const sb=supabaseServer();
  const {data:auth}=await sb.auth.getUser();
  if(!auth.user) redirect("/connexion?retour=%2Fcentre-examens%2Fmessages");
  if(!validUuid(centerId)||!validUuid(messageId)) fail(path,centerId);
  const {error}=await sb.from("exam_messages").update({read_at:new Date().toISOString()}).eq("id",messageId);
  if(error) fail(path,centerId);
  revalidatePath(path);
}

export async function prepareExamDailySummary(form:FormData){
  const centerId=textValue(form,"center_id",64);
  const path=BASE+"/ia";
  const {sb,user,assignment}=await requireActor(centerId,["ai_use","appointments_read"],path);
  const {data:appointments,error}=await sb.from("exam_appointments")
    .select("id,status,exam_slots(starts_at)").eq("center_id",centerId).limit(1000);
  if(error) fail(path,centerId);
  const rows=appointments??[];
  const summary=[
    rows.length+" rendez-vous dans le périmètre chargé",
    rows.filter((x:any)=>x.status==="booked").length+" à confirmer",
    rows.filter((x:any)=>x.status==="confirmed").length+" confirmés",
    rows.filter((x:any)=>x.status==="completed").length+" réalisés",
    rows.filter((x:any)=>x.status==="cancelled").length+" annulés"
  ].join(" · ");
  const {data:log,error:logError}=await sb.from("exam_ai_action_audit").insert({
    center_id:centerId,actor_id:user.id,actor_role:assignment.role_key,
    action_key:"daily_operations_summary",scope_summary:"Agrégats de rendez-vous du centre; aucune donnée clinique consultée.",
    status:"prepared"
  }).select("id").single();
  if(logError||!log?.id) fail(path,centerId);
  const {error:updateError}=await sb.from("exam_ai_action_audit").update({status:"executed",result_summary:summary}).eq("id",log.id);
  if(updateError) fail(path,centerId);
  revalidatePath(path);
  redirect(path+"?centre="+encodeURIComponent(centerId)+"&rapport="+encodeURIComponent(log.id));
}

export async function prepareExamReminders(form:FormData){
  const centerId=textValue(form,"center_id",64);
  const path=BASE+"/ia";
  const {sb,user,assignment}=await requireActor(centerId,["ai_use","appointments_read","communications_write"],path);
  const now=new Date();
  const end=new Date(now.getTime()+24*60*60*1000);
  const {data:appointments,error}=await sb.from("exam_appointments")
    .select("id,exam_slots!inner(starts_at)").eq("center_id",centerId)
    .in("status",["booked","confirmed"]).gte("exam_slots.starts_at",now.toISOString())
    .lte("exam_slots.starts_at",end.toISOString()).limit(500);
  if(error) fail(path,centerId);
  const count=(appointments??[]).length;
  const {data:log,error:logError}=await sb.from("exam_ai_action_audit").insert({
    center_id:centerId,actor_id:user.id,actor_role:assignment.role_key,
    action_key:"prepare_appointment_reminders",
    scope_summary:count+" rendez-vous identifiés sur les prochaines 24 heures. Aucune notification créée avant confirmation.",
    status:"prepared"
  }).select("id").single();
  if(logError||!log?.id) fail(path,centerId);
  revalidatePath(path);
  redirect(path+"?centre="+encodeURIComponent(centerId)+"&aConfirmer="+encodeURIComponent(log.id));
}

export async function confirmExamReminders(form:FormData){
  const centerId=textValue(form,"center_id",64);
  const auditId=textValue(form,"audit_id",64);
  const path=BASE+"/ia";
  const {sb,user}=await requireActor(centerId,["ai_use","appointments_read","communications_write"],path);
  if(!validUuid(auditId)) fail(path,centerId);
  const {data:log}=await sb.from("exam_ai_action_audit").select("id,action_key,status")
    .eq("id",auditId).eq("center_id",centerId).eq("actor_id",user.id).maybeSingle();
  if(!log||log.action_key!=="prepare_appointment_reminders"||log.status!=="prepared") fail(path,centerId);
  const now=new Date();
  const end=new Date(now.getTime()+24*60*60*1000);
  const {data:appointments,error}=await sb.from("exam_appointments")
    .select("id,client_id,item_name,exam_slots!inner(starts_at)")
    .eq("center_id",centerId).in("status",["booked","confirmed"])
    .gte("exam_slots.starts_at",now.toISOString()).lte("exam_slots.starts_at",end.toISOString()).limit(500);
  if(error) fail(path,centerId);
  let created=0;
  for(const appointment of appointments??[]){
    const slot=(appointment as any).exam_slots;
    const startsAt=Array.isArray(slot)?slot[0]?.starts_at:slot?.starts_at;
    const date=startsAt?new Intl.DateTimeFormat("fr-FR",{dateStyle:"medium",timeStyle:"short"}).format(new Date(startsAt)):"prochainement";
    const {error:insertError}=await sb.from("exam_notifications").insert({
      center_id:centerId,user_id:appointment.client_id,appointment_id:appointment.id,
      notification_type:"appointment_reminder_24h",title:"Rappel de rendez-vous",
      body:"Votre rendez-vous « "+appointment.item_name+" » est prévu le "+date+". Le règlement s’effectue directement auprès du centre."
    });
    if(!insertError) created++;
    else if(insertError.code!=="23505") fail(path,centerId);
  }
  const {error:updateError}=await sb.from("exam_ai_action_audit").update({
    status:"executed",result_summary:created+" rappel(s) ajouté(s) dans les notifications de l’espace Client. Les doublons ont été ignorés."
  }).eq("id",auditId).eq("status","prepared");
  if(updateError) fail(path,centerId);
  finish(path,centerId,"rappels");
}

export async function rejectExamAiAction(form:FormData){
  const centerId=textValue(form,"center_id",64);
  const auditId=textValue(form,"audit_id",64);
  const path=BASE+"/ia";
  const {sb,user}=await requireActor(centerId,["ai_use"],path);
  if(!validUuid(auditId)) fail(path,centerId);
  const {error}=await sb.from("exam_ai_action_audit").update({status:"rejected",result_summary:"Action refusée par l’utilisateur; aucune opération exécutée."})
    .eq("id",auditId).eq("center_id",centerId).eq("actor_id",user.id).eq("status","prepared");
  if(error) fail(path,centerId);
  finish(path,centerId,"refus");
}
