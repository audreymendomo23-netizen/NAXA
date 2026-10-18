"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { isMedicationProduct } from "@/lib/universe-product-rules";

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
  const brand = field(form, "brand", 120) || null;
  const category = field(form, "category", 100) || "Autres";
  const description = field(form, "description", 600) || null;
  const price = Number(field(form, "price_fcfa", 12));
  const stock = Number(field(form, "stock_quantity", 20));
  const threshold = Number(field(form, "low_stock_threshold", 20));
  const expiresAt = field(form, "expires_at", 10);
  const photo = field(form, "photo_url", 1000);
  const membership = memberships.find((m: any) => m.partner_id === partnerId);
  if (!membership || !uuid(partnerId) || !universes.includes(universe) || name.length < 2 ||
      (universe === "parapharmacie" && isMedicationProduct({ name, brand, category, description })) ||
      !Number.isSafeInteger(price) || price < 0 || !Number.isFinite(stock) ||
      stock < 0 || stock > 1000000 || !Number.isFinite(threshold) || threshold < 0 || threshold > 1000000 || (expiresAt && !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(expiresAt)) || (photo && !/^https:\/\//i.test(photo))) {
    redirect("/partenaire/catalogue?erreur=produit");
  }
  const { data: association } = await sb.from("partner_universes").select("enabled")
    .eq("partner_id", partnerId).eq("universe_slug", universe).maybeSingle();
  if (!association?.enabled) redirect("/partenaire/catalogue?erreur=univers");
  const { data: created, error } = await sb.from("partner_products").insert({
    partner_id: partnerId, universe_slug: universe, name,
    brand, category, description,
    photo_url: photo || null, price_fcfa: price, stock_quantity: 0,
    low_stock_threshold: threshold, expires_at: expiresAt || null,
    unit_label: field(form, "unit_label", 30) || "unité",
    status: "draft", created_by: userId,
  }).select("id").single();
  if (error || !created) redirect("/partenaire/catalogue?erreur=produit");
  if (stock > 0) {
    const { error: stockError } = await sb.rpc("partner_adjust_universe_stock", {
      p_product_id: created.id, p_quantity_delta: stock, p_movement_type: "opening", p_reason: "Stock initial à la création du produit",
    });
    if (stockError) redirect("/partenaire/catalogue?erreur=stock");
  }
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
  const { data: product } = await sb.from("partner_products").select("id,partner_id,universe_slug,name,brand,category,description")
    .eq("id", productId).eq("partner_id", partnerId).maybeSingle();
  if (!product) redirect("/partenaire/catalogue?erreur=produit");
  if (status === "active" && product.universe_slug === "parapharmacie" && isMedicationProduct(product)) redirect("/partenaire/catalogue?erreur=produit");
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


function parseSemicolonCsv(source: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (quoted && ch === '"' && source[i + 1] === '"') { cell += '"'; i++; }
    else if (ch === '"') quoted = !quoted;
    else if (ch === ";" && !quoted) { row.push(cell.trim()); cell = ""; }
    else if ((ch === "\n" || ch === "\r") && !quoted) {
      if (ch === "\r" && source[i + 1] === "\n") i++;
      row.push(cell.trim()); cell = "";
      if (row.some((v) => v !== "")) rows.push(row);
      row = [];
    } else cell += ch;
  }
  if (quoted) throw new Error("CSV: guillemet non fermé");
  row.push(cell.trim());
  if (row.some((v) => v !== "")) rows.push(row);
  return rows;
}

export async function importerCsvCatalogue(form: FormData) {
  const { sb } = await partnerContext();
  const partnerId = field(form, "partner_id", 36);
  const universe = field(form, "universe_slug", 40) as Universe;
  const file = form.get("csv_file");
  if (!uuid(partnerId) || !universes.includes(universe) || !(file instanceof File) || file.size < 1 || file.size > 2_000_000) {
    redirect("/partenaire/catalogue?erreur=csv");
  }
  const { data: association } = await sb.from("partner_universes").select("enabled")
    .eq("partner_id", partnerId).eq("universe_slug", universe).maybeSingle();
  if (!association?.enabled) redirect("/partenaire/catalogue?erreur=univers");
  let rows: string[][];
  try { rows = parseSemicolonCsv((await file.text()).replace(/^\uFEFF/, "")); }
  catch { redirect("/partenaire/catalogue?erreur=csv"); }
  if (rows.length < 2 || rows.length > 501) redirect("/partenaire/catalogue?erreur=csv");
  const headers = rows[0].map((h) => h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "_"));
  const required = ["name", "price_fcfa", "stock_quantity"];
  if (new Set(headers).size !== headers.length || required.some((h) => !headers.includes(h))) redirect("/partenaire/catalogue?erreur=csv");
  const idx = (name: string) => headers.indexOf(name);
  const val = (row: string[], name: string) => idx(name) < 0 ? "" : String(row[idx(name)] ?? "").trim();
  const payload: Record<string, unknown>[] = [];
  for (const row of rows.slice(1)) {
    if (row.length !== headers.length) redirect("/partenaire/catalogue?erreur=csv");
    const name = val(row, "name");
    const priceRaw = val(row, "price_fcfa");
    const stockRaw = val(row, "stock_quantity");
    const price = Number(priceRaw);
    const stock = Number(stockRaw.replace(",", "."));
    const thresholdRaw = val(row, "low_stock_threshold");
    const threshold = thresholdRaw === "" ? 3 : Number(thresholdRaw.replace(",", "."));
    const expiresAt = val(row, "expires_at");
    const photo = val(row, "photo_url");
    const validDate = (value: string) => {
      if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)) return false;
      const parsed = new Date(value + "T00:00:00.000Z");
      return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
    };
    if (name.length < 2 || name.length > 180 || !priceRaw || !Number.isSafeInteger(price) || price < 0 ||
        !stockRaw || !Number.isFinite(stock) || stock < 0 || stock > 1000000 ||
        !Number.isFinite(threshold) || threshold < 0 || threshold > 1000000 ||
        (expiresAt !== "" && !validDate(expiresAt)) || (photo && !/^https:\/\//i.test(photo))) redirect("/partenaire/catalogue?erreur=csv");
    const brand = val(row, "brand").slice(0,120) || null;
    const category = val(row, "category").slice(0,100) || "Autres";
    const description = val(row, "description").slice(0,600) || null;
    if (universe === "parapharmacie" && isMedicationProduct({ name, brand, category, description })) {
      redirect("/partenaire/catalogue?erreur=produit");
    }
    payload.push({
      name, brand, category, description,
      photo_url: photo || null, price_fcfa: price, stock_quantity: stock,
      unit_label: val(row, "unit_label").slice(0,30) || "unité",
      expires_at: expiresAt || null,
      low_stock_threshold: threshold,
    });
  }
  if (!payload.length) redirect("/partenaire/catalogue?erreur=csv");
  const { error } = await sb.rpc("partner_import_universe_products", {
    p_partner_id: partnerId, p_universe_slug: universe, p_rows: payload,
  });
  if (error) redirect("/partenaire/catalogue?erreur=csv");
  revalidatePath("/partenaire/catalogue"); revalidatePath("/" + universe);
  redirect("/partenaire/catalogue?ok=csv");
}
