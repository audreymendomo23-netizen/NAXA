import { NextResponse } from "next/server";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";
import { authorizeSupportAgent } from "@/lib/support/agent-auth";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(_request:Request,context:{params:Promise<{callId:string}>}) {
  const {callId}=await context.params;
  if(!UUID.test(callId)) return NextResponse.json({error:"Identifiant invalide."},{status:400});

  const {data:auth,error:authError}=await supabaseServer().auth.getUser();
  if(authError||!auth.user) return NextResponse.json({error:"Connexion requise."},{status:401});

  const db=supabaseAdmin();
  const {data:call,error}=await db.from("support_calls")
    .select("requester_user_id,agent_user_id,status")
    .eq("id",callId).maybeSingle();
  if(error) return NextResponse.json({error:"Session d’appel indisponible."},{status:503});
  if(!call||(call.requester_user_id!==auth.user.id&&call.agent_user_id!==auth.user.id))
    return NextResponse.json({error:"Participant non autorisé."},{status:403});

  if(call.agent_user_id===auth.user.id) {
    const audio=await authorizeSupportAgent("audio_call");
    if(!audio.ok) return NextResponse.json({error:audio.error},{status:audio.status});
    const ticket=await authorizeSupportAgent("ticket_view_assigned");
    if(!ticket.ok) return NextResponse.json({error:ticket.error},{status:ticket.status});
  } else {
    const {data:profile,error:profileError}=await db.from("profiles")
      .select("actif").eq("id",auth.user.id).maybeSingle();
    if(profileError) return NextResponse.json({error:"Statut du profil indisponible."},{status:503});
    if(!profile||profile.actif!==true) return NextResponse.json({error:"Profil suspendu."},{status:403});
  }

  const {data,error:heartbeatError}=await db.rpc("naxa_support_call_heartbeat",{
    p_actor_user_id:auth.user.id,p_call_id:callId,
  });
  if(heartbeatError||!data)
    return NextResponse.json({error:heartbeatError?.message??"La session audio a expiré."},{status:409});
  return NextResponse.json({success:true,call:data},{headers:{"Cache-Control":"private, no-store"}});
}
