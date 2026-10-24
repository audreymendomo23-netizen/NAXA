"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type Entry = {
  id: string; client_id: string; pharmacie_id: string; statut: string; mode: string;
  total: number; created_at: string; expires_at: string; commande_statut: string | null;
  paiement_statut: string; paiement_ref?: string | null;
  pharmacies: { nom: string; ville: string | null; quartier: string | null; adresse?: string | null } | null;
};
type Event = { id: string; reservation_id: string; event_type: string; from_statut: string | null; to_statut: string | null; paiement_ref: string | null; occurred_at: string; detail: Record<string, unknown> };
type Purchase = {
  reservation_id: string; produit_id: string; medicament: string; dci: string; dosage: string;
  forme: string; quantite: number; prix_unitaire: number; total_ligne: number; total_transaction: number;
  reference_paiement: string | null; reservation_creee_le: string; pharmacie_id: string;
  pharmacie: string; ville: string; quartier: string | null; adresse: string | null;
  confirmee_le: string | null; paiement_declare_le: string | null; payee_le: string | null;
  retiree_le: string | null; achat_le: string | null; horodatage_achat_exact: boolean; statut: string;
};
type Receipt = { reservationId: string; rows: Purchase[]; date: string; pharmacy: string; city: string; address: string; total: number; reference: string | null; status: string };

const fmt = (v: string | null | undefined) => v ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(v)) : "Non renseignée";
const fcfa = (v: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Number(v) || 0) + " FCFA";
const STATUS: Record<string, string> = {
  en_attente: "En attente", confirmee: "Confirmée", payee: "Payée", retiree: "Retirée",
  expiree: "Expirée", annulee: "Annulée", annule: "Annulée", cancelled: "Annulée",
  expired: "Expirée", preparation: "En préparation", prete: "Prête au retrait",
};
const EVENT_LABELS: Record<string, string> = {
  reservation_created: "Réservation créée", status_changed: "Statut modifié",
  payment_declared: "Paiement signalé", payment_verified: "Paiement vérifié",
  delivery_status_changed: "Commande mise à jour",
};
const PERIODS = [{ value: "30", label: "30 derniers jours" }, { value: "90", label: "3 derniers mois" }, { value: "180", label: "6 derniers mois" }, { value: "365", label: "1 an" }, { value: "all", label: "Tout l’historique" }];

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
}

