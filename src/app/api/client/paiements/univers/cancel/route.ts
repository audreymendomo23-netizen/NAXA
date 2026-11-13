import { NextResponse } from "next/server";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";
import { deviceTokenFromRequest } from "@/lib/appareil-token";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function POST(request:Request) {
  try {
    const token=deviceTokenFromRequest(request);
    const authResult=token
      ? await supabaseAdmin().auth.getUser(token)
      : await supabaseServer().auth.getUser();
    if(authResult.error||!authResult.data.user) {
      return NextResponse.json({error:"Connexion Client requise."},{status:401});
    }
    const body=await request.json() as {reservationId?:string};
    const reservationId=String(body.reservationId??"");
    if(!/^[0-9a-f-]{36}$/i.test(reservationId)) {
      return NextResponse.json({error:"Réservation invalide."},{status:400});
    }
    const {data,error}=await supabaseAdmin().rpc("naxa_universe_cancel_payment_intent",{
      p_reservation:reservationId,
      p_client:authResult.data.user.id,
    });
    if(error||data!==true) {
      return NextResponse.json({
        error:error?.message??"L'intention ne peut pas être annulée automatiquement après transmission du SMS payeur.",
      },{status:409});
    }
    return NextResponse.json({
      cancelled:true,
      message:"Le choix de paiement électronique a été annulé. Vous pourrez régler sur place selon les modalités du partenaire.",
    });
  } catch {
    return NextResponse.json({error:"Annulation du choix de paiement indisponible."},{status:503});
  }
}
