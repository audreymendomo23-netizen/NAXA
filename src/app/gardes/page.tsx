import Link from "next/link";
import { supabasePublic } from "@/lib/supabase/server";
import { chargerGardesMfasha, MFASHA_SOURCE_URL } from "@/lib/pharmacies-gardes/mfasha";
import { PharmaciesGardeListe } from "@/components/gardes/PharmaciesGardeListe";
import { PhotoPharmacie } from "@/components/PhotoPharmacie";

export const dynamic = "force-dynamic";

type PharmacieGarde = {
  id: string;
  nom: string;
  ville: string | null;
  region: string | null;
  quartier: string | null;
  adresse: string | null;
  lat: number | null;
  lng: number | null;
  photo_path: string | null;
  photo_source_url: string | null;
  photo_licence: string | null;
  photo_verifiee_le: string | null;
  garde_debut: string;
  garde_fin: string;
  garde_source_url: string;
  garde_verifiee_le: string;
};

type GardeResult = { pharmacies: PharmacieGarde[]; error: boolean };

function dateLisible(value: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Africa/Douala",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function coordonneesValides(lat: number | null, lng: number | null): boolean {
  return typeof lat === "number" && typeof lng === "number"
    && Number.isFinite(lat) && Number.isFinite(lng)
    && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
    && !(lat === 0 && lng === 0);
}

async function chargerGardesNationales(): Promise<GardeResult> {
  try {
    const now = new Date();
    const nowIso = now.toISOString();
    const verificationMin = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const sb = supabasePublic(30);
    const { data, error } = await sb.from("pharmacies")
      .select("id,nom,ville,region,quartier,adresse,lat,lng,photo_path,photo_source_url,photo_licence,photo_verifiee_le,garde_debut,garde_fin,garde_source_url,garde_verifiee_le")
      .eq("actif", true)
      .eq("visible_recherche", true)
      .eq("est_demo", false)
      .is("archivee_le", null)
      .eq("de_garde", true)
      .lte("garde_debut", nowIso)
      .gt("garde_fin", nowIso)
      .not("garde_source_url", "is", null)
      .gte("garde_verifiee_le", verificationMin)
      .order("region", { ascending: true })
      .order("ville", { ascending: true })
      .order("nom", { ascending: true });
    if (error) return { pharmacies: [], error: true };
    return { pharmacies: (data ?? []) as PharmacieGarde[], error: false };
  } catch {
    return { pharmacies: [], error: true };
  }
}

function photoVerifiee(pharmacie: PharmacieGarde): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base || !pharmacie.photo_path || !pharmacie.photo_source_url
    || !pharmacie.photo_licence || !pharmacie.photo_verifiee_le) return null;
  return `${base}/storage/v1/object/public/pharmacies-photos/${pharmacie.photo_path}`;
}

function grouperParRegion(pharmacies: PharmacieGarde[]) {
  const groupes = new Map<string, Map<string, PharmacieGarde[]>>();
  for (const pharmacie of pharmacies) {
    const region = pharmacie.region?.trim() || "Région non renseignée";
    const ville = pharmacie.ville?.trim() || "Ville non renseignée";
    const villes = groupes.get(region) ?? new Map<string, PharmacieGarde[]>();
    villes.set(ville, [...(villes.get(ville) ?? []), pharmacie]);
    groupes.set(region, villes);
  }
  return [...groupes.entries()];
}

