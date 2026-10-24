"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { fcfa } from "@/lib/ranking";
import { EnTeteClient } from "@/components/EnTeteClient";

type TicketItem = {
  produit_id: string;
  produit_nom: string | null;
  produit_dosage: string | null;
  quantite: number;
  prix_unitaire: number;
  total_ligne: number;
};
type TicketPayment = {
  mode: string | null;
  montant: number;
  montant_percu: number | null;
  monnaie_rendue: number | null;
  created_at: string;
};
type Ticket = {
  receipt_type: string;
  sale: {
    vente_id: string;
    numero_vente: string | null;
    pharmacie_id: string;
    statut: string;
    created_at: string;
    paid_at: string | null;
    total_brut: number;
    remise: number;
    total_net: number;
    mode_paiement: string | null;
    paiement_ref: string | null;
  };
  items: TicketItem[];
  payments: TicketPayment[];
  reservation: {
    reservation_id: string;
    ticket_numero_snapshot: string | null;
    montant_percu_snapshot: number | null;
    monnaie_rendue_snapshot: number | null;
    paiement_valide_at: string | null;
  };
};
type RecuData = { ticket: Ticket; pharmacie: string };

const dateFr = (value: string | null) =>
  value ? new Date(value).toLocaleString("fr-FR") : "—";

