package cm.naxa.app

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class PharmacyRepositoryTest {
    

    @Test
    fun parsesPartnerPharmaciesAndRealRouteInformation() {
        val payload = JSONObject(
            """
            {
              "pharmacies": [
                {
                  "id": "ph-1",
                  "nom": "Pharmacie Réelle",
                  "ville": "Douala",
                  "quartier": "Akwa",
                  "adresse": "Rue Exemple",
                  "de_garde": true,
                  "livraison_active": true,
                  "distanceKm": 2.8,
                  "distanceRoutiereKm": 3.4,
                  "dureeTrajetMinutes": 11,
                  "horaires": "08:00-22:00",
                  "googleMapsUrl": "https://maps.google.com/?q=4.05,9.70"
                }
              ]
            }
            """.trimIndent()
        )

        val result = parseNearbyPharmacies(payload).single()
        assertEquals("ph-1", result.id)
        assertEquals("Pharmacie Réelle", result.name)
        assertEquals("Akwa", result.district)
        assertTrue(result.onDuty)
        assertTrue(result.deliveryAvailable)
        assertEquals(3.4, result.distanceRoadKm!!, 0.001)
        assertEquals(11, result.travelMinutes)
    }

    @Test
    fun doesNotInventDistanceOrIncludeMalformedPharmacies() {
        val payload = JSONObject(
            """
            {
              "pharmacies": [
                null,
                {"id": "missing-name"},
                {"nom": "missing-id"},
                {"id": "valid", "nom": "Pharmacie sans distance"}
              ]
            }
            """.trimIndent()
        )

        val result = repository.parse(payload)
        assertEquals(1, result.size)
        assertNull(result.single().distanceRoadKm)
        assertNull(result.single().distanceStraightKm)
        assertFalse(result.single().onDuty)
    }
}

