package cm.naxa.app

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ClientHistoryRepositoryTest {
    @Test
    fun parsesOnlyValidReservationIdsAndVerifiedPharmacyDetails() {
        val id = "11111111-2222-3333-4444-555555555555"
        val rows = JSONArray().put(
            JSONObject()
                .put("id", id).put("mode", "commande").put("statut", "payee")
                .put("commande_statut", "preparation").put("paiement_statut", "effectue")
                .put("paiement_ref", "TX-12345").put("total", 2750)
                .put("created_at", "2026-11-13T10:00:00Z")
                .put("pharmacies", JSONObject().put("nom", "Pharmacie Test").put("ville", "Yaoundé").put("quartier", "Bastos"))
        ).put(JSONObject().put("id", "not-a-uuid").put("mode", "reservation"))

        val result = parseClientReservationRows(rows)
        assertEquals(1, result.size)
        assertEquals("Pharmacie Test", result.single().pharmacy)
        assertEquals("Yaoundé", result.single().city)
        assertEquals(2750L, result.single().total)
        assertEquals("TX-12345", result.single().paymentReference)
    }

    @Test
    fun parsesPurchaseLinesWithoutInventingAmounts() {
        val id = "11111111-2222-3333-4444-555555555555"
        val rows = JSONArray().put(
            JSONObject()
                .put("reservation_id", id).put("produit_id", "product-1").put("medicament", "Paracétamol")
                .put("dosage", "500 mg").put("forme", "Comprimé").put("quantite", 2)
                .put("total_ligne", 1500).put("total_transaction", 1500).put("reference_paiement", "TX-12345")
                .put("pharmacie", "Pharmacie Test").put("ville", "Yaoundé").put("statut", "payee")
        ).put(JSONObject().put("reservation_id", "bad"))

        val result = parseClientPurchaseRows(rows)
        assertEquals(1, result.size)
        assertEquals("Paracétamol", result.single().medicine)
        assertEquals(2, result.single().quantity)
        assertEquals(1500L, result.single().lineTotal)
        assertTrue(result.single().purchasedAt == null)
    }

    @Test
    fun rejectsEventsWithoutValidReservationId() {
        val id = "11111111-2222-3333-4444-555555555555"
        val rows = JSONArray().put(
            JSONObject().put("id", "event-1").put("reservation_id", id)
                .put("event_type", "payment_verified").put("occurred_at", "2026-11-13T10:00:00Z")
        ).put(JSONObject().put("id", "event-2").put("reservation_id", "not-a-uuid"))

        val events = parseClientReservationEvents(rows)
        assertEquals(1, events.size)
        assertEquals("payment_verified", events.single().second.eventType)
        assertEquals(id, events.single().first)
    }
}
