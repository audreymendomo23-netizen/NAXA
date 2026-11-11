import {
  loadProductImageLibrary,
  type ProductImageLibraryItem,
  type ProductImageUniverse,
} from "@/lib/catalogue/product-image-library";

const CONFIG: Record<ProductImageUniverse, {
  title: string;
  intro: string;
  accent: string;
  surface: string;
}> = {
  parapharmacie: {
    title: "Bibliothèque visuelle · Parapharmacie",
    intro: "Photos de référence de produits d’hygiène, de soin et de cosmétique répertoriés par la base ouverte. Elles ne représentent pas les stocks des pharmacies partenaires.",
    accent: "#0B7F85",
    surface: "#E6F7F6",
  },
  "bebe-maman": {
    title: "Bibliothèque visuelle · Bébé & Maman",
    intro: "Photos documentaires de références liées aux soins du bébé et de la maternité. Présentation neutre : aucun prix, classement, placement sponsorisé ni incitation à l’achat.",
    accent: "#C93774",
    surface: "#FDEEF4",
  },
};

function Attribution({ item }: { item: ProductImageLibraryItem }) {
  return (
    <p className="mt-2 text-[10px] leading-4 text-slate-500">
      Crédit photo : {item.photographer}
    </p>
  );
}

export async function ProductImageLibrary({ universe }: { universe: ProductImageUniverse }) {
  const config = CONFIG[universe];
  const items = await loadProductImageLibrary(universe);

  return (
    <section
      className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
      aria-labelledby={"product-image-library-" + universe}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-3xl">
          <p
            className="text-[10px] font-extrabold uppercase tracking-[0.16em]"
            style={{ color: config.accent }}
          >
            Références photographiques · Base ouverte
          </p>
          <h2
            id={"product-image-library-" + universe}
            className="mt-1 text-xl font-black text-slate-900 sm:text-2xl"
          >
            {config.title}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{config.intro}</p>
        </div>
        <span
          className="rounded-full px-3 py-1.5 text-xs font-bold"
          style={{ backgroundColor: config.surface, color: config.accent }}
        >
          {items.length} photo(s) de référence
        </span>
      </div>

      {items.length > 0 ? (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => (
            <article
              key={item.code}
              className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white"
            >
              <div
                className="relative flex aspect-[4/3] items-center justify-center overflow-hidden p-3"
                style={{ backgroundColor: config.surface }}
              >
                <img
                  src={item.imageUrl}
                  alt={"Photo de référence : " + item.name}
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-contain"
                />
              </div>
              <div className="p-3">
                <p className="truncate text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  {item.brand}
                </p>
                <h3 className="mt-1 line-clamp-2 min-h-10 text-xs font-extrabold leading-5 text-slate-900">
                  {item.name}
                </h3>
                <p className="mt-1 line-clamp-2 min-h-8 text-[10px] leading-4 text-slate-500">
                  {item.category}
                </p>
                <Attribution item={item}/>
                <a
                  href={item.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex min-h-9 items-center text-[11px] font-bold underline underline-offset-2"
                  style={{ color: config.accent }}
                >
                  Voir la fiche source
                </a>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p role="status" className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm leading-6 text-slate-600">
          La base photographique ne renvoie pas d’image exploitable pour le moment. Les photos des produits partenaires publiés apparaîtront séparément dans le catalogue NAXA.
        </p>
      )}

      <div className="mt-4 border-t border-slate-100 pt-3 text-[10px] leading-5 text-slate-500">
        Photos contributives Open Beauty Facts, sous licence{" "}
        <a
          href="https://creativecommons.org/licenses/by-sa/3.0/"
          target="_blank"
          rel="noreferrer"
          className="font-semibold underline underline-offset-2"
        >
          Creative Commons Attribution – Partage dans les mêmes conditions (CC BY-SA 3.0)
        </a>
        . Fiches communautaires non garanties exhaustives. Les marques et éléments graphiques des emballages restent ceux de leurs détenteurs. Cette galerie ne prouve ni référencement local, ni stock, ni disponibilité chez une pharmacie partenaire.
        {" "}
        <a
          href="https://world.openbeautyfacts.org/"
          target="_blank"
          rel="noreferrer"
          className="font-semibold underline underline-offset-2"
        >
          Source : Open Beauty Facts
        </a>
        .
      </div>
    </section>
  );
}
