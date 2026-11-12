import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { cancelHomeServiceRequest } from "@/app/prestations/actions";

type RequestReceipt = {
  request_id: string;
  status: string;
  offer_name: string;
  category: string;
  price_fcfa: number | null;
  partner_name: string;
  service_area_label: string;
  preferred_at: string | null;
  created_at: string;
  exact_address: string;
  contact_phone: string;
  client_note: string | null;
};
const labels: Record<string, string> = {
  requested: "En attente de confirmation",
  confirmed: "Confirmée par le professionnel",
  completed: "Terminée",
  cancelled: "Annulée",
  expired: "Expirée",
};
const money = (value: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value) + " FCFA";

export default async function HomeServiceRequestReceipt({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; erreur?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(id)) redirect("/prestations");
  const sb = supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/connexion?retour=/prestations/demande/" + id);
  const { data, error } = await sb.rpc("get_home_service_request_receipt", { p_request_id: id });
  const receipt = ((data ?? []) as unknown as RequestReceipt[])[0];
  if (error || !receipt) return <main className="mx-auto max-w-xl px-4 py-8"><Link href="/prestations" className="font-bold underline">← Prestations à domicile</Link><section className="mt-5 rounded-2xl border bg-white p-5"><h1 className="text-xl font-extrabold">Demande indisponible</h1><p className="mt-2 text-sm text-slate-600">Cette demande n’existe pas ou n’appartient pas à ton compte.</p></section></main>;
  const canCancel = ["requested", "confirmed"].includes(receipt.status);
  return <main className="min-h-screen bg-[#F8FAF9] px-4 pb-12 text-slate-900">
    <div className="mx-auto max-w-xl pt-4">
      <header className="flex items-center justify-between rounded-2xl bg-[#064B2A] px-4 py-3 text-white"><Link href="/" className="font-extrabold">NAXA</Link><Link href="/prestations" className="text-sm font-bold underline">Catalogue</Link></header>
      {query.ok === "annulation" && <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">La demande a été annulée.</p>}
      {query.erreur && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-900">L’action n’a pas abouti. Vérifie le statut avant de réessayer.</p>}
      <p className="mt-5 text-xs font-extrabold uppercase tracking-widest text-[#B73623]">Prestations et soins à domicile</p>
      <h1 className="mt-1 text-2xl font-black">Suivi de ma demande</h1>
      <section className="mt-4 rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm text-slate-500">Statut</p><p className="mt-1 font-extrabold">{labels[receipt.status] ?? receipt.status}</p></div><span className="rounded-full bg-[#FFEFEA] px-3 py-1 text-xs font-bold text-[#9B3527]">Sans paiement en ligne</span></div>
        <h2 className="mt-5 text-lg font-black">{receipt.offer_name}</h2>
        <p className="mt-1 text-sm text-slate-600">{receipt.category} · {receipt.partner_name}</p>
        <p className="mt-3 text-sm">Tarif indicatif : <strong>{receipt.price_fcfa == null ? "À confirmer avec le professionnel" : money(Number(receipt.price_fcfa))}</strong></p>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between gap-3"><dt className="text-slate-500">Zone demandée</dt><dd className="text-right font-semibold">{receipt.service_area_label}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-slate-500">Adresse d’intervention</dt><dd className="text-right font-semibold">{receipt.exact_address}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-slate-500">Téléphone</dt><dd className="text-right font-semibold">{receipt.contact_phone}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-slate-500">Envoyée le</dt><dd className="text-right font-semibold">{new Date(receipt.created_at).toLocaleString("fr-FR")}</dd></div>
          {receipt.preferred_at && <div className="flex justify-between gap-3"><dt className="text-slate-500">Date souhaitée</dt><dd className="text-right font-semibold">{new Date(receipt.preferred_at).toLocaleString("fr-FR")}</dd></div>}
        </dl>
        {receipt.client_note && <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm leading-5">Précisions : {receipt.client_note}</p>}
      </section>
      {canCancel && <form action={cancelHomeServiceRequest} className="mt-4"><input type="hidden" name="request_id" value={receipt.request_id}/><button className="min-h-11 w-full rounded-xl border border-red-300 px-4 py-2 font-bold text-red-800">Annuler la demande</button></form>}
      <p className="mt-4 text-xs leading-5 text-slate-500">L’adresse exacte et le téléphone sont partagés avec le professionnel uniquement après confirmation. NAXA ne collecte aucun paiement.</p>
    </div>
  </main>;
}
