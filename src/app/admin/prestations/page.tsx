import Link from "next/link";
import { requireAdminActive } from "@/lib/admin/require-admin-active";
import { setHomeServiceOfferStatus, setAdminHomeServicePartnerLocation } from "./actions";
import { BoutonNotifications } from "@/components/BoutonNotifications";
import { GeolocalisationChamps } from "@/components/admin/GeolocalisationChamps";

const statusLabel: Record<string, string> = { draft: "Brouillon", active: "Publié", archived: "Archivé" };

export default async function AdminHomeServices({ searchParams }: { searchParams: Promise<{ ok?: string; erreur?: string; q?: string; statut?: string }> }) {
  const filters = await searchParams;
  const { sb } = await requireAdminActive("/admin/prestations");

  const [offersResult, partnerLocationsResult] = await Promise.all([
    sb.from("home_service_offers")
    .select("id,partner_id,name,category,description,service_area_label,price_fcfa,status,created_at,partners!inner(name,city,neighborhood,status,partner_type)")
    .order("created_at", { ascending: false }).limit(300),
    sb.from("partners").select("id,name,city,neighborhood,status,latitude,longitude,provider_latitude,provider_longitude,provider_location_updated_at")
      .eq("partner_type","professionnel_domicile").order("created_at",{ascending:false}).limit(300)
  ]);
  const offers = offersResult.data;
  const error = offersResult.error;
  const locationError = partnerLocationsResult.error;
  const partnerLocations = partnerLocationsResult.data ?? [];
  const allOffers = offers ?? [];
  const query = (filters.q ?? "").trim().toLocaleLowerCase("fr");
  const filteredOffers = allOffers.filter((offer: any) =>
    (!filters.statut || offer.status === filters.statut) &&
    (!query || [offer.name, offer.category, offer.description ?? "", offer.service_area_label, offer.partners?.name ?? "", offer.partners?.city ?? "", offer.partners?.neighborhood ?? ""].join(" ").toLocaleLowerCase("fr").includes(query))
  );
  const colonnes = [{ key: "draft", label: "À examiner", items: filteredOffers.filter((offer: any) => offer.status === "draft") }, { key: "active", label: "Publiées", items: filteredOffers.filter((offer: any) => offer.status === "active") }, { key: "archived", label: "Archivées", items: filteredOffers.filter((offer: any) => offer.status === "archived") }];
  const broken = !!error;
  return <main className="min-h-screen bg-[#F8FAF9] px-4 pb-12 text-slate-900">
    <div className="mx-auto max-w-5xl space-y-5 pt-4">
      <header className="flex items-center justify-between gap-3 rounded-2xl bg-[#064B2A] px-4 py-3 text-white"><strong>NAXA · Administration</strong><nav className="flex items-center gap-3"><BoutonNotifications/><Link href="/admin/prestations/demandes" className="font-bold underline">Demandes clients</Link><Link href="/admin/univers" className="font-bold underline">Univers et partenaires</Link></nav></header>
      <div><p className="text-xs font-extrabold uppercase tracking-widest text-[#B73623]">NAXA · Validation des offres</p><h1 className="mt-1 text-3xl font-black">Prestations et soins à domicile</h1><p className="mt-2 text-sm leading-6 text-slate-600">Une offre ne peut être publiée que si le professionnel, son association à l’univers Prestations et les drapeaux de l’univers sont actifs. La validation ne remplace pas la vérification réelle des justificatifs du professionnel.</p></div>
      {filters.ok && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">{filters.ok === "position" ? "Position administrative de référence enregistrée." : filters.ok === "active" ? "Prestation publiée." : filters.ok === "archived" ? "Prestation archivée." : "Prestation remise en brouillon."}</p>}
      {filters.erreur && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-900">{filters.erreur === "position" ? "La position administrative n’a pas été enregistrée. Vérifiez les coordonnées et le partenaire." : "Action refusée. Vérifie le statut du partenaire, l’association à l’univers et les activations."}</p>}
      {broken && <p role="status" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-950">Le catalogue des prestations est temporairement indisponible. Les actions restent désactivées jusqu’au retour des données.</p>}
      {!broken && !allOffers.length && <p className="rounded-2xl border bg-white p-5 text-sm text-slate-600">Aucune prestation soumise à validation.</p>}
      <section className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
        <div><p className="text-xs font-extrabold uppercase tracking-wider text-emerald-800">Référentiel GPS des partenaires</p><h2 className="mt-1 text-xl font-black">Position administrative de référence</h2><p className="mt-1 text-sm leading-6 text-slate-600">Vous pouvez créer ou corriger ici la position de référence. La position définie ensuite par le professionnel depuis son tableau de bord reste prioritaire pour les recherches client.</p></div>
        {locationError?<p role="alert" className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-950">Impossible de charger les partenaires pour la gestion de leurs positions.</p>:!partnerLocations.length?<p className="mt-3 text-sm text-slate-600">Aucun partenaire Prestations à domicile enregistré.</p>:<div className="mt-4 space-y-3">{partnerLocations.map((partner:any)=>{
          const own=partner.provider_latitude!=null&&partner.provider_longitude!=null;
          return <article key={partner.id} className="rounded-xl border p-4">
            <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-extrabold">{partner.name}</h3><p className="mt-1 text-xs text-slate-500">{[partner.neighborhood,partner.city].filter(Boolean).join(" · ")} · {partner.status}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{own?"Position professionnelle prioritaire":"Position administrative active"}</span></div>
            {partner.latitude!=null&&partner.longitude!=null&&<p className="mt-2 text-xs text-slate-600">Référence admin : {Number(partner.latitude).toFixed(6)} · {Number(partner.longitude).toFixed(6)}</p>}
            {own&&<p className="mt-1 text-xs font-semibold text-emerald-800">Le système utilise actuellement le point professionnel : {Number(partner.provider_latitude).toFixed(6)} · {Number(partner.provider_longitude).toFixed(6)}</p>}
            <form action={setAdminHomeServicePartnerLocation} className="mt-3 space-y-3">
              <input type="hidden" name="partner_id" value={partner.id}/>
              <GeolocalisationChamps className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm" initialLatitude={partner.latitude==null?null:Number(partner.latitude)} initialLongitude={partner.longitude==null?null:Number(partner.longitude)}/>
              <button disabled={locationError} className="min-h-10 rounded-xl bg-[#064B2A] px-4 text-sm font-bold text-white disabled:opacity-40">Enregistrer la position de référence</button>
            </form>
          </article>;
        })}</div>}
      </section>

      {!broken && allOffers.length > 0 && <form method="get" role="search" aria-label="Rechercher les prestations à valider" className="grid gap-3 rounded-2xl border bg-white p-4 sm:grid-cols-[1fr_220px_auto_auto]">
        <label className="text-sm font-semibold">Rechercher<input name="q" defaultValue={filters.q ?? ""} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3" placeholder="Offre, professionnel, zone…"/></label>
        <label className="text-sm font-semibold">Statut<select name="statut" defaultValue={filters.statut ?? ""} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3"><option value="">Tous les statuts</option><option value="draft">Brouillon</option><option value="active">Publié</option><option value="archived">Archivé</option></select></label>
        <button className="min-h-11 self-end rounded-xl bg-[#064B2A] px-4 font-bold text-white">Filtrer</button><Link href="/admin/prestations" className="inline-flex min-h-11 items-center self-end rounded-xl border px-4 font-bold">Réinitialiser</Link>
      </form>}
      {!broken && allOffers.length > 0 && <p className="text-sm font-semibold text-slate-600">{filteredOffers.length} offre(s) affichée(s) sur {allOffers.length}</p>}
      {!broken && filteredOffers.length === 0 && allOffers.length > 0 && <p className="rounded-2xl border bg-white p-5 text-sm text-slate-600">Aucune offre ne correspond aux filtres.</p>}
      <div className="admin-kanban admin-kanban-services" aria-label="Prestations par statut">{colonnes.map(colonne=><section key={colonne.key} className="admin-kanban-column"><header className="admin-kanban-column-header"><div><h2>{colonne.label}</h2><p>État de publication</p></div><span>{colonne.items.length}</span></header><div className="admin-kanban-cards">{colonne.items.map((offer: any) => <article key={offer.id} className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-extrabold uppercase tracking-wide text-[#B73623]">{statusLabel[offer.status] ?? offer.status}</p><h2 className="mt-1 text-xl font-black">{offer.name}</h2><p className="mt-1 text-sm text-slate-600">{offer.category} · {offer.service_area_label}</p><p className="mt-1 text-sm font-semibold">{offer.price_fcfa == null ? "Tarif à confirmer" : Number(offer.price_fcfa).toLocaleString("fr-FR") + " FCFA"}</p><p className="mt-2 text-sm">Professionnel : <strong>{offer.partners?.name}</strong> · {[offer.partners?.neighborhood, offer.partners?.city].filter(Boolean).join(" · ")}</p><p className="mt-1 text-xs text-slate-500">Statut partenaire : {offer.partners?.status} · Type : {offer.partners?.partner_type}</p>{offer.description && <p className="mt-3 text-sm leading-5 text-slate-600">{offer.description}</p>}</div>
          <div className="flex flex-wrap gap-2">{offer.status !== "active" && <form action={setHomeServiceOfferStatus}><input type="hidden" name="offer_id" value={offer.id}/><input type="hidden" name="status" value="active"/><button disabled={broken} className="min-h-10 rounded-lg bg-emerald-700 px-3 text-sm font-bold text-white disabled:opacity-40">Valider et publier</button></form>}{offer.status !== "draft" && <form action={setHomeServiceOfferStatus}><input type="hidden" name="offer_id" value={offer.id}/><input type="hidden" name="status" value="draft"/><button disabled={broken} className="min-h-10 rounded-lg border px-3 text-sm font-bold disabled:opacity-40">Brouillon</button></form>}{offer.status !== "archived" && <form action={setHomeServiceOfferStatus}><input type="hidden" name="offer_id" value={offer.id}/><input type="hidden" name="status" value="archived"/><button disabled={broken} className="min-h-10 rounded-lg border border-red-300 px-3 text-sm font-bold text-red-800 disabled:opacity-40">Archiver</button></form>}</div>
        </div>
      </article>)}</div></section>)}</div>
    </div>
  </main>;
}
