import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

// Le rappel quotidien est planifié par le job Supabase pg_cron naxa-promoteur-echeance-5j.
// Ne pas ajouter de planification Vercel en parallèle sans retirer le job Supabase.
const escapeHtml = (value: unknown) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#39;");

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = supabaseAdmin();
  const { error: blockError } = await sb.rpc("synchroniser_validite_pharmacies");
  if (blockError) return NextResponse.json({ error: blockError.message }, { status: 500 });

  const { data: rows, error } = await sb.rpc("claim_validite_promoteurs_5j");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!rows?.length) return NextResponse.json({ blocked: "ok", reminders: 0 });

  const promoterIds = [...new Set(rows.map((r: any) => r.promoteur_id).filter(Boolean))];
  const [{ data: links, error: linksError }, { data: profiles, error: profilesError }] = await Promise.all([
    sb.from("promoteur_pharmacies").select("promoteur_id,pharmacie_id").in("promoteur_id", promoterIds),
    sb.from("profiles").select("id,first_name,last_name,username").in("id", promoterIds),
  ]);
  if (linksError || profilesError) {
    return NextResponse.json({ error: "Le nom des Promoteurs ou le rattachement des pharmacies n’a pas pu être chargé." }, { status: 503 });
  }

  const pharmacyIds = [...new Set((links ?? []).map((link: any) => link.pharmacie_id).filter(Boolean))];
  let pharmacyRows: { id: string; nom: string }[] = [];
  if (pharmacyIds.length) {
    const { data, error: pharmacyError } = await sb.from("pharmacies").select("id,nom").in("id", pharmacyIds);
    if (pharmacyError) return NextResponse.json({ error: "Les noms des pharmacies rattachées n’ont pas pu être chargés." }, { status: 503 });
    pharmacyRows = data ?? [];
  }

  const pharmacyNamesById = new Map(pharmacyRows.map((pharmacy) => [pharmacy.id, pharmacy.nom]));
  const pharmaciesByPromoter = new Map<string, string[]>();
  for (const link of links ?? []) {
    const name = pharmacyNamesById.get(link.pharmacie_id);
    if (!name) continue;
    const names = pharmaciesByPromoter.get(link.promoteur_id) ?? [];
    if (!names.includes(name)) names.push(name);
    pharmaciesByPromoter.set(link.promoteur_id, names);
  }
  for (const names of pharmaciesByPromoter.values()) names.sort((a, b) => a.localeCompare(b, "fr"));
  const profilesById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  const labelForPromoter = (promoterId: string, fallback?: string | null) => {
    const profile = profilesById.get(promoterId);
    return [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || profile?.username || fallback || promoterId;
  };
  const labelsForPharmacies = (promoterId: string) => {
    const names = pharmaciesByPromoter.get(promoterId) ?? [];
    return names.length ? names.join(", ") : "Aucune pharmacie rattachée";
  };

  const key = process.env.RESEND_API_KEY;
  const from = process.env.REPORT_FROM_EMAIL;
  const { data: admins } = await sb.from("profiles").select("id").eq("role", "admin").eq("actif", true);

  for (const r of rows) {
    const promoterName = labelForPromoter(r.promoteur_id, r.promoteur_prenom);
    const pharmacyNames = labelsForPharmacies(r.promoteur_id);
    const promoterBody = `Compte Promoteur : ${promoterName}. Pharmacie(s) : ${pharmacyNames}. Votre abonnement mensuel arrive à échéance le ${r.echeance}. Montant à régler : ${Number(r.montant_mensuel).toLocaleString("fr-FR")} FCFA. Soumettez vos références et votre preuve dans « Mes paiements » après avoir effectué le paiement.`;
    const { data: existingPromoterNotice } = await sb.from("notifications").select("id")
      .eq("user_id", r.promoteur_id).eq("type", "abonnement_echeance_5j")
      .gte("created_at", new Date().toISOString().slice(0, 10)).limit(1);
    if (!existingPromoterNotice?.length) {
      await sb.from("notifications").insert({
        user_id: r.promoteur_id, type: "abonnement_echeance_5j",
        titre: "Votre abonnement expire dans 5 jours", corps: promoterBody,
      });
    }
    for (const admin of admins ?? []) {
      const { data: existingAdminNotice } = await sb.from("notifications").select("id")
        .eq("user_id", admin.id).eq("type", "abonnement_echeance_5j_admin")
        .gte("created_at", new Date().toISOString().slice(0, 10)).limit(1);
      if (!existingAdminNotice?.length) {
        await sb.from("notifications").insert({
          user_id: admin.id, type: "abonnement_echeance_5j_admin",
          titre: "Échéance Promoteur dans 5 jours",
          corps: `L’abonnement du Promoteur ${promoterName} — pharmacie(s) : ${pharmacyNames} — arrive à échéance le ${r.echeance}. Tarif mensuel : ${Number(r.montant_mensuel).toLocaleString("fr-FR")} FCFA.`,
        });
      }
    }
  }

  if (!key || !from) return NextResponse.json({ error: "RESEND_API_KEY et REPORT_FROM_EMAIL requis", reminders: 0 }, { status: 503 });
  let sent = 0;
  for (const r of rows) {
    const promoterName = labelForPromoter(r.promoteur_id, r.promoteur_prenom);
    const pharmacyNames = labelsForPharmacies(r.promoteur_id);
    const rr = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [r.promoteur_email],
        subject: "NAXA — rappel : échéance de votre abonnement dans 5 jours",
        html: `<div style="font-family:Arial,sans-serif"><h1>NAXA</h1><p>Bonjour ${escapeHtml(r.promoteur_prenom || promoterName)},</p><p>Compte Promoteur : <strong>${escapeHtml(promoterName)}</strong>.</p><p>Pharmacie(s) rattachée(s) : <strong>${escapeHtml(pharmacyNames)}</strong>.</p><p>Votre convention et votre abonnement arrivent à échéance le <strong>${escapeHtml(r.echeance)}</strong>.</p><p>Montant mensuel à régler : <strong>${Number(r.montant_mensuel).toLocaleString("fr-FR")} FCFA</strong>.</p><p>Merci de procéder au règlement avant l’échéance afin d’éviter le blocage de toutes les pharmacies rattachées à votre périmètre et l’indisponibilité de leurs produits côté client.</p><p>Si le règlement est effectué, NAXA renouvellera l’abonnement et examinera l’état opérationnel des pharmacies selon les règles applicables.</p></div>`,
      }),
    });
    if (rr.ok) {
      await sb.rpc("marquer_rappel_promoteur", { p_promoteur: r.promoteur_id });
      sent++;
    }
  }
  return NextResponse.json({ blocked: "ok", reminders: sent, total: rows.length });
}
