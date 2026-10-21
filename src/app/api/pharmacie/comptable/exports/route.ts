import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import * as XLSX from "xlsx";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ExportType = "ventes" | "depenses" | "tresorerie" | "ecritures" | "grand_livre" | "balance" | "bilan" | "resultat" | "tva" | "paie";
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
  .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
  .replace(/[^\x20-\x7E]/g, "?").replace(/[\\()]/g, (character) => "\\" + character);
function createSimplePdf(lines: string[]) {
  const pageLines = lines.slice(0, 48);
  const stream = ["BT", "/F1 9 Tf", "42 800 Td", "12 TL",
    ...pageLines.flatMap((line, index) => index === 0
      ? [`(${pdfAscii(line).slice(0, 110)}) Tj`]
      : ["T*", `(${pdfAscii(line).slice(0, 110)}) Tj`]),
    "ET"].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${new TextEncoder().encode(stream).length} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(new TextEncoder().encode(pdf).length);
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref = new TextEncoder().encode(pdf).length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) pdf += String(offset).padStart(10, "0") + " 00000 n \n";
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}

const csvEscape = (value: unknown) => {
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
  const { data: pharmacy } = await sb.from("pharmacies").select("nom").eq("id", profile.pharmacie_id).maybeSingle();
  const pharmacyName = pharmacy?.nom ?? "Pharmacie non renseignée";
  if (permissionError || allowed !== true) return NextResponse.json({ error: "acces_refuse" }, { status: 403 });

  const url = new URL(request.url);
  const type = url.searchParams.get("type") as ExportType | null;
  if (type && ["bilan", "resultat", "tva", "paie"].includes(type)) {
    return NextResponse.json({
      error: "source_ou_mapping_non_confirme",
      type,
      detail: "Aucun état officiel n’est généré tant que les sources métier et règles de classement/fiscalité ne sont pas confirmées.",
    }, { status: 409 });
  }
  if (!type || !["ventes", "depenses", "tresorerie", "ecritures", "grand_livre", "balance"].includes(type)) {
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
    if (type === "grand_livre") {
      columns = ["Date écriture", "Journal", "Référence écriture", "Compte", "Libellé compte", "Libellé ligne", "Débit FCFA", "Crédit FCFA", "Statut compte"];
    } else if (type === "balance") {
      columns = ["Compte", "Libellé compte", "Classe renseignée", "Total débit FCFA", "Total crédit FCFA", "Solde débiteur FCFA", "Solde créditeur FCFA", "Statut compte"];
    } else {
      columns = ["Date écriture", "Journal", "Référence source", "Libellé", "Type source", "Identifiant source"];
    }
    query = sb.from("compta_ecriture").select("id,date_ecriture,journal_code,reference_source,libelle,source_type,source_id")
      .eq("pharmacie_id", profile.pharmacie_id).order("date_ecriture", { ascending: true }).limit(limit);
  }
  const dateOnly = type === "depenses" || type === "ecritures" || type === "grand_livre" || type === "balance";
  if (debut) query = query.gte(dateField, dateOnly ? debut : debut + "T00:00:00+01:00");
  if (dateOnly && fin) query = query.lte(dateField, fin);
  else if (type === "depenses" && fin) query = query.lte(dateField, fin);
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
  let sourceTruncated = rows.length === limit;
  let records: (string | number)[][];
  if (type === "grand_livre" || type === "balance") {
    const entryIds = rows.map(row => String(row.id ?? "")).filter(Boolean);
    const lineResult = entryIds.length
      ? await sb.from("compta_ligne").select("ecriture_id,compte_id,libelle,debit_fcfa,credit_fcfa").eq("pharmacie_id", profile.pharmacie_id).in("ecriture_id", entryIds).limit(limit)
      : { data: [], error: null };
    if (lineResult.error) return NextResponse.json({ error: "lignes_comptables_indisponibles" }, { status: 503 });
    const lineRows = (lineResult.data ?? []) as Row[];
    sourceTruncated = sourceTruncated || lineRows.length === limit;
    const accountIds = [...new Set(lineRows.map(line => String(line.compte_id ?? "")).filter(Boolean))];
    const accountResult = accountIds.length
      ? await sb.from("compta_plan_comptable").select("id,code,libelle,classe,statut").eq("pharmacie_id", profile.pharmacie_id).in("id", accountIds)
      : { data: [], error: null };
    if (accountResult.error) return NextResponse.json({ error: "plan_comptable_indisponible" }, { status: 503 });
    const accounts = new Map(((accountResult.data ?? []) as Row[]).map(account => [String(account.id), account]));
    const entries = new Map(rows.map(entry => [String(entry.id), entry]));
    if (type === "grand_livre") {
      records = lineRows.map(line => {
        const entry = entries.get(String(line.ecriture_id));
        const account = accounts.get(String(line.compte_id));
        return [
          String(entry?.date_ecriture ?? ""), String(entry?.journal_code ?? ""),
          String(entry?.reference_source ?? entry?.id ?? ""), String(account?.code ?? line.compte_id ?? ""),
          String(account?.libelle ?? "Compte absent du référentiel"), String(line.libelle ?? ""),
          String(line.debit_fcfa ?? "0"), String(line.credit_fcfa ?? "0"), String(account?.statut ?? "absent"),
        ];
      });
    } else {
      const grouped = new Map<string, { account: Row; debit: bigint; credit: bigint }>();
      for (const line of lineRows) {
        const id = String(line.compte_id ?? "");
        const account = accounts.get(id) ?? { id, code: id, libelle: "Compte absent du référentiel", classe: null, statut: "absent" };
        const current = grouped.get(id) ?? { account, debit: 0n, credit: 0n };
        current.debit += BigInt(String(line.debit_fcfa ?? "0"));
        current.credit += BigInt(String(line.credit_fcfa ?? "0"));
        grouped.set(id, current);
      }
      records = [...grouped.values()].sort((a,b) => String(a.account.code).localeCompare(String(b.account.code), "fr")).map(({account,debit,credit}) => [
        String(account.code ?? ""), String(account.libelle ?? ""), account.classe == null ? "À renseigner" : Number(account.classe),
        debit.toString(), credit.toString(), (debit > credit ? debit-credit : 0n).toString(), (credit > debit ? credit-debit : 0n).toString(), String(account.statut ?? "absent"),
      ]);
    }
  } else {
    records = rows.map((row) => {
      if (type === "ventes") return [String(row.created_at ?? ""), String(row.paid_at ?? ""), String(row.numero_vente ?? ""), String(row.statut ?? ""), Number(row.total_brut ?? 0), Number(row.remise ?? 0), Number(row.total_net ?? 0), String(row.mode_paiement ?? ""), String(row.paiement_ref ?? "")];
      if (type === "depenses") return [String(row.date_depense ?? ""), String(row.reference ?? ""), Number(row.montant ?? 0), String(row.statut ?? ""), String(row.created_at ?? "")];
      if (type === "tresorerie") return [String(row.date_operation ?? ""), String(row.nature ?? ""), Number(row.montant ?? 0), String(row.reference ?? ""), String(row.source_type ?? ""), String(row.source_id ?? "")];
      return [String(row.date_ecriture ?? ""), String(row.journal_code ?? ""), String(row.reference_source ?? ""), String(row.libelle ?? ""), String(row.source_type ?? ""), String(row.source_id ?? "")];
    });
  }
  const metadata = [
    ["Rapport NAXA — état préparé à contrôler par votre expert-comptable"],
    ["Pharmacie", pharmacyName],
    ["Identifiant pharmacie", profile.pharmacie_id],
    ["Généré le", new Date().toISOString()],
    ["Période début", debut ?? "Non précisée"],
    ["Période fin", fin ?? "Non précisée"],
    ["Lignes exportées", records.length],
    ["Limite atteinte", sourceTruncated || records.length === limit ? "Oui — export potentiellement tronqué" : "Non"],
    [],
  ];
  const filename = `naxa-${type}-${debut ?? "debut"}-${fin ?? "fin"}`;
  const requestedFormat = url.searchParams.get("format");
  const format = requestedFormat === "xlsx" ? "xlsx" : requestedFormat === "pdf" ? "pdf" : "csv";
  const finalizeExport = async (bytes: Uint8Array, contentType: string, extension: string) => {
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const audit = await supabaseAdmin().rpc("compta_auditer", {
      p_pharmacie: profile.pharmacie_id,
      p_acteur: auth.user.id,
      p_action: "export_generation",
      p_objet_type: type,
      p_objet_id: filename,
      p_resultat: "succes",
      p_motif: `format=${format}; debut=${debut ?? "non_precise"}; fin=${fin ?? "non_precise"}; lignes=${records.length}; tronque=${sourceTruncated || records.length === limit}; sha256=${sha256}`,
    });
    if (audit.error) return NextResponse.json({ error: "journalisation_export_indisponible" }, { status: 503 });
    return new NextResponse(bytes, { headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}.${extension}"`,
      "Cache-Control": "no-store",
      "X-NAXA-Export-Rows": String(records.length),
      "X-NAXA-Export-Truncated": sourceTruncated || records.length === limit ? "true" : "false",
      "X-NAXA-Export-SHA256": sha256,
    }});
  };
  if (format === "pdf") {
    const pdfRows = [
      "NAXA - Rapport comptable",
      `Type: ${type} | Pharmacie: ${pharmacyName}`,
      `Genere le: ${new Date().toISOString()}`,
      `Periode: ${debut ?? "non precise"} au ${fin ?? "non precise"}`,
      `Lignes: ${records.length}${sourceTruncated || records.length === limit ? " - LIMITE ATTEINTE" : ""}`,
      "Etat prepare par NAXA, a controler par votre expert-comptable.",
      "",
      columns.join(" | "),
      ...records.map(row => row.map(pdfAscii).join(" | ")),
      "",
      "Document limite a une page; consulter CSV/Excel pour le detail complet.",
    ];
    sourceTruncated = sourceTruncated || pdfRows.length > 48;
    const bytes = createSimplePdf(pdfRows);
    return finalizeExport(bytes, "application/pdf", "pdf");
  }
  if (format === "xlsx") {
    const workbook = XLSX.utils.book_new();
    const safeRecords = records.map((row) => row.map((cell) => safeCell(cell)));
    const sheet = XLSX.utils.aoa_to_sheet([...metadata, columns, ...safeRecords]);
    XLSX.utils.book_append_sheet(workbook, sheet, "Rapport");
    const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }) as Buffer;
    return finalizeExport(new Uint8Array(buffer), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx");
  }
  const csv = [...metadata, columns, ...records].map(row => row.map(csvEscape).join(";")).join("\r\n");
  return finalizeExport(new TextEncoder().encode("\uFEFF" + csv), "text/csv; charset=utf-8", "csv");
}
