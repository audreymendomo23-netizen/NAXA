"use server";

import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { isMedicationProduct } from "@/lib/universe-product-rules";

type ReservationItem = { product_id: string; quantity: number };
type OwnerType = "pharmacie" | "parapharmacie";

function universePath(universe: string) {
  return "/" + (universe === "bebe-maman" ? "bebe-maman" : "parapharmacie");
}

async function catalogItemsAllowed(
  sb: ReturnType<typeof supabaseServer>,
  universe: string,
  ownerType: OwnerType,
  ownerId: string,
  items: ReservationItem[],
) {
  const { data, error } = await sb.rpc("get_universe_catalog_v2", { p_universe_slug: universe });
  if (error || !Array.isArray(data)) return false;
  const products = new Map<string, any>(
    data.map((product: any) => [String(product.product_id), product] as [string, any]),
  );
  return items.every((item) => {
    const product = products.get(item.product_id);
    return Boolean(
      product
      && product.owner_type === ownerType
      && product.owner_id === ownerId
      && product.universe_slug === universe
      && !(universe === "parapharmacie" && isMedicationProduct(product))
    );
  });
}

async function reserveOwnedGroup(
  sb: ReturnType<typeof supabaseServer>,
  universe: string,
  ownerType: OwnerType,
  ownerId: string,
  items: ReservationItem[],
) {
  if (ownerType === "pharmacie") {
    const { data, error } = await sb.rpc("reserve_pharmacy_stock_in_universe", {
      p_pharmacie: ownerId,
      p_universe_slug: universe,
      p_items: items,
    });
    if (error || !data || typeof data.id !== "string") return null;
    return { id: data.id as string, receipt: "pharmacy" as const };
  }
  const { data, error } = await sb.rpc("reserve_universe_products", {
    p_partner_id: ownerId,
    p_universe_slug: universe,
    p_items: items,
    p_note: null,
  });
  if (error || typeof data !== "string") return null;
  return { id: data, receipt: "partner" as const };
}

async function requireClient(sb: ReturnType<typeof supabaseServer>, universe: string) {
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/connexion?retour=" + encodeURIComponent(universePath(universe)));
  const { data: profile, error } = await sb.from("profiles").select("role,actif").eq("id", auth.user.id).maybeSingle();
  if (error || profile?.role !== "client" || profile.actif !== true) {
    redirect(universePath(universe) + "?erreur=compte");
  }
}

const uuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const ownerTypeValue = (value: string): OwnerType | null =>
  value === "pharmacie" || value === "parapharmacie" ? value : null;

export async function reserverProduit(form: FormData) {
  const universe = String(form.get("universe_slug") ?? "");
  const ownerType = ownerTypeValue(String(form.get("owner_type") ?? ""));
  const ownerId = String(form.get("owner_id") ?? form.get("partner_id") ?? "");
  const productId = String(form.get("product_id") ?? "");
  const quantity = Number(form.get("quantity") ?? 1);
  if (!["parapharmacie", "bebe-maman"].includes(universe) || !ownerType
      || !uuid(ownerId) || !uuid(productId)
      || !Number.isInteger(quantity) || quantity < 1 || quantity > 10
      || (ownerType === "parapharmacie" && universe === "pharmacie")) {
    redirect(universePath(universe) + "?erreur=reservation");
  }
  const sb = supabaseServer();
  await requireClient(sb, universe);
  const items = [{ product_id: productId, quantity }];
  if (!(await catalogItemsAllowed(sb, universe, ownerType, ownerId, items))) {
    redirect(universePath(universe) + "?erreur=stock");
  }
  const reservation = await reserveOwnedGroup(sb, universe, ownerType, ownerId, items);
  if (!reservation) redirect(universePath(universe) + "?erreur=stock");
  if (reservation.receipt === "pharmacy") {
    redirect("/reservation/" + reservation.id + "?viderOwnerType=" + ownerType + "&viderOwnerId=" + ownerId + "&univers=" + universe);
  }
  redirect("/univers-reservation/" + reservation.id + "?viderOwnerType=" + ownerType + "&viderOwnerId=" + ownerId + "&univers=" + universe);
}

export async function annulerReservationUnivers(form: FormData) {
  const id = String(form.get("reservation_id") ?? "");
  if (!uuid(id)) redirect("/?erreur=reservation");
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
  const ownerType = ownerTypeValue(String(form.get("owner_type") ?? ""));
  const ownerId = String(form.get("owner_id") ?? form.get("partner_id") ?? "");
  let items: ReservationItem[] = [];
  try {
    const parsed = JSON.parse(String(form.get("items") ?? "[]"));
    if (Array.isArray(parsed)) items = parsed.map((item) => ({
      product_id: String(item.product_id ?? ""),
      quantity: Number(item.quantity),
    }));
  } catch {
    redirect(universePath(universe) + "?erreur=panier");
  }
  if (!["parapharmacie", "bebe-maman"].includes(universe) || !ownerType
      || !uuid(ownerId) || items.length < 1 || items.length > 20
      || (ownerType === "pharmacie" && items.length > 10)
      || items.some((item) => !uuid(item.product_id) || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 10)
      || new Set(items.map((item) => item.product_id)).size !== items.length) {
    redirect(universePath(universe) + "?erreur=panier");
  }
  const sb = supabaseServer();
  await requireClient(sb, universe);
  if (!(await catalogItemsAllowed(sb, universe, ownerType, ownerId, items))) {
    redirect(universePath(universe) + "?erreur=stock");
  }
  const reservation = await reserveOwnedGroup(sb, universe, ownerType, ownerId, items);
  if (!reservation) redirect(universePath(universe) + "?erreur=stock");
  const receiptPath = reservation.receipt === "pharmacy" ? "/reservation/" : "/univers-reservation/";
  redirect(receiptPath + reservation.id + "?viderOwnerType=" + ownerType + "&viderOwnerId=" + ownerId + "&univers=" + universe);
}
