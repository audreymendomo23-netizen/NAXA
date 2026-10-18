"use client";

import { useMemo, useState } from "react";
import { importerCsvCatalogue } from "./actions";

const inputClass = "mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900";
function parsePreview(source: string) {
  const lines = source.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  return lines.slice(0, 6).map((line) => line.split(";").map((cell) => cell.replace(/^"|"$/g, "").replace(/""/g, '"').trim()));
}
export function CsvCatalogueTools({ partnerOptions }: { partnerOptions: { id: string; name: string; universes: string[] }[] }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string[][]>([]);
  const [error, setError] = useState("");
  const [partnerId, setPartnerId] = useState(partnerOptions[0]?.id ?? "");
  const [universe, setUniverse] = useState(partnerOptions[0]?.universes[0] ?? "parapharmacie");
  const allowed = partnerOptions.find((p) => p.id === partnerId)?.universes ?? [];
  const headers = ["name", "price_fcfa", "stock_quantity", "category", "brand", "description", "unit_label", "photo_url"];
  const sample = "name;price_fcfa;stock_quantity;category;brand;description;unit_label;photo_url\nCrème hydratante;3500;12;Soins;NAXA;Hydratation;unité;https://exemple.cm/image.jpg";
  const previewRows = useMemo(() => preview, [preview]);
  return <section className="rounded-2xl border bg-white p-5 shadow-sm">
    <h2 className="text-xl font-extrabold">Import / export CSV</h2>
    <p className="mt-1 text-sm leading-6 text-slate-600">Format UTF-8, séparateur point-virgule. Chaque import crée des brouillons ; il ne supprime et ne remplace aucun produit existant. Limite : 500 lignes et 2 Mo par fichier.</p>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <label className="text-sm font-semibold">Partenaire<select className={inputClass} value={partnerId} onChange={(e) => { setPartnerId(e.target.value); const first = partnerOptions.find((p) => p.id === e.target.value)?.universes[0]; if (first) setUniverse(first); }}>{partnerOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label className="text-sm font-semibold">Univers<select className={inputClass} value={universe} onChange={(e) => setUniverse(e.target.value)}>{allowed.map((u) => <option key={u} value={u}>{u === "bebe-maman" ? "Bébé & Maman" : "Parapharmacie"}</option>)}</select></label>
    </div>
    <div className="mt-4 flex flex-wrap gap-3"><a href="/partenaire/catalogue/export" className="inline-flex min-h-11 items-center rounded-xl border border-teal-800 px-4 py-2 text-sm font-bold text-teal-900">Exporter mes produits CSV</a><button type="button" onClick={() => { const blob = new Blob(["\uFEFF" + sample], { type: "text/csv;charset=utf-8" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "modele-catalogue-naxa.csv"; a.click(); URL.revokeObjectURL(url); }} className="min-h-11 rounded-xl border px-4 py-2 text-sm font-bold">Télécharger le modèle</button></div>
    <form action={importerCsvCatalogue} className="mt-4 space-y-3">
      <input type="hidden" name="partner_id" value={partnerId}/><input type="hidden" name="universe_slug" value={universe}/>
      <label className="block text-sm font-semibold">Fichier CSV<input className={inputClass} type="file" name="csv_file" accept=".csv,text/csv" required onChange={async (e) => { const selected = e.target.files?.[0] ?? null; setFile(selected); setError(""); setPreview([]); if (!selected) return; if (selected.size > 2_000_000) { setError("Fichier supérieur à 2 Mo."); return; } try { const text = await selected.text(); const rows = parsePreview(text); setPreview(rows); if (rows.length < 2 || !rows[0].includes("name") || !rows[0].includes("price_fcfa") || !rows[0].includes("stock_quantity")) setError("En-têtes requis : name, price_fcfa, stock_quantity. Vérifie l’aperçu avant l’import."); } catch { setError("Impossible de lire ce fichier."); } }}/></label>
      {error && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{error}</p>}
      {previewRows.length > 0 && <div className="overflow-x-auto rounded-lg border"><p className="p-3 text-sm font-bold">Aperçu (jusqu’à 5 lignes de données)</p><table className="w-full text-left text-xs"><tbody>{previewRows.map((row, i) => <tr key={i} className="border-t">{row.map((cell, j) => <td key={j} className="max-w-48 p-2">{cell || "—"}</td>)}</tr>)}</tbody></table></div>}
      <button disabled={!file || !!error || previewRows.length < 2} className="min-h-11 rounded-xl bg-[#064B2A] px-4 py-3 font-bold text-white disabled:opacity-40">Importer en brouillons</button>
    </form>
  </section>;
}
