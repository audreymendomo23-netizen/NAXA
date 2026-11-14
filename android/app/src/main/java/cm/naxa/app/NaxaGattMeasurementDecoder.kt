package cm.naxa.app

import java.time.LocalDateTime
import java.time.ZoneOffset
import kotlin.math.pow
import kotlin.math.round

data class NativeGattMeasurement(
    val measurementType: String,
    val value: Double,
    val unit: String,
    val measuredAt: String? = null
)

/**
 * Pure Kotlin decoder for the same Bluetooth SIG standard GATT profiles used by the PWA.
 * Only measurement types accepted by suivi_measurements are emitted.
 */
object NaxaGattMeasurementDecoder {
    private val cyclingCrankBaselines = mutableMapOf<String, Pair<Int, Int>>()

    fun decode(serviceUuid: String, characteristicUuid: String, payloadHex: String, deviceId: String): List<NativeGattMeasurement> {
        require(payloadHex.isNotBlank() && payloadHex.length % 2 == 0 && payloadHex.matches(Regex("[0-9a-fA-F]+"))) {
            "Trame Bluetooth hexadécimale invalide."
        }
        val bytes = ByteArray(payloadHex.length / 2) { index ->
            payloadHex.substring(index * 2, index * 2 + 2).toInt(16).toByte()
        }
        val service = shortUuid(serviceUuid)
        val characteristic = shortUuid(characteristicUuid)
        return when {
            service == "180D" && characteristic == "2A37" -> heartRate(bytes)
            service == "1810" && characteristic == "2A35" -> bloodPressure(bytes)
            service == "1809" && characteristic == "2A1C" -> temperature(bytes)
            service == "1822" && characteristic in setOf("2A5E", "2A5F") -> pulseOximeter(bytes, characteristic == "2A5F")
            service == "1808" && characteristic == "2A18" -> glucose(bytes)
            service == "181D" && characteristic == "2A9D" -> weight(bytes)
            service == "181B" && characteristic == "2A9C" -> bodyComposition(bytes)
            service == "1814" && characteristic == "2A53" -> runningSpeedCadence(bytes)
            service == "1826" && characteristic == "2AD2" -> indoorBike(bytes)
            service == "1816" && characteristic == "2A5B" -> cyclingSpeedCadence(bytes, deviceId)
            else -> throw UnsupportedOperationException("Profil GATT non pris en charge : $service/$characteristic")
        }
    }

    private fun shortUuid(value: String): String {
        val normalized = value.trim().removePrefix("0x").replace("-", "").uppercase()
        return if (normalized.length >= 8) normalized.substring(4, 8) else normalized
    }

    private fun requireBytes(bytes: ByteArray, endExclusive: Int, label: String) {
        require(endExclusive >= 0 && bytes.size >= endExclusive) { "$label : trame trop courte." }
    }

    private fun u8(bytes: ByteArray, offset: Int): Int {
        requireBytes(bytes, offset + 1, "Octet")
        return bytes[offset].toInt() and 0xff
    }

    private fun u16(bytes: ByteArray, offset: Int): Int {
        requireBytes(bytes, offset + 2, "UInt16")
        return u8(bytes, offset) or (u8(bytes, offset + 1) shl 8)
    }

    private fun i16(bytes: ByteArray, offset: Int): Int = u16(bytes, offset).let { if (it and 0x8000 != 0) it - 0x10000 else it }

    private fun u24(bytes: ByteArray, offset: Int): Int {
        requireBytes(bytes, offset + 3, "UInt24")
        return u8(bytes, offset) or (u8(bytes, offset + 1) shl 8) or (u8(bytes, offset + 2) shl 16)
    }

    private fun decodeSfloat(raw: Int): Double {
        if (raw in setOf(0x07ff, 0x0800, 0x0801, 0x0802, 0x0803)) throw IllegalArgumentException("Valeur SFLOAT Bluetooth non finie.")
        var mantissa = raw and 0x0fff
        if (mantissa and 0x0800 != 0) mantissa -= 0x1000
        var exponent = (raw shr 12) and 0x0f
        if (exponent and 0x08 != 0) exponent -= 0x10
        return mantissa * 10.0.pow(exponent)
    }

    private fun decodeIeee11073(bytes: ByteArray, offset: Int): Double {
        requireBytes(bytes, offset + 4, "IEEE-11073 FLOAT")
        val raw = u24(bytes, offset)
        var mantissa = raw
        if (mantissa and 0x00800000 != 0) mantissa -= 0x01000000
        var exponent = u8(bytes, offset + 3)
        if (exponent and 0x80 != 0) exponent -= 0x100
        val value = mantissa * 10.0.pow(exponent)
        require(value.isFinite()) { "Valeur IEEE-11073 invalide." }
        return value
    }

