import { redirect } from "next/navigation";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";
import { mettreAJourPiecesRecues, validerDossierPharmacie } from "./actions";

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

  const db = supabaseAdmin();
  const [
    { data: pharmacies, error: pharmaciesError },
    { data: links, error: linksError },
    { data: promoters, error: promotersError },
    { data: conventions, error: conventionsError },
    { data: subscriptions, error: subscriptionsError },
    { data: pharmacyArchitectures, error: pharmacyArchitecturesError },
    { data: architectures, error: architecturesError },
    { data: documentsRecus, error: documentsRecusError },
  ] = await Promise.all([
    db.from("pharmacies").select("id,nom,ville,quartier,adresse,actif,visible_recherche,created_at").order("created_at", { ascending: false }),
    db.from("promoteur_pharmacies").select("promoteur_id,pharmacie_id,actif,created_at"),
    db.from("profiles").select("id,role,username,first_name,last_name,phone,architecture_code,actif").eq("role", "promoteur"),
    db.from("conventions_promoteurs").select("id,promoteur_id,architecture_code,montant_mensuel,statut,date_expiration"),
    db.from("abonnements_promoteurs").select("id,promoteur_id,convention_id,montant_mensuel,statut,echeance"),
    db.from("pharmacie_architectures").select("pharmacie_id,architecture_code,active"),
    db.from("naxa_architectures").select("code,active"),
    db.from("pharmacie_documents_recus").select("pharmacie_id,piece_existence_legale,registre_commerce,niu,attestation_non_redevance,plan_localisation,cni_promoteur,mis_a_jour_le"),
  ]);

  const loadError = pharmaciesError || linksError || promotersError || conventionsError || subscriptionsError || pharmacyArchitecturesError || architecturesError || documentsRecusError;
  const promoterById = new Map((promoters ?? []).map((p) => [p.id, p] as const));
  const documentsByPharmacy = new Map((documentsRecus ?? []).map((d) => [d.pharmacie_id, d] as const));
  const linksByPharmacy = new Map<string, NonNullable<typeof links>>();
  for (const link of links ?? []) {
    const group = linksByPharmacy.get(link.pharmacie_id) ?? [];
    group.push(link);
    linksByPharmacy.set(link.pharmacie_id, group);
  }
  const rows = (pharmacies ?? []).map((pharmacy) => {
    const candidates = linksByPharmacy.get(pharmacy.id) ?? [];
    const link = candidates.length === 1 ? candidates[0] : null;
    const promoter = link ? promoterById.get(link.promoteur_id) : null;
    const promoterConventions = (conventions ?? []).filter((c) => c.promoteur_id === promoter?.id);
    const promoterSubscriptions = (subscriptions ?? []).filter((s) => s.promoteur_id === promoter?.id);
    const assignedArchitectures = (pharmacyArchitectures ?? []).filter((a) => a.pharmacie_id === pharmacy.id);
    const convention = promoterConventions.length === 1 ? promoterConventions[0] : null;
    const subscription = promoterSubscriptions.length === 1 ? promoterSubscriptions[0] : null;
    const assignedArchitecture = assignedArchitectures.length === 1 ? assignedArchitectures[0] : null;
    const architectureIsActive = Boolean(
      promoter?.architecture_code &&
      (architectures ?? []).some((a) => a.code === promoter.architecture_code && a.active) &&
      assignedArchitecture?.active &&
      assignedArchitecture.architecture_code === promoter.architecture_code
    );
    const commercialReady = Boolean(
      convention && subscription &&
      convention.statut === "active" &&
      convention.date_expiration >= new Date().toISOString().slice(0, 10) &&
      convention.architecture_code === promoter?.architecture_code &&
      subscription.statut === "actif" &&
      subscription.convention_id === convention.id &&
      subscription.montant_mensuel === convention.montant_mensuel &&
      subscription.echeance >= new Date().toISOString().slice(0, 10)
    );
    const ready = Boolean(
      pharmacy.actif && pharmacy.visible_recherche &&
      link?.actif && promoter?.actif &&
      candidates.length === 1 && architectureIsActive && commercialReady
    );
    return { pharmacy, link, promoter, ready, linkCount: candidates.length, convention, subscription, architectureIsActive, commercialReady, documents: documentsByPharmacy.get(pharmacy.id) ?? null };
  });

  return (
    <main className="space-y-6">
      <header className="rounded-3xl bg-naxa-green-900 p-6 text-white">
        <p className="text-xs font-bold uppercase tracking-[.18em] text-white/70">Administration · conformité</p>
        <h1 className="mt-2 text-2xl font-extrabold sm:text-3xl">Dossiers Promoteurs & pharmacies</h1>
        <p className="mt-2 max-w-3xl text-sm text-white/80">Contrôlez le rattachement, la convention, l’abonnement et l’architecture avant de rendre une pharmacie active et visible dans la recherche publique.</p>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-white/10 p-4"><p className="text-xs text-white/70">Pharmacies enregistrées</p><p className="mt-1 text-2xl font-extrabold">{rows.length}</p></div>
          <div className="rounded-2xl bg-white/10 p-4"><p className="text-xs text-white/70">À examiner</p><p className="mt-1 text-2xl font-extrabold">{rows.filter((r) => !r.ready).length}</p></div>
          <div className="col-span-2 rounded-2xl bg-white/10 p-4 sm:col-span-1"><p className="text-xs text-white/70">Actives et visibles</p><p className="mt-1 text-2xl font-extrabold">{rows.filter((r) => r.ready).length}</p></div>
        </div>
      </header>

      {searchParams.ok === "documents" && <p role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">État des pièces reçues enregistré. Aucune vérification documentaire n’a été effectuée par cette action.</p>}
      {searchParams.ok === "validation" && <p role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">Dossier validé. La pharmacie et l’accès Promoteur sont activés ; la période d’essai de 14 jours commence à la validation.</p>}
      {searchParams.erreur && <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">{erreurs[searchParams.erreur] ?? "L’opération n’a pas abouti. Aucun succès n’est confirmé."}</p>}
      {loadError && <p role="alert" className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">Certaines données administratives n’ont pas pu être chargées. Les validations sont désactivées tant que le dossier ne peut pas être contrôlé.</p>}

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-extrabold">Registre des pharmacies</h2>
          <p className="mt-1 text-sm text-slate-600">Une pharmacie en attente reste désactivée et masquée de la recherche publique.</p>
        </div>
        {!rows.length && !loadError && <div className="rounded-2xl border border-dashed p-8 text-center"><p className="font-bold">Aucun dossier pharmacie</p><p className="mt-1 text-sm text-slate-600">Les nouveaux dossiers créés depuis le formulaire administratif apparaîtront ici.</p></div>}
        {rows.map(({ pharmacy, link, promoter, ready, linkCount, architectureIsActive, commercialReady, documents }) => (
          <article key={pharmacy.id} className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Créée le {new Date(pharmacy.created_at).toLocaleDateString("fr-FR")}</p>
                <h3 className="mt-1 text-lg font-extrabold">{pharmacy.nom}</h3>
                <p className="text-sm text-slate-600">{[pharmacy.quartier, pharmacy.ville].filter(Boolean).join(" · ") || "Localisation non renseignée"}</p>
                {pharmacy.adresse && <p className="mt-1 text-sm text-slate-500">{pharmacy.adresse}</p>}
              </div>
              <span className={ready ? "rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-900" : "rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-950"}>{ready ? "Active et visible" : "À examiner"}</span>
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 p-4">
              <h4 className="font-bold">Pièces reçues — déclaration administrative</h4>
              <p className="mt-1 text-xs text-slate-600">Cet état indique uniquement les pièces déclarées comme reçues. Il ne signifie pas qu’elles ont été vérifiées ou authentifiées.</p>
              <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                {([
                  ["piece_existence_legale", "Pièce d’existence légale"],
                  ["registre_commerce", "Registre de commerce"],
                  ["niu", "Numéro d’identifiant unique (NIU)"],
                  ["attestation_non_redevance", "Attestation de non-redevance"],
                  ["plan_localisation", "Plan de localisation"],
                  ["cni_promoteur", "CNI du Promoteur"],
                ] as const).map(([key, label]) => (
                  <li key={key} className="flex items-center gap-2">
                    <span aria-hidden="true">{documents?.[key] ? "✓" : "○"}</span>
                    <span>{label}</span>
                    <span className="ml-auto text-xs text-slate-500">{documents?.[key] ? "Reçu" : "Non reçu"}</span>
                  </li>
                ))}
              </ul>
              <form action={mettreAJourPiecesRecues} className="mt-4 space-y-3 border-t border-slate-200 pt-4">
                <input type="hidden" name="pharmacie_id" value={pharmacy.id} />
                <p className="text-sm font-semibold">Mettre à jour la réception des documents</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {([
                    ["piece_existence_legale", "Pièce d’existence légale"],
                    ["registre_commerce", "Registre de commerce"],
                    ["niu", "Numéro d’identifiant unique (NIU)"],
                    ["attestation_non_redevance", "Attestation de non-redevance"],
                    ["plan_localisation", "Plan de localisation"],
                    ["cni_promoteur", "CNI du Promoteur"],
                  ] as const).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name={key} value="oui" defaultChecked={Boolean(documents?.[key])} className="size-4 accent-emerald-700" />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
                <button type="submit" className="min-h-10 rounded-full border border-naxa-green-900 px-4 py-2 text-sm font-bold text-naxa-green-900">Enregistrer les pièces reçues</button>
              </form>
              {documents?.mis_a_jour_le && <p className="mt-3 text-xs text-slate-500">Dernière déclaration de réception : {new Date(documents.mis_a_jour_le).toLocaleString("fr-FR")}</p>}
              {!documents && <p className="mt-2 text-xs text-amber-800">Aucune déclaration de réception enregistrée pour ce dossier.</p>}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Promoteur rattaché</p>
                {promoter ? <><p className="mt-1 font-bold">{[promoter.first_name, promoter.last_name].filter(Boolean).join(" ") || promoter.username || "Identité à compléter"}</p><p className="text-sm text-slate-600">{promoter.phone || "Téléphone non renseigné"}</p><p className="mt-1 text-xs text-slate-500">Compte : {promoter.actif ? "actif" : "inactif"} · Architecture : {promoter.architecture_code || "non attribuée"}</p></> : <p className="mt-1 text-sm text-red-700">{linkCount === 0 ? "Aucun rattachement réseau" : "Rattachement multiple ou Promoteur introuvable"}</p>}
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Contrôles de disponibilité</p>
                <ul className="mt-2 space-y-1 text-sm">
                  <li>{pharmacy.actif ? "✓" : "○"} Pharmacie activée</li>
                  <li>{pharmacy.visible_recherche ? "✓" : "○"} Visible dans la recherche</li>
                  <li>{link?.actif ? "✓" : "○"} Lien réseau actif</li>
                  <li>{promoter?.actif ? "✓" : "○"} Compte Promoteur actif</li>
                  <li>{architectureIsActive ? "✓" : "○"} Architecture attribuée et active</li>
                  <li>{commercialReady ? "✓" : "○"} Convention et abonnement cohérents</li>
                </ul>
              </div>
            </div>

            {!ready && (
              <form action={validerDossierPharmacie} className="mt-4 space-y-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                <input type="hidden" name="pharmacie_id" value={pharmacy.id} />
                <p className="text-sm font-semibold">La réception des pièces est suivie séparément ci-dessus. Pour activer la pharmacie, vérifiez les autorisations officielles et l’identité du responsable ; cette confirmation est indépendante des cases de réception documentaire.</p>
                <label className="flex items-start gap-3 text-sm">
                  <input type="checkbox" name="autorisations_verifiees" required disabled={Boolean(loadError || linkCount !== 1 || !promoter)} className="mt-1 size-4 accent-emerald-700" />
                  <span>Je confirme avoir vérifié les autorisations et l’identité du responsable, et autorise l’activation de ce dossier.</span>
                </label>
                <button type="submit" disabled={Boolean(loadError || linkCount !== 1 || !promoter)} className="min-h-11 w-full rounded-full bg-naxa-green-900 px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">Valider et activer la pharmacie</button>
              </form>
            )}
          </article>
        ))}
      </section>
    </main>
  );
}
