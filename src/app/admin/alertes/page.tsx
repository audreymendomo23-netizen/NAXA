import Link from "next/link";
import { isDemoPharmacy } from "@/lib/admin/is-demo-pharmacy";
import { requireAdminActive } from "@/lib/admin/require-admin-active";

export default async function AdminAlertes() {
  const { sb } = await requireAdminActive("/admin/alertes");
  const [{ data: pharmacies, error: pharmaciesError }, { data: validites, error: validitesError }] = await Promise.all([
    sb.from("pharmacies").select("id,nom,stock_updated_at,actif,visible_recherche").order("nom"),
    sb.rpc("validites_promoteurs_admin"),
  ]);
  const rows = (pharmacies ?? []).filter((p) => !isDemoPharmacy(p.nom));
  const missingStock = rows.filter((p) => !p.stock_updated_at);
  const inactive = rows.filter((p) => p.actif === false || p.visible_recherche === false);
  const overdue = ((validites ?? []) as any[]).filter((x) => x.statut === "impaye" || Number(x.jours_restants) < 0);
  const broken = !!(pharmaciesError || validitesError);
  return <main className="space-y-5">
    <header><div><p className="text-xs font-extrabold uppercase tracking-widest text-amber-700">NAXA · Surveillance réseau</p><h1>Alertes réseau</h1><p className="mt-2 text-sm text-slate-600">Signaux calculés à partir des dates de stock, de l’état de publication des pharmacies et des échéances de convention. Une date de stock manquante ne signifie pas nécessairement une rupture de produit.</p></div><Link href="/admin" className="font-bold underline">← Vue générale</Link></header>
    {broken && <p role="alert" className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm">Une ou plusieurs sources d’alerte sont indisponibles. Les éléments ci-dessous peuvent être incomplets ; aucune donnée n’a été modifiée.</p>}
    <div className="grid gap-3 sm:grid-cols-3">
      <article className="rounded-2xl border bg-white p-4"><p className="text-sm text-slate-600">Dates de stock manquantes</p><p className="mt-2 text-3xl font-black">{pharmaciesError ? "—" : missingStock.length}</p></article>
      <article className="rounded-2xl border bg-white p-4"><p className="text-sm text-slate-600">Pharmacies inactives ou masquées</p><p className="mt-2 text-3xl font-black">{pharmaciesError ? "—" : inactive.length}</p></article>
      <article className="rounded-2xl border bg-white p-4"><p className="text-sm text-slate-600">Échéances à régulariser</p><p className="mt-2 text-3xl font-black">{validitesError ? "—" : overdue.length}</p></article>
    </div>
    <section className="rounded-2xl border bg-white p-4 sm:p-5"><h2 className="text-lg font-extrabold">Stock à vérifier</h2>{pharmaciesError ? <p role="status" className="mt-2 text-sm text-amber-800">Indisponible : la liste des pharmacies n’a pas pu être chargée.</p> : missingStock.length ? <ul className="mt-3 divide-y">{missingStock.map(p => <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><span className="font-semibold">{p.nom}</span><span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold">Date non renseignée</span></li>)}</ul> : <p className="mt-2 text-sm text-slate-600">Toutes les pharmacies disposent d’une date de stock, ou aucune pharmacie n’est enregistrée.</p>}</section>
    <section className="rounded-2xl border bg-white p-4 sm:p-5"><h2 className="text-lg font-extrabold">Pharmacies inactives ou masquées</h2>{pharmaciesError ? <p role="status" className="mt-2 text-sm text-amber-800">Indisponible : la liste des pharmacies n’a pas pu être chargée.</p> : inactive.length ? <ul className="mt-3 divide-y">{inactive.map(p => <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><span className="font-semibold">{p.nom}</span><Link href={"/admin/pharmacies/"+p.id} className="font-bold underline">Ouvrir le dossier →</Link></li>)}</ul> : <p className="mt-2 text-sm text-slate-600">Aucune pharmacie inactive ou masquée détectée dans les champs consultés.</p>}</section>
    <section className="rounded-2xl border bg-white p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-extrabold">Conventions et échéances</h2><Link href="/admin/pilotage/validite" className="font-bold underline">Ouvrir la page Validité →</Link></div>{validitesError ? <p role="status" className="mt-2 text-sm text-amber-800">Indisponible : les échéances ne peuvent pas être confirmées.</p> : overdue.length ? <ul className="mt-3 divide-y">{overdue.map((x:any) => <li key={x.promoteur_id} className="py-3"><p className="font-semibold">{x.promoteur_nom || "Promoteur sans nom"}</p><p className="text-sm text-slate-600">{x.pharmacies_count} pharmacie(s) · {x.statut === "impaye" ? "Paiement à vérifier" : "Échéance dépassée"}</p></li>)}</ul> : <p className="mt-2 text-sm text-slate-600">Aucune échéance en retard détectée par la fonction de validité.</p>}</section>
  </main>;
}
