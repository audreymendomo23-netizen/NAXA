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
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.spec.GCMParameterSpec
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

class NaxaBleForegroundService : Service() {
    companion object {
        const val ACTION_CONNECT = "cm.naxa.app.BLE_CONNECT"
        const val ACTION_DISCONNECT = "cm.naxa.app.BLE_DISCONNECT"
        const val ACTION_STOP = "cm.naxa.app.BLE_STOP"
        const val ACTION_SCAN = "cm.naxa.app.BLE_SCAN"
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
            "1826" to "2AD2", "1816" to "2A5B",
            "180A" to "2A29", "180A" to "2A24", "180A" to "2A26",
            "180F" to "2A19"
        )
        private val DEVICE_SERVICE_FILTERS = mapOf(
            "tensiometre" to setOf("1810"),
            "thermometre" to setOf("1809"),
            "oxymetre" to setOf("1822"),
            "glucometre" to setOf("1808"),
            "balance" to setOf("181D"),
            "capteur_cardiaque_bluetooth" to setOf("180D"),
            "podometre" to setOf("1814", "1816"),
            "balance_impedance" to setOf("181B"),
            "montre_connectee" to setOf("180D", "1810", "1809", "1822", "1808", "181D", "181B", "1814", "1826", "1816"),
            "bracelet_activite" to setOf("180D", "1814", "1816", "1826")
        )
        private val CCCD = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb")
        fun enqueueEvent(context: android.content.Context, event: JSONObject) {
            val prefs = context.getSharedPreferences(PREFS, android.content.Context.MODE_PRIVATE)
            synchronized(NaxaBleForegroundService::class.java) {
                val queue = decryptQueue(prefs.getString(QUEUE_KEY, null))
                event.put("eventId", UUID.randomUUID().toString())
                queue.put(event)
                val hasOverflowMarker = queue.optJSONObject(0)?.optString("type") == "queueOverflow"
                val normalCapacity = 300
                if (queue.length() > normalCapacity) {
                    val droppedNow = if (hasOverflowMarker) queue.length() - 300 else queue.length() - 299
                    val previousDropped = if (hasOverflowMarker) queue.optJSONObject(0)?.optInt("droppedCount", 0) ?: 0 else 0
                    val bounded = JSONArray()
                    bounded.put(JSONObject()
                        .put("type", "queueOverflow")
                        .put("eventId", UUID.randomUUID().toString())
                        .put("droppedCount", previousDropped + droppedNow))
                    val firstRetained = maxOf(if (hasOverflowMarker) 2 else 1, queue.length() - 299)
                    for (index in firstRetained until queue.length()) bounded.put(queue.getJSONObject(index))
                    prefs.edit().putString(QUEUE_KEY, encryptQueue(bounded.toString())).apply()
                } else {
                    prefs.edit().putString(QUEUE_KEY, encryptQueue(queue.toString())).apply()
                }
            }
        }
        fun pendingEvents(context: android.content.Context): String =
            try { decryptQueue(context.getSharedPreferences(PREFS, android.content.Context.MODE_PRIVATE).getString(QUEUE_KEY, null)).toString() } catch (_: Exception) { "[]" }

        fun savedSessionOwners(context: android.content.Context): Set<String> {
            val prefs = context.getSharedPreferences(PREFS, android.content.Context.MODE_PRIVATE)
            val sessions = try { decryptQueue(prefs.getString(SESSIONS_KEY, null)) } catch (_: Exception) { JSONArray() }
            return (0 until sessions.length()).mapNotNull { index ->
                sessions.optJSONObject(index)?.optString("owner")?.takeIf { it.isNotBlank() }
            }.toSet()
        }

