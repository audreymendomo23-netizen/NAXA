type CommonsImageInfo = {
  url?: string;
  thumburl?: string;
  descriptionurl?: string;
  extmetadata?: Record<string, { value?: string }>;
};
type CommonsPage = { title?: string; imageinfo?: CommonsImageInfo[] };
type CommonsResponse = { query?: { pages?: Record<string, CommonsPage> } };

export type MedicamentPhoto = {
  url: string;
  sourceUrl: string;
  licence: string;
  attribution: string | null;
  title: string;
};

/**
 * Ne retourne que des images Commons dont la licence permet la réutilisation
 * commerciale. Aucune image n'est téléchargée/copieuse dans Storage sans
 * contrôle éditorial distinct et preuve de provenance.
 */
export async function rechercherPhotoMedicament(term: string): Promise<MedicamentPhoto | null> {
  const query = term.trim().slice(0, 80);
  const tokens = query.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length >= 4);
  if (!tokens.length) return null;

  const params = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: "filetype:bitmap " + query + " medicine",
    gsrnamespace: "6",
    gsrlimit: "8",
    prop: "imageinfo",
    iiprop: "url|extmetadata",
    iiurlwidth: "640",
    format: "json",
    origin: "*"
  });

  try {
    const response = await fetch("https://commons.wikimedia.org/w/api.php?" + params.toString(), {
      headers: { Accept: "application/json", "User-Agent": "NAXA/1.0 (medicine catalogue; contact: naxa.home@gmail.com)" },
      signal: AbortSignal.timeout(3500),
      next: { revalidate: 86400 }
    });
    if (!response.ok) return null;
    const json = await response.json() as CommonsResponse;
    const pages = Object.values(json.query?.pages ?? {});
    for (const page of pages) {
      const info = page.imageinfo?.[0];
      if (!info?.thumburl || !info.url || !info.descriptionurl || !page.title) continue;
      const metadata = info.extmetadata ?? {};
      const license = (metadata.LicenseShortName?.value ?? "").replace(/<[^>]*>/g, "").trim();
      const terms = (metadata.UsageTerms?.value ?? "").replace(/<[^>]*>/g, "").trim();
      const licenseUrl = (metadata.LicenseUrl?.value ?? "").trim();
      const title = page.title.replace(/^File:/i, "").replace(/\.[a-z0-9]{2,5}$/i, "");
      const normalizedTitle = title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      const commercialLicense = /^(CC0|Public domain|CC BY(?:-SA)?(?:\s|$))/i.test(license);
      const noNcNd = !/\b(NC|ND)\b/i.test(license);
      const relevant = tokens.every((token) => normalizedTitle.includes(token));
      if (!commercialLicense || !noNcNd || !relevant) continue;
      const artist = (metadata.Artist?.value ?? metadata.Credit?.value ?? "").replace(/<[^>]*>/g, "").trim();
      return {
        url: info.thumburl,
        sourceUrl: info.descriptionurl,
        licence: [license, terms, licenseUrl].filter(Boolean).join(" — "),
        attribution: artist || null,
        title
      };
    }
    return null;
  } catch {
    return null;
  }
}
