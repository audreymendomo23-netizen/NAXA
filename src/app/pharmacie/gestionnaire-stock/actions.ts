"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";

const safeUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export async function confirmerReservationGestionStock(formData: FormData) {
  const sb = supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/connexion?retour=/pharmacie/gestionnaire-stock/reservations");
  const id = String(formData.get("reservation_id") ?? "");
  if (!safeUuid(id)) redirect("/pharmacie/gestionnaire-stock/reservations?erreur=confirmation");
  const { error } = await sb.rpc("gestionnaire_stock_reservation_confirmer", { p_reservation: id });
  if (error) redirect("/pharmacie/gestionnaire-stock/reservations?erreur=confirmation_stock");
  revalidatePath("/pharmacie/gestionnaire-stock");
  revalidatePath("/pharmacie/gestionnaire-stock/reservations");
  revalidatePath("/pharmacie/caisse");
  revalidatePath("/pharmacie/caisse/retraits-marketplace");
  redirect("/pharmacie/gestionnaire-stock/reservations?ok=confirmee");
}

export async function annulerReservationGestionStock(formData: FormData) {
  const sb = supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/connexion?retour=/pharmacie/gestionnaire-stock/reservations");

  const id = String(formData.get("reservation_id") ?? "");
  const confirmation = formData.get("confirmation") === "oui";
  if (!safeUuid(id) || !confirmation) {
    redirect("/pharmacie/gestionnaire-stock/reservations?erreur=confirmation");
  }

  // La RPC existante vérifie le périmètre pharmacie, verrouille la réservation,
  // contrôle la transition et restaure le stock selon ses règles métier.
  const { data, error } = await sb.rpc("gestionnaire_stock_reservation_annuler", { p_reservation: id });
  if (error || data !== true) {
    redirect("/pharmacie/gestionnaire-stock/reservations?erreur=annulation");
  }

  revalidatePath("/pharmacie/gestionnaire-stock");
  revalidatePath("/pharmacie/gestionnaire-stock/reservations");
  revalidatePath("/pharmacie/caisse");
  revalidatePath("/pharmacie/caisse/retraits-marketplace");
  redirect("/pharmacie/gestionnaire-stock/reservations?ok=annulee");
}

export async function modifierEmplacementStock(formData: FormData) {
  const sb = supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/connexion?retour=/pharmacie/gestionnaire-stock/stock-logistique");
  const pharmacie = String(formData.get("pharmacie_id") ?? "");
  const produit = String(formData.get("produit_id") ?? "");
  const emplacementRaw = String(formData.get("emplacement") ?? "").trim();
  if (!safeUuid(pharmacie) || !safeUuid(produit) || emplacementRaw.length > 160) {
    redirect("/pharmacie/gestionnaire-stock/stock-logistique?erreur=emplacement");
  }
  const { error } = await sb.rpc("stock_emplacement_modifier", {
    p_pharmacie: pharmacie, p_produit: produit, p_emplacement: emplacementRaw || null,
  });
  if (error) redirect("/pharmacie/gestionnaire-stock/stock-logistique?erreur=emplacement");
  revalidatePath("/pharmacie/gestionnaire-stock");
  revalidatePath("/pharmacie/gestionnaire-stock/stock-logistique");
  revalidatePath("/pharmacie/gestionnaire-stock/reservations");
  redirect("/pharmacie/gestionnaire-stock/stock-logistique?ok=emplacement");
}

export async function modifierEmplacementLot(formData: FormData) {
  const sb = supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/connexion?retour=/pharmacie/gestionnaire-stock/lots-peremptions");
  const lot = String(formData.get("lot_id") ?? "");
  const emplacementRaw = String(formData.get("emplacement") ?? "").trim();
  if (!safeUuid(lot) || emplacementRaw.length > 160) {
    redirect("/pharmacie/gestionnaire-stock/lots-peremptions?erreur=emplacement");
  }
  const { error } = await sb.rpc("stock_lot_emplacement_modifier", {
    p_lot: lot, p_emplacement: emplacementRaw || null,
  });
  if (error) redirect("/pharmacie/gestionnaire-stock/lots-peremptions?erreur=emplacement");
  revalidatePath("/pharmacie/gestionnaire-stock");
  revalidatePath("/pharmacie/gestionnaire-stock/lots-peremptions");
  revalidatePath("/pharmacie/gestionnaire-stock/reservations");
  redirect("/pharmacie/gestionnaire-stock/lots-peremptions?ok=emplacement");
}

export async function ouvrirServiceGestionStock(formData: FormData) {
  const sb = supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/connexion?retour=/pharmacie/gestionnaire-stock/service");
  const pharmacie = String(formData.get("pharmacie_id") ?? "");
  if (!safeUuid(pharmacie)) redirect("/pharmacie/gestionnaire-stock/service?erreur=validation");
  const { error } = await sb.rpc("stock_service_open", {
    p_pharmacie: pharmacie,
    p_note: String(formData.get("note_debut") ?? "").trim() || null,
  });
  if (error) redirect("/pharmacie/gestionnaire-stock/service?erreur=ouverture");
  revalidatePath("/pharmacie/gestionnaire-stock");
  revalidatePath("/pharmacie/gestionnaire-stock/service");
  redirect("/pharmacie/gestionnaire-stock/service?ok=ouvert");
}

