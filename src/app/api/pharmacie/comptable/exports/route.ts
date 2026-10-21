import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ExportType = "ventes" | "depenses" | "tresorerie" | "ecritures";
type Row = Record<string, string | number | boolean | null>;

const validDate = (value: string | null) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(value + "T00:00:00Z");
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : null;
};
const safeCell = (value: unknown): string | number => {
  if (typeof value === "number") return value;
  const raw = value == null ? "" : String(value);
  // Prevent spreadsheet formula injection in text cells.
  return /^[=+@\-\t\r]/.test(raw) ? "'" + raw : raw;
};

const pdfAscii = (value: unknown) => String(safeCell(value))
  .normalize("NFKD").replace(/[\\u0300-\\u036f]/g, "")
  .replace(/[^\\x20-\\x7E]/g, "?").replace(/([\\\\()])/g, "\\\\$1");
function createSimplePdf(lines: string[]) {
  const pageLines = lines.slice(0, 48);
  const stream = ["BT", "/F1 9 Tf", "42 800 Td", "12 TL",
    ...pageLines.flatMap((line, index) => index === 0
      ? [`(${pdfAscii(line).slice(0, 110)}) Tj`]
      : ["T*", `(${pdfAscii(line).slice(0, 110)}) Tj`]),
    "ET"].join("\\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${new TextEncoder().encode(stream).length} >>\\nstream\\n${stream}\\nendstream`,
  ];
  let pdf = "%PDF-1.4\\n";
  const offsets = [0];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(new TextEncoder().encode(pdf).length);
    pdf += `${i + 1} 0 obj\\n${objects[i]}\\nendobj\\n`;
  }
  const xref = new TextEncoder().encode(pdf).length;
  pdf += `xref\\n0 ${objects.length + 1}\\n0000000000 65535 f \\n`;
  for (const offset of offsets.slice(1)) pdf += String(offset).padStart(10, "0") + " 00000 n \\n";
  pdf += `trailer\\n<< /Size ${objects.length + 1} /Root 1 0 R >>\\nstartxref\\n${xref}\\n%%EOF`;
  return new TextEncoder().encode(pdf);
}
\nconst csvEscape = (value: unknown) => {
  const text = String(safeCell(value));
  return '"' + text.replace(/"/g, '""') + '"';
};

export async function GET(request: Request) {
  const sb = supabaseServer();
  const { data: auth, error: authError } = await sb.auth.getUser();
  if (authError || !auth.user) return NextResponse.json({ error: "authentification_requise" }, { status: 401 });

  const { data: profile, error: profileError } = await sb.from("profiles")
    .select("id,actif,pharmacie_id").eq("id", auth.user.id).single();
  if (profileError || !profile || profile.actif !== true || !profile.pharmacie_id) {
    return NextResponse.json({ error: "acces_refuse" }, { status: 403 });
  }
  const { data: allowed, error: permissionError } = await sb.rpc("naxa_can", {
    p_privilege: "MANAGE_ACCOUNTING", p_pharmacie: profile.pharmacie_id, p_target: null,
  });
  if (permissionError || allowed !== true) return NextResponse.json({ error: "acces_refuse" }, { status: 403 });

  const url = new URL(request.url);
  const type = url.searchParams.get("type") as ExportType | null;
  if (!type || !["ventes", "depenses", "tresorerie", "ecritures"].includes(type)) {
    return NextResponse.json({ error: "type_export_invalide" }, { status: 400 });
  }
  const debut = validDate(url.searchParams.get("debut"));
  const fin = validDate(url.searchParams.get("fin"));
  if ((url.searchParams.get("debut") && !debut) || (url.searchParams.get("fin") && !fin) || (debut && fin && debut > fin)) {
    return NextResponse.json({ error: "periode_invalide" }, { status: 400 });
  }
  const endExclusive = fin ? new Date(Date.parse(fin + "T00:00:00+01:00") + 86400000).toISOString() : null;
  const limit = 5000;
  let query: any;
  let dateField: string;
  let columns: string[];
  if (type === "ventes") {
    dateField = "created_at";
    columns = ["Date création", "Date paiement", "Référence vente", "Statut", "Brut FCFA", "Remise FCFA", "Net FCFA", "Mode de paiement", "Référence paiement"];
    query = sb.from("ventes").select("created_at,paid_at,numero_vente,statut,total_brut,remise,total_net,mode_paiement,paiement_ref")
      .eq("pharmacie_id", profile.pharmacie_id).order("created_at", { ascending: true }).limit(limit);
  } else if (type === "depenses") {
    dateField = "date_depense";
    columns = ["Date dépense", "Référence", "Montant FCFA", "Statut", "Créée le"];
    query = sb.from("depenses").select("date_depense,reference,montant,statut,created_at")
      .eq("pharmacie_id", profile.pharmacie_id).order("date_depense", { ascending: true }).limit(limit);
  } else if (type === "tresorerie") {
    dateField = "date_operation";
    columns = ["Date opération", "Nature", "Montant FCFA", "Référence", "Type source", "Référence source"];
    query = sb.from("tresorerie_mouvements").select("date_operation,nature,montant,reference,source_type,source_id")
      .eq("pharmacie_id", profile.pharmacie_id).order("date_operation", { ascending: true }).limit(limit);
  } else {
    dateField = "date_ecriture";
    columns = ["Date écriture", "Journal", "Référence source", "Libellé", "Type source", "Identifiant source"];
    query = sb.from("compta_ecriture").select("date_ecriture,journal_code,reference_source,libelle,source_type,source_id")
      .eq("pharmacie_id", profile.pharmacie_id).order("date_ecriture", { ascending: true }).limit(limit);
  }
  if (debut) query = query.gte(dateField, type === "depenses" ? debut : debut + "T00:00:00+01:00");
  if (type === "depenses" && fin) query = query.lte(dateField, fin);
  else if (endExclusive) query = query.lt(dateField, endExclusive);

  const { data, error } = await query;
  if (error) {
    const admin = supabaseAdmin();
    await admin.rpc("compta_auditer", {
      p_pharmacie: profile.pharmacie_id, p_acteur: auth.user.id,
      p_action: "export_generation", p_objet_type: type, p_objet_id: type,
      p_resultat: "erreur", p_motif: "source_indisponible",
    });
    return NextResponse.json({ error: "source_indisponible" }, { status: 503 });
  }
  const rows = (data ?? []) as Row[];
  const records: (string | number)[][] = rows.map((row) => {
    if (type === "ventes") return [row.created_at as string, row.paid_at as string | null ?? "", row.numero_vente as string, row.statut as string, row.total_brut as number, row.remise as number, row.total_net as number, row.mode_paiement as string | null ?? "", row.paiement_ref as string | null ?? ""];
    if (type === "depenses") return [row.date_depense as string, row.reference as string | null ?? "", row.montant as number, row.statut as string, row.created_at as string];
    if (type === "tresorerie") return [row.date_operation as string, row.nature as string, row.montant as number, row.reference as string | null ?? "", row.source_type as string, row.source_id as string | null ?? ""];
    return [row.date_ecriture as string, row.journal_code as string, row.reference_source as string | null ?? "", row.libelle as string, row.source_type as string, row.source_id as string];
  });
  const metadata = [
    ["Rapport NAXA — état préparé à contrôler par votre expert-comptable"],
    ["Pharmacie", profile.pharmacie_id],
    ["Généré le", new Date().toISOString()],
    ["Période début", debut ?? "Non précisée"],
    ["Période fin", fin ?? "Non précisée"],
    ["Lignes exportées", records.length],
    ["Limite atteinte", records.length === limit ? "Oui — export potentiellement tronqué" : "Non"],
    [],
  ];
  const filename = `naxa-${type}-${debut ?? "debut"}-${fin ?? "fin"}`;
  const requestedFormat = url.searchParams.get("format");
  const format = requestedFormat === "xlsx" ? "xlsx" : requestedFormat === "pdf" ? "pdf" : "csv";
  const audit = await supabaseAdmin().rpc("compta_auditer", {
    p_pharmacie: profile.pharmacie_id,
    p_acteur: auth.user.id,
    p_action: "export_generation",
    p_objet_type: type,
    p_objet_id: filename,
    p_resultat: "succes",
    p_motif: `format=${format}; debut=${debut ?? "non_precise"}; fin=${fin ?? "non_precise"}; lignes=${records.length}; tronque=${records.length === limit}`,
  });
  if (audit.error) {
    return NextResponse.json({ error: "journalisation_export_indisponible" }, { status: 503 });
  }
  if (format === "pdf") {
    const pdfRows = [
      "NAXA - Rapport comptable",
      `Type: ${type} | Pharmacie: ${profile.pharmacie_id}`,
      `Genere le: ${new Date().toISOString()}`,
      `Periode: ${debut ?? "non precise"} au ${fin ?? "non precise"}`,
      `Lignes: ${records.length}${records.length === limit ? " - LIMITE ATTEINTE" : ""}`,
      "Etat prepare par NAXA, a controler par votre expert-comptable.",
      "",
      columns.join(" | "),
      ...records.map(row => row.map(pdfAscii).join(" | ")),
      "",
      "Document limite a une page; consulter CSV/Excel pour le detail complet.",
    ];
    const bytes = createSimplePdf(pdfRows);
    return new NextResponse(bytes, { headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}.pdf"`,
      "Cache-Control": "no-store",
      "X-NAXA-Export-Rows": String(records.length),
      "X-NAXA-Export-Truncated": records.length === limit || pdfRows.length > 48 ? "true" : "false",
    }});
  }
  if (format === "xlsx") {
    const workbook = XLSX.utils.book_new();
    const safeRecords = records.map((row) => row.map((cell) => safeCell(cell)));
    const sheet = XLSX.utils.aoa_to_sheet([...metadata, columns, ...safeRecords]);
    XLSX.utils.book_append_sheet(workbook, sheet, "Rapport");
    const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }) as Buffer;
    return new NextResponse(buffer, { headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}.xlsx"`,
      "Cache-Control": "no-store",
      "X-NAXA-Export-Rows": String(records.length),
      "X-NAXA-Export-Truncated": records.length === limit ? "true" : "false",
    }});
  }
  const csv = [...metadata, columns, ...records].map(row => row.map(csvEscape).join(";")).join("\r\n");
  return new NextResponse("\uFEFF" + csv, { headers: {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${filename}.csv"`,
    "Cache-Control": "no-store",
    "X-NAXA-Export-Rows": String(records.length),
    "X-NAXA-Export-Truncated": records.length === limit ? "true" : "false",
  }});
}
