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
      .select("id,nom,dci,forme,synonymes,photo_url,description,indications,source_fiche,fiche_validee")
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
      // Aucun chemin, licence ni date de vérification photo n'existe encore
      // dans public.produits : ne jamais afficher photo_url sans ces preuves.
      const imageUrl = null;
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
        imageSource: product.photo_url ? "Photo masquée jusqu’à validation de sa provenance et de ses droits" : null,
        imageSourceUrl: null,
        imageLicense: null,
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
