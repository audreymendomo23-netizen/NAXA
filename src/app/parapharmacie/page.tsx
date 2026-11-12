import { UniverseCatalog } from "@/components/universes/UniverseCatalog";

type PageSearchParams = { erreur?: string };

export default async function ParapharmaciePage({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>;
}) {
  const params = await searchParams;
  return <UniverseCatalog universe="parapharmacie" actionError={params.erreur} />;
}
