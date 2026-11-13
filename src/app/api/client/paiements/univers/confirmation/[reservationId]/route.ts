import { NextResponse } from "next/server";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";
import { deviceTokenFromRequest } from "@/lib/appareil-token";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(request:Request,{params}:{params:Promise<{reservationId:string}>}) {
  try {
    const {reservationId}=await params;
    if(!/^[0-9a-f-]{36}$/i.test(reservationId)) return NextResponse.json({error:"Réservation invalide."},{status:400});
    const token=deviceTokenFromRequest(request);
    const db=supabaseAdmin();
    const authResult=token?await db.auth.getUser(token):await supabaseServer().auth.getUser();
    if(authResult.error||!authResult.data.user) return NextResponse.json({error:"Connexion Client requise."},{status:401});
    const userId=authResult.data.user.id;

    const {data:confirmation,error}=await db.from("naxa_universe_payment_confirmations")
      .select("id,receipt_number,canal,transaction_reference,amount_fcfa,destination_snapshot,payer_number_tail,payer_occurred_at,merchant_occurred_at,merchant_received_at,confirmed_at")
      .eq("reservation_id",reservationId).eq("client_id",userId).maybeSingle();
    if(error) return NextResponse.json({error:"Reçu de confirmation indisponible."},{status:503});
    if(confirmation) {
      const snapshot=confirmation.destination_snapshot&&typeof confirmation.destination_snapshot==="object"
        ? confirmation.destination_snapshot as Record<string,unknown> : {};
      return NextResponse.json({
        status:"financially_confirmed",
        confirmation:{
          receiptNumber:confirmation.receipt_number,
          channel:confirmation.canal,
          transactionReference:confirmation.transaction_reference,
          amount:confirmation.amount_fcfa,
          merchantName:typeof snapshot.merchant_name==="string"?snapshot.merchant_name:null,
          merchantPhone:typeof snapshot.merchant_phone==="string"?snapshot.merchant_phone:null,
          confirmedAt:confirmation.confirmed_at,
          merchantSmsReceivedAt:confirmation.merchant_received_at,
          providerOccurredAt:confirmation.merchant_occurred_at??confirmation.payer_occurred_at,
        },
      },{headers:{"Cache-Control":"no-store"}});
    }

    const {data:reservation,error:reservationError}=await db.from("universe_reservations")
      .select("payment_status,payment_mode")
      .eq("id",reservationId).eq("client_id",userId).maybeSingle();
    if(reservationError||!reservation) return NextResponse.json({error:"Réservation introuvable."},{status:404});

    const {data:intent}=await db.from("naxa_universe_payment_intents")
      .select("transaction_reference,status,proof_source,canal")
      .eq("reservation_id",reservationId).eq("client_id",userId)
      .order("created_at",{ascending:false}).limit(1).maybeSingle();

    const status=reservation.payment_status==="manual_review"?"manual_review":
      intent?.status==="submitted"||intent?.status==="matched"?"awaiting_pair":
      intent?.status==="active"?"intent_active":"not_submitted";

    return NextResponse.json({
      status,
      paymentMode:reservation.payment_mode,
      transactionReference:intent?.transaction_reference??null,
      intentChannel:intent?.canal??null,
    },{headers:{"Cache-Control":"no-store"}});
  } catch {
    return NextResponse.json({error:"Lecture de l'état du paiement partenaire indisponible."},{status:503});
  }
}
