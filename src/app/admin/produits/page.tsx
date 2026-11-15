import Link from "next/link";
import { requireAdminActive } from "@/lib/admin/require-admin-active";
import { Logo } from "@/components/Logo";

type ProduitAdmin = {
  id: string;
  nom: string;
  dci: string;
  dosage: string;
  forme: string;
  source_fiche: string | null;
  created_by_pharmacie_id: string | null;
};

export default async function AdminProduits({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const filters = await searchParams;
  const { sb } = await requireAdminActive("/admin/produits");
  const q = (filters.q ?? "").trim().slice(0, 100);

  let query = sb.from("produits")
    .select("id,nom,dci,dosage,forme,source_fiche,created_by_pharmacie_id")
    .order("nom", { ascending: true })
    .limit(200);
  if (q) query = query.ilike("nom_norm", "%" + q.toLowerCase() + "%");

  const { data, error, count } = await query;
  const products = (data ?? []) as ProduitAdmin[];
  const declaredByPharmacy = products.filter((product) =>
    product.source_fiche === "declaration_pharmacie" || Boolean(product.created_by_pharmacie_id)
  ).length;

  return (
    <main className="mx-auto min-h-screen max-w-6xl space-y-5 px-4 py-5">
      <header className="flex items-center justify-between rounded-2xl bg-naxa-green-900 px-4 py-3 text-white">
        <Link href="/admin"><Logo taille={34}/></Link>
        <Link href="/admin" className="text-sm font-semibold underline">Administration</Link>
      </header>

      <section className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wide text-naxa-green-800">Consultation technique</p>
        <h1 className="text-2xl font-black text-slate-950">Catalogue partagé des produits</h1>
        <p className="max-w-3xl text-sm leading-6 text-slate-700">
          Les pharmacies déclarent librement leurs références, leurs prix et leurs stocks.
          NAXA ne vérifie, ne certifie, n'approuve et ne corrige pas les fiches.
          L'affichage public dépend uniquement d'une offre réellement vendable communiquée
          par une pharmacie active.
        </p>
        <p className="max-w-3xl text-xs leading-5 text-slate-500">
          Cet écran est en lecture seule. Il ne permet ni de valider une fiche, ni de publier
          un stock, ni de modifier une déclaration de pharmacie.
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <article className="rounded-2xl border bg-white p-4">
          <p className="text-sm text-slate-500">Références consultées</p>
          <p className="mt-1 text-3xl font-black">{error ? "—" : count ?? products.length}</p>
        </article>
        <article className="rounded-2xl border bg-white p-4">
          <p className="text-sm text-slate-500">Références déclarées par les pharmacies</p>
          <p className="mt-1 text-3xl font-black">{error ? "—" : declaredByPharmacy}</p>
        </article>
      </section>

      <form method="get" className="flex flex-col gap-2 rounded-2xl border bg-white p-4 sm:flex-row">
        <label className="flex-1 text-sm font-semibold">
          Rechercher une référence
          <input name="q" defaultValue={q} maxLength={100} placeholder="Nom du produit"
            className="mt-1 min-h-11 w-full rounded-xl border px-3"/>
        </label>
        <div className="flex items-end gap-2">
          <button className="min-h-11 rounded-xl bg-naxa-green-900 px-5 font-bold text-white">Rechercher</button>
          <Link href="/admin/produits" className="inline-flex min-h-11 items-center rounded-xl border px-4 text-sm font-bold">Effacer</Link>
        </div>
      </form>

      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-900">
        Le catalogue n'a pas pu être consulté. Aucun chiffre n'est présenté comme complet.
      </p>}

      {!error && products.length === 0 && <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-slate-600">
        Aucune référence dans cette recherche.
      </p>}

      {!error && products.length > 0 && <div className="overflow-x-auto rounded-2xl border bg-white">
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead className="bg-slate-50"><tr>
            <th className="p-3">Référence</th><th className="p-3">DCI</th>
            <th className="p-3">Dosage / présentation</th><th className="p-3">Origine déclarative</th>
          </tr></thead>
          <tbody>{products.map((product) => <tr key={product.id} className="border-t">
            <td className="p-3 font-semibold">{product.nom}<span className="block text-xs font-normal text-slate-500">{product.forme}</span></td>
            <td className="p-3">{product.dci}</td>
            <td className="p-3">{product.dosage}</td>
            <td className="p-3">{product.source_fiche === "declaration_pharmacie" || product.created_by_pharmacie_id
              ? "Déclaration pharmacie"
              : "Référence catalogue existante"}</td>
          </tr>)}</tbody>
        </table>
      </div>}
    </main>
  );
}
