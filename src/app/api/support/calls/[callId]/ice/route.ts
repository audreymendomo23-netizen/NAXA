import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin,supabaseServer } from "@/lib/supabase/server";
import { authorizeSupportAgent } from "@/lib/support/agent-auth";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function GET(_request:Request,context:{params:Promise<{callId:string}>}){
 const {callId}=await context.params;if(!UUID.test(callId))return NextResponse.json({error:"Identifiant invalide."},{status:400});
 const {data:auth,error:authError}=await supabaseServer().auth.getUser();if(authError||!auth.user)return NextResponse.json({error:"Connexion requise."},{status:401});
 const db=supabaseAdmin();
 const {data:call,error}=await db.from("support_calls").select("requester_user_id,agent_user_id,status").eq("id",callId).maybeSingle();
 if(error)return NextResponse.json({error:"Session audio indisponible."},{status:503});
 if(!call||call.status!=="accepted"||(call.requester_user_id!==auth.user.id&&call.agent_user_id!==auth.user.id))return NextResponse.json({error:"Participant ou appel non autorisé."},{status:403});
 if(call.agent_user_id===auth.user.id){
  const agent=await authorizeSupportAgent("audio_call");
  if(!agent.ok)return NextResponse.json({error:agent.error},{status:agent.status});
  const ticketAccess=await authorizeSupportAgent("ticket_view_assigned");
  if(!ticketAccess.ok)return NextResponse.json({error:ticketAccess.error},{status:ticketAccess.status});
 }else if(call.requester_user_id===auth.user.id){
  const {data:profile,error:profileError}=await db.from("profiles").select("actif").eq("id",auth.user.id).maybeSingle();
  if(profileError)return NextResponse.json({error:"Statut du profil indisponible."},{status:503});
  if(!profile||profile.actif!==true)return NextResponse.json({error:"Le profil demandeur est suspendu."},{status:403});
 }
 const parseUrls=(value:string|undefined)=>(value??"").split(",").map(x=>x.trim()).filter(x=>/^(stun|stuns|turn|turns):/i.test(x));
 const turns=parseUrls(process.env.NAXA_TURN_URLS),stuns=parseUrls(process.env.NAXA_STUN_URLS),secret=process.env.NAXA_TURN_SHARED_SECRET;
 const n=Number(process.env.NAXA_TURN_CREDENTIAL_TTL_SECONDS??300),ttl=Number.isFinite(n)?Math.min(900,Math.max(60,Math.floor(n))):300;
 if(!turns.length||!secret||secret.length<24)return NextResponse.json({error:"Le relais audio TURN n’est pas configuré sur Replay."},{status:503});
 const expiresAt=Math.floor(Date.now()/1000)+ttl,username=expiresAt+":"+auth.user.id,credential=createHmac("sha1",secret).update(username).digest("base64");
 const iceServers:RTCIceServer[]=[...(stuns.length?[{urls:stuns}]:[]),{urls:turns,username,credential}];
 return NextResponse.json({iceServers,expiresAt},{headers:{"Cache-Control":"private, no-store"}});
}
