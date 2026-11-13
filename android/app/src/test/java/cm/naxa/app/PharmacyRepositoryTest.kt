package cm.naxa.app

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class PharmacyRepositoryTest {
    private val repository = PharmacyRepositoryTestParser()

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

        val result = repository.parse(payload).single()
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

/** Parser seam kept separate from Android's Location/HTTP services for JVM tests. */
private class PharmacyRepositoryTestParser {
    fun parse(payload: JSONObject): List<NearbyPharmacy> {
        val rows = payload.optJSONArray("pharmacies") ?: return emptyList()
        return buildList {
            for (index in 0 until rows.length()) {
                val item = rows.optJSONObject(index) ?: continue
                val id = item.optString("id")
                val name = item.optString("nom")
                if (id.isBlank() || name.isBlank()) continue
                add(
                    NearbyPharmacy(
                        id = id,
                        name = name,
                        city = item.nullable("ville"),
                        district = item.nullable("quartier"),
                        address = item.nullable("adresse"),
                        onDuty = item.optBoolean("de_garde", false),
                        deliveryAvailable = item.optBoolean("livraison_active", false),
                        distanceRoadKm = item.number("distanceRoutiereKm"),
                        distanceStraightKm = item.number("distanceKm")?.takeIf { it >= 0 },
                        travelMinutes = if (item.isNull("dureeTrajetMinutes")) null else item.optInt("dureeTrajetMinutes").takeIf { it >= 0 },
                        openingHours = item.nullable("horaires"),
                        mapsUrl = item.nullable("googleMapsUrl")
                    )
                )
            }
        }
    }

    private fun JSONObject.nullable(key: String): String? =
        optString(key).takeIf { it.isNotBlank() && it != "null" }

    private fun JSONObject.number(key: String): Double? =
        if (isNull(key)) null else optDouble(key, Double.NaN).takeIf { it.isFinite() }
}
