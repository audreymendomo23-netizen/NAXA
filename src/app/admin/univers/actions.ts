"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { isMedicationProduct } from "@/lib/universe-product-rules";

async function admin() {
  const sb = supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/connexion?retour=/admin/univers");
  const { data: profile } = await sb.from("profiles").select("role").eq("id", auth.user.id).maybeSingle();
  if (profile?.role !== "admin") redirect("/");
  return { sb, actor: auth.user.id };
}

const field = (form: FormData, key: string, max = 160) => String(form.get(key) ?? "").trim().slice(0, max);
const slugs = ["parapharmacie", "bebe-maman", "examens", "suivi", "prestations", "aide"];
const types = ["parapharmacie", "maternite", "centre_examen", "professionnel_domicile", "autre"];

export async function creerPartenaire(form: FormData) {
  const { sb, actor } = await admin();
  const name = field(form, "name");
  const type = field(form, "partner_type", 40);
  const universe = field(form, "universe_slug", 40);
  if (name.length < 2 || !types.includes(type) || !slugs.includes(universe) || universe === "suivi") redirect("/admin/univers?erreur=parametres");
  const { data: partner, error } = await sb.from("partners").insert({
    name, partner_type: type, city: field(form, "city", 100) || "Yaoundé",
    neighborhood: field(form, "neighborhood", 120) || null,
    phone_private: field(form, "phone_private", 40) || null,
    status: "pending", created_by: actor,
  }).select("id").single();
  if (error || !partner) redirect("/admin/univers?erreur=schema");
  const { error: linkError } = await sb.from("partner_universes").insert({
    partner_id: partner.id, universe_slug: universe, enabled: false,
  });
  if (linkError) {
    await sb.from("partners").update({ status: "suspended" }).eq("id", partner.id);
    redirect("/admin/univers?erreur=association");
  }
  await sb.from("audit_log").insert({
    actor_id: actor, action: "partner.created", entity_type: "partner",
    entity_id: partner.id, metadata: { partner_type: type, universe_slug: universe, status: "pending" },
  });
  revalidatePath("/admin/univers");
  redirect("/admin/univers?ok=partenaire");
}

export async function changerStatutPartenaire(form: FormData) {
  const { sb, actor } = await admin();
  const id = field(form, "id", 40);
  const status = field(form, "status", 20);
  if (!/^[0-9a-f-]{36}$/i.test(id) || !["active", "suspended", "pending"].includes(status)) redirect("/admin/univers?erreur=parametres");
  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (status === "active") { patch.verified_at = new Date().toISOString(); patch.verified_by = actor; }
  const { error } = await sb.from("partners").update(patch).eq("id", id);
  if (error) redirect("/admin/univers?erreur=schema");
  await sb.from("audit_log").insert({
    actor_id: actor, action: "partner.status_changed", entity_type: "partner",
    entity_id: id, metadata: { status },
  });
  revalidatePath("/admin/univers");
  redirect("/admin/univers?ok=statut");
}

