"use client";

import { useState, type FormEvent } from "react";

type Channel = "mtn_momo" | "orange_money";
type Destination = { canal?: string; beneficiaire?: string; reference_destination?: string; instructions?: string | null };
type Intent = { id: string; canal: Channel; expectedAmount: number; destination: Destination | null; expiresAt: string };
type Props = {
  device: { id: string; name: string } | null;
  activeIntent: Intent | null;
  channels: string[];
  amount: number | null;
};

const label: Record<Channel, string> = { mtn_momo: "MTN Mobile Money", orange_money: "Orange Money" };
const money = (n: number) => new Intl.NumberFormat("fr-FR").format(n) + " FCFA";

export function PaymentIntentPanel({ device, activeIntent, channels, amount }: Props) {
  const [channel, setChannel] = useState<Channel>(channels.includes("mtn_momo") ? "mtn_momo" : "orange_money");
  const [intent, setIntent] = useState<Intent | null>(activeIntent);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function prepare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/promoteur/paiements/intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canal: channel }),
        cache: "no-store",
      });
      const result = await response.json() as { intent?: { id: string; canal: Channel; expected_amount: number; destination_snapshot: Destination; expires_at: string }; error?: string };
      if (!response.ok || !result.intent) { setError(result.error || "Préparation du paiement impossible."); return; }
      setIntent({
        id: result.intent.id, canal: result.intent.canal,
        expectedAmount: result.intent.expected_amount,
        destination: result.intent.destination_snapshot,
        expiresAt: result.intent.expires_at,
      });
      setMessage("Paiement préparé. Utilisez ce même téléphone pour effectuer l'opération.");
    } catch {
      setError("Connexion indisponible. Aucun paiement n'a été préparé.");
    } finally { setBusy(false); }
  }

  const expires = intent ? new Date(intent.expiresAt) : null;
  return (
    <section className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-emerald-900">Paiement assisté par le téléphone</p>
      {!device ? (
        <div className="mt-2 space-y-2">
          <p className="font-bold text-slate-900">Compagnon Android non connecté</p>
          <p className="text-sm leading-6 text-slate-700">Avant de payer, vérifiez que vous êtes connecté au bon compte Promoteur sur ce téléphone et que le compagnon Android NAXA est installé, ouvert et enrôlé avec ce même compte. La détection automatique n'est pas disponible tant que ce téléphone n'apparaît pas comme connecté.</p>
          <p className="text-xs text-slate-600">Ne payez pas en supposant qu'une notification sera capturée. Utilisez la saisie manuelle de secours tant que le compagnon n'est pas connecté.</p>
        </div>
      ) : (
        <>
          <p className="mt-2 text-sm text-slate-700">Téléphone reconnu : <strong>{device.name}</strong>. Votre session Promoteur est connectée sur cette page. Préparez le paiement puis effectuez-le depuis ce même téléphone.</p>
          {!intent ? (
            <form onSubmit={prepare} className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
              <label className="grid gap-1 text-sm font-semibold">Canal
                <select value={channel} onChange={event => setChannel(event.target.value as Channel)} className="min-h-11 rounded-xl border border-slate-300 bg-white px-3" disabled={busy}>
                  {channels.filter(value => value === "mtn_momo" || value === "orange_money").map(value => <option key={value} value={value}>{label[value as Channel]}</option>)}
                </select>
              </label>
              <button type="submit" disabled={busy || !amount || channels.length === 0} className="min-h-11 self-end rounded-xl bg-[#0B3D26] px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? "Préparation…" : "Préparer le paiement"}</button>
            </form>
          ) : (
            <div className="mt-3 rounded-xl border border-emerald-200 bg-white p-4">
              <p className="text-xs font-bold uppercase text-emerald-800">Paiement préparé · {label[intent.canal]}</p>
              <p className="mt-1 text-2xl font-black text-[#0B3D26]">{money(intent.expectedAmount)}</p>
              <p className="mt-3 text-xs text-slate-500">Bénéficiaire</p><p className="font-bold">{intent.destination?.beneficiaire ?? "—"}</p>
              <p className="mt-2 text-xs text-slate-500">Destination marchande</p><p className="break-all font-bold">{intent.destination?.reference_destination ?? "—"}</p>
              {intent.destination?.instructions && <p className="mt-2 text-sm text-slate-600">{intent.destination.instructions}</p>}
              <p className="mt-3 text-xs text-slate-500">Expire le {expires?.toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}</p>
              <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">Effectuez le paiement depuis ce téléphone, avec le numéro et le canal affichés. Le compagnon NAXA peut transmettre la notification de transaction, mais le règlement restera « en attente » jusqu'à sa vérification par l'Administrateur. Ne partagez jamais votre code PIN ni un OTP.</p>
            </div>
          )}
        </>
      )}
      {message && <p role="status" className="mt-3 text-sm font-semibold text-emerald-900">{message}</p>}
      {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-900">{error}</p>}
    </section>
  );
}
