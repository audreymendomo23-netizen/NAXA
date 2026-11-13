import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET(_request:NextRequest,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const sb=supabaseServer();
  const {data:auth}=await sb.auth.getUser();
  if(!auth.user) return NextResponse.json({error:"Connexion requise"},{status:401});
  const {data:file,error}=await sb.from("exam_result_files").select("id,result_id,center_id,storage_path").eq("id",id).maybeSingle();
  if(error||!file) return NextResponse.json({error:"Pièce introuvable ou accès refusé"},{status:404});
  const {data:result}=await sb.from("exam_results").select("id,status,client_id").eq("id",file.result_id).eq("center_id",file.center_id).maybeSingle();
  if(!result) return NextResponse.json({error:"Résultat introuvable"},{status:404});
  const {error:logError}=await sb.from("exam_result_access_log").insert({
    result_id:file.result_id,center_id:file.center_id,actor_id:auth.user.id,action_key:"download"
  });
  if(logError) return NextResponse.json({error:"Accès au fichier refusé"},{status:403});
  const {data:signed,error:signedError}=await sb.storage.from("exam-results").createSignedUrl(file.storage_path,60);
  if(signedError||!signed?.signedUrl) return NextResponse.json({error:"Fichier indisponible"},{status:404});
  return NextResponse.redirect(signed.signedUrl,302);
}
