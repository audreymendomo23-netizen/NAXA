import { supabaseBrowser } from "./supabase/client";

const clean = (s: unknown) => String(s ?? "").trim();
const cle = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").replace(/[^a-z0-9]/g, "");
const NOM = ["nom", "designation", "produit", "libelle", "medicament", "article"];
const PRIX = ["prix", "pu", "prixvente", "prixdevente", "pvttc", "tarif"];
const QTE = ["quantite", "qte", "stock", "qtestock"];
const DOSAGE = ["dosage", "conditionnement"];
const PEREMPTION = ["peremption", "dateperemption", "expiration", "dlc"];

function trouver(row: Record<string, unknown>, cles: string[]) {
  for (const k of Object.keys(row)) if (cles.includes(cle(k))) return row[k];
  return "";
}

export async function importerStock(file: File, pharmacieId: string) {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer(), { cellDates: true });
  const lignes = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { defval: "" });
  const valides = lignes.map((r) => ({
    nom: clean(trouver(r, NOM)),
    dosage: clean(trouver(r, DOSAGE)),
    prix: Math.round(Number(String(trouver(r, PRIX)).replace(/\\s/g, "").replace(",", "."))) || 0,
    quantite: Math.max(0, Math.round(Number(trouver(r, QTE))) || 0),
    per: trouver(r, PEREMPTION),
  })).filter((r) => r.nom.length > 1 && r.prix > 0);

  const sb = supabaseBrowser();
  let importes = 0;

  for (let i = 0; i < valides.length; i += 200) {
    const lot = valides.slice(i, i + 200);
    const noms = [...new Set(lot.map((r) => r.nom))];
    const { data: existants, error: lectureErreur } = await sb.from("produits").select("id,nom,dosage,forme").in("nom", noms);
    if (lectureErreur) throw lectureErreur;

    const cleProduit = (nom: string, dosage: string, forme = "") => nom + "|" + dosage + "|" + forme;
    const index = new Map((existants ?? []).map((p) => [cleProduit(p.nom, p.dosage, p.forme ?? ""), p.id]));
    const manquants = lot.filter((r) => !index.has(cleProduit(r.nom, r.dosage))).reduce((acc, r) => {
      const k = cleProduit(r.nom, r.dosage);
      if (!acc.has(k)) acc.set(k, { nom: r.nom, dosage: r.dosage, forme: "" });
      return acc;
    }, new Map<string, { nom: string; dosage: string; forme: string }>());

    if (manquants.size) {
      const { data: nouveaux, error: insertionErreur } = await sb.from("produits").insert([...manquants.values()]).select("id,nom,dosage,forme");
      if (insertionErreur) throw insertionErreur;
      for (const p of nouveaux ?? []) index.set(cleProduit(p.nom, p.dosage, p.forme ?? ""), p.id);
    }

    const stocks = lot.map((r) => ({
      pharmacie_id: pharmacieId,
      produit_id: index.get(cleProduit(r.nom, r.dosage)),
      prix: r.prix,
      quantite: r.quantite,
      date_peremption: r.per instanceof Date ? r.per.toISOString().slice(0, 10) : null,
    })).filter((s): s is typeof s & { produit_id: string } => Boolean(s.produit_id));
    if (!stocks.length) continue;
    const { error: stockErreur } = await sb.from("stocks").upsert(stocks, { onConflict: "pharmacie_id,produit_id" });
    if (stockErreur) throw stockErreur;
    importes += stocks.length;
  }

  return { lus: lignes.length, importes, ignores: lignes.length - valides.length };
}