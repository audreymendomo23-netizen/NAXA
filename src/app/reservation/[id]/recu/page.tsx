"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { fcfa } from "@/lib/ranking";
import { EnTeteClient } from "@/components/EnTeteClient";

type Ligne = { quantite: number; prix_unitaire: number; produits: { nom: string; dosage: string } | null };
type RecuData = {
  r: { total: number; statut: string; paiement_ref: string | null; created_at: string; pharmacies: { nom: string } | null };
  lignes: Ligne[];
};

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
      const { data: r, error: reservationError } = await sb
        .from("reservations")
        .select("total,statut,paiement_ref,created_at,pharmacies(nom)")
        .eq("id", id)
        .single();
      if (reservationError || !r) throw reservationError ?? new Error("Réservation introuvable.");

      if (!["payee", "retiree"].includes(r.statut)) {
        setD(null);
        setErreur("Le reçu sera disponible lorsque la réservation sera payée ou retirée.");
        return;
      }

      const { data: lignes, error: lignesError } = await sb
        .from("reservation_items")
        .select("quantite,prix_unitaire,produits(nom,dosage)")
        .eq("reservation_id", id);
      if (lignesError) throw lignesError;
      if (!lignes?.length) throw new Error("Aucune ligne de réservation n’a été trouvée.");

      setD({ r: r as never, lignes: lignes as never });
    } catch {
      setD(null);
      setErreur("Impossible de charger le reçu pour le moment. Vérifiez votre connexion puis réessayez.");
    } finally {
      setChargement(false);
    }
  }, [id]);

  useEffect(() => { void charger(); }, [charger]);

  return (
    <main className="mx-auto max-w-md space-y-4 px-4 pb-16">
      <EnTeteClient />
      <h1 className="text-xl font-extrabold">Reçu de réservation</h1>
      {chargement && <p role="status" className="text-sm text-slate-600">Chargement du reçu…</p>}
      {!chargement && erreur && (
        <section className="carte space-y-3" role="alert">
          <p className="text-sm">{erreur}</p>
          <button type="button" className="btn btn-vert w-full" onClick={() => void charger()}>Réessayer</button>
        </section>
      )}
      {d && !chargement && (
        <>
          <p className="text-sm">
            N° {id.slice(0, 8).toUpperCase()} · {new Date(d.r.created_at).toLocaleString("fr-FR")}<br />
            Pharmacie : {d.r.pharmacies?.nom ?? "—"}<br />
            Référence de paiement : {d.r.paiement_ref ?? "—"}
          </p>
          <table className="w-full text-sm">
            <tbody>
              {d.lignes.map((l, i) => (
                <tr key={i} className="border-b">
                  <td className="py-1">{l.quantite} × {l.produits?.nom ?? "Produit"} {l.produits?.dosage ?? ""}</td>
                  <td className="py-1 text-right">{fcfa(l.prix_unitaire * l.quantite)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-right text-lg font-extrabold">Total : {fcfa(d.r.total)}</p>
          <button type="button" className="btn btn-vert no-print w-full" onClick={() => window.print()}>
            Imprimer ou enregistrer en PDF
          </button>
        </>
      )}
    </main>
  );
}
