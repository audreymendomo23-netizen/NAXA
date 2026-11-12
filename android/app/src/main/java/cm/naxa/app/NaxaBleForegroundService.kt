package cm.naxa.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothGattDescriptor
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

class NaxaBleForegroundService : Service() {
    companion object {
        const val ACTION_CONNECT = "cm.naxa.app.BLE_CONNECT"
        const val ACTION_DISCONNECT = "cm.naxa.app.BLE_DISCONNECT"
        const val ACTION_STOP = "cm.naxa.app.BLE_STOP"
        const val EXTRA_ADDRESS = "deviceAddress"
        const val EXTRA_KEY = "deviceKey"
        const val EXTRA_OWNER = "ownerUserId"
        const val EXTRA_NAME = "deviceName"
        private const val CHANNEL = "naxa_ble_background"
        private const val NOTIFICATION_ID = 8421
        private const val PREFS = "naxa_ble_background"
        private const val QUEUE_KEY = "pending_events"
        private const val SESSIONS_KEY = "active_sessions"
        private val SERVICE_PAIRS = listOf(
            "180D" to "2A37", "1810" to "2A35", "1809" to "2A1C",
            "1822" to "2A5E", "1822" to "2A5F", "1808" to "2A18",
            "181D" to "2A9D", "181B" to "2A9C", "1814" to "2A53",
            "1826" to "2AD2"
        )
        private val CCCD = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb")
        fun enqueueEvent(context: android.content.Context, event: JSONObject) {
            val prefs = context.getSharedPreferences(PREFS, android.content.Context.MODE_PRIVATE)
            synchronized(NaxaBleForegroundService::class.java) {
                val queue = try { JSONArray(prefs.getString(QUEUE_KEY, "[]")) } catch (_: Exception) { JSONArray() }
                event.put("eventId", UUID.randomUUID().toString())
                queue.put(event)
                val bounded = JSONArray()
                for (index in maxOf(0, queue.length() - 300)..queue.length() - 1) bounded.put(queue.getJSONObject(index))
                prefs.edit().putString(QUEUE_KEY, bounded.toString()).apply()
            }
        }
        fun pendingEvents(context: android.content.Context): String =
            context.getSharedPreferences(PREFS, android.content.Context.MODE_PRIVATE).getString(QUEUE_KEY, "[]") ?: "[]"
        fun acknowledgeEvents(context: android.content.Context, ids: Set<String>) {
            if (ids.isEmpty()) return
            val prefs = context.getSharedPreferences(PREFS, android.content.Context.MODE_PRIVATE)
            synchronized(NaxaBleForegroundService::class.java) {
                val old = try { JSONArray(prefs.getString(QUEUE_KEY, "[]")) } catch (_: Exception) { JSONArray() }
                val next = JSONArray()
                for (index in 0 until old.length()) {
                    val item = old.optJSONObject(index) ?: continue
                    if (!ids.contains(item.optString("eventId"))) next.put(item)
                }
                prefs.edit().putString(QUEUE_KEY, next.toString()).apply()
            }
        }
    }

    private data class DeviceSession(
        val device: BluetoothDevice,
        val key: String,
        val ownerId: String,
        var gatt: BluetoothGatt? = null,
        var retries: Int = 0,
        var retryTask: Runnable? = null,
        val reads: ArrayDeque<BluetoothGattCharacteristic> = ArrayDeque()
    )

