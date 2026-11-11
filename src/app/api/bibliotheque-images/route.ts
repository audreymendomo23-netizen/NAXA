import { NextRequest, NextResponse } from "next/server";
import { loadProductImageLibrary } from "@/lib/catalogue/product-image-library";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (request.cookies.get("naxa-age-status-v2")?.value !== "adult") {
    return NextResponse.json({ error: "Vérification d’âge requise." }, { status: 403 });
  }

  const [parapharmacie, bebeMaman] = await Promise.all([
    loadProductImageLibrary("parapharmacie"),
    loadProductImageLibrary("bebe-maman"),
  ]);

  return NextResponse.json(
    { galleries: { parapharmacie, bebeMaman } },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
