package cm.naxa.app

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver as AndroidBroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import org.json.JSONObject
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.LocalTime

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

    fun updateFreshness(context: Context, measurementType: String, timestamp: Long, deviceId: String) {
        val edit = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putLong("last_" + measurementType, timestamp)
        if (deviceId.isNotBlank()) edit.putLong("last_" + measurementType + "_" + deviceId, timestamp)
        edit.apply()
    }

    fun scheduleAll(context: Context) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        prefs.all.keys.filter { it.startsWith("schedule_") }.forEach { scheduleNext(context, it.removePrefix("schedule_")) }
        prefs.all.keys.filter { it.startsWith("reminder_") }.forEach { schedulePersonalNext(context, it.removePrefix("reminder_")) }
    }

    fun notificationsEnabled(context: Context): Boolean =
        context.getSharedPreferences(PREFS,Context.MODE_PRIVATE).getBoolean("notifications_enabled",false)

    fun setNotificationsEnabled(context: Context, enabled: Boolean) {
        context.getSharedPreferences(PREFS,Context.MODE_PRIVATE).edit()
            .putBoolean("notifications_enabled",enabled).apply()
        if(enabled) scheduleAll(context) else {
            val prefs=context.getSharedPreferences(PREFS,Context.MODE_PRIVATE)
            prefs.all.keys.filter { it.startsWith("schedule_") }.forEach { id ->
                val key=id.removePrefix("schedule_")
                val intent=Intent(context,NaxaReminderReceiver::class.java).putExtra("scheduleId",key)
                context.getSystemService(AlarmManager::class.java).cancel(PendingIntent.getBroadcast(
                    context,key.hashCode(),intent,PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                ))
            }
            prefs.all.keys.filter { it.startsWith("reminder_") }.forEach { id ->
                val key=id.removePrefix("reminder_")
                val intent=Intent(context,NaxaReminderReceiver::class.java)
                    .putExtra("kind","personal").putExtra("scheduleId",key)
                context.getSystemService(AlarmManager::class.java).cancel(PendingIntent.getBroadcast(
                    context,key.hashCode() xor 0x5A17,intent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                ))
            }
        }
    }

    fun clearAll(context: Context) {
        val prefs=context.getSharedPreferences(PREFS,Context.MODE_PRIVATE)
        val ids=prefs.all.keys.filter { it.startsWith("schedule_") }.map { it.removePrefix("schedule_") }
        ids.forEach { remove(context,it) }
        val reminderIds=prefs.all.keys.filter { it.startsWith("reminder_") }.map { it.removePrefix("reminder_") }
        reminderIds.forEach { removePersonal(context,it) }
        prefs.edit().clear().apply()
    }

    fun sync(context: Context, raw: String) {
        val schedules=try { org.json.JSONArray(raw) } catch (_: Exception) { return }
        val prefs=context.getSharedPreferences(PREFS,Context.MODE_PRIVATE)
        val ids=prefs.all.keys.filter { it.startsWith("schedule_") }.map { it.removePrefix("schedule_") }
        ids.forEach { remove(context,it) }
        for(index in 0 until schedules.length()){
            val item=schedules.optJSONObject(index) ?: continue
            save(context,item.toString())
        }
    }

    fun savePersonal(context: Context, raw: String) {
        val json=try { JSONObject(raw) } catch (_: Exception) { return }
        val id=json.optString("id")
        if(id.isBlank())return
        context.getSharedPreferences(PREFS,Context.MODE_PRIVATE).edit()
            .putString("reminder_"+id,json.toString()).apply()
        schedulePersonalNext(context,id)
    }

    fun removePersonal(context: Context,id:String) {
        context.getSharedPreferences(PREFS,Context.MODE_PRIVATE).edit().remove("reminder_"+id).apply()
        val intent=Intent(context,NaxaReminderReceiver::class.java)
            .putExtra("kind","personal").putExtra("scheduleId",id)
        context.getSystemService(AlarmManager::class.java).cancel(PendingIntent.getBroadcast(
            context,id.hashCode() xor 0x5A17,intent,PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        ))
    }

    fun syncPersonal(context: Context,raw:String) {
        val reminders=try { org.json.JSONArray(raw) } catch (_: Exception) { return }
        val prefs=context.getSharedPreferences(PREFS,Context.MODE_PRIVATE)
        val ids=prefs.all.keys.filter { it.startsWith("reminder_") }.map { it.removePrefix("reminder_") }
        ids.forEach { removePersonal(context,it) }
        for(index in 0 until reminders.length()){
            val item=reminders.optJSONObject(index) ?: continue
            savePersonal(context,item.toString())
        }
    }

    fun schedulePersonalNext(context: Context,id:String) {
        val prefs=context.getSharedPreferences(PREFS,Context.MODE_PRIVATE)
        val raw=prefs.getString("reminder_"+id,null) ?: return
        if(!prefs.getBoolean("notifications_enabled",false))return
        try {
            val json=JSONObject(raw)
            if(!json.optBoolean("enabled",true)){removePersonal(context,id);return}
            val zone=ZoneId.of(json.optString("timezone","Africa/Douala"))
            val due=java.time.Instant.parse(json.getString("dueAt")).atZone(zone)
            val now=ZonedDateTime.now(zone)
            val repeat=json.optString("repeatRule","none")
            var next=due
            while(!next.isAfter(now)&&repeat=="daily")next=next.plusDays(1)
            while(!next.isAfter(now)&&repeat=="weekly")next=next.plusWeeks(1)
            if(!next.isAfter(now)){removePersonal(context,id);return}
            val intent=Intent(context,NaxaReminderReceiver::class.java)
                .putExtra("kind","personal").putExtra("scheduleId",id)
            val pending=PendingIntent.getBroadcast(
                context,id.hashCode() xor 0x5A17,intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            val alarms=context.getSystemService(AlarmManager::class.java)
            val at=next.toInstant().toEpochMilli()
            if(Build.VERSION.SDK_INT>=31&&alarms.canScheduleExactAlarms())alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,at,pending)
            else alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,at,pending)
        }catch(_:Exception){/* Rappel invalide : aucune alarme locale. */}
    }

    fun scheduleNext(context: Context, id: String) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val raw = prefs.getString("schedule_" + id, null) ?: return
        if(!prefs.getBoolean("notifications_enabled",false))return
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
        if(!NaxaReminderScheduler.notificationsEnabled(context))return
        if(intent.getStringExtra("kind")=="personal"){
            val reminderRaw=prefs.getString("reminder_"+id,null) ?: return
            try {
                val reminder=JSONObject(reminderRaw)
                if(!reminder.optBoolean("enabled",true))return
                val zone=ZoneId.of(reminder.optString("timezone","Africa/Douala"))
                val due=java.time.Instant.parse(reminder.getString("dueAt")).atZone(zone)
                val now=ZonedDateTime.now(zone)
                if(due.isAfter(now)){NaxaReminderScheduler.schedulePersonalNext(context,id);return}
                NaxaReminderScheduler.ensureChannel(context)
                val open=Intent(context,MainActivity::class.java).apply{
                    flags=Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                    putExtra("openPath","/suivi")
                }
                val pending=PendingIntent.getActivity(context,id.hashCode() xor 0x5A17,open,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
                val notification=android.app.Notification.Builder(context,"naxa_suivi_measurements")
                    .setSmallIcon(android.R.drawable.ic_dialog_info)
                    .setContentTitle(reminder.optString("title","Rappel NAXA"))
                    .setContentText("Votre rappel personnel arrive à échéance.")
                    .setStyle(android.app.Notification.BigTextStyle().bigText("Ouvrez NAXA pour consulter votre rappel de suivi."))
                    .setContentIntent(pending).setAutoCancel(true).build()
                context.getSystemService(NotificationManager::class.java).notify(id.hashCode() xor 0x5A17,notification)
                when(reminder.optString("repeatRule","none")){
                    "daily" -> {
                        var nextDue=due.plusDays(1)
                        while(!nextDue.isAfter(now))nextDue=nextDue.plusDays(1)
                        reminder.put("dueAt",nextDue.toInstant().toString())
                        prefs.edit().putString("reminder_"+id,reminder.toString()).apply()
                        NaxaReminderScheduler.schedulePersonalNext(context,id)
                    }
                    "weekly" -> {
                        var nextDue=due.plusWeeks(1)
                        while(!nextDue.isAfter(now))nextDue=nextDue.plusWeeks(1)
                        reminder.put("dueAt",nextDue.toInstant().toString())
                        prefs.edit().putString("reminder_"+id,reminder.toString()).apply()
                        NaxaReminderScheduler.schedulePersonalNext(context,id)
                    }
                    else -> NaxaReminderScheduler.removePersonal(context,id)
                }
            }catch(_:Exception){NaxaReminderScheduler.schedulePersonalNext(context,id)}
            return
        }
        val raw = prefs.getString("schedule_" + id, null) ?: return
        try {
            val json = JSONObject(raw)
            if (!json.optBoolean("enabled", true)) return
            val type = json.optString("measurementType", "mesure")
            val freshness = json.optInt("freshnessWindowMinutes", 5).coerceIn(1, 1440) * 60_000L
            val deviceId = json.optString("deviceId", "")
            val freshnessKey = if (deviceId.isNotBlank()) "last_" + type + "_" + deviceId else "last_" + type
            val last = prefs.getLong(freshnessKey, 0L)
            val age = System.currentTimeMillis() - last
            val fresh = last > 0L && age >= 0L && age <= freshness
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
                val notification = android.app.Notification.Builder(context, "naxa_suivi_measurements")
                    .setSmallIcon(android.R.drawable.ic_dialog_info)
                    .setContentTitle("NAXA · Mesure à actualiser")
                    .setContentText("Aucune donnée récente n'a été reçue. Vérifiez votre appareil et sa synchronisation.")
                    .setStyle(android.app.Notification.BigTextStyle().bigText(
                        "La mesure programmée approche et aucune donnée récente n'a été reçue. Ouvrez NAXA pour vérifier votre appareil."
                    ))
                    .setContentIntent(pending).setAutoCancel(true)
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
