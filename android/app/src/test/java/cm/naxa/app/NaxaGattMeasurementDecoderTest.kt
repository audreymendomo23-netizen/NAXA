package cm.naxa.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class NaxaGattMeasurementDecoderTest {
    @Test
    fun decodesHeartRateFromStandardGatt() {
        val result = NaxaGattMeasurementDecoder.decode("180D", "2A37", "0048", "device-a")
        assertEquals("frequence_cardiaque", result.single().measurementType)
        assertEquals(72.0, result.single().value, 0.0)
        assertEquals("bpm", result.single().unit)
    }

    @Test
    fun decodesBloodPressureIntoPersistableSystolicAndDiastolicValues() {
        val result = NaxaGattMeasurementDecoder.decode("1810", "2A35", "00780050005D00", "device-b")
        assertEquals(listOf("tension_systolique", "tension_diastolique"), result.map { it.measurementType })
        assertEquals(listOf(120.0, 80.0), result.map { it.value })
    }

    @Test
    fun decodesTemperatureAndOximetry() {
        val temperature = NaxaGattMeasurementDecoder.decode("00001809-0000-1000-8000-00805f9b34fb", "2A1C", "006D0100FF", "device-c")
        assertEquals(36.5, temperature.single().value, 0.0001)
        val oxygen = NaxaGattMeasurementDecoder.decode("1822", "2A5E", "0062004800", "device-d")
        assertEquals(listOf("saturation_oxygene", "frequence_cardiaque"), oxygen.map { it.measurementType })
        assertEquals(listOf(98.0, 72.0), oxygen.map { it.value })
    }

    @Test
    fun decodesWeightAndBodyComposition() {
        val weight = NaxaGattMeasurementDecoder.decode("181D", "2A9D", "004600", "device-e")
        assertEquals("poids", weight.single().measurementType)
        assertEquals(70.0, weight.single().value, 0.0)
        val composition = NaxaGattMeasurementDecoder.decode("181B", "2A9C", "0000FA00", "device-f")
        assertEquals("masse_grasse", composition.single().measurementType)
        assertEquals(25.0, composition.single().value, 0.0)
    }

    @Test
    fun rejectsMalformedAndUnknownFrames() {
        assertThrows(IllegalArgumentException::class.java) {
            NaxaGattMeasurementDecoder.decode("180D", "2A37", "00", "device-g")
        }
        assertThrows(UnsupportedOperationException::class.java) {
            NaxaGattMeasurementDecoder.decode("FFFF", "FFFF", "0102", "device-g")
        }
    }
}
