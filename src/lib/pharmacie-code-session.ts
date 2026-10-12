import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";

export const PHARMACY_COOKIE = "naxa_pharmacy_gate";
const MAX_AGE_SECONDS = 15 * 60;

function secret() {
  const value = process.env.NAXA_PHARMACY_COOKIE_SECRET;
  if (!value || value.length < 32) throw new Error("NAXA_PHARMACY_COOKIE_SECRET must contain at least 32 characters");
  return value;
}
function signature(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}
export function setPharmacyCookie(response: NextResponse, pharmacyId: string) {
  const payload = Buffer.from(JSON.stringify({ pharmacyId, exp: Math.floor(Date.now()/1000) + MAX_AGE_SECONDS })).toString("base64url");
  response.cookies.set(PHARMACY_COOKIE, payload + "." + signature(payload), {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax",
    path: "/", maxAge: MAX_AGE_SECONDS,
  });
}
export function clearPharmacyCookie(response: NextResponse) {
  response.cookies.set(PHARMACY_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0, expires: new Date(0) });
}
export function readPharmacyCookie(request: NextRequest): string | null {
  try {
    const value = request.cookies.get(PHARMACY_COOKIE)?.value;
    if (!value) return null;
    const [payload, sig, extra] = value.split(".");
    if (!payload || !sig || extra) return null;
    const expected = Buffer.from(signature(payload));
    const supplied = Buffer.from(sig);
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof decoded.pharmacyId !== "string" || !decoded.pharmacyId || !Number.isInteger(decoded.exp) || decoded.exp <= Math.floor(Date.now()/1000)) return null;
    return decoded.pharmacyId;
  } catch { return null; }
}
