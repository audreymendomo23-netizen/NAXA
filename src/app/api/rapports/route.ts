import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PERIODS = {
  quotidien: { days: 1, label: "Quotidien" },
  hebdomadaire: { days: 7, label: "Hebdomadaire" },
  mensuel: { days: 30, label: "Mensuel" },
  trimestriel: { days: 90, label: "Trimestriel" },
  semestriel: { days: 180, label: "Semestriel" },
  annuel: { days: 365, label: "Annuel" },
} as const;

type Period = keyof typeof PERIODS;
type ReportRow = { indicateur: string; valeur: string | number };

function csvEscape(value: unknown) {
  const raw = String(value ?? "");
  const safe = /^[=+@-]/.test(raw) ? "'" + raw : raw;
  return '"' + safe.replace(/"/g, '""') + '"';
}

function toPdf(lines: string[]) {
  const clean = (value: string) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, " ").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += 46) pages.push(lines.slice(i, i + 46));
  if (!pages.length) pages.push(["Rapport NAXA"]);
  const objects: string[] = [];
  const pageIds: number[] = [];
  const fontId = 3;
  objects[0] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[1] = "";
  objects[2] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  pages.forEach((page, index) => {
    const pageId = 4 + index * 2;
    const streamId = pageId + 1;
    pageIds.push(pageId);
    const content = ["BT", "/F1 10 Tf", "42 800 Td", "14 TL",
      ...page.flatMap((line, lineIndex) => lineIndex === 0
        ? [`(${clean(line).slice(0, 150)}) Tj`]
        : ["T*", `(${clean(line).slice(0, 150)}) Tj`]),
      "ET"].join("\n");
    objects[pageId - 1] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${streamId} 0 R >>`;
    objects[streamId - 1] = `<< /Length ${Buffer.byteLength(content, "ascii")} >>\nstream\n${content}\nendstream`;
  });
  objects[1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
  let output = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(output, "ascii"));
    output += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(output, "ascii");
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => { output += String(offset).padStart(10, "0") + " 00000 n \n"; });
  output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(output, "ascii");
}

async function explainWithAi(metrics: Record<string, unknown>, role: string, period: string) {
  const key = process.env.AI_GATEWAY_API_KEY;
  if (!key) return { status: "indisponible", texte: "Analyse IA non configurée. Les indicateurs chiffrés restent disponibles." };
  try {
    const response = await fetch("https://ai-gateway.vercel.sh/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.AI_GATEWAY_MODEL || "openai/gpt-4.1-mini",
        temperature: 0.1,
        messages: [
          { role: "system", content: "Tu es l'analyste BI de NAXA. Analyse uniquement les chiffres fournis. Ne fabrique aucun historique, aucune comparaison ni causalité. Distingue faits, signaux et hypothèses. Si les données ne permettent pas d'expliquer une variation, dis-le. Réponds en français, en 5 points maximum." },
          { role: "user", content: JSON.stringify({ role, period, metrics, comparison: "Aucune comparaison N-1 n'est fournie par le moteur actuel. Ne pas en inventer." }) },
        ],
      }),
      cache: "no-store",
    });
    if (!response.ok) return { status: "erreur", texte: "Analyse IA temporairement indisponible. Les indicateurs chiffrés restent disponibles." };
    const payload = await response.json();
    const texte = payload.choices?.[0]?.message?.content;
    return typeof texte === "string" && texte.trim()
      ? { status: "disponible", texte: texte.trim().slice(0, 7000) }
      : { status: "erreur", texte: "L'analyse IA n'a pas renvoyé de contenu exploitable." };
  } catch {
    return { status: "erreur", texte: "Analyse IA temporairement indisponible. Les indicateurs chiffrés restent disponibles." };
  }
}

function rowsFromStats(stats: Record<string, any>): ReportRow[] {
  const rows: ReportRow[] = [];
  const add = (label: string, value: unknown) => {
    if (typeof value === "number" || typeof value === "string") rows.push({ indicateur: label, valeur: value });
  };
  add("Périmètre", stats.role === "admin" ? "Réseau NAXA" : stats.role === "promoteur" ? "Réseau Promoteur autorisé" : stats.role === "caisse" ? "Activité de caisse personnelle" : "Pharmacie autorisée");
  add("Pharmacies du périmètre", stats.pharmacies?.total);
  add("Pharmacies actives", stats.pharmacies?.actives);
  add("Pharmacies inactives", stats.pharmacies?.inactives);
  add("Recherches", stats.recherches?.total);
  add("Recherches sans résultat", stats.recherches?.sans_resultat);
  add("Fiches consultées", stats.entonnoir?.fiches_vues);
  add("Ajouts au panier", stats.entonnoir?.paniers);
  add("Réservations", stats.entonnoir?.reservations);
  add("Ventes", stats.entonnoir?.ventes);
  add("Chiffre d'affaires (FCFA)", stats.ca);
  add("Produits disponibles", stats.stock?.produits_en_stock);
  add("Ruptures de stock", stats.stock?.ruptures);
  add("Alertes non lues", stats.alertes);
  add("Taux de conversion vente (%)", stats.performance?.taux_conversion_vente);
  add("Taux de retrait (%)", stats.performance?.taux_retrait);
  add("Panier moyen (FCFA)", stats.performance?.panier_moyen);
  add("Âge moyen du stock (heures)", stats.performance?.stock_age_heures);
  add("Opérations réservation", stats.evenements_reservation);
  add("Paiements traités", stats.paiements);
  add("Retraits traités", stats.retraits);
  add("Annulations", stats.annulations);
  return rows;
}

export async function GET() {
  const sb = supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Connexion requise" }, { status: 401 });
  const { data: profile } = await sb.from("profiles").select("role,fonction_interne,pharmacie_id,actif").eq("id", auth.user.id).single();
  if (!profile?.actif || !["admin", "promoteur", "pharmacie", "caisse"].includes(profile.role)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  const { data, error } = await sb.from("rapports")
    .select("id,portee,pharmacie_id,periode,du,au,texte,contenu,created_at,pharmacies(nom)")
    .order("created_at", { ascending: false }).limit(30);
  if (error) return NextResponse.json({ error: "Historique des rapports indisponible." }, { status: 500 });
  const scoped = (data ?? []).filter((report: any) => {
    if (profile.role === "admin") return report.portee === "admin";
    if (profile.role === "promoteur") return false;
    return Boolean(profile.pharmacie_id) && report.pharmacie_id === profile.pharmacie_id;
  });
  return NextResponse.json({ rapports: scoped.map((r: any) => ({ ...r, pharmacie_nom: r.pharmacies?.nom ?? null })) });
}

export async function POST(request: Request) {
  const sb = supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Connexion requise" }, { status: 401 });
  const { data: profile, error: profileError } = await sb.from("profiles")
    .select("role,fonction_interne,pharmacie_id,actif").eq("id", auth.user.id).single();
  if (profileError || !profile?.actif) return NextResponse.json({ error: "Compte inactif ou profil indisponible." }, { status: 403 });

  let body: { periode?: Period; format?: "json" | "csv" | "pdf" };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Paramètres invalides." }, { status: 400 }); }
  const periode = body.periode || "hebdomadaire";
  const config = PERIODS[periode];
  if (!config) return NextResponse.json({ error: "Période non prise en charge." }, { status: 400 });

  let stats: Record<string, any>;
  if (profile.role === "caisse") {
    const { data, error } = await sb.rpc("stats_caisse_scope", { p_jours: config.days });
    if (error) return NextResponse.json({ error: "Les statistiques de caisse ne sont pas accessibles pour ce poste." }, { status: 403 });
    stats = (Array.isArray(data) ? data[0] : data) as Record<string, any>;
  } else {
    if (profile.role === "pharmacie" && profile.fonction_interne !== "responsable") {
      return NextResponse.json({ error: "Le rapport est réservé au Responsable de pharmacie habilité." }, { status: 403 });
    }
    if (!["admin", "promoteur", "pharmacie"].includes(profile.role)) return NextResponse.json({ error: "Poste non habilité aux rapports." }, { status: 403 });
    const { data, error } = await sb.rpc("stats_pilotage_scope", { p_jours: config.days });
    if (error) return NextResponse.json({ error: "Le pilotage de ce poste n'est pas autorisé ou ses données sont indisponibles." }, { status: 403 });
    stats = (Array.isArray(data) ? data[0] : data) as Record<string, any>;
  }
  if (!stats || typeof stats !== "object") return NextResponse.json({ error: "Le moteur BI n'a pas renvoyé de données exploitables." }, { status: 502 });

  const now = new Date();
  const start = new Date(now.getTime() - config.days * 86400000);
  const startDate = start.toISOString().slice(0, 10);
  const endDate = now.toISOString().slice(0, 10);
  const rows = rowsFromStats(stats);
  const ai = await explainWithAi(stats, profile.role, config.label);
  const report = {
    titre: "Rapport BI NAXA",
    role: profile.role,
    periode,
    periode_label: config.label,
    jours: config.days,
    du: startDate,
    au: endDate,
    genere_le: now.toISOString(),
    comparaison: { disponible: false, motif: "Le moteur de statistiques actuel ne prend pas encore de date de début/fin arbitraire. Aucune comparaison artificielle n'est affichée." },
    indicateurs: rows,
    serie: Array.isArray(stats.serie) ? stats.serie : [],
    analyse_ia: ai,
    donnees: stats,
  };

  if (body.format === "csv") {
    const csvRows = [...rows, { indicateur: "Statut analyse IA", valeur: ai.status }, { indicateur: "Analyse IA", valeur: ai.texte }];
    const csv = ["indicateur,valeur", ...csvRows.map((row) => [csvEscape(row.indicateur), csvEscape(row.valeur)].join(","))].join("\r\n");
    return new Response("\ufeff" + csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="naxa-rapport-${periode}-${endDate}.csv"`, "Cache-Control": "no-store" } });
  }
  if (body.format === "pdf") {
    const lines = [
      "NAXA - RAPPORT BI",
      `Periode : ${config.label} (${config.days} jours)`,
      `Du ${startDate} au ${endDate} | Genere le ${now.toISOString()}`,
      `Perimetre : ${String(rows[0]?.valeur ?? "Autorise")}`,
      "",
      "INDICATEURS",
      ...rows.map((row) => `${row.indicateur} : ${row.valeur}`),
      "",
      "ANALYSE IA",
      `Statut : ${ai.status}`,
      ...ai.texte.split("\n"),
      "",
      "COMPARAISON",
      report.comparaison.motif,
      "",
      "NOTE : les hypotheses de l'IA ne constituent pas des causalites prouvees.",
    ];
    const pdf = toPdf(lines);
    return new Response(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="naxa-rapport-${periode}-${endDate}.pdf"`, "Cache-Control": "no-store" } });
  }
  return NextResponse.json(report, { headers: { "Cache-Control": "no-store" } });
}
