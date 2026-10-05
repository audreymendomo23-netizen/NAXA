import { NextResponse } from "next/server";import { supabaseAdmin } from "@/lib/supabase/server";
export async function GET(req:Request){
 const secret=process.env.CRON_SECRET;
 if(!secret||req.headers.get("authorization")!==`Bearer ${secret}`)return NextResponse.json({error:"Unauthorized"},{status:401});
 const sb=supabaseAdmin();
 const {error:blockError}=await sb.rpc("synchroniser_validite_pharmacies");
 if(blockError)return NextResponse.json({error:blockError.message},{status:500});
 const {data:rows,error}=await sb.rpc("claim_validite_rappels_5j");
 if(error)return NextResponse.json({error:error.message},{status:500});
 const key=process.env.RESEND_API_KEY,from=process.env.REPORT_FROM_EMAIL;
 if(!rows?.length)return NextResponse.json({blocked:"ok",reminders:0});
 if(!key||!from)return NextResponse.json({error:"RESEND_API_KEY et REPORT_FROM_EMAIL requis",reminders:0},{status:503});
 let sent=0;
 for(const r of rows){
   const rr=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"Authorization":`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({
     from,to:[r.promoteur_email],subject:"NAXA — rappel : échéance de votre pharmacie dans 5 jours",
     html:`<div style="font-family:Arial,sans-serif"><h1>NAXA</h1><p>Bonjour ${String(r.promoteur_prenom||"").replace(/</g,"&lt;")},</p><p>La validité de la pharmacie <strong>${String(r.pharmacie_nom).replace(/</g,"&lt;")}</strong> arrive à échéance le <strong>${r.echeance}</strong>.</p><p>Montant mensuel à régler : <strong>${Number(r.montant_mensuel).toLocaleString("fr-FR")} FCFA</strong>.</p><p>Merci de procéder au règlement avant l’échéance afin d’éviter le blocage de la pharmacie et l’indisponibilité de ses produits côté client.</p><p>Si le règlement est effectué, NAXA réactive la pharmacie après validation administrative.</p></div>`
   })});
   if(rr.ok){await sb.rpc("marquer_rappel_validite",{p_pharmacie:r.pharmacie_id});sent++}
 }
 return NextResponse.json({blocked:"ok",reminders:sent,total:rows.length});
}