export default async function PharmaciesDeGarde() {
  const [national, externe] = await Promise.all([
    chargerGardesNationales(),
    chargerGardesMfasha(),
  ]);
  const groupes = grouperParRegion(national.pharmacies);

  return (
    <main className="min-h-dvh bg-naxa-green-50 px-4 py-6 text-naxa-ink">
      <div className="mx-auto w-full max-w-4xl space-y-5">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center font-semibold text-naxa-green-700 underline underline-offset-4 hover:text-naxa-green-900"
        >
          ← Retour à l’accueil
        </Link>

        <header className="rounded-2xl bg-naxa-green-900 p-5 text-white">
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-100">Couverture nationale</p>
          <h1 className="mt-1 text-2xl font-extrabold">Pharmacies de garde au Cameroun</h1>
          <p className="mt-2 text-sm leading-relaxed">
            Les pharmacies NAXA affichées ci-dessous ont une période de garde en cours, une source publiée et une vérification récente.
            Appelez ou confirmez auprès de l’établissement avant de vous déplacer.
          </p>
        </header>

        {national.error && (
          <p role="alert" className="carte text-sm text-red-700">
            Le planning national NAXA n’a pas pu être vérifié. Aucune garde non confirmée ne sera affichée comme active.
          </p>
        )}

        {!national.error && national.pharmacies.length === 0 && (
          <section className="carte space-y-2">
            <h2 className="font-bold text-naxa-green-900">Aucune garde NAXA confirmée en cours</h2>
            <p className="text-sm leading-relaxed text-slate-600">
              Le réseau ne contient actuellement aucune garde avec dates valides et vérification de moins de 24 heures.
              Consultez l’annuaire national pour trouver le programme publié dans votre ville; les dates de garde doivent être vérifiées auprès de la source.
            </p>
            <a className="inline-flex min-h-11 items-center font-semibold text-naxa-green-700 underline" href="https://www.annuaire-medical.cm/fr/pharmacies-de-garde" target="_blank" rel="noreferrer">
              Ouvrir l’annuaire des gardes pour toutes les régions
            </a>
          </section>
        )}

        {groupes.map(([region, villes]) => (
          <section key={region} className="carte space-y-4">
            <h2 className="text-lg font-extrabold text-naxa-green-900">{region}</h2>
            {[...villes.entries()].map(([ville, pharmacies]) => (
              <div key={ville} className="space-y-3">
                <h3 className="border-b border-emerald-100 pb-2 font-bold">{ville}</h3>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {pharmacies.map((pharmacie) => (
                    <li key={pharmacie.id} className="min-w-0 rounded-xl border border-emerald-100 bg-white p-3">
                      <PhotoPharmacie nom={pharmacie.nom} src={photoVerifiee(pharmacie)} lieu={pharmacie.quartier || pharmacie.adresse} hauteur="compacte" />
                      <h4 className="mt-2 font-bold text-naxa-green-900">{pharmacie.nom}</h4>
                      {(pharmacie.quartier || pharmacie.adresse) && (
                        <p className="mt-1 text-sm text-slate-600">{[pharmacie.quartier, pharmacie.adresse].filter(Boolean).join(" · ")}</p>
                      )}
                      <p className="mt-2 text-sm font-semibold text-emerald-800">En garde jusqu’au {dateLisible(pharmacie.garde_fin)}</p>
                      <p className="mt-1 text-xs text-slate-500">Planning vérifié le {dateLisible(pharmacie.garde_verifiee_le)}</p>
                      <div className="mt-3 flex flex-wrap gap-3 text-sm">
                        <a className="font-semibold text-naxa-green-700 underline" href={pharmacie.garde_source_url} target="_blank" rel="noreferrer">Source du planning</a>
                        {coordonneesValides(pharmacie.lat, pharmacie.lng) && (
                          <a className="font-semibold text-naxa-green-700 underline" href={`https://www.google.com/maps/dir/?api=1&destination=${pharmacie.lat},${pharmacie.lng}`} target="_blank" rel="noreferrer">Itinéraire</a>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        ))}

        {externe && externe.pharmacies.length > 0 && (
          <section className="space-y-3">
            <div className="carte space-y-2">
              <h2 className="font-bold text-naxa-green-900">Planning externe — Yaoundé</h2>
              <p className="text-sm text-slate-600">
                Données recueillies depuis Mfasha; ce flux n’est pas un répertoire national ni une certification officielle NAXA.
                Vérifiez la période et appelez avant de vous déplacer.
              </p>
              <p className="text-xs text-slate-500">
                Période publiée : {externe.periode}. Récupération le {dateLisible(externe.fetchedAt)}.
              </p>
              <a className="inline-flex min-h-11 items-center font-semibold text-naxa-green-700 underline" href={MFASHA_SOURCE_URL} target="_blank" rel="noreferrer">Vérifier directement sur Mfasha</a>
            </div>
            <PharmaciesGardeListe pharmacies={externe.pharmacies} sourceAnnuaireUrl="https://mboapharma.cm/single-location-3/yaounde/?directory_type=pharmacie&view=list" />
          </section>
        )}

        <section className="carte space-y-2">
          <h2 className="font-bold text-naxa-green-900">Annuaire national par ville</h2>
          <p className="text-sm leading-relaxed text-slate-600">
            L’annuaire médical répertorie des pages de garde pour des villes des dix régions. La disponibilité et la période publiées doivent être contrôlées sur chaque fiche.
          </p>
          <a className="inline-flex min-h-11 items-center font-semibold text-naxa-green-700 underline" href="https://www.annuaire-medical.cm/fr/pharmacies-de-garde" target="_blank" rel="noreferrer">
            Choisir une ville et consulter la source
          </a>
        </section>

        <section className="carte">
          <h2 className="font-bold text-naxa-green-900">En cas d’urgence</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            NAXA ne remplace pas les services d’urgence. Appelez le 118 (pompiers) ou le 119 (SAMU).
          </p>
          <div className="mt-3 flex flex-wrap gap-4">
            <a className="inline-flex min-h-11 items-center font-semibold text-naxa-green-700 underline" href="tel:118">118</a>
            <a className="inline-flex min-h-11 items-center font-semibold text-naxa-green-700 underline" href="tel:119">119</a>
          </div>
        </section>
      </div>
    </main>
  );
}
