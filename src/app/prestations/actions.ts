"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseServer, supabaseAdmin } from "@/lib/supabase/server";

const uuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export async function requestHomeService(form: FormData) {
  const offerId = String(form.get("offer_id") ?? "");
  const area = String(form.get("area_label") ?? "").trim();
  const address = String(form.get("exact_address") ?? "").trim();
  const phone = String(form.get("contact_phone") ?? "").trim();
  const submittedNote = String(form.get("client_note") ?? "").trim();
  const source = String(form.get("source_demande") ?? "");
  const note = (source === "dispositifs-connectes"
    ? "[Assistance demandée depuis l’univers Dispositifs connectés] " + submittedNote
    : submittedNote).slice(0, 500);
  const shareLocation = String(form.get("share_location") ?? "") === "true";
  const rawLatitude = String(form.get("shared_latitude") ?? "").trim();
  const rawLongitude = String(form.get("shared_longitude") ?? "").trim();
  const rawAccuracy = String(form.get("shared_accuracy_m") ?? "").trim();
  let sharedLatitude: number | null = null;
  let sharedLongitude: number | null = null;
  let sharedAccuracy: number | null = null;
  if (shareLocation) {
    sharedLatitude = Number(rawLatitude);
    sharedLongitude = Number(rawLongitude);
    sharedAccuracy = Number(rawAccuracy);
    if (!rawLatitude || !rawLongitude || !rawAccuracy ||
      !Number.isFinite(sharedLatitude) || sharedLatitude < -90 || sharedLatitude > 90 ||
      !Number.isFinite(sharedLongitude) || sharedLongitude < -180 || sharedLongitude > 180 ||
      !Number.isFinite(sharedAccuracy) || sharedAccuracy < 0 || sharedAccuracy > 10000) {
      redirect("/prestations?erreur=validation");
    }
  }
  const preferredRaw = String(form.get("preferred_at") ?? "").trim();
  let preferredAt: string | null = null;

  if (preferredRaw) {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(preferredRaw)) {
      redirect("/prestations?erreur=validation");
    }
    // Cameroon uses Africa/Douala (UTC+01:00 year-round).
    const parsed = new Date(preferredRaw + ":00+01:00");
    if (Number.isNaN(parsed.valueOf()) || parsed.getTime() <= Date.now()) {
      redirect("/prestations?erreur=validation");
    }
    preferredAt = parsed.toISOString();
  }

  if (!uuid(offerId) || area.length < 2 || area.length > 180 ||
      address.length < 5 || address.length > 500 || phone.length < 7 || phone.length > 40 ||
      note.length > 500) {
    redirect("/prestations?erreur=validation");
  }

  const sb = supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/connexion?retour=/prestations");

  let requestResult: any;
  try {
    requestResult = await (supabaseAdmin() as any).rpc("request_home_service_with_location", {
    p_client_id: auth.user.id,
    p_offer_id: offerId,
    p_area_label: area,
    p_exact_address: address,
    p_contact_phone: phone,
    p_preferred_at: preferredAt,
    p_client_note: note || null,
    p_shared_latitude: sharedLatitude,
    p_shared_longitude: sharedLongitude,
    p_accuracy_m: sharedAccuracy,
    });
  } catch {
    redirect("/prestations?erreur=indisponible");
  }
  const { data: requestId, error } = requestResult;
  if (error || !requestId) redirect("/prestations?erreur=indisponible");

  revalidatePath("/prestations");
  redirect("/prestations/demande/" + String(requestId));
}

export async function cancelHomeServiceRequest(form: FormData) {
  const requestId = String(form.get("request_id") ?? "");
  if (!uuid(requestId)) redirect("/prestations?erreur=demande");

  const sb = supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/connexion?retour=/prestations/demande/" + requestId);

  const { error } = await sb.rpc("transition_home_service_request", {
    p_request_id: requestId,
    p_status: "cancelled",
  });
  if (error) redirect("/prestations/demande/" + requestId + "?erreur=annulation");

  const { data: request } = await sb.from("home_service_requests").select("status").eq("id", requestId).maybeSingle();
  if (request?.status !== "cancelled") redirect("/prestations/demande/" + requestId + "?erreur=annulation");
  revalidatePath("/prestations");
  revalidatePath("/client");
  revalidatePath("/partenaire/prestations");
  redirect("/prestations/demande/" + requestId + "?ok=annulation");
}
