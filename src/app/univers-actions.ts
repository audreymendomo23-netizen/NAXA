"use server";

import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { excludedFromBabyUniverse, isMedicationProduct } from "@/lib/universe-product-rules";

type ReservationItem = { product_id: string; quantity: number };

async function catalogItemsAllowed(sb: any, universe: string, partnerId: string, items: ReservationItem[]) {
  const { data, error } = await sb.rpc("get_universe_catalog", { p_universe_slug: universe });
  if (error || !Array.isArray(data)) return false;
  const products = new Map<string, any>(data.map((product: any) => [String(product.product_id), product] as [string, any]));
  return items.every((item) => {
    const product = products.get(item.product_id);
    if (!product || product.partner_id !== partnerId || product.universe_slug !== universe) return false;
    if (universe === "parapharmacie" && isMedicationProduct(product)) return false;
    if (universe === "bebe-maman" && excludedFromBabyUniverse(product)) return false;
    return true;
  });
}


export async function reserverProduit(form: FormData) {
  const universe = String(form.get("universe_slug") ?? "");
  const partnerId = String(form.get("partner_id") ?? "");
  const productId = String(form.get("product_id") ?? "");
  const quantity = Number(form.get("quantity") ?? 1);
  if (!["parapharmacie", "bebe-maman"].includes(universe) ||
      !/^[0-9a-f-]{36}$/i.test(partnerId) ||
      !/^[0-9a-f-]{36}$/i.test(productId) ||
      !Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
    redirect("/" + (universe === "bebe-maman" ? "bebe-maman" : "parapharmacie") + "?erreur=reservation");
  }
  const sb = supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/connexion?retour=/" + universe);
  const { data: profile } = await sb.from("profiles").select("role").eq("id", auth.user.id).maybeSingle();
  if (profile?.role !== "client") redirect("/" + universe + "?erreur=compte");
  if (!(await catalogItemsAllowed(sb, universe, partnerId, [{ product_id: productId, quantity }]))) redirect("/" + universe + "?erreur=stock");
  const { data, error } = await sb.rpc("reserve_universe_products", {
    p_partner_id: partnerId,
    p_universe_slug: universe,
    p_items: [{ product_id: productId, quantity }],
    p_note: null,
  });
  if (error || !data) redirect("/" + universe + "?erreur=stock");
  redirect("/univers-reservation/" + String(data));
}

export async function annulerReservationUnivers(form: FormData) {
  const id = String(form.get("reservation_id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) redirect("/?erreur=reservation");
  const sb = supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/connexion?retour=/univers-reservation/" + id);
  const { error } = await sb.rpc("transition_universe_reservation", {
    p_reservation_id: id,
    p_status: "cancelled",
  });
  if (error) redirect("/univers-reservation/" + id + "?erreur=annulation");
  redirect("/univers-reservation/" + id + "?ok=annulation");
}


export async function reserverGroupeProduits(form: FormData) {
  const universe = String(form.get("universe_slug") ?? "");
  const partnerId = String(form.get("partner_id") ?? "");
  let items: { product_id: string; quantity: number }[] = [];
  try {
    const parsed = JSON.parse(String(form.get("items") ?? "[]"));
    if (Array.isArray(parsed)) items = parsed.map((item) => ({
      product_id: String(item.product_id ?? ""),
      quantity: Number(item.quantity),
    }));
  } catch {
    redirect("/" + (universe === "bebe-maman" ? "bebe-maman" : "parapharmacie") + "?erreur=panier");
  }
  if (!["parapharmacie", "bebe-maman"].includes(universe) ||
      !/^[0-9a-f-]{36}$/i.test(partnerId) || items.length < 1 || items.length > 20 ||
      items.some((item) => !/^[0-9a-f-]{36}$/i.test(item.product_id) || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 10) ||
      new Set(items.map((item) => item.product_id)).size !== items.length) {
    redirect("/" + (universe === "bebe-maman" ? "bebe-maman" : "parapharmacie") + "?erreur=panier");
  }
  const sb = supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/connexion?retour=/" + universe);
  const { data: profile } = await sb.from("profiles").select("role").eq("id", auth.user.id).maybeSingle();
  if (profile?.role !== "client") redirect("/" + universe + "?erreur=compte");
  if (!(await catalogItemsAllowed(sb, universe, partnerId, items))) redirect("/" + universe + "?erreur=stock");
  const { data, error } = await sb.rpc("reserve_universe_products", {
    p_partner_id: partnerId, p_universe_slug: universe, p_items: items, p_note: null,
  });
  if (error || !data) redirect("/" + universe + "?erreur=stock");
  redirect("/univers-reservation/" + String(data) + "?viderPanier=" + partnerId + "&univers=" + universe);
}
