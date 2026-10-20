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
  const { error } = await sb.rpc("set_reservation_status", {
    p_id: id,
    p_statut: "annulee",
  });
  if (error) {
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
  revalidatePath("/pharmacie/gestionnaire-stock/lots-peremptions");
  revalidatePath("/pharmacie/gestionnaire-stock/reservations");
  redirect("/pharmacie/gestionnaire-stock/lots-peremptions?ok=emplacement");
}

export async function ouvrirServiceGestionStock(formData: FormData) {
  const sb=supabaseServer();const {data:auth}=await sb.auth.getUser();
  if(!auth.user)redirect("/connexion?retour=/pharmacie/gestionnaire-stock/service");
  const pharmacie=String(formData.get("pharmacie_id")??"");
  if(!safeUuid(pharmacie))redirect("/pharmacie/gestionnaire-stock/service?erreur=validation");
  const {error}=await sb.rpc("gestionnaire_stock_service_ouvrir",{p_pharmacie:pharmacie});
  if(error)redirect("/pharmacie/gestionnaire-stock/service?erreur=ouverture");
  revalidatePath("/pharmacie/gestionnaire-stock/service");
  redirect("/pharmacie/gestionnaire-stock/service?ok=ouvert");
}
export async function fermerServiceGestionStock(formData: FormData) {
  const sb=supabaseServer();const {data:auth}=await sb.auth.getUser();
  if(!auth.user)redirect("/connexion?retour=/pharmacie/gestionnaire-stock/service");
  const session=String(formData.get("session_id")??"");
  const note=String(formData.get("note_fin")??"").trim();
  if(!safeUuid(session)||note.length>500)redirect("/pharmacie/gestionnaire-stock/service?erreur=validation");
  const {error}=await sb.rpc("gestionnaire_stock_service_fermer",{p_session:session,p_note:note||null});
  if(error)redirect("/pharmacie/gestionnaire-stock/service?erreur=fermeture");
  revalidatePath("/pharmacie/gestionnaire-stock/service");
  redirect("/pharmacie/gestionnaire-stock/service?ok=ferme");
}
