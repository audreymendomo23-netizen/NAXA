import { UniverseCatalog } from "@/components/universes/UniverseCatalog";

export default function BebeMamanPage({ searchParams }: { searchParams: { erreur?: string } }) {
  return <UniverseCatalog universe="bebe-maman" actionError={searchParams.erreur} />;
}
