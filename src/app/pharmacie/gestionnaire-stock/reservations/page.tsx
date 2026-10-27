import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { annulerReservationGestionStock, confirmerReservationGestionStock, marquerPreparationReservationGestionStock } from "../actions";
import { GestionnaireStockSidebar } from "@/components/pharmacie/GestionnaireStockSidebar";

type StockRow = {
  pharmacie_id: string;
  produit_id: string;
  quantite: number;
  date_peremption: string | null;
  emplacement: string | null;
};
type LotRow = {
  pharmacie_id: string;
  produit_id: string;
  id: string;
  numero_lot: string;
  date_peremption: string | null;
  quantite: number;
  bloque: boolean;
  motif_blocage: string | null;
  emplacement: string | null;
};
type AllocationRow = { reservation_id: string; produit_id: string; lot_id: string; quantite: number; restauree_at: string | null };
type ItemRow = {
  produit_id: string;
  quantite: number;
  prix_unitaire: number;
  produits: { nom: string; dosage: string | null; forme: string | null } | null;
};
type ReservationRow = {
  id: string;
  pharmacie_id: string;
  client_id: string;
  statut: string;
  preparation_statut: string | null;
  preparation_demarre_le: string | null;
  prete_au_retrait_le: string | null;
  total: number;
  created_at: string;
  expires_at: string;
  mode: string;
  reservation_items: ItemRow[] | null;
};

const statusLabels: Record<string, string> = {
  en_attente: "À confirmer",
  confirmee: "Confirmée · à préparer",
  payee: "Payée · retrait à confirmer",
  retiree: "Retirée",
  annulee: "Annulée",
  expiree: "Expirée",
};

const shortId = (id: string) => id.replace(/-/g, "").slice(0, 8).toUpperCase();
const fcfa = (value: number) => `${Number(value || 0).toLocaleString("fr-FR")} FCFA`;

