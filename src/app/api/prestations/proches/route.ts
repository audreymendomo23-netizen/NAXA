import { NextRequest, NextResponse } from "next/server";
import { supabasePublic } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function numberParam(value:string|null,min:number,max:number):number|null {
  if(value==null||value.trim()==="") return null;
  const n=Number(value);
  return Number.isFinite(n)&&n>=min&&n<=max?n:null;
}

export async function GET(request:NextRequest) {
  const params=request.nextUrl.searchParams;
  const lat=numberParam(params.get("lat"),-90,90);
  const lng=numberParam(params.get("lng"),-180,180);
  const radius=numberParam(params.get("rayon_km"),1,100);
  if(lat==null||lng==null||radius==null) return NextResponse.json({error:"Coordonnées GPS ou rayon invalides."},{status:400});
  try {
    const {data,error} = await (supabasePublic(0) as any).rpc("get_home_service_catalog_nearby",{p_latitude:lat,p_longitude:lng,p_radius_km:radius});
    if(error) {
      console.error("[NAXA] Recherche de prestations à proximité indisponible",error);
      return NextResponse.json({error:"La recherche géolocalisée est temporairement indisponible."},{status:503});
    }
    const results=(data??[]).map((row:{offer_id:string;distance_km:number|string})=>({offer_id:row.offer_id,distance_km:Number(row.distance_km)}))
      .filter((row:{offer_id:string;distance_km:number})=>Number.isFinite(row.distance_km));
    return NextResponse.json({results},{headers:{"Cache-Control":"private, no-store"}});
  } catch(error) {
    console.error("[NAXA] Échec API proximité prestations",error);
    return NextResponse.json({error:"La recherche géolocalisée est temporairement indisponible."},{status:503});
  }
}
