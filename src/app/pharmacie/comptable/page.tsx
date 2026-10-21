import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Evenement = {
  id: string;
  evenement_type: string;
  source_type: string;
  source_id: string;
  date_evenement: string;
  statut: "a_traiter" | "en_cours" | "traite" | "erreur";
  code_erreur: string | null;
  created_at: string;
};

type Ecriture = {
  id: string;
  date_ecriture: string;
  journal_code: string;
  reference_source: string | null;
  libelle: string;
  source_type: string;
  source_id: string;
  created_at: string;
};

const dateFr = (value: string) =>
  new Intl.DateTimeFormat("fr-CM", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

export default async function ComptableDashboardPage() {
  const sb = supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/connexion?retour=/pharmacie/comptable");

  const { data: profile, error: profileError } = await sb
    .from("profiles")
    .select("id,role,actif,pharmacie_id")
    .eq("id", auth.user.id)
    .single();

  if (profileError || !profile || profile.actif !== true || !profile.pharmacie_id) {
    redirect("/pharmacie");
  }

  // Le poste Comptable est une fonction interne autorisée par privilège :
  // aucune nouvelle valeur de profiles.role/role_type n'est créée.
  const { data: allowed, error: permissionError } = await sb.rpc("naxa_can", {
    p_privilege: "MANAGE_ACCOUNTING",
    p_pharmacie: profile.pharmacie_id,
    p_target: null,
  });
  if (permissionError || allowed !== true) redirect("/pharmacie");

  const [{ data: pharmacy, error: pharmacyError }, { data: evenements, error: eventsError },
    { data: ecritures, error: entriesError }, { data: periodes, error: periodsError }] = await Promise.all([
    sb.from("pharmacies").select("nom").eq("id", profile.pharmacie_id).maybeSingle(),
    sb.from("compta_evenement")
      .select("id,evenement_type,source_type,source_id,date_evenement,statut,code_erreur,created_at")
      .eq("pharmacie_id", profile.pharmacie_id)
      .order("created_at", { ascending: false }).limit(12),
    sb.from("compta_ecriture")
      .select("id,date_ecriture,journal_code,reference_source,libelle,source_type,source_id,created_at")
      .eq("pharmacie_id", profile.pharmacie_id)
      .order("date_ecriture", { ascending: false }).limit(8),
    sb.from("compta_periodes")
      .select("id,date_debut,date_fin,statut")
      .eq("pharmacie_id", profile.pharmacie_id)
      .order("date_debut", { ascending: false }).limit(4),
  ]);

  const error = pharmacyError || eventsError || entriesError || periodsError;
  const eventRows = (evenements ?? []) as Evenement[];
  const entryRows = (ecritures ?? []) as Ecriture[];
  const openPeriods = (periodes ?? []).filter((period) => period.statut === "ouverte").length;
  const pending = eventRows.filter((event) => event.statut === "a_traiter" || event.statut === "en_cours").length;
  const failed = eventRows.filter((event) => event.statut === "erreur").length;
  const treated = eventRows.filter((event) => event.statut === "traite").length;

  return (
    <main className="mx-auto max-w-6xl space-y-5 px-4 py-5 pb-16">
      <header className="-mx-4 flex flex-wrap items-center justify-between gap-3 bg-naxa-green-900 px-4 py-4 text-white">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-100">NAXA · Poste Comptable</p>
          <h1 className="mt-1 text-xl font-extrabold">{pharmacy?.nom ?? "Ma pharmacie"}</h1>
          <p className="mt-1 text-sm text-emerald-100">Consultation et contrôle — aucune action de caisse</p>
        </div>
        <Link href="/pharmacie" className="rounded-full border border-white/70 px-4 py-2 text-sm font-semibold hover:bg-white/10">
          Espace pharmacie
        </Link>
      </header>

      {error ? (
        <section role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Les données comptables ne peuvent pas être chargées. Aucun montant n’est remplacé par une valeur fictive. Vérifiez les droits et l’application des migrations sur l’environnement de test.
        </section>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-600">Écritures récentes</p>
              <p className="mt-2 text-2xl font-extrabold text-slate-950">{entryRows.length}</p>
              <p className="mt-1 text-xs text-slate-500">Dernières écritures affichées, maximum 8</p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-600">Événements en attente</p>
              <p className="mt-2 text-2xl font-extrabold text-slate-950">{pending}</p>
              <p className="mt-1 text-xs text-slate-500">Sur les 12 derniers événements chargés</p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-600">Événements en erreur</p>
              <p className="mt-2 text-2xl font-extrabold text-slate-950">{failed}</p>
              <p className="mt-1 text-xs text-slate-500">Sur les 12 derniers événements chargés</p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-600">Périodes ouvertes</p>
              <p className="mt-2 text-2xl font-extrabold text-slate-950">{openPeriods}</p>
              <p className="mt-1 text-xs text-slate-500">Parmi les 4 périodes les plus récentes</p>
            </article>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold text-slate-950">Journal comptable récent</h2>
                <p className="mt-1 text-sm text-slate-600">Consultation en lecture seule. Aucun détail de patient n’est affiché.</p>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">{treated} événements traités dans la file récente</span>
            </div>
            {entryRows.length === 0 ? (
              <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Aucune écriture disponible pour ce périmètre, ou le socle comptable n’est pas encore initialisé.</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-sm">
                  <thead><tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                    <th className="px-3 py-3">Date</th><th className="px-3 py-3">Journal</th><th className="px-3 py-3">Libellé</th><th className="px-3 py-3">Référence</th>
                  </tr></thead>
                  <tbody>{entryRows.map((entry) => (
                    <tr key={entry.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-3 py-3 whitespace-nowrap">{entry.date_ecriture}</td>
                      <td className="px-3 py-3">{entry.journal_code}</td>
                      <td className="px-3 py-3">{entry.libelle}</td>
                      <td className="px-3 py-3">{entry.reference_source ?? entry.source_id}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-bold text-slate-950">État de l’outbox</h2>
            <p className="mt-1 text-sm text-slate-600">Le worker ne passe un événement en « traité » qu’après création de l’écriture correspondante.</p>
            {eventRows.length === 0 ? (
              <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Aucun événement disponible. Les données apparaîtront après application des migrations et émission par les sources métier.</p>
            ) : (
              <ul className="mt-3 divide-y divide-slate-100">
                {eventRows.map((event) => (
                  <li key={event.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">{event.evenement_type}</p>
                      <p className="mt-1 text-xs text-slate-500">{event.source_type} · {event.source_id} · {dateFr(event.date_evenement)}</p>
                      {event.code_erreur && <p className="mt-1 text-xs text-amber-700">Code de traitement : {event.code_erreur}</p>}
                    </div>
                    <span className={"rounded-full px-3 py-1 text-xs font-semibold " + (event.statut === "traite" ? "bg-emerald-50 text-emerald-800" : event.statut === "erreur" ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-800")}>
                      {event.statut === "traite" ? "Traité" : event.statut === "erreur" ? "À investiguer" : event.statut === "en_cours" ? "En cours" : "À traiter"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <p className="text-xs leading-5 text-slate-500">Les indicateurs sont limités aux lignes chargées et ne constituent pas une balance complète. Les montants et calculs ne sont pas affichés tant que les données sources et mappings validés ne sont pas disponibles. État actualisé à l’ouverture de la page.</p>
        </>
      )}
    </main>
  );
}
