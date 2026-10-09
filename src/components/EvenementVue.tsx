"use client";

import { useEffect } from "react";
import { suivre } from "@/lib/evenements";

export function EvenementVue({ produitId }: { produitId: string }) {
  useEffect(() => {
    void suivre({ type: "fiche_vue", produitId });
  }, [produitId]);
  return null;
}