export default function Recu() {
  const { id } = useParams<{ id: string }>();
  const [d, setD] = useState<RecuData | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur("");
    try {
      const sb = supabaseBrowser();

      // Source d'autorité : ticket POS vérifié côté serveur pour le client connecté.
      const { data: rawTicket, error: ticketError } = await sb.rpc(
        "get_client_reservation_ticket",
        { p_reservation_id: id }
      );
      if (ticketError || !rawTicket) {
        throw new Error("Aucun ticket de caisse POS validé n’est disponible pour cette réservation.");
      }
      const ticket = rawTicket as unknown as Ticket;
      if (
        ticket.receipt_type !== "cashier_ticket" ||
        ticket.sale?.statut !== "payee" ||
        !ticket.sale?.vente_id ||
        !Array.isArray(ticket.items) ||
        ticket.items.length === 0 ||
        !Array.isArray(ticket.payments) ||
        ticket.payments.length === 0
      ) {
        throw new Error("Le ticket de caisse ne contient pas toutes les preuves de paiement requises.");
      }

      const itemsTotal = ticket.items.reduce((sum, item) => sum + Number(item.total_ligne), 0);
      const paymentsTotal = ticket.payments.reduce((sum, payment) => sum + Number(payment.montant), 0);
      const saleTotal = Number(ticket.sale.total_net);
      if (
        !Number.isFinite(itemsTotal) ||
        !Number.isFinite(paymentsTotal) ||
        !Number.isFinite(saleTotal) ||
        Math.abs(itemsTotal - Number(ticket.sale.total_brut)) > 1 ||
        Math.abs(paymentsTotal - saleTotal) > 1
      ) {
        throw new Error("Les montants du ticket, des lignes et des paiements ne concordent pas. Le reçu est bloqué pour vérification.");
      }

      // La RPC a déjà validé le propriétaire et le statut payé. Cette lecture ne sert
      // qu'au libellé de la pharmacie ; elle ne décide jamais si le paiement est validé.
      const { data: reservation, error: reservationError } = await sb
        .from("reservations")
        .select("pharmacies(nom)")
        .eq("id", id)
        .maybeSingle();
      if (reservationError) throw reservationError;

      setD({
        ticket,
        pharmacie: (Array.isArray(reservation?.pharmacies) ? reservation.pharmacies[0]?.nom : (reservation?.pharmacies as unknown as { nom: string } | null)?.nom) ?? "Pharmacie partenaire",
      });
    } catch (error) {
      setD(null);
      setErreur(error instanceof Error
        ? error.message
        : "Impossible de vérifier le ticket de caisse. Réessayez plus tard.");
    } finally {
      setChargement(false);
    }
  }, [id]);

  useEffect(() => { void charger(); }, [charger]);

  const ticket = d?.ticket;
  const totalPaye = ticket?.payments.reduce((sum, payment) => sum + Number(payment.montant), 0) ?? 0;

  return (
    <main className="mx-auto max-w-md space-y-4 px-4 pb-16">
      <EnTeteClient />
      <h1 className="text-xl font-extrabold">Ticket de caisse pharmacie</h1>
      {chargement && <p role="status" className="text-sm text-slate-600">Vérification du ticket et du paiement…</p>}
      {!chargement && erreur && (
        <section className="carte space-y-3" role="alert">
          <p className="text-sm">{erreur}</p>
          <p className="text-xs text-slate-500">Aucun reçu n’est affiché tant que le ticket POS et les montants ne peuvent pas être vérifiés côté serveur.</p>
          <button type="button" className="btn btn-vert w-full" onClick={() => void charger()}>Réessayer</button>
        </section>
      )}
      {d && ticket && !chargement && (
        <>
          <section className="rounded-xl border p-4 text-sm">
            <p><strong>Ticket de caisse :</strong> {ticket.sale.numero_vente ?? ticket.reservation.ticket_numero_snapshot ?? "—"}</p>
            <p><strong>Référence transaction :</strong> {id.toUpperCase()}</p>
            <p><strong>Pharmacie :</strong> {d.pharmacie}</p>
            <p><strong>Vente créée :</strong> {dateFr(ticket.sale.created_at)}</p>
            <p><strong>Paiement validé :</strong> {dateFr(ticket.sale.paid_at ?? ticket.reservation.paiement_valide_at)}</p>
            <p><strong>Statut de la vente POS :</strong> PAYÉE</p>
            <p><strong>Mode enregistré :</strong> {ticket.sale.mode_paiement ?? (ticket.payments.map(payment => payment.mode).filter(Boolean).join(", ") || "—")}</p>
            <p><strong>Référence de paiement :</strong> {ticket.sale.paiement_ref ?? "—"}</p>
          </section>
          <section className="rounded-xl border p-4">
            <h2 className="mb-3 font-bold">Articles vendus</h2>
            <table className="w-full text-sm">
              <tbody>
                {ticket.items.map((item, index) => (
                  <tr key={item.produit_id + "-" + index} className="border-b">
                    <td className="py-2 pr-2">{item.quantite} × {item.produit_nom ?? "Produit"} {item.produit_dosage ?? ""}</td>
                    <td className="py-2 text-right whitespace-nowrap">{fcfa(Number(item.total_ligne))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <dl className="mt-3 space-y-1 text-sm">
              <div className="flex justify-between gap-3"><dt>Sous-total</dt><dd>{fcfa(Number(ticket.sale.total_brut))}</dd></div>
              <div className="flex justify-between gap-3"><dt>Remise</dt><dd>{fcfa(Number(ticket.sale.remise))}</dd></div>
              <div className="flex justify-between gap-3 text-lg font-extrabold"><dt>Total vente</dt><dd>{fcfa(Number(ticket.sale.total_net))}</dd></div>
              <div className="flex justify-between gap-3 font-bold"><dt>Total paiements enregistrés</dt><dd>{fcfa(totalPaye)}</dd></div>
            </dl>
          </section>
          <section className="rounded-xl border p-4 text-sm">
            <h2 className="mb-2 font-bold">Détail du paiement enregistré</h2>
            {ticket.payments.map((payment, index) => (
              <div key={payment.created_at + "-" + index} className="border-b py-2 last:border-b-0">
                <p><strong>Mode :</strong> {payment.mode ?? "—"}</p>
                <p><strong>Montant affecté :</strong> {fcfa(Number(payment.montant))}</p>
                {payment.montant_percu != null && <p><strong>Montant perçu :</strong> {fcfa(Number(payment.montant_percu))}</p>}
                {payment.monnaie_rendue != null && <p><strong>Monnaie rendue :</strong> {fcfa(Number(payment.monnaie_rendue))}</p>}
                <p><strong>Enregistré le :</strong> {dateFr(payment.created_at)}</p>
              </div>
            ))}
          </section>
          <button type="button" className="btn btn-vert no-print w-full" onClick={() => window.print()}>
            Imprimer ou enregistrer en PDF
          </button>
        </>
      )}
    </main>
  );
}
