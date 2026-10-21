import { NextRequest, NextResponse } from "next/server";
import { rechercherPhotosMedicament } from "@/lib/medicaments/photos-externes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const query = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);
  if (query.length < 3) {
    return NextResponse.json({ photo: null, photos: { boite: null, comprime: null } }, {
      headers: { "Cache-Control": "public, max-age=300" }
    });
  }

  const photos = await rechercherPhotosMedicament(query);
  return NextResponse.json({ photo: photos.boite ?? photos.comprime, photos }, {
    headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" }
  });
}