        fun requestScan(context: android.content.Context, ownerId: String) {
            val intent = Intent(context, NaxaBleForegroundService::class.java)
                .setAction(ACTION_SCAN).putExtra(EXTRA_OWNER, ownerId)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                androidx.core.content.ContextCompat.startForegroundService(context, intent)
            } else context.startService(intent)
        }

        fun requestConnect(context: android.content.Context, address: String, deviceKey: String, ownerId: String) {
            val intent = Intent(context, NaxaBleForegroundService::class.java)
                .setAction(ACTION_CONNECT)
                .putExtra(EXTRA_ADDRESS, address)
                .putExtra(EXTRA_KEY, deviceKey)
                .putExtra(EXTRA_OWNER, ownerId)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                androidx.core.content.ContextCompat.startForegroundService(context, intent)
            } else context.startService(intent)
        }

        fun requestDisconnect(context: android.content.Context, address: String) {
            val intent = Intent(context, NaxaBleForegroundService::class.java)
                .setAction(ACTION_DISCONNECT).putExtra(EXTRA_ADDRESS, address)
            context.startService(intent)
        }

        fun stopForLogout(context: android.content.Context) {
            val prefs = context.getSharedPreferences(PREFS, android.content.Context.MODE_PRIVATE)
            synchronized(NaxaBleForegroundService::class.java) {
                prefs.edit().putString(SESSIONS_KEY, "[]").commit()
            }
            context.stopService(Intent(context, NaxaBleForegroundService::class.java))
        }

        private const val KEY_ALIAS = "naxa_ble_measurement_queue_v1"

        private fun queueKey(): java.security.Key {
            val store = java.security.KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
            (store.getKey(KEY_ALIAS, null) as? java.security.Key)?.let { return it }
            val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
            generator.init(KeyGenParameterSpec.Builder(
                KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
            ).setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true).build())
            return generator.generateKey()
        }

        private fun encryptQueue(plain: String): String {
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.ENCRYPT_MODE, queueKey())
            val encrypted = cipher.doFinal(plain.toByteArray(Charsets.UTF_8))
            val combined = cipher.iv + encrypted
            return Base64.encodeToString(combined, Base64.NO_WRAP)
        }

        private fun decryptQueue(raw: String?): JSONArray {
            if (raw.isNullOrBlank()) return JSONArray()
            if (raw.trimStart().startsWith("[")) return JSONArray(raw)
            val combined = Base64.decode(raw, Base64.NO_WRAP)
            if (combined.size <= 12) return JSONArray()
            val iv = combined.copyOfRange(0, 12)
            val encrypted = combined.copyOfRange(12, combined.size)
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.DECRYPT_MODE, queueKey(), GCMParameterSpec(128, iv))
            return JSONArray(String(cipher.doFinal(encrypted), Charsets.UTF_8))
        }

        fun acknowledgeEvents(context: android.content.Context, ids: Set<String>) {
            if (ids.isEmpty()) return
            val prefs = context.getSharedPreferences(PREFS, android.content.Context.MODE_PRIVATE)
            synchronized(NaxaBleForegroundService::class.java) {
                val old = decryptQueue(prefs.getString(QUEUE_KEY, null))
                val next = JSONArray()
                for (index in 0 until old.length()) {
                    val item = old.optJSONObject(index) ?: continue
                    if (!ids.contains(item.optString("eventId"))) next.put(item)
                }
                prefs.edit().putString(QUEUE_KEY, encryptQueue(next.toString())).apply()
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
        val reads: ArrayDeque<BluetoothGattCharacteristic> = ArrayDeque(),
        val descriptorWrites: ArrayDeque<BluetoothGattDescriptor> = ArrayDeque()
    )

    private val handler = Handler(Looper.getMainLooper())
    private val sessions = linkedMapOf<String, DeviceSession>()
    private val bluetoothManager by lazy { getSystemService(BluetoothManager::class.java) }
    private val adapter: BluetoothAdapter? get() = bluetoothManager?.adapter
    private var foregroundStarted = false
    private var activeScanCallback: ScanCallback? = null
    private var scanTimeout: Runnable? = null
    private val discoveredAddresses = mutableSetOf<String>()

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                stopAll()
                stopSelf()
                return START_NOT_STICKY
            }
            ACTION_SCAN -> {
                if (!hasBleScanPermission()) {
                    enqueueEvent(this, JSONObject().put("type", "error")
                        .put("message", "Autorisation de recherche Bluetooth requise.")
                        .put("ownerUserId", intent.getStringExtra(EXTRA_OWNER).orEmpty()))
                    if (sessions.isEmpty()) stopSelf()
                    return START_NOT_STICKY
                }
                ensureForeground()
                startDeviceScan(intent.getStringExtra(EXTRA_OWNER).orEmpty())
            }
            ACTION_DISCONNECT -> {
                val address = intent.getStringExtra(EXTRA_ADDRESS).orEmpty()
                disconnectDevice(address)
                if (sessions.isEmpty()) stopSelf()
                return START_STICKY
            }
            ACTION_CONNECT -> {
                if (!hasBleRuntimePermission()) {
                    enqueueEvent(this, JSONObject().put("type", "error")
                        .put("message", "Autorisation Bluetooth requise pour démarrer la liaison.")
                        .put("ownerUserId", intent.getStringExtra(EXTRA_OWNER).orEmpty()))
                    stopSelf()
                    return START_NOT_STICKY
                }
                ensureForeground()
                val address = intent.getStringExtra(EXTRA_ADDRESS).orEmpty()
                val key = intent.getStringExtra(EXTRA_KEY).orEmpty()
                val owner = intent.getStringExtra(EXTRA_OWNER).orEmpty()
                if (address.isNotBlank() && key.isNotBlank() && owner.isNotBlank()) connect(address, key, owner)
            }
            else -> {
                val sessionsJson = savedSessions()
                if (sessionsJson.length() > 0) {
                    if (!hasBleRuntimePermission()) return START_NOT_STICKY
                    ensureForeground()
                    resumeSavedSessionsAfterAuth()
                }
            }
        }
        return START_STICKY
    }

    private fun hasBleScanPermission(): Boolean {
        val permission = if (Build.VERSION.SDK_INT >= 31) {
            android.Manifest.permission.BLUETOOTH_SCAN
        } else {
            android.Manifest.permission.ACCESS_FINE_LOCATION
        }
        return checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED
    }

    @Suppress("MissingPermission")
    private fun startDeviceScan(ownerId: String) {
        stopDeviceScan()
        val scanner = adapter?.bluetoothLeScanner
        if (scanner == null || adapter?.isEnabled != true) {
            enqueueEvent(this, JSONObject().put("type", "error")
                .put("message", "Bluetooth est désactivé ou le scanner est indisponible.")
                .put("ownerUserId", ownerId))
            if (sessions.isEmpty()) {
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
            }
            return
        }
        discoveredAddresses.clear()
        enqueueEvent(this, JSONObject().put("type", "scanning").put("ownerUserId", ownerId))
        val callback = object : ScanCallback() {
            override fun onScanResult(callbackType: Int, result: ScanResult) {
                val address = result.device.address ?: return
                if (!discoveredAddresses.add(address)) return
                val services = JSONArray()
                result.scanRecord?.serviceUuids?.forEach { services.put(it.toString()) }
                enqueueEvent(this@NaxaBleForegroundService, JSONObject()
                    .put("type", "deviceFound")
                    .put("deviceId", address)
                    .put("deviceName", safeName(result.device))
                    .put("rssi", result.rssi)
                    .put("serviceUuids", services)
                    .put("ownerUserId", ownerId))
            }

            override fun onScanFailed(errorCode: Int) {
                enqueueEvent(this@NaxaBleForegroundService, JSONObject().put("type", "error")
                    .put("message", "La recherche Bluetooth a échoué (code $errorCode).")
                    .put("ownerUserId", ownerId))
                stopDeviceScan()
                if (sessions.isEmpty()) {
                    stopForeground(STOP_FOREGROUND_REMOVE)
                    stopSelf()
                }
            }
        }
        activeScanCallback = callback
        try {
            scanner.startScan(null, ScanSettings.Builder()
                .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
                .build(), callback)
            val timeout = Runnable {
                stopDeviceScan()
                enqueueEvent(this, JSONObject().put("type", "scanFinished")
                    .put("deviceCount", discoveredAddresses.size)
                    .put("ownerUserId", ownerId))
                if (sessions.isEmpty()) {
                    stopForeground(STOP_FOREGROUND_REMOVE)
                    stopSelf()
                }
            }
            scanTimeout = timeout
            handler.postDelayed(timeout, 12000L)
        } catch (_: SecurityException) {
            enqueueEvent(this, JSONObject().put("type", "error")
                .put("message", "Permission Bluetooth refusée pendant la recherche.")
                .put("ownerUserId", ownerId))
            stopDeviceScan()
            if (sessions.isEmpty()) {
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
            }
        }
    }

    @Suppress("MissingPermission")
    private fun stopDeviceScan() {
        scanTimeout?.let(handler::removeCallbacks)
        scanTimeout = null
        val callback = activeScanCallback
        activeScanCallback = null
        if (callback != null) {
            try { adapter?.bluetoothLeScanner?.stopScan(callback) } catch (_: SecurityException) { }
        }
    }

    private fun hasBleRuntimePermission(): Boolean {
        val permission = if (Build.VERSION.SDK_INT >= 31) {
            android.Manifest.permission.BLUETOOTH_CONNECT
        } else {
            android.Manifest.permission.ACCESS_FINE_LOCATION
        }
        return checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED
    }

    private fun savedSessions(): JSONArray {
        val raw = getSharedPreferences(PREFS, android.content.Context.MODE_PRIVATE).getString(SESSIONS_KEY, null)
        return try { decryptQueue(raw) } catch (_: Exception) { JSONArray() }
    }

    private fun resumeSavedSessionsAfterAuth() {
        val saved = savedSessions()
        if (saved.length() == 0) return
        CoroutineScope(SupervisorJob() + Dispatchers.IO).launch {
            try {
                val profile = AuthRepository(SecureTokenStore(this@NaxaBleForegroundService)).restoreSession()
                if (profile == null) {
                    stopForLogout(this@NaxaBleForegroundService)
                    return@launch
                }
                val owners = savedSessionOwners(this@NaxaBleForegroundService)
                if (!owners.contains(profile.userId)) {
                    stopForLogout(this@NaxaBleForegroundService)
                    return@launch
                }
                handler.post {
                    val latest = savedSessions()
                    for (index in 0 until latest.length()) {
                        val item = latest.optJSONObject(index) ?: continue
                        if (item.optString("owner") == profile.userId) {
                            connect(item.optString("address"), item.optString("key"), item.optString("owner"))
                        }
                    }
                }
            } catch (_: Exception) {
                // Une panne réseau ne détruit pas les sessions persistées; aucune reconnexion n'est faite sans validation.
            }
        }
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
        var current = sessions[address]
        if (current != null && current.ownerId != ownerId) {
            disconnectDevice(address)
            current = null
        }
        if (current?.gatt != null) return
        val required = if (Build.VERSION.SDK_INT >= 31) android.Manifest.permission.BLUETOOTH_CONNECT
            else android.Manifest.permission.ACCESS_FINE_LOCATION
        if (checkSelfPermission(required) != PackageManager.PERMISSION_GRANTED) {
            enqueueEvent(this, JSONObject().put("type", "error").put("deviceId", address)
                .put("message", "Autorisation Bluetooth requise pour la liaison en arrière-plan.")
                .put("ownerUserId", ownerId))
            return
        }
        val device = try { adapter?.getRemoteDevice(address) } catch (_: Exception) { null }
        if (device == null || adapter?.isEnabled != true) {
            enqueueEvent(this, JSONObject().put("type", "error").put("deviceId", address)
                .put("message", "Appareil Bluetooth indisponible. Activez Bluetooth puis reconnectez-le.")
                .put("ownerUserId", ownerId))
            return
        }
        val session = current ?: DeviceSession(device, key, ownerId).also { sessions[address] = it }
        saveSessions()
        session.retryTask?.let(handler::removeCallbacks)
        session.retryTask = null
        session.gatt?.close()
        session.gatt = null
        enqueueEvent(this, JSONObject().put("type", "connecting").put("deviceId", address)
            .put("deviceKey", key).put("deviceName", safeName(device)).put("ownerUserId", ownerId))
        try {
            session.gatt = device.connectGatt(this, false, callback(session), BluetoothDevice.TRANSPORT_LE)
        } catch (_: SecurityException) {
            enqueueEvent(this, JSONObject().put("type", "error").put("deviceId", address)
                .put("message", "Autorisation Bluetooth refusée.")
                .put("ownerUserId", ownerId))
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
                    .put("deviceId", address).put("deviceKey", session.key).put("ownerUserId", session.ownerId)
                    .put("deviceName", safeName(session.device)))
                scheduleReconnect(session)
            }
        }

        override fun onServicesDiscovered(gatt: BluetoothGatt, status: Int) {
            if (status != BluetoothGatt.GATT_SUCCESS) {
                enqueueEvent(this@NaxaBleForegroundService, JSONObject().put("type", "error")
                    .put("deviceId", session.device.address).put("message", "Lecture des profils Bluetooth impossible.")
                    .put("ownerUserId", session.ownerId))
                return
            }
            var count = 0
            val allowedServices = DEVICE_SERVICE_FILTERS[session.key].orEmpty()
            for ((serviceId, characteristicId) in SERVICE_PAIRS) {
                if (serviceId !in allowedServices && serviceId != "180A" && serviceId != "180F") continue
                val characteristic = gatt.getService(uuid(serviceId))?.getCharacteristic(uuid(characteristicId)) ?: continue
                val properties = characteristic.properties
                if (serviceId in allowedServices && properties and (BluetoothGattCharacteristic.PROPERTY_NOTIFY or
                        BluetoothGattCharacteristic.PROPERTY_INDICATE or BluetoothGattCharacteristic.PROPERTY_READ) != 0) count++
                if (properties and (BluetoothGattCharacteristic.PROPERTY_NOTIFY or BluetoothGattCharacteristic.PROPERTY_INDICATE) != 0) {
                    if (gatt.setCharacteristicNotification(characteristic, true)) {
                        val descriptor = characteristic.getDescriptor(CCCD)
                        if (descriptor != null) {
                            val value = if (properties and BluetoothGattCharacteristic.PROPERTY_INDICATE != 0)
                                BluetoothGattDescriptor.ENABLE_INDICATION_VALUE else BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
                            descriptor.value = value
                            session.descriptorWrites.addLast(descriptor)
                        }
                    }
                }
                if (properties and BluetoothGattCharacteristic.PROPERTY_READ != 0) session.reads.addLast(characteristic)
            }
            enqueueEvent(this@NaxaBleForegroundService, JSONObject().put("type", "profiles")
                .put("deviceId", session.device.address).put("deviceKey", session.key).put("profileCount", count).put("ownerUserId", session.ownerId))
            performNextOperation(gatt, session)
        }

        @Deprecated("Android callback compatibility")
        override fun onCharacteristicChanged(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic) {
            saveMeasurement(session, characteristic, characteristic.value ?: byteArrayOf())
        }
        override fun onDescriptorWrite(gatt: BluetoothGatt, descriptor: BluetoothGattDescriptor, status: Int) {
            performNextOperation(gatt, session)
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
    private fun performNextOperation(gatt: BluetoothGatt, session: DeviceSession) {
        val descriptor = session.descriptorWrites.removeFirstOrNull()
        if (descriptor != null) {
            if (Build.VERSION.SDK_INT >= 33) {
                val status = gatt.writeDescriptor(descriptor, descriptor.value ?: BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE)
                if (status != android.bluetooth.BluetoothStatusCodes.SUCCESS) performNextOperation(gatt, session)
            } else {
                @Suppress("DEPRECATION")
                val accepted = gatt.writeDescriptor(descriptor)
                if (!accepted) performNextOperation(gatt, session)
            }
            return
        }
        val characteristic = session.reads.removeFirstOrNull() ?: return
        if (!gatt.readCharacteristic(characteristic)) performNextOperation(gatt, session)
    }

    @Suppress("MissingPermission")
    private fun handleRead(session: DeviceSession, gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic, bytes: ByteArray, status: Int) {
        if (status == BluetoothGatt.GATT_SUCCESS) {
            when (characteristic.uuid.toString().substring(4, 8).uppercase()) {
                "2A29" -> enqueueEvent(this, JSONObject().put("type", "deviceInfo").put("deviceId", session.device.address).put("metadataKey", "manufacturer").put("metadataValue", String(bytes, Charsets.UTF_8).trim()).put("ownerUserId", session.ownerId))
                "2A24" -> enqueueEvent(this, JSONObject().put("type", "deviceInfo").put("deviceId", session.device.address).put("metadataKey", "model").put("metadataValue", String(bytes, Charsets.UTF_8).trim()).put("ownerUserId", session.ownerId))
                "2A26" -> enqueueEvent(this, JSONObject().put("type", "deviceInfo").put("deviceId", session.device.address).put("metadataKey", "firmware").put("metadataValue", String(bytes, Charsets.UTF_8).trim()).put("ownerUserId", session.ownerId))
                "2A19" -> if (bytes.isNotEmpty()) enqueueEvent(this, JSONObject().put("type", "deviceInfo").put("deviceId", session.device.address).put("metadataKey", "battery_level").put("metadataValue", (bytes[0].toInt() and 0xff).toString()).put("ownerUserId", session.ownerId))
                else -> saveMeasurement(session, characteristic, bytes)
            }
        }
        performNextOperation(gatt, session)
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
        enqueueEvent(this, JSONObject().put("type", "disconnected").put("deviceId", address).put("deviceKey", session.key).put("ownerUserId", session.ownerId))
        saveSessions()
        if (sessions.isEmpty()) stopForeground(STOP_FOREGROUND_REMOVE)
    }

    private fun saveSessions() {
        val array = JSONArray()
        sessions.values.forEach { session ->
            array.put(JSONObject().put("address", session.device.address).put("key", session.key).put("owner", session.ownerId))
        }
        getSharedPreferences(PREFS, android.content.Context.MODE_PRIVATE).edit().putString(SESSIONS_KEY, encryptQueue(array.toString())).apply()
    }

    private fun stopAll() {
        stopDeviceScan()
        sessions.keys.toList().forEach(::disconnectDevice)
        sessions.clear()
        saveSessions()
        stopForeground(STOP_FOREGROUND_REMOVE)
    }

    private fun uuid(short: String): UUID =
        UUID.fromString("0000" + short.lowercase() + "-0000-1000-8000-00805f9b34fb")

    override fun onDestroy() {
        stopDeviceScan()
        stopAll()
        handler.removeCallbacksAndMessages(null)
        super.onDestroy()
    }
}
