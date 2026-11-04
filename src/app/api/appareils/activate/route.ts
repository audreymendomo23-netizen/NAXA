import { NextRequest,NextResponse } from "next/server";
import { supabaseAdmin,supabaseServer } from "@/lib/supabase/server";
import { PHARMACIE_SCHEMA as S } from "@/lib/pharmacie-schema";
import { readPharmacyCookie } from "@/lib/pharmacie-code-session";
import { createDeviceToken,hashDeviceToken } from "@/lib/appareil-token";
export async function POST(req:NextRequest){
 const pharmacyId=readPharmacyCookie(req);if(!pharmacyId)return NextResponse.json({error:"Session pharmacie expirée."},{status:401});
 try{
  const {data:{user},error:userError}=await supabaseServer().auth.getUser();if(userError||!user)return NextResponse.json({error:"Connexion requise."},{status:401});
  const {data:profile,error:pe}=await supabaseAdmin().from(S.profilesTable).select(`${S.profileIdColumn},${S.profilePharmacyIdColumn},${S.profileActiveColumn},${S.profileRoleColumn},fonction_interne`).eq(S.profileIdColumn,user.id).maybeSingle();
  const profileRecord = profile as unknown as Record<string, unknown> | null;
  const role=String(profileRecord?.[S.profileRoleColumn]??"");
  const internalFunction=String(profileRecord?.fonction_interne??"").trim();
  const authorizedRole=role==="caisse"||(role==="pharmacie"&&internalFunction.length>0);
  if(pe||!profileRecord||profileRecord[S.profileActiveColumn]!==true||!authorizedRole)return NextResponse.json({error:"Fonction professionnelle active requise."},{status:403});
  const {data:canEditStock,error:privilegeError}=await supabaseServer().rpc("naxa_has_privilege",{
    p_privilege:"EDIT_STOCK_QUANTITY",p_pharmacie:pharmacyId,p_scope:"PHARMACIE"
  });
  if(privilegeError||canEditStock!==true)return NextResponse.json({error:"Le privilège Modifier les quantités n'est pas accordé pour cette pharmacie."},{status:403});
  const body=await req.json();
  const name=String(body.name||"Appareil pharmacie").trim().slice(0,100)||"Appareil pharmacie";
  const installationId=String(body.installationId||"");
  if(!/^[0-9a-f-]{36}$/i.test(installationId)) return NextResponse.json({error:"Identifiant local d'appareil invalide."},{status:400});
  const {data:existingDevice,error:existingDeviceError}=await supabaseAdmin().from(S.devicesTable)
    .select(S.deviceIdColumn).eq(S.deviceUserIdColumn,user.id)
    .eq(S.deviceInstallationColumn,installationId).maybeSingle();
  if(existingDeviceError){console.error("NAXA_DEVICE_EXISTENCE_CHECK_FAILED",existingDeviceError);return NextResponse.json({error:"Vérification de l'appareil existant impossible."},{status:503})}
  if(existingDevice)return NextResponse.json({error:"Ce poste est déjà enrôlé sur le serveur. Conservez son stockage local et déverrouillez-le ; aucune rotation automatique du jeton ne sera effectuée."},{status:409});

  const token=createDeviceToken();
  const {data:device,error}=await supabaseAdmin().from(S.devicesTable).insert({
    [S.devicePharmacyIdColumn]:pharmacyId,
    [S.deviceUserIdColumn]:user.id,
    [S.deviceNameColumn]:name,
    [S.deviceTokenHashColumn]:hashDeviceToken(token),
    [S.deviceInstallationColumn]:installationId,
    [S.deviceActiveColumn]:true,
    [S.deviceLastSyncColumn]:new Date().toISOString()
  }).select(S.deviceIdColumn).single();
  const deviceRecord = device as unknown as Record<string, unknown> | null;
  if(error?.code==="23505")return NextResponse.json({error:"Ce poste vient d'être enrôlé dans un autre onglet. Conservez les données locales et déverrouillez-le."},{status:409});
  if(error||!deviceRecord){console.error("NAXA_DEVICE_ACTIVATION_FAILED",error);return NextResponse.json({error:"Activation de l'appareil indisponible. Vérifiez la migration Preview."},{status:500})}
  const {data:ph, error:pharmacyError}=await supabaseAdmin().from(S.pharmaciesTable)
    .select(S.pharmacyNameColumn).eq(S.pharmacyIdColumn,pharmacyId).eq("actif",true).maybeSingle();
  if(pharmacyError||!ph)return NextResponse.json({error:"La pharmacie est inactive ou inaccessible."},{status:403});
  return NextResponse.json({
    deviceId:deviceRecord[S.deviceIdColumn],
    token,
    pharmacyId,
    pharmacyName:ph?.[S.pharmacyNameColumn]??"",
    role,
    canEditStock:true,
    nextDeviceSequence:0,
    serverTimeMs:Date.now()
  });
 }catch(e){console.error("NAXA_DEVICE_ACTIVATION_FAILED",e);return NextResponse.json({error:"Activation impossible."},{status:500})}
}
