package cm.naxa.app

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class CatalogueRepositoryTest {
    private val repository = CatalogueRepository()

    @Test
    fun parsesOnlyVerifiedPartnerStockAndPrice() {
        val payload = JSONObject(
            """
            {
              "results": [
                {
                  "id": "local-1",
                  "name": "Produit vérifié",
                  "activeIngredient": "Substance A",
                  "form": "Comprimé",
                  "availability": "disponible",
                  "partnerPharmacyCount": 2,
                  "lowestPartnerPrice": 1800,
                  "source": ["BDPM", "Catalogue local NAXA"]
                }
              ]
            }
            """.trimIndent()
        )

        val result = repository.parseMedicines(payload).single()
        assertEquals("Produit vérifié", result.name)
        assertEquals("disponible", result.availability)
        assertEquals(2, result.partnerPharmacyCount)
        assertEquals(1800L, result.lowestPartnerPrice)
        assertEquals(listOf("BDPM", "Catalogue local NAXA"), result.sources)
    }

    @Test
    fun doesNotInventPriceOrAvailabilityWhenNotVerified() {
        val payload = JSONObject(
            """
            {
              "results": [
                {
                  "id": "catalogue-1",
                  "name": "Produit sans stock vérifié",
                  "availability": "non_verifiee",
                  "partnerPharmacyCount": null,
                  "lowestPartnerPrice": null,
                  "source": ["RxNorm"]
                }
              ]
            }
            """.trimIndent()
        )

        val result = repository.parseMedicines(payload).single()
        assertEquals("non_verifiee", result.availability)
        assertNull(result.partnerPharmacyCount)
        assertNull(result.lowestPartnerPrice)
    }

    @Test
    fun ignoresMalformedCatalogueRows() {
        val payload = JSONObject(
            """
            {
              "results": [
                null,
                {"id": "missing-name"},
                {"name": "missing-id"},
                {"id": "valid", "name": "Valide", "availability": "non_verifiee"}
              ]
            }
            """.trimIndent()
        )

        val result = repository.parseMedicines(payload)
        assertEquals(1, result.size)
        assertEquals("valid", result.single().id)
    }
}
