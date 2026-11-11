import Link from "next/link";
import { supabasePublic } from "@/lib/supabase/server";
import { UniverseLanding } from "@/components/universes/UniverseLanding";
import { requestHomeService } from "./actions";

type HomeServiceOffer = {
  offer_id: string;
  partner_id: string;
  partner_name: string;
  city: string | null;
  neighborhood: string | null;
  name: string;
  category: string;
  description: string | null;
  service_area_label: string;
  price_fcfa: number | null;
};

const field = "mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900";
const money = (value: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value) + " FCFA";

export default async function PrestationsPage({ searchParams }: { searchParams: { erreur?: string; q?: string; categorie?: string; tri?: string } }) {
  const { data, error } = await supabasePublic(30).rpc("get_home_service_catalog", {});
  if (error) {
    return <><UniverseLanding universe="prestations"/><p role="status" className="mx-auto mt-3 max-w-3xl rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">Le catalogue des prestations est temporairement indisponible. Réessayez dans quelques instants.</p></>;
  }
  const offers = (data ?? []) as HomeServiceOffer[];
  if (!offers.length) return <><UniverseLanding universe="prestations"/><section className="mx-auto mt-4 max-w-3xl px-4 pb-8"><div className="rounded-2xl border border-[#FAD0C6] bg-white p-5"><h2 className="font-extrabold text-slate-900">Aucune prestation publiée pour le moment</h2><p className="mt-2 text-sm leading-6 text-slate-600">Les professionnels partenaires n’ont pas encore publié d’offre disponible. Revenez un peu plus tard pour consulter le catalogue.</p></div></section></>;
  const query = (searchParams.q ?? "").trim().toLocaleLowerCase("fr");
  const categories = [...new Set(offers.map((offer) => offer.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr"));
  const filteredOffers = offers.filter((offer) => {
    const haystack = [offer.name, offer.category, offer.description ?? "", offer.partner_name, offer.city ?? "", offer.neighborhood ?? "", offer.service_area_label].join(" ").toLocaleLowerCase("fr");
    return (!query || haystack.includes(query)) && (!searchParams.categorie || offer.category === searchParams.categorie);
  }).sort((a, b) => {
    if (searchParams.tri === "prix-croissant") return (a.price_fcfa ?? Number.MAX_SAFE_INTEGER) - (b.price_fcfa ?? Number.MAX_SAFE_INTEGER);
    if (searchParams.tri === "prix-decroissant") return (b.price_fcfa ?? -1) - (a.price_fcfa ?? -1);
    if (searchParams.tri === "nom") return a.name.localeCompare(b.name, "fr");
    return 0;
  });

  return <main className="min-h-screen bg-[#F8FAF9] px-4 pb-12 text-[#1F2937]">
    <div className="mx-auto max-w-6xl pt-4">
      <section className="rounded-3xl border border-[#FAD0C6] bg-[#FFEFEA] p-6 sm:p-8">
        <p className="text-xs font-extrabold uppercase tracking-widest text-[#D4402B]">NAXA · Services de proximité</p>
        <h1 className="mt-2 text-3xl font-black sm:text-4xl">Prestations et soins à domicile</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-700">Découvrez les services publiés par les professionnels partenaires. Envoyez une demande, puis attendez la confirmation du professionnel avant de vous organiser.</p>
        <p className="mt-3 text-sm font-bold">{filteredOffers.length} prestation(s) affichée(s) sur {offers.length}</p>
      </section>
      {searchParams.erreur && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">{searchParams.erreur === "validation" ? "Vérifiez les informations, l’adresse, le téléphone et la date souhaitée." : searchParams.erreur === "annulation" ? "L’annulation n’a pas abouti. Vérifiez le statut de la demande." : "La demande n’a pas pu être envoyée. Le service peut être indisponible."}</p>}
      <form method="get" className="mt-5 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4" role="search" aria-label="Filtrer les prestations">
        <label className="text-sm font-semibold lg:col-span-2">Rechercher<input className={field} name="q" defaultValue={searchParams.q ?? ""} placeholder="Service, professionnel, quartier…"/></label>
        <label className="text-sm font-semibold">Catégorie<select className={field} name="categorie" defaultValue={searchParams.categorie ?? ""}><option value="">Toutes les catégories</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
        <label className="text-sm font-semibold">Trier par<select className={field} name="tri" defaultValue={searchParams.tri ?? "pertinence"}><option value="pertinence">Pertinence</option><option value="nom">Nom</option><option value="prix-croissant">Prix croissant</option><option value="prix-decroissant">Prix décroissant</option></select></label>
        <div className="flex gap-2 sm:col-span-2 lg:col-span-4"><button className="min-h-11 rounded-xl bg-[#D4402B] px-4 font-bold text-white">Appliquer</button><Link href="/prestations" className="inline-flex min-h-11 items-center rounded-xl border px-4 font-bold">Réinitialiser</Link></div>
      </form>
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        {filteredOffers.map((offer) => <article key={offer.offer_id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="bg-[#FFF8F5] p-5">
            <p className="text-xs font-extrabold uppercase tracking-wide text-[#D4402B]">{offer.category}</p>
            <h2 className="mt-1 text-xl font-black">{offer.name}</h2>
            {offer.description && <p className="mt-2 text-sm leading-6 text-slate-600">{offer.description}</p>}
            <p className="mt-3 text-sm font-semibold">{offer.partner_name}</p>
            <p className="text-sm text-slate-600">{[offer.neighborhood, offer.city].filter(Boolean).join(" · ") || "Zone communiquée par le professionnel"}</p>
            <p className="mt-2 text-sm text-slate-700">Zone d’intervention : <strong>{offer.service_area_label}</strong></p>
            <p className="mt-3 text-lg font-black">{offer.price_fcfa == null ? "Tarif à confirmer" : money(Number(offer.price_fcfa))}</p>
          </div>
          <form action={requestHomeService} className="space-y-3 p-5">
            <input type="hidden" name="offer_id" value={offer.offer_id}/>
            <h3 className="font-extrabold">Demander cette prestation</h3>
            <label className="block text-sm font-semibold">Quartier ou zone souhaitée<input className={field} name="area_label" required minLength={2} maxLength={180} placeholder="Ex. Bastos, Yaoundé"/></label>
            <label className="block text-sm font-semibold">Adresse exacte<input className={field} name="exact_address" required minLength={5} maxLength={500} autoComplete="street-address" placeholder="Adresse complète pour l’intervention"/></label>
            <label className="block text-sm font-semibold">Téléphone de contact<input className={field} name="contact_phone" type="tel" required minLength={7} maxLength={40} autoComplete="tel" placeholder="+237…"/></label>
            <label className="block text-sm font-semibold">Date et heure souhaitées (facultatif)<input className={field} name="preferred_at" type="datetime-local"/></label>
            <label className="block text-sm font-semibold">Précisions utiles (facultatif)<textarea className={field} name="client_note" maxLength={500} rows={3} placeholder="Informations pratiques nécessaires à la demande"/></label>
            <p className="rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600">Confidentialité : l’adresse exacte et le téléphone ne sont accessibles au professionnel qu’après confirmation de la demande. NAXA ne collecte aucun paiement pour cette demande.</p>
            <button className="min-h-11 w-full rounded-xl bg-[#D4402B] px-4 py-3 font-bold text-white">Envoyer la demande</button>
          </form>
        </article>)}
        {filteredOffers.length === 0 && <p className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600 lg:col-span-2">Aucune prestation ne correspond à ces filtres. Modifiez la recherche ou réinitialisez les filtres.</p>}
      </div>
      <p className="mt-6 rounded-xl border border-slate-200 bg-white p-4 text-xs leading-5 text-slate-600">NAXA transmet une demande de réservation et ne fournit aucun diagnostic médical. La prestation est soumise à la confirmation du professionnel partenaire.</p>
    </div>
  </main>;
}
