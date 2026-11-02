"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminActive } from "@/lib/admin/require-admin-active";
import { supabaseAdmin } from "@/lib/supabase/server";

const CANAUX = new Set(["orange_money", "mtn_momo", "virement"]);

export async function enregistrerDestinationPaiement(formData: FormData) {
  const { user } = await requireAdminActive("/admin/pilotage/reglements/configuration");
  const canal = String(formData.get("canal") ?? "");
  const beneficiaire = String(formData.get("beneficiaire") ?? "").trim();
  const reference = String(formData.get("reference_destination") ?? "").trim();
  const instructions = String(formData.get("instructions") ?? "").trim();
  const actif = formData.get("actif") === "on";

  if (!CANAUX.has(canal) || beneficiaire.length < 2 || beneficiaire.length > 160 ||
      reference.length < 3 || reference.length > 160 || instructions.length > 500) {
    redirect("/admin/pilotage/reglements/configuration?erreur=champs");
  }

  const db = supabaseAdmin();
  const { error } = await db.from("naxa_payment_destinations").upsert({
    canal,
    beneficiaire,
    reference_destination: reference,
    instructions: instructions || null,
    actif,
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  }, { onConflict: "canal" });

  if (error) {
    redirect("/admin/pilotage/reglements/configuration?erreur=enregistrement");
  }

  revalidatePath("/admin/pilotage/reglements/configuration");
  revalidatePath("/promoteur/paiements");
  redirect("/admin/pilotage/reglements/configuration?ok=enregistre");
}
