import { NextResponse } from "next/server";
import { clearPharmacyCookie } from "@/lib/pharmacie-code-session";
export async function POST() {
  const response = NextResponse.json({ ok: true });
  clearPharmacyCookie(response);
  return response;
}
