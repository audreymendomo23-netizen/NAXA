"use client";

import { useState } from "react";
import { importerStock } from "@/lib/importStock";

type Pharmacie = { id: string; nom: string };

export function ImportAdmin({ pharmacies }: { pharmacies: Pharmacie[] }) {
  const [pharmacieId, setPharmacieId] = useState(pharmacies[0]?.id ?? "");
  const [fichier, setFichier] = useState<File | null>(null);
  const [etat, setEtat] = useState<"idle" | "chargement" | "ok" | "erreur">("idle");
  const [message, setMessage] = useState("");

  async function importer() {
    if (!pharmacieId || !fichier) {
      setEtat("erreur");
      setMessage("Choisissez une pharmacie et un fichier Excel.");
      return;
    }

    setEtat("chargement");
    setMessage("");

    try {
      const resultat = await importerStock(fichier, pharmacieId);
      setEtat("ok");
      setMessage(
        `Import terminé : ${resultat.importes} stock(s) importé(s), ${resultat.ignores} ligne(s) ignorée(s) sur ${resultat.lus} lue(s).`
      );
      setFichier(null);
    } catch (error) {
      setEtat("erreur");
      setMessage(error instanceof Error ? error.message : "Échec de l'import.");
    }
  }

  return (
    <section className="carte space-y-3">
      <div>
        <h2 className="text-lg font-bold">Importer un stock</h2>
        <p className="mt-1 text-sm text-slate-600">
          Fichier Excel (.xlsx/.xls). Les colonnes reconnues sont nom, dosage, prix et quantité.
        </p>
      </div>

      {pharmacies.length === 0 ? (
        <p className="text-sm text-slate-600">Créez d’abord une pharmacie.</p>
      ) : (
        <>
          <label className="block text-sm font-semibold">
            Pharmacie
            <select
              value={pharmacieId}
              onChange={(event) => setPharmacieId(event.target.value)}
              className="champ mt-1"
            >
              {pharmacies.map((pharmacie) => (
                <option key={pharmacie.id} value={pharmacie.id}>
                  {pharmacie.nom}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-semibold">
            Fichier
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(event) => setFichier(event.target.files?.[0] ?? null)}
              className="mt-1 block w-full text-sm"
            />
          </label>

          <button
            type="button"
            className="btn btn-vert w-full"
            onClick={importer}
            disabled={etat === "chargement" || !fichier}
          >
            {etat === "chargement" ? "Import en cours…" : "Importer le stock"}
          </button>
        </>
      )}

      {message && (
        <p role={etat === "erreur" ? "alert" : "status"} className={etat === "erreur" ? "text-sm text-red-700" : "text-sm"}>
          {message}
        </p>
      )}
    </section>
  );
}