function collectInventoryCounts(formData: FormData) {
  const counts: { produit_id: string; quantite_comptee: number }[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("count_")) continue;
    const produit_id = key.slice("count_".length);
    const raw = String(value ?? "").trim();
    const quantite_comptee = Number(raw);
    if (!safeUuid(produit_id) || raw === "" || !Number.isSafeInteger(quantite_comptee) || quantite_comptee < 0) {
      throw new Error("Comptage invalide");
    }
    counts.push({ produit_id, quantite_comptee });
  }
  if (counts.length === 0 || counts.length > 5000) throw new Error("Inventaire vide ou trop volumineux");
  if (new Set(counts.map((line) => line.produit_id)).size !== counts.length) throw new Error("Produit dupliqué");
  return counts;
}

export async function enregistrerComptageOuvertureServiceGestionStock(formData: FormData) {
  const sb = supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/connexion?retour=/pharmacie/gestionnaire-stock/service");
  const session = String(formData.get("session_id") ?? "");
  let counts;
  try { if (!safeUuid(session)) throw new Error("Session invalide"); counts = collectInventoryCounts(formData); }
  catch { redirect("/pharmacie/gestionnaire-stock/service?erreur=comptage_ouverture"); }
  const { error } = await sb.rpc("stock_service_record_count", {
    p_session: session, p_phase: "opening", p_counts: counts,
  });
  if (error) redirect("/pharmacie/gestionnaire-stock/service?erreur=comptage_ouverture");
  revalidatePath("/pharmacie/gestionnaire-stock");
  revalidatePath("/pharmacie/gestionnaire-stock/service");
  redirect("/pharmacie/gestionnaire-stock/service?ok=inventaire_ouverture");
}

export async function fermerServiceGestionStock(formData: FormData) {
  const sb = supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/connexion?retour=/pharmacie/gestionnaire-stock/service");
  const session = String(formData.get("session_id") ?? "");
  const note = String(formData.get("note_fin") ?? "").trim();
  let counts;
  try {
    if (!safeUuid(session) || note.length > 500) throw new Error("Session invalide");
    counts = collectInventoryCounts(formData);
  } catch { redirect("/pharmacie/gestionnaire-stock/service?erreur=comptage_fermeture"); }
  const { error: countError } = await sb.rpc("stock_service_record_count", {
    p_session: session, p_phase: "closing", p_counts: counts,
  });
  if (countError) redirect("/pharmacie/gestionnaire-stock/service?erreur=comptage_fermeture");
  const { error } = await sb.rpc("stock_service_close", {
    p_session: session, p_note: note || null,
  });
  if (error) redirect("/pharmacie/gestionnaire-stock/service?erreur=fermeture");
  revalidatePath("/pharmacie/gestionnaire-stock");
  revalidatePath("/pharmacie/gestionnaire-stock/service");
  revalidatePath("/pharmacie/gestionnaire-stock/historique-rapports");
  redirect("/pharmacie/gestionnaire-stock/service?ok=ferme");
}

export async function modifierBlocageLotGestionStock(formData: FormData) {
  const sb=supabaseServer();const {data:auth}=await sb.auth.getUser();
  if(!auth.user)redirect("/connexion?retour=/pharmacie/gestionnaire-stock/lots-peremptions");
  const lot=String(formData.get("lot_id")??"");
  const bloque=String(formData.get("bloque")??"")==="true";
  const motif=String(formData.get("motif_blocage")??"").trim();
  if(!safeUuid(lot)||motif.length>500||(bloque&&motif.length===0))redirect("/pharmacie/gestionnaire-stock/lots-peremptions?erreur=blocage");
  const {error}=await sb.rpc("stock_lot_blocage_modifier",{p_lot:lot,p_bloque:bloque,p_motif:motif||null});
  if(error)redirect("/pharmacie/gestionnaire-stock/lots-peremptions?erreur=blocage");
  revalidatePath("/pharmacie/gestionnaire-stock");
  revalidatePath("/pharmacie/gestionnaire-stock/lots-peremptions");
  revalidatePath("/pharmacie/gestionnaire-stock/reservations");
  redirect("/pharmacie/gestionnaire-stock/lots-peremptions?ok="+(bloque?"bloque":"debloque"));
}

