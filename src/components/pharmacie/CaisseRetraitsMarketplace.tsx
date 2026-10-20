"use client";

import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { fcfa } from "@/lib/ranking";

type ReservationItem = {
  quantite: number;
  prix_unitaire: number;
  produits: { nom: string; dosage: string | null } | null;
};

type Reservation = {
  id: string;
  statut: string;
  total: number;
  created_at: string;
  expires_at: string;
  paiement_statut: string | null;
  paiement_mode: string | null;
  reservation_items: ReservationItem[] | null;
};

const statusLabel: Record<string, string> = {
  en_attente: "En attente de confirmation",
  confirmee: "Confirmée · paiement à traiter",
  payee: "Payée · retrait à confirmer",
  retiree: "Retirée",
  annulee: "Annulée",
  expiree: "Expirée",
};

export function CaisseRetraitsMarketplace({
  pharmacieId,
  sessionId,
}: {
  pharmacieId: string | null;
  sessionId: string | null;
}) {
  const [rows, setRows] = useState<Reservation[]>([]);
  const [received, setReceived] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!pharmacieId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    const sb = supabaseBrowser();
    const { data, error: queryError } = await sb
      .from("reservations")
      .select("id,statut,total,created_at,expires_at,paiement_statut,paiement_mode,reservation_items(quantite,prix_unitaire,produits(nom,dosage))")
      .eq("pharmacie_id", pharmacieId)
      .eq("mode", "reservation")
      .in("statut", ["en_attente", "confirmee", "payee"])
      .order("created_at", { ascending: false })
      .limit(100);

    if (queryError) {
      setError("Impossible de charger les réservations de cette pharmacie. Aucune action n’a été effectuée.");
      setRows([]);
    } else {
      setRows((data ?? []) as unknown as Reservation[]);
    }
    setLoading(false);
  }, [pharmacieId]);

  useEffect(() => { void load(); }, [load]);

  async function encaisser(row: Reservation) {
    if (!sessionId) {
      setError("Ouvrez une session de caisse avant d’encaisser une réservation.");
      return;
    }
    if (busyId) return;
    const amount = Number(received[row.id]);
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      setError("Saisissez le montant espèces reçu, en FCFA.");
      return;
    }
    if (row.statut !== "confirmee" || row.paiement_statut === "effectue") {
      setError("Cette réservation n’est plus éligible à l’encaissement. Actualisez la liste.");
      return;
    }
    if (row.paiement_mode && !["especes", "a_convenir"].includes(row.paiement_mode)) {
      setError("Le mode de paiement choisi n’est pas encaissable en espèces. Vérifiez le paiement selon le mode indiqué.");
      return;
    }
    if (!window.confirm("Encaisser en espèces la réservation " + row.id.slice(0, 8).toUpperCase() + " pour " + fcfa(row.total) + " ? Le ticket sera enregistré dans la session de caisse.")) return;

    setBusyId(row.id);
    setError("");
    setMessage("");
    const { data, error: paymentError } = await supabaseBrowser().rpc("vente_reservation_encaisser", {
      p_reservation: row.id,
      p_session: sessionId,
      p_montant_percu: amount,
    });
    if (paymentError) {
      setError(paymentError.message || "Encaissement non confirmé. Actualisez la liste avant de réessayer.");
    } else {
      const result = Array.isArray(data) ? data[0] : data;
      setReceived((current) => ({ ...current, [row.id]: "" }));
      setMessage(
        "Encaissement enregistré · ticket " + (result?.numero_vente ?? "créé") +
        " · monnaie à rendre : " + fcfa(Number(result?.monnaie_rendue ?? Math.max(amount - row.total, 0)) ) +
        ". Le ticket peut être réimprimé depuis l’historique des ventes."
      );
      await load();
    }
    setBusyId(null);
  }

  async function confirmerRetrait(row: Reservation) {
    if (!sessionId) {
      setError("Ouvrez une session de caisse avant de confirmer le retrait.");
      return;
    }
    if (busyId) return;
    if (row.statut !== "payee" || row.paiement_statut !== "effectue") {
      setError("Le retrait ne peut être confirmé qu’après validation du paiement.");
      return;
    }
    if (!window.confirm("Confirmer le retrait de la réservation " + row.id.slice(0, 8).toUpperCase() + " ?")) return;

    setBusyId(row.id);
    setError("");
    setMessage("");
    const { error: transitionError } = await supabaseBrowser().rpc("set_reservation_status", {
      p_id: row.id,
      p_statut: "retiree",
    });
    if (transitionError) {
      setError("Retrait non confirmé. Vérifiez le statut actuel avant de réessayer.");
    } else {
      setMessage("Retrait confirmé pour la réservation " + row.id.slice(0, 8).toUpperCase() + ".");
      await load();
    }
    setBusyId(null);
  }

  return (
    <section className="carte mb-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold">Retraits Marketplace</h2>
          <p className="text-sm text-slate-600">Encaissement comptoir et retrait des réservations de cette pharmacie. Le paiement est enregistré dans la session POS.</p>
        </div>
        <button type="button" className="btn btn-clair" disabled={loading || !!busyId} onClick={() => void load()}>
          Actualiser
        </button>
      </div>
      {!sessionId && <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">Ouvrez une session de caisse pour encaisser ou confirmer un retrait.</p>}
      {message && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{message}</p>}
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-900">{error}</p>}
      {loading ? (
        <p role="status" className="text-sm text-slate-600">Chargement des réservations…</p>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-dashed p-4 text-sm text-slate-600">Aucune réservation en attente de retrait.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => {
            const expired = new Date(row.expires_at).getTime() <= Date.now() && row.statut !== "payee";
            const canCash = row.statut === "confirmee"
              && row.paiement_statut !== "effectue"
              && (!row.paiement_mode || ["especes", "a_convenir"].includes(row.paiement_mode))
              && !expired;
            const paid = row.statut === "payee" && row.paiement_statut === "effectue";
            return (
              <li key={row.id} className="rounded-xl border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-bold">Réservation #{row.id.slice(0, 8).toUpperCase()}</p>
                    <p className="text-xs text-slate-500">{new Date(row.created_at).toLocaleString("fr-FR")}</p>
                  </div>
                  <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-bold">
                    {expired ? "Délai dépassé · vérifier le statut" : statusLabel[row.statut] ?? row.statut}
                  </span>
                </div>
                <div className="mt-2 space-y-1 text-sm">
                  {(row.reservation_items ?? []).map((item, index) => (
                    <p key={index}>{item.quantite} × {item.produits?.nom ?? "Produit"}{item.produits?.dosage ? " · " + item.produits.dosage : ""}</p>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-extrabold">{fcfa(row.total)}</p>
                    <p className="text-xs text-slate-600">Paiement : {row.paiement_statut === "effectue" ? "confirmé" : "à vérifier"} · {row.paiement_mode ?? "modalité à convenir"}</p>
                  </div>
                  {paid && (
                    <button type="button" className="btn btn-vert" disabled={!!busyId || !sessionId} onClick={() => void confirmerRetrait(row)}>
                      {busyId === row.id ? "Confirmation…" : "Confirmer le retrait"}
                    </button>
                  )}
                </div>
                {canCash && (
                  <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                    <label className="text-sm font-semibold">Espèces reçues (FCFA)
                      <input className="champ mt-1 w-full" type="number" min={row.total} step="1" inputMode="numeric" value={received[row.id] ?? ""} onChange={(event) => setReceived((current) => ({ ...current, [row.id]: event.target.value }))} disabled={!sessionId || !!busyId} />
                    </label>
                    <button type="button" className="btn btn-vert" disabled={!sessionId || !!busyId} onClick={() => void encaisser(row)}>
                      {busyId === row.id ? "Encaissement…" : "Encaisser en espèces"}
                    </button>
                  </div>
                )}
                {!paid && !canCash && <p className="mt-2 text-xs text-amber-800">Vérifiez la confirmation, l’expiration et le mode de paiement avant toute opération. Les paiements électroniques ne sont pas simulés.</p>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
