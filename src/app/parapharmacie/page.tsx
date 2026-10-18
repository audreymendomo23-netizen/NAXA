import { UniverseCatalog } from "@/components/universes/UniverseCatalog";

export default function ParapharmaciePage({ searchParams }: { searchParams: { erreur?: string } }) {
  return <UniverseCatalog universe="parapharmacie" actionError={searchParams.erreur} />;
}
