package cm.naxa.app

import android.Manifest
import android.app.Activity
import android.app.AlertDialog
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothGattDescriptor
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanResult
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.ValueCallback
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import org.json.JSONObject
import java.util.UUID

class MainActivity : Activity() {
    private lateinit var web: WebView
    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private val handler = Handler(Looper.getMainLooper())
    private val discovered = linkedMapOf<String, BluetoothDevice>()
    private val gatts = linkedMapOf<String, BluetoothGatt>()
    private val deviceKeys = linkedMapOf<String, String>()
    private val retryCounts = linkedMapOf<String, Int>()
    private val pendingReads = linkedMapOf<String, ArrayDeque<BluetoothGattCharacteristic>>()
    private var scanning = false
    private var pendingDeviceKey = "montre_connectee"
    private var pendingReconnectAddress: String? = null
    private val bluetoothManager by lazy { getSystemService(BluetoothManager::class.java) }
    private val adapter: BluetoothAdapter? get() = bluetoothManager?.adapter
    private val scanner get() = adapter?.bluetoothLeScanner
    private val servicePairs = listOf(
        "180D" to "2A37", "1810" to "2A35", "1809" to "2A1C",
        "1822" to "2A5E", "1822" to "2A5F", "1808" to "2A18",
        "181D" to "2A9D", "181B" to "2A9C", "1814" to "2A53"
    )
    private val cccd = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb")

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        web = WebView(this)
        web.settings.javaScriptEnabled = true
        web.settings.domStorageEnabled = true
        web.settings.databaseEnabled = true
        web.settings.mediaPlaybackRequiresUserGesture = true
        web.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                view: WebView?,
                callback: ValueCallback<Array<Uri>>?,
                params: FileChooserParams?
            ): Boolean {
                filePathCallback?.onReceiveValue(null)
                filePathCallback = callback
                val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = "*/*"
                    putExtra(Intent.EXTRA_MIME_TYPES, arrayOf("image/*", "application/pdf"))
                    putExtra(Intent.EXTRA_ALLOW_MULTIPLE, false)
                }
                return try {
                    startActivityForResult(intent, 703)
                    true
                } catch (_: Exception) {
                    filePathCallback?.onReceiveValue(null)
                    filePathCallback = null
                    false
                }
            }
        }
        web.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val uri = request?.url ?: return false
                if (uri.scheme == "https" && uri.host == "nnaxa.vercel.app") return false
                if (uri.scheme == "https") {
                    try { startActivity(Intent(Intent.ACTION_VIEW, uri)) } catch (_: Exception) { }
                }
                return true
            }
        }
        web.addJavascriptInterface(NaxaBridge(), "NaxaAndroid")
        setContentView(web)
        NaxaReminderScheduler.ensureChannel(this)
        NaxaReminderScheduler.scheduleAll(this)
        web.loadUrl(BuildConfig.NAXA_BASE_URL + (intent.getStringExtra("openPath") ?: "/suivi"))
    }

    inner class NaxaBridge {
        @JavascriptInterface fun isAvailable(): Boolean = true
        @JavascriptInterface fun startScan(deviceKey: String) {
            pendingDeviceKey = deviceKey.take(80)
            runOnUiThread { ensureBluetoothPermissionsAndScan() }
        }
        @JavascriptInterface fun disconnect(address: String) {
            runOnUiThread {
                deviceKeys.remove(address)
                retryCounts.remove(address)
                gatts.remove(address)?.disconnect()
            }
        }
        @JavascriptInterface fun reconnect(address: String, deviceKey: String) {
            pendingDeviceKey = deviceKey.take(80)
            pendingReconnectAddress = address.take(80)
            runOnUiThread { ensureBluetoothPermissionsAndReconnect() }
        }
        @JavascriptInterface fun stopScan() { runOnUiThread { stopBleScan() } }
        @JavascriptInterface fun requestNotifications() {
            runOnUiThread {
                if (Build.VERSION.SDK_INT >= 33 &&
                    checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
                ) requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 704)
                else NaxaReminderScheduler.ensureChannel(this@MainActivity)
            }
        }
        @JavascriptInterface fun scheduleMeasurementReminder(raw: String) {
            runOnUiThread {
                NaxaReminderScheduler.ensureChannel(this@MainActivity)
                NaxaReminderScheduler.save(this@MainActivity, raw.take(4000))
                if (Build.VERSION.SDK_INT >= 33 &&
                    checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
                ) requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 704)
            }
        }
        @JavascriptInterface fun cancelMeasurementReminder(id: String) {
            runOnUiThread { NaxaReminderScheduler.remove(this@MainActivity, id.take(120)) }
        }
        @JavascriptInterface fun updateMeasurementFreshness(measurementType: String, timestampMillis: Long, deviceId: String) {
            NaxaReminderScheduler.updateFreshness(this@MainActivity, measurementType.take(100), timestampMillis, deviceId.take(120))
        }
    }

    private fun ensureBluetoothPermissionsAndScan() {
        val required = if (Build.VERSION.SDK_INT >= 31) arrayOf(
            Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT
        ) else arrayOf(Manifest.permission.ACCESS_FINE_LOCATION)
        val missing = required.filter { checkSelfPermission(it) != PackageManager.PERMISSION_GRANTED }
        if (missing.isNotEmpty()) { requestPermissions(missing.toTypedArray(), 701); return }
        if (adapter?.isEnabled != true || scanner == null) {
            emit("error", message = "Activez le Bluetooth Android puis réessayez."); return
        }
        discovered.clear(); scanning = true
        try { scanner?.startScan(scanCallback) } catch (_: SecurityException) {
            scanning = false; emit("error", message = "Autorisation Bluetooth refusée."); return
        }
        emit("scanning", message = "Recherche des appareils Bluetooth à proximité…")
        handler.postDelayed({ showDiscoveredDevices() }, 10000)
    }

    @Suppress("MissingPermission")
    private fun ensureBluetoothPermissionsAndReconnect() {
        val required = if (Build.VERSION.SDK_INT >= 31) arrayOf(
            Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT
        ) else arrayOf(Manifest.permission.ACCESS_FINE_LOCATION)
        val missing = required.filter { checkSelfPermission(it) != PackageManager.PERMISSION_GRANTED }
        if (missing.isNotEmpty()) { requestPermissions(missing.toTypedArray(), 702); return }
        val address = pendingReconnectAddress ?: return
        if (adapter?.isEnabled != true) { emit("error", deviceId = address, message = "Activez le Bluetooth Android pour reconnecter l'appareil."); return }
        try { connect(adapter!!.getRemoteDevice(address)) }
        catch (_: Exception) { emit("error", deviceId = address, message = "Appareil mémorisé indisponible. Relancez une recherche Bluetooth."); }
    }

    @Deprecated("Android activity result compatibility")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == 703) {
            val callback = filePathCallback
            filePathCallback = null
            val uri = if (resultCode == RESULT_OK) data?.data else null
            callback?.onReceiveValue(if (uri != null) arrayOf(uri) else null)
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == 701) {
            if (grantResults.isNotEmpty() && grantResults.all { it == PackageManager.PERMISSION_GRANTED }) ensureBluetoothPermissionsAndScan()
            else emit("error", message = "Autorisation Bluetooth nécessaire pour détecter les appareils.")
        } else if (requestCode == 702) {
            if (grantResults.isNotEmpty() && grantResults.all { it == PackageManager.PERMISSION_GRANTED }) ensureBluetoothPermissionsAndReconnect()
            else emit("error", deviceId = pendingReconnectAddress, message = "Autorisation Bluetooth nécessaire pour reconnecter l'appareil.")
        } else if (requestCode == 704) {
            if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                NaxaReminderScheduler.ensureChannel(this)
            }
        }
    }

    private val scanCallback = object : ScanCallback() {
        override fun onScanResult(callbackType: Int, result: ScanResult) {
            val address = result.device.address ?: return
            discovered[address] = result.device
        }
        override fun onScanFailed(errorCode: Int) {
            scanning = false; emit("error", message = "Recherche Bluetooth interrompue (code $errorCode).")
        }
    }

    private fun stopBleScan() {
        if (!scanning) return
        try { scanner?.stopScan(scanCallback) } catch (_: SecurityException) { }
        scanning = false
    }

    @Suppress("MissingPermission")
    private fun showDiscoveredDevices() {
        stopBleScan()
        val entries = discovered.values.toList()
        if (entries.isEmpty()) {
            emit("error", message = "Aucun appareil détecté. Rapprochez l'appareil, réveillez-le et relancez la recherche."); return
        }
        val labels = entries.map { device ->
            val name = try { device.name } catch (_: SecurityException) { null }
            (name?.takeIf { it.isNotBlank() } ?: "Appareil Bluetooth") + " · " + device.address
        }.toTypedArray()
        AlertDialog.Builder(this).setTitle("Choisir l'appareil à connecter")
            .setItems(labels) { _, index -> connect(entries[index]) }
            .setNegativeButton("Annuler") { _, _ -> emit("cancelled") }.show()
    }

    @Suppress("MissingPermission")
    private fun connect(device: BluetoothDevice) {
        val address = device.address
        deviceKeys[address] = pendingDeviceKey
        emit("connecting", deviceId = address, deviceName = safeName(device))
        gatts.remove(address)?.close()
        val gatt = device.connectGatt(this, false, gattCallback, BluetoothDevice.TRANSPORT_LE)
        if (gatt == null) emit("error", deviceId = address, message = "Connexion Bluetooth impossible.")
        else gatts[address] = gatt
    }

    @Suppress("MissingPermission")
    private fun safeName(device: BluetoothDevice): String =
        try { device.name?.takeIf { it.isNotBlank() } ?: "Appareil Bluetooth" } catch (_: SecurityException) { "Appareil Bluetooth" }

    private val gattCallback = object : BluetoothGattCallback() {
        override fun onConnectionStateChange(gatt: BluetoothGatt, status: Int, newState: Int) {
            val address = gatt.device.address
            if (status == BluetoothGatt.GATT_SUCCESS && newState == BluetoothProfile.STATE_CONNECTED) {
                retryCounts[address] = 0
                emit("connected", deviceId = address, deviceName = safeName(gatt.device), deviceKey = deviceKeys[address])
                gatt.discoverServices()
            } else if (newState == BluetoothProfile.STATE_DISCONNECTED || status != BluetoothGatt.GATT_SUCCESS) {
                gatt.close()
                gatts.remove(address)
                val retry = retryCounts[address] ?: 0
                if (deviceKeys.containsKey(address) && retry < 5) {
                    retryCounts[address] = retry + 1
                    val delay = (1000L shl retry).coerceAtMost(30000L)
                    emit("reconnecting", deviceId = address, deviceName = safeName(gatt.device), message = "Reconnexion automatique dans quelques instants…")
                    handler.postDelayed({
                        if (deviceKeys.containsKey(address) && !gatts.containsKey(address)) connect(gatt.device)
                    }, delay)
                } else {
                    emit("disconnected", deviceId = address, deviceName = safeName(gatt.device),
                        message = if (deviceKeys.containsKey(address)) "Reconnexion automatique suspendue après plusieurs échecs." else "Appareil déconnecté.")
                    retryCounts.remove(address)
                    deviceKeys.remove(address)
                }
            }
        }

        override fun onServicesDiscovered(gatt: BluetoothGatt, status: Int) {
            if (status != BluetoothGatt.GATT_SUCCESS) {
                emit("error", deviceId = gatt.device.address, message = "Lecture des profils Bluetooth impossible."); return
            }
            var subscribed = 0
            val readQueue = ArrayDeque<BluetoothGattCharacteristic>()
            for ((serviceShort, characteristicShort) in servicePairs) {
                val service = gatt.getService(uuid(serviceShort)) ?: continue
                val characteristic = service.getCharacteristic(uuid(characteristicShort)) ?: continue
                val properties = characteristic.properties
                if (properties and (BluetoothGattCharacteristic.PROPERTY_NOTIFY or BluetoothGattCharacteristic.PROPERTY_INDICATE or BluetoothGattCharacteristic.PROPERTY_READ) != 0) subscribed++
                if (properties and BluetoothGattCharacteristic.PROPERTY_NOTIFY != 0 ||
                    properties and BluetoothGattCharacteristic.PROPERTY_INDICATE != 0) {
                    if (gatt.setCharacteristicNotification(characteristic, true)) {
                        val descriptor = characteristic.getDescriptor(cccd)
                        if (descriptor != null) {
                            if (Build.VERSION.SDK_INT >= 33) {
                                gatt.writeDescriptor(descriptor, if (properties and BluetoothGattCharacteristic.PROPERTY_INDICATE != 0)
                                    BluetoothGattDescriptor.ENABLE_INDICATION_VALUE else BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE)
                            } else {
                                @Suppress("DEPRECATION")
                                descriptor.value = if (properties and BluetoothGattCharacteristic.PROPERTY_INDICATE != 0)
                                    BluetoothGattDescriptor.ENABLE_INDICATION_VALUE else BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
                                @Suppress("DEPRECATION")
                                gatt.writeDescriptor(descriptor)
                            }
                        }
                    }
                }
                if (properties and BluetoothGattCharacteristic.PROPERTY_READ != 0) {
                    readQueue.addLast(characteristic)
                }
            }
            val infoService = gatt.getService(uuid("180A"))
            listOf("2A29", "2A24", "2A26").forEach { short ->
                val characteristic = infoService?.getCharacteristic(uuid(short))
                if (characteristic != null && characteristic.properties and BluetoothGattCharacteristic.PROPERTY_READ != 0) {
                    readQueue.addLast(characteristic)
                }
            }
            val batteryService = gatt.getService(uuid("180F"))
            val battery = batteryService?.getCharacteristic(uuid("2A19"))
            if (battery != null && battery.properties and BluetoothGattCharacteristic.PROPERTY_READ != 0) {
                readQueue.addLast(battery)
            }
            pendingReads[gatt.device.address] = readQueue
            if (readQueue.isNotEmpty()) {
                try { gatt.readCharacteristic(readQueue.removeFirst()) } catch (_: SecurityException) { }
            }
            emit("profiles", deviceId = gatt.device.address, profileCount = subscribed)
        }

        @Deprecated("Android callback compatibility")
        override fun onCharacteristicChanged(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic) {
            emitMeasurement(gatt, characteristic, characteristic.value ?: byteArrayOf())
        }
        override fun onCharacteristicChanged(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic, value: ByteArray) {
            emitMeasurement(gatt, characteristic, value)
        }
        @Deprecated("Android callback compatibility")
        override fun onCharacteristicRead(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic, status: Int) {
            handleCharacteristicRead(gatt, characteristic, characteristic.value ?: byteArrayOf(), status)
        }

        override fun onCharacteristicRead(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic, value: ByteArray, status: Int) {
            handleCharacteristicRead(gatt, characteristic, value, status)
        }

        private fun handleCharacteristicRead(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic, bytes: ByteArray, status: Int) {
            if (status == BluetoothGatt.GATT_SUCCESS) {
                val short = characteristic.uuid.toString().substring(4, 8).uppercase()
                when (short) {
                    "2A29" -> emit("deviceInfo", deviceId = gatt.device.address, metadataKey = "manufacturer", metadataValue = String(bytes, Charsets.UTF_8).trim())
                    "2A24" -> emit("deviceInfo", deviceId = gatt.device.address, metadataKey = "model", metadataValue = String(bytes, Charsets.UTF_8).trim())
                    "2A26" -> emit("deviceInfo", deviceId = gatt.device.address, metadataKey = "firmware", metadataValue = String(bytes, Charsets.UTF_8).trim())
                    "2A19" -> if (bytes.isNotEmpty()) emit("deviceInfo", deviceId = gatt.device.address, metadataKey = "battery_level", metadataValue = (bytes[0].toInt() and 0xff).toString())
                    else -> emitMeasurement(gatt, characteristic, bytes)
                }
            }
            val queue = pendingReads[gatt.device.address]
            if (queue != null && queue.isNotEmpty()) {
                try { gatt.readCharacteristic(queue.removeFirst()) } catch (_: SecurityException) { }
            } else pendingReads.remove(gatt.device.address)
        }
    }

    private fun emitMeasurement(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic, bytes: ByteArray) {
        val payload = bytes.joinToString("") { "%02x".format(it) }
        emit("measurement", deviceId = gatt.device.address, deviceName = safeName(gatt.device),
            deviceKey = deviceKeys[gatt.device.address], serviceUuid = characteristic.service.uuid.toString(),
            characteristicUuid = characteristic.uuid.toString(), payloadHex = payload)
    }

    private fun uuid(short: String): UUID = UUID.fromString("0000" + short.lowercase() + "-0000-1000-8000-00805f9b34fb")

    private fun emit(type: String, message: String? = null, deviceId: String? = null,
                     deviceName: String? = null, deviceKey: String? = null,
                     serviceUuid: String? = null, characteristicUuid: String? = null,
                     payloadHex: String? = null, profileCount: Int? = null,
                     metadataKey: String? = null, metadataValue: String? = null) {
        val data = JSONObject().put("type", type)
        message?.let { data.put("message", it) }
        deviceId?.let { data.put("deviceId", it) }
        deviceName?.let { data.put("deviceName", it) }
        deviceKey?.let { data.put("deviceKey", it) }
        serviceUuid?.let { data.put("serviceUuid", it) }
        characteristicUuid?.let { data.put("characteristicUuid", it) }
        payloadHex?.let { data.put("payloadHex", it) }
        profileCount?.let { data.put("profileCount", it) }
        metadataKey?.let { data.put("metadataKey", it) }
        metadataValue?.let { data.put("metadataValue", it) }
        val script = "window.dispatchEvent(new CustomEvent('naxa-android-ble',{detail:" + data.toString() + "}))"
        runOnUiThread { if (::web.isInitialized) web.evaluateJavascript(script, null) }
    }

    override fun onDestroy() {
        stopBleScan()
        gatts.values.forEach { try { it.disconnect(); it.close() } catch (_: Exception) { } }
        gatts.clear()
        web.removeJavascriptInterface("NaxaAndroid")
        web.destroy()
        super.onDestroy()
    }

    @Deprecated("Back navigation compatibility")
    override fun onBackPressed() {
        if (::web.isInitialized && web.canGoBack()) web.goBack() else super.onBackPressed()
    }
}
