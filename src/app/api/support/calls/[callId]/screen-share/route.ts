import { NextResponse } from "next/server";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACTIONS=new Set(["consented","started","stopped","denied"]);
const REASONS=new Set(["browser_permission_denied","browser_unsupported","user_cancelled","user_stopped","call_ended","requester_disconnected","unexpected_track_end"]);
type Context={params:Promise<{callId:string}>};

export async function POST(request:Request,context:Context){
  const {callId}=await context.params;
  if(!UUID.test(callId))return NextResponse.json({error:"Identifiant d’appel invalide."},{status:400});
  let body:{action?:string;share_session_id?:string;reason?:string};
  try{body=await request.json();}catch{return NextResponse.json({error:"Événement de partage invalide."},{status:400});}
  const action=String(body.action??"");
  const shareSessionId=String(body.share_session_id??"");
  const reason=body.reason===undefined?null:String(body.reason);
  if(!ACTIONS.has(action)||!UUID.test(shareSessionId)||(reason!==null&&!REASONS.has(reason)))return NextResponse.json({error:"Événement ou motif non autorisé."},{status:400});
  if((action==="consented"||action==="started")&&reason!==null)return NextResponse.json({error:"Motif inattendu."},{status:400});
  if(action==="denied"&&reason===null)return NextResponse.json({error:"Le motif du refus est obligatoire."},{status:400});
  const {data:auth,error:authError}=await supabaseServer().auth.getUser();
  if(authError||!auth.user)return NextResponse.json({error:"Connexion requise."},{status:401});
  const admin=supabaseAdmin();
  const {data:call,error:callError}=await admin.from("support_calls")
    .select("id,requester_user_id").eq("id",callId).maybeSingle();
  if(callError)return NextResponse.json({error:"Appel momentanément indisponible."},{status:503});
  if(!call||call.requester_user_id!==auth.user.id)return NextResponse.json({error:"Seul le demandeur peut contrôler le partage de son écran."},{status:403});
  const {error}=await admin.rpc("naxa_support_call_screen_share_event",{
    p_call_id:callId,p_actor_user_id:auth.user.id,p_share_session_id:shareSessionId,p_action:action,p_reason:reason,
  });
  if(error)return NextResponse.json({error:"Événement refusé."},{status:409});
  return NextResponse.json({success:true},{headers:{"Cache-Control":"private, no-store"}});
}
