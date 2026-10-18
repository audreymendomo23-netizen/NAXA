import { NextResponse } from "next/server";
import webpush from "web-push";
import { supabaseServer, supabaseAdmin } from "@/lib/supabase/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Body = { filId?: string; messageId?: string };
type IdRow = { id: string };
export async function POST(request: Request) {
  try {
    const session = await supabaseServer();
    const { data: auth, error: authError } = await session.auth.getUser();
    if (authError || !auth.user) return NextResponse.json({ error: "Connexion requise." }, { status: 401 });
    const body = await request.json() as Body;
    if (!body.filId || !body.messageId) return NextResponse.json({ error: "Conversation ou message manquant." }, { status: 400 });
    const admin = supabaseAdmin();
    const [{ data: fil }, { data: message }] = await Promise.all([
      admin.from("fils_messages").select("id,client_id,pharmacie_id,anonyme").eq("id", body.filId).maybeSingle(),
      admin.from("messages_pharmacie").select("id,fil_id,expediteur,corps").eq("id", body.messageId).eq("fil_id", body.filId).maybeSingle()
    ]);
    if (!fil || !message) return NextResponse.json({ error: "Message introuvable." }, { status: 404 });
    let recipients: string[] = [];
    if (fil.client_id === auth.user.id && message.expediteur === "client") {
      const { data: pharmacyUsers } = await admin.from("profiles").select("id").eq("pharmacie_id", fil.pharmacie_id).eq("actif", true).in("role", ["pharmacie", "caisse"]);
      recipients = (pharmacyUsers ?? []).map((row: IdRow) => row.id).filter(id => id !== auth.user.id);
      const { data: links } = await admin.from("promoteur_pharmacies").select("promoteur_id").eq("pharmacie_id", fil.pharmacie_id).eq("actif", true);
      const promoterIds = (links ?? []).map((row: { promoteur_id: string }) => row.promoteur_id);
      if (promoterIds.length) {
        const { data: promoters } = await admin.from("profiles").select("id").in("id", promoterIds).eq("actif", true);
        recipients.push(...(promoters ?? []).map((row: IdRow) => row.id));
      }
      recipients = [...new Set(recipients)];
    } else if (message.expediteur === "pharmacie") {
      const { data: myPharmacies, error } = await session.rpc("my_pharmacies");
      const allowed = Array.isArray(myPharmacies) && myPharmacies.some((row: { pharmacie_id?: string; id?: string }) => (row.pharmacie_id ?? row.id) === fil.pharmacie_id);
      if (error || !allowed) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
      recipients = [fil.client_id];
    } else return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
    const publicKey = process.env.NAXA_VAPID_PUBLIC_KEY;
    const privateKey = process.env.NAXA_VAPID_PRIVATE_KEY;
    if (!publicKey || !privateKey || recipients.length === 0) return NextResponse.json({ ok: true, sent: 0, reason: "Push non configuré ou destinataire indisponible." });
    webpush.setVapidDetails(process.env.NAXA_VAPID_SUBJECT || "mailto:naxa.home@gmail.com", publicKey, privateKey);
    const { data: subscriptions, error: subscriptionError } = await admin.from("naxa_push_subscriptions").select("endpoint,subscription").in("user_id", recipients);
    if (subscriptionError) return NextResponse.json({ error: "Abonnements Push indisponibles." }, { status: 503 });
    const title = message.expediteur === "client" ? (fil.anonyme ? "Nouveau message — client anonyme" : "Nouveau message client") : "Nouvelle réponse de la pharmacie";
    const url = message.expediteur === "client" ? "/pharmacie/messages" : "/client/messages";
    let sent = 0;
    await Promise.all((subscriptions ?? []).map(async (item: { endpoint: string; subscription: webpush.PushSubscription }) => {
      try {
        await webpush.sendNotification(item.subscription, JSON.stringify({ title, body: "Nouveau message reçu. Ouvrez NAXA pour le consulter.", url, tag: "naxa-message-" + body.messageId }));
        sent++;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await admin.from("naxa_push_subscriptions").delete().eq("endpoint", item.endpoint);
      }
    }));
    return NextResponse.json({ ok: true, sent });
  } catch {
    return NextResponse.json({ error: "Impossible d’envoyer la notification pour le moment." }, { status: 500 });
  }
}
