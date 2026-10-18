import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { Logo } from "@/components/Logo";
import { annulerReservationUnivers } from "@/app/univers-actions";

type Item = { product_name: string; unit_price_fcfa: number; quantity: number; line_total_fcfa: number };
type Receipt = {
  reservation_id: string;
  status: string;
  total_fcfa: number;
  pickup_code: string;
  expires_at: string;
  created_at: string;
  partner_name: string;
  universe_slug: string;
  items: Item[];
};
const money = (n: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " FCFA";
const statusText: Record<string, string> = {
  requested: "En attente de confirmation",
  confirmed: "Confirmée par le partenaire",
  ready: "Prête pour le retrait",
  picked_up: "Retirée",
  cancelled: "Annulée",
  expired: "Expirée",
};

export default async function ReservationUniversPage({ params, searchParams }: { params: { id: string }; searchParams: { ok?: string; erreur?: string } }) {
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) redirect("/");
  const sb = supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/connexion?retour=/univers-reservation/" + params.id);
  const { data, error } = await sb.rpc("get_universe_reservation_receipt", { p_reservation_id: params.id });
  const receipt = ((data ?? []) as unknown as Receipt[])[0];
  if (error || !receipt) return <main className="mx-auto max-w-xl px-4 py-8"><Link href="/" className="font-bold underline">← Accueil NAXA</Link><section className="carte mt-5"><h1 className="text-xl font-extrabold">Réservation indisponible</h1><p className="mt-2 text-sm text-slate-600">Le reçu ne peut pas être chargé. Vérifiez que la migration 101 est appliquée et que vous êtes connecté au compte ayant effectué la réservation.</p></section></main>;
  const canCancel = ["requested", "confirmed"].includes(receipt.status) && new Date(receipt.expires_at).getTime() > Date.now();
  const universe = receipt.universe_slug === "bebe-maman" ? "Bébé & Maman" : "Parapharmacie";
  return <main className="mx-auto max-w-xl px-4 pb-12">
    <header className="-mx-4 mb-5 flex items-center justify-between bg-naxa-green-900 px-4 py-3"><Link href="/"><Logo taille={32}/></Link><Link href={"/" + receipt.universe_slug} className="text-sm font-bold text-white underline">Retour au catalogue</Link></header>
    {searchParams.ok && <p role="status" className="mb-3 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">Réservation annulée.</p>}
    {searchParams.erreur && <p role="alert" className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">L’annulation n’a pas abouti. Actualisez le statut avant de réessayer.</p>}
    <p className="text-xs font-extrabold uppercase tracking-widest text-emerald-800">{universe} · Retrait</p><h1 className="mt-1 text-2xl font-black">Mon reçu de réservation</h1>
    <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-sm text-slate-500">Statut</p><p className="mt-1 font-extrabold">{statusText[receipt.status] ?? receipt.status}</p></div><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-900">Sans paiement en ligne</span></div>
      <div className="mt-5 rounded-xl bg-[#E6F7F6] p-4 text-center"><p className="text-xs font-bold uppercase tracking-widest text-[#096A6F]">Code de retrait</p><p className="mt-2 font-mono text-3xl font-black tracking-[0.25em] text-[#064B2A]">{receipt.pickup_code}</p><p className="mt-2 text-xs leading-5 text-slate-700">Présentez ce code au partenaire lorsque la réservation sera marquée « Prête pour le retrait ».</p></div>
      <dl className="mt-4 space-y-2 text-sm"><div className="flex justify-between gap-3"><dt className="text-slate-500">Partenaire</dt><dd className="text-right font-semibold">{receipt.partner_name}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-500">Créée le</dt><dd className="text-right font-semibold">{new Date(receipt.created_at).toLocaleString("fr-FR")}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-500">Valable jusqu’au</dt><dd className="text-right font-semibold">{new Date(receipt.expires_at).toLocaleString("fr-FR")}</dd></div></dl>
    </section>
    <section className="carte mt-4"><h2 className="font-extrabold">Articles réservés</h2><ul className="mt-3 space-y-3">{(receipt.items ?? []).map((item,i)=><li key={i} className="flex justify-between gap-3 border-b border-slate-100 pb-3 last:border-0"><div><p className="font-semibold">{item.product_name}</p><p className="text-sm text-slate-500">{item.quantity} × {money(item.unit_price_fcfa)}</p></div><p className="font-bold">{money(item.line_total_fcfa)}</p></li>)}</ul><div className="mt-3 flex justify-between border-t pt-3"><span className="font-bold">Total indicatif</span><strong>{money(receipt.total_fcfa)}</strong></div></section>
    {canCancel && <form action={annulerReservationUnivers} className="mt-4"><input type="hidden" name="reservation_id" value={receipt.reservation_id}/><button className="min-h-11 w-full rounded-xl border border-red-300 px-4 py-2 font-bold text-red-800">Annuler la réservation</button></form>}
    <p className="mt-4 text-xs leading-5 text-slate-500">Le total est un récapitulatif de la réservation, pas un reçu de paiement. Ne vous déplacez qu’après confirmation de la disponibilité par le partenaire.</p>
  </main>;
}
