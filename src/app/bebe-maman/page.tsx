import { UniverseCatalog } from "@/components/universes/UniverseCatalog";

type BebeMamanSearchParams = {
  erreur?: string;
};

export default async function BebeMamanPage({
  searchParams,
}: {
  searchParams: Promise<BebeMamanSearchParams>;
}) {
  const params = await searchParams;

  return <UniverseCatalog universe="bebe-maman" actionError={params.erreur} />;
}
