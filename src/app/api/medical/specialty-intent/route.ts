import { NextRequest,NextResponse } from "next/server";
import { classifyMedicalSpecialtyIntent } from "@/lib/medical-specialty-intent";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function POST(request:NextRequest){
  let body:{description?:unknown;allow_external_ai?:unknown};
  try{body=await request.json();}catch{return NextResponse.json({error:"Requête invalide."},{status:400});}
  const description=typeof body.description==="string"?body.description.trim().slice(0,500):"";
  if(description.length<2)return NextResponse.json({error:"Saisissez au moins deux caractères."},{status:400});
  const consent=body.allow_external_ai===true;
  const result=await classifyMedicalSpecialtyIntent(description,consent);
  return NextResponse.json(result,{headers:{"Cache-Control":"no-store"}});
}
