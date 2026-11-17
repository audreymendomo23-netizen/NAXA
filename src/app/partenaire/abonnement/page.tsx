import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { soumettreReglementAbonnementPartenaire } from "./actions";

type Payment = {
  id: string;
  amount_fcfa: number;
  canal: string;
  transaction_reference: string;
  paid_at: string;
  status: string;
  confirmed_at: string | null;
  refusal_reason: string | null;
  period_start: string | null;
  period_end: string | null;
  receipt_number: string | null;
};

type SubscriptionData = {
  partner_id: string;
  partner_name: string;
  universe_slug: string;
  monthly_fee_fcfa: number;
  dossier_status: string;
  subscription: {
    status: string;
    period_start: string | null;
    due_date: string | null;
    first_confirmed_payment_at: string | null;
    legacy_access_until: string | null;
  };
  destinations: Array<{
    canal: string;
    beneficiaire: string;
    reference_destination: string;
    instructions: string | null;
  }>;
  payments: Payment[];
};

const money = (value: number) => new Intl.NumberFormat("fr-FR").format(value) + " FCFA";
const date = (value?: string | null) => value
  ? new Date(value.length === 10 ? value + "T12:00:00+01:00" : value).toLocaleDateString("fr-FR", { timeZone: "Africa/Douala" })
  : "—";
const statusLabel = (value: string) => ({
  pending_payment: "En attente du premier paiement",
  active: "Abonnement actif",
  expired: "Échu — renouvellement requis",
  cancelled: "Résilié",
  pending: "En attente de vérification",
  confirmed: "Confirmé",
  refused: "Refusé",
} as Record<string, string>)[value] ?? value;

