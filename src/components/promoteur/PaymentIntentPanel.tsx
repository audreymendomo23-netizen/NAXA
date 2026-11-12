"use client";

type Channel = "mtn_momo" | "orange_money";
type Destination = { beneficiaire?: string; reference_destination?: string; instructions?: string | null };
type Intent = { id: string; canal: Channel; expectedAmount: number; destination: Destination | null; expiresAt: string };
type Props = {
  device: { id: string; name: string } | null;
  activeIntent: Intent | null;
};
const label: Record<Channel, string> = { mtn_momo: "MTN Mobile Money", orange_money: "Orange Money" };
const money = (n: number) => new Intl.NumberFormat("fr-FR").format(n) + " FCFA";

export function PaymentIntentPanel({ device, activeIntent }: Props) {
  const expires = activeIntent ? new Date(activeIntent.expiresAt) : null;
  return (
    <section className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-emerald-900">Paiement assisté par le téléphone</p>
      {!device ? (
        <div className="mt-2 space-y-2">
          <p className="font-bold text-slate-900">Compagnon Android non connecté</p>
          <p className="text-sm leading-6 text-slate-700">Avant de payer, vérifiez que vous êtes connecté au bon compte Promoteur sur le téléphone qui servira au paiement et que le compagnon Android NAXA y est installé, ouvert et enrôlé avec ce même compte.</p>
          <p className="text-xs text-slate-600">La détection automatique ne sera pas proposée tant que le téléphone n'est pas enrôlé. Utilisez la saisie manuelle de secours si le compagnon n'est pas disponible.</p>
        </div>
      ) : !activeIntent ? (
        <div className="mt-2 space-y-2">
          <p className="font-bold text-slate-900">Téléphone enrôlé : {device.name}</p>
          <p className="text-sm leading-6 text-slate-700">Ouvrez le compagnon Android NAXA sur ce téléphone. Vérifiez qu'il est connecté au même compte Promoteur, puis préparez le paiement depuis le compagnon. La page web ne peut pas préparer un paiement à la place de ce téléphone.</p>
          <button type="button" onClick={() => window.location.reload()} className="min-h-10 rounded-xl border border-emerald-900/30 bg-white px-4 py-2 text-sm font-bold text-emerald-950">Actualiser le statut</button>
        </div>
      ) : (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-white p-4">
          <p className="text-xs font-bold uppercase text-emerald-800">Paiement préparé depuis {device.name} · {label[activeIntent.canal]}</p>
          <p className="mt-1 text-2xl font-black text-[#0B3D26]">{money(activeIntent.expectedAmount)}</p>
          <p className="mt-3 text-xs text-slate-500">Bénéficiaire</p><p className="font-bold">{activeIntent.destination?.beneficiaire ?? "—"}</p>
          <p className="mt-2 text-xs text-slate-500">Destination marchande</p><p className="break-all font-bold">{activeIntent.destination?.reference_destination ?? "—"}</p>
          {activeIntent.destination?.instructions && <p className="mt-2 text-sm text-slate-600">{activeIntent.destination.instructions}</p>}
          <p className="mt-3 text-xs text-slate-500">Expire le {expires?.toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}</p>
          <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">Effectuez le paiement depuis ce même téléphone, avec le numéro et le canal affichés. La notification capturée par le compagnon reste une indication : le règlement sera confirmé uniquement après vérification indépendante par NAXA. Ne partagez jamais votre code PIN ni un OTP.</p>
        </div>
      )}
    </section>
  );
}
