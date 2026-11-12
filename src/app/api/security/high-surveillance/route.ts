import { NextResponse } from "next/server";
import { loadPromoteurAccess } from "@/lib/promoteur-access";
import { supabaseAdmin } from "@/lib/supabase/server";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TIME=/^(?:[01]\d|2[0-3]):[0-5]\d$/;
const DATE=/^\d{4}-\d{2}-\d{2}$/;
function eligible(a:Awaited<ReturnType<typeof loadPromoteurAccess>>){return (a.pharmacies??[]).filter(p=>a.activeLinkIds.has(p.id)&&p.actif&&p.visible_recherche&&p.archivee_le===null);}
function valid(v:unknown):v is {pharmacyId:string;enabled:boolean;timezone:string;windows:{days:number[];start:string;end:string}[];exceptions:Record<string,"armed"|"disarmed">}{
 if(!v||typeof v!=="object"||Array.isArray(v))return false;const x=v as Record<string,unknown>;
 if(typeof x.pharmacyId!=="string"||!UUID.test(x.pharmacyId)||typeof x.enabled!=="boolean"||typeof x.timezone!=="string"||!x.timezone||x.timezone.length>80||!Array.isArray(x.windows)||x.windows.length>32||!x.exceptions||typeof x.exceptions!=="object"||Array.isArray(x.exceptions)||Object.keys(x.exceptions).length>60)return false;
 try{new Intl.DateTimeFormat("en",{timeZone:x.timezone}).format(new Date());}catch{return false;}
 for(const item of x.windows){if(!item||typeof item!=="object"||Array.isArray(item))return false;const w=item as Record<string,unknown>;
  if(!Array.isArray(w.days)||w.days.length<1||w.days.length>7||w.days.some(d=>!Number.isInteger(d)||(d as number)<0||(d as number)>6)||new Set(w.days).size!==w.days.length||typeof w.start!=="string"||!TIME.test(w.start)||typeof w.end!=="string"||!TIME.test(w.end)||w.start===w.end)return false;}
 for(const [date,mode] of Object.entries(x.exceptions as Record<string,unknown>)){if(!DATE.test(date)||new Date(date+"T00:00:00Z").toISOString().slice(0,10)!==date||(mode!=="armed"&&mode!=="disarmed"))return false;}
 return true;
}
export async function GET(){
 try{const a=await loadPromoteurAccess();if(a.profile.role!=="promoteur"||a.profile.actif!==true||a.shouldShowAccessStatus||a.linksError||a.pharmaciesError)return NextResponse.json({ok:false,error:"Accès Promoteur indisponible."},{status:403});
 const ph=eligible(a),ids=ph.map(p=>p.id);if(!ids.length)return NextResponse.json({ok:true,policies:[]},{headers:{"Cache-Control":"no-store"}});
 const {data,error}=await supabaseAdmin().from("naxa_security_high_surveillance_policies").select("id,pharmacie_id,enabled,timezone,schedule_windows,exceptions,policy_version,expires_at,updated_at").in("pharmacie_id",ids).order("updated_at",{ascending:false});
 if(error)return NextResponse.json({ok:false,error:"Calendriers indisponibles."},{status:503});const names=new Map(ph.map(p=>[p.id,p.nom]));
 return NextResponse.json({ok:true,policies:(data??[]).map(p=>({id:p.id,pharmacyId:p.pharmacie_id,pharmacyName:names.get(p.pharmacie_id)??"Pharmacie",enabled:p.enabled,timezone:p.timezone,windows:p.schedule_windows,exceptions:p.exceptions,version:p.policy_version,expiresAt:p.expires_at,updatedAt:p.updated_at}))},{headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({ok:false,error:"Service calendrier indisponible."},{status:500});}
}
export async function POST(request:Request){
 try{const origin=request.headers.get("origin");if((origin&&origin!==new URL(request.url).origin)||request.headers.get("sec-fetch-site")==="cross-site")return NextResponse.json({ok:false,error:"Origine refusée."},{status:403});
 const raw=await request.text();if(!raw||Buffer.byteLength(raw,"utf8")>8192)return NextResponse.json({ok:false,error:"Requête trop volumineuse."},{status:413});
 let body:unknown;try{body=JSON.parse(raw);}catch{return NextResponse.json({ok:false,error:"JSON invalide."},{status:400});}
 if(!valid(body))return NextResponse.json({ok:false,error:"Calendrier, fuseau ou exception invalide."},{status:400});
 const a=await loadPromoteurAccess();if(a.profile.role!=="promoteur"||a.profile.actif!==true||a.shouldShowAccessStatus||a.linksError||a.pharmaciesError)return NextResponse.json({ok:false,error:"Accès Promoteur indisponible."},{status:403});
 if(!eligible(a).some(p=>p.id===body.pharmacyId))return NextResponse.json({ok:false,error:"Pharmacie hors périmètre actif."},{status:404});
 const expiresAt=new Date(Date.now()+72*60*60*1000).toISOString();
 const {data,error}=await supabaseAdmin().rpc("naxa_security_save_high_surveillance_policy",{p_pharmacie_id:body.pharmacyId,p_actor_id:a.profile.id,p_enabled:body.enabled,p_timezone:body.timezone,p_schedule_windows:body.windows,p_exceptions:body.exceptions,p_expires_at:expiresAt});
 if(error){console.error("[security.high-surveillance] rejected",{code:error.code});return NextResponse.json({ok:false,error:"Enregistrement du calendrier refusé."},{status:503});}
 const row=Array.isArray(data)?data[0]:data;if(!row?.policy_id||!Number.isSafeInteger(row.policy_version))return NextResponse.json({ok:false,error:"Confirmation indisponible."},{status:503});
 return NextResponse.json({ok:true,policyId:row.policy_id,version:row.policy_version,expiresAt,offlineValidityHours:72},{headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({ok:false,error:"Service calendrier indisponible."},{status:500});}
}