export default async function PartnerSubscriptionPage({
  searchParams,
}: {
  searchParams?: Promise<{ ok?: string; erreur?: string }>;
}) {
  const sb = supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/connexion?retour=/partenaire/abonnement");

  const { data: memberships, error: membershipError } = await sb.from("partner_members")
    .select("partner_id,member_role")
    .eq("user_id", auth.user.id)
    .eq("member_role", "owner");

  const owners = memberships ?? [];
  const records = await Promise.all(owners.map(async (membership: any) => {
    const { data, error } = await sb.rpc("partner_lire_abonnement", { p_partner_id: membership.partner_id });
    return error ? null : data as SubscriptionData;
  }));
  const subscriptions = records.filter((item): item is SubscriptionData => Boolean(item));
  const params = searchParams ? await searchParams : {};
  const nowLocal = new Date().toLocaleString("sv-SE", {
    timeZone: "Africa/Douala", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).replace(" ", "T").slice(0, 16);

  return (
    <main className="min-h-dvh bg-slate-50 px-4 py-6 text-slate-900">
      <div className="mx-auto max-w-5xl space-y-5">
        <header className="rounded-3xl bg-naxa-green-900 p-5 text-white sm:p-7">
          <Link href="/" className="text-sm font-semibold text-white/80 underline">Retour à NAXA</Link>
          <p className="mt-4 text-xs font-extrabold uppercase tracking-widest text-white/70">Contrats partenaires</p>
          <h1 className="mt-2 text-2xl font-black sm:text-3xl">Abonnements de vos structures</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/85">
            Chaque structure règle son propre abonnement. Une déclaration de paiement reste en attente :
            le cycle ne commence qu’après confirmation effective par NAXA.
          </p>
        </header>

        {params.ok === "transmis" && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">Déclaration transmise. Votre abonnement n’est pas encore renouvelé.</p>}
        {params.erreur && <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">La déclaration n’a pas pu être enregistrée. Vérifiez les champs, la référence et le statut de votre dossier.</p>}
        {membershipError && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm">Impossible de charger les structures rattachées à votre compte.</p>}
        {!subscriptions.length && <p className="rounded-2xl bg-white p-5 text-sm shadow-sm">Aucun contrat de Parapharmacie, Examens médicaux ou Prestations à domicile accessible pour ce compte titulaire.</p>}

        {subscriptions.map((item) => {
          const sub = item.subscription;
          const pending = item.payments.some((payment) => payment.status === "pending");
          return (
            <section key={item.partner_id} className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{item.universe_slug}</p>
                  <h2 className="text-xl font-extrabold">{item.partner_name}</h2>
                  <p className="mt-1 text-sm text-slate-600">Tarif contractuel : <strong>{money(item.monthly_fee_fcfa)}</strong></p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{sub.first_confirmed_payment_at === null && sub.legacy_access_until ? "Accès historique conservé" : statusLabel(sub.status)}</span>
              </div>

              <div className="grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm sm:grid-cols-3">
                <div><p className="text-slate-500">Début du cycle</p><strong>{date(sub.period_start)}</strong></div>
                <div><p className="text-slate-500">Prochaine échéance</p><strong>{date(sub.due_date)}</strong></div>
                <div><p className="text-slate-500">Accès historique conservé jusqu’au</p><strong>{date(sub.legacy_access_until)}</strong></div>
              </div>

              {item.destinations.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-bold">Coordonnées de paiement NAXA</h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {item.destinations.map((destination) => (
                      <div key={destination.canal} className="rounded-xl border border-slate-200 p-3 text-sm">
                        <p className="font-bold">{destination.canal === "mtn_momo" ? "MTN Mobile Money" : "Orange Money"}</p>
                        <p>Bénéficiaire : {destination.beneficiaire}</p>
                        <p>Référence / numéro : {destination.reference_destination}</p>
                        {destination.instructions && <p className="mt-1 text-slate-600">{destination.instructions}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {item.dossier_status !== "validated" ? (
                <p className="rounded-xl bg-amber-50 p-3 text-sm">Le dossier doit être validé avant de soumettre un règlement d’abonnement.</p>
              ) : pending ? (
                <p className="rounded-xl bg-amber-50 p-3 text-sm">Un règlement est déjà en attente de vérification pour cette structure. Aucun second règlement ne peut être soumis.</p>
              ) : item.destinations.length === 0 ? (
                <p className="rounded-xl bg-amber-50 p-3 text-sm">Les coordonnées de paiement NAXA ne sont pas configurées. La déclaration est temporairement indisponible.</p>
              ) : (
                <form action={soumettreReglementAbonnementPartenaire} className="grid gap-3 rounded-2xl border border-slate-200 p-4 sm:grid-cols-2">
                  <input type="hidden" name="partner_id" value={item.partner_id}/>
                  <input type="hidden" name="amount_fcfa" value={item.monthly_fee_fcfa}/>
                  <div className="sm:col-span-2">
                    <h3 className="font-bold">Déclarer le paiement de cette structure</h3>
                    <p className="text-xs text-slate-500">Montant généré depuis le contrat : {money(item.monthly_fee_fcfa)}. NAXA vérifiera l’encaissement avant d’activer le cycle.</p>
                  </div>
                  <label className="text-sm font-semibold">Canal
                    <select name="canal" required className="champ mt-1">
                      <option value="mtn_momo">MTN Mobile Money</option>
                      <option value="orange_money">Orange Money</option>
                    </select>
                  </label>
                  <label className="text-sm font-semibold">Compte payeur
                    <input name="payer_account" required minLength={3} maxLength={120} className="champ mt-1" placeholder="Numéro ayant effectué le paiement"/>
                  </label>
                  <label className="text-sm font-semibold">Référence de transaction
                    <input name="transaction_reference" required minLength={5} maxLength={160} className="champ mt-1"/>
                  </label>
                  <label className="text-sm font-semibold">Date et heure du paiement (heure du Cameroun)
                    <input name="paid_at" type="datetime-local" required defaultValue={nowLocal} className="champ mt-1"/>
                  </label>
                  <div className="sm:col-span-2">
                    <button className="min-h-11 w-full rounded-xl bg-naxa-green-900 px-4 font-bold text-white">Transmettre à NAXA pour vérification</button>
                  </div>
                </form>
              )}

              {item.payments.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-bold">Historique des règlements</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[620px] text-left text-sm">
                      <thead><tr className="border-b text-slate-500"><th className="p-2">Date déclarée</th><th className="p-2">Montant</th><th className="p-2">Référence</th><th className="p-2">Statut</th><th className="p-2">Reçu / période</th></tr></thead>
                      <tbody>{item.payments.map((payment) => (
                        <tr key={payment.id} className="border-b last:border-0">
                          <td className="p-2">{date(payment.paid_at)}</td>
                          <td className="p-2">{money(payment.amount_fcfa)}</td>
                          <td className="p-2">{payment.transaction_reference}</td>
                          <td className="p-2">{statusLabel(payment.status)}{payment.refusal_reason && <p className="text-xs text-red-700">{payment.refusal_reason}</p>}</td>
                          <td className="p-2">{payment.receipt_number ?? "—"}{payment.period_start && <p className="text-xs text-slate-500">{date(payment.period_start)} → {date(payment.period_end)}</p>}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </main>
  );
}
