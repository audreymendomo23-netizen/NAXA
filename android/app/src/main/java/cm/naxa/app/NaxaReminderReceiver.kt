package cm.naxa.app

import android.app.AlarmManager
import android.app.BroadcastReceiver
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver as AndroidBroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import org.json.JSONObject
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.LocalTime
import java.util.Calendar

object NaxaReminderScheduler {
    private const val PREFS = "naxa_suivi_reminders"
    private const val CHANNEL = "naxa_suivi_measurements"

    fun ensureChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= 26) {
            val manager = context.getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(NotificationChannel(
                CHANNEL, "Rappels de suivi NAXA", NotificationManager.IMPORTANCE_HIGH
            ).apply { description = "Rappels de fraîcheur des mesures programmées." })
        }
    }

    fun save(context: Context, raw: String) {
        val json = JSONObject(raw)
        val id = json.optString("id")
        if (id.isBlank()) return
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString("schedule_" + id, json.toString()).apply()
        scheduleNext(context, id)
    }

    fun remove(context: Context, id: String) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().remove("schedule_" + id).apply()
        val intent = Intent(context, NaxaReminderReceiver::class.java).putExtra("scheduleId", id)
        context.getSystemService(AlarmManager::class.java).cancel(PendingIntent.getBroadcast(
            context, id.hashCode(), intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        ))
    }

    fun updateFreshness(context: Context, measurementType: String, timestamp: Long) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putLong("last_" + measurementType, timestamp).apply()
    }

    fun scheduleAll(context: Context) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        prefs.all.keys.filter { it.startsWith("schedule_") }.forEach { scheduleNext(context, it.removePrefix("schedule_")) }
    }

    fun scheduleNext(context: Context, id: String) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val raw = prefs.getString("schedule_" + id, null) ?: return
        try {
            val json = JSONObject(raw)
            if (!json.optBoolean("enabled", true)) { remove(context, id); return }
            val zone = ZoneId.of(json.optString("timezone", "Africa/Douala"))
            val time = LocalTime.parse(json.getString("localTime"))
            val days = json.optJSONArray("daysOfWeek")
            val lead = json.optInt("leadMinutes", 5).coerceIn(1, 30)
            var target = ZonedDateTime.now(zone).withSecond(0).withNano(0)
            var found: ZonedDateTime? = null
            for (offset in 0..7) {
                val candidate = target.toLocalDate().plusDays(offset.toLong()).atTime(time).atZone(zone)
                val day = (candidate.dayOfWeek.value % 7)
                val active = days == null || (0 until days.length()).any { days.optInt(it, -1) == day }
                if (active && candidate.minusMinutes(lead.toLong()).isAfter(ZonedDateTime.now(zone))) {
                    found = candidate
                    break
                }
            }
            val scheduled = found ?: return
            val alarmAt = scheduled.minusMinutes(lead.toLong()).toInstant().toEpochMilli()
            val intent = Intent(context, NaxaReminderReceiver::class.java)
                .putExtra("scheduleId", id).putExtra("scheduledAt", scheduled.toInstant().toEpochMilli())
            val pending = PendingIntent.getBroadcast(
                context, id.hashCode(), intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            val alarms = context.getSystemService(AlarmManager::class.java)
            if (Build.VERSION.SDK_INT >= 31 && alarms.canScheduleExactAlarms()) {
                alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, alarmAt, pending)
            } else {
                alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, alarmAt, pending)
            }
        } catch (_: Exception) {
            // Une programmation invalide ne doit pas empêcher les autres rappels.
        }
    }
}

class NaxaReminderReceiver : AndroidBroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val id = intent.getStringExtra("scheduleId") ?: return
        val prefs = context.getSharedPreferences("naxa_suivi_reminders", Context.MODE_PRIVATE)
        val raw = prefs.getString("schedule_" + id, null) ?: return
        try {
            val json = JSONObject(raw)
            if (!json.optBoolean("enabled", true)) return
            val type = json.optString("measurementType", "mesure")
            val freshness = json.optInt("freshnessWindowMinutes", 5).coerceIn(1, 1440) * 60_000L
            val last = prefs.getLong("last_" + type, 0L)
            val fresh = last > 0L && System.currentTimeMillis() - last <= freshness
            if (!fresh) {
                NaxaReminderScheduler.ensureChannel(context)
                val open = Intent(context, MainActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                    putExtra("openPath", "/suivi")
                }
                val pending = PendingIntent.getActivity(
                    context, id.hashCode(), open,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
                val notification = NotificationCompat.Builder(context, "naxa_suivi_measurements")
                    .setSmallIcon(android.R.drawable.ic_dialog_info)
                    .setContentTitle("NAXA · Mesure à actualiser")
                    .setContentText("Aucune donnée récente n'a été reçue. Vérifiez votre appareil et sa synchronisation.")
                    .setStyle(NotificationCompat.BigTextStyle().bigText(
                        "La mesure programmée approche et aucune donnée récente n'a été reçue. Ouvrez NAXA pour vérifier votre appareil."
                    ))
                    .setContentIntent(pending).setAutoCancel(true).setPriority(NotificationCompat.PRIORITY_HIGH)
                    .build()
                context.getSystemService(NotificationManager::class.java)
                    .notify(id.hashCode(), notification)
            }
            NaxaReminderScheduler.scheduleNext(context, id)
        } catch (_: Exception) {
            NaxaReminderScheduler.scheduleNext(context, id)
        }
    }
}

class NaxaBootReceiver : AndroidBroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) NaxaReminderScheduler.scheduleAll(context)
    }
}
