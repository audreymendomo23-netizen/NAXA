"use client";
import { useEffect } from "react";
const CART_KEY = "naxa-universe-cart-v1";

export function ClearReservedGroup({
  ownerType, ownerId, universeSlug, partnerId,
}: {
  ownerType?: "pharmacie" | "parapharmacie";
  ownerId?: string;
  universeSlug?: string;
  partnerId?: string;
}) {
  useEffect(() => {
    const effectiveOwnerId = ownerId || partnerId;
    if (!effectiveOwnerId || !universeSlug || !["parapharmacie", "bebe-maman"].includes(universeSlug)) return;
    try {
      const raw = window.localStorage.getItem(CART_KEY);
      if (!raw) return;
      const items = JSON.parse(raw);
      if (!Array.isArray(items)) return;
      window.localStorage.setItem(CART_KEY, JSON.stringify(items.filter((item) => {
        if (!item || item.universe !== universeSlug) return true;
        if (ownerType) {
          const type = item.ownerType || (typeof item.partnerId === "string" ? "parapharmacie" : null);
          const id = item.ownerId || item.partnerId;
          return type !== ownerType || id !== effectiveOwnerId;
        }
        return item.partnerId !== effectiveOwnerId;
      })));
    } catch { /* Panier local invalide : ne pas bloquer le reçu. */ }
  }, [ownerType, ownerId, partnerId, universeSlug]);
  return null;
}
