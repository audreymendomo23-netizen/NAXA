import { NextRequest,NextResponse } from "next/server";
import { supabaseAdmin,supabaseServer } from "@/lib/supabase/server";
import { PHARMACIE_SCHEMA as S } from "@/lib/pharmacie-schema";
export async function POST(req:NextRequest){
 try{
  const {data:{user},error}=await supabaseServer().auth.getUser();if(error||!user)return NextResponse.json({error:"Connexion requise."},{status:401});
  const {data:actor}=await supabaseAdmin().from(S.profilesTable).select(`${S.profileIdColumn},${S.profilePharmacyIdColumn},${S.profileRoleColumn},${S.profileActiveColumn}`).eq(S.profileIdColumn,user.id).maybeSingle();
  if(!actor||actor[S.profileActiveColumn]===false||!["promoteur","admin"].includes(String(actor[S.profileRoleColumn])))return NextResponse.json({error:"Action réservée au promoteur ou à l'administrateur NAXA."},{status:403});
  const body=await req.json();const deviceId=String(body.deviceId||"");
  const q=supabaseAdmin().from(S.devicesTable).update({[S.deviceActiveColumn]:false}).eq(S.deviceIdColumn,deviceId);
  if(actor[S.profileRoleColumn]!=="admin")q.eq(S.devicePharmacyIdColumn,actor[S.profilePharmacyIdColumn]);
  const {data,error:updateError}=await q.select(S.deviceIdColumn).maybeSingle();
  if(updateError||!data)return NextResponse.json({error:"Appareil introuvable ou non autorisé."},{status:404});
  return NextResponse.json({ok:true});
 }catch{return NextResponse.json({error:"Désactivation impossible."},{status:500})}
}