    private fun dateTime(bytes: ByteArray, offset: Int): String? {
        requireBytes(bytes, offset + 7, "Date Bluetooth")
        val year = u16(bytes, offset)
        val month = u8(bytes, offset + 2)
        val day = u8(bytes, offset + 3)
        val hour = u8(bytes, offset + 4)
        val minute = u8(bytes, offset + 5)
        val second = u8(bytes, offset + 6)
        if (year < 2000 || month !in 1..12 || day !in 1..31 || hour > 23 || minute > 59 || second > 59) return null
        return try {
            LocalDateTime.of(year, month, day, hour, minute, second).toInstant(ZoneOffset.UTC).toString()
        } catch (_: Exception) { null }
    }

    private fun value(type: String, amount: Double, unit: String, at: String? = null): List<NativeGattMeasurement> {
        if (!amount.isFinite()) return emptyList()
        return listOf(NativeGattMeasurement(type, round(amount * 10000.0) / 10000.0, unit, at))
    }

    private fun heartRate(bytes: ByteArray): List<NativeGattMeasurement> {
        requireBytes(bytes, 2, "Fréquence cardiaque")
        val flags = u8(bytes, 0)
        val bpm = if (flags and 1 != 0) u16(bytes, 1).also { requireBytes(bytes, 3, "Fréquence cardiaque 16 bits") } else u8(bytes, 1)
        require(bpm in 1..300) { "Fréquence cardiaque hors plage." }
        return value("frequence_cardiaque", bpm.toDouble(), "bpm")
    }

    private fun bloodPressure(bytes: ByteArray): List<NativeGattMeasurement> {
        requireBytes(bytes, 7, "Tension artérielle")
        val flags = u8(bytes, 0)
        val multiplier = if (flags and 1 != 0) 7.50062 else 1.0
        val systolic = decodeSfloat(u16(bytes, 1)) * multiplier
        val diastolic = decodeSfloat(u16(bytes, 3)) * multiplier
        val mean = decodeSfloat(u16(bytes, 5)) * multiplier
        var offset = 7
        var measuredAt: String? = null
        if (flags and 2 != 0) { measuredAt = dateTime(bytes, offset); offset += 7 }
        if (flags and 4 != 0) { requireBytes(bytes, offset + 2, "Pouls tensionnel"); offset += 2 }
        if (flags and 8 != 0) { requireBytes(bytes, offset + 1, "Identifiant utilisateur tensionnel"); offset++ }
        if (flags and 16 != 0) { requireBytes(bytes, offset + 2, "Statut tensionnel"); offset += 2 }
        require(listOf(systolic, diastolic, mean).all { it.isFinite() && it > 0 && it < 400 }) { "Valeurs de tension invalides." }
        return value("tension_systolique", systolic, "mmHg", measuredAt) +
            value("tension_diastolique", diastolic, "mmHg", measuredAt)
    }

    private fun temperature(bytes: ByteArray): List<NativeGattMeasurement> {
        requireBytes(bytes, 5, "Température")
        val flags = u8(bytes, 0)
        var offset = 1
        var measuredAt: String? = null
        if (flags and 2 != 0) { measuredAt = dateTime(bytes, offset); offset += 7 }
        val raw = decodeIeee11073(bytes, offset)
        val celsius = if (flags and 1 != 0) (raw - 32.0) * 5.0 / 9.0 else raw
        require(celsius in 20.0..50.0) { "Température hors plage prise en charge." }
        return value("temperature", celsius, "°C", measuredAt)
    }

    private fun pulseOximeter(bytes: ByteArray, continuous: Boolean): List<NativeGattMeasurement> {
        requireBytes(bytes, 5, "Oxymètre")
        val flags = u8(bytes, 0)
        val spo2 = decodeSfloat(u16(bytes, 1))
        val pulse = decodeSfloat(u16(bytes, 3))
        var offset = 5
        var measuredAt: String? = null
        if (!continuous && flags and 1 != 0) { measuredAt = dateTime(bytes, offset); offset += 7 }
        if (continuous) {
            if (flags and 1 != 0) offset += 4
            if (flags and 2 != 0) offset += 4
            if (flags and 4 != 0) offset += 2
            if (flags and 8 != 0) offset += 3
            if (flags and 16 != 0) offset += 2
        } else {
            if (flags and 2 != 0) { requireBytes(bytes, offset + 2, "Statut oxymètre"); offset += 2 }
            if (flags and 4 != 0) { requireBytes(bytes, offset + 3, "État capteur oxymètre"); offset += 3 }
            if (flags and 8 != 0) { requireBytes(bytes, offset + 2, "Amplitude oxymètre"); offset += 2 }
        }
        requireBytes(bytes, offset, "Champs facultatifs oxymètre")
        require(spo2 in 50.0..100.0 && pulse in 0.0..300.0) { "Résultat oxymètre invalide." }
        return value("saturation_oxygene", spo2, "%", measuredAt) +
            if (pulse > 0) value("frequence_cardiaque", pulse, "bpm", measuredAt) else emptyList()
    }

