import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function numberParam(value:unknown,min:number,max:number):number|null {
  if((typeof value!=="number"&&typeof value!=="string")||String(value).trim()==="") return null;
  const n=Number(value);
  return Number.isFinite(n)&&n>=min&&n<=max?n:null;
}

export async function POST(request:NextRequest) {
  let body:Record<string,unknown>;
  try {
    const parsed=await request.json();
    if(!parsed||typeof parsed!=="object"||Array.isArray(parsed)) return NextResponse.json({error:"Paramètres GPS invalides."},{status:400});
    body=parsed as Record<string,unknown>;
  } catch {
    return NextResponse.json({error:"Requête GPS invalide."},{status:400});
  }

  const lat=numberParam(body.lat,-90,90);
  const lng=numberParam(body.lng,-180,180);
  const radius=numberParam(body.rayon_km,1,100);
  if(lat==null||lng==null||radius==null) return NextResponse.json({error:"Coordonnées GPS ou rayon invalides."},{status:400});

  try {
    const {data,error}=await (supabaseAdmin() as any).rpc("get_home_service_catalog_nearby",{
      p_latitude:lat,p_longitude:lng,p_radius_km:radius
    });
    if(error) {
      console.error("[NAXA] Recherche de prestations à proximité indisponible",error);
      return NextResponse.json({error:"La recherche géolocalisée est temporairement indisponible."},{status:503});
    }
    const results=(data??[]).map((row:{offer_id:string;distance_km:number|string})=>({
      offer_id:row.offer_id,distance_km:Number(row.distance_km)
    })).filter((row:{offer_id:string;distance_km:number})=>Number.isFinite(row.distance_km));
    return NextResponse.json({results},{headers:{"Cache-Control":"private, no-store"}});
  } catch(error) {
    console.error("[NAXA] Échec API proximité prestations",error);
    return NextResponse.json({error:"La recherche géolocalisée est temporairement indisponible."},{status:503});
  }
}
