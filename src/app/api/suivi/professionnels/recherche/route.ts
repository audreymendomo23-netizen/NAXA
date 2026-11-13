import { NextRequest,NextResponse } from "next/server";
import { supabaseServer,supabaseAdmin } from "@/lib/supabase/server";

export const runtime="nodejs";
export const dynamic="force-dynamic";

type ProfessionalRow={user_id:string;professional_role:string;display_name:string;specialty:string|null;verification_expires_at:string|null};
type MemberRow={user_id:string;member_role:string;partners:{id:string;name:string;city:string|null;neighborhood:string|null;latitude:number|null;longitude:number|null;provider_latitude:number|null;provider_longitude:number|null;status:string;partner_type:string}};
type AvailabilityRow={user_id:string;is_open:boolean;opens_at:string|null;closes_at:string|null};

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
    const db=supabaseAdmin() as any;
    const {data:rows,error}=await db.from("suivi_professionals")
      .select("user_id,professional_role,display_name,specialty,verification_expires_at")
      .eq("verified",true).eq("verification_status","verified").limit(1000);
    if(error)throw error;
    const activeRows=(rows??[]) as ProfessionalRow[];
    const unexpired=activeRows.filter(row=>!row.verification_expires_at||new Date(row.verification_expires_at).getTime()>Date.now());
    const ids=unexpired.map(row=>row.user_id);
    if(!ids.length)return NextResponse.json({results:[]},{headers:{"Cache-Control":"private, no-store"}});
    const weekdayLabel=new Intl.DateTimeFormat("en-US",{timeZone:"Africa/Douala",weekday:"short"}).format(new Date());
    const weekday:Record<string,number>={Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6,Sun:7};
    const isoWeekday=weekday[weekdayLabel]??1;
    const [profilesResult,membersResult,availabilityResult]=await Promise.all([
      db.from("profiles").select("id,actif").in("id",ids).eq("actif",true),
      db.from("partner_members").select("user_id,member_role,partners!inner(id,name,city,neighborhood,latitude,longitude,provider_latitude,provider_longitude,status,partner_type)")
        .in("user_id",ids).eq("partners.status","active").eq("partners.partner_type","professionnel_domicile"),
      db.from("suivi_professional_weekly_availability").select("user_id,is_open,opens_at,closes_at")
        .in("user_id",ids).eq("weekday",isoWeekday)
    ]);
    if(profilesResult.error||membersResult.error||availabilityResult.error)throw profilesResult.error||membersResult.error||availabilityResult.error;
    const activeIds=new Set((profilesResult.data??[]).map((row:{id:string})=>row.id));
    const members=(membersResult.data??[]) as MemberRow[];
    const availabilities=(availabilityResult.data??[]) as AvailabilityRow[];
    const localParts=new Intl.DateTimeFormat("en-GB",{timeZone:"Africa/Douala",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date());
    const nowTime=localParts.find(p=>p.type==="hour")?.value+":"+localParts.find(p=>p.type==="minute")?.value;
    const results=unexpired.filter(row=>activeIds.has(row.user_id)).flatMap(row=>{
      const memberRows=members.filter(member=>member.user_id===row.user_id);
      const availability=availabilities.find(item=>item.user_id===row.user_id);
      const todayOpen=!!availability?.is_open&&!!availability.opens_at&&!!availability.closes_at;
      const todayOpens=todayOpen?String(availability!.opens_at).slice(0,5):null;
      const todayCloses=todayOpen?String(availability!.closes_at).slice(0,5):null;
      const nowOpen=!!(todayOpen&&nowTime>=todayOpens!&&nowTime<todayCloses!);
      const listings=memberRows.length?memberRows.map(member=>{
        const partner=member.partners;
        const effectiveLat=partner.provider_latitude??partner.latitude;
        const effectiveLng=partner.provider_longitude??partner.longitude;
        const distance=lat!==null&&lng!==null&&effectiveLat!==null&&effectiveLng!==null
          ?distanceKm(lat,lng,Number(effectiveLat),Number(effectiveLng)):null;
        return {partner_name:partner.name,city:partner.city,neighborhood:partner.neighborhood,distance_km:distance};
      }):[{partner_name:null,city:null,neighborhood:null,distance_km:null}];
      const best=[...listings].sort((a,b)=>{
        if(lat!==null&&lng!==null)return (a.distance_km??Number.MAX_SAFE_INTEGER)-(b.distance_km??Number.MAX_SAFE_INTEGER);
        return 0;
      })[0];
      if(lat!==null&&lng!==null&&best.distance_km===null)return [];
      if(lat!==null&&lng!==null&&best.distance_km!==null&&best.distance_km>radius)return [];
      return [{
        user_id:row.user_id,professional_role:row.professional_role,display_name:row.display_name,
        specialty:row.specialty,partner_name:best.partner_name,city:best.city,neighborhood:best.neighborhood,
        distance_km:best.distance_km===null?null:Math.round(best.distance_km*10)/10,
        available_today:todayOpen,available_now:nowOpen,
        today_opens_at:todayOpens,today_closes_at:todayCloses
      }];
    });
    return NextResponse.json({results},{headers:{"Cache-Control":"private, no-store"}});
  }catch(error){
    console.error("[NAXA] Annuaire professionnel indisponible",error);
    return NextResponse.json({error:"L’annuaire des professionnels est temporairement indisponible."},{status:503});
  }
}
