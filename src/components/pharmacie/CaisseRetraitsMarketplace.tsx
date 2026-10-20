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
  confirmee: "Confirmée",
  payee: "Payée · retrait à confirmer",
  retiree: "Retirée",
  annulee: "Annulée",
  expiree: "Expirée",
};

export function CaisseRetraitsMarketplace({ pharmacieId }: { pharmacieId: string | null }) {
  const [rows, setRows] = useState<Reservation[]>([]);
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

  async function confirmerRetrait(row: Reservation) {
    if (busyId) return;
    if (row.statut !== "payee" || row.paiement_statut !== "effectue") {
      setError("Le retrait ne peut être confirmé qu’après vérification du paiement.");
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
          <p className="text-sm text-slate-600">Réservations de cette pharmacie. Le retrait n’est confirmable qu’après validation du paiement.</p>
        </div>
        <button type="button" className="btn btn-clair" disabled={loading || !!busyId} onClick={() => void load()}>
          Actualiser
        </button>
      </div>
      {message && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{message}</p>}
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-900">{error}</p>}
      {loading ? (
        <p role="status" className="text-sm text-slate-600">Chargement des réservations…</p>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-dashed p-4 text-sm text-slate-600">Aucune réservation en attente de retrait.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => {
            const paid = row.statut === "payee" && row.paiement_statut === "effectue";
            const expired = new Date(row.expires_at).getTime() <= Date.now() && row.statut !== "payee";
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
                    <button type="button" className="btn btn-vert" disabled={!!busyId} onClick={() => void confirmerRetrait(row)}>
                      {busyId === row.id ? "Confirmation…" : "Confirmer le retrait"}
                    </button>
                  )}
                </div>
                {!paid && <p className="mt-2 text-xs text-amber-800">Ne confirmez pas le retrait tant que le paiement n’est pas marqué comme effectué dans le dossier de réservation.</p>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
