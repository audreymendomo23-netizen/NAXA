"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";

const universes = ["parapharmacie", "bebe-maman"] as const;
type Universe = typeof universes[number];
const field = (form: FormData, key: string, max = 180) => String(form.get(key) ?? "").trim().slice(0, max);
const uuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

async function partnerContext() {
  const sb = supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/connexion?retour=/partenaire/catalogue");
  const { data: memberships, error } = await sb.from("partner_members")
    .select("partner_id,member_role,partners!inner(id,name,status)")
    .eq("user_id", auth.user.id)
    .in("member_role", ["owner", "manager", "operator"]);
  if (error || !memberships?.length) redirect("/?erreur=espace_partenaire");
  const eligible = memberships.filter((m: any) => m.partners?.status === "active");
  if (!eligible.length) redirect("/?erreur=partenaire_inactif");
  return { sb, userId: auth.user.id, memberships: eligible };
}

export async function creerProduitCatalogue(form: FormData) {
  const { sb, userId, memberships } = await partnerContext();
  const partnerId = field(form, "partner_id", 36);
  const universe = field(form, "universe_slug", 40) as Universe;
  const name = field(form, "name", 180);
  const price = Number(field(form, "price_fcfa", 12));
  const stock = Number(field(form, "stock_quantity", 20));
  const photo = field(form, "photo_url", 1000);
  const membership = memberships.find((m: any) => m.partner_id === partnerId);
  if (!membership || !uuid(partnerId) || !universes.includes(universe) || name.length < 2 ||
      !Number.isSafeInteger(price) || price < 0 || !Number.isFinite(stock) ||
      stock < 0 || stock > 1000000 || (photo && !/^https:\/\//i.test(photo))) {
    redirect("/partenaire/catalogue?erreur=produit");
  }
  const { data: association } = await sb.from("partner_universes").select("enabled")
    .eq("partner_id", partnerId).eq("universe_slug", universe).maybeSingle();
  if (!association?.enabled) redirect("/partenaire/catalogue?erreur=univers");
  const { error } = await sb.from("partner_products").insert({
    partner_id: partnerId, universe_slug: universe, name,
    brand: field(form, "brand", 120) || null,
    category: field(form, "category", 100) || "Autres",
    description: field(form, "description", 600) || null,
    photo_url: photo || null, price_fcfa: price, stock_quantity: stock,
    unit_label: field(form, "unit_label", 30) || "unité",
    status: "draft", created_by: userId,
  });
  if (error) redirect("/partenaire/catalogue?erreur=produit");
  revalidatePath("/partenaire/catalogue");
  revalidatePath("/" + universe);
  redirect("/partenaire/catalogue?ok=creation");
}

export async function ajusterStockCatalogue(form: FormData) {
  const { sb, memberships } = await partnerContext();
  const partnerId = field(form, "partner_id", 36);
  const productId = field(form, "product_id", 36);
  const delta = Number(field(form, "quantity_delta", 24).replace(",", "."));
  const kind = field(form, "movement_type", 24);
  const reason = field(form, "reason", 240);
  if (!memberships.some((m: any) => m.partner_id === partnerId) || !uuid(partnerId) ||
      !uuid(productId) || !Number.isFinite(delta) || delta === 0 || Math.abs(delta) > 1000000 ||
      !["receipt", "adjustment", "loss", "return", "transfer_in", "transfer_out", "opening"].includes(kind)) {
    redirect("/partenaire/catalogue?erreur=stock");
  }
  const { data: product } = await sb.from("partner_products").select("id,partner_id,universe_slug")
    .eq("id", productId).eq("partner_id", partnerId).maybeSingle();
  if (!product) redirect("/partenaire/catalogue?erreur=stock");
  const { error } = await sb.rpc("partner_adjust_universe_stock", {
    p_product_id: productId, p_quantity_delta: delta,
    p_movement_type: kind, p_reason: reason || null,
  });
  if (error) redirect("/partenaire/catalogue?erreur=stock");
  revalidatePath("/partenaire/catalogue");
  revalidatePath("/" + product.universe_slug);
  redirect("/partenaire/catalogue?ok=stock");
}

export async function changerEtatProduitCatalogue(form: FormData) {
  const { sb, memberships } = await partnerContext();
  const partnerId = field(form, "partner_id", 36);
  const productId = field(form, "product_id", 36);
  const status = field(form, "status", 20);
  if (!memberships.some((m: any) => m.partner_id === partnerId) || !uuid(partnerId) || !uuid(productId) ||
      !["draft", "archived", "active"].includes(status)) redirect("/partenaire/catalogue?erreur=produit");
  const { data: product } = await sb.from("partner_products").select("id,partner_id,universe_slug")
    .eq("id", productId).eq("partner_id", partnerId).maybeSingle();
  if (!product) redirect("/partenaire/catalogue?erreur=produit");
  if (status === "active") {
    const [association, universe, flag] = await Promise.all([
      sb.from("partner_universes").select("enabled").eq("partner_id", partnerId).eq("universe_slug", product.universe_slug).maybeSingle(),
      sb.from("universes").select("enabled").eq("slug", product.universe_slug).maybeSingle(),
      sb.from("feature_flags").select("enabled").eq("flag_key", "universe." + product.universe_slug).maybeSingle(),
    ]);
    if (!association.data?.enabled || !universe.data?.enabled || !flag.data?.enabled) redirect("/partenaire/catalogue?erreur=univers");
  }
  const { error } = await sb.from("partner_products").update({ status, updated_at: new Date().toISOString() })
    .eq("id", productId).eq("partner_id", partnerId);
  if (error) redirect("/partenaire/catalogue?erreur=produit");
  revalidatePath("/partenaire/catalogue");
  revalidatePath("/" + product.universe_slug);
  redirect("/partenaire/catalogue?ok=etat");
}
