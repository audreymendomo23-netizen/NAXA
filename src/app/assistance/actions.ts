"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";

const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;
const MAX_MESSAGE_LENGTH = 2000;
const CATEGORIES = new Set([
  "compte", "technique", "commande", "signalement",
  "confidentialite", "suggestion", "autre",
]);
const MIME_EXTENSIONS: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

async function clientSession() {
  const sb = supabaseServer();
  const { data: auth, error: authError } = await sb.auth.getUser();
  if (authError || !auth.user) redirect("/connexion?retour=%2Fassistance");

  const { data: profile, error } = await sb.from("profiles")
    .select("id,role,actif")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (error || !profile || profile.role !== "client" || profile.actif !== true) {
    redirect("/?erreur=assistance_compte");
  }
  return { sb, profile };
}

function field(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim();
}

async function validatedFile(form: FormData): Promise<File | null> {
  const value = form.get("attachment");
  if (!(value instanceof File) || value.size === 0) return null;
  if (!MIME_EXTENSIONS[value.type] || value.size > MAX_ATTACHMENT_BYTES) {
    redirect("/assistance?erreur=piece_jointe");
  }
  const signature = new Uint8Array(await value.slice(0, 12).arrayBuffer());
  const starts = (...bytes: number[]) => bytes.every((byte, index) => signature[index] === byte);
  const validSignature =
    (value.type === "application/pdf" && starts(0x25, 0x50, 0x44, 0x46, 0x2d))
    || (value.type === "image/jpeg" && starts(0xff, 0xd8, 0xff))
    || (value.type === "image/png" && starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))
    || (value.type === "image/webp"
      && String.fromCharCode(...signature.slice(0, 4)) === "RIFF"
      && String.fromCharCode(...signature.slice(8, 12)) === "WEBP");
  if (!validSignature) redirect("/assistance?erreur=piece_jointe");
  return value;
}

function safeFilename(name: string) {
  const cleaned = name.replace(/[^a-zA-Z0-9._ -]/g, "_").replace(/\s+/g, " ").trim();
  return (cleaned || "piece-jointe").slice(0, 180);
}

async function joindreFichier(
  sb: ReturnType<typeof supabaseServer>,
  profileId: string,
  ticketId: string,
  file: File,
) {
  const extension = MIME_EXTENSIONS[file.type];
  const path = profileId + "/" + ticketId + "/" + randomUUID() + "." + extension;
  const filename = safeFilename(file.name || ("piece-jointe." + extension));
  const { error: uploadError } = await sb.storage
    .from("naxa-support-attachments")
    .upload(path, file, {
      contentType: file.type,
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) return false;

  const { error: metadataError } = await sb.from("messages_support").insert({
    ticket_id: ticketId,
    auteur_profile_id: profileId,
    contenu: "Pièce jointe : " + filename,
    interne: false,
    piece_jointe_path: path,
    piece_jointe_nom: filename,
    piece_jointe_mime: file.type,
    piece_jointe_taille: file.size,
  });

  if (metadataError) {
    await sb.storage.from("naxa-support-attachments").remove([path]);
    return false;
  }
  return true;
}

function actualiser() {
  revalidatePath("/assistance");
  revalidatePath("/admin/messagerie");
}

export async function creerDemandeNaxa(form: FormData) {
  const { sb, profile } = await clientSession();
  const categorie = field(form, "categorie");
  const sujet = field(form, "sujet");
  const message = field(form, "message");
  const file = await validatedFile(form);

  if (!CATEGORIES.has(categorie) || sujet.length < 5 || sujet.length > 100
    || message.length < 1 || message.length > MAX_MESSAGE_LENGTH) {
    redirect("/assistance?erreur=formulaire");
  }

  const { data: ticket, error: ticketError } = await sb.from("tickets_support")
    .insert({
      auteur_profile_id: profile.id,
      pharmacie_id: null,
      sujet,
      type: "support_naxa",
      categorie,
      statut: "ouvert",
    })
    .select("id,reference_code")
    .single();

  if (ticketError || !ticket) redirect("/assistance?erreur=envoi");

  const { error: messageError } = await sb.from("messages_support").insert({
    ticket_id: ticket.id,
    auteur_profile_id: profile.id,
    contenu: message,
    interne: false,
  });

  if (messageError) redirect("/assistance?ticket=" + encodeURIComponent(ticket.id) + "&erreur=envoi");

  try {
    const adminDb = supabaseAdmin();
    const { data: admins } = await adminDb.from("profiles")
      .select("id")
      .eq("role", "admin")
      .eq("actif", true);
    if (admins?.length) {
      const { error: notificationError } = await adminDb.from("notifications").insert(
        admins.map((admin) => ({
          user_id: admin.id,
          type: "support_naxa_nouvelle_demande",
          titre: "Nouvelle demande d’assistance Client",
          corps: "Une nouvelle demande NAXA attend son traitement : " + ticket.reference_code + ".",
          related_entity_id: ticket.id,
        })),
      );
      if (notificationError) console.error("support_naxa_new_ticket_notification_failed", notificationError.message);
    }
  } catch (error) {
    console.error("support_naxa_admin_notification_unavailable", error);
  }

  let attachmentWarning = "";
  if (file) {
    const uploaded = await joindreFichier(sb, profile.id, ticket.id, file);
    if (!uploaded) attachmentWarning = "&avertissement=piece_jointe";
  }

  actualiser();
  redirect(
    "/assistance?ticket=" + encodeURIComponent(ticket.id) +
    "&envoye=1" + attachmentWarning,
  );
}

export async function envoyerReponseNaxa(form: FormData) {
  const { sb, profile } = await clientSession();
  const ticketId = field(form, "ticket_id");
  const message = field(form, "message");
  const file = await validatedFile(form);

  if (!/^[0-9a-f-]{36}$/i.test(ticketId)
    || message.length < 1 || message.length > MAX_MESSAGE_LENGTH) {
    redirect("/assistance?erreur=formulaire");
  }

  const { data: ticket, error: ticketError } = await sb.from("tickets_support")
    .select("id,statut")
    .eq("id", ticketId)
    .eq("auteur_profile_id", profile.id)
    .eq("type", "support_naxa")
    .maybeSingle();

  if (ticketError || !ticket || ticket.statut === "ferme") {
    redirect("/assistance?erreur=ticket");
  }

  const { error: messageError } = await sb.from("messages_support").insert({
    ticket_id: ticket.id,
    auteur_profile_id: profile.id,
    contenu: message,
    interne: false,
  });
  if (messageError) redirect("/assistance?ticket=" + encodeURIComponent(ticket.id) + "&erreur=envoi");

  let attachmentWarning = "";
  if (file) {
    const uploaded = await joindreFichier(sb, profile.id, ticket.id, file);
    if (!uploaded) attachmentWarning = "&avertissement=piece_jointe";
  }

  actualiser();
  redirect(
    "/assistance?ticket=" + encodeURIComponent(ticket.id) +
    "&envoye=1" + attachmentWarning,
  );
}
