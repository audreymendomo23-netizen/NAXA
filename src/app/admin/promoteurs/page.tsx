import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";

type SearchParams = { ok?: string; erreur?: string };

const erreurs: Record<string, string> = {
  verification: "Cochez la confirmation après vérification effective des autorisations.",
  "validation-impossible": "La validation a échoué et la transaction a été annulée. Vérifiez les prérequis du dossier et réessayez.",
  pharmacie: "Pharmacie introuvable ou impossible à lire.",
  rattachement: "Le rattachement Promoteur–pharmacie est absent ou ambigu.",
  promoteur: "Le compte Promoteur ou son architecture est invalide.",
  "dossier-incomplet": "Le dossier administratif est incomplet : vérifiez le rattachement et les coordonnées privées de la pharmacie.",
  contrat: "Convention, abonnement et architecture ne sont pas cohérents.",
  abonnement: "L’abonnement n’a pas pu être activé.",
  architecture: "L’architecture de la pharmacie n’a pas pu être activée.",
  activation: "La pharmacie n’a pas pu être activée. Le système a tenté de remettre les accès en attente.",
  "deja-active": "Ce dossier est déjà actif. Aucune réactivation ni remise à zéro de l’essai n’a été effectuée.",
  documents: "Les pièces reçues n’ont pas pu être enregistrées. Aucune création partielle ne doit être considérée comme réussie.",
};

export default async function DossiersPromoteurs({ searchParams }: { searchParams: SearchParams }) {
  const sb = supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/connexion?retour=/admin/promoteurs");
  const { data: current, error: roleError } = await sb.from("profiles").select("role").eq("id", auth.user.id).single();
  if (roleError || current?.role !== "admin") redirect("/");

  const { data: pharmacies, error } = await supabaseAdmin()
    .from("pharmacies")
    .select("id,nom,ville,quartier,created_at")
    .order("created_at", { ascending: false });

  return (
    <main className="space-y-6">
      <header className="rounded-3xl bg-naxa-green-900 p-6 text-white">
        <p className="text-xs font-bold uppercase tracking-[.18em] text-white/70">Administration · conformité</p>
        <h1 className="mt-2 text-2xl font-extrabold sm:text-3xl">Dossiers Promoteurs & pharmacies</h1>
        <p className="mt-2 max-w-3xl text-sm text-white/80">
          Sélectionnez un dossier pour consulter les informations détaillées de la pharmacie et du Promoteur rattaché.
        </p>
      </header>

      {searchParams.ok === "documents" && (
        <p role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">
          État des pièces reçues enregistré.
        </p>
      )}
      {searchParams.ok === "validation" && (
        <p role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">
          Dossier validé. La pharmacie et l’accès Promoteur sont activés.
        </p>
      )}
      {searchParams.erreur && (
        <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          {erreurs[searchParams.erreur] ?? "L’opération n’a pas abouti. Aucun succès n’est confirmé."}
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          La liste des dossiers pharmacies n’a pas pu être chargée. Actualisez la page ou réessayez plus tard.
        </p>
      )}

      <section className="space-y-3" aria-labelledby="liste-dossiers">
        <div>
          <h2 id="liste-dossiers" className="text-xl font-extrabold">Liste des dossiers pharmacies</h2>
          <p className="mt-1 text-sm text-slate-600">{pharmacies?.length ?? 0} dossier(s)</p>
        </div>

        {!error && !pharmacies?.length && (
          <div className="rounded-2xl border border-dashed p-8 text-center">
            <p className="font-bold">Aucun dossier pharmacie</p>
            <p className="mt-1 text-sm text-slate-600">Les dossiers pharmacies apparaîtront ici après leur création.</p>
          </div>
        )}

        {(pharmacies ?? []).map((pharmacy) => (
          <article key={pharmacy.id} className="flex flex-col gap-4 rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div className="min-w-0">
              <h3 className="break-words text-lg font-extrabold text-slate-900">{pharmacy.nom}</h3>
              <p className="mt-1 text-sm text-slate-600">
                {[pharmacy.quartier, pharmacy.ville].filter(Boolean).join(" · ") || "Localisation non renseignée"}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Dossier créé le {new Date(pharmacy.created_at).toLocaleDateString("fr-FR")}
              </p>
            </div>
            <Link
              href={"/admin/pharmacies/" + pharmacy.id}
              className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border-2 border-[#FFE23D] bg-[#FFE23D] px-5 py-3 text-sm font-extrabold text-[#0B3D26] shadow-sm transition hover:bg-[#f5d900] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B3D26] focus-visible:ring-offset-2"
            >
              Ouvrir le dossier individuel →
            </Link>
          </article>
        ))}
      </section>
    </main>
  );
}
