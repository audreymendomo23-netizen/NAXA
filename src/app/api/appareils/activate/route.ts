import { NextRequest,NextResponse } from "next/server";
import { supabaseAdmin,supabaseServer } from "@/lib/supabase/server";
import { PHARMACIE_SCHEMA as S } from "@/lib/pharmacie-schema";
import { readPharmacyCookie } from "@/lib/pharmacie-code-session";
import { createDeviceToken,hashDeviceToken } from "@/lib/appareil-token";
export async function POST(req:NextRequest){
 const pharmacyId=readPharmacyCookie(req);if(!pharmacyId)return NextResponse.json({error:"Session pharmacie expirée."},{status:401});
 try{
  const {data:{user},error:userError}=await supabaseServer().auth.getUser();if(userError||!user)return NextResponse.json({error:"Connexion requise."},{status:401});
  const {data:profile,error:pe}=await supabaseAdmin().from(S.profilesTable).select(`${S.profileIdColumn},${S.profilePharmacyIdColumn},${S.profileActiveColumn}`).eq(S.profileIdColumn,user.id).maybeSingle();
  const profileRecord = profile as unknown as Record<string, unknown> | null;
  if(pe||!profileRecord||profileRecord[S.profileActiveColumn]===false||profileRecord[S.profilePharmacyIdColumn]!==pharmacyId)return NextResponse.json({error:"Identifiants non valides pour cette pharmacie"},{status:403});
  const body=await req.json();
  const name=String(body.name||"Appareil pharmacie").trim().slice(0,100)||"Appareil pharmacie";
  const installationId=String(body.installationId||"");
  if(!/^[0-9a-f-]{36}$/i.test(installationId)) return NextResponse.json({error:"Identifiant local d'appareil invalide."},{status:400});
  const token=createDeviceToken();
  const {data:device,error}=await supabaseAdmin().from(S.devicesTable).upsert({
    [S.devicePharmacyIdColumn]:pharmacyId,
    [S.deviceUserIdColumn]:user.id,
    [S.deviceNameColumn]:name,
    [S.deviceTokenHashColumn]:hashDeviceToken(token),
    [S.deviceInstallationColumn]:installationId,
    [S.deviceActiveColumn]:true,
    [S.deviceLastSyncColumn]:new Date().toISOString()
  },{onConflict:`${S.deviceUserIdColumn},${S.deviceInstallationColumn}`}).select(S.deviceIdColumn).single();
  const deviceRecord = device as unknown as Record<string, unknown> | null;
  if(error||!deviceRecord){console.error("NAXA_DEVICE_ACTIVATION_FAILED",error);return NextResponse.json({error:"Activation de l'appareil indisponible. Vérifiez la migration Preview."},{status:500})}
  const {data:ph}=await supabaseAdmin().from(S.pharmaciesTable).select(S.pharmacyNameColumn).eq(S.pharmacyIdColumn,pharmacyId).single();
  return NextResponse.json({deviceId:deviceRecord[S.deviceIdColumn],token,pharmacyId,pharmacyName:ph?.[S.pharmacyNameColumn]??""});
 }catch(e){console.error("NAXA_DEVICE_ACTIVATION_FAILED",e);return NextResponse.json({error:"Activation impossible."},{status:500})}
}
