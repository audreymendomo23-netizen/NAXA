import type { Metadata } from "next";
import { FaqInteractive } from "@/components/FaqInteractive";

export const metadata: Metadata = {
  title: "FAQ NAXA — Centre d’aide",
  description: "Retrouvez les réponses aux questions fréquentes sur les six espaces NAXA, les offres, les commandes et l’assistance Client.",
};

export default function FaqPage() {
  return <FaqInteractive />;
}
