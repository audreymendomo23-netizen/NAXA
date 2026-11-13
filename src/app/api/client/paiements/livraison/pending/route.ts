import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { deviceTokenFromRequest } from "@/lib/appareil-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const token=deviceTokenFromRequest(request);
    if(!token) return NextResponse.json({error:"Session Client requise."},{status:401});
    const db=supabaseAdmin();
    const {data:auth,error:authError}=await db.auth.getUser(token);
    if(authError||!auth.user) return NextResponse.json({error:"Session invalide ou expirée."},{status:401});

    const {data:deliveries,error:deliveryError}=await db.from("reservations")
      .select("id,total,frais_livraison,paiement_mode,paiement_statut,commande_statut,livraison_confirmee_stock_at,created_at,pharmacies(nom)")
      .eq("client_id",auth.user.id).eq("mode","commande")
      .not("livraison_confirmee_stock_at","is",null)
      .in("paiement_mode",["mtn_marchand","orange_money"])
      .neq("paiement_statut","effectue")
      .in("commande_statut",["acceptee","preparation","livreur_assigne","en_livraison"])
      .order("created_at",{ascending:false}).limit(30);
    if(deliveryError) return NextResponse.json({error:"Commandes payables indisponibles."},{status:503});

    const deliveryOrders=(deliveries??[]).map((row:any)=>({
      id:row.id,
      paymentType:"delivery",
      paymentLabel:"Livraison · "+(row.pharmacies?.nom??"Pharmacie"),
      pharmacyName:row.pharmacies?.nom??"Pharmacie",
      channel:row.paiement_mode==="mtn_marchand"?"mtn_momo":"orange_money",
      expectedAmount:Number(row.total??0)+Number(row.frais_livraison??0),
      paymentStatus:row.paiement_statut,
      commandStatus:row.commande_statut,
      createdAt:row.created_at,
    })).filter(row=>Number.isSafeInteger(row.expectedAmount)&&row.expectedAmount>0);

    const {data:partnerReservations,error:partnerError}=await db.from("universe_reservations")
      .select("id,partner_id,universe_slug,status,total_fcfa,expires_at,created_at,payment_mode,payment_status,partners(name)")
      .eq("client_id",auth.user.id)
      .in("status",["confirmed","ready"])
      .gt("expires_at",new Date().toISOString())
      .neq("payment_status","confirmed")
      .gt("total_fcfa",0)
      .order("created_at",{ascending:false}).limit(30);
    if(partnerError) return NextResponse.json({error:"Réservations Partenaire payables indisponibles."},{status:503});

    const partnerReservationIds=(partnerReservations??[]).map((r:any)=>r.id);
    const activeIntentByReservation=new Map<string,{canal:string;status:string}>();
    if(partnerReservationIds.length) {
      const {data:intents,error:intentError}=await db.from("naxa_universe_payment_intents")
        .select("reservation_id,canal,status,created_at")
        .in("reservation_id",partnerReservationIds)
        .in("status",["active","submitted"])
        .order("created_at",{ascending:false});
      if(intentError) return NextResponse.json({error:"Intentions de paiement Partenaire indisponibles."},{status:503});
      for(const intent of intents??[]) {
        if(!activeIntentByReservation.has(intent.reservation_id)) {
          activeIntentByReservation.set(intent.reservation_id,{canal:intent.canal,status:intent.status});
        }
      }
    }

    const partners=[...new Set((partnerReservations??[]).map((r:any)=>r.partner_id))];
    const activeChannelsByPartner=new Map<string,string[]>();
    if(partners.length) {
      const {data:destinations,error:destinationError}=await db.from("naxa_merchant_payment_destinations")
        .select("partner_id,canal")
        .in("partner_id",partners)
        .eq("is_active",true);
      if(destinationError) return NextResponse.json({error:"Destinations marchandes Partenaire indisponibles."},{status:503});
      for(const destination of destinations??[]) {
        if(!destination.partner_id) continue;
        const channels=activeChannelsByPartner.get(destination.partner_id)??[];
        if(!channels.includes(destination.canal)) channels.push(destination.canal);
        activeChannelsByPartner.set(destination.partner_id,channels);
      }
    }

    const partnerOrders=(partnerReservations??[]).flatMap((row:any)=>{
      const existing=activeIntentByReservation.get(row.id);
      const channels=existing?[existing.canal]:(activeChannelsByPartner.get(row.partner_id)??[]);
      const partnerName=row.partners?.name??"Partenaire";
      return channels.map(channel=>({
        id:row.id,
        paymentType:"partner_reservation",
        paymentLabel:"Réservation Partenaire · "+partnerName,
        pharmacyName:partnerName,
        channel,
        expectedAmount:Number(row.total_fcfa),
        paymentStatus:row.payment_status,
        commandStatus:row.status,
        universeSlug:row.universe_slug,
        partnerName,
        createdAt:row.created_at,
      }));
    });

    const orders=[...deliveryOrders,...partnerOrders].sort((a,b)=>
      new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime()
    );
    return NextResponse.json({orders},{headers:{"Cache-Control":"no-store"}});
  } catch {
    return NextResponse.json({error:"Lecture des paiements en attente impossible."},{status:503});
  }
}
