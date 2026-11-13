"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function authorizedPartners(userId: string) {
  const { data, error } = await supabaseServer().from("partner_members")
    .select("partner_id,member_role,partners!inner(id,name,status)")
    .eq("user_id", userId)
    .in("member_role", ["owner", "manager"]);
  if (error) return [];
  return (data ?? []).filter((item: any) => item.partners?.status === "active");
}

export async function savePartnerMerchantPayment(formData: FormData) {
  const sb = supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/connexion?retour=/partenaire/paiements");

  const partnerId = String(formData.get("partner_id") ?? "").trim();
  const canal = String(formData.get("canal") ?? "");
  const merchantName = String(formData.get("merchant_name") ?? "").trim();
  const merchantPhone = String(formData.get("merchant_phone") ?? "").trim();
  const merchantCode = String(formData.get("merchant_code") ?? "").trim();
  const isActive = formData.get("is_active") === "on";
  const partners = await authorizedPartners(auth.user.id);

  if (
    !uuid.test(partnerId) ||
    !partners.some((item: any) => item.partner_id === partnerId) ||
    !["mtn_momo", "orange_money"].includes(canal) ||
    merchantName.length < 2 || merchantName.length > 120 ||
    merchantPhone.replace(/\D/g, "").length < 8 ||
    merchantPhone.replace(/\D/g, "").length > 15 ||
    !/^\d{6}$/.test(merchantCode)
  ) {
    redirect("/partenaire/paiements?erreur=perimetre");
  }

  const { error } = await supabaseAdmin().rpc("naxa_save_merchant_payment_destination", {
    p_pharmacie_id: null,
    p_partner_id: partnerId,
    p_canal: canal,
    p_merchant_name: merchantName,
    p_merchant_phone: merchantPhone,
    p_merchant_code: merchantCode,
    p_is_active: isActive,
    p_actor_id: auth.user.id,
  });
  if (error) {
    console.error("[payment.destination.partner]", { code: error.code });
    redirect("/partenaire/paiements?erreur=enregistrement");
  }
  revalidatePath("/partenaire/paiements");
  redirect("/partenaire/paiements?ok=1");
}
