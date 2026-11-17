import Link from "next/link";
import { requireAdminActive } from "@/lib/admin/require-admin-active";
import { confirmerReglementPartenaire, refuserReglementPartenaire } from "./actions";

type Payment = {
  id: string;
  partner_id: string;
  partner_name: string;
  universe_slug: string;
  owner_name: string | null;
  amount_fcfa: number;
  canal: string;
  payer_account: string;
  transaction_reference: string;
  paid_at: string;
  proof_path: string | null;
  status: string;
  submitted_at: string;
};

const money = (value: number) => new Intl.NumberFormat("fr-FR").format(value) + " FCFA";
const date = (value: string) => new Date(value).toLocaleString("fr-FR", { timeZone: "Africa/Douala" });

export default async function AdminPartnerSubscriptionsPage({
  searchParams,
}: {
  searchParams?: Promise<{ ok?: string; erreur?: string }>;
}) {
  const { sb } = await requireAdminActive("/admin/abonnements-partenaires");
  const { data, error } = await sb.rpc("admin_lister_reglements_partenaires", { p_status: "pending" });
  const payments = (data ?? []) as Payment[];
  const params = searchParams ? await searchParams : {};

  return (
    <main className="min-h-dvh bg-slate-50 px-4 py-6 text-slate-900">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="rounded-3xl bg-slate-950 p-5 text-white sm:p-7">
          <Link href="/admin" className="text-sm font-semibold text-white/75 underline">Retour Administration</Link>
          <p className="mt-4 text-xs font-extrabold uppercase tracking-widest text-white/65">Contrôle des encaissements</p>
          <h1 className="mt-2 text-2xl font-black sm:text-3xl">Règlements d’abonnements partenaires</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/80">
            Chaque paiement est rattaché à une seule structure. Confirmez uniquement après vérification indépendante de l’encaissement sur le compte marchand NAXA.
          </p>
        </header>

        {params.ok === "confirme" && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">Règlement confirmé ; le cycle de cette structure a démarré ou a été prolongé.</p>}
        {params.ok === "refuse" && <p role="status" className="rounded-xl bg-slate-100 p-3 text-sm">Règlement refusé. Aucun cycle n’a été créé ou renouvelé.</p>}
        {params.erreur && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm">Décision non enregistrée. Vérifiez les informations et réessayez.</p>}
        {error && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm">File de règlements indisponible. Vérifiez la migration et les droits administrateur.</p>}
        {!payments.length && !error && <p className="rounded-2xl bg-white p-5 text-sm shadow-sm">Aucun règlement partenaire en attente.</p>}

        {payments.map((payment) => (
          <section key={payment.id} className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{payment.universe_slug}</p>
                <h2 className="text-xl font-extrabold">{payment.partner_name}</h2>
                <p className="text-sm text-slate-600">Titulaire : {payment.owner_name ?? "—"}</p>
              </div>
              <strong className="text-lg">{money(payment.amount_fcfa)}</strong>
            </div>
            <dl className="grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm sm:grid-cols-2">
              <div><dt className="text-slate-500">Canal</dt><dd className="font-semibold">{payment.canal === "mtn_momo" ? "MTN Mobile Money" : "Orange Money"}</dd></div>
              <div><dt className="text-slate-500">Compte payeur déclaré</dt><dd className="font-semibold">{payment.payer_account}</dd></div>
              <div><dt className="text-slate-500">Référence</dt><dd className="font-semibold">{payment.transaction_reference}</dd></div>
              <div><dt className="text-slate-500">Date déclarée</dt><dd className="font-semibold">{date(payment.paid_at)}</dd></div>
              <div><dt className="text-slate-500">Soumis le</dt><dd className="font-semibold">{date(payment.submitted_at)}</dd></div>
              {payment.proof_path && <div><dt className="text-slate-500">Chemin de pièce</dt><dd className="break-all font-semibold">{payment.proof_path}</dd></div>}
            </dl>
            <div className="grid gap-3 lg:grid-cols-2">
              <form action={confirmerReglementPartenaire} className="space-y-3 rounded-2xl border border-emerald-200 p-4">
                <input type="hidden" name="reglement_id" value={payment.id}/>
                <label className="flex items-start gap-3 text-sm font-semibold">
                  <input type="checkbox" name="encaissement_verifie" required className="mt-1 h-4 w-4"/>
                  J’ai vérifié l’encaissement réel sur le compte marchand NAXA et la concordance du montant et de la référence.
                </label>
                <button className="min-h-11 w-full rounded-xl bg-emerald-800 px-4 font-bold text-white">Confirmer le paiement</button>
              </form>
              <form action={refuserReglementPartenaire} className="space-y-3 rounded-2xl border border-rose-200 p-4">
                <input type="hidden" name="reglement_id" value={payment.id}/>
                <label className="block text-sm font-semibold">Motif du refus
                  <textarea name="motif" required minLength={5} maxLength={500} rows={3} className="champ mt-1" placeholder="Écart de montant, référence introuvable…"/>
                </label>
                <button className="min-h-11 w-full rounded-xl bg-rose-700 px-4 font-bold text-white">Refuser le règlement</button>
              </form>
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
