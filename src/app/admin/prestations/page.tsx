import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { setHomeServiceOfferStatus } from "./actions";
import { BoutonNotifications } from "@/components/BoutonNotifications";

const statusLabel: Record<string, string> = { draft: "Brouillon", active: "Publié", archived: "Archivé" };

export default async function AdminHomeServices({ searchParams }: { searchParams: { ok?: string; erreur?: string; q?: string; statut?: string } }) {
  const sb = supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/connexion?retour=/admin/prestations");
  const { data: profile } = await sb.from("profiles").select("role").eq("id", auth.user.id).maybeSingle();
  if (profile?.role !== "admin") redirect("/");

  const { data: offers, error } = await sb.from("home_service_offers")
    .select("id,partner_id,name,category,description,service_area_label,price_fcfa,status,created_at,partners!inner(name,city,neighborhood,status,partner_type)")
    .order("created_at", { ascending: false }).limit(300);
  const allOffers = offers ?? [];
  const query = (searchParams.q ?? "").trim().toLocaleLowerCase("fr");
  const filteredOffers = allOffers.filter((offer: any) =>
    (!searchParams.statut || offer.status === searchParams.statut) &&
    (!query || [offer.name, offer.category, offer.description ?? "", offer.service_area_label, offer.partners?.name ?? "", offer.partners?.city ?? "", offer.partners?.neighborhood ?? ""].join(" ").toLocaleLowerCase("fr").includes(query))
  );
  const broken = !!error;
  return <main className="min-h-screen bg-[#F8FAF9] px-4 pb-12 text-slate-900">
    <div className="mx-auto max-w-5xl space-y-5 pt-4">
      <header className="flex items-center justify-between gap-3 rounded-2xl bg-[#064B2A] px-4 py-3 text-white"><strong>NAXA · Administration</strong><nav className="flex items-center gap-3"><BoutonNotifications/><Link href="/admin/univers" className="font-bold underline">Univers et partenaires</Link></nav></header>
      <div><p className="text-xs font-extrabold uppercase tracking-widest text-[#B73623]">NAXA · Validation des offres</p><h1 className="mt-1 text-3xl font-black">Prestations et soins à domicile</h1><p className="mt-2 text-sm leading-6 text-slate-600">Une offre ne peut être publiée que si le professionnel, son association à l’univers Prestations et les drapeaux de l’univers sont actifs. La validation ne remplace pas la vérification réelle des justificatifs du professionnel.</p></div>
      {searchParams.ok && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">{searchParams.ok === "active" ? "Prestation publiée." : searchParams.ok === "archived" ? "Prestation archivée." : "Prestation remise en brouillon."}</p>}
      {searchParams.erreur && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-900">Action refusée. Vérifie le statut du partenaire, l’association à l’univers et les activations.</p>}
      {broken && <p role="status" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-950">Le catalogue des prestations est temporairement indisponible. Les actions restent désactivées jusqu’au retour des données.</p>}
      {!broken && !allOffers.length && <p className="rounded-2xl border bg-white p-5 text-sm text-slate-600">Aucune prestation soumise à validation.</p>}
      {!broken && allOffers.length > 0 && <form method="get" role="search" aria-label="Rechercher les prestations à valider" className="grid gap-3 rounded-2xl border bg-white p-4 sm:grid-cols-[1fr_220px_auto_auto]">
        <label className="text-sm font-semibold">Rechercher<input name="q" defaultValue={searchParams.q ?? ""} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3" placeholder="Offre, professionnel, zone…"/></label>
        <label className="text-sm font-semibold">Statut<select name="statut" defaultValue={searchParams.statut ?? ""} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3"><option value="">Tous les statuts</option><option value="draft">Brouillon</option><option value="active">Publié</option><option value="archived">Archivé</option></select></label>
        <button className="min-h-11 self-end rounded-xl bg-[#064B2A] px-4 font-bold text-white">Filtrer</button><Link href="/admin/prestations" className="inline-flex min-h-11 items-center self-end rounded-xl border px-4 font-bold">Réinitialiser</Link>
      </form>}
      {!broken && allOffers.length > 0 && <p className="text-sm font-semibold text-slate-600">{filteredOffers.length} offre(s) affichée(s) sur {allOffers.length}</p>}
      {!broken && filteredOffers.length === 0 && allOffers.length > 0 && <p className="rounded-2xl border bg-white p-5 text-sm text-slate-600">Aucune offre ne correspond aux filtres.</p>}
      <div className="space-y-4">{filteredOffers.map((offer: any) => <article key={offer.id} className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-extrabold uppercase tracking-wide text-[#B73623]">{statusLabel[offer.status] ?? offer.status}</p><h2 className="mt-1 text-xl font-black">{offer.name}</h2><p className="mt-1 text-sm text-slate-600">{offer.category} · {offer.service_area_label}</p><p className="mt-1 text-sm font-semibold">{offer.price_fcfa == null ? "Tarif à confirmer" : Number(offer.price_fcfa).toLocaleString("fr-FR") + " FCFA"}</p><p className="mt-2 text-sm">Professionnel : <strong>{offer.partners?.name}</strong> · {[offer.partners?.neighborhood, offer.partners?.city].filter(Boolean).join(" · ")}</p><p className="mt-1 text-xs text-slate-500">Statut partenaire : {offer.partners?.status} · Type : {offer.partners?.partner_type}</p>{offer.description && <p className="mt-3 text-sm leading-5 text-slate-600">{offer.description}</p>}</div>
          <div className="flex flex-wrap gap-2">{offer.status !== "active" && <form action={setHomeServiceOfferStatus}><input type="hidden" name="offer_id" value={offer.id}/><input type="hidden" name="status" value="active"/><button disabled={broken} className="min-h-10 rounded-lg bg-emerald-700 px-3 text-sm font-bold text-white disabled:opacity-40">Valider et publier</button></form>}{offer.status !== "draft" && <form action={setHomeServiceOfferStatus}><input type="hidden" name="offer_id" value={offer.id}/><input type="hidden" name="status" value="draft"/><button disabled={broken} className="min-h-10 rounded-lg border px-3 text-sm font-bold disabled:opacity-40">Brouillon</button></form>}{offer.status !== "archived" && <form action={setHomeServiceOfferStatus}><input type="hidden" name="offer_id" value={offer.id}/><input type="hidden" name="status" value="archived"/><button disabled={broken} className="min-h-10 rounded-lg border border-red-300 px-3 text-sm font-bold text-red-800 disabled:opacity-40">Archiver</button></form>}</div>
        </div>
      </article>)}</div>
    </div>
  </main>;
}
