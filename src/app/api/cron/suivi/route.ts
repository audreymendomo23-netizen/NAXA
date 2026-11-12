import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import webpush from "web-push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const weekdays:Record<string,number>={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6};
function zoned(date:Date,timezone:string) {
  const parts=new Intl.DateTimeFormat("en-US",{timeZone:timezone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",weekday:"short",hourCycle:"h23"}).formatToParts(date);
  const v=Object.fromEntries(parts.map(x=>[x.type,x.value]));
  return {date:`${v.year}-${v.month}-${v.day}`,time:`${v.hour}:${v.minute}`,weekday:weekdays[String(v.weekday)]};
}
function family(type:string):string|null {
  if(["tension_systolique","tension_diastolique","tension_arterielle_moyenne","frequence_cardiaque","temperature","saturation_oxygene","frequence_respiratoire","debit_expiratoire","ecg_note","capacite_vitale"].includes(type)) return "constantes";
  if(["glycemie","poids","taille","imc","cholesterol_total","masse_grasse","masse_musculaire","masse_osseuse","cetonemie","acide_urique","cholesterol_hdl","cholesterol_ldl","pourcentage_musculaire","masse_maigre","masse_maigre_molle","masse_eau_corporelle","metabolisme_basal"].includes(type)) return "metabolisme";
  if(["pas_jour","activite_minutes","hydratation_ml","vitesse_course","cadence_course","longueur_foulee"].includes(type)) return "activite";
  if(type==="sommeil_heures") return "sommeil";
  if(["douleur_score","humeur_score","cycle_jour","symptome_note"].includes(type)) return "bien_etre";
  if(type==="medicament_pris") return "traitements";
  return null;
}

export async function GET(request:Request) {
  const auth=request.headers.get("authorization")??"";
  const bearer=auth.startsWith("Bearer ")?auth.slice(7).trim():"";
  if(!bearer) return NextResponse.json({error:"Non autorisé"},{status:401});
  let db:ReturnType<typeof supabaseAdmin>;
  try { db=supabaseAdmin(); } catch { return NextResponse.json({error:"Supabase indisponible"},{status:503}); }
  if(process.env.VERCEL_ENV==="production") {
    const {data,error}=await db.rpc("naxa_verify_posology_cron_secret",{p_candidate:bearer});
    if(error||data!==true) return NextResponse.json({error:"Non autorisé"},{status:401});
  } else if(!process.env.CRON_SECRET||bearer!==process.env.CRON_SECRET) {
    return NextResponse.json({error:"Non autorisé"},{status:401});
  }
  const {data:feature}=await db.from("feature_flags").select("enabled")
    .eq("flag_key","suivi_connecte").maybeSingle();
  if(!feature?.enabled) return NextResponse.json({ok:true,disabled:true,reason:"suivi_connecte_disabled"});

  const pub=process.env.NAXA_VAPID_PUBLIC_KEY,priv=process.env.NAXA_VAPID_PRIVATE_KEY;
  const pushConfigured=!!pub&&!!priv;
  if(pushConfigured) webpush.setVapidDetails(
    process.env.NAXA_VAPID_SUBJECT||"mailto:naxa.home@gmail.com",pub!,priv!
  );

  const now=new Date();
  const {data:schedules,error}=await db.from("suivi_measurement_schedules")
    .select("id,user_id,measurement_type,device_id,local_time,timezone,days_of_week,lead_minutes,freshness_window_minutes,last_prealert_key")
    .eq("enabled",true).limit(5000);
  if(error) return NextResponse.json({error:"Lecture des programmations impossible"},{status:500});
  let checked=0,stale=0,inApp=0,pushSent=0,failed=0;
  for(const s of schedules??[]) {
    checked++;
    const group=family(s.measurement_type);
    if(!group) continue;
    const {data:consent}=await db.from("suivi_consents").select("granted,revoked_at").eq("user_id",s.user_id).eq("family_key",group).maybeSingle();
    if(!consent?.granted||consent.revoked_at) continue;
    const lead=Math.max(1,Math.min(30,Number(s.lead_minutes)||5));
    let target;
    try { target=zoned(new Date(now.getTime()+lead*60000),String(s.timezone||"Africa/Douala")); } catch { failed++; continue; }
    if(String(s.local_time).slice(0,5)!==target.time) continue;
    const activeDays=Array.isArray(s.days_of_week)?s.days_of_week.map(Number):[0,1,2,3,4,5,6];
    if(!activeDays.includes(target.weekday)) continue;
    const key=target.date+"T"+String(s.local_time).slice(0,5);
    if(s.last_prealert_key===key) continue;
    const freshMins=Math.max(1,Math.min(1440,Number(s.freshness_window_minutes)||5));
    let query=db.from("suivi_measurements").select("id").eq("user_id",s.user_id).eq("measurement_type",s.measurement_type)
      .gte("received_at",new Date(now.getTime()-freshMins*60000).toISOString()).limit(1);
    if(s.device_id) query=query.eq("device_id",s.device_id);
    const {data:recent,error:readError}=await query;
    if(readError){failed++;continue;}
    if(recent?.length) continue;
    const {data:claimed,error:claimError}=await db.from("suivi_measurement_schedules")
      .update({last_prealert_key:key,updated_at:now.toISOString()}).eq("id",s.id)
      .or(`last_prealert_key.is.null,last_prealert_key.neq.${key}`).select("id").maybeSingle();
    if(claimError||!claimed) continue;
    stale++;
    const {error:noteError}=await db.from("notifications").insert({
      user_id:s.user_id,type:"suivi_mesure_non_actualisee",titre:"Rappel de mesure NAXA",
      corps:"Aucune donnée récente n'a été reçue avant l'heure de mesure programmée. Vérifiez votre appareil et sa synchronisation."
    });
    if(!noteError) inApp++; else failed++;
    if(pushConfigured){
      const {data:subs,error:subsError}=await db.from("naxa_push_subscriptions")
        .select("endpoint,subscription").eq("user_id",s.user_id);
      if(subsError){failed++;continue;}
      for(const sub of subs??[]) try {
        await webpush.sendNotification(sub.subscription,JSON.stringify({
          title:"NAXA · Rappel de mesure",
          body:"Vos données ne sont pas actualisées avant l'heure programmée. Vérifiez votre appareil.",
          url:"/suivi",tag:`suivi-h5-${s.id}-${key}`
        }),{TTL:300,urgency:"high"});
        pushSent++;
      } catch(e) {
        failed++;
        const status=(e as {statusCode?:number}).statusCode;
        if(status===404||status===410) await db.from("naxa_push_subscriptions").delete().eq("endpoint",sub.endpoint).eq("user_id",s.user_id);
      }
    }
  }

  const {data:outbox,error:outboxError}=await db.from("suivi_push_outbox")
    .select("id,patient_user_id,recipient_user_id,measurement_type,attempt_count,in_app_created_at")
    .is("processed_at",null).lt("attempt_count",8)
    .order("created_at",{ascending:true}).limit(300);
  if(outboxError) failed++;
  else for(const item of outbox??[]) {
    const {data:claimed}=await db.from("suivi_push_outbox")
      .update({attempt_count:(item.attempt_count??0)+1,locked_until:new Date(now.getTime()+60000).toISOString()})
      .eq("id",item.id).is("processed_at",null)
      .or("locked_until.is.null,locked_until.lt."+now.toISOString()).select("id").maybeSingle();
    if(!claimed) continue;

    // Réévaluer les droits au moment de l'envoi : un consentement révoqué
    // après la mise en file ne doit jamais déclencher une notification tardive.
    const {data:consent}=await db.from("suivi_consents")
      .select("granted,revoked_at").eq("user_id",item.patient_user_id)
      .eq("family_key",family(item.measurement_type)??"").maybeSingle();
    const {data:patientAccount}=await db.from("profiles").select("actif")
      .eq("id",item.patient_user_id).maybeSingle();
    let authorized=!!consent?.granted&&!consent?.revoked_at&&patientAccount?.actif===true;
    if(authorized&&item.recipient_user_id!==item.patient_user_id){
      const [shareResult,linkResult,professionalResult,recipientAccount]=await Promise.all([
        db.from("suivi_shares").select("id").eq("owner_user_id",item.patient_user_id)
          .eq("recipient_user_id",item.recipient_user_id).eq("measurement_type",item.measurement_type)
          .eq("active",true).eq("allow_alerts",true).is("revoked_at",null).maybeSingle(),
        db.from("suivi_care_links").select("id").eq("patient_user_id",item.patient_user_id)
          .eq("professional_user_id",item.recipient_user_id).eq("active",true)
          .eq("alerts_access",true).is("revoked_at",null).maybeSingle(),
        db.rpc("suivi_is_verified_professional",{p_user_id:item.recipient_user_id}),
        db.from("profiles").select("actif").eq("id",item.recipient_user_id).maybeSingle()
      ]);
      authorized=professionalResult.data===true&&recipientAccount.data?.actif===true
        &&(!shareResult.error&&!!shareResult.data||!linkResult.error&&!!linkResult.data);
    }
    if(!authorized){
      await db.from("suivi_push_outbox").update({
        processed_at:now.toISOString(),locked_until:null,
        last_error:"Envoi annulé : compte, consentement ou autorisation révoqué(e)"
      }).eq("id",item.id);
      continue;
    }

    const {data:subs,error:subError}=pushConfigured
      ? await db.from("naxa_push_subscriptions").select("endpoint,subscription").eq("user_id",item.recipient_user_id)
      : {data:[],error:null};
    if(subError){
      failed++;
      await db.from("suivi_push_outbox").update({
        locked_until:null,last_error:"Lecture des abonnements Push impossible"
      }).eq("id",item.id);
      continue;
    }

    let pushed=false;
    let pushError:string|null=null;
    for(const sub of subs??[]) try {
      await webpush.sendNotification(sub.subscription,JSON.stringify({
        title:"NAXA · Alerte de suivi",
        body:"Une nouvelle alerte liée à un suivi autorisé est disponible dans NAXA.",
        url:item.recipient_user_id===item.patient_user_id?"/suivi":"/suivi/professionnel",
        tag:"suivi-alert-"+item.id
      }),{TTL:300,urgency:"high"});
      pushed=true;pushSent++;
    } catch(e) {
      failed++;
      const status=(e as {statusCode?:number}).statusCode;
      if(status===404||status===410) {
        await db.from("naxa_push_subscriptions").delete().eq("endpoint",sub.endpoint).eq("user_id",item.recipient_user_id);
      } else {
        pushError="Échec d'envoi Push";
      }
    }
    const {error:finishError}=await db.from("suivi_push_outbox").update({
      processed_at:inAppDone?now.toISOString():null,
      locked_until:null,
      last_error:pushError??(pushed?null:pushConfigured?"Aucun abonnement Push actif":"Push désactivé : clés VAPID non configurées")
    }).eq("id",item.id);
    if(finishError) failed++;
  }
  return NextResponse.json({ok:true,checked,stale,inApp,pushSent,failed,at:now.toISOString()});
}