export async function initialiserReferenceStock(formData: FormData) {
  const sb = supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/connexion?retour=/pharmacie/gestionnaire-stock/stock-logistique");
  const pharmacie = String(formData.get("pharmacie_id") ?? "");
  const produit = String(formData.get("produit_id") ?? "");
  const prixRaw = String(formData.get("prix") ?? "");
  const emplacement = String(formData.get("emplacement") ?? "").trim();
  const prix = Number(prixRaw);
  if (!safeUuid(pharmacie) || !safeUuid(produit) || !prixRaw.trim() || !Number.isSafeInteger(prix) || prix < 0 || prix > 100000000 || emplacement.length > 160) {
    redirect("/pharmacie/gestionnaire-stock/stock-logistique?erreur=reference");
  }
  const { data, error } = await sb.rpc("gestionnaire_stock_reference_initialiser", {
    p_pharmacie: pharmacie, p_produit: produit, p_prix: prix, p_emplacement: emplacement || null,
  });
  if (error || data !== true) redirect("/pharmacie/gestionnaire-stock/stock-logistique?erreur=reference");
  revalidatePath("/pharmacie/gestionnaire-stock");
  revalidatePath("/pharmacie/gestionnaire-stock/stock-logistique");
  revalidatePath("/pharmacie/gestionnaire-stock/fournisseurs-receptions");
  redirect("/pharmacie/gestionnaire-stock/stock-logistique?ok=reference");
}

export async function ajusterQuantiteStockGestionnaire(formData: FormData) {
  const sb = supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/connexion?retour=/pharmacie/gestionnaire-stock/stock-logistique");
  const pharmacie = String(formData.get("pharmacie_id") ?? "");
  const produit = String(formData.get("produit_id") ?? "");
  const lotRaw = String(formData.get("lot_id") ?? "");
  const type = String(formData.get("type") ?? "");
  const deltaRaw = String(formData.get("delta") ?? "");
  const motif = String(formData.get("motif") ?? "").trim();
  const delta = Number(deltaRaw);
  const lot = lotRaw || null;
  if (!safeUuid(pharmacie) || !safeUuid(produit) || (lot && !safeUuid(lot)) || !["perte","retour","ajustement"].includes(type) || !deltaRaw.trim() || !Number.isSafeInteger(delta) || delta===0 || Math.abs(delta)>1000000 || motif.length<3 || motif.length>500 || (type==="perte"&&delta>=0) || (type==="retour"&&delta<=0)) {
    redirect("/pharmacie/gestionnaire-stock/stock-logistique?erreur=mouvement");
  }
  const { data, error } = await sb.rpc("gestionnaire_stock_quantite_ajuster", {
    p_pharmacie: pharmacie, p_produit: produit, p_delta: delta, p_type: type, p_motif: motif, p_lot: lot,
  });
  if (error || data !== true) redirect("/pharmacie/gestionnaire-stock/stock-logistique?erreur=mouvement");
  revalidatePath("/pharmacie/gestionnaire-stock");
  revalidatePath("/pharmacie/gestionnaire-stock/stock-logistique");
  revalidatePath("/pharmacie/gestionnaire-stock");
  revalidatePath("/pharmacie/gestionnaire-stock/lots-peremptions");
  revalidatePath("/pharmacie/gestionnaire-stock/historique-rapports");
  redirect("/pharmacie/gestionnaire-stock/stock-logistique?ok=mouvement");
}

export async function transfererStockEntrePharmacies(formData: FormData) {
  const sb = supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/connexion?retour=/pharmacie/gestionnaire-stock/stock-logistique");
  const source = String(formData.get("source_pharmacie_id") ?? "");
  const destination = String(formData.get("destination_pharmacie_id") ?? "");
  const produit = String(formData.get("produit_id") ?? "");
  const lotRaw = String(formData.get("lot_id") ?? "");
  const quantiteRaw = String(formData.get("quantite") ?? "");
  const motif = String(formData.get("motif") ?? "").trim();
  const quantite = Number(quantiteRaw);
  if (!safeUuid(source) || !safeUuid(destination) || !safeUuid(produit) || source===destination || (lotRaw&&!safeUuid(lotRaw)) || !quantiteRaw.trim() || !Number.isSafeInteger(quantite) || quantite<1 || quantite>1000000 || motif.length<3 || motif.length>500) {
    redirect("/pharmacie/gestionnaire-stock/stock-logistique?erreur=transfert");
  }
  const { data, error } = await sb.rpc("gestionnaire_stock_transfert_atomique", {
    p_source: source, p_destination: destination, p_produit: produit, p_quantite: quantite, p_lot: lotRaw || null, p_motif: motif,
  });
  if (error || !data) redirect("/pharmacie/gestionnaire-stock/stock-logistique?erreur=transfert");
  revalidatePath("/pharmacie/gestionnaire-stock");
  revalidatePath("/pharmacie/gestionnaire-stock/stock-logistique");
  revalidatePath("/pharmacie/gestionnaire-stock");
  revalidatePath("/pharmacie/gestionnaire-stock/lots-peremptions");
  revalidatePath("/pharmacie/gestionnaire-stock/historique-rapports");
  redirect("/pharmacie/gestionnaire-stock/stock-logistique?ok=transfert");
}