function downloadReceipt(receipt: Receipt) {
  const popup = window.open("", "_blank", "noopener,noreferrer");
  if (!popup) {
    window.alert("Autorisez l’ouverture de la fenêtre d’impression pour enregistrer le reçu en PDF.");
    return;
  }
  const lines = receipt.rows.map((row) => `
    <tr><td>${escapeHtml(row.medicament)}${row.dosage ? " · " + escapeHtml(row.dosage) : ""}${row.forme ? " · " + escapeHtml(row.forme) : ""}<small>${escapeHtml(row.dci || "")}</small></td>
    <td class="num">${row.quantite}</td><td class="num">${fcfa(row.prix_unitaire)}</td><td class="num">${fcfa(row.total_ligne)}</td></tr>`).join("");
  popup.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Duplicata reçu ${escapeHtml(receipt.reservationId.slice(0, 8).toUpperCase())}</title>
  <style>
  *{box-sizing:border-box}body{font:14px/1.45 Arial,sans-serif;color:#111;margin:0;padding:24px}main{max-width:720px;margin:auto}.brand{text-align:center;border-bottom:2px dashed #777;padding-bottom:14px}h1{font-size:20px;margin:0 0 6px}.muted{color:#555;font-size:12px}.meta{margin:16px 0;display:grid;grid-template-columns:1fr 1fr;gap:8px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{padding:8px 4px;border-bottom:1px solid #ddd;text-align:left;vertical-align:top}.num{text-align:right;white-space:nowrap}small{display:block;color:#555}.total{display:flex;justify-content:space-between;font-weight:700;font-size:18px;margin-top:16px;border-top:2px dashed #777;padding-top:12px}.notice{margin-top:22px;padding:10px;border:1px solid #999;font-size:11px}.actions{margin:20px 0;text-align:center}.actions button{padding:10px 16px;margin:4px}@media print{body{padding:0}.actions{display:none}main{max-width:none}}@media(max-width:500px){body{padding:12px}.meta{grid-template-columns:1fr}table{font-size:10px}}
  </style></head><body><main><header class="brand"><h1>NAXA · Duplicata du reçu d’achat</h1><div>${escapeHtml(receipt.pharmacy)}</div><div class="muted">${escapeHtml(receipt.address)} ${receipt.city ? "· " + escapeHtml(receipt.city) : ""}</div></header>
  <section class="meta"><div><b>Référence achat</b><br>${escapeHtml(receipt.reservationId.toUpperCase())}</div><div><b>Date d’achat</b><br>${escapeHtml(fmt(receipt.date))}</div><div><b>Référence de paiement</b><br>${escapeHtml(receipt.reference || "Non disponible dans l’historique")}</div><div><b>État enregistré</b><br>${escapeHtml(STATUS[receipt.status] || receipt.status)}</div></section>
  <table><thead><tr><th>Article</th><th class="num">Qté</th><th class="num">Prix unitaire</th><th class="num">Total</th></tr></thead><tbody>${lines}</tbody></table>
  <div class="total"><span>Total enregistré</span><span>${fcfa(receipt.total)}</span></div>
  <p class="muted">Montants exprimés en FCFA. Ce duplicata est généré à partir des données d’achat conservées dans NAXA.</p>
  <div class="notice"><b>Important — justificatif :</b> ce document est un duplicata numérique des informations d’achat disponibles. Il ne reproduit pas nécessairement à l’identique le ticket original imprimé à la caisse et ne remplace pas une copie certifiée de ce ticket. Pour un dossier médico-professionnel, conservez aussi le ticket original et demandez à la pharmacie une attestation si nécessaire.</div>
  <div class="actions"><button onclick="window.print()">Imprimer / Enregistrer en PDF</button><button onclick="window.close()">Fermer</button></div></main><script>window.addEventListener("load",()=>setTimeout(()=>window.print(),250));</script></body></html>`);
  popup.document.close();
}

export default function HistoriqueClient() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [q, setQ] = useState("");
  const [period, setPeriod] = useState("90");
  const [kind, setKind] = useState<"all" | "orders" | "purchases">("all");
  const [loading, setLoading] = useState(true);
  const [purchaseWarning, setPurchaseWarning] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const sb = supabaseBrowser();
      const { data: auth } = await sb.auth.getUser();
      if (!auth.user) { location.assign("/connexion?retour=%2Fclient%2Fhistorique"); return; }
      const [reservationResult, purchaseResult] = await Promise.all([
        sb.from("reservations").select("id,client_id,pharmacie_id,statut,mode,total,created_at,expires_at,commande_statut,paiement_statut,paiement_ref,pharmacies(nom,ville,quartier,adresse)").eq("client_id", auth.user.id).order("created_at", { ascending: false }).limit(1000),
        sb.from("client_achats").select("reservation_id,produit_id,medicament,dci,dosage,forme,quantite,prix_unitaire,total_ligne,total_transaction,reference_paiement,reservation_creee_le,pharmacie_id,pharmacie,ville,quartier,adresse,confirmee_le,paiement_declare_le,payee_le,retiree_le,achat_le,horodatage_achat_exact,statut").eq("client_id", auth.user.id).order("achat_le", { ascending: false, nullsFirst: false }).limit(2000),
      ]);
      if (cancelled) return;
      if (reservationResult.error) {
        setError("Impossible de charger les réservations et commandes. Réessayez plus tard.");
        setLoading(false);
        return;
      }
      const rows = (reservationResult.data ?? []) as unknown as Entry[];
      setEntries(rows);
      if (purchaseResult.error) {
        setPurchaseWarning("Les achats détaillés ne sont pas disponibles dans cet environnement. Les réservations et commandes restent consultables.");
      } else {
        setPurchases((purchaseResult.data ?? []) as unknown as Purchase[]);
      }
      if (rows.length) {
        const { data: ev } = await sb.from("reservation_events").select("id,reservation_id,event_type,from_statut,to_statut,paiement_ref,occurred_at,detail").in("reservation_id", rows.slice(0, 200).map((x) => x.id)).order("occurred_at", { ascending: false }).limit(1000);
        if (!cancelled) setEvents((ev ?? []) as Event[]);
      }
      if (!cancelled) setLoading(false);
    })().catch(() => { if (!cancelled) { setError("Une erreur inattendue empêche le chargement de l’historique."); setLoading(false); } });
    return () => { cancelled = true; };
  }, []);

  const cutoff = useMemo(() => period === "all" ? 0 : Date.now() - Number(period) * 24 * 60 * 60 * 1000, [period]);
  const filteredEntries = useMemo(() => entries.filter((entry) => {
    const date = new Date(entry.created_at).getTime();
    const matchesPeriod = !cutoff || date >= cutoff;
    const haystack = [entry.pharmacies?.nom || "", entry.mode, entry.statut, entry.commande_statut || "", entry.id, entry.paiement_ref || ""].join(" ").toLocaleLowerCase("fr");
    return matchesPeriod && haystack.includes(q.trim().toLocaleLowerCase("fr")) && kind !== "purchases";
  }), [entries, cutoff, q, kind]);
  const filteredPurchases = useMemo(() => purchases.filter((purchase) => {
    const date = new Date(purchase.achat_le || purchase.payee_le || purchase.retiree_le || purchase.reservation_creee_le).getTime();
    const matchesPeriod = !cutoff || date >= cutoff;
    const haystack = [purchase.medicament, purchase.dci, purchase.dosage, purchase.forme, purchase.pharmacie, purchase.ville, purchase.reservation_id, purchase.reference_paiement || ""].join(" ").toLocaleLowerCase("fr");
    return matchesPeriod && haystack.includes(q.trim().toLocaleLowerCase("fr")) && kind !== "orders" && (purchase.statut === "payee" || purchase.statut === "retiree");
  }), [purchases, cutoff, q, kind]);
  const receipts = useMemo<Receipt[]>(() => {
    const groups = new Map<string, Purchase[]>();
    for (const purchase of filteredPurchases) groups.set(purchase.reservation_id, [...(groups.get(purchase.reservation_id) ?? []), purchase]);
    return [...groups.entries()].map(([reservationId, rows]) => {
      const first = rows[0];
      return { reservationId, rows, date: first.achat_le || first.payee_le || first.retiree_le || first.reservation_creee_le, pharmacy: first.pharmacie, city: first.ville, address: first.adresse || first.quartier || "", total: Math.max(...rows.map((row) => Number(row.total_transaction) || 0), rows.reduce((sum, row) => sum + (Number(row.total_ligne) || 0), 0)), reference: first.reference_paiement, status: first.statut };
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [filteredPurchases]);
  const labels: Record<string, string> = { ...EVENT_LABELS };
  const isEmpty = filteredEntries.length === 0 && receipts.length === 0;

  return <main className="mx-auto min-h-dvh max-w-3xl px-4 pb-[calc(100px+env(safe-area-inset-bottom,0px))]">
    <h1 className="mt-4 text-xl font-extrabold text-[#0B3D26]">Historique et justificatifs</h1>
    <p className="mt-2 text-sm text-slate-600">Retrouvez vos commandes, réservations et achats, avec leur chronologie et les justificatifs disponibles.</p>
    <section className="carte mt-4 space-y-3">
      <label className="block text-sm font-bold" htmlFor="history-period">Période</label>
      <select id="history-period" value={period} onChange={(e) => setPeriod(e.target.value)} className="champ w-full">
        {PERIODS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
      </select>
      <label className="block text-sm font-bold" htmlFor="history-search">Recherche</label>
      <input id="history-search" value={q} onChange={(e) => setQ(e.target.value)} className="champ w-full" placeholder="Produit, pharmacie, référence ou identifiant…" />
      <div className="grid grid-cols-3 gap-2">
        {([{ value: "all", label: "Tout" }, { value: "orders", label: "Commandes & réservations" }, { value: "purchases", label: "Achats" }] as const).map((item) =>
          <button key={item.value} type="button" onClick={() => setKind(item.value)} aria-pressed={kind === item.value} className={`rounded-xl border px-2 py-2 text-xs font-bold ${kind === item.value ? "border-[#0F6B3F] bg-[#0F6B3F] text-white" : "border-slate-200 bg-white text-slate-700"}`}>{item.label}</button>
        )}
      </div>
      <p className="text-xs text-slate-500">Par défaut, l’historique affiche les 3 derniers mois. Les données plus anciennes ne sont pas supprimées : choisissez une période plus longue pour les retrouver.</p>
    </section>
    {error && <p role="alert" className="mt-4 text-red-700">{error}</p>}
    {purchaseWarning && <p role="status" className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{purchaseWarning}</p>}
    {loading ? <p className="mt-5">Chargement de votre historique…</p> : isEmpty ? <section className="carte mt-4"><p className="font-bold">Aucun élément ne correspond à ces critères.</p><Link href="/" className="btn btn-vert mt-3 w-full">Rechercher un médicament</Link></section> : <>
      {filteredEntries.length > 0 && <section className="mt-5"><h2 className="mb-3 text-lg font-extrabold text-[#0B3D26]">Commandes et réservations ({filteredEntries.length})</h2><ul className="space-y-3">{filteredEntries.map((entry) => {
        const timeline = events.filter((event) => event.reservation_id === entry.id);
        const status = entry.commande_statut || entry.statut;
        return <li key={entry.id} className="carte">
          <div className="flex items-start justify-between gap-3"><div><p className="font-extrabold">{entry.mode === "commande" ? "Commande" : "Réservation"} · {entry.pharmacies?.nom || "Pharmacie"}</p><p className="text-xs text-slate-500">{fmt(entry.created_at)} · N° {entry.id.slice(0, 8).toUpperCase()}</p></div><span className="rounded-full bg-naxa-canari px-2 py-1 text-xs font-bold">{STATUS[status] || status || "Statut indisponible"}</span></div>
          <p className="mt-2 text-sm text-slate-600">Montant enregistré : {fcfa(entry.total)} · Paiement : {STATUS[entry.paiement_statut] || entry.paiement_statut || "Non renseigné"}</p>
          {timeline.length > 0 && <ol className="mt-3 space-y-2 border-l-2 border-slate-100 pl-3">{timeline.map((event) => <li key={event.id} className="text-sm"><span className="font-semibold">{labels[event.event_type] || event.event_type}</span><span className="block text-xs text-slate-500">{fmt(event.occurred_at)}{event.to_statut || String(event.detail?.to || "") ? " · " + (event.to_statut || String(event.detail?.to || "")) : ""}</span></li>)}</ol>}
          <Link href={"/reservation/" + entry.id} className="mt-3 inline-block text-sm font-bold text-[#0F6B3F] underline">Ouvrir le suivi</Link>
        </li>;
      })}</ul></section>}
      {receipts.length > 0 && <section className="mt-6"><h2 className="mb-3 text-lg font-extrabold text-[#0B3D26]">Achats et reçus ({receipts.length})</h2><ul className="space-y-3">{receipts.map((receipt) => <li key={receipt.reservationId} className="carte">
        <div className="flex items-start justify-between gap-3"><div><p className="font-extrabold">{receipt.pharmacy || "Pharmacie"}</p><p className="text-xs text-slate-500">{fmt(receipt.date)} · Réf. {receipt.reservationId.slice(0, 8).toUpperCase()}</p></div><span className="rounded-full bg-[#E6F4EA] px-2 py-1 text-xs font-bold text-[#0B3D26]">{STATUS[receipt.status] || receipt.status}</span></div>
        <ul className="mt-3 space-y-1 text-sm">{receipt.rows.map((row, index) => <li key={row.produit_id + "-" + index} className="flex justify-between gap-3"><span>{row.medicament}{row.dosage ? " · " + row.dosage : ""} × {row.quantite}</span><span className="whitespace-nowrap">{fcfa(row.total_ligne)}</span></li>)}</ul>
        <div className="mt-3 flex items-center justify-between border-t pt-3 font-extrabold"><span>Total</span><span>{fcfa(receipt.total)}</span></div>
        {receipt.reference && <p className="mt-2 text-xs text-slate-500">Référence paiement : {receipt.reference}</p>}
        <button type="button" className="btn btn-vert mt-3 w-full" onClick={() => downloadReceipt(receipt)}>Télécharger / imprimer le duplicata</button>
      </li>)}</ul></section>}
    </>}
    <p className="mt-5 text-xs text-slate-500">Pour une preuve destinée à un dossier de santé ou de maladie professionnelle, privilégiez les justificatifs originaux et demandez à la pharmacie un duplicata officiel lorsque nécessaire. L’historique NAXA peut aider à retrouver les achats, mais ne constitue pas à lui seul une décision médicale ou juridique.</p>
  </main>;
}
