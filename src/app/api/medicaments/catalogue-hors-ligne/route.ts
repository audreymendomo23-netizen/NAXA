import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProduitCatalogue = {
  id: string;
  nom: string;
  dci: string | null;
  forme: string | null;
  synonymes: string[] | null;
  photo_url: string | null;
  photo_path: string | null;
  photo_source_url: string | null;
  photo_licence: string | null;
  photo_verifiee_le: string | null;
  description: string | null;
  indications: string | null;
  source_fiche: string | null;
  fiche_validee: boolean | null;
};

export async function GET() {
  try {
    const sb = supabaseServer();
    const { data, error } = await sb
      .from("produits")
      .select("id,nom,dci,forme,synonymes,photo_url,photo_path,photo_source_url,photo_licence,photo_verifiee_le,description,indications,source_fiche,fiche_validee")
      .eq("fiche_validee", true)
      .order("nom", { ascending: true })
      .limit(500);

    if (error) {
      return NextResponse.json(
        { results: [], message: "Catalogue hors ligne indisponible pour le moment." },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }

    const results = ((data ?? []) as ProduitCatalogue[]).map((product) => {
      const verifiedPhoto = Boolean(product.photo_path && product.photo_licence && product.photo_verifiee_le);
      const imageUrl = verifiedPhoto && product.photo_path
        ? sb.storage.from("medicaments").getPublicUrl(product.photo_path).data.publicUrl
        : null;
      const validated = product.fiche_validee === true;
      return {
        id: product.id,
        name: product.nom,
        brand: null,
        activeIngredient: product.dci,
        form: product.forme,
        definition: validated ? product.description : null,
        indications: validated ? product.indications : null,
        imageUrl,
        imageSource: imageUrl ? "Photo hébergée par NAXA — provenance enregistrée" : null,
        imageSourceUrl: imageUrl ? product.photo_source_url : null,
        imageLicense: imageUrl ? product.photo_licence : null,
        imageAttribution: null,
        imageTitle: null,
        source: ["Catalogue NAXA"],
        availability: "non_verifiee" as const,
        partnerPharmacyCount: null,
        lowestPartnerPrice: null,
        localProductId: product.id,
        localInformationValidated: validated,
        localInformationSource: product.source_fiche,
        cameroonRegulatoryStatus: "a_verifier" as const,
        cameroonRegulatoryReference: "https://dpml.cm/repertoireDesAmm/index.php",
        synonyms: product.synonymes ?? [],
      };
    });

    return NextResponse.json(
      { results, count: results.length, catalogueVersion: new Date().toISOString() },
      { headers: { "Cache-Control": "private, max-age=300, stale-while-revalidate=3600" } }
    );
  } catch {
    return NextResponse.json(
      { results: [], message: "Catalogue hors ligne indisponible pour le moment." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
