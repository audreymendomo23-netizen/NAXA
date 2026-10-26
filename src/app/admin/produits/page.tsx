import Link from "next/link";
import { requireAdminActive } from "@/lib/admin/require-admin-active";
import { Logo } from "@/components/Logo";
import { PhotoUpload } from "@/components/PhotoUpload";
import { brouillonIA, enregistrerFiche } from "./actions";

type StatutFiche = "toutes" | "a-completer" | "a-relire" | "validees";

export default async function AdminProduits({
  searchParams,
}: {
  searchParams: { q?: string; statut?: string; ok?: string; erreur?: string };
}) {
  const { sb } = await requireAdminActive("/admin/produits");

  const q = (searchParams.q ?? "").trim();
  const statut = (["toutes", "a-completer", "a-relire", "validees"].includes(searchParams.statut ?? "")
    ? searchParams.statut
    : "toutes") as StatutFiche;
  let req = sb.from("produits")
    .select("id,nom,dci,dosage,forme,photo_url,description,indications,precautions,synonymes,source_fiche,fiche_validee")
    .order("fiche_validee", { ascending: true }).order("nom").limit(30);
  if (q) req = req.ilike("nom_norm", `%${q.toLowerCase()}%`);
  const { data: produits, error } = await req;
  const toutes = produits ?? [];
  const listeProduits = toutes.filter((p) => {
    if (statut === "a-completer") return !p.fiche_validee && !p.description;
    if (statut === "a-relire") return !p.fiche_validee && !!p.description;
    if (statut === "validees") return !!p.fiche_validee;
    return true;
  });
  const compte = {
    toutes: toutes.length,
    "a-completer": toutes.filter((p) => !p.fiche_validee && !p.description).length,
    "a-relire": toutes.filter((p) => !p.fiche_validee && !!p.description).length,
    validees: toutes.filter((p) => !!p.fiche_validee).length,
  };
  const champ = "champ mt-1 !rounded-xl !py-2";
  const erreurs: Record<string, string> = {
    produit: "Le produit demandé est introuvable.",
    ia: "Le brouillon n’a pas pu être généré. Réessayez plus tard.",
    enregistrement: "La fiche n’a pas pu être enregistrée. Vérifiez vos droits et réessayez.",
  };
  const etat = (p: (typeof toutes)[number]) => p.fiche_validee
    ? { label: "Relue", style: "bg-emerald-100 text-emerald-900", description: "Fiche relue et validée" }
    : p.description
      ? { label: "À relire", style: "bg-amber-100 text-amber-900", description: "Contenu présent, validation requise" }
      : { label: "À compléter", style: "bg-slate-100 text-slate-700", description: "Description à renseigner" };

  return <main className="mx-auto max-w-6xl space-y-5 px-4 pb-16 sm:px-6">
    <header className="-mx-4 flex items-center justify-between gap-3 bg-naxa-green-900 px-4 py-3 text-white sm:mx-0 sm:rounded-2xl sm:px-5">
      <Logo taille={32}/>
      <Link href="/admin" className="rounded-full border border-white/50 px-3 py-2 text-sm font-semibold underline underline-offset-4">← Vue générale</Link>
    </header>

    <section className="rounded-3xl bg-[#F1F8F3] p-4 sm:p-6">
      <p className="text-xs font-extrabold uppercase tracking-[.18em] text-emerald-800">Catalogue santé · Administration</p>
      <div className="mt-2 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div><h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Fiches produits</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Un espace de relecture simple : complétez les informations, ajoutez une photo puis validez la fiche. Les brouillons IA restent non validés jusqu’à la relecture.</p></div>
        <span className="w-fit rounded-full border border-emerald-200 bg-white px-3 py-2 text-sm font-bold text-emerald-900">30 fiches maximum par recherche</span>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { key: "toutes", label: "Résultats", value: compte.toutes, tone: "border-slate-200" },
          { key: "a-completer", label: "À compléter", value: compte["a-completer"], tone: "border-slate-300" },
          { key: "a-relire", label: "À relire", value: compte["a-relire"], tone: "border-amber-300" },
          { key: "validees", label: "Validées", value: compte.validees, tone: "border-emerald-300" },
        ].map((item) => <div key={item.key} className={`rounded-2xl border bg-white p-3 sm:p-4 ${item.tone}`}><p className="text-xs font-semibold text-slate-500 sm:text-sm">{item.label}</p><p className="mt-1 text-2xl font-black text-slate-950">{item.value}</p></div>)}
      </div>
    </section>

    {searchParams.ok && <p role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">{searchParams.ok === "ia" ? "Brouillon IA généré. Relisez-le avant de l’enregistrer comme fiche validée." : "Fiche enregistrée."}</p>}
    {searchParams.erreur && <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">{erreurs[searchParams.erreur] ?? "Une erreur est survenue. Réessayez ou vérifiez les journaux techniques."}</p>}
    {error && <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">Les produits n’ont pas pu être chargés. Vérifiez la connexion à la base puis réessayez.</p>}

    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <form className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px_auto]" role="search" aria-label="Rechercher et filtrer les fiches produits" method="get">
        <label className="block text-sm font-bold text-slate-700">Recherche produit<input name="q" defaultValue={q} className={`${champ} w-full`} placeholder="Nom du produit…" aria-label="Chercher un produit"/></label>
        <label className="block text-sm font-bold text-slate-700">État de la fiche<select name="statut" defaultValue={statut} className={`${champ} w-full`}><option value="toutes">Tous les états</option><option value="a-completer">À compléter</option><option value="a-relire">À relire</option><option value="validees">Validées</option></select></label>
        <div className="flex items-end gap-2"><button className="min-h-11 flex-1 rounded-xl bg-[#0F6B3F] px-5 py-2 font-bold text-white">Rechercher</button><Link href="/admin/produits" className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 px-3 text-sm font-bold">Effacer</Link></div>
      </form>
    </section>

    {!error && listeProduits.length === 0 && <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center"><p className="text-lg font-extrabold">Aucune fiche dans cette sélection</p><p className="mt-2 text-sm text-slate-600">Modifiez la recherche ou choisissez « Tous les états ».</p></section>}

    <section aria-label="Catalogue des fiches produits" className="grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {listeProduits.map((p) => {
        const status = etat(p);
        return <article key={p.id} className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0"><h2 className="break-words text-base font-extrabold text-slate-950">{p.nom}{p.dosage ? ` · ${p.dosage}` : ""}</h2><p className="mt-1 text-sm text-slate-600">{[p.dci, p.forme].filter(Boolean).join(" · ") || "Informations générales à compléter"}</p></div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${status.style}`}>{status.label}</span>
            </div>
            <p className="mt-3 text-xs text-slate-500">{status.description}{p.source_fiche ? ` · Source : ${p.source_fiche === "ia" ? "IA" : p.source_fiche === "pharmacien" ? "Pharmacien" : "Administration"}` : ""}</p>
            <details className="mt-4 border-t border-slate-100 pt-3">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-sm font-bold text-emerald-900 hover:bg-emerald-50"><span>Ouvrir / modifier la fiche</span><span aria-hidden="true">＋</span></summary>
              <div className="mt-4 space-y-4">
                <PhotoUpload produitId={p.id} photoUrl={p.photo_url}/>
                <form className="space-y-3">
                  <input type="hidden" name="id" value={p.id}/><input type="hidden" name="q" value={q}/><input type="hidden" name="statut" value={statut}/>
                  <label className="block text-sm font-bold">Description<textarea name="description" defaultValue={p.description??""} rows={3} maxLength={400} className={`${champ} w-full`}/><span className="mt-1 block text-xs font-normal text-slate-500">400 caractères maximum.</span></label>
                  <label className="block text-sm font-bold">À quoi ça sert<textarea name="indications" defaultValue={p.indications??""} rows={3} maxLength={400} className={`${champ} w-full`}/></label>
                  <label className="block text-sm font-bold">Précautions<textarea name="precautions" defaultValue={p.precautions??""} rows={3} maxLength={600} className={`${champ} w-full`}/></label>
                  <label className="block text-sm font-bold">Synonymes de recherche<input name="synonymes" defaultValue={(p.synonymes??[]).join(", ")} className={`${champ} w-full`} placeholder="Séparés par des virgules"/></label>
                  <label className="flex min-h-12 items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm font-semibold"><input type="checkbox" name="validee" defaultChecked={p.fiche_validee} className="h-5 w-5"/> Fiche relue par un pharmacien</label>
                  <div className="grid gap-2 sm:grid-cols-2"><button formAction={brouillonIA} className="min-h-11 rounded-xl border border-emerald-800 px-3 py-2 text-sm font-bold text-emerald-900">Générer un brouillon IA</button><button formAction={enregistrerFiche} className="min-h-11 rounded-xl bg-[#0F6B3F] px-3 py-2 text-sm font-bold text-white">Enregistrer la fiche</button></div>
                  <p className="text-xs leading-5 text-slate-500">Le brouillon IA remplace les textes actuels et remet la fiche en état « À relire ». Vérifiez toujours le contenu avant validation. Aucune posologie n’est générée.</p>
                </form>
              </div>
            </details>
          </div>
        </article>;
      })}
    </section>
  </main>;
}
