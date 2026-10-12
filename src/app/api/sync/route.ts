import {NextRequest,NextResponse} from "next/server";
import {supabaseAdmin} from "@/lib/supabase/server";
import {PHARMACIE_SCHEMA as S} from "@/lib/pharmacie-schema";
import {deviceTokenFromRequest,hashDeviceToken} from "@/lib/appareil-token";
export async function POST(req:NextRequest){
 const token=deviceTokenFromRequest(req);if(!token)return NextResponse.json({error:"Jeton appareil requis."},{status:401});
 try{
  const {data:device,error}=await supabaseAdmin().from(S.devicesTable).select("id,pharmacie_id,utilisateur_id,actif,derniere_synchro,cree_le").eq(S.deviceTokenHashColumn,hashDeviceToken(token)).maybeSingle();
  if(error||!device||!device.actif)return NextResponse.json({error:"Appareil désactivé ou inconnu."},{status:401});
  if(Date.now()-new Date(device.derniere_synchro||device.cree_le).getTime()>7*24*60*60*1000)return NextResponse.json({error:"Appareil expiré après 7 jours sans synchronisation. Reconnectez-vous en ligne.",code:"DEVICE_EXPIRED"},{status:401});
  const body=await req.json();const operations=Array.isArray(body.operations)?body.operations.slice(0,100):[];
  operations.sort((a:any,b:any)=>Number(a.createdAt||0)-Number(b.createdAt||0)||String(a.id).localeCompare(String(b.id)));
  const results=[];
  for(const op of operations){
   if(!op||typeof op.id!=="string"||!/^[0-9a-f-]{36}$/i.test(op.id)||typeof op.type!=="string") {results.push({id:op?.id,status:"rejected"});continue}
   const payload=op.payload&&typeof op.payload==="object"?op.payload:{};
   if(op.type!=="note_caisse_test"){results.push({id:op.id,status:"unsupported_operation"});continue}\n   const status="appliquee";
   const {error:insertError}=await supabaseAdmin().from(S.operationsTable).insert({id:op.id,appareil_id:device.id,pharmacie_id:device.pharmacie_id,utilisateur_id:device.utilisateur_id,type:op.type,payload,statut:status});
   if(insertError?.code==="23505"){results.push({id:op.id,status:"already_applied"});continue}
   if(insertError){console.error("NAXA_SYNC_OPERATION_FAILED",insertError);results.push({id:op.id,status:"retry"});continue}
   results.push({id:op.id,status:"applied"});
  }
  const now=new Date().toISOString();
  await supabaseAdmin().from(S.devicesTable).update({[S.deviceLastSyncColumn]:now}).eq(S.deviceIdColumn,device.id);
  const {data:reference}=await supabaseAdmin().from(S.pharmaciesTable).select("id,nom,stock_updated_at").eq("id",device.pharmacie_id).maybeSingle();
  return NextResponse.json({ok:true,results,reference:reference?{pharmacie:reference}:null,syncedAt:now});
 }catch(e){console.error("NAXA_SYNC_FAILED",e);return NextResponse.json({error:"Synchronisation indisponible."},{status:500})}
}
