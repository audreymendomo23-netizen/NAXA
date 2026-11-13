"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { loadPromoteurAccess } from "@/lib/promoteur-access";
import { supabaseAdmin } from "@/lib/supabase/server";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function savePharmacyMerchantPayment(formData: FormData) {
  const access = await loadPromoteurAccess();
  const pharmacieId = String(formData.get("pharmacie_id") ?? "").trim();
  const canal = String(formData.get("canal") ?? "");
  const merchantName = String(formData.get("merchant_name") ?? "").trim();
  const merchantPhone = String(formData.get("merchant_phone") ?? "").trim();
  const merchantCode = String(formData.get("merchant_code") ?? "").trim();
  const isActive = formData.get("is_active") === "on";
  const pharmacy = (access.pharmacies ?? []).find((item) => item.id === pharmacieId);

  if (
    access.profile.role !== "promoteur" ||
    access.profile.actif !== true ||
    access.shouldShowAccessStatus ||
    access.linksError ||
    access.pharmaciesError ||
    !uuid.test(pharmacieId) ||
    !access.activeLinkIds.has(pharmacieId) ||
    !pharmacy ||
    !pharmacy.actif ||
    !pharmacy.visible_recherche ||
    pharmacy.archivee_le !== null ||
    !["mtn_momo", "orange_money"].includes(canal) ||
    merchantName.length < 2 || merchantName.length > 120 ||
    merchantPhone.replace(/\D/g, "").length < 8 ||
    merchantPhone.replace(/\D/g, "").length > 15 ||
    !/^\d{6}$/.test(merchantCode)
  ) {
    redirect("/pharmacie/promoteur/paiements?erreur=perimetre");
  }

  const { error } = await supabaseAdmin().rpc("naxa_save_merchant_payment_destination", {
    p_pharmacie_id: pharmacieId,
    p_partner_id: null,
    p_canal: canal,
    p_merchant_name: merchantName,
    p_merchant_phone: merchantPhone,
    p_merchant_code: merchantCode,
    p_is_active: isActive,
    p_actor_id: access.profile.id,
  });

  if (error) {
    console.error("[payment.destination.pharmacy]", { code: error.code });
    redirect("/pharmacie/promoteur/paiements?erreur=enregistrement");
  }
  revalidatePath("/pharmacie/promoteur/paiements");
  revalidatePath("/api/pay");
  redirect("/pharmacie/promoteur/paiements?ok=1");
}
