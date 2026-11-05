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

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const publicKey = process.env.NAXA_VAPID_PUBLIC_KEY;
  const privateKey = process.env.NAXA_VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    return NextResponse.json({ error: "Configuration Push serveur incomplète" }, { status: 503 });
  }

  let db: ReturnType<typeof supabaseAdmin>;
  try {
    // Respecte la clé serveur propre à l'environnement :
    // SUPABASE_SECRET_KEY sur Preview/Development, clé historique Production uniquement en Production.
    db = supabaseAdmin();
  } catch {
    return NextResponse.json({ error: "Accès Supabase serveur indisponible" }, { status: 503 });
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

  return NextResponse.json({
    ok: true,
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
    at: now.toISOString(),
  });
}
