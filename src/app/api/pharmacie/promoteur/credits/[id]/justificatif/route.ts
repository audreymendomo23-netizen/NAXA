import { NextResponse } from "next/server";
import { supabaseServer, supabaseAdmin } from "@/lib/supabase/server";

const valid=(v:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = supabaseServer();
  const {data:auth}=await sb.auth.getUser();
  if(!auth.user)return NextResponse.json({error:"Connexion requise"},{status:401});
  if (!valid(id)) return NextResponse.json({ error: "Référence invalide" }, { status: 400 });

  const {data:profile}=await sb.from("profiles")
    .select("role,fonction_interne,actif,niveau_interne")
    .eq("id",auth.user.id).maybeSingle();
  const isPromoteur=profile?.role==="promoteur"&&profile.actif===true&&profile.niveau_interne===1;
  const isResponsable=profile?.role==="pharmacie"&&profile.fonction_interne==="responsable"
    &&profile.actif===true&&profile.niveau_interne===2;
  if(!isPromoteur&&!isResponsable)return NextResponse.json({error:"Accès refusé"},{status:403});

  // La lecture est volontairement faite avec la session authentifiée :
  // la politique RLS can_access_pharmacy borne le justificatif à la pharmacie accessible.
  const {data:row,error}=await sb.from("client_credit_requests")
    .select("pharmacie_id,origine,justificatif_path")
    .eq("id", id).maybeSingle();
  if(error||!row||row.origine!=="marketplace"||!row.justificatif_path){
    return NextResponse.json({error:"Justificatif indisponible"},{status:404});
  }

  const {data:signed,error:signError}=await supabaseAdmin().storage
    .from("credit-marketplace-justificatifs")
    .createSignedUrl(row.justificatif_path,60,{download:true});
  if(signError||!signed?.signedUrl){
    return NextResponse.json({error:"Téléchargement indisponible"},{status:503});
  }
  return NextResponse.redirect(signed.signedUrl);
}
