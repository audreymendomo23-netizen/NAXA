"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";

const uuid=(value:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export async function enregistrerPositionProfessionnelle(formData:FormData){
  const partnerId=String(formData.get("partner_id")??"").trim();
  const rawLat=String(formData.get("latitude")??"").trim();
  const rawLng=String(formData.get("longitude")??"").trim();
  const returnTo="/suivi/professionnel/disponibilites";
  if(!uuid(partnerId)) redirect(returnTo+"?erreurPosition=1");

  let latitude:number|null=null;
  let longitude:number|null=null;
  if(rawLat!==""||rawLng!==""){
    latitude=Number(rawLat);longitude=Number(rawLng);
    if(rawLat===""||rawLng===""||!Number.isFinite(latitude)||latitude < -90||latitude>90
      ||!Number.isFinite(longitude)||longitude < -180||longitude>180){
      redirect(returnTo+"?erreurPosition=1");
    }
  }

  const sb=supabaseServer();
  const {data:auth,error:authError}=await sb.auth.getUser();
  if(authError||!auth.user) redirect("/connexion?next=%2Fsuivi%2Fprofessionnel%2Fdisponibilites");
  const [{data:verified,error:verifiedError},{data:profile,error:profileError},{data:membership,error:membershipError}]=await Promise.all([
    sb.rpc("suivi_is_verified_professional",{p_user_id:auth.user.id}),
    sb.from("profiles").select("actif").eq("id",auth.user.id).maybeSingle(),
    sb.from("partner_members").select("partner_id,member_role,partners!inner(id,status,partner_type)")
      .eq("partner_id",partnerId).eq("user_id",auth.user.id).maybeSingle()
  ]);
  if(verifiedError||verified!==true||profileError||profile?.actif!==true||membershipError
    ||!membership||!["owner","manager","operator"].includes(membership.member_role)
    ||(membership as any).partners?.status!=="active"
    ||(membership as any).partners?.partner_type!=="professionnel_domicile"){
    redirect(returnTo+"?erreurPosition=1");
  }

  let result:any;
  try{
    result=await (supabaseAdmin() as any).rpc("set_professional_partner_location",{
      p_partner_id:partnerId,
      p_user_id:auth.user.id,
      p_latitude:latitude,
      p_longitude:longitude
    });
  }catch{
    redirect(returnTo+"?erreurPosition=1");
  }
  if(result?.error) redirect(returnTo+"?erreurPosition=1");

  revalidatePath(returnTo);
  revalidatePath("/prestations");
  revalidatePath("/suivi");
  redirect(returnTo+"?position=updated");
}
