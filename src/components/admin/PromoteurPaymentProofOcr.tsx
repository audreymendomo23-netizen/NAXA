"use client";

import { useState } from "react";
import { lirePreuvePaiement } from "@/lib/promoteurPaymentProofOcr";
import { analyserPreuvePaiementOcr } from "@/app/admin/pilotage/reglements/actions";

type Props = { proofUrl: string; reglementId: string };
type Result = {
  direction: string | null;
  amount: number | null;
  reference: string | null;
  payerNumber: string | null;
  merchantNumber: string | null;
  occurredAt: string | null;
  parser: string;
  quality: string;
};

export function PromoteurPaymentProofOcr({ proofUrl, reglementId }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [reasons, setReasons] = useState<string[]>([]);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [textPreview, setTextPreview] = useState("");

  async function runOcr() {
    setBusy(true);
    setError(null);
    setMessage(null);
    setResult(null);
    setReasons([]);
    setTextPreview("");
    try {
      const response = await fetch(proofUrl, { cache: "no-store" });
      if (!response.ok) throw new Error("Le fichier prive n'a pas pu etre telecharge.");
      const blob = await response.blob();
      const ocr = await lirePreuvePaiement(blob);
      setConfidence(ocr.confiance);
      setTextPreview(ocr.texte.slice(0, 5000));
      const saved = await analyserPreuvePaiementOcr(reglementId, ocr.texte, ocr.confiance);
      if (!saved.ok) throw new Error(saved.message);
      setMessage(saved.message + " · " + ocr.pagesTraitees + " page(s) · " + ocr.mode);
      setResult(saved.extracted ?? null);
      setReasons(saved.reasons ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Lecture OCR impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-bold text-indigo-950">Lecture automatique du justificatif</p>
          <p className="text-xs text-indigo-900">OCR local dans le navigateur, images et PDF (3 pages max). Le texte brut n'est pas stocke.</p>
        </div>
        <button type="button" disabled={busy} onClick={runOcr}
          className="min-h-10 rounded-full bg-indigo-700 px-4 text-sm font-bold text-white disabled:opacity-50">
          {busy ? "Analyse en cours…" : "Lire le justificatif"}
        </button>
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-red-800">{error}</p>}
      {message && <p role="status" className="mt-2 text-sm font-semibold text-indigo-950">{message}{confidence !== null ? " · confiance OCR " + confidence + "%" : ""}</p>}
      {result && <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
        <div><dt className="text-indigo-800">Type de mouvement</dt><dd className="font-bold">{result.direction ?? "Non identifie"}</dd></div>
        <div><dt className="text-indigo-800">Montant</dt><dd className="font-bold">{result.amount ?? "—"} FCFA</dd></div>
        <div><dt className="text-indigo-800">Reference</dt><dd className="break-all font-bold">{result.reference ?? "—"}</dd></div>
        <div><dt className="text-indigo-800">Numero payeur</dt><dd className="font-bold">{result.payerNumber ?? "—"}</dd></div>
        <div><dt className="text-indigo-800">Numero marchand</dt><dd className="font-bold">{result.merchantNumber ?? "—"}</dd></div>
        <div><dt className="text-indigo-800">Analyseur</dt><dd className="font-bold">{result.parser} · {result.quality}</dd></div>
      </dl>}
      {reasons.length > 0 && <ul className="mt-2 list-disc pl-5 text-xs text-amber-950">{reasons.map((reason,index)=><li key={index}>{reason}</li>)}</ul>}
      {textPreview && <details className="mt-3 text-xs"><summary className="cursor-pointer font-semibold text-indigo-950">Voir le texte reconnu temporairement</summary><pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-white p-2 text-slate-800">{textPreview}</pre></details>}
    </section>
  );
}
