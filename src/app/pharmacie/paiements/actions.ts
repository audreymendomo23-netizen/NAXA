"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function authorizedPharmacy() {
  const sb = supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/connexion?retour=/pharmacie/paiements");
  const { data: profile } = await sb.from("profiles")
    .select("id,role,pharmacie_id,actif")
    .eq("id", auth.user.id).maybeSingle();
  const { data: businessFunction, error: functionError } = await sb.rpc("naxa_business_function");
  if (
    functionError || !profile || profile.actif !== true ||
    !["pharmacie", "responsable"].includes(profile.role ?? "") ||
    !["pharmacie", "responsable"].includes(businessFunction ?? "") ||
    !profile.pharmacie_id
  ) redirect("/");
  const { data: pharmacy, error } = await sb.from("pharmacies")
    .select("id,actif").eq("id", profile.pharmacie_id).maybeSingle();
  if (error || pharmacy?.actif !== true) redirect("/");
  return { userId: auth.user.id, pharmacieId: profile.pharmacie_id };
}

export async function savePharmacyMerchantPayment(formData: FormData) {
  const scope = await authorizedPharmacy();
  const pharmacieId = String(formData.get("pharmacie_id") ?? "").trim();
  const canal = String(formData.get("canal") ?? "");
  const merchantName = String(formData.get("merchant_name") ?? "").trim();
  const merchantPhone = String(formData.get("merchant_phone") ?? "").trim();
  const merchantCode = String(formData.get("merchant_code") ?? "").trim();
  const isActive = formData.get("is_active") === "on";

  if (
    !uuid.test(pharmacieId) || pharmacieId !== scope.pharmacieId ||
    !["mtn_momo", "orange_money"].includes(canal) ||
    merchantName.length < 2 || merchantName.length > 120 ||
    merchantPhone.replace(/\D/g, "").length < 8 ||
    merchantPhone.replace(/\D/g, "").length > 15 ||
    !/^\d{6}$/.test(merchantCode)
  ) redirect("/pharmacie/paiements?erreur=perimetre");

  const { error } = await supabaseAdmin().rpc("naxa_save_merchant_payment_destination", {
    p_pharmacie_id: pharmacieId,
    p_partner_id: null,
    p_canal: canal,
    p_merchant_name: merchantName,
    p_merchant_phone: merchantPhone,
    p_merchant_code: merchantCode,
    p_is_active: isActive,
    p_actor_id: scope.userId,
  });
  if (error) {
    console.error("[payment.destination.pharmacy-direct]", { code: error.code });
    redirect("/pharmacie/paiements?erreur=enregistrement");
  }
  revalidatePath("/pharmacie/paiements");
  revalidatePath("/api/pay");
  redirect("/pharmacie/paiements?ok=1");
}
