import { supabaseServer } from "@/lib/supabase/server";

const allowedFunctions = ["pharmacien", "pharmacien_assistant", "responsable", "gestionnaire_stock", "magasinier"];
const csvCell = (value: unknown) => {
  const raw = value === null || value === undefined ? "" : String(value);
  return '"' + raw.replace(/"/g, '""').replace(/\r?\n/g, " ") + '"';
};

export async function GET(request: Request) {
  const sb = supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return Response.redirect(new URL("/connexion?retour=/pharmacie/gestionnaire-stock/historique-rapports/export", request.url), 303);

  const { data: profile, error: profileError } = await sb.from("profiles")
    .select("role,fonction_interne,actif").eq("id", auth.user.id).maybeSingle();
  const role = String(profile?.role ?? "").toLowerCase();
  const fn = String(profile?.fonction_interne ?? "").toLowerCase();
  if (profileError || !profile || profile.actif !== true || !(role === "admin" || role === "promoteur" || allowedFunctions.includes(fn))) {
    return new Response("Accès refusé", { status: 403 });
  }

  const { data: rawPharmacies, error: scopeError } = await sb.rpc("my_pharmacies");
  const pharmacyIds = [...new Set((Array.isArray(rawPharmacies) ? rawPharmacies : [])
    .map((row) => typeof row === "string" ? row : row && typeof row === "object" ? ((row as { pharmacie_id?: string; id?: string }).pharmacie_id ?? (row as { id?: string }).id) : undefined)
    .filter((id): id is string => Boolean(id))];
  if (scopeError || !pharmacyIds.length) return new Response("Périmètre pharmacie indisponible", { status: 503 });

  const [movements, reservations, adjustments, outgoingTransfers, incomingTransfers] = await Promise.all([
    sb.from("stock_manager_movement_journal")
      .select("pharmacie_id,produit_id,numero_lot,source_table,event_type,quantite_avant,quantite_apres,bloque_avant,bloque_apres,emplacement_avant,emplacement_apres,motif_operation,cree_le,produits(nom)")
      .in("pharmacie_id", pharmacyIds).order("cree_le", { ascending: false }).limit(5000),
    sb.from("reservations")
      .select("id,pharmacie_id,statut,total,created_at,expires_at,mode")
      .in("pharmacie_id", pharmacyIds).order("created_at", { ascending: false }).limit(5000),
    sb.from("inventaire_ajustements")
      .select("pharmacie_id,produit_id,quantite_theorique,quantite_comptee,ecart,cree_le,produits(nom),inventaires(reference)")
      .in("pharmacie_id", pharmacyIds).order("cree_le", { ascending: false }).limit(5000),
    sb.from("stock_manager_transfers")
      .select("id,source_pharmacie_id,destination_pharmacie_id,produit_id,numero_lot,quantite,motif,cree_le,produits(nom)")
      .in("source_pharmacie_id", pharmacyIds).order("cree_le", { ascending: false }).limit(5000),
    sb.from("stock_manager_transfers")
      .select("id,source_pharmacie_id,destination_pharmacie_id,produit_id,numero_lot,quantite,motif,cree_le,produits(nom)")
      .in("destination_pharmacie_id", pharmacyIds).order("cree_le", { ascending: false }).limit(5000),
  ]);
  if (movements.error || reservations.error || adjustments.error || outgoingTransfers.error || incomingTransfers.error) {
    return new Response("Export indisponible : appliquez les migrations du poste stock et vérifiez les accès de lecture.", { status: 503 });
  }

  const rows: unknown[][] = [["categorie", "date", "pharmacie_id", "reference", "produit", "quantite_avant", "quantite_apres", "ecart", "statut", "details"]];
  for (const m of movements.data ?? []) {
    const product = m.produits as unknown as { nom?: string } | null;
    rows.push(["mouvement_stock", m.cree_le, m.pharmacie_id, m.numero_lot ?? "", product?.nom ?? m.produit_id,
      m.quantite_avant, m.quantite_apres,
      m.quantite_avant !== null && m.quantite_apres !== null ? Number(m.quantite_apres) - Number(m.quantite_avant) : "",
      m.event_type, [m.source_table, m.bloque_avant === null && m.bloque_apres === null ? "" : "blocage " + m.bloque_avant + " → " + m.bloque_apres, m.emplacement_avant || m.emplacement_apres || "", m.motif_operation || ""].filter(Boolean).join(" · ")]);
  }
  for (const r of reservations.data ?? []) {
    rows.push(["reservation", r.created_at, r.pharmacie_id, r.id, "", "", "", "", r.statut,
      "mode=" + r.mode + "; total=" + r.total + " FCFA; expiration=" + r.expires_at]);
  }
  for (const a of adjustments.data ?? []) {
    const product = a.produits as unknown as { nom?: string } | null;
    const inventory = a.inventaires as unknown as { reference?: string | null } | null;
    rows.push(["ecart_inventaire", a.cree_le, a.pharmacie_id, inventory?.reference ?? "", product?.nom ?? a.produit_id,
      a.quantite_theorique, a.quantite_comptee, a.ecart, "applique", "produit_id=" + a.produit_id]);
  }

  const transfers = [...new Map([...(outgoingTransfers.data ?? []), ...(incomingTransfers.data ?? [])].map((transfer) => [transfer.id, transfer])).values()];
  for (const transfer of transfers) {
    const product = transfer.produits as unknown as { nom?: string } | null;
    rows.push(["transfert_inter_pharmacie", transfer.cree_le, transfer.source_pharmacie_id,
      transfer.id, product?.nom ?? transfer.produit_id, "", transfer.quantite, transfer.quantite,
      "transfere", "destination=" + transfer.destination_pharmacie_id + "; lot=" + (transfer.numero_lot ?? "non lotisé") + "; motif=" + transfer.motif]);
  }

  const csv = "\uFEFF" + rows.map((row) => row.map(csvCell).join(";")).join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="naxa-gestion-stock-historique.csv"',
      "Cache-Control": "private, no-store",
    },
  });
}
