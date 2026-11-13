import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Retired for the payment pilot:
 * Promoteur debit SMS must be voluntarily shared.
 * Automatic SMS reception is reserved for the Admin beneficiary phone.
 */
export async function POST() {
  return NextResponse.json({
    error: "La capture SMS automatique côté Promoteur est désactivée. Partagez volontairement le SMS de débit via NAXA Paiement.",
    replacement: "/api/promoteur/paiements/share",
  }, { status: 410 });
}
