"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function soumettreReglementAbonnementPartenaire(formData: FormData) {
  const sb = supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/connexion?retour=/partenaire/abonnement");

  const partnerId = String(formData.get("partner_id") ?? "").trim();
  const amount = Number(String(formData.get("amount_fcfa") ?? "").trim());
  const canal = String(formData.get("canal") ?? "");
  const payerAccount = String(formData.get("payer_account") ?? "").trim();
  const reference = String(formData.get("transaction_reference") ?? "").trim();
  const paidAtLocal = String(formData.get("paid_at") ?? "").trim();

  if (!uuid.test(partnerId) || !Number.isSafeInteger(amount) || amount <= 0 ||
      !["orange_money", "mtn_momo"].includes(canal) ||
      payerAccount.length < 3 || payerAccount.length > 120 ||
      reference.length < 5 || reference.length > 160 ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(paidAtLocal)) {
    redirect("/partenaire/abonnement?erreur=validation");
  }

  // Cameroon uses UTC+1; the input is a local date/time, not a UTC timestamp.
  const paidAt = new Date(paidAtLocal + ":00+01:00");
  if (Number.isNaN(paidAt.getTime())) redirect("/partenaire/abonnement?erreur=date");

  const { error } = await sb.rpc("partner_soumettre_reglement_abonnement", {
    p_partner_id: partnerId,
    p_montant: amount,
    p_canal: canal,
    p_compte_payeur: payerAccount,
    p_reference: reference,
    p_paye_le: paidAt.toISOString(),
    p_preuve_path: null,
  });
  if (error) {
    console.error("[partner.subscription.payment.submit]", { code: error.code });
    redirect("/partenaire/abonnement?erreur=paiement");
  }

  revalidatePath("/partenaire/abonnement");
  redirect("/partenaire/abonnement?ok=transmis");
}
