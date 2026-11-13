import { createHash } from "node:crypto";
import { NextRequest,NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { classifyMedicalSpecialtyIntent } from "@/lib/medical-specialty-intent";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function POST(request:NextRequest){
  let body:{description?:unknown;allow_external_ai?:unknown};
  try{body=await request.json();}catch{return NextResponse.json({error:"Requête invalide."},{status:400});}
  const description=typeof body.description==="string"?body.description.trim().slice(0,500):"";
  if(description.length<2)return NextResponse.json({error:"Saisissez au moins deux caractères."},{status:400});
  const consent=body.allow_external_ai===true;
  if(consent){
    const forwarded=request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      ||request.headers.get("x-real-ip")?.trim()
      ||"unknown";
    const rateKey="med_ai_"+createHash("sha256").update(forwarded).digest("hex").slice(0,24);
    try{
      const {data,error}=await (supabaseAdmin() as any).rpc("naxa_reserve_api_rate_limit",{
        p_key:rateKey,p_interval_ms:1500,p_max_wait_ms:1500
      });
      if(error||!data)return NextResponse.json({error:"Analyse IA limitée momentanément. Les suggestions locales restent disponibles."},{status:429,headers:{"Retry-After":"2","Cache-Control":"no-store"}});
    }catch{
      return NextResponse.json({error:"Analyse IA indisponible. Les suggestions locales restent disponibles."},{status:503});
    }
  }
  const result=await classifyMedicalSpecialtyIntent(description,consent);
  return NextResponse.json(result,{headers:{"Cache-Control":"no-store"}});
}
