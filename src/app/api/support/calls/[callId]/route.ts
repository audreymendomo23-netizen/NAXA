import { NextResponse } from "next/server";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";
import { authorizeSupportAgent } from "@/lib/support/agent-auth";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Context={params:Promise<{callId:string}>};
export async function GET(_request:Request,context:Context){
 const {callId}=await context.params;if(!UUID.test(callId))return NextResponse.json({error:"Identifiant invalide."},{status:400});
 const {data:auth,error:authError}=await supabaseServer().auth.getUser();if(authError||!auth.user)return NextResponse.json({error:"Connexion requise."},{status:401});
 const {data:call,error}=await supabaseAdmin().from("support_calls").select("id,ticket_id,requester_user_id,agent_user_id,status,fallback_at,accepted_at,ended_at,end_reason,created_at").eq("id",callId).maybeSingle();
 if(error)return NextResponse.json({error:"État de l’appel indisponible."},{status:503});
 if(!call||(call.requester_user_id!==auth.user.id&&call.agent_user_id!==auth.user.id))return NextResponse.json({error:"Appel introuvable ou accès refusé."},{status:404});
 return NextResponse.json({call},{headers:{"Cache-Control":"private, no-store"}});
}
export async function PATCH(request:Request,context:Context){
 const {callId}=await context.params;if(!UUID.test(callId))return NextResponse.json({error:"Identifiant invalide."},{status:400});
 let body:{action?:string};try{body=await request.json();}catch{return NextResponse.json({error:"Transition invalide."},{status:400});}
 const action=String(body.action??"");if(!["accept","decline","cancel","end"].includes(action))return NextResponse.json({error:"Transition non autorisée."},{status:400});
 const {data:auth,error:authError}=await supabaseServer().auth.getUser();if(authError||!auth.user)return NextResponse.json({error:"Connexion requise."},{status:401});
 const admin=supabaseAdmin();
 const {data:call,error}=await admin.from("support_calls").select("requester_user_id,agent_user_id").eq("id",callId).maybeSingle();
 if(error)return NextResponse.json({error:"État de l’appel indisponible."},{status:503});
 if(!call)return NextResponse.json({error:"Appel introuvable."},{status:404});
 if(action==="accept"||action==="decline"){
  const agent=await authorizeSupportAgent("audio_call");if(!agent.ok)return NextResponse.json({error:agent.error},{status:agent.status});
  if(agent.user.id!==auth.user.id)return NextResponse.json({error:"Session incohérente."},{status:403});
 }else if(call.requester_user_id!==auth.user.id&&call.agent_user_id!==auth.user.id)return NextResponse.json({error:"Participant non autorisé."},{status:403});
 if(action==="decline"&&call.agent_user_id!==auth.user.id)return NextResponse.json({error:"Seul l’Agent appelé peut refuser."},{status:403});
 if(action==="cancel"&&call.requester_user_id!==auth.user.id)return NextResponse.json({error:"Seul le demandeur peut annuler."},{status:403});
 const result=action==="accept"
  ? await admin.rpc("naxa_support_call_accept",{p_actor_user_id:auth.user.id,p_call_id:callId})
  : await admin.rpc("naxa_support_call_transition",{p_actor_user_id:auth.user.id,p_call_id:callId,p_action:action});
 if(result.error||!result.data)return NextResponse.json({error:"Transition refusée : "+(result.error?.message??"état invalide")},{status:409});
 return NextResponse.json({success:true,call:result.data},{headers:{"Cache-Control":"private, no-store"}});
}
