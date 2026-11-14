package cm.naxa.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class SuiviMeasurementFamiliesTest {
    @Test
    fun mapsDeviceCategoriesToTheirConsentFamily() {
        assertEquals("constantes", SuiviMeasurementFamilies.device("tensiometre"))
        assertEquals("metabolisme", SuiviMeasurementFamilies.device("balance_impedance"))
        assertEquals("activite", SuiviMeasurementFamilies.device("montre_connectee"))
        assertNull(SuiviMeasurementFamilies.device("unknown_device"))
    }

    @Test
    fun mapsPersistableMeasurementsToTheirConsentFamily() {
        assertEquals("constantes", SuiviMeasurementFamilies.measurement("frequence_cardiaque"))
        assertEquals("metabolisme", SuiviMeasurementFamilies.measurement("glycemie"))
        assertEquals("activite", SuiviMeasurementFamilies.measurement("pas_jour"))
        assertEquals("sommeil", SuiviMeasurementFamilies.measurement("sommeil_heures"))
        assertEquals("bien_etre", SuiviMeasurementFamilies.measurement("humeur_score"))
        assertEquals("traitements", SuiviMeasurementFamilies.measurement("medicament_pris"))
        assertNull(SuiviMeasurementFamilies.measurement("vitesse_cyclisme"))
    }
}
