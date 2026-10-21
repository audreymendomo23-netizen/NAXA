import Link from "next/link";
import { supabasePublic } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PharmacieGarde = {
  id: string;
  nom: string;
  quartier: string | null;
  adresse: string | null;
  lat: number | null;
  lng: number | null;
};

function coordonneesValides(lat: number | null, lng: number | null): lat is number {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    !(lat === 0 && lng === 0)
  );
}

async function chargerGardes(): Promise<PharmacieGarde[] | null> {
  try {
    const { data, error } = await supabasePublic(60)
      .from("pharmacies")
      .select("id,nom,quartier,adresse,lat,lng")
      .eq("actif", true)
      .eq("visible_recherche", true)
      .is("archivee_le", null)
      .eq("de_garde", true)
      .order("nom");
    if (error) return null;
    return (data ?? []) as PharmacieGarde[];
  } catch {
    return null;
  }
}

export default async function PharmaciesDeGarde() {
  const pharmacies = await chargerGardes();

  return (
    <main className="min-h-dvh bg-naxa-green-50 px-4 py-6 text-naxa-ink">
      <div className="mx-auto w-full max-w-xl space-y-5">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center font-semibold text-naxa-green-700 underline underline-offset-4 hover:text-naxa-green-900"
        >
          ← Retour à l’accueil
        </Link>

        <header className="rounded-2xl bg-naxa-green-900 p-5 text-white">
          <h1 className="text-2xl font-extrabold">Pharmacies de garde</h1>
          <p className="mt-2 text-sm leading-relaxed">
            Pharmacies actuellement de garde sur NAXA. Vérifiez la disponibilité directement auprès de la pharmacie avant de vous déplacer.
          </p>
        </header>

        {pharmacies === null && (
          <p role="alert" className="carte text-sm text-red-700">
            Impossible de charger les pharmacies de garde. Réessayez dans un instant.
          </p>
        )}

        {pharmacies !== null && pharmacies.length === 0 && (
          <p className="carte text-sm text-slate-600">
            Aucune pharmacie de garde n’est indiquée pour le moment.
          </p>
        )}

        {pharmacies !== null && pharmacies.length > 0 && (
          <ul className="space-y-3">
            {pharmacies.map((p) => (
              <li key={p.id} className="carte space-y-1">
                <h2 className="font-bold text-naxa-green-900">{p.nom}</h2>
                {(p.quartier || p.adresse) && (
                  <p className="text-sm text-slate-600">
                    {[p.quartier, p.adresse].filter(Boolean).join(" · ")}
                  </p>
                )}
                {coordonneesValides(p.lat, p.lng) && (
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-11 items-center font-semibold text-naxa-green-700 underline underline-offset-4 hover:text-naxa-green-900"
                  >
                    Itinéraire
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}

        <section className="carte">
          <h2 className="font-bold text-naxa-green-900">En cas d’urgence</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            NAXA ne remplace pas les services d’urgence. Appelez le 117 (police), le 118 (pompiers) ou le 119 (SAMU).
          </p>
          <div className="mt-3 flex flex-wrap gap-4">
            <a className="inline-flex min-h-11 items-center font-semibold text-naxa-green-700 underline" href="tel:117">117</a>
            <a className="inline-flex min-h-11 items-center font-semibold text-naxa-green-700 underline" href="tel:118">118</a>
            <a className="inline-flex min-h-11 items-center font-semibold text-naxa-green-700 underline" href="tel:119">119</a>
          </div>
        </section>
      </div>
    </main>
  );
}
