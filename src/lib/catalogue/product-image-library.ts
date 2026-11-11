export type ProductImageUniverse = "parapharmacie" | "bebe-maman";

type OpenBeautyFactsProduct = {
  code?: string;
  product_name?: string;
  brands?: string;
  categories?: string;
  image_front_url?: string;
  image_front_small_url?: string;
  photographers_tags?: string[];
};

type OpenBeautyFactsResponse = {
  products?: OpenBeautyFactsProduct[];
};

export type ProductImageLibraryItem = {
  code: string;
  name: string;
  brand: string;
  category: string;
  imageUrl: string;
  photographer: string;
  sourceUrl: string;
};

const SOURCE_QUERIES: Record<ProductImageUniverse, string> = {
  parapharmacie: "skin care",
  "bebe-maman": "baby",
};

function imageUrlValide(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      url.hostname === "images.openbeautyfacts.org" &&
      url.pathname.includes("/images/products/");
  } catch {
    return false;
  }
}

function productSourceUrl(code: string) {
  return "https://world.openbeautyfacts.org/product/" + encodeURIComponent(code);
}

function normalizeProducts(
  products: OpenBeautyFactsProduct[],
  universe: ProductImageUniverse,
): ProductImageLibraryItem[] {
  const unique = new Map<string, ProductImageLibraryItem>();
  const babyPattern = /baby|bébé|bebe|infant|newborn|nourrisson|matern|breast|maternity|child|enfant|diaper|nappy|wipes|couche|lingette/i;

  for (const product of products) {
    const code = String(product.code ?? "").trim();
    const name = String(product.product_name ?? "").trim();
    const imageUrl = imageUrlValide(product.image_front_url)
      ? product.image_front_url
      : imageUrlValide(product.image_front_small_url)
        ? product.image_front_small_url
        : null;
    if (!/^\d{8,14}$/.test(code) || name.length < 2 || !imageUrl || unique.has(code)) continue;

    const brand = String(product.brands ?? "").split(",")[0].trim().slice(0, 100);
    const category = String(product.categories ?? "").split(",")[0].trim().slice(0, 100);
    if (universe === "bebe-maman" && !babyPattern.test([name, brand, category].join(" "))) continue;

    const photographerTags = Array.isArray(product.photographers_tags)
      ? product.photographers_tags.filter((tag) => typeof tag === "string" && tag.trim().length > 0)
      : [];

    unique.set(code, {
      code,
      name: name.slice(0, 180),
      brand: brand || "Marque non renseignée",
      category: category || "Catégorie non renseignée",
      imageUrl,
      photographer: photographerTags.slice(0, 3).join(", ") || "Contributeurs Open Beauty Facts",
      sourceUrl: productSourceUrl(code),
    });
  }

  return Array.from(unique.values())
    .sort((a, b) => a.name.localeCompare(b.name, "fr"))
    .slice(0, 12);
}

export async function loadProductImageLibrary(
  universe: ProductImageUniverse,
): Promise<ProductImageLibraryItem[]> {
  const url = new URL("https://world.openbeautyfacts.org/cgi/search.pl");
  url.searchParams.set("search_terms", SOURCE_QUERIES[universe]);
  url.searchParams.set("search_simple", "1");
  url.searchParams.set("action", "process");
  url.searchParams.set("json", "1");
  url.searchParams.set("page_size", "40");
  url.searchParams.set(
    "fields",
    "code,product_name,brands,categories,image_front_url,image_front_small_url,photographers_tags",
  );
  url.searchParams.set("lc", "fr");

  try {
    const response = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent": "NAXA/1.0 (naxa.home@gmail.com)",
      },
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return [];
    const payload = await response.json() as OpenBeautyFactsResponse;
    return normalizeProducts(Array.isArray(payload.products) ? payload.products : [], universe);
  } catch {
    return [];
  }
}