    private fun glucose(bytes: ByteArray): List<NativeGattMeasurement> {
        requireBytes(bytes, 10, "Glycémie")
        val flags = u8(bytes, 0)
        var offset = 3
        var measuredAt = dateTime(bytes, offset)
        offset += 7
        if (flags and 1 != 0) {
            requireBytes(bytes, offset + 2, "Décalage horaire glycémie")
            val minutes = i16(bytes, offset)
            offset += 2
            if (measuredAt != null) measuredAt = try {
                java.time.Instant.parse(measuredAt).plusSeconds(minutes * 60L).toString()
            } catch (_: Exception) { measuredAt }
        }
        require(flags and 2 != 0) { "Concentration glycémique absente." }
        requireBytes(bytes, offset + 4, "Concentration/type glycémie")
        val concentration = decodeSfloat(u16(bytes, offset))
        offset += 4
        if (flags and 8 != 0) offset += 2
        require(concentration.isFinite() && concentration > 0) { "Concentration glycémique invalide." }
        return value("glycemie", concentration, if (flags and 4 != 0) "mol/L" else "kg/L", measuredAt)
    }

    private fun weight(bytes: ByteArray): List<NativeGattMeasurement> {
        requireBytes(bytes, 3, "Balance")
        val flags = u8(bytes, 0)
        var offset = 1
        var weight = decodeSfloat(u16(bytes, offset)); offset += 2
        if (flags and 1 != 0) weight *= 0.45359237
        var measuredAt: String? = null
        if (flags and 2 != 0) { measuredAt = dateTime(bytes, offset); offset += 7 }
        if (flags and 4 != 0) { requireBytes(bytes, offset + 1, "Identifiant balance"); offset++ }
        val result = value("poids", weight, "kg", measuredAt).toMutableList()
        if (flags and 8 != 0) {
            requireBytes(bytes, offset + 4, "IMC/taille balance")
            val bmi = decodeSfloat(u16(bytes, offset)); offset += 2
            val height = decodeSfloat(u16(bytes, offset))
            if (bmi > 0 && bmi < 100) result += value("imc", bmi, "kg/m²", measuredAt)
            if (height > 0 && height < 3) result += value("taille", height * 100, "cm", measuredAt)
        }
        require(weight > 0 && weight < 500) { "Poids hors plage prise en charge." }
        return result
    }

    private fun bodyComposition(bytes: ByteArray): List<NativeGattMeasurement> {
        requireBytes(bytes, 4, "Composition corporelle")
        val flags = u16(bytes, 0)
        require(flags and 0x1000 == 0) { "Trame fragmentée de composition corporelle non prise en charge." }
        val imperial = flags and 1 != 0
        val values = mutableListOf<NativeGattMeasurement>()
        val fat = u16(bytes, 2) / 10.0
        if (fat in 0.0..100.0) values += value("masse_grasse", fat, "%")
        var offset = 4
        var measuredAt: String? = null
        if (flags and 2 != 0) { measuredAt = dateTime(bytes, offset); offset += 7 }
        if (flags and 4 != 0) { requireBytes(bytes, offset + 1, "Utilisateur balance"); offset++ }
        fun readU16(label: String): Int { requireBytes(bytes, offset + 2, label); val raw = u16(bytes, offset); offset += 2; return raw }
        fun mass(): Double = if (imperial) readU16("Masse corporelle") * 0.01 * 0.45359237 else readU16("Masse corporelle") * 0.005
        if (flags and 8 != 0) readU16("Métabolisme basal")
        if (flags and 16 != 0) readU16("Pourcentage musculaire")
        if (flags and 32 != 0) values += value("masse_musculaire", mass(), "kg", measuredAt)
        if (flags and 64 != 0) mass()
        if (flags and 128 != 0) mass()
        if (flags and 256 != 0) mass()
        if (flags and 512 != 0) readU16("Impédance")
        if (flags and 1024 != 0) values += value("poids", mass(), "kg", measuredAt)
        if (flags and 2048 != 0) {
            val rawHeight = readU16("Taille")
            val heightCm = if (imperial) rawHeight * 0.1 * 2.54 else rawHeight * 0.1
            values += value("taille", heightCm, "cm", measuredAt)
        }
        return values.map { it.copy(measuredAt = measuredAt ?: it.measuredAt) }
    }

