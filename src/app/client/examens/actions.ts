"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function clientContext(){
  const sb=supabaseServer();
  const {data:auth}=await sb.auth.getUser();
  if(!auth.user) redirect("/connexion?retour=%2Fclient%2Fexamens");
  const {data:profile}=await sb.from("profiles").select("actif,role").eq("id",auth.user.id).maybeSingle();
  if(profile?.actif!==true) redirect("/");
  return {sb,user:auth.user};
}

export async function createClientExamConversation(form:FormData){
  const {sb,user}=await clientContext();
  const appointmentId=String(form.get("appointment_id")??"");
  const subject=String(form.get("subject")??"").trim().slice(0,180);
  if(!UUID.test(appointmentId)||subject.length<2) redirect("/client/examens?erreur=conversation");
  const {data:appointment}=await sb.from("exam_appointments").select("id,center_id").eq("id",appointmentId).eq("client_id",user.id).maybeSingle();
  if(!appointment) redirect("/client/examens?erreur=conversation");
  const {data:existing}=await sb.from("exam_conversations").select("id").eq("appointment_id",appointmentId).eq("client_id",user.id).eq("status","open").maybeSingle();
  if(existing?.id) redirect("/client/examens?conversation="+existing.id);
  const {data:thread,error}=await sb.from("exam_conversations").insert({
    center_id:appointment.center_id,client_id:user.id,appointment_id:appointment.id,subject,status:"open"
  }).select("id").single();
  if(error||!thread?.id) redirect("/client/examens?erreur=conversation");
  revalidatePath("/client/examens");
  redirect("/client/examens?conversation="+thread.id);
}

export async function sendClientExamMessage(form:FormData){
  const {sb,user}=await clientContext();
  const conversationId=String(form.get("conversation_id")??"");
  const body=String(form.get("body")??"").trim().slice(0,5000);
  if(!UUID.test(conversationId)||!body) redirect("/client/examens?erreur=message");
  const {data:thread}=await sb.from("exam_conversations").select("id,status").eq("id",conversationId).eq("client_id",user.id).eq("status","open").maybeSingle();
  if(!thread) redirect("/client/examens?erreur=message");
  const {error}=await sb.from("exam_messages").insert({conversation_id:thread.id,sender_id:user.id,body});
  if(error) redirect("/client/examens?erreur=message");
  revalidatePath("/client/examens");
  redirect("/client/examens?conversation="+conversationId);
}
