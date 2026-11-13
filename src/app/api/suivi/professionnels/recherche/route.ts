import { NextRequest,NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime="nodejs";
export const dynamic="force-dynamic";

type DirectoryRow={
  user_id:string;partner_id:string;professional_role:string;display_name:string;specialty:string|null;
  partner_name:string;city:string|null;neighborhood:string|null;
  latitude:number|string|null;longitude:number|string|null;
  available_today:boolean;available_now:boolean;today_opens_at:string|null;today_closes_at:string|null;
};

function validCoordinate(value:unknown,min:number,max:number):number|null{
  if(typeof value!=="number"||!Number.isFinite(value)||value<min||value>max)return null;
  return value;
}
function distanceKm(a:number,b:number,c:number,d:number){
  const rad=(v:number)=>v*Math.PI/180;
  const dLat=rad(c-a),dLng=rad(d-b);
  const h=Math.sin(dLat/2)**2+Math.cos(rad(a))*Math.cos(rad(c))*Math.sin(dLng/2)**2;
  return 6371*2*Math.asin(Math.min(1,Math.sqrt(h)));
}

export async function POST(request:NextRequest){
  const sb=supabaseServer();
  const {data:auth,error:authError}=await sb.auth.getUser();
  if(authError||!auth.user)return NextResponse.json({error:"Connexion requise."},{status:401});

  const [{data:enabled,error:enabledError},{data:profile,error:profileError}]=await Promise.all([
    sb.rpc("suivi_is_enabled_user",{p_user_id:auth.user.id}),
    sb.from("profiles").select("actif").eq("id",auth.user.id).maybeSingle()
  ]);
  if(enabledError||enabled!==true||profileError||profile?.actif!==true){
    return NextResponse.json({error:"L’annuaire médical n’est pas accessible à ce compte."},{status:403});
  }

  let body:Record<string,unknown>={};
  try{
    const parsed=await request.json();
    if(parsed&&typeof parsed==="object"&&!Array.isArray(parsed))body=parsed as Record<string,unknown>;
  }catch{
    return NextResponse.json({error:"Requête de recherche invalide."},{status:400});
  }
  const lat=body.lat===undefined?null:validCoordinate(body.lat,-90,90);
  const lng=body.lng===undefined?null:validCoordinate(body.lng,-180,180);
  if((body.lat!==undefined&&lat===null)||(body.lng!==undefined&&lng===null)||((lat===null)!==(lng===null))){
    return NextResponse.json({error:"Position GPS invalide."},{status:400});
  }
  const radius=typeof body.radius_km==="number"&&Number.isFinite(body.radius_km)?Math.min(100,Math.max(1,body.radius_km)):25;

  try{
    const {data:rows,error}=await sb.rpc("suivi_list_independent_partner_directory");
    if(error)throw error;
    const directory=(rows??[]) as DirectoryRow[];
    const results=directory.flatMap(row=>{
      const partnerLat=row.latitude===null?null:Number(row.latitude);
      const partnerLng=row.longitude===null?null:Number(row.longitude);
      const validLat=partnerLat!==null&&Number.isFinite(partnerLat)&&partnerLat>=-90&&partnerLat<=90?partnerLat:null;
      const validLng=partnerLng!==null&&Number.isFinite(partnerLng)&&partnerLng>=-180&&partnerLng<=180?partnerLng:null;
      const distance=lat!==null&&lng!==null&&validLat!==null&&validLng!==null
        ?distanceKm(lat,lng,validLat,validLng):null;
      if(lat!==null&&lng!==null&&(distance===null||distance>radius))return [];
      return [{
        user_id:row.user_id,professional_role:row.professional_role,display_name:row.display_name,
        specialty:row.specialty,partner_name:row.partner_name,city:row.city,neighborhood:row.neighborhood,
        distance_km:distance===null?null:Math.round(distance*10)/10,
        available_today:!!row.available_today,available_now:!!row.available_now,
        today_opens_at:row.today_opens_at?String(row.today_opens_at).slice(0,5):null,
        today_closes_at:row.today_closes_at?String(row.today_closes_at).slice(0,5):null
      }];
    });
    results.sort((a,b)=>{
      if(lat!==null&&lng!==null)return (a.distance_km??Number.MAX_SAFE_INTEGER)-(b.distance_km??Number.MAX_SAFE_INTEGER);
      return a.display_name.localeCompare(b.display_name,"fr");
    });
    return NextResponse.json({results},{headers:{"Cache-Control":"private, no-store"}});
  }catch(error){
    console.error("[NAXA] Annuaire professionnel indépendant indisponible",error);
    return NextResponse.json({error:"L’annuaire des professionnels est temporairement indisponible."},{status:503});
  }
}
