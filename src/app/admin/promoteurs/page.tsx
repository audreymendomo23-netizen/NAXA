import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requireAdminActive } from "@/lib/admin/require-admin-active";
import { suspendrePromoteurDisciplinaire, leverSuspensionPromoteur } from "./actions";

type SearchParams = Promise<{ ok?: string; erreur?: string }>;

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
  suspension: "La suspension disciplinaire n’a pas été enregistrée. Vérifiez la migration SM-01 et les droits de l’administrateur.",
  "levee-suspension": "La levée disciplinaire n’a pas été enregistrée. La suspension reste active.",
};

export default async function DossiersPromoteurs({ searchParams }: { searchParams: SearchParams }) {
  const filters = await searchParams;
  await requireAdminActive("/admin/promoteurs");
  const db = supabaseAdmin();
  const [{ data: pharmacies, error }, { data: partnerDossiers, error: partnerDossiersError }, { data: promoteurs, error: promoteursError }, { data: suspensions, error: suspensionsError }] = await Promise.all([
    db.from("pharmacies").select("id,nom,ville,quartier,created_at").order("created_at", { ascending: false }),
    db.from("admin_partner_dossiers")
      .select("partner_id,promoteur_id,universe_slug,monthly_fee_fcfa,architecture_code,dossier_status,created_at,partners!inner(name,city,neighborhood,status),profiles!inner(username,first_name,last_name)")
      .order("created_at", { ascending: false }).limit(500),
    db.from("profiles").select("id,username,first_name,last_name,actif").eq("role", "promoteur").order("created_at", { ascending: false }).limit(500),
    db.from("promoteur_suspensions_disciplinaires").select("id,promoteur_id,motif,observations,statut,suspendu_le").eq("statut", "active").order("suspendu_le", { ascending: false }).limit(500),
  ]);

  return (
    <main className="space-y-6">
      <header className="rounded-3xl bg-naxa-green-900 p-6 text-white">
        <p className="text-xs font-bold uppercase tracking-[.18em] text-white/70">Administration · conformité</p>
        <h1 className="mt-2 text-2xl font-extrabold sm:text-3xl">Dossiers Promoteurs & pharmacies</h1>
        <p className="mt-2 max-w-3xl text-sm text-white/80">
          Consultez les dossiers des pharmacies et des partenaires indépendants. Bébé &amp; Maman reste un service rattaché au dossier de sa pharmacie partenaire.
        </p>
      </header>

      {filters.ok === "suspension" && (
        <p role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">
          Suspension disciplinaire enregistrée. Le renouvellement commercial ne la lèvera pas.
        </p>
      )}
      {filters.ok === "levee-suspension" && (
        <p role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">
          Décision de levée enregistrée. L’accès reste soumis aux conditions commerciales et opérationnelles.
        </p>
      )}
      {filters.ok === "documents" && (
        <p role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">
          État des pièces reçues enregistré.
        </p>
      )}
      {filters.ok === "validation" && (
        <p role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">
          Dossier validé. La pharmacie et l’accès Promoteur sont activés.
        </p>
      )}
      {filters.erreur && (
        <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          {erreurs[filters.erreur] ?? "L’opération n’a pas abouti. Aucun succès n’est confirmé."}
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          La liste des dossiers pharmacies n’a pas pu être chargée. Actualisez la page ou réessayez plus tard.
        </p>
      )}

      <section className="space-y-4 rounded-3xl border border-amber-200 bg-amber-50 p-4 sm:p-6" aria-labelledby="sm01-suspensions">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.16em] text-amber-900">Contrôle disciplinaire · SM-01</p>
          <h2 id="sm01-suspensions" className="mt-1 text-xl font-extrabold text-slate-950">Suspensions disciplinaires Promoteurs</h2>
          <p className="mt-2 text-sm text-slate-700">Une suspension pour faute est à durée indéterminée. Elle bloque la publication Marketplace du Promoteur et de ses pharmacies rattachées. Un paiement ou renouvellement ne la lève jamais : seule une décision explicite d’un administrateur actif peut le faire.</p>
        </div>
        {(promoteursError || suspensionsError) && (
          <p role="alert" className="rounded-2xl border border-red-300 bg-white p-4 text-sm text-red-900">Le registre disciplinaire est indisponible. Vérifiez que la migration SM-01 a été appliquée à cet environnement; aucune action ne doit être considérée comme enregistrée.</p>
        )}
        {!promoteursError && !suspensionsError && (promoteurs ?? []).map((promoteur: any) => {
          const sanction = (suspensions ?? []).find((item: any) => item.promoteur_id === promoteur.id);
          const nom = [promoteur.first_name, promoteur.last_name].filter(Boolean).join(" ") || promoteur.username || promoteur.id;
          return <article key={promoteur.id} className="rounded-2xl border border-amber-200 bg-white p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h3 className="break-words font-extrabold text-slate-900">{nom}</h3>
                <p className="mt-1 break-all text-xs text-slate-500">Promoteur · {promoteur.id}</p>
                {sanction ? (
                  <p className="mt-2 text-sm font-bold text-red-800">Suspension active · motif : faute · depuis {new Date(sanction.suspendu_le).toLocaleString("fr-FR")}</p>
                ) : <p className="mt-2 text-sm font-semibold text-emerald-800">Aucune suspension disciplinaire active</p>}
              </div>
              {sanction ? (
                <form action={leverSuspensionPromoteur} className="flex w-full flex-col gap-2 sm:max-w-sm">
                  <input type="hidden" name="suspension_id" value={sanction.id} />
                  <label className="text-sm font-semibold text-slate-800" htmlFor={"motif-levee-" + sanction.id}>Motif de la décision de levée</label>
                  <input id={"motif-levee-" + sanction.id} name="motif_levee" maxLength={500} placeholder="Décision explicite (facultatif)" className="min-h-11 rounded-xl border border-slate-300 px-3 text-sm" />
                  <button type="submit" className="min-h-11 rounded-xl bg-[#0B3D26] px-4 py-2 text-sm font-bold text-white">Lever la suspension</button>
                </form>
              ) : (
                <form action={suspendrePromoteurDisciplinaire} className="flex w-full flex-col gap-2 sm:max-w-sm">
                  <input type="hidden" name="promoteur_id" value={promoteur.id} />
                  <button type="submit" className="min-h-11 rounded-xl bg-red-700 px-4 py-2 text-sm font-bold text-white">Suspendre pour faute</button>
                </form>
              )}
            </div>
          </article>;
        })}
        {!promoteursError && !suspensionsError && !promoteurs?.length && <p className="rounded-xl border border-dashed border-amber-300 bg-white p-4 text-sm text-slate-600">Aucun compte Promoteur trouvé.</p>}
      </section>

      {partnerDossiersError && <p role="alert" className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">Les dossiers des autres univers sont indisponibles. Vérifiez que la migration additive du registre transversal est appliquée dans l’environnement concerné.</p>}

      <section className="space-y-3" aria-labelledby="liste-dossiers-partenaires">
        <div>
          <h2 id="liste-dossiers-partenaires" className="text-xl font-extrabold">Dossiers Promoteurs — autres univers</h2>
          <p className="mt-1 text-sm text-slate-600">{partnerDossiersError ? "—" : partnerDossiers?.length ?? 0} dossier(s) partenaire(s)</p>
        </div>
        {!partnerDossiersError && !partnerDossiers?.length && <div className="rounded-2xl border border-dashed p-6 text-sm text-slate-600">Aucun dossier partenaire indépendant enregistré. Bébé &amp; Maman ne figure pas ici comme établissement : son statut est géré dans le dossier de sa pharmacie de parrainage.</div>}
        {(partnerDossiers ?? []).map((item: any) => {
          const partner = item.partners;
          const owner = item.profiles;
          const universeName: Record<string,string> = { parapharmacie:"Parapharmacie", examens:"Examens médicaux", prestations:"Prestations à domicile", aide:"Aide NAXA" };
          const dossierStatus: Record<string,string> = { pending:"À vérifier", validated:"Validé", rejected:"Rejeté" };
          return <article key={item.partner_id} className="flex flex-col gap-4 rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div className="min-w-0">
              <h3 className="break-words text-lg font-extrabold text-slate-900">{partner.name}</h3>
              <p className="mt-1 text-sm text-slate-600">{universeName[item.universe_slug] ?? item.universe_slug} · {[partner.neighborhood, partner.city].filter(Boolean).join(" · ")}</p>
              <p className="mt-1 text-sm text-slate-600">Promoteur : {[owner.first_name, owner.last_name].filter(Boolean).join(" ") || owner.username || "Non renseigné"}</p>
              <p className="mt-1 text-xs text-slate-500">Statut du dossier : {dossierStatus[item.dossier_status] ?? item.dossier_status} · Partenaire : {partner.status}</p>
            </div>
            <Link href={"/admin/promoteurs/partenaires/" + item.partner_id} className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border-2 border-[#FFE23D] bg-[#FFE23D] px-5 py-3 text-sm font-extrabold text-[#0B3D26] shadow-sm">Examiner / valider →</Link>
          </article>;
        })}
      </section>

      <section className="space-y-3" aria-labelledby="liste-dossiers">
        <div>
          <h2 id="liste-dossiers" className="text-xl font-extrabold">Liste des dossiers pharmacies</h2>
          <p className="mt-1 text-sm text-slate-600">{error ? "—" : pharmacies?.length ?? 0} dossier(s)</p>
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
