import { NextRequest, NextResponse } from "next/server";
import { rechercherPhotoMedicament } from "@/lib/medicaments/photos-externes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const query = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);
  if (query.length < 3) {
    return NextResponse.json({ photo: null }, { headers: { "Cache-Control": "public, max-age=300" } });
  }

  const photo = await rechercherPhotoMedicament(query);
  return NextResponse.json(
    { photo },
    { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } }
  );
}
