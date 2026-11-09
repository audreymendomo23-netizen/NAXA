import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { authenticateSignedSecurityGateway } from "@/lib/security/gateway-request";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(request:Request){
 try{const raw=await request.text();if(!raw||Buffer.byteLength(raw,"utf8")>2048)return NextResponse.json({ok:false,complete:false,error:"Requête trop volumineuse."},{status:413});
 let body:{version?:unknown};try{body=JSON.parse(raw);}catch{return NextResponse.json({ok:false,complete:false,error:"JSON invalide."},{status:400});}
 if(body.version!==1)return NextResponse.json({ok:false,complete:false,error:"Version non supportée."},{status:400});
 const auth=await authenticateSignedSecurityGateway(request,raw);if(!auth.ok)return NextResponse.json({ok:false,complete:false,error:auth.error},{status:auth.status});
 if(auth.installation.status!=="pilot_active"||auth.installation.legal_review_status!=="approved"||auth.installation.privacy_notice_status!=="approved")return NextResponse.json({ok:false,complete:false,error:"Installation pilote non autorisée."},{status:403});
 const {data,error}=await auth.admin.from("naxa_security_high_surveillance_policies").select("id,enabled,timezone,schedule_windows,exceptions,policy_version,expires_at,updated_at").eq("pharmacie_id",auth.gateway.pharmacie_id).eq("scope_key","pharmacy").maybeSingle();
 if(error)return NextResponse.json({ok:false,complete:false,error:"Politique indisponible."},{status:503});
 const policy=data?{id:data.id,enabled:data.enabled,timezone:data.timezone,windows:data.schedule_windows,exceptions:data.exceptions,policyVersion:data.policy_version,expiresAt:data.expires_at,updatedAt:data.updated_at}:null;
 const policySha256=createHash("sha256").update(JSON.stringify(policy),"utf8").digest("hex");
 return NextResponse.json({ok:true,complete:true,policy,policySha256,serverTime:new Date().toISOString()},{headers:{"Cache-Control":"no-store",Pragma:"no-cache"}});
 }catch{return NextResponse.json({ok:false,complete:false,error:"Synchronisation calendrier indisponible."},{status:500});}
}
