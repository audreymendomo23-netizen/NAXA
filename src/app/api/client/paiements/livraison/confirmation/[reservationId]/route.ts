import { NextResponse } from "next/server";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ reservationId: string }> },
) {
  try {
    const { reservationId } = await params;
    if (!/^[0-9a-f-]{36}$/i.test(reservationId)) {
      return NextResponse.json({ error: "Commande invalide." }, { status: 400 });
    }

    const session = supabaseServer();
    const { data: auth, error: authError } = await session.auth.getUser();
    if (authError || !auth.user) {
      return NextResponse.json({ error: "Connexion Client requise." }, { status: 401 });
    }

    const db = supabaseAdmin();
    const { data: confirmation, error } = await db
      .from("naxa_delivery_payment_confirmations")
      .select("id,receipt_number,canal,transaction_reference,amount_fcfa,destination_snapshot,payer_number_tail,merchant_number_tail,payer_occurred_at,payer_declared_at,merchant_occurred_at,merchant_received_at,confirmed_at")
      .eq("reservation_id", reservationId)
      .eq("client_id", auth.user.id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: "Reçu de rapprochement indisponible." }, { status: 503 });
    }

    if (confirmation) {
      const snapshot = confirmation.destination_snapshot && typeof confirmation.destination_snapshot === "object"
        ? confirmation.destination_snapshot as Record<string, unknown>
        : {};
      return NextResponse.json({
        status: "financially_confirmed_waiting_pos",
        confirmation: {
          id: confirmation.id,
          receiptNumber: confirmation.receipt_number,
          channel: confirmation.canal,
          transactionReference: confirmation.transaction_reference,
          amount: confirmation.amount_fcfa,
          merchantName: typeof snapshot.merchant_name === "string" ? snapshot.merchant_name : null,
          merchantPhone: typeof snapshot.merchant_phone === "string" ? snapshot.merchant_phone : null,
          payerNumberTail: confirmation.payer_number_tail,
          providerOccurredAt: confirmation.merchant_occurred_at ?? confirmation.payer_occurred_at,
          merchantSmsReceivedAt: confirmation.merchant_received_at,
          confirmedAt: confirmation.confirmed_at,
        },
      }, { headers: { "Cache-Control": "no-store" } });
    }

    const { data: paymentRecord, error: paymentError } = await db
      .from("naxa_delivery_payment_records")
      .select("status,sms_match_status,reference,declared_at")
      .eq("reservation_id", reservationId)
      .eq("client_id", auth.user.id)
      .maybeSingle();

    if (paymentError) {
      return NextResponse.json({ error: "État du rapprochement indisponible." }, { status: 503 });
    }

    const status = paymentRecord?.sms_match_status === "manual_review"
      ? "manual_review"
      : paymentRecord?.sms_match_status === "awaiting_merchant_sms"
        ? "awaiting_merchant_sms"
        : paymentRecord ? "awaiting_pair" : "not_submitted";

    return NextResponse.json({
      status,
      transactionReference: paymentRecord?.reference ?? null,
      declaredAt: paymentRecord?.declared_at ?? null,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Lecture de la confirmation indisponible." }, { status: 503 });
  }
}
