import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";
import { deviceTokenFromRequest } from "@/lib/appareil-token";
import { parsePromoteurPaymentSms } from "@/lib/promoteurPaymentSms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  reservationId?: string;
  canal?: "orange_money" | "mtn_momo";
  smsText?: string;
  payerNumber?: string;
  amount?: number;
  paidAt?: string;
  reference?: string;
  fieldSources?: Record<string,string>;
};

const digits=(value:unknown)=>String(value??"").replace(/\D/g,"");

export async function POST(request:Request) {
  try {
    const token=deviceTokenFromRequest(request);
    const db=supabaseAdmin();
    const authResult=token ? await db.auth.getUser(token) : await supabaseServer().auth.getUser();
    if(authResult.error||!authResult.data.user) {
      return NextResponse.json({error:"Connexion Client requise."},{status:401});
    }
    const userId=authResult.data.user.id;
    const body=await request.json() as Body;
    const reservationId=String(body.reservationId??"");
    const canal=body.canal;
    const smsText=String(body.smsText??"").trim().slice(0,8000);
    if(!/^[0-9a-f-]{36}$/i.test(reservationId)||
       (canal!=="orange_money"&&canal!=="mtn_momo")) {
      return NextResponse.json({error:"Déclaration de paiement incomplète."},{status:400});
    }

    const {data:reservation,error:reservationError}=await db.from("universe_reservations")
      .select("id,client_id,partner_id,status,total_fcfa,expires_at,payment_mode,payment_status")
      .eq("id",reservationId).eq("client_id",userId).maybeSingle();
    if(reservationError||!reservation) return NextResponse.json({error:"Réservation introuvable."},{status:404});
    if(!["confirmed","ready"].includes(reservation.status)||
       new Date(reservation.expires_at).getTime()<=Date.now()||
       reservation.payment_mode!==canal||
       reservation.payment_status==="confirmed") {
      return NextResponse.json({error:"La réservation ne permet pas cette déclaration de paiement."},{status:409});
    }

    const parsed=smsText?parsePromoteurPaymentSms(smsText,canal):null;
    const extractedPayer=parsed?.direction==="payer_debit"&&parsed.success===true?parsed:null;
    const amountWasCorrected=body.fieldSources?.amount==="manual_entry";
    const referenceWasCorrected=body.fieldSources?.reference==="manual_entry";
    const dateWasCorrected=body.fieldSources?.paidAt==="manual_entry";
    const amount=amountWasCorrected
      ? Number(body.amount)
      : extractedPayer?.amount??Number(body.amount??reservation.total_fcfa);
    if(!Number.isSafeInteger(amount)||amount<=0) {
      return NextResponse.json({error:"Montant déclaré invalide."},{status:400});
    }
    const reference=String(referenceWasCorrected
      ? body.reference??""
      : extractedPayer?.reference??body.reference??"").trim();
    if(reference.length<5||reference.length>120||!/^[\\p{L}\\p{N}\\s_./-]+$/u.test(reference)) {
      return NextResponse.json({error:"ID / Référence de transaction obligatoire (5 caractères minimum). Complétez-le si le SMS n'a pas été reconnu."},{status:400});
    }
    const payerNumber=String(body.fieldSources?.payerNumber==="manual_entry"
      ? body.payerNumber??""
      : extractedPayer?.payerNumber??body.payerNumber??"").trim().slice(0,40);
    if(payerNumber&& (digits(payerNumber).length<8||digits(payerNumber).length>15)) {
      return NextResponse.json({error:"Numéro payeur invalide."},{status:400});
    }
    const paidAtRaw=dateWasCorrected
      ? String(body.paidAt??"")
      : extractedPayer?.occurredAt??String(body.paidAt??new Date().toISOString());
    const paidAt=new Date(paidAtRaw);
    const now=new Date();
    if(!Number.isFinite(paidAt.getTime())||paidAt.getTime()>now.getTime()+5*60_000||
       paidAt.getTime()<now.getTime()-7*24*60*60_000) {
      return NextResponse.json({error:"Date de paiement invalide ou trop ancienne."},{status:400});
    }

    const completePayerSms=Boolean(
      extractedPayer?.quality==="complete"&&
      Number.isSafeInteger(extractedPayer.amount)&&Number(extractedPayer.amount)>0&&
      Boolean(extractedPayer.reference)&&!amountWasCorrected&&!referenceWasCorrected&&
      (!extractedPayer.occurredAt||!dateWasCorrected)
    );
    const fieldSources={
      amount:extractedPayer?.amount!==null&&extractedPayer?.amount!==undefined&&!amountWasCorrected
        ?"sms_extracted":amountWasCorrected?"manual_entry":
        body.fieldSources?.amount==="manual_entry"?"manual_entry":"generated_default",
      paidAt:extractedPayer?.occurredAt&&!dateWasCorrected
        ?"sms_extracted":dateWasCorrected?"manual_entry":
        body.fieldSources?.paidAt==="manual_entry"?"manual_entry":"generated_default",
      reference:extractedPayer?.reference&&!referenceWasCorrected
        ?"sms_extracted":"manual_entry",
      payerNumber:extractedPayer?.payerNumber&&body.fieldSources?.payerNumber!=="manual_entry"
        ?"sms_extracted":payerNumber?"manual_entry":"not_provided",
      sms:!smsText?"not_shared":completePayerSms?"recognized_complete_payer_debit":
        extractedPayer?"shared_incomplete_or_corrected_manual_review":"shared_unrecognized_manual_review",
    };
    const hash=smsText?createHash("sha256").update(smsText).digest("hex"):null;
    const {data:saved,error:saveError}=await db.rpc("naxa_universe_declare_payment",{
      p_reservation:reservationId,
      p_client:userId,
      p_canal:canal,
      p_reference:reference,
      p_payer_number:payerNumber||null,
      p_declared_amount:amount,
      p_payment_occurred_at:paidAt.toISOString(),
      p_proof_source:completePayerSms?"shared_sms":"manual_entry",
      p_field_sources:fieldSources,
      p_sms_payload_sha256:hash,
    });
    if(saveError||saved!==true) return NextResponse.json({error:saveError?.message??"Déclaration non enregistrée."},{status:409});

    const {data:confirmation}=await db.from("naxa_universe_payment_confirmations")
      .select("receipt_number,amount_fcfa,confirmed_at")
      .eq("reservation_id",reservationId).eq("client_id",userId).maybeSingle();
    if(confirmation) {
      return NextResponse.json({
        received:true,status:"financially_confirmed",
        receiptNumber:confirmation.receipt_number,
        amount:confirmation.amount_fcfa,
        confirmedAt:confirmation.confirmed_at,
        message:"Les SMS de débit et de crédit concordent. Paiement confirmé par NAXA · reçu "+confirmation.receipt_number+".",
      },{status:202});
    }

    const {data:intent}=await db.from("naxa_universe_payment_intents")
      .select("status,proof_source")
      .eq("reservation_id",reservationId).eq("client_id",userId)
      .order("created_at",{ascending:false}).limit(1).maybeSingle();

    return NextResponse.json({
      received:true,
      status:intent?.proof_source==="manual_entry"?"manual_review":"awaiting_pair",
      message:intent?.proof_source==="manual_entry"
        ?"Les informations ont été transmises. Le SMS n'a pas été reconnu comme preuve de débit automatique ; une revue manuelle est requise."
        :"Déclaration enregistrée. NAXA rapprochera automatiquement le SMS de débit avec le SMS de crédit reçu par le Partenaire. L'absence d'un SMS dans NAXA ne signifie pas un échec opérateur.",
    },{status:202});
  } catch {
    return NextResponse.json({error:"Déclaration du paiement partenaire indisponible."},{status:503});
  }
}
