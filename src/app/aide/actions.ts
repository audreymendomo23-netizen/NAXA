"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";

const value = (form: FormData, key: string, max: number) =>
  String(form.get(key) ?? "").trim().slice(0, max);

async function sessionProfile() {
  const sb = supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/connexion?retour=/aide");
  const { data: profile, error } = await sb
    .from("profiles")
    .select("id,role,pharmacie_id,actif")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (error || !profile || profile.actif === false) redirect("/connexion?erreur=profil");
  return { sb, profile };
}

export async function ouvrirChatPharmacien(form: FormData) {
  const { sb, profile } = await sessionProfile();
  if (profile.role !== "client") redirect("/aide?erreur=compte");
  const pharmacyId = value(form, "pharmacie_id", 36);
  const message = value(form, "message", 2000);
  if (!/^[0-9a-f-]{36}$/i.test(pharmacyId) || message.length < 1) {
    redirect("/aide?erreur=message");
  }

  const { data: pharmacy, error: pharmacyError } = await sb
    .from("pharmacies")
    .select("id")
    .eq("id", pharmacyId)
    .eq("actif", true)
    .eq("visible_recherche", true)
    .is("archivee_le", null)
    .maybeSingle();
  if (pharmacyError || !pharmacy) redirect("/aide?erreur=pharmacie");

  const { data: ticketId, error } = await sb.rpc("open_pharmacist_chat", {
    p_pharmacy_id: pharmacyId,
    p_message: message,
  });
  if (error || typeof ticketId !== "string") redirect("/aide?erreur=envoi");
  revalidatePath("/aide");
  revalidatePath("/pharmacie/aide");
  redirect("/aide?ticket=" + encodeURIComponent(ticketId));
}

export async function envoyerMessageChat(form: FormData) {
  const { sb, profile } = await sessionProfile();
  if (profile.role !== "client" && profile.role !== "pharmacie" && profile.role !== "promoteur") redirect("/aide?erreur=compte");
  const ticketId = value(form, "ticket_id", 36);
  const message = value(form, "message", 2000);
  const returnTo = profile.role === "pharmacie" || profile.role === "promoteur" ? "/pharmacie/aide" : "/aide";
  if (!/^[0-9a-f-]{36}$/i.test(ticketId) || message.length < 1) {
    redirect(returnTo + "?erreur=message");
  }

  if (profile.role === "promoteur") {
    if (profile.actif !== true) redirect("/connexion?erreur=profil");
    const { data: links, error: linksError } = await sb.from("promoteur_pharmacies").select("pharmacie_id").eq("promoteur_id", profile.id).eq("actif", true);
    if (linksError || !links?.length) redirect(returnTo + "?erreur=compte");
    const { data: ticket, error: ticketError } = await sb.from("tickets_support").select("pharmacie_id").eq("id", ticketId).maybeSingle();
    if (ticketError || !ticket || !links.some((link) => link.pharmacie_id === ticket.pharmacie_id)) redirect(returnTo + "?erreur=compte");
  }
  const { error } = await sb.from("messages_support").insert({
    ticket_id: ticketId,
    auteur_profile_id: profile.id,
    contenu: message,
    interne: false,
  });
  if (error) redirect(returnTo + "?erreur=envoi");
  revalidatePath("/aide");
  revalidatePath("/pharmacie/aide");
  redirect(returnTo + (profile.role === "client" ? "?ticket=" : "?ticket=") + encodeURIComponent(ticketId));
}
