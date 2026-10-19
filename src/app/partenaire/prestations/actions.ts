"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";

const uuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const fail = () => redirect("/partenaire/prestations?erreur=action");

async function context() {
  const sb = supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/connexion?retour=/partenaire/prestations");
  const { data: members, error } = await sb.from("partner_members")
    .select("partner_id,member_role,partners!inner(status,partner_type)")
    .eq("user_id", auth.user.id)
    .in("member_role", ["owner", "manager", "operator"]);
  if (error || !members?.length) redirect("/");
  const active = (members as any[]).filter((m) =>
    m.partners?.status === "active" && m.partners?.partner_type === "professionnel_domicile"
  );
  if (!active.length) redirect("/");
  return { sb, user: auth.user, memberships: active };
}

export async function createHomeServiceOffer(form: FormData) {
  const { sb, user, memberships } = await context();
  const partnerId = String(form.get("partner_id") ?? "");
  const name = String(form.get("name") ?? "").trim();
  const category = String(form.get("category") ?? "Autres").trim() || "Autres";
  const description = String(form.get("description") ?? "").trim();
  const area = String(form.get("service_area_label") ?? "").trim();
  const priceRaw = String(form.get("price_fcfa") ?? "").trim();
  const price = priceRaw === "" ? null : Number(priceRaw);
  if (!uuid(partnerId) || !memberships.some((m: any) => m.partner_id === partnerId) ||
      name.length < 2 || name.length > 180 || category.length < 2 || category.length > 100 ||
      description.length > 2000 || area.length < 2 || area.length > 180 ||
      (priceRaw !== "" && (!Number.isSafeInteger(price) || Number(price) < 0 || Number(price) > 100000000))) fail();

  const { data: association } = await sb.from("partner_universes").select("enabled")
    .eq("partner_id", partnerId).eq("universe_slug", "prestations").maybeSingle();
  if (!association?.enabled) redirect("/partenaire/prestations?erreur=univers");

  const { error } = await sb.from("home_service_offers").insert({
    partner_id: partnerId,
    name,
    category,
    description: description || null,
    service_area_label: area,
    price_fcfa: price,
    status: "draft",
    created_by: user.id,
  });
  if (error) fail();
  revalidatePath("/partenaire/prestations");
  revalidatePath("/admin/prestations");
  redirect("/partenaire/prestations?ok=creation");
}

export async function archiveHomeServiceOffer(form: FormData) {
  const { sb, memberships } = await context();
  const offerId = String(form.get("offer_id") ?? "");
  if (!uuid(offerId)) fail();
  const { data: offer } = await sb.from("home_service_offers").select("id,partner_id")
    .eq("id", offerId).maybeSingle();
  if (!offer || !memberships.some((m: any) => m.partner_id === offer.partner_id)) fail();
  const offerPartnerId = offer.partner_id;
  const { error } = await sb.from("home_service_offers")
    .update({ status: "archived", updated_at: new Date().toISOString() })
    .eq("id", offerId).eq("partner_id", offerPartnerId);
  if (error) fail();
  revalidatePath("/partenaire/prestations");
  revalidatePath("/prestations");
  redirect("/partenaire/prestations?ok=archive");
}

export async function transitionHomeServiceRequest(form: FormData) {
  const { sb, memberships } = await context();
  const requestId = String(form.get("request_id") ?? "");
  const status = String(form.get("status") ?? "");
  if (!uuid(requestId) || !["confirmed", "completed"].includes(status)) fail();
  const { data: request } = await sb.from("home_service_requests")
    .select("id,partner_id,status").eq("id", requestId).maybeSingle();
  if (!request || !memberships.some((m: any) => m.partner_id === request.partner_id)) fail();

  const { error } = await sb.rpc("transition_home_service_request", {
    p_request_id: requestId,
    p_status: status,
  });
  if (error) fail();
  const { data: updated } = await sb.from("home_service_requests")
    .select("status").eq("id", requestId).maybeSingle();
  if (updated?.status !== status) fail();

  revalidatePath("/partenaire/prestations");
  revalidatePath("/client");
  revalidatePath("/prestations/demande/" + requestId);
  redirect("/partenaire/prestations?ok=" + status);
}
