import Link from "next/link";
import { CreditRepaymentReceipts } from "@/components/CreditRepaymentReceipts";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

type CreditRequest = {
  id: string;
  pharmacie_id: string;
  montant: number;
  statut: string;
  created_at: string;
  date_remboursement: string | null;
  reservation_id: string | null;
  vente_id: string | null;
  origine: string;
};
type CreditAccount = {
  id: string;
  pharmacie_id: string;
  plafond: number;
  solde: number;
  actif: boolean;
  updated_at: string;
};
type CreditOperation = {
  id: string;
  credit_id: string;
  pharmacie_id: string;
  vente_id: string | null;
  nature: string;
  montant: number;
  reference: string | null;
  motif: string | null;
  created_at: string;
  mode_paiement: string | null;
};
type Repayment = {
  id: string;
  credit_id: string;
  pharmacie_id: string;
  montant: number;
  reference: string | null;
  motif: string | null;
  mode_paiement: string | null;
  created_at: string;
};

const labels: Record<string, string> = {
  en_attente: "En attente de décision",
  approuvee: "Crédit approuvé",
  rejetee: "Demande refusée",
};
const fcfa = (value: number) => Number(value || 0).toLocaleString("fr-FR") + " FCFA";

export default async function SuiviCreditMarketplacePage() {
  const sb = supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/connexion?retour=/achats/credit/suivi");

  const [
    { data: requestData, error: requestError },
    { data: accountData, error: accountError },
    { data: operationData, error: operationError },
  ] = await Promise.all([
    sb.from("client_credit_requests")
      .select("id,pharmacie_id,montant,statut,created_at,date_remboursement,reservation_id,vente_id,origine")
      .eq("client_id", auth.user.id)
      .in("origine", ["marketplace", "caisse"])
      .order("created_at", { ascending: false })
      .limit(100),
    sb.from("client_credits")
      .select("id,pharmacie_id,plafond,solde,actif,updated_at")
      .eq("client_id", auth.user.id)
      .order("updated_at", { ascending: false })
      .limit(100),
    sb.from("client_credit_operations")
      .select("id,credit_id,pharmacie_id,vente_id,nature,montant,reference,motif,created_at,mode_paiement")
      .eq("client_id", auth.user.id)
      .in("nature", ["credit", "remboursement"])
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  const requests = (requestData ?? []) as CreditRequest[];
  const accounts = (accountData ?? []) as CreditAccount[];
  const operations = (operationData ?? []) as CreditOperation[];
  const repayments: Repayment[] = operations
    .filter((operation) => operation.nature === "remboursement")
    .map(({ id, credit_id, pharmacie_id, montant, reference, motif, mode_paiement, created_at }) => ({
      id, credit_id, pharmacie_id, montant, reference, motif, mode_paiement, created_at,
    }));

  const pharmacyIds = [...new Set([
    ...requests.map((request) => request.pharmacie_id),
    ...accounts.map((account) => account.pharmacie_id),
    ...operations.map((operation) => operation.pharmacie_id),
  ])];
  const { data: pharmacies, error: pharmacyError } = pharmacyIds.length
    ? await sb.from("pharmacies").select("id,nom").in("id", pharmacyIds)
    : { data: [] as { id: string; nom: string }[], error: null };
  const pharmacyNames = new Map((pharmacies ?? []).map((pharmacy) => [pharmacy.id, pharmacy.nom]));
  const names = Object.fromEntries(pharmacyNames);

  return (
    <main className="mx-auto min-h-dvh max-w-lg space-y-4 px-4 py-6">
      <Link href="/achats/credit" className="text-sm font-semibold underline">Nouvelle demande</Link>
      <header className="rounded-2xl bg-[#0B3D26] p-5 text-white">
        <h1 className="text-2xl font-black">Mes crédits et remboursements</h1>
        <p className="mt-2 text-sm text-white/85">Retrouvez vos encours, achats à crédit au comptoir, demandes Marketplace et remboursements enregistrés.</p>
      </header>

      {(requestError || accountError || operationError || pharmacyError) && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-900">
          Une partie de votre suivi de crédit est momentanément indisponible. Les données manquantes ne sont pas estimées.
        </p>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-black">Mes comptes de crédit</h2>
        {!accountError && accounts.length === 0 && (
          <p className="rounded-xl border bg-white p-4 text-sm">Aucun compte de crédit n'est actuellement activé à votre nom.</p>
        )}
        {accounts.map((account) => (
          <article key={account.id} className="space-y-2 rounded-2xl border bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-bold">{pharmacyNames.get(account.pharmacie_id) ?? "Pharmacie"}</h3>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold">{account.actif ? "Actif" : "Inactif"}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <p>Encours dû<strong className="mt-1 block text-lg">{fcfa(Number(account.solde))}</strong></p>
              <p>Plafond<strong className="mt-1 block text-lg">{fcfa(Number(account.plafond))}</strong></p>
            </div>
            <p className="border-t pt-2 text-xs text-slate-600">
              Disponible : {fcfa(Math.max(Number(account.plafond) - Number(account.solde), 0))}
              {" · "}Mis à jour le {new Date(account.updated_at).toLocaleString("fr-FR")}
            </p>
          </article>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-black">Mes demandes</h2>
        {!requestError && requests.length === 0 && (
          <p className="rounded-xl border bg-white p-4">Vous n'avez aucune demande de crédit Marketplace ou comptoir.</p>
        )}
        {requests.map((request) => (
          <article key={request.id} className="space-y-2 rounded-2xl border bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-black">Demande #{request.id.replace(/-/g, "").slice(0, 8).toUpperCase()}</h3>
              <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-bold">{labels[request.statut] ?? request.statut}</span>
            </div>
            <p className="text-sm">Origine : <strong>{request.origine === "caisse" ? "Achat à la pharmacie" : "Marketplace"}</strong></p>
            <p className="text-sm">Pharmacie : <strong>{pharmacyNames.get(request.pharmacie_id) ?? "Pharmacie"}</strong></p>
            <p className="text-sm">Montant : <strong>{fcfa(Number(request.montant))}</strong></p>
            <p className="text-sm">Soumise le {new Date(request.created_at).toLocaleString("fr-FR")}</p>
            {request.date_remboursement && <p className="text-sm">Remboursement prévu : <strong>{request.date_remboursement}</strong></p>}
            {request.statut === "approuvee" && request.origine === "marketplace" && (
              <p className="text-sm text-emerald-900">Le stock a été débité à l'approbation. La pharmacie prépare votre commande avant le retrait.</p>
            )}
            {request.statut === "rejetee" && <p className="text-sm text-slate-700">La demande a été refusée ; aucun crédit n'a été consommé.</p>}
            {request.reservation_id && <p className="break-all text-xs text-slate-600">Préparation : {request.reservation_id}</p>}
            {request.vente_id && <p className="break-all text-xs text-slate-600">Vente Caisse : {request.vente_id}</p>}
          </article>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-black">Journal de crédit</h2>
        {!operationError && operations.length === 0 && (
          <p className="rounded-xl border bg-white p-4 text-sm">Aucune opération de crédit ou de remboursement enregistrée.</p>
        )}
        {operations.map((operation) => (
          <article key={operation.id} className="space-y-1 rounded-xl border bg-white p-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <strong>{operation.nature === "credit" ? "Achat à crédit" : "Remboursement"}</strong>
              <strong>{operation.nature === "credit" ? "+" : "−"}{fcfa(Number(operation.montant))}</strong>
            </div>
            <p>{pharmacyNames.get(operation.pharmacie_id) ?? "Pharmacie"}</p>
            <p className="text-xs text-slate-500">{new Date(operation.created_at).toLocaleString("fr-FR")} · {operation.mode_paiement ?? "Opération de crédit"}</p>
            {operation.vente_id && <p className="break-all text-xs text-slate-500">Vente : {operation.vente_id}</p>}
            {operation.reference && <p className="break-all text-xs text-slate-500">Référence : {operation.reference}</p>}
          </article>
        ))}
      </section>

      <CreditRepaymentReceipts repayments={repayments} pharmacyNames={names} error={operationError?.message ?? null} />
    </main>
  );
}
