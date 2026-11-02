import Link from "next/link";
import { requireAdminActive } from "@/lib/admin/require-admin-active";

const statusLabels: Record<string, string> = {
  en_attente: "En attente",
  confirmee: "Confirmée",
  payee: "Payée",
  retiree: "Retirée",
  expiree: "Expirée",
  annulee: "Annulée",
};

const paymentLabels: Record<string, string> = {
  en_attente: "En attente",
  effectue: "Paiement signalé effectué",
  rembourse: "Remboursé",
  annule: "Annulé",
};

const shortId = (value: string) => value.replace(/-/g, "").slice(0, 8).toUpperCase();
const money = (value: number) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Number(value ?? 0)) + " FCFA";

export default async function AdminMarketplaceReservationsPage({
  searchParams,
}: {
  searchParams: { q?: string; statut?: string; mode?: string };
}) {
  const { sb } = await requireAdminActive("/admin/pilotage/reservations");
  const knownStatuses = Object.keys(statusLabels);
  const status = knownStatuses.includes(searchParams.statut ?? "") ? searchParams.statut! : "";
  const mode = ["reservation", "commande"].includes(searchParams.mode ?? "") ? searchParams.mode! : "";

  let query = sb
    .from("reservations")
    .select(
      "id,client_id,pharmacie_id,statut,total,expires_at,paiement_statut,paiement_mode,created_at,mode,commande_statut,frais_livraison,stock_decremented,stock_restored,consumed_at,pharmacies(nom),reservation_items(produit_id,quantite,prix_unitaire,produits(nom,dosage,forme))",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .limit(100);
  if (status) query = query.eq("statut", status);
  if (mode) query = query.eq("mode", mode);

  const { data, error, count } = await query;
  const reservations = (data ?? []) as any[];
  const term = (searchParams.q ?? "").trim().toLocaleLowerCase("fr");
  const filtered = reservations.filter((reservation) => {
    const pharmacy = Array.isArray(reservation.pharmacies) ? reservation.pharmacies[0] : reservation.pharmacies;
    const items = (reservation.reservation_items ?? []).map((item: any) => item.produits?.nom ?? "").join(" ");
    const haystack = [reservation.id, pharmacy?.nom ?? "", items, reservation.mode, reservation.statut].join(" ").toLocaleLowerCase("fr");
    return !term || haystack.includes(term);
  });

  const ids = reservations.map((reservation) => reservation.id);
  const eventsResult = ids.length
    ? await sb
        .from("reservation_events")
        .select("id,reservation_id,event_type,from_statut,to_statut,occurred_at")
        .in("reservation_id", ids)
        .order("occurred_at", { ascending: false })
        .limit(400)
    : { data: [], error: null };
  const eventsByReservation = new Map<string, any[]>();
  for (const event of eventsResult.data ?? []) {
    eventsByReservation.set(event.reservation_id, [...(eventsByReservation.get(event.reservation_id) ?? []), event]);
  }

  const summary = {
    pending: reservations.filter((item) => ["en_attente", "confirmee"].includes(item.statut)).length,
    paid: reservations.filter((item) => item.paiement_statut === "effectue").length,
    stockReview: reservations.filter((item) => item.stock_decremented && !item.stock_restored && !item.consumed_at).length,
    issues: reservations.filter((item) => item.stock_restored && item.consumed_at).length,
  };

  return (
    <main className="min-h-screen bg-[#F4F8F5] px-4 pb-12 text-slate-900">
      <div className="mx-auto max-w-7xl space-y-5 pt-5">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#0B3D26] p-4 text-white">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-100">NAXA · Pilotage Marketplace</p>
            <h1 className="mt-1 text-2xl font-black">Diagnostic des réservations</h1>
            <p className="mt-1 text-sm text-white/80">Consultation des dossiers, articles et événements · aucune mutation de stock, statut ou paiement.</p>
          </div>
          <nav className="flex flex-wrap gap-3 text-sm font-bold">
            <Link href="/admin/pilotage" className="underline">Pilotage</Link>
            <Link href="/admin/pilotage/rapports" className="underline">Rapports</Link>
            <Link href="/admin" className="underline">Administration</Link>
          </nav>
        </header>

        {error ? (
          <section role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
            La source des réservations est indisponible. Aucun compteur n’est calculé comme s’il s’agissait de zéro.
          </section>
        ) : (
          <>
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Dossiers chargés", reservations.length, "Sur les 100 plus récents"],
                ["À traiter", summary.pending, "En attente ou confirmés"],
                ["Paiement marqué effectué", summary.paid, "Statut déclaré par la pharmacie"],
                ["À examiner — stock", summary.stockReview + summary.issues, "Signaux de cohérence, pas une preuve d’incident"],
              ].map(([label, value, hint]) => (
                <article key={String(label)} className="rounded-2xl border bg-white p-4">
                  <p className="text-sm text-slate-500">{label}</p><p className="mt-1 text-3xl font-black">{value}</p><p className="mt-1 text-xs text-slate-500">{hint}</p>
                </article>
              ))}
            </section>

            <form method="get" role="search" aria-label="Filtrer les réservations" className="grid gap-3 rounded-2xl border bg-white p-4 sm:grid-cols-[minmax(0,1fr)_200px_200px_auto_auto]">
              <label className="text-sm font-semibold">Rechercher
                <input name="q" defaultValue={searchParams.q ?? ""} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3" placeholder="Référence, pharmacie, produit…" />
              </label>
              <label className="text-sm font-semibold">Statut
                <select name="statut" defaultValue={status} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3">
                  <option value="">Tous</option>
                  {knownStatuses.map((value) => <option key={value} value={value}>{statusLabels[value]}</option>)}
                </select>
              </label>
              <label className="text-sm font-semibold">Type
                <select name="mode" defaultValue={mode} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3">
                  <option value="">Tous</option><option value="reservation">Réservation</option><option value="commande">Commande</option>
                </select>
              </label>
              <button className="min-h-11 self-end rounded-xl bg-[#0B3D26] px-4 font-bold text-white">Filtrer</button>
              <Link href="/admin/pilotage/reservations" className="inline-flex min-h-11 items-center self-end rounded-xl border px-4 font-bold">Réinitialiser</Link>
            </form>

            <p className="text-sm text-slate-600">
              {filtered.length} dossier(s) affiché(s) · {reservations.length} chargés sur {count ?? "—"} au total. Les événements affichés sont limités aux 400 plus récents de cette sélection.
            </p>
            {eventsResult.error && <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950">Les dossiers sont lisibles, mais l’historique d’événements est indisponible pour cette consultation.</p>}
            {!filtered.length ? (
              <p className="rounded-2xl border bg-white p-5 text-sm text-slate-600">{reservations.length ? "Aucun dossier ne correspond aux filtres." : "Aucune réservation dans la source consultée."}</p>
            ) : (
              <section className="space-y-3" aria-label="Dossiers de réservation">
                {filtered.map((reservation) => {
                  const pharmacy = Array.isArray(reservation.pharmacies) ? reservation.pharmacies[0] : reservation.pharmacies;
                  const events = eventsByReservation.get(reservation.id) ?? [];
                  const items = reservation.reservation_items ?? [];
                  return (
                    <article key={reservation.id} className="rounded-2xl border bg-white p-4 shadow-sm sm:p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-bold uppercase tracking-widest text-emerald-800">{reservation.mode === "commande" ? "Commande" : "Réservation"} · {pharmacy?.nom ?? "Pharmacie non renseignée"}</p>
                          <h2 className="mt-1 text-lg font-extrabold">{statusLabels[reservation.statut] ?? reservation.statut}</h2>
                          <p className="mt-1 text-xs text-slate-500">Dossier {shortId(reservation.id)} · Client {shortId(reservation.client_id)}</p>
                        </div>
                        <div className="rounded-xl bg-slate-50 px-4 py-3 text-right">
                          <p className="text-xs text-slate-500">Total</p><p className="text-xl font-black">{money(reservation.total)}</p>
                          <p className="mt-1 text-xs text-slate-600">Paiement : {paymentLabels[reservation.paiement_statut] ?? reservation.paiement_statut}</p>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <div><p className="text-xs text-slate-500">Créée le</p><p className="mt-1 text-sm font-semibold">{new Date(reservation.created_at).toLocaleString("fr-FR")}</p></div>
                        <div><p className="text-xs text-slate-500">Expiration</p><p className="mt-1 text-sm font-semibold">{new Date(reservation.expires_at).toLocaleString("fr-FR")}</p></div>
                        <div><p className="text-xs text-slate-500">Préparation / commande</p><p className="mt-1 text-sm font-semibold">{reservation.commande_statut ?? "—"}</p></div>
                        <div><p className="text-xs text-slate-500">Paiement via</p><p className="mt-1 text-sm font-semibold">{reservation.paiement_mode ?? "Non précisé"}</p></div>
                      </div>

                      <div className="mt-4 border-t pt-3">
                        <h3 className="text-sm font-bold">Articles</h3>
                        {items.length ? (
                          <ul className="mt-2 space-y-2">{items.map((item: any, index: number) => (
                            <li key={item.produit_id ?? index} className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 text-sm">
                              <span>{item.produits?.nom ?? "Produit non renseigné"}{item.produits?.dosage ? " · " + item.produits.dosage : ""} × {item.quantite}</span>
                              <strong>{money(Number(item.prix_unitaire) * Number(item.quantite))}</strong>
                            </li>
                          ))}</ul>
                        ) : <p className="mt-2 text-sm text-slate-500">Aucun article retourné pour ce dossier.</p>}
                      </div>

                      <div className="mt-4 border-t pt-3">
                        <h3 className="text-sm font-bold">Journal des événements</h3>
                        {events.length ? (
                          <ol className="mt-2 space-y-2">{events.map((event: any) => (
                            <li key={event.id} className="flex flex-wrap items-start justify-between gap-2 text-sm">
                              <span className="font-semibold">{event.event_type}{event.from_statut || event.to_statut ? " · " + (event.from_statut ?? "—") + " → " + (event.to_statut ?? "—") : ""}</span>
                              <time className="text-xs text-slate-500">{new Date(event.occurred_at).toLocaleString("fr-FR")}</time>
                            </li>
                          ))}</ol>
                        ) : <p className="mt-2 text-sm text-slate-500">Aucun événement retourné pour ce dossier.</p>}
                      </div>

                      <div className="mt-4 flex flex-wrap gap-3 border-t pt-3 text-xs text-slate-500">
                        <span>Stock décrémenté : {reservation.stock_decremented ? "Oui" : "Non"}</span>
                        <span>Stock restauré : {reservation.stock_restored ? "Oui" : "Non"}</span>
                        <span>Consommation caisse : {reservation.consumed_at ? new Date(reservation.consumed_at).toLocaleString("fr-FR") : "Non enregistrée"}</span>
                        {reservation.frais_livraison > 0 && <span>Frais de livraison : {money(reservation.frais_livraison)}</span>}
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