    // These activity profiles are recognized, but their speed/cadence fields have no equivalent
    // in the current suivi_measurements type constraint; never relabel them as steps or duration.
    private fun runningSpeedCadence(bytes: ByteArray): List<NativeGattMeasurement> {
        requireBytes(bytes, 4, "Vitesse/course")
        val flags = u8(bytes, 0)
        val speed = u16(bytes, 1) / 256.0
        val cadence = u8(bytes, 3)
        var offset = 4
        val result = mutableListOf<NativeGattMeasurement>()
        if (speed in 0.0..25.0) result += value("vitesse_course", speed, "m/s")
        if (cadence <= 250) result += value("cadence_course", cadence.toDouble(), "pas/min")
        if (flags and 1 != 0) {
            requireBytes(bytes, offset + 2, "Longueur de foulée")
            val strideLength = u16(bytes, offset)
            if (strideLength in 1..300) result += value("longueur_foulee", strideLength.toDouble(), "cm")
            offset += 2
        }
        if (flags and 2 != 0) {
            requireBytes(bytes, offset + 4, "Distance totale de course")
            offset += 4
        }
        return result
    }

    private fun indoorBike(bytes: ByteArray): List<NativeGattMeasurement> {
        requireBytes(bytes, 2, "Vélo d'intérieur")
        val flags = u16(bytes, 0)
        var offset = 2
        val result = mutableListOf<NativeGattMeasurement>()
        if (flags and 1 == 0) {
            requireBytes(bytes, offset + 2, "Vitesse instantanée")
            val speedKmh = u16(bytes, offset) / 100.0
            offset += 2
            if (speedKmh in 0.0..100.0) result += value("vitesse_cyclisme", speedKmh, "km/h")
        }
        if (flags and 2 != 0) { requireBytes(bytes, offset + 2, "Vitesse moyenne"); offset += 2 }
        if (flags and 4 != 0) {
            requireBytes(bytes, offset + 2, "Cadence")
            val cadence = u16(bytes, offset) / 2.0
            offset += 2
            if (cadence in 0.0..250.0) result += value("cadence_course", cadence, "tr/min")
        }
        if (flags and 8 != 0) { requireBytes(bytes, offset + 2, "Cadence moyenne"); offset += 2 }
        if (flags and 16 != 0) { requireBytes(bytes, offset + 3, "Distance"); offset += 3 }
        if (flags and 32 != 0) { requireBytes(bytes, offset + 2, "Résistance"); offset += 2 }
        if (flags and 64 != 0) { requireBytes(bytes, offset + 2, "Puissance"); offset += 2 }
        if (flags and 128 != 0) { requireBytes(bytes, offset + 2, "Puissance moyenne"); offset += 2 }
        if (flags and 256 != 0) { requireBytes(bytes, offset + 5, "Énergie"); offset += 5 }
        if (flags and 512 != 0) {
            requireBytes(bytes, offset + 1, "Fréquence cardiaque vélo")
            val bpm = u8(bytes, offset++)
            if (bpm in 1..250) result += value("frequence_cardiaque", bpm.toDouble(), "bpm")
        }
        if (flags and 1024 != 0) { requireBytes(bytes, offset + 1, "Équivalent métabolique"); offset++ }
        if (flags and 2048 != 0) { requireBytes(bytes, offset + 2, "Temps écoulé"); offset += 2 }
        if (flags and 4096 != 0) { requireBytes(bytes, offset + 2, "Temps restant"); offset += 2 }
        return result
    }

    private fun cyclingSpeedCadence(bytes: ByteArray, deviceId: String): List<NativeGattMeasurement> {
        requireBytes(bytes, 1, "Cadence cyclisme")
        val flags = u8(bytes, 0)
        var offset = 1
        val previous = cyclingCrankBaselines[deviceId]
        if (flags and 1 != 0) { requireBytes(bytes, offset + 6, "Révolutions de roue"); offset += 6 }
        var result = emptyList<NativeGattMeasurement>()
        if (flags and 2 != 0) {
            requireBytes(bytes, offset + 4, "Révolutions pédalier")
            val revolutions = u16(bytes, offset)
            val eventTime = u16(bytes, offset + 2)
            if (previous != null) {
                val deltaRevolutions = (revolutions - previous.first + 65536) % 65536
                val deltaTicks = (eventTime - previous.second + 65536) % 65536
                if (deltaTicks > 0) {
                    val cadence = deltaRevolutions * 60.0 * 1024.0 / deltaTicks
                    if (cadence in 0.0..250.0) result = value("cadence_course", cadence, "tr/min")
                }
            }
            cyclingCrankBaselines[deviceId] = revolutions to eventTime
            if (cyclingCrankBaselines.size > 200) cyclingCrankBaselines.remove(cyclingCrankBaselines.keys.first())
        }
        return result
    }
}
