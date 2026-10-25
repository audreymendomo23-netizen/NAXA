import Link from "next/link";
import { supabasePublic } from "@/lib/supabase/server";
import { chargerGardesMfasha, MFASHA_SOURCE_URL } from "@/lib/pharmacies-gardes/mfasha";
import { PhotoPharmacie } from "@/components/PhotoPharmacie";

export const dynamic = "force-dynamic";

type PharmacieGarde = {
  id: string;
  nom: string;
  quartier: string | null;
  adresse: string | null;
  lat: number | null;
  lng: number | null;
  photo_url: string | null;
};

function coordonneesValides(lat: number | null, lng: number | null): boolean {
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

async function chargerGardesLocales(): Promise<PharmacieGarde[] | null> {
  try {
    const { data, error } = await supabasePublic(60)
      .from("pharmacies")
      .select("id,nom,quartier,adresse,lat,lng,photo_url")
      .eq("actif", true)
      .eq("visible_recherche", true)
      .is("archivee_le", null)
      .eq("de_garde", true)
      .not("nom", "ilike", "%démo%")
      .not("nom", "ilike", "%test%")
      .order("nom");
    if (error) return null;
    return (data ?? []) as PharmacieGarde[];
  } catch {
    return null;
  }
}

export default async function PharmaciesDeGarde() {
  const externe = await chargerGardesMfasha();
  const pharmaciesLocales = externe ? null : await chargerGardesLocales();
  const aucuneSource = !externe && pharmaciesLocales === null;
  const aucunePharmacie =
    Boolean(externe && externe.pharmacies.length === 0) ||
    Boolean(pharmaciesLocales && pharmaciesLocales.length === 0);

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
            Liste publiée pour la période indiquée par la source. Appelez la pharmacie avant de vous déplacer : les gardes peuvent être modifiées.
          </p>
        </header>

        {externe && (
          <section className="carte space-y-2" aria-label="Provenance des données">
            <p className="text-sm font-semibold text-naxa-green-900">
              Source : Mfasha · Yaoundé
            </p>
            <p className="text-sm text-slate-600">
              Période publiée : {externe.periode}
            </p>
            <p className="text-xs text-slate-500">
              Récupération vérifiée le {new Date(externe.fetchedAt).toLocaleString("fr-FR", { timeZone: "Africa/Douala" })}. Cette source publique n’est pas une API officielle; NAXA ne certifie pas indépendamment les tours de garde.
            </p>
            <a
              href={MFASHA_SOURCE_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center font-semibold text-naxa-green-700 underline underline-offset-4"
            >
              Vérifier la liste sur Mfasha
            </a>
          </section>
        )}

        {!externe && pharmaciesLocales !== null && (
          <p className="carte text-sm text-amber-800">
            La source Mfasha est momentanément indisponible. Affichage des données locales NAXA, qui peuvent ne pas refléter le planning le plus récent.
            {" "}
            <a className="font-semibold underline" href={MFASHA_SOURCE_URL} target="_blank" rel="noreferrer">
              Consulter Mfasha
            </a>
          </p>
        )}

        {aucuneSource && (
          <p role="alert" className="carte text-sm text-red-700">
            Impossible de charger les pharmacies de garde. Consultez directement la source publique Mfasha et réessayez plus tard.
            {" "}
            <a className="font-semibold underline" href={MFASHA_SOURCE_URL} target="_blank" rel="noreferrer">
              Ouvrir Mfasha
            </a>
          </p>
        )}

        {aucunePharmacie && (
          <p className="carte text-sm text-slate-600">
            Aucune pharmacie de garde n’a pu être extraite pour cette période. Consultez la source directement.
          </p>
        )}

        {externe && externe.pharmacies.length > 0 && (
          <ul className="space-y-3">
            {externe.pharmacies.map((p) => (
              <li key={p.id} className="carte overflow-hidden space-y-0">
                <PhotoPharmacie nom={p.nom} src={p.imageUrl} lieu={p.quartier} />
                <div className="space-y-1">
                <h2 className="font-bold text-naxa-green-900">{p.nom}</h2>
                {p.quartier && <p className="text-sm text-slate-600">{p.quartier}</p>}
                {p.telephone && (
                  <p className="text-sm">
                    Téléphone :{" "}
                    <a className="font-semibold text-naxa-green-700 underline" href={`tel:${p.telephone.replace(/[^+\d]/g, "")}`}>
                      {p.telephone}
                    </a>
                  </p>
                )}
                {p.autresTelephones.length > 0 && (
                  <p className="text-sm text-slate-600">
                    Autres numéros : {p.autresTelephones.join(" · ")}
                  </p>
                )}
                <p className="text-xs text-slate-500">
                  <a href={p.source} target="_blank" rel="noreferrer" className="underline">
                    Source et vérification
                  </a>
                </p>
                </div>
              </li>
            ))}
          </ul>
        )}

        {!externe && pharmaciesLocales && pharmaciesLocales.length > 0 && (
          <ul className="space-y-3">
            {pharmaciesLocales.map((p) => (
              <li key={p.id} className="carte space-y-1">
                <PhotoPharmacie nom={p.nom} src={p.photo_url} lieu={p.quartier || p.adresse} hauteur="compacte" />
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
