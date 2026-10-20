"use client";

import { notFound, useParams } from "next/navigation";
import { PharmacienWorkspace } from "@/components/pharmacie/PharmacienWorkspace";

const sections = [
  "consultation",
  "prescription",
  "ordonnances",
  "preparations",
  "historique",
  "rapports",
  "profil",
] as const;

type Section = (typeof sections)[number];

export default function PharmacienSectionPage() {
  const params = useParams<{ section: string }>();
  const section = params.section;
  if (!sections.includes(section as Section)) notFound();

  return <PharmacienWorkspace key={section} initialTab={section as Section} />;
}