export async function changerActivationUnivers(form: FormData) {
  const { sb, actor } = await admin();
  const slug = field(form, "slug", 40);
  const flag = field(form, "flag_key", 100);
  const enabled = field(form, "enabled", 5) === "true";
  if (!slugs.includes(slug) || flag !== "universe." + slug || slug === "aide" || (slug === "suivi" && enabled)) {
    redirect("/admin/univers?erreur=parametres");
  }

  const { error: rpcError } = await sb.rpc("admin_set_universe_enabled", {
    p_slug: slug,
    p_enabled: enabled,
  });
  if (rpcError) redirect("/admin/univers?erreur=schema");

  // Vérifier l’état réellement persisté : un retour RPC sans erreur ne suffit
  // pas à annoncer une activation effective dans l’interface.
  const [{ data: universe, error: universeError }, { data: feature, error: featureError }] = await Promise.all([
    sb.from("universes").select("enabled").eq("slug", slug).maybeSingle(),
    sb.from("feature_flags").select("enabled").eq("flag_key", flag).maybeSingle(),
  ]);
  if (universeError || featureError || !universe || !feature ||
      universe.enabled !== enabled || feature.enabled !== enabled) {
    redirect("/admin/univers?erreur=activation_verification");
  }

  await sb.from("audit_log").insert({
    actor_id: actor,
    action: "universe.status_changed",
    entity_type: "universe",
    entity_id: slug,
    metadata: { enabled, verified: true },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/univers");
  revalidatePath("/admin/prestations");
  revalidatePath("/admin/examens");
  revalidatePath("/" + slug);
  redirect("/admin/univers?ok=activation");
}


export async function changerAssociationPartenaire(form: FormData) {
  const { sb, actor } = await admin();
  const partnerId = field(form, "partner_id", 40);
  const universe = field(form, "universe_slug", 40);
  const enabled = field(form, "enabled", 5) === "true";
  if (!/^[0-9a-f-]{36}$/i.test(partnerId) || !slugs.includes(universe) || (universe === "suivi" && enabled)) redirect("/admin/univers?erreur=parametres");
  const { data: partner, error: partnerError } = await sb.from("partners").select("status").eq("id", partnerId).maybeSingle();
  if (partnerError || !partner) redirect("/admin/univers?erreur=schema");
  if (enabled && partner.status !== "active") redirect("/admin/univers?erreur=partenaire_inactif");

  // Contrôle de cohérence : une association ne doit pas être ouverte si
  // l'univers lui-même ou son drapeau fonctionnel est désactivé.
  if (enabled) {
    const [{ data: universeRow, error: universeError }, { data: feature, error: featureError }] = await Promise.all([
      sb.from("universes").select("enabled").eq("slug", universe).maybeSingle(),
      universe === "aide"
        ? Promise.resolve({ data: null, error: null })
        : sb.from("feature_flags").select("enabled").eq("flag_key", "universe." + universe).maybeSingle(),
    ]);
    if (universeError || featureError || !universeRow) redirect("/admin/univers?erreur=schema");
    if (!universeRow.enabled || (universe !== "aide" && !feature?.enabled)) {
      redirect("/admin/univers?erreur=univers_inactif");
    }
  }

  const { error } = await sb.rpc("admin_set_partner_universe", {
    p_partner_id: partnerId, p_universe_slug: universe, p_enabled: enabled,
  });
  if (error) redirect("/admin/univers?erreur=association");

  const { data: association, error: associationError } = await sb
    .from("partner_universes")
    .select("enabled")
    .eq("partner_id", partnerId)
    .eq("universe_slug", universe)
    .maybeSingle();
  if (associationError || !association || association.enabled !== enabled) {
    redirect("/admin/univers?erreur=association_verification");
  }

  await sb.from("audit_log").insert({
    actor_id: actor,
    action: "partner.universe_association_changed",
    entity_type: "partner",
    entity_id: partnerId,
    metadata: { universe_slug: universe, enabled, verified: true },
  });
  revalidatePath("/admin/univers");
  revalidatePath("/" + universe);
  redirect("/admin/univers?ok=association");
}


export async function ajouterCompteTestSuivi(form: FormData) {
  const { sb, actor } = await admin();
  const userId = field(form, "user_id", 40);
  const reason = field(form, "reason", 240) || "Compte de test autorisé";
  if (!/^[0-9a-f-]{36}$/i.test(userId)) redirect("/admin/univers?erreur=compte_test");
  const { error } = await sb.from("feature_flag_test_accounts").upsert({
    user_id: userId, reason, added_by: actor,
  }, { onConflict: "user_id" });
  if (error) redirect("/admin/univers?erreur=compte_test");
  await sb.from("audit_log").insert({
    actor_id: actor, action: "tracking.test_account_added", entity_type: "test_account",
    entity_id: userId, metadata: { reason },
  });
  revalidatePath("/admin/univers");
  redirect("/admin/univers?ok=compte_test");
}

export async function retirerCompteTestSuivi(form: FormData) {
  const { sb, actor } = await admin();
  const userId = field(form, "user_id", 40);
  if (!/^[0-9a-f-]{36}$/i.test(userId)) redirect("/admin/univers?erreur=compte_test");
  const { error } = await sb.from("feature_flag_test_accounts").delete().eq("user_id", userId);
  if (error) redirect("/admin/univers?erreur=compte_test");
  await sb.from("audit_log").insert({
    actor_id: actor, action: "tracking.test_account_removed", entity_type: "test_account",
    entity_id: userId, metadata: {},
  });
  revalidatePath("/admin/univers");
  redirect("/admin/univers?ok=compte_test");
}


export async function creerProduitPartenaire(form: FormData) {
  const { sb, actor } = await admin();
  const partnerId = field(form, "partner_id", 40);
  const universe = field(form, "universe_slug", 40);
  const name = field(form, "name", 180);
  const category = field(form, "category", 100) || "Autres";
  const brand = field(form, "brand", 120) || null;
  const description = field(form, "description", 600) || null;
  const price = Number(field(form, "price_fcfa", 12));
  const stock = Number(field(form, "stock_quantity", 20));
  const photo = field(form, "photo_url", 1000);
  if (!/^[0-9a-f-]{36}$/i.test(partnerId) || !["parapharmacie", "bebe-maman"].includes(universe) ||
      name.length < 2 || (universe === "parapharmacie" && isMedicationProduct({ name, brand, category, description })) ||
      !Number.isInteger(price) || price < 0 || !Number.isFinite(stock) || stock < 0 ||
      (photo && (!/^https:\/\//i.test(photo) || photo.length > 1000))) {
    redirect("/admin/univers?erreur=produit");
  }
  const { data: partner } = await sb.from("partners").select("status").eq("id", partnerId).maybeSingle();
  const { data: association } = await sb.from("partner_universes").select("enabled").eq("partner_id", partnerId).eq("universe_slug", universe).maybeSingle();
  if (partner?.status !== "active" || !association?.enabled) redirect("/admin/univers?erreur=association");
  const { error } = await sb.from("partner_products").insert({
    partner_id: partnerId, universe_slug: universe, name, category, brand, description,
    photo_url: photo || null, price_fcfa: price, stock_quantity: stock,
    unit_label: field(form, "unit_label", 30) || "unité", status: "draft", created_by: actor,
  });
  if (error) redirect("/admin/univers?erreur=produit");
  await sb.from("audit_log").insert({
    actor_id: actor, action: "partner_product.created", entity_type: "partner_product",
    entity_id: name, metadata: { partner_id: partnerId, universe_slug: universe, status: "draft" },
  });
  revalidatePath("/admin/univers");
  redirect("/admin/univers?ok=produit");
}

export async function changerStatutProduitPartenaire(form: FormData) {
  const { sb, actor } = await admin();
  const id = field(form, "product_id", 40);
  const status = field(form, "status", 20);
  if (!/^[0-9a-f-]{36}$/i.test(id) || !["draft", "active", "archived"].includes(status)) redirect("/admin/univers?erreur=produit");
  const { data: product } = await sb.from("partner_products").select("partner_id,universe_slug,name,brand,category,description").eq("id", id).maybeSingle();
  if (!product) redirect("/admin/univers?erreur=schema");
  if (status === "active" && product.universe_slug === "parapharmacie" && isMedicationProduct(product)) redirect("/admin/univers?erreur=produit");
  if (status === "active") {
    const [partner, association, universe, flag] = await Promise.all([
      sb.from("partners").select("status").eq("id", product.partner_id).maybeSingle(),
      sb.from("partner_universes").select("enabled").eq("partner_id", product.partner_id).eq("universe_slug", product.universe_slug).maybeSingle(),
      sb.from("universes").select("enabled").eq("slug", product.universe_slug).maybeSingle(),
      sb.from("feature_flags").select("enabled").eq("flag_key", "universe." + product.universe_slug).maybeSingle(),
    ]);
    if (partner.data?.status !== "active" || !association.data?.enabled || !universe.data?.enabled || !flag.data?.enabled) {
      redirect("/admin/univers?erreur=association");
    }
  }
  const { error } = await sb.from("partner_products").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) redirect("/admin/univers?erreur=produit");
  await sb.from("audit_log").insert({
    actor_id: actor, action: "partner_product.status_changed", entity_type: "partner_product",
    entity_id: id, metadata: { status },
  });
  revalidatePath("/admin/univers");
  revalidatePath("/parapharmacie");
  revalidatePath("/bebe-maman");
  redirect("/admin/univers?ok=produit");
}


export async function ajouterProfessionnelSuivi(form: FormData) {
  const { sb, actor } = await admin();
  const userId = field(form, "user_id", 40);
  const role = field(form, "professional_role", 20);
  const displayName = field(form, "display_name", 160);
  if (!/^[0-9a-f-]{36}$/i.test(userId) || !["pharmacien", "medecin"].includes(role) || displayName.length < 2) {
    redirect("/admin/univers?erreur=professionnel_suivi");
  }
  const { error } = await sb.from("suivi_professionals").upsert({
    user_id: userId, professional_role: role, display_name: displayName,
    verified: true, verified_by: actor,
  }, { onConflict: "user_id" });
  if (error) redirect("/admin/univers?erreur=professionnel_suivi");
  await sb.from("audit_log").insert({
    actor_id: actor, action: "tracking.professional_verified", entity_type: "tracking_professional",
    entity_id: userId, metadata: { professional_role: role },
  });
  revalidatePath("/admin/univers");
  redirect("/admin/univers?ok=professionnel_suivi");
}

export async function retirerProfessionnelSuivi(form: FormData) {
  const { sb, actor } = await admin();
  const userId = field(form, "user_id", 40);
  if (!/^[0-9a-f-]{36}$/i.test(userId)) redirect("/admin/univers?erreur=professionnel_suivi");
  const { error } = await sb.from("suivi_professionals").update({ verified: false }).eq("user_id", userId);
  if (error) redirect("/admin/univers?erreur=professionnel_suivi");
  await sb.from("audit_log").insert({
    actor_id: actor, action: "tracking.professional_unverified", entity_type: "tracking_professional",
    entity_id: userId, metadata: {},
  });
  revalidatePath("/admin/univers");
  redirect("/admin/univers?ok=professionnel_suivi");
}
