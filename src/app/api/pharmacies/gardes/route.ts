import { NextResponse } from "next/server";
import { chargerGardesMfasha } from "@/lib/pharmacies-gardes/mfasha";

export const dynamic = "force-dynamic";
export const revalidate = 300;

export async function GET() {
  const result = await chargerGardesMfasha();

  if (!result || result.pharmacies.length < 5 || !result.periode) {
    return NextResponse.json(
      {
        ok: false,
        source: "https://mfasha.com/",
        message: "La source publique est indisponible ou sa liste n'a pas pu être validée.",
      },
      {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      source: "https://mfasha.com/",
      fetchedAt: result.fetchedAt,
      periode: result.periode,
      pharmacies: result.pharmacies,
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    },
  );
}
