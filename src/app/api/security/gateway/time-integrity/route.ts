import { NextResponse } from "next/server";
import { authenticateSignedSecurityGateway } from "@/lib/security/gateway-request";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const serverPattern=/^[A-Za-z0-9.-]{1,253}$/;
export async function POST(request:Request) {
 try {
  const rawBody=await request.text();
  if(!rawBody||Buffer.byteLength(rawBody,"utf8")>4096)return NextResponse.json({ok:false,error:"Corps temporel trop volumineux."},{status:413});
  let body:{ntpServer?:unknown;stratum?:unknown;offsetMs?:unknown;roundTripMs?:unknown;measuredAt?:unknown};
  try{body=JSON.parse(rawBody);}catch{return NextResponse.json({ok:false,error:"JSON invalide."},{status:400});}
  const auth=await authenticateSignedSecurityGateway(request,rawBody);
  if(!auth.ok)return NextResponse.json({ok:false,error:auth.error},{status:auth.status});
  if(auth.installation.status!=="pilot_active"||auth.installation.legal_review_status!=="approved"||auth.installation.privacy_notice_status!=="approved")
    return NextResponse.json({ok:false,error:"Installation pilote non autorisée."},{status:403});
  const ntpServer=typeof body.ntpServer==="string"?body.ntpServer:"";
  const stratum=typeof body.stratum==="number"?body.stratum:NaN;
  const offsetMs=typeof body.offsetMs==="number"?body.offsetMs:NaN;
  const roundTripMs=typeof body.roundTripMs==="number"?body.roundTripMs:NaN;
  const measuredAt=typeof body.measuredAt==="string"?new Date(body.measuredAt):null;
  if(!serverPattern.test(ntpServer)||!Number.isInteger(stratum)||stratum<1||stratum>15||
    !Number.isSafeInteger(offsetMs)||Math.abs(offsetMs)>86400000||
    !Number.isInteger(roundTripMs)||roundTripMs<0||roundTripMs>10000||
    !measuredAt||!Number.isFinite(measuredAt.getTime())||Math.abs(Date.now()-measuredAt.getTime())>300000)
    return NextResponse.json({ok:false,error:"Mesure NTP invalide ou périmée."},{status:400});
  const clockStatus=Math.abs(offsetMs)<=1000&&roundTripMs<=1500?"synchronized":"warning";
  const {data,error}=await auth.admin.rpc("naxa_security_record_gateway_time_sample",{
    p_gateway_id:auth.gateway.id,p_pharmacie_id:auth.gateway.pharmacie_id,p_ntp_server:ntpServer,
    p_ntp_stratum:stratum,p_offset_ms:offsetMs,p_round_trip_ms:roundTripMs,
    p_clock_status:clockStatus,p_measured_at:measuredAt.toISOString()
  });
  if(error||typeof data!=="string"){
    console.error("[security.time-integrity] sample rejected",{code:error?.code});
    return NextResponse.json({ok:false,error:"Enregistrement de la mesure NTP impossible."},{status:503});
  }
  return NextResponse.json({ok:true,sampleId:data,clockStatus,offsetMs,roundTripMs},{headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({ok:false,error:"Service d'intégrité temporelle indisponible."},{status:500});}
}
