"use client";
import { useEffect } from "react";
const CART_KEY = "naxa-universe-cart-v1";
export function ClearReservedGroup({ partnerId, universeSlug }: { partnerId?: string; universeSlug?: string }) {
  useEffect(() => {
    if (!partnerId || !universeSlug || !["parapharmacie", "bebe-maman"].includes(universeSlug)) return;
    try {
      const raw = window.localStorage.getItem(CART_KEY);
      if (!raw) return;
      const items = JSON.parse(raw);
      if (!Array.isArray(items)) return;
      window.localStorage.setItem(CART_KEY, JSON.stringify(items.filter((item) =>
        !(item && item.partnerId === partnerId && item.universe === universeSlug)
      )));
    } catch { /* Panier local invalide : ne pas bloquer le reçu. */ }
  }, [partnerId, universeSlug]);
  return null;
}
