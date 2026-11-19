import { NextResponse } from "next/server";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function POST(request:Request){
 const session=supabaseServer(); const {data:auth,error:authError}=await session.auth.getUser();
 if(authError||!auth.user)return NextResponse.json({error:"Connexion requise."},{status:401});
 let body:{ticket_id?:string}; try{body=await request.json();}catch{return NextResponse.json({error:"Demande invalide."},{status:400});}
 const ticketId=String(body.ticket_id??"").trim(); if(!UUID.test(ticketId))return NextResponse.json({error:"Dossier invalide."},{status:400});
 const {data,error}=await supabaseAdmin().rpc("naxa_support_call_request",{p_actor_user_id:auth.user.id,p_ticket_id:ticketId});
 if(error||!data)return NextResponse.json({error:"L’appel n’a pas pu être lancé : "+(error?.message??"indisponible")},{status:409});
 return NextResponse.json({success:true,call:data},{status:201,headers:{"Cache-Control":"private, no-store"}});
}
