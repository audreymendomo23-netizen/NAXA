import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import webpush from "web-push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Schedule = {
  id: string;
  user_id: string;
  heures: string[];
  timezone: string;
  last_notified_key: string | null;
};

function zonedParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone || "Africa/Douala",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}`,
  };
}

function isMissingFeatureSchema(error: unknown) {
  const code = error && typeof error === "object" && "code" in error
    ? String((error as { code?: unknown }).code ?? "")
    : "";
  return ["42P01", "42703", "PGRST200", "PGRST204", "PGRST205"].includes(code);
}

export async function GET(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const bearer = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!bearer) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  let db: ReturnType<typeof supabaseAdmin>;
  try {
    // Respecte la clé serveur propre à l'environnement :
    // SUPABASE_SECRET_KEY sur Preview/Development, clé historique Production uniquement en Production.
    db = supabaseAdmin();
  } catch {
    return NextResponse.json({ error: "Accès Supabase serveur indisponible" }, { status: 503 });
  }

  if (process.env.VERCEL_ENV === "production") {
    // En Production, le jeton de ce dispatcher est celui conservé dans Supabase Vault.
    // Le compareur ne renvoie jamais le secret et n'est exécutable que par service_role.
    const { data: authorized, error: authorizationError } = await db.rpc(
      "naxa_verify_posology_cron_secret",
      { p_candidate: bearer },
    );
    if (authorizationError || authorized !== true) {
      console.error("Posology cron authentication rejected", authorizationError?.message ?? "invalid token");
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
  } else {
    // Preview/Development utilisent le secret propre à leur environnement.
    const secret = process.env.CRON_SECRET;
    if (!secret || bearer !== secret) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
  }

  const publicKey = process.env.NAXA_VAPID_PUBLIC_KEY;
  const privateKey = process.env.NAXA_VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    return NextResponse.json({ error: "Configuration Push serveur incomplète" }, { status: 503 });
  }

  webpush.setVapidDetails(
    process.env.NAXA_VAPID_SUBJECT || "mailto:naxa.home@gmail.com",
    publicKey,
    privateKey,
  );
  const { data, error } = await db
    .from("naxa_posologie_schedules")
    .select("id,user_id,heures,timezone,last_notified_key")
    .eq("rappels", true)
    .limit(5000);

  if (error) {
    return NextResponse.json({ error: "Lecture des rappels impossible" }, { status: 500 });
  }

  const now = new Date();
  let due = 0;
  let sent = 0;
  let failed = 0;

  for (const schedule of (data ?? []) as Schedule[]) {
    if (!Array.isArray(schedule.heures) || schedule.heures.length === 0) continue;

    // Le déclencheur gratuit peut s'exécuter toutes les 5 minutes :
    // inspecter les 6 dernières minutes et dédupliquer sur l'heure prévue.
    const candidates = Array.from({ length: 6 }, (_, index) =>
      zonedParts(new Date(now.getTime() - index * 60_000), schedule.timezone || "Africa/Douala"),
    );
    const matched = candidates.find(candidate => schedule.heures.includes(candidate.time));
    if (!matched) continue;

    const key = `${matched.date}T${matched.time}`;
    if (schedule.last_notified_key === key) continue;
    due++;

    // Le filtre inclut explicitement NULL : neq(key) seul ne sélectionne pas les NULL.
    const { data: claimed, error: claimError } = await db
      .from("naxa_posologie_schedules")
      .update({ last_notified_key: key, updated_at: now.toISOString() })
      .eq("id", schedule.id)
      .or(`last_notified_key.is.null,last_notified_key.neq.${key}`)
      .select("id")
      .maybeSingle();

    if (claimError || !claimed) continue;

    const { data: subscriptions, error: subscriptionError } = await db
      .from("naxa_push_subscriptions")
      .select("endpoint,subscription")
      .eq("user_id", schedule.user_id);

    if (subscriptionError || !subscriptions?.length) {
      // Permet une nouvelle tentative si la lecture échoue ou si aucun appareil n'est inscrit.
      await db.from("naxa_posologie_schedules")
        .update({ last_notified_key: null, updated_at: new Date().toISOString() })
        .eq("id", schedule.id)
        .eq("last_notified_key", key);
      if (subscriptionError) failed++;
      continue;
    }

    let sentForSchedule = 0;
    const payload = JSON.stringify({
      title: "Rappel NAXA",
      body: "Une prise prévue vous attend. Ouvrez NAXA pour consulter votre planning.",
      url: "/client/posologie",
      tag: `naxa-${schedule.id}-${key}`,
    });

    for (const subscription of subscriptions) {
      try {
        await webpush.sendNotification(subscription.subscription, payload, {
          TTL: 300,
          urgency: "normal",
        });
        sent++;
        sentForSchedule++;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await db.from("naxa_push_subscriptions")
            .delete()
            .eq("endpoint", subscription.endpoint)
            .eq("user_id", schedule.user_id);
        } else {
          failed++;
        }
      }
    }

    // Si tous les envois ont échoué, libérer la clé pour retenter au prochain passage.
    if (sentForSchedule === 0) {
      await db.from("naxa_posologie_schedules")
        .update({ last_notified_key: null, updated_at: new Date().toISOString() })
        .eq("id", schedule.id)
        .eq("last_notified_key", key);
    }
  }

  // Rappels personnels de suivi : même moteur planifié que les rappels déjà déployés.
  // Les notifications ne contiennent aucune mesure ni information médicale sur l’écran verrouillé.
  type SuiviReminder = {
    id: string;
    user_id: string;
    measurement_type: string;
    title: string;
    due_at: string;
    repeat_rule: "none" | "daily" | "weekly";
    enabled: boolean;
  };
  const familyForMeasurement = (type: string): string | null => {
    if (["tension_systolique","tension_diastolique","frequence_cardiaque","temperature","saturation_oxygene","frequence_respiratoire","debit_expiratoire","ecg_note","capacite_vitale"].includes(type)) return "constantes";
    if (["glycemie","poids","taille","imc","cholesterol_total","masse_grasse","masse_musculaire","masse_osseuse","cetonemie","acide_urique","cholesterol_hdl","cholesterol_ldl"].includes(type)) return "metabolisme";
    if (["pas_jour","activite_minutes","hydratation_ml"].includes(type)) return "activite";
    if (type === "sommeil_heures") return "sommeil";
    if (["douleur_score","humeur_score","cycle_jour","symptome_note"].includes(type)) return "bien_etre";
    if (type === "medicament_pris") return "traitements";
    return null;
  };

  const { data: suiviReminders, error: suiviReadError } = await db
    .from("suivi_reminders")
    .select("id,user_id,measurement_type,title,due_at,repeat_rule,enabled")
    .eq("enabled", true)
    .lte("due_at", now.toISOString())
    .limit(5000);
  let suiviDue = 0;
  let suiviSent = 0;
  let suiviFailed = 0;

  if (suiviReadError) {
    failed++;
  } else {
    for (const reminder of (suiviReminders ?? []) as SuiviReminder[]) {
      const family = familyForMeasurement(reminder.measurement_type);
      if (!family) {
        await db.from("suivi_reminders")
          .update({ enabled: false, updated_at: now.toISOString() })
          .eq("id", reminder.id).eq("enabled", true);
        continue;
      }
      const { data: consent } = await db.from("suivi_consents")
        .select("granted")
        .eq("user_id", reminder.user_id)
        .eq("family_key", family)
        .maybeSingle();
      if (!consent?.granted) {
        // Une révocation de consentement rend le rappel inactif, même si l’interface n’est pas ouverte.
        await db.from("suivi_reminders")
          .update({ enabled: false, updated_at: now.toISOString() })
          .eq("id", reminder.id).eq("enabled", true);
        continue;
      }

      const originalDue = reminder.due_at;
      const dueTimestamp = new Date(originalDue).getTime();
      if (!Number.isFinite(dueTimestamp)) continue;
      const nextValues: { enabled: boolean; due_at?: string; updated_at: string } = {
        enabled: reminder.repeat_rule !== "none",
        updated_at: now.toISOString(),
      };
      if (reminder.repeat_rule !== "none") {
        const interval = reminder.repeat_rule === "weekly" ? 7 * 86400000 : 86400000;
        let nextDue = dueTimestamp;
        while (nextDue <= now.getTime()) nextDue += interval;
        nextValues.due_at = new Date(nextDue).toISOString();
      }

      // Mise à jour conditionnelle : une seule exécution cron peut revendiquer cette échéance.
      const { data: claimed, error: claimError } = await db.from("suivi_reminders")
        .update(nextValues)
        .eq("id", reminder.id)
        .eq("enabled", true)
        .eq("due_at", originalDue)
        .select("id")
        .maybeSingle();
      if (claimError || !claimed) continue;
      suiviDue++;

      const { error: notificationError } = await db.from("notifications").insert({
        user_id: reminder.user_id,
        type: "suivi_rappel",
        titre: "Rappel personnel NAXA",
        corps: "Un rappel personnel de suivi est arrivé à échéance. Ouvrez NAXA pour le consulter.",
      });
      if (notificationError) suiviFailed++;

      const { data: subscriptions, error: subscriptionsError } = await db
        .from("naxa_push_subscriptions")
        .select("endpoint,subscription")
        .eq("user_id", reminder.user_id);
      if (subscriptionsError) {
        suiviFailed++;
        continue;
      }
      const payload = JSON.stringify({
        title: "Rappel personnel NAXA",
        body: "Un rappel de suivi est arrivé à échéance. Ouvrez NAXA pour le consulter.",
        url: "/suivi",
        tag: `naxa-suivi-${reminder.id}-${originalDue}`,
      });
      for (const subscription of subscriptions ?? []) {
        try {
          await webpush.sendNotification(subscription.subscription, payload, { TTL: 300, urgency: "normal" });
          sent++;
          suiviSent++;
        } catch (error) {
          const status = (error as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            await db.from("naxa_push_subscriptions")
              .delete().eq("endpoint", subscription.endpoint).eq("user_id", reminder.user_id);
          } else {
            failed++;
            suiviFailed++;
          }
        }
      }
    }
  }

  const today = now.toISOString().slice(0, 10);
  const { data: favorisReminders, error: favorisReminderError } = await db
    .from("naxa_favoris_rappels").select("id,user_id,produit_ref,produit_nom,reminder_date")
    .eq("actif", true).is("notified_at", null).lte("reminder_date", today).limit(5000);
  let favorisRappelsDus = 0, favorisRappelsPush = 0, favorisRappelsEchecs = 0;
  if (favorisReminderError) { failed++; favorisRappelsEchecs++; }
  else for (const reminder of favorisReminders ?? []) {
    const { data: claimed, error: claimError } = await db.from("naxa_favoris_rappels")
      .update({ notified_at: now.toISOString(), updated_at: now.toISOString() })
      .eq("id", reminder.id).eq("actif", true).is("notified_at", null).select("id").maybeSingle();
    if (claimError || !claimed) continue;
    favorisRappelsDus++;
    const { error: notifError } = await db.from("notifications").insert({
      user_id: reminder.user_id, type: "favoris_rappel_renouvellement",
      titre: "Votre rappel NAXA",
      corps: "Un rappel que vous avez programmé est arrivé à échéance. Ouvrez Mes favoris pour consulter vos options.",
      related_entity_id: reminder.id,
    });
    if (notifError) favorisRappelsEchecs++;
    const { data: subs, error: subsError } = await db.from("naxa_push_subscriptions")
      .select("endpoint,subscription").eq("user_id", reminder.user_id);
    if (subsError) { failed++; favorisRappelsEchecs++; continue; }
    for (const sub of subs ?? []) try {
      await webpush.sendNotification(sub.subscription, JSON.stringify({
        title: "Votre rappel NAXA",
        body: "Un rappel que vous avez programmé est arrivé à échéance. Ouvrez vos favoris.",
        url: "/client/profil/favoris", tag: `naxa-favoris-${reminder.id}`,
      }), { TTL: 300, urgency: "normal" });
      sent++; favorisRappelsPush++;
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) await db.from("naxa_push_subscriptions").delete().eq("endpoint", sub.endpoint).eq("user_id", reminder.user_id);
      else { failed++; favorisRappelsEchecs++; }
    }
  }

  // Rappels des rendez-vous Prestations : même dispatcher VAPID/cron que les autres alertes NAXA.
  // Les lignes pending sont créées avant leur échéance, puis revendiquées après due_at.
  let homeServiceChecked = 0;
  let homeServiceRemindersDue = 0;
  let homeServiceRemindersPush = 0;
  let homeServiceRemindersFailed = 0;
  let homeServiceAvailable = true;
  let homeServiceSchemaReady = true;

  const homeServiceWindowStart = new Date(now.getTime() - 6 * 60_000).toISOString();
  const homeServiceWindowEnd = new Date(now.getTime() + 8 * 86400_000).toISOString();
  const { data: homeServiceRequests, error: homeServiceRequestsError } = await db
    .from("home_service_requests")
    .select("id,partner_id,scheduled_at")
    .eq("status", "confirmed")
    .not("scheduled_at", "is", null)
    .gte("scheduled_at", homeServiceWindowStart)
    .lte("scheduled_at", homeServiceWindowEnd)
    .limit(5000);

  if (homeServiceRequestsError) {
    if (isMissingFeatureSchema(homeServiceRequestsError)) {
      homeServiceAvailable = false;
      homeServiceSchemaReady = false;
      console.warn("Home-service reminders not active: apply the appointment/reminder migration first.");
    } else {
      failed++;
      homeServiceRemindersFailed++;
    }
  } else {
    homeServiceChecked = homeServiceRequests?.length ?? 0;
    const partnerIds = [...new Set((homeServiceRequests ?? []).map((r: { partner_id: string }) => r.partner_id))];

    if (partnerIds.length) {
      const [preferencesResult, membersResult] = await Promise.all([
        db.from("home_service_reminder_preferences")
          .select("partner_id,user_id,offsets_minutes")
          .eq("enabled", true)
          .in("partner_id", partnerIds),
        db.from("partner_members")
          .select("partner_id,user_id,member_role,partners!inner(status,partner_type)")
          .in("partner_id", partnerIds)
          .in("member_role", ["owner", "manager", "operator"]),
      ]);

      if (preferencesResult.error || membersResult.error) {
        const schemaError = preferencesResult.error ?? membersResult.error;
        if (isMissingFeatureSchema(schemaError)) {
          homeServiceAvailable = false;
          homeServiceSchemaReady = false;
          console.warn("Home-service reminder preferences not available until their migration is applied.");
        } else {
          failed++;
          homeServiceRemindersFailed++;
        }
      } else {
        const userIds = [...new Set((membersResult.data ?? [])
          .map((m: { user_id: string | null }) => m.user_id).filter((id: string | null): id is string => Boolean(id)))];
        const { data: activeProfiles, error: activeProfilesError } = userIds.length
          ? await db.from("profiles").select("id").in("id", userIds).eq("actif", true)
          : { data: [], error: null };
        if (activeProfilesError) {
          failed++;
          homeServiceRemindersFailed++;
        } else {
          const activeUserIds = new Set((activeProfiles ?? []).map((p: { id: string }) => p.id));
          const memberSet = new Set((membersResult.data ?? [])
            .filter((m: any) => m.partners?.status === "active" &&
              m.partners?.partner_type === "professionnel_domicile" &&
              m.member_role && activeUserIds.has(m.user_id))
            .map((m: any) => `${m.partner_id}:${m.user_id}`));
          const prefsByPartner = new Map<string, any[]>();
          for (const preference of preferencesResult.data ?? []) {
            const list = prefsByPartner.get(preference.partner_id) ?? [];
            list.push(preference);
            prefsByPartner.set(preference.partner_id, list);
          }

          const dispatchRows: any[] = [];
          for (const appointment of homeServiceRequests ?? []) {
            const scheduledTime = new Date(appointment.scheduled_at).getTime();
            if (!Number.isFinite(scheduledTime)) continue;
            for (const preference of prefsByPartner.get(appointment.partner_id) ?? []) {
              if (!memberSet.has(`${appointment.partner_id}:${preference.user_id}`)) continue;
              const offsets = Array.isArray(preference.offsets_minutes) ? preference.offsets_minutes : [];
              for (const offset of offsets) {
                const minutes = Number(offset);
                if (![0, 15, 30, 60, 120, 1440].includes(minutes)) continue;
                dispatchRows.push({
                  request_id: appointment.id,
                  recipient_id: preference.user_id,
                  offset_minutes: minutes,
                  scheduled_at: appointment.scheduled_at,
                  due_at: new Date(scheduledTime - minutes * 60_000).toISOString(),
                });
              }
            }
          }

          if (dispatchRows.length) {
            const { error: upsertError } = await db.from("home_service_reminder_dispatches")
              .upsert(dispatchRows, {
                onConflict: "request_id,recipient_id,offset_minutes",
                ignoreDuplicates: true,
              });
            if (upsertError) {
              if (isMissingFeatureSchema(upsertError)) {
                homeServiceAvailable = false;
                homeServiceSchemaReady = false;
                console.warn("Home-service reminder dispatch table is not installed yet.");
              } else {
                failed++;
                homeServiceRemindersFailed++;
              }
            }
          }

          const { data: pendingDispatches, error: pendingError } = homeServiceSchemaReady
            ? await db.rpc("claim_home_service_reminder_dispatches", { p_batch_size: 500 })
            : { data: [], error: null };
          if (pendingError) {
            if (isMissingFeatureSchema(pendingError)) {
              homeServiceAvailable = false;
              homeServiceSchemaReady = false;
            } else {
              failed++;
              homeServiceRemindersFailed++;
            }
          } else {
            const subscriptionCache = new Map<string, any[]>();
            for (const dispatch of pendingDispatches ?? []) {
              homeServiceRemindersDue++;

              if (!dispatch.notification_created_at) {
                const lead = Number(dispatch.offset_minutes);
                const when = lead === 0 ? "maintenant" : lead === 60 ? "dans 1 heure" :
                  lead === 1440 ? "dans 24 heures" : `dans ${lead} minutes`;
                const { error: notificationError } = await db.from("notifications").insert({
                  user_id: dispatch.recipient_id,
                  type: "home_service_appointment_reminder",
                  titre: lead === 0 ? "Votre rendez-vous commence maintenant" : `Rendez-vous ${when}`,
                  corps: "Un rendez-vous confirmé de prestations à domicile approche. Ouvrez NAXA pour consulter les détails.",
                });
                if (notificationError) {
                  failed++;
                  homeServiceRemindersFailed++;
                  await db.from("home_service_reminder_dispatches")
                    .update({ state: "pending", locked_at: null, last_error: "notification_insert_failed", updated_at: new Date().toISOString() })
                    .eq("id", dispatch.dispatch_id).eq("state", "processing");
                  continue;
                }
                const { error: markNotificationError } = await db.from("home_service_reminder_dispatches")
                  .update({ notification_created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
                  .eq("id", dispatch.dispatch_id).eq("state", "processing");
                if (markNotificationError) {
                  failed++;
                  homeServiceRemindersFailed++;
                  await db.from("home_service_reminder_dispatches")
                    .update({ state: "pending", locked_at: null, last_error: "notification_claim_update_failed", updated_at: new Date().toISOString() })
                    .eq("id", dispatch.dispatch_id).eq("state", "processing");
                  continue;
                }
              }

              let subscriptions = subscriptionCache.get(dispatch.recipient_id);
              if (!subscriptions) {
                const { data, error: subscriptionError } = await db.from("naxa_push_subscriptions")
                  .select("endpoint,subscription")
                  .eq("user_id", dispatch.recipient_id);
                if (subscriptionError) {
                  failed++;
                  homeServiceRemindersFailed++;
                  await db.from("home_service_reminder_dispatches")
                    .update({ state: "pending", locked_at: null, last_error: "push_subscription_read_failed", updated_at: new Date().toISOString() })
                    .eq("id", dispatch.dispatch_id).eq("state", "processing");
                  continue;
                }
                subscriptions = data ?? [];
                subscriptionCache.set(dispatch.recipient_id, subscriptions);
              }

              let pushFailed = false;
              const lead = Number(dispatch.offset_minutes);
              const when = lead === 0 ? "maintenant" : lead === 60 ? "dans 1 heure" :
                lead === 1440 ? "dans 24 heures" : `dans ${lead} minutes`;
              const payload = JSON.stringify({
                type: "home_service_appointment_reminder",
                title: lead === 0 ? "Votre rendez-vous commence maintenant" : `Rendez-vous ${when}`,
                body: "Un rendez-vous confirmé de prestations à domicile approche. Ouvrez NAXA pour consulter les détails.",
                url: "/partenaire/prestations",
                tag: `naxa-home-service-${dispatch.request_id}-${dispatch.offset_minutes}-${dispatch.recipient_id}`,
                vibrate: lead === 0 ? [300, 120, 300, 120, 500] : [180, 100, 180],
              });
              for (const subscription of subscriptions) {
                try {
                  await webpush.sendNotification(subscription.subscription, payload, { TTL: 3600, urgency: "high" });
                  sent++;
                  homeServiceRemindersPush++;
                } catch (error) {
                  const status = (error as { statusCode?: number }).statusCode;
                  if (status === 404 || status === 410) {
                    await db.from("naxa_push_subscriptions")
                      .delete().eq("endpoint", subscription.endpoint).eq("user_id", dispatch.recipient_id);
                  } else {
                    pushFailed = true;
                    failed++;
                    homeServiceRemindersFailed++;
                  }
                }
              }

              if (!pushFailed) {
                await db.from("home_service_reminder_dispatches")
                  .update({ state: "sent", locked_at: null, updated_at: new Date().toISOString(), last_error: null })
                  .eq("id", dispatch.dispatch_id).eq("state", "processing");
              } else {
                await db.from("home_service_reminder_dispatches")
                  .update({ state: "pending", locked_at: null, last_error: "push_delivery_failed", updated_at: new Date().toISOString() })
                  .eq("id", dispatch.dispatch_id).eq("state", "processing");
              }
            }
          }
        }
      }
    }
  }

  // Dispatcher central des notifications de tous les univers NAXA.
  // Le contenu des messages est volontairement masqué sur l'écran verrouillé.
  let notificationPushChecked = 0;
  let notificationPushSent = 0;
  let notificationPushFailed = 0;
  const { data: outboxItems, error: outboxError } = await db
    .rpc("claim_naxa_notification_push_outbox", { p_batch_size: 500 });

  let notificationPushAvailable = true;
  if (outboxError) {
    if (isMissingFeatureSchema(outboxError)) {
      notificationPushAvailable = false;
      console.warn("Global NAXA Push outbox not active until its migration is applied.");
    } else {
      failed++;
      notificationPushFailed++;
    }
  } else {
    notificationPushChecked = outboxItems?.length ?? 0;
    const outboxSubscriptions = new Map<string, any[]>();
    for (const item of outboxItems ?? []) {
      let subscriptions = outboxSubscriptions.get(item.recipient_id);
      if (!subscriptions) {
        const { data, error: subscriptionError } = await db.from("naxa_push_subscriptions")
          .select("endpoint,subscription").eq("user_id", item.recipient_id);
        if (subscriptionError) {
          failed++;
          notificationPushFailed++;
          await db.from("naxa_notification_push_outbox")
            .update({ state: "pending", locked_at: null, last_error: "push_subscription_read_failed", updated_at: new Date().toISOString() })
            .eq("id", item.outbox_id).eq("state", "processing");
          continue;
        }
        subscriptions = data ?? [];
        outboxSubscriptions.set(item.recipient_id, subscriptions);
      }

      // L'absence d'appareil inscrit ne bloque pas la notification in-app.
      if (!subscriptions.length) {
        await db.from("naxa_notification_push_outbox")
          .update({ state: "sent", locked_at: null, updated_at: new Date().toISOString(), last_error: "no_push_subscription" })
          .eq("id", item.outbox_id).eq("state", "processing");
        continue;
      }

      const kind = String(item.notification_type ?? "").toLowerCase();
      const isCall = /call|appel|incoming_call/.test(kind);
      const isMessage = /message|sms/.test(kind);
      const isReminder = /rappel|reminder|appointment/.test(kind);
      const title = isCall ? "Appel NAXA" : isMessage ? "Nouveau message NAXA" :
        isReminder ? "Rappel NAXA" : "Notification NAXA";
      const vibrate = isCall ? [700, 250, 700, 250, 900] :
        isMessage ? [180, 80, 180] : isReminder ? [300, 120, 300] : [160, 80, 160];
      const payload = JSON.stringify({
        type: kind,
        title,
        body: "Ouvrez NAXA pour consulter votre notification.",
        url: typeof item.target_url === "string" ? item.target_url : "/notifications",
        tag: `naxa-notification-${item.id}`,
        vibrate,
      });

      let deliveryFailed = false;
      for (const subscription of subscriptions) {
        try {
          await webpush.sendNotification(subscription.subscription, payload, {
            TTL: 3600,
            urgency: isCall || isReminder ? "high" : "normal",
          });
          sent++;
          notificationPushSent++;
        } catch (error) {
          const status = (error as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            await db.from("naxa_push_subscriptions")
              .delete().eq("endpoint", subscription.endpoint).eq("user_id", item.recipient_id);
          } else {
            deliveryFailed = true;
            failed++;
            notificationPushFailed++;
          }
        }
      }

      if (!deliveryFailed) {
        await db.from("naxa_notification_push_outbox")
          .update({ state: "sent", locked_at: null, updated_at: new Date().toISOString(), last_error: null })
          .eq("id", item.outbox_id).eq("state", "processing");
      } else {
        await db.from("naxa_notification_push_outbox")
          .update({ state: "pending", locked_at: null, last_error: "push_delivery_failed", updated_at: new Date().toISOString() })
          .eq("id", item.outbox_id).eq("state", "processing");
      }
    }
  }

  // Un worker planifié ne doit jamais renvoyer un faux vert quand un sous-traitement a échoué.
  // Le dispatcher/pg_cron peut ainsi remonter l'échec HTTP et l'historiser.
  const hasFailures = failed > 0 || suiviFailed > 0 || favorisRappelsEchecs > 0 || homeServiceRemindersFailed > 0 || notificationPushFailed > 0;
  return NextResponse.json({
    ok: !hasFailures,
    checked: data?.length ?? 0,
    due,
    sent,
    failed,
    suiviChecked: suiviReminders?.length ?? 0,
    suiviDue,
    suiviSent,
    suiviFailed,
    favorisRappelsChecked: favorisReminders?.length ?? 0,
    favorisRappelsDus,
    favorisRappelsPush,
    favorisRappelsEchecs,
    homeServiceChecked,
    homeServiceRemindersDue,
    homeServiceRemindersPush,
    homeServiceRemindersFailed,
    notificationPushChecked,
    notificationPushSent,
    notificationPushFailed,
    homeServiceAvailable,
    notificationPushAvailable,
    at: now.toISOString(),
  }, { status: hasFailures ? 503 : 200 });
}
