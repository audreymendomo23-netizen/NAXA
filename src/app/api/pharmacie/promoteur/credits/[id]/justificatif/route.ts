import { NextResponse } from "next/server";
import { supabaseServer, supabaseAdmin } from "@/lib/supabase/server";

const valid=(v:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
export async function GET(_request:Request,{params}:{params:{id:string}}){
 const sb=supabaseServer();const {data:auth}=await sb.auth.getUser();
 if(!auth.user)return NextResponse.json({error:"Connexion requise"},{status:401});
 if(!valid(params.id))return NextResponse.json({error:"Référence invalide"},{status:400});
 const {data:profile}=await sb.from("profiles").select("role,actif").eq("id",auth.user.id).maybeSingle();
 if(!profile||profile.role!=="promoteur"||profile.actif===false)return NextResponse.json({error:"Accès refusé"},{status:403});
 const {data:ids,error:scopeError}=await sb.rpc("my_pharmacies");
 if(scopeError||!Array.isArray(ids))return NextResponse.json({error:"Périmètre indisponible"},{status:403});
 const {data:row,error}=await sb.from("client_credit_requests").select("pharmacie_id,origine,justificatif_path").eq("id",params.id).maybeSingle();
 if(error||!row||row.origine!=="marketplace"||!ids.includes(row.pharmacie_id)||!row.justificatif_path)return NextResponse.json({error:"Justificatif indisponible"},{status:404});
 const {data:signed,error:signError}=await supabaseAdmin().storage.from("credit-marketplace-justificatifs").createSignedUrl(row.justificatif_path,60,{download:true});
 if(signError||!signed?.signedUrl)return NextResponse.json({error:"Téléchargement indisponible"},{status:503});
 return NextResponse.redirect(signed.signedUrl);
}
