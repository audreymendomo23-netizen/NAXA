import Link from "next/link";
import { requireAdminActive } from "@/lib/admin/require-admin-active";

const labels: Record<string, string> = {
  requested: "À confirmer",
  confirmed: "Confirmée",
  completed: "Terminée",
  cancelled: "Annulée",
  expired: "Expirée",
};

const statuses = ["requested", "confirmed", "completed", "cancelled", "expired"];

const money = (value: number) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value) + " FCFA";

export default async function AdminHomeServiceRequestsPage({
  searchParams,
}: {
  searchParams: { q?: string; statut?: string };
}) {
  const { sb } = await requireAdminActive("/admin/prestations/demandes");
  const status = statuses.includes(searchParams.statut ?? "") ? searchParams.statut! : "";
  let requestQuery = sb
    .from("home_service_requests")
    .select(
      "id,partner_id,offer_id,offer_name,category,price_fcfa,service_area_label,preferred_at,status,created_at,updated_at,confirmed_at,completed_at,partners!inner(name,city,neighborhood,status)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .limit(100);
  if (status) requestQuery = requestQuery.eq("status", status);

  const { data, error, count } = await requestQuery;
  const rows = (data ?? []) as any[];
  const term = (searchParams.q ?? "").trim().toLocaleLowerCase("fr");
  const filtered = rows.filter((row) => {
    const partner = Array.isArray(row.partners) ? row.partners[0] : row.partners;
    const haystack = [
      row.offer_name,
      row.category,
      row.service_area_label,
      partner?.name ?? "",
      partner?.city ?? "",
      partner?.neighborhood ?? "",
      row.id,
    ].join(" ").toLocaleLowerCase("fr");
    return !term || haystack.includes(term);
  });

  const counts = {
    requested: rows.filter((row) => row.status === "requested").length,
    confirmed: rows.filter((row) => row.status === "confirmed").length,
    completed: rows.filter((row) => row.status === "completed").length,
    closed: rows.filter((row) => ["cancelled", "expired"].includes(row.status)).length,
  };

  return (
    <main className="min-h-screen bg-[#F8FAF9] px-4 pb-12 text-slate-900">
      <div className="mx-auto max-w-6xl space-y-5 pt-5">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#064B2A] p-4 text-white">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-100">NAXA · Supervision administrative</p>
            <h1 className="mt-1 text-2xl font-black">Demandes de prestations à domicile</h1>
            <p className="mt-1 text-sm text-white/80">File de diagnostic en lecture seule · aucun paiement ni changement de statut.</p>
          </div>
          <nav className="flex flex-wrap gap-3 text-sm font-bold">
            <Link href="/admin/prestations" className="underline">Offres de prestations</Link>
            <Link href="/admin" className="underline">Administration</Link>
          </nav>
        </header>

        {error ? (
          <section role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
            La file des demandes est indisponible. Aucun résultat vide n’est présenté comme une absence de demandes. Vérifiez l’accès Admin aux demandes et aux partenaires.
          </section>
        ) : (
          <>
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Demandes chargées", rows.length, "Sur les 100 plus récentes"],
                ["À confirmer", counts.requested, "Attente de réponse partenaire"],
                ["Confirmées", counts.confirmed, "Intervention acceptée"],
                ["Terminées / closes", counts.completed + counts.closed, "Terminées, annulées ou expirées"],
              ].map(([label, value, hint]) => (
                <article key={String(label)} className="rounded-2xl border bg-white p-4">
                  <p className="text-sm text-slate-500">{label}</p>
                  <p className="mt-1 text-3xl font-black">{value}</p>
                  <p className="mt-1 text-xs text-slate-500">{hint}</p>
                </article>
              ))}
            </section>

            <form method="get" role="search" aria-label="Filtrer les demandes de prestations" className="grid gap-3 rounded-2xl border bg-white p-4 sm:grid-cols-[minmax(0,1fr)_220px_auto_auto]">
              <label className="text-sm font-semibold">Rechercher
                <input name="q" defaultValue={searchParams.q ?? ""} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3" placeholder="Prestation, professionnel, zone…" />
              </label>
              <label className="text-sm font-semibold">Statut
                <select name="statut" defaultValue={status} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3">
                  <option value="">Tous les statuts</option>
                  {statuses.map((value) => <option key={value} value={value}>{labels[value]}</option>)}
                </select>
              </label>
              <button className="min-h-11 self-end rounded-xl bg-[#064B2A] px-4 font-bold text-white">Filtrer</button>
              <Link href="/admin/prestations/demandes" className="inline-flex min-h-11 items-center self-end rounded-xl border px-4 font-bold">Réinitialiser</Link>
            </form>

            <p className="text-sm text-slate-600">
              {filtered.length} demande(s) affichée(s) · {rows.length} chargée(s) sur {count ?? "—"} au total. La liste est limitée aux 100 demandes les plus récentes.
            </p>
            {!filtered.length ? (
              <p className="rounded-2xl border bg-white p-5 text-sm text-slate-600">
                {rows.length ? "Aucune demande ne correspond aux filtres." : "Aucune demande n’est enregistrée dans la source consultée."}
              </p>
            ) : (
              <section aria-label="Demandes de prestations" className="space-y-3">
                {filtered.map((row) => {
                  const partner = Array.isArray(row.partners) ? row.partners[0] : row.partners;
                  return (
                    <article key={row.id} className="rounded-2xl border bg-white p-4 shadow-sm sm:p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-bold uppercase tracking-widest text-teal-800">{row.category}</p>
                          <h2 className="mt-1 break-words text-lg font-extrabold">{row.offer_name}</h2>
                          <p className="mt-1 text-sm text-slate-600">{partner?.name ?? "Professionnel non renseigné"} · {partner?.city ?? "Ville non renseignée"}{partner?.neighborhood ? " · " + partner.neighborhood : ""}</p>
                        </div>
                        <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-900">{labels[row.status] ?? row.status}</span>
                      </div>
                      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                        <div><dt className="text-slate-500">Zone demandée</dt><dd className="mt-1 font-semibold">{row.service_area_label}</dd></div>
                        <div><dt className="text-slate-500">Tarif indicatif</dt><dd className="mt-1 font-semibold">{row.price_fcfa == null ? "À convenir" : money(Number(row.price_fcfa))}</dd></div>
                        <div><dt className="text-slate-500">Date souhaitée</dt><dd className="mt-1 font-semibold">{row.preferred_at ? new Date(row.preferred_at).toLocaleString("fr-FR") : "Non précisée"}</dd></div>
                        <div><dt className="text-slate-500">Demande créée</dt><dd className="mt-1 font-semibold">{new Date(row.created_at).toLocaleString("fr-FR")}</dd></div>
                      </dl>
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-xs text-slate-500">
                        <span>Référence demande : {String(row.id).slice(0, 8).toUpperCase()} · Aucun renseignement client sensible affiché</span>
                        <span>Dernière mise à jour : {new Date(row.updated_at).toLocaleString("fr-FR")}</span>
                      </div>
                    </article>
                  );
                })}
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
