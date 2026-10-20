"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";

const safeUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

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
