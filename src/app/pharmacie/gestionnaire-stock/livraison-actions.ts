"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";

const safeUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export async function confirmerDemandeLivraisonStock(formData: FormData) {
  const sb = supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/connexion?retour=/pharmacie/gestionnaire-stock/commandes");
  const id = String(formData.get("reservation_id") ?? "");
  if (!safeUuid(id)) redirect("/pharmacie/gestionnaire-stock/commandes?erreur=validation");

  const { data, error } = await sb.rpc("gestionnaire_stock_confirmer_demande_livraison", {
    p_reservation: id,
  });
  if (error || data !== true) {
    redirect("/pharmacie/gestionnaire-stock/commandes?erreur=confirmation_livraison");
  }

  revalidatePath("/pharmacie/gestionnaire-stock/commandes");
  revalidatePath("/pharmacie/commandes");
  revalidatePath("/pharmacie/livreur");
  revalidatePath("/client");
  redirect("/pharmacie/gestionnaire-stock/commandes?ok=demande_confirmee");
}
