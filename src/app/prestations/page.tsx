import Link from "next/link";
import { supabasePublic } from "@/lib/supabase/server";
import { UniverseLanding } from "@/components/universes/UniverseLanding";
import { PrestationsCatalogue } from "@/components/prestations/PrestationsCatalogue";

type HomeServiceOffer = {
  offer_id: string; partner_id: string; partner_name: string; city: string | null;
  neighborhood: string | null; name: string; category: string; description: string | null;
  service_area_label: string; price_fcfa: number | null;
  specialty: string | null;
  available_today: boolean;
  available_now: boolean;
  today_opens_at: string | null;
  today_closes_at: string | null;
};
type SearchParams = { erreur?: string; q?: string; mode?: string; origine?: string };

export default async function PrestationsPage({ searchParams }: { searchParams: SearchParams }) {
  const { data, error } = await supabasePublic(30).rpc("get_home_service_catalog_for_client", {});
  if (error) return <><UniverseLanding universe="prestations"/><p role="status" className="mx-auto mt-3 max-w-3xl rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">Le catalogue des prestations est temporairement indisponible. Réessayez dans quelques instants.</p></>;
  const offers = (data ?? []) as HomeServiceOffer[];
  if (!offers.length) return <><UniverseLanding universe="prestations"/><section className="mx-auto mt-4 max-w-3xl px-4 pb-8"><div className="rounded-2xl border border-[#FAD0C6] bg-white p-5"><h2 className="font-extrabold text-slate-900">Aucune prestation publiée pour le moment</h2><p className="mt-2 text-sm leading-6 text-slate-600">Les professionnels partenaires n’ont pas encore publié d’offre disponible. Revenez un peu plus tard pour consulter le catalogue.</p><Link href="/suivi" className="mt-3 inline-flex min-h-10 items-center font-bold text-[#B73623] underline">Revenir à mes dispositifs connectés</Link></div></section></>;
  const assistanceMode = searchParams.mode === "assistance" && searchParams.origine === "dispositifs-connectes";
  return <main className="min-h-screen bg-[#F8FAF9] px-4 pb-12 text-[#1F2937]"><div className="mx-auto max-w-6xl pt-4">
    <section className="relative isolate overflow-hidden rounded-3xl border border-[#FAD0C6] p-6 text-white shadow-sm sm:p-8" style={{backgroundImage:'linear-gradient(90deg, #A83C2DF0 0%, #A83C2DD9 62%, #A83C2D99 100%), url("/images/ecosystemes/ecosystemes.webp")',backgroundSize:"100% 100%, 300% 200%",backgroundPosition:"center, 0% 100%"}}>
      <span className="inline-flex rounded-full bg-white/80 px-3 py-1.5 text-xs font-extrabold text-[#9B3527]">Demande sans paiement en ligne</span>
      <p className="mt-3 text-xs font-extrabold uppercase tracking-widest text-white/90">NAXA · Services et accompagnement</p>
      <h1 className="mt-2 text-3xl font-black sm:text-4xl">Soins à domicile</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-white/95">Services et accompagnement à domicile auprès des professionnels partenaires. Envoyez une demande, puis attendez la confirmation du professionnel avant de vous organiser.</p>
      <p className="mt-3 text-sm font-bold text-white">{offers.length} prestation(s) publiée(s)</p>
    </section>
    {searchParams.erreur && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">{searchParams.erreur === "validation" ? "Vérifiez les informations, l’adresse, le téléphone, la position partagée et la date souhaitée." : searchParams.erreur === "annulation" ? "L’annulation n’a pas abouti. Vérifiez le statut de la demande." : "La demande n’a pas pu être envoyée. Le service peut être indisponible."}</p>}
    <PrestationsCatalogue offers={offers} initialQuery={searchParams.q ?? ""} assistanceMode={assistanceMode}/>
    <p className="mt-6 rounded-xl border border-slate-200 bg-white p-4 text-xs leading-5 text-slate-600">NAXA transmet une demande de réservation et ne fournit aucun diagnostic médical. La prestation est soumise à la confirmation du professionnel partenaire. La distance de proximité est indicative (à vol d’oiseau), pas un temps de trajet.</p>
  </div></main>;
}