export default async function GestionnaireStockReservationsPage({
  searchParams,
}: {
  searchParams: { ok?: string; erreur?: string; page?: string; reservation?: string };
}) {
  const sb = supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/connexion?retour=/pharmacie/gestionnaire-stock/reservations");

  const { data: profile, error: profileError } = await sb
    .from("profiles")
    .select("role,fonction_interne,actif")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (profileError || !profile || profile.actif === false) redirect("/");

  const role = String(profile.role ?? "").toLowerCase();
  const fonction = String(profile.fonction_interne ?? "").toLowerCase();
  const { data: assignmentRows, error: assignmentError } = await sb.from("naxa_professional_assignments")
    .select("pharmacie_id,fonction,commence_at,expire_at").eq("profile_id", auth.user.id)
    .eq("statut","active").in("fonction",["gestionnaire_stock","magasinier"]);
  const now = Date.now();
  const assignedIds = (assignmentRows ?? []).filter(a => new Date(a.commence_at).getTime() <= now && new Date(a.expire_at).getTime() > now).map(a => a.pharmacie_id);
  const hasStockAssignment = assignedIds.length > 0;
  const allowedRole = role === "admin" || role === "promoteur" ||
    ["pharmacien", "pharmacien_assistant", "responsable", "gestionnaire_stock", "magasinier"].includes(fonction) || hasStockAssignment;
  if (!allowedRole) redirect("/");

  const { data: pharmacies, error: pharmaciesError } = await sb.rpc("my_pharmacies");
  const pharmacyIds = [...new Set([...(Array.isArray(pharmacies) ? pharmacies : []).filter((id): id is string => typeof id === "string"), ...assignedIds])];
  if ((pharmaciesError && !hasStockAssignment) || assignmentError) {
    return <main className="mx-auto max-w-5xl p-5"><p role="alert" className="rounded-xl bg-red-50 p-4 text-red-900">Impossible de déterminer le périmètre pharmacie du compte.</p></main>;
  }
  const { data: pharmacyRows } = pharmacyIds.length ? await sb.from("pharmacies").select("id,nom").in("id",pharmacyIds) : { data: [] as {id:string;nom:string}[] };
  if (!pharmacyIds.length) redirect("/");

  const pageNumber = Math.max(1, Math.min(10000, Number.parseInt(searchParams.page ?? "1", 10) || 1));
  const pageSize = 50;
  let reservationQuery = sb
    .from("reservations")
    .select("id,pharmacie_id,client_id,statut,preparation_statut,preparation_demarre_le,prete_au_retrait_le,total,created_at,expires_at,mode,reservation_items(produit_id,quantite,prix_unitaire,produits(nom,dosage,forme))", { count: "exact" })
    .in("pharmacie_id", pharmacyIds)
    .eq("mode", "reservation")
    .order("created_at", { ascending: true });
  const focusedReservation = searchParams.reservation && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(searchParams.reservation);
  reservationQuery = focusedReservation ? reservationQuery.eq("id", searchParams.reservation!) : reservationQuery.in("statut", ["en_attente", "confirmee"]);
  const { data: rawReservations, error: reservationError, count: reservationCount } = await reservationQuery
    .range((pageNumber - 1) * pageSize, pageNumber * pageSize - 1);

  const reservations = (rawReservations ?? []) as unknown as ReservationRow[];
  const productIds = [...new Set(reservations.flatMap((reservation) => (reservation.reservation_items ?? []).map((item) => item.produit_id)))];

  const [stockResult, lotsResult] = productIds.length
    ? await Promise.all([
        sb.from("stocks").select("pharmacie_id,produit_id,quantite,date_peremption,emplacement").in("pharmacie_id", pharmacyIds).in("produit_id", productIds),
        sb.from("stocks_lots").select("id,pharmacie_id,produit_id,numero_lot,date_peremption,quantite,bloque,motif_blocage,emplacement").in("pharmacie_id", pharmacyIds).in("produit_id", productIds),
      ])
    : [{ data: [], error: null }, { data: [], error: null }];

  const allocationResult = reservations.length
    ? await sb.from("reservation_item_lots").select("reservation_id,produit_id,lot_id,quantite,restauree_at").in("reservation_id", reservations.map((reservation) => reservation.id))
    : { data: [] as AllocationRow[], error: null };
  const stockRows = (stockResult.data ?? []) as StockRow[];
  const lotRows = (lotsResult.data ?? []) as LotRow[];
  const allocationRows = (allocationResult.data ?? []) as AllocationRow[];
  const stockKey = (pharmacyId: string, productId: string) => pharmacyId + ":" + productId;
  const stocks = new Map(stockRows.map((row) => [stockKey(row.pharmacie_id, row.produit_id), row]));
  const lotsByProduct = new Map<string, LotRow[]>();
  for (const lot of lotRows) {
    const key = stockKey(lot.pharmacie_id, lot.produit_id);
    lotsByProduct.set(key, [...(lotsByProduct.get(key) ?? []), lot]);
  }

  return (
    <main className="min-h-screen bg-[#F4F8F5] px-4 pb-12 text-slate-900">
      <div className="mx-auto max-w-6xl space-y-5 pt-5">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#0B3D26] p-4 text-white">
          <div><p className="text-xs font-bold uppercase tracking-widest text-emerald-100">NAXA · Poste de travail</p><h1 className="mt-1 text-2xl font-black">Réservations Marketplace</h1></div>
          <nav className="flex flex-wrap gap-3 text-sm font-bold"><Link className="underline" href="/pharmacie/gestionnaire-stock">Tableau de bord</Link><Link className="underline" href="/pharmacie/messages">Messages pharmacie</Link><Link className="underline" href="/pharmacie/caisse">Caisse</Link></nav>
        </header>

        <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]"><GestionnaireStockSidebar active="/pharmacie/gestionnaire-stock/reservations" /><div className="min-w-0 space-y-5">
        <section className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border bg-white p-4"><p className="text-sm text-slate-600">Dossiers à traiter</p><p className="mt-1 text-3xl font-black">{reservations.length}</p></div>
          <div className="rounded-2xl border bg-white p-4"><p className="text-sm text-slate-600">Échéance proche (30 min)</p><p className="mt-1 text-3xl font-black">{reservations.filter((r) => new Date(r.expires_at).getTime() - Date.now() <= 30 * 60 * 1000 && new Date(r.expires_at).getTime() > Date.now()).length}</p></div>
          <div className="rounded-2xl border bg-white p-4"><p className="text-sm text-slate-600">Source</p><p className="mt-1 text-sm font-bold">Réservations pharmacie existantes</p><p className="mt-1 text-xs text-slate-500">Aucun dossier ou moteur de stock parallèle.</p></div>
        </section>

        {searchParams.ok === "annulee" && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">La réservation a été annulée et la mise à jour serveur confirmée.</p>}{searchParams.ok === "en_preparation" && <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-950">Début de préparation enregistré côté serveur.</p>}{searchParams.ok === "prete_au_retrait" && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">Réservation marquée prête au retrait. Elle est protégée contre l’annulation disciplinaire automatique.</p>}{searchParams.ok === "confirmee" && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">Réservation confirmée. Le dossier est transmis au parcours de préparation et de retrait.</p>}
        {searchParams.erreur && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-900">{searchParams.erreur === "preparation" ? "Transition de préparation refusée : vérifie le statut, le périmètre et les droits du compte." : searchParams.erreur === "confirmation" ? "Coche la confirmation avant d’annuler." : searchParams.erreur === "confirmation_stock" ? "Confirmation refusée : le serveur a détecté une réservation expirée, un stock absent ou des lots utilisables insuffisants. Vérifie les lots et réessaie." : "Annulation refusée : vérifie le statut actuel et les droits du compte. Aucune réussite n’est présumée."}</p>}
        {reservationError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-900">Impossible de charger les réservations dans le périmètre du compte.</p>}
        {(stockResult.error || lotsResult.error || allocationResult.error) && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950">Les informations de stock, de lots ou d’allocation sont incomplètes. La confirmation est bloquée si l’affectation des lots ne peut pas être vérifiée.</p>}

        {!reservations.length && !reservationError && <section className="rounded-2xl border bg-white p-5"><h2 className="font-bold">Aucune réservation à préparer</h2><p className="mt-1 text-sm text-slate-600">Les nouveaux dossiers apparaîtront ici dès qu’ils seront enregistrés pour une pharmacie accessible à ce compte.</p></section>}

        <p className="text-sm text-slate-600">Dossiers actifs : {reservationCount ?? "—"} · page {pageNumber} sur {Math.max(1, Math.ceil((reservationCount ?? 0) / pageSize))}</p>
        <div className="space-y-4">
          {reservations.map((reservation) => {
            const expiresAt = new Date(reservation.expires_at).getTime();
            const remaining = expiresAt - Date.now();
            const pharmacyName = pharmacyRows?.find((row) => row.id === reservation.pharmacie_id)?.nom;
            return (
              <article key={reservation.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{pharmacyName ?? "Pharmacie autorisée"} · Client #{shortId(reservation.client_id)}</p><h2 className="mt-1 text-xl font-black">Réservation #{shortId(reservation.id)}</h2><p className="mt-1 text-sm text-slate-600">Reçue le {new Date(reservation.created_at).toLocaleString("fr-FR")}</p></div>
                  <span className={`rounded-full px-3 py-1 text-xs font-extrabold ${remaining <= 30 * 60 * 1000 ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-900"}`}>{reservation.preparation_statut === "prete_au_retrait" ? "Prête au retrait" : reservation.preparation_statut === "en_preparation" ? "En préparation" : reservation.statut === "confirmee" && reservation.preparation_statut === null ? "Phase historique à vérifier" : statusLabels[reservation.statut] ?? reservation.statut}</span>
                </div>
                <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm"><strong>Expiration :</strong> {new Date(reservation.expires_at).toLocaleString("fr-FR")} · {remaining <= 0 ? "Délai dépassé — vérification requise" : remaining <= 30 * 60 * 1000 ? "Moins de 30 minutes restantes" : "Délai restant : " + Math.floor(remaining / 60000) + " min"}</div>

                <h3 className="mt-4 font-extrabold">Produits de cette réservation</h3>
                <ul className="mt-2 space-y-3">
                  {(reservation.reservation_items ?? []).map((item) => {
                    const key = stockKey(reservation.pharmacie_id, item.produit_id);
                    const stock = stocks.get(key);
                    const lots = lotsByProduct.get(key) ?? [];
                    const lotsTracked = lots.length > 0;
                    const today = new Date().toISOString().slice(0, 10);
                    const allocations = allocationRows.filter(
                      (allocation) =>
                        allocation.reservation_id === reservation.id &&
                        allocation.produit_id === item.produit_id &&
                        !allocation.restauree_at
                    );
                    const allocatedQuantity = allocations.reduce(
                      (sum, allocation) => sum + Number(allocation.quantite || 0),
                      0
                    );
                    const allocationsValid =
                      !allocationResult.error &&
                      allocatedQuantity === item.quantite &&
                      allocations.length > 0 &&
                      allocations.every((allocation) => {
                        const lot = lotRows.find((row) => row.id === allocation.lot_id);
                        return Boolean(
                          lot &&
                          lot.pharmacie_id === reservation.pharmacie_id &&
                          lot.produit_id === item.produit_id &&
                          !lot.bloque &&
                          lot.date_peremption &&
                          lot.date_peremption >= today &&
                          Number.isSafeInteger(Number(allocation.quantite)) &&
                          Number(allocation.quantite) > 0
                        );
                      });
                    const usableLots = lots.filter((lot) => !lot.bloque && lot.quantite > 0 && Boolean(lot.date_peremption) && lot.date_peremption! >= today);
                    const usableLotQuantity = usableLots.reduce((sum, lot) => sum + Number(lot.quantite || 0), 0);
                    const usableQuantity = lotsTracked ? usableLotQuantity : stock && (!stock.date_peremption || stock.date_peremption >= new Date().toISOString().slice(0, 10)) ? Number(stock.quantite || 0) : 0;
                    const locations = lotsTracked
                      ? usableLots.map((lot) => `${lot.emplacement?.trim() || "Emplacement non renseigné"} · lot ${lot.numero_lot} · péremption ${lot.date_peremption}`)
                      : stock?.emplacement?.trim() || "Emplacement non renseigné";
                    const blockedOrExpired = lotsTracked && usableLots.length === 0;
                    const sufficient = usableQuantity >= item.quantite && !blockedOrExpired;
                    return <li key={item.produit_id} className="rounded-xl border p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-bold">{item.produits?.nom ?? "Produit sans nom"} {item.produits?.dosage ?? ""} {item.produits?.forme ?? ""}</p><p className="text-sm text-slate-600">Demandé : {item.quantite} · Stock restant après réservations : {usableQuantity} · Déjà affecté à ce dossier : {lotsTracked ? allocatedQuantity : stock ? item.quantite : 0}</p></div><span className={`rounded-full px-2 py-1 text-xs font-bold ${sufficient ? "bg-emerald-100 text-emerald-900" : "bg-red-100 text-red-900"}`}>{sufficient ? (lotsTracked ? "Lots affectés et valides" : "Stock agrégé réservé") : "Affectation à vérifier"}</span></div>
                      <p className="mt-2 text-sm"><strong>Localisation :</strong> {Array.isArray(locations) ? locations.join(" ; ") || "Aucun lot utilisable" : locations}</p>
                      {lotsTracked && <p className={`mt-2 text-xs font-semibold ${allocationsValid ? "text-emerald-800" : "text-red-700"}`}>{allocationResult.error ? "Allocation des lots indisponible : appliquer les migrations de réservation avant confirmation." : allocationsValid ? `Allocation FEFO confirmée : ${allocatedQuantity} unité(s) sur ${allocations.length} lot(s).` : `Allocation insuffisante ou lot bloqué/périmé : ${allocatedQuantity}/${item.quantite} unité(s) affectée(s).`}</p>}{lotsTracked && <ul className="mt-2 space-y-1 text-xs text-slate-600">{lots.map((lot) => <li key={lot.numero_lot}>Lot {lot.numero_lot} · {lot.quantite} unité(s) · péremption {lot.date_peremption} · {lot.bloque ? "BLOQUÉ" : lot.date_peremption && lot.date_peremption < new Date().toISOString().slice(0, 10) ? "PÉRIMÉ" : "contrôle à confirmer"}{lot.motif_blocage ? " · " + lot.motif_blocage : ""}</li>)}</ul>}
                      {!lotsTracked && stock?.date_peremption && <p className="mt-1 text-xs text-slate-600">Péremption agrégée enregistrée : {stock.date_peremption}. Vérifie les lots si cette information n’est pas spécifique à l’unité prélevée.</p>}
                    </li>;
                  })}
                </ul>
                <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-t pt-3"><div><p className="font-black">{fcfa(reservation.total)}</p><Link href={"/pharmacie/messages?reservation="+reservation.id} className="mt-2 inline-block text-sm font-bold text-emerald-900 underline">Ouvrir les messages liés à ce dossier</Link></div>
                  {reservation.statut === "confirmee" && reservation.preparation_statut === "non_commencee" && <form action={marquerPreparationReservationGestionStock} className="flex flex-wrap items-center gap-2"><input type="hidden" name="reservation_id" value={reservation.id}/><input type="hidden" name="etat" value="en_preparation"/><button type="submit" className="min-h-10 rounded-xl bg-amber-400 px-3 py-2 text-sm font-bold text-slate-950">Démarrer la préparation</button></form>}
                  {reservation.statut === "confirmee" && reservation.preparation_statut === "en_preparation" && <form action={marquerPreparationReservationGestionStock} className="flex flex-wrap items-center gap-2"><input type="hidden" name="reservation_id" value={reservation.id}/><input type="hidden" name="etat" value="prete_au_retrait"/><button type="submit" className="min-h-10 rounded-xl bg-emerald-700 px-3 py-2 text-sm font-bold text-white">Marquer prête au retrait</button></form>}
                  {reservation.statut === "en_attente" && <form action={confirmerReservationGestionStock} className="flex flex-wrap items-center gap-2"><input type="hidden" name="reservation_id" value={reservation.id}/><button type="submit" disabled={(reservation.reservation_items ?? []).some((item) => { const key = stockKey(reservation.pharmacie_id, item.produit_id); const stock = stocks.get(key); const itemLots = lotsByProduct.get(key) ?? []; if (!itemLots.length) return !stock || Number(stock.quantite || 0) < item.quantite || Boolean(stock.date_peremption && stock.date_peremption < new Date().toISOString().slice(0,10)); const allocated = allocationRows.filter((a) => a.reservation_id === reservation.id && a.produit_id === item.produit_id && !a.restauree_at); return Boolean(allocationResult.error) || allocated.length === 0 || allocated.reduce((sum, a) => sum + Number(a.quantite || 0), 0) !== item.quantite || allocated.some((a) => { const lot = lotRows.find((l) => l.id === a.lot_id); return !lot || lot.pharmacie_id !== reservation.pharmacie_id || lot.produit_id !== item.produit_id || lot.bloque || !lot.date_peremption || lot.date_peremption < new Date().toISOString().slice(0,10) || !Number.isSafeInteger(Number(a.quantite)) || Number(a.quantite) <= 0; }); })} className="min-h-10 rounded-xl bg-[#0B3D26] px-3 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">Confirmer disponibilité et préparer</button></form>}{["en_attente", "confirmee"].includes(reservation.statut) && reservation.preparation_statut !== "prete_au_retrait" && !(reservation.statut === "confirmee" && reservation.preparation_statut === null) && <form action={annulerReservationGestionStock} className="flex flex-wrap items-center gap-2"><input type="hidden" name="reservation_id" value={reservation.id}/><label className="flex items-center gap-2 text-xs text-slate-700"><input type="checkbox" name="confirmation" value="oui" required/> Je confirme l’annulation de ce dossier</label><button type="submit" className="min-h-10 rounded-xl border border-red-300 px-3 py-2 text-sm font-bold text-red-800">Annuler la réservation</button></form>}
                </div>
              </article>
            );
          })}
        </div>
        <nav aria-label="Pagination des réservations" className="flex items-center justify-between gap-3"><span className="text-xs text-slate-500">Page {pageNumber} · {Math.min((pageNumber - 1) * pageSize + 1, reservationCount ?? 0)}–{Math.min(pageNumber * pageSize, reservationCount ?? 0)} sur {reservationCount ?? "—"}</span><div className="flex gap-2">{pageNumber > 1 && <Link className="rounded-xl border bg-white px-3 py-2 text-sm font-bold" href={"?page=" + (pageNumber - 1)}>Précédent</Link>}{pageNumber < Math.ceil((reservationCount ?? 0) / pageSize) && <Link className="rounded-xl border bg-white px-3 py-2 text-sm font-bold" href={"?page=" + (pageNumber + 1)}>Suivant</Link>}</div></nav>
        <p className="text-xs leading-relaxed text-slate-500">Les informations de stock sont indicatives au chargement de la page. Le serveur doit revalider le stock, les lots, le statut et le périmètre avant toute préparation ou annulation. Les emplacements absents ne sont jamais inventés.</p>
        </div></div>
      </div>
    </main>
  );
}
