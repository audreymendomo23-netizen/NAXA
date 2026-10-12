import { NextRequest,NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/server";
import { PHARMACIE_SCHEMA as S } from "@/lib/pharmacie-schema";
import { setPharmacyCookie } from "@/lib/pharmacie-code-session";
import { hashRateKey,rateLimit,tooManyAttempts,trustedRequestIp } from "@/lib/pharmacie-rate-limit";
export async function POST(request:NextRequest){
 let body:{code?:unknown};try{body=await request.json()}catch{return NextResponse.json({error:"Code invalide."},{status:400})}
 const code=typeof body.code==="string"?body.code:"";
 if(!/^\d{4}$/.test(code))return NextResponse.json({error:"Code invalide."},{status:400});
 const ip=trustedRequestIp(request);
 try{
  const ipCheck=await rateLimit("ip_code",ip,"check",5,600,30,900);if(!ipCheck.allowed)return tooManyAttempts(ipCheck.retryAfter);
  const codeCheck=await rateLimit("code",code,"check",20,3600,900,900);if(!codeCheck.allowed)return tooManyAttempts(codeCheck.retryAfter);
  const {data,error}=await supabaseAdmin().from(S.pharmaciesTable).select(`${S.pharmacyIdColumn},${S.pharmacyNameColumn}`).eq(S.pharmacyCodeColumn,code).eq(S.pharmacyActiveColumn,true).limit(2);
  if(error)throw error;
  if(!data||data.length!==1){
   const ipFail=await rateLimit("ip_code",ip,"fail",5,600,30,900);
   await rateLimit("code",code,"fail",20,3600,900,900);
   if(!ipFail.allowed)return tooManyAttempts(ipFail.retryAfter);
   return NextResponse.json({error:"Code pharmacie introuvable"},{status:404});
  }
  await rateLimit("ip_code",ip,"success",5,600,30,900);await rateLimit("code",code,"success",20,3600,900,900);
  const row=data[0] as Record<string,unknown>;if(typeof row[S.pharmacyIdColumn]!=="string"||typeof row[S.pharmacyNameColumn]!=="string")throw new Error("Invalid pharmacy schema");
  const response=NextResponse.json({nom:row[S.pharmacyNameColumn]});setPharmacyCookie(response,row[S.pharmacyIdColumn] as string);return response;
 }catch(e){console.error("NAXA_PHARMACY_CODE_FAILED",e);return NextResponse.json({error:"Vérification indisponible."},{status:503})}
}