    private val handler = Handler(Looper.getMainLooper())
    private val sessions = linkedMapOf<String, DeviceSession>()
    private val bluetoothManager by lazy { getSystemService(BluetoothManager::class.java) }
    private val adapter: BluetoothAdapter? get() = bluetoothManager?.adapter
    private var foregroundStarted = false

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                stopAll()
                stopSelf()
                return START_NOT_STICKY
            }
            ACTION_DISCONNECT -> {
                val address = intent.getStringExtra(EXTRA_ADDRESS).orEmpty()
                disconnectDevice(address)
                if (sessions.isEmpty()) stopSelf()
                return START_STICKY
            }
            ACTION_CONNECT -> {
                ensureForeground()
                val address = intent.getStringExtra(EXTRA_ADDRESS).orEmpty()
                val key = intent.getStringExtra(EXTRA_KEY).orEmpty()
                val owner = intent.getStringExtra(EXTRA_OWNER).orEmpty()
                if (address.isNotBlank() && key.isNotBlank() && owner.isNotBlank()) connect(address, key, owner)
            }
            else -> {
                val saved = getSharedPreferences(PREFS, android.content.Context.MODE_PRIVATE).getString(SESSIONS_KEY, "[]")
                val sessionsJson = try { JSONArray(saved) } catch (_: Exception) { JSONArray() }
                if (sessionsJson.length() > 0) ensureForeground()
                for (index in 0 until sessionsJson.length()) {
                    val item = sessionsJson.optJSONObject(index) ?: continue
                    connect(item.optString("address"), item.optString("key"), item.optString("owner"))
                }
            }
        }
        return START_STICKY
    }

    private fun ensureForeground() {
        if (foregroundStarted) return
        if (Build.VERSION.SDK_INT >= 26) {
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(NotificationChannel(
                CHANNEL, "Bluetooth NAXA en arrière-plan", NotificationManager.IMPORTANCE_LOW
            ).apply { description = "Maintient la liaison aux dispositifs autorisés pour synchroniser les mesures." })
        }
        val open = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("openPath", "/suivi")
        }
        val pending = PendingIntent.getActivity(this, 8421, open,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val notification = Notification.Builder(this, CHANNEL)
            .setSmallIcon(android.R.drawable.stat_sys_data_bluetooth)
            .setContentTitle("NAXA · Suivi Bluetooth actif")
            .setContentText("Synchronisation des appareils autorisés en arrière-plan.")
            .setContentIntent(pending)
            .setOngoing(true)
            .build()
        if (Build.VERSION.SDK_INT >= 29) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE)
        } else startForeground(NOTIFICATION_ID, notification)
        foregroundStarted = true
    }

    @Suppress("MissingPermission")
    private fun connect(address: String, key: String, ownerId: String) {
        val current = sessions[address]
        if (current?.gatt != null) return
        val required = if (Build.VERSION.SDK_INT >= 31) android.Manifest.permission.BLUETOOTH_CONNECT
            else android.Manifest.permission.ACCESS_FINE_LOCATION
        if (checkSelfPermission(required) != PackageManager.PERMISSION_GRANTED) {
            enqueueEvent(this, JSONObject().put("type", "error").put("deviceId", address)
                .put("message", "Autorisation Bluetooth requise pour la liaison en arrière-plan."))
            return
        }
        val device = try { adapter?.getRemoteDevice(address) } catch (_: Exception) { null }
        if (device == null || adapter?.isEnabled != true) {
            enqueueEvent(this, JSONObject().put("type", "error").put("deviceId", address)
                .put("message", "Appareil Bluetooth indisponible. Activez Bluetooth puis reconnectez-le."))
            return
        }
        val session = current ?: DeviceSession(device, key, ownerId).also { sessions[address] = it }
        saveSessions()
        session.retryTask?.let(handler::removeCallbacks)
        session.retryTask = null
        session.gatt?.close()
        session.gatt = null
        enqueueEvent(this, JSONObject().put("type", "connecting").put("deviceId", address)
            .put("deviceKey", key).put("deviceName", safeName(device)))
        try {
            session.gatt = device.connectGatt(this, false, callback(session), BluetoothDevice.TRANSPORT_LE)
        } catch (_: SecurityException) {
            enqueueEvent(this, JSONObject().put("type", "error").put("deviceId", address)
                .put("message", "Autorisation Bluetooth refusée."))
        }
    }

    @Suppress("MissingPermission")
    private fun callback(session: DeviceSession) = object : BluetoothGattCallback() {
        override fun onConnectionStateChange(gatt: BluetoothGatt, status: Int, newState: Int) {
            val address = session.device.address
            if (status == BluetoothGatt.GATT_SUCCESS && newState == BluetoothProfile.STATE_CONNECTED) {
                session.retries = 0
                enqueueEvent(this@NaxaBleForegroundService, JSONObject().put("type", "connected")
                    .put("deviceId", address).put("deviceKey", session.key)
                    .put("deviceName", safeName(session.device)).put("background", true).put("ownerUserId", session.ownerId))
                gatt.discoverServices()
            } else if (newState == BluetoothProfile.STATE_DISCONNECTED || status != BluetoothGatt.GATT_SUCCESS) {
                session.gatt?.close()
                session.gatt = null
                session.reads.clear()
                enqueueEvent(this@NaxaBleForegroundService, JSONObject().put("type", "disconnected")
                    .put("deviceId", address).put("deviceKey", session.key)
                    .put("deviceName", safeName(session.device)))
                scheduleReconnect(session)
            }
        }

        override fun onServicesDiscovered(gatt: BluetoothGatt, status: Int) {
            if (status != BluetoothGatt.GATT_SUCCESS) {
                enqueueEvent(this@NaxaBleForegroundService, JSONObject().put("type", "error")
                    .put("deviceId", session.device.address).put("message", "Lecture des profils Bluetooth impossible."))
                return
            }
            var count = 0
            for ((serviceId, characteristicId) in SERVICE_PAIRS) {
                val characteristic = gatt.getService(uuid(serviceId))?.getCharacteristic(uuid(characteristicId)) ?: continue
                val properties = characteristic.properties
                if (properties and (BluetoothGattCharacteristic.PROPERTY_NOTIFY or
                        BluetoothGattCharacteristic.PROPERTY_INDICATE or BluetoothGattCharacteristic.PROPERTY_READ) != 0) count++
                if (properties and (BluetoothGattCharacteristic.PROPERTY_NOTIFY or BluetoothGattCharacteristic.PROPERTY_INDICATE) != 0) {
                    if (gatt.setCharacteristicNotification(characteristic, true)) {
                        val descriptor = characteristic.getDescriptor(CCCD)
                        if (descriptor != null) {
                            val value = if (properties and BluetoothGattCharacteristic.PROPERTY_INDICATE != 0)
                                BluetoothGattDescriptor.ENABLE_INDICATION_VALUE else BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
                            if (Build.VERSION.SDK_INT >= 33) gatt.writeDescriptor(descriptor, value)
                            else {
                                @Suppress("DEPRECATION")
                                descriptor.value = value
                                @Suppress("DEPRECATION")
                                gatt.writeDescriptor(descriptor)
                            }
                        }
                    }
                }
                if (properties and BluetoothGattCharacteristic.PROPERTY_READ != 0) session.reads.addLast(characteristic)
            }
            enqueueEvent(this@NaxaBleForegroundService, JSONObject().put("type", "profiles")
                .put("deviceId", session.device.address).put("deviceKey", session.key).put("profileCount", count).put("ownerUserId", session.ownerId))
            if (session.reads.isNotEmpty()) gatt.readCharacteristic(session.reads.removeFirst())
        }

        @Deprecated("Android callback compatibility")
        override fun onCharacteristicChanged(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic) {
            saveMeasurement(session, characteristic, characteristic.value ?: byteArrayOf())
        }
        override fun onCharacteristicChanged(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic, value: ByteArray) {
            saveMeasurement(session, characteristic, value)
        }
        @Deprecated("Android callback compatibility")
        override fun onCharacteristicRead(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic, status: Int) {
            handleRead(session, gatt, characteristic, characteristic.value ?: byteArrayOf(), status)
        }
        override fun onCharacteristicRead(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic, value: ByteArray, status: Int) {
            handleRead(session, gatt, characteristic, value, status)
        }
    }

    @Suppress("MissingPermission")
    private fun handleRead(session: DeviceSession, gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic, bytes: ByteArray, status: Int) {
        if (status == BluetoothGatt.GATT_SUCCESS) {
            when (characteristic.uuid.toString().substring(4, 8).uppercase()) {
                "2A29" -> enqueueEvent(this, JSONObject().put("type", "deviceInfo").put("deviceId", session.device.address).put("metadataKey", "manufacturer").put("metadataValue", String(bytes, Charsets.UTF_8).trim()))
                "2A24" -> enqueueEvent(this, JSONObject().put("type", "deviceInfo").put("deviceId", session.device.address).put("metadataKey", "model").put("metadataValue", String(bytes, Charsets.UTF_8).trim()))
                "2A26" -> enqueueEvent(this, JSONObject().put("type", "deviceInfo").put("deviceId", session.device.address).put("metadataKey", "firmware").put("metadataValue", String(bytes, Charsets.UTF_8).trim()))
                "2A19" -> if (bytes.isNotEmpty()) enqueueEvent(this, JSONObject().put("type", "deviceInfo").put("deviceId", session.device.address).put("metadataKey", "battery_level").put("metadataValue", (bytes[0].toInt() and 0xff).toString()))
                else -> saveMeasurement(session, characteristic, bytes)
            }
        }
        if (session.reads.isNotEmpty()) {
            try { gatt.readCharacteristic(session.reads.removeFirst()) } catch (_: SecurityException) { }
        }
    }

    private fun saveMeasurement(session: DeviceSession, characteristic: BluetoothGattCharacteristic, bytes: ByteArray) {
        if (bytes.isEmpty()) return
        val payload = bytes.joinToString("") { "%02x".format(it) }
        enqueueEvent(this, JSONObject().put("type", "measurement")
            .put("deviceId", session.device.address).put("deviceKey", session.key)
            .put("deviceName", safeName(session.device)).put("ownerUserId", session.ownerId).put("serviceUuid", characteristic.service.uuid.toString())
            .put("characteristicUuid", characteristic.uuid.toString()).put("payloadHex", payload)
            .put("background", true))
    }

    @Suppress("MissingPermission")
    private fun safeName(device: BluetoothDevice): String =
        try { device.name?.takeIf { it.isNotBlank() } ?: "Appareil Bluetooth" }
        catch (_: SecurityException) { "Appareil Bluetooth" }

    private fun scheduleReconnect(session: DeviceSession) {
        if (!sessions.containsKey(session.device.address)) return
        val attempt = session.retries.coerceAtMost(8)
        session.retries++
        val delay = (1000L shl attempt).coerceAtMost(300000L)
        val task = Runnable { connect(session.device.address, session.key, session.ownerId) }
        session.retryTask = task
        handler.postDelayed(task, delay)
        enqueueEvent(this, JSONObject().put("type", "reconnecting")
            .put("deviceId", session.device.address).put("deviceKey", session.key).put("ownerUserId", session.ownerId)
            .put("message", "Reconnexion Bluetooth en arrière-plan programmée."))
    }

    @Suppress("MissingPermission")
    private fun disconnectDevice(address: String) {
        val session = sessions.remove(address) ?: return
        session.retryTask?.let(handler::removeCallbacks)
        session.gatt?.disconnect()
        session.gatt?.close()
        enqueueEvent(this, JSONObject().put("type", "disconnected").put("deviceId", address))
        saveSessions()
        if (sessions.isEmpty()) stopForeground(STOP_FOREGROUND_REMOVE)
    }

    private fun saveSessions() {
        val array = JSONArray()
        sessions.values.forEach { session ->
            array.put(JSONObject().put("address", session.device.address).put("key", session.key).put("owner", session.ownerId))
        }
        getSharedPreferences(PREFS, android.content.Context.MODE_PRIVATE).edit().putString(SESSIONS_KEY, array.toString()).apply()
    }

    private fun stopAll() {
        sessions.keys.toList().forEach(::disconnectDevice)
        sessions.clear()
        saveSessions()
        stopForeground(STOP_FOREGROUND_REMOVE)
    }

    private fun uuid(short: String): UUID =
        UUID.fromString("0000" + short.lowercase() + "-0000-1000-8000-00805f9b34fb")

    override fun onDestroy() {
        stopAll()
        handler.removeCallbacksAndMessages(null)
        super.onDestroy()
    }
}
