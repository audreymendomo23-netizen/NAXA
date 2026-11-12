import { NextResponse } from "next/server";
import { loadPromoteurAccess } from "@/lib/promoteur-access";
import { supabaseAdmin } from "@/lib/supabase/server";
export const runtime="nodejs";
export const dynamic="force-dynamic";
type TimeSample={gateway_id:string;ntp_server:string;ntp_stratum:number;offset_ms:number;round_trip_ms:number;clock_status:string;measured_at:string};
export async function GET(){
 try{
  const access=await loadPromoteurAccess();
  if(access.profile.role!=="promoteur"||access.profile.actif!==true||access.shouldShowAccessStatus||access.linksError||access.pharmaciesError)
   return NextResponse.json({ok:false,error:"Accès Promoteur indisponible."},{status:403,headers:{"Cache-Control":"no-store"}});
  const pharmacyIds=(access.pharmacies??[]).filter(p=>access.activeLinkIds.has(p.id)&&p.actif&&p.visible_recherche&&p.archivee_le===null).map(p=>p.id);
  if(!pharmacyIds.length)return NextResponse.json({ok:true,gateways:[]},{headers:{"Cache-Control":"no-store"}});
  const db=supabaseAdmin();
  const {data:gateways,error}=await db.from("naxa_security_gateways").select("id,pharmacie_id,label,tunnel_status,last_seen_at").in("pharmacie_id",pharmacyIds).order("updated_at",{ascending:false}).limit(100);
  if(error)return NextResponse.json({ok:false,error:"Registre passerelle indisponible."},{status:503});
  const ids=(gateways??[]).map(g=>g.id);
  const {data:samples,error:sampleError}=ids.length?await db.from("naxa_security_gateway_time_samples")
    .select("gateway_id,ntp_server,ntp_stratum,offset_ms,round_trip_ms,clock_status,measured_at")
    .in("gateway_id",ids).order("measured_at",{ascending:false}).limit(Math.min(500,ids.length*5))
    :{data:[] as TimeSample[],error:null};
  if(sampleError)return NextResponse.json({ok:false,error:"Historique temporel indisponible."},{status:503});
  const latest=new Map<string,TimeSample>();
  for(const s of (samples??[]) as TimeSample[])if(!latest.has(s.gateway_id))latest.set(s.gateway_id,s);
  const names=new Map((access.pharmacies??[]).map(p=>[p.id,p.nom]));
  return NextResponse.json({ok:true,gateways:(gateways??[]).map(g=>{
    const s=latest.get(g.id);
    return {id:g.id,label:g.label,pharmacyName:names.get(g.pharmacie_id)??"Pharmacie",sample:s?{
      ntpServer:s.ntp_server,stratum:s.ntp_stratum,offsetMs:s.offset_ms,roundTripMs:s.round_trip_ms,clockStatus:s.clock_status,measuredAt:s.measured_at
    }:null};
  })},{headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({ok:false,error:"État temporel indisponible."},{status:500});}
}
